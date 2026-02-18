#import "AppDelegate.h"

#import <React-Core/RCTBundleURLProvider.h>
#import <Firebase.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <UserNotifications/UserNotifications.h>

@interface AppDelegate () <UNUserNotificationCenterDelegate, FIRMessagingDelegate>
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Configure Firebase
  [FIRApp configure];

  // Setup notification delegates
  [UNUserNotificationCenter currentNotificationCenter].delegate = self;
  [FIRMessaging messaging].delegate = self;

  // Request notification permission and register for remote notifications
  UNAuthorizationOptions authOptions = UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge;
  [[UNUserNotificationCenter currentNotificationCenter] requestAuthorizationWithOptions:authOptions
    completionHandler:^(BOOL granted, NSError * _Nullable error) {
      if (granted) {
        NSLog(@"[Push] Notification permission granted");
      } else {
        NSLog(@"[Push] Notification permission denied: %@", error.localizedDescription);
      }
    }];
  
  // Register for remote notifications - this is required for APNs!
  dispatch_async(dispatch_get_main_queue(), ^{
    [[UIApplication sharedApplication] registerForRemoteNotifications];
    NSLog(@"[Push] Registered for remote notifications");
  });

  self.moduleName = @"CommEazyTemp";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}

- (NSURL *)getBundleURL
{
#if DEBUG
  // For physical devices, use Mac's LAN IP instead of localhost
  // Metro must be started with: npm start -- --host 10.10.15.75
  RCTBundleURLProvider *settings = [RCTBundleURLProvider sharedSettings];

  // Check if running on simulator or physical device
  #if TARGET_IPHONE_SIMULATOR
    // Simulator can use localhost
    return [settings jsBundleURLForBundleRoot:@"index"];
  #else
    // Physical device needs LAN IP - set the JS location explicitly
    [settings setJsLocation:@"10.10.15.75"];
    return [settings jsBundleURLForBundleRoot:@"index"];
  #endif
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

// MARK: - Push Notification Registration

- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  // Pass APNs token to Firebase
  [FIRMessaging messaging].APNSToken = deviceToken;
  
  // Log the APNs token for debugging
  const unsigned char *bytes = (const unsigned char *)[deviceToken bytes];
  NSMutableString *tokenString = [NSMutableString stringWithCapacity:[deviceToken length] * 2];
  for (NSUInteger i = 0; i < [deviceToken length]; i++) {
    [tokenString appendFormat:@"%02x", bytes[i]];
  }
  NSLog(@"[APNs] Device token registered: %@", tokenString);
}

- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  NSLog(@"[APNs] Failed to register: %@", error.localizedDescription);
}

// MARK: - UNUserNotificationCenterDelegate

// Handle notification when app is in foreground
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler
{
  NSDictionary *userInfo = notification.request.content.userInfo;
  NSLog(@"[Push] Foreground notification: %@", userInfo[@"type"]);

  // Show notification even when app is in foreground
  // Options: badge, sound, banner (iOS 14+), list (iOS 14+)
  completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound | UNNotificationPresentationOptionBadge);
}

// Handle notification tap
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler
{
  NSDictionary *userInfo = response.notification.request.content.userInfo;
  NSLog(@"[Push] Notification tapped: %@", userInfo[@"type"]);

  // React Native Firebase will handle the notification data
  completionHandler();
}

// MARK: - FIRMessagingDelegate

- (void)messaging:(FIRMessaging *)messaging didReceiveRegistrationToken:(NSString *)fcmToken
{
  NSLog(@"[FCM] Token: %@", [fcmToken substringToIndex:MIN(30, fcmToken.length)]);

  // Post notification for React Native to listen to
  NSDictionary *dataDict = @{@"token": fcmToken ?: @""};
  [[NSNotificationCenter defaultCenter] postNotificationName:@"FCMToken" object:nil userInfo:dataDict];
}

@end
