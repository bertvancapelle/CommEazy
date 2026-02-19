/**
 * CallsScreen — Placeholder module for voice calling
 *
 * This is a placeholder module screen used to test module switching
 * in the WheelNavigationMenu.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '@/theme';
import { ModuleHeader } from '@/components';

export function CallsScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {/* Module Header — standardized component with AdMob placeholder */}
      <ModuleHeader
        moduleId="calls"
        icon="phone"
        title={t('navigation.calls')}
        showAdMob={true}
      />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {/* Phone icon */}
          <View style={styles.phoneBody} />
          <View style={styles.phoneEarpiece} />
          <View style={styles.phoneMouthpiece} />
        </View>

        <Text style={styles.title}>{t('navigation.calls')}</Text>
        <Text style={styles.subtitle}>{t('modules.coming_soon')}</Text>

        <View style={styles.featureList}>
          <Text style={styles.featureItem}>• {t('modules.calls.feature1')}</Text>
          <Text style={styles.featureItem}>• {t('modules.calls.feature2')}</Text>
          <Text style={styles.featureItem}>• {t('modules.calls.feature3')}</Text>
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
    backgroundColor: '#1565C0',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  phoneBody: {
    width: 35,
    height: 70,
    backgroundColor: colors.textOnPrimary,
    borderRadius: 10,
  },
  phoneEarpiece: {
    position: 'absolute',
    width: 25,
    height: 12,
    backgroundColor: colors.textOnPrimary,
    top: 32,
  },
  phoneMouthpiece: {
    position: 'absolute',
    width: 25,
    height: 12,
    backgroundColor: colors.textOnPrimary,
    bottom: 32,
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
