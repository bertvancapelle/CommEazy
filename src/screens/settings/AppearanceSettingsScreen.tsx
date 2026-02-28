/**
 * AppearanceSettingsScreen — Theme and Color Settings
 *
 * Allows users to:
 * - Select theme mode (Light / Dark / System)
 * - Choose accent color (16 options, 4x4 grid)
 * - Customize module colors (same 16-color palette)
 * - Preview the current appearance
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear visual feedback
 * - Simple 3-option theme selector
 * - Color overlay with large, tappable swatches
 * - Unified color palette for accent and modules
 *
 * @see .claude/plans/COLOR_THEME_SYSTEM_FOR_SENIORS.md
 * @see src/contexts/ThemeContext.tsx
 * @see src/contexts/AccentColorContext.tsx
 * @see src/contexts/ModuleColorsContext.tsx
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
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';

import { colors, typography, spacing, touchTargets, borderRadius, ACCENT_COLORS, ACCENT_COLOR_KEYS, DEFAULT_ACCENT_COLOR, type AccentColorKey } from '@/theme';
import { darkColors } from '@/theme/darkColors';
import { Icon, LiquidGlassView, type IconName } from '@/components';
import { useTheme, useColors, type ThemeMode } from '@/contexts/ThemeContext';
import { useAccentColorContext } from '@/contexts/AccentColorContext';
import {
  useModuleColorsContext,
  useModuleColor,
  CUSTOMIZABLE_MODULES,
  MODULE_LABELS,
  type ModuleColorId,
} from '@/contexts/ModuleColorsContext';
import { MODULE_TINT_COLORS } from '@/types/liquidGlass';
import { useLiquidGlassContext } from '@/contexts/LiquidGlassContext';
import { useButtonStyle, type ButtonBorderColor } from '@/contexts/ButtonStyleContext';
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
  const { getModuleHex, setModuleColor, resetModuleColor, resetAllColors, hasCustomColor, overrides: customColors } = useModuleColorsContext();

  // Liquid Glass context for integrated settings
  const {
    platform: liquidGlassPlatform,
    settings: liquidGlassSettings,
    accessibility: liquidGlassAccessibility,
    isEnabled: isLiquidGlassEnabled,
    setTintIntensity,
    setForceDisabled,
  } = useLiquidGlassContext();

  // Button style context for border settings
  const {
    settings: buttonStyleSettings,
    setBorderEnabled,
    setBorderColor,
    getBorderColorHex,
  } = useButtonStyle();

  // Get individual module colors for preview cards
  const radioColor = useModuleColor('radio');
  const podcastColor = useModuleColor('podcast');
  const booksColor = useModuleColor('books');
  const appleMusicColor = useModuleColor('appleMusic');
  const weatherColor = useModuleColor('weather');
  const chatsColor = useModuleColor('chats');

  // Overlay state for accent color picker
  const [showAccentColorPicker, setShowAccentColorPicker] = useState(false);

  // Overlay state for module color picker (which module is being edited)
  const [editingModuleId, setEditingModuleId] = useState<ModuleColorId | null>(null);

  // Overlay state for button border color picker
  const [showButtonBorderColorPicker, setShowButtonBorderColorPicker] = useState(false);

  // Prepare color options for overlay (unified palette for both accent and module colors)
  // Uses ACCENT_COLORS which has 16 colors in 4x4 grid
  const colorOptions = ACCENT_COLOR_KEYS.map((key) => ({
    value: key,
    hex: ACCENT_COLORS[key].primary,
    label: t(ACCENT_COLORS[key].label),
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

  // Handle module color selection (accepts AccentColorKey, converts to hex for storage)
  const handleModuleColorSelect = useCallback(
    async (moduleId: ModuleColorId, colorKey: AccentColorKey) => {
      await triggerFeedback('tap');
      const colorHex = ACCENT_COLORS[colorKey].primary;
      setModuleColor(moduleId, colorHex);
    },
    [setModuleColor, triggerFeedback]
  );

  // Helper: find AccentColorKey from hex (for showing selected state)
  const getColorKeyFromHex = useCallback((hex: string): AccentColorKey => {
    const found = ACCENT_COLOR_KEYS.find((key) => ACCENT_COLORS[key].primary === hex);
    return found || 'blue'; // Default to blue if not found
  }, []);

  // Handle reset accent color to default
  const handleResetAccentColor = useCallback(async () => {
    await triggerFeedback('tap');
    await updateAccentColor(DEFAULT_ACCENT_COLOR);
  }, [updateAccentColor, triggerFeedback]);

  // Handle reset single module color to default
  const handleResetModuleColor = useCallback(async (moduleId: ModuleColorId) => {
    await triggerFeedback('tap');
    resetModuleColor(moduleId);
  }, [resetModuleColor, triggerFeedback]);

  // Handle reset all module colors
  const handleResetModuleColors = useCallback(async () => {
    await triggerFeedback('tap');
    resetAllColors();
  }, [resetAllColors, triggerFeedback]);

  // Check if accent color is not default
  const isAccentColorCustom = accentColorKey !== DEFAULT_ACCENT_COLOR;

  // Check if any custom colors are set
  const hasCustomColors = Object.keys(customColors).length > 0;

  // Handle button border toggle
  const handleButtonBorderToggle = useCallback(
    async (enabled: boolean) => {
      await triggerFeedback('tap');
      await setBorderEnabled(enabled);
    },
    [setBorderEnabled, triggerFeedback]
  );

  // Handle button border color selection
  const handleButtonBorderColorSelect = useCallback(
    async (color: ButtonBorderColor) => {
      await triggerFeedback('tap');
      await setBorderColor(color);
    },
    [setBorderColor, triggerFeedback]
  );

  // Button border color options (16 accent colors + white + black)
  const buttonBorderColorOptions: Array<{ value: ButtonBorderColor; hex: string; label: string }> = [
    ...colorOptions.map(opt => ({ ...opt, value: opt.value as ButtonBorderColor })),
    { value: 'white', hex: '#FFFFFF', label: t('colors.white') },
    { value: 'black', hex: '#000000', label: t('colors.black') },
  ];

  // Get current button border color label
  const getButtonBorderColorLabel = (): string => {
    const color = buttonStyleSettings.borderColor;
    if (color === 'white') return t('colors.white');
    if (color === 'black') return t('colors.black');
    return t(ACCENT_COLORS[color]?.label || 'colors.white');
  };

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
          currentColorLabel={t(accentColor.label)}
          onPress={() => setShowAccentColorPicker(true)}
          themeColors={themeColors}
        />

        {/* Reset accent color button (only show if not default) */}
        {isAccentColorCustom && (
          <TouchableOpacity
            style={[styles.resetInlineButton, { borderColor: themeColors.border }]}
            onPress={() => void handleResetAccentColor()}
            accessibilityRole="button"
            accessibilityLabel={t('appearance.accentColor.reset')}
          >
            <Icon name="refresh" size={16} color={themeColors.textSecondary} />
            <Text style={[styles.resetInlineButtonText, { color: themeColors.textSecondary }]}>
              {t('appearance.accentColor.reset')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Accent Color Picker Overlay */}
        <ColorPickerOverlay
          visible={showAccentColorPicker}
          onClose={() => setShowAccentColorPicker(false)}
          onSelect={(key) => void handleColorSelect(key)}
          colors={colorOptions}
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
          const currentColorKey = getColorKeyFromHex(currentHex);
          const colorLabel = t(ACCENT_COLORS[currentColorKey].label);
          const isCustomized = hasCustomColor(moduleId);

          return (
            <View key={moduleId}>
              <ColorSelectorRow
                label={t(MODULE_LABELS[moduleId])}
                currentColorHex={currentHex}
                currentColorLabel={colorLabel}
                onPress={() => setEditingModuleId(moduleId)}
                themeColors={themeColors}
              />
              {/* Inline reset button for individual module */}
              {isCustomized && (
                <TouchableOpacity
                  style={[styles.resetInlineButton, { borderColor: themeColors.border, marginTop: -spacing.xs }]}
                  onPress={() => void handleResetModuleColor(moduleId)}
                  accessibilityRole="button"
                  accessibilityLabel={t('appearance.moduleColors.resetSingle', { module: t(MODULE_LABELS[moduleId]) })}
                >
                  <Icon name="refresh" size={14} color={themeColors.textSecondary} />
                  <Text style={[styles.resetInlineButtonText, { color: themeColors.textSecondary }]}>
                    {t('appearance.moduleColors.resetSingle', { module: t(MODULE_LABELS[moduleId]) })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Module Color Picker Overlay */}
        <ColorPickerOverlay
          visible={editingModuleId !== null}
          onClose={() => setEditingModuleId(null)}
          onSelect={(colorKey) => {
            if (editingModuleId) {
              void handleModuleColorSelect(editingModuleId, colorKey);
            }
          }}
          colors={colorOptions}
          selectedValue={editingModuleId ? getColorKeyFromHex(getModuleHex(editingModuleId)) : 'blue'}
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

      {/* Button Border Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('appearance.buttonBorder.title')}</Text>
        <Text style={[styles.sectionHint, { color: themeColors.textSecondary }]}>{t('appearance.buttonBorder.hint')}</Text>

        {/* Toggle for button border */}
        <View style={[styles.settingRow, { backgroundColor: themeColors.surface }]}>
          <View style={styles.settingLabelContainer}>
            <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
              {t('appearance.buttonBorder.toggle')}
            </Text>
          </View>
          <Switch
            value={buttonStyleSettings.borderEnabled}
            onValueChange={handleButtonBorderToggle}
            trackColor={{ false: themeColors.border, true: accentColor.primary }}
            thumbColor={Platform.OS === 'android' ? themeColors.surface : undefined}
            accessibilityLabel={t('appearance.buttonBorder.toggle')}
          />
        </View>

        {/* Color selector (always visible, grayed out when disabled) */}
        <View style={!buttonStyleSettings.borderEnabled && styles.disabledSection}>
          <ColorSelectorRow
            label={t('appearance.buttonBorder.color')}
            currentColorHex={getBorderColorHex()}
            currentColorLabel={getButtonBorderColorLabel()}
            onPress={() => buttonStyleSettings.borderEnabled && setShowButtonBorderColorPicker(true)}
            themeColors={themeColors}
          />
        </View>

        {/* Button Border Color Picker Overlay */}
        <ColorPickerOverlay
          visible={showButtonBorderColorPicker}
          onClose={() => setShowButtonBorderColorPicker(false)}
          onSelect={(color) => void handleButtonBorderColorSelect(color)}
          colors={buttonBorderColorOptions}
          selectedValue={buttonStyleSettings.borderColor}
          title={t('appearance.buttonBorder.selectTitle')}
          themeColors={themeColors}
        />
      </View>

      {/* Preview Section - Shows actual module colors */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('appearance.preview.title')}</Text>
        <Text style={[styles.sectionHint, { color: themeColors.textSecondary }]}>{t('appearance.preview.hint')}</Text>

        {/* Module color preview cards */}
        <View style={styles.previewCardsContainer}>
          <View style={[styles.modulePreviewCard, { backgroundColor: radioColor }]}>
            <Icon name="radio" size={32} color={themeColors.textOnPrimary} />
            <Text style={[styles.modulePreviewLabel, { color: themeColors.textOnPrimary }]}>{t('navigation.radio')}</Text>
          </View>

          <View style={[styles.modulePreviewCard, { backgroundColor: podcastColor }]}>
            <Icon name="podcast" size={32} color={themeColors.textOnPrimary} />
            <Text style={[styles.modulePreviewLabel, { color: themeColors.textOnPrimary }]}>{t('navigation.podcast')}</Text>
          </View>

          <View style={[styles.modulePreviewCard, { backgroundColor: booksColor }]}>
            <Icon name="book" size={32} color={themeColors.textOnPrimary} />
            <Text style={[styles.modulePreviewLabel, { color: themeColors.textOnPrimary }]}>{t('navigation.books')}</Text>
          </View>

          <View style={[styles.modulePreviewCard, { backgroundColor: appleMusicColor }]}>
            <Icon name="musical-note" size={32} color={themeColors.textOnPrimary} />
            <Text style={[styles.modulePreviewLabel, { color: themeColors.textOnPrimary }]}>{t('navigation.appleMusic')}</Text>
          </View>

          <View style={[styles.modulePreviewCard, { backgroundColor: weatherColor }]}>
            <Icon name="weather" size={32} color={themeColors.textOnPrimary} />
            <Text style={[styles.modulePreviewLabel, { color: themeColors.textOnPrimary }]}>{t('navigation.weather')}</Text>
          </View>

          <View style={[styles.modulePreviewCard, { backgroundColor: chatsColor }]}>
            <Icon name="chat" size={32} color={themeColors.textOnPrimary} />
            <Text style={[styles.modulePreviewLabel, { color: themeColors.textOnPrimary }]}>{t('tabs.chats')}</Text>
          </View>
        </View>
      </View>

      {/* Liquid Glass Section (iOS only) */}
      {Platform.OS === 'ios' && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('settings.liquidGlass.title')}</Text>

          {/* Platform status */}
          <View style={[styles.statusCard, { backgroundColor: themeColors.surface }]}>
            <View style={styles.statusRow}>
              <Icon
                name={liquidGlassPlatform.isSupported ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={liquidGlassPlatform.isSupported ? themeColors.success : themeColors.textTertiary}
              />
              <View style={styles.statusTextContainer}>
                <Text style={[styles.statusLabel, { color: themeColors.textPrimary }]}>
                  {liquidGlassPlatform.platform === 'ios'
                    ? t('settings.liquidGlass.iosVersion', { version: liquidGlassPlatform.iosVersion })
                    : t('settings.liquidGlass.android')}
                </Text>
                <Text style={[styles.statusHint, { color: themeColors.textSecondary }]}>
                  {liquidGlassPlatform.isSupported
                    ? t('settings.liquidGlass.enabled')
                    : t('settings.liquidGlass.iosRequired')}
                </Text>
              </View>
            </View>
          </View>

          {/* Accessibility warning */}
          {liquidGlassAccessibility.reduceTransparencyEnabled && (
            <View style={[styles.warningCard, { backgroundColor: themeColors.surface, borderColor: themeColors.warning }]}>
              <Icon name="warning" size={24} color={themeColors.warning} />
              <View style={styles.warningTextContainer}>
                <Text style={[styles.warningTitle, { color: themeColors.warning }]}>
                  {t('settings.liquidGlass.reduceTransparency')}
                </Text>
                <Text style={[styles.warningHint, { color: themeColors.textSecondary }]}>
                  {t('settings.liquidGlass.reduceTransparencyHint')}
                </Text>
              </View>
            </View>
          )}

          {/* Force disable toggle & intensity slider */}
          {liquidGlassPlatform.isSupported && !liquidGlassAccessibility.reduceTransparencyEnabled && (
            <>
              <View style={[styles.settingRow, { backgroundColor: themeColors.surface }]}>
                <View style={styles.settingLabelContainer}>
                  <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                    {t('settings.liquidGlass.forceDisable')}
                  </Text>
                  <Text style={[styles.settingHint, { color: themeColors.textSecondary }]}>
                    {t('settings.liquidGlass.forceDisableHint')}
                  </Text>
                </View>
                <Switch
                  value={liquidGlassSettings.forceDisabled}
                  onValueChange={setForceDisabled}
                  trackColor={{ false: themeColors.border, true: accentColor.primary }}
                  thumbColor={Platform.OS === 'android' ? themeColors.surface : undefined}
                  accessibilityLabel={t('settings.liquidGlass.forceDisable')}
                />
              </View>

              {/* Tint Intensity Slider */}
              {!liquidGlassSettings.forceDisabled && (
                <View style={styles.sliderSection}>
                  <Text style={[styles.sliderLabel, { color: themeColors.textPrimary }]}>
                    {t('settings.liquidGlass.tintIntensity')}
                  </Text>
                  <Text style={[styles.sliderHint, { color: themeColors.textSecondary }]}>
                    {t('settings.liquidGlass.tintIntensityHint')}
                  </Text>
                  <View style={[styles.sliderContainer, { backgroundColor: themeColors.surface }]}>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={100}
                      step={5}
                      value={liquidGlassSettings.tintIntensity}
                      onValueChange={setTintIntensity}
                      minimumTrackTintColor={accentColor.primary}
                      maximumTrackTintColor={themeColors.border}
                      thumbTintColor={accentColor.primary}
                      accessibilityLabel={t('settings.liquidGlass.tintIntensity')}
                      accessibilityValue={{ text: `${liquidGlassSettings.tintIntensity}%` }}
                    />
                    <Text style={[styles.sliderValue, { color: accentColor.primary }]}>
                      {liquidGlassSettings.tintIntensity}%
                    </Text>
                  </View>
                </View>
              )}

              {/* Status indicator */}
              <View style={styles.statusIndicator}>
                <Icon
                  name={isLiquidGlassEnabled ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={isLiquidGlassEnabled ? themeColors.success : themeColors.textTertiary}
                />
                <Text style={[styles.statusIndicatorText, { color: isLiquidGlassEnabled ? themeColors.success : themeColors.textTertiary }]}>
                  {isLiquidGlassEnabled ? t('settings.liquidGlass.enabled') : t('settings.liquidGlass.disabled')}
                </Text>
              </View>
            </>
          )}
        </View>
      )}

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
  // Inline reset button (smaller, for individual items)
  resetInlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  resetInlineButtonText: {
    ...typography.small,
    marginLeft: spacing.xs,
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
  // Module Preview Cards (2x2 grid)
  previewCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  modulePreviewCard: {
    width: '47%',
    aspectRatio: 1.2,
    borderRadius: borderRadius.lg,
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
  modulePreviewLabel: {
    ...typography.body,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  // Liquid Glass Section Styles
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  statusLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  statusHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  warningTitle: {
    ...typography.bodyBold,
  },
  warningHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    minHeight: touchTargets.comfortable,
  },
  settingLabelContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  settingHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sliderSection: {
    marginTop: spacing.sm,
  },
  sliderLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sliderHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: touchTargets.comfortable,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    ...typography.bodyBold,
    width: 50,
    textAlign: 'right',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  statusIndicatorText: {
    ...typography.body,
    marginLeft: spacing.sm,
  },
  // Disabled state for button border color selector
  disabledSection: {
    opacity: 0.5,
  },
});
