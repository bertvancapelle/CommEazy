/**
 * AudioBookScreen — Placeholder module for audiobook listening
 *
 * This is a fake module screen used to test module switching
 * in the WheelNavigationMenu.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@/theme';
import { Icon, MediaIndicator } from '@/components';

// Module color (consistent with WheelNavigationMenu)
const AUDIOBOOK_MODULE_COLOR = '#7B1FA2';

export function AudioBookScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Module Header — consistent with navigation menu, centered */}
      <View style={[styles.moduleHeader, { backgroundColor: AUDIOBOOK_MODULE_COLOR, paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.moduleHeaderContent}>
          <Icon name="headphones" size={28} color={colors.textOnPrimary} />
          <Text style={styles.moduleTitle}>{t('navigation.audiobook')}</Text>
        </View>
        <View style={styles.mediaIndicatorContainer}>
          <MediaIndicator moduleColor={AUDIOBOOK_MODULE_COLOR} currentSource="audiobook" />
        </View>
      </View>

      <View style={styles.content}>
      <View style={styles.iconContainer}>
        {/* Headphones icon */}
        <View style={styles.headphonesBand} />
        <View style={styles.headphonesLeft} />
        <View style={styles.headphonesRight} />
      </View>

      <Text style={styles.title}>{t('navigation.audiobook')}</Text>
      <Text style={styles.subtitle}>{t('modules.coming_soon')}</Text>

      <View style={styles.featureList}>
        <Text style={styles.featureItem}>• {t('modules.audiobook.feature1')}</Text>
        <Text style={styles.featureItem}>• {t('modules.audiobook.feature2')}</Text>
        <Text style={styles.featureItem}>• {t('modules.audiobook.feature3')}</Text>
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
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  moduleHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  moduleTitle: {
    ...typography.h2,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  mediaIndicatorContainer: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: 8 }],
  },
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
