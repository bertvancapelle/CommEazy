/**
 * DifficultyPicker — Horizontal chip selector for game difficulty
 *
 * Similar to ChipSelector pattern but for difficulty levels.
 * Touch targets ≥60pt, senior-inclusive design.
 *
 * @see Prompt_1_Games_Foundation.md §5.7
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, borderRadius, touchTargets, typography } from '@/theme';
import { HapticTouchable } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import type { GameDifficulty } from '@/types/games';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

export interface DifficultyOption {
  /** Difficulty value */
  value: GameDifficulty;
  /** i18n display label */
  label: string;
  /** i18n description */
  description?: string;
}

export interface DifficultyPickerProps {
  /** Currently selected difficulty */
  selected: GameDifficulty;
  /** Selection callback */
  onSelect: (difficulty: GameDifficulty) => void;
  /** Available difficulty options */
  options: DifficultyOption[];
  /** Module identifier for accent color */
  moduleId: ModuleColorId;
}

// ============================================================
// Component
// ============================================================

export function DifficultyPicker({
  selected,
  onSelect,
  options,
  moduleId,
}: DifficultyPickerProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(moduleId);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: themeColors.textSecondary }]}>
        {t('games.lobby.difficulty')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {options.map((option) => {
          const isSelected = option.value === selected;
          return (
            <HapticTouchable
              key={option.value}
              onPress={() => onSelect(option.value)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? moduleColor : themeColors.surface,
                  borderColor: isSelected ? moduleColor : themeColors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? '#FFFFFF' : themeColors.textPrimary },
                ]}
              >
                {option.label}
              </Text>
            </HapticTouchable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  label: {
    ...typography.label,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    ...typography.body,
    fontWeight: '500',
  },
});
