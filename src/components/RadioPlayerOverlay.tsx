/**
 * RadioPlayerOverlay — Full-screen radio player overlay
 *
 * Shows when a radio station is playing:
 * - Station name and country
 * - Current song metadata (ICY: artist - title)
 * - Station artwork or album artwork
 * - Large play/pause/stop controls (senior-friendly)
 * - Favorite toggle
 *
 * Voice commands supported:
 * - "speel" / "play" — Resume playback
 * - "pauze" / "pause" — Pause playback
 * - "stop" — Stop playback and close overlay
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Animated,
  type ImageSourcePropType,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon } from '@/components';
import { useRadioContext } from '@/contexts/RadioContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';

// ============================================================
// Constants
// ============================================================

// Module color (consistent with WheelNavigationMenu and RadioScreen)
const RADIO_MODULE_COLOR = '#00897B';

// ============================================================
// Component
// ============================================================

interface RadioPlayerOverlayProps {
  /** Callback when favorite is toggled */
  onToggleFavorite?: () => void;
  /** Whether current station is a favorite */
  isFavorite?: boolean;
}

export function RadioPlayerOverlay({
  onToggleFavorite,
  isFavorite = false,
}: RadioPlayerOverlayProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { accentColor } = useAccentColor();
  const isReducedMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();

  const {
    isPlaying,
    isLoading,
    isBuffering,
    currentStation,
    metadata,
    showPlayer,
    setShowPlayer,
    play,
    pause,
    stop,
  } = useRadioContext();

  // Animation for artwork pulse (when buffering)
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (isBuffering && !isReducedMotion) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isBuffering, isReducedMotion, pulseAnim]);

  // ============================================================
  // Handlers
  // ============================================================

  const handlePlayPause = useCallback(async () => {
    await triggerFeedback('tap');

    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause, triggerFeedback]);

  const handleStop = useCallback(async () => {
    await triggerFeedback('tap');
    await stop();
  }, [stop, triggerFeedback]);

  const handleClose = useCallback(() => {
    triggerFeedback('tap');
    setShowPlayer(false);
  }, [setShowPlayer, triggerFeedback]);

  const handleToggleFavorite = useCallback(() => {
    triggerFeedback('tap');
    onToggleFavorite?.();
  }, [onToggleFavorite, triggerFeedback]);

  // ============================================================
  // Render
  // ============================================================

  if (!showPlayer || !currentStation) {
    return null;
  }

  // Determine artwork source (favicon or null for placeholder)
  const hasArtwork = Boolean(metadata.artwork || currentStation.favicon);
  const artworkUri = metadata.artwork || currentStation.favicon || null;

  // Display text
  const displayTitle = metadata.title || currentStation.name;
  const displayArtist = metadata.artist || currentStation.country;
  const hasMetadata = Boolean(metadata.title || metadata.artist);

  return (
    <Modal
      visible={showPlayer}
      transparent={true}
      animationType={isReducedMotion ? 'none' : 'slide'}
      onRequestClose={handleClose}
      accessibilityViewIsModal={true}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header with close button */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Icon name="radio" size={24} color={RADIO_MODULE_COLOR} />
            <Text style={styles.headerTitle}>{t('modules.radio.title')}</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Icon name="chevron-down" size={28} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Main content */}
        <View style={styles.content}>
          {/* Artwork */}
          <Animated.View
            style={[
              styles.artworkContainer,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            {hasArtwork ? (
              <Image
                source={{ uri: artworkUri! }}
                style={styles.artwork}
                resizeMode="cover"
                accessibilityLabel={t('modules.radio.stationArtwork', { station: currentStation.name })}
              />
            ) : (
              // Placeholder: Radio icon on teal background
              <View style={[styles.artwork, styles.artworkPlaceholder]}>
                <Icon name="radio" size={120} color={colors.textOnPrimary} strokeWidth={1.5} />
              </View>
            )}
            {(isLoading || isBuffering) && (
              <View style={styles.artworkOverlay}>
                <ActivityIndicator size="large" color={colors.textOnPrimary} />
              </View>
            )}
          </Animated.View>

          {/* Station info */}
          <View style={styles.stationInfo}>
            {/* Station name (always shown) */}
            <Text
              style={styles.stationName}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {currentStation.name}
            </Text>

            {/* Now playing (metadata or country) */}
            {hasMetadata ? (
              <View style={styles.nowPlaying}>
                <Text style={styles.nowPlayingLabel}>
                  {t('modules.radio.nowPlayingLabel')}
                </Text>
                <Text style={styles.songTitle} numberOfLines={2}>
                  {displayTitle}
                </Text>
                {metadata.artist && (
                  <Text style={styles.artistName} numberOfLines={1}>
                    {metadata.artist}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.countryText} numberOfLines={1}>
                {currentStation.country}
              </Text>
            )}
          </View>

          {/* Playback controls */}
          <View style={styles.controls}>
            {/* Favorite button */}
            {onToggleFavorite && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleToggleFavorite}
                accessibilityRole="button"
                accessibilityLabel={
                  isFavorite
                    ? t('modules.radio.removeFromFavorites')
                    : t('modules.radio.addToFavorites')
                }
                accessibilityState={{ selected: isFavorite }}
              >
                <Icon
                  name={isFavorite ? 'heart-filled' : 'heart'}
                  size={32}
                  color={isFavorite ? accentColor.primary : colors.textSecondary}
                />
              </TouchableOpacity>
            )}

            {/* Play/Pause button (large, primary) */}
            <TouchableOpacity
              style={[styles.playButton, { backgroundColor: accentColor.primary }]}
              onPress={handlePlayPause}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? t('modules.radio.pause') : t('modules.radio.play')}
              accessibilityState={{ disabled: isLoading }}
            >
              {isLoading ? (
                <ActivityIndicator size="large" color={colors.textOnPrimary} />
              ) : (
                <Icon
                  name={isPlaying ? 'pause' : 'play'}
                  size={48}
                  color={colors.textOnPrimary}
                />
              )}
            </TouchableOpacity>

            {/* Stop button */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleStop}
              accessibilityRole="button"
              accessibilityLabel={t('modules.radio.stop')}
            >
              <Icon name="stop" size={32} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Buffering indicator text */}
          {isBuffering && (
            <Text style={styles.bufferingText}>
              {t('modules.radio.buffering')}
            </Text>
          )}
        </View>

        {/* Voice hint */}
        <View style={styles.voiceHint}>
          <Text style={styles.voiceHintText}>
            {t('modules.radio.playerVoiceHint')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  artworkContainer: {
    width: 280,
    height: 280,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.xl,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  artworkPlaceholder: {
    backgroundColor: RADIO_MODULE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stationInfo: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  stationName: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  countryText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  nowPlaying: {
    alignItems: 'center',
    width: '100%',
  },
  nowPlayingLabel: {
    ...typography.small,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  songTitle: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '600',
  },
  artistName: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  playButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryButton: {
    width: touchTargets.comfortable,
    height: touchTargets.comfortable,
    borderRadius: touchTargets.comfortable / 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  bufferingText: {
    ...typography.small,
    color: colors.textTertiary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  voiceHint: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
  },
  voiceHintText: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
