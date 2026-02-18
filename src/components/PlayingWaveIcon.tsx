/**
 * PlayingWaveIcon — Small animated waveform icon for playing items
 *
 * Shows a compact animated waveform to indicate active playback.
 * Used in Radio and Podcast station/episode lists next to the playing item.
 *
 * Design:
 * - 3 animated bars (audio wave effect)
 * - Compact size (fits within list items)
 * - Respects reduced motion preference
 * - Color configurable via accent color
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';

// ============================================================
// Types
// ============================================================

interface PlayingWaveIconProps {
  /**
   * The color of the wave bars.
   * Typically the accent color primary.
   */
  color: string;

  /**
   * Size of the icon container.
   * Default: 24
   */
  size?: number;

  /**
   * Whether playback is active.
   * When false, shows static bars.
   */
  isPlaying?: boolean;
}

// ============================================================
// Component
// ============================================================

export function PlayingWaveIcon({
  color,
  size = 24,
  isPlaying = true,
}: PlayingWaveIconProps) {
  const reducedMotion = useReducedMotion();

  // Animation values for waveform bars
  const bar1Anim = useRef(new Animated.Value(0.4)).current;
  const bar2Anim = useRef(new Animated.Value(0.7)).current;
  const bar3Anim = useRef(new Animated.Value(0.5)).current;

  // Calculate bar dimensions based on size
  const barWidth = Math.max(2, size / 8);
  const maxBarHeight = size * 0.7;
  const gap = Math.max(2, size / 10);

  // Start/stop wave animation based on playing state
  useEffect(() => {
    if (!isPlaying || reducedMotion) {
      // Reset to static positions
      bar1Anim.setValue(0.5);
      bar2Anim.setValue(0.7);
      bar3Anim.setValue(0.5);
      return;
    }

    const createBarAnimation = (animValue: Animated.Value, toValue: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animValue, {
            toValue,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(animValue, {
            toValue: 0.25,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );
    };

    const anim1 = createBarAnimation(bar1Anim, 0.9, 350);
    const anim2 = createBarAnimation(bar2Anim, 1.0, 450);
    const anim3 = createBarAnimation(bar3Anim, 0.85, 400);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [isPlaying, reducedMotion, bar1Anim, bar2Anim, bar3Anim]);

  // For reduced motion or paused: show static bars
  const staticMultiplier = reducedMotion || !isPlaying ? 0.6 : undefined;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.waveContainer, { gap }]}>
        <Animated.View
          style={[
            styles.waveBar,
            {
              backgroundColor: color,
              width: barWidth,
              borderRadius: barWidth / 2,
              height: staticMultiplier !== undefined
                ? maxBarHeight * staticMultiplier
                : bar1Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [maxBarHeight * 0.25, maxBarHeight],
                  }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.waveBar,
            {
              backgroundColor: color,
              width: barWidth,
              borderRadius: barWidth / 2,
              height: staticMultiplier !== undefined
                ? maxBarHeight * (staticMultiplier + 0.15)
                : bar2Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [maxBarHeight * 0.25, maxBarHeight],
                  }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.waveBar,
            {
              backgroundColor: color,
              width: barWidth,
              borderRadius: barWidth / 2,
              height: staticMultiplier !== undefined
                ? maxBarHeight * staticMultiplier
                : bar3Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [maxBarHeight * 0.25, maxBarHeight],
                  }),
            },
          ]}
        />
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveBar: {
    // Dynamic properties set inline
  },
});
