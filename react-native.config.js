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
    // Disable react-native-maps — was disabled due to folly_config conflict (RN 0.73).
    // RN 0.84 builds Folly from source (RCT_USE_RN_DEP=0), so conflict may be resolved.
    // TODO: Test re-enabling with react-native-maps 1.14+ when maps feature is needed.
    'react-native-maps': {
      platforms: {
        ios: null,
        android: null,
      },
    },
  },
};
