/**
 * MailComposeScreen — Compose and send emails
 *
 * Supports:
 * - New message, reply, and forward
 * - To/CC recipients
 * - Subject and body input
 * - Send via SMTP bridge
 *
 * Senior-inclusive design:
 * - Large input fields (≥60pt height)
 * - Clear labels above fields
 * - Prominent send button
 * - Confirmation before discarding draft
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { Icon } from '@/components';
import type { MailAccount, CachedMailHeader, MailBody, MailAttachment } from '@/types/mail';
import { parseEmailAddress } from '@/types/mail';
import { AttachmentPreviewBar } from '@/components/mail/AttachmentPreviewBar';
import { AlbumPickerModal } from '@/components/mail/AlbumPickerModal';
import {
  buildAttachment,
  compressImageIfNeeded,
  isImageType,
  wouldExceedTotalSize,
} from '@/services/mail/mediaAttachmentService';

// ============================================================
// Types
// ============================================================

export type ComposeMode = 'new' | 'reply' | 'forward';

export interface MailComposeScreenProps {
  /** Current account for sending */
  account: MailAccount;
  /** Compose mode */
  mode: ComposeMode;
  /** Original header (for reply/forward) */
  originalHeader?: CachedMailHeader;
  /** Original body (for forward) */
  originalBody?: MailBody | null;
  /** Go back / close compose */
  onClose: () => void;
  /** Called after successful send */
  onSent?: () => void;
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
// Helpers
// ============================================================

function getInitialTo(mode: ComposeMode, header?: CachedMailHeader): string {
  if (mode === 'reply' && header) {
    const parsed = parseEmailAddress(header.from);
    return parsed.address;
  }
  return '';
}

function getInitialSubject(
  mode: ComposeMode,
  header?: CachedMailHeader,
  t?: (key: string) => string,
): string {
  if (!header) return '';
  const subject = header.subject || '';

  if (mode === 'reply') {
    if (subject.toLowerCase().startsWith('re:')) return subject;
    return `Re: ${subject}`;
  }
  if (mode === 'forward') {
    if (subject.toLowerCase().startsWith('fwd:') || subject.toLowerCase().startsWith('fw:')) {
      return subject;
    }
    return `Fwd: ${subject}`;
  }
  return '';
}

function getInitialBody(
  mode: ComposeMode,
  header?: CachedMailHeader,
  body?: MailBody | null,
  t?: (key: string, opts?: Record<string, string>) => string,
): string {
  if (mode === 'forward' && body) {
    const originalText = body.plainText || body.html?.replace(/<[^>]*>/g, '') || '';
    const senderParsed = parseEmailAddress(header?.from || '');
    const senderDisplay = senderParsed.name || senderParsed.address;

    return `\n\n--- ${t?.('modules.mail.compose.forwardedMessage') || 'Forwarded message'} ---\n${t?.('modules.mail.compose.fromLabel') || 'From'}: ${senderDisplay}\n${t?.('modules.mail.compose.subjectLabel') || 'Subject'}: ${header?.subject || ''}\n\n${originalText}`;
  }
  if (mode === 'reply' && header) {
    const senderParsed = parseEmailAddress(header.from);
    const senderDisplay = senderParsed.name || senderParsed.address;

    return `\n\n${t?.('modules.mail.compose.replyPrefix', { sender: senderDisplay }) || `On ${header.date}, ${senderDisplay} wrote:`}\n`;
  }
  return '';
}

// ============================================================
// Component
// ============================================================

