/**
 * ScrollMoreIndicator — Bouncing arrow indicating scrollable content below
 *
 * Shows a 48pt circular button with a chevron-down icon that bounces
 * to indicate more content is available. Tapping scrolls down by ~80%
 * of the viewport height.
 *
 * Features:
 * - Bouncing animation (respects Reduced Motion)
 * - Dynamic bottom offset (sits above MiniPlayer when active)
 * - Fades in/out on visibility change
 * - VoiceOver accessible with i18n label
 *
 * @example
 * const { scrollRef, hasOverflow, isAtBottom, scrollDownByViewport, ...scrollProps } = useScrollOverflow();
 *
 * <View style={{ flex: 1 }}>
 *   <ScrollView ref={scrollRef} {...scrollProps} scrollEventThrottle={16}>
 *     {content}
 *   </ScrollView>
 *   <ScrollMoreIndicator
 *     visible={hasOverflow && !isAtBottom}
 *     onPress={scrollDownByViewport}
 *   />
 * </View>
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { HapticTouchable } from './HapticTouchable';
import { Icon } from './Icon';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useActivePlayback } from '@/hooks/useActivePlayback';
import { spacing, zIndex } from '@/theme';

interface ScrollMoreIndicatorProps {
  /** Whether the indicator should be visible */
  visible: boolean;
  /** Callback when the indicator is tapped */
  onPress: () => void;
  /** Additional bottom offset (e.g. for tab bars) */
  extraBottomOffset?: number;
}

/** Height of the MiniPlayer bar when active */
const MINI_PLAYER_HEIGHT = 72;

/** Size of the indicator button */
const INDICATOR_SIZE = 48;

/** Bounce amplitude in points */
const BOUNCE_AMPLITUDE = 8;

/** Bounce cycle duration in ms */
const BOUNCE_DURATION = 1200;

export function ScrollMoreIndicator({
  visible,
  onPress,
  extraBottomOffset = 0,
}: ScrollMoreIndicatorProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const activePlayback = useActivePlayback();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const bounceRef = useRef<Animated.CompositeAnimation | null>(null);

  // Determine bottom offset: above MiniPlayer if active
  const miniPlayerOffset = activePlayback ? MINI_PLAYER_HEIGHT + spacing.sm : 0;
  const bottomOffset = spacing.md + miniPlayerOffset + extraBottomOffset;

  // Fade in/out
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : 200,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim, reduceMotion]);

  // Bounce animation (only when visible and motion allowed)
  useEffect(() => {
    if (visible && !reduceMotion) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: 1,
            duration: BOUNCE_DURATION / 2,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: BOUNCE_DURATION / 2,
            useNativeDriver: true,
          }),
        ]),
      );
      bounceRef.current = animation;
      animation.start();
    } else {
      bounceRef.current?.stop();
      bounceAnim.setValue(0);
    }

    return () => {
      bounceRef.current?.stop();
    };
  }, [visible, reduceMotion, bounceAnim]);

  const translateY = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -BOUNCE_AMPLITUDE],
  });

  // Don't render at all when fully faded out (avoid phantom touch targets)
  if (!visible && fadeAnim.__getValue() === 0) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      <HapticTouchable
        onPress={onPress}
        hapticType="tap"
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('common.scrollForMore')}
        style={styles.button}
      >
        <Icon name="chevron-down" size={24} color="#FFFFFF" />
      </HapticTouchable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: spacing.md,
    zIndex: zIndex.above,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  button: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
