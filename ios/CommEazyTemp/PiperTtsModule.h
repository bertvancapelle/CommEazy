/**
 * PiperTtsModule — Native iOS Piper TTS Implementation
 *
 * Privacy-first offline TTS using Sherpa-ONNX with Piper VITS models.
 * ALL processing happens 100% on-device.
 *
 * CRITICAL PRIVACY GUARANTEE:
 * - NO network calls are made
 * - NO data leaves the device
 * - Models are bundled in the app
 */

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface PiperTtsModule : RCTEventEmitter <RCTBridgeModule>

@end
