/**
 * MailComposeScreen — Compose, reply, and forward emails
 *
 * Features:
 * - Recipient chips (contacts with ✕ remove)
 * - Inline contact search dropdown (filtered by email)
 * - Manual email address entry
 * - CC/BCC hidden by default with toggle link
 * - HTML preservation for forward/reply with read-only WebView preview
 * - SMTP sends htmlBody for forward/reply
 * - Photo attachments via AlbumPickerModal
 *
 * Senior-inclusive design:
 * - Large input fields (≥60pt height)
 * - 60pt touch targets on all buttons
 * - Clear labels, haptic feedback
 * - Bottom action bar with send button (CommEazy standard)
 * - Recipient chips with large ✕ remove button
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useLabelStyle, useFieldTextStyle, type ResolvedTextStyle } from '@/contexts/FieldTextStyleContext';
import { useFeedback } from '@/hooks/useFeedback';
import { Icon, ScrollViewWithIndicator, ErrorView } from '@/components';
import { useScrollToField } from '@/hooks/useScrollToField';
import type { MailAccount, CachedMailHeader, MailBody, MailAttachment, MailRecipient } from '@/types/mail';
import { parseEmailAddress } from '@/types/mail';
import { AttachmentPreviewBar } from '@/components/mail/AttachmentPreviewBar';
import { AlbumPickerModal } from '@/components/mail/AlbumPickerModal';
import {
  buildAttachment,
  compressImageIfNeeded,
  isImageType,
  wouldExceedTotalSize,
} from '@/services/mail/mediaAttachmentService';
import {
  searchContactsForMail,
  contactToMailRecipient,
  getMailableContacts,
} from '@/services/mail/contactMailService';
import type { Contact } from '@/services/interfaces';
import { SendConfirmationOverlay } from './SendConfirmationOverlay';
import { saveDraft, deleteDraft } from '@/services/mail/draftService';

// ============================================================
// Types
// ============================================================

export type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward';

export interface MailComposeScreenProps {
  /** Current account for sending */
  account: MailAccount;
  /** Compose mode */
  mode: ComposeMode;
  /** Original header (for reply/forward) */
  originalHeader?: CachedMailHeader;
  /** Original body (for forward/reply) */
  originalBody?: MailBody | null;
  /** Go back / close compose */
  onClose: () => void;
  /** Called after successful send */
  onSent?: () => void;
  /** Pre-fill from a restored draft */
  restoredDraft?: {
    to: MailRecipient[];
    cc: MailRecipient[];
    bcc: MailRecipient[];
    subject: string;
    body: string;
  };
}

// ============================================================
// Helpers
// ============================================================

function getInitialRecipients(
  mode: ComposeMode,
  header?: CachedMailHeader,
  accountEmail?: string,
): MailRecipient[] {
  if ((mode === 'reply' || mode === 'replyAll') && header) {
    const parsed = parseEmailAddress(header.from);
    const recipients: MailRecipient[] = [
      {
        email: parsed.address,
        name: parsed.name,
        isFromContacts: false,
      },
    ];

    // For Reply All, add all To recipients (excluding self and sender)
    if (mode === 'replyAll') {
      const addedEmails = new Set([parsed.address.toLowerCase()]);
      if (accountEmail) addedEmails.add(accountEmail.toLowerCase());

      for (const addr of header.to) {
        const toParsed = parseEmailAddress(addr);
        if (!addedEmails.has(toParsed.address.toLowerCase())) {
          addedEmails.add(toParsed.address.toLowerCase());
          recipients.push({
            email: toParsed.address,
            name: toParsed.name,
            isFromContacts: false,
          });
        }
      }
    }

    return recipients;
  }
  return [];
}

