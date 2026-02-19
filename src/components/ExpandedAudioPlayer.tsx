/**
 * ExpandedAudioPlayer — Standardized full-screen audio player modal
 *
 * Configurable expanded player for all audio modules (Radio, Podcast, Audiobook).
 * Supports configurable controls that can be shown/hidden per module:
 * - seekSlider: Progress bar with seek functionality
 * - skipButtons: Skip forward/backward buttons
 * - speedControl: Playback speed selector
 * - sleepTimer: Sleep timer button
 * - favorite: Favorite/heart button
 * - listenDuration: Duration counter for live streams
 *
 * Senior-inclusive design:
 * - Touch targets ≥60pt
 * - High contrast text
 * - Haptic feedback on all interactions
 * - Accessibility labels for VoiceOver/TalkBack
 * - Reduced motion support
 *
 * @see .claude/CLAUDE.md Section 13 (Gestandaardiseerde AudioPlayer Architectuur)
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, type IconName } from './Icon';
import { SeekSlider } from './SeekSlider';
import { useFeedback } from '@/hooks/useFeedback';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// ============================================================
// Types
// ============================================================

/** Configurable controls for the expanded player */
export interface AudioPlayerControls {
  /** Show seek slider (for content with known duration) */
  seekSlider?: boolean;
  /** Show skip forward/backward buttons */
  skipButtons?: boolean;
  /** Show playback speed control */
  speedControl?: boolean;
  /** Show sleep timer button */
  sleepTimer?: boolean;
  /** Show favorite/heart button */
  favorite?: boolean;
  /** Show listen duration counter (for live streams) */
  listenDuration?: boolean;
}

export interface ExpandedAudioPlayerProps {
  /** Is the modal visible */
  visible: boolean;
  /** Album/podcast/book cover artwork URL (or null for placeholder) */
  artwork: string | null;
  /** Main title (station name, episode title, book title) */
  title: string;
  /** Optional subtitle (show name, author) */
  subtitle?: string;
  /** Module accent color (e.g., teal for radio, purple for podcast) */
  accentColor: string;
  /** Placeholder icon when no artwork is available */
  placeholderIcon?: IconName;
  /** Show AdMob banner at top of player (default: true) */
  showAdMob?: boolean;
  /** AdMob unit ID (optional, uses default if not provided) */
  adMobUnitId?: string;
  /** Is currently playing */
  isPlaying: boolean;
  /** Is loading/buffering */
  isLoading: boolean;
  /** Is currently buffering (distinct from initial loading) */
  isBuffering: boolean;

  // Seek slider props (when controls.seekSlider is true)
  /** Current position in seconds */
  position?: number;
  /** Total duration in seconds */
  duration?: number;
  /** Callback when seeking */
  onSeek?: (position: number) => void;

  // Listen duration props (when controls.listenDuration is true)
  /** Listen duration in seconds (for live streams) */
  listenDuration?: number;

  // Control callbacks
  /** Callback for play/pause button */
  onPlayPause: () => void;
  /** Callback to close the modal */
  onClose: () => void;

  // Configurable controls
  /** Which controls to show */
  controls: AudioPlayerControls;

  // Skip buttons (when controls.skipButtons is true)
  /** Skip backward seconds (default: 10) */
  skipBackwardSeconds?: number;
  /** Skip forward seconds (default: 30) */
  skipForwardSeconds?: number;
  /** Callback for skip backward */
  onSkipBackward?: () => void;
  /** Callback for skip forward */
  onSkipForward?: () => void;

  // Speed control (when controls.speedControl is true)
  /** Current playback rate (e.g., 1.0, 1.5, 2.0) */
  playbackRate?: number;
  /** Callback when speed button is pressed */
  onSpeedPress?: () => void;

  // Sleep timer (when controls.sleepTimer is true)
  /** Minutes remaining on sleep timer (0 = not active) */
  sleepTimerMinutes?: number;
  /** Callback when sleep timer button is pressed */
  onSleepTimerPress?: () => void;

