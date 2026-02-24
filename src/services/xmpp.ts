/**
 * XMPP Service — xmpp.js implementation
 *
 * @see cross-cutting/TECH_COMPARISON.md for rationale
 * @see services/interfaces.ts for contract
 */

import { client, xml, jid as parseJid } from '@xmpp/client';
import type { Element } from '@xmpp/client';
import type {
  XMPPService,
  EncryptedPayload,
  ConnectionStatus,
  PresenceShow,
  Observable,
  Unsubscribe,
} from './interfaces';

// Dev server configuration
// Simulators use localhost, physical devices use Mac's LAN IP
const DEV_SERVER_LAN_IP = '10.10.15.75'; // Mac's LAN IP for physical device testing (update when network changes)

type XMPPClient = ReturnType<typeof client>;

// XEP-0357 Push Notifications namespace
const NS_PUSH = 'urn:xmpp:push:0';

// Firebase Cloud Messaging push service node
// This is configured in Prosody's mod_cloud_notify
const FCM_PUSH_SERVICE = 'push.commeazy.local'; // Prosody push component

// Call signaling namespace (custom for CommEazy)
const NS_CALL = 'urn:commeazy:call:1';

// Call signaling payload type (matches types in call/types.ts)
interface CallSignalingPayload {
  type: 'offer' | 'answer' | 'ice-candidate' | 'hangup' | 'decline' | 'busy' | 'ringing' | 'invite';
  callId: string;
  [key: string]: unknown;
}

export class XmppJsService implements XMPPService {
  private xmpp: XMPPClient | null = null;
  private status: ConnectionStatus = 'disconnected';
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private messageHandlers: Set<(from: string, payload: EncryptedPayload, id: string) => void> = new Set();
  private presenceHandlers: Set<(from: string, show: PresenceShow) => void> = new Set();
  private receiptHandlers: Set<(messageId: string, from: string) => void> = new Set();
  private callSignalingHandlers: Set<(from: string, payload: CallSignalingPayload) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000; // 30 seconds
  private pushEnabled = false;

  async connect(userJid: string, password: string): Promise<void> {
    const parsed = parseJid(userJid);

    // Use WebSocket for both dev and production (React Native requires WebSocket)
    // Dev: local Prosody on port 5280 (HTTP WebSocket), Production: commeazy.nl (HTTPS)
    let service: string;
    let isPhysical = false;

    if (__DEV__) {
      // In dev mode, determine if this is a physical device or simulator
      // Physical devices need to use the Mac's LAN IP, simulators use localhost
      isPhysical = await this.isPhysicalDevice();
      const host = isPhysical ? DEV_SERVER_LAN_IP : 'localhost';
      service = `ws://${host}:5280/xmpp-websocket`;
      console.log(`[XMPP] Using dev server: ${service} (physical: ${isPhysical})`);
    } else {
      service = 'wss://commeazy.nl:5281/xmpp-websocket';
    }

    console.log(`[XMPP] Creating client with: service=${service}, domain=${parsed.domain}, username=${parsed.local}`);

    this.xmpp = client({
      service,
      domain: parsed.domain,
      username: parsed.local,
      password,
    });

    console.log(`[XMPP] Client created, isSecure type: ${typeof this.xmpp.isSecure}, isSecure(): ${this.xmpp.isSecure()}`);

    // WORKAROUND: Mark LAN connections as secure for SASL PLAIN auth in dev mode
    // The @xmpp/client library refuses PLAIN auth over non-secure connections
    // but our LAN IP (10.10.15.75) is not in the whitelist (localhost, 127.0.0.1, ::1)
    // This is safe for dev mode since we're on a trusted local network
    if (__DEV__ && isPhysical) {
      // Override isSecure() to always return true for dev LAN
      // This is checked by SASL mechanism selection in createOnAuthenticate.js
      this.xmpp.isSecure = () => {
        console.log('[XMPP] isSecure() override called, returning true for dev LAN');
        return true;
      };
      console.log('[XMPP] Patched isSecure() for physical device on LAN');
    }

    // Debug: Log XMPP events only in dev mode (SECURITY: may contain sensitive data)
    if (__DEV__) {
      this.xmpp.on('input', (data: string) => {
        // Only log stanza type, not content (security)
        const stanzaType = data.match(/<(\w+)/)?.[1] || 'unknown';
        console.log(`[XMPP] <<< INPUT: <${stanzaType}...>`);
      });
      this.xmpp.on('output', (data: string) => {
        // Only log stanza type, not content (security)
        const stanzaType = data.match(/<(\w+)/)?.[1] || 'unknown';
        console.log(`[XMPP] >>> OUTPUT: <${stanzaType}...>`);
      });
    }

    this.setupEventHandlers();

    this.setStatus('connecting');
    await this.xmpp.start();
  }

