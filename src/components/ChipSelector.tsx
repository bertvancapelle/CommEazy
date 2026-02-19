/**
 * ChipSelector — Senior-inclusive horizontal chip selector
 *
 * Standardized component for country/language selection in search filters.
 * Used across Radio, Podcast, and Books modules.
 *
 * Features:
 * - Horizontal scrolling pill-shaped chips
 * - 60pt touch targets (senior-inclusive)
 * - 18pt typography (senior-inclusive)
 * - Hold-gesture protection
 * - Automatic label via mode prop
 *
 * Senior-inclusive design:
 * - Touch targets ≥60pt
 * - Clear visual feedback on selection
 * - Large, readable text (18pt)
 * - Haptic feedback on selection
 *
 * @see .claude/CLAUDE.md Section 14 (Component Registry)
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';

// ============================================================
// Types
// ============================================================

export interface ChipOption {
  /** Unique code (e.g., 'NL', 'nl') */
  code: string;
  /** Flag emoji (e.g., '🇳🇱') */
  flag: string;
  /** Native name (e.g., 'Nederland', 'Nederlands') */
  nativeName: string;
}

export interface ChipSelectorProps {
  /** Mode determines the label via t() — 'country' shows "Land", 'language' shows "Taal" */
  mode: 'country' | 'language';
  /** List of options to display */
  options: ChipOption[];
  /** Currently selected code */
  selectedCode: string;
  /** Callback when an option is selected */
  onSelect: (code: string) => void;
  /** Optional custom label (overrides mode-based label) */
  label?: string;
}

// ============================================================
// ChipSelector Component
// ============================================================

/**
 * Standardized chip selector for country/language filtering
 *
 * @example
 * // Country selection (Radio)
 * <ChipSelector
 *   mode="country"
 *   options={COUNTRIES}
 *   selectedCode={selectedCountry}
 *   onSelect={setSelectedCountry}
 * />
 *
 * @example
 * // Language selection (Podcast/Books)
 * <ChipSelector
 *   mode="language"
 *   options={LANGUAGES}
 *   selectedCode={selectedLanguage}
 *   onSelect={setSelectedLanguage}
 * />
 */
export function ChipSelector({
  mode,
  options,
  selectedCode,
  onSelect,
  label,
}: ChipSelectorProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const { triggerFeedback } = useFeedback();

  // Determine label based on mode or custom label
  const displayLabel = label ?? t(`components.chipSelector.${mode}`);

  const handleSelect = async (code: string) => {
    await triggerFeedback('tap');
    onSelect(code);
  };

  return (
    <View style={styles.container}>
      {/* Label — ABOVE chips, bold */}
      <Text style={styles.label}>{displayLabel}</Text>

      {/* Horizontal scrolling chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipList}
      >
        {options.map((option) => {
          const isSelected = selectedCode === option.code;

          return (
            <TouchableOpacity
              key={option.code}
              style={[
                styles.chip,
                isSelected && {
                  backgroundColor: accentColor.primary,
                  borderColor: accentColor.primary,
                },
              ]}
              onPress={() => handleSelect(option.code)}
              onLongPress={() => {
                // Empty handler prevents onPress from firing after long press
                // Required for HoldToNavigateWrapper compatibility
              }}
              delayLongPress={300}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${option.flag} ${option.nativeName}`}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextActive,
                ]}
              >
                {option.flag} {option.nativeName}
              </Text>
            </TouchableOpacity>
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
    // No margin — let parent control spacing
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  chipList: {
    gap: spacing.xs,
    paddingRight: spacing.md, // Extra padding for last chip visibility
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: touchTargets.minimum, // 60pt — senior-inclusive
    justifyContent: 'center',
  },
  chipText: {
    ...typography.body, // 18pt — senior-inclusive
    color: colors.textPrimary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
});

export default ChipSelector;
