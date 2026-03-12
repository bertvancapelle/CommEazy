/**
 * AskAIHistoryModal — Previous conversations list
 *
 * Shows a scrollable list of past conversations grouped by date.
 * Tap to load, swipe to delete.
 *
 * @see .claude/plans/VRAAG_HET_AI_MODULE.md
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  colors,
  typography,
  spacing,
  borderRadius,
  touchTargets,
} from '@/theme';
import { Icon } from '@/components/Icon';
import { useAskAI } from '@/contexts/AskAIContext';
import type { AskAIConversationSummary } from '@/types/askAI';

interface AskAIHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  moduleColor: string;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return 'Vandaag';
  if (diffDays === 1) return 'Gisteren';
  return date.toLocaleDateString();
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AskAIHistoryModal({
  visible,
  onClose,
  moduleColor,
}: AskAIHistoryModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    conversations,
    loadConversation,
    deleteConversation,
    clearAllConversations,
  } = useAskAI();

  const handleLoad = useCallback(
    async (id: string) => {
      await loadConversation(id);
      onClose();
    },
    [loadConversation, onClose],
  );

  const handleDelete = useCallback(
    (item: AskAIConversationSummary) => {
      Alert.alert(
        t('modules.askAI.chat.deleteConversation'),
        t('modules.askAI.chat.deleteConversationConfirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => deleteConversation(item.id),
          },
        ],
      );
    },
    [deleteConversation, t],
  );

  const handleClearAll = useCallback(() => {
    Alert.alert(
      t('modules.askAI.chat.clearAll'),
      t('modules.askAI.chat.clearAllConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: clearAllConversations,
        },
      ],
    );
  }, [clearAllConversations, t]);

  // Group conversations by date
  const grouped = conversations.reduce<
    Record<string, AskAIConversationSummary[]>
  >((acc, conv) => {
    const dateKey = formatDate(conv.updatedAt);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(conv);
    return acc;
  }, {});

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <HapticTouchable hapticDisabled
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Icon name="chevron-down" size={28} color={colors.textPrimary} />
          </HapticTouchable>
          <Text style={styles.headerTitle}>
            {t('modules.askAI.chat.history')}
          </Text>
          {conversations.length > 0 && (
            <HapticTouchable hapticDisabled
              style={styles.clearButton}
              onPress={handleClearAll}
              accessibilityRole="button"
              accessibilityLabel={t('modules.askAI.chat.clearAll')}
            >
              <Icon name="trash" size={22} color={colors.error} />
            </HapticTouchable>
          )}
        </View>

        {/* Content */}
        {conversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {t('modules.askAI.chat.noHistory')}
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {Object.entries(grouped).map(([dateLabel, items]) => (
              <View key={dateLabel}>
                <Text style={styles.dateHeader}>{dateLabel}</Text>
                {items.map((item) => (
                  <HapticTouchable hapticDisabled
                    key={item.id}
                    style={styles.conversationItem}
                    onPress={() => handleLoad(item.id)}
                    onLongPress={() => handleDelete(item)}
                    delayLongPress={500}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    accessibilityHint={t('modules.askAI.a11y.viewHistory')}
                  >
                    <View style={styles.conversationContent}>
                      <Text style={styles.conversationTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.conversationMeta}>
                        {formatTime(item.updatedAt)} · {item.messageCount}{' '}
                        {item.messageCount === 1 ? 'bericht' : 'berichten'}
                      </Text>
                    </View>
                    <Icon
                      name="chevron-right"
                      size={20}
                      color={colors.textTertiary}
                    />
                  </HapticTouchable>
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  clearButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  dateHeader: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  conversationContent: {
    flex: 1,
  },
  conversationTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  conversationMeta: {
    ...typography.small,
    color: colors.textTertiary,
    marginTop: 2,
  },
});
