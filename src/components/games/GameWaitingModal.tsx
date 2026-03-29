/**
 * GameWaitingModal — Waiting screen while invites are pending
 *
 * Shows per-contact status (pending/accepted/declined) and allows
 * starting the game when ≥1 contact has accepted.
 *
 * @see Prompt_1_Games_Foundation.md §5.4
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, borderRadius, touchTargets, typography } from '@/theme';
import { HapticTouchable, Icon } from '@/components';
import { PanelAwareModal } from '@/components/PanelAwareModal';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

export interface WaitingInvitee {
  /** Contact JID */
  jid: string;
  /** Contact display name */
  name: string;
  /** Current invite status */
  status: 'pending' | 'accepted' | 'declined';
}

export interface GameWaitingModalProps {
  /** Modal visibility */
  visible: boolean;
  /** Module identifier for LiquidGlassView tint */
  moduleId: ModuleColorId;
  /** Status per invited contact */
  invitees: WaitingInvitee[];
  /** Cancel all invitations */
  onCancel: () => void;
  /** Start game (enabled when ≥1 accepted) */
  onStart: () => void;
}

// ============================================================
// Status indicator
// ============================================================

function StatusIcon({ status }: { status: WaitingInvitee['status'] }) {
  switch (status) {
    case 'accepted':
      return <Icon name="check" size={20} color="#2E7D32" />;
    case 'declined':
      return <Icon name="x" size={20} color="#C62828" />;
    case 'pending':
    default:
      return <ActivityIndicator size="small" />;
  }
}

// ============================================================
// Component
// ============================================================

export function GameWaitingModal({
  visible,
  moduleId,
  invitees,
  onCancel,
  onStart,
}: GameWaitingModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(moduleId);

  const hasAccepted = invitees.some((i) => i.status === 'accepted');

  return (
    <PanelAwareModal
      visible={visible}
      onRequestClose={onCancel}
      animationType="slide"
      moduleId={moduleId}
    >
      <LiquidGlassView moduleId={moduleId} cornerRadius={0}>
        <View style={[styles.container, { backgroundColor: themeColors.surface }]}>
          {/* Title */}
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {t('games.multiplayer.waiting')}
          </Text>

          {/* Invitee list */}
          <View style={styles.inviteeList}>
            {invitees.map((invitee) => (
              <View
                key={invitee.jid}
                style={[styles.inviteeRow, { borderBottomColor: themeColors.border }]}
              >
                <View style={[styles.avatar, { backgroundColor: moduleColor + '33' }]}>
                  <Text style={styles.avatarText}>
                    {invitee.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={[styles.inviteeName, { color: themeColors.textPrimary }]}
                  numberOfLines={1}
                >
                  {invitee.name}
                </Text>
                <StatusIcon status={invitee.status} />
              </View>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <HapticTouchable
              hapticType="success"
              onPress={onStart}
              disabled={!hasAccepted}
              accessibilityRole="button"
              accessibilityLabel={t('games.multiplayer.startGame')}
              style={[
                styles.startButton,
                {
                  backgroundColor: hasAccepted ? moduleColor : themeColors.border,
                },
              ]}
            >
              <Text style={styles.startButtonText}>
                {t('games.multiplayer.startGame')}
              </Text>
            </HapticTouchable>

            <HapticTouchable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={t('games.multiplayer.cancelInvite')}
              style={styles.cancelButton}
            >
              <Text style={[styles.cancelButtonText, { color: themeColors.textSecondary }]}>
                {t('games.multiplayer.cancelInvite')}
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  inviteeList: {
    flex: 1,
  },
  inviteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
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
  inviteeName: {
    ...typography.body,
    flex: 1,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  startButton: {
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.body,
  },
});
