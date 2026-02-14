/**
 * HoldToNavigateWrapper — Global Hold-to-Navigate overlay
 *
 * Wraps the main app content and provides:
 * - Long-press detection anywhere on screen
 * - DraggableMenuButton display
 * - NavigationMenu overlay
 *
 * This component should wrap the main navigation container.
 *
 * IMPORTANT: Uses onTouchStart/onTouchMove/onTouchEnd instead of PanResponder
 * to observe touches WITHOUT stealing them from the content. This allows
 * normal interaction with the app while still detecting long presses.
 *
 * @see .claude/skills/ui-designer/SKILL.md#hold-to-navigate
 */

import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  GestureResponderEvent,
} from 'react-native';
import { useNavigation, NavigationProp, useNavigationState } from '@react-navigation/native';

import { WheelNavigationMenu, NavigationDestination } from './WheelNavigationMenu';
import { HoldIndicator } from './HoldIndicator';
import { useHoldToNavigate } from '@/hooks/useHoldToNavigate';

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

  // Use useNavigationState to reactively get the current route name
  const currentRouteName = useNavigationState(state => {
    if (!state) return undefined;
    const route = state.routes[state.index];
    return route?.name;
  });

  const {
    settings,
    isNavigationMenuOpen,
    reducedMotion,
    openNavigationMenu,
    closeNavigationMenu,
    triggerHaptic,
    isTouchValid,
  } = useHoldToNavigate();

  // Press state for hold indicator
  const [isPressing, setIsPressing] = useState(false);
  const [pressPosition, setPressPosition] = useState({ x: 0, y: 0 });
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMoved = useRef(false);
  const longPressCompleted = useRef(false);
  const startPosition = useRef({ x: 0, y: 0 });
  const isPressingRef = useRef(false);

  // Clear press timer helper
  const clearPressTimer = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  // Touch handlers that OBSERVE touches without consuming them
  // This allows normal app interaction while detecting long presses
  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    if (!enabled || isNavigationMenuOpen) return;

    const { pageX, pageY } = event.nativeEvent;
    const touches = event.nativeEvent.touches;
    const touchCount = touches?.length ?? 1;

    console.log('[HoldToNavigate] Touch started at', pageX, pageY);

    // Check if touch is valid (single finger, not in edge zone)
    if (!isTouchValid(pageX, pageY, touchCount)) {
      return;
    }

    startPosition.current = { x: pageX, y: pageY };
    setPressPosition({ x: pageX, y: pageY });
    setIsPressing(true);
    isPressingRef.current = true;
    hasMoved.current = false;
    longPressCompleted.current = false;

    // Start long press timer - opens wheel directly when complete
    clearPressTimer();
    pressTimer.current = setTimeout(() => {
      if (!hasMoved.current && isPressingRef.current) {
        console.log('[HoldToNavigate] Long press completed - opening wheel directly!');
        longPressCompleted.current = true;
        triggerHaptic();
        setIsPressing(false);
        isPressingRef.current = false;
        // Open wheel directly instead of showing menu button
        openNavigationMenu();
      }
    }, settings.longPressDelay);
  }, [enabled, isNavigationMenuOpen, isTouchValid, settings.longPressDelay, openNavigationMenu, triggerHaptic, clearPressTimer]);

  const handleTouchMove = useCallback((event: GestureResponderEvent) => {
    if (!isPressingRef.current) return;

    const { pageX, pageY } = event.nativeEvent;
    const dx = pageX - startPosition.current.x;
    const dy = pageY - startPosition.current.y;

    // Cancel if moved more than 10px
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      hasMoved.current = true;
      setIsPressing(false);
      isPressingRef.current = false;
      clearPressTimer();
    }
  }, [clearPressTimer]);

  const handleTouchEnd = useCallback(() => {
    setIsPressing(false);
    isPressingRef.current = false;
    clearPressTimer();
  }, [clearPressTimer]);

  // Handle navigation from menu
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

  // Convert route name to NavigationDestination - uses reactive currentRouteName
  const activeScreen = useMemo((): NavigationDestination | undefined => {
    console.log('[HoldToNavigate] currentRouteName:', currentRouteName);
    switch (currentRouteName) {
      case 'ChatsTab':
        return 'chats';
      case 'ContactsTab':
        return 'contacts';
      case 'GroupsTab':
        return 'groups';
      case 'SettingsTab':
        return 'settings';
      case 'CallsTab':
        return 'calls';
      case 'VideoCallTab':
        return 'videocall';
      case 'EBookTab':
        return 'ebook';
      case 'AudioBookTab':
        return 'audiobook';
      case 'PodcastTab':
        return 'podcast';
      default:
        return undefined;
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

      {/* Hold indicator (shows during long press) */}
      {isPressing && enabled && (
        <HoldIndicator
          isActive={isPressing}
          duration={settings.longPressDelay}
          x={pressPosition.x}
          y={pressPosition.y}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Navigation wheel overlay - opens directly after long press */}
      <WheelNavigationMenu
        visible={isNavigationMenuOpen}
        onNavigate={handleNavigate}
        onClose={handleCloseMenu}
        activeScreen={activeScreen}
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
