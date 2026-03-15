/**
 * ContactListScreen — Alphabetical list of all contacts
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Large photo for easy recognition
 * - Large name text (h3)
 * - Minimal visual elements (photo + name only)
 * - VoiceOver support
 * - Voice Session Mode navigation (see Voice Control section)
 *
 * Voice Control (VERPLICHT voor lijsten >3 items):
 * - "volgende"/"vorige" navigeert door de lijst
 * - "Oma" focust direct op contact "Oma" (fuzzy matching)
 * - "Letter M" springt naar eerste contact met M
 * - "open" selecteert het gefocuste contact
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { ContactAvatar, LoadingView, Icon, ModuleHeader, ModuleScreenLayout, SearchBar, ContactGroupChipBar, ContactGroupActionsBar, HapticTouchable , ScrollViewWithIndicator} from '@/components';
import type { ChipId } from '@/components';
import { VoiceFocusable } from '@/components/VoiceFocusable';
import { useVoiceFocusList, type VoiceFocusableItem } from '@/contexts/VoiceFocusContext';
import { useVisualPresence } from '@/contexts/PresenceContext';
import { useFeedback } from '@/hooks/useFeedback';
import { useContactGroups } from '@/hooks/useContactGroups';
import { ServiceContainer } from '@/services/container';
import { type Contact, getContactDisplayName } from '@/services/interfaces';
import { getSmartSections, getCallFrequency } from '@/services/contacts';
import type { SmartSection, ContactGroup } from '@/services/contacts';
import type { ContactStackParams } from '@/navigation';
import {
  STANDARD_CATEGORIES,
  CUSTOM_CATEGORIES_STORAGE_KEY,
  type AgendaCategoryDef,
  type CustomCategory,
} from '@/constants/agendaCategories';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CreateGroupModal } from './CreateGroupModal';
import { EditGroupModal } from './EditGroupModal';

type NavigationProp = NativeStackNavigationProp<ContactStackParams, 'ContactList'>;

/** Contact row with real presence via PresenceContext */
function ContactListItem({
  contact,
  index,
  onPress,
}: {
  contact: Contact;
  index: number;
  onPress: (contact: Contact) => void;
}) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const presence = useVisualPresence(contact.jid);

  const displayName = getContactDisplayName(contact);

  return (
    <VoiceFocusable
      key={contact.jid}
      id={contact.jid}
      label={displayName}
      index={index}
      onSelect={() => onPress(contact)}
    >
      <HapticTouchable hapticDisabled
        style={[styles.contactItem, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.divider }]}
        onPress={() => onPress(contact)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={displayName}
        accessibilityHint={t('accessibility.openContact', { name: displayName })}
      >
        {/* Profile photo with presence dot */}
        <ContactAvatar
          name={displayName}
          photoUrl={contact.photoUrl}
          size={60}
          presence={presence}
        />

        {/* Name - large and clear */}
        <Text
          style={[styles.contactName, { color: themeColors.textPrimary }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayName}
        </Text>

        {/* Chevron indicator */}
        <Text style={[styles.chevron, { color: themeColors.textTertiary }]}>›</Text>
      </HapticTouchable>
    </VoiceFocusable>
  );
}