function getInitialSubject(
  mode: ComposeMode,
  header?: CachedMailHeader,
): string {
  if (!header) return '';
  const subject = header.subject || '';

  if (mode === 'reply' || mode === 'replyAll') {
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
  if ((mode === 'reply' || mode === 'replyAll') && header) {
    const senderParsed = parseEmailAddress(header.from);
    const senderDisplay = senderParsed.name || senderParsed.address;
    return `\n\n${t?.('modules.mail.compose.replyPrefix', { sender: senderDisplay }) || `On ${header.date}, ${senderDisplay} wrote:`}\n`;
  }
  // For forward: body text is empty, original message shown in WebView preview
  if (mode === 'forward') {
    return '';
  }
  return '';
}

/**
 * Get the original HTML content for forward/reply preview.
 * Returns the raw HTML if available, or wraps plain text in basic HTML.
 */
function getOriginalHtml(body?: MailBody | null): string | null {
  if (!body) return null;
  if (body.html) return body.html;
  if (body.plainText) {
    // Wrap plain text in HTML with basic formatting
    const escaped = body.plainText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return `<p>${escaped}</p>`;
  }
  return null;
}

/**
 * Build HTML for the read-only original message preview.
 * Simplified version of the MailDetailScreen buildWebViewHtml.
 */
function buildPreviewHtml(
  rawHtml: string,
  textColor: string,
  backgroundColor: string,
): string {
  // Strip <script> tags for security
  const noScripts = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Strip MSO conditional comments
  const noMso = noScripts
    .replace(/<!--\[if\s[^\]]*mso[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, '');

  // Extract body content if full HTML document
  let bodyContent = noMso;
  const hasDocStructure = /<html[\s>]/i.test(noMso);
  if (hasDocStructure) {
    const bodyMatch = noMso.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const headMatch = noMso.match(/<head[^>]*>([\s\S]*)<\/head>/i);
    const headStyles = headMatch
      ? (headMatch[1].match(/<style[\s\S]*?<\/style>/gi) || []).join('\n')
      : '';
    bodyContent = `${headStyles}\n${bodyMatch ? bodyMatch[1] : noMso}`;
  }

  // CSP: block external images in preview
  const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none';`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 8px;
      font-family: -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: ${textColor};
      background-color: ${backgroundColor};
      word-wrap: break-word;
      overflow-wrap: break-word;
      -webkit-text-size-adjust: 100%;
    }
    img { max-width: 100%; height: auto; }
    table { max-width: 100%; border-collapse: collapse; }
    td, th { vertical-align: top; }
    body > table, body > div > table { width: 100% !important; max-width: 100% !important; }
    td { word-break: break-word; }
    img[width="1"], img[height="1"],
    img[style*="display:none"], img[style*="display: none"] { display: none !important; }
    pre, code { font-size: 14px; white-space: pre-wrap; word-wrap: break-word; }
  </style>
</head>
<body>
${bodyContent}
<script>
  function reportHeight() {
    var h = Math.max(
      document.body.scrollHeight || 0,
      document.body.offsetHeight || 0,
      document.documentElement.scrollHeight || 0,
      document.documentElement.offsetHeight || 0
    );
    if (h > 0) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
    }
  }
  window.addEventListener('load', function() {
    reportHeight();
    setTimeout(reportHeight, 200);
    setTimeout(reportHeight, 600);
  });
</script>
</body>
</html>`;
}

// ============================================================
// RecipientChip Sub-Component
// ============================================================

function RecipientChip({
  recipient,
  onRemove,
  accentColor,
  themeColors,
}: {
  recipient: MailRecipient;
  onRemove: () => void;
  accentColor: string;
  themeColors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const { triggerHaptic } = useFeedback();
  const displayName = recipient.name || recipient.email;

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: accentColor + '20', borderColor: accentColor + '40' },
      ]}
    >
      <Text
        style={[styles.chipText, { color: themeColors.textPrimary }]}
        numberOfLines={1}
      >
        {displayName}
      </Text>
      <HapticTouchable hapticDisabled
        style={styles.chipRemove}
        onPress={() => {
          triggerHaptic('tap');
          onRemove();
        }}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        accessibilityRole="button"
        accessibilityLabel={t('modules.mail.compose.removeRecipient')}
      >
        <Icon name="x" size={16} color={themeColors.textSecondary} />
      </HapticTouchable>
    </View>
  );
}

// ============================================================
// ContactSuggestionRow Sub-Component
// ============================================================

function ContactSuggestionRow({
  contact,
  onSelect,
  accentColor,
  themeColors,
}: {
  contact: Contact;
  onSelect: () => void;
  accentColor: { primary: string; light: string };
  themeColors: ReturnType<typeof useColors>;
}) {
  const { triggerHaptic } = useFeedback();
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const initial = (contact.firstName[0] || '').toUpperCase();

  return (
    <HapticTouchable hapticDisabled
      style={[styles.suggestionRow, { borderBottomColor: themeColors.border }]}
      onPress={() => {
        triggerHaptic('tap');
        onSelect();
      }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${fullName}, ${contact.email}`}
    >
      <View style={[styles.suggestionAvatar, { backgroundColor: accentColor.light }]}>
        <Text style={[styles.suggestionAvatarText, { color: accentColor.primary }]}>
          {initial}
        </Text>
      </View>
      <View style={styles.suggestionInfo}>
        <Text
          style={[styles.suggestionName, { color: themeColors.textPrimary }]}
          numberOfLines={1}
        >
          {fullName}
        </Text>
        <Text
          style={[styles.suggestionEmail, { color: themeColors.textSecondary }]}
          numberOfLines={1}
        >
          {contact.email}
        </Text>
      </View>
    </HapticTouchable>
  );
}

