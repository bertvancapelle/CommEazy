/**
 * HelpPlaceholderScreen — Placeholder for the Help module
 *
 * Shows a "coming soon" message with the help icon.
 * Includes a back button to return to the HomeScreen grid.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing } from '@/theme';
import { Icon, ModuleHeader, ModuleScreenLayout } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

interface HelpPlaceholderScreenProps {
  onBack: () => void;
}

// ============================================================
// Component
// ============================================================

export function HelpPlaceholderScreen({ onBack }: HelpPlaceholderScreenProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor('help' as ModuleColorId);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ModuleScreenLayout
        moduleId={'help' as ModuleColorId}
        moduleBlock={
          <ModuleHeader
            moduleId={'help' as ModuleColorId}
            icon="help"
            title={t('navigation.help')}
            showBackButton
            onBackPress={onBack}
            skipSafeArea
          />
        }
        controlsBlock={<></>}
        contentBlock={
          <View style={styles.content}>
            <View style={[styles.iconContainer, { backgroundColor: moduleColor + '20' }]}>
              <Icon name="help" size={96} color={moduleColor} />
            </View>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {t('navigation.help')}
            </Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              {t('common.comingSoon')}
            </Text>
          </View>
        }
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
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
  },
});
