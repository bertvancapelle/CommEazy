/**
 * ContactListScreen — Alphabetical list of all contacts
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Large photo for easy recognition
 * - Large name text (h3)
 * - Minimal visual elements (photo + name only)
 * - VoiceOver support
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { ContactAvatar, LoadingView } from '@/components';
import type { Contact } from '@/services/interfaces';
import type { ContactStackParams } from '@/navigation';

type NavigationProp = NativeStackNavigationProp<ContactStackParams, 'ContactList'>;

export function ContactListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load contacts (mock data in dev mode)
  useEffect(() => {
    const loadContacts = async () => {
      try {
        if (__DEV__) {
          // Dynamic import to avoid module loading at bundle time
          const { getMockContactsForDevice } = await import('@/services/mock');
          const { chatService } = await import('@/services/chat');

          // Get current user JID to show appropriate contacts (other test devices)
          const currentUserJid = chatService.isInitialized ? chatService.getMyJid() : 'ik@commeazy.local';
          const deviceContacts = getMockContactsForDevice(currentUserJid || 'ik@commeazy.local');

          const sorted = [...deviceContacts].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          );
          setContacts(sorted);
          setLoading(false);
        } else {
          // Production: use real database service
          // This would use ServiceContainer.database.getContacts()
          setContacts([]);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load contacts:', error);
        setContacts([]);
        setLoading(false);
      }
    };
    void loadContacts();
  }, []);

  // Filter contacts when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phoneNumber.includes(query)
      );
      setFilteredContacts(filtered);
    }
  }, [searchQuery, contacts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Contacts are observable, so just wait a moment
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleContactPress = useCallback(
    (contact: Contact) => {
      navigation.navigate('ContactDetail', { jid: contact.jid });
    },
    [navigation]
  );

  const handleAddContact = useCallback(() => {
    navigation.navigate('AddContact' as never);
  }, [navigation]);

  const renderContactItem = useCallback(
    (item: Contact) => (
      <TouchableOpacity
        key={item.jid}
        style={styles.contactItem}
        onPress={() => handleContactPress(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        accessibilityHint={t('accessibility.openContact', { name: item.name })}
      >
        {/* Profile photo */}
        <ContactAvatar
          name={item.name}
          photoUrl={item.photoUrl}
          size={60}
        />

        {/* Name - large and clear */}
        <Text
          style={styles.contactName}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.name}
        </Text>

        {/* Chevron indicator */}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    ),
    [handleContactPress, t]
  );

  const renderEmptyList = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>{t('contacts.noContacts')}</Text>
        <Text style={styles.emptySubtitle}>{t('contacts.noContactsHint')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddContact}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.add')}
        >
          <Text style={styles.addButtonText}>{t('contacts.add')}</Text>
        </TouchableOpacity>
      </View>
    ),
    [t, handleAddContact]
  );

  if (loading) {
    return <LoadingView fullscreen message={t('common.loading')} />;
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('contacts.searchPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel={t('contacts.searchPlaceholder')}
          accessibilityHint={t('accessibility.searchContacts')}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {/* Contact list */}
      <ScrollView
        contentContainerStyle={
          filteredContacts.length === 0 ? styles.emptyListContent : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t('accessibility.contactList', { count: filteredContacts.length })}
      >
        {filteredContacts.length === 0 ? (
          renderEmptyList()
        ) : (
          filteredContacts.map(renderContactItem)
        )}
      </ScrollView>

      {/* FAB for adding contacts */}
      {contacts.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleAddContact}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.add')}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  searchInput: {
    ...typography.body,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
    color: colors.textPrimary,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  contactName: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  chevron: {
    fontSize: 28,
    color: colors.textTertiary,
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
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: touchTargets.large,
    height: touchTargets.large,
    borderRadius: touchTargets.large / 2,
    backgroundColor: colors.primary,
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
    color: colors.textOnPrimary,
    fontWeight: '300',
  },
});
