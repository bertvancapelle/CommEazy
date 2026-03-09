/**
 * Hold-to-Navigate — Context Provider and Hook
 *
 * Provides a universal navigation mechanism for all screens:
 * - Long-press anywhere navigates to HomeScreen grid
 * - Settings are persisted in user profile
 *
 * @see .claude/skills/ui-designer/SKILL.md#hold-to-navigate
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import {
  Dimensions,
  AccessibilityInfo,
  Platform,
  Vibration,
} from 'react-native';
import { ServiceContainer } from '@/services/container';
import { glassPlayer } from '@/services/glassPlayer';

// Default values
const DEFAULT_LONG_PRESS_DELAY = 1000; // 1 second
const DEFAULT_EDGE_EXCLUSION_SIZE = 40; // 40px edge exclusion zone (seniors often grip edges)
const DEFAULT_WHEEL_BLUR_INTENSITY = 15; // Legacy setting (kept for settings compat)
const DEFAULT_WHEEL_DISMISS_MARGIN = 50; // Legacy setting (kept for settings compat)
const MIN_LONG_PRESS_DELAY = 500;
const MAX_LONG_PRESS_DELAY = 3000;
const MIN_EDGE_EXCLUSION_SIZE = 0;
const MAX_EDGE_EXCLUSION_SIZE = 100;
const MIN_WHEEL_BLUR_INTENSITY = 0;
const MAX_WHEEL_BLUR_INTENSITY = 30;
const MIN_WHEEL_DISMISS_MARGIN = 20;
const MAX_WHEEL_DISMISS_MARGIN = 100;

export interface HoldToNavigateSettings {
  /** Long press delay in ms (500-3000, default 1000) */
  longPressDelay: number;
  /** Edge exclusion zone in pixels (0-100, default 40). Touches in this zone are ignored. */
  edgeExclusionSize: number;
  /** Legacy setting (kept for settings compat) */
  wheelBlurIntensity: number;
  /** Legacy setting (kept for settings compat) */
  wheelDismissMargin: number;
}

export interface HoldToNavigateContextValue {
  /** Current settings */
  settings: HoldToNavigateSettings;

  /** Whether the user is currently in the onboarding tutorial */
  isInTutorial: boolean;

  /** Whether reduced motion is enabled */
  reducedMotion: boolean;

  /** Close the navigation menu (hides Glass Player overlay) */
  closeNavigationMenu: () => void;

  /** Update the long press delay */
  updateLongPressDelay: (delayMs: number) => Promise<void>;

  /** Update the edge exclusion size */
  updateEdgeExclusionSize: (sizePx: number) => Promise<void>;

  /** Update the wheel blur intensity (legacy setting) */
  updateWheelBlurIntensity: (intensity: number) => Promise<void>;

  /** Update the wheel dismiss margin (legacy setting) */
  updateWheelDismissMargin: (marginPx: number) => Promise<void>;

  /** Check if a touch position is valid (single finger, not in edge zone) */
  isTouchValid: (x: number, y: number, touchCount: number) => boolean;

  /** Mark tutorial as complete */
  completeTutorial: () => void;

  /** Trigger haptic feedback */
  triggerHaptic: () => void;
}

const HoldToNavigateContext = createContext<HoldToNavigateContextValue | null>(null);

interface HoldToNavigateProviderProps {
  children: React.ReactNode;
  /** Whether this is the first launch (show tutorial) */
  isFirstLaunch?: boolean;
}

