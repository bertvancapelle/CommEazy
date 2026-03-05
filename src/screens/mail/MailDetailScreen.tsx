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
  TouchableOpacity,
  Alert,
  Modal,
  Switch,
  Platform,
} from 'react-native';
import RNFS from 'react-native-fs';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { Icon, FullscreenImageViewer } from '@/components';
import type { ViewerImage } from '@/components';
import type {
  CachedMailHeader,
  MailBody,
  MailAttachmentMeta,
  MailAccount,
} from '@/types/mail';
import { parseEmailAddress } from '@/types/mail';
import { canSaveToAlbum, isImageType } from '@/services/mail/mediaAttachmentService';
import { getSaveableAttachments, isAlreadySaved } from '@/services/mail/saveToAlbumService';
import { openURL as contentRouterOpenURL, downloadAndPreview } from '@/services/mail/contentRouter';
import {
  extractDomain,
  isWhitelisted as isDomainWhitelisted,
  addDomain as whitelistDomain,
} from '@/services/mail/imageWhitelistService';

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
// Mail Body Formatting
// ============================================================

/**
 * Decode quoted-printable soft line breaks and encoded characters.
 * Quoted-printable encoding uses '=' followed by hex codes for special chars,
 * and '=' at end of line as a soft line break (continuation).
 */
