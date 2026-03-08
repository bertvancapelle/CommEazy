/**
 * AgendaItemFormScreen — Universal form for creating/editing agenda items
 *
 * The selected category determines:
 * - Which fields are visible
 * - Default values for repeat and reminder
 * - Whether multiple times are supported (medication)
 *
 * Fields:
 * - Title (always) — text input
 * - Date (always) — date picker
 * - Time (category-dependent) — time picker
 * - Multiple times (medication only) — add/remove times
 * - Repeat (always) — picker modal
 * - End date (when repeat selected) — date picker
 * - Reminder (always) — picker modal
 *
 * Senior-inclusive: 60pt+ touch targets, 18pt+ text, labels above fields
 *
 * @see constants/agendaCategories.ts for field visibility per category
 * @see contexts/AgendaContext.tsx for createItem/updateItem
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, HapticTouchable } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import {
  getCategoryById,
  REPEAT_OPTIONS,
  REMINDER_OPTIONS,
  type AgendaCategory,
  type RepeatType,
  type ReminderOffset,
} from '@/constants/agendaCategories';
import type { CreateAgendaItemData } from '@/contexts/AgendaContext';

// ============================================================
// Props
// ============================================================

interface AgendaItemFormScreenProps {
  category: AgendaCategory;
  /** Pre-filled data for editing (optional) */
  initialData?: Partial<CreateAgendaItemData>;
  onSave: (data: CreateAgendaItemData) => void;
  onBack: () => void;
}

// ============================================================
// Helpers
// ============================================================

/** Format date for display */
function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Format time for display */
function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// ============================================================
// PickerModal — Reusable option picker
// ============================================================

