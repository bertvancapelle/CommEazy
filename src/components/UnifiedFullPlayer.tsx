/**
 * UnifiedFullPlayer — Unified expanded audio player
 *
 * Generic component with NO context knowledge.
 * All data and callbacks provided via props by the caller.
 *
 * Features:
 * - Renders as Modal (iPhone) or panel overlay (iPad Split View)
 * - Liquid Glass (iOS 26+) on main play button
 * - Conditional controls: only shown when props provided
 * - No AdMob (design decision)
 * - Senior-inclusive: 60-72pt touch targets, 22pt titles
 * - Button border styling via ButtonStyleContext
 * - Haptic feedback on all interactions
 * - VoiceOver accessibility labels
 * - SeekSlider with internal drag state
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  // Modal removed — using PanelAwareModal
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { PanelAwareModal } from './PanelAwareModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { HapticTouchable } from './HapticTouchable';
import { Icon } from './Icon';
import { SeekSlider } from './SeekSlider';
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
import { usePanelId } from '../contexts/PanelIdContext';
import type { ModuleColorId } from '../types/liquidGlass';
import type { IconName } from './Icon';

// ── Types ──────────────────────────────────────────────────────

export type ShuffleMode = 'off' | 'songs';
export type RepeatMode = 'off' | 'one' | 'all';

export interface UnifiedFullPlayerProps {
  /** Modal visibility */
  visible: boolean;

  // ── Content ──
  moduleId: ModuleColorId;
  artwork: string | null;
  title: string;
  subtitle?: string;
  placeholderIcon?: IconName;

  // ── Playback state ──
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering: boolean;

  // ── Core callbacks ──
  onPlayPause: () => void;
  onStop: () => void;
  onClose: () => void;

  // ── Seek (podcast, books, apple music) ──
  position?: number;
  duration?: number;
  onSeek?: (position: number) => void;

  // ── Skip ──
  onSkipBackward?: () => void;
  onSkipForward?: () => void;
  skipBackwardLabel?: string;
  skipForwardLabel?: string;

  // ── Speed (podcast, books) ──
  playbackRate?: number;
  onSpeedPress?: () => void;

  // ── Shuffle/Repeat (apple music) ──
  shuffleMode?: ShuffleMode;
  onShufflePress?: () => void;
  repeatMode?: RepeatMode;
  onRepeatPress?: () => void;

  // ── Favorite ──
  isFavorite?: boolean;
  onFavoritePress?: () => void;

  // ── Sleep timer ──
  sleepTimerMinutes?: number;
  onSleepTimerPress?: () => void;

  // ── Listen duration (radio) ──
  listenDuration?: number;

  // ── Apple Music specific ──
  isInLibrary?: boolean;
  isAddingToLibrary?: boolean;
  onAddToLibraryPress?: () => void;
  queueCount?: number;
  onQueuePress?: () => void;

  // ── AirPlay (iOS) ──
  showAirPlay?: boolean;
}

// ── Constants ──────────────────────────────────────────────────

const ARTWORK_PADDING = 32;
const PLAY_BUTTON_SIZE = touchTargets.comfortable; // 72pt
const CONTROL_BUTTON_SIZE = touchTargets.minimum;   // 60pt
const SPEED_BUTTON_HEIGHT = 44;

// ── Helpers ────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatListenDuration(totalSeconds: number): string {
  return formatTime(totalSeconds);
}

// ── Component ──────────────────────────────────────────────────

