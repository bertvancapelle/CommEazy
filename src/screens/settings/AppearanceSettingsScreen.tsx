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

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, typography, spacing, touchTargets, borderRadius, ACCENT_COLORS, ACCENT_COLOR_KEYS, type AccentColorKey } from '@/theme';
import { darkColors } from '@/theme/darkColors';
import { Icon, type IconName } from '@/components';
import { useTheme, useColors, type ThemeMode } from '@/contexts/ThemeContext';
import { useAccentColorContext } from '@/contexts/AccentColorContext';
import {
  useModuleColorsContext,
  CUSTOMIZABLE_MODULES,
  MODULE_COLOR_OPTIONS,
  MODULE_LABELS,
  type ModuleColorId,
} from '@/contexts/ModuleColorsContext';
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
  themeColors: typeof colors;
}

function ThemeOptionButton({ option, isSelected, onSelect, accentColor, themeColors }: ThemeOptionButtonProps) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={[
        styles.themeOption,
        { backgroundColor: themeColors.surface, borderColor: themeColors.border },
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
          { backgroundColor: themeColors.backgroundSecondary },
          isSelected && { backgroundColor: accentColor },
        ]}
      >
        <Icon
          name={option.icon}
          size={28}
          color={isSelected ? themeColors.textOnPrimary : themeColors.textSecondary}
        />
      </View>
      <Text
        style={[
          styles.themeLabel,
          { color: themeColors.textPrimary },
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
// Color Picker Overlay Component
// ============================================================

interface ColorPickerOverlayProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  onSelect: (value: T) => void;
  colors: Array<{ value: T; hex: string; label: string }>;
  selectedValue: T;
  title: string;
  themeColors: typeof colors;
}

function ColorPickerOverlay<T extends string>({
  visible,
  onClose,
  onSelect,
  colors: colorOptions,
  selectedValue,
  title,
  themeColors,
}: ColorPickerOverlayProps<T>) {
  const handleSelect = (value: T) => {
    onSelect(value);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlayBackdrop} onPress={onClose}>
        <View style={[styles.overlayContainer, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.overlayTitle, { color: themeColors.textPrimary }]}>{title}</Text>
          <View style={styles.overlayColorGrid}>
            {colorOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.overlayColorSwatch,
                  { backgroundColor: option.hex },
                  selectedValue === option.value && styles.overlayColorSwatchSelected,
                ]}
                onPress={() => handleSelect(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedValue === option.value }}
                accessibilityLabel={option.label}
              >
                {selectedValue === option.value && (
                  <Icon name="checkmark" size={20} color={colors.textOnPrimary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ============================================================
// Color Selector Row Component (for triggering overlay)
// ============================================================

interface ColorSelectorRowProps {
  label: string;
  currentColorHex: string;
  currentColorLabel: string;
  onPress: () => void;
  themeColors: typeof colors;
}

function ColorSelectorRow({ label, currentColorHex, currentColorLabel, onPress, themeColors }: ColorSelectorRowProps) {
  return (
    <TouchableOpacity
      style={[styles.colorSelectorRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${currentColorLabel}`}
      accessibilityHint="Tap to change color"
    >
      <Text style={[styles.colorSelectorLabel, { color: themeColors.textPrimary }]}>{label}</Text>
      <View style={styles.colorSelectorRight}>
        <View style={[styles.colorSelectorPreview, { backgroundColor: currentColorHex }]} />
        <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// Main Screen
// ============================================================

export function AppearanceSettingsScreen() {
  const { t } = useTranslation();
  const { triggerFeedback } = useFeedback();
  const { themeMode, resolvedTheme, isDarkMode, setThemeMode } = useTheme();
  const themeColors = useColors(); // Dynamic colors based on theme
  const { accentColorKey, accentColor, updateAccentColor } = useAccentColorContext();
  const { getModuleHex, setModuleColor, resetAllColors, overrides: customColors } = useModuleColorsContext();

  // Overlay state for accent color picker
  const [showAccentColorPicker, setShowAccentColorPicker] = useState(false);

  // Overlay state for module color picker (which module is being edited)
  const [editingModuleId, setEditingModuleId] = useState<ModuleColorId | null>(null);

  // Prepare accent color options for overlay
  const accentColorOptions = ACCENT_COLOR_KEYS.map((key) => ({
    value: key,
    hex: ACCENT_COLORS[key].primary,
    label: ACCENT_COLORS[key].label,
  }));

  // Prepare module color options for overlay
  const moduleColorOptions = MODULE_COLOR_OPTIONS.map((option) => ({
    value: option.hex,
    hex: option.hex,
    label: option.label,
  }));

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

  // Handle module color selection
  const handleModuleColorSelect = useCallback(
    async (moduleId: ModuleColorId, colorHex: string) => {
      await triggerFeedback('tap');
      setModuleColor(moduleId, colorHex);
    },
    [setModuleColor, triggerFeedback]
  );

  // Handle reset all module colors
  const handleResetModuleColors = useCallback(async () => {
    await triggerFeedback('tap');
    resetAllColors();
  }, [resetAllColors, triggerFeedback]);

  // Check if any custom colors are set
  const hasCustomColors = Object.keys(customColors).length > 0;

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.contentContainer}>
      {/* Theme Mode Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('appearance.theme.title')}</Text>
        <Text style={[styles.sectionHint, { color: themeColors.textSecondary }]}>{t('appearance.theme.hint')}</Text>

        <View style={styles.themeOptionsContainer}>
          {THEME_OPTIONS.map((option) => (
            <ThemeOptionButton
              key={option.mode}
              option={option}
              isSelected={themeMode === option.mode}
              onSelect={() => void handleThemeSelect(option.mode)}
              accentColor={accentColor.primary}
              themeColors={themeColors}
            />
          ))}
        </View>

        {/* Current theme indicator (when using system) */}
        {themeMode === 'system' && (
          <View style={[styles.systemIndicator, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Icon
              name={resolvedTheme === 'dark' ? 'moon' : 'sun'}
              size={18}
              color={themeColors.textSecondary}
            />
            <Text style={[styles.systemIndicatorText, { color: themeColors.textSecondary }]}>
              {t('appearance.theme.currentlyUsing', {
                theme: t(resolvedTheme === 'dark' ? 'appearance.theme.dark' : 'appearance.theme.light'),
              })}
            </Text>
          </View>
        )}
      </View>

      {/* Accent Color Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('appearance.accentColor.title')}</Text>
        <Text style={[styles.sectionHint, { color: themeColors.textSecondary }]}>{t('appearance.accentColor.hint')}</Text>

        <ColorSelectorRow
          label={t('appearance.accentColor.selectLabel')}
          currentColorHex={accentColor.primary}
          currentColorLabel={accentColor.label}
          onPress={() => setShowAccentColorPicker(true)}
          themeColors={themeColors}
        />

        {/* Accent Color Picker Overlay */}
        <ColorPickerOverlay
          visible={showAccentColorPicker}
          onClose={() => setShowAccentColorPicker(false)}
          onSelect={(key) => void handleColorSelect(key)}
          colors={accentColorOptions}
          selectedValue={accentColorKey}
          title={t('appearance.accentColor.selectTitle')}
          themeColors={themeColors}
        />
      </View>

      {/* Module Colors Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('appearance.moduleColors.title')}</Text>
        <Text style={[styles.sectionHint, { color: themeColors.textSecondary }]}>{t('appearance.moduleColors.hint')}</Text>

        {/* Module color selectors */}
        {CUSTOMIZABLE_MODULES.map((moduleId) => {
          const currentHex = getModuleHex(moduleId);
          const currentColorOption = MODULE_COLOR_OPTIONS.find((opt) => opt.hex === currentHex);
          const colorLabel = currentColorOption?.label || currentHex;

          return (
            <ColorSelectorRow
              key={moduleId}
              label={t(MODULE_LABELS[moduleId])}
              currentColorHex={currentHex}
              currentColorLabel={colorLabel}
              onPress={() => setEditingModuleId(moduleId)}
              themeColors={themeColors}
            />
          );
        })}

        {/* Module Color Picker Overlay */}
        <ColorPickerOverlay
          visible={editingModuleId !== null}
          onClose={() => setEditingModuleId(null)}
          onSelect={(hex) => {
            if (editingModuleId) {
              void handleModuleColorSelect(editingModuleId, hex);
            }
          }}
          colors={moduleColorOptions}
          selectedValue={editingModuleId ? getModuleHex(editingModuleId) : ''}
          title={editingModuleId ? t('appearance.moduleColors.selectTitle', { module: t(MODULE_LABELS[editingModuleId]) }) : ''}
          themeColors={themeColors}
        />

        {/* Reset button */}
        {hasCustomColors && (
          <TouchableOpacity
            style={[styles.resetButton, { borderColor: themeColors.border }]}
            onPress={() => void handleResetModuleColors()}
            accessibilityRole="button"
            accessibilityLabel={t('appearance.moduleColors.reset')}
          >
            <Icon name="refresh" size={18} color={themeColors.textSecondary} />
            <Text style={[styles.resetButtonText, { color: themeColors.textSecondary }]}>
              {t('appearance.moduleColors.reset')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Preview Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('appearance.preview.title')}</Text>
        <Text style={[styles.sectionHint, { color: themeColors.textSecondary }]}>{t('appearance.preview.hint')}</Text>

        {/* Preview card showing current theme + accent */}
        <View style={[
          styles.previewCard,
          {
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }
        ]}>
          <View style={[styles.previewHeader, { backgroundColor: accentColor.primary }]}>
            <Icon name="chat" size={24} color={themeColors.textOnPrimary} />
            <Text style={[styles.previewHeaderText, { color: themeColors.textOnPrimary }]}>{t('tabs.chats')}</Text>
          </View>
          <View style={[styles.previewContent, { backgroundColor: themeColors.background }]}>
            <View style={[styles.previewMessage, { backgroundColor: themeColors.backgroundSecondary }]}>
              <Text style={[styles.previewMessageText, { color: themeColors.textPrimary }]}>
                {t('appearance.preview.sampleMessage')}
              </Text>
            </View>
            <View style={[styles.previewButton, { backgroundColor: accentColor.primary }]}>
              <Text style={[styles.previewButtonText, { color: themeColors.textOnPrimary }]}>{t('common.send')}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Info text */}
      <View style={[styles.infoSection, { backgroundColor: themeColors.backgroundSecondary }]}>
        <Icon name="info" size={18} color={themeColors.textTertiary} />
        <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
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
  // Module Colors
  moduleColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moduleColorLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  moduleColorPreview: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  moduleColorText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  moduleColorOptions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  moduleColorSwatch: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleColorSwatchSelected: {
    borderWidth: 2,
    borderColor: colors.textOnPrimary,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  resetButtonText: {
    ...typography.body,
    marginLeft: spacing.sm,
  },
  // Color Selector Row (for triggering overlay)
  colorSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: touchTargets.comfortable,
  },
  colorSelectorLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  colorSelectorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorSelectorPreview: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  // Overlay styles
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  overlayContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 320,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  overlayTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  overlayColorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
  overlayColorSwatch: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
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
  overlayColorSwatchSelected: {
    borderWidth: 3,
    borderColor: colors.textOnPrimary,
  },
});