export function ContactListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { triggerFeedback } = useFeedback();
  const themeColors = useColors();
  const isFocused = useIsFocused(); // Track if this screen is focused
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Contact groups state
  const [selectedChipId, setSelectedChipId] = useState<ChipId>('all');
  const [callFrequency, setCallFrequency] = useState<Record<string, number>>({});
  const { groups, create, rename, updateEmoji, addContacts, removeContacts, remove: deleteGroup } = useContactGroups();

  // Category filter state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  // Group CRUD modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);

  // Voice focus navigation handler
  const handleContactPress = useCallback(
    (contact: Contact) => {
      void triggerFeedback('tap');
      navigation.navigate('ContactDetail', { jid: contact.jid });
    },
    [navigation, triggerFeedback]
  );

  // Build voice focusable items from filtered contacts
  // IMPORTANT: Only provide items when screen is focused to prevent
  // registering the list when user is on a different tab
  const voiceFocusItems: VoiceFocusableItem[] = useMemo(() => {
    console.log(`[ContactListScreen] voiceFocusItems memo - isFocused: ${isFocused}, contacts: ${filteredContacts.length}`);
    if (!isFocused) {
      // Screen not focused - return empty array to prevent registration
      console.log('[ContactListScreen] Screen not focused, returning empty items');
      return [];
    }
    return filteredContacts.map((contact, index) => ({
      id: contact.jid,
      label: getContactDisplayName(contact), // Human-readable name for voice matching
      index,
      onSelect: () => handleContactPress(contact),
    }));
  }, [filteredContacts, handleContactPress, isFocused]);

  // Register list for voice focus navigation
  // VoiceFocusable components handle their own focus styling
  const { scrollRef } = useVoiceFocusList(
    'contact-list',
    voiceFocusItems
  );

  /** Parse category IDs from a contact's categories JSON string */
  const getContactCategoryIds = useCallback((contact: Contact): string[] => {
    if (!contact.categories) return [];
    try {
      return JSON.parse(contact.categories);
    } catch {
      return [];
    }
  }, []);

  /** Categories that are actually used by at least one contact (standard + custom) */
  const usedCategories: AgendaCategoryDef[] = useMemo(() => {
    const usedIds = new Set<string>();
    for (const contact of contacts) {
      for (const catId of getContactCategoryIds(contact)) {
        usedIds.add(catId);
      }
    }
    const standardUsed = STANDARD_CATEGORIES.filter(cat => usedIds.has(cat.id));
    const customUsed: AgendaCategoryDef[] = customCategories
      .filter(cat => usedIds.has(cat.id))
      .map(cat => ({
        id: cat.id,
        icon: cat.icon,
        name: cat.name,
        isStandard: false,
        defaultFormType: cat.formType,
        isAutomatic: false,
      }));
    return [...standardUsed, ...customUsed];
  }, [contacts, getContactCategoryIds, customCategories]);

  // Load contacts from WatermelonDB (single source of truth for all modes)
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const contactList = await ServiceContainer.database.getContactsOnce();
        const sorted = [...contactList].sort((a, b) =>
          getContactDisplayName(a).localeCompare(getContactDisplayName(b), undefined, { sensitivity: 'base' })
        );
        setContacts(sorted);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load contacts:', error);
        setContacts([]);
        setLoading(false);
      }
    };
    void loadContacts();
  }, []);

  // Load custom categories from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY).then(json => {
      if (json) {
        try { setCustomCategories(JSON.parse(json)); } catch { /* ignore */ }
      }
    });
  }, []);

  // Compute smart sections from contacts (memoized for performance)
  const smartSections: SmartSection[] = useMemo(() => {
    if (contacts.length === 0) return [];
    return getSmartSections(contacts, callFrequency);
  }, [contacts, callFrequency]);

  // Load call frequency data
  useEffect(() => {
    getCallFrequency().then(setCallFrequency).catch(() => {});
  }, []);

  // Filter contacts by chip selection + category + search query
  useEffect(() => {
    let base = contacts;

    // Apply chip filter first
    if (selectedChipId !== 'all') {
      if (selectedChipId.startsWith('smart:')) {
        const sectionId = selectedChipId.replace('smart:', '');
        const section = smartSections.find(s => s.id === sectionId);
        if (section) {
          const sectionJids = new Set(section.contacts.map(c => c.jid));
          base = contacts.filter(c => sectionJids.has(c.jid));
        }
      } else if (selectedChipId.startsWith('group:')) {
        const groupId = selectedChipId.replace('group:', '');
        const group = groups.find(g => g.id === groupId);
        if (group) {
          const groupJids = new Set(group.contactJids);
          base = contacts.filter(c => groupJids.has(c.jid));
        }
      }
    }

    // Apply category filter
    if (selectedCategoryId) {
      base = base.filter(c => getContactCategoryIds(c).includes(selectedCategoryId));
    }

    // Apply search filter on top
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      base = base.filter(
        (c) =>
          getContactDisplayName(c).toLowerCase().includes(query) ||
          c.firstName.toLowerCase().includes(query) ||
          c.lastName.toLowerCase().includes(query) ||
          (c.phoneNumber?.includes(query) ?? false)
      );
    }

    setFilteredContacts(base);
  }, [searchQuery, contacts, selectedChipId, smartSections, groups, selectedCategoryId, getContactCategoryIds]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Contacts are observable, so just wait a moment
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleAddContact = useCallback(() => {
    void triggerFeedback('tap');
    navigation.navigate('AddContact' as never);
  }, [navigation, triggerFeedback]);

  // Open create group modal
  const handleCreateGroup = useCallback(() => {
    void triggerFeedback('tap');
    setShowCreateModal(true);
  }, [triggerFeedback]);

  // Handle group creation from modal
  const handleGroupCreated = useCallback(async (name: string, emoji: string | undefined, contactJids: string[]) => {
    const newGroup = await create(name, emoji, contactJids);
    if (newGroup) {
      setSelectedChipId(`group:${newGroup.id}` as ChipId);
    }
    setShowCreateModal(false);
  }, [create]);

  // Open edit group modal (long-press on group chip)
  const handleLongPressGroup = useCallback((groupId: string) => {
    void triggerFeedback('tap');
    const group = groups.find(g => g.id === groupId);
    if (group) {
      setEditingGroup(group);
      setShowEditModal(true);
    }
  }, [groups, triggerFeedback]);

  // Edit modal callbacks
  const handleEditRename = useCallback(async (groupId: string, newName: string) => {
    await rename(groupId, newName);
  }, [rename]);

  const handleEditChangeEmoji = useCallback(async (groupId: string, emoji: string | undefined) => {
    if (emoji) {
      await updateEmoji(groupId, emoji);
    }
  }, [updateEmoji]);

  const handleEditUpdateMembers = useCallback(async (groupId: string, addJids: string[], removeJids: string[]) => {
    if (addJids.length > 0) await addContacts(groupId, addJids);
    if (removeJids.length > 0) await removeContacts(groupId, removeJids);
  }, [addContacts, removeContacts]);

  const handleEditDelete = useCallback(async (groupId: string) => {
    await deleteGroup(groupId);
    setSelectedChipId('all');
    setShowEditModal(false);
    setEditingGroup(null);
  }, [deleteGroup]);

  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingGroup(null);
  }, []);

  // Compute selected group/section label for accessibility
  const selectedGroupLabel = useMemo(() => {
    if (selectedChipId === 'all') return '';
    if (selectedChipId.startsWith('smart:')) {
      const sectionId = selectedChipId.replace('smart:', '');
      const section = smartSections.find(s => s.id === sectionId);
      return section ? t(section.labelKey, sectionId) : sectionId;
    }
    if (selectedChipId.startsWith('group:')) {
      const groupId = selectedChipId.replace('group:', '');
      const group = groups.find(g => g.id === groupId);
      return group?.name ?? groupId;
    }
    return '';
  }, [selectedChipId, smartSections, groups, t]);

  // Group action handlers — operate on filteredContacts (current visible group members)
  const handleGroupSendPhoto = useCallback(() => {
    void triggerFeedback('tap');
    // TODO: Open PhotoRecipientModal with filteredContacts pre-selected
    console.info('[ContactListScreen] Send photo to group:', selectedGroupLabel, filteredContacts.length, 'contacts');
  }, [triggerFeedback, selectedGroupLabel, filteredContacts]);

  const handleGroupSendMessage = useCallback(() => {
    void triggerFeedback('tap');
    // TODO: Navigate to group chat with filteredContacts
    console.info('[ContactListScreen] Send message to group:', selectedGroupLabel, filteredContacts.length, 'contacts');
  }, [triggerFeedback, selectedGroupLabel, filteredContacts]);

  const handleGroupSendMail = useCallback(() => {
    void triggerFeedback('tap');
    // TODO: Navigate to MailComposeScreen with filteredContacts as recipients
    console.info('[ContactListScreen] Send mail to group:', selectedGroupLabel, filteredContacts.length, 'contacts');
  }, [triggerFeedback, selectedGroupLabel, filteredContacts]);

  const handleGroupCallMember = useCallback(() => {
    void triggerFeedback('tap');
    // TODO: Show contact picker modal → initiate 1-on-1 call
    console.info('[ContactListScreen] Call member from group:', selectedGroupLabel, filteredContacts.length, 'contacts');
  }, [triggerFeedback, selectedGroupLabel, filteredContacts]);

  const renderContactItem = useCallback(
    (item: Contact, index: number) => (
      <ContactListItem
        key={item.jid}
        contact={item}
        index={index}
        onPress={handleContactPress}
      />
    ),
    [handleContactPress]
  );

  const renderEmptyList = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>{t('contacts.noContacts')}</Text>
        <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>{t('contacts.noContactsHint')}</Text>
        <HapticTouchable hapticDisabled
          style={[styles.addButton, { backgroundColor: themeColors.primary }]}
          onPress={handleAddContact}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.addButton')}
        >
          <Text style={[styles.addButtonText, { color: themeColors.textOnPrimary }]}>{t('contacts.addButton')}</Text>
        </HapticTouchable>
      </View>
    ),
    [t, handleAddContact, themeColors]
  );

  if (loading) {
    return <LoadingView fullscreen message={t('common.loading')} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ModuleScreenLayout
        moduleId="contacts"
        moduleBlock={
          <ModuleHeader
            moduleId="contacts"
            icon="contacts"
            title={t('tabs.contacts')}
            skipSafeArea
          />
        }
        controlsBlock={
          <>
            {/* Contact group chip bar — smart sections + manual groups */}
            <ContactGroupChipBar
              selectedChipId={selectedChipId}
              smartSections={smartSections}
              groups={groups}
              onSelectChip={setSelectedChipId}
              onCreateGroup={handleCreateGroup}
              onLongPressGroup={handleLongPressGroup}
            />

            {/* Search bar — standardized SearchBar component */}
            <View style={styles.searchContainer}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmit={() => {}} // Live filter — no explicit submit needed
                placeholder={t('contacts.searchPlaceholder')}
                searchButtonLabel={t('contacts.searchButton')}
              />
            </View>

            {/* Category filter chips — horizontal scroll */}
            {usedCategories.length > 0 && (
              <View style={[styles.categoryFilterContainer, { borderBottomColor: themeColors.divider }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryFilterContent}
                >
                  {/* "Alle" chip */}
                  <HapticTouchable
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: selectedCategoryId === null ? themeColors.primary : themeColors.surface,
                        borderColor: selectedCategoryId === null ? themeColors.primary : themeColors.border,
                      },
                    ]}
                    onPress={() => setSelectedCategoryId(null)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedCategoryId === null }}
                    accessibilityLabel={t('contacts.categories.filterAll', 'Alle')}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: selectedCategoryId === null ? themeColors.textOnPrimary : themeColors.textPrimary },
                      ]}
                    >
                      {t('contacts.categories.filterAll', 'Alle')}
                    </Text>
                  </HapticTouchable>

                  {/* Category chips */}
                  {usedCategories.map(cat => {
                    const isActive = selectedCategoryId === cat.id;
                    return (
                      <HapticTouchable
                        key={cat.id}
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor: isActive ? themeColors.primary : themeColors.surface,
                            borderColor: isActive ? themeColors.primary : themeColors.border,
                          },
                        ]}
                        onPress={() => setSelectedCategoryId(isActive ? null : cat.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                        accessibilityLabel={t(cat.name)}
                      >
                        <Text style={styles.categoryChipEmoji}>{cat.icon}</Text>
                        <Text
                          style={[
                            styles.categoryChipText,
                            { color: isActive ? themeColors.textOnPrimary : themeColors.textPrimary },
                          ]}
                        >
                          {t(cat.name)}
                        </Text>
                      </HapticTouchable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </>
        }
        contentBlock={
          <>
            {/* Contact list with voice focus navigation */}
            <ScrollViewWithIndicator
              ref={scrollRef}
              contentContainerStyle={
                filteredContacts.length === 0 ? styles.emptyListContent : undefined
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={themeColors.primary}
                />
              }
              showsVerticalScrollIndicator={false}
              accessibilityLabel={t('accessibility.contactList', { count: filteredContacts.length })}
            >
              {filteredContacts.length === 0 ? (
                renderEmptyList()
              ) : (
                filteredContacts.map((contact, index) => renderContactItem(contact, index))
              )}
            </ScrollViewWithIndicator>

            {/* Group actions bar — visible when a group/smart section is selected */}
            {selectedChipId !== 'all' && filteredContacts.length > 0 && (
              <ContactGroupActionsBar
                memberCount={filteredContacts.length}
                groupLabel={selectedGroupLabel}
                onSendPhoto={handleGroupSendPhoto}
                onSendMessage={handleGroupSendMessage}
                onSendMail={handleGroupSendMail}
                onCallMember={handleGroupCallMember}
              />
            )}

            {/* FAB for adding contacts */}
            {contacts.length > 0 && (
              <HapticTouchable hapticDisabled
                style={[styles.fab, { backgroundColor: themeColors.primary }]}
                onPress={handleAddContact}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('contacts.addButton')}
              >
                <Text style={[styles.fabIcon, { color: themeColors.textOnPrimary }]}>+</Text>
              </HapticTouchable>
            )}

            {/* Create Group Modal */}
            <CreateGroupModal
              visible={showCreateModal}
              contacts={contacts}
              onClose={() => setShowCreateModal(false)}
              onCreate={handleGroupCreated}
            />

            {/* Edit Group Modal (long-press on group chip) */}
            <EditGroupModal
              visible={showEditModal}
              group={editingGroup}
              contacts={contacts}
              onClose={handleCloseEditModal}
              onRename={handleEditRename}
              onChangeEmoji={handleEditChangeEmoji}
              onUpdateMembers={handleEditUpdateMembers}
              onDelete={handleEditDelete}
            />
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryFilterContainer: {
    borderBottomWidth: 1,
  },
  categoryFilterContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
    gap: spacing.xs,
  },
  categoryChipEmoji: {
    fontSize: 18,
  },
  categoryChipText: {
    ...typography.label,
    fontWeight: '600',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    borderBottomWidth: 1,
  },
  contactName: {
    ...typography.h3,
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  chevron: {
    fontSize: 28,
    fontWeight: '300',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  addButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    ...typography.button,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: touchTargets.large,
    height: touchTargets.large,
    borderRadius: touchTargets.large / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabIcon: {
    fontSize: 32,
    fontWeight: '300',
  },
});
