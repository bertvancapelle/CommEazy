/**
 * useFeedback — Combined Haptic + Audio Feedback Hook
 *
 * Provides accessible feedback combining:
 * - Haptic feedback (5 intensity levels: off, veryLight, light, normal, strong)
 * - Audio feedback (system sounds, respects silent mode)
 *
 * Audio volume is tied to system volume with optional +20% boost.
 *
 * IMPORTANT: Settings are shared via FeedbackContext. All useFeedback() instances
 * across the entire app share the same settings state. When a setting is changed
 * in one place (e.g. AccessibilitySettings), ALL components immediately reflect
 * the change. This is a REQUIREMENT for all modules (existing and new).
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import { useCallback } from 'react';
import {
  Platform,
  NativeModules,
} from 'react-native';
import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';
import {
  useFeedbackContextSafe,
  DEFAULT_FEEDBACK_SETTINGS,
  type HapticIntensity,
  type FeedbackSettings,
} from '@/contexts/FeedbackContext';

// Re-export types from context so consumers don't need to change imports
export type { HapticIntensity, FeedbackSettings } from '@/contexts/FeedbackContext';
export { DEFAULT_FEEDBACK_SETTINGS } from '@/contexts/FeedbackContext';

// System Sound IDs for iOS (AudioServicesPlaySystemSound)
// Reference: https://iphonedev.wiki/index.php/AudioServices
//
// Most reliable and audible sounds:
// - 1007 = SMS Received (classic tri-tone) - default for normal mode
// - 1005 = New Voicemail - very loud and distinctive (used for boosted)
// - 1057 = Mail Sent whoosh
// - 1304 = Photo shutter
//
// Note: These are passed to the native module, which may override with defaults
const IOS_SYSTEM_SOUND_IDS = {
  tap: 1007,       // SMS Received tri-tone
  success: 1007,   // SMS Received tri-tone
  warning: 1005,   // New Voicemail (loud)
  error: 1005,     // New Voicemail (loud)
  navigation: 1007, // SMS Received tri-tone
};

// Boosted sound - native module handles the sequence
const IOS_BOOSTED_SOUND_ID = 1005; // New Voicemail (loud)

// Feedback types
export type FeedbackType =
  | 'tap'           // Button tap, selection
  | 'success'       // Action completed successfully
  | 'warning'       // Attention needed
  | 'error'         // Action failed
  | 'navigation';   // Screen transition

// Haptic intensity level mapping for Core Haptics native module
// Maps our intensity names to numeric levels (1-4)
const HAPTIC_INTENSITY_LEVEL: Record<HapticIntensity, number> = {
  off: 0,
  veryLight: 1,
  light: 2,
  normal: 3,
  strong: 4,
};

// Fallback haptic type mapping for react-native-haptic-feedback
// Used when native Core Haptics is not available
const HAPTIC_TYPE_MAP: Record<HapticIntensity, HapticFeedbackTypes | null> = {
  off: null,
  veryLight: HapticFeedbackTypes.impactLight,
  light: HapticFeedbackTypes.impactMedium,
  normal: HapticFeedbackTypes.impactHeavy,
  strong: HapticFeedbackTypes.notificationError,
};

// Haptic options for react-native-haptic-feedback
const HAPTIC_OPTIONS = {
  enableVibrateFallback: true,  // Use vibration on devices without haptic engine
  ignoreAndroidSystemSettings: false, // Respect system haptic settings
};

/**
 * Hook providing combined haptic + audio feedback.
 *
 * Settings are read from FeedbackContext (shared across all components).
 * Falls back to DEFAULT_FEEDBACK_SETTINGS if used outside FeedbackProvider
 * (e.g. during app startup before provider is mounted).
 */
