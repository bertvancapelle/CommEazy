/**
 * FeedbackContext — Shared Haptic + Audio Feedback State
 *
 * Provides a single source of truth for feedback settings across all components.
 * Solves the problem where each useFeedback() instance had its own isolated
 * local state, causing settings changes (e.g. toggling haptic off) to not
 * propagate to other screens until app restart.
 *
 * VERPLICHT: All modules (existing and new) MUST use this context for feedback.
 * Direct usage of useFeedback() is still the consumer API, but it now reads
 * from this shared context instead of maintaining its own local state.
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { createContext, useContext, useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import { ServiceContainer } from '@/services/container';

// Haptic intensity levels
export type HapticIntensity = 'off' | 'veryLight' | 'light' | 'normal' | 'strong';

// Feedback settings (persisted in user profile)
export interface FeedbackSettings {
  hapticIntensity: HapticIntensity;
  audioFeedbackEnabled: boolean;
  audioFeedbackBoost: boolean;
}

// Default settings
// NOTE: audioFeedbackEnabled defaults to FALSE (off by default)
// Haptic defaults to 'normal' (on by default)
export const DEFAULT_FEEDBACK_SETTINGS: FeedbackSettings = {
  hapticIntensity: 'normal',
  audioFeedbackEnabled: false,
  audioFeedbackBoost: false,
};

export interface FeedbackContextValue {
  settings: FeedbackSettings;
  isLoading: boolean;
  updateHapticIntensity: (intensity: HapticIntensity) => Promise<void>;
  updateAudioFeedbackEnabled: (enabled: boolean) => Promise<void>;
  updateAudioFeedbackBoost: (boost: boolean) => Promise<void>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

/**
 * FeedbackProvider — Wraps the app to provide shared feedback settings.
 * Must be placed inside ServiceProvider (needs ServiceContainer).
 */
export function FeedbackProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<FeedbackSettings>(DEFAULT_FEEDBACK_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from database on mount
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
        console.error('[FeedbackContext] Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadSettings();
  }, []);

  const updateHapticIntensity = useCallback(async (intensity: HapticIntensity) => {
    // Update shared state immediately (all consumers re-render)
    setSettings(prev => ({ ...prev, hapticIntensity: intensity }));

    // Persist to database
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
      console.error('[FeedbackContext] Failed to save haptic intensity:', error);
    }
  }, []);

  const updateAudioFeedbackEnabled = useCallback(async (enabled: boolean) => {
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
      console.error('[FeedbackContext] Failed to save audio feedback enabled:', error);
    }
  }, []);

  const updateAudioFeedbackBoost = useCallback(async (boost: boolean) => {
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
      console.error('[FeedbackContext] Failed to save audio feedback boost:', error);
    }
  }, []);

  return (
    <FeedbackContext.Provider
      value={{
        settings,
        isLoading,
        updateHapticIntensity,
        updateAudioFeedbackEnabled,
        updateAudioFeedbackBoost,
      }}
    >
      {children}
    </FeedbackContext.Provider>
  );
}

/**
 * Hook to access feedback context. Throws if used outside FeedbackProvider.
 */
export function useFeedbackContext(): FeedbackContextValue {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedbackContext must be used within a FeedbackProvider');
  }
  return context;
}

/**
 * Safe hook that returns null if used outside FeedbackProvider.
 * Use this in components that may render before the provider is mounted.
 */
export function useFeedbackContextSafe(): FeedbackContextValue | null {
  return useContext(FeedbackContext);
}
