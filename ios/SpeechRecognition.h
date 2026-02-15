/**
 * SpeechRecognition — Native iOS Speech Recognition Module
 *
 * Provides speech-to-text functionality using Apple's SFSpeechRecognizer.
 * Used by the two-finger voice command gesture in CommEazy.
 *
 * Features:
 * - Real-time speech transcription
 * - Multiple language support (NL, EN, DE, FR, ES)
 * - On-device recognition when available (iOS 13+)
 *
 * @see src/hooks/useVoiceCommands.ts
 */

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <Speech/Speech.h>
#import <AVFoundation/AVFoundation.h>

@interface SpeechRecognition : RCTEventEmitter <RCTBridgeModule, SFSpeechRecognizerDelegate>

@end