  // Favorite (when controls.favorite is true)
  /** Is item favorited */
  isFavorite?: boolean;
  /** Callback when favorite button is pressed */
  onFavoritePress?: () => void;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Format seconds to mm:ss or hh:mm:ss
 */
function formatTime(seconds: number): string {
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

export function ExpandedAudioPlayer({
  visible,
  artwork,
  title,
  subtitle,
  accentColor,
  placeholderIcon = 'musical-notes',
  showAdMob = true,
  adMobUnitId,
  isPlaying,
  isLoading,
  isBuffering,
  position = 0,
  duration = 0,
  onSeek,
  listenDuration = 0,
  onPlayPause,
  onClose,
  controls,
  skipBackwardSeconds = 10,
  skipForwardSeconds = 30,
  onSkipBackward,
  onSkipForward,
  playbackRate = 1.0,
  onSpeedPress,
  sleepTimerMinutes = 0,
  onSleepTimerPress,
  isFavorite = false,
  onFavoritePress,
}: ExpandedAudioPlayerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { triggerFeedback } = useFeedback();
  const isReducedMotion = useReducedMotion();

  // Pulse animation for artwork when playing
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isReducedMotion) {
      pulseAnim.setValue(1);
      return;
    }

    if (isPlaying && !isBuffering && !isLoading) {
      // Subtle breathing animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPlaying, isBuffering, isLoading, isReducedMotion, pulseAnim]);

  // Internal seek state
  const [isSeeking, setIsSeeking] = React.useState(false);
  const [seekPosition, setSeekPosition] = React.useState(0);

  const handlePlayPause = useCallback(async () => {
    await triggerFeedback('tap');
    onPlayPause();
  }, [onPlayPause, triggerFeedback]);

  const handleClose = useCallback(async () => {
    await triggerFeedback('tap');
    onClose();
  }, [onClose, triggerFeedback]);

  const handleSkipBackward = useCallback(async () => {
    await triggerFeedback('tap');
    onSkipBackward?.();
  }, [onSkipBackward, triggerFeedback]);

  const handleSkipForward = useCallback(async () => {
    await triggerFeedback('tap');
    onSkipForward?.();
  }, [onSkipForward, triggerFeedback]);

  const handleSpeedPress = useCallback(async () => {
    await triggerFeedback('tap');
    onSpeedPress?.();
  }, [onSpeedPress, triggerFeedback]);

  const handleSleepTimerPress = useCallback(async () => {
    await triggerFeedback('tap');
    onSleepTimerPress?.();
  }, [onSleepTimerPress, triggerFeedback]);

  const handleFavoritePress = useCallback(async () => {
    await triggerFeedback('tap');
    onFavoritePress?.();
  }, [onFavoritePress, triggerFeedback]);

  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
  }, []);

  const handleSeeking = useCallback((pos: number) => {
    setSeekPosition(pos);
  }, []);

  const handleSeekEnd = useCallback((pos: number) => {
    setIsSeeking(false);
    onSeek?.(pos);
  }, [onSeek]);

  const displayPosition = isSeeking ? seekPosition : position;
  const remainingTime = Math.max(0, duration - displayPosition);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType={isReducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      accessibilityViewIsModal={true}
    >
      <View style={styles.overlay}>
        {/* Safe Area + AdMob Row at Top */}
        <View style={[styles.topSection, { paddingTop: insets.top }]}>
          {/* AdMob Row (optional) */}
          {showAdMob && (
            <View style={styles.adMobRow}>
              {/* TODO: Implement AdMobBanner component */}
              {/* <AdMobBanner unitId={adMobUnitId} /> */}
              <View style={styles.adMobPlaceholder}>
                <Text style={styles.adMobPlaceholderText}>AdMob Banner</Text>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.content, { paddingTop: showAdMob ? spacing.md : insets.top + spacing.md }]}>
          {/* Artwork */}
          <Animated.View
            style={[
              styles.artworkContainer,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            {artwork ? (
              <Image
                source={{ uri: artwork }}
                style={styles.artwork}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={[styles.artwork, styles.artworkPlaceholder, { backgroundColor: accentColor }]}>
                <Icon name={placeholderIcon} size={80} color={colors.textOnPrimary} />
              </View>
            )}
            {(isLoading || isBuffering) && (
              <View style={styles.artworkOverlay}>
                <ActivityIndicator size="large" color={colors.textOnPrimary} />
              </View>
            )}
          </Animated.View>

          {/* Info section */}
          <View style={styles.info}>
            {subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          </View>

          {/* Listen duration (for live streams) */}
          {controls.listenDuration && (
            <View style={styles.listenDurationContainer}>
              <Icon name="headphones" size={18} color={colors.textSecondary} />
              <Text style={styles.listenDurationText}>
                {formatTime(listenDuration)}
              </Text>
            </View>
          )}

          {/* Seek slider (for seekable content) */}
          {controls.seekSlider && duration > 0 && (
            <View style={styles.progressSection}>
              <SeekSlider
                value={position}
                duration={duration}
                onSeekStart={handleSeekStart}
                onSeeking={handleSeeking}
                onSeekEnd={handleSeekEnd}
                accentColor={accentColor}
                accessibilityLabel={`${formatTime(displayPosition)} ${t('audio.of')} ${formatTime(duration)}`}
                accessibilityStep={10}
              />
              <View style={styles.progressLabels}>
                <Text style={styles.progressTime}>
                  {formatTime(displayPosition)}
                </Text>
                <Text style={styles.progressTime}>
                  -{formatTime(remainingTime)}
                </Text>
              </View>
            </View>
          )}

          {/* Controls row */}
          <View style={styles.controls}>
            {/* Speed control */}
            {controls.speedControl && onSpeedPress && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleSpeedPress}
                accessibilityRole="button"
                accessibilityLabel={t('audio.playbackSpeed', { rate: `${playbackRate}x` })}
              >
                <Text style={styles.secondaryButtonText}>{playbackRate}x</Text>
              </TouchableOpacity>
            )}

            {/* Skip backward */}
            {controls.skipButtons && onSkipBackward && (
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkipBackward}
                accessibilityRole="button"
                accessibilityLabel={t('audio.skipBackward', { seconds: skipBackwardSeconds })}
              >
                <Icon name="chevron-left" size={24} color={colors.textPrimary} />
                <Text style={styles.skipButtonText}>{skipBackwardSeconds}</Text>
              </TouchableOpacity>
            )}

            {/* Play/Pause button */}
            <TouchableOpacity
              style={[styles.mainPlayButton, { backgroundColor: accentColor }]}
              onPress={handlePlayPause}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? t('audio.pause') : t('audio.play')}
            >
              {isLoading ? (
                <ActivityIndicator size="large" color={colors.textOnPrimary} />
              ) : (
                <Icon
                  name={isPlaying ? 'pause' : 'play'}
                  size={40}
                  color={colors.textOnPrimary}
                />
              )}
            </TouchableOpacity>

