/**
 * AgendaScreen — Timeline overview for appointments, reminders & medication
 *
 * Senior-inclusive timeline with:
 * - Day-grouped items (Vandaag, Morgen, weekdays, Volgende week)
 * - Category icons + time + title + contact names
 * - Medication inline checkbox (visual only, Fase 4 for interaction)
 * - Expired items (today, past time) shown greyed out
 * - "Afgelopen bekijken" for past items
 * - "+ Nieuw item toevoegen" opens category picker (Fase 3)
 * - Large touch targets (60pt+), 18pt+ text
 *
 * @see contexts/AgendaContext.tsx for data source
 * @see constants/agendaCategories.ts for category definitions
 * @see .claude/plans/AGENDA_MODULE.md for full spec
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, ModuleHeader, HapticTouchable, LoadingView } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import {
  AgendaProvider,
  useAgendaContext,
  type TimelineDay,
  type TimelineItem,
  type CreateAgendaItemData,
} from '@/contexts/AgendaContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import type { AgendaCategory } from '@/constants/agendaCategories';
import { AgendaCategoryPickerScreen } from './AgendaCategoryPickerScreen';
import { AgendaItemFormScreen } from './AgendaItemFormScreen';

// ============================================================
// Constants
// ============================================================

const MODULE_ID = 'agenda';

// ============================================================
// TimelineItemRow — Individual agenda item
// ============================================================

interface TimelineItemRowProps {
  item: TimelineItem;
  isExpired: boolean;
  onPress: (item: TimelineItem) => void;
  moduleColor: string;
}

function TimelineItemRow({ item, isExpired, onPress, moduleColor }: TimelineItemRowProps) {
  const { t } = useTranslation();
  const themeColors = useColors();

  const textColor = isExpired ? themeColors.disabled : themeColors.textPrimary;
  const secondaryTextColor = isExpired ? themeColors.disabled : themeColors.textSecondary;

  // Build time display
  const timeDisplay = item.time ?? '';

  // Build subtitle (contact names or years-since info)
  let subtitle = '';
  if (item.contactNames.length > 0) {
    subtitle = item.contactNames.join(', ');
  }
  if (item.yearsSince != null && item.yearsSince > 0) {
    // e.g. "(78)" for birthday or "(45 jaar)" for wedding anniversary
    if (item.category === 'birthday') {
      subtitle = subtitle
        ? `${subtitle} (${item.yearsSince})`
        : `(${item.yearsSince})`;
    } else {
      subtitle = subtitle
        ? `${subtitle} (${item.yearsSince} ${t('modules.agenda.years')})`
        : `(${item.yearsSince} ${t('modules.agenda.years')})`;
    }
  }

  // Accessibility label
  const a11yParts = [item.icon, timeDisplay, item.title, subtitle].filter(Boolean);
  const a11yLabel = a11yParts.join(', ');

  return (
    <HapticTouchable
      style={[
        styles.itemRow,
        isExpired && styles.itemRowExpired,
      ]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      {/* Icon */}
      <Text style={[styles.itemIcon, isExpired && styles.itemIconExpired]}>
        {item.icon}
      </Text>

      {/* Time + Title + Subtitle */}
      <View style={styles.itemContent}>
        <View style={styles.itemTitleRow}>
          {timeDisplay ? (
            <Text
              style={[
                styles.itemTime,
                { color: secondaryTextColor },
                isExpired && styles.textExpired,
              ]}
            >
              {timeDisplay}
            </Text>
          ) : null}
          <Text
            style={[
              styles.itemTitle,
              { color: textColor },
              isExpired && styles.textExpired,
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
        </View>
        {subtitle ? (
          <Text
            style={[
              styles.itemSubtitle,
              { color: secondaryTextColor },
              isExpired && styles.textExpired,
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Medication checkbox placeholder (visual only in Fase 2) */}
      {item.isMedication && (
        <View style={styles.checkboxContainer}>
          <View style={[styles.checkbox, { borderColor: isExpired ? themeColors.disabled : moduleColor }]}>
            {/* Empty for now — Fase 4 adds toggle functionality */}
          </View>
        </View>
      )}
    </HapticTouchable>
  );
}

// ============================================================
// TimelineSectionView — Day header + items
// ============================================================

interface TimelineSectionProps {
  day: TimelineDay;
  onItemPress: (item: TimelineItem) => void;
  moduleColor: string;
}

function TimelineSectionView({ day, onItemPress, moduleColor }: TimelineSectionProps) {
  const themeColors = useColors();

  // Determine which items are expired (today, past their time)
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const isItemExpired = useCallback(
    (item: TimelineItem): boolean => {
      if (!day.isToday) return day.isPast;
      if (!item.time) return false; // All-day items are never "expired" during the day
      const [h, m] = item.time.split(':').map(Number);
      return h < currentHour || (h === currentHour && m <= currentMinute);
    },
    [day.isToday, day.isPast, currentHour, currentMinute],
  );

  return (
    <View style={styles.section}>
      {/* Day header */}
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionLine, { backgroundColor: themeColors.divider }]} />
        <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>
          {day.label}
        </Text>
        <View style={[styles.sectionLine, { backgroundColor: themeColors.divider }]} />
      </View>

      {/* Items */}
      {day.items.map((item) => (
        <TimelineItemRow
          key={item.id}
          item={item}
          isExpired={isItemExpired(item)}
          onPress={onItemPress}
          moduleColor={moduleColor}
        />
      ))}
    </View>
  );
}

// ============================================================
// AgendaScreenInner — Main content (inside provider)
// ============================================================

// ============================================================
// Internal navigation state
// ============================================================

type AgendaView =
  | { screen: 'timeline' }
  | { screen: 'categoryPicker' }
  | { screen: 'form'; category: AgendaCategory };

function AgendaScreenInner() {
  const { t } = useTranslation();
  const themeColors = useColors();
  const insets = useSafeAreaInsets();
  const { accentColor } = useAccentColor();
  const moduleColor = useModuleColor(MODULE_ID);
  const { timelineDays, pastItems, isLoading, refresh, createItem } = useAgendaContext();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPastItems, setShowPastItems] = useState(false);
  const [currentView, setCurrentView] = useState<AgendaView>({ screen: 'timeline' });

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  // Item tap — Fase 4 will open detail screen
  const handleItemPress = useCallback((item: TimelineItem) => {
    // TODO: Fase 4 — navigate to AgendaItemDetailScreen
    console.debug('[AgendaScreen] Item pressed:', item.id, item.category);
  }, []);

  // Past items toggle
  const handleTogglePastItems = useCallback(() => {
    setShowPastItems((prev) => !prev);
  }, []);

  // Add new item → open category picker
  const handleAddItem = useCallback(() => {
    setCurrentView({ screen: 'categoryPicker' });
  }, []);

  // Category selected → open form
  const handleCategorySelected = useCallback((category: AgendaCategory) => {
    setCurrentView({ screen: 'form', category });
  }, []);

  // Form saved → create item and return to timeline
  const handleFormSave = useCallback(async (data: CreateAgendaItemData) => {
    try {
      await createItem(data);
      setCurrentView({ screen: 'timeline' });
    } catch (error) {
      console.error('[AgendaScreen] Failed to create item:', error);
    }
  }, [createItem]);

  // Back navigation
  const handleBackToTimeline = useCallback(() => {
    setCurrentView({ screen: 'timeline' });
  }, []);

  const handleBackToCategoryPicker = useCallback(() => {
    setCurrentView({ screen: 'categoryPicker' });
  }, []);

  // Filter days with items
  const visibleDays = useMemo(
    () => timelineDays.filter((day) => day.items.length > 0),
    [timelineDays],
  );

  // ============================================================
  // Sub-screen rendering
  // ============================================================

  if (currentView.screen === 'categoryPicker') {
    return (
      <AgendaCategoryPickerScreen
        onSelectCategory={handleCategorySelected}
        onBack={handleBackToTimeline}
      />
    );
  }

  if (currentView.screen === 'form') {
    return (
      <AgendaItemFormScreen
        category={currentView.category}
        onSave={handleFormSave}
        onBack={handleBackToCategoryPicker}
      />
    );
  }

  // ============================================================
  // Timeline view (default)
  // ============================================================

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ModuleHeader
          moduleId={MODULE_ID}
          icon="calendar"
          title={t('modules.agenda.title')}
          showAdMob={false}
        />
        <LoadingView message={t('common.loading')} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ModuleHeader
        moduleId={MODULE_ID}
        icon="calendar"
        title={t('modules.agenda.title')}
        showAdMob={false}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={moduleColor}
          />
        }
      >
        {/* Empty state */}
        {visibleDays.length === 0 && pastItems.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
              {t('modules.agenda.emptyTitle')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
              {t('modules.agenda.emptySubtitle')}
            </Text>
          </View>
        )}

        {/* Timeline sections */}
        {visibleDays.map((day) => (
          <TimelineSectionView
            key={day.dateKey}
            day={day}
            onItemPress={handleItemPress}
            moduleColor={moduleColor}
          />
        ))}

        {/* Bottom buttons */}
        <View style={styles.bottomButtons}>
          {/* Past items button */}
          {pastItems.length > 0 && (
            <HapticTouchable
              style={[styles.secondaryButton, { borderColor: themeColors.border }]}
              onPress={handleTogglePastItems}
              accessibilityRole="button"
              accessibilityLabel={t('modules.agenda.viewPast')}
            >
              <Icon name="chevron-down" size={20} color={themeColors.textSecondary} />
              <Text style={[styles.secondaryButtonText, { color: themeColors.textSecondary }]}>
                {t('modules.agenda.viewPast')} ({pastItems.length})
              </Text>
            </HapticTouchable>
          )}

          {/* Past items list (expandable) */}
          {showPastItems && pastItems.length > 0 && (
            <View style={styles.pastItemsContainer}>
              {pastItems.slice(0, 20).map((item) => (
                <TimelineItemRow
                  key={item.id}
                  item={item}
                  isExpired={true}
                  onPress={handleItemPress}
                  moduleColor={moduleColor}
                />
              ))}
              {pastItems.length > 20 && (
                <Text style={[styles.moreItemsText, { color: themeColors.textSecondary }]}>
                  {t('modules.agenda.moreItems', { count: pastItems.length - 20 })}
                </Text>
              )}
            </View>
          )}

          {/* Add new item button */}
          <HapticTouchable
            style={[styles.addButton, { backgroundColor: accentColor.primary }]}
            onPress={handleAddItem}
            accessibilityRole="button"
            accessibilityLabel={t('modules.agenda.addItem')}
          >
            <Icon name="plus" size={24} color={colors.textOnPrimary} />
            <Text style={[styles.addButtonText, { color: colors.textOnPrimary }]}>
              {t('modules.agenda.addItem')}
            </Text>
          </HapticTouchable>
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================================
// AgendaScreen — Wrapped with provider
// ============================================================

export function AgendaScreen() {
  return (
    <AgendaProvider>
      <AgendaScreenInner />
    </AgendaProvider>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },

  // Section (day group)
  section: {
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },
  sectionLabel: {
    ...typography.label,
    fontWeight: '700',
  },

  // Timeline item row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  itemRowExpired: {
    opacity: 0.6,
  },
  itemIcon: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  itemIconExpired: {
    opacity: 0.5,
  },
  itemContent: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  itemTime: {
    ...typography.body,
    fontWeight: '600',
    minWidth: 50,
  },
  itemTitle: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
  },
  itemSubtitle: {
    ...typography.body,
    fontStyle: 'italic',
    marginLeft: 50 + spacing.sm, // Align with title (past the time column)
  },
  textExpired: {
    textDecorationLine: 'line-through',
  },

  // Medication checkbox
  checkboxContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: touchTargets.minimum,
    height: touchTargets.minimum,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: borderRadius.sm,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    ...typography.h3,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },

  // Bottom buttons
  bottomButtons: {
    marginTop: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.comfortable,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    ...typography.button,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.comfortable,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  addButtonText: {
    ...typography.button,
  },

  // Past items
  pastItemsContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.sm,
  },
  moreItemsText: {
    ...typography.body,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