export function HoldToNavigateProvider({
  children,
  isFirstLaunch = false,
}: HoldToNavigateProviderProps) {
  // Use ServiceContainer directly instead of context hook
  // This avoids null errors during initial render before services are initialized
  const getDatabase = () => {
    if (ServiceContainer.isInitialized) {
      return ServiceContainer.database;
    }
    return null;
  };

  // State
  const [settings, setSettings] = useState<HoldToNavigateSettings>({
    longPressDelay: DEFAULT_LONG_PRESS_DELAY,
    edgeExclusionSize: DEFAULT_EDGE_EXCLUSION_SIZE,
    wheelBlurIntensity: DEFAULT_WHEEL_BLUR_INTENSITY,
    wheelDismissMargin: DEFAULT_WHEEL_DISMISS_MARGIN,
  });
  const [isInTutorial, setIsInTutorial] = useState(isFirstLaunch);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Screen dimensions (for edge exclusion calculations)
  const screenDimensions = useRef(Dimensions.get('window'));

  // Load settings from database on mount
  useEffect(() => {
    async function loadSettings() {
      const db = getDatabase();
      if (!db) {
        // Database not yet initialized, will use defaults
        return;
      }
      try {
        const profile = await db.getUserProfile();
        if (profile) {
          setSettings({
            longPressDelay: profile.longPressDelay ?? DEFAULT_LONG_PRESS_DELAY,
            edgeExclusionSize: profile.edgeExclusionSize ?? DEFAULT_EDGE_EXCLUSION_SIZE,
            wheelBlurIntensity: profile.wheelBlurIntensity ?? DEFAULT_WHEEL_BLUR_INTENSITY,
            wheelDismissMargin: profile.wheelDismissMargin ?? DEFAULT_WHEEL_DISMISS_MARGIN,
          });
        }
      } catch (error) {
        console.error('Failed to load Hold-to-Navigate settings:', error);
      }
    }
    loadSettings();
  }, []);

  // Listen for screen dimension changes (rotation)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      screenDimensions.current = window;
    });
    return () => subscription.remove();
  }, []);

  // Check for reduced motion preference
  useEffect(() => {
    async function checkReducedMotion() {
      const isReducedMotion = await AccessibilityInfo.isReduceMotionEnabled();
      setReducedMotion(isReducedMotion);
    }
    checkReducedMotion();

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );
    return () => subscription.remove();
  }, []);

  // Haptic feedback
  const triggerHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      // iOS uses the Taptic Engine via native modules
      // For now, fall back to Vibration
      Vibration.vibrate(10);
    } else {
      // Android
      Vibration.vibrate(25);
    }
  }, []);

  // Close navigation menu (restores Glass Player)
  const closeNavigationMenu = useCallback(() => {
    // Restore Glass Player visibility (iOS 26+)
    glassPlayer.setTemporarilyHidden(false);
  }, []);

  // Update long press delay (persisted)
  const updateLongPressDelay = useCallback(
    async (delayMs: number) => {
      // Clamp to valid range
      const clampedDelay = Math.max(
        MIN_LONG_PRESS_DELAY,
        Math.min(MAX_LONG_PRESS_DELAY, delayMs),
      );

      // Update local state immediately
      setSettings(prev => ({
        ...prev,
        longPressDelay: clampedDelay,
      }));

      // Persist to database
      const db = getDatabase();
      if (!db) return;
      try {
        const profile = await db.getUserProfile();
        if (profile) {
          await db.saveUserProfile({
            ...profile,
            longPressDelay: clampedDelay,
          });
        }
      } catch (error) {
        console.error('Failed to save long press delay:', error);
      }
    },
    [],
  );

  // Update edge exclusion size (persisted)
  const updateEdgeExclusionSize = useCallback(
    async (sizePx: number) => {
      // Clamp to valid range
      const clampedSize = Math.max(
        MIN_EDGE_EXCLUSION_SIZE,
        Math.min(MAX_EDGE_EXCLUSION_SIZE, sizePx),
      );

      // Update local state immediately
      setSettings(prev => ({
        ...prev,
        edgeExclusionSize: clampedSize,
      }));

      // Persist to database
      const db = getDatabase();
      if (!db) return;
      try {
        const profile = await db.getUserProfile();
        if (profile) {
          await db.saveUserProfile({
            ...profile,
            edgeExclusionSize: clampedSize,
          });
        }
      } catch (error) {
        console.error('Failed to save edge exclusion size:', error);
      }
    },
    [],
  );

  // Update wheel blur intensity (legacy setting, persisted)
  const updateWheelBlurIntensity = useCallback(
    async (intensity: number) => {
      // Clamp to valid range
      const clampedIntensity = Math.max(
        MIN_WHEEL_BLUR_INTENSITY,
        Math.min(MAX_WHEEL_BLUR_INTENSITY, intensity),
      );

      // Update local state immediately
      setSettings(prev => ({
        ...prev,
        wheelBlurIntensity: clampedIntensity,
      }));

      // Persist to database
      const db = getDatabase();
      if (!db) return;
      try {
        const profile = await db.getUserProfile();
        if (profile) {
          await db.saveUserProfile({
            ...profile,
            wheelBlurIntensity: clampedIntensity,
          });
        }
      } catch (error) {
        console.error('Failed to save wheel blur intensity:', error);
      }
    },
    [],
  );

  // Update wheel dismiss margin (legacy setting, persisted)
  const updateWheelDismissMargin = useCallback(
    async (marginPx: number) => {
      // Clamp to valid range
      const clampedMargin = Math.max(
        MIN_WHEEL_DISMISS_MARGIN,
        Math.min(MAX_WHEEL_DISMISS_MARGIN, marginPx),
      );

      // Update local state immediately
      setSettings(prev => ({
        ...prev,
        wheelDismissMargin: clampedMargin,
      }));

      // Persist to database
      const db = getDatabase();
      if (!db) return;
      try {
        const profile = await db.getUserProfile();
        if (profile) {
          await db.saveUserProfile({
            ...profile,
            wheelDismissMargin: clampedMargin,
          });
        }
      } catch (error) {
        console.error('Failed to save wheel dismiss margin:', error);
      }
    },
    [],
  );

  /**
   * Check if a touch is valid for Hold-to-Navigate activation.
   * Returns false if:
   * - Multi-touch detected (touchCount > 1) — seniors may grip device with multiple fingers
   * - Touch is in edge exclusion zone — seniors often rest fingers on screen edges
   */
  const isTouchValid = useCallback(
    (x: number, y: number, touchCount: number): boolean => {
      // Reject multi-touch (seniors gripping device with multiple fingers)
      if (touchCount > 1) {
        return false;
      }

      const { width, height } = screenDimensions.current;
      const exclusion = settings.edgeExclusionSize;

      // Check if touch is within edge exclusion zone
      const isInLeftEdge = x < exclusion;
      const isInRightEdge = x > width - exclusion;
      const isInTopEdge = y < exclusion;
      const isInBottomEdge = y > height - exclusion;

      if (isInLeftEdge || isInRightEdge || isInTopEdge || isInBottomEdge) {
        return false;
      }

      return true;
    },
    [settings.edgeExclusionSize],
  );

  // Complete tutorial
  const completeTutorial = useCallback(() => {
    setIsInTutorial(false);
  }, []);

  // Context value (memoized to prevent unnecessary re-renders)
  const contextValue = useMemo<HoldToNavigateContextValue>(
    () => ({
      settings,
      isInTutorial,
      reducedMotion,
      closeNavigationMenu,
      updateLongPressDelay,
      updateEdgeExclusionSize,
      updateWheelBlurIntensity,
      updateWheelDismissMargin,
      isTouchValid,
      completeTutorial,
      triggerHaptic,
    }),
    [
      settings,
      isInTutorial,
      reducedMotion,
      closeNavigationMenu,
      updateLongPressDelay,
      updateEdgeExclusionSize,
      updateWheelBlurIntensity,
      updateWheelDismissMargin,
      isTouchValid,
      completeTutorial,
      triggerHaptic,
    ],
  );

  return (
    <HoldToNavigateContext.Provider value={contextValue}>
      {children}
    </HoldToNavigateContext.Provider>
  );
}

/**
 * Hook to access Hold-to-Navigate functionality
 */
export function useHoldToNavigate(): HoldToNavigateContextValue {
  const context = useContext(HoldToNavigateContext);
  if (!context) {
    throw new Error('useHoldToNavigate must be used within HoldToNavigateProvider');
  }
  return context;
}

// Export constants for use in settings UI
export const HOLD_TO_NAVIGATE_CONSTANTS = {
  DEFAULT_LONG_PRESS_DELAY,
  DEFAULT_EDGE_EXCLUSION_SIZE,
  DEFAULT_WHEEL_BLUR_INTENSITY,
  DEFAULT_WHEEL_DISMISS_MARGIN,
  MIN_LONG_PRESS_DELAY,
  MAX_LONG_PRESS_DELAY,
  MIN_EDGE_EXCLUSION_SIZE,
  MAX_EDGE_EXCLUSION_SIZE,
  MIN_WHEEL_BLUR_INTENSITY,
  MAX_WHEEL_BLUR_INTENSITY,
  MIN_WHEEL_DISMISS_MARGIN,
  MAX_WHEEL_DISMISS_MARGIN,
};
