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

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { Icon, FullscreenImageViewer, LoadingView, ErrorView, CalendarInvitationCard , ScrollViewWithIndicator } from '@/components';
import type { ViewerImage } from '@/components';
import type {
  CachedMailHeader,
  MailBody,
  MailAccount,
} from '@/types/mail';
import type { ParsedCalendarEvent } from '@/services/mail/icsParser';
import { parseEmailAddress } from '@/types/mail';
import { isImageType } from '@/services/mail/mediaAttachmentService';
import { getSaveableAttachments, isAlreadySaved } from '@/services/mail/saveToAlbumService';
import { extractDomain } from '@/services/mail/imageWhitelistService';
import { useMailTTS } from '@/hooks/useMailTTS';

// Extracted sub-components and helpers
import { formatDetailDate, formatMailBody } from './mailDetailHelpers';
import { MailBodyWebView } from './MailBodyWebView';
import { AttachmentRow } from './AttachmentRow';

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
  /** Open compose for reply all */
  onReplyAll?: (header: CachedMailHeader) => void;
  /** Open compose for forward */
  onForward?: (header: CachedMailHeader, body: MailBody | null) => void;
  /** Called after message is deleted */
  onDeleted?: (uid: number) => void;
}

// ============================================================
// Text Size Settings
// ============================================================

const MAIL_FONT_SIZE_KEY = '@commeazy/mailFontSize';
const FONT_SIZES = [18, 24, 32] as const;
type FontSizeOption = typeof FONT_SIZES[number];

const FONT_SIZE_LABELS: Record<FontSizeOption, string> = {
  18: 'textSizeNormal',
  24: 'textSizeLarge',
  32: 'textSizeExtraLarge',
};

// ============================================================
// Component
// ============================================================

