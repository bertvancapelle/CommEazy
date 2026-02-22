/**
 * AppleMusicModule.m — React Native Bridge for Apple Music
 *
 * Objective-C bridge macros for exposing Swift Apple Music module to React Native.
 * Uses RCT_EXTERN_MODULE and RCT_EXTERN_METHOD to bridge Swift async methods.
 *
 * @see AppleMusicModule.swift for Swift implementation
 * @see .claude/plans/APPLE_MUSIC_IMPLEMENTATION.md
 */

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// ============================================================
// MARK: - Module Bridge
// ============================================================

@interface RCT_EXTERN_MODULE(AppleMusicModule, RCTEventEmitter)

// ============================================================
// MARK: - Authorization
// ============================================================

RCT_EXTERN_METHOD(checkAuthStatus:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(requestAuthorization:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(checkSubscription:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// ============================================================
// MARK: - Catalog Search
// ============================================================

RCT_EXTERN_METHOD(searchCatalog:(NSString *)query
                  types:(NSArray *)types
                  limit:(NSInteger)limit
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getTopCharts:(NSArray *)types
                  limit:(NSInteger)limit
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// ============================================================
// MARK: - Playback Control
// ============================================================

RCT_EXTERN_METHOD(playSong:(NSString *)songId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(playAlbum:(NSString *)albumId
                  startIndex:(NSInteger)startIndex
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(playPlaylist:(NSString *)playlistId
                  startIndex:(NSInteger)startIndex
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(pause:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(resume:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(skipToNext:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(skipToPrevious:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(seekTo:(double)position
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// ============================================================
// MARK: - Shuffle & Repeat Modes
// ============================================================

RCT_EXTERN_METHOD(setShuffleMode:(NSString *)mode
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getShuffleMode:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setRepeatMode:(NSString *)mode
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getRepeatMode:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// ============================================================
// MARK: - Queue Management
// ============================================================

RCT_EXTERN_METHOD(getQueue:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(addToQueue:(NSString *)songId
                  position:(NSString *)position
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// ============================================================
// MARK: - Playback State
// ============================================================

RCT_EXTERN_METHOD(getPlaybackState:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getNowPlaying:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
