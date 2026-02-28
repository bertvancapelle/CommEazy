/**
 * PhotoRecipientModal — Modal for selecting photo recipients (1-8 contacts)
 *
 * Used in PhotoAlbum and ChatScreen for selecting who to send photos to.
 * Supports multi-select up to MAX_RECIPIENTS (8) due to encryption constraints.
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt)
 * - Clear selection indicators
 * - Visual feedback on selection
 * - Counter showing selected/max
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, typography, spacing, borderRadius, touchTargets } from '@/theme';
import { Button } from './Button';
import { ContactAvatar } from './ContactAvatar';
import { Icon } from './Icon';
import type { Contact } from '@/services/interfaces';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[PhotoRecipientModal]';

// Maximum recipients (dual-path encryption limit)
export const MAX_RECIPIENTS = 8;

// Haptic feedback
const HAPTIC_DURATION = 50;

// ============================================================
// Types
// ============================================================

export interface PhotoRecipientModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Available contacts to select from */
  contacts: Contact[];
  /** Number of photos being sent */
  photoCount: number;
  /** Whether contacts are still loading */
  isLoading?: boolean;
  /** Called when user confirms selection */
  onConfirm: (selectedContacts: Contact[]) => void;
  /** Called when modal is closed/cancelled */
  onClose: () => void;
  /** Module accent color */
  accentColor?: string;
}

// ============================================================
// Component
// ============================================================

export function PhotoRecipientModal({
  visible,
  contacts,
  photoCount,
  isLoading = false,
  onConfirm,
  onClose,
  accentColor = colors.primary,
}: PhotoRecipientModalProps) {
  const { t } = useTranslation();
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  // Reset selection when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedContacts(new Set());
    }
  }, [visible]);

  // Toggle contact selection
  const handleToggleContact = useCallback((contact: Contact) => {
    Vibration.vibrate(HAPTIC_DURATION);
    setSelectedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contact.jid)) {
        newSet.delete(contact.jid);
      } else if (newSet.size < MAX_RECIPIENTS) {
        newSet.add(contact.jid);
      }
      return newSet;
    });
  }, []);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    const selected = contacts.filter(c => selectedContacts.has(c.jid));
    console.info(LOG_PREFIX, 'Confirmed selection:', selected.length, 'contacts');
    onConfirm(selected);
  }, [contacts, selectedContacts, onConfirm]);

  // Get title based on photo count
  const getTitle = () => {
    if (photoCount === 1) {
      return t('modules.photoAlbum.sendPhotoTo', 'Send photo to...');
    }
    return t('modules.photoAlbum.sendPhotosTo', 'Send {{count}} photos to...', { count: photoCount });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel', 'Cancel')}
          >
            <Icon name="x" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{getTitle()}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Selection counter */}
        <View style={styles.counterBar}>
          <Text style={styles.counterText}>
            {t('modules.photoAlbum.recipientCount', '{{selected}} of {{max}} selected', {
              selected: selectedContacts.size,
              max: MAX_RECIPIENTS,
            })}
          </Text>
        </View>

        {/* Contact list */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={accentColor} />
            <Text style={styles.loadingText}>
              {t('common.loading', 'Loading...')}
            </Text>
          </View>
        ) : contacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="users" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>
              {t('modules.photoAlbum.noContacts', 'No contacts')}
            </Text>
            <Text style={styles.emptyHint}>
              {t('modules.photoAlbum.noContactsHint', 'Add contacts to send photos.')}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.contactList}
            contentContainerStyle={styles.contactListContent}
            showsVerticalScrollIndicator={false}
          >
            {contacts.map((contact) => {
              const isSelected = selectedContacts.has(contact.jid);
              const isDisabled = !isSelected && selectedContacts.size >= MAX_RECIPIENTS;

              return (
                <TouchableOpacity
                  key={contact.jid}
                  style={[
                    styles.contactRow,
                    isSelected && { borderColor: accentColor, borderWidth: 2 },
                    isDisabled && styles.contactRowDisabled,
                  ]}
                  onPress={() => !isDisabled && handleToggleContact(contact)}
                  disabled={isDisabled}
                  accessibilityRole="checkbox"
                  accessibilityLabel={contact.name}
                  accessibilityState={{ checked: isSelected, disabled: isDisabled }}
                >
                  <ContactAvatar
                    name={contact.name}
                    photoUri={contact.avatarUrl}
                    size={48}
                  />
                  <Text
                    style={[
                      styles.contactName,
                      isDisabled && styles.contactNameDisabled,
                    ]}
                    numberOfLines={1}
                  >
                    {contact.name}
                  </Text>
                  {isSelected && (
                    <View style={[styles.checkBadge, { backgroundColor: accentColor }]}>
                      <Icon name="checkmark" size={16} color={colors.textOnPrimary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title={
              selectedContacts.size === 0
                ? t('modules.photoAlbum.selectRecipients', 'Select recipients')
                : t('modules.photoAlbum.sendToSelected', 'Send to {{count}} contact(s)', {
                    count: selectedContacts.size,
                  })
            }
            onPress={handleConfirm}
            variant="primary"
            disabled={selectedContacts.size === 0}
            style={[
              styles.confirmButton,
              { backgroundColor: selectedContacts.size > 0 ? accentColor : colors.disabled },
            ]}
          />
        </View>
      </View>
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: touchTargets.minimum,
  },
  counterBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  counterText: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptyHint: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  contactList: {
    flex: 1,
  },
  contactListContent: {
    padding: spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    minHeight: touchTargets.comfortable,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactRowDisabled: {
    opacity: 0.5,
  },
  contactName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: spacing.md,
    flex: 1,
  },
  contactNameDisabled: {
    color: colors.textSecondary,
  },
  checkBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmButton: {
    minHeight: touchTargets.comfortable,
  },
});

export default PhotoRecipientModal;
