/**
 * ModuleColorsScreen — Separate pageSheet modal for per-module color customization
 *
 * Shows a compact list of customizable modules with color dot indicators.
 * Tapping a module opens a color picker (same 16-color palette).
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear visual feedback (color dot + label)
 * - Consistent pageSheet presentation
 * - Close button at bottom
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';

import { colors, typography, spacing, touchTargets, borderRadius, ACCENT_COLORS, ACCENT_COLOR_KEYS, type AccentColorKey } from '@/theme';
import { Icon, LiquidGlassView, ScrollViewWithIndicator, type IconName } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import {
  useModuleColorsContext,
  CUSTOMIZABLE_MODULES,
  MODULE_LABELS,
  type ModuleColorId,
} from '@/contexts/ModuleColorsContext';
import { useFeedback } from '@/hooks/useFeedback';

// ============================================================
// Module Icon Mapping
// ============================================================

const MODULE_ICONS: Record<ModuleColorId, IconName> = {
  chats: 'chat',
  messages: 'chat',
  contacts: 'contacts',
  groups: 'groups',
  calls: 'phone',
  videocall: 'videocam',
  radio: 'radio',
  podcast: 'podcast',
  books: 'book',
  audiobook: 'headphones',
  ebook: 'book',
  weather: 'weather',
  nunl: 'news',
  appleMusic: 'musical-note',
  camera: 'camera',
  photoAlbum: 'image',
  askAI: 'sparkles',
  mail: 'mail',
  agenda: 'calendar',
  settings: 'settings',
};

// ============================================================
// Props
// ============================================================

export interface ModuleColorsScreenProps {
  visible: boolean;
  onClose: () => void;
}

// ============================================================
// Color Picker Modal (pageSheet, consistent with app pattern)
// ============================================================

interface ColorPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (colorKey: AccentColorKey) => void;
  selectedValue: AccentColorKey;
  title: string;
}

function ColorPickerModal({ visible, onClose, onSelect, selectedValue, title }: ColorPickerModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();

  const colorOptions = ACCENT_COLOR_KEYS.map((key) => ({
    value: key,
    hex: ACCENT_COLORS[key].primary,
    label: t(ACCENT_COLORS[key].label),
  }));

  const handleSelect = (value: AccentColorKey) => {
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
      <LiquidGlassView moduleId="settings" style={pickerStyles.container} cornerRadius={0}>
        {/* Header */}
        <View style={[pickerStyles.header, { borderBottomColor: themeColors.border }]}>
          <Text style={[pickerStyles.title, { color: themeColors.textPrimary }]}>{title}</Text>
        </View>

        {/* Color Grid */}
        <View style={pickerStyles.content}>
          <View style={pickerStyles.colorGrid}>
            {colorOptions.map((option) => (
              <HapticTouchable hapticDisabled
                key={option.value}
                style={[
                  pickerStyles.colorSwatch,
                  { backgroundColor: option.hex },
                  selectedValue === option.value && pickerStyles.colorSwatchSelected,
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
        <View style={[pickerStyles.footer, { borderTopColor: themeColors.border }]}>
          <HapticTouchable hapticDisabled
            style={[pickerStyles.closeButton, { backgroundColor: accentColor.primary }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={[pickerStyles.closeButtonText, { color: colors.textOnPrimary }]}>
              {t('common.close')}
            </Text>
          </HapticTouchable>
        </View>
      </LiquidGlassView>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
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
// Main Component
// ============================================================

export function ModuleColorsScreen({ visible, onClose }: ModuleColorsScreenProps) {
  const { t } = useTranslation();
  const { triggerFeedback } = useFeedback();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { getModuleHex, setModuleColor, resetModuleColor, resetAllColors, hasCustomColor, overrides: customColors } = useModuleColorsContext();

  // State for which module's color picker is open
  const [editingModuleId, setEditingModuleId] = useState<ModuleColorId | null>(null);

  // Helper: find AccentColorKey from hex
  const getColorKeyFromHex = useCallback((hex: string): AccentColorKey => {
    const found = ACCENT_COLOR_KEYS.find((key) => ACCENT_COLORS[key].primary === hex);
    return found || 'blue';
  }, []);

  // Handle module color selection
  const handleModuleColorSelect = useCallback(
    async (colorKey: AccentColorKey) => {
      if (!editingModuleId) return;
      await triggerFeedback('tap');
      const colorHex = ACCENT_COLORS[colorKey].primary;
      setModuleColor(editingModuleId, colorHex);
    },
    [editingModuleId, setModuleColor, triggerFeedback]
  );

  // Handle reset single module color
  const handleResetModuleColor = useCallback(async (moduleId: ModuleColorId) => {
    await triggerFeedback('tap');
    resetModuleColor(moduleId);
  }, [resetModuleColor, triggerFeedback]);

  // Handle reset all module colors
  const handleResetModuleColors = useCallback(async () => {
    await triggerFeedback('tap');
    resetAllColors();
  }, [resetAllColors, triggerFeedback]);

  const hasCustomColors = Object.keys(customColors).length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LiquidGlassView moduleId="settings" style={styles.container} cornerRadius={0}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {t('appearance.moduleColors.title')}
          </Text>
        </View>

        {/* Module list */}
        <ScrollViewWithIndicator style={styles.list} contentContainerStyle={styles.listContent}>
          <Text style={[styles.hint, { color: themeColors.textSecondary }]}>
            {t('appearance.moduleColors.hint')}
          </Text>

          {CUSTOMIZABLE_MODULES.map((moduleId) => {
            const currentHex = getModuleHex(moduleId);
            const isCustomized = hasCustomColor(moduleId);
            const icon = MODULE_ICONS[moduleId] || 'info';

            return (
              <View key={moduleId} style={styles.moduleRow}>
                <HapticTouchable hapticDisabled
                  style={[styles.moduleItem, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                  onPress={() => setEditingModuleId(moduleId)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(MODULE_LABELS[moduleId])}: ${t('appearance.moduleColors.hint')}`}
                >
                  {/* Icon + Label */}
                  <View style={styles.moduleLeft}>
                    <Icon name={icon} size={24} color={currentHex} />
                    <Text style={[styles.moduleLabel, { color: themeColors.textPrimary }]}>
                      {t(MODULE_LABELS[moduleId])}
                    </Text>
                  </View>

                  {/* Color dot + chevron */}
                  <View style={styles.moduleRight}>
                    <View style={[styles.colorDot, { backgroundColor: currentHex }]} />
                    <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
                  </View>
                </HapticTouchable>

                {/* Inline reset for individual module */}
                {isCustomized && (
                  <HapticTouchable hapticDisabled
                    style={styles.resetInlineButton}
                    onPress={() => void handleResetModuleColor(moduleId)}
                    accessibilityRole="button"
                    accessibilityLabel={t('appearance.moduleColors.resetSingle', { module: t(MODULE_LABELS[moduleId]) })}
                  >
                    <Icon name="refresh" size={14} color={themeColors.textSecondary} />
                    <Text style={[styles.resetInlineText, { color: themeColors.textSecondary }]}>
                      {t('appearance.moduleColors.resetSingle', { module: t(MODULE_LABELS[moduleId]) })}
                    </Text>
                  </HapticTouchable>
                )}
              </View>
            );
          })}

          {/* Reset all button */}
          {hasCustomColors && (
            <HapticTouchable hapticDisabled
              style={[styles.resetAllButton, { borderColor: themeColors.border }]}
              onPress={() => void handleResetModuleColors()}
              accessibilityRole="button"
              accessibilityLabel={t('appearance.moduleColors.reset')}
            >
              <Icon name="refresh" size={18} color={themeColors.textSecondary} />
              <Text style={[styles.resetAllText, { color: themeColors.textSecondary }]}>
                {t('appearance.moduleColors.reset')}
              </Text>
            </HapticTouchable>
          )}
        </ScrollViewWithIndicator>

        {/* Footer with close button */}
        <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
          <HapticTouchable hapticDisabled
            style={[styles.closeButton, { backgroundColor: accentColor.primary }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={[styles.closeButtonText, { color: colors.textOnPrimary }]}>
              {t('common.close')}
            </Text>
          </HapticTouchable>
        </View>
      </LiquidGlassView>

      {/* Color Picker for selected module */}
      <ColorPickerModal
        visible={editingModuleId !== null}
        onClose={() => setEditingModuleId(null)}
        onSelect={(colorKey) => void handleModuleColorSelect(colorKey)}
        selectedValue={editingModuleId ? getColorKeyFromHex(getModuleHex(editingModuleId)) : 'blue'}
        title={editingModuleId ? t('appearance.moduleColors.selectTitle', { module: t(MODULE_LABELS[editingModuleId]) }) : ''}
      />
    </Modal>
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
    padding: spacing.lg,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
  },
  hint: {
    ...typography.small,
    marginBottom: spacing.md,
  },
  moduleRow: {
    marginBottom: spacing.xs,
  },
  moduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    minHeight: touchTargets.comfortable,
  },
  moduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  moduleLabel: {
    ...typography.body,
  },
  moduleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  resetInlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  resetInlineText: {
    ...typography.small,
    marginLeft: spacing.xs,
  },
  resetAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  resetAllText: {
    ...typography.body,
    marginLeft: spacing.sm,
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

export default ModuleColorsScreen;
