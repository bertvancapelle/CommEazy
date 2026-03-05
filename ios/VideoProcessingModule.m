/**
 * VideoProcessingModule.m — React Native Bridge for Video Processing
 *
 * Objective-C bridge macros for exposing Swift VideoProcessingModule to React Native.
 *
 * @see VideoProcessingModule.swift for Swift implementation
 */

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VideoProcessingModule, NSObject)

// Compress a video file (H.264, configurable quality/resolution)
RCT_EXTERN_METHOD(compressVideo:(NSString *)inputPath
                  quality:(NSString *)quality
                  maxWidth:(nonnull NSNumber *)maxWidth
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Generate a JPEG thumbnail at specified timestamp
RCT_EXTERN_METHOD(generateThumbnail:(NSString *)inputPath
                  timeMs:(nonnull NSNumber *)timeMs
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Extract video metadata (duration, dimensions, size, codec)
RCT_EXTERN_METHOD(getVideoMetadata:(NSString *)inputPath
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
