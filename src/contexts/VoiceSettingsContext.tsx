/**
 * VoiceSettingsContext — Centralized voice command settings management
 *
 * Manages voice command settings including:
 * - Enabling/disabling voice control globally
 * - Command customizations (add synonyms, disable patterns)
 * - Session timeout configuration
 * - Confidence thresholds
 *
 * Settings are persisted to AsyncStorage and loaded on app start.
 *
 * @see .claude/CLAUDE.md § 11. Voice Interaction Architecture
 * @see src/types/voiceCommands.ts
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

import {
  type Language,
  type VoiceSettings,
  type VoiceCommand,
  type VoiceCommandCategory,
  type VoiceCommandCustomization,
  DEFAULT_VOICE_SETTINGS,
  DEFAULT_VOICE_COMMANDS,
  getCommandPatterns,
  isCommandEnabled,
  getCommandsByCategory,
} from '@/types/voiceCommands';

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = '@commeazy/voice_settings';

// ============================================================
// Context Types
// ============================================================

export interface VoiceSettingsContextValue {
  // Settings state
  settings: VoiceSettings;
  isLoading: boolean;

  // Global toggle
  setEnabled: (enabled: boolean) => Promise<void>;

  // Language
  setLanguage: (language: Language) => Promise<void>;

  // Command management
  getCommand: (commandId: string) => VoiceCommand | undefined;
  getCommandsForCategory: (category: VoiceCommandCategory) => VoiceCommand[];
  getPatternsForCommand: (commandId: string) => string[];
  isCommandEnabled: (commandId: string) => boolean;

  // Customization
  enableCommand: (commandId: string) => Promise<void>;
  disableCommand: (commandId: string) => Promise<void>;
  addCustomPattern: (commandId: string, pattern: string) => Promise<void>;
  removeCustomPattern: (commandId: string, pattern: string) => Promise<void>;
  disableDefaultPattern: (commandId: string, pattern: string) => Promise<void>;
  enableDefaultPattern: (commandId: string, pattern: string) => Promise<void>;

  // Session settings
  setSessionTimeout: (timeoutMs: number) => Promise<void>;
  setConfidenceThreshold: (threshold: number) => Promise<void>;
  setFuzzyMatchingEnabled: (enabled: boolean) => Promise<void>;
  setFuzzyMatchingThreshold: (threshold: number) => Promise<void>;

  // Reset
  resetToDefaults: () => Promise<void>;
  resetCommandToDefault: (commandId: string) => Promise<void>;
}

// ============================================================
// Context
// ============================================================

const VoiceSettingsContext = createContext<VoiceSettingsContextValue | null>(null);

interface VoiceSettingsProviderProps {
  children: ReactNode;
}

/**
 * Provider component for voice settings context
 */
