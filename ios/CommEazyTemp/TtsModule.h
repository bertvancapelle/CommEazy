/**
 * TtsModule — Native iOS Text-to-Speech Module
 *
 * Provides text-to-speech functionality using Apple's AVSpeechSynthesizer.
 * Used by the Books module for read-aloud functionality.
 *
 * Features:
 * - Multiple language/voice support (NL, EN, DE, FR, ES)
 * - Playback rate and pitch control
 * - Progress tracking (word-level)
 * - Pause/resume support
 * - Background audio support
 *
 * @see src/services/ttsService.ts
 * @see src/contexts/BooksContext.tsx
 */

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <AVFoundation/AVFoundation.h>

@interface TtsModule : RCTEventEmitter <RCTBridgeModule, AVSpeechSynthesizerDelegate>

@end
