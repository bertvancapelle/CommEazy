/**
 * PiperTtsModule — Native iOS Piper TTS Implementation
 *
 * Uses Sherpa-ONNX with Piper VITS models for high-quality offline TTS.
 *
 * PRIVACY: All processing is 100% on-device. No network requests.
 */

#import "PiperTtsModule.h"
#import <React/RCTLog.h>
#import <AVFoundation/AVFoundation.h>

// Include the sherpa-onnx TTS wrapper from react-native-sherpa-onnx
#include "sherpa-onnx-tts-wrapper.h"

@implementation PiperTtsModule {
    std::unique_ptr<sherpaonnx::TtsWrapper> _ttsWrapper;
    AVAudioPlayer *_audioPlayer;
    BOOL _isInitialized;
    BOOL _hasListeners;
    NSString *_currentModelPath;
}

RCT_EXPORT_MODULE();

- (instancetype)init {
    self = [super init];
    if (self) {
        _ttsWrapper = std::make_unique<sherpaonnx::TtsWrapper>();
        _isInitialized = NO;
        _hasListeners = NO;
        _currentModelPath = nil;
    }
    return self;
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[
        @"piperStart",
        @"piperProgress",
        @"piperComplete",
        @"piperError"
    ];
}

- (void)startObserving {
    _hasListeners = YES;
}

- (void)stopObserving {
    _hasListeners = NO;
}

#pragma mark - Initialization

RCT_EXPORT_METHOD(initialize:(NSString *)modelDir
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    RCTLogInfo(@"[PiperTtsModule] Initializing with model: %@", modelDir);

    // Configure audio session for playback
    // Use MixWithOthers + DuckOthers so TTS can play alongside music
    // This prevents activation failures when Apple Music is playing
    NSError *error = nil;
    AVAudioSession *session = [AVAudioSession sharedInstance];
    [session setCategory:AVAudioSessionCategoryPlayback
                    mode:AVAudioSessionModeDefault
                 options:(AVAudioSessionCategoryOptionMixWithOthers | AVAudioSessionCategoryOptionDuckOthers)
                   error:&error];

    if (error) {
        RCTLogError(@"[PiperTtsModule] Audio session error: %@", error.localizedDescription);
    }

    // Don't force-activate session here - let it activate when audio plays
    // This prevents conflicts with already-active audio sessions (Apple Music, etc.)

    // Find model in app bundle
    NSString *modelPath = nil;

    // Try to find in main bundle (Assets folder)
    NSBundle *mainBundle = [NSBundle mainBundle];
    NSString *bundlePath = [mainBundle pathForResource:@"nl_NL-mls-medium" ofType:@"onnx" inDirectory:modelDir];

    if (bundlePath) {
        // Model directory is parent of the .onnx file
        modelPath = [bundlePath stringByDeletingLastPathComponent];
        RCTLogInfo(@"[PiperTtsModule] Found model in bundle: %@", modelPath);
    } else {
        // Try direct path
        NSString *resourcePath = [mainBundle resourcePath];
        modelPath = [resourcePath stringByAppendingPathComponent:modelDir];

        // Check if directory exists
        BOOL isDir;
        if (![[NSFileManager defaultManager] fileExistsAtPath:modelPath isDirectory:&isDir] || !isDir) {
            RCTLogError(@"[PiperTtsModule] Model directory not found: %@", modelPath);
            reject(@"MODEL_NOT_FOUND", @"Model directory not found", nil);
            return;
        }
    }

    // Initialize TTS wrapper
    auto result = _ttsWrapper->initialize(
        [modelPath UTF8String],
        "vits",  // Piper uses VITS architecture
        2,       // numThreads
        false    // debug
    );

    if (!result.success) {
        RCTLogError(@"[PiperTtsModule] Failed to initialize TTS");
        reject(@"INIT_FAILED", @"Failed to initialize TTS model", nil);
        return;
    }

    _isInitialized = YES;
    _currentModelPath = modelPath;

    int32_t sampleRate = _ttsWrapper->getSampleRate();
    int32_t numSpeakers = _ttsWrapper->getNumSpeakers();

    RCTLogInfo(@"[PiperTtsModule] Initialized successfully (sampleRate: %d, speakers: %d)",
               sampleRate, numSpeakers);

    resolve(@{
        @"success": @YES,
        @"sampleRate": @(sampleRate),
        @"numSpeakers": @(numSpeakers)
    });
}

#pragma mark - Speech Generation

