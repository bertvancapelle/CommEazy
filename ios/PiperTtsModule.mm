/**
 * PiperTtsModule — Native iOS Piper TTS Implementation
 *
 * Uses Sherpa-ONNX with Piper VITS models for high-quality offline TTS.
 *
 * CHUNKED PLAYBACK ARCHITECTURE:
 * - Text is split into paragraphs for faster first-audio latency
 * - AVQueuePlayer manages seamless playback of audio chunks
 * - Background thread pre-generates next chunks while current plays
 * - Progress tracking spans the entire chapter, not individual chunks
 *
 * PRIVACY: All processing is 100% on-device. No network requests.
 */

#import "PiperTtsModule.h"
#import <React/RCTLog.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreMedia/CoreMedia.h>

// Include the sherpa-onnx TTS wrapper from react-native-sherpa-onnx
#include "sherpa-onnx-tts-wrapper.h"

@implementation PiperTtsModule {
    std::unique_ptr<sherpaonnx::TtsWrapper> _ttsWrapper;
    
    // Legacy single-audio player (for backwards compatibility)
    AVAudioPlayer *_audioPlayer;
    
    // Chunked playback components
    AVQueuePlayer *_queuePlayer;
    NSMutableArray<AVPlayerItem *> *_playerItemQueue;
    NSMutableArray<NSString *> *_pendingChunks;      // Text chunks waiting to be generated
    NSMutableArray<NSNumber *> *_chunkDurations;     // Duration of each generated chunk
    NSInteger _currentChunkIndex;                     // Currently playing chunk
    NSInteger _totalChunks;                           // Total number of chunks
    BOOL _isChunkedMode;                              // Whether we're in chunked playback mode
    BOOL _isGeneratingChunks;                         // Background generation in progress
    float _currentSpeed;                              // Playback speed for chunk generation
    
    // Overall progress tracking for chunked mode
    NSTimeInterval _totalDuration;                    // Sum of all chunk durations
    NSTimeInterval _playedDuration;                   // Duration of completed chunks
    id _timeObserver;                                 // For observing current item progress
    
    BOOL _isInitialized;
    BOOL _hasListeners;
    NSString *_currentModelPath;
    NSTimer *_progressTimer;
}

RCT_EXPORT_MODULE();

