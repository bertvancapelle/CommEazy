/**
 * AgendaItemDetailScreen — Detail view for a single agenda item
 *
 * Shows item info (icon, title, date, time, repeat, reminder) and actions:
 * - Standard items: Edit, Share, Delete
 * - Medication items: Taken, Skipped, Remind Later (+ Edit, Share, Delete)
 * - Recurring items: "Only today" / "Today and all following" choice modal
 *
 * Senior-inclusive: 60pt+ touch targets, 18pt+ text, WCAG AAA contrast
 *
 * @see contexts/AgendaContext.tsx for data actions
 * @see constants/agendaCategories.ts for category definitions
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, HapticTouchable } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import {
  useAgendaContext,
  type TimelineItem,
} from '@/contexts/AgendaContext';
import type { MedicationLogEntry } from '@/models/AgendaItem';
import {
  REPEAT_OPTIONS,
  REMINDER_OPTIONS,
} from '@/constants/agendaCategories';

// ============================================================
// Props
// ============================================================

interface AgendaItemDetailScreenProps {
  item: TimelineItem;
  onBack: () => void;
  onEdit: (item: TimelineItem) => void;
}

// ============================================================
// Helpers
// ============================================================

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getLocaleString(lang: string): string {
  const map: Record<string, string> = {
    nl: 'nl-NL', de: 'de-DE', fr: 'fr-FR', es: 'es-ES',
    it: 'it-IT', no: 'nb-NO', sv: 'sv-SE', da: 'da-DK',
    'pt-BR': 'pt-BR', pt: 'pt-PT', pl: 'pl-PL',
    'en-GB': 'en-GB',
  };
  return map[lang] ?? 'en-US';
}

// ============================================================
// RecurringActionModal — "Only today" / "All following"
// ============================================================

interface RecurringActionModalProps {
  visible: boolean;
  title: string;
  onTodayOnly: () => void;
  onAllFollowing: () => void;
  onCancel: () => void;
}

function RecurringActionModal({
  visible,
  title,
  onTodayOnly,
  onAllFollowing,
  onCancel,
}: RecurringActionModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <View style={recurringStyles.overlay}>
        <View style={[recurringStyles.sheet, { backgroundColor: themeColors.background }]}>
          <Text style={[recurringStyles.title, { color: themeColors.textPrimary }]}>
            {title}
          </Text>

          <HapticTouchable
            style={[recurringStyles.option, { borderColor: themeColors.border }]}
            onPress={onTodayOnly}
            accessibilityRole="button"
            accessibilityLabel={t('modules.agenda.detail.todayOnly')}
          >
            <Text style={[recurringStyles.optionText, { color: themeColors.textPrimary }]}>
              {t('modules.agenda.detail.todayOnly')}
            </Text>
          </HapticTouchable>

          <HapticTouchable
            style={[recurringStyles.option, { borderColor: themeColors.border }]}
            onPress={onAllFollowing}
            accessibilityRole="button"
            accessibilityLabel={t('modules.agenda.detail.allFollowing')}
          >
            <Text style={[recurringStyles.optionText, { color: themeColors.textPrimary }]}>
              {t('modules.agenda.detail.allFollowing')}
            </Text>
          </HapticTouchable>

          <HapticTouchable
            style={[recurringStyles.cancelOption]}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={[recurringStyles.cancelText, { color: themeColors.textSecondary }]}>
              {t('common.cancel')}
            </Text>
          </HapticTouchable>
        </View>
      </View>
    </Modal>
  );
}

const recurringStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    width: '100%',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  option: {
    minHeight: touchTargets.comfortable,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  optionText: {
    ...typography.body,
    fontWeight: '600',
  },
  cancelOption: {
    minHeight: touchTargets.comfortable,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  cancelText: {
    ...typography.body,
    fontWeight: '600',
  },
});

// ============================================================
// InfoRow — Label + value pair
// ============================================================

interface InfoRowProps {
  emoji: string;
  label: string;
  themeColors: ReturnType<typeof useColors>;
}

function InfoRow({ emoji, label, themeColors }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoEmoji}>{emoji}</Text>
      <Text style={[styles.infoLabel, { color: themeColors.textPrimary }]}>
        {label}
      </Text>
    </View>
  );
}

// ============================================================
// AgendaItemDetailScreen
// ============================================================

export function AgendaItemDetailScreen({
  item,
  onBack,
  onEdit,
}: AgendaItemDetailScreenProps) {
  const { t, i18n } = useTranslation();
  const themeColors = useColors();
  const insets = useSafeAreaInsets();
  const moduleColor = useModuleColor('agenda');
  const { accentColor } = useAccentColor();
  const {
    deleteItem,
    logMedication,
    deleteSingleOccurrence,
  } = useAgendaContext();

  const locale = getLocaleString(i18n.language);

  // Recurring action modal state
  const [recurringModal, setRecurringModal] = useState<{
    visible: boolean;
    action: 'edit' | 'delete';
  }>({ visible: false, action: 'edit' });

  // ============================================================
  // Info display values
  // ============================================================

  const dateDisplay = useMemo(
    () => formatDate(new Date(item.date), locale),
    [item.date, locale],
  );

  const timeDisplay = useMemo(() => {
    if (item.times.length > 1) {
      return item.times.join(', ');
    }
    return item.time ?? t('modules.agenda.detail.allDay');
  }, [item.time, item.times, t]);

  const repeatDisplay = useMemo(() => {
    const opt = REPEAT_OPTIONS.find(o => o.value === item.repeatType);
    return opt ? t(opt.labelKey) : t('modules.agenda.repeat.none');
  }, [item.repeatType, t]);

  const reminderDisplay = useMemo(() => {
    const opt = REMINDER_OPTIONS.find(o => o.value === item.reminderOffset);
    return opt ? t(opt.labelKey) : '';
  }, [item.reminderOffset, t]);

  const endDateDisplay = useMemo(() => {
    if (!item.endDate) return null;
    return formatDate(new Date(item.endDate), locale);
  }, [item.endDate, locale]);

  // ============================================================
  // Action handlers
  // ============================================================

  const handleEdit = useCallback(() => {
    if (item.isRecurring && item.modelId) {
      setRecurringModal({ visible: true, action: 'edit' });
    } else {
      onEdit(item);
    }
  }, [item, onEdit]);

  const handleDelete = useCallback(() => {
    if (item.isRecurring && item.modelId) {
      setRecurringModal({ visible: true, action: 'delete' });
    } else {
      Alert.alert(
        t('modules.agenda.detail.deleteTitle'),
        t('modules.agenda.detail.deleteMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              if (item.modelId) {
                await deleteItem(item.modelId);
                onBack();
              }
            },
          },
        ],
      );
    }
  }, [item, deleteItem, onBack, t]);

  // Recurring: "Only today"
  const handleTodayOnly = useCallback(async () => {
    setRecurringModal({ visible: false, action: 'edit' });
    if (recurringModal.action === 'delete') {
      if (item.modelId) {
        await deleteSingleOccurrence(item.modelId, item.date);
        onBack();
      }
    } else {
      // Edit single occurrence — navigate to form with exception data
      onEdit(item);
    }
  }, [recurringModal.action, item, deleteSingleOccurrence, onBack, onEdit]);

  // Recurring: "All following"
  const handleAllFollowing = useCallback(async () => {
    setRecurringModal({ visible: false, action: 'edit' });
    if (recurringModal.action === 'delete') {
      if (item.modelId) {
        await deleteItem(item.modelId);
        onBack();
      }
    } else {
      // Edit all — navigate to form with full item
      onEdit(item);
    }
  }, [recurringModal.action, item, deleteItem, onBack, onEdit]);

  const handleCancelRecurring = useCallback(() => {
    setRecurringModal({ visible: false, action: 'edit' });
  }, []);

  // Medication actions
  const handleMedicationTaken = useCallback(async () => {
    if (!item.modelId) return;
    const dateKey = new Date(item.date).toISOString().split('T')[0];
    const entry: MedicationLogEntry = {
      date: dateKey,
      time: item.time ?? '00:00',
      status: 'taken',
      confirmedAt: Date.now(),
    };
    await logMedication(item.modelId, entry);
    onBack();
  }, [item, logMedication, onBack]);

  const handleMedicationSkipped = useCallback(async () => {
    if (!item.modelId) return;
    const dateKey = new Date(item.date).toISOString().split('T')[0];
    const entry: MedicationLogEntry = {
      date: dateKey,
      time: item.time ?? '00:00',
      status: 'skipped',
      confirmedAt: Date.now(),
    };
    await logMedication(item.modelId, entry);
    onBack();
  }, [item, logMedication, onBack]);

  // Share (placeholder — Fase 7)
  const handleShare = useCallback(() => {
    // TODO: Fase 7 — share via XMPP
    console.debug('[AgendaDetail] Share tapped for item:', item.id);
  }, [item.id]);

  // Check if medication was already logged for this date
  const medicationStatus = useMemo(() => {
    if (!item.isMedication) return null;
    const dateKey = new Date(item.date).toISOString().split('T')[0];
    const log = item.medicationLog.find(
      e => e.date === dateKey && e.time === (item.time ?? '00:00'),
    );
    return log?.status ?? 'pending';
  }, [item]);

  // ============================================================
  // Render
  // ============================================================

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
          {item.icon} {item.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        {/* Item info card */}
        <View style={[styles.infoCard, { borderColor: themeColors.border }]}>
          <InfoRow emoji="📅" label={dateDisplay} themeColors={themeColors} />
          <InfoRow emoji="🕐" label={timeDisplay} themeColors={themeColors} />
          <InfoRow emoji="🔁" label={repeatDisplay} themeColors={themeColors} />
          {endDateDisplay && (
            <InfoRow
              emoji="⏳"
              label={`${t('modules.agenda.detail.until')} ${endDateDisplay}`}
              themeColors={themeColors}
            />
          )}
          <InfoRow emoji="🔔" label={reminderDisplay} themeColors={themeColors} />

          {/* Contact names */}
          {item.contactNames.length > 0 && (
            <InfoRow
              emoji="👤"
              label={item.contactNames.join(', ')}
              themeColors={themeColors}
            />
          )}

          {/* Years since (birthday/anniversary) */}
          {item.yearsSince != null && item.yearsSince > 0 && (
            <InfoRow
              emoji={item.category === 'birthday' ? '🎂' : '💍'}
              label={`${item.yearsSince} ${t('modules.agenda.years')}`}
              themeColors={themeColors}
            />
          )}
        </View>

        {/* Medication status banner */}
        {item.isMedication && medicationStatus !== 'pending' && (
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: medicationStatus === 'taken'
                  ? (themeColors.success ?? '#4CAF50') + '20'
                  : (themeColors.warning ?? '#FF9800') + '20',
                borderColor: medicationStatus === 'taken'
                  ? (themeColors.success ?? '#4CAF50')
                  : (themeColors.warning ?? '#FF9800'),
              },
            ]}
          >
            <Text style={styles.statusEmoji}>
              {medicationStatus === 'taken' ? '✓' : '⏭'}
            </Text>
            <Text style={[styles.statusText, { color: themeColors.textPrimary }]}>
              {medicationStatus === 'taken'
                ? t('modules.agenda.detail.markedTaken')
                : t('modules.agenda.detail.markedSkipped')}
            </Text>
          </View>
        )}

        {/* Medication actions */}
        {item.isMedication && medicationStatus === 'pending' && (
          <View style={styles.actionGroup}>
            <Text style={[styles.actionGroupTitle, { color: themeColors.textSecondary }]}>
              {t('modules.agenda.detail.medicationActions')}
            </Text>

            <HapticTouchable
              style={[styles.actionButton, { backgroundColor: themeColors.success ?? '#4CAF50' }]}
              onPress={handleMedicationTaken}
              accessibilityRole="button"
              accessibilityLabel={t('modules.agenda.detail.taken')}
            >
              <Text style={styles.actionEmoji}>✓</Text>
              <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
                {t('modules.agenda.detail.taken')}
              </Text>
            </HapticTouchable>

            <HapticTouchable
              style={[styles.actionButton, { backgroundColor: themeColors.warning ?? '#FF9800' }]}
              onPress={handleMedicationSkipped}
              accessibilityRole="button"
              accessibilityLabel={t('modules.agenda.detail.skipped')}
            >
              <Text style={styles.actionEmoji}>⏭</Text>
              <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
                {t('modules.agenda.detail.skipped')}
              </Text>
            </HapticTouchable>
          </View>
        )}

        {/* Standard actions */}
        <View style={styles.actionGroup}>
          {item.isMedication && medicationStatus === 'pending' && (
            <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
          )}

          <HapticTouchable
            style={[styles.outlineButton, { borderColor: accentColor.primary }]}
            onPress={handleEdit}
            accessibilityRole="button"
            accessibilityLabel={t('modules.agenda.detail.edit')}
          >
            <Text style={styles.outlineEmoji}>✏️</Text>
            <Text style={[styles.outlineButtonText, { color: accentColor.primary }]}>
              {t('modules.agenda.detail.edit')}
            </Text>
          </HapticTouchable>

          <HapticTouchable
            style={[styles.outlineButton, { borderColor: accentColor.primary }]}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel={t('modules.agenda.detail.share')}
          >
            <Text style={styles.outlineEmoji}>📤</Text>
            <Text style={[styles.outlineButtonText, { color: accentColor.primary }]}>
              {t('modules.agenda.detail.share')}
            </Text>
          </HapticTouchable>

          <HapticTouchable
            style={[styles.outlineButton, { borderColor: themeColors.error ?? colors.error }]}
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel={t('modules.agenda.detail.delete')}
          >
            <Text style={styles.outlineEmoji}>🗑️</Text>
            <Text style={[styles.outlineButtonText, { color: themeColors.error ?? colors.error }]}>
              {t('modules.agenda.detail.delete')}
            </Text>
          </HapticTouchable>
        </View>
      </ScrollView>

      {/* Recurring action modal */}
      <RecurringActionModal
        visible={recurringModal.visible}
        title={
          recurringModal.action === 'delete'
            ? t('modules.agenda.detail.deleteWhat')
            : t('modules.agenda.detail.editWhat')
        }
        onTodayOnly={handleTodayOnly}
        onAllFollowing={handleAllFollowing}
        onCancel={handleCancelRecurring}
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
    gap: spacing.lg,
  },

  // Info card
  infoCard: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 32,
  },
  infoEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  infoLabel: {
    ...typography.body,
    flex: 1,
  },

  // Status banner (medication taken/skipped)
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  statusEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  statusText: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },

  // Action groups
  actionGroup: {
    gap: spacing.md,
  },
  actionGroupTitle: {
    ...typography.label,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },

  // Medication action buttons (solid)
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.comfortable,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  actionEmoji: {
    fontSize: 18,
    color: colors.textOnPrimary,
  },
  actionButtonText: {
    ...typography.button,
    fontWeight: '700',
  },

  // Outline buttons (edit, share, delete)
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.comfortable,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  outlineEmoji: {
    fontSize: 18,
  },
  outlineButtonText: {
    ...typography.button,
    fontWeight: '600',
  },
});
