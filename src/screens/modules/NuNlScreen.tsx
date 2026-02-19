/**
 * NuNlScreen — nu.nl News Reader Module
 *
 * Senior-inclusive news reader with:
 * - Category-based article browsing
 * - Large touch targets (60pt+)
 * - VoiceFocusable article list
 * - TTS support for article reading
 * - Welcome modal for first-time users
 *
 * Voice commands supported:
 * - "volgende" / "vorige" — Navigate article list
 * - "[article title]" — Focus on article
 * - "open" — Open focused article
 *
 * @see .claude/plans/COUNTRY_SPECIFIC_MODULES.md
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors, typography, spacing, touchTargets, borderRadius, shadows } from '@/theme';
import { Icon, IconButton, VoiceFocusable, ModuleHeader, ArticleViewer } from '@/components';
import { useVoiceFocusList } from '@/contexts/VoiceFocusContext';
import { useHoldGestureContextSafe } from '@/contexts/HoldGestureContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';
import { useNewsArticles } from '@/hooks/useNewsArticles';
import { useArticleTTS } from '@/hooks/useArticleTTS';
import type { NewsArticle, ModuleCategory } from '@/types/modules';

// ============================================================
// Constants
// ============================================================

const MODULE_ID = 'nunl';
const MODULE_COLOR = '#E65100'; // nu.nl orange
const WELCOME_SHOWN_KEY = 'nunl_welcome_shown';

// ============================================================
// Category Chip Component
// ============================================================

interface CategoryChipProps {
  category: ModuleCategory;
  isSelected: boolean;
  onPress: () => void;
}

function CategoryChip({ category, isSelected, onPress }: CategoryChipProps) {
  const { t } = useTranslation();
  const holdGesture = useHoldGestureContextSafe();

  const handlePress = useCallback(() => {
    // Check if hold gesture was just consumed
    if (holdGesture?.isGestureConsumed?.()) {
      return;
    }
    onPress();
  }, [onPress, holdGesture]);

  return (
    <TouchableOpacity
      style={[
        styles.categoryChip,
        isSelected && styles.categoryChipSelected,
      ]}
      onPress={handlePress}
      onLongPress={() => {}} // Prevent onPress after long press
      delayLongPress={300}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t(category.labelKey)}
      accessibilityState={{ selected: isSelected }}
    >
      {category.icon && (
        <Text style={styles.categoryIcon}>{category.icon}</Text>
      )}
      <Text
        style={[
          styles.categoryLabel,
          isSelected && styles.categoryLabelSelected,
        ]}
      >
        {t(category.labelKey)}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Article Card Component
// ============================================================

interface ArticleCardProps {
  article: NewsArticle;
  index: number;
  onPress: () => void;
}

function ArticleCard({ article, index, onPress }: ArticleCardProps) {
  const { t } = useTranslation();
  const holdGesture = useHoldGestureContextSafe();
  const [imageError, setImageError] = useState(false);

  // Format relative time
  const timeAgo = useMemo(() => {
    const now = Date.now();
    const diff = now - article.pubDate.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}u`;
    if (minutes > 0) return `${minutes}m`;
    return 'nu';
  }, [article.pubDate]);

  const handlePress = useCallback(() => {
    if (holdGesture?.isGestureConsumed?.()) {
      return;
    }
    onPress();
  }, [onPress, holdGesture]);

  return (
    <VoiceFocusable
      id={article.id}
      label={article.title}
      index={index}
      onSelect={onPress}
    >
      <TouchableOpacity
        style={styles.articleCard}
        onPress={handlePress}
        onLongPress={() => {}}
        delayLongPress={300}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${article.title}. ${timeAgo} geleden`}
        accessibilityHint={t('modules.nunl.articleHint')}
      >
        {/* Image */}
        {article.imageUrl && !imageError ? (
          <Image
            source={{ uri: article.imageUrl }}
            style={styles.articleImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.articleImage, styles.articleImagePlaceholder]}>
            <Icon name="news" size={40} color={colors.textSecondary} />
          </View>
        )}

        {/* Content */}
        <View style={styles.articleContent}>
          <Text style={styles.articleTitle} numberOfLines={2}>
            {article.title}
          </Text>
          <Text style={styles.articleDescription} numberOfLines={2}>
            {article.description}
          </Text>
          <Text style={styles.articleTime}>{timeAgo}</Text>
        </View>
      </TouchableOpacity>
    </VoiceFocusable>
  );
}