  /**
   * Check if running on a physical iOS device (not simulator).
   * Physical devices can't connect to localhost - they need the Mac's LAN IP.
   */
  private async isPhysicalDevice(): Promise<boolean> {
    try {
      const DeviceInfo = await import('react-native-device-info');
      const isEmulator = await DeviceInfo.default.isEmulator();
      console.log(`[XMPP] Device check: isEmulator=${isEmulator}`);
      return !isEmulator;
    } catch {
      // If DeviceInfo is not available, assume simulator (safer default)
      console.log('[XMPP] DeviceInfo not available, assuming simulator');
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.xmpp) {
      await this.xmpp.stop();
      this.xmpp = null;
    }
    this.setStatus('disconnected');
  }

  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  observeConnectionStatus(): Observable<ConnectionStatus> {
    return {
      subscribe: (observer) => {
        this.statusListeners.add(observer);
        observer(this.status); // Emit current value
        return () => this.statusListeners.delete(observer);
      },
    };
  }

  async sendMessage(to: string, payload: EncryptedPayload, messageId: string): Promise<void> {
    this.ensureConnected();
    await this.xmpp!.send(
      xml('message', { to, type: 'chat', id: messageId },
        xml('body', {}, JSON.stringify(payload)),
        xml('request', { xmlns: 'urn:xmpp:receipts' }),
      ),
    );
  }

  async sendDeliveryReceipt(to: string, messageId: string): Promise<void> {
    this.ensureConnected();
    await this.xmpp!.send(
      xml('message', { to },
        xml('received', { xmlns: 'urn:xmpp:receipts', id: messageId }),
      ),
    );
  }

  async sendPresence(show?: 'chat' | 'away' | 'xa' | 'dnd'): Promise<void> {
    this.ensureConnected();
    const stanza = show
      ? xml('presence', {}, xml('show', {}, show))
      : xml('presence', {});
    await this.xmpp!.send(stanza);
  }

  /**
   * Send unavailable presence (going offline/background).
   * This notifies contacts immediately that user is offline.
   *
   * NOTE: On iOS, this must complete very quickly before the app is suspended.
   * We use a small timeout to ensure the packet is flushed.
   */
  async sendUnavailable(): Promise<void> {
    console.log(`[XMPP] sendUnavailable called, status: ${this.status}, xmpp: ${this.xmpp ? 'exists' : 'null'}`);

    if (!this.xmpp) {
      console.log('[XMPP] No XMPP client, skipping unavailable presence');
      return;
    }

    if (this.status !== 'connected') {
      console.log(`[XMPP] Not connected (status: ${this.status}), skipping unavailable presence`);
      return;
    }

    try {
      console.log('[XMPP] Sending unavailable presence stanza...');
      await this.xmpp.send(xml('presence', { type: 'unavailable' }));
      console.log('[XMPP] Unavailable presence sent successfully');

      // Small delay to ensure packet is flushed before iOS suspends the app
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log('[XMPP] Packet flush delay completed');
    } catch (error) {
      console.error('[XMPP] Failed to send unavailable presence:', error);
    }
  }

  /**
   * Subscribe to a contact's presence (request to see their online status).
   * The contact must accept the subscription for it to work.
   */
  async subscribeToPresence(contactJid: string): Promise<void> {
    this.ensureConnected();
    await this.xmpp!.send(
      xml('presence', { to: contactJid, type: 'subscribe' }),
    );
    if (__DEV__) {
      console.log('[XMPP] Sent presence subscription request');
    }
  }

