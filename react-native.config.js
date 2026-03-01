module.exports = {
  dependencies: {
    // Disable auto-linking for react-native-sherpa-onnx
    // We use our own PiperTtsModule wrapper that is compatible with Old Architecture
    'react-native-sherpa-onnx': {
      platforms: {
        ios: null,
        android: null,
      },
    },
    // Temporarily disable react-native-maps due to folly_config conflict with RN 0.73
    // TODO: Update to react-native-maps 1.14+ when ready
    'react-native-maps': {
      platforms: {
        ios: null,
        android: null,
      },
    },
  },
};
