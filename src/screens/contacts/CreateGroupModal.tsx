/**
 * CreateGroupModal — Modal for creating a new contact group
 *
 * Flow:
 * 1. Enter group name
 * 2. Pick an emoji icon (optional)
 * 3. Select contacts to add
 * 4. Tap "Aanmaken" to create
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Large text labels
 * - Simple 3-step flow
 * - Haptic feedback
 *
 * @see .claude/plans/CONTACT_GROUPS.md (Fase 4)
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { PanelAwareModal, HapticTouchable, ContactAvatar, Icon, ScrollViewWithIndicator, ContactReachabilityIcons } from '@/components';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { useFeedback } from '@/hooks/useFeedback';
import { type Contact, getContactDisplayName } from '@/services/interfaces';

// ============================================================
// Constants
// ============================================================

/** Commonly used emoji for contact groups */
const GROUP_EMOJIS = [
  '👨‍👩‍👧‍👦', '❤️', '🏠', '👵', '👴', '🤝',
  '⭐', '🎉', '🎂', '☕', '🏥', '⛪',
  '🏫', '🏢', '🎵', '⚽', '🌍', '🌸',
  '🐱', '🐶', '🎯', '📞', '💬', '📧',
];

// ============================================================
// Types
// ============================================================

export interface CreateGroupModalProps {
  visible: boolean;
  contacts: Contact[];
  onClose: () => void;
  onCreate: (name: string, emoji: string | undefined, contactJids: string[]) => void;
}

// ============================================================
// Component
// ============================================================

export function CreateGroupModal({
  visible,
  contacts,
  onClose,
  onCreate,
}: CreateGroupModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();
  const insets = useSafeAreaInsets();

  const [groupName, setGroupName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>(undefined);
  const [selectedJids, setSelectedJids] = useState<Set<string>>(new Set());

  // Reset state when modal opens
  const handleClose = useCallback(() => {
    setGroupName('');
    setSelectedEmoji(undefined);
    setSelectedJids(new Set());
    onClose();
  }, [onClose]);

  const handleCreate = useCallback(() => {
    if (groupName.trim().length === 0) return;
    void triggerFeedback('success');
    onCreate(groupName.trim(), selectedEmoji, Array.from(selectedJids));
    setGroupName('');
    setSelectedEmoji(undefined);
    setSelectedJids(new Set());
  }, [groupName, selectedEmoji, selectedJids, onCreate, triggerFeedback]);

  const toggleContact = useCallback((jid: string) => {
    void triggerFeedback('tap');
    setSelectedJids(prev => {
      const next = new Set(prev);
      if (next.has(jid)) {
        next.delete(jid);
      } else {
        next.add(jid);
      }
      return next;
    });
  }, [triggerFeedback]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    void triggerFeedback('tap');
    setSelectedEmoji(prev => (prev === emoji ? undefined : emoji));
  }, [triggerFeedback]);

  const isValid = groupName.trim().length > 0;

  // Sort contacts alphabetically for the picker
  const sortedContacts = useMemo(() =>
    [...contacts].sort((a, b) =>
      getContactDisplayName(a).localeCompare(getContactDisplayName(b), undefined, { sensitivity: 'base' })
    ),
    [contacts],
  );

  return (
    <PanelAwareModal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <LiquidGlassView moduleId="contacts" style={[styles.fullScreen, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: themeColors.divider, paddingTop: insets.top }]}>
          <HapticTouchable
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Icon name="close" size={24} color={themeColors.textSecondary} />
          </HapticTouchable>

          <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
            {t('contacts.groups.newGroup', 'Nieuwe groep')}
          </Text>

          <HapticTouchable
            style={[
              styles.createButton,
              {
                backgroundColor: isValid ? themeColors.primary : themeColors.border,
              },
            ]}
            onPress={handleCreate}
            disabled={!isValid}
            accessibilityRole="button"
            accessibilityLabel={t('common.create', 'Aanmaken')}
            accessibilityState={{ disabled: !isValid }}
          >
            <Text
              style={[
                styles.createButtonText,
                { color: isValid ? themeColors.textOnPrimary : themeColors.textTertiary },
              ]}
            >
              {t('common.create', 'Aanmaken')}
            </Text>
          </HapticTouchable>
        </View>

        <ScrollViewWithIndicator
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Group name input */}
          <VoiceTextInput
            voiceId="group-name"
            label={t('contacts.groups.groupName', 'Groepsnaam')}
            value={groupName}
            onChangeText={setGroupName}
            placeholder={t('contacts.groups.groupNamePlaceholder', 'bijv. Familie, Vrienden...')}
            maxLength={50}
          />

          {/* Emoji selector */}
          <Text style={[styles.sectionLabel, { color: themeColors.textPrimary }]}>
            {t('contacts.groups.chooseEmoji', 'Kies een icoon')}
          </Text>
          <View style={styles.emojiGrid}>
            {GROUP_EMOJIS.map((emoji) => (
              <HapticTouchable hapticDisabled
                key={emoji}
                style={[
                  styles.emojiButton,
                  selectedEmoji === emoji && {
                    backgroundColor: `${themeColors.primary}20`,
                    borderColor: themeColors.primary,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => handleEmojiSelect(emoji)}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedEmoji === emoji }}
                accessibilityLabel={emoji}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </HapticTouchable>
            ))}
          </View>

          {/* Contact selector */}
          <Text style={[styles.sectionLabel, { color: themeColors.textPrimary }]}>
            {t('contacts.groups.selectContacts', 'Selecteer contacten')}
            {selectedJids.size > 0 && (
              <Text style={{ color: themeColors.textSecondary }}>
                {` (${selectedJids.size})`}
              </Text>
            )}
          </Text>

          {sortedContacts.map((contact) => {
            const displayName = getContactDisplayName(contact);
            const isSelected = selectedJids.has(contact.jid);

            return (
              <HapticTouchable hapticDisabled
                key={contact.jid}
                style={[
                  styles.contactRow,
                  {
                    backgroundColor: isSelected
                      ? `${themeColors.primary}10`
                      : themeColors.surface,
                    borderBottomColor: themeColors.divider,
                  },
                ]}
                onPress={() => toggleContact(contact.jid)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={displayName}
              >
                <ContactAvatar
                  name={displayName}
                  photoUrl={contact.photoUrl}
                  size={48}
                />
                <View style={styles.contactInfo}>
                  <Text
                    style={[styles.contactName, { color: themeColors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  <ContactReachabilityIcons
                    hasApp={(contact.trustLevel ?? 0) >= 2}
                    hasEmail={!!contact.email}
                    hasPhone={!!contact.phoneNumber}
                  />
                </View>
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: isSelected ? themeColors.primary : 'transparent',
                      borderColor: isSelected ? themeColors.primary : themeColors.border,
                    },
                  ]}
                >
                  {isSelected && (
                    <Icon name="checkmark" size={16} color={themeColors.textOnPrimary} />
                  )}
                </View>
              </HapticTouchable>
            );
          })}

          {/* Bottom spacing */}
          <View style={{ height: insets.bottom + spacing.xl }} />
        </ScrollViewWithIndicator>
      </LiquidGlassView>
    </PanelAwareModal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    minHeight: touchTargets.minimum,
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  createButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    ...typography.button,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  sectionLabel: {
    ...typography.body,
    fontWeight: '700',
    marginTop: spacing.lg,
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
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
