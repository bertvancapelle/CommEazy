/**
 * MailBodyWebView — Renders HTML mail body via WebView
 *
 * Extracted from MailDetailScreen for better separation of concerns.
 *
 * Features:
 * - CSP-based external image blocking (privacy by default)
 * - Per-domain image whitelist with toggle
 * - Auto-height measurement via injected JS
 * - Senior-friendly base styling
 * - Link interception via contentRouter
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Switch,
  Platform,
  Pressable,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { Icon, PanelAwareModal } from '@/components';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { ModalLayout } from '@/components/ModalLayout';
import { openURL as contentRouterOpenURL } from '@/services/mail/contentRouter';
import {
  isWhitelisted as isDomainWhitelisted,
  addDomain as whitelistDomain,
} from '@/services/mail/imageWhitelistService';
import { buildWebViewHtml } from './mailDetailHelpers';

// ============================================================
// Props
// ============================================================

export interface MailBodyWebViewProps {
  html: string;
  textColor: string;
  backgroundColor: string;
  linkColor: string;
  bannerBackgroundColor: string;
  bannerTextColor: string;
  bannerButtonColor: string;
  /** Sender domain for whitelist feature (e.g. "microsoft.com") */
  senderDomain: string;
  /** Base font size for mail body text (default: 18) */
  baseFontSize?: number;
}

// ============================================================
// Component
// ============================================================

export function MailBodyWebView({
  html,
  textColor,
  backgroundColor,
  linkColor,
  bannerBackgroundColor,
  bannerTextColor,
  bannerButtonColor,
  senderDomain,
  baseFontSize = 18,
}: MailBodyWebViewProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { triggerHaptic } = useFeedback();
  const [webViewHeight, setWebViewHeight] = useState(300);
  const [heightReceived, setHeightReceived] = useState(false);
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
    () => buildWebViewHtml(html, imagesLoaded, textColor, backgroundColor, linkColor, baseFontSize),
    [html, imagesLoaded, textColor, backgroundColor, linkColor, baseFontSize],
  );

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'height' && typeof msg.value === 'number') {
        const newHeight = Math.max(msg.value + 32, 100);
        setHeightReceived(true);
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
    triggerHaptic('tap');
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
    triggerHaptic('tap');
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
          <HapticTouchable hapticDisabled
            style={[styles.loadImagesButton, { backgroundColor: bannerButtonColor }]}
            onPress={handleLoadImages}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('modules.mail.detail.loadImages')}
          >
            <Text style={styles.loadImagesButtonText}>
              {t('modules.mail.detail.loadImages')}
            </Text>
          </HapticTouchable>
        </View>
      )}

      {/* Warning modal — shown after images are loaded (dismissable) */}
      <PanelAwareModal
        visible={showWarningModal}
        transparent
        animationType="fade"
        onRequestClose={handleDismissWarningModal}
      >
        <Pressable style={styles.modalOverlay} onPress={handleDismissWarningModal}>
          <LiquidGlassView moduleId="mail" style={styles.modalContent} cornerRadius={borderRadius.lg}>
            <ModalLayout
              headerBlock={
                <View style={styles.modalHeader}>
                  <Icon name="warning" size={28} color="#E65100" />
                  <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                    {t('modules.mail.detail.warningModalTitle')}
                  </Text>
                </View>
              }
              contentBlock={
                <>
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
                          triggerHaptic('tap');
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
                </>
              }
              footerBlock={
                <HapticTouchable hapticDisabled
                  style={[styles.modalDismissButton, { backgroundColor: accentColor.primary }]}
                  onPress={handleDismissWarningModal}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t('modules.mail.detail.warningModalDismiss')}
                >
                  <Text style={styles.modalDismissButtonText}>
                    {t('modules.mail.detail.warningModalDismiss')}
                  </Text>
                </HapticTouchable>
              }
            />
          </LiquidGlassView>
        </Pressable>
      </PanelAwareModal>

      {/* WebView — renders the HTML mail body */}
      <WebView
        ref={webViewRef}
        source={{ html: webViewHtml, baseUrl: '' }}
        style={[
          styles.webView,
          {
            // Use measured height if available, otherwise generous fallback
            height: heightReceived ? webViewHeight : 5000,
            backgroundColor,
          },
        ]}
        scrollEnabled={!heightReceived}
        nestedScrollEnabled={!heightReceived}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleNavigationRequest}
        onLoadEnd={() => {
          // Backup height measurement via injected JS in case the inline script didn't fire
          webViewRef.current?.injectJavaScript(`
            try {
              var h = Math.max(
                document.body.scrollHeight || 0,
                document.body.offsetHeight || 0,
                document.documentElement.scrollHeight || 0
              );
              if (h > 0) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
              }
            } catch(e) {}
            true;
          `);
        }}
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
// Styles
// ============================================================

const styles = StyleSheet.create({
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
});

export default MailBodyWebView;
