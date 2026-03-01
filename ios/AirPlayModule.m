/**
 * AirPlayModule.m — React Native Bridge for AirPlay route detection
 *
 * Objective-C bridge macros for exposing Swift AirPlayModule to React Native.
 *
 * @see AirPlayModule.swift for Swift implementation
 */

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(AirPlayModule, RCTEventEmitter)

RCT_EXTERN_METHOD(startDetection:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopDetection:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getCurrentRoute:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
