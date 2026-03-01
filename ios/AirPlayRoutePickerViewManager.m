/**
 * AirPlayRoutePickerViewManager.m — React Native View Manager Bridge
 *
 * Objective-C bridge for AirPlayRoutePickerViewManager Swift class.
 * Exports view properties to React Native.
 *
 * @see AirPlayRoutePickerViewManager.swift for Swift implementation
 */

#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(AirPlayRoutePickerViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(tintColorHex, NSString)
RCT_EXPORT_VIEW_PROPERTY(activeTintColorHex, NSString)
RCT_EXPORT_VIEW_PROPERTY(buttonSize, CGFloat)

@end
