/**
 * ArticleWebViewer — Embedded WebView for full article reading
 *
 * Displays news articles in an embedded WebView with:
 * - AdMob banner at top
 * - Full webpage scrollable in WebView
 * - TTS controls to read the article aloud
 * - Close button to return to article list
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear button labels
 * - Loading indicator with text
 * - Haptic feedback on interactions
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, IconButton, AdMobBanner } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { NewsArticle } from '@/types/modules';

// ============================================================
// CSS Injection for improved readability
// ============================================================

/**
 * CSS injection script for nu.nl articles
 *
 * Senior-inclusive improvements:
 * - Larger font sizes (body 20px, headings proportionally larger)
 * - Better line height for readability (1.7)
 * - Hide ads, navigation, and clutter
 * - Improved contrast
 * - Wider content area on mobile
 * - LINKS DISABLED: Prevents accidental navigation when scrolling
 *   Links are greyed out and non-clickable (pointer-events: none)
 *   This keeps seniors focused on the current article
 *
 * IMPORTANT: This only affects visual presentation.
 * Content remains on nu.nl servers and is not copied.
 */
const NUNL_CSS_INJECTION = `
(function() {
  // Create style element
  var style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = \`
    /* === HIDE CLUTTER === */
    /* Navigation, headers, footers */
    header, footer, nav,
    [class*="navigation"],
    [class*="header-"],
    [class*="footer-"],
    [class*="menu"],
    [class*="sidebar"],
    [class*="related"],
    [class*="trending"],
    [class*="popular"],
    [class*="recommended"],
    [class*="social"],
    [class*="share"],
    [class*="comment"],
    [class*="newsletter"],
    [class*="subscribe"],
    [class*="cookie"],
    [class*="banner"],
    [class*="promo"],
    [class*="advertisement"],
    [class*="ad-"],
    [class*="-ad"],
    [id*="ad-"],
    [id*="-ad"],
    iframe,
    .ad, .ads, .advertisement,
    [data-ad], [data-advertisement] {
      display: none !important;
    }

    /* === TYPOGRAPHY === */
    /* Body text - senior-friendly size */
    body, p, li, td, th, span, div {
      font-size: 20px !important;
      line-height: 1.7 !important;
    }

    /* Article content specifically */
    article, [class*="article"], [class*="content"], main {
      font-size: 20px !important;
      line-height: 1.7 !important;
    }

    /* Headings - proportionally larger */
    h1 {
      font-size: 32px !important;
      line-height: 1.3 !important;
      margin-bottom: 16px !important;
    }
    h2 {
      font-size: 28px !important;
      line-height: 1.3 !important;
      margin-bottom: 14px !important;
    }
    h3 {
      font-size: 24px !important;
      line-height: 1.4 !important;
      margin-bottom: 12px !important;
    }

    /* === LAYOUT === */
    /* Full width content on mobile */
    body, main, article, [class*="article"], [class*="content"] {
      max-width: 100% !important;
      width: 100% !important;
      padding-left: 16px !important;
      padding-right: 16px !important;
      margin: 0 auto !important;
      box-sizing: border-box !important;
    }

    /* Remove side margins that waste space */
    [class*="container"], [class*="wrapper"] {
      max-width: 100% !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
    }

    /* === IMAGES === */
    /* Ensure images scale properly */
    img {
      max-width: 100% !important;
      height: auto !important;
    }

    /* === LINKS === */
    /* Links are visually distinguished but disabled for tap */
    a {
      color: #666666 !important;
      text-decoration: none !important;
      pointer-events: none !important;
    }

    /* === CONTRAST === */
    /* Ensure good text contrast */
    p, li, span, div, article {
      color: #1a1a1a !important;
    }

    /* === SPACING === */
    /* Better paragraph spacing */
    p {
      margin-bottom: 1.2em !important;
    }
  \`;
  document.head.appendChild(style);

  // Also try to scroll to article content
  setTimeout(function() {
    var article = document.querySelector('article') ||
                  document.querySelector('[class*="article-content"]') ||
                  document.querySelector('main');
    if (article) {
      article.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 500);
})();
true; // Required for injectedJavaScript to work
`;

// ============================================================
// Types
// ============================================================

export interface ArticleWebViewerProps {
  /** Whether the viewer is visible */
  visible: boolean;
  /** The article to display */
  article: NewsArticle | null;
  /** Callback when the viewer is closed */
  onClose: () => void;
  /** Accent color for the module */
  accentColor: string;

  // TTS controls
  /** Callback to start TTS playback (full article text) */
  onStartTTS?: (article: NewsArticle, useFullText: boolean) => void;
  /** Callback to stop TTS playback */
  onStopTTS?: () => void;
  /** Whether TTS is currently playing */
  isTTSPlaying?: boolean;
  /** Whether TTS is loading */
  isTTSLoading?: boolean;

  // AdMob
  /** Whether to show AdMob banner */
  showAdMob?: boolean;
}

