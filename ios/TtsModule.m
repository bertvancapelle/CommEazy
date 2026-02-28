/**
 * TtsModule — Native iOS Text-to-Speech Implementation
 *
 * Uses AVSpeechSynthesizer for text-to-speech functionality.
 * Emits events to JavaScript for progress tracking and state changes.
 *
 * Note: Audio session is activated lazily (on first speak) to avoid
 * conflicts with other audio sources during app startup.
 */

#import "TtsModule.h"
#import <React/RCTLog.h>

@implementation TtsModule {
    AVSpeechSynthesizer *_synthesizer;
    NSString *_currentText;
    NSInteger _currentPosition;
    BOOL _isPaused;
    BOOL _hasListeners;
    BOOL _audioSessionConfigured;
}

RCT_EXPORT_MODULE();

- (instancetype)init {
    self = [super init];
    if (self) {
        _synthesizer = [[AVSpeechSynthesizer alloc] init];
        _synthesizer.delegate = self;
        _currentText = @"";
        _currentPosition = 0;
        _isPaused = NO;
        _hasListeners = NO;
        _audioSessionConfigured = NO;
    }
    return self;
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[
        @"ttsStart",
        @"ttsProgress",
        @"ttsPause",
        @"ttsResume",
        @"ttsComplete",
        @"ttsCancelled",
        @"ttsError"
    ];
}

- (void)startObserving {
    _hasListeners = YES;
}

- (void)stopObserving {
    _hasListeners = NO;
}

#pragma mark - Initialization

RCT_EXPORT_METHOD(initialize:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    RCTLogInfo(@"[TtsModule] Initializing (lazy audio session)...");
    
    // Audio session is now configured lazily on first speak() call
    // This avoids conflicts with other audio sources during app startup
    RCTLogInfo(@"[TtsModule] Initialized successfully (audio session will be configured on first use)");
    resolve(@YES);
}

/**
 * Configure audio session lazily - called before first speech
 * Returns YES if successful, NO otherwise
 */
- (BOOL)ensureAudioSessionConfigured {
    if (_audioSessionConfigured) {
        return YES;
    }
    
    NSError *error = nil;
    AVAudioSession *session = [AVAudioSession sharedInstance];
    
    // Configure category with duck others option
    [session setCategory:AVAudioSessionCategoryPlayback
                    mode:AVAudioSessionModeDefault
                 options:AVAudioSessionCategoryOptionDuckOthers
                   error:&error];
    
    if (error) {
        RCTLogError(@"[TtsModule] Audio session category error: %@", error.localizedDescription);
        return NO;
    }
    
    // Activate session with notify others option for graceful handling
    [session setActive:YES 
           withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
                 error:&error];
    
    if (error) {
        RCTLogWarn(@"[TtsModule] Audio session activation warning: %@", error.localizedDescription);
        // Continue anyway - some errors are recoverable
    }
    
    _audioSessionConfigured = YES;
    RCTLogInfo(@"[TtsModule] Audio session configured successfully");
    return YES;
}

#pragma mark - Voice Query

RCT_EXPORT_METHOD(getVoicesForLanguage:(NSString *)language
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSArray<AVSpeechSynthesisVoice *> *allVoices = [AVSpeechSynthesisVoice speechVoices];
    NSMutableArray *voices = [NSMutableArray array];
    
    NSString *langPrefix = [language stringByAppendingString:@"-"];
    
    for (AVSpeechSynthesisVoice *voice in allVoices) {
        if ([voice.language hasPrefix:language] || [voice.language hasPrefix:langPrefix]) {
            NSString *quality = @"default";
            NSString *identifier = voice.identifier;
            
            if ([identifier containsString:@".premium."] || 
                [identifier containsString:@"ttsbundle.siri"] ||
                [identifier containsString:@".novelty."]) {
                quality = @"premium";
            } else if ([identifier containsString:@".enhanced."]) {
                quality = @"enhanced";
            } else if (@available(iOS 16.0, *)) {
                if (voice.quality == AVSpeechSynthesisVoiceQualityPremium) {
                    quality = @"premium";
                } else if (voice.quality == AVSpeechSynthesisVoiceQualityEnhanced) {
                    quality = @"enhanced";
                }
            }

            [voices addObject:@{
                @"id": voice.identifier,
                @"name": voice.name,
                @"language": voice.language,
                @"quality": quality
            }];
        }
    }

    resolve(voices);
}

RCT_EXPORT_METHOD(getAllVoices:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSArray<AVSpeechSynthesisVoice *> *allVoices = [AVSpeechSynthesisVoice speechVoices];
    NSMutableArray *voices = [NSMutableArray array];

    for (AVSpeechSynthesisVoice *voice in allVoices) {
        NSString *quality = @"default";
        NSString *identifier = voice.identifier;
        
        if ([identifier containsString:@".premium."] || 
            [identifier containsString:@"ttsbundle.siri"] ||
            [identifier containsString:@".novelty."]) {
            quality = @"premium";
        } else if ([identifier containsString:@".enhanced."]) {
            quality = @"enhanced";
        } else if (@available(iOS 16.0, *)) {
            if (voice.quality == AVSpeechSynthesisVoiceQualityPremium) {
                quality = @"premium";
            } else if (voice.quality == AVSpeechSynthesisVoiceQualityEnhanced) {
                quality = @"enhanced";
            }
        }

        [voices addObject:@{
            @"id": voice.identifier,
            @"name": voice.name,
            @"language": voice.language,
            @"quality": quality
        }];
    }

    resolve(voices);
}