function decodeQuotedPrintable(text: string): string {
  // Remove soft line breaks (= at end of line followed by newline)
  let result = text.replace(/=\r?\n/g, '');
  // Decode =XX hex sequences
  result = result.replace(/=([0-9A-Fa-f]{2})/g, (_match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  return result;
}

/**
 * Shorten long URLs for readability.
 * Shows domain + truncated path instead of full URL.
 * Example: "https://www.example.com/very/long/path?query=..." → "example.com/very/lon..."
 */
function shortenUrls(text: string): string {
  return text.replace(
    /https?:\/\/[^\s<>"{}|\\^`[\]]{40,}/g,
    (url) => {
      try {
        const parsed = new URL(url);
        const domain = parsed.hostname.replace(/^www\./, '');
        const pathPart = parsed.pathname + parsed.search;
        if (pathPart.length <= 1) return domain;
        const shortPath = pathPart.length > 20 ? pathPart.substring(0, 20) + '...' : pathPart;
        return domain + shortPath;
      } catch {
        // If URL parsing fails, truncate raw
        return url.substring(0, 50) + '...';
      }
    },
  );
}

/**
 * Format mail body text for display.
 * Handles quoted-printable decoding and URL shortening.
 */
function formatMailBody(text: string): string {
  let result = decodeQuotedPrintable(text);
  result = shortenUrls(result);
  return result;
}

// ============================================================
// MailBodyWebView — Renders HTML mail body via WebView
// ============================================================

interface MailBodyWebViewProps {
  html: string;
  textColor: string;
  backgroundColor: string;
  linkColor: string;
  bannerBackgroundColor: string;
  bannerTextColor: string;
  bannerButtonColor: string;
  /** Sender domain for whitelist feature (e.g. "microsoft.com") */
  senderDomain: string;
}

/**
 * Build a complete HTML document for the WebView.
 *
 * - Preserves original <style> tags for proper layout (tables, CSS classes)
 * - Strips <script> tags for security
 * - CSP blocks external images by default (img-src 'none')
 * - Injects base styling for senior-friendly readability
 * - Disables user scaling to prevent accidental zoom
 */
function buildWebViewHtml(
  rawHtml: string,
  imagesAllowed: boolean,
  textColor: string,
  backgroundColor: string,
  linkColor: string,
): string {
  // Strip <script> tags entirely (security)
  const noScripts = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '');

  // CSP: block or allow external images
  const imgSrc = imagesAllowed ? "img-src * data: blob:" : "img-src data:";
  const csp = `default-src 'none'; style-src 'unsafe-inline'; ${imgSrc}; font-src 'none';`;

  // Check if HTML already has <html>/<body> structure
  const hasDocStructure = /<html[\s>]/i.test(noScripts);

  // Extract existing <style> blocks to preserve them
  // (they contain CSS classes needed for table/column layouts)
  let bodyContent = noScripts;

  if (hasDocStructure) {
    // Extract body content — keep styles that are in <head>
    const bodyMatch = noScripts.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const headMatch = noScripts.match(/<head[^>]*>([\s\S]*)<\/head>/i);
    const headStyles = headMatch
      ? (headMatch[1].match(/<style[\s\S]*?<\/style>/gi) || []).join('\n')
      : '';
    bodyContent = `${headStyles}\n${bodyMatch ? bodyMatch[1] : noScripts}`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>
    /* Senior-friendly base styles */
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 8px;
      font-family: -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif;
      font-size: 18px;
      line-height: 1.55;
      color: ${textColor};
      background-color: ${backgroundColor};
      word-wrap: break-word;
      overflow-wrap: break-word;
      -webkit-text-size-adjust: 100%;
    }
    a { color: ${linkColor}; }
    img { max-width: 100%; height: auto; }
    table { max-width: 100%; border-collapse: collapse; }
    td, th { vertical-align: top; }
    /* Prevent horizontal overflow from wide tables */
    body > table, body > div > table {
      width: 100% !important;
      max-width: 100% !important;
    }
    /* Force table cells to wrap */
    td { word-break: break-word; }
    /* Hide tracking pixels (1x1 or hidden images) when images are loaded */
    img[width="1"], img[height="1"],
    img[style*="display:none"], img[style*="display: none"] {
      display: none !important;
    }
    pre, code {
      font-size: 15px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
${bodyContent}
<script>
  // Report content height to React Native — use max of multiple measurements
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
  // Report after load with multiple delayed checks for late-rendering content
  window.addEventListener('load', function() {
    reportHeight();
    setTimeout(reportHeight, 100);
    setTimeout(reportHeight, 300);
    setTimeout(reportHeight, 600);
    setTimeout(reportHeight, 1500);
    setTimeout(reportHeight, 3000);
  });
  // Observe DOM mutations (dynamic content, late-loading CSS)
  var observer = new MutationObserver(function() {
    reportHeight();
    setTimeout(reportHeight, 100);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  // Also observe resize events (layout reflows)
  window.addEventListener('resize', reportHeight);

  // Handle image load requests from React Native
  window.addEventListener('message', function(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'loadImages') {
        // Remove CSP by creating a new meta tag
        var metas = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
        metas.forEach(function(m) { m.remove(); });
        var meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = "default-src 'none'; style-src 'unsafe-inline'; img-src * data: blob:; font-src 'none';";
        document.head.appendChild(meta);
        // Reload all images by updating their src
        var imgs = document.querySelectorAll('img');
        imgs.forEach(function(img) {
          var src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src) {
            img.src = '';
            img.src = src;
          }
        });
        // Report new height after images load
        setTimeout(reportHeight, 500);
        setTimeout(reportHeight, 2000);
      }
    } catch(ex) {}
  });
</script>
</body>
</html>`;
}

function MailBodyWebView({
  html,
  textColor,
  backgroundColor,
  linkColor,
  bannerBackgroundColor,
  bannerTextColor,
  bannerButtonColor,
  senderDomain,
}: MailBodyWebViewProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const [webViewHeight, setWebViewHeight] = useState(300);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [whitelistToggle, setWhitelistToggle] = useState(false);
  const [autoLoadChecked, setAutoLoadChecked] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Check if HTML contains external images (http:// or https:// in img src)
  const hasExternalImages = useMemo(() => {
    return /<img[^>]+src\s*=\s*["']https?:\/\//i.test(html);
  }, [html]);

  // Auto-load images if sender domain is whitelisted
  useEffect(() => {
    if (!hasExternalImages || autoLoadChecked || imagesLoaded) return;

    let cancelled = false;
    const checkWhitelist = async () => {
      try {
        const whitelisted = await isDomainWhitelisted(senderDomain);
        if (whitelisted && !cancelled) {
          setImagesLoaded(true);
        }
      } catch {
        // Non-critical — just don't auto-load
      } finally {
        if (!cancelled) setAutoLoadChecked(true);
      }
    };

    checkWhitelist();
    return () => { cancelled = true; };
  }, [hasExternalImages, senderDomain, autoLoadChecked, imagesLoaded]);

  const webViewHtml = useMemo(
    () => buildWebViewHtml(html, imagesLoaded, textColor, backgroundColor, linkColor),
    [html, imagesLoaded, textColor, backgroundColor, linkColor],
  );

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'height' && typeof msg.value === 'number') {
        const newHeight = Math.max(msg.value + 32, 100);
        // Only grow — never shrink (prevents flicker from inconsistent measurements)
        setWebViewHeight((prev) => Math.max(prev, newHeight));
      }
    } catch {
      // Ignore invalid messages
    }
  }, []);

  const handleNavigationRequest = useCallback((request: WebViewNavigation): boolean => {
    const { url } = request;
    // Allow initial HTML load (file:// or about:blank used by WebView internally)
    if (url === 'about:blank' || url.startsWith('about:') || url.startsWith('file://') || url.startsWith('data:')) {
      return true;
    }
    // Intercept links — route through contentRouter instead of in-WebView navigation
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      contentRouterOpenURL(url).catch(() => {
        console.debug('[MailDetail] Failed to open URL from WebView');
      });
      return false;
    }
    return false;
  }, []);

  /** Inject JS to unlock images in the already-loaded WebView */
  const injectImageLoad = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      try {
        var metas = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
        metas.forEach(function(m) { m.remove(); });
        var meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = "default-src 'none'; style-src 'unsafe-inline'; img-src * data: blob:; font-src 'none';";
        document.head.appendChild(meta);
        var imgs = document.querySelectorAll('img');
        imgs.forEach(function(img) {
          var src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src) { img.src = ''; img.src = src; }
        });
        setTimeout(function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: document.body.scrollHeight }));
        }, 1000);
      } catch(e) {}
      true;
    `);
  }, []);

  const handleLoadImages = useCallback(() => {
    triggerHaptic();
    Alert.alert(
      t('modules.mail.detail.externalImagesTitle'),
      t('modules.mail.detail.externalImagesWarning'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('modules.mail.detail.loadImagesConfirm'),
          onPress: () => {
            setImagesLoaded(true);
            injectImageLoad();
            // Show informational modal after images are loaded
            setWhitelistToggle(false);
            setShowWarningModal(true);
          },
        },
      ],
    );
  }, [t, injectImageLoad]);

  /** Dismiss the warning modal and optionally save domain to whitelist */
  const handleDismissWarningModal = useCallback(async () => {
    triggerHaptic();
    if (whitelistToggle && senderDomain) {
      try {
        await whitelistDomain(senderDomain);
      } catch {
        // Non-critical — whitelist save failed silently
      }
    }
    setShowWarningModal(false);
  }, [whitelistToggle, senderDomain]);

  return (
    <View style={styles.bodyContainer}>
      {/* Privacy banner — shown when mail contains external images that are blocked */}
      {hasExternalImages && !imagesLoaded && (
        <View style={[styles.imageBanner, { backgroundColor: bannerBackgroundColor }]}>
          <View style={styles.imageBannerContent}>
            <Icon name="lock" size={20} color={bannerTextColor} />
            <Text style={[styles.imageBannerText, { color: bannerTextColor }]}>
              {t('modules.mail.detail.imagesBlocked')}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.loadImagesButton, { backgroundColor: bannerButtonColor }]}
            onPress={handleLoadImages}
            onLongPress={() => {}}
            delayLongPress={300}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('modules.mail.detail.loadImages')}
          >
            <Text style={styles.loadImagesButtonText}>
              {t('modules.mail.detail.loadImages')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Warning modal — shown after images are loaded (dismissable) */}
      <Modal
        visible={showWarningModal}
        transparent
        animationType="fade"
        onRequestClose={handleDismissWarningModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
            {/* Warning icon + title */}
            <View style={styles.modalHeader}>
              <Icon name="warning" size={28} color="#E65100" />
              <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                {t('modules.mail.detail.warningModalTitle')}
              </Text>
            </View>

            {/* Warning text */}
            <Text style={[styles.modalBody, { color: themeColors.textPrimary }]}>
              {t('modules.mail.detail.warningModalBody')}
            </Text>

            {/* Sender domain info */}
            {senderDomain ? (
              <View style={[styles.modalDomainRow, { backgroundColor: themeColors.background }]}>
                <Text style={[styles.modalDomainLabel, { color: themeColors.textSecondary }]}>
                  {t('modules.mail.detail.warningModalSender')}
                </Text>
                <Text style={[styles.modalDomainValue, { color: themeColors.textPrimary }]}>
                  {senderDomain}
                </Text>
              </View>
            ) : null}

            {/* Whitelist toggle */}
            {senderDomain ? (
              <View style={[styles.modalToggleRow, { borderColor: themeColors.border }]}>
                <Text style={[styles.modalToggleLabel, { color: themeColors.textPrimary }]}>
                  {t('modules.mail.detail.warningModalAlwaysAllow', { domain: senderDomain })}
                </Text>
                <Switch
                  value={whitelistToggle}
                  onValueChange={(value) => {
                    triggerHaptic();
                    setWhitelistToggle(value);
                  }}
                  trackColor={{ false: themeColors.disabled, true: accentColor.primary }}
                  thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  accessibilityLabel={t('modules.mail.detail.warningModalAlwaysAllow', { domain: senderDomain })}
                />
              </View>
            ) : null}

            {/* Settings reference */}
            <Text style={[styles.modalSettingsHint, { color: themeColors.textSecondary }]}>
              {t('modules.mail.detail.warningModalSettingsHint')}
            </Text>

            {/* Dismiss button */}
            <TouchableOpacity
              style={[styles.modalDismissButton, { backgroundColor: accentColor.primary }]}
              onPress={handleDismissWarningModal}
              onLongPress={() => {}}
              delayLongPress={300}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('modules.mail.detail.warningModalDismiss')}
            >
              <Text style={styles.modalDismissButtonText}>
                {t('modules.mail.detail.warningModalDismiss')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* WebView — renders the HTML mail body */}
      <WebView
        ref={webViewRef}
        source={{ html: webViewHtml, baseUrl: '' }}
        style={[styles.webView, { height: webViewHeight, backgroundColor }]}
        scrollEnabled={false}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleNavigationRequest}
        javaScriptEnabled={true}
        domStorageEnabled={false}
        allowsInlineMediaPlayback={false}
        mediaPlaybackRequiresUserAction={true}
        allowsLinkPreview={false}
        automaticallyAdjustContentInsets={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        decelerationRate="normal"
        accessibilityLabel={t('modules.mail.detail.mailBody')}
      />
    </View>
  );
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

  // State
  const [body, setBody] = useState<MailBody | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Image viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  /** Map of attachment index → local temp file URI (for downloaded thumbnails) */
  const [downloadedImages, setDownloadedImages] = useState<Map<number, string>>(new Map());
  /** Set of attachment indices currently being downloaded */
  const [downloadingImages, setDownloadingImages] = useState<Set<number>>(new Set());
  /** Set of attachment indices already saved to album */
  const [savedToAlbumIndices, setSavedToAlbumIndices] = useState<Set<number>>(new Set());

  const mountedRef = useRef(true);

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
          const db = await mailCache.getMailCacheDb();
          const cachedBody = await mailCache.getBody(db, account.id, header.uid);
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
            const db = await mailCache.getMailCacheDb();
            await mailCache.upsertBody(db, account.id, header.uid, serverBody.html, serverBody.plainText);
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
            const db = await mailCache.getMailCacheDb();
            await mailCache.updateReadStatus(db, account.id, header.folder, header.uid, true);
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
          }
        } catch {
          console.debug('[MailDetail] Failed to download image thumbnail:', attachment.name);
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
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: themeColors.border }]}
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

        {/* Delete button */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: themeColors.border }]}
          onPress={handleDelete}
          onLongPress={() => {}}
          delayLongPress={300}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
        >
          <Icon name="trash" size={22} color={themeColors.error} />
        </TouchableOpacity>
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
        ) : body?.html ? (
          <MailBodyWebView
            html={body.html}
            textColor={themeColors.textPrimary}
            backgroundColor={themeColors.background}
            linkColor={accentColor.primary}
            bannerBackgroundColor={themeColors.surface}
            bannerTextColor={themeColors.textSecondary}
            bannerButtonColor={accentColor.primary}
            senderDomain={extractDomain(senderEmail)}
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
                  <TouchableOpacity
                    key={attachment.index}
                    style={[styles.inlineThumbnailContainer, { borderColor: themeColors.border }]}
                    onPress={() => {
                      if (localUri) {
                        triggerHaptic();
                        // Find the viewer index for this attachment
                        const viewerIdx = imageAttachments
                          .filter(a => downloadedImages.has(a.index))
                          .findIndex(a => a.index === attachment.index);
                        setViewerInitialIndex(viewerIdx >= 0 ? viewerIdx : 0);
                        setViewerVisible(true);
                      }
                    }}
                    onLongPress={() => {}}
                    delayLongPress={300}
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
                      <View style={styles.thumbnailPlaceholder}>
                        <ActivityIndicator size="small" color={accentColor.primary} />
                      </View>
                    ) : (
                      <View style={styles.thumbnailPlaceholder}>
                        <Icon name="image" size={24} color={themeColors.textSecondary} />
                      </View>
                    )}

                    {/* Saved badge */}
                    {isSavedAlready && (
                      <View style={[styles.savedBadge, { backgroundColor: 'rgba(76, 175, 80, 0.85)' }]}>
                        <Icon name="check" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
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
      </ScrollView>

      {/* Fullscreen Image Viewer */}
      <FullscreenImageViewer
        visible={viewerVisible}
        images={viewerImages}
        initialIndex={viewerInitialIndex}
        onClose={() => setViewerVisible(false)}
        onSave={handleViewerSave}
        accentColor={accentColor.primary}
      />

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
        <TouchableOpacity
          style={[styles.bottomAction, { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: themeColors.border }]}
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
          style={[styles.bottomAction, { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: themeColors.border }]}
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
    </SafeAreaView>
  );
}

