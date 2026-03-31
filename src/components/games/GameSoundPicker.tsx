/**
 * GameSoundPicker — Reusable sound picker for game settings menus
 *
 * Shows two rows of chip-style selectors:
 * 1. Tap sound (played on each interaction)
 * 2. Win sound (played on game win)
 *
 * Tapping a chip selects it, previews the sound, and persists the choice.
 * Shared across all 6 games via gameSoundService.
 *
 * @see src/services/gameSoundService.ts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, borderRadius, touchTargets, typography } from '@/theme';
import { HapticTouchable } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import {
  gameSoundService,
  TAP_SOUND_OPTIONS,
  WIN_SOUND_OPTIONS,
  LOSE_SOUND_OPTIONS,
  type TapSoundId,
  type WinSoundId,
  type LoseSoundId,
} from '@/services/gameSoundService';

// ============================================================
// Types
// ============================================================

interface GameSoundPickerProps {
  /** Module accent color for selected chip */
  moduleColor: string;
}

// ============================================================
// Component
// ============================================================

export function GameSoundPicker({ moduleColor }: GameSoundPickerProps) {
  const { t } = useTranslation();
  const themeColors = useColors();

  const [tapSound, setTapSound] = useState<TapSoundId>('click');
  const [winSound, setWinSound] = useState<WinSoundId>('horn');
  const [loseSound, setLoseSound] = useState<LoseSoundId>('buzzer');

  // Load settings on mount
  useEffect(() => {
    gameSoundService.loadSettings().then(settings => {
      setTapSound(settings.tapSound);
      setWinSound(settings.winSound);
      setLoseSound(settings.loseSound);
    });
  }, []);

  const handleTapSoundChange = useCallback((id: TapSoundId) => {
    setTapSound(id);
    gameSoundService.setTapSound(id);
    gameSoundService.previewTapSound(id);
  }, []);

  const handleWinSoundChange = useCallback((id: WinSoundId) => {
    setWinSound(id);
    gameSoundService.setWinSound(id);
    gameSoundService.previewWinSound(id);
  }, []);

  const handleLoseSoundChange = useCallback((id: LoseSoundId) => {
    setLoseSound(id);
    gameSoundService.setLoseSound(id);
    gameSoundService.previewLoseSound(id);
  }, []);

  return (
    <View style={styles.container}>
      {/* Section title */}
      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
        {t('games.sounds.title')}
      </Text>

      {/* Tap sound row */}
      <Text style={[styles.rowLabel, { color: themeColors.textPrimary }]}>
        {t('games.sounds.tapSound')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        {TAP_SOUND_OPTIONS.map(option => {
          const isSelected = tapSound === option.id;
          return (
            <HapticTouchable
              key={option.id}
              onPress={() => handleTapSoundChange(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(option.labelKey)}
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
                {t(option.labelKey)}
              </Text>
            </HapticTouchable>
          );
        })}
      </ScrollView>

      {/* Win sound row */}
      <Text style={[styles.rowLabel, { color: themeColors.textPrimary }]}>
        {t('games.sounds.winSound')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        {WIN_SOUND_OPTIONS.map(option => {
          const isSelected = winSound === option.id;
          return (
            <HapticTouchable
              key={option.id}
              onPress={() => handleWinSoundChange(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(option.labelKey)}
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
                {t(option.labelKey)}
              </Text>
            </HapticTouchable>
          );
        })}
      </ScrollView>

      {/* Lose sound row */}
      <Text style={[styles.rowLabel, { color: themeColors.textPrimary }]}>
        {t('games.sounds.loseSound')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        {LOSE_SOUND_OPTIONS.map(option => {
          const isSelected = loseSound === option.id;
          return (
            <HapticTouchable
              key={option.id}
              onPress={() => handleLoseSoundChange(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(option.labelKey)}
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
                {t(option.labelKey)}
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
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  rowLabel: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  chipRow: {
    marginBottom: spacing.md,
  },
  chipRowContent: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  chip: {
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  chipText: {
    ...typography.body,
    fontWeight: '600',
  },
});