// ============================================================
// SelfSuggestionRow Sub-Component — "Aan mezelf"
// ============================================================

function SelfSuggestionRow({
  email,
  onSelect,
  accentColor,
  themeColors,
  label,
}: {
  email: string;
  onSelect: () => void;
  accentColor: { primary: string; light: string };
  themeColors: ReturnType<typeof useColors>;
  label: string;
}) {
  const { triggerHaptic } = useFeedback();
  return (
    <HapticTouchable hapticDisabled
      style={[styles.suggestionRow, { borderBottomColor: themeColors.border }]}
      onPress={() => {
        triggerHaptic('tap');
        onSelect();
      }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${email}`}
    >
      <View style={[styles.suggestionAvatar, { backgroundColor: accentColor.primary }]}>
        <Icon name="user" size={20} color="white" />
      </View>
      <View style={styles.suggestionInfo}>
        <Text
          style={[styles.suggestionName, { color: themeColors.textPrimary }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          style={[styles.suggestionEmail, { color: themeColors.textSecondary }]}
          numberOfLines={1}
        >
          {email}
        </Text>
      </View>
    </HapticTouchable>
  );
}

// ============================================================
// RecipientField Sub-Component
// ============================================================

function RecipientField({
  label,
  recipients,
  onAddRecipient,
  onRemoveRecipient,
  contacts,
  accentColor,
  themeColors,
  labelStyle,
  fieldTextStyle,
  placeholder,
  accountEmail,
  accountDisplayName,
  onInputFocus,
}: {
  label: string;
  recipients: MailRecipient[];
  onAddRecipient: (recipient: MailRecipient) => void;
  onRemoveRecipient: (email: string) => void;
  contacts: Contact[];
  accentColor: { primary: string; light: string };
  themeColors: ReturnType<typeof useColors>;
  labelStyle: ResolvedTextStyle;
  fieldTextStyle: ResolvedTextStyle;
  placeholder: string;
  /** Account email for "To myself" suggestion */
  accountEmail?: string;
  /** Account display name for "To myself" chip */
  accountDisplayName?: string;
  /** Called when the recipient input is focused (for scroll-to-field) */
  onInputFocus?: () => void;
}) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Determine if own email is already added as recipient
  const isSelfAlreadyAdded = useMemo(() => {
    if (!accountEmail) return true; // Hide self-row if no account email
    return recipients.some(r => r.email.toLowerCase() === accountEmail.toLowerCase());
  }, [recipients, accountEmail]);

  // Filter contacts by search query, excluding already-added recipients
  const suggestions = useMemo(() => {
    const addedEmails = new Set(recipients.map(r => r.email.toLowerCase()));
    if (inputValue.length < 2) {
      // Show all contacts (max 5) when input is empty/short — enables browsing on focus
      return contacts
        .filter(c => !addedEmails.has((c.email || '').toLowerCase()))
        .slice(0, 5);
    }
    return searchContactsForMail(contacts, inputValue, 5).filter(
      c => !addedEmails.has((c.email || '').toLowerCase()),
    );
  }, [inputValue, contacts, recipients]);

  // Show suggestions when there are contacts or self to show
  const hasSuggestionsToShow = showSuggestions && (suggestions.length > 0 || !isSelfAlreadyAdded);

  const handleSelectContact = useCallback(
    (contact: Contact) => {
      const recipient = contactToMailRecipient(contact);
      if (recipient) {
        onAddRecipient(recipient);
      }
      setInputValue('');
      setShowSuggestions(false);
    },
    [onAddRecipient],
  );

  const handleSelectSelf = useCallback(() => {
    if (!accountEmail) return;
    onAddRecipient({
      email: accountEmail,
      name: accountDisplayName,
      isFromContacts: false,
    });
    setInputValue('');
    setShowSuggestions(false);
  }, [accountEmail, accountDisplayName, onAddRecipient]);

  const handleSubmitManualAddress = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed.length === 0) return;

    // Basic email validation — user@domain.tld format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return;

    // Check for duplicates
    const exists = recipients.some(
      r => r.email.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      setInputValue('');
      return;
    }

    onAddRecipient({
      email: trimmed,
      isFromContacts: false,
    });
    setInputValue('');
    setShowSuggestions(false);
  }, [inputValue, recipients, onAddRecipient]);

  const handleChangeText = useCallback((text: string) => {
    setInputValue(text);
    setShowSuggestions(true);
  }, []);

  return (
    <View>
      <View style={[styles.recipientFieldRow, { borderBottomColor: themeColors.border }]}>
        <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
          {label}
        </Text>

        <View style={styles.recipientFieldContent}>
          {/* Chips */}
          {recipients.map(recipient => (
            <RecipientChip
              key={recipient.email}
              recipient={recipient}
              onRemove={() => onRemoveRecipient(recipient.email)}
              accentColor={accentColor.primary}
              themeColors={themeColors}
            />
          ))}

          {/* Text input for adding new recipients */}
          <TextInput
            ref={inputRef}
            style={[styles.recipientInput, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}
            value={inputValue}
            onChangeText={handleChangeText}
            placeholder={recipients.length === 0 ? placeholder : ''}
            placeholderTextColor={themeColors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmitManualAddress}
            onBlur={() => {
              // Small delay so tapping a suggestion still works
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            onFocus={() => {
              setShowSuggestions(true);
              onInputFocus?.();
            }}
            accessibilityLabel={label}
          />
        </View>
      </View>

      {/* Contact suggestions dropdown */}
      {hasSuggestionsToShow && (
        <View style={[styles.suggestionsContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          {/* "Aan mezelf" — always first when not already added */}
          {!isSelfAlreadyAdded && accountEmail && (
            <SelfSuggestionRow
              email={accountEmail}
              onSelect={handleSelectSelf}
              accentColor={accentColor}
              themeColors={themeColors}
              label={t('modules.mail.compose.toMyself')}
            />
          )}
          {suggestions.map(contact => (
            <ContactSuggestionRow
              key={contact.userUuid}
              contact={contact}
              onSelect={() => handleSelectContact(contact)}
              accentColor={accentColor}
              themeColors={themeColors}
            />
          ))}
        </View>
      )}
    </View>
  );
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
  restoredDraft,
}: MailComposeScreenProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const labelStyle = useLabelStyle();
  const fieldTextStyle = useFieldTextStyle();
  const { triggerHaptic } = useFeedback();
  const { scrollRef, registerField, scrollToField, getFieldFocusHandler, handleScroll: handleScrollToField } = useScrollToField();

  // Contact loading
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Form state — pre-fill from restored draft if available
  const [toRecipients, setToRecipients] = useState<MailRecipient[]>(
    restoredDraft?.to ?? getInitialRecipients(mode, originalHeader, account.email),
  );
  const [ccRecipients, setCcRecipients] = useState<MailRecipient[]>(
    restoredDraft?.cc ?? [],
  );
  const [bccRecipients, setBccRecipients] = useState<MailRecipient[]>(
    restoredDraft?.bcc ?? [],
  );
  const [showCcBcc, setShowCcBcc] = useState(
    (restoredDraft?.cc?.length ?? 0) > 0 || (restoredDraft?.bcc?.length ?? 0) > 0,
  );
  const [subject, setSubject] = useState(
    restoredDraft?.subject ?? getInitialSubject(mode, originalHeader),
  );
  const [body, setBody] = useState(
    restoredDraft?.body ?? getInitialBody(mode, originalHeader, originalBody, t),
  );
  const [isSending, setIsSending] = useState(false);
  const [showSentConfirmation, setShowSentConfirmation] = useState(false);
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);

  // Required field validation — invalidField highlight pattern
  const [invalidField, setInvalidField] = useState<string | null>(null);

  // Original message HTML for forward/reply preview
  const originalHtml = useMemo(
    () => (mode !== 'new' ? getOriginalHtml(originalBody) : null),
    [mode, originalBody],
  );
  const [previewHeight, setPreviewHeight] = useState(200);

  const bodyInputRef = useRef<TextInput>(null);

  // ============================================================
  // Load Contacts
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    const loadContacts = async () => {
      try {
        const { ServiceContainer } = await import('@/services/container');
        if (ServiceContainer.isInitialized) {
          const contactList = await ServiceContainer.database.getContactsOnce();
          if (!cancelled) {
            setContacts(getMailableContacts(contactList));
          }
        }
      } catch (error) {
        console.debug('[MailCompose] Failed to load contacts:', error);
      }
    };

    void loadContacts();
    return () => {
      cancelled = true;
    };
  }, []);

  // Clear validation highlight reactively when the invalid field is filled
  useEffect(() => {
    if (!invalidField) return;
    if (invalidField === 'to' && toRecipients.length > 0) {
      setInvalidField(null);
    } else if (invalidField === 'subject' && subject.trim().length > 0) {
      setInvalidField(null);
    }
  }, [invalidField, toRecipients, subject]);

  // ============================================================
  // Auto-Save Draft (30s timer + AppState background)
  // ============================================================

  const saveDraftNow = useCallback(() => {
    const hasContent =
      toRecipients.length > 0 ||
      subject.trim().length > 0 ||
      body.trim().length > 0;

    if (!hasContent) return;

    saveDraft({
      to: toRecipients,
      cc: ccRecipients,
      bcc: bccRecipients,
      subject,
      body,
      mode,
      accountId: account.id,
      savedAt: new Date().toISOString(),
      replyToUid: originalHeader?.uid,
    }).catch(() => {});
  }, [toRecipients, ccRecipients, bccRecipients, subject, body, mode, account.id, originalHeader]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      saveDraftNow();
    }, 30_000);
    return () => clearInterval(timer);
  }, [saveDraftNow]);

  // Save when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        saveDraftNow();
      }
    });
    return () => sub.remove();
  }, [saveDraftNow]);

  // Clear draft from previous session if this compose was opened from a restored draft
  useEffect(() => {
    if (restoredDraft) {
      // Draft has been loaded into state — clear it from storage
      deleteDraft().catch(() => {});
    }
  }, []); // Only on mount

  // ============================================================
  // Validation
  // ============================================================

  const isValid = toRecipients.length > 0;

  // ============================================================
  // Recipient Handlers
  // ============================================================

  const handleAddToRecipient = useCallback((recipient: MailRecipient) => {
    setToRecipients(prev => {
      const exists = prev.some(r => r.email.toLowerCase() === recipient.email.toLowerCase());
      if (exists) return prev;
      return [...prev, recipient];
    });
  }, []);

  const handleRemoveToRecipient = useCallback((email: string) => {
    triggerHaptic('tap');
    setToRecipients(prev => prev.filter(r => r.email !== email));
  }, []);

  const handleAddCcRecipient = useCallback((recipient: MailRecipient) => {
    setCcRecipients(prev => {
      const exists = prev.some(r => r.email.toLowerCase() === recipient.email.toLowerCase());
      if (exists) return prev;
      return [...prev, recipient];
    });
  }, []);

  const handleRemoveCcRecipient = useCallback((email: string) => {
    triggerHaptic('tap');
    setCcRecipients(prev => prev.filter(r => r.email !== email));
  }, []);

  const handleAddBccRecipient = useCallback((recipient: MailRecipient) => {
    setBccRecipients(prev => {
      const exists = prev.some(r => r.email.toLowerCase() === recipient.email.toLowerCase());
      if (exists) return prev;
      return [...prev, recipient];
    });
  }, []);

  const handleRemoveBccRecipient = useCallback((email: string) => {
    triggerHaptic('tap');
    setBccRecipients(prev => prev.filter(r => r.email !== email));
  }, []);

  // ============================================================
  // Send
  // ============================================================

  const handleSend = useCallback(async () => {
    if (isSending) return;

    triggerHaptic('tap');

    // Validate required fields — scroll to first invalid field + highlight
    if (toRecipients.length === 0) {
      triggerHaptic('warning');
      setInvalidField('to');
      scrollToField('to', { isModalReturn: false });
      return;
    }

    if (subject.trim().length === 0) {
      triggerHaptic('warning');
      setInvalidField('subject');
      scrollToField('subject', { isModalReturn: false });
      return;
    }

    // Clear any previous validation error
    setInvalidField(null);
    setIsSending(true);

    try {
      const smtpBridge = await import('@/services/mail/smtpBridge');
      const credentialManager = await import('@/services/mail/credentialManager');

      const credentials = await credentialManager.getCredentials(account.id);
      if (!credentials) {
        throw new Error(t('modules.mail.compose.noCredentials'));
      }

      const smtpConfig = credentialManager.buildSMTPConfig(credentials);

      // Build address arrays from recipient chips
      const toAddresses = toRecipients.map(r => ({
        name: r.name,
        address: r.email,
      }));

      const ccAddresses = ccRecipients.map(r => ({
        name: r.name,
        address: r.email,
      }));

      const bccAddresses = bccRecipients.map(r => ({
        name: r.name,
        address: r.email,
      }));

      // Build htmlBody for forward/reply (preserve original HTML)
      let htmlBody: string | undefined;
      if (mode !== 'new' && originalHtml) {
        // Wrap user's new text + original HTML
        const userTextHtml = body
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');

        const senderParsed = originalHeader
          ? parseEmailAddress(originalHeader.from)
          : null;
        const senderDisplay = senderParsed?.name || senderParsed?.address || '';

        const dividerLabel =
          mode === 'forward'
            ? t('modules.mail.compose.forwardedMessage')
            : t('modules.mail.compose.replyPrefix', { sender: senderDisplay });

        htmlBody = `<div>${userTextHtml}</div>
<br>
<div style="border-top: 1px solid #ccc; padding-top: 12px; margin-top: 12px; color: #666;">
  <p><strong>${dividerLabel}</strong></p>
  ${originalHtml}
</div>`;
      }

      // Prepare attachments for sending
      const sendAttachments =
        attachments.length > 0
          ? attachments.map(a => ({
              filePath: a.localUri,
              fileName: a.name,
              mimeType: a.mimeType,
            }))
          : undefined;

      await smtpBridge.sendMessage({
        smtpConfig,
        from: { name: account.displayName, address: account.email },
        to: toAddresses,
        cc: ccAddresses.length > 0 ? ccAddresses : undefined,
        bcc: bccAddresses.length > 0 ? bccAddresses : undefined,
        subject,
        body,
        htmlBody,
        attachments: sendAttachments,
      });

      // Clear saved draft — message was sent successfully
      deleteDraft().catch(() => {});

      // Show confirmation overlay — it auto-dismisses after 2 seconds
      setShowSentConfirmation(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setNotification({
        type: 'error',
        title: t('modules.mail.compose.sendFailed'),
        message: t('modules.mail.compose.sendFailedMessage'),
      });
    } finally {
      setIsSending(false);
    }
  }, [
    isSending,
    toRecipients,
    ccRecipients,
    bccRecipients,
    subject,
    body,
    account,
    mode,
    originalHtml,
    originalHeader,
    attachments,
    onClose,
    onSent,
    scrollToField,
    t,
  ]);

  // ============================================================
  // Send Confirmation Dismiss
  // ============================================================

  const handleSentConfirmationDismiss = useCallback(() => {
    setShowSentConfirmation(false);
    onSent?.();
    onClose();
  }, [onSent, onClose]);

  // ============================================================
  // Close with Draft Warning
  // ============================================================

  const handleClose = useCallback(() => {
    triggerHaptic('tap');

    const hasContent =
      toRecipients.length > 0 ||
      subject.trim().length > 0 ||
      body.trim().length > 0;

    if (hasContent) {
      Alert.alert(
        t('modules.mail.compose.discardTitle'),
        t('modules.mail.compose.discardMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('modules.mail.compose.saveDraft'),
            onPress: () => {
              saveDraftNow();
              onClose();
            },
          },
          {
            text: t('modules.mail.compose.discard'),
            style: 'destructive',
            onPress: () => {
              deleteDraft().catch(() => {});
              onClose();
            },
          },
        ],
      );
    } else {
      onClose();
    }
  }, [toRecipients, subject, body, onClose, t, saveDraftNow]);

  // ============================================================
  // Attachments
  // ============================================================

  const handleAddPhotos = useCallback(
    async (photos: Array<{ uri: string; fileName: string; fileSize: number; mimeType: string }>) => {
      for (const photo of photos) {
        if (wouldExceedTotalSize(attachments, photo.fileSize)) {
          setNotification({
            type: 'warning',
            title: t('modules.mail.compose.totalSizeExceeded'),
            message: t('modules.mail.compose.totalSizeWarning'),
          });
          break;
        }

        const attachment = buildAttachment(
          photo.uri,
          photo.fileName,
          photo.mimeType,
          photo.fileSize,
        );

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
    triggerHaptic('tap');
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  // ============================================================
  // WebView Height Handling
  // ============================================================

  const handlePreviewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'height' && data.value > 0) {
        setPreviewHeight(Math.min(data.value + 16, 600));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // ============================================================
  // Title
  // ============================================================

  const title =
    mode === 'reply'
      ? t('modules.mail.compose.replyTitle')
      : mode === 'replyAll'
        ? t('modules.mail.compose.replyAllTitle')
        : mode === 'forward'
          ? t('modules.mail.compose.forwardTitle')
          : t('modules.mail.compose.newTitle');

  // ============================================================
  // Render
  // ============================================================

  // Check if CameraRoll is available (photo attachments)
  const isCameraRollAvailable = true; // @react-native-camera-roll/camera-roll installed

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {notification && (
        <ErrorView
          type={notification.type}
          title={notification.title}
          message={notification.message}
          autoDismiss={notification.type === 'success' || notification.type === 'info' ? 3000 : undefined}
          onDismiss={() => setNotification(null)}
        />
      )}

      {/* Top bar — cancel + title */}
      <View style={[styles.topBar, { borderBottomColor: themeColors.border }]}>
        <HapticTouchable hapticDisabled
          style={styles.topBarButton}
          onPress={handleClose}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          <Text style={[styles.topBarButtonText, { color: themeColors.textPrimary }]}>{t('common.cancel')}</Text>
        </HapticTouchable>

        <Text style={[styles.title, { color: themeColors.textPrimary }]}>
          {title}
        </Text>

        {/* Spacer to balance layout */}
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollViewWithIndicator
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScrollToField}
        scrollEventThrottle={16}
      >
        {/* To — Recipient chips with inline search (required) */}
        <View ref={registerField('to')} style={invalidField === 'to' ? styles.invalidFieldHighlight : undefined}>
          <RecipientField
            label={`${t('modules.mail.compose.to')} *`}
            recipients={toRecipients}
            onAddRecipient={handleAddToRecipient}
            onRemoveRecipient={handleRemoveToRecipient}
            contacts={contacts}
            accentColor={accentColor}
            themeColors={themeColors}
            labelStyle={labelStyle}
            fieldTextStyle={fieldTextStyle}
            placeholder={t('modules.mail.compose.toPlaceholder')}
            accountEmail={account.email}
            accountDisplayName={account.displayName}
            onInputFocus={getFieldFocusHandler('to')}
          />
        </View>

        {/* CC/BCC toggle */}
        {!showCcBcc && (
          <HapticTouchable hapticDisabled
            style={[styles.ccBccToggle, { borderBottomColor: themeColors.border }]}
            onPress={() => {
              triggerHaptic('tap');
              setShowCcBcc(true);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('modules.mail.compose.addCcBcc')}
          >
            <Text style={[styles.ccBccToggleText, { color: accentColor.primary }]}>
              {t('modules.mail.compose.addCcBcc')}
            </Text>
          </HapticTouchable>
        )}

        {/* CC field */}
        {showCcBcc && (
          <View ref={registerField('cc')}>
            <RecipientField
              label={t('modules.mail.compose.ccLabel')}
              recipients={ccRecipients}
              onAddRecipient={handleAddCcRecipient}
              onRemoveRecipient={handleRemoveCcRecipient}
              contacts={contacts}
              accentColor={accentColor}
              themeColors={themeColors}
              labelStyle={labelStyle}
              fieldTextStyle={fieldTextStyle}
              placeholder={t('modules.mail.compose.ccPlaceholder')}
              onInputFocus={getFieldFocusHandler('cc')}
            />
          </View>
        )}

        {/* BCC field */}
        {showCcBcc && (
          <View ref={registerField('bcc')}>
            <RecipientField
              label={t('modules.mail.compose.bccLabel')}
              recipients={bccRecipients}
              onAddRecipient={handleAddBccRecipient}
              onRemoveRecipient={handleRemoveBccRecipient}
              contacts={contacts}
              accentColor={accentColor}
              themeColors={themeColors}
              labelStyle={labelStyle}
              fieldTextStyle={fieldTextStyle}
              placeholder={t('modules.mail.compose.bccPlaceholder')}
              onInputFocus={getFieldFocusHandler('bcc')}
            />
          </View>
        )}

        {/* Subject (required) */}
        <View ref={registerField('subject')} style={[styles.fieldRow, { borderBottomColor: themeColors.border }, invalidField === 'subject' ? styles.invalidFieldHighlight : undefined]}>
          <Text style={[styles.fieldLabel, { color: labelStyle.color, fontWeight: labelStyle.fontWeight, fontStyle: labelStyle.fontStyle }]}>
            {t('modules.mail.compose.subject')}<Text style={{ color: '#D32F2F', fontWeight: '700' }}> *</Text>
          </Text>
          <TextInput
            style={[styles.fieldInput, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}
            value={subject}
            onChangeText={setSubject}
            placeholder={t('modules.mail.compose.subjectPlaceholder')}
            placeholderTextColor={themeColors.textSecondary}
            returnKeyType="next"
            onSubmitEditing={() => bodyInputRef.current?.focus()}
            onFocus={getFieldFocusHandler('subject')}
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
        <View ref={registerField('body')}>
          <TextInput
            ref={bodyInputRef}
            style={[styles.bodyInput, { color: fieldTextStyle.color, fontWeight: fieldTextStyle.fontWeight, fontStyle: fieldTextStyle.fontStyle }]}
            value={body}
            onChangeText={setBody}
            placeholder={t('modules.mail.compose.bodyPlaceholder')}
            placeholderTextColor={themeColors.textSecondary}
            multiline
            textAlignVertical="top"
            onFocus={getFieldFocusHandler('body')}
            accessibilityLabel={t('modules.mail.compose.body')}
          />
        </View>

        {/* Original message preview (forward/reply) */}
        {originalHtml && (
          <View style={[styles.originalMessageContainer, { borderColor: themeColors.border }]}>
            <Text style={[styles.originalMessageLabel, { color: themeColors.textSecondary }]}>
              {mode === 'forward'
                ? t('modules.mail.compose.originalMessage')
                : t('modules.mail.compose.originalMessage')}
            </Text>
            <View style={[styles.originalMessageWebView, { height: previewHeight }]}>
              <WebView
                source={{
                  html: buildPreviewHtml(
                    originalHtml,
                    themeColors.textPrimary,
                    themeColors.surface,
                  ),
                }}
                style={{ backgroundColor: 'transparent' }}
                scrollEnabled={previewHeight >= 600}
                onMessage={handlePreviewMessage}
                originWhitelist={['*']}
                javaScriptEnabled
              />
            </View>
          </View>
        )}
      </ScrollViewWithIndicator>

      {/* Bottom action bar — attach + send */}
      <View style={[styles.bottomBar, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
        {/* Attach photo button — hidden when CameraRoll not available */}
        {isCameraRollAvailable && (
          <HapticTouchable hapticDisabled
            style={[
              styles.bottomAction,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
            ]}
            onPress={() => {
              triggerHaptic('tap');
              setShowAlbumPicker(true);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('modules.mail.compose.attachPhoto')}
          >
            <Icon name="attach" size={22} color={accentColor.primary} />
            <Text style={[styles.bottomActionText, { color: accentColor.primary }]}>
              {t('modules.mail.compose.attachPhoto')}
            </Text>
          </HapticTouchable>
        )}

        {/* Send button */}
        <HapticTouchable hapticDisabled
          style={[
            styles.bottomAction,
            {
              backgroundColor: accentColor.primary,
              borderColor: accentColor.primary,
            },
          ]}
          onPress={handleSend}
          activeOpacity={0.7}
          disabled={isSending}
          accessibilityRole="button"
          accessibilityLabel={t('modules.mail.compose.send')}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Icon name="mail" size={22} color="white" />
              <Text style={[styles.bottomActionText, { color: 'white' }]}>
                {t('modules.mail.compose.send')}
              </Text>
            </>
          )}
        </HapticTouchable>
      </View>

      {/* Album Picker Modal */}
      {isCameraRollAvailable && (
        <AlbumPickerModal
          visible={showAlbumPicker}
          onSelect={handleAddPhotos}
          onClose={() => {
            setShowAlbumPicker(false);
            scrollToField('body', { isModalReturn: true });
          }}
        />
      )}
    </KeyboardAvoidingView>

    {/* Send confirmation overlay — shown after successful send */}
    {showSentConfirmation && (
      <SendConfirmationOverlay onDismiss={handleSentConfirmationDismiss} />
    )}
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    minHeight: touchTargets.minimum,
  },
  topBarButton: {
    height: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  topBarButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
  topBarSpacer: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
  },
  title: {
    ...typography.body,
    fontWeight: '700',
  },

  // Scroll content
  scrollContent: {
    flexGrow: 1,
  },

  // Field rows
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

  // Recipient field
  recipientFieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  recipientFieldContent: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  recipientInput: {
    ...typography.body,
    flex: 1,
    minWidth: 120,
    minHeight: touchTargets.minimum,
    paddingVertical: 0,
  },

  // Chips
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: spacing.xs,
  },
  chipText: {
    ...typography.body,
    maxWidth: 180,
  },
  chipRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Contact suggestions
  suggestionsContainer: {
    marginHorizontal: spacing.lg,
    marginLeft: spacing.lg + 60 + spacing.sm, // Align with input (label width + gap)
    borderWidth: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  suggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionAvatarText: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 18,
  },
  suggestionInfo: {
    flex: 1,
    gap: 2,
  },
  suggestionName: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 18,
  },
  suggestionEmail: {
    ...typography.label,
  },

  // CC/BCC toggle
  ccBccToggle: {
    paddingHorizontal: spacing.lg,
    paddingLeft: spacing.lg + 60 + spacing.sm, // Align with input
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  ccBccToggleText: {
    ...typography.body,
    fontWeight: '600',
  },

  // Attachments
  attachmentSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },

  // Body input
  bodyInput: {
    ...typography.body,
    flex: 1,
    minHeight: 150,
    padding: spacing.lg,
    lineHeight: 28,
  },

  // Original message preview
  originalMessageContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  originalMessageLabel: {
    ...typography.body,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  originalMessageWebView: {
    minHeight: 100,
  },

  // Bottom action bar
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md + 20, // Account for home indicator
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
    borderWidth: 1,
    gap: spacing.sm,
  },
  bottomActionText: {
    ...typography.body,
    fontWeight: '700',
  },
  invalidFieldHighlight: {
    backgroundColor: 'rgba(255, 0, 0, 0.08)',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginHorizontal: -spacing.xs,
  },
});
