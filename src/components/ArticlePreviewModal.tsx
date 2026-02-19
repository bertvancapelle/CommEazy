/**
 * ArticlePreviewModal — Article preview with choice options
 *
 * Shows article preview and lets user choose:
 * - Read abstract (TTS of summary)
 * - Open full article (with TTS option)
 *
 * Senior-inclusive design:
 * - Large touch targets (72pt+ for primary buttons)
 * - Clear visual hierarchy
 * - High contrast icons and text
 * - Haptic feedback on interactions
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, IconButton, NunlLogo } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { NewsArticle } from '@/types/modules';

// ============================================================
// Types
// ============================================================

export interface ArticlePreviewModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** The article to preview */
  article: NewsArticle | null;
  /** Callback when the modal is closed */
  onClose: () => void;
  /** Callback when user chooses to read abstract (TTS) */
  onReadAbstract: (article: NewsArticle) => void;
  /** Callback when user chooses to open full article */
  onOpenFullArticle: (article: NewsArticle) => void;
  /** Accent color for the module */
  accentColor: string;

  // TTS state (passed from parent)
  /** Whether TTS is currently playing */
  isTTSPlaying?: boolean;
  /** Whether TTS is loading */
  isTTSLoading?: boolean;
  /** Callback to stop TTS */
  onStopTTS?: () => void;
}

// ============================================================
// Choice Button Component
// ============================================================

interface ChoiceButtonProps {
  icon: 'volume-up' | 'book-open' | 'external-link';
  title: string;
  subtitle: string;
  onPress: () => void;
  accentColor: string;
  isPrimary?: boolean;
  /** Custom logo to show instead of icon (e.g., nu.nl logo) */
  customLogo?: React.ReactNode;
}

