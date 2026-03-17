/**
 * PickerModal — Generic option picker modal
 *
 * Extracted from ProfileSettingsScreen for better separation of concerns.
 *
 * Features:
 * - PanelAwareModal (stays within panel on iPad Split View)
 * - Page sheet presentation on iPhone (iOS)
 * - Scrollable option list with checkmark for selected item
 * - Senior-inclusive touch targets (≥60pt)
 * - Theme-aware styling
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { ScrollViewWithIndicator, PanelAwareModal } from '@/components';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, touchTargets } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Props
// ============================================================

export interface PickerModalProps {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  /** Module color ID for Liquid Glass tint (iOS 26+) */
  moduleId?: ModuleColorId;
}

// ============================================================
// Component
// ============================================================

export function PickerModal({ visible, title, options, selectedValue, onSelect, onClose, moduleId }: PickerModalProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const themeColors = useColors();
  return (
    <PanelAwareModal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      moduleId={moduleId ?? 'settings'}
    >
      <LiquidGlassView moduleId={moduleId ?? 'settings'} style={styles.container} cornerRadius={0}>
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{title}</Text>
          <HapticTouchable hapticDisabled
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={[styles.closeText, { color: themeColors.textSecondary }]}>✕</Text>
          </HapticTouchable>
        </View>
        <ScrollViewWithIndicator style={styles.optionsList}>
          {options.map((option) => (
            <HapticTouchable hapticDisabled
              key={option.value}
              style={[
                styles.option,
                { borderBottomColor: themeColors.border },
                selectedValue === option.value && { backgroundColor: accentColor.primaryLight + '20' },
              ]}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: selectedValue === option.value }}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: themeColors.textPrimary },
                  selectedValue === option.value && { color: accentColor.primary, fontWeight: '600' },
                ]}
              >
                {option.label}
              </Text>
              {selectedValue === option.value && (
                <Text style={[styles.checkmark, { color: accentColor.primary }]}>✓</Text>
              )}
            </HapticTouchable>
          ))}
        </ScrollViewWithIndicator>
      </LiquidGlassView>
    </PanelAwareModal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  optionsList: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  checkmark: {
    ...typography.h3,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
});

export default PickerModal;
