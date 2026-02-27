/**
 * DraggableDivider — Resizable panel divider for iPad Split View
 *
 * Allows users to drag to resize the left/right panel ratio.
 * Includes visual feedback and accessibility support.
 * Supports collapsing panels completely (ratio 0.0 or 1.0).
 *
 * Design considerations:
 * - Touch target: 44pt wide (invisible, centered on 1pt visual divider)
 * - Visual feedback: Divider highlights during drag
 * - Haptic feedback on drag start
 * - Min/max constraints: 25% to 75% when expanded
 * - Snap to collapsed: When dragged below MIN_RATIO + 60px threshold
 * - Senior-inclusive: Clear visual indicator with arrow when collapsed
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 * @see .claude/plans/COLLAPSIBLE_PANES_IPAD.md
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
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

/** Minimum panel ratio when expanded (25% of screen) */
const MIN_RATIO = 0.25;

/** Maximum panel ratio when expanded (75% of screen) */
const MAX_RATIO = 0.75;

/** Extra pixels below MIN_RATIO before snap to collapsed */
const SNAP_THRESHOLD_PX = 60;

/** Touch target width (invisible hit area) */
const TOUCH_TARGET_WIDTH = 44;

/** Touch target width when collapsed (wider for easier grabbing) */
const TOUCH_TARGET_WIDTH_COLLAPSED = 60;

/** Visual divider width */
const DIVIDER_WIDTH = 4;

/** Visual divider width when dragging */
const DIVIDER_WIDTH_ACTIVE = 6;

/** Handle width when expanded (3 dots) */
const HANDLE_WIDTH_NORMAL = 24;

/** Handle width when collapsed (3 dots + arrow) — must fit: padding(20) + arrow(20) + gap(8) + dots(10) = 58pt minimum */
const HANDLE_WIDTH_COLLAPSED = 64;

