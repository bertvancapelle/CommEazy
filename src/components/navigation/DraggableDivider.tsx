/**
 * DraggableDivider — Resizable panel divider for iPad Split View
 *
 * Allows users to drag to resize the left/right panel ratio.
 * Includes visual feedback and accessibility support.
 *
 * Design considerations:
 * - Touch target: 44pt wide (invisible, centered on 1pt visual divider)
 * - Visual feedback: Divider highlights during drag
 * - Haptic feedback on drag start
 * - Min/max constraints: 25% to 75% of screen width
 * - Senior-inclusive: Clear visual indicator, not subtle
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { usePaneContext } from '@/contexts/PaneContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { colors } from '@/theme';

// ============================================================
// Constants
// ============================================================

/** Minimum panel ratio (25% of screen) */
const MIN_RATIO = 0.25;

/** Maximum panel ratio (75% of screen) */
const MAX_RATIO = 0.75;

/** Touch target width (invisible hit area) */
const TOUCH_TARGET_WIDTH = 44;

/** Visual divider width */
const DIVIDER_WIDTH = 4;

/** Visual divider width when dragging */
const DIVIDER_WIDTH_ACTIVE = 6;

// ============================================================
// Types
// ============================================================

export interface DraggableDividerProps {
  /** Current panel ratio (0-1) */
  ratio: number;
  /** Called when ratio changes */
  onRatioChange: (ratio: number) => void;
}

// ============================================================
// Component
// ============================================================

export function DraggableDivider({ ratio, onRatioChange }: DraggableDividerProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { panes } = usePaneContext();
  const leftPanel = panes.left!;
  const leftModuleColor = useModuleColor(leftPanel?.moduleId as any);
  const [isDragging, setIsDragging] = useState(false);
  const startRatioRef = useRef(ratio);
  const startXRef = useRef(0);

  // Animation for visual feedback
  const dividerScale = useRef(new Animated.Value(1)).current;
  const dividerOpacity = useRef(new Animated.Value(0.5)).current;

  // ============================================================
  // Haptic Feedback
  // ============================================================

  const triggerHaptic = useCallback((type: 'start' | 'move' | 'end') => {
    if (Platform.OS === 'ios') {
      if (type === 'start') {
        ReactNativeHapticFeedback.trigger('impactMedium', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      } else if (type === 'end') {
        ReactNativeHapticFeedback.trigger('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
    }
  }, []);

  // ============================================================
  // Pan Responder
  // ============================================================

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (_, gestureState) => {
        startRatioRef.current = ratio;
        startXRef.current = gestureState.x0;
        setIsDragging(true);
        triggerHaptic('start');

        // Animate divider to active state
        Animated.parallel([
          Animated.spring(dividerScale, {
            toValue: 1.5,
            useNativeDriver: true,
          }),
          Animated.timing(dividerOpacity, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
      },

      onPanResponderMove: (_, gestureState) => {
        // Calculate new ratio based on drag distance
        const deltaX = gestureState.moveX - startXRef.current;
        const deltaRatio = deltaX / screenWidth;
        let newRatio = startRatioRef.current + deltaRatio;

        // Clamp to min/max
        newRatio = Math.max(MIN_RATIO, Math.min(MAX_RATIO, newRatio));

        onRatioChange(newRatio);
      },

      onPanResponderRelease: () => {
        setIsDragging(false);
        triggerHaptic('end');

        // Animate divider back to normal state
        Animated.parallel([
          Animated.spring(dividerScale, {
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(dividerOpacity, {
            toValue: 0.5,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      },

      onPanResponderTerminate: () => {
        setIsDragging(false);

        // Animate divider back to normal state
        Animated.parallel([
          Animated.spring(dividerScale, {
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(dividerOpacity, {
            toValue: 0.5,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      },
    })
  ).current;

  // ============================================================
  // Render
  // ============================================================

  return (
    <View
      style={styles.touchTarget}
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel="Panel divider"
      accessibilityHint="Drag to resize panels"
    >
      {/* Visual divider */}
      <Animated.View
        style={[
          styles.divider,
          {
            width: isDragging ? DIVIDER_WIDTH_ACTIVE : DIVIDER_WIDTH,
            opacity: dividerOpacity,
            transform: [{ scaleX: dividerScale }],
          },
        ]}
      />

      {/* Drag handle indicator (three dots) */}
      <View style={styles.handleContainer}>
        <Animated.View
          style={[
            styles.handle,
            {
              backgroundColor: leftModuleColor,
              opacity: dividerOpacity,
            },
          ]}
        >
          <View style={styles.handleDot} />
          <View style={styles.handleDot} />
          <View style={styles.handleDot} />
        </Animated.View>
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  touchTarget: {
    width: TOUCH_TARGET_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    // Center the visual divider within touch target
    marginLeft: -(TOUCH_TARGET_WIDTH - DIVIDER_WIDTH) / 2,
    marginRight: -(TOUCH_TARGET_WIDTH - DIVIDER_WIDTH) / 2,
    // Ensure divider + handle render above both panels (right panel was covering the handle)
    zIndex: 1,
  },
  divider: {
    height: '100%',
    backgroundColor: colors.divider,
    borderRadius: 2,
  },
  handleContainer: {
    position: 'absolute',
    top: '50%',
    marginTop: -30,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handle: {
    width: 20,
    height: 40,
    backgroundColor: colors.surface,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  handleDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginVertical: 2,
  },
});

export default DraggableDivider;