- (instancetype)init {
    self = [super init];
    if (self) {
        _ttsWrapper = std::make_unique<sherpaonnx::TtsWrapper>();
        _isInitialized = NO;
        _hasListeners = NO;
        _currentModelPath = nil;
        
        // Chunked playback initialization
        _playerItemQueue = [NSMutableArray new];
        _pendingChunks = [NSMutableArray new];
        _chunkDurations = [NSMutableArray new];
        _currentChunkIndex = 0;
        _totalChunks = 0;
        _isChunkedMode = NO;
        _isGeneratingChunks = NO;
        _currentSpeed = 1.0f;
        _totalDuration = 0;
        _playedDuration = 0;
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
    NSError *error = nil;
    AVAudioSession *session = [AVAudioSession sharedInstance];
    [session setCategory:AVAudioSessionCategoryPlayback
                    mode:AVAudioSessionModeDefault
                 options:AVAudioSessionCategoryOptionDuckOthers
                   error:&error];

    if (error) {
        RCTLogError(@"[PiperTtsModule] Audio session error: %@", error.localizedDescription);
    }

    [session setActive:YES error:&error];

    // Find model in app bundle
    NSString *modelPath = nil;
    NSBundle *mainBundle = [NSBundle mainBundle];
    NSString *resourcePath = [mainBundle resourcePath];
    NSFileManager *fm = [NSFileManager defaultManager];
    
    RCTLogInfo(@"[PiperTtsModule] Bundle resource path: %@", resourcePath);
    
    // Try multiple strategies to find the model files
    // Priority: nl_BE-rdh-medium (best quality) > nl_BE-nathalie > nl_NL-mls
    
    // Strategy 1: Look for nl_BE-rdh-medium (highest quality)
    NSString *onnxPath = [mainBundle pathForResource:@"nl_BE-rdh-medium" ofType:@"onnx" inDirectory:@"piper-models/nl_BE-rdh-medium"];
    
    if (onnxPath) {
        modelPath = [onnxPath stringByDeletingLastPathComponent];
        RCTLogInfo(@"[PiperTtsModule] Found nl_BE-rdh model (best quality): %@", modelPath);
    }
    
    // Strategy 2: Fallback to nl_BE-nathalie-medium
    if (!modelPath) {
        onnxPath = [mainBundle pathForResource:@"nl_BE-nathalie-medium" ofType:@"onnx" inDirectory:@"piper-models/nl_BE-nathalie-medium"];
        if (onnxPath) {
            modelPath = [onnxPath stringByDeletingLastPathComponent];
            RCTLogInfo(@"[PiperTtsModule] Found nl_BE-nathalie model: %@", modelPath);
        }
    }
    
    // Strategy 3: Fallback to nl_NL-mls-medium (multi-speaker)
    if (!modelPath) {
        onnxPath = [mainBundle pathForResource:@"nl_NL-mls-medium" ofType:@"onnx" inDirectory:@"piper-models/nl_NL-mls-medium"];
        if (onnxPath) {
            modelPath = [onnxPath stringByDeletingLastPathComponent];
            RCTLogInfo(@"[PiperTtsModule] Found nl_NL-mls model: %@", modelPath);
        }
    }
    
    // Strategy 4: Flat bundle (files directly in bundle root)
    if (!modelPath) {
        onnxPath = [mainBundle pathForResource:@"nl_BE-rdh-medium" ofType:@"onnx"];
        if (!onnxPath) {
            onnxPath = [mainBundle pathForResource:@"nl_BE-nathalie-medium" ofType:@"onnx"];
        }
        if (!onnxPath) {
            onnxPath = [mainBundle pathForResource:@"nl_NL-mls-medium" ofType:@"onnx"];
        }
        if (onnxPath) {
            // Model is in bundle root - check for espeak-ng-data nearby
            NSString *bundleRoot = [onnxPath stringByDeletingLastPathComponent];
            NSString *espeakPath = [bundleRoot stringByAppendingPathComponent:@"espeak-ng-data"];
            
            if ([fm fileExistsAtPath:espeakPath]) {
                modelPath = bundleRoot;
                RCTLogInfo(@"[PiperTtsModule] Found model flat in bundle root: %@", modelPath);
            } else {
                RCTLogWarn(@"[PiperTtsModule] Found ONNX but missing espeak-ng-data at: %@", espeakPath);
                modelPath = bundleRoot;
            }
        }
    }
    
    // Strategy 5: Directory-based paths (subfolders in bundle)
    if (!modelPath) {
        NSArray *pathsToTry = @[
            [resourcePath stringByAppendingPathComponent:@"piper-models/nl_BE-rdh-medium"],
            [resourcePath stringByAppendingPathComponent:@"piper-models/nl_BE-nathalie-medium"],
            [resourcePath stringByAppendingPathComponent:@"piper-models/nl_NL-mls-medium"],
            [resourcePath stringByAppendingPathComponent:@"nl_BE-rdh-medium"],
            [resourcePath stringByAppendingPathComponent:@"nl_BE-nathalie-medium"],
            [resourcePath stringByAppendingPathComponent:@"nl_NL-mls-medium"],
            [resourcePath stringByAppendingPathComponent:modelDir],
        ];
        
        for (NSString *path in pathsToTry) {
            RCTLogInfo(@"[PiperTtsModule] Trying directory: %@", path);
            // Check for any model
            NSString *rdhFile = [path stringByAppendingPathComponent:@"nl_BE-rdh-medium.onnx"];
            NSString *nathalieFile = [path stringByAppendingPathComponent:@"nl_BE-nathalie-medium.onnx"];
            NSString *mlsFile = [path stringByAppendingPathComponent:@"nl_NL-mls-medium.onnx"];
            if ([fm fileExistsAtPath:rdhFile] || [fm fileExistsAtPath:nathalieFile] || [fm fileExistsAtPath:mlsFile]) {
                modelPath = path;
                RCTLogInfo(@"[PiperTtsModule] Found model at: %@", modelPath);
                break;
            }
        }
    }
    
    if (!modelPath) {
        // Log bundle contents for debugging
        NSArray *contents = [fm contentsOfDirectoryAtPath:resourcePath error:nil];
        RCTLogError(@"[PiperTtsModule] Model not found in bundle!");
        RCTLogError(@"[PiperTtsModule] Bundle contents (%lu items):", (unsigned long)contents.count);
        for (NSString *item in contents) {
            RCTLogError(@"[PiperTtsModule]   - %@", item);
        }
        reject(@"MODEL_NOT_FOUND", @"Model directory not found. Check that piper-models folder reference is added to Copy Bundle Resources build phase.", nil);
        return;
    }

    // Initialize TTS wrapper with optimized parameters for cleaner audio
    // Lower noise_scale values = cleaner/smoother audio
    // noise_scale: controls phoneme-level variability (default 0.667)
    // noise_scale_w: controls word-level variability (default 0.8)  
    // length_scale: controls speaking speed (1.0 = normal, lower = faster)
    auto result = _ttsWrapper->initialize(
        [modelPath UTF8String],
        "vits",   // Piper uses VITS architecture
        2,        // numThreads
        false,    // debug - disable for cleaner logs
        0.333f,   // noiseScale - lower = cleaner audio (default ~0.667)
        0.333f,   // noiseScaleW - lower = more consistent (default ~0.8)
        1.0f      // lengthScale - normal speed
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
    RCTLogInfo(@"[PiperTtsModule] Input text: '%@'", text);

    // Emit start event
    if (_hasListeners) {
        [self sendEventWithName:@"piperStart" body:@{}];
    }

    // Generate speech on background thread
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        @try {
            RCTLogInfo(@"[PiperTtsModule] ABOUT TO CALL _ttsWrapper->generate() - v3");
            RCTLogInfo(@"[PiperTtsModule] Wrapper pointer: %p", (void*)self->_ttsWrapper.get());
            RCTLogInfo(@"[PiperTtsModule] Wrapper initialized: %d", self->_ttsWrapper->isInitialized() ? 1 : 0);
            
            // Generate audio samples
            auto audioResult = self->_ttsWrapper->generate(
                [text UTF8String],
                0,       // speaker ID
                speed    // speed
            );
            
            RCTLogInfo(@"[PiperTtsModule] _ttsWrapper->generate() RETURNED");

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
                    
                    // Start progress timer to send periodic updates
                    [self startProgressTimer];
                    
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

#pragma mark - Chunked Speech Generation

RCT_EXPORT_METHOD(speakChunked:(NSArray<NSString *> *)chunks
                  speed:(float)speed
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!_isInitialized) {
        reject(@"NOT_INITIALIZED", @"TTS not initialized", nil);
        return;
    }
    
    if (!chunks || chunks.count == 0) {
        RCTLogWarn(@"[PiperTtsModule] Empty chunks provided");
        resolve(@NO);
        return;
    }
    
    RCTLogInfo(@"[PiperTtsModule] Starting chunked playback (%lu chunks, speed: %.2f)",
               (unsigned long)chunks.count, speed);
    
    // Stop any existing playback
    [self stopChunkedPlayback];
    [self stopProgressTimer];
    if (_audioPlayer) {
        [_audioPlayer stop];
        _audioPlayer = nil;
    }
    
    // Initialize chunked mode
    _isChunkedMode = YES;
    _currentSpeed = speed;
    _totalChunks = chunks.count;
    _currentChunkIndex = 0;
    _totalDuration = 0;
    _playedDuration = 0;
    
    // Store pending chunks (skip first one, we'll generate it immediately)
    [_pendingChunks removeAllObjects];
    [_chunkDurations removeAllObjects];
    [_playerItemQueue removeAllObjects];
    
    for (NSInteger i = 1; i < chunks.count; i++) {
        [_pendingChunks addObject:chunks[i]];
    }
    
    // Create queue player
    _queuePlayer = [[AVQueuePlayer alloc] init];
    _queuePlayer.actionAtItemEnd = AVPlayerActionAtItemEndAdvance;
    
    // Observe when items finish playing
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(playerItemDidFinish:)
                                                 name:AVPlayerItemDidPlayToEndTimeNotification
                                               object:nil];
    
    // Emit start event
    if (_hasListeners) {
        [self sendEventWithName:@"piperStart" body:@{}];
    }
    
    // Generate first chunk immediately on background thread
    NSString *firstChunk = chunks[0];
    
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
        [self generateAndQueueChunk:firstChunk atIndex:0 isFirst:YES resolve:resolve reject:reject];
    });
}

