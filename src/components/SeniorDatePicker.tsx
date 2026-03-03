/**
 * SeniorDatePicker — Reusable date picker for seniors
 *
 * Single touchable field showing the full date as readable text
 * (e.g. "20 november 2026") or a placeholder ("Kies een datum").
 *
 * Tap opens a bottom-sheet popup with Day, Month, Year sections
 * stacked vertically. Each section expands into a scrollable list
 * when tapped. Auto-closes when all three fields are filled.
 *
 * Designed for seniors who find standard date pickers too small/confusing.
 * Month names are hardcoded per supported language (13 locales)
 * for Hermes compatibility — Intl.DateTimeFormat has limited locale support.
 *
 * Reusable for: Contact dates, Agenda/Calendar module (future).
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useFeedback } from '@/hooks/useFeedback';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

// Month names per supported language — hardcoded for Hermes compatibility
// (Intl.DateTimeFormat on React Native/Hermes has limited locale support)
const MONTH_NAMES: Record<string, string[]> = {
  nl: ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  'en-GB': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  it: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
  no: ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'],
  sv: ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'],
  da: ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December'],
  pt: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  'pt-BR': ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  pl: ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'],
};

/** Get month names for the given language, with English fallback */
function getMonthNames(language: string): string[] {
  return MONTH_NAMES[language] ?? MONTH_NAMES[language.substring(0, 2)] ?? MONTH_NAMES.en;
}