export function VoiceSettingsProvider({ children }: VoiceSettingsProviderProps) {
  const { i18n } = useTranslation();
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // Persistence
  // ============================================================

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<VoiceSettings>;
          // Merge with defaults to handle new settings added in updates
          setSettings({
            ...DEFAULT_VOICE_SETTINGS,
            ...parsed,
          });
        } else {
          // Set language from i18n if no settings stored
          setSettings({
            ...DEFAULT_VOICE_SETTINGS,
            language: (i18n.language.substring(0, 2) as Language) || 'nl',
          });
        }
      } catch (error) {
        console.error('[VoiceSettingsContext] Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettings();
  }, [i18n.language]);

  // Save settings to AsyncStorage
  const saveSettings = useCallback(async (newSettings: VoiceSettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('[VoiceSettingsContext] Failed to save settings:', error);
      throw error;
    }
  }, []);

  // ============================================================
  // Global Toggle
  // ============================================================

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      await saveSettings({ ...settings, isEnabled: enabled });
    },
    [settings, saveSettings]
  );

  // ============================================================
  // Language
  // ============================================================

  const setLanguage = useCallback(
    async (language: Language) => {
      await saveSettings({ ...settings, language });
    },
    [settings, saveSettings]
  );

  // ============================================================
  // Command Queries
  // ============================================================

  const getCommand = useCallback((commandId: string): VoiceCommand | undefined => {
    return DEFAULT_VOICE_COMMANDS.find((cmd) => cmd.id === commandId);
  }, []);

  const getCommandsForCategory = useCallback(
    (category: VoiceCommandCategory): VoiceCommand[] => {
      return getCommandsByCategory(category);
    },
    []
  );

  const getPatternsForCommand = useCallback(
    (commandId: string): string[] => {
      const command = getCommand(commandId);
      if (!command) return [];

      return getCommandPatterns(
        command,
        settings.language,
        settings.customizations[commandId]
      );
    },
    [getCommand, settings.language, settings.customizations]
  );

  const checkCommandEnabled = useCallback(
    (commandId: string): boolean => {
      const command = getCommand(commandId);
      if (!command) return false;

      return isCommandEnabled(command, settings.customizations[commandId]);
    },
    [getCommand, settings.customizations]
  );

  // ============================================================
  // Command Customization
  // ============================================================

  const getOrCreateCustomization = useCallback(
    (commandId: string): VoiceCommandCustomization => {
      return (
        settings.customizations[commandId] || {
          commandId,
          customPatterns: [],
          disabledPatterns: [],
          isEnabled: true,
        }
      );
    },
    [settings.customizations]
  );

  const enableCommand = useCallback(
    async (commandId: string) => {
      const customization = getOrCreateCustomization(commandId);
      const newCustomizations = {
        ...settings.customizations,
        [commandId]: { ...customization, isEnabled: true },
      };
      await saveSettings({ ...settings, customizations: newCustomizations });
    },
    [settings, saveSettings, getOrCreateCustomization]
  );

  const disableCommand = useCallback(
    async (commandId: string) => {
      const command = getCommand(commandId);
      if (command && !command.canDisable) {
        console.warn(`[VoiceSettingsContext] Command ${commandId} cannot be disabled`);
        return;
      }

      const customization = getOrCreateCustomization(commandId);
      const newCustomizations = {
        ...settings.customizations,
        [commandId]: { ...customization, isEnabled: false },
      };
      await saveSettings({ ...settings, customizations: newCustomizations });
    },
    [settings, saveSettings, getCommand, getOrCreateCustomization]
  );

  const addCustomPattern = useCallback(
    async (commandId: string, pattern: string) => {
      const normalizedPattern = pattern.toLowerCase().trim();
      if (!normalizedPattern) return;

      const customization = getOrCreateCustomization(commandId);

      // Don't add duplicates
      if (customization.customPatterns.includes(normalizedPattern)) return;

      const newCustomizations = {
        ...settings.customizations,
        [commandId]: {
          ...customization,
          customPatterns: [...customization.customPatterns, normalizedPattern],
        },
      };
      await saveSettings({ ...settings, customizations: newCustomizations });
    },
    [settings, saveSettings, getOrCreateCustomization]
  );

  const removeCustomPattern = useCallback(
    async (commandId: string, pattern: string) => {
      const normalizedPattern = pattern.toLowerCase().trim();
      const customization = getOrCreateCustomization(commandId);

      const newCustomizations = {
        ...settings.customizations,
        [commandId]: {
          ...customization,
          customPatterns: customization.customPatterns.filter(
            (p) => p !== normalizedPattern
          ),
        },
      };
      await saveSettings({ ...settings, customizations: newCustomizations });
    },
    [settings, saveSettings, getOrCreateCustomization]
  );

  const disableDefaultPattern = useCallback(
    async (commandId: string, pattern: string) => {
      const normalizedPattern = pattern.toLowerCase().trim();
      const customization = getOrCreateCustomization(commandId);

      // Don't add duplicates
      if (customization.disabledPatterns.includes(normalizedPattern)) return;

      const newCustomizations = {
        ...settings.customizations,
        [commandId]: {
          ...customization,
          disabledPatterns: [...customization.disabledPatterns, normalizedPattern],
        },
      };
      await saveSettings({ ...settings, customizations: newCustomizations });
    },
    [settings, saveSettings, getOrCreateCustomization]
  );

  const enableDefaultPattern = useCallback(
    async (commandId: string, pattern: string) => {
      const normalizedPattern = pattern.toLowerCase().trim();
      const customization = getOrCreateCustomization(commandId);

      const newCustomizations = {
        ...settings.customizations,
        [commandId]: {
          ...customization,
          disabledPatterns: customization.disabledPatterns.filter(
            (p) => p !== normalizedPattern
          ),
        },
      };
      await saveSettings({ ...settings, customizations: newCustomizations });
    },
    [settings, saveSettings, getOrCreateCustomization]
  );

  // ============================================================
  // Session Settings
  // ============================================================

  const setSessionTimeout = useCallback(
    async (timeoutMs: number) => {
      await saveSettings({ ...settings, sessionTimeoutMs: timeoutMs });
    },
    [settings, saveSettings]
  );

  const setConfidenceThreshold = useCallback(
    async (threshold: number) => {
      const clamped = Math.max(0, Math.min(1, threshold));
      await saveSettings({ ...settings, confidenceThreshold: clamped });
    },
    [settings, saveSettings]
  );

  const setFuzzyMatchingEnabled = useCallback(
    async (enabled: boolean) => {
      await saveSettings({ ...settings, fuzzyMatchingEnabled: enabled });
    },
    [settings, saveSettings]
  );

  const setFuzzyMatchingThreshold = useCallback(
    async (threshold: number) => {
      const clamped = Math.max(0, Math.min(1, threshold));
      await saveSettings({ ...settings, fuzzyMatchingThreshold: clamped });
    },
    [settings, saveSettings]
  );

  // ============================================================
  // Reset
  // ============================================================

  const resetToDefaults = useCallback(async () => {
    await saveSettings({
      ...DEFAULT_VOICE_SETTINGS,
      language: settings.language, // Keep current language
    });
  }, [settings.language, saveSettings]);

  const resetCommandToDefault = useCallback(
    async (commandId: string) => {
      const newCustomizations = { ...settings.customizations };
      delete newCustomizations[commandId];
      await saveSettings({ ...settings, customizations: newCustomizations });
    },
    [settings, saveSettings]
  );

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo(
    (): VoiceSettingsContextValue => ({
      settings,
      isLoading,

      setEnabled,
      setLanguage,

      getCommand,
      getCommandsForCategory,
      getPatternsForCommand,
      isCommandEnabled: checkCommandEnabled,

      enableCommand,
      disableCommand,
      addCustomPattern,
      removeCustomPattern,
      disableDefaultPattern,
      enableDefaultPattern,

      setSessionTimeout,
      setConfidenceThreshold,
      setFuzzyMatchingEnabled,
      setFuzzyMatchingThreshold,

      resetToDefaults,
      resetCommandToDefault,
    }),
    [
      settings,
      isLoading,
      setEnabled,
      setLanguage,
      getCommand,
      getCommandsForCategory,
      getPatternsForCommand,
      checkCommandEnabled,
      enableCommand,
      disableCommand,
      addCustomPattern,
      removeCustomPattern,
      disableDefaultPattern,
      enableDefaultPattern,
      setSessionTimeout,
      setConfidenceThreshold,
      setFuzzyMatchingEnabled,
      setFuzzyMatchingThreshold,
      resetToDefaults,
      resetCommandToDefault,
    ]
  );

  return (
    <VoiceSettingsContext.Provider value={value}>
      {children}
    </VoiceSettingsContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook to access voice settings context
 * Must be used within a VoiceSettingsProvider
 */
export function useVoiceSettingsContext(): VoiceSettingsContextValue {
  const context = useContext(VoiceSettingsContext);
  if (!context) {
    throw new Error(
      'useVoiceSettingsContext must be used within a VoiceSettingsProvider'
    );
  }
  return context;
}

/**
 * Hook for basic voice settings (lightweight)
 */
export function useVoiceSettings(): {
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
} {
  const { settings, setEnabled, setLanguage } = useVoiceSettingsContext();
  return {
    isEnabled: settings.isEnabled,
    setEnabled,
    language: settings.language,
    setLanguage,
  };
}

/**
 * Hook for command patterns in current language
 */
export function useCommandPatterns(commandId: string): string[] {
  const { getPatternsForCommand } = useVoiceSettingsContext();
  return getPatternsForCommand(commandId);
}