- (void)generateAndQueueChunk:(NSString *)text atIndex:(NSInteger)index isFirst:(BOOL)isFirst
                      resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
    @try {
        RCTLogInfo(@"[PiperTtsModule] Generating chunk %ld of %ld (length: %lu chars)",
                   (long)index + 1, (long)self->_totalChunks, (unsigned long)text.length);
        
        // Generate audio samples
        auto audioResult = self->_ttsWrapper->generate(
            [text UTF8String],
            0,              // speaker ID
            self->_currentSpeed
        );
        
        if (audioResult.samples.empty()) {
            RCTLogError(@"[PiperTtsModule] Generated empty audio for chunk %ld", (long)index);
            if (isFirst) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    if (self->_hasListeners) {
                        [self sendEventWithName:@"piperError" body:@{@"error": @"Generated empty audio"}];
                    }
                    reject(@"EMPTY_AUDIO", @"Generated empty audio", nil);
                });
            }
            return;
        }
        
        // Save to temporary WAV file
        NSString *tempDir = NSTemporaryDirectory();
        NSString *wavPath = [tempDir stringByAppendingPathComponent:
                             [NSString stringWithFormat:@"piper_chunk_%ld_%lld.wav",
                              (long)index, (long long)[[NSDate date] timeIntervalSince1970] * 1000]];
        
        bool saved = sherpaonnx::TtsWrapper::saveToWavFile(
            audioResult.samples,
            audioResult.sampleRate,
            [wavPath UTF8String]
        );
        
        if (!saved) {
            RCTLogError(@"[PiperTtsModule] Failed to save chunk %ld", (long)index);
            if (isFirst) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    if (self->_hasListeners) {
                        [self sendEventWithName:@"piperError" body:@{@"error": @"Failed to save audio"}];
                    }
                    reject(@"SAVE_FAILED", @"Failed to save audio file", nil);
                });
            }
            return;
        }
        
        // Calculate duration from samples
        NSTimeInterval chunkDuration = (double)audioResult.samples.size() / (double)audioResult.sampleRate;
        
        RCTLogInfo(@"[PiperTtsModule] Chunk %ld generated: %.2fs duration", (long)index, chunkDuration);
        
        // Queue the audio on main thread
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!self->_isChunkedMode) {
                RCTLogInfo(@"[PiperTtsModule] Chunked mode cancelled, ignoring chunk %ld", (long)index);
                return;
            }
            
            NSURL *audioURL = [NSURL fileURLWithPath:wavPath];
            AVPlayerItem *item = [AVPlayerItem playerItemWithURL:audioURL];
            
            // Store duration
            [self->_chunkDurations addObject:@(chunkDuration)];
            self->_totalDuration += chunkDuration;
            
            // Add to queue
            [self->_playerItemQueue addObject:item];
            [self->_queuePlayer insertItem:item afterItem:nil];
            
            RCTLogInfo(@"[PiperTtsModule] Queued chunk %ld, total duration now: %.2fs",
                       (long)index, self->_totalDuration);
            
            if (isFirst) {
                // Start playback immediately for first chunk
                [self->_queuePlayer play];
                [self startChunkedProgressTracking];
                
                RCTLogInfo(@"[PiperTtsModule] Started playback with first chunk");
                resolve(@YES);
                
                // Start generating remaining chunks in background
                [self generateRemainingChunks];
            }
        });
        
    } @catch (NSException *exception) {
        RCTLogError(@"[PiperTtsModule] Chunk generation exception: %@", exception.reason);
        if (isFirst) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (self->_hasListeners) {
                    [self sendEventWithName:@"piperError" body:@{@"error": exception.reason}];
                }
                reject(@"GENERATION_EXCEPTION", exception.reason, nil);
            });
        }
    }
}

