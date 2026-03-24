/**
 * DateTimePickerModal — App-wide standard date & time picker
 *
 * Wraps @react-native-community/datetimepicker in a PanelAwareModal
 * as a compact bottom-sheet with semi-transparent module color overlay.
 *
 * This is the ONLY date/time picker component allowed in CommEazy.
 * All screens MUST use this component for date and time selection.
 *
 * Features:
 * - PanelAwareModal transparent overlay (stays within panel on iPad Split View)
 * - Semi-transparent module color overlay (~40% opacity)
 * - Compact bottom-positioned picker with solid surface background
 * - Native iOS spinner / Android default picker
 * - "Gereed" (Done) button with module accent color
 * - Locale-aware via i18n
 * - Senior-inclusive: 60pt+ touch targets
 *
 * Design: Does NOT use LiquidGlassView (avoids Yoga flex-end conflict on iOS 26).
 * Uses solid surface background instead.
 *
 * Replaces: SeniorDatePicker (deprecated — removed)
 * Extracted from: AgendaItemFormScreen (local DateTimePickerModal)
 *
 * @see CLAUDE.md section "Date/Time Picker Standard"
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';

import { HapticTouchable } from './HapticTouchable';
import { PanelAwareModal } from './PanelAwareModal';
import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

export interface DateTimePickerModalProps {
  /** Whether the picker modal is visible */
  visible: boolean;
  /** Title shown in the modal header */
  title: string;
  /** Current date/time value */
  value: Date;
  /** Picker mode: 'date' for date selection, 'time' for time selection */
  mode: 'date' | 'time';
  /** Module color ID for overlay tint and Done button color */
  moduleId: ModuleColorId;
  /** Called when the user changes the date/time */
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
  /** Called when the modal should close */
  onClose: () => void;
  /** Minimum selectable date (date mode only) */
  minimumDate?: Date;
  /** Maximum selectable date (date mode only) */
  maximumDate?: Date;
  /** Use 24-hour format for time picker (default: true) */
  is24Hour?: boolean;
  /** Locale for the native picker (e.g. 'nl-NL', 'de-DE') */
  locale?: string;
}

// Re-export the event type for consumers
export type { DateTimePickerEvent };

// ============================================================
// Component
// ============================================================

export function DateTimePickerModal({
  visible,
  title,
  value,
  mode,
  moduleId,
  onChange,
  onClose,
  minimumDate,
  maximumDate,
  is24Hour = true,
  locale,
}: DateTimePickerModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(moduleId);

  return (
    <PanelAwareModal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      moduleId={moduleId}
    >
      {/* Overlay — semi-transparent module color, tap to dismiss */}
      <Pressable
        style={[styles.overlay, { backgroundColor: moduleColor + '66' }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      />

      {/* Compact picker sheet at bottom */}
      <View style={[styles.sheet, { backgroundColor: themeColors.surface }]}>
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {title}
          </Text>
          <HapticTouchable
            style={[styles.doneButton, { backgroundColor: moduleColor }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.done')}
          >
            <Text style={styles.doneButtonText}>
              {t('common.done')}
            </Text>
          </HapticTouchable>
        </View>
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={value}
            mode={mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            is24Hour={is24Hour}
            locale={locale}
          />
        </View>
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
  },
  sheet: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    ...typography.h3,
  },
  doneButton: {
    minWidth: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  doneButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  pickerContainer: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});

export default DateTimePickerModal;
