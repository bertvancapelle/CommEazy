/**
 * AudioServices Native Module
 *
 * Provides access to iOS AudioServicesPlaySystemSound for accessible
 * audio feedback that respects system settings (silent mode, etc.)
 *
 * Also provides Core Haptics support for precise haptic intensity control.
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
#import <CoreHaptics/CoreHaptics.h>

@interface AudioServices ()
@property (nonatomic, strong) CHHapticEngine *hapticEngine API_AVAILABLE(ios(13.0));
@end

@implementation AudioServices

RCT_EXPORT_MODULE();

/**
 * Required by React Native for modules that override init.
 * Returns YES to indicate this module should be initialized on the main queue.
 */
+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        [self setupHapticEngine];
    }
    return self;
}

- (void)setupHapticEngine {
    if (@available(iOS 13.0, *)) {
        NSError *error = nil;
        self.hapticEngine = [[CHHapticEngine alloc] initAndReturnError:&error];
        if (error) {
            NSLog(@"[AudioServices] Failed to create haptic engine: %@", error);
            return;
        }

        // Set auto-shutdown mode
        self.hapticEngine.autoShutdownEnabled = YES;

        // Handle engine reset
        __weak typeof(self) weakSelf = self;
        self.hapticEngine.resetHandler = ^{
            NSLog(@"[AudioServices] Haptic engine reset");
            NSError *startError = nil;
            [weakSelf.hapticEngine startAndReturnError:&startError];
            if (startError) {
                NSLog(@"[AudioServices] Failed to restart haptic engine: %@", startError);
            }
        };

        // Start the engine
        [self.hapticEngine startAndReturnError:&error];
        if (error) {
            NSLog(@"[AudioServices] Failed to start haptic engine: %@", error);
        } else {
            NSLog(@"[AudioServices] Haptic engine started successfully");
        }
    }
}

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

/**
 * Play a system sound as alert (ignores silent mode).
 * On silent mode, this will vibrate instead of playing sound.
 *
 * Uses reliable system sounds that are definitely audible:
 * - 1057 = Mail Sent whoosh (nice, distinctive)
 * - 1306 = Begin Recording beep
 * - 1007 = SMS Received (if you want classic message sound)
 *
 * @param soundId The system sound ID to play (defaults to 1007 if 0 or invalid)
 */
RCT_EXPORT_METHOD(playAlertSound:(int)soundId)
{
    NSLog(@"[AudioServices] playAlertSound called with soundId: %d", soundId);

    // Use a well-known, reliably audible system sound
    // 1007 = SMS Received - very recognizable "tri-tone" sound
    SystemSoundID actualSoundId = (soundId > 0) ? (SystemSoundID)soundId : 1007;

    NSLog(@"[AudioServices] Playing alert sound with ID: %u", actualSoundId);
    AudioServicesPlayAlertSound(actualSoundId);
    NSLog(@"[AudioServices] playAlertSound completed");
}

/**
 * Play a boosted alert sound - HETZELFDE geluid als normaal, maar met extra vibratie
 * en herhaling voor een "versterkt" effect.
 *
 * Verschil met normaal:
 * - Normaal: 1x geluid (1007 tri-tone)
 * - Versterkt: 1x vibratie + 2x ZELFDE geluid (1007) + 1x vibratie
 *
 * Dit maakt het verschil duidelijk hoorbaar: versterkt = langer/meer
 *
 * @param soundId The system sound ID to play (uses 1007 as default)
 */
RCT_EXPORT_METHOD(playBoostedAlertSound:(int)soundId)
{
    NSLog(@"[AudioServices] 🔊 playBoostedAlertSound called");

    // Gebruik ZELFDE geluid als normaal, maar met extra feedback
    SystemSoundID normalSoundId = (soundId > 0) ? (SystemSoundID)soundId : 1007;

    // 1. Eerst vibratie voor directe tactiele feedback
    AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);

    // 2. Eerste keer het geluid (zelfde als normaal)
    AudioServicesPlayAlertSound(normalSoundId);
    NSLog(@"[AudioServices] 🔊 Playing first sound (%u)", normalSoundId);

    // 3. Tweede keer HETZELFDE geluid na korte pauze (dit maakt het "versterkt")
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.4 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        AudioServicesPlayAlertSound(normalSoundId);
        NSLog(@"[AudioServices] 🔊 Playing second sound (%u)", normalSoundId);
    });

    // 4. Afsluitende vibratie
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.8 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
    });

    NSLog(@"[AudioServices] playBoostedAlertSound sequence started");
}

/**
 * Trigger a strong haptic feedback pattern.
 * Uses multiple vibrations for emphasis.
 */
RCT_EXPORT_METHOD(playStrongHaptic)
{
    NSLog(@"[AudioServices] playStrongHaptic called");
    // Play vibration twice with slight delay for stronger effect
    AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
    });
    NSLog(@"[AudioServices] playStrongHaptic completed");
}

/**
 * Play haptic feedback with a specific intensity level using Core Haptics.
 * This provides much better control over haptic intensity than the standard APIs.
 *
 * @param intensity The intensity level: 1=veryLight, 2=light, 3=normal, 4=strong
 */