- (void)generateRemainingChunks {
    if (_isGeneratingChunks || !_isChunkedMode) {
        return;
    }
    
    _isGeneratingChunks = YES;
    
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSInteger chunkIndex = 1; // Start from second chunk
        
        while (self->_isChunkedMode && self->_pendingChunks.count > 0) {
            // Get next chunk text
            NSString *chunkText;
            @synchronized (self->_pendingChunks) {
                if (self->_pendingChunks.count == 0) break;
                chunkText = self->_pendingChunks[0];
                [self->_pendingChunks removeObjectAtIndex:0];
            }
            
            // Generate this chunk (not first, so no resolve/reject)
            [self generateAndQueueChunk:chunkText atIndex:chunkIndex isFirst:NO resolve:nil reject:nil];
            chunkIndex++;
            
            // Small delay to prevent overwhelming the system
            [NSThread sleepForTimeInterval:0.05];
        }
        
        self->_isGeneratingChunks = NO;
        RCTLogInfo(@"[PiperTtsModule] Finished generating all chunks");
    });
}

- (void)startChunkedProgressTracking {
    // Remove existing observer
    if (_timeObserver) {
        [_queuePlayer removeTimeObserver:_timeObserver];
        _timeObserver = nil;
    }
    
    // Add periodic time observer (every 250ms)
    __weak PiperTtsModule *weakSelf = self;
    _timeObserver = [_queuePlayer addPeriodicTimeObserverForInterval:CMTimeMakeWithSeconds(0.25, NSEC_PER_SEC)
                                                               queue:dispatch_get_main_queue()
                                                          usingBlock:^(CMTime time) {
        [weakSelf reportChunkedProgress];
    }];
}

