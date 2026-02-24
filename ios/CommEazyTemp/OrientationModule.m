/**
 * OrientationModule — Screen Orientation Control Implementation
 *
 * Manages screen orientation restrictions. Portrait-only by default on iPhone,
 * with programmatic control for fullscreen video.
 *
 * Automatic video detection:
 * - Detects AVPlayerViewController (native fullscreen video)
 * - Allows landscape when video is fullscreen
 * - Locks back to portrait when video exits fullscreen
 */

#import "OrientationModule.h"
#import <React/RCTLog.h>
#import <AVKit/AVKit.h>

static BOOL _landscapeAllowed = NO;

@implementation OrientationModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

#pragma mark - Static Methods (for AppDelegate)

+ (BOOL)isLandscapeAllowed {
    return _landscapeAllowed;
}

/**
 * Check if AVPlayerViewController is currently presented (fullscreen video)
 */
+ (BOOL)isVideoFullscreen {
    UIViewController *rootVC = [UIApplication sharedApplication].keyWindow.rootViewController;
    return [self findAVPlayerViewControllerInHierarchy:rootVC] != nil;
}

/**
 * Recursively search for AVPlayerViewController in the view controller hierarchy
 */
+ (AVPlayerViewController *)findAVPlayerViewControllerInHierarchy:(UIViewController *)viewController {
    if (!viewController) {
        return nil;
    }

    // Check if this is an AVPlayerViewController
    if ([viewController isKindOfClass:[AVPlayerViewController class]]) {
        return (AVPlayerViewController *)viewController;
    }

    // Check presented view controller
    if (viewController.presentedViewController) {
        AVPlayerViewController *found = [self findAVPlayerViewControllerInHierarchy:viewController.presentedViewController];
        if (found) {
            return found;
        }
    }

    // Check child view controllers
    for (UIViewController *child in viewController.childViewControllers) {
        AVPlayerViewController *found = [self findAVPlayerViewControllerInHierarchy:child];
        if (found) {
            return found;
        }
    }

    // Check navigation controller's view controllers
    if ([viewController isKindOfClass:[UINavigationController class]]) {
        UINavigationController *navVC = (UINavigationController *)viewController;
        for (UIViewController *child in navVC.viewControllers) {
            AVPlayerViewController *found = [self findAVPlayerViewControllerInHierarchy:child];
            if (found) {
                return found;
            }
        }
    }

    // Check tab bar controller's view controllers
    if ([viewController isKindOfClass:[UITabBarController class]]) {
        UITabBarController *tabVC = (UITabBarController *)viewController;
        for (UIViewController *child in tabVC.viewControllers) {
            AVPlayerViewController *found = [self findAVPlayerViewControllerInHierarchy:child];
            if (found) {
                return found;
            }
        }
    }

    return nil;
}

+ (UIInterfaceOrientationMask)supportedOrientations {
    // iPad: Always allow all orientations
    if (UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad) {
        return UIInterfaceOrientationMaskAll;
    }

    // Check if fullscreen video is playing
    if ([self isVideoFullscreen]) {
        RCTLogInfo(@"[OrientationModule] Video fullscreen detected, allowing landscape");
        return UIInterfaceOrientationMaskAllButUpsideDown;
    }

    // iPhone: Portrait only, unless landscape is explicitly allowed
    if (_landscapeAllowed) {
        return UIInterfaceOrientationMaskAllButUpsideDown;
    }

    return UIInterfaceOrientationMaskPortrait;
}

#pragma mark - React Native Methods

RCT_EXPORT_METHOD(setLandscapeAllowed:(BOOL)allowed) {
    RCTLogInfo(@"[OrientationModule] Landscape allowed: %@", allowed ? @"YES" : @"NO");

    _landscapeAllowed = allowed;

    // Force orientation update on main thread
    dispatch_async(dispatch_get_main_queue(), ^{
        // This triggers the system to re-evaluate supported orientations
        if (@available(iOS 16.0, *)) {
            // iOS 16+ uses the new API
            NSArray<UIWindowScene *> *scenes = [[UIApplication sharedApplication].connectedScenes allObjects];
            for (UIWindowScene *scene in scenes) {
                if ([scene isKindOfClass:[UIWindowScene class]]) {
                    UIWindowSceneGeometryPreferencesIOS *preferences =
                        [[UIWindowSceneGeometryPreferencesIOS alloc] initWithInterfaceOrientations:[OrientationModule supportedOrientations]];
                    [scene requestGeometryUpdateWithPreferences:preferences errorHandler:^(NSError * _Nonnull error) {
                        RCTLogError(@"[OrientationModule] Geometry update error: %@", error.localizedDescription);
                    }];
                }
            }
        } else {
            // iOS 15 and earlier - trigger rotation
            [UIViewController attemptRotationToDeviceOrientation];
        }
    });
}

RCT_EXPORT_METHOD(isLandscapeAllowedAsync:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@(_landscapeAllowed));
}

RCT_EXPORT_METHOD(lockToPortrait) {
    [self setLandscapeAllowed:NO];

    // Force device back to portrait if in landscape
    dispatch_async(dispatch_get_main_queue(), ^{
        if (@available(iOS 16.0, *)) {
            NSArray<UIWindowScene *> *scenes = [[UIApplication sharedApplication].connectedScenes allObjects];
            for (UIWindowScene *scene in scenes) {
                if ([scene isKindOfClass:[UIWindowScene class]]) {
                    UIWindowSceneGeometryPreferencesIOS *preferences =
                        [[UIWindowSceneGeometryPreferencesIOS alloc] initWithInterfaceOrientations:UIInterfaceOrientationMaskPortrait];
                    [scene requestGeometryUpdateWithPreferences:preferences errorHandler:^(NSError * _Nonnull error) {
                        RCTLogError(@"[OrientationModule] Lock to portrait error: %@", error.localizedDescription);
                    }];
                }
            }
        } else {
            // For iOS 15 and earlier, we need to use the deprecated setValue:forKey:
            [[UIDevice currentDevice] setValue:@(UIInterfaceOrientationPortrait) forKey:@"orientation"];
            [UIViewController attemptRotationToDeviceOrientation];
        }
    });
}

RCT_EXPORT_METHOD(unlockForVideo) {
    [self setLandscapeAllowed:YES];
}

RCT_EXPORT_METHOD(isVideoFullscreenAsync:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        resolve(@([OrientationModule isVideoFullscreen]));
    });
}

@end
