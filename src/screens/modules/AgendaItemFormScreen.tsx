/**
 * AgendaItemFormScreen — Universal form for creating/editing agenda items
 *
 * Simplified 2-step flow:
 * 1. Type picker (Afspraak/Herinnering/Medicatie) — determines visible fields
 * 2. Category picker (emoji + name) — purely visual, stored as snapshot
 *
 * The selected form type determines:
 * - Which fields are visible (time, contacts, address, medication)
 * - Default values for repeat and reminder
 *
 * Fields:
 * - Type (always) — 3-option picker
 * - Category (always) — emoji + name picker with standard + custom categories
 * - Title (always) — text input
 * - Date (always) — date picker
 * - Time (type-dependent) — time picker or multiple times (medication)
 * - Repeat (always) — picker modal
 * - End date (when repeat selected) — date picker
 * - Reminder (always) — picker modal
 * - Contacts (appointment only) — contact picker
 * - Address (appointment only) — address fields with category-memory
 *
 * Senior-inclusive: 60pt+ touch targets, 18pt+ text, labels above fields
 *
 * @see constants/agendaCategories.ts for form type & category definitions
 * @see contexts/AgendaContext.tsx for createItem/updateItem
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  Image,
  StyleSheet,
  Platform,
  Alert,
  Modal,
  Keyboard,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, HapticTouchable, ModuleHeader, SearchBar, ScrollViewWithIndicator, ErrorView } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import {
  FORM_TYPES,
  getFormType,
  STANDARD_CATEGORIES,
  CURATED_EMOJI_GROUPS,
  CUSTOM_CATEGORIES_STORAGE_KEY,
  REPEAT_OPTIONS,
  REMINDER_OPTIONS,
  getFormTypeForCategory,
  type AgendaCategory,
  type AgendaFormType,
  type AgendaCategoryDef,
  type CustomCategory,
  type FormTypeDefinition,
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
// Custom Category Persistence
// ============================================================

async function loadCustomCategories(): Promise<CustomCategory[]> {
  try {
    const json = await AsyncStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

async function saveCustomCategories(categories: CustomCategory[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch {
    // Silently fail
  }
}

// ============================================================
// Props
// ============================================================

interface AgendaItemFormScreenProps {
  /** Pre-filled data for editing (optional) */
  initialData?: Partial<CreateAgendaItemData> & {
    /** Existing category id for editing */
    category?: AgendaCategory;
    /** Existing form type for editing */
    formType?: AgendaFormType;
    /** Existing category icon for editing */
    categoryIcon?: string;
    /** Existing category name for editing */
    categoryName?: string;
  };
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

/** Generate a simple unique ID */
function generateId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// PickerModal — Reusable option picker
// ============================================================

