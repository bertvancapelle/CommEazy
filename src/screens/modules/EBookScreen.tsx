/**
 * EBookScreen — Placeholder module for e-book reading
 *
 * This is a fake module screen used to test module switching
 * in the WheelNavigationMenu.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@/theme';

export function EBookScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.iconContainer}>
        {/* Book icon */}
        <View style={styles.bookLeft} />
        <View style={styles.bookRight} />
        <View style={styles.bookSpine} />
      </View>

      <Text style={styles.title}>{t('navigation.ebook')}</Text>
      <Text style={styles.subtitle}>{t('modules.coming_soon')}</Text>

      <View style={styles.featureList}>
        <Text style={styles.featureItem}>• {t('modules.ebook.feature1')}</Text>
        <Text style={styles.featureItem}>• {t('modules.ebook.feature2')}</Text>
        <Text style={styles.featureItem}>• {t('modules.ebook.feature3')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
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
