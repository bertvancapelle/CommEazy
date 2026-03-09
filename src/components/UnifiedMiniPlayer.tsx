/**
 * UnifiedMiniPlayer — Unified compact audio player bar
 *
 * Generic component with NO context knowledge.
 * All data and callbacks provided via props by the caller.
 *
 * Features:
 * - Liquid Glass (iOS 26+) with module tint color
 * - Swipe-to-dismiss (audio continues, player hidden)
 * - Progress: bar (seekable) or duration (live stream)
 * - Play/Pause + Stop controls
 * - Senior-inclusive: 72pt height, 60pt touch targets
 * - Button border styling via ButtonStyleContext
 * - Haptic feedback on all interactions
 * - VoiceOver accessibility labels
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  PanResponder,
  StyleSheet,
  Platform,
  AccessibilityInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { HapticTouchable } from './HapticTouchable';
import { Icon } from './Icon';
import { LiquidGlassView } from './LiquidGlassView';
import {
  colors,
  typography,
  spacing,
  touchTargets,
  borderRadius,
} from '../theme';
import { useButtonStyleSafe } from '../contexts/ButtonStyleContext';
import { useModuleColor } from '../contexts/ModuleColorsContext';
import type { ModuleColorId } from '../types/liquidGlass';
import type { IconName } from './Icon';

// ── Types ──────────────────────────────────────────────────────

export interface UnifiedMiniPlayerProps {
  /** Module identifier for Liquid Glass tint and color */
  moduleId: ModuleColorId;
  /** Album/podcast/station artwork URL */
  artwork: string | null;
  /** Primary text: track/episode/station name */
  title: string;
  /** Secondary text: artist/show/author */
  subtitle?: string;
  /** Placeholder icon when no artwork available */
  placeholderIcon?: IconName;

  /** Current playback state */
  isPlaying: boolean;
  /** Loading/buffering state */
  isLoading: boolean;

  /** Tap on bar → expand to FullPlayer */
  onPress: () => void;
  /** Play/pause toggle */
  onPlayPause: () => void;
  /** Stop playback, clear state, hide player */
  onStop: () => void;

  /** Progress display variant */
  progressType: 'bar' | 'duration';
  /** 0-1 progress value (for 'bar' type) */
  progress?: number;
  /** Seconds of listen time (for 'duration' type) */
  listenDuration?: number;

  /** Called when user swipes player down to dismiss */
  onDismiss?: () => void;

  /** Style override for positioning */
  style?: StyleProp<ViewStyle>;
}

// ── Constants ──────────────────────────────────────────────────

const MINI_PLAYER_HEIGHT = touchTargets.comfortable; // 72pt
const ARTWORK_SIZE = 48;
const BUTTON_SIZE = touchTargets.minimum; // 60pt
const DISMISS_THRESHOLD = 60; // px to trigger dismiss
const PROGRESS_BAR_HEIGHT = 3;

// ── Helpers ────────────────────────────────────────────────────

function formatListenDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds)) return '0:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ── Component ──────────────────────────────────────────────────

