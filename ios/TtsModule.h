/**
 * TtsModule — Native iOS Apple TTS Bridge for React Native
 */

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <AVFoundation/AVFoundation.h>

@interface TtsModule : RCTEventEmitter <RCTBridgeModule, AVSpeechSynthesizerDelegate>
@end