interface FormPickerModalProps {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

function FormPickerModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: FormPickerModalProps) {
  const themeColors = useColors();
  const { accentColor } = useAccentColor();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[formPickerStyles.container, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[formPickerStyles.header, { borderBottomColor: themeColors.border }]}>
          <Text style={[formPickerStyles.title, { color: themeColors.textPrimary }]}>
            {title}
          </Text>
          <HapticTouchable
            style={formPickerStyles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Icon name="x" size={24} color={themeColors.textPrimary} />
          </HapticTouchable>
        </View>

        {/* Options */}
        <ScrollView>
          {options.map((option) => {
            const isSelected = option.value === selectedValue;
            return (
              <HapticTouchable
                key={option.value}
                style={[
                  formPickerStyles.option,
                  { borderBottomColor: themeColors.border },
                  isSelected && { backgroundColor: accentColor.light },
                ]}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={option.label}
              >
                <Text
                  style={[
                    formPickerStyles.optionLabel,
                    { color: themeColors.textPrimary },
                    isSelected && {
                      fontWeight: '600',
                      color: accentColor.primary,
                    },
                  ]}
                >
                  {option.label}
                </Text>
                {isSelected && (
                  <Icon name="check" size={20} color={accentColor.primary} />
                )}
              </HapticTouchable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const formPickerStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    ...typography.h3,
    flex: 1,
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  optionLabel: {
    ...typography.body,
    flex: 1,
  },
});

// ============================================================
// AgendaItemFormScreen
// ============================================================

export function AgendaItemFormScreen({
  category,
  initialData,
  onSave,
  onBack,
}: AgendaItemFormScreenProps) {
  const { t, i18n } = useTranslation();
  const themeColors = useColors();
  const insets = useSafeAreaInsets();
  const moduleColor = useModuleColor('agenda');
  const { accentColor } = useAccentColor();

  const categoryDef = useMemo(
    () => getCategoryById(category)!,
    [category],
  );

  // Form state
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialData?.date ? new Date(initialData.date) : new Date(),
  );
  const [selectedTime, setSelectedTime] = useState<Date>(() => {
    if (initialData?.time) {
      const [h, m] = initialData.time.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    }
    // Default: next full hour
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const [medicationTimes, setMedicationTimes] = useState<Date[]>(() => {
    if (initialData?.times) {
      return initialData.times.map((t) => {
        const [h, m] = t.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
      });
    }
    // Default medication time: 09:00
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return [d];
  });
  const [repeatType, setRepeatType] = useState<RepeatType | null>(
    initialData?.repeatType ?? categoryDef.defaultRepeat,
  );
  const [endDate, setEndDate] = useState<Date | null>(
    initialData?.endDate ? new Date(initialData.endDate) : null,
  );
  const [reminderOffset, setReminderOffset] = useState<ReminderOffset>(
    initialData?.reminderOffset ?? categoryDef.defaultReminder,
  );

  // Picker visibility state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [editingMedTimeIndex, setEditingMedTimeIndex] = useState<number | null>(null);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  const titleInputRef = useRef<RNTextInput>(null);

  // Locale for date formatting
  const locale = i18n.language === 'nl' ? 'nl-NL'
    : i18n.language === 'de' ? 'de-DE'
    : i18n.language === 'fr' ? 'fr-FR'
    : i18n.language === 'es' ? 'es-ES'
    : i18n.language === 'it' ? 'it-IT'
    : i18n.language === 'no' ? 'nb-NO'
    : i18n.language === 'sv' ? 'sv-SE'
    : i18n.language === 'da' ? 'da-DK'
    : i18n.language === 'pt-BR' ? 'pt-BR'
    : i18n.language === 'pt' ? 'pt-PT'
    : i18n.language === 'pl' ? 'pl-PL'
    : 'en-US';

  // ============================================================
  // Handlers
  // ============================================================

  const handleDateChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === 'android') setShowDatePicker(false);
      if (date) setSelectedDate(date);
    },
    [],
  );

  const handleTimeChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === 'android') setShowTimePicker(false);
      if (date) setSelectedTime(date);
    },
    [],
  );

  const handleEndDateChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === 'android') setShowEndDatePicker(false);
      if (date) setEndDate(date);
    },
    [],
  );

  const handleMedTimeChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === 'android') setEditingMedTimeIndex(null);
      if (date && editingMedTimeIndex != null) {
        setMedicationTimes((prev) => {
          const next = [...prev];
          next[editingMedTimeIndex] = date;
          return next;
        });
      }
    },
    [editingMedTimeIndex],
  );

  const handleAddMedicationTime = useCallback(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    setMedicationTimes((prev) => [...prev, d]);
  }, []);

  const handleRemoveMedicationTime = useCallback((index: number) => {
    setMedicationTimes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(() => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert(
        t('status.warning'),
        t('modules.agenda.form.titleRequired'),
      );
      titleInputRef.current?.focus();
      return;
    }

    // Build time data
    let timeStr: string | undefined;
    let timesArr: string[] | undefined;

    if (categoryDef.showMultipleTimes) {
      // Medication: multiple times
      timesArr = medicationTimes
        .map(formatTime)
        .sort();
      timeStr = timesArr[0]; // Primary time for sorting
    } else if (categoryDef.showTimeField) {
      timeStr = formatTime(selectedTime);
    }

    const data: CreateAgendaItemData = {
      category,
      title: trimmedTitle,
      date: selectedDate.getTime(),
      time: timeStr,
      times: timesArr,
      repeatType: repeatType ?? undefined,
      endDate: endDate?.getTime(),
      reminderOffset,
    };

    onSave(data);
  }, [
    title,
    category,
    categoryDef,
    selectedDate,
    selectedTime,
    medicationTimes,
    repeatType,
    endDate,
    reminderOffset,
    onSave,
    t,
  ]);

  // Build picker options
  const repeatOptions = useMemo(
    () =>
      REPEAT_OPTIONS.map((opt) => ({
        value: opt.value ?? '__none__',
        label: t(opt.labelKey),
      })),
    [t],
  );

  const reminderOptions = useMemo(
    () =>
      REMINDER_OPTIONS.map((opt) => ({
        value: opt.value,
        label: t(opt.labelKey),
      })),
    [t],
  );

  // ============================================================
  // Render
  // ============================================================

  const isEditing = !!initialData;
  const headerTitle = isEditing
    ? t('modules.agenda.form.editTitle')
    : `${categoryDef.icon} ${t('modules.agenda.form.newTitle')}`;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: moduleColor,
            paddingTop: insets.top + spacing.sm,
          },
        ]}
      >
        <HapticTouchable
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.goBack')}
        >
          <Icon name="chevron-left" size={24} color={colors.textOnPrimary} />
        </HapticTouchable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ====== Title ====== */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('modules.agenda.form.titleLabel')}
          </Text>
          <RNTextInput
            ref={titleInputRef}
            style={[
              styles.textInput,
              {
                color: themeColors.textPrimary,
                borderColor: themeColors.border,
                backgroundColor: themeColors.surface,
              },
            ]}
            value={title}
            onChangeText={setTitle}
            placeholder={t('modules.agenda.form.titlePlaceholder')}
            placeholderTextColor={themeColors.disabled}
            autoCapitalize="sentences"
            returnKeyType="done"
            accessibilityLabel={t('modules.agenda.form.titleLabel')}
          />
        </View>

        {/* ====== Date ====== */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('modules.agenda.form.dateLabel')}
          </Text>
          <HapticTouchable
            style={[styles.pickerRow, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t('modules.agenda.form.dateLabel')}: ${formatDate(selectedDate, locale)}`}
          >
            <Text style={[styles.pickerValue, { color: themeColors.textPrimary }]}>
              {formatDate(selectedDate, locale)}
            </Text>
            <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
          </HapticTouchable>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date()}
            locale={locale}
          />
        )}

        {/* ====== Time (single) ====== */}
        {categoryDef.showTimeField && !categoryDef.showMultipleTimes && (
          <>
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
                {t('modules.agenda.form.timeLabel')}
              </Text>
              <HapticTouchable
                style={[styles.pickerRow, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
                onPress={() => setShowTimePicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`${t('modules.agenda.form.timeLabel')}: ${formatTime(selectedTime)}`}
              >
                <Text style={[styles.pickerValue, { color: themeColors.textPrimary }]}>
                  {formatTime(selectedTime)}
                </Text>
                <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
              </HapticTouchable>
            </View>

            {showTimePicker && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
                is24Hour={true}
                locale={locale}
              />
            )}
          </>
        )}

        {/* ====== Multiple Times (medication) ====== */}
        {categoryDef.showMultipleTimes && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('modules.agenda.form.timesLabel')}
            </Text>
            {medicationTimes.map((medTime, index) => (
              <View key={index} style={styles.medTimeRow}>
                <HapticTouchable
                  style={[
                    styles.pickerRow,
                    { borderColor: themeColors.border, backgroundColor: themeColors.surface, flex: 1 },
                  ]}
                  onPress={() => setEditingMedTimeIndex(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('modules.agenda.form.timeLabel')} ${index + 1}: ${formatTime(medTime)}`}
                >
                  <Text style={[styles.pickerValue, { color: themeColors.textPrimary }]}>
                    {formatTime(medTime)}
                  </Text>
                  <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
                </HapticTouchable>
                {medicationTimes.length > 1 && (
                  <HapticTouchable
                    style={[styles.removeTimeButton, { borderColor: themeColors.error || colors.error }]}
                    onPress={() => handleRemoveMedicationTime(index)}
                    accessibilityRole="button"
                    accessibilityLabel={t('modules.agenda.form.removeTime')}
                  >
                    <Icon name="x" size={18} color={themeColors.error || colors.error} />
                  </HapticTouchable>
                )}
              </View>
            ))}

            {editingMedTimeIndex != null && (
              <DateTimePicker
                value={medicationTimes[editingMedTimeIndex] ?? new Date()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleMedTimeChange}
                is24Hour={true}
                locale={locale}
              />
            )}

            <HapticTouchable
              style={[styles.addTimeButton, { borderColor: accentColor.primary }]}
              onPress={handleAddMedicationTime}
              accessibilityRole="button"
              accessibilityLabel={t('modules.agenda.form.addTime')}
            >
              <Icon name="plus" size={18} color={accentColor.primary} />
              <Text style={[styles.addTimeText, { color: accentColor.primary }]}>
                {t('modules.agenda.form.addTime')}
              </Text>
            </HapticTouchable>
          </View>
        )}

        {/* ====== Repeat ====== */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('modules.agenda.form.repeatLabel')}
          </Text>
          <HapticTouchable
            style={[styles.pickerRow, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
            onPress={() => setShowRepeatPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t('modules.agenda.form.repeatLabel')}: ${t(REPEAT_OPTIONS.find(o => o.value === repeatType)?.labelKey ?? 'modules.agenda.repeat.none')}`}
          >
            <Text style={[styles.pickerValue, { color: themeColors.textPrimary }]}>
              {t(REPEAT_OPTIONS.find(o => o.value === repeatType)?.labelKey ?? 'modules.agenda.repeat.none')}
            </Text>
            <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
          </HapticTouchable>
        </View>

        {/* ====== End Date (when repeating) ====== */}
        {repeatType != null && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('modules.agenda.form.endDateLabel')}
            </Text>
            <HapticTouchable
              style={[styles.pickerRow, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
              onPress={() => setShowEndDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`${t('modules.agenda.form.endDateLabel')}: ${endDate ? formatDate(endDate, locale) : t('modules.agenda.form.noEndDate')}`}
            >
              <Text
                style={[
                  styles.pickerValue,
                  { color: endDate ? themeColors.textPrimary : themeColors.textTertiary },
                ]}
              >
                {endDate ? formatDate(endDate, locale) : t('modules.agenda.form.noEndDate')}
              </Text>
              <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
            </HapticTouchable>
            {endDate != null && (
              <HapticTouchable
                style={styles.clearEndDate}
                onPress={() => setEndDate(null)}
                accessibilityRole="button"
                accessibilityLabel={t('modules.agenda.form.clearEndDate')}
              >
                <Text style={[styles.clearEndDateText, { color: accentColor.primary }]}>
                  {t('modules.agenda.form.clearEndDate')}
                </Text>
              </HapticTouchable>
            )}
          </View>
        )}

        {showEndDatePicker && (
          <DateTimePicker
            value={endDate ?? new Date(selectedDate.getTime() + 30 * 24 * 60 * 60 * 1000)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={handleEndDateChange}
            minimumDate={selectedDate}
            locale={locale}
          />
        )}

        {/* ====== Reminder ====== */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('modules.agenda.form.reminderLabel')}
          </Text>
          <HapticTouchable
            style={[styles.pickerRow, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
            onPress={() => setShowReminderPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t('modules.agenda.form.reminderLabel')}: ${t(REMINDER_OPTIONS.find(o => o.value === reminderOffset)?.labelKey ?? '')}`}
          >
            <Text style={[styles.pickerValue, { color: themeColors.textPrimary }]}>
              {t(REMINDER_OPTIONS.find(o => o.value === reminderOffset)?.labelKey ?? '')}
            </Text>
            <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
          </HapticTouchable>
        </View>

        {/* ====== Save Button ====== */}
        <HapticTouchable
          style={[styles.saveButton, { backgroundColor: accentColor.primary }]}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel={t('common.save')}
        >
          <Text style={[styles.saveButtonText, { color: colors.textOnPrimary }]}>
            {t('common.save')}
          </Text>
        </HapticTouchable>
      </ScrollView>

      {/* Picker Modals */}
      <FormPickerModal
        visible={showRepeatPicker}
        title={t('modules.agenda.form.repeatLabel')}
        options={repeatOptions}
        selectedValue={repeatType ?? '__none__'}
        onSelect={(value) => {
          setRepeatType(value === '__none__' ? null : (value as RepeatType));
        }}
        onClose={() => setShowRepeatPicker(false)}
      />

      <FormPickerModal
        visible={showReminderPicker}
        title={t('modules.agenda.form.reminderLabel')}
        options={reminderOptions}
        selectedValue={reminderOffset}
        onSelect={(value) => setReminderOffset(value as ReminderOffset)}
        onClose={() => setShowReminderPicker(false)}
      />
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  backButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textOnPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  headerSpacer: {
    width: touchTargets.minimum,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },

  // Field container
  fieldContainer: {
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },

  // Text input
  textInput: {
    ...typography.input,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
  },

  // Picker row
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    minHeight: touchTargets.minimum,
  },
  pickerValue: {
    ...typography.body,
    flex: 1,
  },

  // Medication times
  medTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  removeTimeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  addTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  addTimeText: {
    ...typography.body,
    fontWeight: '600',
  },

  // End date
  clearEndDate: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  clearEndDateText: {
    ...typography.body,
    fontWeight: '600',
  },

  // Save button
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.comfortable,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  saveButtonText: {
    ...typography.button,
    fontWeight: '700',
  },
});
