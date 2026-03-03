/**
 * SeniorDatePicker — Reusable date picker for seniors
 *
 * Single touchable field showing the full date as readable text
 * (e.g. "20 november 2026") or a placeholder ("Kies een datum").
 *
 * Tap opens a full-screen modal with 3 large buttons (Dag, Maand, Jaar).
 * Tapping a button opens a centered sub-popup with a scrollable list.
 * Sub-popup auto-closes after selecting a value.
 * User must explicitly press "Opslaan" to save the date.
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
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
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

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Estimated height per item in sub-popup (minHeight 60 + vertical padding)
const ITEM_HEIGHT_ESTIMATE = 68;

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
  const [activeSubPopup, setActiveSubPopup] = useState<PickerField | null>(null);

  // Track selections within modal (only emit onChange on save)
  const [modalDay, setModalDay] = useState<number | undefined>(undefined);
  const [modalMonth, setModalMonth] = useState<number | undefined>(undefined);
  const [modalYear, setModalYear] = useState<number | undefined>(undefined);

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

  // Check if save is possible (all 3 fields filled)
  const canSave = modalDay !== undefined && modalMonth !== undefined && modalYear !== undefined;

  // Open the main modal
  const handleOpenModal = useCallback(() => {
    void triggerFeedback('tap');
    setModalDay(parsed.day);
    setModalMonth(parsed.month);
    setModalYear(parsed.year);
    setActiveSubPopup(null);
    setIsModalOpen(true);
  }, [triggerFeedback, parsed]);

  // Close main modal (discard changes)
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setActiveSubPopup(null);
  }, []);

  // Save and close
  const handleSave = useCallback(() => {
    if (!canSave) return;
    void triggerFeedback('tap');

    let day = modalDay!;
    const month = modalMonth!;
    const year = modalYear!;

    // Clamp day if needed (e.g. selected day 31 but month only has 30)
    const maxDays = getDaysInMonth(month, year);
    if (day > maxDays) {
      day = maxDays;
    }

    onChange(formatDateValue(day, month, year));
    setIsModalOpen(false);
    setActiveSubPopup(null);
  }, [canSave, modalDay, modalMonth, modalYear, onChange, triggerFeedback]);

  // Open a sub-popup for a specific field
  const handleOpenSubPopup = useCallback((field: PickerField) => {
    void triggerFeedback('tap');
    setActiveSubPopup(field);
  }, [triggerFeedback]);

  // Close sub-popup without selection
  const handleCloseSubPopup = useCallback(() => {
    setActiveSubPopup(null);
  }, []);

  // Select a value in the sub-popup — auto-closes sub-popup
  const handleSubPopupSelect = useCallback((field: PickerField, selectedValue: number) => {
    void triggerFeedback('tap');

    if (field === 'day') {
      setModalDay(selectedValue);
    } else if (field === 'month') {
      setModalMonth(selectedValue);
    } else {
      setModalYear(selectedValue);
    }

    // Auto-close sub-popup after selection
    setActiveSubPopup(null);
  }, [triggerFeedback]);

  // Clear handler
  const handleClear = useCallback(() => {
    void triggerFeedback('tap');
    setModalDay(undefined);
    setModalMonth(undefined);
    setModalYear(undefined);
    onChange(undefined);
    setIsModalOpen(false);
    setActiveSubPopup(null);
  }, [onChange, triggerFeedback]);

  // Ref for sub-popup ScrollView to auto-scroll to selected item
  const subPopupScrollRef = useRef<ScrollView>(null);

  // Store the scroll target so onLayout can use it
  const pendingScrollRef = useRef<number | null>(null);

  // Compute scroll target when sub-popup field changes
  useEffect(() => {
    if (activeSubPopup === null) {
      pendingScrollRef.current = null;
      return;
    }

    // Read selected value directly from state
    let selectedValue: number | undefined;
    if (activeSubPopup === 'day') selectedValue = modalDay;
    else if (activeSubPopup === 'month') selectedValue = modalMonth;
    else selectedValue = modalYear;

    if (selectedValue === undefined) {
      pendingScrollRef.current = null;
      return;
    }

    // Build options inline to find the selected index
    let options: { value: number }[];
    if (activeSubPopup === 'day') {
      options = dayOptions.map(d => ({ value: d }));
    } else if (activeSubPopup === 'month') {
      options = monthNames.map((_, i) => ({ value: i + 1 }));
    } else {
      options = yearOptions.map(y => ({ value: y }));
    }

    const selectedIndex = options.findIndex(o => o.value === selectedValue);
    if (selectedIndex <= 0) {
      pendingScrollRef.current = null;
      return;
    }

    // Scroll so the selected item is roughly centered in the visible area
    const popupVisibleHeight = SCREEN_HEIGHT * 0.6 - 60; // subtract header
    const targetOffset = Math.max(
      0,
      selectedIndex * ITEM_HEIGHT_ESTIMATE - popupVisibleHeight / 2 + ITEM_HEIGHT_ESTIMATE / 2,
    );

    pendingScrollRef.current = targetOffset;

    // Also attempt immediate scroll (works when ScrollView is already mounted)
    subPopupScrollRef.current?.scrollTo({ y: targetOffset, animated: false });
  }, [activeSubPopup, modalDay, modalMonth, modalYear, dayOptions, monthNames, yearOptions]);

  // Called when ScrollView content size changes — all items are rendered and scrollable
  const handleContentSizeChange = useCallback((_w: number, contentHeight: number) => {
    if (pendingScrollRef.current !== null && contentHeight > 0) {
      // Clamp to max scrollable offset to avoid overshooting
      const popupVisibleHeight = SCREEN_HEIGHT * 0.6 - 60;
      const maxScroll = Math.max(0, contentHeight - popupVisibleHeight);
      const clampedOffset = Math.min(pendingScrollRef.current, maxScroll);
      subPopupScrollRef.current?.scrollTo({ y: clampedOffset, animated: false });
    }
  }, []);

  // Get the display value for a field button inside the modal
  const getFieldButtonDisplay = (field: PickerField): string => {
    switch (field) {
      case 'day': return modalDay !== undefined ? String(modalDay) : '—';
      case 'month': return modalMonth !== undefined ? monthNames[modalMonth - 1] : '—';
      case 'year': return modalYear !== undefined ? String(modalYear) : '—';
    }
  };

  // Get the field label (e.g. "Dag", "Maand", "Jaar")
  const getFieldLabel = (field: PickerField): string => {
    return t('contacts.datePicker.' + field);
  };

  // Get options for the sub-popup
  const getSubPopupOptions = (field: PickerField): { value: number; label: string }[] => {
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

  // Get sub-popup title
  const getSubPopupTitle = (field: PickerField): string => {
    switch (field) {
      case 'day': return t('contacts.datePicker.selectDay');
      case 'month': return t('contacts.datePicker.selectMonth');
      case 'year': return t('contacts.datePicker.selectYear');
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

      {/* ========= MODAL 1: Full-screen date picker ========= */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: themeColors.background }]}>
          {/* Header with title and cancel */}
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.divider }]}>
            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
              {t('contacts.datePicker.chooseDate')}
            </Text>
            <TouchableOpacity
              onPress={handleCloseModal}
              style={styles.modalCancelButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={[styles.modalCancelText, { color: themeColors.primary }]}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 3 large field buttons centered on screen */}
          <View style={styles.fieldButtonsContainer}>
            {fields.map((field) => {
              const fieldDisplay = getFieldButtonDisplay(field);
              const fieldLabel = getFieldLabel(field);
              const hasValue = fieldDisplay !== '—';

              return (
                <TouchableOpacity
                  key={field}
                  style={[
                    styles.fieldButton,
                    {
                      backgroundColor: themeColors.surface,
                      borderColor: hasValue ? themeColors.primary : themeColors.border,
                      borderWidth: hasValue ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleOpenSubPopup(field)}
                  accessibilityRole="button"
                  accessibilityLabel={`${fieldLabel}: ${fieldDisplay}`}
                >
                  <Text style={[styles.fieldButtonLabel, { color: themeColors.textSecondary }]}>
                    {fieldLabel}
                  </Text>
                  <Text
                    style={[
                      styles.fieldButtonValue,
                      {
                        color: hasValue ? themeColors.textPrimary : themeColors.textTertiary,
                      },
                    ]}
                  >
                    {fieldDisplay}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bottom area: Save + Clear */}
          <View style={styles.bottomArea}>
            {/* Save button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: canSave ? themeColors.primary : themeColors.border,
                },
              ]}
              onPress={handleSave}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel={t('contacts.save')}
              accessibilityState={{ disabled: !canSave }}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  {
                    color: canSave ? '#FFFFFF' : themeColors.textTertiary,
                  },
                ]}
              >
                {t('contacts.save')}
              </Text>
            </TouchableOpacity>

            {/* Clear link */}
            {allowClear && (modalDay !== undefined || modalMonth !== undefined || modalYear !== undefined || value) && (
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
          </View>
        </SafeAreaView>

        {/* ========= MODAL 2: Centered sub-popup for selections ========= */}
        {activeSubPopup !== null && (
          <Modal
            visible={true}
            transparent
            animationType="fade"
            onRequestClose={handleCloseSubPopup}
          >
            <TouchableOpacity
              style={styles.subPopupOverlay}
              activeOpacity={1}
              onPress={handleCloseSubPopup}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={[styles.subPopupCard, { backgroundColor: themeColors.background }]}
              >
                {/* Sub-popup title */}
                <View style={[styles.subPopupHeader, { borderBottomColor: themeColors.divider }]}>
                  <Text style={[styles.subPopupTitle, { color: themeColors.textPrimary }]}>
                    {getSubPopupTitle(activeSubPopup)}
                  </Text>
                </View>

                {/* Scrollable option list */}
                <ScrollView
                  ref={subPopupScrollRef}
                  style={styles.subPopupList}
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={styles.subPopupListContent}
                  onContentSizeChange={handleContentSizeChange}
                >
                  {getSubPopupOptions(activeSubPopup).map((option) => {
                    const isSelected = option.value === getFieldSelected(activeSubPopup);
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.subPopupItem,
                          {
                            borderBottomColor: themeColors.divider,
                            backgroundColor: isSelected
                              ? themeColors.primary + '15'
                              : 'transparent',
                          },
                        ]}
                        onPress={() => handleSubPopupSelect(activeSubPopup, option.value)}
                        accessibilityRole="button"
                        accessibilityLabel={option.label}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text
                          style={[
                            styles.subPopupItemText,
                            {
                              color: isSelected ? themeColors.primary : themeColors.textPrimary,
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
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },

  // Main date button (on contact screen)
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

  // === MODAL 1: Full-screen date picker ===
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    ...typography.h3,
  },
  modalCancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  modalCancelText: {
    ...typography.button,
  },

  // 3 large field buttons
  fieldButtonsContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  fieldButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  fieldButtonLabel: {
    ...typography.label,
    fontWeight: '700',
    marginBottom: 4,
  },
  fieldButtonValue: {
    ...typography.h2,
    fontWeight: '600',
  },

  // Bottom area: Save + Clear
  bottomArea: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  saveButton: {
    width: '100%',
    minHeight: touchTargets.comfortable,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.button,
    fontWeight: '700',
    fontSize: 20,
  },
  clearButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  clearText: {
    ...typography.body,
  },

  // === MODAL 2: Centered sub-popup ===
  subPopupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  subPopupCard: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.6,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  subPopupHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  subPopupTitle: {
    ...typography.h3,
  },
  subPopupList: {
    flexGrow: 0,
  },
  subPopupListContent: {
    paddingBottom: spacing.md,
  },
  subPopupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  subPopupItemText: {
    ...typography.body,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: '700',
  },
});
