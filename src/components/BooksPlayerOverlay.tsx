/**
 * BooksPlayerOverlay — Full-screen TTS player overlay for Books
 *
 * Shows when TTS read-aloud is active:
 * - Book title and author
 * - Animated reading indicator
 * - Seekbar for reading position
 * - Play/pause/stop controls (senior-friendly)
 * - Skip back/forward buttons (-10s / +30s)
 * - Playback speed control
 * - Sleep timer
 * - Voice selection with quality badge
 * - Single-voice hint (when only 1 high-quality voice available)
 *
 * Voice commands supported:
 * - "speel" / "play" — Resume playback
 * - "pauze" / "pause" — Pause playback
 * - "stop" — Stop playback
 * - "vooruit" / "skip" — Skip forward 30s
 * - "terug" / "back" — Skip backward 10s
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
  Modal,
  Animated,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon } from '@/components';
import { useBooksContext, type TtsVoice } from '@/contexts/BooksContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';

// ============================================================
// Constants
// ============================================================

// Module color (consistent with WheelNavigationMenu and BooksScreen)
const BOOKS_MODULE_COLOR = '#9C27B0';

// Speed options
const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

// Sleep timer options (in minutes)
const SLEEP_TIMER_OPTIONS = [null, 15, 30, 45, 60];

// ============================================================
// Component
// ============================================================

export function BooksPlayerOverlay() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { accentColor } = useAccentColor();
  const isReducedMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();

  const {
    currentBook,
    isSpeaking,
    isPaused,
    ttsProgress,
    ttsSettings,
    voiceQualityStatus,
    showPlayer,
    setShowPlayer,
    startReading,
    pauseReading,
    resumeReading,
    stopReading,
    setTtsRate,
    setSleepTimer,
    selectVoice,
  } = useBooksContext();

  // Local state
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // Animation for reading pulse indicator
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (isSpeaking && !isReducedMotion) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.85,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSpeaking, isReducedMotion, pulseAnim]);

  // ============================================================
  // Handlers
  // ============================================================

  const handlePlayPause = useCallback(async () => {
    await triggerFeedback('tap');

    if (isSpeaking) {
      await pauseReading();
    } else if (isPaused) {
      await resumeReading();
    } else {
      await startReading();
    }
  }, [isSpeaking, isPaused, pauseReading, resumeReading, startReading, triggerFeedback]);

  const handleStop = useCallback(async () => {
    await triggerFeedback('tap');
    await stopReading();
  }, [stopReading, triggerFeedback]);

  const handleClose = useCallback(() => {
    triggerFeedback('tap');
    setShowPlayer(false);
  }, [setShowPlayer, triggerFeedback]);

  const handleSpeedSelect = useCallback(async (speed: number) => {
    await triggerFeedback('tap');
    await setTtsRate(speed);
    setShowSpeedModal(false);
  }, [setTtsRate, triggerFeedback]);

  const handleSleepTimerSelect = useCallback((minutes: number | null) => {
    triggerFeedback('tap');
    setSleepTimer(minutes);
    setShowSleepTimerModal(false);
  }, [setSleepTimer, triggerFeedback]);

  const handleVoiceSelect = useCallback(async (voice: TtsVoice) => {
    await triggerFeedback('tap');
    await selectVoice(voice);
    setShowVoiceModal(false);
  }, [selectVoice, triggerFeedback]);

  const handleOpenSettings = useCallback(async () => {
    await triggerFeedback('tap');

    if (Platform.OS === 'ios') {
      const settingsUrl = 'App-Prefs:ACCESSIBILITY';
      const canOpen = await Linking.canOpenURL(settingsUrl);

      if (canOpen) {
        await Linking.openURL(settingsUrl);
      } else {
        await Linking.openSettings();
      }
    } else {
      await Linking.openSettings();
    }
  }, [triggerFeedback]);

  // ============================================================
  // Render
  // ============================================================

  if (!showPlayer || !currentBook) {
    return null;
  }

  const isSingleVoice = voiceQualityStatus?.highQualityVoices.length === 1;

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
            <Icon name="book" size={24} color={BOOKS_MODULE_COLOR} />
            <Text style={styles.headerTitle}>{t('modules.books.title')}</Text>
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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Animated reading indicator */}
          <Animated.View
            style={[
              styles.readingIndicator,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <View style={[styles.readingIconContainer, { backgroundColor: BOOKS_MODULE_COLOR }]}>
              <Icon name="book-open" size={80} color={colors.textOnPrimary} strokeWidth={1.5} />
            </View>
          </Animated.View>

          {/* Book info */}
          <View style={styles.bookInfo}>
            <Text
              style={styles.bookTitle}
              numberOfLines={2}
              accessibilityRole="header"
            >
              {currentBook.title}
            </Text>
            <Text style={styles.authorName} numberOfLines={1}>
              {currentBook.author}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${ttsProgress.percentage}%`,
                    backgroundColor: BOOKS_MODULE_COLOR,
                  },
                ]}
              />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressText}>
                {isSpeaking
                  ? t('modules.books.tts.reading')
                  : isPaused
                    ? t('modules.books.tts.paused')
                    : t('modules.books.tts.readAloud')}
              </Text>
              <Text style={styles.progressText}>
                {Math.round(ttsProgress.percentage)}%
              </Text>
            </View>
          </View>

          {/* Playback controls */}
          <View style={styles.controls}>
            {/* Sleep timer button */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                triggerFeedback('tap');
                setShowSleepTimerModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                ttsSettings.sleepTimerMinutes
                  ? t('modules.books.tts.sleepTimerActive', { minutes: ttsSettings.sleepTimerMinutes })
                  : t('modules.books.tts.sleepTimer')
              }
            >
              <Icon
                name="clock"
                size={28}
                color={ttsSettings.sleepTimerMinutes ? accentColor.primary : colors.textSecondary}
              />
              {ttsSettings.sleepTimerMinutes && (
                <View style={[styles.badge, { backgroundColor: accentColor.primary }]}>
                  <Text style={styles.badgeText}>{ttsSettings.sleepTimerMinutes}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Play/Pause button (large, primary) */}
            <TouchableOpacity
              style={[styles.playButton, { backgroundColor: accentColor.primary }]}
              onPress={handlePlayPause}
              accessibilityRole="button"
              accessibilityLabel={
                isSpeaking
                  ? t('modules.books.tts.pause')
                  : isPaused
                    ? t('modules.books.tts.resume')
                    : t('modules.books.tts.readAloud')
              }
            >
              <Icon
                name={isSpeaking ? 'pause' : 'play'}
                size={48}
                color={colors.textOnPrimary}
              />
            </TouchableOpacity>

            {/* Stop button */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleStop}
              disabled={!isSpeaking && !isPaused}
              accessibilityRole="button"
              accessibilityLabel={t('modules.books.tts.stop')}
              accessibilityState={{ disabled: !isSpeaking && !isPaused }}
            >
              <Icon
                name="stop"
                size={28}
                color={isSpeaking || isPaused ? colors.textSecondary : colors.textTertiary}
              />
            </TouchableOpacity>
          </View>

          {/* Speed and Voice selection row */}
          <View style={styles.settingsRow}>
            {/* Speed button */}
            <TouchableOpacity
              style={styles.settingButton}
              onPress={() => {
                triggerFeedback('tap');
                setShowSpeedModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('modules.books.tts.speed') + ': ' + ttsSettings.playbackRate + 'x'}
            >
              <Icon name="gauge" size={20} color={colors.textSecondary} />
              <Text style={styles.settingButtonText}>
                {ttsSettings.playbackRate}x
              </Text>
            </TouchableOpacity>

            {/* Voice button */}
            <TouchableOpacity
              style={styles.settingButton}
              onPress={() => {
                triggerFeedback('tap');
                setShowVoiceModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                voiceQualityStatus?.selectedVoice
                  ? t('modules.books.tts.changeVoice', { voice: voiceQualityStatus.selectedVoice.name })
                  : t('modules.books.tts.selectVoice')
              }
            >
              <Icon name="mic" size={20} color={colors.textSecondary} />
              <Text style={styles.settingButtonText} numberOfLines={1}>
                {voiceQualityStatus?.selectedVoice?.name || t('modules.books.tts.selectVoice')}
              </Text>
              {voiceQualityStatus?.selectedVoice && (
                <View style={[
                  styles.qualityBadge,
                  voiceQualityStatus.selectedVoice.quality === 'premium'
                    ? { backgroundColor: `${BOOKS_MODULE_COLOR}20` }
                    : { backgroundColor: colors.border }
                ]}>
                  <Text style={[
                    styles.qualityBadgeText,
                    voiceQualityStatus.selectedVoice.quality === 'premium'
                      ? { color: BOOKS_MODULE_COLOR }
                      : { color: colors.textSecondary }
                  ]}>
                    {voiceQualityStatus.selectedVoice.quality === 'premium'
                      ? t('modules.books.tts.premiumShort')
                      : t('modules.books.tts.enhancedShort')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Single voice hint */}
          {isSingleVoice && (
            <TouchableOpacity
              style={styles.singleVoiceHint}
              onPress={handleOpenSettings}
              accessibilityRole="button"
              accessibilityLabel={t('modules.books.tts.singleVoiceHint')}
              accessibilityHint={t('modules.books.tts.singleVoiceHintAction')}
            >
              <Icon name="info" size={18} color={colors.textSecondary} />
              <Text style={styles.singleVoiceHintText}>
                {t('modules.books.tts.singleVoiceHint')}
              </Text>
              <Icon name="external-link" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Voice hint */}
        <View style={styles.voiceHint}>
          <Text style={styles.voiceHintText}>
            {t('modules.books.tts.playerVoiceHint')}
          </Text>
        </View>
      </View>

      {/* Speed selection modal */}
      <Modal
        visible={showSpeedModal}
        transparent={true}
        animationType={isReducedMotion ? 'none' : 'fade'}
        onRequestClose={() => setShowSpeedModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSpeedModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={styles.modalTitle}>{t('modules.books.tts.speed')}</Text>
            <View style={styles.speedOptions}>
              {SPEED_OPTIONS.map((speed) => (
                <TouchableOpacity
                  key={speed}
                  style={[
                    styles.speedOption,
                    ttsSettings.playbackRate === speed && {
                      backgroundColor: accentColor.primary,
                      borderColor: accentColor.primary,
                    },
                  ]}
                  onPress={() => handleSpeedSelect(speed)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ttsSettings.playbackRate === speed }}
                >
                  <Text
                    style={[
                      styles.speedOptionText,
                      ttsSettings.playbackRate === speed && { color: colors.textOnPrimary },
                    ]}
                  >
                    {speed}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sleep timer modal */}
      <Modal
        visible={showSleepTimerModal}
        transparent={true}
        animationType={isReducedMotion ? 'none' : 'fade'}
        onRequestClose={() => setShowSleepTimerModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSleepTimerModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={styles.modalTitle}>{t('modules.books.tts.sleepTimer')}</Text>
            <View style={styles.sleepTimerOptions}>
              {SLEEP_TIMER_OPTIONS.map((minutes) => (
                <TouchableOpacity
                  key={minutes ?? 'off'}
                  style={[
                    styles.sleepTimerOption,
                    ttsSettings.sleepTimerMinutes === minutes && {
                      backgroundColor: accentColor.primary,
                      borderColor: accentColor.primary,
                    },
                  ]}
                  onPress={() => handleSleepTimerSelect(minutes)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ttsSettings.sleepTimerMinutes === minutes }}
                >
                  <Text
                    style={[
                      styles.sleepTimerOptionText,
                      ttsSettings.sleepTimerMinutes === minutes && { color: colors.textOnPrimary },
                    ]}
                  >
                    {minutes === null ? t('modules.books.tts.sleepTimerOff') : `${minutes} min`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Voice selection modal */}
      <Modal
        visible={showVoiceModal}
        transparent={true}
        animationType={isReducedMotion ? 'none' : 'slide'}
        onRequestClose={() => setShowVoiceModal(false)}
      >
        <View style={styles.voiceModalOverlay}>
          <View style={[styles.voiceModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.voiceModalHeader}>
              <Icon name="mic" size={32} color={BOOKS_MODULE_COLOR} />
              <Text style={styles.voiceModalTitle}>
                {t('modules.books.tts.selectVoiceTitle')}
              </Text>
            </View>

            <Text style={styles.voiceModalSubtitle}>
              {t('modules.books.tts.selectVoiceSubtitle')}
            </Text>

            <ScrollView style={styles.voiceList}>
              {voiceQualityStatus?.highQualityVoices.map((voice) => (
                <TouchableOpacity
                  key={voice.id}
                  style={[
                    styles.voiceOption,
                    voiceQualityStatus.selectedVoice?.id === voice.id && {
                      backgroundColor: accentColor.primary,
                      borderColor: accentColor.primary,
                    },
                  ]}
                  onPress={() => handleVoiceSelect(voice)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: voiceQualityStatus.selectedVoice?.id === voice.id }}
                  accessibilityLabel={`${voice.name} - ${
                    voice.quality === 'premium'
                      ? t('modules.books.tts.premiumVoice')
                      : t('modules.books.tts.enhancedVoice')
                  }`}
                >
                  <View style={styles.voiceOptionContent}>
                    <Icon
                      name="mic"
                      size={24}
                      color={
                        voiceQualityStatus.selectedVoice?.id === voice.id
                          ? colors.textOnPrimary
                          : colors.textPrimary
                      }
                    />
                    <View style={styles.voiceOptionText}>
                      <Text
                        style={[
                          styles.voiceOptionName,
                          voiceQualityStatus.selectedVoice?.id === voice.id && {
                            color: colors.textOnPrimary,
                          },
                        ]}
                      >
                        {voice.name}
                      </Text>
                      <View style={styles.voiceQualityRow}>
                        <Text
                          style={[
                            styles.voiceOptionQuality,
                            voiceQualityStatus.selectedVoice?.id === voice.id && {
                              color: colors.textOnPrimary,
                            },
                          ]}
                        >
                          {voice.quality === 'premium'
                            ? t('modules.books.tts.premiumVoice')
                            : t('modules.books.tts.enhancedVoice')}
                        </Text>
                        {voice.quality === 'premium' && (
                          <View style={[
                            styles.recommendedBadge,
                            voiceQualityStatus.selectedVoice?.id === voice.id && {
                              backgroundColor: 'rgba(255,255,255,0.3)',
                            },
                          ]}>
                            <Text style={[
                              styles.recommendedBadgeText,
                              voiceQualityStatus.selectedVoice?.id === voice.id && {
                                color: colors.textOnPrimary,
                              },
                            ]}>
                              {t('modules.books.tts.recommended')}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  {voiceQualityStatus.selectedVoice?.id === voice.id && (
                    <Icon name="check" size={24} color={colors.textOnPrimary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.voiceModalCancelButton}
              onPress={() => setShowVoiceModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.voiceModalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  readingIndicator: {
    marginBottom: spacing.xl,
  },
  readingIconContainer: {
    width: 180,
    height: 180,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  bookInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  bookTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  authorName: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  secondaryButton: {
    width: touchTargets.comfortable,
    height: touchTargets.comfortable,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    ...typography.small,
    fontSize: 10,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  playButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  settingsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
  },
  settingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: touchTargets.comfortable,
  },
  settingButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
    flexShrink: 1,
  },
  qualityBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  qualityBadgeText: {
    ...typography.small,
    fontSize: 10,
    fontWeight: '600',
  },
  singleVoiceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    width: '100%',
  },
  singleVoiceHintText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
  },
  voiceHint: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  voiceHintText: {
    ...typography.small,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  speedOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  speedOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minWidth: 70,
    alignItems: 'center',
  },
  speedOptionText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  sleepTimerOptions: {
    gap: spacing.sm,
  },
  sleepTimerOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  sleepTimerOptionText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  // Voice modal styles
  voiceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  voiceModalContent: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  voiceModalHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  voiceModalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  voiceModalSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  voiceList: {
    maxHeight: 300,
  },
  voiceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
    minHeight: touchTargets.comfortable,
  },
  voiceOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  voiceOptionText: {
    flex: 1,
  },
  voiceOptionName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  voiceOptionQuality: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  voiceQualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  recommendedBadge: {
    backgroundColor: `${BOOKS_MODULE_COLOR}20`,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  recommendedBadgeText: {
    ...typography.small,
    fontSize: 11,
    color: BOOKS_MODULE_COLOR,
    fontWeight: '600',
  },
  voiceModalCancelButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  voiceModalCancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
