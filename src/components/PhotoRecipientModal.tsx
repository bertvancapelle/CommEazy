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
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing, borderRadius, touchTargets } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { HapticTouchable } from './HapticTouchable';
import { Button } from './Button';
import { ContactAvatar } from './ContactAvatar';
import { Icon } from './Icon';
import type { Contact } from '@/services/interfaces';
import { getContactDisplayName } from '@/services/interfaces';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[PhotoRecipientModal]';

// Maximum recipients (dual-path encryption limit)
export const MAX_RECIPIENTS = 8;

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
  accentColor,
}: PhotoRecipientModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const resolvedAccent = accentColor || themeColors.primary;
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  // Reset selection when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedContacts(new Set());
    }
  }, [visible]);

  // Toggle contact selection — haptic is handled by HapticTouchable
  const handleToggleContact = useCallback((contact: Contact) => {
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
    console.debug(LOG_PREFIX, 'Confirmed selection', { count: selected.length });
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
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <HapticTouchable
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel', 'Cancel')}
          >
            <Icon name="x" size={24} color={themeColors.textPrimary} />
          </HapticTouchable>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{getTitle()}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Selection counter */}
        <View style={[styles.counterBar, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.counterText, { color: themeColors.textSecondary }]}>
            {t('modules.photoAlbum.recipientCount', '{{selected}} of {{max}} selected', {
              selected: selectedContacts.size,
              max: MAX_RECIPIENTS,
            })}
          </Text>
        </View>

        {/* Contact list */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={resolvedAccent} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              {t('common.loading', 'Loading...')}
            </Text>
          </View>
        ) : contacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="users" size={64} color={themeColors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
              {t('modules.photoAlbum.noContacts', 'No contacts')}
            </Text>
            <Text style={[styles.emptyHint, { color: themeColors.textSecondary }]}>
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
                <HapticTouchable
                  key={contact.jid}
                  style={[
                    styles.contactRow,
                    { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                    isSelected && { borderColor: resolvedAccent, borderWidth: 2 },
                    isDisabled && styles.contactRowDisabled,
                  ]}
                  onPress={() => !isDisabled && handleToggleContact(contact)}
                  disabled={isDisabled}
                  hapticDisabled={isDisabled}
                  accessibilityRole="checkbox"
                  accessibilityLabel={getContactDisplayName(contact)}
                  accessibilityState={{ checked: isSelected, disabled: isDisabled }}
                >
                  <ContactAvatar
                    name={getContactDisplayName(contact)}
                    photoUri={contact.avatarUrl}
                    size={48}
                  />
                  <Text
                    style={[
                      styles.contactName,
                      { color: themeColors.textPrimary },
                      isDisabled && { color: themeColors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {getContactDisplayName(contact)}
                  </Text>
                  {isSelected && (
                    <View style={[styles.checkBadge, { backgroundColor: resolvedAccent }]}>
                      <Icon name="checkmark" size={16} color={themeColors.textOnPrimary} />
                    </View>
                  )}
                </HapticTouchable>
              );
            })}
          </ScrollView>
        )}

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
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
              { backgroundColor: selectedContacts.size > 0 ? resolvedAccent : themeColors.disabled },
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: touchTargets.minimum,
  },
  counterBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  counterText: {
    ...typography.label,
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
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptyHint: {
    ...typography.body,
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
    minHeight: touchTargets.comfortable,
    borderWidth: 1,
  },
  contactRowDisabled: {
    opacity: 0.5,
  },
  contactName: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.md,
    flex: 1,
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
  },
  confirmButton: {
    minHeight: touchTargets.comfortable,
  },
});

export default PhotoRecipientModal;