export function UnifiedFullPlayer(props: UnifiedFullPlayerProps) {
  const {
    visible,
    moduleId,
    artwork,
    title,
    subtitle,
    placeholderIcon = 'musical-notes',
    isPlaying,
    isLoading,
    isBuffering,
    onPlayPause,
    onStop,
    onClose,
    position,
    duration,
    onSeek,
    onSkipBackward,
    onSkipForward,
    skipBackwardLabel = '10',
    skipForwardLabel = '30',
    playbackRate,
    onSpeedPress,
    shuffleMode,
    onShufflePress,
    repeatMode,
    onRepeatPress,
    isFavorite,
    onFavoritePress,
    sleepTimerMinutes,
    onSleepTimerPress,
    listenDuration,
    isInLibrary,
    isAddingToLibrary,
    onAddToLibraryPress,
    queueCount,
    onQueuePress,
    showAirPlay,
  } = props;

  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const moduleColor = useModuleColor(moduleId);
  const buttonStyle = useButtonStyleSafe();
  const panelId = usePanelId();
  // iPhone panelId is 'main' — must use PanelAwareModal, not View overlay
  const isInPanel = panelId !== null && panelId !== 'main';

  // ── Derived state ──

  const artworkSize = Math.min(screenWidth - ARTWORK_PADDING * 2, 280);

  // ── Artwork error fallback ──
  const [artworkFailed, setArtworkFailed] = useState(false);
  const artworkRef = useRef(artwork);
  if (artwork !== artworkRef.current) {
    artworkRef.current = artwork;
    setArtworkFailed(false);
  }
  const handleArtworkError = useCallback(() => setArtworkFailed(true), []);

  const hasSeek = onSeek !== undefined && duration !== undefined && position !== undefined;
  const hasSkip = onSkipBackward !== undefined || onSkipForward !== undefined;
  const hasSpeed = onSpeedPress !== undefined && playbackRate !== undefined;
  const hasShuffle = onShufflePress !== undefined && shuffleMode !== undefined;
  const hasRepeat = onRepeatPress !== undefined && repeatMode !== undefined;
  const hasFavorite = onFavoritePress !== undefined;
  const hasSleepTimer = onSleepTimerPress !== undefined;
  const hasListenDuration = listenDuration !== undefined && listenDuration > 0;
  const hasAddToLibrary = onAddToLibraryPress !== undefined;
  const hasQueue = onQueuePress !== undefined;

  // ── Button border style ──

  const getButtonBorderStyle = useCallback((): ViewStyle => {
    if (!buttonStyle?.settings?.borderEnabled) return {};
    return {
      borderWidth: 2,
      borderColor: buttonStyle.getBorderColorHex(),
    };
  }, [buttonStyle]);

  // ── Render helpers ──

  const playPauseIcon: IconName = isPlaying ? 'pause' : 'play';
  const playPauseLabel = isPlaying
    ? t('audio.pause', 'Pauzeer')
    : t('audio.play', 'Speel af');

  // ── Player content (shared between Modal and Panel overlay) ──

  const playerContent = (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: moduleColor }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Zone 1: Top bar — Close + Sleep timer */}
        <View style={styles.topBar}>
          <HapticTouchable
            onPress={onClose}
            hapticType="navigation"
            accessibilityRole="button"
            accessibilityLabel={t('audio.closePlayer', 'Sluit speler')}
            style={[styles.topBarButton, getButtonBorderStyle()]}
          >
            <Icon name="chevron-down" size={24} color={colors.textOnPrimary} />
          </HapticTouchable>

          <View style={styles.topBarSpacer} />

          {hasSleepTimer && (
            <HapticTouchable
              onPress={onSleepTimerPress}
              hapticType="tap"
              accessibilityRole="button"
              accessibilityLabel={
                sleepTimerMinutes && sleepTimerMinutes > 0
                  ? t('audio.sleepTimerActive', 'Slaaptimer actief: {{minutes}} minuten', { minutes: sleepTimerMinutes })
                  : t('audio.sleepTimer', 'Slaaptimer')
              }
              style={[styles.topBarButton, getButtonBorderStyle()]}
            >
              <Icon
                name="moon"
                size={22}
                color={sleepTimerMinutes && sleepTimerMinutes > 0 ? '#FFD700' : colors.textOnPrimary}
              />
            </HapticTouchable>
          )}
        </View>

        {/* Zone 2: Artwork */}
        <View style={styles.artworkContainer}>
          {artwork && !artworkFailed ? (
            <Image
              source={{ uri: artwork }}
              style={[styles.artwork, { width: artworkSize, height: artworkSize }]}
              accessibilityIgnoresInvertColors
              onError={handleArtworkError}
            />
          ) : (
            <View style={[styles.artworkPlaceholder, { width: artworkSize, height: artworkSize }]}>
              <Icon name={placeholderIcon} size={64} color="rgba(255,255,255,0.5)" />
            </View>
          )}
          {/* Buffering overlay */}
          {isBuffering && (
            <View style={[styles.bufferingOverlay, { width: artworkSize, height: artworkSize }]}>
              <Text style={styles.bufferingText}>{t('audio.buffering', 'Bufferen...')}</Text>
            </View>
          )}
        </View>

        {/* Zone 3: Title + Subtitle */}
        <View style={styles.metadataContainer}>
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Zone 4a: Listen duration (radio) */}
        {hasListenDuration && (
          <View style={styles.listenDurationContainer}>
            <Icon name="headphones" size={18} color="rgba(255,255,255,0.8)" />
            <Text style={styles.listenDurationText}>
              {formatListenDuration(listenDuration!)}
            </Text>
          </View>
        )}

        {/* Zone 4b: Seek slider */}
        {hasSeek && (
          <View style={styles.seekContainer}>
            <SeekSlider
              value={position!}
              duration={duration!}
              onSeekEnd={(pos) => onSeek!(pos)}
              accentColor={colors.textOnPrimary}
              trackColor="rgba(255, 255, 255, 0.3)"
              accessibilityLabel={t('audio.seekSlider', 'Voortgang')}
            />
            <View style={styles.timeLabels}>
              <Text style={styles.timeLabel}>{formatTime(position!)}</Text>
              <Text style={styles.timeLabel}>{formatTime(duration!)}</Text>
            </View>
          </View>
        )}

        {/* Zone 5: Transport controls */}
        <View style={styles.transportRow}>
          {/* Skip backward */}
          {onSkipBackward ? (
            <HapticTouchable
              onPress={onSkipBackward}
              hapticType="tap"
              accessibilityRole="button"
              accessibilityLabel={t('audio.skipBackward', '{{seconds}} seconden terug', { seconds: skipBackwardLabel })}
              style={[styles.transportButton, getButtonBorderStyle()]}
            >
              <Icon name="chevron-left" size={20} color={colors.textOnPrimary} />
              <Text style={styles.skipLabel}>{skipBackwardLabel}</Text>
            </HapticTouchable>
          ) : (
            <View style={styles.transportSpacer} />
          )}

          {/* Play/Pause (main, large) */}
          <LiquidGlassView
            moduleId={moduleId}
            fallbackColor="rgba(255, 255, 255, 0.2)"
            cornerRadius={borderRadius.md}
            style={styles.playButtonGlass}
          >
            <HapticTouchable
              onPress={onPlayPause}
              hapticType="tap"
              accessibilityRole="button"
              accessibilityLabel={playPauseLabel}
              style={[styles.playButton, getButtonBorderStyle()]}
            >
              {isLoading ? (
                <View style={styles.loadingDots}>
                  <View style={styles.loadingDot} />
                  <View style={styles.loadingDot} />
                  <View style={styles.loadingDot} />
                </View>
              ) : (
                <Icon name={playPauseIcon} size={32} color={colors.textOnPrimary} />
              )}
            </HapticTouchable>
          </LiquidGlassView>

          {/* Skip forward */}
          {onSkipForward ? (
            <HapticTouchable
              onPress={onSkipForward}
              hapticType="tap"
              accessibilityRole="button"
              accessibilityLabel={t('audio.skipForward', '{{seconds}} seconden vooruit', { seconds: skipForwardLabel })}
              style={[styles.transportButton, getButtonBorderStyle()]}
            >
              <Text style={styles.skipLabel}>{skipForwardLabel}</Text>
              <Icon name="chevron-right" size={20} color={colors.textOnPrimary} />
            </HapticTouchable>
          ) : (
            <View style={styles.transportSpacer} />
          )}
        </View>

        {/* Zone 6: Speed control (podcast, books) */}
        {hasSpeed && (
          <View style={styles.speedContainer}>
            <HapticTouchable
              onPress={onSpeedPress}
              hapticType="tap"
              accessibilityRole="button"
              accessibilityLabel={t('audio.speed', 'Snelheid: {{rate}}x', { rate: playbackRate })}
              style={[styles.speedButton, getButtonBorderStyle()]}
            >
              <Text style={styles.speedText}>{playbackRate}×</Text>
            </HapticTouchable>
          </View>
        )}

        {/* Zone 7: Shuffle/Repeat (apple music) */}
        {(hasShuffle || hasRepeat) && (
          <View style={styles.shuffleRepeatRow}>
            {hasShuffle && (
              <HapticTouchable
                onPress={onShufflePress}
                hapticType="tap"
                accessibilityRole="button"
                accessibilityLabel={t('audio.shuffle', 'Willekeurig')}
                accessibilityState={{ selected: shuffleMode === 'songs' }}
                style={[
                  styles.shuffleRepeatButton,
                  shuffleMode === 'songs' && styles.shuffleRepeatActive,
                  getButtonBorderStyle(),
                ]}
              >
                <Icon
                  name="shuffle"
                  size={20}
                  color={shuffleMode === 'songs' ? '#FFD700' : colors.textOnPrimary}
                />
              </HapticTouchable>
            )}
            {hasRepeat && (
              <HapticTouchable
                onPress={onRepeatPress}
                hapticType="tap"
                accessibilityRole="button"
                accessibilityLabel={t('audio.repeat', 'Herhaal')}
                accessibilityState={{ selected: repeatMode !== 'off' }}
                style={[
                  styles.shuffleRepeatButton,
                  repeatMode !== 'off' && styles.shuffleRepeatActive,
                  getButtonBorderStyle(),
                ]}
              >
                <Icon
                  name={repeatMode === 'one' ? 'repeat-one' : 'repeat'}
                  size={20}
                  color={repeatMode !== 'off' ? '#FFD700' : colors.textOnPrimary}
                />
              </HapticTouchable>
            )}
          </View>
        )}

        {/* Zone 8: Action row (favorite, add to library, queue, stop) */}
        <View style={styles.actionRow}>
          {hasFavorite && (
            <HapticTouchable
              onPress={onFavoritePress}
              hapticType={isFavorite ? 'warning' : 'success'}
              accessibilityRole="button"
              accessibilityLabel={
                isFavorite
                  ? t('audio.removeFavorite', 'Verwijder uit favorieten')
                  : t('audio.addFavorite', 'Voeg toe aan favorieten')
              }
              accessibilityState={{ selected: isFavorite }}
              style={[styles.actionButton, getButtonBorderStyle()]}
            >
              <Icon
                name={isFavorite ? 'heart-filled' : 'heart-outline'}
                size={22}
                color={isFavorite ? '#FF4444' : colors.textOnPrimary}
              />
            </HapticTouchable>
          )}

          {hasAddToLibrary && (
            <HapticTouchable
              onPress={onAddToLibraryPress}
              hapticType="success"
              accessibilityRole="button"
              accessibilityLabel={t('audio.addToLibrary', 'Voeg toe aan bibliotheek')}
              accessibilityState={{ selected: isInLibrary }}
              style={[styles.actionButton, getButtonBorderStyle()]}
              hapticDisabled={isAddingToLibrary || isInLibrary}
            >
              <Icon
                name={isInLibrary ? 'check' : 'plus'}
                size={22}
                color={isInLibrary ? '#4CAF50' : colors.textOnPrimary}
              />
            </HapticTouchable>
          )}

          {hasQueue && (
            <HapticTouchable
              onPress={onQueuePress}
              hapticType="tap"
              accessibilityRole="button"
              accessibilityLabel={t('audio.queue', 'Wachtrij ({{count}})', { count: queueCount || 0 })}
              style={[styles.actionButton, getButtonBorderStyle()]}
            >
              <Icon name="queue" size={22} color={colors.textOnPrimary} />
              {queueCount && queueCount > 0 ? (
                <View style={styles.queueBadge}>
                  <Text style={styles.queueBadgeText}>{queueCount}</Text>
                </View>
              ) : null}
            </HapticTouchable>
          )}

          {/* Spacer pushes stop to right */}
          <View style={{ flex: 1 }} />

          {/* Stop button */}
          <HapticTouchable
            onPress={onStop}
            hapticType="tap"
            accessibilityRole="button"
            accessibilityLabel={t('audio.stop', 'Stop')}
            style={[styles.actionButton, getButtonBorderStyle()]}
          >
            <Icon name="stop" size={20} color={colors.textOnPrimary} />
          </HapticTouchable>
        </View>

        {/* AirPlay (iOS only) */}
        {showAirPlay && Platform.OS === 'ios' && (
          <View style={styles.airplayContainer}>
            {/* AirPlay button rendered by native AirPlayButton component */}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  if (!visible) return null;

  // ── iPad Split View: render as panel overlay ──
  if (isInPanel) {
    return (
      <View style={styles.panelOverlay}>
        {playerContent}
      </View>
    );
  }

  // ── iPhone: render as Modal ──
  return (
    <PanelAwareModal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      {playerContent}
    </PanelAwareModal>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Container ──
  panelOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  // ── Zone 1: Top bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  topBarButton: {
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarSpacer: {
    flex: 1,
  },

  // ── Zone 2: Artwork ──
  artworkContainer: {
    alignItems: 'center',
    paddingHorizontal: ARTWORK_PADDING,
    marginBottom: spacing.lg,
  },
  artwork: {
    borderRadius: borderRadius.lg,
  },
  artworkPlaceholder: {
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferingText: {
    ...typography.body,
    color: colors.textOnPrimary,
  },

  // ── Zone 3: Metadata ──
  metadataContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textOnPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // ── Zone 4a: Listen duration ──
  listenDurationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  listenDurationText: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.8)',
  },

  // ── Zone 4b: Seek ──
  seekContainer: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  timeLabel: {
    ...typography.small,
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // ── Zone 5: Transport ──
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  transportButton: {
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  transportSpacer: {
    width: CONTROL_BUTTON_SIZE,
  },
  playButtonGlass: {
    borderRadius: borderRadius.md,
  },
  playButton: {
    width: PLAY_BUTTON_SIZE,
    height: PLAY_BUTTON_SIZE,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipLabel: {
    ...typography.small,
    color: colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 11,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textOnPrimary,
    opacity: 0.6,
  },

  // ── Zone 6: Speed ──
  speedContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  speedButton: {
    paddingHorizontal: spacing.lg,
    height: SPEED_BUTTON_HEIGHT,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedText: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
  },

  // ── Zone 7: Shuffle/Repeat ──
  shuffleRepeatRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  shuffleRepeatButton: {
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shuffleRepeatActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },

  // ── Zone 8: Actions ──
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  actionButton: {
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.textOnPrimary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  queueBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
  },

  // ── AirPlay ──
  airplayContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
});
