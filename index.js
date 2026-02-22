// Polyfill URL (required by @xmpp/client - React Native's URL is incomplete)
import 'react-native-url-polyfill/auto';

// Polyfill for crypto.getRandomValues (required by @xmpp/client in Hermes)
import 'react-native-get-random-values';

// Polyfill btoa/atob (required by @xmpp/client for SASL authentication)
import { encode as btoa, decode as atob } from 'base-64';
if (!globalThis.btoa) globalThis.btoa = btoa;
if (!globalThis.atob) globalThis.atob = atob;

// Polyfill crypto.randomUUID() using getRandomValues (xmpp.js needs this)
if (typeof globalThis.crypto !== 'undefined' && !globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = function randomUUID() {
    // Generate 16 random bytes
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    // Set version (4) and variant (RFC4122)
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC4122
    // Convert to hex string with dashes
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

import { AppRegistry, LogBox } from 'react-native';
import App from './src/app/App';
import { name as appName } from './app.json';

// Firebase Cloud Messaging - Background message handler
// MUST be registered before AppRegistry.registerComponent
import { setBackgroundMessageHandler } from './src/services/notifications';
setBackgroundMessageHandler();

// Disable the inspector overlay in dev mode (the Inspect/Perf/Network/Touchables bar)
if (__DEV__) {
  // Ignore common warnings that clutter development
  LogBox.ignoreLogs([
    'Require cycle:',
    'Non-serializable values were found in the navigation state',
    // XMPP connection errors when Prosody server is not running
    // The app continues to work in mock mode without XMPP
    '[XMPP] Error event:',
    'Connection refused',
    "The operation couldn't be completed",
  ]);
}

AppRegistry.registerComponent(appName, () => App);
