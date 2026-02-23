/**
 * AudioBookScreen — Placeholder module for audiobook listening
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

export function AudioBookScreen() {
  const { t } = useTranslation();
  const themeColors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Module Header — standardized component with AdMob placeholder */}
      <ModuleHeader
        moduleId="audiobook"
        icon="headphones"
        title={t('navigation.audiobook')}
        showAdMob={true}
      />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {/* Headphones icon */}
          <View style={[styles.headphonesBand, { borderColor: themeColors.textOnPrimary }]} />
          <View style={[styles.headphonesLeft, { backgroundColor: themeColors.textOnPrimary }]} />
          <View style={[styles.headphonesRight, { backgroundColor: themeColors.textOnPrimary }]} />
        </View>

        <Text style={[styles.title, { color: themeColors.textPrimary }]}>{t('navigation.audiobook')}</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{t('modules.coming_soon')}</Text>

        <View style={[styles.featureList, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.featureItem, { color: themeColors.textPrimary }]}>• {t('modules.audiobook.feature1')}</Text>
          <Text style={[styles.featureItem, { color: themeColors.textPrimary }]}>• {t('modules.audiobook.feature2')}</Text>
          <Text style={[styles.featureItem, { color: themeColors.textPrimary }]}>• {t('modules.audiobook.feature3')}</Text>
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
    backgroundColor: '#7B1FA2',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headphonesBand: {
    position: 'absolute',
    top: 25,
    width: 60,
    height: 35,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 7,
    borderColor: colors.textOnPrimary,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  headphonesLeft: {
    position: 'absolute',
    left: 23,
    top: 55,
    width: 20,
    height: 30,
    backgroundColor: colors.textOnPrimary,
    borderRadius: 6,
  },
  headphonesRight: {
    position: 'absolute',
    right: 23,
    top: 55,
    width: 20,
    height: 30,
    backgroundColor: colors.textOnPrimary,
    borderRadius: 6,
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