// ============================================================
// Welcome Modal Component
// ============================================================

interface WelcomeModalProps {
  visible: boolean;
  onDismiss: () => void;
}

function WelcomeModal({ visible, onDismiss }: WelcomeModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { accentColor } = useAccentColor();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.welcomeModal, { paddingBottom: insets.bottom + spacing.lg }]}>
          {/* Header */}
          <View style={[styles.welcomeHeader, { backgroundColor: MODULE_COLOR }]}>
            <Icon name="news" size={48} color={colors.textOnPrimary} />
            <Text style={styles.welcomeTitle}>{t('modules.nunl.title')}</Text>
          </View>

          {/* Steps */}
          <View style={styles.welcomeContent}>
            <View style={styles.welcomeStep}>
              <View style={[styles.stepNumber, { backgroundColor: accentColor.primary }]}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>
                {t('modules.nunl.welcome.step1')}
              </Text>
            </View>

            <View style={styles.welcomeStep}>
              <View style={[styles.stepNumber, { backgroundColor: accentColor.primary }]}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>
                {t('modules.nunl.welcome.step2')}
              </Text>
            </View>

            <View style={styles.welcomeStep}>
              <View style={[styles.stepNumber, { backgroundColor: accentColor.primary }]}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>
                {t('modules.nunl.welcome.step3')}
              </Text>
            </View>
          </View>

          {/* Button */}
          <TouchableOpacity
            style={[styles.welcomeButton, { backgroundColor: accentColor.primary }]}
            onPress={onDismiss}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('modules.nunl.welcome.understood')}
          >
            <Text style={styles.welcomeButtonText}>{t('modules.nunl.welcome.understood')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================
// Main Screen Component
// ============================================================

export function NuNlScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();

  // State
  const [showWelcome, setShowWelcome] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  // News data
  const {
    articles,
    isLoading,
    error,
    fromCache,
    categories,
    selectedCategory,
    setSelectedCategory,
    refresh,
    module,
  } = useNewsArticles(MODULE_ID);

  // TTS for article reading
  const {
    startTTS,
    stopTTS,
    isPlaying: isTTSPlaying,
    isLoading: isTTSLoading,
    progress: ttsProgress,
  } = useArticleTTS();

  // Voice focus for article list
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return [];
    return articles.map((article, index) => ({
      id: article.id,
      label: article.title,
      index,
      onSelect: () => setSelectedArticle(article),
    }));
  }, [articles, isFocused]);

  const { scrollRef } = useVoiceFocusList('nunl-articles', voiceFocusItems);

  // Check for first-time use
  useEffect(() => {
    AsyncStorage.getItem(WELCOME_SHOWN_KEY).then((value) => {
      if (!value) {
        setShowWelcome(true);
      }
    });
  }, []);

  // Handle welcome dismiss
  const handleWelcomeDismiss = useCallback(async () => {
    setShowWelcome(false);
    await AsyncStorage.setItem(WELCOME_SHOWN_KEY, 'true');
  }, []);

  // Handle category change
  const handleCategoryChange = useCallback((categoryId: string) => {
    void triggerFeedback('tap');
    setSelectedCategory(categoryId);
  }, [setSelectedCategory, triggerFeedback]);

  // Handle article press
  const handleArticlePress = useCallback((article: NewsArticle) => {
    void triggerFeedback('tap');
    setSelectedArticle(article);
  }, [triggerFeedback]);

  // Handle article modal close
  const handleArticleClose = useCallback(() => {
    setSelectedArticle(null);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    void triggerFeedback('tap');
    await refresh();
  }, [refresh, triggerFeedback]);

  // Get error message
  const errorMessage = useMemo(() => {
    if (!error) return null;
    switch (error) {
      case 'network':
        return t('modules.nunl.errors.network');
      case 'timeout':
        return t('modules.nunl.errors.timeout');
      case 'server':
        return t('modules.nunl.errors.server');
      default:
        return t('modules.nunl.errors.parse');
    }
  }, [error, t]);

  return (
    <View style={styles.container}>
      {/* Module Header */}
      <ModuleHeader
        moduleId={MODULE_ID}
        icon="news"
        title={t('modules.nunl.title')}
        showAdMob
      />

      {/* Category Chips */}
      <View style={styles.categoryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              category={category}
              isSelected={selectedCategory === category.id}
              onPress={() => handleCategoryChange(category.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Error Banner */}
      {error && !isLoading && (
        <View style={styles.errorBanner}>
          <Icon name="warning" size={24} color={colors.error} />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity onPress={handleRefresh}>
            <Text style={styles.errorDismiss}>{t('common.try_again')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading State */}
      {isLoading && articles.length === 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MODULE_COLOR} />
          <Text style={styles.loadingText}>{t('modules.nunl.loading')}</Text>
        </View>
      )}

      {/* Empty State */}
      {!isLoading && articles.length === 0 && !error && (
        <View style={styles.emptyContainer}>
          <Icon name="news" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>{t('modules.nunl.noArticles')}</Text>
          <Text style={styles.emptyHint}>{t('modules.nunl.noArticlesHint')}</Text>
        </View>
      )}

      {/* Article List */}
      {articles.length > 0 && (
        <ScrollView
          ref={scrollRef}
          style={styles.articleList}
          contentContainerStyle={[
            styles.articleListContent,
            { paddingBottom: insets.bottom + spacing.lg },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              tintColor={MODULE_COLOR}
              colors={[MODULE_COLOR]}
            />
          }
        >
          {articles.map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              index={index}
              onPress={() => handleArticlePress(article)}
            />
          ))}
        </ScrollView>
      )}

      {/* Welcome Modal */}
      <WelcomeModal
        visible={showWelcome}
        onDismiss={handleWelcomeDismiss}
      />

      {/* Article Viewer */}
      <ArticleViewer
        visible={selectedArticle !== null}
        article={selectedArticle}
        onClose={handleArticleClose}
        accentColor={MODULE_COLOR}
        onStartTTS={startTTS}
        onStopTTS={stopTTS}
        isTTSPlaying={isTTSPlaying}
        isTTSLoading={isTTSLoading}
        ttsProgress={ttsProgress}
        showAdMob
      />
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

  // Category chips
  categoryContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryScroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: touchTargets.minimum,
  },
  categoryChipSelected: {
    backgroundColor: MODULE_COLOR,
    borderColor: MODULE_COLOR,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  categoryLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  categoryLabelSelected: {
    color: colors.textOnPrimary,
    fontWeight: '600',
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.errorLight,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    flex: 1,
  },
  errorDismiss: {
    ...typography.body,
    color: colors.error,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyHint: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Article list
  articleList: {
    flex: 1,
  },
  articleListContent: {
    padding: spacing.md,
    gap: spacing.md,
  },

  // Article card
  articleCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.small,
  },
  articleImage: {
    width: 100,
    height: 100,
  },
  articleImagePlaceholder: {
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleContent: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'space-between',
  },
  articleTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  articleDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  articleTime: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },

  // Welcome modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  welcomeModal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  welcomeHeader: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  welcomeTitle: {
    ...typography.h2,
    color: colors.textOnPrimary,
    textAlign: 'center',
  },
  welcomeContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  welcomeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  stepText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  welcomeButton: {
    margin: spacing.lg,
    marginTop: 0,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minHeight: touchTargets.minimum,
  },
  welcomeButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
});

export default NuNlScreen;
