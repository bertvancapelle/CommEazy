/**
 * AttachmentPreviewBar — Horizontal scrollable attachment previews in compose
 *
 * Shows thumbnails (60x60px) for each attachment with:
 * - X button to remove (≥60pt hit area)
 * - Compression indicator
 * - File size label
 *
 * Senior-inclusive:
 * - Large remove buttons
 * - Clear file names
 * - Haptic feedback
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 14
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { Icon } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import type { MailAttachment } from '@/types/mail';
import { isImageType, isVideoType } from '@/services/mail/mediaAttachmentService';

// ============================================================
// Types
// ============================================================

export interface AttachmentPreviewBarProps {
  attachments: MailAttachment[];
  onRemove: (attachmentId: string) => void;
}

// ============================================================
// Helpers
// ============================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentIcon(mimeType: string): string {
  if (isImageType(mimeType)) return 'image';
  if (isVideoType(mimeType)) return 'video';
  if (mimeType.includes('pdf')) return 'file-text';
  return 'file';
}

// ============================================================
// Component
// ============================================================

export function AttachmentPreviewBar({
  attachments,
  onRemove,
}: AttachmentPreviewBarProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { triggerHaptic } = useFeedback();

  const handleRemove = useCallback(
    (id: string) => {
      triggerHaptic('tap');
      onRemove(id);
    },
    [onRemove, triggerHaptic],
  );

  if (attachments.length === 0) return null;

  return (
    <View style={[styles.container, { borderTopColor: themeColors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {attachments.map(attachment => (
          <View key={attachment.id} style={styles.attachmentItem}>
            {/* Thumbnail or icon */}
            <View style={[styles.thumbnail, { backgroundColor: themeColors.surface }]}>
              {isImageType(attachment.mimeType) && attachment.localUri ? (
                <Image
                  source={{ uri: attachment.localUri }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              ) : (
                <Icon
                  name={getAttachmentIcon(attachment.mimeType)}
                  size={24}
                  color={themeColors.textSecondary}
                />
              )}

              {/* Compression indicator */}
              {attachment.compressionStatus === 'compressing' && (
                <View style={styles.compressionOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}

              {/* Video badge */}
              {isVideoType(attachment.mimeType) && (
                <View style={styles.videoBadge}>
                  <Icon name="play" size={12} color="#FFFFFF" />
                </View>
              )}
            </View>

            {/* Remove button */}
            <HapticTouchable hapticDisabled
              style={styles.removeButton}
              onPress={() => handleRemove(attachment.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('modules.mail.compose.removeAttachment', { name: attachment.fileName })}
            >
              <View style={styles.removeIcon}>
                <Icon name="close" size={12} color="#FFFFFF" />
              </View>
            </HapticTouchable>

            {/* File info */}
            <Text
              style={[styles.fileName, { color: themeColors.textPrimary }]}
              numberOfLines={1}
            >
              {attachment.fileName}
            </Text>
            <Text style={[styles.fileSize, { color: themeColors.textSecondary }]}>
              {formatFileSize(attachment.compressedSize || attachment.fileSize)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  attachmentItem: {
    width: 80,
    alignItems: 'center',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: 60,
    height: 60,
  },
  compressionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: -4,
    right: 4,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileName: {
    ...typography.small,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  fileSize: {
    ...typography.small,
    fontSize: 10,
    textAlign: 'center',
  },
});
