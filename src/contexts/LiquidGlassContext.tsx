/**
 * LiquidGlassContext — Apple Liquid Glass state management
 *
 * Provides global state for Liquid Glass effects on iOS/iPadOS 26+.
 * Handles platform detection, user settings, and accessibility preferences.
 *
 * Progressive Enhancement:
 * - iOS 26+: Liquid Glass with user-configurable tint intensity
 * - iOS <26 / Android: Solid color fallback
 *
 * @see .claude/CLAUDE.md section 16 - Apple Liquid Glass Compliance
 * @see src/types/liquidGlass.ts for type definitions
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { Platform, AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  type LiquidGlassContextValue,
  type LiquidGlassSettings,
  type LiquidGlassPlatformSupport,
  type LiquidGlassAccessibility,
  type ModuleColorId,
  DEFAULT_LIQUID_GLASS_SETTINGS,
  LIQUID_GLASS_STORAGE_KEY,
  LIQUID_GLASS_MIN_IOS_VERSION,
  MODULE_TINT_COLORS,
} from '@/types/liquidGlass';

// ============================================================
// Platform Detection
// ============================================================

/**
 * Detect platform support for Liquid Glass
 * iOS 26+ required for UIGlassEffect
 */
function detectPlatformSupport(): LiquidGlassPlatformSupport {
  if (Platform.OS !== 'ios') {
    console.debug('[LiquidGlass] Platform is not iOS, Liquid Glass disabled');
    return {
      isSupported: false,
      iosVersion: null,
      platform: 'android',
    };
  }

  // Parse iOS version from Platform.Version
  // Platform.Version on iOS returns a string like "26.0" or number
  const versionString = String(Platform.Version);
  const majorVersion = parseInt(versionString.split('.')[0], 10);

  const isSupported = majorVersion >= LIQUID_GLASS_MIN_IOS_VERSION;
  console.info(`[LiquidGlass] iOS version detected: ${majorVersion}, min required: ${LIQUID_GLASS_MIN_IOS_VERSION}, supported: ${isSupported}`);

  return {
    isSupported,
    iosVersion: majorVersion,
    platform: 'ios',
  };
}

// ============================================================
// Context
// ============================================================

const LiquidGlassContext = createContext<LiquidGlassContextValue | null>(null);

interface LiquidGlassProviderProps {
  children: ReactNode;
}

/**
 * Provider component for Liquid Glass context
 *
 * Wraps the app to provide Liquid Glass state to all children.
 * Handles loading settings from AsyncStorage and accessibility listeners.
 */
