/**
 * MailBackgroundFetchModule — ObjC Bridge
 *
 * Exposes MailBackgroundFetchModule to React Native JavaScript layer.
 * Used for badge count management and manual mail checks.
 */

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MailBackgroundFetchModule, NSObject)

RCT_EXTERN_METHOD(getUnreadCount:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearUnreadBadge:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(checkMailNow:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(initializeBaseline:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

@end
