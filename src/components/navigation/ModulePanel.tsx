/**
 * ModulePanel — Panel wrapper for iPad Split View
 *
 * Wraps a module component with:
 * - Long-press gesture for opening module picker
 * - Two-finger long-press for panel-scoped voice commands
 * - Panel identification for context
 * - Stack Navigator for modules that need sub-navigation
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  type GestureResponderEvent,
} from 'react-native';

import { useSplitViewContext, type PanelId } from '@/contexts/SplitViewContext';
import { useHoldGestureContext } from '@/contexts/HoldGestureContext';
import { PanelNavigator } from './PanelNavigator';
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
  /** Panel identifier */
  panelId: PanelId;
  /** Module to display */
  moduleId: NavigationDestination;
}

// ============================================================
// Component
// ============================================================

export function ModulePanel({ panelId, moduleId }: ModulePanelProps) {
  const { openModulePicker, setActiveVoicePanel } = useSplitViewContext();
  const holdGesture = useHoldGestureContext();

  // Touch tracking refs
  const touchCountRef = useRef(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const twoFingerTimerRef = useRef<NodeJS.Timeout | null>(null);

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

      clearTimers();

      if (touchCount === 1) {
        // Single finger: start long-press timer for module picker
        longPressTimerRef.current = setTimeout(() => {
          // Consume gesture to prevent underlying elements from firing
          holdGesture?.consumeGesture();
          openModulePicker(panelId);
        }, LONG_PRESS_DURATION);
      } else if (touchCount === 2) {
        // Two fingers: start timer for voice commands
        twoFingerTimerRef.current = setTimeout(() => {
          holdGesture?.consumeGesture();
          setActiveVoicePanel(panelId);
          // TODO: Trigger voice commands for this panel
          console.log(`[ModulePanel] Voice activated for ${panelId} panel`);
        }, TWO_FINGER_LONG_PRESS_DURATION);
      }
    },
    [panelId, openModulePicker, setActiveVoicePanel, holdGesture, clearTimers]
  );

  const handleTouchMove = useCallback(() => {
    // Any movement cancels the long-press
    clearTimers();
  }, [clearTimers]);

  const handleTouchEnd = useCallback(() => {
    touchCountRef.current = 0;
    clearTimers();
  }, [clearTimers]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <View
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <PanelNavigator panelId={panelId} moduleId={moduleId} />
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
