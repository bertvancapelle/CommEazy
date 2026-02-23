/**
 * BookReaderScreen — E-book reader with TTS support
 *
 * Senior-inclusive reading experience with:
 * - Large, adjustable text (Dynamic Type support)
 * - TTS read-aloud with play/pause/stop
 * - Page navigation (swipe or buttons)
 * - Progress tracking and auto-save
 * - Sleep timer for bedtime reading
 * - Themes: light, sepia, dark
 *
 * Voice commands supported:
 * - "speel" / "play" — Start TTS reading
 * - "pauze" / "pause" — Pause TTS
 * - "stop" — Stop TTS
 * - "volgende" / "next" — Next page
 * - "vorige" / "previous" — Previous page
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  PanResponder,
  Linking,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, IconButton } from '@/components';
import { useBooksContext } from '@/contexts/BooksContext';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';

// ============================================================
// Constants
// ============================================================

const BOOKS_MODULE_COLOR = '#FF8F00';  // Amber color

// Theme configurations
const THEMES = {
  light: {
    background: '#FFFFFF',
    text: '#1A1A1A',
    secondary: '#666666',
  },
  sepia: {
    background: '#F8F0E3',
    text: '#5C4033',
    secondary: '#8B7355',
  },
  dark: {
    background: '#1A1A1A',
    text: '#E8E8E8',
    secondary: '#999999',
  },
};

// Font size configurations
const FONT_SIZES = {
  small: 16,
  medium: 18,
  large: 22,
  xlarge: 26,
};

// Line height configurations
const LINE_HEIGHTS = {
  normal: 1.4,
  relaxed: 1.6,
  loose: 1.8,
};

// Sleep timer options (in minutes)
const SLEEP_TIMER_OPTIONS = [null, 15, 30, 45, 60];

// ============================================================
// Component
// ============================================================

export function BookReaderScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { accentColor } = useAccentColor();
  const isReducedMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();
  const themeColors = useColors();

  // Books Context
  const {
    currentBook,
    currentPage,
    currentPageNumber,
    totalPages,
    isSpeaking,
    isPaused,
    isLoading,
    ttsProgress,
    readerSettings,
    ttsSettings,
    voiceQualityStatus,
    closeBook,
    nextPage,
    previousPage,
    goToPage,
    startReading,
    pauseReading,
    resumeReading,
    stopReading,
    setSleepTimer,
    updateReaderSettings,
    selectVoice,
    refreshVoiceQualityStatus,
  } = useBooksContext();

  // State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [showNoHighQualityVoiceModal, setShowNoHighQualityVoiceModal] = useState(false);
  const [showVoiceSelectionModal, setShowVoiceSelectionModal] = useState(false);
  const [showVoiceUnavailableModal, setShowVoiceUnavailableModal] = useState(false);

  // Theme and styles
  const theme = THEMES[readerSettings.theme];
  const fontSize = FONT_SIZES[readerSettings.fontSize];
  const lineHeight = LINE_HEIGHTS[readerSettings.lineHeight];

  // Swipe gesture for page navigation
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 30;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          // Swipe left = next page
          triggerFeedback('tap');
          nextPage();
        } else if (gestureState.dx > 50) {
          // Swipe right = previous page
          triggerFeedback('tap');
          previousPage();
        }
      },
    });
  }, [nextPage, previousPage, triggerFeedback]);

  // Handle back navigation
  const handleClose = useCallback(() => {
    triggerFeedback('tap');
    closeBook();
    navigation.goBack();
  }, [closeBook, navigation, triggerFeedback]);

  // Handle TTS play/pause
  const handlePlayPause = useCallback(async () => {
    triggerFeedback('tap');

    // Check voice quality status before playing
    // Enhanced = minimum required, Premium = recommended
    if (!isSpeaking && !isPaused) {
      // Refresh voice status - voice might have been deleted while app was in background
      await refreshVoiceQualityStatus();

      // Re-check after refresh (need to use fresh data)
      const freshStatus = voiceQualityStatus;

      // User wants to start reading
      if (!freshStatus?.hasHighQualityVoice) {
        // No Enhanced OR Premium voice available - show blocking modal
        setShowNoHighQualityVoiceModal(true);
        return;
      }

      // Check if previously selected voice is still available
      if (freshStatus.selectedVoice) {
        const voiceStillExists = freshStatus.highQualityVoices.some(
          v => v.id === freshStatus.selectedVoice?.id
        );
        if (!voiceStillExists) {
          // Voice was deleted - show modal to choose new voice
          setShowVoiceUnavailableModal(true);
          return;
        }
      }

      // Multiple high-quality voices available and user hasn't explicitly chosen one?
      // Show the selection modal so they can pick their preferred voice
      if (freshStatus.highQualityVoices.length > 1 && !freshStatus.userHasSelectedVoice) {
        setShowVoiceSelectionModal(true);
        return;
      }
    }

    if (isSpeaking) {
      await pauseReading();
    } else if (isPaused) {
      await resumeReading();
    } else {
      await startReading();
    }
  }, [isSpeaking, isPaused, pauseReading, resumeReading, startReading, triggerFeedback, voiceQualityStatus, refreshVoiceQualityStatus]);

  // Open iOS Settings for voice download
  const handleOpenSettings = useCallback(async () => {
    triggerFeedback('tap');
    setShowNoHighQualityVoiceModal(false);

    if (Platform.OS === 'ios') {
      // Try to open Accessibility > Spoken Content settings
      // Note: Direct deep link may not work on all iOS versions
      const settingsUrl = 'App-Prefs:ACCESSIBILITY';
      const canOpen = await Linking.canOpenURL(settingsUrl);

      if (canOpen) {
        await Linking.openURL(settingsUrl);
      } else {
        // Fallback to general settings
        await Linking.openSettings();
      }
    } else {
      // Android: open general settings
      await Linking.openSettings();
    }
  }, [triggerFeedback]);

  // Handle voice selection
  const handleSelectVoice = useCallback(async (voice: typeof voiceQualityStatus extends { highQualityVoices: (infer V)[] } ? V : never) => {
    triggerFeedback('tap');
    await selectVoice(voice);
    setShowVoiceSelectionModal(false);

    // Start reading after voice selection
    await startReading();
  }, [triggerFeedback, selectVoice, startReading]);

  // Handle auto-select best voice (when previous voice unavailable)
  const handleAutoSelectBestVoice = useCallback(async () => {
    triggerFeedback('tap');
    setShowVoiceUnavailableModal(false);

    // Auto-select the best available voice (Premium > Enhanced)
    if (voiceQualityStatus?.premiumVoices[0]) {
      await selectVoice(voiceQualityStatus.premiumVoices[0]);
    } else if (voiceQualityStatus?.highQualityVoices[0]) {
      await selectVoice(voiceQualityStatus.highQualityVoices[0]);
    }

    // Start reading
    await startReading();
  }, [triggerFeedback, voiceQualityStatus, selectVoice, startReading]);

  // Handle choose new voice (when previous voice unavailable)
  const handleChooseNewVoice = useCallback(() => {
    triggerFeedback('tap');
    setShowVoiceUnavailableModal(false);
    setShowVoiceSelectionModal(true);
  }, [triggerFeedback]);

  // Open voice selection modal from voice label
  const handleOpenVoiceSelection = useCallback(() => {
    triggerFeedback('tap');
    setShowVoiceSelectionModal(true);
  }, [triggerFeedback]);

  // Handle TTS stop
  const handleStop = useCallback(async () => {
    triggerFeedback('tap');
    await stopReading();
  }, [stopReading, triggerFeedback]);

  // Sleep timer selection
  const handleSleepTimer = useCallback((minutes: number | null) => {
    triggerFeedback('tap');
    setSleepTimer(minutes);
    setShowSleepTimerModal(false);
  }, [setSleepTimer, triggerFeedback]);

  // Render no book state
  if (!currentBook) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyContainer}>
          <Icon name="book" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyText}>{t('modules.books.reading.noBook')}</Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: accentColor.primary }]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Text style={styles.backButtonText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Progress percentage
  const progressPercent = totalPages > 0 ? (currentPageNumber / totalPages) * 100 : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top controls - always visible */}
      <View
        style={[
          styles.topControls,
          {
            paddingTop: insets.top + spacing.sm,
            backgroundColor: theme.background,
          },
        ]}
      >
        {/* Back button */}
        <IconButton
          icon="arrow-left"
          onPress={handleClose}
          accessibilityLabel={t('common.back')}
          size={24}
        />

        {/* Book title */}
        <View style={styles.titleContainer}>
          <Text
            style={[styles.bookTitle, { color: theme.text }]}
            numberOfLines={1}
          >
            {currentBook.title}
          </Text>
        </View>

        {/* Settings button */}
        <IconButton
          icon="settings"
          onPress={() => {
            triggerFeedback('tap');
            setShowSettingsModal(true);
          }}
          accessibilityLabel={t('modules.books.reading.settings')}
          size={24}
        />
      </View>

      {/* Reading content area - fills remaining space */}
      <View style={styles.contentWrapper} {...panResponder.panHandlers}>
        <ScrollView
          style={styles.contentScrollView}
          contentContainerStyle={[
            styles.contentContainer,
            // Add padding for bottom controls (fixed position)
            { paddingBottom: 180 + insets.bottom },
          ]}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={accentColor.primary} />
              <Text style={[styles.loadingText, { color: theme.secondary }]}>
                {t('modules.books.loading')}
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.pageContent,
                {
                  color: theme.text,
                  fontSize,
                  lineHeight: fontSize * lineHeight,
                },
              ]}
              selectable
            >
              {currentPage}
            </Text>
          )}
        </ScrollView>
      </View>

      {/* Bottom controls - always visible */}
      <View
        style={[
          styles.bottomControls,
          {
            paddingBottom: insets.bottom + spacing.sm,
            backgroundColor: theme.background,
          },
        ]}
      >
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: accentColor.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.secondary }]}>
            {t('modules.books.reading.page', {
              current: currentPageNumber,
              total: totalPages,
            })}
          </Text>
        </View>

        {/* Page navigation */}
        <View style={styles.navigationRow}>
          {/* Previous page */}
          <TouchableOpacity
            style={[
              styles.pageButton,
              currentPageNumber <= 1 && styles.pageButtonDisabled,
            ]}
            onPress={() => {
              triggerFeedback('tap');
              previousPage();
            }}
            disabled={currentPageNumber <= 1}
            accessibilityRole="button"
            accessibilityLabel={t('modules.books.reading.previousPage')}
            accessibilityState={{ disabled: currentPageNumber <= 1 }}
          >
            <Icon
              name="chevron-left"
              size={32}
              color={currentPageNumber <= 1 ? colors.textTertiary : theme.text}
            />
          </TouchableOpacity>

          {/* TTS controls */}
          <View style={styles.ttsControls}>
            {/* Sleep timer */}
            <IconButton
              icon="clock"
              isActive={ttsSettings.sleepTimerMinutes !== null}
              onPress={() => {
                triggerFeedback('tap');
                setShowSleepTimerModal(true);
              }}
              accessibilityLabel={
                ttsSettings.sleepTimerMinutes
                  ? t('modules.books.tts.sleepTimerActive', { minutes: ttsSettings.sleepTimerMinutes })
                  : t('modules.books.tts.sleepTimer')
              }
              size={24}
            />

            {/* Play/Pause with Voice Quality Warning and Voice Label */}
            <View style={styles.playButtonWrapper}>
              <View style={styles.playButtonContainer}>
                <TouchableOpacity
                  style={[styles.playButton, { backgroundColor: accentColor.primary }]}
                  onPress={handlePlayPause}
                  accessibilityRole="button"
                  accessibilityLabel={
                    !voiceQualityStatus?.hasHighQualityVoice
                      ? t('modules.books.tts.noHighQualityVoice')
                      : isSpeaking
                        ? t('modules.books.tts.pause')
                        : isPaused
                          ? t('modules.books.tts.resume')
                          : t('modules.books.tts.readAloud')
                  }
                  accessibilityHint={
                    !voiceQualityStatus?.hasHighQualityVoice
                      ? t('modules.books.tts.noHighQualityVoiceHint')
                      : undefined
                  }
                >
                  <Icon
                    name={isSpeaking ? 'pause' : 'play'}
                    size={32}
                    color={colors.textOnPrimary}
                  />
                </TouchableOpacity>
                {/* Warning badge when no Enhanced/Premium voice */}
                {!voiceQualityStatus?.hasHighQualityVoice && (
                  <View style={styles.warningBadge}>
                    <Icon name="alert-circle" size={20} color={colors.textOnPrimary} />
                  </View>
                )}
              </View>

              {/* Voice label under play button */}
              {voiceQualityStatus?.selectedVoice && (
                <TouchableOpacity
                  style={styles.voiceLabelContainer}
                  onPress={handleOpenVoiceSelection}
                  accessibilityRole="button"
                  accessibilityLabel={t('modules.books.tts.changeVoice', {
                    voice: voiceQualityStatus.selectedVoice.name,
                  })}
                  accessibilityHint={t('modules.books.tts.changeVoiceHint')}
                >
                  <Text style={[styles.voiceLabelText, { color: theme.secondary }]} numberOfLines={1}>
                    {voiceQualityStatus.selectedVoice.name}
                    {' '}
                    ({voiceQualityStatus.selectedVoice.quality === 'premium'
                      ? t('modules.books.tts.premiumShort')
                      : t('modules.books.tts.enhancedShort')})
                  </Text>
                  <Icon name="settings" size={14} color={theme.secondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Stop */}
            <IconButton
              icon="stop"
              onPress={handleStop}
              disabled={!isSpeaking && !isPaused}
              accessibilityLabel={t('modules.books.tts.stop')}
              size={24}
            />
          </View>

          {/* Next page */}
          <TouchableOpacity
            style={[
              styles.pageButton,
              currentPageNumber >= totalPages && styles.pageButtonDisabled,
            ]}
            onPress={() => {
              triggerFeedback('tap');
              nextPage();
            }}
            disabled={currentPageNumber >= totalPages}
            accessibilityRole="button"
            accessibilityLabel={t('modules.books.reading.nextPage')}
            accessibilityState={{ disabled: currentPageNumber >= totalPages }}
          >
            <Icon
              name="chevron-right"
              size={32}
              color={currentPageNumber >= totalPages ? colors.textTertiary : theme.text}
            />
          </TouchableOpacity>
        </View>

        {/* TTS progress indicator */}
        {(isSpeaking || isPaused) && (
          <View style={styles.ttsProgressContainer}>
            <View style={[styles.ttsProgressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.ttsProgressFill,
                  {
                    width: `${ttsProgress.percentage}%`,
                    backgroundColor: BOOKS_MODULE_COLOR,
                  },
                ]}
              />
            </View>
            <Text style={[styles.ttsProgressText, { color: theme.secondary }]}>
              {isSpeaking ? t('modules.books.tts.reading') : t('modules.books.tts.paused')}
            </Text>
          </View>
        )}
      </View>

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType={isReducedMotion ? 'none' : 'slide'}
        onRequestClose={() => setShowSettingsModal(false)}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.settingsModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>
                {t('modules.books.reading.settings')}
              </Text>
              <IconButton
                icon="close"
                onPress={() => setShowSettingsModal(false)}
                accessibilityLabel={t('common.close')}
                size={24}
              />
            </View>

            {/* Font size */}
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>
                {t('modules.books.settings.fontSize')}
              </Text>
              <View style={styles.settingOptions}>
                {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.settingOption,
                      readerSettings.fontSize === size && {
                        backgroundColor: accentColor.primary,
                        borderColor: accentColor.primary,
                      },
                    ]}
                    onPress={() => {
                      triggerFeedback('tap');
                      updateReaderSettings({ fontSize: size });
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: readerSettings.fontSize === size }}
                    accessibilityLabel={t(`modules.books.settings.fontSizes.${size}`)}
                  >
                    <Text
                      style={[
                        styles.settingOptionText,
                        readerSettings.fontSize === size && styles.settingOptionTextActive,
                        { fontSize: FONT_SIZES[size] - 4 },
                      ]}
                    >
                      A
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Line height */}
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>
                {t('modules.books.settings.lineHeight')}
              </Text>
              <View style={styles.settingOptions}>
                {(['normal', 'relaxed', 'loose'] as const).map((height) => (
                  <TouchableOpacity
                    key={height}
                    style={[
                      styles.settingOption,
                      styles.settingOptionWide,
                      readerSettings.lineHeight === height && {
                        backgroundColor: accentColor.primary,
                        borderColor: accentColor.primary,
                      },
                    ]}
                    onPress={() => {
                      triggerFeedback('tap');
                      updateReaderSettings({ lineHeight: height });
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: readerSettings.lineHeight === height }}
                    accessibilityLabel={t(`modules.books.settings.lineHeights.${height}`)}
                  >
                    <Text
                      style={[
                        styles.settingOptionText,
                        readerSettings.lineHeight === height && styles.settingOptionTextActive,
                      ]}
                    >
                      {t(`modules.books.settings.lineHeights.${height}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Theme */}
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>
                {t('modules.books.settings.theme')}
              </Text>
              <View style={styles.settingOptions}>
                {(['light', 'sepia', 'dark'] as const).map((themeKey) => (
                  <TouchableOpacity
                    key={themeKey}
                    style={[
                      styles.themeOption,
                      { backgroundColor: THEMES[themeKey].background },
                      readerSettings.theme === themeKey && {
                        borderColor: accentColor.primary,
                        borderWidth: 3,
                      },
                    ]}
                    onPress={() => {
                      triggerFeedback('tap');
                      updateReaderSettings({ theme: themeKey });
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: readerSettings.theme === themeKey }}
                    accessibilityLabel={t(`modules.books.settings.themes.${themeKey}`)}
                  >
                    <Text
                      style={[
                        styles.themeOptionText,
                        { color: THEMES[themeKey].text },
                      ]}
                    >
                      Aa
                    </Text>
                    <Text
                      style={[
                        styles.themeOptionLabel,
                        { color: THEMES[themeKey].secondary },
                      ]}
                    >
                      {t(`modules.books.settings.themes.${themeKey}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Close button */}
            <TouchableOpacity
              style={[styles.closeSettingsButton, { backgroundColor: accentColor.primary }]}
              onPress={() => setShowSettingsModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.done')}
            >
              <Text style={styles.closeSettingsButtonText}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sleep Timer Modal */}
      <Modal
        visible={showSleepTimerModal}
        transparent={true}
        animationType={isReducedMotion ? 'none' : 'fade'}
        onRequestClose={() => setShowSleepTimerModal(false)}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.sleepTimerModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.sleepTimerHeader}>
              <Icon name="clock" size={32} color={BOOKS_MODULE_COLOR} />
              <Text style={styles.sleepTimerTitle}>
                {t('modules.books.tts.sleepTimer')}
              </Text>
            </View>

            <Text style={styles.sleepTimerSubtitle}>
              {t('modules.books.tts.sleepTimerHint')}
            </Text>

            {/* Timer options */}
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
                  onPress={() => handleSleepTimer(minutes)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ttsSettings.sleepTimerMinutes === minutes }}
                  accessibilityLabel={
                    minutes === null
                      ? t('modules.books.tts.sleepTimerOff')
                      : t('modules.books.tts.sleepTimerMinutes', { minutes })
                  }
                >
                  <Text
                    style={[
                      styles.sleepTimerOptionText,
                      ttsSettings.sleepTimerMinutes === minutes && styles.sleepTimerOptionTextActive,
                    ]}
                  >
                    {minutes === null
                      ? t('modules.books.tts.sleepTimerOff')
                      : `${minutes} min`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cancel button */}
            <TouchableOpacity
              style={styles.sleepTimerCancelButton}
              onPress={() => setShowSleepTimerModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.sleepTimerCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* No High Quality Voice Modal (blocks playback) */}
      <Modal
        visible={showNoHighQualityVoiceModal}
        transparent={true}
        animationType={isReducedMotion ? 'none' : 'fade'}
        onRequestClose={() => setShowNoHighQualityVoiceModal(false)}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.noVoiceModalContent, { backgroundColor: colors.surface }]}>
            {/* Warning icon */}
            <View style={styles.noVoiceIconContainer}>
              <Icon name="alert-circle" size={48} color={colors.error} />
            </View>

            {/* Title */}
            <Text style={styles.noVoiceTitle}>
              {t('modules.books.tts.noHighQualityVoiceTitle')}
            </Text>

            {/* Description */}
            <Text style={styles.noVoiceDescription}>
              {t('modules.books.tts.noHighQualityVoiceDescription')}
            </Text>

            {/* Steps to download */}
            <View style={styles.noVoiceSteps}>
              <Text style={styles.noVoiceStep}>
                1. {t('modules.books.tts.downloadStep1')}
              </Text>
              <Text style={styles.noVoiceStep}>
                2. {t('modules.books.tts.downloadStep2')}
              </Text>
              <Text style={styles.noVoiceStep}>
                3. {t('modules.books.tts.downloadStep3')}
              </Text>
            </View>

            {/* Language info */}
            <View style={styles.noVoiceLanguageInfo}>
              <Icon name="globe" size={20} color={colors.textSecondary} />
              <Text style={styles.noVoiceLanguageText}>
                {t('modules.books.tts.voiceLanguage', { language: voiceQualityStatus?.language || 'nl' })}
              </Text>
            </View>

            {/* Open Settings button */}
            <TouchableOpacity
              style={[styles.openSettingsButton, { backgroundColor: accentColor.primary }]}
              onPress={handleOpenSettings}
              accessibilityRole="button"
              accessibilityLabel={t('modules.books.tts.openSettings')}
            >
              <Icon name="settings" size={24} color={colors.textOnPrimary} />
              <Text style={styles.openSettingsButtonText}>
                {t('modules.books.tts.openSettings')}
              </Text>
            </TouchableOpacity>

            {/* Close button */}
            <TouchableOpacity
              style={styles.noVoiceCancelButton}
              onPress={() => setShowNoHighQualityVoiceModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.noVoiceCancelText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Voice Selection Modal - shows all Enhanced + Premium voices */}
      <Modal
        visible={showVoiceSelectionModal}
        transparent={true}
        animationType={isReducedMotion ? 'none' : 'slide'}
        onRequestClose={() => setShowVoiceSelectionModal(false)}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.voiceSelectionModalContent, { backgroundColor: colors.surface }]}>
            {/* Header */}
            <View style={styles.voiceSelectionHeader}>
              <Icon name="mic" size={32} color={BOOKS_MODULE_COLOR} />
              <Text style={styles.voiceSelectionTitle}>
                {t('modules.books.tts.selectVoiceTitle')}
              </Text>
            </View>

            <Text style={styles.voiceSelectionSubtitle}>
              {t('modules.books.tts.selectVoiceSubtitle')}
            </Text>

            {/* Voice list - shows Enhanced + Premium voices */}
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
                  onPress={() => handleSelectVoice(voice)}
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

            {/* Cancel button */}
            <TouchableOpacity
              style={styles.voiceSelectionCancelButton}
              onPress={() => setShowVoiceSelectionModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.voiceSelectionCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Voice Unavailable Modal - shown when previously selected voice was deleted */}
      <Modal
        visible={showVoiceUnavailableModal}
        transparent={true}
        animationType={isReducedMotion ? 'none' : 'fade'}
        onRequestClose={() => setShowVoiceUnavailableModal(false)}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.voiceUnavailableModalContent, { backgroundColor: colors.surface }]}>
            {/* Warning icon */}
            <View style={styles.voiceUnavailableIconContainer}>
              <Icon name="alert-circle" size={48} color={colors.warning} />
            </View>

            {/* Title */}
            <Text style={styles.voiceUnavailableTitle}>
              {t('modules.books.tts.voiceUnavailableTitle')}
            </Text>

            {/* Description */}
            <Text style={styles.voiceUnavailableDescription}>
              {t('modules.books.tts.voiceUnavailableDescription')}
            </Text>

            {/* Buttons */}
            <View style={styles.voiceUnavailableButtons}>
              {/* Choose new voice button */}
              <TouchableOpacity
                style={[styles.voiceUnavailableButton, { backgroundColor: accentColor.primary }]}
                onPress={handleChooseNewVoice}
                accessibilityRole="button"
                accessibilityLabel={t('modules.books.tts.chooseNewVoice')}
              >
                <Icon name="mic" size={24} color={colors.textOnPrimary} />
                <Text style={styles.voiceUnavailableButtonText}>
                  {t('modules.books.tts.chooseNewVoice')}
                </Text>
              </TouchableOpacity>

              {/* Auto-select best button */}
              <TouchableOpacity
                style={[styles.voiceUnavailableButtonSecondary, { borderColor: accentColor.primary }]}
                onPress={handleAutoSelectBestVoice}
                accessibilityRole="button"
                accessibilityLabel={t('modules.books.tts.autoSelectBest')}
              >
                <Icon name="star" size={24} color={accentColor.primary} />
                <Text style={[styles.voiceUnavailableButtonTextSecondary, { color: accentColor.primary }]}>
                  {t('modules.books.tts.autoSelectBest')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Cancel button */}
            <TouchableOpacity
              style={styles.voiceUnavailableCancelButton}
              onPress={() => setShowVoiceUnavailableModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.voiceUnavailableCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  },
  contentWrapper: {
    flex: 1,
  },
  contentScrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 300,
  },
  loadingText: {
    ...typography.body,
  },
  pageContent: {
    ...typography.body,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    marginTop: spacing.md,
  },
  backButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  // Top controls
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  bookTitle: {
    ...typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Bottom controls - fixed at bottom
  bottomControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    // Shadow for elevation effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  progressContainer: {
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    ...typography.small,
    textAlign: 'center',
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageButton: {
    width: touchTargets.comfortable,
    height: touchTargets.comfortable,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  pageButtonDisabled: {
    opacity: 0.3,
  },
  ttsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  playButton: {
    width: touchTargets.large,
    height: touchTargets.large,
    borderRadius: touchTargets.large / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  ttsProgressContainer: {
    marginTop: spacing.sm,
  },
  ttsProgressBar: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  ttsProgressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  ttsProgressText: {
    ...typography.small,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  settingsModalContent: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  settingsTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  settingSection: {
    marginBottom: spacing.lg,
  },
  settingLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  settingOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  settingOption: {
    width: touchTargets.comfortable,
    height: touchTargets.comfortable,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  settingOptionWide: {
    width: 'auto',
    paddingHorizontal: spacing.md,
  },
  settingOptionText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  settingOptionTextActive: {
    color: colors.textOnPrimary,
  },
  themeOption: {
    flex: 1,
    minWidth: 80,
    height: 80,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeOptionText: {
    fontSize: 24,
    fontWeight: '600',
  },
  themeOptionLabel: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  closeSettingsButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.comfortable,
    marginTop: spacing.md,
  },
  closeSettingsButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  // Sleep timer modal
  sleepTimerModalContent: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  sleepTimerHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sleepTimerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sleepTimerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
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
    minHeight: touchTargets.comfortable,
    justifyContent: 'center',
  },
  sleepTimerOptionText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  sleepTimerOptionTextActive: {
    color: colors.textOnPrimary,
  },
  sleepTimerCancelButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  sleepTimerCancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  // Play button container for warning badge
  playButtonContainer: {
    position: 'relative',
  },
  warningBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  // No High Quality Voice Modal styles
  noVoiceModalContent: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  noVoiceIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.error}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  noVoiceTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  noVoiceDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  noVoiceSteps: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  noVoiceStep: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
  },
  noVoiceLanguageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  noVoiceLanguageText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  openSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    minWidth: 200,
    minHeight: touchTargets.comfortable,
    marginBottom: spacing.md,
  },
  openSettingsButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  noVoiceCancelButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  noVoiceCancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  // Voice Selection Modal styles
  voiceSelectionModalContent: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  voiceSelectionHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  voiceSelectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  voiceSelectionSubtitle: {
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
  voiceSelectionCancelButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  voiceSelectionCancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  // Voice label under play button
  playButtonWrapper: {
    alignItems: 'center',
  },
  voiceLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  voiceLabelText: {
    ...typography.small,
    fontWeight: '500',
  },
  // Voice Unavailable Modal styles
  voiceUnavailableModalContent: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  voiceUnavailableIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.warning}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  voiceUnavailableTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  voiceUnavailableDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  voiceUnavailableButtons: {
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  voiceUnavailableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
  },
  voiceUnavailableButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  voiceUnavailableButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    minHeight: touchTargets.comfortable,
    backgroundColor: 'transparent',
  },
  voiceUnavailableButtonTextSecondary: {
    ...typography.body,
    fontWeight: '600',
  },
  voiceUnavailableCancelButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  voiceUnavailableCancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
