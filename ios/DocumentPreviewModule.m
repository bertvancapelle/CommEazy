/**
 * DocumentPreviewModule.m — React Native Bridge for Document Preview + Safari Browser
 *
 * Objective-C bridge macros for exposing Swift DocumentPreviewModule to React Native.
 *
 * @see DocumentPreviewModule.swift for Swift implementation
 */

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DocumentPreviewModule, NSObject)

// Preview a local file using Quick Look (PDF, Word, Excel, etc.)
RCT_EXTERN_METHOD(previewFile:(NSString *)filePath
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Open a URL in SFSafariViewController (in-app browser)
RCT_EXTERN_METHOD(openURL:(NSString *)urlString
                  tintColorHex:(NSString *)tintColorHex
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Check if a file can be previewed
RCT_EXTERN_METHOD(canPreviewFile:(NSString *)filePath
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
