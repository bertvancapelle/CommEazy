/**
 * SeekSlider - Reusable seek/progress slider component
 *
 * Senior-inclusive design:
 * - 60pt touch target height
 * - 28pt thumb size
 * - No jump on initial touch (starts from current position)
 * - Smooth relative movement via gesture delta
 * - Visual feedback with thumb scale animation
 * - Accessibility support with adjustable role
 *
 * IMPORTANT: This component manages seek position INTERNALLY during drag.
 * The `value` prop is only used when NOT actively seeking.
 * This prevents visual jumps caused by async state updates in the parent.
 *
 * @example
 * <SeekSlider
 *   value={progress.position}
 *   duration={progress.duration}
 *   onSeekEnd={(position) => seekTo(position)}
 * />
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { colors, touchTargets } from '../theme';

interface SeekSliderProps {
  /** Current position in seconds (only used when NOT seeking) */
  value: number;
  /** Total duration in seconds */
  duration: number;
  /** Called when user starts seeking */
  onSeekStart?: () => void;
  /** Called during seeking with current position */
  onSeeking?: (position: number) => void;
  /** Called when user finishes seeking with final position */
  onSeekEnd: (position: number) => void;
  /** Accent color for the filled track and thumb (default: colors.primary) */
  accentColor?: string;
  /** Track background color (default: colors.border) */
  trackColor?: string;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Step size for accessibility increment/decrement in seconds (default: 10) */
  accessibilityStep?: number;
  /** Test ID for testing */
  testID?: string;
}

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 6;
const TOUCH_TARGET_HEIGHT = touchTargets.minimum; // 60pt
const THUMB_SCALE_ACTIVE = 1.3;