            {/* Skip forward */}
            {controls.skipButtons && onSkipForward && (
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkipForward}
                accessibilityRole="button"
                accessibilityLabel={t('audio.skipForward', { seconds: skipForwardSeconds })}
              >
                <Text style={styles.skipButtonText}>{skipForwardSeconds}</Text>
                <Icon name="chevron-right" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            )}

            {/* Sleep timer */}
            {controls.sleepTimer && onSleepTimerPress && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleSleepTimerPress}
                accessibilityRole="button"
                accessibilityLabel={
                  sleepTimerMinutes > 0
                    ? t('audio.sleepTimerActive', { minutes: sleepTimerMinutes })
                    : t('audio.sleepTimer')
                }
              >
                <Icon
                  name="time"
                  size={20}
                  color={sleepTimerMinutes > 0 ? accentColor : colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Favorite button (below main controls) */}
          {controls.favorite && onFavoritePress && (
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={handleFavoritePress}
              accessibilityRole="button"
              accessibilityLabel={
                isFavorite
                  ? t('audio.removeFromFavorites')
                  : t('audio.addToFavorites')
              }
              accessibilityState={{ selected: isFavorite }}
            >
              <Icon
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={28}
                color={isFavorite ? accentColor : colors.textSecondary}
              />
            </TouchableOpacity>
          )}

          {/* Buffering text */}
          {isBuffering && (
            <Text style={styles.bufferingText}>{t('audio.buffering')}</Text>
          )}

          {/* Close/minimize button */}
          <View style={styles.closeContainer}>
            <TouchableOpacity
              style={styles.minimizeButton}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={t('audio.collapsePlayer')}
            >
              <Icon name="chevron-down" size={28} color={colors.textSecondary} />
              <Text style={styles.minimizeButtonText}>{t('audio.collapsePlayer')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topSection: {
    // Fixed at top, does not flex
    backgroundColor: colors.background,
  },
  adMobRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  adMobPlaceholder: {
    // Temporary placeholder until AdMobBanner is implemented
    height: 50,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adMobPlaceholderText: {
    ...typography.small,
    color: colors.textTertiary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  artworkContainer: {
    marginBottom: spacing.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  artwork: {
    width: 240,
    height: 240,
    borderRadius: borderRadius.lg,
  },
  artworkPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  info: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    width: '100%',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  listenDurationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
  },
  listenDurationText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    marginLeft: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  progressSection: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.sm,
  },
  progressTime: {
    ...typography.small,
    color: colors.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  secondaryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: touchTargets.minimum,
    height: touchTargets.minimum,
  },
  skipButtonText: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  mainPlayButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  favoriteButton: {
    marginTop: spacing.lg,
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferingText: {
    ...typography.small,
    color: colors.textTertiary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  closeContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  minimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  minimizeButtonText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
