/**
 * GlassPlayerWindowModule — Objective-C Bridge for React Native
 *
 * Exposes the GlassPlayerWindowModule Swift class to React Native.
 */

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(GlassPlayerWindowModule, RCTEventEmitter)

RCT_EXTERN_METHOD(isAvailable:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(showMiniPlayer:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(expandToFullPlayer:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(collapseToMini:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(hidePlayer:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateContent:(NSDictionary *)config)

RCT_EXTERN_METHOD(updatePlaybackState:(NSDictionary *)state)

RCT_EXTERN_METHOD(configureControls:(NSDictionary *)controls)

RCT_EXTERN_METHOD(setTemporarilyHidden:(BOOL)hidden)

@end
