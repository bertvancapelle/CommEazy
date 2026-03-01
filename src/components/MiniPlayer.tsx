/**
 * MiniPlayer — Standardized compact audio player bar
 *
 * Configurable mini-player for all audio modules (Radio, Podcast, Audiobook).
 * Supports two progress display modes:
 * - 'bar': Progress bar (for content with known duration)
 * - 'duration': Listen duration counter (for live streams)
 *
 * Liquid Glass Support (iOS 26+):
 * - Uses LiquidGlassView wrapper when available and moduleId provided
 * - Falls back to solid accentColor on iOS <26 and Android
 *
 * Senior-inclusive design:
 * - Touch targets ≥60pt
 * - High contrast text on accent background
 * - Haptic feedback on all interactions
 * - Accessibility labels for VoiceOver/TalkBack
 *
 * @see .claude/CLAUDE.md Section 13 (Gestandaardiseerde AudioPlayer Architectuur)
 * @see .claude/CLAUDE.md Section 16 (Liquid Glass Compliance)
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon } from './Icon';
import { LiquidGlassView } from './LiquidGlassView';
import { useFeedback } from '@/hooks/useFeedback';
import { useLiquidGlassContextSafe } from '@/contexts/LiquidGlassContext';
import { useButtonStyleSafe } from '@/contexts/ButtonStyleContext';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

export interface MiniPlayerProps {
  /** Module ID for Liquid Glass tint color (e.g., 'radio', 'podcast', 'books') */
  moduleId?: ModuleColorId;
  /** Album/podcast/book cover artwork URL (or null for placeholder) */
  artwork: string | null;
  /** Main title (station name, episode title, book title) */
  title: string;
  /** Optional subtitle (show name, author, now playing info) */
  subtitle?: string;
  /** Module accent color (e.g., teal for radio, purple for podcast) - used as fallback */
  accentColor: string;
  /** Is currently playing */
  isPlaying: boolean;
  /** Is loading/buffering */
  isLoading: boolean;
  /** Callback when mini-player is tapped (expand to full player) */
  onPress: () => void;
  /** Callback for play/pause button */
  onPlayPause: () => void;
  /** Progress display mode: 'bar' for seekable content, 'duration' for live streams */
  progressType: 'bar' | 'duration';
  /** Progress value 0-1 (required for 'bar' type) */
  progress?: number;
  /** Listen duration in seconds (required for 'duration' type) */
  listenDuration?: number;
  /** Accessibility label for the expand action */
  expandAccessibilityLabel?: string;
  /** Accessibility hint for the expand action */
  expandAccessibilityHint?: string;
  /** Optional stop button (for live streams like radio) */
  showStopButton?: boolean;
  /** Callback for stop button */
  onStop?: () => void;
  /**
   * Optional style override for container positioning
   * Used for absolute positioning when MiniPlayer overlays content
   * @example style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
   */
  style?: StyleProp<ViewStyle>;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Format seconds to mm:ss or hh:mm:ss
 */
function formatListenDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================
// Component
// ============================================================

export function MiniPlayer({
  moduleId,
  artwork,
  title,
  subtitle,
  accentColor,
  isPlaying,
  isLoading,
  onPress,
  onPlayPause,
  progressType,
  progress = 0,
  listenDuration = 0,
  expandAccessibilityLabel,
  expandAccessibilityHint,
  showStopButton = false,
  onStop,
  style,
}: MiniPlayerProps) {
  const { t } = useTranslation();
  const { triggerFeedback } = useFeedback();

  // Check if Liquid Glass is available
  const liquidGlassContext = useLiquidGlassContextSafe();
  const useLiquidGlass = liquidGlassContext?.isEnabled && moduleId;

  // Button border styling from user preferences
  const buttonStyleContext = useButtonStyleSafe();
  const buttonBorderStyle = buttonStyleContext?.settings.borderEnabled
    ? {
        borderWidth: 2,
        borderColor: buttonStyleContext.getBorderColorHex(),
      }
    : undefined;

  // Debug logging
  console.debug(`[MiniPlayer] moduleId=${moduleId}, contextExists=${!!liquidGlassContext}, isEnabled=${liquidGlassContext?.isEnabled}, useLiquidGlass=${useLiquidGlass}`);

  const handlePress = useCallback(async () => {
    await triggerFeedback('tap');
    onPress();
  }, [onPress, triggerFeedback]);

  const handlePlayPause = useCallback(async (e: any) => {
    // Prevent propagation to parent TouchableOpacity
    e.stopPropagation();
    await triggerFeedback('tap');
    onPlayPause();
  }, [onPlayPause, triggerFeedback]);

  const handleStop = useCallback(async (e: any) => {
    e.stopPropagation();
    await triggerFeedback('tap');
    onStop?.();
  }, [onStop, triggerFeedback]);

  // Common content for both Liquid Glass and fallback
  const playerContent = (
    <>
      {/* Artwork */}
      {artwork && (
        <Image
          source={{ uri: artwork }}
          style={styles.artwork}
          accessibilityIgnoresInvertColors
        />
      )}

      {/* Info section */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {/* Progress display based on type */}
        {progressType === 'bar' ? (
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(progress * 100, 100)}%` },
              ]}
            />
          </View>
        ) : (
          <View style={styles.durationContainer}>
            <Icon name="headphones" size={14} color={colors.textOnPrimary} />
            <Text style={styles.durationText}>
              {formatListenDuration(listenDuration)}
            </Text>
          </View>
        )}

        {/* Optional subtitle */}
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Control buttons */}
      <View style={styles.controls}>
        {/* Play/Pause button */}
        <TouchableOpacity
          style={[styles.playButton, buttonBorderStyle]}
          onPress={handlePlayPause}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? t('audio.pause') : t('audio.play')}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Icon
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              color={colors.textOnPrimary}
            />
          )}
        </TouchableOpacity>

        {/* Optional Stop button (for live streams) */}
        {showStopButton && onStop && (
          <TouchableOpacity
            style={[styles.playButton, styles.stopButton, buttonBorderStyle]}
            onPress={handleStop}
            accessibilityRole="button"
            accessibilityLabel={t('audio.stop')}
          >
            <Icon name="stop" size={28} color={colors.textOnPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  // Use LiquidGlassView when available, otherwise fallback to solid color
  if (useLiquidGlass && moduleId) {
    return (
      <LiquidGlassView
        moduleId={moduleId}
        fallbackColor={accentColor}
        style={[styles.container, style]}
        cornerRadius={0}
      >
        <TouchableOpacity
          style={styles.touchableContent}
          onPress={handlePress}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={expandAccessibilityLabel || t('audio.expandPlayer')}
          accessibilityHint={expandAccessibilityHint || t('audio.expandPlayerHint')}
        >
          {playerContent}
        </TouchableOpacity>
      </LiquidGlassView>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, styles.touchableContent, { backgroundColor: accentColor }, style]}
      onPress={handlePress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={expandAccessibilityLabel || t('audio.expandPlayer')}
      accessibilityHint={expandAccessibilityHint || t('audio.expandPlayerHint')}
    >
      {playerContent}
    </TouchableOpacity>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    minHeight: touchTargets.comfortable,
    // Elevation/shadow for floating appearance
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  touchableContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  info: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.small,
    color: colors.textOnPrimary,
    opacity: 0.8,
    marginTop: 2,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.textOnPrimary,
    borderRadius: 1.5,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  durationText: {
    ...typography.small,
    color: colors.textOnPrimary,
    marginLeft: 4,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  stopButton: {
    // Stop button uses same style as play button
  },
});
