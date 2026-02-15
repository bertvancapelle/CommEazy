/**
 * AudioServices Native Module
 *
 * Provides access to iOS AudioServicesPlaySystemSound for accessible
 * audio feedback that respects system settings (silent mode, etc.)
 *
 * System sound IDs used:
 * - 1104: Tock (tap feedback)
 * - 1025: New mail (success)
 * - 1073: SMS received (warning)
 * - 1053: Tweet sent (error)
 *
 * @see src/hooks/useFeedback.ts
 */

#import "AudioServices.h"
#import <AudioToolbox/AudioToolbox.h>

@implementation AudioServices

RCT_EXPORT_MODULE();

/**
 * Play a system sound by ID.
 * System sounds automatically respect the device's silent mode switch.
 *
 * @param soundId The system sound ID to play (e.g., 1104 for Tock)
 */
RCT_EXPORT_METHOD(playSystemSound:(int)soundId)
{
    // AudioServicesPlaySystemSound respects the ringer switch on iOS
    // When the ringer is off, most sounds won't play (which is the desired behavior)
    AudioServicesPlaySystemSound((SystemSoundID)soundId);
}

/**
 * Play a system sound with vibration.
 * Useful for stronger feedback on important actions.
 *
 * @param soundId The system sound ID to play
 */
RCT_EXPORT_METHOD(playSystemSoundWithVibration:(int)soundId)
{
    AudioServicesPlaySystemSound((SystemSoundID)soundId);
    // Also trigger a short vibration for additional feedback
    AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
}

/**
 * Play only vibration (no sound).
 * Useful when audio is disabled but haptic is enabled.
 */
RCT_EXPORT_METHOD(playVibration)
{
    AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
}

@end
