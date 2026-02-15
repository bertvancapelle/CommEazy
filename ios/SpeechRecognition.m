/**
 * SpeechRecognition — Native iOS Speech Recognition Implementation
 *
 * Uses SFSpeechRecognizer for real-time speech-to-text.
 * Emits events to JavaScript for live transcription updates.
 */

#import "SpeechRecognition.h"
#import <React/RCTLog.h>

@implementation SpeechRecognition {
    SFSpeechRecognizer *_speechRecognizer;
    SFSpeechAudioBufferRecognitionRequest *_recognitionRequest;
    SFSpeechRecognitionTask *_recognitionTask;
    AVAudioEngine *_audioEngine;
    NSString *_currentLanguage;
    BOOL _isListening;
    BOOL _hasListeners;
}

RCT_EXPORT_MODULE();

- (instancetype)init {
    self = [super init];
    if (self) {
        _audioEngine = [[AVAudioEngine alloc] init];
        _currentLanguage = @"nl-NL";
        _isListening = NO;
        _hasListeners = NO;
    }
    return self;
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[
        @"onSpeechStart",
        @"onSpeechEnd",
        @"onSpeechResults",
        @"onSpeechPartialResults",
        @"onSpeechError",
        @"onSpeechVolumeChanged"
    ];
}

- (void)startObserving {
    _hasListeners = YES;
}

- (void)stopObserving {
    _hasListeners = NO;
}

#pragma mark - Permission Check

RCT_EXPORT_METHOD(requestPermissions:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    RCTLogInfo(@"[SpeechRecognition] Requesting permissions...");

    // Request speech recognition authorization
    [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
        switch (status) {
            case SFSpeechRecognizerAuthorizationStatusAuthorized:
                RCTLogInfo(@"[SpeechRecognition] Speech recognition authorized");

                // Also request microphone access
                [[AVAudioSession sharedInstance] requestRecordPermission:^(BOOL granted) {
                    if (granted) {
                        RCTLogInfo(@"[SpeechRecognition] Microphone access granted");
                        resolve(@{
                            @"speechRecognition": @YES,
                            @"microphone": @YES
                        });
                    } else {
                        RCTLogWarn(@"[SpeechRecognition] Microphone access denied");
                        resolve(@{
                            @"speechRecognition": @YES,
                            @"microphone": @NO
                        });
                    }
                }];
                break;

            case SFSpeechRecognizerAuthorizationStatusDenied:
                RCTLogWarn(@"[SpeechRecognition] Speech recognition denied");
                resolve(@{
                    @"speechRecognition": @NO,
                    @"microphone": @NO,
                    @"reason": @"denied"
                });
                break;

            case SFSpeechRecognizerAuthorizationStatusRestricted:
                RCTLogWarn(@"[SpeechRecognition] Speech recognition restricted");
                resolve(@{
                    @"speechRecognition": @NO,
                    @"microphone": @NO,
                    @"reason": @"restricted"
                });
                break;

            case SFSpeechRecognizerAuthorizationStatusNotDetermined:
                RCTLogInfo(@"[SpeechRecognition] Speech recognition not determined");
                resolve(@{
                    @"speechRecognition": @NO,
                    @"microphone": @NO,
                    @"reason": @"not_determined"
                });
                break;
        }
    }];
}

RCT_EXPORT_METHOD(isAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    SFSpeechRecognizer *recognizer = [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:_currentLanguage]];

    resolve(@{
        @"available": @(recognizer.isAvailable),
        @"language": _currentLanguage
    });
}

#pragma mark - Start/Stop Listening