export function LiquidGlassProvider({ children }: LiquidGlassProviderProps) {
  // Platform support (static, determined once)
  const platform = useMemo(() => detectPlatformSupport(), []);

  // User settings (persisted to AsyncStorage)
  const [settings, setSettings] = useState<LiquidGlassSettings>(
    DEFAULT_LIQUID_GLASS_SETTINGS
  );

  // Accessibility state (from system settings)
  const [accessibility, setAccessibility] = useState<LiquidGlassAccessibility>({
    reduceTransparencyEnabled: false,
    reduceMotionEnabled: false,
  });

  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // Load Settings from AsyncStorage
  // ============================================================

  useEffect(() => {
    async function loadSettings() {
      try {
        const stored = await AsyncStorage.getItem(LIQUID_GLASS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<LiquidGlassSettings>;
          setSettings({
            ...DEFAULT_LIQUID_GLASS_SETTINGS,
            ...parsed,
          });
        }
      } catch (error) {
        console.error('[LiquidGlassContext] Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadSettings();
  }, []);

  // ============================================================
  // Accessibility Listeners
  // ============================================================

  useEffect(() => {
    // Check initial accessibility state
    async function checkAccessibility() {
      try {
        const [reduceMotion, reduceTransparency] = await Promise.all([
          AccessibilityInfo.isReduceMotionEnabled(),
          // Note: isReduceTransparencyEnabled is iOS only
          Platform.OS === 'ios'
            ? AccessibilityInfo.isReduceTransparencyEnabled()
            : Promise.resolve(false),
        ]);

        setAccessibility({
          reduceMotionEnabled: reduceMotion,
          reduceTransparencyEnabled: reduceTransparency,
        });
      } catch (error) {
        console.warn('[LiquidGlassContext] Failed to check accessibility:', error);
      }
    }

    void checkAccessibility();

    // Subscribe to accessibility changes
    const reduceMotionSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        setAccessibility((prev) => ({
          ...prev,
          reduceMotionEnabled: enabled,
        }));
      }
    );

    // Note: reduceTransparencyChanged is iOS 13+ only
    let reduceTransparencySubscription: ReturnType<typeof AccessibilityInfo.addEventListener> | null = null;
    if (Platform.OS === 'ios') {
      reduceTransparencySubscription = AccessibilityInfo.addEventListener(
        'reduceTransparencyChanged',
        (enabled) => {
          setAccessibility((prev) => ({
            ...prev,
            reduceTransparencyEnabled: enabled,
          }));
        }
      );
    }

    return () => {
      reduceMotionSubscription.remove();
      reduceTransparencySubscription?.remove();
    };
  }, []);

  // ============================================================
  // Persist Settings to AsyncStorage
  // ============================================================

  const persistSettings = useCallback(async (newSettings: LiquidGlassSettings) => {
    try {
      await AsyncStorage.setItem(
        LIQUID_GLASS_STORAGE_KEY,
        JSON.stringify(newSettings)
      );
    } catch (error) {
      console.error('[LiquidGlassContext] Failed to persist settings:', error);
    }
  }, []);

  // ============================================================
  // Setting Updaters
  // ============================================================

  const setTintIntensity = useCallback(
    (intensity: number) => {
      // Clamp to 0-100
      const clamped = Math.max(0, Math.min(100, intensity));
      const newSettings = { ...settings, tintIntensity: clamped };
      setSettings(newSettings);
      void persistSettings(newSettings);
    },
    [settings, persistSettings]
  );

  const setForceDisabled = useCallback(
    (disabled: boolean) => {
      const newSettings = { ...settings, forceDisabled: disabled };
      setSettings(newSettings);
      void persistSettings(newSettings);
    },
    [settings, persistSettings]
  );

  // ============================================================
  // Computed Values
  // ============================================================

  /**
   * Whether Liquid Glass effects should be rendered
   * True when:
   * - Platform supports Liquid Glass (iOS 26+)
   * - User has not force-disabled it
   * - System "Reduce Transparency" is not enabled
   */
  const isEnabled = useMemo(() => {
    return (
      platform.isSupported &&
      !settings.forceDisabled &&
      !accessibility.reduceTransparencyEnabled
    );
  }, [platform.isSupported, settings.forceDisabled, accessibility.reduceTransparencyEnabled]);

  /**
   * Get the appropriate color for a module
   * Returns tintColor if Liquid Glass is enabled, fallbackColor otherwise
   */
  const getModuleColor = useCallback(
    (moduleId: ModuleColorId): string => {
      const colors = MODULE_TINT_COLORS[moduleId];
      if (!colors) {
        console.warn(`[LiquidGlassContext] Unknown moduleId: ${moduleId}`);
        return '#607D8B'; // Default grey
      }
      return isEnabled ? colors.tintColor : colors.fallbackColor;
    },
    [isEnabled]
  );

  /**
   * Get effective tint intensity as 0-1 value for native module
   * Returns 0 if Liquid Glass is not enabled
   */
  const getEffectiveTintIntensity = useCallback((): number => {
    if (!isEnabled) return 0;
    return settings.tintIntensity / 100;
  }, [isEnabled, settings.tintIntensity]);

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo<LiquidGlassContextValue>(
    () => ({
      platform,
      settings,
      accessibility,
      isEnabled,
      setTintIntensity,
      setForceDisabled,
      getModuleColor,
      getEffectiveTintIntensity,
    }),
    [
      platform,
      settings,
      accessibility,
      isEnabled,
      setTintIntensity,
      setForceDisabled,
      getModuleColor,
      getEffectiveTintIntensity,
    ]
  );

  // Show loading state briefly, then render children
  // Settings are loaded in background, defaults are used initially
  if (isLoading && !platform.isSupported) {
    // On non-supported platforms, don't wait for settings
    // They won't be used anyway
  }

  return (
    <LiquidGlassContext.Provider value={value}>
      {children}
    </LiquidGlassContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook to access the Liquid Glass context
 * Must be used within a LiquidGlassProvider
 *
 * @throws Error if used outside of LiquidGlassProvider
 */
export function useLiquidGlassContext(): LiquidGlassContextValue {
  const context = useContext(LiquidGlassContext);
  if (!context) {
    throw new Error(
      'useLiquidGlassContext must be used within a LiquidGlassProvider'
    );
  }
  return context;
}

/**
 * Safe hook that returns null if outside provider
 * Useful for components that may render before provider is mounted
 */
export function useLiquidGlassContextSafe(): LiquidGlassContextValue | null {
  return useContext(LiquidGlassContext);
}

/**
 * Convenience hook for checking if Liquid Glass is enabled
 * Returns false if outside provider or not supported
 */
export function useLiquidGlassEnabled(): boolean {
  const context = useContext(LiquidGlassContext);
  return context?.isEnabled ?? false;
}
