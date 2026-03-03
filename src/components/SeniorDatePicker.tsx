/**
 * SeniorDatePicker — Reusable date picker for seniors
 *
 * Three large dropdown fields (dag/maand/jaar) that each open a
 * scrollable bottom sheet with large touch targets (60pt+).
 *
 * Designed for seniors who find standard date pickers too small/confusing.
 * Month names are displayed in the user's locale language.
 *
 * Reusable for: Contact dates, Agenda/Calendar module (future).
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useFeedback } from '@/hooks/useFeedback';

export interface SeniorDatePickerProps {
  /** Current date value as ISO string "YYYY-MM-DD" or undefined */
  value?: string;
  /** Called when date changes — receives ISO string "YYYY-MM-DD" or undefined */
  onChange: (date: string | undefined) => void;
  /** Accessibility label for the date picker group */
  accessibilityLabel?: string;
  /** Minimum year (default: 1900) */
  minYear?: number;
  /** Maximum year (default: current year) */
  maxYear?: number;
  /** Allow clearing the date (default: true) */
  allowClear?: boolean;
}

type PickerField = 'day' | 'month' | 'year';

/** Parse ISO date string into day/month/year components */
function parseDateValue(value?: string): { day?: number; month?: number; year?: number } {
  if (!value) return {};
  const parts = value.split('-');
  if (parts.length !== 3) return {};
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return {};
  return { year, month, day };
}

