/**
 * Node.js net module shim for React Native
 *
 * Provides minimal implementation for @xmpp libraries.
 * We use WebSocket transport, so TCP socket functionality is not needed.
 */

class Socket {
  constructor() {
    this.destroyed = false;
  }

  connect() {
    return this;
  }

  write() {
    return true;
  }

  end() {
    this.destroyed = true;
  }

  destroy() {
    this.destroyed = true;
  }

  on() {
    return this;
  }

  once() {
    return this;
  }

  off() {
    return this;
  }

  removeListener() {
    return this;
  }

  setKeepAlive() {
    return this;
  }

  setTimeout() {
    return this;
  }

  setNoDelay() {
    return this;
  }
}

module.exports = {
  Socket,
  createConnection: () => new Socket(),
  connect: () => new Socket(),
  isIP: () => 0,
  isIPv4: () => false,
  isIPv6: () => false,
};
