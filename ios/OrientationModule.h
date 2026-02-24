/**
 * OrientationModule — Screen Orientation Control
 *
 * Controls screen orientation for the app. Default is portrait-only on iPhone,
 * with an exception for fullscreen video playback which allows landscape.
 *
 * iPad always allows all orientations.
 *
 * Usage from React Native:
 * - OrientationModule.setLandscapeAllowed(true)  — Enable landscape (for video)
 * - OrientationModule.setLandscapeAllowed(false) — Disable landscape (default)
 *
 * @see src/services/orientationService.ts
 */

#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

@interface OrientationModule : NSObject <RCTBridgeModule>

/**
 * Check if landscape is currently allowed.
 * Called by AppDelegate to determine supported orientations.
 */
+ (BOOL)isLandscapeAllowed;

/**
 * Get the supported interface orientations based on current state.
 * Called by AppDelegate.
 */
+ (UIInterfaceOrientationMask)supportedOrientations;

@end
