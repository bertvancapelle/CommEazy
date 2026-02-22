/**
 * CallSoundService — Manages call sounds and vibrations
 *
 * Handles:
 * - Incoming call ringtone (multiple options, configurable)
 * - Outgoing call dial tone (tuut... tuut... pattern)
 * - Vibration for incoming/outgoing calls (uses hapticIntensity setting)
 *
 * Uses system sounds for cross-platform compatibility (iOS/Android).
 * All settings are configurable via user profile.
 *
 * @see src/models/schema.ts v12 for call sound settings
 * @see src/services/interfaces.ts for UserProfile types
 */

import { Platform, NativeModules } from 'react-native';
import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';
import type { HapticIntensity } from '@/hooks/useFeedback';

// Native AudioServices module (from iOS native code)
const { AudioServices } = NativeModules;

// Debug: Check if AudioServices is available
console.log('[CallSoundService] AudioServices module available:', !!AudioServices);
if (AudioServices) {
  console.log('[CallSoundService] AudioServices methods:', Object.keys(AudioServices));
}

// ============================================================
// Types
// ============================================================

/**
 * Available ringtone options
 * These map to system sound IDs on iOS/Android
 */
export type RingtoneSound = 'default' | 'classic' | 'gentle' | 'urgent';

/**
 * Call sound settings from user profile
 */
export interface CallSoundSettings {
  ringtoneEnabled: boolean;
  ringtoneSound: RingtoneSound;
  dialToneEnabled: boolean;
  incomingCallVibration: boolean;
  outgoingCallVibration: boolean;
  hapticIntensity: HapticIntensity;
}

/**
 * Default call sound settings
 */
export const DEFAULT_CALL_SOUND_SETTINGS: CallSoundSettings = {
  ringtoneEnabled: true,
  ringtoneSound: 'default',
  dialToneEnabled: true,
  incomingCallVibration: true,
  outgoingCallVibration: false,
  hapticIntensity: 'normal',
};

// ============================================================
// iOS System Sound IDs for ringtones
// Reference: https://iphonedev.wiki/index.php/AudioServices
// These are AUDIBLE system sounds, not silent alerts
// ============================================================

const IOS_RINGTONE_SOUNDS: Record<RingtoneSound, number> = {
  default: 1007,  // SMS Received (tri-tone) - VERY recognizable
  classic: 1005,  // Voicemail - classic sound
  gentle: 1003,   // Mail Received - softer
  urgent: 1020,   // Anticipate - alert sound
};

// Dial tone sound ID - phone line ringing simulation
const IOS_DIAL_TONE = 1109; // Tink - short clear tone for dial pattern

// ============================================================
// CallSoundService Class
// ============================================================

class CallSoundService {
  private ringtoneInterval: ReturnType<typeof setInterval> | null = null;
  private dialToneInterval: ReturnType<typeof setInterval> | null = null;
  private vibrationInterval: ReturnType<typeof setInterval> | null = null;
  private settings: CallSoundSettings = DEFAULT_CALL_SOUND_SETTINGS;

  /**
   * Update settings from user profile
   */
  updateSettings(settings: Partial<CallSoundSettings>): void {
    this.settings = { ...this.settings, ...settings };
    console.debug('[CallSoundService] Settings updated:', this.settings);
  }

  /**
   * Get current settings
   */
  getSettings(): CallSoundSettings {
    return { ...this.settings };
  }

  // ============================================================
  // Incoming Call (Receiver Side)
  // ============================================================

  /**
   * Start playing ringtone for incoming call
   * Plays the selected ringtone sound in a loop until stopped
   */
  startRingtone(): void {
    if (!this.settings.ringtoneEnabled) {
      console.debug('[CallSoundService] Ringtone disabled, skipping');
      return;
    }

    // Stop any existing ringtone
    this.stopRingtone();

    console.debug('[CallSoundService] Starting ringtone:', this.settings.ringtoneSound);

    // Play ringtone immediately
    this.playRingtoneSound();

    // Loop ringtone every 2 seconds
    this.ringtoneInterval = setInterval(() => {
      this.playRingtoneSound();
    }, 2000);

    // Start vibration pattern if enabled
    if (this.settings.incomingCallVibration) {
      this.startIncomingVibration();
    }
  }

  /**
   * Stop playing ringtone
   */
  stopRingtone(): void {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
    this.stopVibration();
    console.debug('[CallSoundService] Ringtone stopped');
  }

  /**
   * Play the selected ringtone sound once
   * Uses boosted alert sound for better audibility
   */
  private playRingtoneSound(): void {
    const soundId = IOS_RINGTONE_SOUNDS[this.settings.ringtoneSound] || IOS_RINGTONE_SOUNDS.default;
    console.debug('[CallSoundService] Playing ringtone sound ID:', soundId);

    if (Platform.OS === 'ios') {
      if (!AudioServices) {
        console.error('[CallSoundService] AudioServices native module NOT available!');
        return;
      }

      // Use boosted alert for ringtones (louder, with vibration)
      console.log('[CallSoundService] Calling AudioServices.playBoostedAlertSound with ID:', soundId);
      try {
        AudioServices.playBoostedAlertSound(soundId);
        console.log('[CallSoundService] playBoostedAlertSound called successfully');
      } catch (error) {
        console.error('[CallSoundService] Error calling playBoostedAlertSound:', error);
      }
    } else {
      // Android: Use system ringtone
      AudioServices?.playAlertSound(0);
    }
  }

