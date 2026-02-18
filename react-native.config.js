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
  },
};
