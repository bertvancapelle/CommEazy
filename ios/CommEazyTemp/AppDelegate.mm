#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <Firebase.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <UserNotifications/UserNotifications.h>
#import <PushKit/PushKit.h>
#import "RNCallKeep.h"
#import "OrientationModule.h"

// Forward declaration — VoIPPushModule is a Swift class
// We access it via NSClassFromString at runtime to avoid circular build dependency
// (Swift header can't be generated until Swift files compile,
//  but ObjC needs it to compile → we break the cycle with runtime lookup)

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

  // Setup CallKeep (CallKit wrapper)
  // This enables native iOS call UI for incoming/outgoing calls
  [RNCallKeep setup:@{
    @"appName": @"CommEazy",
    @"maximumCallGroups": @1,
    @"maximumCallsPerCallGroup": @3,
    @"supportsVideo": @YES,
    @"includesCallsInRecents": @YES
  }];

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

// MARK: - CallKeep Continue User Activity (Siri, Recents) + Universal Links Blocking

- (BOOL)application:(UIApplication *)application continueUserActivity:(NSUserActivity *)userActivity restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler
{
  // Block Universal Links for news sites to keep users in our WebView
  // When we return NO, iOS will NOT open the external app
  if ([userActivity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) {
    NSURL *url = userActivity.webpageURL;
    if (url) {
      NSString *host = url.host.lowercaseString;

      // Block nu.nl and DPG Media Universal Links
      // These should stay in our WebView, not open external apps
      NSArray *blockedHosts = @[
        @"nu.nl",
        @"www.nu.nl",
        @"m.nu.nl",
        @"dpgmedia.nl",
        @"myprivacy.dpgmedia.nl"
      ];

      for (NSString *blocked in blockedHosts) {
        if ([host isEqualToString:blocked] || [host hasSuffix:[@"." stringByAppendingString:blocked]]) {
          NSLog(@"[UniversalLinks] Blocked external app for: %@", host);
          return NO; // Don't handle = don't open external app
        }
      }
    }
  }

  // Let CallKeep handle call-related activities (Siri, Recents)
  return [RNCallKeep application:application continueUserActivity:userActivity restorationHandler:restorationHandler];
}

// MARK: - Orientation Control

- (UIInterfaceOrientationMask)application:(UIApplication *)application supportedInterfaceOrientationsForWindow:(UIWindow *)window
{
  return [OrientationModule supportedOrientations];
}

// MARK: - PushKit (VoIP Push) Delegate

- (void)pushRegistry:(PKPushRegistry *)registry didUpdatePushCredentials:(PKPushCredentials *)pushCredentials forType:(PKPushType)type
{
  if (![type isEqualToString:PKPushTypeVoIP]) return;

  // Convert token data to hex string
  const unsigned char *bytes = (const unsigned char *)[pushCredentials.token bytes];
  NSMutableString *tokenString = [NSMutableString stringWithCapacity:[pushCredentials.token length] * 2];
  for (NSUInteger i = 0; i < [pushCredentials.token length]; i++) {
    [tokenString appendFormat:@"%02x", bytes[i]];
  }

  NSLog(@"[VoIPPush] Token received: ...%@", [tokenString substringFromIndex:MAX(0, (NSInteger)tokenString.length - 6)]);

  // Forward token to VoIPPushModule for React Native (runtime lookup to avoid circular dependency)
  id module = [NSClassFromString(@"CommEazyTemp.VoIPPushModule") valueForKey:@"shared"];
  if (module && [module respondsToSelector:@selector(didReceiveVoIPToken:)]) {
    [module performSelector:@selector(didReceiveVoIPToken:) withObject:tokenString];
  }
}

- (void)pushRegistry:(PKPushRegistry *)registry didInvalidatePushTokenForType:(PKPushType)type
{
  if (![type isEqualToString:PKPushTypeVoIP]) return;
  NSLog(@"[VoIPPush] Token invalidated");
}

- (void)pushRegistry:(PKPushRegistry *)registry didReceiveIncomingPushWithPayload:(PKPushPayload *)payload forType:(PKPushType)type withCompletionHandler:(void (^)(void))completion
{
  if (![type isEqualToString:PKPushTypeVoIP]) {
    completion();
    return;
  }

  NSLog(@"[VoIPPush] Incoming VoIP push received");

  // CRITICAL: Must report to CallKit IMMEDIATELY
  // Apple requires that every VoIP push results in a CallKit reportNewIncomingCall.
  // Failing to do so will cause iOS to terminate the app and may revoke push privileges.
  NSString *callUUID = [[NSUUID UUID] UUIDString];
  NSString *callerName = @"CommEazy";  // Placeholder — updated via XMPP when connected

  [RNCallKeep reportNewIncomingCall:callUUID
                             handle:@"commeazy"
                         handleType:@"generic"
                           hasVideo:NO
                localizedCallerName:callerName
                    supportsHolding:NO
                       supportsDTMF:NO
                   supportsGrouping:NO
                 supportsUngrouping:NO
                        fromPushKit:YES
                            payload:payload.dictionaryPayload
              withCompletionHandler:nil];

  // Forward to VoIPPushModule for React Native event (runtime lookup)
  id module = [NSClassFromString(@"CommEazyTemp.VoIPPushModule") valueForKey:@"shared"];
  if (module && [module respondsToSelector:@selector(didReceiveVoIPPush:)]) {
    [module performSelector:@selector(didReceiveVoIPPush:) withObject:payload.dictionaryPayload];
  }

  completion();
}

@end