export function useFeedback() {
  // Read from shared context — all instances share the same state
  const context = useFeedbackContextSafe();

  // Fallback for usage outside FeedbackProvider (startup, tests)
  const settings = context?.settings ?? DEFAULT_FEEDBACK_SETTINGS;
  const isLoading = context?.isLoading ?? false;

  // Trigger haptic feedback using Core Haptics native module (iOS) or fallback
  const triggerHaptic = useCallback(
    (type: FeedbackType, intensity?: HapticIntensity) => {
      const effectiveIntensity = intensity ?? settings.hapticIntensity;
      const intensityLevel = HAPTIC_INTENSITY_LEVEL[effectiveIntensity];

      if (intensityLevel === 0) {
        return;
      }

      // Use DIFFERENT haptic types based on intensity for more noticeable difference
      // This uses react-native-haptic-feedback with intensity-specific types
      let hapticType: HapticFeedbackTypes;
      switch (effectiveIntensity) {
        case 'veryLight':
          hapticType = HapticFeedbackTypes.selection; // Very subtle
          break;
        case 'light':
          hapticType = HapticFeedbackTypes.impactLight;
          break;
        case 'normal':
          hapticType = HapticFeedbackTypes.impactMedium;
          break;
        case 'strong':
          hapticType = HapticFeedbackTypes.notificationWarning; // Strong notification
          break;
        default:
          hapticType = HapticFeedbackTypes.impactMedium;
      }

      try {
        ReactNativeHapticFeedback.trigger(hapticType, HAPTIC_OPTIONS);
      } catch {
        // Fallback already handled by library
      }

      // Also use native Core Haptics for better intensity control on iOS
      if (Platform.OS === 'ios') {
        try {
          const { AudioServices } = NativeModules;
          if (AudioServices?.playHapticWithIntensity) {
            AudioServices.playHapticWithIntensity(intensityLevel);
          }
        } catch {
          // Native haptic failed, fallback already triggered above
        }
      }
    },
    [settings.hapticIntensity],
  );

  // Trigger audio feedback using native system sounds
  const triggerAudio = useCallback(
    async (type: FeedbackType, overrideBoost?: boolean) => {
      if (!settings.audioFeedbackEnabled) {
        return;
      }

      const useBoost = overrideBoost ?? settings.audioFeedbackBoost;

      try {
        if (Platform.OS === 'ios') {
          const { AudioServices } = NativeModules;

          if (!AudioServices) {
            // Use haptic fallback if native module not available
            ReactNativeHapticFeedback.trigger(
              HapticFeedbackTypes.notificationSuccess,
              { ...HAPTIC_OPTIONS, enableVibrateFallback: true }
            );
            return;
          }

          const soundId = IOS_SYSTEM_SOUND_IDS[type];

          if (useBoost) {
            AudioServices.playBoostedAlertSound(soundId);
          } else {
            AudioServices.playAlertSound(soundId);
          }
        } else {
          // Android
          const { AudioServices } = NativeModules;

          if (useBoost && AudioServices?.playBoostedAlertSound) {
            AudioServices.playBoostedAlertSound(0);
          } else if (AudioServices?.playAlertSound) {
            AudioServices.playAlertSound(0);
          } else {
            // Fallback: Use haptic feedback
            ReactNativeHapticFeedback.trigger(
              HapticFeedbackTypes.effectClick,
              HAPTIC_OPTIONS
            );
          }
        }
      } catch {
        // Audio feedback failed silently
      }
    },
    [settings.audioFeedbackEnabled, settings.audioFeedbackBoost],
  );

  // Combined feedback function (haptic + audio together)
  // Optional parameters allow testing with specific settings
  const triggerFeedback = useCallback(
    async (type: FeedbackType, hapticIntensity?: HapticIntensity, audioBoost?: boolean) => {
      // Trigger haptic immediately (synchronous)
      triggerHaptic(type, hapticIntensity);

      // Trigger audio (may be async) - pass through boost override if specified
      await triggerAudio(type, audioBoost);
    },
    [triggerHaptic, triggerAudio],
  );

  // Update functions — delegate to context (or no-op if outside provider)
  const updateHapticIntensity = useCallback(
    async (intensity: HapticIntensity) => {
      if (context) {
        await context.updateHapticIntensity(intensity);
      }
    },
    [context],
  );

  const updateAudioFeedbackEnabled = useCallback(
    async (enabled: boolean) => {
      if (context) {
        await context.updateAudioFeedbackEnabled(enabled);
      }
    },
    [context],
  );

  const updateAudioFeedbackBoost = useCallback(
    async (boost: boolean) => {
      if (context) {
        await context.updateAudioFeedbackBoost(boost);
      }
    },
    [context],
  );

  return {
    settings,
    isLoading,
    triggerFeedback,
    triggerHaptic,
    triggerAudio,
    updateHapticIntensity,
    updateAudioFeedbackEnabled,
    updateAudioFeedbackBoost,
  };
}

// Export constants for settings UI
export const FEEDBACK_CONSTANTS = {
  HAPTIC_INTENSITIES: ['off', 'veryLight', 'light', 'normal', 'strong'] as const,
};
