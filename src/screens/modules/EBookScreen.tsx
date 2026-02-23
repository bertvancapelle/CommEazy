/**
 * EBookScreen — Placeholder module for e-book reading
 *
 * This is a placeholder module screen used to test module switching
 * in the WheelNavigationMenu.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '@/theme';
import { ModuleHeader } from '@/components';
import { useColors } from '@/contexts/ThemeContext';

export function EBookScreen() {
  const { t } = useTranslation();
  const themeColors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Module Header — standardized component with AdMob placeholder */}
      <ModuleHeader
        moduleId="ebook"
        icon="book"
        title={t('navigation.ebook')}
        showAdMob={true}
      />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {/* Book icon */}
          <View style={[styles.bookLeft, { backgroundColor: themeColors.textOnPrimary }]} />
          <View style={[styles.bookRight, { backgroundColor: themeColors.textOnPrimary }]} />
          <View style={[styles.bookSpine, { backgroundColor: themeColors.textOnPrimary }]} />
        </View>

        <Text style={[styles.title, { color: themeColors.textPrimary }]}>{t('navigation.ebook')}</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{t('modules.coming_soon')}</Text>

        <View style={[styles.featureList, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.featureItem, { color: themeColors.textPrimary }]}>• {t('modules.ebook.feature1')}</Text>
          <Text style={[styles.featureItem, { color: themeColors.textPrimary }]}>• {t('modules.ebook.feature2')}</Text>
          <Text style={[styles.featureItem, { color: themeColors.textPrimary }]}>• {t('modules.ebook.feature3')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // moduleHeader styles removed — using standardized ModuleHeader component
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    backgroundColor: '#F57C00',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  bookLeft: {
    position: 'absolute',
    left: 25,
    width: 35,
    height: 55,
    backgroundColor: colors.textOnPrimary,
    borderRadius: 4,
    transform: [{ rotate: '-5deg' }],
  },
  bookRight: {
    position: 'absolute',
    right: 25,
    width: 35,
    height: 55,
    backgroundColor: colors.textOnPrimary,
    borderRadius: 4,
    transform: [{ rotate: '5deg' }],
  },
  bookSpine: {
    width: 6,
    height: 50,
    backgroundColor: colors.textOnPrimary,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  featureList: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
  },
  featureItem: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});