RCT_EXPORT_METHOD(startListening:(NSString *)language) {
    RCTLogInfo(@"[SpeechRecognition] startListening called with language: %@", language);

    if (_isListening) {
        RCTLogWarn(@"[SpeechRecognition] Already listening, stopping first...");
        [self stopListeningInternal];
    }

    // Update language if provided
    if (language && language.length > 0) {
        _currentLanguage = language;
    }

    // Initialize speech recognizer with locale
    NSLocale *locale = [NSLocale localeWithLocaleIdentifier:_currentLanguage];
    _speechRecognizer = [[SFSpeechRecognizer alloc] initWithLocale:locale];
    _speechRecognizer.delegate = self;

    if (!_speechRecognizer.isAvailable) {
        RCTLogError(@"[SpeechRecognition] Speech recognizer not available for language: %@", _currentLanguage);
        if (_hasListeners) {
            [self sendEventWithName:@"onSpeechError" body:@{
                @"error": @"Speech recognition not available",
                @"code": @"not_available"
            }];
        }
        return;
    }

    // Configure audio session
    NSError *audioSessionError = nil;
    AVAudioSession *audioSession = [AVAudioSession sharedInstance];
    [audioSession setCategory:AVAudioSessionCategoryRecord
                         mode:AVAudioSessionModeMeasurement
                      options:AVAudioSessionCategoryOptionDuckOthers
                        error:&audioSessionError];

    if (audioSessionError) {
        RCTLogError(@"[SpeechRecognition] Audio session error: %@", audioSessionError.localizedDescription);
        if (_hasListeners) {
            [self sendEventWithName:@"onSpeechError" body:@{
                @"error": audioSessionError.localizedDescription,
                @"code": @"audio_session_error"
            }];
        }
        return;
    }

    [audioSession setActive:YES withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:&audioSessionError];

    if (audioSessionError) {
        RCTLogError(@"[SpeechRecognition] Audio session activation error: %@", audioSessionError.localizedDescription);
        if (_hasListeners) {
            [self sendEventWithName:@"onSpeechError" body:@{
                @"error": audioSessionError.localizedDescription,
                @"code": @"audio_activation_error"
            }];
        }
        return;
    }

    // Create recognition request
    _recognitionRequest = [[SFSpeechAudioBufferRecognitionRequest alloc] init];
    _recognitionRequest.shouldReportPartialResults = YES;

    // Use on-device recognition if available (iOS 13+)
    if (@available(iOS 13, *)) {
        if (_speechRecognizer.supportsOnDeviceRecognition) {
            _recognitionRequest.requiresOnDeviceRecognition = YES;
            RCTLogInfo(@"[SpeechRecognition] Using on-device recognition");
        }
    }

    // Get input node
    AVAudioInputNode *inputNode = _audioEngine.inputNode;
    AVAudioFormat *recordingFormat = [inputNode outputFormatForBus:0];

    // Install tap on input node
    [inputNode installTapOnBus:0 bufferSize:1024 format:recordingFormat block:^(AVAudioPCMBuffer * _Nonnull buffer, AVAudioTime * _Nonnull when) {
        if (self->_recognitionRequest) {
            [self->_recognitionRequest appendAudioPCMBuffer:buffer];
        }
    }];

    // Prepare and start audio engine
    [_audioEngine prepare];

    NSError *startError = nil;
    [_audioEngine startAndReturnError:&startError];

    if (startError) {
        RCTLogError(@"[SpeechRecognition] Audio engine start error: %@", startError.localizedDescription);
        if (_hasListeners) {
            [self sendEventWithName:@"onSpeechError" body:@{
                @"error": startError.localizedDescription,
                @"code": @"audio_engine_error"
            }];
        }
        return;
    }

    // Start recognition task
    _recognitionTask = [_speechRecognizer recognitionTaskWithRequest:_recognitionRequest resultHandler:^(SFSpeechRecognitionResult * _Nullable result, NSError * _Nullable error) {

        if (error) {
            RCTLogError(@"[SpeechRecognition] Recognition error: %@", error.localizedDescription);

            // Don't report "cancelled" errors as they're expected when stopping
            if (error.code != 216 && error.code != 1110) {
                if (self->_hasListeners) {
                    [self sendEventWithName:@"onSpeechError" body:@{
                        @"error": error.localizedDescription,
                        @"code": [NSString stringWithFormat:@"%ld", (long)error.code]
                    }];
                }
            }

            [self stopListeningInternal];
            return;
        }

        if (result) {
            NSString *transcript = result.bestTranscription.formattedString;
            float confidence = 0.0;

            if (result.bestTranscription.segments.count > 0) {
                for (SFTranscriptionSegment *segment in result.bestTranscription.segments) {
                    confidence += segment.confidence;
                }
                confidence /= result.bestTranscription.segments.count;
            }

            RCTLogInfo(@"[SpeechRecognition] Transcript: %@ (final: %@, confidence: %.2f)",
                      transcript,
                      result.isFinal ? @"YES" : @"NO",
                      confidence);

            if (self->_hasListeners) {
                if (result.isFinal) {
                    [self sendEventWithName:@"onSpeechResults" body:@{
                        @"transcript": transcript,
                        @"confidence": @(confidence),
                        @"isFinal": @YES
                    }];

                    // Auto-stop after final result
                    [self stopListeningInternal];
                } else {
                    [self sendEventWithName:@"onSpeechPartialResults" body:@{
                        @"transcript": transcript,
                        @"confidence": @(confidence),
                        @"isFinal": @NO
                    }];
                }
            }
        }
    }];

    _isListening = YES;

    if (_hasListeners) {
        [self sendEventWithName:@"onSpeechStart" body:@{
            @"language": _currentLanguage
        }];
    }

    RCTLogInfo(@"[SpeechRecognition] Started listening in %@", _currentLanguage);
}

RCT_EXPORT_METHOD(stopListening) {
    RCTLogInfo(@"[SpeechRecognition] stopListening called");
    [self stopListeningInternal];
}

- (void)stopListeningInternal {
    if (!_isListening && !_recognitionTask) {
        RCTLogInfo(@"[SpeechRecognition] Not listening, nothing to stop");
        return;
    }

    // Stop audio engine
    if (_audioEngine.isRunning) {
        [_audioEngine stop];
        [_audioEngine.inputNode removeTapOnBus:0];
    }

    // End recognition request
    if (_recognitionRequest) {
        [_recognitionRequest endAudio];
        _recognitionRequest = nil;
    }

    // Cancel recognition task
    if (_recognitionTask) {
        [_recognitionTask cancel];
        _recognitionTask = nil;
    }

    // Deactivate audio session
    NSError *error = nil;
    [[AVAudioSession sharedInstance] setActive:NO
                                   withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
                                         error:&error];

    _isListening = NO;

    if (_hasListeners) {
        [self sendEventWithName:@"onSpeechEnd" body:@{}];
    }

    RCTLogInfo(@"[SpeechRecognition] Stopped listening");
}

#pragma mark - SFSpeechRecognizerDelegate

- (void)speechRecognizer:(SFSpeechRecognizer *)speechRecognizer availabilityDidChange:(BOOL)available {
    RCTLogInfo(@"[SpeechRecognition] Availability changed: %@", available ? @"YES" : @"NO");

    if (!available && _isListening) {
        [self stopListeningInternal];

        if (_hasListeners) {
            [self sendEventWithName:@"onSpeechError" body:@{
                @"error": @"Speech recognition became unavailable",
                @"code": @"unavailable"
            }];
        }
    }
}

#pragma mark - Cleanup

- (void)invalidate {
    [self stopListeningInternal];
    _speechRecognizer = nil;
}

@end