export function SeniorDatePicker({
  value,
  onChange,
  accessibilityLabel,
  minYear = 1900,
  maxYear,
  allowClear = true,
}: SeniorDatePickerProps) {
  const { t, i18n } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();
  const currentYear = new Date().getFullYear();
  const effectiveMaxYear = maxYear ?? currentYear;

  const parsed = useMemo(() => parseDateValue(value), [value]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedField, setExpandedField] = useState<PickerField | null>(null);

  // Track selections within modal (only emit onChange when all 3 are set or on close)
  const [modalDay, setModalDay] = useState<number | undefined>(undefined);
  const [modalMonth, setModalMonth] = useState<number | undefined>(undefined);
  const [modalYear, setModalYear] = useState<number | undefined>(undefined);

  // Ref to track if we should auto-close
  const autoCloseRef = useRef(false);

  // Month names in the app's current language
  const monthNames = useMemo(() => getMonthNames(i18n.language), [i18n.language]);

  // Generate day options based on selected month/year
  const dayOptions = useMemo(() => {
    const maxDays = modalMonth && modalYear
      ? getDaysInMonth(modalMonth, modalYear)
      : 31;
    return Array.from({ length: maxDays }, (_, i) => i + 1);
  }, [modalMonth, modalYear]);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = effectiveMaxYear; y >= minYear; y--) {
      years.push(y);
    }
    return years;
  }, [minYear, effectiveMaxYear]);

  // Format the display text for the main button
  const displayText = useMemo(() => {
    if (!parsed.day || !parsed.month || !parsed.year) {
      return null; // Will show placeholder
    }
    const monthName = monthNames[parsed.month - 1];
    return `${parsed.day} ${monthName} ${parsed.year}`;
  }, [parsed, monthNames]);

  // Open the modal
  const handleOpenModal = useCallback(() => {
    void triggerFeedback('tap');
    // Sync modal state from current value
    setModalDay(parsed.day);
    setModalMonth(parsed.month);
    setModalYear(parsed.year);
    setExpandedField(null);
    setIsModalOpen(true);
  }, [triggerFeedback, parsed]);

  // Close modal
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setExpandedField(null);
  }, []);

  // Toggle a field's expanded state
  const handleToggleField = useCallback((field: PickerField) => {
    void triggerFeedback('tap');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedField(prev => prev === field ? null : field);
  }, [triggerFeedback]);

  // Handle selection of a value within a field
  const handleSelect = useCallback((field: PickerField, selectedValue: number) => {
    void triggerFeedback('tap');

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    let newDay = modalDay;
    let newMonth = modalMonth;
    let newYear = modalYear;

    if (field === 'day') {
      newDay = selectedValue;
      setModalDay(selectedValue);
    } else if (field === 'month') {
      newMonth = selectedValue;
      setModalMonth(selectedValue);
    } else {
      newYear = selectedValue;
      setModalYear(selectedValue);
    }

    // Collapse the current field
    setExpandedField(null);

    // Clamp day if needed (e.g. day 31 but month only has 30)
    if (newDay && newMonth && newYear) {
      const maxDays = getDaysInMonth(newMonth, newYear);
      if (newDay > maxDays) {
        newDay = maxDays;
        setModalDay(maxDays);
      }
    }

    // If all three are now set, emit and auto-close
    if (newDay && newMonth && newYear) {
      onChange(formatDateValue(newDay, newMonth, newYear));
      autoCloseRef.current = true;
    }
  }, [modalDay, modalMonth, modalYear, onChange, triggerFeedback]);

  // Auto-close modal after all fields are set (with small delay for visual feedback)
  useEffect(() => {
    if (autoCloseRef.current) {
      autoCloseRef.current = false;
      const timer = setTimeout(() => {
        setIsModalOpen(false);
        setExpandedField(null);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [modalDay, modalMonth, modalYear]);

  // Clear handler
  const handleClear = useCallback(() => {
    void triggerFeedback('tap');
    onChange(undefined);
  }, [onChange, triggerFeedback]);

  // Get display text for a field in the modal
  const getFieldDisplay = (field: PickerField): string | null => {
    switch (field) {
      case 'day': return modalDay ? String(modalDay) : null;
      case 'month': return modalMonth ? monthNames[modalMonth - 1] : null;
      case 'year': return modalYear ? String(modalYear) : null;
    }
  };

  // Get label for a field
  const getFieldLabel = (field: PickerField): string => {
    switch (field) {
      case 'day': return t('contacts.datePicker.selectDay');
      case 'month': return t('contacts.datePicker.selectMonth');
      case 'year': return t('contacts.datePicker.selectYear');
    }
  };

  // Get options for a field
  const getFieldOptions = (field: PickerField): { value: number; label: string }[] => {
    switch (field) {
      case 'day':
        return dayOptions.map(d => ({ value: d, label: String(d) }));
      case 'month':
        return monthNames.map((name, i) => ({ value: i + 1, label: name }));
      case 'year':
        return yearOptions.map(y => ({ value: y, label: String(y) }));
    }
  };

  // Get selected value for a field
  const getFieldSelected = (field: PickerField): number | undefined => {
    switch (field) {
      case 'day': return modalDay;
      case 'month': return modalMonth;
      case 'year': return modalYear;
    }
  };

  const fields: PickerField[] = ['day', 'month', 'year'];

  return (
    <View
      style={styles.container}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="none"
    >
      {/* Main touchable field — shows full date or placeholder */}
      <TouchableOpacity
        style={[
          styles.dateButton,
          {
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          },
        ]}
        onPress={handleOpenModal}
        accessibilityRole="button"
        accessibilityLabel={displayText ?? t('contacts.datePicker.chooseDate')}
        accessibilityHint={t('contacts.datePicker.chooseDate')}
      >
        <Text
          style={[
            styles.dateButtonText,
            { color: displayText ? themeColors.textPrimary : themeColors.textTertiary },
          ]}
        >
          {displayText ?? t('contacts.datePicker.chooseDate')}
        </Text>
        <Text style={[styles.dateButtonChevron, { color: themeColors.textTertiary }]}>▼</Text>
      </TouchableOpacity>

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

      {/* Bottom sheet modal with Day/Month/Year sections */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleCloseModal}
        >
          <SafeAreaView style={styles.sheetSafeArea}>
            <TouchableOpacity activeOpacity={1} style={[styles.sheetContainer, { backgroundColor: themeColors.background }]}>
              {/* Header */}
              <View style={[styles.sheetHeader, { borderBottomColor: themeColors.divider }]}>
                <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>
                  {t('contacts.datePicker.chooseDate')}
                </Text>
                <TouchableOpacity
                  onPress={handleCloseModal}
                  style={styles.sheetCloseButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}
                >
                  <Text style={[styles.sheetCloseText, { color: themeColors.primary }]}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Scrollable content: Day, Month, Year sections stacked */}
              <ScrollView
                style={styles.sheetBody}
                contentContainerStyle={styles.sheetBodyContent}
                showsVerticalScrollIndicator={true}
              >
                {fields.map((field) => {
                  const isExpanded = expandedField === field;
                  const fieldDisplay = getFieldDisplay(field);
                  const fieldLabel = getFieldLabel(field);

                  return (
                    <View key={field}>
                      {/* Field button — tap to expand/collapse */}
                      <TouchableOpacity
                        style={[
                          styles.fieldRow,
                          {
                            backgroundColor: isExpanded
                              ? themeColors.primary + '10'
                              : themeColors.surface,
                            borderColor: themeColors.border,
                          },
                        ]}
                        onPress={() => handleToggleField(field)}
                        accessibilityRole="button"
                        accessibilityLabel={`${fieldLabel}: ${fieldDisplay ?? t('contacts.datePicker.' + field)}`}
                        accessibilityState={{ expanded: isExpanded }}
                      >
                        <View style={styles.fieldRowContent}>
                          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
                            {t('contacts.datePicker.' + field)}
                          </Text>
                          <Text
                            style={[
                              styles.fieldValue,
                              {
                                color: fieldDisplay
                                  ? themeColors.textPrimary
                                  : themeColors.textTertiary,
                              },
                            ]}
                          >
                            {fieldDisplay ?? '—'}
                          </Text>
                        </View>
                        <Text style={[styles.fieldChevron, { color: themeColors.textTertiary }]}>
                          {isExpanded ? '▲' : '▼'}
                        </Text>
                      </TouchableOpacity>

                      {/* Expanded option list */}
                      {isExpanded && (
                        <ScrollView
                          style={[styles.optionList, { borderColor: themeColors.border }]}
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={true}
                        >
                          {getFieldOptions(field).map((option) => {
                            const isSelected = option.value === getFieldSelected(field);
                            return (
                              <TouchableOpacity
                                key={option.value}
                                style={[
                                  styles.optionItem,
                                  {
                                    borderBottomColor: themeColors.divider,
                                    backgroundColor: isSelected
                                      ? themeColors.primary + '15'
                                      : 'transparent',
                                  },
                                ]}
                                onPress={() => handleSelect(field, option.value)}
                                accessibilityRole="button"
                                accessibilityLabel={option.label}
                                accessibilityState={{ selected: isSelected }}
                              >
                                <Text
                                  style={[
                                    styles.optionText,
                                    {
                                      color: isSelected
                                        ? themeColors.primary
                                        : themeColors.textPrimary,
                                      fontWeight: isSelected ? '700' : '400',
                                    },
                                  ]}
                                >
                                  {option.label}
                                </Text>
                                {isSelected && (
                                  <Text style={[styles.checkmark, { color: themeColors.primary }]}>
                                    ✓
                                  </Text>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </TouchableOpacity>
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },

  // Main date button
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTargets.minimum,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateButtonText: {
    ...typography.body,
    flex: 1,
  },
  dateButtonChevron: {
    fontSize: 14,
    marginLeft: spacing.sm,
  },

  // Clear button
  clearButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  clearText: {
    ...typography.label,
  },

  // Modal overlay
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetSafeArea: {
    maxHeight: '75%',
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

  // Scrollable body
  sheetBody: {
    flexGrow: 0,
  },
  sheetBodyContent: {
    paddingBottom: spacing.xl,
  },

  // Field row (Day / Month / Year buttons)
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  fieldRowContent: {
    flex: 1,
    gap: 2,
  },
  fieldLabel: {
    ...typography.label,
    fontWeight: '700',
  },
  fieldValue: {
    ...typography.body,
  },
  fieldChevron: {
    fontSize: 14,
    marginLeft: spacing.sm,
  },

  // Expanded option list
  optionList: {
    maxHeight: 240,
    borderBottomWidth: 1,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.lg + spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    ...typography.body,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: '700',
  },
});
