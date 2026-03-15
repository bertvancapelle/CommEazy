/**
 * AgendaScreen — Day-by-day agenda with action bar + search
 *
 * Senior-inclusive agenda redesign with:
 * - Action bar: [+ Nieuwe afspraak] left, [🔍] right (always visible)
 * - Date navigation: [◀] Vandaag, 10 mrt 2026 [▶] (day-by-day)
 * - Single day view with items for the selected date
 * - Contact display: first contact full name + "+N" indicator
 * - Route icon (🧭) on items with address → opens maps
 * - Search view: universal search across title, contacts, location, address
 *   with toggle for past items and fuzzy/contains matching
 * - Empty day state: "Dag zonder afspraken"
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
  Image,
  StyleSheet,
  RefreshControl,
  Modal,
  Linking,
  Platform,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, ModuleHeader, ModuleScreenLayout, HapticTouchable, LoadingView, SearchBar , ScrollViewWithIndicator} from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import {
  AgendaProvider,
  useAgendaContext,
  type TimelineItem,
  type CreateAgendaItemData,
} from '@/contexts/AgendaContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useAgendaNotifications } from '@/hooks/useAgendaNotifications';
import { AgendaItemFormScreen } from './AgendaItemFormScreen';
import { AgendaItemDetailScreen } from './AgendaItemDetailScreen';

// ============================================================
// Constants
// ============================================================

const MODULE_ID = 'agenda';
const WELCOME_SHOWN_KEY = 'agenda_welcome_shown';

// ============================================================
// Helpers
// ============================================================

/** Format a Date to a localized day label, e.g. "Vandaag, 10 mrt 2026" */
function formatDateLabel(date: Date, t: (key: string) => string): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((targetStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));

  const dateStr = date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (diffDays === 0) return `${t('modules.agenda.dayNav.today')}, ${dateStr}`;
  if (diffDays === 1) return `${t('modules.agenda.dayNav.tomorrow')}, ${dateStr}`;
  if (diffDays === -1) return `${t('modules.agenda.dayNav.yesterday')}, ${dateStr}`;

  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
  // Capitalize first letter
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalizedWeekday}, ${dateStr}`;
}

/** Format a date for search result display */
function formatSearchResultDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Open address in maps app */
function openInMaps(item: TimelineItem): void {
  const parts = [item.addressStreet, item.addressPostalCode, item.addressCity, item.addressCountry].filter(Boolean);
  if (parts.length === 0) return;

  const address = parts.join(', ');
  const encoded = encodeURIComponent(address);

  // Use Apple Maps on iOS (maps: scheme), Google Maps on Android
  const url = Platform.OS === 'ios'
    ? `maps:?q=${encoded}`
    : `geo:0,0?q=${encoded}`;

  Linking.openURL(url).catch(err =>
    console.warn('[AgendaScreen] Failed to open maps:', err),
  );
}

/** Check if an item has a navigable address */
function hasAddress(item: TimelineItem): boolean {
  return !!(item.addressStreet || item.addressCity);
}

// ============================================================
// TimelineItemRow — Individual agenda item (redesigned)
// ============================================================

interface TimelineItemRowProps {
  item: TimelineItem;
  isExpired: boolean;
  onPress: (item: TimelineItem) => void;
  moduleColor: string;
  showDate?: boolean;
}

function TimelineItemRow({ item, isExpired, onPress, moduleColor, showDate }: TimelineItemRowProps) {
  const { t } = useTranslation();
  const themeColors = useColors();

  const textColor = isExpired ? themeColors.disabled : themeColors.textPrimary;
  const secondaryTextColor = isExpired ? themeColors.disabled : themeColors.textSecondary;

  // Build time display
  const timeDisplay = item.time ?? '';

  // Build contact subtitle: first contact full name + "+N" for additional
  let contactSubtitle = '';
  if (item.contactNames.length === 1) {
    contactSubtitle = item.contactNames[0];
  } else if (item.contactNames.length > 1) {
    contactSubtitle = `${item.contactNames[0]} +${item.contactNames.length - 1}`;
  }

  // Years-since info
  if (item.yearsSince != null && item.yearsSince > 0) {
    const yearsSuffix = item.category === 'birthday'
      ? `(${item.yearsSince})`
      : `(${item.yearsSince} ${t('modules.agenda.years')})`;
    contactSubtitle = contactSubtitle
      ? `${contactSubtitle} ${yearsSuffix}`
      : yearsSuffix;
  }

  // Accessibility label
  const a11yParts = [
    item.icon,
    timeDisplay,
    item.title,
    contactSubtitle,
    hasAddress(item) ? t('modules.agenda.dayNav.routeA11y', { address: [item.addressStreet, item.addressCity].filter(Boolean).join(', ') }) : null,
  ].filter(Boolean);
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

      {/* Time + Title + Contact + Date (for search results) */}
      <View style={styles.itemContent}>
        {showDate && (
          <Text
            style={[styles.itemDate, { color: secondaryTextColor }]}
            numberOfLines={1}
          >
            {formatSearchResultDate(item.date)}
          </Text>
        )}
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
        {contactSubtitle ? (
          <View style={styles.itemSubtitleRow}>
            {/* Mini contact avatars */}
            {item.contactPhotoPaths.length > 0 && (
              <View style={styles.miniAvatarsRow}>
                {item.contactPhotoPaths.slice(0, 3).map((photoPath, idx) => (
                  photoPath ? (
                    <Image
                      key={idx}
                      source={{ uri: photoPath }}
                      style={[
                        styles.miniAvatar,
                        idx > 0 && styles.miniAvatarOverlap,
                        isExpired && styles.itemRowExpired,
                      ]}
                    />
                  ) : (
                    <View
                      key={idx}
                      style={[
                        styles.miniAvatarFallback,
                        idx > 0 && styles.miniAvatarOverlap,
                        { backgroundColor: moduleColor },
                        isExpired && styles.itemRowExpired,
                      ]}
                    />
                  )
                ))}
              </View>
            )}
            <Text
              style={[
                styles.itemSubtitle,
                { color: secondaryTextColor },
                isExpired && styles.textExpired,
              ]}
              numberOfLines={1}
            >
              {contactSubtitle}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Route icon for items with address */}
      {hasAddress(item) && (
        <HapticTouchable
          style={styles.routeButton}
          onPress={() => openInMaps(item)}
          accessibilityRole="button"
          accessibilityLabel={t('modules.agenda.dayNav.routeA11y', {
            address: [item.addressStreet, item.addressCity].filter(Boolean).join(', '),
          })}
        >
          <Text style={styles.routeIcon}>🧭</Text>
        </HapticTouchable>
      )}

      {/* Medication checkbox placeholder (visual only) */}
      {item.isMedication && (
        <View style={styles.checkboxContainer}>
          <View style={[styles.checkbox, { borderColor: isExpired ? themeColors.disabled : moduleColor }]} />
        </View>
      )}
    </HapticTouchable>
  );
}

// ============================================================
// AgendaScreenInner — Main content (inside provider)
// ============================================================

type AgendaView =
  | { screen: 'dayView' }
  | { screen: 'search' }
  | { screen: 'form'; editItem?: TimelineItem }
  | { screen: 'detail'; item: TimelineItem };

function AgendaScreenInner() {
  const { t } = useTranslation();
  const themeColors = useColors();
  const insets = useSafeAreaInsets();
  const { accentColor } = useAccentColor();
  const moduleColor = useModuleColor(MODULE_ID);
  const {
    timelineDays,
    pastItems,
    isLoading,
    refresh,
    createItem,
    updateItem,
    getItemsForDate,
    searchItems,
  } = useAgendaContext();

  // Activate notification scheduling
  useAgendaNotifications();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentView, setCurrentView] = useState<AgendaView>({ screen: 'dayView' });
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIncludePast, setSearchIncludePast] = useState(false);
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

  // Item tap → open detail screen
  const handleItemPress = useCallback((item: TimelineItem) => {
    setCurrentView({ screen: 'detail', item });
  }, []);

  // Add new item → open form directly (type + category are picker fields in the form)
  const handleAddItem = useCallback(() => {
    setCurrentView({ screen: 'form' });
  }, []);

  // Open search view
  const handleOpenSearch = useCallback(() => {
    setSearchQuery('');
    setSearchIncludePast(false);
    setCurrentView({ screen: 'search' });
  }, []);

  // Back from search to day view
  const handleBackFromSearch = useCallback(() => {
    setSearchQuery('');
    setCurrentView({ screen: 'dayView' });
  }, []);

  // Edit from detail
  const handleEditItem = useCallback((item: TimelineItem) => {
    setCurrentView({
      screen: 'form',
      editItem: item,
    });
  }, []);

  // Form saved
  const handleFormSave = useCallback(async (data: CreateAgendaItemData) => {
    try {
      const cv = currentView;
      if (cv.screen === 'form' && cv.editItem?.modelId) {
        await updateItem(cv.editItem.modelId, data);
      } else {
        await createItem(data);
      }
      setCurrentView({ screen: 'dayView' });
    } catch (error) {
      console.error('[AgendaScreen] Failed to save item:', error);
    }
  }, [currentView, createItem, updateItem]);

  // Back navigation
  const handleBackToTimeline = useCallback(() => {
    setCurrentView({ screen: 'dayView' });
  }, []);

  // Date navigation
  const handlePreviousDay = useCallback(() => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const handleNextDay = useCallback(() => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);

  // Items for the selected date
  const dayItems = useMemo(
    () => getItemsForDate(selectedDate),
    [getItemsForDate, selectedDate],
  );

  // Determine expired state for items on the selected day
  const now = new Date();
  const isSelectedDateToday = selectedDate.toDateString() === now.toDateString();
  const isSelectedDatePast = selectedDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const isItemExpired = useCallback(
    (item: TimelineItem): boolean => {
      if (isSelectedDatePast) return true;
      if (!isSelectedDateToday) return false;
      if (!item.time) return false;
      const [h, m] = item.time.split(':').map(Number);
      return h < now.getHours() || (h === now.getHours() && m <= now.getMinutes());
    },
    [isSelectedDatePast, isSelectedDateToday, now],
  );

  // Search results
  const searchResults = useMemo(
    () => searchItems(searchQuery, searchIncludePast),
    [searchItems, searchQuery, searchIncludePast],
  );

  // ============================================================
  // Sub-screen rendering
  // ============================================================

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
          category: currentView.editItem.category,
          formType: currentView.editItem.formType ?? undefined,
          categoryIcon: currentView.editItem.icon,
          categoryName: currentView.editItem.categoryName ?? undefined,
          title: currentView.editItem.title,
          date: currentView.editItem.date,
          time: currentView.editItem.time ?? undefined,
          times: currentView.editItem.times.length > 0 ? currentView.editItem.times : undefined,
          repeatType: currentView.editItem.repeatType ?? undefined,
          endDate: currentView.editItem.endDate ?? undefined,
          reminderOffset: currentView.editItem.reminderOffset,
          contactIds: currentView.editItem.contactIds,
          locationName: currentView.editItem.locationName ?? undefined,
          addressStreet: currentView.editItem.addressStreet ?? undefined,
          addressPostalCode: currentView.editItem.addressPostalCode ?? undefined,
          addressCity: currentView.editItem.addressCity ?? undefined,
          addressCountry: currentView.editItem.addressCountry ?? undefined,
        }
      : undefined;
    return (
      <AgendaItemFormScreen
        initialData={editData}
        onSave={handleFormSave}
        onBack={handleBackToTimeline}
      />
    );
  }

  // ============================================================
  // Consolidated layout — single ModuleScreenLayout
  // ============================================================

  const isSearchView = currentView.screen === 'search';

  const renderControlsBlock = () => {
    if (isLoading) return <></>;

    if (isSearchView) {
      return (
        <View style={styles.searchHeader}>
          <HapticTouchable
            style={[styles.backButton, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}
            onPress={handleBackFromSearch}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Icon name="chevron-left" size={24} color={themeColors.textPrimary} />
            <Text style={[styles.backButtonText, { color: themeColors.textPrimary }]}>
              {t('common.back')}
            </Text>
          </HapticTouchable>
        </View>
      );
    }

    // Day view controls
    return (
      <>
        {/* Action bar: [+ Nieuwe afspraak] ... [🔍] */}
        <View style={styles.actionBar}>
          <HapticTouchable
            style={[styles.actionButton, { backgroundColor: accentColor.primary }]}
            onPress={handleAddItem}
            accessibilityRole="button"
            accessibilityLabel={t('modules.agenda.addItem')}
          >
            <Icon name="plus" size={22} color={colors.textOnPrimary} />
            <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
              {t('modules.agenda.addItem')}
            </Text>
          </HapticTouchable>

          <HapticTouchable
            style={[styles.searchButton, { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: themeColors.border, borderWidth: 1 }]}
            onPress={handleOpenSearch}
            accessibilityRole="button"
            accessibilityLabel={t('common.search')}
          >
            <Icon name="search" size={24} color={themeColors.textPrimary} />
          </HapticTouchable>
        </View>

        {/* Date navigation bar: [◀] Label [▶] */}
        <View style={[styles.dateNavBar, { borderBottomColor: themeColors.divider }]}>
          <HapticTouchable
            style={styles.dateNavArrow}
            onPress={handlePreviousDay}
            accessibilityRole="button"
            accessibilityLabel={t('modules.agenda.dayNav.previousDay')}
          >
            <Icon name="chevron-left" size={28} color={themeColors.textPrimary} />
          </HapticTouchable>

          <Text
            style={[styles.dateNavLabel, { color: themeColors.textPrimary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {formatDateLabel(selectedDate, t)}
          </Text>

          <HapticTouchable
            style={styles.dateNavArrow}
            onPress={handleNextDay}
            accessibilityRole="button"
            accessibilityLabel={t('modules.agenda.dayNav.nextDay')}
          >
            <Icon name="chevron-right" size={28} color={themeColors.textPrimary} />
          </HapticTouchable>
        </View>
      </>
    );
  };

  const renderContentBlock = () => {
    if (isLoading) {
      return <LoadingView message={t('common.loading')} />;
    }

    if (isSearchView) {
      return (
        <ScrollViewWithIndicator
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search bar */}
          <View style={styles.searchBarContainer}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmit={() => {}}
              placeholder={t('modules.agenda.search.universalPlaceholder')}
              searchButtonLabel={t('common.search')}
            />
          </View>

          {/* Past toggle */}
          <View style={styles.pastToggleRow}>
            <Text style={[styles.pastToggleLabel, { color: themeColors.textPrimary }]}>
              {t('modules.agenda.search.includePast')}
            </Text>
            <Switch
              value={searchIncludePast}
              onValueChange={setSearchIncludePast}
              trackColor={{ false: themeColors.border, true: moduleColor }}
              accessibilityLabel={t('modules.agenda.search.includePast')}
            />
          </View>

          {/* Search results */}
          {searchQuery.trim() ? (
            searchResults.length > 0 ? (
              <View style={styles.searchResultsContainer}>
                {searchResults.map((item) => (
                  <TimelineItemRow
                    key={item.id}
                    item={item}
                    isExpired={item.date < Date.now()}
                    onPress={handleItemPress}
                    moduleColor={moduleColor}
                    showDate
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                  {t('modules.agenda.search.noResults')}
                </Text>
              </View>
            )
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
                {t('modules.agenda.search.universalPlaceholder')}
              </Text>
            </View>
          )}
        </ScrollViewWithIndicator>
      );
    }

    // Day view content
    return (
      <>
        <ScrollViewWithIndicator
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
          {dayItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                {t('modules.agenda.emptyDay')}
              </Text>
            </View>
          ) : (
            dayItems.map((item) => (
              <TimelineItemRow
                key={item.id}
                item={item}
                isExpired={isItemExpired(item)}
                onPress={handleItemPress}
                moduleColor={moduleColor}
              />
            ))
          )}
        </ScrollViewWithIndicator>

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
              <HapticTouchable hapticDisabled
                style={[styles.welcomeButton, { backgroundColor: accentColor.primary }]}
                onPress={handleWelcomeDismiss}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('modules.agenda.welcome.understood')}
              >
                <Text style={[styles.welcomeButtonText, { color: colors.textOnPrimary }]}>
                  {t('modules.agenda.welcome.understood')}
                </Text>
              </HapticTouchable>
            </View>
          </View>
        </Modal>
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ModuleScreenLayout
        moduleId={MODULE_ID}
        moduleBlock={
          <ModuleHeader
            moduleId={MODULE_ID}
            icon="calendar"
            title={t('modules.agenda.title')}
            skipSafeArea
          />
        }
        controlsBlock={renderControlsBlock()}
        contentBlock={renderContentBlock()}
      />
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

  // Action bar
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    flex: 1,
  },
  actionButtonText: {
    ...typography.button,
  },
  searchButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Date navigation bar
  dateNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
  },
  dateNavArrow: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavLabel: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },

  // Search header
  searchHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    ...typography.button,
  },

  // Search
  searchBarContainer: {
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  pastToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
  },
  pastToggleLabel: {
    ...typography.body,
    flex: 1,
  },
  searchResultsContainer: {
    marginTop: spacing.sm,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
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
  itemDate: {
    ...typography.label,
    fontWeight: '600',
    marginBottom: 2,
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
  itemSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 50 + spacing.sm,
    gap: spacing.xs,
  },
  miniAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'white',
  },
  miniAvatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarOverlap: {
    marginLeft: -8,
  },
  itemSubtitle: {
    ...typography.body,
    fontStyle: 'italic',
    flexShrink: 1,
  },
  textExpired: {
    textDecorationLine: 'line-through',
  },

  // Route button
  routeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeIcon: {
    fontSize: 24,
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
