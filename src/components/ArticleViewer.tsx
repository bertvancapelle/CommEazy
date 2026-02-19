/**
 * ArticleViewer — In-app article viewer with TTS controls
 *
 * Displays news articles with:
 * - Safari View Controller / Chrome Custom Tabs (when InAppBrowser available)
 * - Fallback to WebView or external browser
 * - AdMob banner at top
 * - TTS play/stop controls
 * - Full text extraction for TTS (optional)
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear button labels
 * - High contrast icons
 * - Haptic feedback on interactions
 *
 * @see .claude/plans/COUNTRY_SPECIFIC_MODULES.md (Fase 4)
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, IconButton, AdMobBanner } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { NewsArticle } from '@/types/modules';

// ============================================================
// Types
// ============================================================

export interface ArticleViewerProps {
  /** Whether the viewer is visible */
  visible: boolean;
  /** The article to display */
  article: NewsArticle | null;
  /** Callback when the viewer is closed */
  onClose: () => void;
  /** Accent color for the module */
  accentColor: string;

  // TTS controls
  /** Callback to start TTS playback */
  onStartTTS?: (article: NewsArticle, useFullText: boolean) => void;
  /** Callback to stop TTS playback */
  onStopTTS?: () => void;
  /** Whether TTS is currently playing */
  isTTSPlaying?: boolean;
  /** Whether TTS is loading (extracting full text) */
  isTTSLoading?: boolean;
  /** TTS progress (0-1) */
  ttsProgress?: number;

  // AdMob
  /** Whether to show AdMob banner */
  showAdMob?: boolean;
}

// ============================================================
// TTS Button States
// ============================================================

type TTSState = 'idle' | 'loading' | 'playing';

function getTTSState(isPlaying?: boolean, isLoading?: boolean): TTSState {
  if (isLoading) return 'loading';
  if (isPlaying) return 'playing';
  return 'idle';
}

// ============================================================
// TTS Control Button Component
// ============================================================

interface TTSControlButtonProps {
  state: TTSState;
  onPress: () => void;
  accentColor: string;
}