/** Format day/month/year into ISO date string */
function formatDateValue(day: number, month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Get number of days in a given month/year */
function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function SeniorDatePicker({
  value,
  onChange,
  accessibilityLabel,
  minYear = 1900,
  maxYear,
  allowClear = true,
}: SeniorDatePickerProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();
  const currentYear = new Date().getFullYear();
  const effectiveMaxYear = maxYear ?? currentYear;

  const parsed = useMemo(() => parseDateValue(value), [value]);
  const [activeField, setActiveField] = useState<PickerField | null>(null);

  // Month names in user's locale
  const monthNames = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => {
      const date = new Date(2024, i, 1);
      const name = formatter.format(date);
      return name.charAt(0).toUpperCase() + name.slice(1);
    });
  }, []);

  // Generate options for each field
  const dayOptions = useMemo(() => {
    const maxDays = parsed.month && parsed.year
      ? getDaysInMonth(parsed.month, parsed.year)
      : 31;
    return Array.from({ length: maxDays }, (_, i) => i + 1);
  }, [parsed.month, parsed.year]);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = effectiveMaxYear; y >= minYear; y--) {
      years.push(y);
    }
    return years;
  }, [minYear, effectiveMaxYear]);

  const openField = useCallback((field: PickerField) => {
    void triggerFeedback('tap');
    setActiveField(field);
  }, [triggerFeedback]);

  const closeField = useCallback(() => {
    setActiveField(null);
  }, []);

  const handleSelect = useCallback((field: PickerField, selectedValue: number) => {
    void triggerFeedback('tap');

    const newDay = field === 'day' ? selectedValue : parsed.day;
    const newMonth = field === 'month' ? selectedValue : parsed.month;
    const newYear = field === 'year' ? selectedValue : parsed.year;

    // If all three are set, emit a complete date
    if (newDay && newMonth && newYear) {
      // Clamp day to max days in new month/year
      const maxDays = getDaysInMonth(newMonth, newYear);
      const clampedDay = Math.min(newDay, maxDays);
      onChange(formatDateValue(clampedDay, newMonth, newYear));
    } else if (newDay || newMonth || newYear) {
      // Partial — still emit if at least one component changed
      // Build a partial date for state tracking
      const partialDay = newDay ?? 1;
      const partialMonth = newMonth ?? 1;
      const partialYear = newYear ?? currentYear;
      onChange(formatDateValue(partialDay, partialMonth, partialYear));
    }

    setActiveField(null);
  }, [parsed, onChange, triggerFeedback, currentYear]);

  const handleClear = useCallback(() => {
    void triggerFeedback('tap');
    onChange(undefined);
  }, [onChange, triggerFeedback]);

  // Display values
  const dayDisplay = parsed.day ? String(parsed.day) : t('contacts.datePicker.day');
  const monthDisplay = parsed.month ? monthNames[parsed.month - 1] : t('contacts.datePicker.month');
  const yearDisplay = parsed.year ? String(parsed.year) : t('contacts.datePicker.year');

  // Get title for bottom sheet
  const getSheetTitle = (field: PickerField): string => {
    switch (field) {
      case 'day': return t('contacts.datePicker.selectDay');
      case 'month': return t('contacts.datePicker.selectMonth');
      case 'year': return t('contacts.datePicker.selectYear');
    }
  };

  // Get options for bottom sheet
  const getSheetOptions = (field: PickerField): { value: number; label: string }[] => {
    switch (field) {
      case 'day':
        return dayOptions.map(d => ({ value: d, label: String(d) }));
      case 'month':
        return monthNames.map((name, i) => ({ value: i + 1, label: name }));
      case 'year':
        return yearOptions.map(y => ({ value: y, label: String(y) }));
    }
  };

  // Get currently selected value for a field
  const getSelectedValue = (field: PickerField): number | undefined => {
    switch (field) {
      case 'day': return parsed.day;
      case 'month': return parsed.month;
      case 'year': return parsed.year;
    }
  };

  return (
    <View
      style={styles.container}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="none"
    >
      {/* Three field buttons in a row */}
      <View style={styles.fieldsRow}>
        {/* Day */}
        <TouchableOpacity
          style={[
            styles.fieldButton,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            },
          ]}
          onPress={() => openField('day')}
          accessibilityRole="button"
          accessibilityLabel={`${t('contacts.datePicker.day')}: ${dayDisplay}`}
          accessibilityHint={t('contacts.datePicker.selectDay')}
        >
          <Text
            style={[
              styles.fieldText,
              { color: parsed.day ? themeColors.textPrimary : themeColors.textTertiary },
            ]}
            numberOfLines={1}
          >
            {dayDisplay}
          </Text>
          <Text style={[styles.chevron, { color: themeColors.textTertiary }]}>▼</Text>
        </TouchableOpacity>

        {/* Month */}
        <TouchableOpacity
          style={[
            styles.fieldButton,
            styles.monthButton,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            },
          ]}
          onPress={() => openField('month')}
          accessibilityRole="button"
          accessibilityLabel={`${t('contacts.datePicker.month')}: ${monthDisplay}`}
          accessibilityHint={t('contacts.datePicker.selectMonth')}
        >
          <Text
            style={[
              styles.fieldText,
              { color: parsed.month ? themeColors.textPrimary : themeColors.textTertiary },
            ]}
            numberOfLines={1}
          >
            {monthDisplay}
          </Text>
          <Text style={[styles.chevron, { color: themeColors.textTertiary }]}>▼</Text>
        </TouchableOpacity>

        {/* Year */}
        <TouchableOpacity
          style={[
            styles.fieldButton,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            },
          ]}
          onPress={() => openField('year')}
          accessibilityRole="button"
          accessibilityLabel={`${t('contacts.datePicker.year')}: ${yearDisplay}`}
          accessibilityHint={t('contacts.datePicker.selectYear')}
        >
          <Text
            style={[
              styles.fieldText,
              { color: parsed.year ? themeColors.textPrimary : themeColors.textTertiary },
            ]}
            numberOfLines={1}
          >
            {yearDisplay}
          </Text>
          <Text style={[styles.chevron, { color: themeColors.textTertiary }]}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Clear button */}
      {allowClear && value && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClear}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.datePicker.clear')}
        >
          <Text style={[styles.clearText, { color: themeColors.error }]}>
            {t('contacts.datePicker.clear')}
          </Text>
        </TouchableOpacity>
      )}

      {/* Bottom sheet modal */}
      {activeField && (
        <Modal
          visible={true}
          transparent
          animationType="slide"
          onRequestClose={closeField}
        >
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={closeField}
          >
            <SafeAreaView style={styles.sheetSafeArea}>
              <TouchableOpacity activeOpacity={1} style={[styles.sheetContainer, { backgroundColor: themeColors.background }]}>
                {/* Header */}
                <View style={[styles.sheetHeader, { borderBottomColor: themeColors.divider }]}>
                  <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>
                    {getSheetTitle(activeField)}
                  </Text>
                  <TouchableOpacity
                    onPress={closeField}
                    style={styles.sheetCloseButton}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.cancel')}
                  >
                    <Text style={[styles.sheetCloseText, { color: themeColors.primary }]}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Options list */}
                <ScrollView
                  style={styles.sheetList}
                  contentContainerStyle={styles.sheetListContent}
                  showsVerticalScrollIndicator={true}
                >
                  {getSheetOptions(activeField).map((option) => {
                    const isSelected = option.value === getSelectedValue(activeField);
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.sheetOption,
                          {
                            borderBottomColor: themeColors.divider,
                            backgroundColor: isSelected ? themeColors.primary + '15' : 'transparent',
                          },
                        ]}
                        onPress={() => handleSelect(activeField, option.value)}
                        accessibilityRole="button"
                        accessibilityLabel={option.label}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text
                          style={[
                            styles.sheetOptionText,
                            {
                              color: isSelected ? themeColors.primary : themeColors.textPrimary,
                              fontWeight: isSelected ? '700' : '400',
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                        {isSelected && (
                          <Text style={[styles.checkmark, { color: themeColors.primary }]}>✓</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </TouchableOpacity>
            </SafeAreaView>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  fieldsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fieldButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTargets.minimum,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  monthButton: {
    flex: 2, // Month gets more space for long names
  },
  fieldText: {
    ...typography.body,
    flex: 1,
  },
  chevron: {
    fontSize: 14,
    marginLeft: spacing.xs,
  },
  clearButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  clearText: {
    ...typography.label,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetSafeArea: {
    maxHeight: '60%',
  },
  sheetContainer: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '100%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    ...typography.h3,
  },
  sheetCloseButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  sheetCloseText: {
    ...typography.button,
  },
  sheetList: {
    flexGrow: 0,
  },
  sheetListContent: {
    paddingBottom: spacing.xl,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetOptionText: {
    ...typography.body,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: '700',
  },
});
