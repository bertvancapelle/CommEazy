/**
 * SpelTegel — Game tile for the GameLobbyScreen
 *
 * Large, accessible tile showing game icon, title, description, and chevron.
 * Uses HapticTouchable with navigation haptic feedback.
 *
 * @see Prompt_1_Games_Foundation.md §2.3
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { spacing, borderRadius, touchTargets, typography } from '@/theme';
import { Icon, HapticTouchable } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import type { ModuleColorId } from '@/types/liquidGlass';
import type { IconName } from '@/components/Icon';

// ============================================================
// Types
// ============================================================

export interface SpelTegelProps {
  /** Module identifier for color lookup */
  moduleId: ModuleColorId;
  /** Icon to display on the left */
  icon: IconName;
  /** Game title */
  title: string;
  /** Short description text */
  description: string;
  /** Called when tile is tapped */
  onPress: () => void;
  /** Accessibility label override */
  accessibilityLabel?: string;
}

// ============================================================
// Component
// ============================================================

export function SpelTegel({
  moduleId,
  icon,
  title,
  description,
  onPress,
  accessibilityLabel,
}: SpelTegelProps) {
  const themeColors = useColors();
  const moduleColor = useModuleColor(moduleId);

  return (
    <HapticTouchable
      hapticType="navigation"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `${title} — ${description}`}
      style={[
        styles.container,
        {
          backgroundColor: moduleColor + '26',
          borderColor: moduleColor + '4D',
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: moduleColor + '33' }]}>
        <Icon name={icon} size={32} color={moduleColor} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: themeColors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.description, { color: themeColors.textSecondary }]} numberOfLines={2}>
          {description}
        </Text>
      </View>
      <Icon name="chevron-right" size={24} color={themeColors.textTertiary} />
    </HapticTouchable>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.large,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  description: {
    ...typography.label,
    marginTop: 2,
  },
});