RCT_EXPORT_METHOD(playHapticWithIntensity:(int)intensity)
{
    NSLog(@"[AudioServices] playHapticWithIntensity called with intensity: %d", intensity);
    
    // Check if device supports haptics (simulator doesn't)
    if (@available(iOS 13.0, *)) {
        if (![CHHapticEngine capabilitiesForHardware].supportsHaptics) {
            NSLog(@"[AudioServices] Device does not support haptics (simulator?), using audio feedback instead");
            // Play different sounds for different intensities so user can hear the difference
            switch (intensity) {
                case 1: // veryLight
                    AudioServicesPlaySystemSound(1519); // Actuate - very soft
                    break;
                case 2: // light
                    AudioServicesPlaySystemSound(1520); // Actuate - soft
                    break;
                case 3: // normal
                    AudioServicesPlaySystemSound(1521); // Actuate - normal
                    break;
                case 4: // strong
                    AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
                    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
                    });
                    break;
                default:
                    AudioServicesPlaySystemSound(1520);
                    break;
            }
            return;
        }
        
        if (!self.hapticEngine) {
            // Try to recreate the engine
            [self setupHapticEngine];
        }
        
        if (!self.hapticEngine) {
            NSLog(@"[AudioServices] Haptic engine not available, falling back to vibration");
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
            return;
        }
        
        // Ensure engine is running (may have auto-shutdown)
        NSError *startError = nil;
        [self.hapticEngine startAndReturnError:&startError];
        if (startError) {
            NSLog(@"[AudioServices] Failed to start haptic engine: %@", startError);
            // Continue anyway - the engine might still work
        }

        // Map intensity levels to Core Haptics values
        // Intensity: 0.0 to 1.0 (we use 0.2, 0.4, 0.7, 1.0 for noticeable differences)
        // Sharpness: 0.0 (soft/dull) to 1.0 (sharp/crisp)
        float hapticIntensity;
        float hapticSharpness;
        float duration;

        // VEEL intensere waarden voor merkbaar verschil
        // Lagere sharpness = meer "trillend/rommelend" gevoel (minder "tik")
        // Langere duration = langer voelbaar
        switch (intensity) {
            case 1: // veryLight - subtiel maar voelbaar trillen
                hapticIntensity = 0.4;
                hapticSharpness = 0.1;  // Zeer zacht/rommelend
                duration = 0.15;
                break;
            case 2: // light - duidelijk trillen
                hapticIntensity = 0.7;
                hapticSharpness = 0.2;  // Zacht/rommelend
                duration = 0.25;
                break;
            case 3: // normal - stevig trillen
                hapticIntensity = 0.9;
                hapticSharpness = 0.3;  // Iets scherper maar nog steeds trillend
                duration = 0.35;
                break;
            case 4: // strong - maximaal trillen
                hapticIntensity = 1.0;
                hapticSharpness = 0.4;  // Nog steeds relatief zacht voor tril-gevoel
                duration = 0.5;         // Langste duur
                break;
            default:
                hapticIntensity = 0.8;
                hapticSharpness = 0.3;
                duration = 0.3;
                break;
        }

        NSLog(@"[AudioServices] Playing haptic: intensity=%.2f, sharpness=%.2f, duration=%.2f",
              hapticIntensity, hapticSharpness, duration);

        NSError *error = nil;

        // Create haptic event parameters
        CHHapticEventParameter *intensityParam =
            [[CHHapticEventParameter alloc] initWithParameterID:CHHapticEventParameterIDHapticIntensity
                                                          value:hapticIntensity];
        CHHapticEventParameter *sharpnessParam =
            [[CHHapticEventParameter alloc] initWithParameterID:CHHapticEventParameterIDHapticSharpness
                                                          value:hapticSharpness];

        // Create a CONTINUOUS haptic event (sustained vibration, not a short tap)
        // CHHapticEventTypeHapticContinuous = langdurig trillen
        // CHHapticEventTypeHapticTransient = korte tik
        CHHapticEvent *event =
            [[CHHapticEvent alloc] initWithEventType:CHHapticEventTypeHapticContinuous
                                          parameters:@[intensityParam, sharpnessParam]
                                        relativeTime:0
                                            duration:duration];

        // For strong intensity (4), add extra vibration pulses for maximum effect
        NSArray<CHHapticEvent *> *events;
        if (intensity == 4) {
            // Drie pulsen voor "strong" - voelt als krachtige vibratie
            CHHapticEvent *event2 =
                [[CHHapticEvent alloc] initWithEventType:CHHapticEventTypeHapticContinuous
                                              parameters:@[intensityParam, sharpnessParam]
                                            relativeTime:0.55  // Na eerste event
                                                duration:0.3];
            CHHapticEvent *event3 =
                [[CHHapticEvent alloc] initWithEventType:CHHapticEventTypeHapticContinuous
                                              parameters:@[intensityParam, sharpnessParam]
                                            relativeTime:0.9   // Na tweede event
                                                duration:0.25];
            events = @[event, event2, event3];
        } else {
            events = @[event];
        }

        // Create pattern and play
        CHHapticPattern *pattern =
            [[CHHapticPattern alloc] initWithEvents:events
                                         parameters:@[]
                                              error:&error];

        if (error) {
            NSLog(@"[AudioServices] Failed to create haptic pattern: %@", error);
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
            return;
        }

        id<CHHapticPatternPlayer> player = [self.hapticEngine createPlayerWithPattern:pattern error:&error];
        if (error) {
            NSLog(@"[AudioServices] Failed to create haptic player: %@", error);
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
            return;
        }

        [player startAtTime:CHHapticTimeImmediate error:&error];
        if (error) {
            NSLog(@"[AudioServices] Failed to play haptic: %@", error);
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
        } else {
            NSLog(@"[AudioServices] Haptic played successfully");
        }
    } else {
        // Fallback for older iOS versions
        NSLog(@"[AudioServices] Core Haptics not available, falling back to vibration");
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
    }
}

@end
