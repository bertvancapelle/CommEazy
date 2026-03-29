/**
 * GameInviteModal — Contact picker for multiplayer game invites
 *
 * Allows selecting 1-3 online contacts to invite for a multiplayer game.
 * Uses PanelAwareModal + LiquidGlassView.
 *
 * @see Prompt_1_Games_Foundation.md §5.3
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, borderRadius, touchTargets, typography } from '@/theme';
import { HapticTouchable, Icon, ScrollViewWithIndicator } from '@/components';
import { PanelAwareModal } from '@/components/PanelAwareModal';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import type { GameType } from '@/types/games';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

export interface GameContact {
  /** Contact JID */
  jid: string;
  /** Display name */
  name: string;
  /** Whether contact is online */
  isOnline: boolean;
}

export interface GameInviteModalProps {
  /** Modal visibility */
  visible: boolean;
  /** Module identifier for LiquidGlassView tint */
  moduleId: ModuleColorId;
  /** Game type */
  gameType: GameType;
  /** Maximum number of players (2-4, includes self) */
  maxPlayers: number;
  /** Available contacts to invite */
  contacts: GameContact[];
  /** Called when invites are confirmed */
  onInvite: (jids: string[]) => void;
  /** Close modal handler */
  onClose: () => void;
}

// ============================================================
// Component
// ============================================================

export function GameInviteModal({
  visible,
  moduleId,
  gameType: _gameType,
  maxPlayers,
  contacts,
  onInvite,
  onClose,
}: GameInviteModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(moduleId);
  const [selectedJids, setSelectedJids] = useState<Set<string>>(new Set());

  const maxSelectable = maxPlayers - 1; // Subtract self

  const onlineContacts = useMemo(
    () => contacts.filter((c) => c.isOnline),
    [contacts],
  );

  const handleToggle = useCallback(
    (jid: string) => {
      setSelectedJids((prev) => {
        const next = new Set(prev);
        if (next.has(jid)) {
          next.delete(jid);
        } else if (next.size < maxSelectable) {
          next.add(jid);
        }
        return next;
      });
    },
    [maxSelectable],
  );

  const handleInvite = useCallback(() => {
    if (selectedJids.size > 0) {
      onInvite(Array.from(selectedJids));
      setSelectedJids(new Set());
    }
  }, [selectedJids, onInvite]);

  const handleClose = useCallback(() => {
    setSelectedJids(new Set());
    onClose();
  }, [onClose]);

  return (
    <PanelAwareModal
      visible={visible}
      onRequestClose={handleClose}
      animationType="slide"
      moduleId={moduleId}
    >
      <LiquidGlassView moduleId={moduleId} cornerRadius={0}>
        <View style={[styles.container, { backgroundColor: themeColors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {t('games.multiplayer.inviteTitle')}
            </Text>
            <HapticTouchable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={styles.closeButton}
            >
              <Icon name="x" size={24} color={themeColors.textSecondary} />
            </HapticTouchable>
          </View>

          {/* Contact list */}
          <ScrollViewWithIndicator style={styles.list}>
            {onlineContacts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                  {t('games.multiplayer.noOnlineContacts')}
                </Text>
              </View>
            ) : (
              onlineContacts.map((contact) => {
                const isSelected = selectedJids.has(contact.jid);
                return (
                  <HapticTouchable
                    key={contact.jid}
                    onPress={() => handleToggle(contact.jid)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={contact.name}
                    accessibilityState={{ checked: isSelected }}
                    style={[
                      styles.contactRow,
                      {
                        borderColor: isSelected ? moduleColor : themeColors.border,
                        backgroundColor: isSelected ? moduleColor + '1A' : 'transparent',
                      },
                    ]}
                  >
                    <View style={[styles.avatar, { backgroundColor: moduleColor + '33' }]}>
                      <Text style={styles.avatarText}>
                        {contact.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={[styles.contactName, { color: themeColors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {contact.name}
                    </Text>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isSelected ? moduleColor : themeColors.border,
                          backgroundColor: isSelected ? moduleColor : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && <Icon name="check" size={16} color="#FFFFFF" />}
                    </View>
                  </HapticTouchable>
                );
              })
            )}
          </ScrollViewWithIndicator>

          {/* Invite button */}
          <View style={styles.footer}>
            <HapticTouchable
              hapticType="success"
              onPress={handleInvite}
              disabled={selectedJids.size === 0}
              accessibilityRole="button"
              accessibilityLabel={t('games.multiplayer.invite')}
              style={[
                styles.inviteButton,
                {
                  backgroundColor: selectedJids.size > 0 ? moduleColor : themeColors.border,
                },
              ]}
            >
              <Text style={styles.inviteButtonText}>
                {t('games.multiplayer.invite')} ({selectedJids.size}/{maxSelectable})
              </Text>
            </HapticTouchable>
          </View>
        </View>
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
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    flex: 1,
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
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
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xxl,
  },
  inviteButton: {
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
