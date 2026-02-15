/**
 * useFeedback — Combined Haptic + Audio Feedback Hook
 *
 * Provides accessible feedback combining:
 * - Haptic feedback (5 intensity levels: off, veryLight, light, normal, strong)
 * - Audio feedback (system sounds, respects silent mode)
 *
 * Audio volume is tied to system volume with optional +20% boost.
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import {
  Platform,
  NativeModules,
} from 'react-native';
import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';
import { ServiceContainer } from '@/services/container';

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

// Haptic intensity levels
export type HapticIntensity = 'off' | 'veryLight' | 'light' | 'normal' | 'strong';

// Feedback types
export type FeedbackType =
  | 'tap'           // Button tap, selection
  | 'success'       // Action completed successfully
  | 'warning'       // Attention needed
  | 'error'         // Action failed
  | 'navigation';   // Screen transition

// Feedback settings (persisted in user profile)
export interface FeedbackSettings {
  hapticIntensity: HapticIntensity;
  audioFeedbackEnabled: boolean;
  audioFeedbackBoost: boolean; // +20% volume boost
}

// Default settings
export const DEFAULT_FEEDBACK_SETTINGS: FeedbackSettings = {
  hapticIntensity: 'normal',
  audioFeedbackEnabled: true,
  audioFeedbackBoost: false,
};

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
 * Hook providing combined haptic + audio feedback
 */
export function useFeedback() {
  const [settings, setSettings] = useState<FeedbackSettings>(DEFAULT_FEEDBACK_SETTINGS);
  const [isSilentMode, setIsSilentMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from database
  useEffect(() => {
    async function loadSettings() {
      try {
        if (!ServiceContainer.isInitialized) {
          setIsLoading(false);
          return;
        }

        const profile = await ServiceContainer.database.getUserProfile();
        if (profile) {
          setSettings({
            hapticIntensity: (profile.hapticIntensity as HapticIntensity) ?? DEFAULT_FEEDBACK_SETTINGS.hapticIntensity,
            audioFeedbackEnabled: profile.audioFeedbackEnabled ?? DEFAULT_FEEDBACK_SETTINGS.audioFeedbackEnabled,
            audioFeedbackBoost: profile.audioFeedbackBoost ?? DEFAULT_FEEDBACK_SETTINGS.audioFeedbackBoost,
          });
        }
      } catch (error) {
        console.error('[useFeedback] Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadSettings();
  }, []);

  // Check for silent mode (iOS only - Android handles this automatically)
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    // iOS doesn't have a direct API for silent mode detection
    // System sounds will automatically be silent when ringer switch is off
    // So we don't need to track this - iOS handles it
    setIsSilentMode(false);
  }, []);

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

  // Update haptic intensity setting
  const updateHapticIntensity = useCallback(
    async (intensity: HapticIntensity) => {
      setSettings(prev => ({ ...prev, hapticIntensity: intensity }));

      try {
        if (!ServiceContainer.isInitialized) return;

        const profile = await ServiceContainer.database.getUserProfile();
        if (profile) {
          await ServiceContainer.database.saveUserProfile({
            ...profile,
            hapticIntensity: intensity,
          });
        }
      } catch (error) {
        console.error('[useFeedback] Failed to save haptic intensity:', error);
      }
    },
    [],
  );

  // Update audio feedback enabled setting
  const updateAudioFeedbackEnabled = useCallback(
    async (enabled: boolean) => {
      setSettings(prev => ({ ...prev, audioFeedbackEnabled: enabled }));

      try {
        if (!ServiceContainer.isInitialized) return;

        const profile = await ServiceContainer.database.getUserProfile();
        if (profile) {
          await ServiceContainer.database.saveUserProfile({
            ...profile,
            audioFeedbackEnabled: enabled,
          });
        }
      } catch (error) {
        console.error('[useFeedback] Failed to save audio feedback enabled:', error);
      }
    },
    [],
  );

  // Update audio feedback boost setting
  const updateAudioFeedbackBoost = useCallback(
    async (boost: boolean) => {
      setSettings(prev => ({ ...prev, audioFeedbackBoost: boost }));

      try {
        if (!ServiceContainer.isInitialized) return;

        const profile = await ServiceContainer.database.getUserProfile();
        if (profile) {
          await ServiceContainer.database.saveUserProfile({
            ...profile,
            audioFeedbackBoost: boost,
          });
        }
      } catch (error) {
        console.error('[useFeedback] Failed to save audio feedback boost:', error);
      }
    },
    [],
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