// ============================================================
// Main Component
// ============================================================

export function ArticleWebViewer({
  visible,
  article,
  onClose,
  accentColor,
  onStartTTS,
  onStopTTS,
  isTTSPlaying = false,
  isTTSLoading = false,
  showAdMob = true,
}: ArticleWebViewerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { triggerFeedback } = useFeedback();
  const reducedMotion = useReducedMotion();
  const webViewRef = useRef<WebView>(null);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Handle close
  const handleClose = useCallback(() => {
    void triggerFeedback('tap');
    // Stop TTS if playing
    if (isTTSPlaying) {
      onStopTTS?.();
    }
    onClose();
  }, [isTTSPlaying, onStopTTS, onClose, triggerFeedback]);

  // Handle TTS toggle
  const handleTTSToggle = useCallback(() => {
    if (!article) return;

    void triggerFeedback('tap');

    if (isTTSPlaying) {
      onStopTTS?.();
    } else {
      // Start TTS with full text extraction
      onStartTTS?.(article, true);
    }
  }, [article, isTTSPlaying, onStartTTS, onStopTTS, triggerFeedback]);

  // Handle WebView load start
  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setLoadError(false);
  }, []);

  // Handle WebView load end
  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Handle WebView error
  const handleError = useCallback(() => {
    setIsLoading(false);
    setLoadError(true);
  }, []);

  // Handle retry
  const handleRetry = useCallback(() => {
    setLoadError(false);
    webViewRef.current?.reload();
  }, []);

  if (!article) return null;

  return (
    <Modal
      visible={visible}
      animationType={reducedMotion ? 'fade' : 'slide'}
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: accentColor }]}>
          <IconButton
            icon="chevron-down"
            onPress={handleClose}
            size={48}
            color={colors.textOnPrimary}
            accessibilityLabel={t('articleViewer.close')}
          />

          <Text style={styles.headerTitle} numberOfLines={1}>
            {article.title}
          </Text>

          <View style={{ width: 48 }} />
        </View>

        {/* AdMob Banner */}
        {showAdMob && (
          <View style={styles.adContainer}>
            <AdMobBanner size="banner" />
          </View>
        )}

        {/* WebView Container */}
        <View style={styles.webViewContainer}>
          {/* Loading Indicator */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={accentColor} />
              <Text style={styles.loadingText}>{t('articleViewer.loading')}</Text>
            </View>
          )}

          {/* Error State */}
          {loadError && (
            <View style={styles.errorContainer}>
              <Icon name="warning" size={48} color={colors.error} />
              <Text style={styles.errorTitle}>{t('modules.nunl.errors.network')}</Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: accentColor }]}
                onPress={handleRetry}
                accessibilityRole="button"
                accessibilityLabel={t('common.try_again')}
              >
                <Text style={styles.retryButtonText}>{t('common.try_again')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* WebView */}
          {!loadError && (
            <WebView
              ref={webViewRef}
              source={{ uri: article.link }}
              style={styles.webView}
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              startInLoadingState={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scalesPageToFit={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              // Improve scrolling performance
              decelerationRate="normal"
              showsVerticalScrollIndicator={true}
              showsHorizontalScrollIndicator={false}
              // Block popups and new windows
              setSupportMultipleWindows={false}
              // CSS injection for improved readability
              // Larger fonts, hide ads/navigation, better spacing
              injectedJavaScript={NUNL_CSS_INJECTION}
              // Accessibility
              accessibilityLabel={t('articleViewer.webViewLabel', { title: article.title })}
            />
          )}
        </View>

        {/* Bottom Controls */}
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + spacing.md }]}>
          {/* TTS Button */}
          <TouchableOpacity
            style={[
              styles.ttsButton,
              { backgroundColor: accentColor },
              isTTSLoading && styles.ttsButtonDisabled,
            ]}
            onPress={handleTTSToggle}
            disabled={isTTSLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              isTTSPlaying
                ? t('articleViewer.stop')
                : t('articleViewer.readAloud')
            }
            accessibilityState={{ disabled: isTTSLoading }}
          >
            {isTTSLoading ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Icon
                name={isTTSPlaying ? 'pause' : 'volume-up'}
                size={24}
                color={colors.textOnPrimary}
              />
            )}
            <Text style={styles.ttsButtonText}>
              {isTTSLoading
                ? t('articleViewer.loading')
                : isTTSPlaying
                  ? t('articleViewer.stop')
                  : t('articleViewer.readAloud')
              }
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: touchTargets.comfortable,
  },
  headerTitle: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },

  // AdMob
  adContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // WebView
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    zIndex: 1,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    minHeight: touchTargets.comfortable,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },

  // Bottom Controls
  bottomControls: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ttsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
    gap: spacing.sm,
  },
  ttsButtonDisabled: {
    opacity: 0.6,
  },
  ttsButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
});

export default ArticleWebViewer;