  // ============================================================
  // Outgoing Call (Caller Side)
  // ============================================================

  /**
   * Start playing dial tone for outgoing call
   * Plays "tuut... tuut..." pattern when waiting for answer
   */
  startDialTone(): void {
    if (!this.settings.dialToneEnabled) {
      console.debug('[CallSoundService] Dial tone disabled, skipping');
      return;
    }

    // Stop any existing dial tone
    this.stopDialTone();

    console.debug('[CallSoundService] Starting dial tone');

    // Play dial tone immediately
    this.playDialToneSound();

    // Loop dial tone every 3 seconds (realistic phone ringing pattern)
    this.dialToneInterval = setInterval(() => {
      this.playDialToneSound();
    }, 3000);

    // Start vibration if enabled for outgoing calls
    if (this.settings.outgoingCallVibration) {
      this.startOutgoingVibration();
    }
  }

  /**
   * Stop playing dial tone
   */
  stopDialTone(): void {
    if (this.dialToneInterval) {
      clearInterval(this.dialToneInterval);
      this.dialToneInterval = null;
    }
    this.stopVibration();
    console.debug('[CallSoundService] Dial tone stopped');
  }

  /**
   * Play dial tone sound once ("tuut... tuut..." pattern)
   */
  private playDialToneSound(): void {
    if (Platform.OS === 'ios') {
      // Play two short beeps with a gap to simulate "tuut... tuut..."
      AudioServices?.playSystemSound(IOS_DIAL_TONE);

      // Second beep after 500ms
      setTimeout(() => {
        AudioServices?.playSystemSound(IOS_DIAL_TONE);
      }, 500);
    } else {
      // Android: Use system dial tone
      AudioServices?.playAlertSound(0);
      setTimeout(() => {
        AudioServices?.playAlertSound(0);
      }, 500);
    }
  }

  // ============================================================
  // Vibration Patterns
  // ============================================================

  /**
   * Start vibration pattern for incoming call
   * Uses hapticIntensity setting for vibration strength
   */
  private startIncomingVibration(): void {
    this.stopVibration();

    // Vibrate immediately
    this.triggerVibration();

    // Loop vibration every 1.5 seconds
    this.vibrationInterval = setInterval(() => {
      this.triggerVibration();
    }, 1500);
  }

  /**
   * Start vibration pattern for outgoing call (subtle feedback)
   */
  private startOutgoingVibration(): void {
    this.stopVibration();

    // Vibrate once when dial tone plays (every 3 seconds)
    this.vibrationInterval = setInterval(() => {
      this.triggerVibration();
    }, 3000);
  }

  /**
   * Stop all vibration
   */
  private stopVibration(): void {
    if (this.vibrationInterval) {
      clearInterval(this.vibrationInterval);
      this.vibrationInterval = null;
    }
  }

  /**
   * Trigger a single vibration based on hapticIntensity setting
   */
  private triggerVibration(): void {
    const intensity = this.settings.hapticIntensity;

    if (intensity === 'off') {
      return;
    }

    // Map intensity to haptic feedback type
    let hapticType: HapticFeedbackTypes;
    switch (intensity) {
      case 'veryLight':
        hapticType = HapticFeedbackTypes.impactLight;
        break;
      case 'light':
        hapticType = HapticFeedbackTypes.impactMedium;
        break;
      case 'normal':
        hapticType = HapticFeedbackTypes.impactHeavy;
        break;
      case 'strong':
        hapticType = HapticFeedbackTypes.notificationWarning;
        break;
      default:
        hapticType = HapticFeedbackTypes.impactMedium;
    }

    try {
      ReactNativeHapticFeedback.trigger(hapticType, {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });

      // For stronger effect on iOS, also use native haptics
      if (Platform.OS === 'ios' && AudioServices?.playHapticWithIntensity) {
        const intensityLevel =
          intensity === 'veryLight' ? 1 :
          intensity === 'light' ? 2 :
          intensity === 'normal' ? 3 : 4;
        AudioServices.playHapticWithIntensity(intensityLevel);
      }
    } catch {
      // Vibration failed silently
    }
  }

  // ============================================================
  // Call State Event Handlers
  // ============================================================

  /**
   * Called when an incoming call starts ringing
   */
  onIncomingCallRinging(): void {
    console.info('[CallSoundService] Incoming call ringing');
    this.startRingtone();
  }

  /**
   * Called when an incoming call is answered or declined
   */
  onIncomingCallEnded(): void {
    console.info('[CallSoundService] Incoming call ended');
    this.stopRingtone();
  }

  /**
   * Called when an outgoing call starts (waiting for answer)
   */
  onOutgoingCallRinging(): void {
    console.info('[CallSoundService] Outgoing call ringing');
    this.startDialTone();
  }

  /**
   * Called when an outgoing call is answered or ends
   */
  onOutgoingCallEnded(): void {
    console.info('[CallSoundService] Outgoing call ended');
    this.stopDialTone();
  }

  /**
   * Stop all sounds (cleanup)
   */
  stopAll(): void {
    this.stopRingtone();
    this.stopDialTone();
  }
}

// Singleton instance
export const callSoundService = new CallSoundService();
