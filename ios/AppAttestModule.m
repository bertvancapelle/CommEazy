/**
 * AppAttestModule — Objective-C Bridge
 *
 * Exposes Swift AppAttestModule methods to React Native via RCT macros.
 *
 * @see AppAttestModule.swift for implementation
 * @see TRUST_AND_ATTESTATION_PLAN.md section 3.1
 */

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppAttestModule, NSObject)

RCT_EXTERN_METHOD(isSupported:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(generateKey:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(attestKey:(NSString *)keyId
                  clientDataHash:(NSString *)clientDataHash
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(generateAssertion:(NSString *)keyId
                  clientDataHash:(NSString *)clientDataHash
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(sha256Hash:(NSString *)input
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