export function SeekSlider({
  value,
  duration,
  onSeekStart,
  onSeeking,
  onSeekEnd,
  accentColor = colors.primary,
  trackColor = colors.border,
  disabled = false,
  accessibilityLabel,
  accessibilityStep = 10,
  testID,
}: SeekSliderProps) {
  // Track width measured via onLayout
  const trackWidthRef = useRef<number>(280);

  // Animation for thumb scale
  const thumbScale = useRef(new Animated.Value(1)).current;

  // Internal seeking state - managed entirely within this component
  const isSeekingRef = useRef(false);
  const [isSeeking, setIsSeeking] = React.useState(false);
  const [internalSeekPosition, setInternalSeekPosition] = React.useState(0);

  // Start position when seek began (the value at the moment of touch)
  const seekStartValueRef = useRef<number>(0);

  // Refs for callbacks (to avoid stale closures in PanResponder)
  const durationRef = useRef(duration);
  const onSeekStartRef = useRef(onSeekStart);
  const onSeekingRef = useRef(onSeeking);
  const onSeekEndRef = useRef(onSeekEnd);
  const valueRef = useRef(value);

  // Keep refs updated
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    onSeekStartRef.current = onSeekStart;
    onSeekingRef.current = onSeeking;
    onSeekEndRef.current = onSeekEnd;
  }, [onSeekStart, onSeeking, onSeekEnd]);

  const triggerHaptic = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  }, []);

  // Animate thumb scale
  const animateThumbScale = useCallback(
    (toValue: number) => {
      Animated.spring(thumbScale, {
        toValue,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }).start();
    },
    [thumbScale],
  );

  // PanResponder for drag handling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,

      onPanResponderGrant: () => {
        // Capture the current value at the EXACT moment of touch
        // This is the position we start from - NO jumping
        const startValue = valueRef.current;
        seekStartValueRef.current = startValue;

        // Set internal seeking state BEFORE notifying parent
        // This ensures we display the correct position immediately
        isSeekingRef.current = true;
        setIsSeeking(true);
        setInternalSeekPosition(startValue);

        // Visual feedback
        animateThumbScale(THUMB_SCALE_ACTIVE);
        triggerHaptic();

        // Notify parent (this may cause async state updates, but we ignore them)
        onSeekStartRef.current?.();
      },

      onPanResponderMove: (_evt, gestureState) => {
        if (!isSeekingRef.current) return;

        const trackWidth = trackWidthRef.current;
        const dur = durationRef.current || 1;

        // Calculate position change based on horizontal drag distance from start
        const deltaSeconds = (gestureState.dx / trackWidth) * dur;
        const newPosition = Math.max(
          0,
          Math.min(dur, seekStartValueRef.current + deltaSeconds),
        );

        // Update internal state
        setInternalSeekPosition(newPosition);

        // Notify parent of seeking position (for time display updates)
        onSeekingRef.current?.(newPosition);
      },

      onPanResponderRelease: (_evt, gestureState) => {
        if (!isSeekingRef.current) return;

        // Reset thumb scale
        animateThumbScale(1);

        // Calculate final position
        const trackWidth = trackWidthRef.current;
        const dur = durationRef.current || 1;
        const deltaSeconds = (gestureState.dx / trackWidth) * dur;
        const finalPosition = Math.max(
          0,
          Math.min(dur, seekStartValueRef.current + deltaSeconds),
        );

        // Clear seeking state
        isSeekingRef.current = false;
        setIsSeeking(false);

        // Commit the final position to parent
        onSeekEndRef.current(finalPosition);

        triggerHaptic();
      },

      onPanResponderTerminate: () => {
        // Cancelled - reset without committing
        animateThumbScale(1);
        isSeekingRef.current = false;
        setIsSeeking(false);
      },
    }),
  ).current;

  // Calculate display position:
  // - During seeking: use internal seek position (ignores parent value)
  // - Not seeking: use the value prop from parent
  const displayPosition = isSeeking ? internalSeekPosition : value;
  const safeDuration = duration || 1;
  const percentage = Math.max(0, Math.min(1, displayPosition / safeDuration));

  // Accessibility actions
  const handleAccessibilityAction = useCallback(
    (event: { nativeEvent: { actionName: string } }) => {
      const { actionName } = event.nativeEvent;
      const currentValue = valueRef.current;
      const dur = durationRef.current || 1;

      let newPosition = currentValue;
      if (actionName === 'increment') {
        newPosition = Math.min(dur, currentValue + accessibilityStep);
      } else if (actionName === 'decrement') {
        newPosition = Math.max(0, currentValue - accessibilityStep);
      }

      if (newPosition !== currentValue) {
        triggerHaptic();
        onSeekEnd(newPosition);
        AccessibilityInfo.announceForAccessibility(
          `${Math.floor(newPosition / 60)}:${String(Math.floor(newPosition % 60)).padStart(2, '0')}`,
        );
      }
    },
    [accessibilityStep, onSeekEnd, triggerHaptic],
  );

  return (
    <View
      testID={testID}
      style={styles.container}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={
        accessibilityLabel || `Seek slider at ${Math.round(percentage * 100)}%`
      }
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(percentage * 100),
      }}
      accessibilityActions={[
        { name: 'increment', label: `Forward ${accessibilityStep} seconds` },
        { name: 'decrement', label: `Back ${accessibilityStep} seconds` },
      ]}
      onAccessibilityAction={handleAccessibilityAction}
      {...panResponder.panHandlers}
      onLayout={(event) => {
        trackWidthRef.current = event.nativeEvent.layout.width;
      }}
    >
      {/* Track background */}
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        {/* Filled portion */}
        <View
          style={[
            styles.trackFilled,
            {
              backgroundColor: disabled ? colors.textSecondary : accentColor,
              width: `${percentage * 100}%`,
            },
          ]}
        />
      </View>

      {/* Thumb */}
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: disabled ? colors.textSecondary : accentColor,
            left: `${percentage * 100}%`,
            transform: [
              { translateX: -THUMB_SIZE / 2 },
              { scale: thumbScale },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: TOUCH_TARGET_HEIGHT,
    justifyContent: 'center',
    width: '100%',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  trackFilled: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    top: (TOUCH_TARGET_HEIGHT - THUMB_SIZE) / 2,
    // Shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});

export default SeekSlider;
