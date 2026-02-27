// VoIPPushModule.m
// ObjC bridge for VoIPPushModule.swift

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(VoIPPushModule, RCTEventEmitter)

RCT_EXTERN_METHOD(registerForVoIPPush)
RCT_EXTERN_METHOD(getVoIPToken:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
