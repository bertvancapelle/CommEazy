/**
 * ColorPickerModal — App-wide standard color picker
 *
 * Wraps a color grid in a PanelAwareModal with theme-aware background
 * and consistent bottom-sheet presentation.
 *
 * This is the ONLY color picker component allowed in CommEazy.
 * All screens MUST use this component for color selection.
 *
 * Features:
 * - PanelAwareModal (stays within panel on iPad Split View)
 * - Bottom-sheet pattern with semi-transparent overlay (consistent with DateTimePickerModal)
 * - LiquidGlassView with module-specific tint color
 * - Generic type support for different color value types
 * - Senior-inclusive: 60pt+ touch targets, clear visual feedback
 * - "Gereed" (Done) button always visible at bottom
 *
 * Replaces: Inline ColorPickerModal in AppearanceSettingsScreen + ModuleColorsScreen
 *
 * @see src/components/DateTimePickerModal.tsx (same bottom-sheet pattern)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { HapticTouchable } from './HapticTouchable';
import { PanelAwareModal } from './PanelAwareModal';
import { LiquidGlassView } from './LiquidGlassView';
import { Icon } from './Icon';
import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

export interface ColorOption<T extends string = string> {
  /** Color value identifier (e.g. AccentColorKey, ButtonBorderColor, TextStyleColor) */
  value: T;
  /** Hex color to display as swatch */
  hex: string;
  /** Human-readable label for accessibility */
  label: string;
}

export interface ColorPickerModalProps<T extends string = string> {
  /** Whether the picker modal is visible */
  visible: boolean;
  /** Title shown in the modal header */
  title: string;
  /** Array of color options to display */
  colors: ColorOption<T>[];
  /** Currently selected color value */
  selectedValue: T;
  /** Module color ID for Liquid Glass tint */
  moduleId: ModuleColorId;
  /** Called when a color is selected */
  onSelect: (value: T) => void;
  /** Called when the modal should close */
  onClose: () => void;
}

// ============================================================
// Component
// ============================================================

export function ColorPickerModal<T extends string>({
  visible,
  title,
  colors: colorOptions,
  selectedValue,
  moduleId,
  onSelect,
  onClose,
}: ColorPickerModalProps<T>) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();

  const handleSelect = (value: T) => {
    onSelect(value);
    onClose();
  };

  return (
    <PanelAwareModal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      moduleId={moduleId}
    >
      <View style={styles.overlay}>
        <LiquidGlassView moduleId={moduleId} style={styles.container} cornerRadius={0}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {title}
            </Text>
          </View>

          {/* Color Grid */}
          <View style={styles.content}>
            <View style={styles.colorGrid}>
              {colorOptions.map((option) => (
                <HapticTouchable hapticDisabled
                  key={option.value}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: option.hex },
                    selectedValue === option.value && styles.colorSwatchSelected,
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

          {/* Done button at bottom */}
          <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
            <HapticTouchable hapticDisabled
              style={[styles.doneButton, { backgroundColor: accentColor.primary }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.done')}
            >
              <Text style={styles.doneButtonText}>
                {t('common.done')}
              </Text>
            </HapticTouchable>
          </View>
        </LiquidGlassView>
      </View>
    </PanelAwareModal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    overflow: 'hidden',
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
  doneButton: {
    minHeight: touchTargets.comfortable,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  doneButtonText: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
  },
});

export default ColorPickerModal;