- (void)reportChunkedProgress {
    if (!_isChunkedMode || !_hasListeners || _totalDuration <= 0) {
        return;
    }
    
    // Calculate current position within current chunk
    NSTimeInterval currentChunkPosition = 0;
    if (_queuePlayer.currentItem) {
        currentChunkPosition = CMTimeGetSeconds(_queuePlayer.currentItem.currentTime);
        if (isnan(currentChunkPosition) || currentChunkPosition < 0) {
            currentChunkPosition = 0;
        }
    }
    
    // Total position = completed chunks + current chunk position
    NSTimeInterval totalPosition = _playedDuration + currentChunkPosition;
    
    // Calculate overall progress percentage
    float progress = (totalPosition / _totalDuration) * 100.0f;
    progress = MIN(100.0f, MAX(0.0f, progress));
    
    [self sendEventWithName:@"piperProgress" body:@{
        @"progress": @(progress),
        @"position": @(totalPosition),
        @"duration": @(_totalDuration)
    }];
}

- (void)playerItemDidFinish:(NSNotification *)notification {
    if (!_isChunkedMode) {
        return;
    }
    
    AVPlayerItem *finishedItem = notification.object;
    
    // Check if this item belongs to our queue
    NSInteger finishedIndex = [_playerItemQueue indexOfObject:finishedItem];
    if (finishedIndex == NSNotFound) {
        return;
    }
    
    // Add this chunk's duration to played duration
    if (finishedIndex < _chunkDurations.count) {
        _playedDuration += [_chunkDurations[finishedIndex] doubleValue];
    }
    
    _currentChunkIndex = finishedIndex + 1;
    
    RCTLogInfo(@"[PiperTtsModule] Chunk %ld finished, moving to chunk %ld of %ld",
               (long)finishedIndex + 1, (long)_currentChunkIndex + 1, (long)_totalChunks);
    
    // Check if all chunks are done
    if (_currentChunkIndex >= _totalChunks) {
        RCTLogInfo(@"[PiperTtsModule] All chunks finished playing");
        [self stopChunkedPlayback];
        
        if (_hasListeners) {
            // Send final 100% progress
            [self sendEventWithName:@"piperProgress" body:@{
                @"progress": @(100),
                @"position": @(_totalDuration),
                @"duration": @(_totalDuration)
            }];
            [self sendEventWithName:@"piperComplete" body:@{}];
        }
    }
}