/** Drag dampening factor (0.5 = half speed, 1.0 = full speed) */
const DRAG_DAMPENING = 0.6;

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

  // Collapsed state detection
  const isLeftCollapsed = ratio === 0;
  const isRightCollapsed = ratio === 1;
  const isCollapsed = isLeftCollapsed || isRightCollapsed;

  // Refs for values needed in PanResponder (to avoid stale closures)
  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;

  const screenWidthRef = useRef(screenWidth);
  screenWidthRef.current = screenWidth;

  // Calculate snap threshold in ratio units
  const snapThreshold = useMemo(() => {
    return SNAP_THRESHOLD_PX / screenWidth;
  }, [screenWidth]);
  const snapThresholdRef = useRef(snapThreshold);
  snapThresholdRef.current = snapThreshold;

  // Last non-collapsed ratio for restoration (stored in PaneContext)
  const lastExpandedRatioRef = useRef(ratio > 0 && ratio < 1 ? ratio : 0.33);

  // Track if we've already triggered threshold haptic (to avoid repeated triggers)
  const hasTriggeredThresholdHapticRef = useRef(false);
  const lastRatioRef = useRef(ratio);

  // Ref for onRatioChange to avoid stale closure
  const onRatioChangeRef = useRef(onRatioChange);
  onRatioChangeRef.current = onRatioChange;

  // Animation for visual feedback
  const dividerScale = useRef(new Animated.Value(1)).current;
  const dividerOpacity = useRef(new Animated.Value(0.5)).current;

  // ============================================================
  // Haptic Feedback
  // ============================================================

  const triggerHaptic = useCallback((type: 'start' | 'move' | 'end' | 'threshold') => {
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
      } else if (type === 'threshold') {
        // Strong haptic when crossing the 25% snap threshold
        ReactNativeHapticFeedback.trigger('impactHeavy', {
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
        // Use ref to get current ratio (avoid stale closure)
        startRatioRef.current = ratioRef.current;
        startXRef.current = gestureState.x0;
        hasTriggeredThresholdHapticRef.current = false; // Reset threshold haptic flag
        lastRatioRef.current = ratioRef.current; // Initialize lastRatio for threshold detection
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
        // Use refs to get current values (avoid stale closures)
        const currentScreenWidth = screenWidthRef.current;
        const currentSnapThreshold = snapThresholdRef.current;

        const deltaX = gestureState.moveX - startXRef.current;
        // Apply dampening for smoother, more controllable drag
        const deltaRatio = (deltaX / currentScreenWidth) * DRAG_DAMPENING;
        let newRatio = startRatioRef.current + deltaRatio;

        const previousRatio = lastRatioRef.current;

        // Snap logic: if below snap threshold, collapse completely
        if (newRatio < MIN_RATIO - currentSnapThreshold) {
          // Snap left pane collapsed (ratio = 0)
          newRatio = 0;
        } else if (newRatio > MAX_RATIO + currentSnapThreshold) {
          // Snap right pane collapsed (ratio = 1)
          newRatio = 1;
        } else {
          // Normal expanded state: clamp to min/max
          newRatio = Math.max(MIN_RATIO, Math.min(MAX_RATIO, newRatio));
          // Store last expanded ratio for restoration
          lastExpandedRatioRef.current = newRatio;
        }

        // Trigger haptic when crossing the MIN_RATIO or MAX_RATIO threshold
        // Only trigger once per drag gesture
        if (!hasTriggeredThresholdHapticRef.current) {
          const crossedMinThreshold =
            (previousRatio >= MIN_RATIO && newRatio < MIN_RATIO) ||
            (previousRatio < MIN_RATIO && newRatio >= MIN_RATIO);
          const crossedMaxThreshold =
            (previousRatio <= MAX_RATIO && newRatio > MAX_RATIO) ||
            (previousRatio > MAX_RATIO && newRatio <= MAX_RATIO);

          if (crossedMinThreshold || crossedMaxThreshold) {
            triggerHaptic('threshold');
            hasTriggeredThresholdHapticRef.current = true;
          }
        }

        lastRatioRef.current = newRatio;
        onRatioChangeRef.current(newRatio);
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

  // Determine handle width based on collapsed state
  const handleWidth = isCollapsed ? HANDLE_WIDTH_COLLAPSED : HANDLE_WIDTH_NORMAL;
  const touchTargetWidth = isCollapsed ? TOUCH_TARGET_WIDTH_COLLAPSED : TOUCH_TARGET_WIDTH;

  // Accessibility label based on state
  const accessibilityLabel = isLeftCollapsed
    ? 'Panel divider - left panel hidden'
    : isRightCollapsed
    ? 'Panel divider - right panel hidden'
    : 'Panel divider';

  const accessibilityHint = isCollapsed
    ? 'Drag to restore hidden panel'
    : 'Drag to resize panels';

  return (
    <View
      style={[
        styles.touchTarget,
        {
          width: touchTargetWidth,
          marginLeft: -(touchTargetWidth - DIVIDER_WIDTH) / 2,
          marginRight: -(touchTargetWidth - DIVIDER_WIDTH) / 2,
        },
      ]}
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
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

      {/* Drag handle indicator */}
      <View
        style={[
          styles.handleContainer,
          {
            // Simplified positioning: left is relative to touchTarget's left edge
            // - Normal: center the handle on the divider
            // - Left collapsed: handle starts at touchTarget's left edge (left: 0)
            // - Right collapsed: handle ends at touchTarget's right edge
            left: isLeftCollapsed
              ? 0  // Handle starts at left edge of touchTarget
              : isRightCollapsed
                ? touchTargetWidth - handleWidth  // Handle ends at right edge of touchTarget
                : (touchTargetWidth - handleWidth) / 2,  // Centered
          },
        ]}
      >
        <View
          style={[
            styles.handle,
            {
              width: handleWidth,
              // Use accent color when collapsed or dragging, otherwise subtle/transparent
              backgroundColor: (isCollapsed || isDragging) ? leftModuleColor : 'rgba(128, 128, 128, 0.4)',
            },
          ]}
        >
          {/* Left arrow when right pane is collapsed (ratio = 1) */}
          {isRightCollapsed && (
            <Text style={styles.arrowText}>◀</Text>
          )}

          {/* Three dots as View components - original styling */}
          <View style={styles.dotsContainer}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          {/* Right arrow when left pane is collapsed (ratio = 0) */}
          {isLeftCollapsed && (
            <Text style={styles.arrowText}>▶</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  touchTarget: {
    // width is set dynamically based on collapsed state
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    // Ensure divider + handle render above both panels (right panel was covering the handle)
    zIndex: 10,
    overflow: 'visible',
  },
  divider: {
    height: '100%',
    backgroundColor: colors.divider,
    borderRadius: 2,
  },
  handleContainer: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    overflow: 'visible',
    // left is set dynamically based on collapsed state
  },
  handle: {
    // width is set dynamically based on collapsed state
    height: 44,
    backgroundColor: colors.surface,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  dotsContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
  arrowText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
    flexShrink: 0,
  },
});

export default DraggableDivider;
