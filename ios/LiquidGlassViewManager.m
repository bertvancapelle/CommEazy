/**
 * LiquidGlassViewManager.m — React Native View Manager Bridge
 *
 * Objective-C bridge for LiquidGlassViewManager Swift class.
 * Exports view properties to React Native.
 *
 * @see LiquidGlassViewManager.swift for Swift implementation
 */

#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(LiquidGlassViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(tintColorHex, NSString)
RCT_EXPORT_VIEW_PROPERTY(tintIntensity, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(glassStyle, NSString)
RCT_EXPORT_VIEW_PROPERTY(cornerRadius, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(fallbackColorHex, NSString)

@end
