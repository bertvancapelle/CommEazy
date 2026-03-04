#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
#import <PushKit/PushKit.h>
#import "RNAppAuthAuthorizationFlowManager.h"

@interface AppDelegate : RCTAppDelegate <PKPushRegistryDelegate, RNAppAuthAuthorizationFlowManager>

@property (nonatomic, weak) id<RNAppAuthAuthorizationFlowManagerDelegate> authorizationFlowManagerDelegate;

@end