RCT_EXPORT_METHOD(speak:(NSString *)text
                  speed:(float)speed
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!_isInitialized) {
        reject(@"NOT_INITIALIZED", @"TTS not initialized", nil);
        return;
    }

    if (!text || text.length == 0) {
        RCTLogWarn(@"[PiperTtsModule] Empty text provided");
        resolve(@NO);
        return;
    }

    RCTLogInfo(@"[PiperTtsModule] Generating speech (length: %lu, speed: %.2f)",
               (unsigned long)text.length, speed);

    // Emit start event
    if (_hasListeners) {
        [self sendEventWithName:@"piperStart" body:@{}];
    }

    // Generate speech on background thread
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        @try {
            // Generate audio samples
            auto audioResult = self->_ttsWrapper->generate(
                [text UTF8String],
                0,       // speaker ID
                speed    // speed
            );

            if (audioResult.samples.empty()) {
                RCTLogError(@"[PiperTtsModule] Generated empty audio");
                dispatch_async(dispatch_get_main_queue(), ^{
                    if (self->_hasListeners) {
                        [self sendEventWithName:@"piperError" body:@{@"error": @"Generated empty audio"}];
                    }
                    reject(@"EMPTY_AUDIO", @"Generated empty audio", nil);
                });
                return;
            }

            RCTLogInfo(@"[PiperTtsModule] Generated %lu samples at %d Hz",
                       audioResult.samples.size(), audioResult.sampleRate);

            // Save to temporary WAV file
            NSString *tempDir = NSTemporaryDirectory();
            NSString *wavPath = [tempDir stringByAppendingPathComponent:
                                 [NSString stringWithFormat:@"piper_speech_%lld.wav",
                                  (long long)[[NSDate date] timeIntervalSince1970] * 1000]];

            bool saved = sherpaonnx::TtsWrapper::saveToWavFile(
                audioResult.samples,
                audioResult.sampleRate,
                [wavPath UTF8String]
            );

            if (!saved) {
                RCTLogError(@"[PiperTtsModule] Failed to save WAV file");
                dispatch_async(dispatch_get_main_queue(), ^{
                    if (self->_hasListeners) {
                        [self sendEventWithName:@"piperError" body:@{@"error": @"Failed to save audio"}];
                    }
                    reject(@"SAVE_FAILED", @"Failed to save audio file", nil);
                });
                return;
            }

            // Play audio on main thread
            dispatch_async(dispatch_get_main_queue(), ^{
                @try {
                    NSURL *audioURL = [NSURL fileURLWithPath:wavPath];
                    NSError *playError = nil;

                    self->_audioPlayer = [[AVAudioPlayer alloc] initWithContentsOfURL:audioURL
                                                                                error:&playError];

                    if (playError) {
                        RCTLogError(@"[PiperTtsModule] Audio player error: %@", playError.localizedDescription);
                        if (self->_hasListeners) {
                            [self sendEventWithName:@"piperError" body:@{@"error": playError.localizedDescription}];
                        }
                        reject(@"PLAY_ERROR", playError.localizedDescription, playError);
                        return;
                    }

                    self->_audioPlayer.delegate = (id<AVAudioPlayerDelegate>)self;
                    [self->_audioPlayer play];

                    RCTLogInfo(@"[PiperTtsModule] Playing audio (duration: %.2fs)", self->_audioPlayer.duration);
                    resolve(@YES);

                } @catch (NSException *exception) {
                    RCTLogError(@"[PiperTtsModule] Playback exception: %@", exception.reason);
                    if (self->_hasListeners) {
                        [self sendEventWithName:@"piperError" body:@{@"error": exception.reason}];
                    }
                    reject(@"PLAY_EXCEPTION", exception.reason, nil);
                }
            });

        } @catch (NSException *exception) {
            RCTLogError(@"[PiperTtsModule] Generation exception: %@", exception.reason);
            dispatch_async(dispatch_get_main_queue(), ^{
                if (self->_hasListeners) {
                    [self sendEventWithName:@"piperError" body:@{@"error": exception.reason}];
                }
                reject(@"GENERATION_EXCEPTION", exception.reason, nil);
            });
        }
    });
}

#pragma mark - Playback Control

RCT_EXPORT_METHOD(pause:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (_audioPlayer && _audioPlayer.isPlaying) {
        [_audioPlayer pause];
        RCTLogInfo(@"[PiperTtsModule] Paused");
    }
    resolve(@YES);
}

RCT_EXPORT_METHOD(resume:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (_audioPlayer && !_audioPlayer.isPlaying) {
        [_audioPlayer play];
        RCTLogInfo(@"[PiperTtsModule] Resumed");
    }
    resolve(@YES);
}

RCT_EXPORT_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (_audioPlayer) {
        [_audioPlayer stop];
        _audioPlayer = nil;
        RCTLogInfo(@"[PiperTtsModule] Stopped");
    }
    resolve(@YES);
}

#pragma mark - State Query

RCT_EXPORT_METHOD(isPlaying:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@(_audioPlayer != nil && _audioPlayer.isPlaying));
}

RCT_EXPORT_METHOD(getModelInfo:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!_isInitialized) {
        reject(@"NOT_INITIALIZED", @"TTS not initialized", nil);
        return;
    }

    resolve(@{
        @"sampleRate": @(_ttsWrapper->getSampleRate()),
        @"numSpeakers": @(_ttsWrapper->getNumSpeakers())
    });
}

#pragma mark - AVAudioPlayerDelegate

- (void)audioPlayerDidFinishPlaying:(AVAudioPlayer *)player successfully:(BOOL)flag {
    RCTLogInfo(@"[PiperTtsModule] Playback finished (success: %@)", flag ? @"YES" : @"NO");

    if (_hasListeners) {
        [self sendEventWithName:@"piperComplete" body:@{}];
    }
}

- (void)audioPlayerDecodeErrorDidOccur:(AVAudioPlayer *)player error:(NSError *)error {
    RCTLogError(@"[PiperTtsModule] Decode error: %@", error.localizedDescription);

    if (_hasListeners) {
        [self sendEventWithName:@"piperError" body:@{@"error": error.localizedDescription}];
    }
}

#pragma mark - Cleanup

RCT_EXPORT_METHOD(release:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (_audioPlayer) {
        [_audioPlayer stop];
        _audioPlayer = nil;
    }

    if (_ttsWrapper) {
        _ttsWrapper->release();
    }

    _isInitialized = NO;
    _currentModelPath = nil;

    RCTLogInfo(@"[PiperTtsModule] Released");
    resolve(@YES);
}

- (void)invalidate {
    if (_audioPlayer) {
        [_audioPlayer stop];
        _audioPlayer = nil;
    }

    if (_ttsWrapper) {
        _ttsWrapper->release();
    }

    _isInitialized = NO;
}

@end
