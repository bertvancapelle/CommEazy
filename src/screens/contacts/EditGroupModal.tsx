/**
 * EditGroupModal — Modal for managing an existing contact group
 *
 * Triggered by long-press on a group chip.
 *
 * Actions:
 * - Rename group
 * - Change emoji
 * - Add/remove members
 * - Delete group (with confirmation)
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Large clear action buttons
 * - Confirmation before destructive action
 * - Haptic feedback
 *
 * @see .claude/plans/CONTACT_GROUPS.md (Fase 4)
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { PanelAwareModal, HapticTouchable, ContactAvatar, Icon , ScrollViewWithIndicator, ModalLayout } from '@/components';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { useFeedback } from '@/hooks/useFeedback';
import { type Contact, getContactDisplayName } from '@/services/interfaces';
import type { ContactGroup } from '@/services/contacts';

// ============================================================
// Constants
// ============================================================

/** Same emoji grid as CreateGroupModal for consistency */
const GROUP_EMOJIS = [
  '👨‍👩‍👧‍👦', '❤️', '🏠', '👵', '👴', '🤝',
  '⭐', '🎉', '🎂', '☕', '🏥', '⛪',
  '🏫', '🏢', '🎵', '⚽', '🌍', '🌸',
  '🐱', '🐶', '🎯', '📞', '💬', '📧',
];

// ============================================================
// Types
// ============================================================

export interface EditGroupModalProps {
  visible: boolean;
  group: ContactGroup | null;
  contacts: Contact[];
  onClose: () => void;
  onRename: (groupId: string, newName: string) => void;
  onChangeEmoji: (groupId: string, emoji: string | undefined) => void;
  onUpdateMembers: (groupId: string, addJids: string[], removeJids: string[]) => void;
  onDelete: (groupId: string) => void;
}

// ============================================================
// Component
// ============================================================