// ============================================================
// Attachment Icon Helper
// ============================================================

function getAttachmentIconName(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'videocam';
  if (mimeType === 'application/pdf') return 'document-text';
  if (mimeType === 'text/calendar') return 'time';
  if (mimeType === 'text/vcard' || mimeType === 'text/x-vcard') return 'person';
  if (mimeType.startsWith('text/')) return 'document-text';
  if (
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('presentation') ||
    mimeType.includes('pages') ||
    mimeType.includes('numbers') ||
    mimeType.includes('keynote') ||
    mimeType.includes('rtf')
  ) return 'document';
  if (mimeType.includes('zip')) return 'folder';
  return 'attach';
}

// ============================================================
// AttachmentRow Sub-component
// ============================================================

interface AttachmentRowProps {
  attachment: MailAttachmentMeta;
  uid: number;
  folder: string;
  accountId: string;
}

function AttachmentRow({ attachment, uid, folder, accountId }: AttachmentRowProps) {
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);

  const isSaveable = canSaveToAlbum(attachment.mimeType);

  const handleDownload = useCallback(async () => {
    triggerHaptic();
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
        Alert.alert(
          t('modules.mail.detail.downloadFailed'),
          result.error || t('modules.mail.detail.downloadFailedMessage'),
        );
      }
    } catch {
      Alert.alert(
        t('modules.mail.detail.downloadFailed'),
        t('modules.mail.detail.downloadFailedMessage'),
      );
    } finally {
      setIsDownloading(false);
    }
  }, [uid, folder, attachment, t]);

  const handleSaveToAlbum = useCallback(async () => {
    triggerHaptic();
    setIsSaving(true);
    setSaveResult(null);
    try {
      const { saveAttachmentToAlbum } = await import('@/services/mail/saveToAlbumService');
      const result = await saveAttachmentToAlbum(uid, folder, attachment, accountId);
      setSaveResult(result.success ? 'success' : 'error');
      if (result.success) {
        Alert.alert(
          t('modules.mail.detail.savedToAlbum'),
          attachment.name,
        );
      } else {
        Alert.alert(
          t('modules.mail.detail.saveToAlbumFailed'),
          t('modules.mail.detail.saveToAlbumFailedMessage'),
        );
      }
    } catch {
      setSaveResult('error');
      Alert.alert(
        t('modules.mail.detail.saveToAlbumFailed'),
        t('modules.mail.detail.saveToAlbumFailedMessage'),
      );
    } finally {
      setIsSaving(false);
    }
  }, [uid, folder, attachment, accountId, t]);

  const iconName = getAttachmentIconName(attachment.mimeType);

  return (
    <View style={[styles.attachmentRow, { borderColor: themeColors.border }]}>
      <TouchableOpacity
        style={styles.attachmentMainArea}
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

      {/* Save to album button for images/videos */}
      {isSaveable && (
        <TouchableOpacity
          style={[
            styles.saveToAlbumButton,
            saveResult === 'success' && { backgroundColor: '#E8F5E9' },
          ]}
          onPress={handleSaveToAlbum}
          onLongPress={() => {}}
          delayLongPress={300}
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
        </TouchableOpacity>
      )}
    </View>
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
  actionButton: {
    minWidth: touchTargets.minimum,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
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
  webView: {
    width: '100%',
    opacity: 0.99, // Forces WKWebView to use proper rendering
  },
  imageBanner: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  imageBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  imageBannerText: {
    ...typography.small,
    flex: 1,
  },
  loadImagesButton: {
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  loadImagesButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Warning modal (shown after images are loaded)
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    fontWeight: '700',
    flex: 1,
  },
  modalBody: {
    ...typography.body,
    lineHeight: 26,
  },
  modalDomainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  modalDomainLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  modalDomainValue: {
    ...typography.body,
    fontWeight: '700',
  },
  modalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    minHeight: touchTargets.minimum,
  },
  modalToggleLabel: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.md,
  },
  modalSettingsHint: {
    ...typography.small,
    fontStyle: 'italic',
  },
  modalDismissButton: {
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  modalDismissButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bodyText: {
    ...typography.body,
    lineHeight: 28,
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
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
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
  // bulkSave styles removed — replaced by inline thumbnails + viewer
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
});