function TTSControlButton({ state, onPress, accentColor }: TTSControlButtonProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  const getIcon = (): 'volume-up' | 'pause' | 'loading' => {
    switch (state) {
      case 'playing':
        return 'pause';
      case 'loading':
        return 'loading';
      default:
        return 'volume-up';
    }
  };

  const getLabel = (): string => {
    switch (state) {
      case 'playing':
        return t('articleViewer.pause');
      case 'loading':
        return t('articleViewer.loading');
      default:
        return t('articleViewer.readAloud');
    }
  };

  const isDisabled = state === 'loading';

  return (
    <TouchableOpacity
      style={[
        styles.ttsButton,
        { backgroundColor: accentColor },
        isDisabled && styles.ttsButtonDisabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={getLabel()}
      accessibilityState={{ disabled: isDisabled }}
    >
      {state === 'loading' ? (
        <ActivityIndicator
          size="small"
          color={colors.textOnPrimary}
          style={styles.ttsButtonIcon}
        />
      ) : (
        <Icon
          name={getIcon()}
          size={24}
          color={colors.textOnPrimary}
        />
      )}
      <Text style={styles.ttsButtonText}>{getLabel()}</Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Full Text Option Button Component
// ============================================================

interface FullTextOptionProps {
  useFullText: boolean;
  onToggle: () => void;
  accentColor: string;
}

function FullTextOption({ useFullText, onToggle, accentColor }: FullTextOptionProps) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={styles.fullTextOption}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityLabel={t('articleViewer.readFullArticle')}
      accessibilityState={{ checked: useFullText }}
    >
      <View
        style={[
          styles.checkbox,
          useFullText && { backgroundColor: accentColor, borderColor: accentColor },
        ]}
      >
        {useFullText && <Icon name="check" size={16} color={colors.textOnPrimary} />}
      </View>
      <Text style={styles.fullTextLabel}>
        {useFullText
          ? t('articleViewer.readFullArticle')
          : t('articleViewer.readSummary')
        }
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Main Component
// ============================================================

export function ArticleViewer({
  visible,
  article,
  onClose,
  accentColor,
  onStartTTS,
  onStopTTS,
  isTTSPlaying = false,
  isTTSLoading = false,
  ttsProgress = 0,
  showAdMob = true,
}: ArticleViewerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { triggerLight, triggerMedium } = useFeedback();
  const reducedMotion = useReducedMotion();

  // State
  const [useFullText, setUseFullText] = useState(false);
  const [isOpeningBrowser, setIsOpeningBrowser] = useState(false);

  // Reset state when article changes
  useEffect(() => {
    if (article) {
      setUseFullText(false);
      setIsOpeningBrowser(false);
    }
  }, [article?.id]);

  // TTS state
  const ttsState = getTTSState(isTTSPlaying, isTTSLoading);

  // Handle TTS button press
  const handleTTSPress = useCallback(() => {
    if (!article) return;

    triggerLight();

    if (isTTSPlaying) {
      onStopTTS?.();
    } else {
      onStartTTS?.(article, useFullText);
    }
  }, [article, isTTSPlaying, useFullText, onStartTTS, onStopTTS, triggerLight]);

  // Handle full text toggle
  const handleFullTextToggle = useCallback(() => {
    triggerLight();
    setUseFullText((prev) => !prev);

    // If already playing, restart with new setting
    if (isTTSPlaying && article) {
      onStopTTS?.();
      // Small delay to allow stop to complete
      setTimeout(() => {
        onStartTTS?.(article, !useFullText);
      }, 100);
    }
  }, [article, isTTSPlaying, useFullText, onStartTTS, onStopTTS, triggerLight]);

  // Handle open in browser
  const handleOpenInBrowser = useCallback(async () => {
    if (!article) return;

    triggerMedium();
    setIsOpeningBrowser(true);

    try {
      // Try InAppBrowser first (if available)
      // For now, use Linking as fallback
      const supported = await Linking.canOpenURL(article.link);
      if (supported) {
        await Linking.openURL(article.link);
      } else {
        console.warn('[ArticleViewer] Cannot open URL:', article.link);
      }
    } catch (error) {
      console.error('[ArticleViewer] Failed to open URL:', error);
    } finally {
      setIsOpeningBrowser(false);
    }
  }, [article, triggerMedium]);

  // Handle close
  const handleClose = useCallback(() => {
    triggerLight();
    // Stop TTS if playing
    if (isTTSPlaying) {
      onStopTTS?.();
    }
    onClose();
  }, [isTTSPlaying, onStopTTS, onClose, triggerLight]);

  if (!article) return null;

  return (
    <Modal
      visible={visible}
      animationType={reducedMotion ? 'fade' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="chevron-down"
            onPress={handleClose}
            size={48}
            color={colors.textPrimary}
            accessibilityLabel={t('articleViewer.close')}
          />

          <View style={styles.headerActions}>
            <IconButton
              icon="external-link"
              onPress={handleOpenInBrowser}
              size={48}
              color={accentColor}
              accessibilityLabel={t('articleViewer.openInBrowser')}
              disabled={isOpeningBrowser}
            />
          </View>
        </View>

        {/* AdMob Banner */}
        {showAdMob && (
          <View style={styles.adContainer}>
            <AdMobBanner size="banner" />
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {/* Article Title */}
          <Text style={styles.title} accessibilityRole="header">
            {article.title}
          </Text>

          {/* Article Date */}
          <Text style={styles.date}>
            {article.pubDate.toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>

          {/* Article Description */}
          <Text style={styles.description}>{article.description}</Text>

          {/* Info Box */}
          <View style={[styles.infoBox, { borderLeftColor: accentColor }]}>
            <Text style={styles.infoText}>
              {t('articleViewer.fullArticleHint')}
            </Text>
            <TouchableOpacity
              onPress={handleOpenInBrowser}
              style={styles.infoLink}
              accessibilityRole="link"
            >
              <Text style={[styles.infoLinkText, { color: accentColor }]}>
                {t('articleViewer.openInBrowser')}
              </Text>
              <Icon name="external-link" size={16} color={accentColor} />
            </TouchableOpacity>
          </View>
        </View>

        {/* TTS Controls (fixed at bottom) */}
        <View style={[styles.ttsControls, { paddingBottom: insets.bottom + spacing.md }]}>
          {/* Full text option */}
          <FullTextOption
            useFullText={useFullText}
            onToggle={handleFullTextToggle}
            accentColor={accentColor}
          />

          {/* TTS Button */}
          <TTSControlButton
            state={ttsState}
            onPress={handleTTSPress}
            accentColor={accentColor}
          />

          {/* Progress indicator (when playing) */}
          {isTTSPlaying && (
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: accentColor, width: `${ttsProgress * 100}%` },
                ]}
              />
            </View>
          )}
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },

  // AdMob
  adContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },

  // Content
  content: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  date: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  description: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 28,
  },

  // Info box
  infoBox: {
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  infoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoLinkText: {
    ...typography.body,
    fontWeight: '600',
  },

  // TTS Controls
  ttsControls: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  ttsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
    gap: spacing.sm,
  },
  ttsButtonDisabled: {
    opacity: 0.6,
  },
  ttsButtonIcon: {
    marginRight: spacing.xs,
  },
  ttsButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },

  // Full text option
  fullTextOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullTextLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },

  // Progress
  progressContainer: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
});

export default ArticleViewer;
