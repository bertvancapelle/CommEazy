const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const shimDir = path.resolve(__dirname, 'src/shims');

const config = {
  resolver: {
    // Map Node.js built-in modules to our shims
    extraNodeModules: {
      'node:dns': path.join(shimDir, 'node-dns.js'),
      'dns': path.join(shimDir, 'node-dns.js'),
      'node:net': path.join(shimDir, 'node-net.js'),
      'net': path.join(shimDir, 'node-net.js'),
      'node:tls': path.join(shimDir, 'node-tls.js'),
      'tls': path.join(shimDir, 'node-tls.js'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
