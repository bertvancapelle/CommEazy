/**
 * Node.js DNS module shim for React Native
 *
 * @xmpp/resolve uses node:dns which doesn't exist in React Native.
 * This provides a no-op implementation since we connect directly via WebSocket URL.
 */

module.exports = {
  promises: {
    resolve: async () => [],
    resolve4: async () => [],
    resolve6: async () => [],
    resolveSrv: async () => [],
    resolveTxt: async () => [],
  },
  resolve: (hostname, callback) => callback(null, []),
  resolve4: (hostname, callback) => callback(null, []),
  resolve6: (hostname, callback) => callback(null, []),
  resolveSrv: (hostname, callback) => callback(null, []),
  resolveTxt: (hostname, callback) => callback(null, []),
};
