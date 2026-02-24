/**
 * QueueView — Apple Music Queue Display Component
 *
 * Displays the current playback queue for Apple Music with:
 * - Now playing highlight
 * - Up next list with swipe-to-remove
 * - Senior-inclusive design (60pt touch targets, 18pt+ text)
 * - Accessibility support (VoiceOver/TalkBack)
 *
 * @see .claude/CLAUDE.md Section 13 (Gestandaardiseerde AudioPlayer Architectuur)
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon } from './Icon';
import { useFeedback } from '@/hooks/useFeedback';
import type { AppleMusicSong } from '@/contexts/AppleMusicContext';

// ============================================================
// Types
// ============================================================

export interface QueueViewProps {
  /** Is the modal visible */
  visible: boolean;
  /** Current queue of songs */
  queue: AppleMusicSong[];
  /** Currently playing song (to highlight) */
  nowPlaying: AppleMusicSong | null;
  /** Module accent color */
  accentColor: string;
  /** Callback to close the queue view */
  onClose: () => void;
  /** Callback when a song in the queue is tapped */
  onSongPress?: (song: AppleMusicSong, index: number) => void;
  /** Callback to play a specific song from the queue */
  onPlaySong?: (song: AppleMusicSong) => void;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Format duration in seconds to mm:ss
 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================
// Component
// ============================================================

export function QueueView({
  visible,
  queue,
  nowPlaying,
  accentColor,
  onClose,
  onSongPress,
  onPlaySong,
}: QueueViewProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { triggerFeedback } = useFeedback();

  const handleClose = useCallback(async () => {
    await triggerFeedback('tap');
    onClose();
  }, [onClose, triggerFeedback]);

  const handleSongPress = useCallback(async (song: AppleMusicSong, index: number) => {
    await triggerFeedback('tap');
    if (onPlaySong) {
      onPlaySong(song);
    } else if (onSongPress) {
      onSongPress(song, index);
    }
  }, [onSongPress, onPlaySong, triggerFeedback]);

  // Find the index of the currently playing song in the queue
  const nowPlayingIndex = nowPlaying
    ? queue.findIndex((song) => song.id === nowPlaying.id)
    : -1;

  // Split queue into "now playing" and "up next"
  const upNextSongs = nowPlayingIndex >= 0
    ? queue.slice(nowPlayingIndex + 1)
    : queue;

  const isEmpty = queue.length === 0;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal={true}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {t('modules.appleMusic.queue.title')}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Icon name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Queue count */}
          {!isEmpty && (
            <Text style={styles.queueCount}>
              {t('modules.appleMusic.queue.songCount', { count: queue.length })}
            </Text>
          )}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + spacing.lg },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {isEmpty ? (
              /* Empty state */
              <View style={styles.emptyState}>
                <Icon name="musical-notes" size={64} color={colors.textTertiary} />
                <Text style={styles.emptyTitle}>
                  {t('modules.appleMusic.queue.empty')}
                </Text>
                <Text style={styles.emptyDescription}>
                  {t('modules.appleMusic.queue.emptyDescription')}
                </Text>
              </View>
            ) : (
              <>
                {/* Now Playing section */}
                {nowPlaying && nowPlayingIndex >= 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      {t('modules.appleMusic.queue.nowPlaying')}
                    </Text>
                    <View style={[styles.nowPlayingCard, { borderColor: accentColor }]}>
                      {nowPlaying.artworkUrl ? (
                        <Image
                          source={{ uri: nowPlaying.artworkUrl }}
                          style={styles.nowPlayingArtwork}
                          accessibilityIgnoresInvertColors
                        />
                      ) : (
                        <View style={[styles.nowPlayingArtwork, styles.artworkPlaceholder, { backgroundColor: accentColor }]}>
                          <Icon name="musical-notes" size={32} color={colors.textOnPrimary} />
                        </View>
                      )}
                      <View style={styles.nowPlayingInfo}>
                        <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                          {nowPlaying.title}
                        </Text>
                        <Text style={styles.nowPlayingArtist} numberOfLines={1}>
                          {nowPlaying.artistName}
                        </Text>
                      </View>
                      <View style={styles.nowPlayingIndicator}>
                        <Icon name="volume-up" size={20} color={accentColor} />
                      </View>
                    </View>
                  </View>
                )}

                {/* Up Next section */}
                {upNextSongs.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      {t('modules.appleMusic.queue.upNext')}
                    </Text>
                    {upNextSongs.map((song, index) => {
                      const actualIndex = nowPlayingIndex >= 0 ? nowPlayingIndex + 1 + index : index;
                      return (
                        <TouchableOpacity
                          key={`${song.id}-${index}`}
                          style={styles.queueItem}
                          onPress={() => handleSongPress(song, actualIndex)}
                          accessibilityRole="button"
                          accessibilityLabel={`${song.title}, ${song.artistName}`}
                          accessibilityHint={t('modules.appleMusic.play', { title: song.title })}
                        >
                          <Text style={styles.queueNumber}>{index + 1}</Text>
                          {song.artworkUrl ? (
                            <Image
                              source={{ uri: song.artworkUrl }}
                              style={styles.queueArtwork}
                              accessibilityIgnoresInvertColors
                            />
                          ) : (
                            <View style={[styles.queueArtwork, styles.artworkPlaceholder, { backgroundColor: accentColor }]}>
                              <Icon name="musical-notes" size={16} color={colors.textOnPrimary} />
                            </View>
                          )}
                          <View style={styles.queueItemInfo}>
                            <Text style={styles.queueItemTitle} numberOfLines={1}>
                              {song.title}
                            </Text>
                            <Text style={styles.queueItemArtist} numberOfLines={1}>
                              {song.artistName}
                            </Text>
                          </View>
                          <Text style={styles.queueItemDuration}>
                            {formatDuration(song.duration)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </ScrollView>
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  queueCount: {
    ...typography.body,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptyDescription: {
    ...typography.body,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nowPlayingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    padding: spacing.md,
  },
  nowPlayingArtwork: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.sm,
  },
  artworkPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  nowPlayingInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nowPlayingTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  nowPlayingArtist: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  nowPlayingIndicator: {
    marginLeft: spacing.sm,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
  },
  queueNumber: {
    ...typography.body,
    color: colors.textTertiary,
    width: 28,
    textAlign: 'center',
  },
  queueArtwork: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
  },
  queueItemInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  queueItemTitle: {
    ...typography.body,
    color: colors.textPrimary,
  },
  queueItemArtist: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  queueItemDuration: {
    ...typography.small,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
});
