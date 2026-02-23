/**
 * AppearanceSettingsScreen — Theme and Color Settings
 *
 * Allows users to:
 * - Select theme mode (Light / Dark / System)
 * - Choose accent color (12 options)
 * - Preview the current appearance
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear visual feedback
 * - Simple 3-option theme selector
 * - Color grid with large, tappable swatches
 *
 * @see .claude/plans/COLOR_THEME_SYSTEM_FOR_SENIORS.md
 * @see src/contexts/ThemeContext.tsx
 * @see src/contexts/AccentColorContext.tsx
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, typography, spacing, touchTargets, borderRadius, ACCENT_COLORS, ACCENT_COLOR_KEYS, type AccentColorKey } from '@/theme';
import { Icon, type IconName } from '@/components';
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext';
import { useAccentColorContext } from '@/contexts/AccentColorContext';
import { useFeedback } from '@/hooks/useFeedback';

// ============================================================
// Types
// ============================================================

interface ThemeOption {
  mode: ThemeMode;
  icon: IconName;
  labelKey: string;
  hintKey: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    mode: 'light',
    icon: 'sun',
    labelKey: 'appearance.theme.light',
    hintKey: 'appearance.theme.lightHint',
  },
  {
    mode: 'dark',
    icon: 'moon',
    labelKey: 'appearance.theme.dark',
    hintKey: 'appearance.theme.darkHint',
  },
  {
    mode: 'system',
    icon: 'settings',
    labelKey: 'appearance.theme.system',
    hintKey: 'appearance.theme.systemHint',
  },
];

// ============================================================
// Theme Option Button Component
// ============================================================

interface ThemeOptionButtonProps {
  option: ThemeOption;
  isSelected: boolean;
  onSelect: () => void;
  accentColor: string;
}

function ThemeOptionButton({ option, isSelected, onSelect, accentColor }: ThemeOptionButtonProps) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={[
        styles.themeOption,
        isSelected && { borderColor: accentColor, borderWidth: 3 },
      ]}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={t(option.labelKey)}
      accessibilityHint={t(option.hintKey)}
    >
      <View
        style={[
          styles.themeIconContainer,
          isSelected && { backgroundColor: accentColor },
        ]}
      >
        <Icon
          name={option.icon}
          size={28}
          color={isSelected ? colors.textOnPrimary : colors.textSecondary}
        />
      </View>
      <Text
        style={[
          styles.themeLabel,
          isSelected && { color: accentColor, fontWeight: '700' },
        ]}
      >
        {t(option.labelKey)}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Color Swatch Component
// ============================================================

interface ColorSwatchProps {
  colorKey: AccentColorKey;
  isSelected: boolean;
  onSelect: () => void;
}

function ColorSwatch({ colorKey, isSelected, onSelect }: ColorSwatchProps) {
  const color = ACCENT_COLORS[colorKey];

  return (
    <TouchableOpacity
      style={[
        styles.colorSwatch,
        { backgroundColor: color.primary },
        isSelected && styles.colorSwatchSelected,
      ]}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={color.label}
    >
      {isSelected && (
        <Icon name="checkmark" size={24} color={colors.textOnPrimary} />
      )}
    </TouchableOpacity>
  );
}

// ============================================================
// Main Screen
// ============================================================

export function AppearanceSettingsScreen() {
  const { t } = useTranslation();
  const { triggerFeedback } = useFeedback();
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const { accentColorKey, accentColor, updateAccentColor } = useAccentColorContext();

  // Handle theme selection
  const handleThemeSelect = useCallback(
    async (mode: ThemeMode) => {
      await triggerFeedback('tap');
      await setThemeMode(mode);
    },
    [setThemeMode, triggerFeedback]
  );

  // Handle accent color selection
  const handleColorSelect = useCallback(
    async (key: AccentColorKey) => {
      await triggerFeedback('tap');
      await updateAccentColor(key);
    },
    [updateAccentColor, triggerFeedback]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Theme Mode Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('appearance.theme.title')}</Text>
        <Text style={styles.sectionHint}>{t('appearance.theme.hint')}</Text>

        <View style={styles.themeOptionsContainer}>
          {THEME_OPTIONS.map((option) => (
            <ThemeOptionButton
              key={option.mode}
              option={option}
              isSelected={themeMode === option.mode}
              onSelect={() => void handleThemeSelect(option.mode)}
              accentColor={accentColor.primary}
            />
          ))}
        </View>

        {/* Current theme indicator (when using system) */}
        {themeMode === 'system' && (
          <View style={styles.systemIndicator}>
            <Icon
              name={resolvedTheme === 'dark' ? 'moon' : 'sun'}
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.systemIndicatorText}>
              {t('appearance.theme.currentlyUsing', {
                theme: t(resolvedTheme === 'dark' ? 'appearance.theme.dark' : 'appearance.theme.light'),
              })}
            </Text>
          </View>
        )}
      </View>

      {/* Accent Color Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('appearance.accentColor.title')}</Text>
        <Text style={styles.sectionHint}>{t('appearance.accentColor.hint')}</Text>

        <View style={styles.colorGrid}>
          {ACCENT_COLOR_KEYS.map((key) => (
            <ColorSwatch
              key={key}
              colorKey={key}
              isSelected={accentColorKey === key}
              onSelect={() => void handleColorSelect(key)}
            />
          ))}
        </View>

        {/* Selected color name */}
        <View style={styles.selectedColorIndicator}>
          <View style={[styles.selectedColorDot, { backgroundColor: accentColor.primary }]} />
          <Text style={styles.selectedColorText}>
            {accentColor.label}
          </Text>
        </View>
      </View>

      {/* Preview Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('appearance.preview.title')}</Text>
        <Text style={styles.sectionHint}>{t('appearance.preview.hint')}</Text>

        {/* Preview card showing current theme + accent */}
        <View style={styles.previewCard}>
          <View style={[styles.previewHeader, { backgroundColor: accentColor.primary }]}>
            <Icon name="chat" size={24} color={colors.textOnPrimary} />
            <Text style={styles.previewHeaderText}>{t('tabs.chats')}</Text>
          </View>
          <View style={styles.previewContent}>
            <View style={styles.previewMessage}>
              <Text style={styles.previewMessageText}>
                {t('appearance.preview.sampleMessage')}
              </Text>
            </View>
            <View style={[styles.previewButton, { backgroundColor: accentColor.primary }]}>
              <Text style={styles.previewButtonText}>{t('common.send')}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Info text */}
      <View style={styles.infoSection}>
        <Icon name="info" size={18} color={colors.textTertiary} />
        <Text style={styles.infoText}>
          {t('appearance.info')}
        </Text>
      </View>
    </ScrollView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  // Theme Options
  themeOptionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: touchTargets.large,
  },
  themeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  themeLabel: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  systemIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.sm,
  },
  systemIndicatorText: {
    ...typography.small,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  // Color Grid
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  colorSwatch: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: colors.textOnPrimary,
  },
  selectedColorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  selectedColorDot: {
    width: 16,
    height: 16,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  selectedColorText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  // Preview
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  previewHeaderText: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
    marginLeft: spacing.sm,
  },
  previewContent: {
    padding: spacing.md,
  },
  previewMessage: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  previewMessageText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  previewButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  previewButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  // Info Section
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  infoText: {
    ...typography.small,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
});
