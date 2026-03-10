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

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Modal,
  Keyboard,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAgendaContext, type CreateAgendaItemData } from '@/contexts/AgendaContext';
import type { ContactModel } from '@/models/Contact';

// ============================================================
// Category Address Memory
// ============================================================

interface CategoryAddress {
  locationName?: string;
  addressStreet?: string;
  addressPostalCode?: string;
  addressCity?: string;
  addressCountry?: string;
}

const CATEGORY_ADDRESS_KEY = '@agenda/lastAddress/';

async function loadCategoryAddress(categoryId: string): Promise<CategoryAddress | null> {
  try {
    const json = await AsyncStorage.getItem(`${CATEGORY_ADDRESS_KEY}${categoryId}`);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

async function saveCategoryAddress(categoryId: string, address: CategoryAddress): Promise<void> {
  try {
    // Only save if there's at least one non-empty field
    const hasContent = address.locationName || address.addressStreet || address.addressCity;
    if (!hasContent) return;
    await AsyncStorage.setItem(`${CATEGORY_ADDRESS_KEY}${categoryId}`, JSON.stringify(address));
  } catch {
    // Silently fail — address memory is a convenience, not critical
  }
}

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
// DateTimePickerModal — wraps DateTimePicker in a pageSheet modal
// ============================================================

interface DateTimePickerModalProps {
  visible: boolean;
  title: string;
  value: Date;
  mode: 'date' | 'time';
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
  onClose: () => void;
  minimumDate?: Date;
  is24Hour?: boolean;
  locale?: string;
}

function DateTimePickerModal({
  visible,
  title,
  value,
  mode,
  onChange,
  onClose,
  minimumDate,
  is24Hour,
  locale: pickerLocale,
}: DateTimePickerModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();

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
            style={dateTimePickerModalStyles.doneButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('modules.agenda.form.done')}
          >
            <Text style={[dateTimePickerModalStyles.doneButtonText, { color: themeColors.textPrimary }]}>
              {t('modules.agenda.form.done')}
            </Text>
          </HapticTouchable>
        </View>

        {/* Picker */}
        <View style={dateTimePickerModalStyles.pickerContainer}>
          <DateTimePicker
            value={value}
            mode={mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onChange}
            minimumDate={minimumDate}
            is24Hour={is24Hour}
            locale={pickerLocale}
          />
        </View>
      </View>
    </Modal>
  );
}

const dateTimePickerModalStyles = StyleSheet.create({
  doneButton: {
    minWidth: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  doneButtonText: {
    ...typography.body,
    fontWeight: '700',
  },
  pickerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
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

  // Contact selection state (only for categories with showContactsField)
  const { contacts: allContacts } = useAgendaContext();
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(
    initialData?.contactIds ?? [],
  );
  const [showContactPicker, setShowContactPicker] = useState(false);

  // Address state (v18)
  const [locationName, setLocationName] = useState(initialData?.locationName ?? '');
  const [addressStreet, setAddressStreet] = useState(initialData?.addressStreet ?? '');
  const [addressPostalCode, setAddressPostalCode] = useState(initialData?.addressPostalCode ?? '');
  const [addressCity, setAddressCity] = useState(initialData?.addressCity ?? '');
  const [addressCountry, setAddressCountry] = useState(initialData?.addressCountry ?? '');
  const [addressAutoFilled, setAddressAutoFilled] = useState(false);

  // Auto-fill address from first selected contact (only if address is currently empty)
  useEffect(() => {
    if (selectedContactIds.length === 0 || addressAutoFilled) return;
    // Only auto-fill if all address fields are empty
    if (locationName || addressStreet || addressPostalCode || addressCity) return;

    const firstContact = allContacts.find(c => c.id === selectedContactIds[0]);
    if (!firstContact) return;

    const hasAddress = firstContact.addressStreet || firstContact.addressCity;
    if (!hasAddress) return;

    setAddressStreet(firstContact.addressStreet ?? '');
    setAddressPostalCode(firstContact.addressPostalCode ?? '');
    setAddressCity(firstContact.addressCity ?? '');
    setAddressCountry(firstContact.addressCountry ?? '');
    setAddressAutoFilled(true);
  }, [selectedContactIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load category-memory address (only for new items, not edits)
  useEffect(() => {
    if (isEditing) return;
    if (!categoryDef.showContactsField) return;
    // Skip if address already has data (e.g., from initialData)
    if (initialData?.addressStreet || initialData?.addressCity) return;

    loadCategoryAddress(category).then(cached => {
      if (!cached) return;
      // Only apply if fields are still empty (user hasn't typed yet)
      if (locationName || addressStreet || addressCity) return;
      setLocationName(cached.locationName ?? '');
      setAddressStreet(cached.addressStreet ?? '');
      setAddressPostalCode(cached.addressPostalCode ?? '');
      setAddressCity(cached.addressCity ?? '');
      setAddressCountry(cached.addressCountry ?? '');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isEditing = !!initialData;

  // Selected contact models (for display)
  const selectedContacts = useMemo(
    () => selectedContactIds
      .map(id => allContacts.find(c => c.id === id))
      .filter((c): c is ContactModel => c != null),
    [selectedContactIds, allContacts],
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
      if (date) setSelectedDate(date);
    },
    [],
  );

  const handleTimeChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      if (date) setSelectedTime(date);
    },
    [],
  );

  const handleEndDateChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      if (date) setEndDate(date);
    },
    [],
  );

  const handleMedTimeChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
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

  const handleToggleContact = useCallback((contactId: string) => {
    setSelectedContactIds(prev => {
      if (prev.includes(contactId)) {
        return prev.filter(id => id !== contactId);
      }
      return [...prev, contactId];
    });
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
      // Contacts (only for categories that support it)
      contactIds: categoryDef.showContactsField ? selectedContactIds : undefined,
      // Address (v18)
      locationName: locationName.trim() || undefined,
      addressStreet: addressStreet.trim() || undefined,
      addressPostalCode: addressPostalCode.trim() || undefined,
      addressCity: addressCity.trim() || undefined,
      addressCountry: addressCountry.trim() || undefined,
    };

    // Save category-memory for address (async, fire-and-forget)
    if (categoryDef.showContactsField) {
      saveCategoryAddress(category, {
        locationName: locationName.trim() || undefined,
        addressStreet: addressStreet.trim() || undefined,
        addressPostalCode: addressPostalCode.trim() || undefined,
        addressCity: addressCity.trim() || undefined,
        addressCountry: addressCountry.trim() || undefined,
      });
    }

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
    selectedContactIds,
    locationName,
    addressStreet,
    addressPostalCode,
    addressCity,
    addressCountry,
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
            blurOnSubmit={true}
            onSubmitEditing={() => Keyboard.dismiss()}
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
            onPress={() => { Keyboard.dismiss(); setShowDatePicker(true); }}
            accessibilityRole="button"
            accessibilityLabel={`${t('modules.agenda.form.dateLabel')}: ${formatDate(selectedDate, locale)}`}
          >
            <Text style={[styles.pickerValue, { color: themeColors.textPrimary }]}>
              {formatDate(selectedDate, locale)}
            </Text>
            <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
          </HapticTouchable>
        </View>

        {/* Date picker modal is rendered outside ScrollView */}

        {/* ====== Time (single) ====== */}
        {categoryDef.showTimeField && !categoryDef.showMultipleTimes && (
          <>
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
                {t('modules.agenda.form.timeLabel')}
              </Text>
              <HapticTouchable
                style={[styles.pickerRow, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
                onPress={() => { Keyboard.dismiss(); setShowTimePicker(true); }}
                accessibilityRole="button"
                accessibilityLabel={`${t('modules.agenda.form.timeLabel')}: ${formatTime(selectedTime)}`}
              >
                <Text style={[styles.pickerValue, { color: themeColors.textPrimary }]}>
                  {formatTime(selectedTime)}
                </Text>
                <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
              </HapticTouchable>
            </View>

            {/* Time picker modal is rendered outside ScrollView */}
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
                  onPress={() => { Keyboard.dismiss(); setEditingMedTimeIndex(index); }}
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

            {/* Medication time picker modal is rendered outside ScrollView */}

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
            onPress={() => { Keyboard.dismiss(); setShowRepeatPicker(true); }}
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
              onPress={() => { Keyboard.dismiss(); setShowEndDatePicker(true); }}
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

        {/* End date picker modal is rendered outside ScrollView */}

        {/* ====== Reminder ====== */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('modules.agenda.form.reminderLabel')}
          </Text>
          <HapticTouchable
            style={[styles.pickerRow, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
            onPress={() => { Keyboard.dismiss(); setShowReminderPicker(true); }}
            accessibilityRole="button"
            accessibilityLabel={`${t('modules.agenda.form.reminderLabel')}: ${t(REMINDER_OPTIONS.find(o => o.value === reminderOffset)?.labelKey ?? '')}`}
          >
            <Text style={[styles.pickerValue, { color: themeColors.textPrimary }]}>
              {t(REMINDER_OPTIONS.find(o => o.value === reminderOffset)?.labelKey ?? '')}
            </Text>
            <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
          </HapticTouchable>
        </View>

        {/* ====== Contacts (when category supports it) ====== */}
        {categoryDef.showContactsField && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('modules.agenda.form.contactsLabel')}
            </Text>

            {/* Selected contacts chips */}
            {selectedContacts.length > 0 && (
              <View style={styles.contactChipsRow}>
                {selectedContacts.map(contact => (
                  <HapticTouchable
                    key={contact.id}
                    style={[
                      styles.contactChip,
                      {
                        backgroundColor: accentColor.light,
                        borderColor: accentColor.primary,
                      },
                    ]}
                    onPress={() => handleToggleContact(contact.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('modules.agenda.form.removeContact', { name: contact.displayName })}
                  >
                    <Text style={[styles.contactChipText, { color: accentColor.primary }]}>
                      {contact.displayName}
                    </Text>
                    <Icon name="x" size={16} color={accentColor.primary} />
                  </HapticTouchable>
                ))}
              </View>
            )}

            {/* Add contact button */}
            <HapticTouchable
              style={[styles.addContactButton, { borderColor: accentColor.primary }]}
              onPress={() => { Keyboard.dismiss(); setShowContactPicker(true); }}
              accessibilityRole="button"
              accessibilityLabel={t('modules.agenda.form.addContact')}
            >
              <Icon name="user-plus" size={18} color={accentColor.primary} />
              <Text style={[styles.addTimeText, { color: accentColor.primary }]}>
                {t('modules.agenda.form.addContact')}
              </Text>
            </HapticTouchable>
          </View>
        )}

        {/* ====== Location / Address (v18) ====== */}
        {categoryDef.showContactsField && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>
              {t('modules.agenda.form.addressSectionTitle')}
            </Text>

            {/* Location name */}
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('modules.agenda.form.locationNameLabel')}
            </Text>
            <RNTextInput
              style={[
                styles.textInput,
                {
                  color: themeColors.textPrimary,
                  borderColor: themeColors.border,
                  backgroundColor: themeColors.surface,
                },
              ]}
              value={locationName}
              onChangeText={setLocationName}
              placeholder={t('modules.agenda.form.locationNamePlaceholder')}
              placeholderTextColor={themeColors.disabled}
              autoCapitalize="sentences"
              returnKeyType="next"
              blurOnSubmit={true}
              onSubmitEditing={() => Keyboard.dismiss()}
              accessibilityLabel={t('modules.agenda.form.locationNameLabel')}
            />

            {/* Street */}
            <View style={styles.addressFieldGap}>
              <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
                {t('modules.agenda.form.streetLabel')}
              </Text>
              <RNTextInput
                style={[
                  styles.textInput,
                  {
                    color: themeColors.textPrimary,
                    borderColor: themeColors.border,
                    backgroundColor: themeColors.surface,
                  },
                ]}
                value={addressStreet}
                onChangeText={setAddressStreet}
                placeholder={t('modules.agenda.form.streetPlaceholder')}
                placeholderTextColor={themeColors.disabled}
                autoCapitalize="words"
                returnKeyType="next"
                blurOnSubmit={true}
                onSubmitEditing={() => Keyboard.dismiss()}
                accessibilityLabel={t('modules.agenda.form.streetLabel')}
              />
            </View>

            {/* Postal code + City row */}
            <View style={styles.addressFieldGap}>
              <View style={styles.addressRow}>
                <View style={styles.postalCodeField}>
                  <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
                    {t('modules.agenda.form.postalCodeLabel')}
                  </Text>
                  <RNTextInput
                    style={[
                      styles.textInput,
                      {
                        color: themeColors.textPrimary,
                        borderColor: themeColors.border,
                        backgroundColor: themeColors.surface,
                      },
                    ]}
                    value={addressPostalCode}
                    onChangeText={setAddressPostalCode}
                    placeholder={t('modules.agenda.form.postalCodePlaceholder')}
                    placeholderTextColor={themeColors.disabled}
                    autoCapitalize="characters"
                    returnKeyType="next"
                    blurOnSubmit={true}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    accessibilityLabel={t('modules.agenda.form.postalCodeLabel')}
                  />
                </View>
                <View style={styles.cityField}>
                  <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
                    {t('modules.agenda.form.cityLabel')}
                  </Text>
                  <RNTextInput
                    style={[
                      styles.textInput,
                      {
                        color: themeColors.textPrimary,
                        borderColor: themeColors.border,
                        backgroundColor: themeColors.surface,
                      },
                    ]}
                    value={addressCity}
                    onChangeText={setAddressCity}
                    placeholder={t('modules.agenda.form.cityPlaceholder')}
                    placeholderTextColor={themeColors.disabled}
                    autoCapitalize="words"
                    returnKeyType="done"
                    blurOnSubmit={true}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    accessibilityLabel={t('modules.agenda.form.cityLabel')}
                  />
                </View>
              </View>
            </View>

            {/* Auto-fill indicator */}
            {addressAutoFilled && (
              <Text style={[styles.autoFillHint, { color: themeColors.textTertiary }]}>
                {t('modules.agenda.form.addressAutoFilled')}
              </Text>
            )}
          </View>
        )}

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

      {/* DateTime Picker Modals */}
      <DateTimePickerModal
        visible={showDatePicker}
        title={t('modules.agenda.form.dateLabel')}
        value={selectedDate}
        mode="date"
        onChange={handleDateChange}
        onClose={() => setShowDatePicker(false)}
        minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
        locale={locale}
      />

      <DateTimePickerModal
        visible={showTimePicker}
        title={t('modules.agenda.form.timeLabel')}
        value={selectedTime}
        mode="time"
        onChange={handleTimeChange}
        onClose={() => setShowTimePicker(false)}
        is24Hour={true}
        locale={locale}
      />

      <DateTimePickerModal
        visible={editingMedTimeIndex != null}
        title={`${t('modules.agenda.form.timeLabel')} ${(editingMedTimeIndex ?? 0) + 1}`}
        value={editingMedTimeIndex != null ? (medicationTimes[editingMedTimeIndex] ?? new Date()) : new Date()}
        mode="time"
        onChange={handleMedTimeChange}
        onClose={() => setEditingMedTimeIndex(null)}
        is24Hour={true}
        locale={locale}
      />

      <DateTimePickerModal
        visible={showEndDatePicker}
        title={t('modules.agenda.form.endDateLabel')}
        value={endDate ?? new Date(selectedDate.getTime() + 30 * 24 * 60 * 60 * 1000)}
        mode="date"
        onChange={handleEndDateChange}
        onClose={() => setShowEndDatePicker(false)}
        minimumDate={selectedDate}
        locale={locale}
      />

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

      {/* Contact Picker Modal */}
      <Modal
        visible={showContactPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowContactPicker(false)}
      >
        <View style={[formPickerStyles.container, { backgroundColor: themeColors.background }]}>
          {/* Header */}
          <View style={[formPickerStyles.header, { borderBottomColor: themeColors.border }]}>
            <Text style={[formPickerStyles.title, { color: themeColors.textPrimary }]}>
              {t('modules.agenda.form.selectContacts')}
            </Text>
            <HapticTouchable
              style={formPickerStyles.closeButton}
              onPress={() => setShowContactPicker(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Icon name="x" size={24} color={themeColors.textPrimary} />
            </HapticTouchable>
          </View>

          {/* Contact list */}
          <ScrollView>
            {allContacts.length === 0 ? (
              <View style={styles.emptyContactList}>
                <Text style={[styles.emptyContactText, { color: themeColors.textTertiary }]}>
                  {t('modules.agenda.form.noContacts')}
                </Text>
              </View>
            ) : (
              allContacts.map(contact => {
                const isSelected = selectedContactIds.includes(contact.id);
                return (
                  <HapticTouchable
                    key={contact.id}
                    style={[
                      formPickerStyles.option,
                      { borderBottomColor: themeColors.border },
                      isSelected && { backgroundColor: accentColor.light },
                    ]}
                    onPress={() => handleToggleContact(contact.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={contact.displayName}
                  >
                    <View style={styles.contactPickerRow}>
                      <Icon
                        name={isSelected ? 'check-square' : 'square'}
                        size={22}
                        color={isSelected ? accentColor.primary : themeColors.textTertiary}
                      />
                      <View style={styles.contactPickerInfo}>
                        <Text
                          style={[
                            formPickerStyles.optionLabel,
                            { color: themeColors.textPrimary },
                            isSelected && { fontWeight: '600', color: accentColor.primary },
                          ]}
                        >
                          {contact.displayName}
                        </Text>
                        {(contact.addressCity || contact.addressStreet) && (
                          <Text style={[styles.contactAddressHint, { color: themeColors.textTertiary }]}>
                            {[contact.addressStreet, contact.addressCity].filter(Boolean).join(', ')}
                          </Text>
                        )}
                      </View>
                    </View>
                  </HapticTouchable>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
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

  // Contact chips
  contactChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
  },
  contactChipText: {
    ...typography.body,
    fontWeight: '600',
  },
  addContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },

  // Contact picker modal
  contactPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  contactPickerInfo: {
    flex: 1,
  },
  contactAddressHint: {
    ...typography.label,
    marginTop: 2,
  },
  emptyContactList: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyContactText: {
    ...typography.body,
    textAlign: 'center',
  },

  // Address section
  sectionLabel: {
    ...typography.label,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  addressFieldGap: {
    marginTop: spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  postalCodeField: {
    flex: 1,
  },
  cityField: {
    flex: 2,
  },
  autoFillHint: {
    ...typography.label,
    fontStyle: 'italic',
    marginTop: spacing.xs,
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
