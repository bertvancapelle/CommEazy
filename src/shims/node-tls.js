/**
 * Node.js tls module shim for React Native
 *
 * Provides minimal implementation for @xmpp libraries.
 * We use WebSocket transport with native TLS, so this is not needed.
 */

const net = require('./node-net');

class TLSSocket extends net.Socket {
  constructor() {
    super();
    this.encrypted = true;
    this.authorized = true;
  }

  getPeerCertificate() {
    return {};
  }

  getCipher() {
    return { name: 'TLS_AES_256_GCM_SHA384', version: 'TLSv1.3' };
  }
}

module.exports = {
  TLSSocket,
  connect: () => new TLSSocket(),
  createSecureContext: () => ({}),
  DEFAULT_MIN_VERSION: 'TLSv1.2',
};