function ChoiceButton({
  icon,
  title,
  subtitle,
  onPress,
  accentColor,
  isPrimary = false,
  customLogo,
}: ChoiceButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.choiceButton,
        isPrimary && { backgroundColor: accentColor },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      onLongPress={() => {}} // Prevent double-action with hold gesture
      delayLongPress={300}
    >
      <View style={[
        styles.choiceIconContainer,
        isPrimary && { backgroundColor: 'rgba(255,255,255,0.2)' },
        !isPrimary && { backgroundColor: `${accentColor}20` },
      ]}>
        {customLogo ? customLogo : (
          <Icon
            name={icon}
            size={28}
            color={isPrimary ? colors.textOnPrimary : accentColor}
          />
        )}
      </View>
      <View style={styles.choiceTextContainer}>
        <Text
          style={[
            styles.choiceTitle,
            isPrimary && { color: colors.textOnPrimary },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.choiceSubtitle,
            isPrimary && { color: 'rgba(255,255,255,0.8)' },
          ]}
        >
          {subtitle}
        </Text>
      </View>
      <Icon
        name="chevron-right"
        size={24}
        color={isPrimary ? colors.textOnPrimary : colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

// ============================================================
// Main Component
// ============================================================

export function ArticlePreviewModal({
  visible,
  article,
  onClose,
  onReadAbstract,
  onOpenFullArticle,
  accentColor,
  isTTSPlaying = false,
  isTTSLoading = false,
  onStopTTS,
}: ArticlePreviewModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { triggerFeedback } = useFeedback();
  const reducedMotion = useReducedMotion();

  // Handle close - also stop TTS if playing
  const handleClose = useCallback(() => {
    void triggerFeedback('tap');
    if (isTTSPlaying) {
      onStopTTS?.();
    }
    onClose();
  }, [onClose, triggerFeedback, isTTSPlaying, onStopTTS]);

  // Handle read abstract - starts TTS but keeps modal open
  const handleReadAbstract = useCallback(() => {
    if (!article) return;
    void triggerFeedback('tap');
    onReadAbstract(article);
  }, [article, onReadAbstract, triggerFeedback]);

  // Handle stop TTS
  const handleStopTTS = useCallback(() => {
    void triggerFeedback('tap');
    onStopTTS?.();
  }, [onStopTTS, triggerFeedback]);

  // Handle open full article
  const handleOpenFullArticle = useCallback(() => {
    if (!article) return;
    void triggerFeedback('navigation');
    // Stop TTS if playing before opening full article
    if (isTTSPlaying) {
      onStopTTS?.();
    }
    onOpenFullArticle(article);
  }, [article, onOpenFullArticle, triggerFeedback, isTTSPlaying, onStopTTS]);

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
          <Text style={styles.headerTitle}>{t('articlePreview.title')}</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Article Title */}
          <Text style={styles.articleTitle} accessibilityRole="header">
            {article.title}
          </Text>

          {/* Article Date */}
          <Text style={styles.articleDate}>
            {article.pubDate.toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>

          {/* Article Description (Abstract) */}
          <View style={[styles.abstractBox, { borderLeftColor: accentColor }]}>
            <Text style={styles.abstractLabel}>
              {t('articlePreview.abstractLabel')}
            </Text>
            <Text style={styles.abstractText}>{article.description}</Text>
          </View>

          {/* Choice Section */}
          <Text style={styles.choiceLabel}>
            {t('articlePreview.whatWouldYouLike')}
          </Text>

          {/* TTS Playing State - Show stop button */}
          {(isTTSPlaying || isTTSLoading) ? (
            <TouchableOpacity
              style={[styles.ttsPlayingButton, { backgroundColor: accentColor }]}
              onPress={handleStopTTS}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('articleViewer.stop')}
              disabled={isTTSLoading}
            >
              <View style={styles.ttsPlayingContent}>
                {isTTSLoading ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Icon name="pause" size={28} color={colors.textOnPrimary} />
                )}
                <View style={styles.ttsPlayingTextContainer}>
                  <Text style={styles.ttsPlayingTitle}>
                    {isTTSLoading ? t('articleViewer.loading') : t('articlePreview.nowPlaying')}
                  </Text>
                  <Text style={styles.ttsPlayingSubtitle} numberOfLines={1}>
                    {article.title}
                  </Text>
                </View>
              </View>
              <Text style={styles.ttsStopText}>{t('articleViewer.stop')}</Text>
            </TouchableOpacity>
          ) : (
            /* Choice: Read Abstract (TTS) */
            <ChoiceButton
              icon="volume-up"
              title={t('articlePreview.readAbstract')}
              subtitle={t('articlePreview.readAbstractHint')}
              onPress={handleReadAbstract}
              accentColor={accentColor}
              isPrimary={false}
            />
          )}

          {/* Choice: Open Full Article — with nu.nl logo */}
          <ChoiceButton
            icon="book-open"
            title={t('articlePreview.openFullArticle')}
            subtitle={t('articlePreview.openFullArticleHint')}
            onPress={handleOpenFullArticle}
            accentColor={accentColor}
            isPrimary={!isTTSPlaying && !isTTSLoading}
            customLogo={<NunlLogo size={32} />}
          />
        </ScrollView>

        {/* Bottom safe area */}
        <View style={{ height: insets.bottom + spacing.md }} />
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
    minHeight: touchTargets.comfortable,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },

  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },

  // Article info
  articleTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  articleDate: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
  },

  // Abstract box
  abstractBox: {
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  abstractLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  abstractText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 28,
  },

  // Choice section
  choiceLabel: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  // Choice button
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minHeight: touchTargets.large,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  choiceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceTextContainer: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  choiceTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  choiceSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // TTS Playing state
  ttsPlayingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minHeight: touchTargets.large,
    marginBottom: spacing.sm,
  },
  ttsPlayingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  ttsPlayingTextContainer: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  ttsPlayingTitle: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
  },
  ttsPlayingSubtitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
  },
  ttsStopText: {
    ...typography.button,
    color: colors.textOnPrimary,
    marginLeft: spacing.md,
  },
});

export default ArticlePreviewModal;
