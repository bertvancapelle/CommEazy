/**
 * AppearanceSettingsScreen — Theme and Color Settings
 *
 * Allows users to:
 * - Select theme mode (Light / Dark / System)
 * - Choose accent color (16 options via pageSheet modal)
 * - Set global default module color (via pageSheet modal)
 * - Open separate Module Colors screen (pageSheet)
 * - Configure button border style
 * - Configure toolbar position (top/bottom toggle)
 * - Liquid Glass settings (iOS only)
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear visual feedback
 * - Simple 3-option theme selector
 * - All modals use consistent pageSheet/slide pattern with close button at bottom
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
  Platform,
  Modal,
  Switch,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';

import { colors, typography, spacing, touchTargets, borderRadius, ACCENT_COLORS, ACCENT_COLOR_KEYS, DEFAULT_ACCENT_COLOR, type AccentColorKey } from '@/theme';
import { Icon, LiquidGlassView, type IconName, ScrollViewWithIndicator } from '@/components';
import { useTheme, useColors, type ThemeMode } from '@/contexts/ThemeContext';
import { useAccentColorContext } from '@/contexts/AccentColorContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import {
  useModuleColorsContext,
} from '@/contexts/ModuleColorsContext';
import { MODULE_TINT_COLORS } from '@/types/liquidGlass';
import { useLiquidGlassContext } from '@/contexts/LiquidGlassContext';
import { useButtonStyle, type ButtonBorderColor } from '@/contexts/ButtonStyleContext';
import { useModuleLayout } from '@/contexts/ModuleLayoutContext';
import { useFeedback } from '@/hooks/useFeedback';
import { ModuleColorsScreen } from './ModuleColorsScreen';

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
    <HapticTouchable hapticDisabled
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
    </HapticTouchable>
  );
}

// ============================================================
// Color Picker Modal Component (pageSheet pattern)
// ============================================================

interface ColorPickerModalProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  onSelect: (value: T) => void;
  colors: Array<{ value: T; hex: string; label: string }>;
  selectedValue: T;
  title: string;
}

function ColorPickerModal<T extends string>({
  visible,
  onClose,
  onSelect,
  colors: colorOptions,
  selectedValue,
  title,
}: ColorPickerModalProps<T>) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();

  const handleSelect = (value: T) => {
    onSelect(value);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LiquidGlassView moduleId="settings" style={modalStyles.container} cornerRadius={0}>
        {/* Header */}
        <View style={[modalStyles.header, { borderBottomColor: themeColors.border }]}>
          <Text style={[modalStyles.title, { color: themeColors.textPrimary }]}>{title}</Text>
        </View>

        {/* Color Grid */}
        <View style={modalStyles.content}>
          <View style={modalStyles.colorGrid}>
            {colorOptions.map((option) => (
              <HapticTouchable hapticDisabled
                key={option.value}
                style={[
                  modalStyles.colorSwatch,
                  { backgroundColor: option.hex },
                  selectedValue === option.value && modalStyles.colorSwatchSelected,
                ]}
                onPress={() => handleSelect(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedValue === option.value }}
                accessibilityLabel={option.label}
              >
                {selectedValue === option.value && (
                  <Icon name="checkmark" size={24} color={colors.textOnPrimary} />
                )}
              </HapticTouchable>
            ))}
          </View>
        </View>

        {/* Close button at bottom */}
        <View style={[modalStyles.footer, { borderTopColor: themeColors.border }]}>
          <HapticTouchable hapticDisabled
            style={[modalStyles.closeButton, { backgroundColor: accentColor.primary }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={[modalStyles.closeButtonText, { color: colors.textOnPrimary }]}>
              {t('common.close')}
            </Text>
          </HapticTouchable>
        </View>
      </LiquidGlassView>
    </Modal>
  );
}

// ============================================================
// Color Selector Row Component (for triggering modal)
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
    <HapticTouchable hapticDisabled
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
    </HapticTouchable>
  );
}

// ============================================================
// Main Screen
// ============================================================