- (void)stopChunkedPlayback {
    _isChunkedMode = NO;
    _isGeneratingChunks = NO;
    
    // Remove time observer
    if (_timeObserver && _queuePlayer) {
        [_queuePlayer removeTimeObserver:_timeObserver];
        _timeObserver = nil;
    }
    
    // Remove notification observer
    [[NSNotificationCenter defaultCenter] removeObserver:self
                                                    name:AVPlayerItemDidPlayToEndTimeNotification
                                                  object:nil];
    
    // Stop and clear queue player
    if (_queuePlayer) {
        [_queuePlayer pause];
        [_queuePlayer removeAllItems];
        _queuePlayer = nil;
    }
    
    // Clear queues
    [_playerItemQueue removeAllObjects];
    [_pendingChunks removeAllObjects];
    [_chunkDurations removeAllObjects];
    
    _currentChunkIndex = 0;
    _totalChunks = 0;
    _totalDuration = 0;
    _playedDuration = 0;
}

#pragma mark - Playback Control

- (void)startProgressTimer {
    // Stop existing timer if any
    [self stopProgressTimer];
    
    // Create timer that fires every 250ms to report progress
    _progressTimer = [NSTimer scheduledTimerWithTimeInterval:0.25
                                                      target:self
                                                    selector:@selector(reportProgress)
                                                    userInfo:nil
                                                     repeats:YES];
}

- (void)stopProgressTimer {
    if (_progressTimer) {
        [_progressTimer invalidate];
        _progressTimer = nil;
    }
}

- (void)reportProgress {
    if (_audioPlayer && _audioPlayer.isPlaying && _hasListeners) {
        NSTimeInterval currentTime = _audioPlayer.currentTime;
        NSTimeInterval duration = _audioPlayer.duration;
        
        if (duration > 0) {
            float progress = (currentTime / duration) * 100.0f;
            [self sendEventWithName:@"piperProgress" body:@{@"progress": @(progress)}];
        }
    }
}

RCT_EXPORT_METHOD(pause:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self stopProgressTimer];
    
    // Handle chunked mode
    if (_isChunkedMode && _queuePlayer) {
        [_queuePlayer pause];
        RCTLogInfo(@"[PiperTtsModule] Paused (chunked mode)");
    }
    
    // Handle legacy mode
    if (_audioPlayer && _audioPlayer.isPlaying) {
        [_audioPlayer pause];
        RCTLogInfo(@"[PiperTtsModule] Paused (legacy mode)");
    }
    resolve(@YES);
}

RCT_EXPORT_METHOD(resume:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    // Handle chunked mode
    if (_isChunkedMode && _queuePlayer) {
        [_queuePlayer play];
        RCTLogInfo(@"[PiperTtsModule] Resumed (chunked mode)");
    }
    
    // Handle legacy mode
    if (_audioPlayer && !_audioPlayer.isPlaying) {
        [_audioPlayer play];
        [self startProgressTimer];
        RCTLogInfo(@"[PiperTtsModule] Resumed (legacy mode)");
    }
    resolve(@YES);
}

RCT_EXPORT_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self stopProgressTimer];
    
    // Handle chunked mode
    if (_isChunkedMode) {
        [self stopChunkedPlayback];
        RCTLogInfo(@"[PiperTtsModule] Stopped (chunked mode)");
    }
    
    // Handle legacy mode
    if (_audioPlayer) {
        [_audioPlayer stop];
        _audioPlayer = nil;
        RCTLogInfo(@"[PiperTtsModule] Stopped (legacy mode)");
    }
    resolve(@YES);
}

#pragma mark - State Query

RCT_EXPORT_METHOD(isPlaying:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    BOOL isPlaying = NO;
    
    // Check chunked mode
    if (_isChunkedMode && _queuePlayer) {
        isPlaying = _queuePlayer.rate > 0;
    }
    
    // Check legacy mode
    if (_audioPlayer && _audioPlayer.isPlaying) {
        isPlaying = YES;
    }
    
    resolve(@(isPlaying));
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
    [self stopProgressTimer];
    RCTLogInfo(@"[PiperTtsModule] Playback finished (success: %@)", flag ? @"YES" : @"NO");

    if (_hasListeners) {
        // Send final 100% progress before complete event
        [self sendEventWithName:@"piperProgress" body:@{@"progress": @(100)}];
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
    [self stopProgressTimer];
    [self stopChunkedPlayback];
    
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
