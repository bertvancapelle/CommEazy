/**
 * HomeGridItem — Single module icon for the HomeScreen grid
 *
 * Displays a module icon in a colored circle with label below.
 * Supports notification badges, audio activity indicator,
 * and wiggle mode for drag & drop reordering.
 *
 * Senior-inclusive design:
 * - Touch target ≥96×96pt (whole cell is tappable)
 * - Label: 14pt, max 2 lines, center-aligned
 * - Icon: 48pt in 72pt colored circle
 * - Badge: min 22pt, bold white text on red
 *
 * @see src/screens/HomeScreen.tsx
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  spacing,
  touchTargets,
  borderRadius,
  colors,
} from '@/theme';

// ============================================================
// Types
// ============================================================

export interface HomeGridItemProps {
  /** Module identifier */
  moduleId: string;
  /** Icon name from the Icon component */
  icon: IconName;
  /** Translated module label */
  label: string;
  /** Module tint color (hex) */
  color: string;
  /** Badge count (only shown when > 0) */
  badgeCount?: number;
  /** Whether this module is currently playing audio */
  isAudioActive?: boolean;
  /** Whether wiggle mode is active (drag & drop) */
  isWiggling?: boolean;
  /** Whether this item is selected for swap in wiggle mode */
  isSelected?: boolean;
  /** Whether this item is currently being dragged (placeholder in grid) */
  isDragging?: boolean;
  /** Whether this cell is the current drop target during drag */
  isDropTarget?: boolean;
  /** Tap handler */
  onPress: () => void;
  /** Long press handler (activates wiggle mode) */
  onLongPress?: () => void;
}

// ============================================================
// Constants
// ============================================================

const GRID_COLUMNS = 3;
const GRID_GAP = 12;
const GRID_PADDING_H = spacing.md; // 16pt
const SCREEN_WIDTH = Dimensions.get('window').width;

/** Width of each grid cell */
export const GRID_CELL_WIDTH =
  (SCREEN_WIDTH - 2 * GRID_PADDING_H - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS;

const ICON_CIRCLE_SIZE = 72;
const ICON_SIZE = 48;
const BADGE_MIN_SIZE = 22;
const BADGE_FONT_SIZE = 12;
const LABEL_FONT_SIZE = 14;
const AUDIO_RING_SIZE = ICON_CIRCLE_SIZE + 8; // 80pt

// ============================================================
// Component
// ============================================================

export function HomeGridItem({
  moduleId,
  icon,
  label,
  color,
  badgeCount,
  isAudioActive = false,
  isWiggling = false,
  isSelected = false,
  isDragging = false,
  isDropTarget = false,
  onPress,
  onLongPress,
}: HomeGridItemProps) {
  const reduceMotion = useReducedMotion();

  // Wiggle animation
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isWiggling && !reduceMotion) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(wiggleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: -1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      wiggleAnim.setValue(0);
    }
  }, [isWiggling, reduceMotion, wiggleAnim]);

  const wiggleRotation = wiggleAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-2deg', '2deg'],
  });

  // Audio pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAudioActive && !reduceMotion) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isAudioActive, reduceMotion, pulseAnim]);

  const showBadge = badgeCount !== undefined && badgeCount > 0;
  const badgeText = badgeCount !== undefined && badgeCount > 99 ? '99+' : String(badgeCount ?? 0);

  return (
    <Animated.View
      style={[
        styles.container,
        isWiggling && !reduceMotion
          ? { transform: [{ rotate: wiggleRotation }] }
          : undefined,
        isWiggling && reduceMotion
          ? styles.wiggleReducedMotion
          : undefined,
        isSelected && styles.selectedContainer,
        isDropTarget && styles.dropTargetContainer,
      ]}
    >
      {/* In wiggle mode: plain View so grid PanResponder can capture touches.
          Normal mode: HapticTouchable for tap/long-press. */}
      {isWiggling ? (
        <View style={styles.touchable} pointerEvents="none">
          <View style={styles.iconWrapper}>
            <View style={[styles.iconCircle, { backgroundColor: color }]}>
              <Icon name={icon} size={ICON_SIZE} color="#FFFFFF" />
            </View>
            {showBadge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeText}</Text>
              </View>
            )}
          </View>
          <Text
            style={styles.label}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {label}
          </Text>
        </View>
      ) : (
        <HapticTouchable
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={800}
          hapticType="tap"
          style={styles.touchable}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={
            showBadge
              ? `${badgeCount} ${badgeCount === 1 ? 'melding' : 'meldingen'}`
              : undefined
          }
        >
          <View style={styles.iconWrapper}>
            {isAudioActive && (
              <Animated.View
                style={[
                  styles.audioRing,
                  {
                    borderColor: color,
                    transform: [{ scale: reduceMotion ? 1 : pulseAnim }],
                  },
                ]}
              />
            )}
            <View style={[styles.iconCircle, { backgroundColor: color }]}>
              <Icon name={icon} size={ICON_SIZE} color="#FFFFFF" />
            </View>
            {showBadge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeText}</Text>
              </View>
            )}
          </View>
          <Text
            style={styles.label}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {label}
          </Text>
        </HapticTouchable>
      )}
    </Animated.View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    width: GRID_CELL_WIDTH,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  touchable: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 96,
    width: '100%',
    paddingVertical: spacing.sm,
  },
  iconWrapper: {
    width: AUDIO_RING_SIZE,
    height: AUDIO_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  audioRing: {
    position: 'absolute',
    width: AUDIO_RING_SIZE,
    height: AUDIO_RING_SIZE,
    borderRadius: AUDIO_RING_SIZE / 2,
    borderWidth: 3,
  },
  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: ICON_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: BADGE_MIN_SIZE,
    height: BADGE_MIN_SIZE,
    borderRadius: BADGE_MIN_SIZE / 2,
    backgroundColor: '#B71C1C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: BADGE_FONT_SIZE,
    fontWeight: '700',
    textAlign: 'center',
  },
  label: {
    fontSize: LABEL_FONT_SIZE,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: GRID_CELL_WIDTH - 8,
  },
  wiggleReducedMotion: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    borderStyle: 'dashed',
  },
  selectedContainer: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  dropTargetContainer: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    borderStyle: 'dashed',
  },
});