export function AppearanceSettingsScreen() {
  const { t } = useTranslation();
  const { triggerFeedback } = useFeedback();
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const themeColors = useColors();
  const { accentColorKey, accentColor, updateAccentColor } = useAccentColorContext();
  const { globalDefaultColor, setGlobalDefaultColor, resetGlobalDefault } = useModuleColorsContext();

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

  // Module layout context
  const { toolbarPosition, toggleToolbarPosition, resetToDefault, isCustomized } = useModuleLayout();

  // Modal states
  const [showAccentColorPicker, setShowAccentColorPicker] = useState(false);
  const [showGlobalColorPicker, setShowGlobalColorPicker] = useState(false);
  const [showButtonBorderColorPicker, setShowButtonBorderColorPicker] = useState(false);
  const [showModuleColors, setShowModuleColors] = useState(false);

  // Prepare color options for modals (unified palette)
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

  // Helper: find AccentColorKey from hex
  const getColorKeyFromHex = useCallback((hex: string): AccentColorKey => {
    const found = ACCENT_COLOR_KEYS.find((key) => ACCENT_COLORS[key].primary === hex);
    return found || 'blue';
  }, []);

  // Handle reset accent color to default
  const handleResetAccentColor = useCallback(async () => {
    await triggerFeedback('tap');
    await updateAccentColor(DEFAULT_ACCENT_COLOR);
  }, [updateAccentColor, triggerFeedback]);

  // Handle global default module color selection
  const handleGlobalDefaultColorSelect = useCallback(
    async (colorKey: AccentColorKey) => {
      await triggerFeedback('tap');
      const colorHex = ACCENT_COLORS[colorKey].primary;
      setGlobalDefaultColor(colorHex);
    },
    [setGlobalDefaultColor, triggerFeedback]
  );

  // Handle reset global default module color
  const handleResetGlobalDefault = useCallback(async () => {
    await triggerFeedback('tap');
    resetGlobalDefault();
  }, [resetGlobalDefault, triggerFeedback]);

  // Check if accent color is not default
  const isAccentColorCustom = accentColorKey !== DEFAULT_ACCENT_COLOR;

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

  // Handle toolbar position toggle
  const handleToolbarToggle = useCallback(
    async (enabled: boolean) => {
      await triggerFeedback('tap');
      toggleToolbarPosition();
    },
    [toggleToolbarPosition, triggerFeedback]
  );

  const handleLayoutReset = useCallback(async () => {
    await triggerFeedback('tap');
    resetToDefault();
  }, [resetToDefault, triggerFeedback]);

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
    <ScrollViewWithIndicator style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.contentContainer}>
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
          <HapticTouchable hapticDisabled
            style={[styles.resetInlineButton, { borderColor: themeColors.border }]}
            onPress={() => void handleResetAccentColor()}
            accessibilityRole="button"
            accessibilityLabel={t('appearance.accentColor.reset')}
          >
            <Icon name="refresh" size={16} color={themeColors.textSecondary} />
            <Text style={[styles.resetInlineButtonText, { color: themeColors.textSecondary }]}>
              {t('appearance.accentColor.reset')}
            </Text>
          </HapticTouchable>
        )}

        {/* Accent Color Picker Modal */}
        <ColorPickerModal
          visible={showAccentColorPicker}
          onClose={() => setShowAccentColorPicker(false)}
          onSelect={(key) => void handleColorSelect(key)}
          colors={colorOptions}
          selectedValue={accentColorKey}
          title={t('appearance.accentColor.selectTitle')}
        />
      </View>

      {/* Global Default Module Color Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('appearance.globalDefaultColor')}</Text>
        <Text style={[styles.sectionHint, { color: themeColors.textSecondary }]}>{t('appearance.globalDefaultColorHint')}</Text>

        <ColorSelectorRow
          label={t('appearance.globalDefaultColor')}
          currentColorHex={globalDefaultColor || MODULE_TINT_COLORS.chats?.tintColor || '#0D47A1'}
          currentColorLabel={globalDefaultColor ? t(ACCENT_COLORS[getColorKeyFromHex(globalDefaultColor)].label) : t('appearance.usingDefault')}
          onPress={() => setShowGlobalColorPicker(true)}
          themeColors={themeColors}
        />

        {/* Reset global default button (only show if custom global color is set) */}
        {globalDefaultColor && (
          <HapticTouchable hapticDisabled
            style={[styles.resetInlineButton, { borderColor: themeColors.border }]}
            onPress={() => void handleResetGlobalDefault()}
            accessibilityRole="button"
            accessibilityLabel={t('appearance.resetToDefault')}
          >
            <Icon name="refresh" size={16} color={themeColors.textSecondary} />
            <Text style={[styles.resetInlineButtonText, { color: themeColors.textSecondary }]}>
              {t('appearance.resetToDefault')}
            </Text>
          </HapticTouchable>
        )}

        {/* Global Color Picker Modal */}
        <ColorPickerModal
          visible={showGlobalColorPicker}
          onClose={() => setShowGlobalColorPicker(false)}
          onSelect={(key) => void handleGlobalDefaultColorSelect(key)}
          colors={colorOptions}
          selectedValue={globalDefaultColor ? getColorKeyFromHex(globalDefaultColor) : 'blue'}
          title={t('appearance.globalDefaultColor')}
        />
      </View>

      {/* Module Colors Navigation Row */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('appearance.moduleColors.title')}</Text>
        <Text style={[styles.sectionHint, { color: themeColors.textSecondary }]}>{t('appearance.moduleColors.hint')}</Text>

        <HapticTouchable hapticDisabled
          style={[styles.colorSelectorRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          onPress={() => setShowModuleColors(true)}
          accessibilityRole="button"
          accessibilityLabel={t('appearance.moduleColors.title')}
        >
          <Text style={[styles.colorSelectorLabel, { color: themeColors.textPrimary }]}>{t('appearance.moduleColors.title')}</Text>
          <View style={styles.colorSelectorRight}>
            <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
          </View>
        </HapticTouchable>

        {/* Module Colors Screen (separate pageSheet modal) */}
        <ModuleColorsScreen
          visible={showModuleColors}
          onClose={() => setShowModuleColors(false)}
        />
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

        {/* Button Border Color Picker Modal */}
        <ColorPickerModal
          visible={showButtonBorderColorPicker}
          onClose={() => setShowButtonBorderColorPicker(false)}
          onSelect={(color) => void handleButtonBorderColorSelect(color)}
          colors={buttonBorderColorOptions}
          selectedValue={buttonStyleSettings.borderColor}
          title={t('appearance.buttonBorder.selectTitle')}
        />
      </View>

      {/* Module Layout Section — Toolbar Position */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('appearance.moduleLayout.title')}</Text>
        <Text style={[styles.sectionHint, { color: themeColors.textSecondary }]}>{t('appearance.moduleLayout.hint')}</Text>

        {/* Toggle: toolbar at bottom */}
        <View style={[styles.settingRow, { backgroundColor: themeColors.surface }]}>
          <View style={styles.settingLabelContainer}>
            <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
              {t('appearance.moduleLayout.bottomToggle')}
            </Text>
            <Text style={[styles.settingHint, { color: themeColors.textSecondary }]}>
              {t('appearance.moduleLayout.bottomToggleHint')}
            </Text>
          </View>
          <Switch
            value={toolbarPosition === 'bottom'}
            onValueChange={handleToolbarToggle}
            trackColor={{ false: themeColors.border, true: accentColor.primary }}
            thumbColor={Platform.OS === 'android' ? themeColors.surface : undefined}
            accessibilityLabel={t('appearance.moduleLayout.bottomToggle')}
          />
        </View>

        {/* Reset button (only if customized) */}
        {isCustomized && (
          <HapticTouchable hapticDisabled
            style={[styles.resetInlineButton, { borderColor: themeColors.border }]}
            onPress={() => void handleLayoutReset()}
            accessibilityRole="button"
            accessibilityLabel={t('appearance.moduleLayout.reset')}
          >
            <Icon name="refresh" size={16} color={themeColors.textSecondary} />
            <Text style={[styles.resetInlineButtonText, { color: themeColors.textSecondary }]}>
              {t('appearance.moduleLayout.reset')}
            </Text>
          </HapticTouchable>
        )}
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
    </ScrollViewWithIndicator>
  );
}

// ============================================================
// Modal Styles (shared across all pageSheet modals)
// ============================================================

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
  colorSwatch: {
    width: 60,
    height: 60,
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
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: colors.textOnPrimary,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  closeButton: {
    minHeight: touchTargets.comfortable,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    ...typography.bodyBold,
  },
});

// ============================================================
// Screen Styles
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
  // Color Selector Row
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
  // Reset buttons
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
  // Disabled state
  disabledSection: {
    opacity: 0.5,
  },
});
