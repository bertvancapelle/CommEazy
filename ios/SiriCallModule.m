/**
 * SiriCallModule — React Native Bridge
 *
 * Exposes SiriCallModule to JavaScript.
 */

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(SiriCallModule, RCTEventEmitter)

RCT_EXTERN_METHOD(requestSiriAuthorization:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getSiriAuthorizationStatus:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(donateCallShortcut:(NSString *)contactName
                  contactId:(NSString *)contactId
                  callType:(NSString *)callType
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
