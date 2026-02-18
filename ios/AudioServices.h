/**
 * AudioServices Native Module
 *
 * Provides access to iOS AudioServicesPlaySystemSound for accessible
 * audio feedback that respects system settings (silent mode, etc.)
 *
 * @see src/hooks/useFeedback.ts
 */

#import <React-Core/RCTBridgeModule.h>

@interface AudioServices : NSObject <RCTBridgeModule>

@end
