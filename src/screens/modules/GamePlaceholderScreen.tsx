/**
 * GamePlaceholderScreen — Reusable placeholder for game modules
 *
 * Shows a "coming soon" message with the game's icon and name.
 * Used for: woordraad, sudoku, solitaire, memory, trivia.
 *
 * @see .claude/plans/MODULE_COLLECTIONS_AND_GAMES.md
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, typography, spacing } from '@/theme';
import { Icon, ModuleHeader } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import {
  STATIC_MODULE_DEFINITIONS,
  mapModuleIconToIconName,
  type StaticNavigationDestination,
} from '@/types/navigation';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

interface GamePlaceholderScreenProps {
  moduleId: StaticNavigationDestination;
}

// ============================================================
// Component
// ============================================================

export function GamePlaceholderScreen({ moduleId }: GamePlaceholderScreenProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(moduleId as ModuleColorId);

  const moduleDef = STATIC_MODULE_DEFINITIONS[moduleId];
  const iconName = mapModuleIconToIconName(moduleDef.icon);
  const title = t(moduleDef.labelKey);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ModuleHeader
        moduleId={moduleId as ModuleColorId}
        icon={iconName}
        title={title}
      />
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: moduleColor + '20' }]}>
          <Icon name={iconName} size={96} color={moduleColor} />
        </View>
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          {t('common.comingSoon')}
        </Text>
      </View>
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
