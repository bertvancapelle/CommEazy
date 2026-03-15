/**
 * ContactPickerModal — Select recipients from CommEazy contacts
 *
 * Uses PanelAwareModal for iPad Split View compatibility.
 * Shows contacts with email addresses, searchable via SearchBar.
 *
 * Senior-inclusive:
 * - Large touch targets (≥60pt)
 * - Clear contact names (firstName + lastName)
 * - Search with SearchBar component
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 13
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { Icon, SearchBar, PanelAwareModal } from '@/components';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import type { MailRecipient } from '@/types/mail';

// ============================================================
// Types
// ============================================================

interface ContactItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photoUrl?: string;
}

export interface ContactPickerModalProps {
  visible: boolean;
  contacts: ContactItem[];
  onSelect: (recipient: MailRecipient) => void;
  onClose: () => void;
}

// ============================================================
// Component
// ============================================================

export function ContactPickerModal({
  visible,
  contacts,
  onSelect,
  onClose,
}: ContactPickerModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { triggerHaptic } = useFeedback();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter contacts by search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;

    const q = searchQuery.toLowerCase();
    return contacts.filter(c => {
      const full = `${c.firstName} ${c.lastName}`.toLowerCase();
      return (
        full.includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    });
  }, [contacts, searchQuery]);

  const handleSelect = useCallback(
    (contact: ContactItem) => {
      triggerHaptic('tap');
      onSelect({
        id: contact.id,
        name: `${contact.firstName} ${contact.lastName}`.trim(),
        email: contact.email,
        avatarUri: contact.photoUrl,
        isFromContacts: true,
      });
    },
    [onSelect],
  );

  const handleClose = useCallback(() => {
    triggerHaptic('tap');
    setSearchQuery('');
    onClose();
  }, [onClose]);

  return (
    <PanelAwareModal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <LiquidGlassView moduleId="mail" style={styles.container} cornerRadius={0}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {t('modules.mail.compose.selectContact')}
          </Text>
          <HapticTouchable hapticDisabled
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Icon name="close" size={24} color={themeColors.textPrimary} />
          </HapticTouchable>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={() => {}}
            placeholder={t('modules.mail.compose.searchContacts')}
          />
        </View>

        {/* Contact List */}
        <ScrollView
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {filteredContacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                {t('modules.mail.compose.noContactsWithEmail')}
              </Text>
            </View>
          ) : (
            filteredContacts.map(contact => (
              <HapticTouchable hapticDisabled
                key={contact.id}
                style={[styles.contactItem, { borderBottomColor: themeColors.border }]}
                onPress={() => handleSelect(contact)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${contact.firstName} ${contact.lastName}, ${contact.email}`}
              >
                {/* Avatar placeholder */}
                <View style={[styles.avatar, { backgroundColor: accentColor.light }]}>
                  <Text style={[styles.avatarText, { color: accentColor.primary }]}>
                    {(contact.firstName[0] || '').toUpperCase()}
                  </Text>
                </View>

                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                    {contact.firstName} {contact.lastName}
                  </Text>
                  <Text style={[styles.contactEmail, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    {contact.email}
                  </Text>
                </View>
              </HapticTouchable>
            ))
          )}
        </ScrollView>
      </LiquidGlassView>
    </PanelAwareModal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
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
    fontWeight: '700',
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  listContent: {
    flexGrow: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 20,
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    ...typography.body,
    fontWeight: '600',
  },
  contactEmail: {
    ...typography.small,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
});
