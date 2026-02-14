/**
 * Hold-to-Navigate — Context Provider and Hook
 *
 * Provides a universal navigation mechanism for all screens:
 * - Long-press anywhere reveals menu button
 * - Menu button position is customizable (draggable, snaps to edges)
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

// Default values
const DEFAULT_LONG_PRESS_DELAY = 1000; // 1 second
const DEFAULT_MENU_POSITION_X = 0.9; // Right side (90% of screen width)
const DEFAULT_MENU_POSITION_Y = 0.5; // Middle height (50% of screen height)
const DEFAULT_EDGE_EXCLUSION_SIZE = 40; // 40px edge exclusion zone (seniors often grip edges)
const DEFAULT_WHEEL_BLUR_INTENSITY = 15; // Blur radius (0-30)
const DEFAULT_WHEEL_DISMISS_MARGIN = 50; // Margin around wheel for tap-outside-to-dismiss (px)
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
  /** Menu button X position (0-1 as % of screen width) */
  menuButtonPositionX: number;
  /** Menu button Y position (0-1 as % of screen height) */
  menuButtonPositionY: number;
  /** Edge exclusion zone in pixels (0-100, default 40). Touches in this zone are ignored. */
  edgeExclusionSize: number;
  /** Wheel background blur intensity (0-30, default 15). 0 = no blur, transparent overlay only. */
  wheelBlurIntensity: number;
  /** Margin around wheel for tap-outside-to-dismiss in pixels (20-100, default 50). */
  wheelDismissMargin: number;
}

export interface HoldToNavigateContextValue {
  /** Current settings */
  settings: HoldToNavigateSettings;

  /** Whether the menu button is currently visible */
  isMenuButtonVisible: boolean;

  /** Whether the navigation menu is open */
  isNavigationMenuOpen: boolean;

  /** Whether the user is currently in the onboarding tutorial */
  isInTutorial: boolean;

  /** Whether reduced motion is enabled */
  reducedMotion: boolean;

  /** Show the menu button (triggered by long press) */
  showMenuButton: () => void;

  /** Hide the menu button */
  hideMenuButton: () => void;

  /** Open the navigation menu */
  openNavigationMenu: () => void;

  /** Close the navigation menu */
  closeNavigationMenu: () => void;

  /** Update the menu button position */
  updateMenuButtonPosition: (x: number, y: number) => Promise<void>;

  /** Update the long press delay */
  updateLongPressDelay: (delayMs: number) => Promise<void>;

  /** Update the edge exclusion size */
  updateEdgeExclusionSize: (sizePx: number) => Promise<void>;

  /** Update the wheel blur intensity */
  updateWheelBlurIntensity: (intensity: number) => Promise<void>;

  /** Update the wheel dismiss margin */
  updateWheelDismissMargin: (marginPx: number) => Promise<void>;

  /** Check if a touch position is valid (single finger, not in edge zone) */
  isTouchValid: (x: number, y: number, touchCount: number) => boolean;

  /** Mark tutorial as complete */
  completeTutorial: () => void;