export function EditGroupModal({
  visible,
  group,
  contacts,
  onClose,
  onRename,
  onChangeEmoji,
  onUpdateMembers,
  onDelete,
}: EditGroupModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerFeedback } = useFeedback();

  const [editName, setEditName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>(undefined);
  const [memberJids, setMemberJids] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state when group changes
  React.useEffect(() => {
    if (group) {
      setEditName(group.name);
      setSelectedEmoji(group.emoji);
      setMemberJids(new Set(group.contactJids));
      setHasChanges(false);
    }
  }, [group]);

  const handleSave = useCallback(() => {
    if (!group) return;

    // Check what changed
    if (editName.trim() !== group.name && editName.trim().length > 0) {
      onRename(group.id, editName.trim());
    }

    if (selectedEmoji !== group.emoji) {
      onChangeEmoji(group.id, selectedEmoji);
    }

    // Compute member changes
    const originalJids = new Set(group.contactJids);
    const addJids = Array.from(memberJids).filter(jid => !originalJids.has(jid));
    const removeJids = Array.from(originalJids).filter(jid => !memberJids.has(jid));
    if (addJids.length > 0 || removeJids.length > 0) {
      onUpdateMembers(group.id, addJids, removeJids);
    }

    void triggerFeedback('success');
    onClose();
  }, [group, editName, selectedEmoji, memberJids, onRename, onChangeEmoji, onUpdateMembers, triggerFeedback, onClose]);

  const handleDelete = useCallback(() => {
    if (!group) return;

    void triggerFeedback('warning');
    Alert.alert(
      t('contacts.groups.deleteGroup', 'Groep verwijderen'),
      t('contacts.groups.deleteGroupConfirm',
        'Weet je zeker dat je de groep \'{{name}}\' wilt verwijderen? De contacten blijven behouden.',
        { name: group.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Verwijderen'),
          style: 'destructive',
          onPress: () => {
            onDelete(group.id);
            onClose();
          },
        },
      ],
    );
  }, [group, t, triggerFeedback, onDelete, onClose]);

  const toggleContact = useCallback((jid: string) => {
    void triggerFeedback('tap');
    setMemberJids(prev => {
      const next = new Set(prev);
      if (next.has(jid)) {
        next.delete(jid);
      } else {
        next.add(jid);
      }
      return next;
    });
    setHasChanges(true);
  }, [triggerFeedback]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    void triggerFeedback('tap');
    setSelectedEmoji(prev => (prev === emoji ? undefined : emoji));
    setHasChanges(true);
  }, [triggerFeedback]);

  const handleNameChange = useCallback((text: string) => {
    setEditName(text);
    setHasChanges(true);
  }, []);

  const isValid = editName.trim().length > 0;

  // Sort contacts: members first, then non-members
  const sortedContacts = useMemo(() =>
    [...contacts].sort((a, b) => {
      const aIsMember = memberJids.has(a.jid);
      const bIsMember = memberJids.has(b.jid);
      if (aIsMember && !bIsMember) return -1;
      if (!aIsMember && bIsMember) return 1;
      return getContactDisplayName(a).localeCompare(getContactDisplayName(b), undefined, { sensitivity: 'base' });
    }),
    [contacts, memberJids],
  );

  if (!group) return null;

  return (
    <PanelAwareModal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <LiquidGlassView moduleId="groups" style={styles.modal} cornerRadius={borderRadius.lg}>
          <ModalLayout
            headerBlock={
              <View style={[styles.header, { borderBottomColor: themeColors.divider }]}>
                <HapticTouchable
                  style={styles.closeButton}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}
                >
                  <Icon name="close" size={24} color={themeColors.textSecondary} />
                </HapticTouchable>

                <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
                  {group.emoji ? `${group.emoji} ` : ''}{group.name}
                </Text>

                <HapticTouchable
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: hasChanges && isValid
                        ? themeColors.primary
                        : themeColors.border,
                    },
                  ]}
                  onPress={handleSave}
                  disabled={!hasChanges || !isValid}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.save', 'Opslaan')}
                  accessibilityState={{ disabled: !hasChanges || !isValid }}
                >
                  <Text
                    style={[
                      styles.saveButtonText,
                      {
                        color: hasChanges && isValid
                          ? themeColors.textOnPrimary
                          : themeColors.textTertiary,
                      },
                    ]}
                  >
                    {t('common.save', 'Opslaan')}
                  </Text>
                </HapticTouchable>
              </View>
            }
            contentBlock={
              <ScrollViewWithIndicator
                style={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Group name edit */}
                <VoiceTextInput
                  voiceId="edit-group-name"
                  label={t('contacts.groups.renameGroup', 'Hernoemen')}
                  value={editName}
                  onChangeText={handleNameChange}
                  maxLength={50}
                />

                {/* Emoji selector */}
                <Text style={[styles.sectionLabel, { color: themeColors.textPrimary }]}>
                  {t('contacts.groups.changeEmoji', 'Icoon wijzigen')}
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

                {/* Member management */}
                <Text style={[styles.sectionLabel, { color: themeColors.textPrimary }]}>
                  {t('contacts.groups.manageMembers', 'Leden beheren')}
                  <Text style={{ color: themeColors.textSecondary }}>
                    {` (${memberJids.size})`}
                  </Text>
                </Text>

                {sortedContacts.map((contact) => {
                  const displayName = getContactDisplayName(contact);
                  const isMember = memberJids.has(contact.jid);

                  return (
                    <HapticTouchable hapticDisabled
                      key={contact.jid}
                      style={[
                        styles.contactRow,
                        {
                          backgroundColor: isMember
                            ? `${themeColors.primary}10`
                            : themeColors.surface,
                          borderBottomColor: themeColors.divider,
                        },
                      ]}
                      onPress={() => toggleContact(contact.jid)}
                      activeOpacity={0.7}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isMember }}
                      accessibilityLabel={displayName}
                    >
                      <ContactAvatar
                        name={displayName}
                        photoUrl={contact.photoUrl}
                        size={48}
                        trustLevel={contact.trustLevel ?? 0}
                      />
                      <Text
                        style={[styles.contactName, { color: themeColors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>
                      <View
                        style={[
                          styles.checkbox,
                          {
                            backgroundColor: isMember ? themeColors.primary : 'transparent',
                            borderColor: isMember ? themeColors.primary : themeColors.border,
                          },
                        ]}
                      >
                        {isMember && (
                          <Icon name="checkmark" size={16} color={themeColors.textOnPrimary} />
                        )}
                      </View>
                    </HapticTouchable>
                  );
                })}

                {/* Delete group button */}
                <View style={styles.deleteSection}>
                  <HapticTouchable
                    style={[styles.deleteButton, { borderColor: themeColors.error }]}
                    onPress={handleDelete}
                    accessibilityRole="button"
                    accessibilityLabel={t('contacts.groups.deleteGroup', 'Groep verwijderen')}
                  >
                    <Icon name="trash" size={20} color={themeColors.error} />
                    <Text style={[styles.deleteButtonText, { color: themeColors.error }]}>
                      {t('contacts.groups.deleteGroup', 'Groep verwijderen')}
                    </Text>
                  </HapticTouchable>
                </View>

                {/* Bottom spacing */}
                <View style={{ height: spacing.xl }} />
              </ScrollViewWithIndicator>
            }
          />
        </LiquidGlassView>
      </View>
    </PanelAwareModal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    maxHeight: '90%',
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    overflow: 'hidden',
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
  saveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
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
  contactName: {
    ...typography.body,
    flex: 1,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteSection: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    minHeight: touchTargets.minimum,
  },
  deleteButtonText: {
    ...typography.button,
  },
});
