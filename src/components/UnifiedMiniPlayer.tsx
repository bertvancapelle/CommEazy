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

import React, { useCallback, useRef, useState, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { useModuleLayoutSafe } from '../contexts/ModuleLayoutContext';
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
const DRAG_HOLD_DURATION = 300; // ms to activate drag mode
const DRAG_POSITION_KEY = '@commeazy/miniPlayerDragY';
const DRAG_TOOLBAR_KEY = '@commeazy/miniPlayerDragToolbar';

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

  // ── Toolbar Position ──
  const layoutContext = useModuleLayoutSafe();
  const toolbarPosition = layoutContext?.toolbarPosition ?? 'top';

  // ── Drag-to-Reposition State ──
  const [dragOffsetY, setDragOffsetY] = useState<number | null>(null);
  const isDragMode = useRef(false);
  const dragStartOffsetY = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragScale = useRef(new Animated.Value(1)).current;

  // Load persisted drag position on mount
  useEffect(() => {
    (async () => {
      try {
        const savedToolbar = await AsyncStorage.getItem(DRAG_TOOLBAR_KEY);
        if (savedToolbar !== toolbarPosition) return; // Reset on toolbar change
        const savedY = await AsyncStorage.getItem(DRAG_POSITION_KEY);
        if (savedY !== null) {
          setDragOffsetY(parseFloat(savedY));
        }
      } catch {
        // Ignore storage errors
      }
    })();
  }, [toolbarPosition]);

  // Clear persisted drag position when toolbar position changes
  useEffect(() => {
    (async () => {
      try {
        const savedToolbar = await AsyncStorage.getItem(DRAG_TOOLBAR_KEY);
        if (savedToolbar !== null && savedToolbar !== toolbarPosition) {
          await AsyncStorage.multiRemove([DRAG_POSITION_KEY, DRAG_TOOLBAR_KEY]);
          setDragOffsetY(null);
        }
      } catch {
        // Ignore storage errors
      }
    })();
  }, [toolbarPosition]);

  // Persist drag position
  const saveDragPosition = useCallback(async (y: number) => {
    try {
      await AsyncStorage.setItem(DRAG_POSITION_KEY, y.toString());
      await AsyncStorage.setItem(DRAG_TOOLBAR_KEY, toolbarPosition);
    } catch {
      // Ignore storage errors
    }
  }, [toolbarPosition]);

  // ── Swipe-to-dismiss + Drag-to-Reposition ──

  const translateY = useRef(new Animated.Value(0)).current;
  const isDismissing = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gs) => {
        // In drag mode: capture all vertical movement
        if (isDragMode.current) {
          return Math.abs(gs.dy) > 2;
        }
        // Normal mode: only capture downward swipes for dismiss
        return gs.dy > 10 && Math.abs(gs.dy) > Math.abs(gs.dx);
      },
      onPanResponderMove: (_evt, gs) => {
        if (isDragMode.current) {
          // Drag mode: update offset position
          const newOffset = dragStartOffsetY.current + gs.dy;
          setDragOffsetY(newOffset);
          return;
        }
        // Normal mode: swipe-to-dismiss (only downward)
        if (gs.dy > 0) {
          translateY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_evt, gs) => {
        if (isDragMode.current) {
          // End drag mode
          isDragMode.current = false;
          Animated.spring(dragScale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 120,
            friction: 10,
          }).start();
          // Persist the final position
          const finalOffset = dragStartOffsetY.current + gs.dy;
          setDragOffsetY(finalOffset);
          saveDragPosition(finalOffset);
          return;
        }
        // Normal mode: swipe-to-dismiss
        if (gs.dy > DISMISS_THRESHOLD) {
          isDismissing.current = true;
          Animated.timing(translateY, {
            toValue: 200,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDismiss?.();
            translateY.setValue(0);
            isDismissing.current = false;
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (isDragMode.current) {
          isDragMode.current = false;
          Animated.spring(dragScale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 120,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  // ── Long Press Handler (activates drag mode) ──

  const handleLongPressStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      isDragMode.current = true;
      dragStartOffsetY.current = dragOffsetY ?? 0;
      // Haptic feedback
      // Scale pulse to indicate drag mode activated
      Animated.sequence([
        Animated.timing(dragScale, {
          toValue: 1.03,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }, DRAG_HOLD_DURATION);
  }, [dragOffsetY, dragScale]);

  const handleLongPressCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

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

  // ── Drag Offset ──
  // dragOffsetY is a vertical offset from default position (persisted in AsyncStorage)
  // Combined with the swipe-to-dismiss translateY and drag scale into a single Animated value
  const dragTranslateY = useRef(new Animated.Value(0)).current;

  // Sync dragOffsetY state → Animated value (without animation, just set)
  useEffect(() => {
    dragTranslateY.setValue(dragOffsetY ?? 0);
  }, [dragOffsetY, dragTranslateY]);

  // Combine: dragOffset + swipe translateY
  const combinedTranslateY = Animated.add(dragTranslateY, translateY);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        style,
        { transform: [{ translateY: combinedTranslateY as unknown as number }, { scale: dragScale }] },
      ]}
      {...panResponder.panHandlers}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressCancel}
      onTouchCancel={handleLongPressCancel}
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
