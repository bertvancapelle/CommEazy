/**
 * MailDetailScreen — Full message view
 *
 * Displays the full content of an email message including:
 * - Sender, recipients, date
 * - Subject line
 * - HTML or plain text body
 * - Attachment list with download capability
 * - Action buttons (Reply, Forward, Delete)
 *
 * Senior-inclusive design:
 * - Large, clear action buttons (≥60pt)
 * - High contrast text
 * - Haptic feedback on all actions
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { Icon } from '@/components';
import type {
  CachedMailHeader,
  MailBody,
  MailAttachmentMeta,
  MailAccount,
} from '@/types/mail';
import { parseEmailAddress } from '@/types/mail';

// ============================================================
// Types
// ============================================================

export interface MailDetailScreenProps {
  /** Mail header to display */
  header: CachedMailHeader;
  /** Current account */
  account: MailAccount;
  /** Go back to inbox */
  onBack: () => void;
  /** Open compose for reply */
  onReply?: (header: CachedMailHeader) => void;
  /** Open compose for forward */
  onForward?: (header: CachedMailHeader, body: MailBody | null) => void;
  /** Called after message is deleted */
  onDeleted?: (uid: number) => void;
}

// ============================================================
// Haptic Helper
// ============================================================

const triggerHaptic = () => {
  const options = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };
  const hapticType = Platform.select({
    ios: 'impactMedium',
    android: 'effectClick',
    default: 'impactMedium',
  }) as string;
  ReactNativeHapticFeedback.trigger(hapticType, options);
};

// ============================================================
// Date Formatting (Detailed)
// ============================================================

function formatDetailDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString([], {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

// ============================================================
// Attachment Size Formatting
// ============================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// Component
// ============================================================

export function MailDetailScreen({
  header,
  account,
  onBack,
  onReply,
  onForward,
  onDeleted,
}: MailDetailScreenProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { width: screenWidth } = useWindowDimensions();

  // State
  const [body, setBody] = useState<MailBody | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Parse sender
  const senderParsed = parseEmailAddress(header.from);
  const senderName = header.fromName || senderParsed.name || senderParsed.address;
  const senderEmail = header.fromAddress || senderParsed.address;

  // ============================================================
  // Load Body
  // ============================================================

  useEffect(() => {
    const loadBody = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const mailCache = await import('@/services/mail/mailCache');
        const imapBridge = await import('@/services/mail/imapBridge');

        // Try cache first
        try {
          const db = mailCache.getMailCacheDb();
          const cachedBody = mailCache.getBody(db, account.id, header.uid);
          if (cachedBody && mountedRef.current) {
            setBody({
              html: cachedBody.html,
              plainText: cachedBody.plainText,
              attachments: [],
            });
            setIsLoading(false);
            // Still fetch from server to get attachments
          }
        } catch {
          // Cache miss — will fetch from server
        }

        // Fetch from server
        try {
          const serverBody = await imapBridge.fetchMessageBody(header.uid, header.folder);

          // Cache the body
          try {
            const db = mailCache.getMailCacheDb();
            mailCache.upsertBody(db, account.id, header.uid, serverBody.html, serverBody.plainText);
          } catch {
            // Cache write failed — non-critical
          }

          if (mountedRef.current) {
            setBody(serverBody);
          }
        } catch {
          // If we already have cached body, show that
          if (!body && mountedRef.current) {
            setError(t('modules.mail.detail.loadFailed'));
          }
        }

        // Mark as read
        try {
          if (!header.isRead) {
            await imapBridge.markAsRead(header.uid, header.folder);
            const db = mailCache.getMailCacheDb();
            mailCache.updateReadStatus(db, account.id, header.folder, header.uid, true);
          }
        } catch {
          console.debug('[MailDetail] Failed to mark as read');
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (mountedRef.current) setError(message);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    };

    loadBody();
  }, [header.uid, header.folder, account.id]);

  // ============================================================
  // Actions
  // ============================================================

  const handleDelete = useCallback(() => {
    triggerHaptic();
    Alert.alert(
      t('modules.mail.detail.deleteTitle'),
      t('modules.mail.detail.deleteMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const imapBridge = await import('@/services/mail/imapBridge');
              const mailCache = await import('@/services/mail/mailCache');

              await imapBridge.deleteMessage(header.uid, header.folder);

              try {
                const db = mailCache.getMailCacheDb();
                mailCache.deleteHeader(db, account.id, header.folder, header.uid);
              } catch {
                // Cache cleanup failed — non-critical
              }

              onDeleted?.(header.uid);
              onBack();
            } catch {
              Alert.alert(
                t('modules.mail.detail.deleteFailedTitle'),
                t('modules.mail.detail.deleteFailedMessage'),
              );
            }
          },
        },
      ],
    );
  }, [header.uid, header.folder, account.id, onBack, onDeleted, t]);

  const handleReply = useCallback(() => {
    triggerHaptic();
    onReply?.(header);
  }, [header, onReply]);

  const handleForward = useCallback(() => {
    triggerHaptic();
    onForward?.(header, body);
  }, [header, body, onForward]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            triggerHaptic();
            onBack();
          }}
          onLongPress={() => {}}
          delayLongPress={300}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Icon name="chevron-left" size={24} color={accentColor.primary} />
          <Text style={[styles.backText, { color: accentColor.primary }]}>
            {t('common.back')}
          </Text>
        </TouchableOpacity>

        {/* Action buttons */}
        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.actionIcon}
            onPress={handleDelete}
            onLongPress={() => {}}
            delayLongPress={300}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
          >
            <Icon name="trash" size={22} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Body content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header section */}
        <View style={styles.headerSection}>
          {/* Subject */}
          <Text
            style={[styles.subject, { color: themeColors.textPrimary }]}
            accessibilityRole="header"
          >
            {header.subject || t('modules.mail.inbox.noSubject')}
          </Text>

          {/* Sender */}
          <View style={styles.senderRow}>
            <View style={[styles.avatar, { backgroundColor: accentColor.light }]}>
              <Text style={[styles.avatarText, { color: accentColor.primary }]}>
                {(senderName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.senderInfo}>
              <Text style={[styles.senderName, { color: themeColors.textPrimary }]}>
                {senderName}
              </Text>
              <Text style={[styles.senderEmail, { color: themeColors.textSecondary }]}>
                {senderEmail}
              </Text>
            </View>
          </View>

          {/* Recipients & Date */}
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: themeColors.textSecondary }]}>
              {t('modules.mail.detail.to')}:
            </Text>
            <Text
              style={[styles.metaValue, { color: themeColors.textSecondary }]}
              numberOfLines={2}
            >
              {header.to?.join(', ') || account.email}
            </Text>
          </View>
          <Text style={[styles.dateText, { color: themeColors.textSecondary }]}>
            {formatDetailDate(header.date)}
          </Text>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

        {/* Body */}
        {isLoading ? (
          <View style={styles.bodyLoading}>
            <ActivityIndicator size="large" color={accentColor.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              {t('modules.mail.detail.loadingBody')}
            </Text>
          </View>
        ) : error && !body ? (
          <View style={styles.bodyError}>
            <Icon name="warning" size={32} color={themeColors.textSecondary} />
            <Text style={[styles.errorText, { color: themeColors.textPrimary }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: accentColor.primary }]}
              onPress={() => {
                triggerHaptic();
                setError(null);
                setIsLoading(true);
                // Re-trigger load
              }}
              onLongPress={() => {}}
              delayLongPress={300}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('common.tryAgain')}
            >
              <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bodyContainer}>
            <Text
              style={[styles.bodyText, { color: themeColors.textPrimary }]}
              selectable
            >
              {body?.plainText || body?.html?.replace(/<[^>]*>/g, '') || t('modules.mail.detail.noContent')}
            </Text>
          </View>
        )}

        {/* Attachments */}
        {body?.attachments && body.attachments.length > 0 && (
          <View style={styles.attachmentsSection}>
            <Text style={[styles.attachmentsTitle, { color: themeColors.textPrimary }]}>
              {t('modules.mail.detail.attachments', { count: body.attachments.length })}
            </Text>
            {body.attachments.map((attachment) => (
              <AttachmentRow
                key={attachment.index}
                attachment={attachment}
                uid={header.uid}
                folder={header.folder}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
        <TouchableOpacity
          style={[styles.bottomAction, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}
          onPress={handleReply}
          onLongPress={() => {}}
          delayLongPress={300}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('modules.mail.detail.reply')}
        >
          <Icon name="reply" size={22} color={accentColor.primary} />
          <Text style={[styles.bottomActionText, { color: accentColor.primary }]}>
            {t('modules.mail.detail.reply')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomAction, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}
          onPress={handleForward}
          onLongPress={() => {}}
          delayLongPress={300}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('modules.mail.detail.forward')}
        >
          <Icon name="forward" size={22} color={accentColor.primary} />
          <Text style={[styles.bottomActionText, { color: accentColor.primary }]}>
            {t('modules.mail.detail.forward')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================
// AttachmentRow Sub-component
// ============================================================

interface AttachmentRowProps {
  attachment: MailAttachmentMeta;
  uid: number;
  folder: string;
}

function AttachmentRow({ attachment, uid, folder }: AttachmentRowProps) {
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    triggerHaptic();
    setIsDownloading(true);
    try {
      const imapBridge = await import('@/services/mail/imapBridge');
      await imapBridge.fetchAttachmentData(uid, folder, attachment.index);
      // File saved — in future, show share sheet
      Alert.alert(
        t('modules.mail.detail.downloadComplete'),
        attachment.name,
      );
    } catch {
      Alert.alert(
        t('modules.mail.detail.downloadFailed'),
        t('modules.mail.detail.downloadFailedMessage'),
      );
    } finally {
      setIsDownloading(false);
    }
  }, [uid, folder, attachment, t]);

  const iconName = attachment.mimeType.startsWith('image/')
    ? 'image'
    : attachment.mimeType === 'application/pdf'
      ? 'document'
      : 'attach';

  return (
    <TouchableOpacity
      style={[styles.attachmentRow, { borderColor: themeColors.border }]}
      onPress={handleDownload}
      onLongPress={() => {}}
      delayLongPress={300}
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
    </TouchableOpacity>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    gap: spacing.xs,
  },
  backText: {
    ...typography.body,
    fontWeight: '600',
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionIcon: {
    minWidth: touchTargets.minimum,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerSection: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  subject: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.h3,
    fontWeight: '700',
  },
  senderInfo: {
    flex: 1,
  },
  senderName: {
    ...typography.body,
    fontWeight: '700',
  },
  senderEmail: {
    ...typography.small,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  metaLabel: {
    ...typography.small,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  metaValue: {
    ...typography.small,
    flex: 1,
  },
  dateText: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
  },
  bodyLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
  },
  bodyError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    ...typography.body,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bodyContainer: {
    padding: spacing.lg,
  },
  bodyText: {
    ...typography.body,
    lineHeight: 28,
  },
  attachmentsSection: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  attachmentsTitle: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
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
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  bottomAction: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  bottomActionText: {
    ...typography.body,
    fontWeight: '600',
  },
});