#pragma mark - Speech Control

RCT_EXPORT_METHOD(speak:(NSString *)text
                  voiceId:(NSString *)voiceId
                  rate:(float)rate
                  pitch:(float)pitch
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!text || text.length == 0) {
        resolve(@NO);
        return;
    }
    
    // Ensure audio session is configured before speaking
    if (![self ensureAudioSessionConfigured]) {
        RCTLogWarn(@"[TtsModule] Audio session not configured, attempting to speak anyway");
    }
    
    if (_synthesizer.isSpeaking) {
        [_synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
    }
    
    _currentText = text;
    _currentPosition = 0;
    _isPaused = NO;
    
    AVSpeechUtterance *utterance = [[AVSpeechUtterance alloc] initWithString:text];
    
    if (voiceId && voiceId.length > 0) {
        AVSpeechSynthesisVoice *voice = [AVSpeechSynthesisVoice voiceWithIdentifier:voiceId];
        if (voice) {
            utterance.voice = voice;
        }
    }
    
    float normalizedRate = AVSpeechUtteranceMinimumSpeechRate +
        ((rate - 0.5f) / 1.5f) * (AVSpeechUtteranceMaximumSpeechRate - AVSpeechUtteranceMinimumSpeechRate);
    utterance.rate = fminf(fmaxf(normalizedRate, AVSpeechUtteranceMinimumSpeechRate), AVSpeechUtteranceMaximumSpeechRate);
    
    utterance.pitchMultiplier = fminf(fmaxf(pitch, 0.5f), 2.0f);
    
    utterance.preUtteranceDelay = 0.1;
    utterance.postUtteranceDelay = 0.1;
    
    [_synthesizer speakUtterance:utterance];
    resolve(@YES);
}

RCT_EXPORT_METHOD(pause:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (_synthesizer.isSpeaking && !_isPaused) {
        BOOL success = [_synthesizer pauseSpeakingAtBoundary:AVSpeechBoundaryImmediate];
        if (success) {
            _isPaused = YES;
            if (_hasListeners) {
                [self sendEventWithName:@"ttsPause" body:@{}];
            }
        }
        resolve(@(success));
    } else {
        resolve(@NO);
    }
}

RCT_EXPORT_METHOD(resume:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (_isPaused) {
        BOOL success = [_synthesizer continueSpeaking];
        if (success) {
            _isPaused = NO;
            if (_hasListeners) {
                [self sendEventWithName:@"ttsResume" body:@{}];
            }
        }
        resolve(@(success));
    } else {
        resolve(@NO);
    }
}

RCT_EXPORT_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (_synthesizer.isSpeaking || _isPaused) {
        [_synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
        _isPaused = NO;
        _currentText = @"";
        _currentPosition = 0;
        if (_hasListeners) {
            [self sendEventWithName:@"ttsCancelled" body:@{}];
        }
    }
    resolve(@YES);
}

#pragma mark - State Query

RCT_EXPORT_METHOD(isSpeaking:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@(_synthesizer.isSpeaking && !_isPaused));
}

RCT_EXPORT_METHOD(isPaused:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@(_isPaused));
}

RCT_EXPORT_METHOD(getCurrentPosition:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@(_currentPosition));
}

#pragma mark - AVSpeechSynthesizerDelegate

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synthesizer
    didStartSpeechUtterance:(AVSpeechUtterance *)utterance {
    if (_hasListeners) {
        [self sendEventWithName:@"ttsStart" body:@{}];
    }
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synthesizer
    willSpeakRangeOfSpeechString:(NSRange)characterRange
                       utterance:(AVSpeechUtterance *)utterance {
    _currentPosition = characterRange.location;
    if (_hasListeners) {
        [self sendEventWithName:@"ttsProgress" body:@{
            @"position": @(characterRange.location),
            @"length": @(_currentText.length)
        }];
    }
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synthesizer
    didFinishSpeechUtterance:(AVSpeechUtterance *)utterance {
    _currentText = @"";
    _currentPosition = 0;
    _isPaused = NO;
    if (_hasListeners) {
        [self sendEventWithName:@"ttsComplete" body:@{}];
    }
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synthesizer
    didCancelSpeechUtterance:(AVSpeechUtterance *)utterance {
    _currentText = @"";
    _currentPosition = 0;
    _isPaused = NO;
    if (_hasListeners) {
        [self sendEventWithName:@"ttsCancelled" body:@{}];
    }
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synthesizer
    didPauseSpeechUtterance:(AVSpeechUtterance *)utterance {
    _isPaused = YES;
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synthesizer
    didContinueSpeechUtterance:(AVSpeechUtterance *)utterance {
    _isPaused = NO;
}

#pragma mark - Cleanup

- (void)invalidate {
    [_synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
    _synthesizer = nil;
    _currentText = @"";
    _currentPosition = 0;
    _isPaused = NO;
    
    // Deactivate audio session if we configured it
    if (_audioSessionConfigured) {
        NSError *error = nil;
        [[AVAudioSession sharedInstance] setActive:NO 
                                       withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
                                             error:&error];
        if (error) {
            RCTLogWarn(@"[TtsModule] Audio session deactivation warning: %@", error.localizedDescription);
        }
        _audioSessionConfigured = NO;
    }
}

@end