export function UnifiedMiniPlayer({
  moduleId,
  artwork,
  title,
  subtitle,
  placeholderIcon = 'musical-notes',
  isPlaying,
  isLoading,
  onPress,
  onPlayPause,
  onStop,
  progressType,
  progress = 0,
  listenDuration = 0,
  onDismiss,
  style,
}: UnifiedMiniPlayerProps) {
  const { t } = useTranslation();
  const moduleColor = useModuleColor(moduleId);
  const buttonStyle = useButtonStyleSafe();

  // ── Swipe-to-dismiss ──

  const translateY = useRef(new Animated.Value(0)).current;
  const isDismissing = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gs) => {
        // Only capture vertical downward swipes
        return gs.dy > 10 && Math.abs(gs.dy) > Math.abs(gs.dx);
      },
      onPanResponderMove: (_evt, gs) => {
        // Only allow downward movement
        if (gs.dy > 0) {
          translateY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_evt, gs) => {
        if (gs.dy > DISMISS_THRESHOLD) {
          // Dismiss
          isDismissing.current = true;
          Animated.timing(translateY, {
            toValue: 200,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDismiss?.();
            // Reset for next show
            translateY.setValue(0);
            isDismissing.current = false;
          });
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  // ── Button border style ──

  const getButtonBorderStyle = useCallback(() => {
    if (!buttonStyle?.settings?.borderEnabled) return {};
    return {
      borderWidth: 2,
      borderColor: buttonStyle.getBorderColorHex(),
    };
  }, [buttonStyle]);

  // ── Render ──

  const playPauseIcon: IconName = isPlaying ? 'pause' : 'play';
  const playPauseLabel = isPlaying
    ? t('audio.pause', 'Pauzeer')
    : t('audio.play', 'Speel af');

  const barContent = (
    <View style={styles.container}>
      {/* Progress bar (for 'bar' type) */}
      {progressType === 'bar' && (
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(Math.max(progress * 100, 0), 100)}%`,
                backgroundColor: colors.textOnPrimary,
              },
            ]}
          />
        </View>
      )}

      {/* Main content row */}
      <View style={styles.contentRow}>
        {/* Artwork */}
        <HapticTouchable
          onPress={onPress}
          hapticType="tap"
          accessibilityRole="button"
          accessibilityLabel={t('audio.expandPlayer', 'Open speler')}
          style={styles.artworkTouchable}
        >
          {artwork ? (
            <Image
              source={{ uri: artwork }}
              style={styles.artwork}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.artworkPlaceholder, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Icon name={placeholderIcon} size={24} color={colors.textOnPrimary} />
            </View>
          )}
        </HapticTouchable>

        {/* Title + Subtitle / Duration */}
        <HapticTouchable
          onPress={onPress}
          hapticType="tap"
          style={styles.textContainer}
          accessibilityRole="button"
          accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}. ${t('audio.expandPlayer', 'Open speler')}`}
        >
          <Text
            style={styles.title}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={styles.subtitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          ) : null}
          {progressType === 'duration' && listenDuration > 0 ? (
            <Text style={styles.duration}>
              🎧 {formatListenDuration(listenDuration)}
            </Text>
          ) : null}
        </HapticTouchable>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Play/Pause */}
          <HapticTouchable
            onPress={onPlayPause}
            hapticType="tap"
            accessibilityRole="button"
            accessibilityLabel={playPauseLabel}
            style={[styles.controlButton, getButtonBorderStyle()]}
          >
            {isLoading ? (
              <View style={styles.loadingDots}>
                <View style={styles.loadingDot} />
                <View style={styles.loadingDot} />
                <View style={styles.loadingDot} />
              </View>
            ) : (
              <Icon name={playPauseIcon} size={22} color={colors.textOnPrimary} />
            )}
          </HapticTouchable>

          {/* Stop */}
          <HapticTouchable
            onPress={onStop}
            hapticType="tap"
            accessibilityRole="button"
            accessibilityLabel={t('audio.stop', 'Stop')}
            style={[styles.controlButton, getButtonBorderStyle()]}
          >
            <Icon name="stop" size={18} color={colors.textOnPrimary} />
          </HapticTouchable>
        </View>
      </View>
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.wrapper,
        style,
        { transform: [{ translateY }] },
      ]}
      {...panResponder.panHandlers}
      accessibilityRole="toolbar"
      accessibilityLabel={t('audio.miniPlayer', 'Minispeler')}
      // VoiceOver: allow dismiss via accessibility action
      accessibilityActions={onDismiss ? [{ name: 'dismiss', label: t('audio.hidePlayer', 'Verberg speler') }] : undefined}
      onAccessibilityAction={onDismiss ? (event) => {
        if (event.nativeEvent.actionName === 'dismiss') {
          onDismiss();
        }
      } : undefined}
    >
      <LiquidGlassView
        moduleId={moduleId}
        fallbackColor={moduleColor}
        cornerRadius={borderRadius.md}
        style={styles.glassContainer}
      >
        {barContent}
      </LiquidGlassView>
    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  glassContainer: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  container: {
    height: MINI_PLAYER_HEIGHT,
    position: 'relative',
  },
  progressBarTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: PROGRESS_BAR_HEIGHT,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressBarFill: {
    height: PROGRESS_BAR_HEIGHT,
    borderRadius: PROGRESS_BAR_HEIGHT / 2,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  artworkTouchable: {
    marginRight: spacing.sm,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: borderRadius.sm,
  },
  artworkPlaceholder: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
    fontSize: 16,
  },
  subtitle: {
    ...typography.small,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 1,
  },
  duration: {
    ...typography.small,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 3,
  },
  loadingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textOnPrimary,
    opacity: 0.6,
  },
});
