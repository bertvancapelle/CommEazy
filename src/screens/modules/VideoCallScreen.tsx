/**
 * VideoCallScreen — Placeholder module for video calling
 *
 * This is a placeholder module screen used to test module switching
 * in the WheelNavigationMenu.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '@/theme';
import { ModuleHeader } from '@/components';

export function VideoCallScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {/* Module Header — standardized component with AdMob placeholder */}
      <ModuleHeader
        moduleId="videocall"
        icon="video"
        title={t('navigation.videocall')}
        showAdMob={true}
      />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {/* Video camera icon */}
          <View style={styles.videoBody} />
          <View style={styles.videoLens} />
        </View>

        <Text style={styles.title}>{t('navigation.videocall')}</Text>
        <Text style={styles.subtitle}>{t('modules.coming_soon')}</Text>

        <View style={styles.featureList}>
          <Text style={styles.featureItem}>• {t('modules.videocall.feature1')}</Text>
          <Text style={styles.featureItem}>• {t('modules.videocall.feature2')}</Text>
          <Text style={styles.featureItem}>• {t('modules.videocall.feature3')}</Text>
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
    backgroundColor: '#C62828',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  videoBody: {
    width: 60,
    height: 45,
    backgroundColor: colors.textOnPrimary,
    borderRadius: 8,
    marginRight: 15,
  },
  videoLens: {
    position: 'absolute',
    right: 22,
    width: 0,
    height: 0,
    borderLeftWidth: 25,
    borderTopWidth: 15,
    borderBottomWidth: 15,
    borderLeftColor: colors.textOnPrimary,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
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
