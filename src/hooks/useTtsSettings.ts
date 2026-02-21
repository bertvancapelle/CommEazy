/**
 * useTtsSettings — Hook for TTS speech rate settings
 *
 * Provides:
 * - Speech rate setting (70%, 80%, 90%, 100%, 110%)
 * - Persisted to AsyncStorage
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = 'tts_settings';

// Available speech rate options (as percentage of normal speed)
// Values are actual multipliers (0.7 = 70%, 1.0 = 100%)
export const TTS_SPEED_OPTIONS = [
  { value: 0.7, label: '70%' },
  { value: 0.8, label: '80%' },
  { value: 0.9, label: '90%' },
  { value: 1.0, label: '100%' },
  { value: 1.1, label: '110%' },
] as const;

export type TtsSpeechRate = 0.7 | 0.8 | 0.9 | 1.0 | 1.1;

const DEFAULT_SPEECH_RATE: TtsSpeechRate = 1.0;

// ============================================================
// Types
// ============================================================

interface TtsSettings {
  speechRate: TtsSpeechRate;
}

interface UseTtsSettingsReturn {
  /** Current speech rate (0.7 - 1.1) */
  speechRate: TtsSpeechRate;
  /** Update speech rate */
  updateSpeechRate: (rate: TtsSpeechRate) => Promise<void>;
  /** Whether settings are loaded */
  isLoaded: boolean;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useTtsSettings(): UseTtsSettingsReturn {
  const [speechRate, setSpeechRate] = useState<TtsSpeechRate>(DEFAULT_SPEECH_RATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const settings: TtsSettings = JSON.parse(stored);
          // Validate the stored value is a valid option
          const isValidRate = TTS_SPEED_OPTIONS.some(opt => opt.value === settings.speechRate);
          if (isValidRate) {
            setSpeechRate(settings.speechRate);
          }
        }
      } catch (error) {
        console.warn('[useTtsSettings] Failed to load settings:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    void loadSettings();
  }, []);

  // Update speech rate and persist
  const updateSpeechRate = useCallback(async (rate: TtsSpeechRate) => {
    setSpeechRate(rate);
    try {
      const settings: TtsSettings = { speechRate: rate };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      console.debug('[useTtsSettings] Speech rate updated to:', rate);
    } catch (error) {
      console.error('[useTtsSettings] Failed to save settings:', error);
    }
  }, []);

  return {
    speechRate,
    updateSpeechRate,
    isLoaded,
  };
}

export default useTtsSettings;