  /**
   * Probe a contact's current presence status.
   * Use this to get the current status of a contact you're already subscribed to.
   */
  async probePresence(contactJid: string): Promise<void> {
    this.ensureConnected();
    await this.xmpp!.send(
      xml('presence', { to: contactJid, type: 'probe' }),
    );
    if (__DEV__) {
      console.log('[XMPP] Sent presence probe');
    }
  }

  async joinMUC(roomJid: string, nickname: string): Promise<void> {
    this.ensureConnected();
    await this.xmpp!.send(
      xml('presence', { to: `${roomJid}/${nickname}` },
        xml('x', { xmlns: 'http://jabber.org/protocol/muc' }),
      ),
    );
  }

  async leaveMUC(roomJid: string): Promise<void> {
    this.ensureConnected();
    await this.xmpp!.send(
      xml('presence', { to: roomJid, type: 'unavailable' }),
    );
  }

  async sendMUCMessage(roomJid: string, payload: EncryptedPayload, messageId: string): Promise<void> {
    this.ensureConnected();
    await this.xmpp!.send(
      xml('message', { to: roomJid, type: 'groupchat', id: messageId },
        xml('body', {}, JSON.stringify(payload)),
      ),
    );
  }

  onMessage(handler: (from: string, payload: EncryptedPayload, id: string) => void): Unsubscribe {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onPresence(handler: (from: string, show: PresenceShow) => void): Unsubscribe {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  onDeliveryReceipt(handler: (messageId: string, from: string) => void): Unsubscribe {
    this.receiptHandlers.add(handler);
    return () => this.receiptHandlers.delete(handler);
  }

  // ---- Call Signaling (WebRTC P2P Calls) ----

  /**
   * Send call signaling payload to a specific user.
   * Used for WebRTC SDP/ICE exchange and call control.
   *
   * @param to - The JID of the recipient
   * @param payload - The call signaling payload (offer, answer, ice-candidate, etc.)
   */
  async sendCallSignaling(to: string, payload: CallSignalingPayload): Promise<void> {
    this.ensureConnected();

    // Create call stanza with JSON payload
    const stanza = xml('message', { to, type: 'chat', id: `call-${payload.callId}-${Date.now()}` },
      xml('call', { xmlns: NS_CALL }, JSON.stringify(payload)),
      // Don't request delivery receipt for call signaling (too noisy)
    );

    await this.xmpp!.send(stanza);

    if (__DEV__) {
      console.log(`[XMPP] Sent call signaling: ${payload.type} to ${to.split('@')[0]}`);
    }
  }

  /**
   * Register handler for incoming call signaling messages.
   * Used by CallService to handle WebRTC negotiation.
   *
   * @param handler - Callback receiving (from, payload)
   * @returns Unsubscribe function
   */
  onCallSignaling(handler: (from: string, payload: CallSignalingPayload) => void): Unsubscribe {
    this.callSignalingHandlers.add(handler);
    return () => this.callSignalingHandlers.delete(handler);
  }

  // ---- Push Notifications (XEP-0357) ----

  /**
   * Enable push notifications by registering the FCM token with Prosody.
   *
   * This uses XEP-0357 Push Notifications to tell Prosody to send a push
   * notification via Firebase Cloud Messaging when we receive a message
   * while offline.
   *
   * The node format supports dual-token for iOS:
   * - iOS: "apns:<hex-token>|fcm:<fcm-token>" (allows direct APNs for dev)
   * - Android: "<fcm-token>" (FCM only)
   *
   * The IQ stanza looks like:
   * <iq type='set' id='x42'>
   *   <enable xmlns='urn:xmpp:push:0' jid='push.commeazy.local' node='token_here'>
   *     <x xmlns='jabber:x:data' type='submit'>
   *       <field var='FORM_TYPE'><value>http://jabber.org/protocol/pubsub#publish-options</value></field>
   *     </x>
   *   </enable>
   * </iq>
   *
   * @param fcmToken - The Firebase Cloud Messaging device token
   * @param apnsToken - The APNs device token (hex string, iOS only)
   */
  async enablePushNotifications(fcmToken: string, apnsToken?: string): Promise<void> {
    this.ensureConnected();

    // Build the node value - for iOS include both tokens
    let nodeValue: string;
    if (apnsToken) {
      // iOS: include both APNs (for direct push) and FCM (for fallback)
      nodeValue = `apns:${apnsToken}|fcm:${fcmToken}`;
      console.log('[XMPP] Enabling push notifications with APNs + FCM tokens...');
    } else {
      // Android or iOS without APNs token
      nodeValue = fcmToken;
      console.log('[XMPP] Enabling push notifications with FCM token...');
    }

    try {
      // Build the XEP-0357 enable stanza
      const enableStanza = xml('iq', { type: 'set', id: `push-enable-${Date.now()}` },
        xml('enable', { xmlns: NS_PUSH, jid: FCM_PUSH_SERVICE, node: nodeValue },
          // Optional: publish options for the push service
          xml('x', { xmlns: 'jabber:x:data', type: 'submit' },
            xml('field', { var: 'FORM_TYPE' },
              xml('value', {}, 'http://jabber.org/protocol/pubsub#publish-options'),
            ),
            // Include device info for debugging
            xml('field', { var: 'device' },
              xml('value', {}, apnsToken ? 'ios' : 'android'),
            ),
          ),
        ),
      );

      await this.xmpp!.send(enableStanza);
      this.pushEnabled = true;
      console.log('[XMPP] Push notifications enabled successfully');
    } catch (error) {
      console.error('[XMPP] Failed to enable push notifications:', error);
      throw error;
    }
  }

  /**
   * Disable push notifications by unregistering from Prosody.
   *
   * The IQ stanza looks like:
   * <iq type='set' id='x43'>
   *   <disable xmlns='urn:xmpp:push:0' jid='push.commeazy.local' node='fcm_token_here'/>
   * </iq>
   */
  async disablePushNotifications(): Promise<void> {
    this.ensureConnected();

    if (!this.pushEnabled) {
      console.log('[XMPP] Push notifications already disabled');
      return;
    }

    console.log('[XMPP] Disabling push notifications...');

    try {
      const disableStanza = xml('iq', { type: 'set', id: `push-disable-${Date.now()}` },
        xml('disable', { xmlns: NS_PUSH, jid: FCM_PUSH_SERVICE }),
      );

      await this.xmpp!.send(disableStanza);
      this.pushEnabled = false;
      console.log('[XMPP] Push notifications disabled successfully');
    } catch (error) {
      console.error('[XMPP] Failed to disable push notifications:', error);
      throw error;
    }
  }

  // ---- Private ----

  private setupEventHandlers(): void {
    if (!this.xmpp) return;

    this.xmpp.on('online', async () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected');

      // Send initial presence to receive presence updates from contacts
      try {
        await this.sendPresence();
        console.log('[XMPP] Sent initial presence');
      } catch (error) {
        console.warn('[XMPP] Failed to send initial presence:', error);
      }
    });

    this.xmpp.on('offline', () => {
      this.setStatus('disconnected');
      void this.attemptReconnect();
    });

    this.xmpp.on('error', (error: Error) => {
      console.error('[XMPP] Error event:', error?.message || error, error?.stack?.substring(0, 300));
      this.setStatus('error');
    });

    this.xmpp.on('stanza', (stanza: Element) => {
      if (stanza.is('message')) {
        this.handleIncomingMessage(stanza);
      } else if (stanza.is('presence')) {
        this.handleIncomingPresence(stanza);
      }
    });
  }

  private handleIncomingMessage(stanza: Element): void {
    const from = stanza.attrs.from as string | undefined;
    const id = stanza.attrs.id as string | undefined;

    // Guard against missing 'from' attribute
    if (!from) {
      console.warn('[XMPP] Received message without from attribute, ignoring');
      return;
    }

    // Check for delivery receipt
    const received = stanza.getChild('received', 'urn:xmpp:receipts');
    if (received) {
      const receiptId = received.attrs.id as string;
      this.receiptHandlers.forEach(h => h(receiptId, from));
      return;
    }

    // Check for call signaling stanza
    const callElement = stanza.getChild('call', NS_CALL);
    if (callElement) {
      this.handleIncomingCallSignaling(from, callElement);
      return;
    }

    // Check for message body
    const body = stanza.getChildText('body');
    if (body) {
      // SECURITY: Never log message content - only log that a message was received
      if (__DEV__) {
        console.log('[XMPP] Received message (content hidden for security)');
      }
      try {
        const payload = JSON.parse(body) as EncryptedPayload;
        if (__DEV__) {
          console.log(`[XMPP] Parsed encrypted payload, mode: ${payload.mode}`);
        }
        this.messageHandlers.forEach(h => h(from, payload, id));

        // Send delivery receipt
        void this.sendDeliveryReceipt(from, id);
      } catch (parseError) {
        // Not a valid JSON payload — likely plain text from non-CommEazy client
        // SECURITY: Don't log message content
        if (__DEV__) {
          console.warn('[XMPP] Message is not encrypted JSON format');
        }
      }
    }
  }

  /**
   * Handle incoming call signaling stanzas.
   * Parses the JSON payload and notifies registered handlers.
   */
  private handleIncomingCallSignaling(from: string, callElement: Element): void {
    try {
      const jsonPayload = callElement.text();
      if (!jsonPayload) {
        console.warn('[XMPP] Empty call signaling payload');
        return;
      }

      const payload = JSON.parse(jsonPayload) as CallSignalingPayload;

      if (__DEV__) {
        console.log(`[XMPP] Received call signaling: ${payload.type} from ${from.split('@')[0]}`);
      }

      // Notify all registered handlers
      this.callSignalingHandlers.forEach((handler) => {
        try {
          handler(from, payload);
        } catch (handlerError) {
          console.error('[XMPP] Call signaling handler error:', handlerError);
        }
      });
    } catch (parseError) {
      console.error('[XMPP] Failed to parse call signaling payload:', parseError);
    }
  }

  private handleIncomingPresence(stanza: Element): void {
    const from = stanza.attrs.from as string | undefined;
    const type = stanza.attrs.type as string | undefined;

    // Guard against missing 'from' attribute
    if (!from) {
      console.warn('[XMPP] Received presence without from attribute, ignoring');
      return;
    }

    // Handle subscription requests - auto-accept to enable bidirectional presence
    if (type === 'subscribe') {
      if (__DEV__) {
        console.log('[XMPP] Received subscription request, auto-accepting');
      }
      // Accept the subscription request
      void this.xmpp!.send(xml('presence', { to: from, type: 'subscribed' }));
      // Also subscribe back to them (mutual subscription)
      void this.xmpp!.send(xml('presence', { to: from, type: 'subscribe' }));
      return;
    }

    // Handle subscription acceptance - request current presence
    if (type === 'subscribed') {
      if (__DEV__) {
        console.log('[XMPP] Subscription accepted, requesting current presence');
      }
      // Send presence probe to get the contact's current status
      void this.xmpp!.send(xml('presence', { to: from, type: 'probe' }));
      return;
    }

    // Handle unavailable (offline)
    if (type === 'unavailable') {
      if (__DEV__) {
        console.log('[XMPP] Presence: contact is now offline');
      }
      this.presenceHandlers.forEach(h => h(from, 'offline'));
      return;
    }

    // Handle regular presence updates with <show> element
    // XMPP presence <show> values: chat, away, xa, dnd
    // No <show> element means "available" (online and ready)
    const showElement = stanza.getChildText('show');
    let show: PresenceShow;

    switch (showElement) {
      case 'chat':
        show = 'chat';      // Free to chat / actively looking
        break;
      case 'away':
        show = 'away';      // Temporarily away
        break;
      case 'xa':
        show = 'xa';        // Extended away
        break;
      case 'dnd':
        show = 'dnd';       // Do not disturb
        break;
      default:
        show = 'available'; // Online and available (no <show> = available)
    }

    if (__DEV__) {
      console.log(`[XMPP] Presence update: ${show}`);
    }
    this.presenceHandlers.forEach(h => h(from, show));
  }

  private async attemptReconnect(): Promise<void> {
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;

    await new Promise(resolve => setTimeout(resolve, delay));

    if (this.xmpp && this.status !== 'connected') {
      this.setStatus('connecting');
      try {
        await this.xmpp.start();
      } catch {
        // Will trigger offline event → retry
      }
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach(l => l(status));
  }

  private ensureConnected(): void {
    if (!this.xmpp || this.status !== 'connected') {
      throw new Error('XMPP not connected');
    }
  }
}