export function MailDetailScreen({
  header,
  account,
  onBack,
  onReply,
  onReplyAll,
  onForward,
  onDeleted,
}: MailDetailScreenProps) {
  const { t, i18n } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { triggerHaptic } = useFeedback();

  // State
  const [body, setBody] = useState<MailBody | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRead, setIsRead] = useState(header.isRead);
  const [baseFontSize, setBaseFontSize] = useState<FontSizeOption>(18);

  // Image viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  /** Map of attachment index → local temp file URI (for downloaded thumbnails) */
  const [downloadedImages, setDownloadedImages] = useState<Map<number, string>>(new Map());
  /** Set of attachment indices currently being downloaded */
  const [downloadingImages, setDownloadingImages] = useState<Set<number>>(new Set());
  /** Set of attachment indices already saved to album */
  const [savedToAlbumIndices, setSavedToAlbumIndices] = useState<Set<number>>(new Set());
  /** Map of contentId → data URI for CID inline image resolution */
  const [cidDataUris, setCidDataUris] = useState<Map<string, string>>(new Map());

  // ICS calendar invitation state
  const [icsEvents, setIcsEvents] = useState<ParsedCalendarEvent[]>([]);
  const [icsAdded, setIcsAdded] = useState(false);

  const mountedRef = useRef(true);

  // Toast feedback for read/unread toggle
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((message: string) => {
    // Clear any pending timer
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setToastMessage(message);
    // Announce for VoiceOver/TalkBack
    AccessibilityInfo.announceForAccessibility(message);

    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        if (mountedRef.current) setToastMessage(null);
      });
    }, 2500);
  }, [toastOpacity]);

  // TTS read-aloud
  const {
    startReading,
    stopReading,
    pauseReading,
    resumeReading,
    isPlaying: isTtsPlaying,
    isPaused: isTtsPaused,
    isLoading: isTtsLoading,
    progress: ttsProgress,
    error: ttsError,
  } = useMailTTS();

  // Saveable attachments (images/videos that can be saved to album)
  const saveableAttachments = useMemo(
    () => (body?.attachments ? getSaveableAttachments(body.attachments) : []),
    [body?.attachments],
  );

  // Image attachments only (for inline thumbnails + viewer)
  const imageAttachments = useMemo(
    () => (body?.attachments?.filter(a => isImageType(a.mimeType)) ?? []),
    [body?.attachments],
  );

  // Build viewer images array from downloaded images
  const viewerImages: ViewerImage[] = useMemo(() => {
    return imageAttachments
      .filter(a => downloadedImages.has(a.index))
      .map(a => ({
        id: `att_${a.index}`,
        uri: downloadedImages.get(a.index)!,
        savedToAlbum: savedToAlbumIndices.has(a.index),
      }));
  }, [imageAttachments, downloadedImages, savedToAlbumIndices]);

  // Resolve CID references in HTML body with downloaded inline image data URIs
  const resolvedHtml = useMemo(() => {
    if (!body?.html || cidDataUris.size === 0) return body?.html ?? null;

    let html = body.html;
    cidDataUris.forEach((dataUri, cid) => {
      // Replace both cid:XXX and CID:XXX (case-insensitive)
      const cidPattern = new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
      html = html.replace(cidPattern, dataUri);
    });
    return html;
  }, [body?.html, cidDataUris]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Load persisted font size
  useEffect(() => {
    AsyncStorage.getItem(MAIL_FONT_SIZE_KEY).then((value) => {
      if (value && mountedRef.current) {
        const parsed = parseInt(value, 10) as FontSizeOption;
        if (FONT_SIZES.includes(parsed)) {
          setBaseFontSize(parsed);
        }
      }
    }).catch(() => {});
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
        let hasCachedBody = false;
        try {
          const db = await mailCache.getMailCacheDb();
          const cachedBody = await mailCache.getBody(db, account.id, header.uid);
          if (cachedBody && mountedRef.current) {
            setBody({
              html: cachedBody.html,
              plainText: cachedBody.plainText,
              attachments: cachedBody.attachments ?? [],
            });
            setIsLoading(false);
            hasCachedBody = true;
          }
        } catch {
          // Cache miss — will fetch from server
        }

        // Fetch from server (always, to get latest attachments if cache was stale)
        try {
          const serverBody = await imapBridge.fetchMessageBody(header.uid, header.folder);

          // Cache the body including attachment metadata
          try {
            const db = await mailCache.getMailCacheDb();
            await mailCache.upsertBody(
              db, account.id, header.uid,
              serverBody.html, serverBody.plainText,
              serverBody.attachments,
            );
          } catch {
            // Cache write failed — non-critical
          }

          if (mountedRef.current) {
            setBody(serverBody);
          }
        } catch {
          // If we don't have cached body at all, show error
          if (!hasCachedBody && mountedRef.current) {
            setError(t('modules.mail.detail.loadFailed'));
          }
        }

        // Mark as read (silently, no toast)
        try {
          if (!header.isRead) {
            await imapBridge.markAsRead(header.uid, header.folder, true);
            const db = await mailCache.getMailCacheDb();
            await mailCache.updateReadStatus(db, account.id, header.folder, header.uid, true);
            if (mountedRef.current) setIsRead(true);
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
  // Detect and parse ICS calendar invitations
  // ============================================================

  useEffect(() => {
    if (!body?.attachments) return;

    const parseIcsAttachments = async () => {
      const { isICSAttachment, parseICS } = await import('@/services/mail/icsParser');
      const imapBridge = await import('@/services/mail/imapBridge');

      const icsAttachments = body.attachments.filter(a =>
        isICSAttachment(a.mimeType, a.name),
      );
      if (icsAttachments.length === 0) return;

      const allEvents: ParsedCalendarEvent[] = [];
      for (const att of icsAttachments) {
        try {
          const data = await imapBridge.fetchAttachmentData(
            header.uid,
            header.folder,
            att.index,
          );
          // Decode ICS content to text
          let icsText = '';
          if (data.base64) {
            // Write base64 to temp file, read back as UTF-8 (Hermes lacks Buffer)
            const tmpPath = `${RNFS.CachesDirectoryPath}/mail_ics_${header.uid}_${att.index}.ics`;
            await RNFS.writeFile(tmpPath, data.base64, 'base64');
            icsText = await RNFS.readFile(tmpPath, 'utf8');
            RNFS.unlink(tmpPath).catch(() => {});
          } else if (data.filePath) {
            icsText = await RNFS.readFile(data.filePath, 'utf8');
          }
          if (icsText) {
            const events = parseICS(icsText);
            allEvents.push(...events);
          }
        } catch (err) {
          console.debug('[MailDetail] Failed to parse ICS attachment:', att.name, err);
        }
      }

      if (mountedRef.current && allEvents.length > 0) {
        setIcsEvents(allEvents);
      }
    };

    parseIcsAttachments();
  }, [body?.attachments, header.uid, header.folder]);

  // Handle adding ICS event to agenda
  const handleAddIcsToAgenda = useCallback(async (event: ParsedCalendarEvent) => {
    try {
      const { mapToAgendaData } = await import('@/services/mail/icsParser');
      const { ServiceContainer } = await import('@/services/container');
      const { WatermelonDBService } = await import('@/services/database');
      const { AgendaItemModel } = await import('@/models/AgendaItem');

      const agendaData = mapToAgendaData(event);
      const dbService = ServiceContainer.database as InstanceType<typeof WatermelonDBService>;
      const db = dbService.getDb();
      const collection = db.get<InstanceType<typeof AgendaItemModel>>('agenda_items');

      await db.write(async () => {
        await collection.create(r => {
          r.category = (agendaData.category ?? 'other') as any;
          r.title = agendaData.title ?? '';
          r.categoryIcon = agendaData.categoryIcon;
          r.categoryName = agendaData.categoryName;
          r.formType = agendaData.formType;
          r.itemDate = agendaData.date ?? Date.now();
          r.time = agendaData.time;
          r.repeatType = agendaData.repeatType;
          r.reminderOffset = agendaData.reminderOffset ?? '1_hour_before';
          r.locationName = agendaData.locationName;
          r.endTime = agendaData.endTime;
          r.notes = agendaData.notes;
          r.source = 'ics';
          r.isHidden = false;
        });
      });

      setIcsAdded(true);
      showToast(t('modules.mail.ics.addedToAgenda'));
    } catch (err) {
      console.error('[MailDetail] Failed to add ICS event to agenda:', err);
      Alert.alert(
        t('status.error'),
        t('modules.mail.ics.addFailed'),
      );
    }
  }, [t, showToast]);

  // ============================================================
  // Auto-download image thumbnails
  // ============================================================

  useEffect(() => {
    if (imageAttachments.length === 0) return;

    const downloadImageThumbnails = async () => {
      const imapBridge = await import('@/services/mail/imapBridge');

      for (const attachment of imageAttachments) {
        if (!mountedRef.current) break;
        if (downloadedImages.has(attachment.index)) continue;
        if (downloadingImages.has(attachment.index)) continue;

        // Mark as downloading
        setDownloadingImages(prev => new Set(prev).add(attachment.index));

        try {
          const data = await imapBridge.fetchAttachmentData(
            header.uid,
            header.folder,
            attachment.index,
          );

          if (!data || !mountedRef.current) continue;

          // Write to temp file for display
          const ext = attachment.mimeType === 'image/png' ? '.png' : '.jpg';
          const tempPath = `${RNFS.CachesDirectoryPath}/mail_thumb_${header.uid}_${attachment.index}${ext}`;

          if (data.base64) {
            await RNFS.writeFile(tempPath, data.base64, 'base64');
          } else if (data.filePath) {
            await RNFS.copyFile(data.filePath, tempPath);
          } else {
            continue;
          }

          if (mountedRef.current) {
            setDownloadedImages(prev => new Map(prev).set(attachment.index, tempPath));

            // For CID-referenced images, store data URI for inline HTML resolution
            if (attachment.contentId) {
              let base64Data = data.base64;
              if (!base64Data && data.filePath) {
                try {
                  base64Data = await RNFS.readFile(data.filePath, 'base64');
                } catch {
                  // Non-critical — CID image just won't render inline
                }
              }
              if (base64Data) {
                const dataUri = `data:${attachment.mimeType};base64,${base64Data}`;
                setCidDataUris(prev => new Map(prev).set(attachment.contentId!, dataUri));
              }
            }
          }
        } catch {
          console.debug('[MailDetail] Failed to download image thumbnail');
        } finally {
          if (mountedRef.current) {
            setDownloadingImages(prev => {
              const next = new Set(prev);
              next.delete(attachment.index);
              return next;
            });
          }
        }
      }

      // Check saved status for all image attachments
      if (mountedRef.current) {
        for (const attachment of imageAttachments) {
          const saved = await isAlreadySaved(account.id, header.uid, attachment.index);
          if (saved && mountedRef.current) {
            setSavedToAlbumIndices(prev => new Set(prev).add(attachment.index));
          }
        }
      }
    };

    downloadImageThumbnails();
  }, [imageAttachments, header.uid, header.folder, account.id]);

  // Cleanup temp files on unmount
  useEffect(() => {
    return () => {
      downloadedImages.forEach(async (tempPath) => {
        try {
          const exists = await RNFS.exists(tempPath);
          if (exists) await RNFS.unlink(tempPath);
        } catch {
          // Non-critical
        }
      });
    };
  }, []);

  // ============================================================
  // Image viewer save handler
  // ============================================================

  const handleViewerSave = useCallback(async (image: ViewerImage, index: number): Promise<boolean> => {
    // Find the original attachment for this viewer image
    const downloadedArr = imageAttachments.filter(a => downloadedImages.has(a.index));
    const attachment = downloadedArr[index];
    if (!attachment) return false;

    try {
      const { saveAttachmentToAlbum } = await import('@/services/mail/saveToAlbumService');
      const result = await saveAttachmentToAlbum(
        header.uid,
        header.folder,
        attachment,
        account.id,
      );

      if (result.success) {
        setSavedToAlbumIndices(prev => new Set(prev).add(attachment.index));
        return true;
      }

      if (result.error === 'ALREADY_SAVED') {
        setSavedToAlbumIndices(prev => new Set(prev).add(attachment.index));
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }, [imageAttachments, downloadedImages, header.uid, header.folder, account.id]);

  // ============================================================
  // Actions
  // ============================================================

  const handleDelete = useCallback(() => {
    triggerHaptic('tap');
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
                const db = await mailCache.getMailCacheDb();
                await mailCache.deleteHeader(db, account.id, header.folder, header.uid);
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

  const handleToggleRead = useCallback(async () => {
    const newValue = !isRead;
    triggerHaptic('tap');
    setIsRead(newValue);

    // Show toast for manual toggle
    showToast(
      newValue
        ? t('modules.mail.detail.markedRead')
        : t('modules.mail.detail.markedUnread'),
    );

    try {
      const imapBridge = await import('@/services/mail/imapBridge');
      const mailCache = await import('@/services/mail/mailCache');
      await imapBridge.markAsRead(header.uid, header.folder, newValue);
      const db = await mailCache.getMailCacheDb();
      await mailCache.updateReadStatus(db, account.id, header.folder, header.uid, newValue);
    } catch {
      // Revert optimistic update on failure
      setIsRead(!newValue);
      console.debug('[MailDetail] Failed to toggle read status');
    }
  }, [isRead, header.uid, header.folder, account.id, triggerHaptic, showToast, t]);

  const handleToggleFontSize = useCallback(() => {
    triggerHaptic('tap');
    setBaseFontSize((prev) => {
      const currentIdx = FONT_SIZES.indexOf(prev);
      const nextIdx = (currentIdx + 1) % FONT_SIZES.length;
      const nextSize = FONT_SIZES[nextIdx];
      AsyncStorage.setItem(MAIL_FONT_SIZE_KEY, String(nextSize)).catch(() => {});
      return nextSize;
    });
  }, [triggerHaptic]);

  const handleReply = useCallback(() => {
    triggerHaptic('tap');
    onReply?.(header);
  }, [header, onReply]);

  const handleReplyAll = useCallback(() => {
    triggerHaptic('tap');
    onReplyAll?.(header);
  }, [header, onReplyAll]);

  const handleForward = useCallback(() => {
    triggerHaptic('tap');
    onForward?.(header, body);
  }, [header, body, onForward]);

  const handleTtsToggle = useCallback(async () => {
    triggerHaptic('tap');

    if (isTtsPlaying && !isTtsPaused) {
      await pauseReading();
    } else if (isTtsPaused) {
      await resumeReading();
    } else {
      // Build structured TTS text: sender → subject → body content
      const bodyText = body?.plainText || body?.html || '';
      if (!bodyText.trim()) return;

      // Prepend sender and subject for context
      const intro = t('modules.mail.detail.ttsIntro', {
        sender: senderName,
        subject: header.subject || t('modules.mail.inbox.noSubject'),
      });

      const fullText = `${intro}\n\n${bodyText}`;

      // Use app language for TTS voice selection
      const appLanguage = i18n.language || 'nl';

      await startReading(fullText, appLanguage);
    }
  }, [isTtsPlaying, isTtsPaused, body, senderName, header.subject, i18n.language, pauseReading, resumeReading, startReading, triggerHaptic, t]);

  const handleTtsStop = useCallback(async () => {
    triggerHaptic('tap');
    await stopReading();
  }, [stopReading, triggerHaptic]);

  // Stop TTS when leaving the screen
  useEffect(() => {
    return () => {
      stopReading().catch(() => {});
    };
  }, [stopReading]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: themeColors.border }]}>
        <HapticTouchable hapticDisabled
          style={[styles.backButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          onPress={() => {
            triggerHaptic('tap');
            onBack();
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Icon name="chevron-left" size={24} color={accentColor.primary} />
          <Text style={[styles.backText, { color: accentColor.primary }]}>
            {t('common.back')}
          </Text>
        </HapticTouchable>

        <View style={styles.topBarRight}>
          {/* Text size toggle */}
          <HapticTouchable hapticDisabled
            style={[styles.actionButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={handleToggleFontSize}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('modules.mail.detail.textSize', {
              size: t(`modules.mail.detail.${FONT_SIZE_LABELS[baseFontSize]}`),
            })}
          >
            <Text style={[styles.fontSizeLabel, { color: accentColor.primary }]}>
              Aa
            </Text>
          </HapticTouchable>

          {/* TTS Read-Aloud toggle */}
          <HapticTouchable hapticDisabled
            style={[
              styles.actionButton,
              {
                backgroundColor: isTtsPlaying || isTtsPaused
                  ? accentColor.primary
                  : themeColors.surface,
                borderColor: themeColors.border,
              },
            ]}
            onPress={handleTtsToggle}
            onLongPress={isTtsPlaying || isTtsPaused ? handleTtsStop : undefined}
            activeOpacity={0.7}
            disabled={!body || isTtsLoading}
            accessibilityRole="button"
            accessibilityLabel={
              isTtsPlaying && !isTtsPaused
                ? t('modules.mail.detail.pauseReading')
                : isTtsPaused
                  ? t('modules.mail.detail.resumeReading')
                  : t('modules.mail.detail.readAloud')
            }
          >
            {isTtsLoading ? (
              <ActivityIndicator size="small" color={accentColor.primary} />
            ) : (
              <Icon
                name="mic"
                size={22}
                color={isTtsPlaying || isTtsPaused ? 'white' : accentColor.primary}
              />
            )}
          </HapticTouchable>

          {/* Read/Unread toggle — filled blue = unread state, outline blue = read state */}
          <HapticTouchable hapticDisabled
            style={[
              styles.actionButton,
              !isRead
                ? { backgroundColor: accentColor.primary, borderColor: accentColor.primary }
                : { backgroundColor: themeColors.surface, borderColor: themeColors.border },
            ]}
            onPress={handleToggleRead}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isRead
              ? t('modules.mail.detail.markUnread')
              : t('modules.mail.detail.markRead')}
          >
            <Icon
              name="mail"
              size={22}
              color={!isRead ? 'white' : accentColor.primary}
            />
          </HapticTouchable>

          {/* Delete button */}
          <HapticTouchable hapticDisabled
            style={[styles.actionButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={handleDelete}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
          >
            <Icon name="trash" size={22} color={themeColors.error} />
          </HapticTouchable>
        </View>
      </View>

      {/* Body content */}
      <ScrollViewWithIndicator
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

        {/* TTS Progress Bar */}
        {(isTtsPlaying || isTtsPaused) && (
          <View style={[styles.ttsBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
            <View style={styles.ttsProgressTrack}>
              <View
                style={[
                  styles.ttsProgressFill,
                  { width: `${Math.round(ttsProgress * 100)}%`, backgroundColor: accentColor.primary },
                ]}
              />
            </View>
            <View style={styles.ttsControls}>
              <HapticTouchable hapticDisabled
                style={styles.ttsControlButton}
                onPress={handleTtsToggle}
                accessibilityRole="button"
                accessibilityLabel={isTtsPaused
                  ? t('modules.mail.detail.resumeReading')
                  : t('modules.mail.detail.pauseReading')
                }
              >
                <Icon
                  name={isTtsPaused ? 'play' : 'pause'}
                  size={20}
                  color={accentColor.primary}
                />
              </HapticTouchable>
              <Text style={[styles.ttsLabel, { color: themeColors.textSecondary }]}>
                {isTtsPaused
                  ? t('modules.mail.detail.readingPaused')
                  : t('modules.mail.detail.readingAloud')
                }
              </Text>
              <HapticTouchable hapticDisabled
                style={styles.ttsControlButton}
                onPress={handleTtsStop}
                accessibilityRole="button"
                accessibilityLabel={t('modules.mail.detail.stopReading')}
              >
                <Icon name="stop" size={20} color={themeColors.error} />
              </HapticTouchable>
            </View>
          </View>
        )}

        {/* Body */}
        {isLoading ? (
          <LoadingView message={t('modules.mail.detail.loadingBody')} />
        ) : error && !body ? (
          <ErrorView
            message={error}
            onRetry={() => {
              triggerHaptic('tap');
              setError(null);
              setIsLoading(true);
            }}
          />
        ) : (resolvedHtml || body?.html) ? (
          <MailBodyWebView
            html={resolvedHtml || body!.html}
            textColor={themeColors.textPrimary}
            backgroundColor={themeColors.background}
            linkColor={accentColor.primary}
            bannerBackgroundColor={themeColors.surface}
            bannerTextColor={themeColors.textSecondary}
            bannerButtonColor={accentColor.primary}
            senderDomain={extractDomain(senderEmail)}
            baseFontSize={baseFontSize}
          />
        ) : (
          <View style={styles.bodyContainer}>
            <Text
              style={[styles.bodyText, { color: themeColors.textPrimary }]}
              selectable
            >
              {formatMailBody(body?.plainText || t('modules.mail.detail.noContent'))}
            </Text>
          </View>
        )}

        {/* Calendar invitation cards (ICS) */}
        {icsEvents.length > 0 && (
          <View style={styles.icsSection}>
            {icsEvents.map((event, idx) => (
              <CalendarInvitationCard
                key={`ics_${idx}_${event.summary}`}
                event={event}
                onAddToAgenda={handleAddIcsToAgenda}
              />
            ))}
          </View>
        )}

        {/* Inline image thumbnails */}
        {imageAttachments.length > 0 && (
          <View style={styles.inlineImagesSection}>
            <Text style={[styles.attachmentsTitle, { color: themeColors.textPrimary }]}>
              {t('modules.mail.detail.photos', { count: imageAttachments.length })}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.inlineImagesScroll}
            >
              {imageAttachments.map((attachment, idx) => {
                const localUri = downloadedImages.get(attachment.index);
                const isDownloading = downloadingImages.has(attachment.index);
                const isSavedAlready = savedToAlbumIndices.has(attachment.index);

                return (
                  <HapticTouchable hapticDisabled
                    key={attachment.index}
                    style={[styles.inlineThumbnailContainer, { borderColor: themeColors.border }]}
                    onPress={() => {
                      if (localUri) {
                        triggerHaptic('tap');
                        // Find the viewer index for this attachment
                        const viewerIdx = imageAttachments
                          .filter(a => downloadedImages.has(a.index))
                          .findIndex(a => a.index === attachment.index);
                        setViewerInitialIndex(viewerIdx >= 0 ? viewerIdx : 0);
                        setViewerVisible(true);
                      }
                    }}
                    activeOpacity={0.7}
                    disabled={!localUri}
                    accessibilityRole="button"
                    accessibilityLabel={t('modules.mail.detail.viewPhoto', { name: attachment.name })}
                  >
                    {localUri ? (
                      <Image
                        source={{ uri: localUri }}
                        style={styles.inlineThumbnail}
                        resizeMode="cover"
                      />
                    ) : isDownloading ? (
                      <View style={[styles.thumbnailPlaceholder, { backgroundColor: themeColors.surface }]}>
                        <ActivityIndicator size="small" color={accentColor.primary} />
                      </View>
                    ) : (
                      <View style={[styles.thumbnailPlaceholder, { backgroundColor: themeColors.surface }]}>
                        <Icon name="image" size={24} color={themeColors.textSecondary} />
                      </View>
                    )}

                    {/* Saved badge */}
                    {isSavedAlready && (
                      <View style={[styles.savedBadge, { backgroundColor: themeColors.success }]}>
                        <Icon name="check" size={12} color="white" />
                      </View>
                    )}
                  </HapticTouchable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Non-image attachments */}
        {body?.attachments && body.attachments.filter(a => !isImageType(a.mimeType)).length > 0 && (
          <View style={styles.attachmentsSection}>
            <Text style={[styles.attachmentsTitle, { color: themeColors.textPrimary }]}>
              {t('modules.mail.detail.attachments', { count: body.attachments.filter(a => !isImageType(a.mimeType)).length })}
            </Text>
            {body.attachments
              .filter(a => !isImageType(a.mimeType))
              .map((attachment) => (
                <AttachmentRow
                  key={attachment.index}
                  attachment={attachment}
                  uid={header.uid}
                  folder={header.folder}
                  accountId={account.id}
                />
              ))}
          </View>
        )}
      </ScrollViewWithIndicator>

      {/* Fullscreen Image Viewer */}
      <FullscreenImageViewer
        visible={viewerVisible}
        images={viewerImages}
        initialIndex={viewerInitialIndex}
        onClose={() => setViewerVisible(false)}
        onSave={handleViewerSave}
        accentColor={accentColor.primary}
      />

      {/* Toast feedback */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toast,
            { backgroundColor: accentColor.primary, opacity: toastOpacity },
          ]}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
        <HapticTouchable hapticDisabled
          style={[styles.bottomAction, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          onPress={handleReply}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('modules.mail.detail.reply')}
        >
          <Icon name="reply" size={22} color={accentColor.primary} />
          <Text style={[styles.bottomActionText, { color: accentColor.primary }]}>
            {t('modules.mail.detail.reply')}
          </Text>
        </HapticTouchable>

        {/* Reply All — only when multiple recipients */}
        {header.to && header.to.length > 1 && (
          <HapticTouchable hapticDisabled
            style={[styles.bottomAction, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={handleReplyAll}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('modules.mail.detail.replyAll')}
          >
            <Icon name="reply-all" size={22} color={accentColor.primary} />
            <Text style={[styles.bottomActionText, { color: accentColor.primary }]}>
              {t('modules.mail.detail.replyAll')}
            </Text>
          </HapticTouchable>
        )}

        <HapticTouchable hapticDisabled
          style={[styles.bottomAction, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          onPress={handleForward}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('modules.mail.detail.forward')}
        >
          <Icon name="forward" size={22} color={accentColor.primary} />
          <Text style={[styles.bottomActionText, { color: accentColor.primary }]}>
            {t('modules.mail.detail.forward')}
          </Text>
        </HapticTouchable>
      </View>
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
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  backText: {
    ...typography.body,
    fontWeight: '600',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    minWidth: touchTargets.minimum,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  fontSizeLabel: {
    fontSize: 16,
    fontWeight: '700',
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
    width: 48,
    height: 48,
    borderRadius: 24,
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
  bodyContainer: {
    padding: spacing.lg,
  },
  bodyText: {
    ...typography.body,
    lineHeight: 28,
  },
  icsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  inlineImagesSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  inlineImagesScroll: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  inlineThumbnailContainer: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inlineThumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
    borderWidth: 1,
    gap: spacing.sm,
  },
  bottomActionText: {
    ...typography.body,
    fontWeight: '700',
  },
  ttsBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  ttsProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  ttsProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  ttsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ttsControlButton: {
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  ttsLabel: {
    ...typography.small,
    flex: 1,
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    zIndex: 20,
  },
  toastText: {
    ...typography.body,
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
});
