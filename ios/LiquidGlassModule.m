/**
 * LiquidGlassModule.m — React Native Bridge for Liquid Glass
 *
 * Objective-C bridge macros for exposing Swift Liquid Glass module to React Native.
 *
 * @see LiquidGlassModule.swift for Swift implementation
 * @see LiquidGlassViewManager.swift for view manager
 */

#import <React/RCTBridgeModule.h>
#import <React/RCTViewManager.h>

// ============================================================
// MARK: - Module Bridge
// ============================================================

@interface RCT_EXTERN_MODULE(LiquidGlassModule, NSObject)

RCT_EXTERN_METHOD(isSupported:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getIOSVersion:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end

// ============================================================
// MARK: - View Manager Bridge
// ============================================================

// View manager is fully implemented in Swift (LiquidGlassViewManager.swift)
// The view properties are exported via RCT_EXPORT_VIEW_PROPERTY in the Swift class
// using the @objc attribute on the view properties
