/**
 * BulkSaveSheet — Save multiple mail attachments to album at once
 *
 * Uses PanelAwareModal for iPad Split View compatibility.
 * Shows progress for each attachment with cancel option.
 *
 * Sequential processing: one at a time to avoid memory pressure.
 *
 * Senior-inclusive:
 * - Large cancel button (≥60pt)
 * - Clear progress per item
 * - Success/failure icons per item
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 17
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { Icon, PanelAwareModal } from '@/components';
import type { MailAttachmentMeta } from '@/types/mail';
import { saveAttachmentsBulk, type BulkSaveResult, type SaveResult } from '@/services/mail/saveToAlbumService';

// ============================================================
// Types
// ============================================================

export interface BulkSaveSheetProps {
  visible: boolean;
  uid: number;
  folder: string;
  accountId: string;
  attachments: MailAttachmentMeta[];
  onComplete: (result: BulkSaveResult) => void;
  onClose: () => void;
}

type ItemStatus = 'pending' | 'saving' | 'success' | 'failed';

interface ItemState {
  attachment: MailAttachmentMeta;
  status: ItemStatus;
  progress: number;
}

// ============================================================
// Helpers
// ============================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// Component
// ============================================================

export function BulkSaveSheet({
  visible,
  uid,
  folder,
  accountId,
  attachments,
  onComplete,
  onClose,
}: BulkSaveSheetProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { triggerHaptic } = useFeedback();

  const [items, setItems] = useState<ItemState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize items
  useEffect(() => {
    if (visible) {
      setItems(
        attachments.map(a => ({
          attachment: a,
          status: 'pending',
          progress: 0,
        })),
      );
      setIsSaving(false);
      setIsComplete(false);
    }
  }, [visible, attachments]);

  // ============================================================
  // Save All
  // ============================================================

  const handleSaveAll = useCallback(async () => {
    triggerHaptic('tap');
    setIsSaving(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const bulkItems = attachments.map(a => ({
      uid,
      folder,
      attachment: a,
      accountId,
    }));

    const result = await saveAttachmentsBulk(
      bulkItems,
      (index, total, progress) => {
        setItems(prev =>
          prev.map((item, i) => {
            if (i < index) return { ...item, status: 'success', progress: 1 };
            if (i === index) return { ...item, status: 'saving', progress: progress.percentage / 100 };
            return item;
          }),
        );
      },
      controller.signal,
    );

    // Update final statuses
    setItems(prev =>
      prev.map((item, i) => ({
        ...item,
        status: result.results[i]?.success ? 'success' : 'failed',
        progress: 1,
      })),
    );

    setIsSaving(false);
    setIsComplete(true);
    onComplete(result);
  }, [attachments, uid, folder, accountId, onComplete]);

  const handleCancel = useCallback(() => {
    triggerHaptic('tap');
    abortControllerRef.current?.abort();
  }, []);

  const handleClose = useCallback(() => {
    triggerHaptic('tap');
    abortControllerRef.current?.abort();
    onClose();
  }, [onClose]);

  // ============================================================
  // Render
  // ============================================================

  const savedCount = items.filter(i => i.status === 'success').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  return (
    <PanelAwareModal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {t('modules.mail.detail.saveAllPhotos', { count: attachments.length })}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            onLongPress={() => {}}
            delayLongPress={300}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Icon name="close" size={24} color={themeColors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Items list */}
        <ScrollView contentContainerStyle={styles.listContent}>
          {items.map((item, index) => (
            <View
              key={index}
              style={[styles.itemRow, { borderBottomColor: themeColors.border }]}
            >
              {/* Status icon */}
              <View style={styles.statusIcon}>
                {item.status === 'pending' && (
                  <Icon name="image" size={20} color={themeColors.textSecondary} />
                )}
                {item.status === 'saving' && (
                  <ActivityIndicator size="small" color={accentColor.primary} />
                )}
                {item.status === 'success' && (
                  <Icon name="check" size={20} color="#4CAF50" />
                )}
                {item.status === 'failed' && (
                  <Icon name="warning" size={20} color="#F44336" />
                )}
              </View>

              {/* File info */}
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {item.attachment.name}
                </Text>
                <Text style={[styles.itemSize, { color: themeColors.textSecondary }]}>
                  {formatFileSize(item.attachment.size)}
                </Text>
              </View>

              {/* Progress */}
              {item.status === 'saving' && (
                <Text style={[styles.progressText, { color: accentColor.primary }]}>
                  {Math.round(item.progress * 100)}%
                </Text>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Action bar */}
        <View style={[styles.actionBar, { borderTopColor: themeColors.border }]}>
          {isComplete ? (
            <View style={styles.resultRow}>
              <Text style={[styles.resultText, { color: themeColors.textPrimary }]}>
                {t('modules.mail.detail.saveComplete', { saved: savedCount, failed: failedCount })}
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: accentColor.primary }]}
                onPress={handleClose}
                onLongPress={() => {}}
                delayLongPress={300}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Text style={styles.actionButtonText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          ) : isSaving ? (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#F44336' }]}
              onPress={handleCancel}
              onLongPress={() => {}}
              delayLongPress={300}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.actionButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: accentColor.primary }]}
              onPress={handleSaveAll}
              onLongPress={() => {}}
              delayLongPress={300}
              accessibilityRole="button"
              accessibilityLabel={t('modules.mail.detail.saveAllButton')}
            >
              <Icon name="download" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>
                {t('modules.mail.detail.saveAllButton')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
    flex: 1,
  },
  closeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingVertical: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  statusIcon: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    ...typography.body,
    fontWeight: '500',
  },
  itemSize: {
    ...typography.small,
  },
  progressText: {
    ...typography.body,
    fontWeight: '700',
  },
  actionBar: {
    borderTopWidth: 1,
    padding: spacing.lg,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  resultText: {
    ...typography.body,
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
