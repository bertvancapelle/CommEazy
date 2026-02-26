/**
 * ModulePanel — Panel wrapper for pane-based layout
 *
 * Wraps a module component with:
 * - Long-press gesture for opening WheelNavigationMenu (consistent UX)
 * - Two-finger long-press for panel-scoped voice commands
 * - Pane identification for context
 * - Stack Navigator for modules that need sub-navigation
 *
 * Used by both iPhone (SinglePaneLayout) and iPad (SplitViewLayout).
 *
 * UX CONSISTENCY PRINCIPLE:
 * Long-press MUST behave the same on iPhone and iPad.
 * Both show the circular WheelNavigationMenu.
 *
 * @see .claude/plans/sunny-yawning-sunset.md
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Vibration,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { usePaneContext } from '@/contexts/PaneContext';
import { PanelIdProvider, type PaneId } from '@/contexts/PanelIdContext';
import { useHoldGestureContext } from '@/contexts/HoldGestureContext';
import { useWheelMenuContext } from '@/contexts/WheelMenuContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { PanelNavigator } from './PanelNavigator';
import { HoldIndicator } from '@/components/HoldIndicator';
import type { NavigationDestination } from '@/types/navigation';
import { colors } from '@/theme';

// ============================================================
// Constants
// ============================================================

/** Long-press duration in milliseconds */
const LONG_PRESS_DURATION = 800;

/** Two-finger long-press duration for voice commands */
const TWO_FINGER_LONG_PRESS_DURATION = 1000;

// ============================================================
// Types
// ============================================================

export interface ModulePanelProps {
  /** Pane identifier */
  panelId: PaneId;
  /** Module to display */
  moduleId: NavigationDestination;
}

// ============================================================
// Component
// ============================================================

export function ModulePanel({ panelId, moduleId }: ModulePanelProps) {
  const { setActiveVoicePane } = usePaneContext();
  const holdGesture = useHoldGestureContext();
  const wheelMenu = useWheelMenuContext();
  const reducedMotion = useReducedMotion();

  // Touch tracking refs
  const touchCountRef = useRef(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const twoFingerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // HoldIndicator state
  const [isHolding, setIsHolding] = useState(false);
  const [holdPosition, setHoldPosition] = useState({ x: 0, y: 0 });

  // Track container's screen position for coordinate conversion
  // pageX/pageY are absolute screen coordinates, but HoldIndicator is rendered
  // inside the ModulePanel, so we need to convert to local coordinates
  const containerOffset = useRef({ x: 0, y: 0 });

  // Track container position on layout
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { target } = event.nativeEvent;
    if (target) {
      // Use measure() to get absolute screen position
      const viewRef = event.target as any;
      if (viewRef && typeof viewRef.measure === 'function') {
        viewRef.measure((
          _x: number,
          _y: number,
          _width: number,
          _height: number,
          screenX: number,
          screenY: number
        ) => {
          containerOffset.current = { x: screenX, y: screenY };
          console.log('[ModulePanel] Container offset updated:', { x: screenX, y: screenY });
        });
      }
    }
  }, []);

  // ============================================================
  // Haptic Feedback
  // ============================================================

  const triggerHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Vibration.vibrate(5);
    } else {
      Vibration.vibrate(10);
    }
  }, []);

  // ============================================================
  // WheelNavigationMenu Handler
  // ============================================================

  const openWheelMenu = useCallback(() => {
    triggerHaptic();
    // Open menu via context — renders at root level for full-screen overlay
    wheelMenu.openMenu(panelId, moduleId);
  }, [triggerHaptic, wheelMenu, panelId, moduleId]);

  // ============================================================
  // Gesture Handlers
  // ============================================================

  const clearTimers = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (twoFingerTimerRef.current) {
      clearTimeout(twoFingerTimerRef.current);
      twoFingerTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      const touchCount = event.nativeEvent.touches.length;
      touchCountRef.current = touchCount;

      console.log('[ModulePanel] handleTouchStart', { touchCount, panelId });

      clearTimers();

      if (touchCount === 1) {
        // Capture touch position for HoldIndicator
        // Convert absolute screen coordinates to local coordinates
        const { pageX, pageY } = event.nativeEvent;
        const localX = pageX - containerOffset.current.x;
        const localY = pageY - containerOffset.current.y;
        console.log('[ModulePanel] Single finger touch, starting hold indicator', {
          pageX, pageY,
          offset: containerOffset.current,
          local: { x: localX, y: localY },
        });
        setHoldPosition({ x: localX, y: localY });
        setIsHolding(true);

        // Single finger: start long-press timer for WheelNavigationMenu
        // UX CONSISTENCY: Same behavior as iPhone — opens wheel menu, not list modal
        longPressTimerRef.current = setTimeout(() => {
          console.log('[ModulePanel] Long press timer completed, opening menu');
          // Consume gesture to prevent underlying elements from firing
          holdGesture?.consumeGesture();
          setIsHolding(false);
          openWheelMenu();
        }, LONG_PRESS_DURATION);
      } else if (touchCount === 2) {
        // Two fingers: cancel single-finger hold indicator
        setIsHolding(false);

        // Two fingers: start timer for voice commands
        twoFingerTimerRef.current = setTimeout(() => {
          holdGesture?.consumeGesture();
          setActiveVoicePane(panelId);
          // TODO: Trigger voice commands for this panel
          console.log(`[ModulePanel] Voice activated for ${panelId} panel`);
        }, TWO_FINGER_LONG_PRESS_DURATION);
      }
    },
    [panelId, openWheelMenu, setActiveVoicePane, holdGesture, clearTimers]
  );

  const handleTouchMove = useCallback(() => {
    // Any movement cancels the long-press (only log first cancellation)
    if (longPressTimerRef.current || twoFingerTimerRef.current) {
      console.log('[ModulePanel] handleTouchMove - cancelling hold');
    }
    setIsHolding(false);
    clearTimers();
  }, [clearTimers]);

  const handleTouchEnd = useCallback(() => {
    console.log('[ModulePanel] handleTouchEnd');
    touchCountRef.current = 0;
    setIsHolding(false);
    clearTimers();
  }, [clearTimers]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <View
      style={styles.container}
      onLayout={handleLayout}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <PanelIdProvider value={panelId}>
        <PanelNavigator panelId={panelId} moduleId={moduleId} />

        {/* HoldIndicator shows animated ring during long press */}
        <HoldIndicator
          isActive={isHolding}
          duration={LONG_PRESS_DURATION}
          x={holdPosition.x}
          y={holdPosition.y}
          reducedMotion={reducedMotion}
        />
      </PanelIdProvider>

      {/* WheelNavigationMenu is rendered at root level via WheelMenuContext
          for full-screen overlay on iPad Split View */}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default ModulePanel;
