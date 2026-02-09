/**
 * XMPP Service — xmpp.js implementation
 *
 * @see cross-cutting/TECH_COMPARISON.md for rationale
 * @see services/interfaces.ts for contract
 */

import { client, xml, jid as parseJid, Element } from '@xmpp/client';
import type {
  XMPPService,
  EncryptedPayload,
  ConnectionStatus,
  Observable,
  Unsubscribe,
} from './interfaces';

type XMPPClient = ReturnType<typeof client>;

export class XmppJsService implements XMPPService {
  private xmpp: XMPPClient | null = null;
  private status: ConnectionStatus = 'disconnected';
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private messageHandlers: Set<(from: string, payload: EncryptedPayload, id: string) => void> = new Set();
  private presenceHandlers: Set<(from: string, status: 'online' | 'offline') => void> = new Set();
  private receiptHandlers: Set<(messageId: string, from: string) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000; // 30 seconds

  async connect(userJid: string, password: string): Promise<void> {
    const parsed = parseJid(userJid);

    this.xmpp = client({
      service: 'wss://commeazy.nl:5281/xmpp-websocket',
      domain: parsed.domain,
      username: parsed.local,
      password,
    });

    this.setupEventHandlers();

    this.setStatus('connecting');
    await this.xmpp.start();
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

  onPresence(handler: (from: string, status: 'online' | 'offline') => void): Unsubscribe {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  onDeliveryReceipt(handler: (messageId: string, from: string) => void): Unsubscribe {
    this.receiptHandlers.add(handler);
    return () => this.receiptHandlers.delete(handler);
  }

  // ---- Private ----

  private setupEventHandlers(): void {
    if (!this.xmpp) return;

    this.xmpp.on('online', () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected');
    });

    this.xmpp.on('offline', () => {
      this.setStatus('disconnected');
      void this.attemptReconnect();
    });

    this.xmpp.on('error', () => {
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
    const from = stanza.attrs.from as string;
    const id = stanza.attrs.id as string;

    // Check for delivery receipt
    const received = stanza.getChild('received', 'urn:xmpp:receipts');
    if (received) {
      const receiptId = received.attrs.id as string;
      this.receiptHandlers.forEach(h => h(receiptId, from));
      return;
    }

    // Check for message body
    const body = stanza.getChildText('body');
    if (body) {
      try {
        const payload = JSON.parse(body) as EncryptedPayload;
        this.messageHandlers.forEach(h => h(from, payload, id));

        // Send delivery receipt
        void this.sendDeliveryReceipt(from, id);
      } catch {
        // Invalid payload — ignore (don't crash)
      }
    }
  }

  private handleIncomingPresence(stanza: Element): void {
    const from = stanza.attrs.from as string;
    const type = stanza.attrs.type as string | undefined;
    const status = type === 'unavailable' ? 'offline' : 'online';
    this.presenceHandlers.forEach(h => h(from, status));
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
