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

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, ModuleHeader, HapticTouchable, LoadingView, SearchBar } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import {
  AgendaProvider,
  useAgendaContext,
  type TimelineItem,
  type TimelineDay,
  type CreateAgendaItemData,
} from '@/contexts/AgendaContext';
import { getCategoryById, type AgendaCategory } from '@/constants/agendaCategories';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useAgendaNotifications } from '@/hooks/useAgendaNotifications';
import { AgendaCategoryPickerScreen } from './AgendaCategoryPickerScreen';
import { AgendaItemFormScreen } from './AgendaItemFormScreen';
import { AgendaItemDetailScreen } from './AgendaItemDetailScreen';

// ============================================================
// Constants
// ============================================================

const MODULE_ID = 'agenda';
const WELCOME_SHOWN_KEY = 'agenda_welcome_shown';

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
  | { screen: 'form'; category: AgendaCategory; editItem?: TimelineItem }
  | { screen: 'detail'; item: TimelineItem };

function AgendaScreenInner() {
  const { t } = useTranslation();
  const themeColors = useColors();
  const insets = useSafeAreaInsets();
  const { accentColor } = useAccentColor();
  const moduleColor = useModuleColor(MODULE_ID);
  const { timelineDays, pastItems, isLoading, refresh, createItem, updateItem } = useAgendaContext();

  // Activate notification scheduling — auto-reschedules on timeline changes
  useAgendaNotifications();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPastItems, setShowPastItems] = useState(false);
  const [currentView, setCurrentView] = useState<AgendaView>({ screen: 'timeline' });
  const [activeTab, setActiveTab] = useState<'overview' | 'search'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

  // Welcome modal for first-time users
  useEffect(() => {
    AsyncStorage.getItem(WELCOME_SHOWN_KEY).then((value) => {
      if (!value) setShowWelcome(true);
    });
  }, []);

  const handleWelcomeDismiss = useCallback(async () => {
    setShowWelcome(false);
    await AsyncStorage.setItem(WELCOME_SHOWN_KEY, 'true');
  }, []);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  // Item tap — open detail screen
  const handleItemPress = useCallback((item: TimelineItem) => {
    setCurrentView({ screen: 'detail', item });
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

  // Edit from detail — open form pre-filled
  const handleEditItem = useCallback((item: TimelineItem) => {
    setCurrentView({
      screen: 'form',
      category: item.category,
      editItem: item,
    });
  }, []);

  // Form saved → create or update item and return to timeline
  const handleFormSave = useCallback(async (data: CreateAgendaItemData) => {
    try {
      // Check if we are editing an existing item
      const cv = currentView;
      if (cv.screen === 'form' && cv.editItem?.modelId) {
        await updateItem(cv.editItem.modelId, data);
      } else {
        await createItem(data);
      }
      setCurrentView({ screen: 'timeline' });
    } catch (error) {
      console.error('[AgendaScreen] Failed to save item:', error);
    }
  }, [currentView, createItem, updateItem]);

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

  // Search: filter all items by query (local filtering)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { upcoming: [], past: [] };

    const query = searchQuery.toLowerCase().trim();
    const now = Date.now();

    // Collect all items from timeline + past
    const allItems: TimelineItem[] = [];
    for (const day of timelineDays) {
      allItems.push(...day.items);
    }
    allItems.push(...pastItems);

    // Filter by title, contact names, or category label
    const filtered = allItems.filter((item) => {
      if (item.title.toLowerCase().includes(query)) return true;
      if (item.contactNames.some(n => n.toLowerCase().includes(query))) return true;
      // Match category label
      const catDef = getCategoryById(item.category);
      if (catDef) {
        const catLabel = t(catDef.labelKey).toLowerCase();
        if (catLabel.includes(query)) return true;
      }
      return false;
    });

    // Split into upcoming and past
    const upcoming = filtered.filter(item => item.date >= now).sort((a, b) => a.date - b.date);
    const past = filtered.filter(item => item.date < now).sort((a, b) => b.date - a.date);

    return { upcoming, past };
  }, [searchQuery, timelineDays, pastItems, t]);

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

  if (currentView.screen === 'detail') {
    return (
      <AgendaItemDetailScreen
        item={currentView.item}
        onBack={handleBackToTimeline}
        onEdit={handleEditItem}
      />
    );
  }

  if (currentView.screen === 'form') {
    const editData = currentView.editItem
      ? {
          title: currentView.editItem.title,
          date: currentView.editItem.date,
          time: currentView.editItem.time ?? undefined,
          times: currentView.editItem.times.length > 0 ? currentView.editItem.times : undefined,
          repeatType: currentView.editItem.repeatType ?? undefined,
          endDate: currentView.editItem.endDate ?? undefined,
          reminderOffset: currentView.editItem.reminderOffset,
          contactIds: currentView.editItem.contactIds,
        }
      : undefined;
    return (
      <AgendaItemFormScreen
        category={currentView.category}
        initialData={editData}
        onSave={handleFormSave}
        onBack={currentView.editItem ? handleBackToTimeline : handleBackToCategoryPicker}
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

      {/* Tab bar: Overzicht / Zoeken */}
      <View style={[styles.tabBar, { borderBottomColor: themeColors.divider }]}>
        <HapticTouchable
          style={[
            styles.tab,
            activeTab === 'overview' && [styles.tabActive, { borderBottomColor: moduleColor }],
          ]}
          onPress={() => { setActiveTab('overview'); setSearchQuery(''); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'overview' }}
          accessibilityLabel={t('modules.agenda.search.tabOverview')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'overview' ? moduleColor : themeColors.textSecondary },
          ]}>
            📋 {t('modules.agenda.search.tabOverview')}
          </Text>
        </HapticTouchable>
        <HapticTouchable
          style={[
            styles.tab,
            activeTab === 'search' && [styles.tabActive, { borderBottomColor: moduleColor }],
          ]}
          onPress={() => setActiveTab('search')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'search' }}
          accessibilityLabel={t('modules.agenda.search.tabSearch')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'search' ? moduleColor : themeColors.textSecondary },
          ]}>
            🔍 {t('modules.agenda.search.tabSearch')}
          </Text>
        </HapticTouchable>
      </View>

      {/* Search tab content */}
      {activeTab === 'search' ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.searchBarContainer}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmit={() => {}}
              placeholder={t('modules.agenda.search.placeholder')}
              searchButtonLabel={t('modules.agenda.search.tabSearch')}
            />
          </View>

          {/* Search results */}
          {searchQuery.trim() ? (
            <>
              {/* Upcoming section */}
              {searchResults.upcoming.length > 0 && (
                <View style={styles.searchSection}>
                  <Text style={[styles.searchSectionLabel, { color: themeColors.textSecondary }]}>
                    {t('modules.agenda.search.sectionUpcoming')}
                  </Text>
                  {searchResults.upcoming.map((item) => (
                    <TimelineItemRow
                      key={item.id}
                      item={item}
                      isExpired={false}
                      onPress={handleItemPress}
                      moduleColor={moduleColor}
                    />
                  ))}
                </View>
              )}

              {/* Past section */}
              {searchResults.past.length > 0 && (
                <View style={styles.searchSection}>
                  <Text style={[styles.searchSectionLabel, { color: themeColors.textSecondary }]}>
                    {t('modules.agenda.search.sectionPast')}
                  </Text>
                  {searchResults.past.map((item) => (
                    <TimelineItemRow
                      key={item.id}
                      item={item}
                      isExpired={true}
                      onPress={handleItemPress}
                      moduleColor={moduleColor}
                    />
                  ))}
                </View>
              )}

              {/* No results */}
              {searchResults.upcoming.length === 0 && searchResults.past.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                    {t('modules.agenda.search.noResults')}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
                {t('modules.agenda.search.placeholder')}
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* Overview tab content */
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
      )}

      {/* Welcome Modal */}
      <Modal
        visible={showWelcome}
        animationType="fade"
        transparent
        onRequestClose={handleWelcomeDismiss}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.welcomeModal, { backgroundColor: themeColors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            {/* Header */}
            <View style={[styles.welcomeHeader, { backgroundColor: moduleColor }]}>
              <Icon name="calendar" size={48} color={colors.textOnPrimary} />
              <Text style={[styles.welcomeTitle, { color: colors.textOnPrimary }]}>
                {t('modules.agenda.title')}
              </Text>
            </View>

            {/* Steps */}
            <View style={styles.welcomeContent}>
              <View style={styles.welcomeStep}>
                <View style={[styles.stepNumber, { backgroundColor: accentColor.primary }]}>
                  <Text style={[styles.stepNumberText, { color: colors.textOnPrimary }]}>1</Text>
                </View>
                <Text style={[styles.stepText, { color: themeColors.textPrimary }]}>
                  {t('modules.agenda.welcome.step1')}
                </Text>
              </View>

              <View style={styles.welcomeStep}>
                <View style={[styles.stepNumber, { backgroundColor: accentColor.primary }]}>
                  <Text style={[styles.stepNumberText, { color: colors.textOnPrimary }]}>2</Text>
                </View>
                <Text style={[styles.stepText, { color: themeColors.textPrimary }]}>
                  {t('modules.agenda.welcome.step2')}
                </Text>
              </View>

              <View style={styles.welcomeStep}>
                <View style={[styles.stepNumber, { backgroundColor: accentColor.primary }]}>
                  <Text style={[styles.stepNumberText, { color: colors.textOnPrimary }]}>3</Text>
                </View>
                <Text style={[styles.stepText, { color: themeColors.textPrimary }]}>
                  {t('modules.agenda.welcome.step3')}
                </Text>
              </View>
            </View>

            {/* Button */}
            <TouchableOpacity
              style={[styles.welcomeButton, { backgroundColor: accentColor.primary }]}
              onPress={handleWelcomeDismiss}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('modules.agenda.welcome.understood')}
            >
              <Text style={[styles.welcomeButtonText, { color: colors.textOnPrimary }]}>
                {t('modules.agenda.welcome.understood')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    // borderBottomColor set dynamically
  },
  tabText: {
    ...typography.body,
    fontWeight: '700',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },

  // Search
  searchBarContainer: {
    paddingTop: spacing.md,
    marginBottom: spacing.sm,
  },
  searchSection: {
    marginTop: spacing.md,
  },
  searchSectionLabel: {
    ...typography.label,
    fontWeight: '700',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
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

  // Welcome modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  welcomeModal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    overflow: 'hidden',
  },
  welcomeHeader: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  welcomeTitle: {
    ...typography.h2,
    color: colors.textOnPrimary,
    textAlign: 'center',
  },
  welcomeContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  welcomeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  stepText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  welcomeButton: {
    margin: spacing.lg,
    marginTop: 0,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  welcomeButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
});
