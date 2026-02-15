/**
 * HoldToNavigateWrapper — Global Hold-to-Navigate overlay
 *
 * Wraps the main app content and provides:
 * - Long-press detection anywhere on screen (1 finger = navigation wheel)
 * - Two-finger long-press for voice commands (same timing as single-finger)
 * - DraggableMenuButton display
 * - NavigationMenu overlay
 * - Voice command overlay
 *
 * This component should wrap the main navigation container.
 *
 * IMPORTANT: Uses onTouchStart/onTouchMove/onTouchEnd instead of PanResponder
 * to observe touches WITHOUT stealing them from the content. This allows
 * normal interaction with the app while still detecting long presses.
 *
 * Gesture Detection:
 * - 1 finger long-press: Opens navigation wheel
 * - 2 finger long-press: Opens voice command mode (same delay, threshold, haptic)
 *
 * @see .claude/skills/ui-designer/SKILL.md#hold-to-navigate
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  GestureResponderEvent,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';

import { WheelNavigationMenu, NavigationDestination } from './WheelNavigationMenu';
import { HoldIndicator } from './HoldIndicator';
import { VoiceCommandOverlay } from './VoiceCommandOverlay';
import { useHoldToNavigate } from '@/hooks/useHoldToNavigate';
import { useVoiceCommands } from '@/hooks/useVoiceCommands';

interface HoldToNavigateWrapperProps {
  children: React.ReactNode;
  /** Whether to enable hold-to-navigate (disable during onboarding) */
  enabled?: boolean;
}