  /** Get menu button position in pixels */
  getMenuButtonPixelPosition: () => { x: number; y: number };

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
    menuButtonPositionX: DEFAULT_MENU_POSITION_X,
    menuButtonPositionY: DEFAULT_MENU_POSITION_Y,
    edgeExclusionSize: DEFAULT_EDGE_EXCLUSION_SIZE,
    wheelBlurIntensity: DEFAULT_WHEEL_BLUR_INTENSITY,
    wheelDismissMargin: DEFAULT_WHEEL_DISMISS_MARGIN,
  });
  const [isMenuButtonVisible, setIsMenuButtonVisible] = useState(false);
  const [isNavigationMenuOpen, setIsNavigationMenuOpen] = useState(false);
  const [isInTutorial, setIsInTutorial] = useState(isFirstLaunch);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Screen dimensions (for pixel position calculations)
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
            menuButtonPositionX: profile.menuButtonPositionX ?? DEFAULT_MENU_POSITION_X,
            menuButtonPositionY: profile.menuButtonPositionY ?? DEFAULT_MENU_POSITION_Y,
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

  // Show menu button (called when long press is detected)
  const showMenuButton = useCallback(() => {
    setIsMenuButtonVisible(true);
    triggerHaptic();
  }, [triggerHaptic]);

  // Hide menu button
  const hideMenuButton = useCallback(() => {
    setIsMenuButtonVisible(false);
  }, []);

  // Open navigation menu (and hide menu button)
  const openNavigationMenu = useCallback(() => {
    setIsMenuButtonVisible(false); // Hide button when wheel opens
    setIsNavigationMenuOpen(true);
    triggerHaptic();
  }, [triggerHaptic]);

  // Close navigation menu
  const closeNavigationMenu = useCallback(() => {
    setIsNavigationMenuOpen(false);
    setIsMenuButtonVisible(false);
  }, []);

  // Update menu button position (persisted)
  const updateMenuButtonPosition = useCallback(
    async (x: number, y: number) => {
      // Clamp values to valid range
      const clampedX = Math.max(0, Math.min(1, x));
      const clampedY = Math.max(0, Math.min(1, y));

      // Update local state immediately for responsiveness
      setSettings(prev => ({
        ...prev,
        menuButtonPositionX: clampedX,
        menuButtonPositionY: clampedY,
      }));

      // Persist to database
      const db = getDatabase();
      if (!db) return;
      try {
        const profile = await db.getUserProfile();
        if (profile) {
          await db.saveUserProfile({
            ...profile,
            menuButtonPositionX: clampedX,
            menuButtonPositionY: clampedY,
          });
        }
      } catch (error) {
        console.error('Failed to save menu button position:', error);
      }
    },
    [],
  );

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

  // Update wheel blur intensity (persisted)
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

  // Update wheel dismiss margin (persisted)
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

  // Get menu button position in pixels
  const getMenuButtonPixelPosition = useCallback(() => {
    const { width, height } = screenDimensions.current;
    return {
      x: settings.menuButtonPositionX * width,
      y: settings.menuButtonPositionY * height,
    };
  }, [settings.menuButtonPositionX, settings.menuButtonPositionY]);

  // Context value (memoized to prevent unnecessary re-renders)
  const contextValue = useMemo<HoldToNavigateContextValue>(
    () => ({
      settings,
      isMenuButtonVisible,
      isNavigationMenuOpen,
      isInTutorial,
      reducedMotion,
      showMenuButton,
      hideMenuButton,
      openNavigationMenu,
      closeNavigationMenu,
      updateMenuButtonPosition,
      updateLongPressDelay,
      updateEdgeExclusionSize,
      updateWheelBlurIntensity,
      updateWheelDismissMargin,
      isTouchValid,
      completeTutorial,
      getMenuButtonPixelPosition,
      triggerHaptic,
    }),
    [
      settings,
      isMenuButtonVisible,
      isNavigationMenuOpen,
      isInTutorial,
      reducedMotion,
      showMenuButton,
      hideMenuButton,
      openNavigationMenu,
      closeNavigationMenu,
      updateMenuButtonPosition,
      updateLongPressDelay,
      updateEdgeExclusionSize,
      updateWheelBlurIntensity,
      updateWheelDismissMargin,
      isTouchValid,
      completeTutorial,
      getMenuButtonPixelPosition,
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

/**
 * Hook to create a long-press gesture handler
 * Use this on any View that should respond to hold-to-navigate
 */
export function useLongPressHandler() {
  const { settings, showMenuButton } = useHoldToNavigate();
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPressed = useRef(false);

  const onPressIn = useCallback(() => {
    isPressed.current = true;
    pressTimer.current = setTimeout(() => {
      if (isPressed.current) {
        showMenuButton();
      }
    }, settings.longPressDelay);
  }, [settings.longPressDelay, showMenuButton]);

  const onPressOut = useCallback(() => {
    isPressed.current = false;
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
      }
    };
  }, []);

  return {
    onPressIn,
    onPressOut,
    longPressDelay: settings.longPressDelay,
  };
}

// Export constants for use in settings UI
export const HOLD_TO_NAVIGATE_CONSTANTS = {
  DEFAULT_LONG_PRESS_DELAY,
  DEFAULT_MENU_POSITION_X,
  DEFAULT_MENU_POSITION_Y,
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
