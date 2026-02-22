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

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, IconButton, VoiceFocusable, SeekSlider, MiniPlayer, ModuleHeader } from '@/components';
import { useVoiceFocusList, useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import { useHoldGestureContextSafe } from '@/contexts/HoldGestureContext';
import {
  useBooksContext,
  useBooksAudioPlayer,
  formatTime,
  type BookChapter,
} from '@/contexts/BooksContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';

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

const MODULE_COLOR = '#FF8F00'; // Amber — Books module color
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
  const isReducedMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();
  const holdGesture = useHoldGestureContextSafe();

  // Accent color for this module
  const accentColor = {
    primary: MODULE_COLOR,
    primaryLight: `${MODULE_COLOR}20`,
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
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);

  // Animation for artwork pulse (when playing)
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  // Pulse animation when playing
  useEffect(() => {
    if (isAudioPlaying && !isReducedMotion) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isAudioPlaying, isReducedMotion, pulseAnim]);

  // ============================================================
  // Handlers
  // ============================================================

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

  const handleSeek = useCallback(async (position: number) => {
    // Position is in characters, convert to actual seek
    await seekAudioTo(position);
  }, [seekAudioTo]);

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
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={accentColor.primary} />
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      </View>
    );
  }

  // Calculate dynamic padding for content to extend under overlays
  const contentPaddingTop = MODULE_HEADER_HEIGHT + insets.top;
  const contentPaddingBottom = currentChapter
    ? MINI_PLAYER_HEIGHT + insets.bottom
    : insets.bottom;

  return (
    <View style={styles.container}>
      {/* ============================================================
          CONTENT LAYER — Extends full height under overlays
          Content scrolls UNDER the ModuleHeader and MiniPlayer
          ============================================================ */}
      <View style={styles.contentLayer}>
        {/* Book Info */}
        <View style={[styles.bookInfoContainer, { marginTop: contentPaddingTop + spacing.md }]}>
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

        {/* Chapter List */}
        <ScrollView
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
              <TouchableOpacity
                style={[
                  styles.chapterItem,
                  isCurrentChapter && { backgroundColor: accentColor.primaryLight },
                ]}
                onPress={() => handleChapterPress(chapter, index)}
                onLongPress={() => {}}
                delayLongPress={300}
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
              </TouchableOpacity>
            </VoiceFocusable>
          );
        })}
      </ScrollView>
      </View>

      {/* ============================================================
          OVERLAY LAYER — Absolute positioned over content
          Contains ModuleHeader (top) and MiniPlayer (bottom)
          pointerEvents="box-none" allows touches to pass through
          ============================================================ */}
      <View style={styles.overlayLayer} pointerEvents="box-none">
        {/* Module Header — absolute positioned at top */}
        <ModuleHeader
          moduleId="books"
          icon="book"
          title={t('modules.books.listen')}
          currentSource="books"
          showAdMob={true}
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          backButtonLabel={t('common.back')}
          style={styles.absoluteHeader}
        />

        {/* Spacer pushes MiniPlayer to bottom */}
        <View style={styles.overlaySpacer} pointerEvents="none" />

        {/* Mini Player — using standardized component */}
        {currentChapter && (
          <MiniPlayer
            moduleId="books"
            artwork={currentBook?.coverImage || null}
            title={currentChapter.title}
            subtitle={currentBook?.title}
            accentColor={MODULE_COLOR}
            isPlaying={isAudioPlaying}
            isLoading={isAudioLoading}
            onPress={() => setIsPlayerExpanded(true)}
            onPlayPause={handlePlayPause}
            progressType="bar"
            progress={audioProgress.percentage / 100}
            showStopButton={true}
            onStop={handleStop}
            expandAccessibilityLabel={t('modules.books.audio.expandPlayer')}
            style={styles.absolutePlayer}
          />
        )}
      </View>

      {/* Expanded Player Modal */}
      <Modal
        visible={isPlayerExpanded && !!currentChapter}
        transparent={true}
        animationType={isReducedMotion ? 'none' : 'slide'}
        onRequestClose={() => setIsPlayerExpanded(false)}
        accessibilityViewIsModal={true}
      >
        <View style={styles.expandedPlayerOverlay}>
          <View style={[styles.expandedPlayerContent, { paddingTop: insets.top + spacing.md }]}>
            {currentChapter && currentBook && (
              <>
                {/* Top section: Artwork + Info */}
                <View style={styles.expandedTopSection}>
                  {/* Book artwork / placeholder */}
                  <Animated.View
                    style={[
                      styles.expandedArtworkContainer,
                      { transform: [{ scale: pulseAnim }] },
                    ]}
                  >
                    {currentBook.coverUrl ? (
                      <Image
                        source={{ uri: currentBook.coverUrl }}
                        style={styles.expandedArtworkImage}
                        resizeMode="cover"
                        accessibilityLabel={t('modules.books.audio.coverArt', { title: currentBook.title })}
                      />
                    ) : (
                      <View style={[styles.expandedArtwork, { backgroundColor: accentColor.primary }]}>
                        <Icon name="book" size={80} color={colors.textOnPrimary} />
                      </View>
                    )}
                    {isAudioLoading && (
                      <View style={styles.expandedArtworkOverlay}>
                        <ActivityIndicator size="large" color={colors.textOnPrimary} />
                      </View>
                    )}
                  </Animated.View>

                  {/* Chapter info */}
                  <View style={styles.expandedInfo}>
                    <Text style={styles.expandedBookTitle} numberOfLines={1}>
                      {currentBook.title}
                    </Text>
                    <Text style={styles.expandedChapterTitle} numberOfLines={2}>
                      {currentChapter.title}
                    </Text>
                    <Text style={styles.expandedChapterNumber}>
                      {t('modules.books.audio.chapterOf', {
                        current: currentChapterIndex + 1,
                        total: chapters.length,
                      })}
                    </Text>
                  </View>
                </View>

                {/* Middle section: Progress + Controls */}
                <View style={styles.expandedMiddleSection}>
                  {/* Progress bar — smooth draggable slider */}
                  <View style={styles.progressSection}>
                  <SeekSlider
                    value={isSeeking ? seekPosition : audioProgress.position}
                    duration={audioProgress.duration || 1}
                    onSeekStart={() => setIsSeeking(true)}
                    onSeeking={(position) => setSeekPosition(position)}
                    onSeekEnd={(position) => {
                      handleSeek(position);
                      setIsSeeking(false);
                    }}
                    accentColor={accentColor.primary}
                    accessibilityLabel={`${formatTime(charsToSeconds(isSeeking ? seekPosition : audioProgress.position))} ${t('common.of')} ${formatTime(charsToSeconds(audioProgress.duration))}`}
                    accessibilityStep={TTS_CHARS_PER_SECOND * 10}
                    testID="book-seek-slider"
                  />
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressTime}>
                      {formatTime(charsToSeconds(isSeeking ? seekPosition : audioProgress.position))}
                    </Text>
                    <Text style={styles.progressTime}>
                      -{formatTime(charsToSeconds(audioProgress.duration - (isSeeking ? seekPosition : audioProgress.position)))}
                    </Text>
                  </View>
                </View>

                {/* Controls */}
                <View style={styles.expandedControls}>
                  {/* Left side controls */}
                  <View style={styles.controlsSide}>
                    {/* Speed */}
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => {
                        triggerFeedback('tap');
                        setIsPlayerExpanded(false);
                        setTimeout(() => setShowSpeedPicker(true), 100);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.books.audio.playbackSpeed', { rate: `${playbackRate}x` })}
                    >
                      <Text style={styles.secondaryButtonText}>{playbackRate}x</Text>
                    </TouchableOpacity>

                    {/* Previous chapter */}
                    <TouchableOpacity
                      style={[styles.skipButton, currentChapterIndex === 0 && styles.skipButtonDisabled]}
                      onPress={async () => {
                        await triggerFeedback('tap');
                        await previousChapter();
                      }}
                      disabled={currentChapterIndex === 0}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.books.audio.previousChapter')}
                    >
                      <Icon
                        name="chevron-left"
                        size={24}
                        color={currentChapterIndex === 0 ? colors.textDisabled : colors.textPrimary}
                      />
                      <Icon
                        name="chevron-left"
                        size={24}
                        color={currentChapterIndex === 0 ? colors.textDisabled : colors.textPrimary}
                        style={{ marginLeft: -12 }}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Center: Play/Pause */}
                  <TouchableOpacity
                    style={[styles.mainPlayButton, { backgroundColor: accentColor.primary }]}
                    onPress={handlePlayPause}
                    disabled={isAudioLoading}
                    accessibilityRole="button"
                    accessibilityLabel={isAudioPlaying ? t('modules.books.audio.pause') : t('modules.books.audio.play')}
                  >
                    {isAudioLoading ? (
                      <ActivityIndicator size="large" color={colors.textOnPrimary} />
                    ) : (
                      <Icon
                        name={isAudioPlaying ? 'pause' : 'play'}
                        size={40}
                        color={colors.textOnPrimary}
                      />
                    )}
                  </TouchableOpacity>

                  {/* Right side controls */}
                  <View style={styles.controlsSide}>
                    {/* Next chapter */}
                    <TouchableOpacity
                      style={[styles.skipButton, currentChapterIndex === chapters.length - 1 && styles.skipButtonDisabled]}
                      onPress={async () => {
                        await triggerFeedback('tap');
                        await nextChapter();
                      }}
                      disabled={currentChapterIndex === chapters.length - 1}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.books.audio.nextChapter')}
                    >
                      <Icon
                        name="chevron-right"
                        size={24}
                        color={currentChapterIndex === chapters.length - 1 ? colors.textDisabled : colors.textPrimary}
                      />
                      <Icon
                        name="chevron-right"
                        size={24}
                        color={currentChapterIndex === chapters.length - 1 ? colors.textDisabled : colors.textPrimary}
                        style={{ marginLeft: -12 }}
                      />
                    </TouchableOpacity>

                    {/* Sleep timer */}
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => {
                        triggerFeedback('tap');
                        setIsPlayerExpanded(false);
                        setTimeout(() => setShowSleepTimerPicker(true), 100);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        sleepTimerMinutes
                          ? t('modules.books.audio.sleepTimerActive', { minutes: sleepTimerMinutes })
                          : t('modules.books.audio.sleepTimer')
                      }
                    >
                      <Icon
                        name="time"
                        size={20}
                        color={sleepTimerMinutes ? accentColor.primary : colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                  {/* Skip controls row */}
                  <View style={styles.skipControlsRow}>
                    <TouchableOpacity
                      style={styles.skipTimeButton}
                      onPress={() => skipAudioBackward(10)}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.books.audio.skipBackward', { seconds: 10 })}
                    >
                      <Icon name="chevron-left" size={20} color={colors.textSecondary} />
                      <Text style={styles.skipTimeText}>10s</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.skipTimeButton}
                      onPress={() => skipAudioForward(30)}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.books.audio.skipForward', { seconds: 30 })}
                    >
                      <Text style={styles.skipTimeText}>30s</Text>
                      <Icon name="chevron-right" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Bottom section: Minimize button */}
                <View style={[styles.expandedBottomSection, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
                  <TouchableOpacity
                    style={styles.minimizeButton}
                    onPress={() => {
                      triggerFeedback('tap');
                      setIsPlayerExpanded(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('modules.books.audio.collapsePlayer')}
                  >
                    <Icon name="chevron-down" size={28} color={colors.textSecondary} />
                    <Text style={styles.minimizeButtonText}>{t('modules.books.audio.collapsePlayer')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Speed Picker Modal */}
      <Modal
        visible={showSpeedPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSpeedPicker(false);
          setTimeout(() => setIsPlayerExpanded(true), 100);
        }}
      >
        <TouchableOpacity
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
              <TouchableOpacity
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
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sleep Timer Picker Modal */}
      <Modal
        visible={showSleepTimerPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSleepTimerPicker(false);
          setTimeout(() => setIsPlayerExpanded(true), 100);
        }}
      >
        <TouchableOpacity
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
              <TouchableOpacity
                style={styles.pickerOption}
                onPress={() => handleSleepTimer(null)}
              >
                <Text style={[styles.pickerOptionText, { color: colors.error }]}>
                  {t('modules.books.audio.sleepTimerCancel')}
                </Text>
              </TouchableOpacity>
            )}
            {SLEEP_TIMER_OPTIONS.map((minutes) => (
              <TouchableOpacity
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
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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

  // Mini Player styles removed — using standardized MiniPlayer component

  // Expanded Player
  expandedPlayerOverlay: {
    flex: 1,
    backgroundColor: colors.background,
  },
  expandedPlayerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  expandedTopSection: {
    alignItems: 'center',
  },
  expandedMiddleSection: {
    width: '100%',
    alignItems: 'center',
  },
  expandedBottomSection: {
    width: '100%',
    alignItems: 'center',
  },
  expandedArtworkContainer: {
    marginVertical: spacing.lg,
  },
  expandedArtwork: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedArtworkImage: {
    width: 200,
    height: 280,
    borderRadius: borderRadius.lg,
  },
  expandedArtworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedInfo: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  expandedBookTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  expandedChapterTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  expandedChapterNumber: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // Progress Section
  progressSection: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  progressTime: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // Controls
  expandedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: spacing.md,
  },
  controlsSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondaryButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: touchTargets.minimum / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  skipButton: {
    width: touchTargets.comfortable,
    height: touchTargets.comfortable,
    borderRadius: touchTargets.comfortable / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  skipButtonDisabled: {
    opacity: 0.5,
  },
  mainPlayButton: {
    width: touchTargets.large,
    height: touchTargets.large,
    borderRadius: touchTargets.large / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
  },

  // Skip controls row
  skipControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl * 2,
    marginBottom: spacing.lg,
  },
  skipTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
  },
  skipTimeText: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // Minimize button
  minimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.xs,
  },
  minimizeButtonText: {
    ...typography.body,
    color: colors.textSecondary,
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
