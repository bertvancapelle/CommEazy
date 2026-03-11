/**
 * PickerModal — Generic option picker modal
 *
 * Extracted from ProfileSettingsScreen for better separation of concerns.
 *
 * Features:
 * - Page sheet presentation (iOS)
 * - Scrollable option list with checkmark for selected item
 * - Senior-inclusive touch targets (≥60pt)
 * - Theme-aware styling
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { ScrollViewWithIndicator } from '@/components';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, touchTargets } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';

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
}

// ============================================================
// Component
// ============================================================

export function PickerModal({ visible, title, options, selectedValue, onSelect, onClose }: PickerModalProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const themeColors = useColors();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={[styles.closeText, { color: themeColors.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollViewWithIndicator style={styles.optionsList}>
          {options.map((option) => (
            <TouchableOpacity
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
            </TouchableOpacity>
          ))}
        </ScrollViewWithIndicator>
      </View>
    </Modal>
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