export function MailComposeScreen({
  account,
  mode,
  originalHeader,
  originalBody,
  onClose,
  onSent,
}: MailComposeScreenProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();

  // Form state
  const [to, setTo] = useState(getInitialTo(mode, originalHeader));
  const [cc, setCc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(getInitialSubject(mode, originalHeader, t));
  const [body, setBody] = useState(getInitialBody(mode, originalHeader, originalBody, t));
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);

  const bodyInputRef = useRef<TextInput>(null);

  // ============================================================
  // Validation
  // ============================================================

  const isValid = to.trim().length > 0 && to.includes('@');

  // ============================================================
  // Send
  // ============================================================

  const handleSend = useCallback(async () => {
    if (!isValid || isSending) return;

    triggerHaptic();
    setIsSending(true);

    try {
      const smtpBridge = await import('@/services/mail/smtpBridge');
      const credentialManager = await import('@/services/mail/credentialManager');

      const credentials = await credentialManager.getCredentials(account.id);
      if (!credentials) {
        throw new Error(t('modules.mail.compose.noCredentials'));
      }

      const smtpConfig = credentialManager.buildSMTPConfig(credentials);

      // Parse recipients
      const toAddresses = to
        .split(/[,;]/)
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0)
        .map(addr => parseEmailAddress(addr));

      const ccAddresses = cc
        .split(/[,;]/)
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0)
        .map(addr => parseEmailAddress(addr));

      await smtpBridge.sendMessage({
        smtpConfig,
        from: { name: account.displayName, address: account.email },
        to: toAddresses,
        cc: ccAddresses.length > 0 ? ccAddresses : undefined,
        subject,
        body,
      });

      onSent?.();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(
        t('modules.mail.compose.sendFailed'),
        t('modules.mail.compose.sendFailedMessage'),
      );
    } finally {
      setIsSending(false);
    }
  }, [isValid, isSending, to, cc, subject, body, account, onClose, onSent, t]);

  // ============================================================
  // Close with Draft Warning
  // ============================================================

  const handleClose = useCallback(() => {
    triggerHaptic();

    // Check if there's any content to discard
    const hasContent = to.trim().length > 0 || subject.trim().length > 0 || body.trim().length > 0;

    if (hasContent) {
      Alert.alert(
        t('modules.mail.compose.discardTitle'),
        t('modules.mail.compose.discardMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('modules.mail.compose.discard'),
            style: 'destructive',
            onPress: onClose,
          },
        ],
      );
    } else {
      onClose();
    }
  }, [to, subject, body, onClose, t]);

  // ============================================================
  // Attachments
  // ============================================================

  const handleAddPhotos = useCallback(
    async (photos: Array<{ uri: string; fileName: string; fileSize: number; mimeType: string }>) => {
      for (const photo of photos) {
        if (wouldExceedTotalSize(attachments, photo.fileSize)) {
          Alert.alert(
            t('modules.mail.compose.totalSizeExceeded'),
            t('modules.mail.compose.totalSizeWarning'),
          );
          break;
        }

        const attachment = buildAttachment(
          photo.uri,
          photo.fileName,
          photo.mimeType,
          photo.fileSize,
        );

        // Compress images if needed
        if (isImageType(photo.mimeType)) {
          const result = await compressImageIfNeeded(photo.uri, photo.fileSize);
          attachment.localUri = result.localUri;
          attachment.compressedSize = result.compressedSize;
          attachment.compressionStatus = result.status === 'done' ? 'done' : 'failed';
        } else {
          attachment.compressionStatus = 'done';
        }

        setAttachments(prev => [...prev, attachment]);
      }
    },
    [attachments, t],
  );

  const handleRemoveAttachment = useCallback((id: string) => {
    triggerHaptic();
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  // ============================================================
  // Title
  // ============================================================

  const title = mode === 'reply'
    ? t('modules.mail.compose.replyTitle')
    : mode === 'forward'
      ? t('modules.mail.compose.forwardTitle')
      : t('modules.mail.compose.newTitle');

  // ============================================================
  // Render
  // ============================================================

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          onLongPress={() => {}}
          delayLongPress={300}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          <Text style={[styles.closeText, { color: accentColor.primary }]}>
            {t('common.cancel')}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: themeColors.textPrimary }]}>
          {title}
        </Text>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => {
              triggerHaptic();
              setShowAlbumPicker(true);
            }}
            onLongPress={() => {}}
            delayLongPress={300}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('modules.mail.compose.attachPhoto')}
          >
            <Icon name="attach" size={22} color={accentColor.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: isValid ? accentColor.primary : themeColors.border },
            ]}
            onPress={handleSend}
            onLongPress={() => {}}
            delayLongPress={300}
            activeOpacity={0.7}
            disabled={!isValid || isSending}
            accessibilityRole="button"
            accessibilityLabel={t('modules.mail.compose.send')}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Icon name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* From */}
        <View style={[styles.fieldRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
            {t('modules.mail.compose.from')}
          </Text>
          <Text style={[styles.fieldValue, { color: themeColors.textPrimary }]}>
            {account.email}
          </Text>
        </View>

        {/* To */}
        <View style={[styles.fieldRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
            {t('modules.mail.compose.to')}
          </Text>
          <TextInput
            style={[styles.fieldInput, { color: themeColors.textPrimary }]}
            value={to}
            onChangeText={setTo}
            placeholder={t('modules.mail.compose.toPlaceholder')}
            placeholderTextColor={themeColors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel={t('modules.mail.compose.to')}
          />
          {!showCc && (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic();
                setShowCc(true);
              }}
              onLongPress={() => {}}
              delayLongPress={300}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('modules.mail.compose.addCc')}
            >
              <Text style={[styles.ccToggle, { color: accentColor.primary }]}>CC</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* CC (optional) */}
        {showCc && (
          <View style={[styles.fieldRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
              CC
            </Text>
            <TextInput
              style={[styles.fieldInput, { color: themeColors.textPrimary }]}
              value={cc}
              onChangeText={setCc}
              placeholder={t('modules.mail.compose.ccPlaceholder')}
              placeholderTextColor={themeColors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              accessibilityLabel="CC"
            />
          </View>
        )}

        {/* Subject */}
        <View style={[styles.fieldRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
            {t('modules.mail.compose.subject')}
          </Text>
          <TextInput
            style={[styles.fieldInput, { color: themeColors.textPrimary }]}
            value={subject}
            onChangeText={setSubject}
            placeholder={t('modules.mail.compose.subjectPlaceholder')}
            placeholderTextColor={themeColors.textSecondary}
            returnKeyType="next"
            onSubmitEditing={() => bodyInputRef.current?.focus()}
            accessibilityLabel={t('modules.mail.compose.subject')}
          />
        </View>

        {/* Attachments */}
        {attachments.length > 0 && (
          <View style={styles.attachmentSection}>
            <AttachmentPreviewBar
              attachments={attachments}
              onRemove={handleRemoveAttachment}
            />
          </View>
        )}

        {/* Body */}
        <TextInput
          ref={bodyInputRef}
          style={[styles.bodyInput, { color: themeColors.textPrimary }]}
          value={body}
          onChangeText={setBody}
          placeholder={t('modules.mail.compose.bodyPlaceholder')}
          placeholderTextColor={themeColors.textSecondary}
          multiline
          textAlignVertical="top"
          accessibilityLabel={t('modules.mail.compose.body')}
        />
      </ScrollView>

      {/* Album Picker Modal */}
      <AlbumPickerModal
        visible={showAlbumPicker}
        onSelect={handleAddPhotos}
        onClose={() => setShowAlbumPicker(false)}
      />
    </KeyboardAvoidingView>
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
  closeButton: {
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  closeText: {
    ...typography.body,
    fontWeight: '600',
  },
  title: {
    ...typography.body,
    fontWeight: '700',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  attachButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.body,
    fontWeight: '600',
    width: 60,
  },
  fieldValue: {
    ...typography.body,
    flex: 1,
  },
  fieldInput: {
    ...typography.body,
    flex: 1,
    minHeight: touchTargets.minimum,
    paddingVertical: 0,
  },
  ccToggle: {
    ...typography.body,
    fontWeight: '700',
  },
  attachmentSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  bodyInput: {
    ...typography.body,
    flex: 1,
    minHeight: 200,
    padding: spacing.lg,
    lineHeight: 28,
  },
});
