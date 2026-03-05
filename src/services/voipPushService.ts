/**
 * VoIP Push Service — Manages PushKit VoIP token registration with Prosody.
 *
 * Flow:
 * 1. Register with PushKit via native VoIPPushModule
 * 2. Receive VoIP device token
 * 3. Send XEP-0357 enable stanza to Prosody with VoIP token
 * 4. When call arrives offline → Prosody → mod_push_http → Push Gateway → APNs VoIP → PushKit → CallKit
 *
 * The VoIP token is separate from the regular APNs/FCM token.
 * VoIP pushes wake the app immediately and MUST report to CallKit.
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { VoIPPushModule } = NativeModules;

let eventEmitter: NativeEventEmitter | null = null;

/**
 * Initialize PushKit registration and listen for VoIP token updates.
 * Call this after XMPP is connected.
 */
export async function registerForVoIPPush(): Promise<string | null> {
  if (Platform.OS !== 'ios') {
    console.debug('[VoIPPush] Skipping VoIP push registration (not iOS)');
    return null;
  }

  if (!VoIPPushModule) {
    console.warn('[VoIPPush] VoIPPushModule not available');
    return null;
  }

  // Register for VoIP push — this triggers PushKit to request a token
  VoIPPushModule.registerForVoIPPush();

  // Check if token is already available
  const existingToken = await VoIPPushModule.getVoIPToken();
  if (existingToken) {
    console.info('[VoIPPush] VoIP token already available: ...' + existingToken.slice(-6));
    return existingToken;
  }

  // Wait for token with retry (first-time registration)
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const token = await waitForToken(attempt);
    if (token) {
      return token;
    }
    if (attempt < maxAttempts) {
      const backoffMs = 5000 * attempt; // 5s, 10s
      console.info('[VoIPPush] Retry ' + attempt + '/' + maxAttempts + ' in ' + backoffMs + 'ms');
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      VoIPPushModule.registerForVoIPPush(); // Re-trigger PushKit
    }
  }

  console.warn('[VoIPPush] VoIP token not received after ' + maxAttempts + ' attempts');
  return null;
}

/**
 * Wait for VoIP token from PushKit with a 10s timeout.
 */
function waitForToken(attempt: number): Promise<string | null> {
  return new Promise((resolve) => {
    if (!eventEmitter) {
      eventEmitter = new NativeEventEmitter(VoIPPushModule);
    }

    const subscription = eventEmitter.addListener('onVoIPToken', (event) => {
      const token = event?.token;
      if (token) {
        console.info('[VoIPPush] VoIP token received (attempt ' + attempt + '): ...' + token.slice(-6));
        subscription.remove();
        resolve(token);
      }
    });

    // Timeout after 10s
    setTimeout(() => {
      subscription.remove();
      console.debug('[VoIPPush] VoIP token not received within 10s (attempt ' + attempt + ')');
      resolve(null);
    }, 10000);
  });
}

/**
 * Get the current VoIP token (if previously registered).
 */
export async function getVoIPToken(): Promise<string | null> {
  if (Platform.OS !== 'ios' || !VoIPPushModule) {
    return null;
  }

  const token = await VoIPPushModule.getVoIPToken();
  return token || null;
}

/**
 * Listen for incoming VoIP push events.
 * These are fired when a VoIP push arrives and the app was backgrounded/killed.
 * CallKit has already been triggered by the native module.
 */
export function onVoIPPush(handler: (payload: Record<string, unknown>) => void): () => void {
  if (Platform.OS !== 'ios' || !VoIPPushModule) {
    return () => {};
  }

  if (!eventEmitter) {
    eventEmitter = new NativeEventEmitter(VoIPPushModule);
  }

  const subscription = eventEmitter.addListener('onVoIPPush', handler);
  return () => subscription.remove();
}