export function HoldToNavigateWrapper({
  children,
  enabled = true,
}: HoldToNavigateWrapperProps) {
  const navigation = useNavigation<NavigationProp<any>>();

  // Track the current tab name using navigation state
  // Default to 'ChatsTab' since that's the initial tab when the app starts
  const [currentTabName, setCurrentTabName] = useState<string>('ChatsTab');

  // Listen to navigation state changes to track the current tab
  useEffect(() => {
    // Function to extract the current tab from navigation state
    // This recursively searches through all routes to find a tab ending with 'Tab'
    const getCurrentTab = () => {
      const state = navigation.getState();

      if (!state) return undefined;

      // Recursively search for a tab in the navigation tree
      const findTabInRoutes = (routes: any[], index: number): string | undefined => {
        if (!routes || routes.length === 0) return undefined;

        const currentRoute = routes[index];
        if (!currentRoute) return undefined;

        // If the route name ends with 'Tab', we found our tab
        if (currentRoute.name?.endsWith('Tab')) {
          return currentRoute.name;
        }

        // Look in nested state
        if (currentRoute.state?.routes) {
          const nestedResult = findTabInRoutes(
            currentRoute.state.routes,
            currentRoute.state.index ?? 0
          );
          if (nestedResult) return nestedResult;
        }

        return undefined;
      };

      return findTabInRoutes(state.routes, state.index ?? 0);
    };

    // Subscribe to state changes - update current tab when navigation changes
    const unsubscribe = navigation.addListener('state', () => {
      const tab = getCurrentTab();
      if (tab) {
        setCurrentTabName(tab);
      }
    });

    return unsubscribe;
  }, [navigation]);

  // Use the tracked tab name
  const currentRouteName = currentTabName;

  const {
    settings,
    isNavigationMenuOpen,
    reducedMotion,
    openNavigationMenu,
    closeNavigationMenu,
    triggerHaptic,
    isTouchValid,
  } = useHoldToNavigate();

  // Voice commands hook
  const voiceCommands = useVoiceCommands();


  // Voice command overlay state
  const [isVoiceOverlayVisible, setIsVoiceOverlayVisible] = useState(false);

  // Press state for hold indicator (single finger)
  const [isPressing, setIsPressing] = useState(false);
  const [pressPosition, setPressPosition] = useState({ x: 0, y: 0 });
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMoved = useRef(false);
  const longPressCompleted = useRef(false);
  const startPosition = useRef({ x: 0, y: 0 });
  const isPressingRef = useRef(false);

  // Two-finger gesture state (for voice commands)
  // Uses SAME timing and movement threshold as single-finger
  const [isTwoFingerPressing, setIsTwoFingerPressing] = useState(false);
  const twoFingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const twoFingerMoved = useRef(false);
  const twoFingerStartPosition = useRef({ x: 0, y: 0 });
  const isTwoFingerPressingRef = useRef(false);
  const currentTouchCount = useRef(0);

  // Track individual finger positions for two separate indicators
  const [finger1Position, setFinger1Position] = useState({ x: 0, y: 0 });
  const [finger2Position, setFinger2Position] = useState({ x: 0, y: 0 });

  // Delay before committing to single-finger gesture (allows second finger to arrive)
  // On physical devices, fingers don't arrive at exactly the same time
  const twoFingerDetectionDelay = 80; // ms to wait for second finger
  const singleFingerDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Voice command callback refs - declared early so they can be used in startTwoFingerGesture
  const clearCallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRegisteredRef = useRef(false);
  const handleVoiceCommandResultRef = useRef<((result: any) => void) | null>(null);

  // CRITICAL: Refs for voiceCommands functions to avoid stale closures in setTimeout
  // When setTimeout fires after 800ms, the voiceCommands object in the closure may be stale
  // Using refs ensures we always call the most recent version of these functions
  const setOnResultReadyRef = useRef(voiceCommands.setOnResultReady);
  const startListeningRef = useRef(voiceCommands.startListening);
  const clearStateRef = useRef(voiceCommands.clearState);

  // Keep refs updated with latest function references
  useEffect(() => {
    setOnResultReadyRef.current = voiceCommands.setOnResultReady;
    startListeningRef.current = voiceCommands.startListening;
    clearStateRef.current = voiceCommands.clearState;
  }, [voiceCommands.setOnResultReady, voiceCommands.startListening, voiceCommands.clearState]);

  // Clear single-finger press timer helper
  const clearPressTimer = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  // Clear single-finger delay timer helper
  const clearSingleFingerDelayTimer = useCallback(() => {
    if (singleFingerDelayTimer.current) {
      clearTimeout(singleFingerDelayTimer.current);
      singleFingerDelayTimer.current = null;
    }
  }, []);

  // Clear two-finger press timer helper
  const clearTwoFingerTimer = useCallback(() => {
    if (twoFingerTimer.current) {
      clearTimeout(twoFingerTimer.current);
      twoFingerTimer.current = null;
    }
  }, []);

  // Clear all gesture state (used when gesture is cancelled or completed)
  const clearAllGestureState = useCallback(() => {
    clearSingleFingerDelayTimer();
    clearPressTimer();
    clearTwoFingerTimer();
    setIsPressing(false);
    setIsTwoFingerPressing(false);
    isPressingRef.current = false;
    isTwoFingerPressingRef.current = false;
    currentTouchCount.current = 0;
  }, [clearSingleFingerDelayTimer, clearPressTimer, clearTwoFingerTimer]);

  // Touch handlers that OBSERVE touches without consuming them
  // This allows normal app interaction while detecting long presses
  //
  // Gesture detection:
  // - 1 finger long-press: Opens navigation wheel
  // - 2 finger long-press: Opens voice command overlay (SAME timing & threshold)
  // Helper function to start two-finger gesture
  const startTwoFingerGesture = useCallback((touches: any[], pageX: number, pageY: number) => {
    // Cancel any single-finger gesture (including the delay timer)
    clearSingleFingerDelayTimer();
    clearPressTimer();
    setIsPressing(false);
    isPressingRef.current = false;

    // Only proceed if voice commands are enabled
    if (!voiceCommands.settings.enabled) {
      return;
    }

    // Get individual finger positions
    const touch1 = touches?.[0];
    const touch2 = touches?.[1];

    // Store individual finger positions for rendering two indicators
    if (touch1) {
      setFinger1Position({ x: touch1.pageX, y: touch1.pageY });
    }
    if (touch2) {
      setFinger2Position({ x: touch2.pageX, y: touch2.pageY });
    }

    // Calculate center point between two fingers (for start position tracking)
    const centerX = touch1 && touch2 ? (touch1.pageX + touch2.pageX) / 2 : pageX;
    const centerY = touch1 && touch2 ? (touch1.pageY + touch2.pageY) / 2 : pageY;

    twoFingerStartPosition.current = { x: centerX, y: centerY };
    setPressPosition({ x: centerX, y: centerY });
    setIsTwoFingerPressing(true);
    isTwoFingerPressingRef.current = true;
    twoFingerMoved.current = false;

    // Start two-finger long press timer
    clearTwoFingerTimer();
    twoFingerTimer.current = setTimeout(() => {
      if (!twoFingerMoved.current && isTwoFingerPressingRef.current && currentTouchCount.current === 2) {
        triggerHaptic();
        setIsTwoFingerPressing(false);
        isTwoFingerPressingRef.current = false;

        // Register callback BEFORE opening overlay to ensure it's ready for results
        // CRITICAL: Use refs instead of voiceCommands directly to avoid stale closures
        callbackRegisteredRef.current = true;
        setOnResultReadyRef.current((result) => {
          if (handleVoiceCommandResultRef.current) {
            handleVoiceCommandResultRef.current(result);
          }
        });

        setIsVoiceOverlayVisible(true);
        startListeningRef.current();
      }
    }, settings.longPressDelay);
  }, [
    clearSingleFingerDelayTimer,
    clearPressTimer,
    clearTwoFingerTimer,
    voiceCommands.settings.enabled, // Only depend on the enabled setting, not the whole object
    triggerHaptic,
    settings.longPressDelay,
  ]);

  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    if (!enabled || isNavigationMenuOpen || isVoiceOverlayVisible) return;

    const { pageX, pageY } = event.nativeEvent;
    const touches = event.nativeEvent.touches;
    const touchCount = touches?.length ?? 1;
    const previousTouchCount = currentTouchCount.current;

    // Track current touch count
    currentTouchCount.current = touchCount;

    // IMPORTANT: Detect transition from 1 to 2 fingers in touchStart
    // This happens when second finger is added on iOS
    if (previousTouchCount === 1 && touchCount === 2) {
      startTwoFingerGesture(touches as any, pageX, pageY);
      return;
    }

    // Handle based on touch count
    if (touchCount === 1) {
      // SINGLE FINGER: Navigation wheel gesture
      // But wait briefly in case a second finger is coming (for two-finger gesture)
      // Check if touch is valid (not in edge zone)
      if (!isTouchValid(pageX, pageY, 1)) {
        return;
      }

      // Store position for potential gesture
      startPosition.current = { x: pageX, y: pageY };
      setPressPosition({ x: pageX, y: pageY });
      hasMoved.current = false;
      longPressCompleted.current = false;

      // Wait briefly to see if a second finger arrives
      // This prevents race condition where first finger starts gesture before second arrives
      clearSingleFingerDelayTimer();
      singleFingerDelayTimer.current = setTimeout(() => {
        // Only start single-finger gesture if still only 1 finger
        if (currentTouchCount.current === 1 && !hasMoved.current) {
          setIsPressing(true);
          isPressingRef.current = true;

          // Start long press timer - opens wheel directly when complete
          clearPressTimer();
          pressTimer.current = setTimeout(() => {
            if (!hasMoved.current && isPressingRef.current && currentTouchCount.current === 1) {
              longPressCompleted.current = true;
              triggerHaptic();
              setIsPressing(false);
              isPressingRef.current = false;
              openNavigationMenu();
            }
          }, settings.longPressDelay - twoFingerDetectionDelay); // Subtract delay already waited
        }
      }, twoFingerDetectionDelay);

    } else if (touchCount === 2) {
      // TWO FINGERS: Voice command gesture (both fingers started at same time)
      startTwoFingerGesture(touches as any, pageX, pageY);
    } else {
      // 3+ fingers: Cancel all gestures
      clearAllGestureState();
    }
  }, [
    enabled,
    isNavigationMenuOpen,
    isVoiceOverlayVisible,
    isTouchValid,
    settings.longPressDelay,
    openNavigationMenu,
    triggerHaptic,
    clearSingleFingerDelayTimer,
    clearPressTimer,
    clearAllGestureState,
    startTwoFingerGesture,
  ]);

  const handleTouchMove = useCallback((event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const touches = event.nativeEvent.touches;
    const touchCount = touches?.length ?? 1;
    const previousTouchCount = currentTouchCount.current;

    // Update touch count
    currentTouchCount.current = touchCount;

    // IMPORTANT: Detect when second finger is added during a gesture
    // onTouchStart may not be called again when second finger arrives on some devices
    if (previousTouchCount === 1 && touchCount === 2) {
      hasMoved.current = false;
      startTwoFingerGesture(touches as any, pageX, pageY);
      return;
    }

    // Also detect if we somehow jumped directly to 2 fingers
    if (previousTouchCount === 0 && touchCount === 2) {
      hasMoved.current = false;
      startTwoFingerGesture(touches as any, pageX, pageY);
      return;
    }

    // Handle single-finger movement (including during delay period)
    if (touchCount === 1) {
      const dx = pageX - startPosition.current.x;
      const dy = pageY - startPosition.current.y;

      // Cancel if moved more than 10px (SAME threshold)
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        hasMoved.current = true;
        // Cancel both the delay timer and the long press timer
        clearSingleFingerDelayTimer();
        clearPressTimer();
        setIsPressing(false);
        isPressingRef.current = false;
      }
    }

    // Handle two-finger movement (SAME 10px threshold)
    if (isTwoFingerPressingRef.current && touchCount === 2) {
      // Calculate center point between two fingers
      const touch1 = touches?.[0];
      const touch2 = touches?.[1];
      const centerX = touch1 && touch2 ? (touch1.pageX + touch2.pageX) / 2 : pageX;
      const centerY = touch1 && touch2 ? (touch1.pageY + touch2.pageY) / 2 : pageY;

      const dx = centerX - twoFingerStartPosition.current.x;
      const dy = centerY - twoFingerStartPosition.current.y;

      // Cancel if moved more than 10px (SAME threshold as single-finger)
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        twoFingerMoved.current = true;
        setIsTwoFingerPressing(false);
        isTwoFingerPressingRef.current = false;
        clearTwoFingerTimer();
      }
    }

    // If touch count changed during move, cancel all gestures
    if (touchCount !== 1 && touchCount !== 2) {
      clearAllGestureState();
    }
  }, [
    clearSingleFingerDelayTimer,
    clearPressTimer,
    clearTwoFingerTimer,
    clearAllGestureState,
    startTwoFingerGesture,
  ]);

  const handleTouchEnd = useCallback(() => {
    // Clear all gesture state on touch end
    clearAllGestureState();
  }, [clearAllGestureState]);

  // Handle navigation from menu (also used by voice commands)
  const handleNavigate = useCallback(
    (destination: NavigationDestination) => {
      closeNavigationMenu();

      // Navigate to the appropriate tab/screen
      switch (destination) {
        case 'chats':
          navigation.navigate('ChatsTab' as never);
          break;
        case 'contacts':
          navigation.navigate('ContactsTab' as never);
          break;
        case 'groups':
          navigation.navigate('GroupsTab' as never);
          break;
        case 'settings':
          navigation.navigate('SettingsTab' as never);
          break;
        case 'calls':
          navigation.navigate('CallsTab' as never);
          break;
        case 'videocall':
          navigation.navigate('VideoCallTab' as never);
          break;
        case 'ebook':
          navigation.navigate('EBookTab' as never);
          break;
        case 'audiobook':
          navigation.navigate('AudioBookTab' as never);
          break;
        case 'podcast':
          navigation.navigate('PodcastTab' as never);
          break;
        case 'help':
          // TODO: Navigate to help screen when implemented
          console.log('[HoldToNavigate] Help not yet implemented');
          break;
      }
    },
    [navigation, closeNavigationMenu],
  );

  // Handle menu close
  const handleCloseMenu = useCallback(() => {
    closeNavigationMenu();
  }, [closeNavigationMenu]);

  // Note: clearCallbackTimeoutRef and callbackRegisteredRef are declared earlier (near top of component)

  // Handle voice command result (navigate to destination or perform action)
  const handleVoiceCommandResult = useCallback(
    (result: ReturnType<typeof voiceCommands.processTranscript>) => {
      if (!result) return;

      // Cancel any pending callback clear timeout - we're handling the result now
      if (clearCallbackTimeoutRef.current) {
        clearTimeout(clearCallbackTimeoutRef.current);
        clearCallbackTimeoutRef.current = null;
      }

      // Reset callback registered flag so next time overlay opens, callback will be registered again
      callbackRegisteredRef.current = false;

      if (result.type === 'navigation' && result.destination) {
        // Close voice overlay and navigate
        setIsVoiceOverlayVisible(false);
        voiceCommands.clearState();
        handleNavigate(result.destination);
      } else if (result.type === 'action') {
        // Handle call/message action
        // TODO: Implement contact lookup and action
        console.log('[HoldToNavigate] Voice action:', result.action, 'to', result.contactName);
        setIsVoiceOverlayVisible(false);
        voiceCommands.clearState();
      } else {
        // Unknown command - keep overlay open for retry
        console.log('[HoldToNavigate] Unknown voice command:', result.rawText);
      }
    },
    [voiceCommands, handleNavigate],
  );

  // Update refs with latest values (refs are declared earlier in the component)
  useEffect(() => {
    handleVoiceCommandResultRef.current = handleVoiceCommandResult;
  }, [handleVoiceCommandResult]);

  // Handle voice overlay close
  // IMPORTANT: Do NOT clear the callback here - iOS may still send final results after stop
  const handleVoiceOverlayClose = useCallback(() => {
    setIsVoiceOverlayVisible(false);
    voiceCommands.stopListening();
  }, [voiceCommands.stopListening]);

  // Note: callbackRegisteredRef and clearCallbackTimeoutRef are declared earlier (before handleVoiceCommandResult)

  // Handle callback cleanup when overlay closes
  useEffect(() => {
    if (isVoiceOverlayVisible) {
      // Cancel any pending clear timeout when overlay opens
      if (clearCallbackTimeoutRef.current) {
        clearTimeout(clearCallbackTimeoutRef.current);
        clearCallbackTimeoutRef.current = null;
      }
    } else if (!isVoiceOverlayVisible && callbackRegisteredRef.current) {
      // Delay clearing the callback to allow iOS to send final results
      clearCallbackTimeoutRef.current = setTimeout(() => {
        callbackRegisteredRef.current = false;
        setOnResultReadyRef.current(null);
        clearStateRef.current();
      }, 3000);
    }

    return () => {
      if (clearCallbackTimeoutRef.current) {
        clearTimeout(clearCallbackTimeoutRef.current);
      }
    };
  }, [isVoiceOverlayVisible]);

  // Convert route name to NavigationDestination
  const activeScreen = useMemo((): NavigationDestination | undefined => {
    switch (currentRouteName) {
      case 'ChatsTab': return 'chats';
      case 'ContactsTab': return 'contacts';
      case 'GroupsTab': return 'groups';
      case 'SettingsTab': return 'settings';
      case 'CallsTab': return 'calls';
      case 'VideoCallTab': return 'videocall';
      case 'EBookTab': return 'ebook';
      case 'AudioBookTab': return 'audiobook';
      case 'PodcastTab': return 'podcast';
      default: return undefined;
    }
  }, [currentRouteName]);

  return (
    <View
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Main content - receives all touches normally
          The touch handlers above observe but don't consume events */}
      <View style={styles.content}>
        {children}
      </View>

      {/* Hold indicator for single-finger (shows during long press) */}
      {isPressing && enabled && (
        <HoldIndicator
          isActive={isPressing}
          duration={settings.longPressDelay}
          x={pressPosition.x}
          y={pressPosition.y}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Two hold indicators for two-finger voice gesture - one per finger */}
      {isTwoFingerPressing && enabled && voiceCommands.settings.enabled && (
        <>
          {/* Indicator for finger 1 */}
          <HoldIndicator
            isActive={isTwoFingerPressing}
            duration={settings.longPressDelay}
            x={finger1Position.x}
            y={finger1Position.y}
            reducedMotion={reducedMotion}
          />
          {/* Indicator for finger 2 */}
          <HoldIndicator
            isActive={isTwoFingerPressing}
            duration={settings.longPressDelay}
            x={finger2Position.x}
            y={finger2Position.y}
            reducedMotion={reducedMotion}
          />
        </>
      )}

      {/* Navigation wheel overlay - opens directly after single-finger long press */}
      <WheelNavigationMenu
        visible={isNavigationMenuOpen}
        onNavigate={handleNavigate}
        onClose={handleCloseMenu}
        activeScreen={activeScreen}
      />

      {/* Voice command overlay - opens after two-finger long press */}
      <VoiceCommandOverlay
        visible={isVoiceOverlayVisible}
        voiceState={voiceCommands.state}
        onClose={handleVoiceOverlayClose}
        onResult={handleVoiceCommandResult}
        processTranscript={voiceCommands.processTranscript}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