interface FormPickerModalProps {
  visible: boolean;
  title: string;
  options: { value: string; label: string; icon?: string }[];
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
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const moduleColor = useModuleColor('agenda');

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
            style={[dateTimePickerModalStyles.doneButton, { backgroundColor: moduleColor }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={dateTimePickerModalStyles.doneButtonText}>
              {t('common.close')}
            </Text>
          </HapticTouchable>
        </View>

        {/* Options */}
        <ScrollViewWithIndicator>
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
                {option.icon && (
                  <Text style={formPickerStyles.optionIcon}>{option.icon}</Text>
                )}
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
        </ScrollViewWithIndicator>
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  optionIcon: {
    fontSize: 24,
    marginRight: spacing.md,
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
  const moduleColor = useModuleColor('agenda');

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
            style={[dateTimePickerModalStyles.doneButton, { backgroundColor: moduleColor }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('modules.agenda.form.done')}
          >
            <Text style={dateTimePickerModalStyles.doneButtonText}>
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
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  doneButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  pickerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});

// ============================================================
// CategoryPickerModal — 3-wide grid with circular icon backgrounds
// ============================================================

interface CategoryPickerModalProps {
  visible: boolean;
  selectedCategoryId: string;
  selectedFormType: AgendaFormType;
  customCategories: CustomCategory[];
  onSelect: (category: { id: string; icon: string; name: string }) => void;
  onDeleteCustom: (categoryId: string) => void;
  onCreateCustom: () => void;
  onClose: () => void;
}

function CategoryPickerModal({
  visible,
  selectedCategoryId,
  selectedFormType,
  customCategories,
  onSelect,
  onDeleteCustom,
  onCreateCustom,
  onClose,
}: CategoryPickerModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const moduleColor = useModuleColor('agenda');

  const handleLongPressCustom = useCallback((cat: CustomCategory) => {
    Alert.alert(
      t('modules.agenda.form.deleteCategoryTitle'),
      t('modules.agenda.form.deleteCategoryMessage', { name: cat.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => onDeleteCustom(cat.id),
        },
      ],
    );
  }, [onDeleteCustom, t]);

  const renderCategoryItem = useCallback((
    id: string,
    icon: string,
    label: string,
    isCustom: boolean,
    customCat?: CustomCategory,
  ) => {
    const isSelected = id === selectedCategoryId;
    return (
      <HapticTouchable
        key={id}
        style={categoryPickerStyles.gridItem}
        onPress={() => {
          onSelect({ id, icon, name: label });
          onClose();
        }}
        onLongPress={isCustom && customCat ? () => handleLongPressCustom(customCat) : undefined}
        delayLongPress={500}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${icon} ${label}`}
        accessibilityHint={isCustom ? t('modules.agenda.form.longPressToDelete') : undefined}
      >
        <View
          style={[
            categoryPickerStyles.gridCircle,
            {
              backgroundColor: isSelected ? accentColor.light : themeColors.surface,
              borderColor: isSelected ? accentColor.primary : themeColors.border,
            },
          ]}
        >
          <Text style={categoryPickerStyles.gridEmoji}>{icon}</Text>
        </View>
        <Text
          style={[
            categoryPickerStyles.gridLabel,
            { color: isSelected ? accentColor.primary : themeColors.textPrimary },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </HapticTouchable>
    );
  }, [selectedCategoryId, accentColor, themeColors, onSelect, onClose, handleLongPressCustom, t]);

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
            {t('modules.agenda.form.categoryLabel')}
          </Text>
          <HapticTouchable
            style={[dateTimePickerModalStyles.doneButton, { backgroundColor: moduleColor }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={dateTimePickerModalStyles.doneButtonText}>
              {t('common.close')}
            </Text>
          </HapticTouchable>
        </View>

        <ScrollViewWithIndicator contentContainerStyle={categoryPickerStyles.scrollContent}>
          {/* Standard categories — 3-wide grid */}
          <View style={categoryPickerStyles.sectionHeader}>
            <Text style={[categoryPickerStyles.sectionTitle, { color: themeColors.textSecondary }]}>
              {t('modules.agenda.form.standardCategories')}
            </Text>
          </View>
          <View style={categoryPickerStyles.grid}>
            {STANDARD_CATEGORIES.map((cat) =>
              renderCategoryItem(cat.id, cat.icon, t(cat.name), false),
            )}
          </View>

          {/* Custom categories — 3-wide grid */}
          {customCategories.length > 0 && (
            <>
              <View style={categoryPickerStyles.sectionHeader}>
                <Text style={[categoryPickerStyles.sectionTitle, { color: themeColors.textSecondary }]}>
                  {t('modules.agenda.form.customCategories')}
                </Text>
              </View>
              <View style={categoryPickerStyles.grid}>
                {customCategories.map((cat) =>
                  renderCategoryItem(cat.id, cat.icon, cat.name, true, cat),
                )}
              </View>
            </>
          )}

          {/* Action buttons row: New + Edit */}
          <View style={categoryPickerStyles.actionRow}>
            <HapticTouchable
              style={[categoryPickerStyles.actionButton, { borderColor: accentColor.primary }]}
              onPress={() => {
                onClose();
                setTimeout(onCreateCustom, 300);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('modules.agenda.form.newCategory')}
            >
              <Icon name="plus" size={18} color={accentColor.primary} />
              <Text style={[categoryPickerStyles.actionButtonText, { color: accentColor.primary }]}>
                {t('modules.agenda.form.newCategoryShort')}
              </Text>
            </HapticTouchable>
          </View>
        </ScrollViewWithIndicator>
      </View>
    </Modal>
  );
}

const categoryPickerStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  gridItem: {
    flexBasis: '30%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  gridCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  gridEmoji: {
    fontSize: 24,
  },
  gridLabel: {
    ...typography.label,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    flex: 1,
  },
  actionButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
});

// ============================================================
// CreateCategoryModal — Emoji picker + name input
// ============================================================

interface CreateCategoryModalProps {
  visible: boolean;
  onSave: (category: CustomCategory) => void;
  onClose: () => void;
}

function CreateCategoryModal({
  visible,
  onSave,
  onClose,
}: CreateCategoryModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const moduleColor = useModuleColor('agenda');

  const [selectedEmoji, setSelectedEmoji] = useState('📋');
  const [categoryName, setCategoryName] = useState('');

  const handleSave = useCallback(() => {
    const trimmedName = categoryName.trim();
    if (!trimmedName) {
      setNotification({
        type: 'warning',
        title: t('status.warning'),
        message: t('modules.agenda.form.categoryNameRequired'),
      });
      return;
    }

    const newCategory: CustomCategory = {
      id: generateId(),
      icon: selectedEmoji,
      name: trimmedName,
      formType: 'appointment', // Default — user can change form type separately
      createdAt: Date.now(),
    };

    onSave(newCategory);
    // Reset state
    setSelectedEmoji('📋');
    setCategoryName('');
  }, [selectedEmoji, categoryName, onSave, t]);

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
            {t('modules.agenda.form.newCategory')}
          </Text>
          <HapticTouchable
            style={[dateTimePickerModalStyles.doneButton, { backgroundColor: moduleColor }]}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel={t('common.confirm')}
          >
            <Text style={dateTimePickerModalStyles.doneButtonText}>
              {t('common.confirm')}
            </Text>
          </HapticTouchable>
        </View>

        <ScrollViewWithIndicator contentContainerStyle={createCategoryStyles.content}>
          {/* Preview */}
          <View style={createCategoryStyles.preview}>
            <Text style={createCategoryStyles.previewEmoji}>{selectedEmoji}</Text>
            <Text style={[createCategoryStyles.previewName, { color: themeColors.textPrimary }]}>
              {categoryName || t('modules.agenda.form.categoryNamePlaceholder')}
            </Text>
          </View>

          {/* Name input */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('modules.agenda.form.categoryNameLabel')}
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
              value={categoryName}
              onChangeText={setCategoryName}
              placeholder={t('modules.agenda.form.categoryNamePlaceholder')}
              placeholderTextColor={themeColors.disabled}
              autoCapitalize="sentences"
              maxLength={30}
              returnKeyType="done"
              blurOnSubmit={true}
              onSubmitEditing={() => Keyboard.dismiss()}
              accessibilityLabel={t('modules.agenda.form.categoryNameLabel')}
            />
          </View>

          {/* Emoji groups */}
          {CURATED_EMOJI_GROUPS.map((group) => (
            <View key={group.id} style={createCategoryStyles.emojiGroup}>
              <Text style={[createCategoryStyles.emojiGroupLabel, { color: themeColors.textSecondary }]}>
                {t(group.labelKey)}
              </Text>
              <View style={createCategoryStyles.emojiGrid}>
                {group.emojis.map((emoji) => (
                  <HapticTouchable
                    key={emoji}
                    style={[
                      createCategoryStyles.emojiButton,
                      selectedEmoji === emoji && {
                        backgroundColor: accentColor.light,
                        borderColor: accentColor.primary,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => setSelectedEmoji(emoji)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedEmoji === emoji }}
                    accessibilityLabel={emoji}
                  >
                    <Text style={createCategoryStyles.emojiText}>{emoji}</Text>
                  </HapticTouchable>
                ))}
              </View>
            </View>
          ))}
        </ScrollViewWithIndicator>
      </View>
    </Modal>
  );
}

const createCategoryStyles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
  },
  previewEmoji: {
    fontSize: 40,
  },
  previewName: {
    ...typography.h3,
    flex: 1,
  },
  emojiGroup: {
    marginTop: spacing.lg,
  },
  emojiGroupLabel: {
    ...typography.label,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emojiButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  emojiText: {
    fontSize: 28,
  },
});

// ============================================================
// AgendaItemFormScreen
// ============================================================

export function AgendaItemFormScreen({
  initialData,
  onSave,
  onBack,
}: AgendaItemFormScreenProps) {
  const { t, i18n } = useTranslation();
  const themeColors = useColors();
  const insets = useSafeAreaInsets();
  const { accentColor } = useAccentColor();
  const moduleColor = useModuleColor('agenda');

  const isEditing = !!initialData;

  // ============================================================
  // Form Type & Category State
  // ============================================================

  const [selectedFormType, setSelectedFormType] = useState<AgendaFormType>(
    initialData?.formType
      ?? (initialData?.category ? getFormTypeForCategory(initialData.category) : 'appointment'),
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialData?.category ?? 'other',
  );
  const [selectedCategoryIcon, setSelectedCategoryIcon] = useState<string>(
    initialData?.categoryIcon ?? '📋',
  );
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>(
    initialData?.categoryName ?? t('modules.agenda.categories.other'),
  );
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  // Inline notification state (replaces Alert.alert for single-button notifications)
  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);

  // Load custom categories on mount
  useEffect(() => {
    loadCustomCategories().then(setCustomCategories);
  }, []);

  // Get active form type definition
  const formTypeDef = useMemo(
    () => getFormType(selectedFormType),
    [selectedFormType],
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
    initialData?.repeatType ?? formTypeDef.defaultRepeat,
  );
  const [endDate, setEndDate] = useState<Date | null>(
    initialData?.endDate ? new Date(initialData.endDate) : null,
  );
  const [reminderOffset, setReminderOffset] = useState<ReminderOffset>(
    initialData?.reminderOffset ?? formTypeDef.defaultReminder,
  );

  // Update defaults when form type changes (only for new items)
  useEffect(() => {
    if (isEditing) return;
    setRepeatType(formTypeDef.defaultRepeat);
    setReminderOffset(formTypeDef.defaultReminder);
  }, [formTypeDef, isEditing]);

  // Contact selection state (only for form types with showContactsField)
  const { contacts: allContacts } = useAgendaContext();
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(
    initialData?.contactIds ?? [],
  );
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');

  // End time state (v21 — ICS calendar import)
  const [endTime, setEndTime] = useState<Date | null>(() => {
    if (initialData?.endTime) {
      const [h, m] = initialData.endTime.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    }
    return null;
  });
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Notes state (v21 — ICS DESCRIPTION)
  const [notes, setNotes] = useState(initialData?.notes ?? '');

  // Address state (v18)
  const [locationName, setLocationName] = useState(initialData?.locationName ?? '');
  const [addressStreet, setAddressStreet] = useState(initialData?.addressStreet ?? '');
  const [addressPostalCode, setAddressPostalCode] = useState(initialData?.addressPostalCode ?? '');
  const [addressCity, setAddressCity] = useState(initialData?.addressCity ?? '');
  const [addressCountry, setAddressCountry] = useState(initialData?.addressCountry ?? '');
  const [useCustomAddress, setUseCustomAddress] = useState(
    !!(initialData?.addressStreet || initialData?.addressCity),
  );

  // Determine if the first selected contact has an address
  const firstContactAddress = useMemo(() => {
    if (selectedContactIds.length === 0) return null;
    const firstContact = allContacts.find(c => c.id === selectedContactIds[0]);
    if (!firstContact) return null;
    const hasAddr = firstContact.addressStreet || firstContact.addressCity;
    if (!hasAddr) return null;
    return {
      street: firstContact.addressStreet ?? '',
      postalCode: firstContact.addressPostalCode ?? '',
      city: firstContact.addressCity ?? '',
      country: firstContact.addressCountry ?? '',
    };
  }, [selectedContactIds, allContacts]);

  // Auto-fill address from first contact when toggle is OFF and contact has address
  useEffect(() => {
    if (useCustomAddress) return;
    if (!firstContactAddress) {
      setLocationName('');
      setAddressStreet('');
      setAddressPostalCode('');
      setAddressCity('');
      setAddressCountry('');
      return;
    }
    setLocationName('');
    setAddressStreet(firstContactAddress.street);
    setAddressPostalCode(firstContactAddress.postalCode);
    setAddressCity(firstContactAddress.city);
    setAddressCountry(firstContactAddress.country);
  }, [firstContactAddress, useCustomAddress]);

  // Handle toggle change
  const handleCustomAddressToggle = useCallback((enabled: boolean) => {
    setUseCustomAddress(enabled);
    if (enabled) {
      setLocationName('');
      setAddressStreet('');
      setAddressPostalCode('');
      setAddressCity('');
      setAddressCountry('');
      loadCategoryAddress(selectedCategoryId).then(cached => {
        if (!cached) return;
        setLocationName(cached.locationName ?? '');
        setAddressStreet(cached.addressStreet ?? '');
        setAddressPostalCode(cached.addressPostalCode ?? '');
        setAddressCity(cached.addressCity ?? '');
        setAddressCountry(cached.addressCountry ?? '');
      });
    }
  }, [selectedCategoryId]);

  // Load category-memory address on mount (only for new items without contact address)
  useEffect(() => {
    if (isEditing) return;
    if (!formTypeDef.showAddressField) return;
    if (initialData?.addressStreet || initialData?.addressCity) return;
    if (firstContactAddress) return;

    loadCategoryAddress(selectedCategoryId).then(cached => {
      if (!cached) return;
      if (locationName || addressStreet || addressCity) return;
      setUseCustomAddress(true);
      setLocationName(cached.locationName ?? '');
      setAddressStreet(cached.addressStreet ?? '');
      setAddressPostalCode(cached.addressPostalCode ?? '');
      setAddressCity(cached.addressCity ?? '');
      setAddressCountry(cached.addressCountry ?? '');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Selected contact models (for display)
  const selectedContacts = useMemo(
    () => selectedContactIds
      .map(id => allContacts.find(c => c.id === id))
      .filter((c): c is ContactModel => c != null),
    [selectedContactIds, allContacts],
  );

  // Contacts split by category match (for picker suggestions)
  const { suggestedContacts, otherContacts } = useMemo(() => {
    const suggested: ContactModel[] = [];
    const other: ContactModel[] = [];
    for (const contact of allContacts) {
      const catIds = contact.categoryIds;
      if (catIds.includes(selectedCategoryId)) {
        suggested.push(contact);
      } else {
        other.push(contact);
      }
    }
    return { suggestedContacts: suggested, otherContacts: other };
  }, [allContacts, selectedCategoryId]);

  // Filter contacts by search query (for contact picker modal)
  const { filteredSuggested, filteredOther } = useMemo(() => {
    const query = contactSearchQuery.toLowerCase().trim();
    if (query === '') {
      return { filteredSuggested: suggestedContacts, filteredOther: otherContacts };
    }
    return {
      filteredSuggested: suggestedContacts.filter(c =>
        c.displayName.toLowerCase().includes(query),
      ),
      filteredOther: otherContacts.filter(c =>
        c.displayName.toLowerCase().includes(query),
      ),
    };
  }, [suggestedContacts, otherContacts, contactSearchQuery]);

  // Picker visibility state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
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

  const handleFormTypeChange = useCallback((typeId: string) => {
    setSelectedFormType(typeId as AgendaFormType);
  }, []);

  const handleCategorySelect = useCallback((cat: { id: string; icon: string; name: string }) => {
    // Auto-fill title: only when title is empty or matches the previous category name
    setTitle(prev => {
      const prevIsEmpty = prev.trim().length === 0;
      const prevMatchesCategory = prev.trim() === selectedCategoryName;
      return (prevIsEmpty || prevMatchesCategory) ? cat.name : prev;
    });
    setSelectedCategoryId(cat.id);
    setSelectedCategoryIcon(cat.icon);
    setSelectedCategoryName(cat.name);
  }, [selectedCategoryName]);

  const handleCreateCategory = useCallback((newCategory: CustomCategory) => {
    setCustomCategories(prev => {
      const updated = [...prev, newCategory];
      saveCustomCategories(updated);
      return updated;
    });
    // Auto-select the new category
    setSelectedCategoryId(newCategory.id);
    setSelectedCategoryIcon(newCategory.icon);
    setSelectedCategoryName(newCategory.name);
    setShowCreateCategory(false);
  }, []);

  const handleDeleteCategory = useCallback((categoryId: string) => {
    setCustomCategories(prev => {
      const updated = prev.filter(c => c.id !== categoryId);
      saveCustomCategories(updated);
      return updated;
    });
    // If the deleted category was selected, reset to 'other'
    if (selectedCategoryId === categoryId) {
      const otherCat = STANDARD_CATEGORIES.find(c => c.id === 'other');
      setSelectedCategoryId('other');
      setSelectedCategoryIcon(otherCat?.icon ?? '📋');
      setSelectedCategoryName(t(otherCat?.name ?? 'modules.agenda.categories.other'));
    }
  }, [selectedCategoryId, t]);

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
      setNotification({
        type: 'warning',
        title: t('status.warning'),
        message: t('modules.agenda.form.titleRequired'),
      });
      titleInputRef.current?.focus();
      return;
    }

    // Build time data based on form type
    let timeStr: string | undefined;
    let timesArr: string[] | undefined;

    if (formTypeDef.showMultipleTimes) {
      // Medication: multiple times
      timesArr = medicationTimes
        .map(formatTime)
        .sort();
      timeStr = timesArr[0]; // Primary time for sorting
    } else if (formTypeDef.showTimeField) {
      timeStr = formatTime(selectedTime);
    }

    const data: CreateAgendaItemData = {
      category: selectedCategoryId as AgendaCategory,
      categoryIcon: selectedCategoryIcon,
      categoryName: selectedCategoryName,
      formType: selectedFormType,
      title: trimmedTitle,
      date: selectedDate.getTime(),
      time: timeStr,
      times: timesArr,
      repeatType: repeatType ?? undefined,
      endDate: endDate?.getTime(),
      reminderOffset,
      // Contacts (only for form types that support it)
      contactIds: formTypeDef.showContactsField ? selectedContactIds : undefined,
      // Address (only for form types that support it)
      locationName: formTypeDef.showAddressField ? (locationName.trim() || undefined) : undefined,
      addressStreet: formTypeDef.showAddressField ? (addressStreet.trim() || undefined) : undefined,
      addressPostalCode: formTypeDef.showAddressField ? (addressPostalCode.trim() || undefined) : undefined,
      addressCity: formTypeDef.showAddressField ? (addressCity.trim() || undefined) : undefined,
      addressCountry: formTypeDef.showAddressField ? (addressCountry.trim() || undefined) : undefined,
      // End time + notes (v21)
      endTime: endTime ? formatTime(endTime) : undefined,
      notes: notes.trim() || undefined,
      source: initialData?.source,
    };

    // Save category-memory for address (async, fire-and-forget)
    if (formTypeDef.showAddressField) {
      saveCategoryAddress(selectedCategoryId, {
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
    selectedCategoryId,
    selectedCategoryIcon,
    selectedCategoryName,
    selectedFormType,
    formTypeDef,
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
    endTime,
    notes,
    initialData?.source,
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
  // Dirty state — determines Cancel behavior
  // ============================================================

  const isDirty = useMemo(() => {
    if (!isEditing) {
      return title.trim().length > 0
        || locationName.trim().length > 0
        || addressStreet.trim().length > 0
        || addressCity.trim().length > 0
        || selectedContactIds.length > 0
        || endTime !== null
        || notes.trim().length > 0;
    }
    const initialEndTime = initialData?.endTime ?? null;
    const currentEndTime = endTime ? formatTime(endTime) : null;
    return title.trim() !== (initialData?.title ?? '')
      || locationName.trim() !== (initialData?.locationName ?? '')
      || addressStreet.trim() !== (initialData?.addressStreet ?? '')
      || addressPostalCode.trim() !== (initialData?.addressPostalCode ?? '')
      || addressCity.trim() !== (initialData?.addressCity ?? '')
      || addressCountry.trim() !== (initialData?.addressCountry ?? '')
      || currentEndTime !== initialEndTime
      || notes.trim() !== (initialData?.notes ?? '');
  }, [
    isEditing, title, locationName, addressStreet, addressPostalCode,
    addressCity, addressCountry, selectedContactIds, initialData,
    endTime, notes,
  ]);

  // Cancel with unsaved changes guard
  const handleCancel = useCallback(() => {
    if (isDirty) {
      Alert.alert(
        t('common.formActions.discardTitle'),
        t('common.formActions.discardMessage'),
        [
          { text: t('common.formActions.keepEditing'), style: 'cancel' },
          { text: t('common.formActions.discard'), style: 'destructive', onPress: onBack },
        ],
      );
    } else {
      onBack();
    }
  }, [isDirty, onBack, t]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {notification && (
        <ErrorView
          type={notification.type}
          title={notification.title}
          message={notification.message}
          onDismiss={() => setNotification(null)}
        />
      )}

      {/* Header — Form mode: Cancel/Save buttons */}
      <ModuleHeader
        moduleId="agenda"
        icon="calendar"
        title={t('modules.agenda.title')}
        showAdMob={false}
        showGridButton={false}
        formMode={true}
        onCancel={handleCancel}
        onSave={handleSave}
      />

      <ScrollViewWithIndicator
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ====== Form Type — 3 inline buttons ====== */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('modules.agenda.form.typeLabel')}
          </Text>
          <View style={styles.formTypeRow}>
            {FORM_TYPES.map((ft) => {
              const isActive = selectedFormType === ft.id;
              return (
                <HapticTouchable
                  key={ft.id}
                  style={[
                    styles.formTypeButton,
                    {
                      borderColor: isActive ? accentColor.primary : themeColors.border,
                      backgroundColor: isActive ? accentColor.light : themeColors.surface,
                    },
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    handleFormTypeChange(ft.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={t(ft.labelKey)}
                >
                  <Text style={styles.formTypeIcon}>{ft.icon}</Text>
                  <Text
                    style={[
                      styles.formTypeLabel,
                      { color: isActive ? accentColor.primary : themeColors.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {t(ft.labelKey)}
                  </Text>
                </HapticTouchable>
              );
            })}
          </View>
        </View>

        {/* ====== Category ====== */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('modules.agenda.form.categoryLabel')}
          </Text>
          <HapticTouchable
            style={[styles.pickerRow, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
            onPress={() => { Keyboard.dismiss(); setShowCategoryPicker(true); }}
            accessibilityRole="button"
            accessibilityLabel={`${t('modules.agenda.form.categoryLabel')}: ${selectedCategoryIcon} ${selectedCategoryName}`}
          >
            <Text style={styles.pickerIcon}>{selectedCategoryIcon}</Text>
            <Text style={[styles.pickerValue, { color: themeColors.textPrimary }]}>
              {selectedCategoryName}
            </Text>
            <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
          </HapticTouchable>
        </View>

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

          {/* Past-date warning (soft — informational, not blocking) */}
          {selectedDate < new Date(new Date().setHours(0, 0, 0, 0)) && selectedFormType !== 'medication' && (
            <View style={[styles.pastDateBanner, { backgroundColor: '#FFF3E0', borderColor: '#FFB74D' }]}>
              <Icon name="warning" size={18} color="#E65100" />
              <Text style={[styles.pastDateText, { color: '#E65100' }]}>
                {t('modules.agenda.form.pastDateWarning', 'Deze datum ligt in het verleden')}
              </Text>
            </View>
          )}
        </View>

        {/* ====== Time (single) ====== */}
        {formTypeDef.showTimeField && !formTypeDef.showMultipleTimes && (
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
        )}

        {/* ====== Multiple Times (medication) ====== */}
        {formTypeDef.showMultipleTimes && (
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

        {/* ====== End Time (optional — shown for appointment when start time is set) ====== */}
        {formTypeDef.showTimeField && !formTypeDef.showMultipleTimes && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
              {t('modules.agenda.form.endTimeLabel')}
            </Text>
            {endTime ? (
              <View style={styles.endTimeRow}>
                <HapticTouchable
                  style={[styles.pickerRow, { borderColor: themeColors.border, backgroundColor: themeColors.surface, flex: 1 }]}
                  onPress={() => { Keyboard.dismiss(); setShowEndTimePicker(true); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('modules.agenda.form.endTimeLabel')}: ${formatTime(endTime)}`}
                >
                  <Text style={[styles.pickerValue, { color: themeColors.textPrimary }]}>
                    {formatTime(endTime)}
                  </Text>
                  <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
                </HapticTouchable>
                <HapticTouchable
                  style={styles.clearEndDate}
                  onPress={() => setEndTime(null)}
                  accessibilityRole="button"
                  accessibilityLabel={t('modules.agenda.form.clearEndTime')}
                >
                  <Text style={[styles.clearEndDateText, { color: accentColor.primary }]}>
                    {t('modules.agenda.form.clearEndTime')}
                  </Text>
                </HapticTouchable>
              </View>
            ) : (
              <HapticTouchable
                style={[styles.pickerRow, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
                onPress={() => {
                  Keyboard.dismiss();
                  // Default end time: 1 hour after start time
                  const defaultEnd = new Date(selectedTime);
                  defaultEnd.setHours(defaultEnd.getHours() + 1);
                  setEndTime(defaultEnd);
                  setShowEndTimePicker(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('modules.agenda.form.addEndTime')}
              >
                <Text style={[styles.pickerValue, { color: themeColors.textTertiary }]}>
                  {t('modules.agenda.form.addEndTime')}
                </Text>
                <Icon name="add" size={20} color={themeColors.textSecondary} />
              </HapticTouchable>
            )}
          </View>
        )}

        {/* ====== Notes (optional) ====== */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>
            {t('modules.agenda.form.notesLabel')}
          </Text>
          <RNTextInput
            style={[
              styles.textInput,
              styles.notesInput,
              {
                color: themeColors.textPrimary,
                borderColor: themeColors.border,
                backgroundColor: themeColors.surface,
              },
            ]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('modules.agenda.form.notesPlaceholder')}
            placeholderTextColor={themeColors.disabled}
            autoCapitalize="sentences"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            blurOnSubmit={true}
            onSubmitEditing={() => Keyboard.dismiss()}
            accessibilityLabel={t('modules.agenda.form.notesLabel')}
          />
        </View>

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

        {/* ====== Contacts (when form type supports it) ====== */}
        {formTypeDef.showContactsField && (
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
                    {contact.photoPath ? (
                      <Image
                        source={{ uri: contact.photoPath }}
                        style={styles.contactChipAvatar}
                      />
                    ) : (
                      <View style={[styles.contactChipAvatarFallback, { backgroundColor: accentColor.primary }]}>
                        <Icon name="person" size={16} color={colors.textOnPrimary} />
                      </View>
                    )}
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

        {/* ====== Location / Address ====== */}
        {formTypeDef.showAddressField && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>
              {t('modules.agenda.form.addressSectionTitle')}
            </Text>

            {/* "Ander adres" toggle */}
            <View style={[
              styles.toggleRow,
              !firstContactAddress && styles.toggleRowDisabled,
            ]}>
              <Text style={[
                styles.fieldLabel,
                { color: firstContactAddress ? themeColors.textPrimary : themeColors.disabled, marginBottom: 0 },
              ]}>
                {t('modules.agenda.form.customAddressLabel')}
              </Text>
              <Switch
                value={useCustomAddress}
                onValueChange={handleCustomAddressToggle}
                disabled={!firstContactAddress}
                trackColor={{ false: themeColors.border, true: accentColor.primary }}
                thumbColor={colors.textOnPrimary}
                accessibilityLabel={t('modules.agenda.form.customAddressLabel')}
              />
            </View>

            {/* Address fields — read-only when showing contact address */}
            {(() => {
              const isReadOnly = !useCustomAddress && !!firstContactAddress;
              const fieldTextColor = isReadOnly ? themeColors.disabled : themeColors.textPrimary;
              const fieldBgColor = isReadOnly ? themeColors.background : themeColors.surface;

              return (
                <>
                  {/* Location name — only shown when custom address is active */}
                  {useCustomAddress && (
                    <>
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
                    </>
                  )}

                  {/* Street */}
                  <View style={styles.addressFieldGap}>
                    <Text style={[styles.fieldLabel, { color: fieldTextColor }]}>
                      {t('modules.agenda.form.streetLabel')}
                    </Text>
                    <RNTextInput
                      style={[
                        styles.textInput,
                        {
                          color: fieldTextColor,
                          borderColor: themeColors.border,
                          backgroundColor: fieldBgColor,
                        },
                      ]}
                      value={addressStreet}
                      onChangeText={setAddressStreet}
                      placeholder={isReadOnly ? '' : t('modules.agenda.form.streetPlaceholder')}
                      placeholderTextColor={themeColors.disabled}
                      editable={!isReadOnly}
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
                        <Text style={[styles.fieldLabel, { color: fieldTextColor }]}>
                          {t('modules.agenda.form.postalCodeLabel')}
                        </Text>
                        <RNTextInput
                          style={[
                            styles.textInput,
                            {
                              color: fieldTextColor,
                              borderColor: themeColors.border,
                              backgroundColor: fieldBgColor,
                            },
                          ]}
                          value={addressPostalCode}
                          onChangeText={setAddressPostalCode}
                          placeholder={isReadOnly ? '' : t('modules.agenda.form.postalCodePlaceholder')}
                          placeholderTextColor={themeColors.disabled}
                          editable={!isReadOnly}
                          autoCapitalize="characters"
                          returnKeyType="next"
                          blurOnSubmit={true}
                          onSubmitEditing={() => Keyboard.dismiss()}
                          accessibilityLabel={t('modules.agenda.form.postalCodeLabel')}
                        />
                      </View>
                      <View style={styles.cityField}>
                        <Text style={[styles.fieldLabel, { color: fieldTextColor }]}>
                          {t('modules.agenda.form.cityLabel')}
                        </Text>
                        <RNTextInput
                          style={[
                            styles.textInput,
                            {
                              color: fieldTextColor,
                              borderColor: themeColors.border,
                              backgroundColor: fieldBgColor,
                            },
                          ]}
                          value={addressCity}
                          onChangeText={setAddressCity}
                          placeholder={isReadOnly ? '' : t('modules.agenda.form.cityPlaceholder')}
                          placeholderTextColor={themeColors.disabled}
                          editable={!isReadOnly}
                          autoCapitalize="words"
                          returnKeyType="done"
                          blurOnSubmit={true}
                          onSubmitEditing={() => Keyboard.dismiss()}
                          accessibilityLabel={t('modules.agenda.form.cityLabel')}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Contact address hint when read-only */}
                  {isReadOnly && (
                    <Text style={[styles.autoFillHint, { color: themeColors.textTertiary }]}>
                      {t('modules.agenda.form.addressFromContact')}
                    </Text>
                  )}
                </>
              );
            })()}
          </View>
        )}
      </ScrollViewWithIndicator>

      {/* Category Picker Modal */}
      <CategoryPickerModal
        visible={showCategoryPicker}
        selectedCategoryId={selectedCategoryId}
        selectedFormType={selectedFormType}
        customCategories={customCategories}
        onSelect={handleCategorySelect}
        onDeleteCustom={handleDeleteCategory}
        onCreateCustom={() => setShowCreateCategory(true)}
        onClose={() => setShowCategoryPicker(false)}
      />

      {/* Create Category Modal */}
      <CreateCategoryModal
        visible={showCreateCategory}
        onSave={handleCreateCategory}
        onClose={() => setShowCreateCategory(false)}
      />

      {/* DateTime Picker Modals */}
      <DateTimePickerModal
        visible={showDatePicker}
        title={t('modules.agenda.form.dateLabel')}
        value={selectedDate}
        mode="date"
        onChange={handleDateChange}
        onClose={() => setShowDatePicker(false)}
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
        visible={showEndTimePicker}
        title={t('modules.agenda.form.endTimeLabel')}
        value={endTime ?? new Date()}
        mode="time"
        onChange={(event, date) => {
          if (date) setEndTime(date);
          if (Platform.OS === 'android') setShowEndTimePicker(false);
        }}
        onClose={() => setShowEndTimePicker(false)}
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
        onRequestClose={() => { setShowContactPicker(false); setContactSearchQuery(''); }}
      >
        <View style={[formPickerStyles.container, { backgroundColor: themeColors.background }]}>
          {/* Header */}
          <View style={[formPickerStyles.header, { borderBottomColor: themeColors.border }]}>
            <Text style={[formPickerStyles.title, { color: themeColors.textPrimary }]}>
              {t('modules.agenda.form.selectContacts')}
            </Text>
            <HapticTouchable
              style={[dateTimePickerModalStyles.doneButton, { backgroundColor: moduleColor }]}
              onPress={() => { setShowContactPicker(false); setContactSearchQuery(''); }}
              accessibilityRole="button"
              accessibilityLabel={t('common.confirm')}
            >
              <Text style={dateTimePickerModalStyles.doneButtonText}>
                {t('common.confirm')}
              </Text>
            </HapticTouchable>
          </View>

          {/* Search bar for filtering contacts */}
          <View style={styles.contactSearchContainer}>
            <SearchBar
              value={contactSearchQuery}
              onChangeText={setContactSearchQuery}
              onSubmit={() => {}}
              placeholder={t('contacts.searchPlaceholder')}
              searchButtonLabel={t('contacts.searchButton')}
            />
          </View>

          {/* Contact list — suggested first, then others */}
          <ScrollViewWithIndicator>
            {allContacts.length === 0 ? (
              <View style={styles.emptyContactList}>
                <Text style={[styles.emptyContactText, { color: themeColors.textTertiary }]}>
                  {t('modules.agenda.form.noContacts')}
                </Text>
              </View>
            ) : filteredSuggested.length === 0 && filteredOther.length === 0 ? (
              <View style={styles.emptyContactList}>
                <Text style={[styles.emptyContactText, { color: themeColors.textTertiary }]}>
                  {t('contacts.noResults')}
                </Text>
              </View>
            ) : (
              <>
                {/* Suggested contacts (matching category) */}
                {filteredSuggested.length > 0 && (
                  <>
                    <View style={styles.contactSectionHeader}>
                      <Text style={[styles.contactSectionTitle, { color: themeColors.textSecondary }]}>
                        {t('modules.agenda.form.suggestedContacts', { category: selectedCategoryName })}
                      </Text>
                    </View>
                    {filteredSuggested.map(contact => {
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
                            {contact.photoPath ? (
                              <Image
                                source={{ uri: contact.photoPath }}
                                style={styles.contactPickerAvatar}
                              />
                            ) : (
                              <View style={[styles.contactPickerAvatarFallback, { backgroundColor: accentColor.light }]}>
                                <Icon name="person" size={20} color={accentColor.primary} />
                              </View>
                            )}
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
                            <Icon
                              name={isSelected ? 'checkbox-checked' : 'checkbox-unchecked'}
                              size={24}
                              color={isSelected ? accentColor.primary : themeColors.textTertiary}
                            />
                          </View>
                        </HapticTouchable>
                      );
                    })}
                  </>
                )}

                {/* Other contacts */}
                {filteredOther.length > 0 && (
                  <>
                    {filteredSuggested.length > 0 && (
                      <View style={styles.contactSectionHeader}>
                        <Text style={[styles.contactSectionTitle, { color: themeColors.textSecondary }]}>
                          {t('modules.agenda.form.otherContacts')}
                        </Text>
                      </View>
                    )}
                    {filteredOther.map(contact => {
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
                            {contact.photoPath ? (
                              <Image
                                source={{ uri: contact.photoPath }}
                                style={styles.contactPickerAvatar}
                              />
                            ) : (
                              <View style={[styles.contactPickerAvatarFallback, { backgroundColor: accentColor.light }]}>
                                <Icon name="person" size={20} color={accentColor.primary} />
                              </View>
                            )}
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
                            <Icon
                              name={isSelected ? 'checkbox-checked' : 'checkbox-unchecked'}
                              size={24}
                              color={isSelected ? accentColor.primary : themeColors.textTertiary}
                            />
                          </View>
                        </HapticTouchable>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </ScrollViewWithIndicator>
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

  // Form type inline buttons
  formTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formTypeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    minHeight: touchTargets.comfortable,
    gap: spacing.xs,
  },
  formTypeIcon: {
    fontSize: 24,
  },
  formTypeLabel: {
    ...typography.label,
    fontWeight: '700',
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
  pickerIcon: {
    fontSize: 24,
    marginRight: spacing.md,
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

  // End time
  endTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Notes
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
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
  contactChipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  contactChipAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
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
  contactPickerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  contactPickerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactPickerInfo: {
    flex: 1,
  },
  contactAddressHint: {
    ...typography.label,
    marginTop: 2,
  },
  contactSectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  contactSectionTitle: {
    ...typography.label,
    fontWeight: '700',
  },
  contactSearchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTargets.minimum,
    marginBottom: spacing.sm,
  },
  toggleRowDisabled: {
    opacity: 0.4,
  },

  // Past-date warning banner
  pastDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  pastDateText: {
    ...typography.label,
    fontWeight: '600',
    flex: 1,
  },
});
