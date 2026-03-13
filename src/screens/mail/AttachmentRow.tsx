/**
 * AttachmentRow — Displays a single mail attachment with download/save actions
 *
 * Extracted from MailDetailScreen for better separation of concerns.
 *
 * Features:
 * - Download and preview via contentRouter
 * - Save to photo album for image/video attachments
 * - File type icon mapping
 * - Senior-inclusive touch targets (≥60pt)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { Icon, ErrorView } from '@/components';
import type { MailAttachmentMeta } from '@/types/mail';
import { canSaveToAlbum } from '@/services/mail/mediaAttachmentService';
import { downloadAndPreview } from '@/services/mail/contentRouter';
import { formatFileSize, getAttachmentIconName } from './mailDetailHelpers';

// ============================================================
// Props
// ============================================================

export interface AttachmentRowProps {
  attachment: MailAttachmentMeta;
  uid: number;
  folder: string;
  accountId: string;
}

// ============================================================
// Component
// ============================================================

export function AttachmentRow({ attachment, uid, folder, accountId }: AttachmentRowProps) {
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { t } = useTranslation();
  const { triggerHaptic } = useFeedback();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);

  const isSaveable = canSaveToAlbum(attachment.mimeType);

  const handleDownload = useCallback(async () => {
    triggerHaptic('tap');
    setIsDownloading(true);
    try {
      const result = await downloadAndPreview(
        uid,
        folder,
        attachment.index,
        attachment.name,
        attachment.mimeType,
      );
      if (!result.handled) {
        setNotification({
          type: 'error',
          title: t('modules.mail.detail.downloadFailed'),
          message: result.error || t('modules.mail.detail.downloadFailedMessage'),
        });
      }
    } catch {
      setNotification({
        type: 'error',
        title: t('modules.mail.detail.downloadFailed'),
        message: t('modules.mail.detail.downloadFailedMessage'),
      });
    } finally {
      setIsDownloading(false);
    }
  }, [uid, folder, attachment, t]);

  const handleSaveToAlbum = useCallback(async () => {
    triggerHaptic('tap');
    setIsSaving(true);
    setSaveResult(null);
    try {
      const { saveAttachmentToAlbum } = await import('@/services/mail/saveToAlbumService');
      const result = await saveAttachmentToAlbum(uid, folder, attachment, accountId);
      setSaveResult(result.success ? 'success' : 'error');
      if (result.success) {
        setNotification({
          type: 'success',
          title: t('modules.mail.detail.savedToAlbum'),
          message: attachment.name,
        });
      } else {
        setNotification({
          type: 'error',
          title: t('modules.mail.detail.saveToAlbumFailed'),
          message: t('modules.mail.detail.saveToAlbumFailedMessage'),
        });
      }
    } catch {
      setSaveResult('error');
      setNotification({
        type: 'error',
        title: t('modules.mail.detail.saveToAlbumFailed'),
        message: t('modules.mail.detail.saveToAlbumFailedMessage'),
      });
    } finally {
      setIsSaving(false);
    }
  }, [uid, folder, attachment, accountId, t]);

  const iconName = getAttachmentIconName(attachment.mimeType);

  return (
    <View>
      {notification && (
        <ErrorView
          type={notification.type}
          title={notification.title}
          message={notification.message}
          autoDismiss={notification.type === 'success' || notification.type === 'info' ? 3000 : undefined}
          onDismiss={() => setNotification(null)}
        />
      )}
    <View style={[styles.attachmentRow, { borderColor: themeColors.border }]}>
      <HapticTouchable hapticDisabled
        style={styles.attachmentMainArea}
        onPress={handleDownload}
        activeOpacity={0.7}
        disabled={isDownloading}
        accessibilityRole="button"
        accessibilityLabel={`${t('modules.mail.detail.downloadAttachment')}: ${attachment.name}`}
      >
        <Icon name={iconName} size={24} color={accentColor.primary} />
        <View style={styles.attachmentInfo}>
          <Text
            style={[styles.attachmentName, { color: themeColors.textPrimary }]}
            numberOfLines={1}
          >
            {attachment.name}
          </Text>
          <Text style={[styles.attachmentSize, { color: themeColors.textSecondary }]}>
            {formatFileSize(attachment.size)}
          </Text>
        </View>
        {isDownloading ? (
          <ActivityIndicator size="small" color={accentColor.primary} />
        ) : (
          <Icon name="download" size={20} color={accentColor.primary} />
        )}
      </HapticTouchable>

      {/* Save to album button for images/videos */}
      {isSaveable && (
        <HapticTouchable hapticDisabled
          style={[
            styles.saveToAlbumButton,
            saveResult === 'success' && { backgroundColor: '#E8F5E9' },
          ]}
          onPress={handleSaveToAlbum}
          activeOpacity={0.7}
          disabled={isSaving || saveResult === 'success'}
          accessibilityRole="button"
          accessibilityLabel={t('modules.mail.detail.saveToAlbum')}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={accentColor.primary} />
          ) : saveResult === 'success' ? (
            <Icon name="check" size={18} color="#4CAF50" />
          ) : (
            <Icon name="image" size={18} color={accentColor.primary} />
          )}
        </HapticTouchable>
      )}
    </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  attachmentMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    ...typography.body,
    fontWeight: '600',
  },
  attachmentSize: {
    ...typography.small,
  },
  saveToAlbumButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0,0,0,0.1)',
  },
});

export default AttachmentRow;
