/**
 * BookPlayerScreen — Podcast-style audio player for books
 *
 * Senior-inclusive audio book player with:
 * - Chapter list (like podcast episodes)
 * - Background TTS playback with progress saving
 * - Large touch targets (60pt+)
 * - VoiceFocusable chapter lists
 * - Expanded player with seek, skip, speed controls
 *
 * Voice commands supported:
 * - "speel" / "play" — Play selected chapter
 * - "pauze" / "pause" — Pause playback
 * - "stop" — Stop playback
 * - "vooruit" / "skip" — Skip forward 30s
 * - "terug" / "back" — Skip backward 10s
 * - "volgende" — Next chapter
 * - "vorige" — Previous chapter
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, VoiceFocusable, UnifiedMiniPlayer, UnifiedFullPlayer, ModuleHeader, ModuleScreenLayout, LoadingView, ScrollViewWithIndicator, PanelAwareModal } from '@/components';
import { useVoiceFocusList, useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import { useHoldGestureContextSafe } from '@/contexts/HoldGestureContext';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import {
  useBooksContext,
  useBooksAudioPlayer,
  formatTime,
  type BookChapter,
} from '@/contexts/BooksContext';
import { useFeedback } from '@/hooks/useFeedback';
import { useModuleBrowsingContextSafe, type BooksBrowsingState } from '@/contexts/ModuleBrowsingContext';

// ============================================================
// Types
// ============================================================

type RootStackParamList = {
  BookPlayer: { bookId: string };
};

type BookPlayerScreenRouteProp = RouteProp<RootStackParamList, 'BookPlayer'>;
type BookPlayerScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BookPlayer'>;

// ============================================================
// Constants
// ============================================================

const PLAYBACK_RATES = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const SLEEP_TIMER_OPTIONS = [15, 30, 45, 60, 90]; // minutes
const TTS_CHARS_PER_SECOND = 15; // For time estimation

// Layout constants for overlay positioning
// ModuleHeader height: icon row (44pt) + AdMob placeholder (50pt) + separator + padding
const MODULE_HEADER_HEIGHT = 120;
// MiniPlayer height: touchTargets.comfortable (72pt) + vertical padding
const MINI_PLAYER_HEIGHT = 84;

// ============================================================
// Component
// ============================================================

export function BookPlayerScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const navigation = useNavigation<BookPlayerScreenNavigationProp>();
  const route = useRoute<BookPlayerScreenRouteProp>();
  const { triggerFeedback } = useFeedback();
  const holdGesture = useHoldGestureContextSafe();
  const themeColors = useColors();
  const browsingCtx = useModuleBrowsingContextSafe();

  // User-customizable module color for Liquid Glass
  const booksModuleColor = useModuleColor('books');

  // Accent color derived from module color
  const accentColor = {
    primary: booksModuleColor,
    primaryLight: `${booksModuleColor}20`,
  };

  // Books context
  const { currentBook, ttsSettings, setSleepTimer, voiceQualityStatus } = useBooksContext();

  // Audio player context
  const {
    bookMode,
    chapters,
    currentChapter,
    currentChapterIndex,
    audioProgress,
    isAudioLoading,
    isAudioPlaying,
    isAudioPaused,
    playbackRate,
    playChapter,
    playAudio,
    pauseAudio,
    stopAudio,
    nextChapter,
    previousChapter,
    seekAudioTo,
    skipAudioForward,
    skipAudioBackward,
    setAudioPlaybackRate,
    getChapterProgress,
    isChapterCompleted,
  } = useBooksAudioPlayer();

  // Local state
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [showSleepTimerPicker, setShowSleepTimerPicker] = useState(false);
  const [sleepTimerMinutes, setSleepTimerMinutesLocal] = useState<number | null>(null);
  // VoiceFocus for chapter list
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return [];
    return chapters.map((chapter, index) => ({
      id: `chapter-${index}`,
      label: chapter.title,
      index,
      onSelect: () => handleChapterPress(chapter, index),
    }));
  }, [chapters, isFocused]);

  const { scrollRef } = useVoiceFocusList('book-chapters', voiceFocusItems);

  // ============================================================
  // Effects
  // ============================================================

  // ============================================================
  // Handlers
  // ============================================================

  // Back navigation — reset activeView so MediaIndicator returns to book list
  const handleBack = useCallback(() => {
    // Reset activeView to 'list' so MediaIndicator doesn't auto-navigate back here
    if (browsingCtx) {
      const saved = browsingCtx.getBrowsingState<BooksBrowsingState>('books');
      if (saved) {
        browsingCtx.saveBrowsingState('books', { ...saved, activeView: 'list' });
      }
    }
    navigation.goBack();
  }, [browsingCtx, navigation]);

  const handleChapterPress = useCallback(async (chapter: BookChapter, index: number) => {
    // Check if hold gesture was just consumed
    if (holdGesture?.isGestureConsumed?.()) {
      return;
    }

    await triggerFeedback('tap');
    await playChapter(index);
  }, [holdGesture, playChapter]);

  const handlePlayPause = useCallback(async () => {
    await triggerFeedback('tap');

    if (isAudioPlaying) {
      await pauseAudio();
    } else if (isAudioPaused) {
      await playAudio();
    } else if (currentChapter) {
      // Not playing and not paused — start playing the current chapter
      await playChapter(currentChapterIndex);
    } else if (chapters.length > 0) {
      // No current chapter selected, start from first chapter
      await playChapter(0);
    }
  }, [isAudioPlaying, isAudioPaused, currentChapter, currentChapterIndex, chapters, playChapter, playAudio, pauseAudio]);

  const handleStop = useCallback(async () => {
    await triggerFeedback('tap');
    await stopAudio();
  }, [stopAudio]);

  const handleSpeedChange = useCallback(async (rate: number) => {
    await triggerFeedback('tap');
    await setAudioPlaybackRate(rate);
    setShowSpeedPicker(false);
    setTimeout(() => setIsPlayerExpanded(true), 100);
  }, [setAudioPlaybackRate]);

  const handleSleepTimer = useCallback((minutes: number | null) => {
    triggerFeedback('tap');
    setSleepTimerMinutesLocal(minutes);
    setSleepTimer(minutes);
    setShowSleepTimerPicker(false);
    setTimeout(() => setIsPlayerExpanded(true), 100);
  }, [setSleepTimer]);

  // ============================================================
  // Helpers
  // ============================================================

  // Convert character position to estimated time in seconds
  const charsToSeconds = (chars: number): number => {
    return Math.floor(chars / TTS_CHARS_PER_SECOND);
  };

  // Format chapter duration
  const formatChapterDuration = (chapter: BookChapter): string => {
    return formatTime(chapter.estimatedDuration);
  };

  // Get progress percentage for a chapter
  const getChapterProgressPercentage = (index: number): number => {
    const progress = getChapterProgress(index);
    if (!progress) return 0;
    const chapter = chapters[index];
    if (!chapter) return 0;
    return Math.min((progress.position / chapter.content.length) * 100, 100);
  };

  // ============================================================
  // Render
  // ============================================================

  if (!currentBook) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoadingView fullscreen />
      </View>
    );
  }

  // Calculate dynamic padding for content to extend under overlays
  const contentPaddingTop = MODULE_HEADER_HEIGHT + insets.top;
  const contentPaddingBottom = currentChapter
    ? MINI_PLAYER_HEIGHT + insets.bottom
    : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* ============================================================
          CONTENT LAYER — Full height, ModuleHeader participates in layout
          ============================================================ */}
      <View style={styles.contentLayer}>
        <ModuleScreenLayout
          moduleId="books"
          moduleBlock={
            <ModuleHeader
              moduleId="books"
              icon="book"
              title={t('modules.books.listen')}
              currentSource="books"
              showBackButton={true}
              onBackPress={handleBack}
              backButtonLabel={t('common.back')}
              skipSafeArea
            />
          }
          controlsBlock={<>
        {/* Book Info */}
        <View style={styles.bookInfoContainer}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {currentBook.title}
          </Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>
            {currentBook.author}
          </Text>
          <Text style={styles.chapterCount}>
            {t('modules.books.audio.chapterCount', { count: chapters.length })}
          </Text>
        </View>
        </>}
        contentBlock={<>
        {/* Chapter List */}
        <ScrollViewWithIndicator
          ref={scrollRef}
          style={styles.chapterList}
          contentContainerStyle={[
            styles.chapterListContent,
            { paddingBottom: contentPaddingBottom + spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
        >
        {chapters.map((chapter, index) => {
          const isCurrentChapter = currentChapterIndex === index && (isAudioPlaying || isAudioPaused);
          const completed = isChapterCompleted(index);
          const progressPercent = getChapterProgressPercentage(index);
          const progress = getChapterProgress(index);

          return (
            <VoiceFocusable
              key={`chapter-${index}`}
              id={`chapter-${index}`}
              label={chapter.title}
              index={index}
              onSelect={() => handleChapterPress(chapter, index)}
            >
              <HapticTouchable hapticDisabled
                style={[
                  styles.chapterItem,
                  isCurrentChapter && { backgroundColor: accentColor.primaryLight },
                ]}
                onPress={() => handleChapterPress(chapter, index)}
                accessibilityRole="button"
                accessibilityLabel={`${chapter.title}, ${formatChapterDuration(chapter)}${completed ? `, ${t('modules.books.audio.completed')}` : ''}`}
                accessibilityState={{ selected: isCurrentChapter }}
              >
                {/* Chapter number */}
                <View
                  style={[
                    styles.chapterNumber,
                    completed && { backgroundColor: accentColor.primary },
                  ]}
                >
                  {completed ? (
                    <Icon name="checkmark" size={16} color={colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.chapterNumberText}>{index + 1}</Text>
                  )}
                </View>

                {/* Chapter info */}
                <View style={styles.chapterInfo}>
                  <Text
                    style={[
                      styles.chapterTitle,
                      completed && styles.chapterTitleCompleted,
                    ]}
                    numberOfLines={2}
                  >
                    {chapter.title}
                  </Text>
                  <View style={styles.chapterMeta}>
                    <Text style={styles.chapterDuration}>
                      {formatChapterDuration(chapter)}
                    </Text>
                    {progress && !completed && (
                      <Text style={styles.chapterProgressText}>
                        • {t('modules.books.audio.resumeFrom', {
                          time: formatTime(charsToSeconds(progress.position)),
                        })}
                      </Text>
                    )}
                  </View>
                  {/* Progress bar */}
                  {progressPercent > 0 && !completed && (
                    <View style={styles.chapterProgressContainer}>
                      <View
                        style={[
                          styles.chapterProgressBar,
                          {
                            width: `${progressPercent}%`,
                            backgroundColor: accentColor.primary,
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>

                {/* Play button */}
                <View style={[styles.playButton, { backgroundColor: accentColor.primary }]}>
                  <Icon
                    name={isCurrentChapter && isAudioPlaying ? 'pause' : 'play'}
                    size={20}
                    color={colors.textOnPrimary}
                  />
                </View>
              </HapticTouchable>
            </VoiceFocusable>
          );
        })}
      </ScrollViewWithIndicator>
        </>}
        />
      </View>

      {/* ============================================================
          OVERLAY LAYER — Floating MiniPlayer at bottom
          pointerEvents="box-none" allows touches to pass through
          ============================================================ */}
      <View style={styles.overlayLayer} pointerEvents="box-none">
        {/* Spacer pushes MiniPlayer to bottom */}
        <View style={styles.overlaySpacer} pointerEvents="none" />

        {/* Mini Player */}
        {currentChapter && (
          <UnifiedMiniPlayer
            moduleId="books"
            artwork={currentBook?.coverUrl || null}
            title={currentChapter.title}
            subtitle={currentBook?.title}
            placeholderIcon="book"
            isPlaying={isAudioPlaying}
            isLoading={isAudioLoading}
            onPress={() => setIsPlayerExpanded(true)}
            onPlayPause={handlePlayPause}
            onStop={handleStop}
            progressType="bar"
            progress={audioProgress.percentage / 100}
            onDismiss={() => {}}
            style={styles.absolutePlayer}
          />
        )}
      </View>

      {/* Expanded Player */}
      <UnifiedFullPlayer
        visible={isPlayerExpanded && !!currentChapter}
        moduleId="books"
        artwork={currentBook?.coverUrl || null}
        title={currentChapter?.title || ''}
        subtitle={currentBook?.title || ''}
        placeholderIcon="book"
        isPlaying={isAudioPlaying}
        isLoading={isAudioLoading}
        isBuffering={false}
        onPlayPause={handlePlayPause}
        onStop={async () => {
          await handleStop();
          setIsPlayerExpanded(false);
        }}
        onClose={() => setIsPlayerExpanded(false)}
        position={charsToSeconds(audioProgress.position)}
        duration={charsToSeconds(audioProgress.duration)}
        onSeek={(seconds) => seekAudioTo(seconds * TTS_CHARS_PER_SECOND)}
        onSkipBackward={() => skipAudioBackward(10)}
        onSkipForward={() => skipAudioForward(30)}
        skipBackwardLabel="10"
        skipForwardLabel="30"
        playbackRate={playbackRate}
        onSpeedPress={() => {
          setIsPlayerExpanded(false);
          setTimeout(() => setShowSpeedPicker(true), 100);
        }}
        sleepTimerMinutes={sleepTimerMinutes ?? undefined}
        onSleepTimerPress={() => {
          setIsPlayerExpanded(false);
          setTimeout(() => setShowSleepTimerPicker(true), 100);
        }}
      />

      {/* Speed Picker Modal */}
      <PanelAwareModal
        visible={showSpeedPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSpeedPicker(false);
          setTimeout(() => setIsPlayerExpanded(true), 100);
        }}
      >
        <HapticTouchable hapticDisabled
          style={styles.pickerOverlay}
          onPress={() => {
            setShowSpeedPicker(false);
            setTimeout(() => setIsPlayerExpanded(true), 100);
          }}
          activeOpacity={1}
        >
          <View style={styles.pickerContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.pickerTitle}>{t('modules.books.audio.playbackSpeedTitle')}</Text>
            {PLAYBACK_RATES.map((rate) => (
              <HapticTouchable hapticDisabled
                key={rate}
                style={[
                  styles.pickerOption,
                  playbackRate === rate && { backgroundColor: accentColor.primaryLight },
                ]}
                onPress={() => handleSpeedChange(rate)}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    playbackRate === rate && { color: accentColor.primary, fontWeight: '700' },
                  ]}
                >
                  {rate}x
                </Text>
              </HapticTouchable>
            ))}
          </View>
        </HapticTouchable>
      </PanelAwareModal>

      {/* Sleep Timer Picker Modal */}
      <PanelAwareModal
        visible={showSleepTimerPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSleepTimerPicker(false);
          setTimeout(() => setIsPlayerExpanded(true), 100);
        }}
      >
        <HapticTouchable hapticDisabled
          style={styles.pickerOverlay}
          onPress={() => {
            setShowSleepTimerPicker(false);
            setTimeout(() => setIsPlayerExpanded(true), 100);
          }}
          activeOpacity={1}
        >
          <View style={styles.pickerContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.pickerTitle}>{t('modules.books.audio.sleepTimerTitle')}</Text>
            {sleepTimerMinutes && (
              <HapticTouchable hapticDisabled
                style={styles.pickerOption}
                onPress={() => handleSleepTimer(null)}
              >
                <Text style={[styles.pickerOptionText, { color: colors.error }]}>
                  {t('modules.books.audio.sleepTimerCancel')}
                </Text>
              </HapticTouchable>
            )}
            {SLEEP_TIMER_OPTIONS.map((minutes) => (
              <HapticTouchable hapticDisabled
                key={minutes}
                style={[
                  styles.pickerOption,
                  sleepTimerMinutes === minutes && { backgroundColor: accentColor.primaryLight },
                ]}
                onPress={() => handleSleepTimer(minutes)}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    sleepTimerMinutes === minutes && { color: accentColor.primary, fontWeight: '700' },
                  ]}
                >
                  {t('modules.books.audio.sleepTimerMinutes', { minutes })}
                </Text>
              </HapticTouchable>
            ))}
          </View>
        </HapticTouchable>
      </PanelAwareModal>
    </View>
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

  // ============================================================
  // Overlay Architecture Styles
  // ============================================================

  // Content layer — scrollable content that extends under overlays
  contentLayer: {
    flex: 1,
  },

  // Overlay layer — absolute positioned container for header and mini player
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
  },

  // ModuleHeader positioning (top of overlay layer)
  absoluteHeader: {
    // No additional styles needed — ModuleHeader handles its own layout
  },

  // Spacer pushes MiniPlayer to bottom of overlay layer
  overlaySpacer: {
    flex: 1,
  },

  // MiniPlayer positioning (bottom of overlay layer)
  absolutePlayer: {
    // No additional styles needed — MiniPlayer handles its own layout
  },

  // ============================================================
  // Book Info
  // ============================================================
  bookInfoContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bookTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  bookAuthor: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chapterCount: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Chapter List
  chapterList: {
    flex: 1,
  },
  chapterListContent: {
    padding: spacing.md,
  },

  // Chapter Item
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: touchTargets.comfortable,
    gap: spacing.md,
  },
  chapterNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterNumberText: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xxs,
  },
  chapterTitleCompleted: {
    color: colors.textSecondary,
  },
  chapterMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chapterDuration: {
    ...typography.label,
    color: colors.textSecondary,
  },
  chapterProgressText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  chapterProgressContainer: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 1.5,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  chapterProgressBar: {
    height: '100%',
    borderRadius: 1.5,
  },
  playButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: touchTargets.minimum / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Picker modals
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  pickerContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 300,
  },
  pickerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  pickerOption: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    justifyContent: 'center',
  },
  pickerOptionText: {
    ...typography.body,
    color: colors.textPrimary,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});

export default BookPlayerScreen;
