/**
 * ArticleWebViewer — Embedded WebView for full article reading
 *
 * Displays news articles in an embedded WebView with:
 * - AdMob banner at top
 * - Full webpage scrollable in WebView
 * - TTS controls to read the article aloud
 * - Close button to return to article list
 *
 * Cookie Consent Handling:
 * - Auto-accepts OneTrust GDPR cookie consent popup
 * - Uses sharedCookiesEnabled to persist consent across sessions
 * - Injects JavaScript before page load to suppress popup
 *
 * URL Filtering (Security):
 * - Only nu.nl URLs are allowed to load in WebView
 * - External links are blocked (no browser redirect)
 * - Prevents accidental navigation away from article
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear button labels
 * - Loading indicator with text
 * - Haptic feedback on interactions
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { WebView, WebViewNavigation, WebViewOpenWindowEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, IconButton, AdMobBanner } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { orientationService } from '@/services/orientationService';
import type { NewsArticle } from '@/types/modules';

// ============================================================
// AsyncStorage Keys
// ============================================================

const ALWAYS_OPEN_EXTERNAL_LINKS_KEY = 'article_always_open_external_links';

// ============================================================
// Allowed Domains for URL Filtering
// ============================================================

/**
 * List of allowed domains for WebView navigation.
 * Only URLs matching these domains will be loaded.
 * All other URLs are blocked to prevent accidental navigation.
 */
const ALLOWED_DOMAINS = [
  'nu.nl',
  'www.nu.nl',
  'm.nu.nl',
  // CDN domains used by nu.nl for images/assets
  'media.nu.nl',
  'images.nu.nl',
  // Additional nu.nl subdomains
  'cdn.nu.nl',
  'static.nu.nl',
  'api.nu.nl',
  // DPG Media (nu.nl parent company) - required for cookie consent flow
  'dpgmedia.nl',
  'myprivacy.dpgmedia.nl',
  'www.myprivacy.dpgmedia.nl',
  'privacy.dpgmedia.nl',
  'consent.dpgmedia.nl',
  'cmp.dpgmedia.nl',
  // Additional DPG Media subdomains that may be used in consent flow
  'api.dpgmedia.nl',
  'auth.dpgmedia.nl',
  'login.dpgmedia.nl',
];

/**
 * Blocked domains for ad/tracking (extra safety layer)
 * These are blocked even if they somehow pass the allowed check
 */
const BLOCKED_DOMAINS = [
  'googlesyndication.com',
  'doubleclick.net',
  'googleadservices.com',
  'facebook.com',
  'facebook.net',
  'twitter.com',
  'linkedin.com',
  'onetrust.com', // Cookie consent provider (we handle this ourselves)
  'cookielaw.org',
];

// ============================================================
// Cookie Consent Auto-Accept Script
// ============================================================

/**
 * JavaScript injected BEFORE page content loads.
 * This script auto-accepts GDPR cookie consent popups from:
 * - OneTrust (common consent provider)
 * - DPG Media (nu.nl parent company's custom consent)
 *
 * How it works:
 * 1. Immediately hides cookie banners via CSS
 * 2. Clicks accept buttons when they appear
 * 3. Uses MutationObserver to catch late-loading popups
 * 4. Intercepts window.open to prevent external browser redirects
 *
 * Platform notes:
 * - Works on both iOS and Android
 * - Uses sharedCookiesEnabled to persist consent
 */
const COOKIE_CONSENT_SCRIPT = `
(function() {
  'use strict';

  // === PRE-SET CONSENT COOKIES ===
  // Set DPG Media / nu.nl consent cookies BEFORE the page checks them
  // This prevents the cookie banner from appearing at all
  try {
    // DPG Media consent cookie (TCF v2 format)
    // This is a base64-encoded consent string that indicates "all accepted"
    var consentExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();

    // OneTrust consent cookie
    document.cookie = 'OptanonAlertBoxClosed=' + new Date().toISOString() + '; path=/; max-age=31536000; SameSite=Lax';
    document.cookie = 'OptanonConsent=isGpcEnabled=0&datestamp=' + encodeURIComponent(new Date().toISOString()) + '&version=6.39.0&isIABGlobal=false&hosts=&consentId=commeazy-app&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1; path=/; max-age=31536000; SameSite=Lax';

    // DPG Media specific consent cookies
    document.cookie = 'dpg_consent=1; path=/; max-age=31536000; SameSite=Lax';
    document.cookie = 'npo_cc=30; path=/; max-age=31536000; SameSite=Lax';
    document.cookie = 'npo_cc_session=1; path=/; SameSite=Lax';

    // Privacy wall bypass
    document.cookie = 'privacy_wall_accepted=1; path=/; max-age=31536000; SameSite=Lax';
    document.cookie = 'consent_wall_accepted=1; path=/; max-age=31536000; SameSite=Lax';

    console.log('[CommEazy] Pre-set consent cookies');
  } catch (e) {
    console.log('[CommEazy] Failed to pre-set cookies:', e);
  }

  // === INTERCEPT WINDOW.OPEN ===
  // DPG Media consent may try to open external browser - block this
  var originalOpen = window.open;
  window.open = function(url, target, features) {
    console.log('[CommEazy] Blocked window.open:', url);
    // If it's a nu.nl URL, navigate in current window instead
    if (url && url.includes('nu.nl')) {
      window.location.href = url;
      return window;
    }
    // If it's a consent/privacy URL, handle it in current window
    if (url && (url.includes('consent') || url.includes('privacy') || url.includes('dpgmedia'))) {
      window.location.href = url;
      return window;
    }
    // Block other popups entirely
    return null;
  };

  // === IMMEDIATE CSS HIDE ===
  // Hide cookie banner immediately before it even renders
  var hideStyle = document.createElement('style');
  hideStyle.id = 'commeazy-cookie-hide';
  hideStyle.textContent = \`
    /* OneTrust cookie banner - hide everything */
    #onetrust-consent-sdk,
    #onetrust-banner-sdk,
    .onetrust-pc-dark-filter,
    .ot-fade-in,
    [class*="onetrust"],
    [id*="onetrust"],
    /* DPG Media consent banner */
    [class*="cmp-"],
    [class*="consent-"],
    [class*="privacy-wall"],
    [class*="cookie-wall"],
    #privacy-gate,
    .privacy-gate,
    /* Generic cookie banner selectors */
    [class*="cookie-banner"],
    [class*="cookie-consent"],
    [class*="cookie-notice"],
    [class*="gdpr"],
    [class*="privacy-banner"],
    /* Overlay/backdrop */
    .ot-sdk-container,
    #ot-sdk-btn-container {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    /* Restore body scroll if locked */
    body.ot-overflow-hidden,
    html.ot-overflow-hidden,
    body.privacy-wall-active,
    body.consent-wall-active {
      overflow: auto !important;
      position: static !important;
    }
  \`;
  (document.head || document.documentElement).appendChild(hideStyle);

  // === AUTO-ACCEPT FUNCTION ===
  function acceptCookies() {
    // Try multiple selectors for the accept button
    // Includes both OneTrust and DPG Media consent buttons
    var selectors = [
      // OneTrust
      '#onetrust-accept-btn-handler',
      '.onetrust-accept-btn-handler',
      // DPG Media / Generic
      '[data-testid="accept-button"]',
      '[data-testid="consent-accept"]',
      'button[class*="accept"]',
      'button[class*="consent"]',
      'button[class*="agree"]',
      '[id*="accept"]',
      'button[title*="Accept"]',
      'button[title*="Accepteren"]', // Dutch
      'button[title*="Akkoord"]',    // Dutch alternative
      'button[title*="Alle cookies"]', // Dutch: Accept all cookies
      // Text-based matching (last resort)
      'button:contains("Akkoord")',
      'button:contains("Accepteren")',
    ];

    for (var i = 0; i < selectors.length; i++) {
      try {
        var btn = document.querySelector(selectors[i]);
        if (btn && typeof btn.click === 'function') {
          btn.click();
          console.log('[CommEazy] Cookie consent auto-accepted via:', selectors[i]);
          return true;
        }
      } catch (e) {
        // Silently continue - selector may be invalid
      }
    }

    // Try OneTrust API directly if available
    if (typeof OneTrust !== 'undefined' && OneTrust.AllowAll) {
      try {
        OneTrust.AllowAll();
        console.log('[CommEazy] Cookie consent accepted via OneTrust API');
        return true;
      } catch (e) {
        // Silently continue
      }
    }

    // Try DPG Media CMP API if available
    if (typeof __cmp !== 'undefined') {
      try {
        __cmp('setConsent', { 'all': true });
        console.log('[CommEazy] Cookie consent accepted via __cmp API');
        return true;
      } catch (e) {
        // Silently continue
      }
    }

    return false;
  }

  // === MUTATION OBSERVER ===
  // Watch for cookie banner appearing and auto-accept
  var observer = new MutationObserver(function(mutations) {
    if (acceptCookies()) {
      observer.disconnect();
    }
  });

  // Start observing once DOM is ready
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // === RETRY ATTEMPTS ===
  // Try to accept cookies at various stages of page load
  var attempts = 0;
  var maxAttempts = 15;
  var retryInterval = setInterval(function() {
    attempts++;
    if (acceptCookies() || attempts >= maxAttempts) {
      clearInterval(retryInterval);
    }
  }, 400);

  // === CLEANUP ===
  // Disconnect observer after 15 seconds to save resources
  setTimeout(function() {
    observer.disconnect();
    clearInterval(retryInterval);
    // Restore window.open after consent phase
    window.open = originalOpen;
  }, 15000);

})();
true;
`;

// ============================================================
// CSS Injection for cookie consent & ads
// ============================================================

/**
 * CSS injection script for nu.nl articles (runs AFTER page load)
 *
 * MINIMAL VERSION: Only hides cookie consent and ads.
 * The original article layout and styling is preserved.
 * This ensures users see the REAL nu.nl article, not a stripped version.
 *
 * What we hide:
 * - Cookie consent popups (OneTrust, DPG Media)
 * - Advertisements and ad containers
 * - Social sharing buttons
 *
 * What we DON'T hide:
 * - Navigation, header, footer (these are part of the site experience)
 * - Article content, images, videos
 * - Comments sections (users can scroll past if they want)
 */
const NUNL_CSS_INJECTION = `
(function() {
  // Create style element
  var style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = \`
    /* === HIDE COOKIE CONSENT ONLY === */
    /* OneTrust GDPR consent popup */
    #onetrust-consent-sdk,
    #onetrust-banner-sdk,
    .onetrust-pc-dark-filter,
    .ot-fade-in,
    .ot-sdk-container,
    #ot-sdk-btn-container,
    /* DPG Media consent banners */
    #privacy-gate,
    .privacy-gate,
    [class*="privacy-wall"],
    [class*="cookie-wall"],
    [class*="consent-banner"],
    [class*="consent-modal"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    /* Restore body scroll if consent locked it */
    body.ot-overflow-hidden,
    html.ot-overflow-hidden,
    body.privacy-wall-active,
    body.consent-wall-active {
      overflow: auto !important;
      position: static !important;
    }

    /* === HIDE ADS ONLY === */
    /* Be specific to avoid hiding article content */
    [data-ad],
    [data-advertisement],
    .ad-container,
    .advertisement,
    .google-ad,
    [id*="google_ads"],
    [class*="googlesyndication"] {
      display: none !important;
    }
  \`;
  document.head.appendChild(style);
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
  /** Callback to start TTS playback with extracted text from WebView */
  onStartTTSWithText?: (article: NewsArticle, extractedText: string) => void;
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
  onStartTTSWithText,
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
  const [canGoBack, setCanGoBack] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState(false);

  // External link confirmation state
  const [pendingExternalUrl, setPendingExternalUrl] = useState<string | null>(null);
  const [alwaysOpenExternal, setAlwaysOpenExternal] = useState<boolean | null>(null);

  // Load "always open external links" preference on mount
  useEffect(() => {
    AsyncStorage.getItem(ALWAYS_OPEN_EXTERNAL_LINKS_KEY).then((value) => {
      setAlwaysOpenExternal(value === 'true');
    });
  }, []);

  // Reset loading state when modal opens with a new article
  // Also add a timeout fallback to prevent infinite loading
  useEffect(() => {
    if (visible && article) {
      setIsLoading(true);
      setLoadError(false);
      setCanGoBack(false); // Reset navigation history

      // Fallback timeout: if loading takes longer than 20 seconds, stop spinner
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
        console.warn('[ArticleWebViewer] Loading timeout reached');
      }, 20000);

      return () => clearTimeout(timeoutId);
    }
  }, [visible, article?.id]);

  // Cleanup orientation lock when component unmounts or modal closes
  useEffect(() => {
    return () => {
      // Ensure orientation is locked when leaving the viewer
      orientationService.lockToPortrait();
    };
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    void triggerFeedback('tap');
    // Stop TTS if playing
    if (isTTSPlaying) {
      onStopTTS?.();
    }
    // Lock orientation back to portrait when closing
    orientationService.lockToPortrait();
    onClose();
  }, [isTTSPlaying, onStopTTS, onClose, triggerFeedback]);

  // Handle back navigation within WebView
  const handleGoBack = useCallback(() => {
    void triggerFeedback('tap');
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    }
  }, [canGoBack, triggerFeedback]);

  // Handle navigation state change (track if we can go back)
  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    console.debug('[ArticleWebViewer] Navigation state:', {
      url: navState.url?.substring(0, 80),
      canGoBack: navState.canGoBack,
    });
  }, []);

  // Handle TTS toggle - extract text from WebView and pass to TTS
  const handleTTSToggle = useCallback(() => {
    if (!article) return;

    void triggerFeedback('tap');

    if (isTTSPlaying) {
      onStopTTS?.();
    } else {
      // Extract text from WebView via JavaScript injection
      // This uses the same cookies/session as the WebView, so cookie consent is already handled
      setIsExtractingText(true);
      console.info('[ArticleWebViewer] Starting text extraction from WebView');

      const extractTextScript = `
        (function() {
          try {
            // Extract article text from nu.nl page
            // Structure: Title (already added by React Native) -> Lead/Intro -> Body paragraphs
            var parts = [];

            // 1. Extract LEAD/INTRO text (the bold summary between title and body)
            // nu.nl uses various class patterns - we try multiple selectors
            var leadSelectors = [
              // nu.nl specific patterns
              '.block--article-lead',
              '.block.block--article-lead',
              '[class*="article-lead"]',
              '[class*="articleLead"]',
              '[class*="ArticleLead"]',
              // Common patterns
              '.article-lead',
              '.article__lead',
              '.article-intro',
              '.article__intro',
              '.lead',
              '.intro',
              '.summary',
              '.excerpt',
              '.standfirst',
              // Header-based patterns
              'article header p:first-of-type',
              '.article-header p',
              'header.article-header p',
              // Data attribute patterns
              '[data-type="intro"]',
              '[data-component="intro"]',
              // Bold intro paragraph (often styled differently)
              'article p strong:first-child',
              'article > p:first-of-type'
            ];

            for (var i = 0; i < leadSelectors.length; i++) {
              var leadEl = document.querySelector(leadSelectors[i]);
              if (leadEl) {
                var leadText = (leadEl.innerText || leadEl.textContent || '').trim();
                if (leadText.length > 20) {
                  parts.push(leadText);
                  console.log('[CommEazy] Found lead via:', leadSelectors[i], leadText.length, 'chars');
                  break;
                }
              }
            }

            // If no lead found, try to find the first bold/strong paragraph
            if (parts.length === 0) {
              var firstStrong = document.querySelector('article p > strong');
              if (firstStrong && firstStrong.parentElement) {
                var strongText = (firstStrong.parentElement.innerText || firstStrong.parentElement.textContent || '').trim();
                if (strongText.length > 20 && strongText.length < 500) {
                  parts.push(strongText);
                  console.log('[CommEazy] Found lead via strong parent:', strongText.length, 'chars');
                }
              }
            }

            // 2. Extract BODY paragraphs
            var bodySelectors = [
              '.block--paragraph',
              '.block.block--paragraph',
              '[class*="paragraph"]',
              '.article-body p',
              '.article__body p',
              'article p',
              '[class*="article-content"] p',
              '[class*="articleContent"] p'
            ];

            var bodyParagraphs = [];
            for (var j = 0; j < bodySelectors.length; j++) {
              var blocks = document.querySelectorAll(bodySelectors[j]);
              if (blocks.length > 0) {
                blocks.forEach(function(block) {
                  var blockText = (block.innerText || block.textContent || '').trim();
                  // Skip if too short or if it's the same as the lead
                  if (blockText.length > 30 && parts.indexOf(blockText) === -1) {
                    bodyParagraphs.push(blockText);
                  }
                });
                if (bodyParagraphs.length > 0) {
                  console.log('[CommEazy] Found', bodyParagraphs.length, 'body paragraphs via:', bodySelectors[j]);
                  break;
                }
              }
            }

            parts = parts.concat(bodyParagraphs);

            // Fallback: try article element if we found nothing
            if (parts.length === 0) {
              var article = document.querySelector('article');
              if (article) {
                var articleText = (article.innerText || article.textContent || '').trim();
                if (articleText.length > 100) {
                  parts.push(articleText);
                }
              }
            }

            // Fallback: try main element
            if (parts.length === 0) {
              var main = document.querySelector('main');
              if (main) {
                var mainText = (main.innerText || main.textContent || '').trim();
                if (mainText.length > 100) {
                  parts.push(mainText);
                }
              }
            }

            // Join all parts and clean up
            var text = parts.join(' ')
              .replace(/\\s+/g, ' ')
              .replace(/\\n+/g, ' ')
              .trim();

            console.log('[CommEazy] Total extracted:', text.length, 'chars from', parts.length, 'parts');

            // Send back to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'extractedText',
              text: text,
              length: text.length,
              partsCount: parts.length
            }));
          } catch (e) {
            console.error('[CommEazy] Extraction error:', e);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'extractedText',
              error: e.message,
              text: ''
            }));
          }
        })();
        true;
      `;

      webViewRef.current?.injectJavaScript(extractTextScript);
    }
  }, [article, isTTSPlaying, onStopTTS, triggerFeedback]);

  // Handle messages from WebView (text extraction results)
  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === 'extractedText') {
          setIsExtractingText(false);

          if (data.error) {
            console.error('[ArticleWebViewer] Text extraction error:', data.error);
            // Fallback to article description
            if (article) {
              const fallbackText = `${article.title}. ${article.description}`;
              console.info('[ArticleWebViewer] Using fallback text:', fallbackText.length, 'chars');
              onStartTTSWithText?.(article, fallbackText);
            }
            return;
          }

          if (data.text && data.text.length > 50 && article) {
            // Build full text: Title + RSS description (abstract) + extracted body
            // This ensures the "Samenvatting" from the RSS is ALWAYS included
            // The extracted text may or may not include the lead, but we have the RSS description as backup

            // Check if extracted text already starts with the description (avoid duplication)
            const descStart = article.description.substring(0, 50).toLowerCase();
            const extractedStart = data.text.substring(0, 50).toLowerCase();
            const descriptionAlreadyIncluded = extractedStart.includes(descStart) || descStart.includes(extractedStart);

            let fullText: string;
            if (descriptionAlreadyIncluded) {
              // Description is already in the extracted text, just add title
              fullText = `${article.title}. ${data.text}`;
              console.info('[ArticleWebViewer] Extracted text already includes description');
            } else {
              // Add RSS description (abstract) between title and body
              fullText = `${article.title}. ${article.description}. ${data.text}`;
              console.info('[ArticleWebViewer] Added RSS description to extracted text');
            }

            console.info('[ArticleWebViewer] Final text:', fullText.length, 'chars');
            onStartTTSWithText?.(article, fullText);
          } else if (article) {
            // Text too short, use fallback
            const fallbackText = `${article.title}. ${article.description}`;
            console.info('[ArticleWebViewer] Extracted text too short, using fallback:', fallbackText.length, 'chars');
            onStartTTSWithText?.(article, fallbackText);
          }
        }
      } catch (e) {
        console.error('[ArticleWebViewer] Failed to parse WebView message:', e);
        setIsExtractingText(false);
      }
    },
    [article, onStartTTSWithText]
  );

  // Handle WebView load start
  const handleLoadStart = useCallback((event: { nativeEvent: { url: string } }) => {
    console.debug('[ArticleWebViewer] Load start:', event.nativeEvent.url);
    setIsLoading(true);
    setLoadError(false);
  }, []);

  // Handle WebView load end
  const handleLoadEnd = useCallback((event: { nativeEvent: { url: string } }) => {
    console.debug('[ArticleWebViewer] Load end:', event.nativeEvent.url);
    setIsLoading(false);
  }, []);

  // Handle WebView error
  const handleError = useCallback((event: { nativeEvent: { code: number; description: string } }) => {
    console.error('[ArticleWebViewer] WebView error:', event.nativeEvent);
    setIsLoading(false);
    setLoadError(true);
  }, []);

  // Handle HTTP error (e.g., 404, 500)
  const handleHttpError = useCallback((event: { nativeEvent: { statusCode: number } }) => {
    console.error('[ArticleWebViewer] HTTP error:', event.nativeEvent.statusCode);
    setIsLoading(false);
    setLoadError(true);
  }, []);

  // Handle retry
  const handleRetry = useCallback(() => {
    setLoadError(false);
    webViewRef.current?.reload();
  }, []);

  // ============================================================
  // External Link Confirmation Handlers
  // ============================================================

  // Cancel external link navigation
  const handleExternalLinkCancel = useCallback(() => {
    void triggerFeedback('tap');
    setPendingExternalUrl(null);
  }, [triggerFeedback]);

  // Open external link once
  const handleExternalLinkOpen = useCallback(async () => {
    void triggerFeedback('tap');
    if (pendingExternalUrl) {
      try {
        await Linking.openURL(pendingExternalUrl);
      } catch (error) {
        console.warn('[ArticleWebViewer] Failed to open external URL:', error);
      }
    }
    setPendingExternalUrl(null);
  }, [pendingExternalUrl, triggerFeedback]);

  // Open external link and remember preference
  const handleExternalLinkAlways = useCallback(async () => {
    void triggerFeedback('tap');
    // Save preference
    setAlwaysOpenExternal(true);
    await AsyncStorage.setItem(ALWAYS_OPEN_EXTERNAL_LINKS_KEY, 'true');
    // Open the link
    if (pendingExternalUrl) {
      try {
        await Linking.openURL(pendingExternalUrl);
      } catch (error) {
        console.warn('[ArticleWebViewer] Failed to open external URL:', error);
      }
    }
    setPendingExternalUrl(null);
  }, [pendingExternalUrl, triggerFeedback]);

  /**
   * Handle window.open() and target="_blank" links
   *
   * This handler is called when JavaScript tries to open a new window/tab.
   * Instead of opening a new browser window (which would exit the app),
   * we navigate to the URL within the current WebView.
   *
   * This is CRITICAL for preventing the nu.nl app from opening:
   * - Cookie accept buttons often use window.open() or target="_blank"
   * - iOS detects nu.nl URLs and tries to open the nu.nl app (Universal Links)
   * - By handling this ourselves, we keep the user in CommEazy
   *
   * @param syntheticEvent - Contains targetUrl that was requested
   */
  const handleOpenWindow = useCallback(
    (syntheticEvent: WebViewOpenWindowEvent) => {
      const { targetUrl } = syntheticEvent.nativeEvent;

      console.info('[ArticleWebViewer] onOpenWindow intercepted:', targetUrl);

      if (!targetUrl) {
        return;
      }

      // Check if it's a nu.nl URL - navigate in current WebView
      if (targetUrl.includes('nu.nl')) {
        console.info('[ArticleWebViewer] Navigating to nu.nl URL in WebView:', targetUrl);
        webViewRef.current?.injectJavaScript(`
          window.location.href = "${targetUrl}";
          true;
        `);
        return;
      }

      // For consent/privacy URLs, also handle in WebView
      if (targetUrl.includes('consent') || targetUrl.includes('privacy') || targetUrl.includes('dpgmedia')) {
        console.info('[ArticleWebViewer] Navigating to consent URL in WebView:', targetUrl);
        webViewRef.current?.injectJavaScript(`
          window.location.href = "${targetUrl}";
          true;
        `);
        return;
      }

      // For other external URLs, show the confirmation modal
      console.debug('[ArticleWebViewer] External URL in onOpenWindow, showing confirmation');
      setPendingExternalUrl(targetUrl);
    },
    [],
  );

  /**
   * URL Filter Handler
   *
   * Controls which URLs can be loaded in the WebView.
   * External links show a confirmation modal before opening in the system browser.
   *
   * Behavior:
   * - Allow: nu.nl domains (main site, mobile, media CDN)
   * - Block: Known ad/tracking domains
   * - External links: Show confirmation modal (or open directly if "always" is set)
   *
   * Platform differences:
   * - iOS: onShouldStartLoadWithRequest is called for ALL requests
   * - Android: Only called for main frame navigation, not iframes/resources
   *   For Android, we also use setSupportMultipleWindows={false}
   *
   * @param request - Navigation request from WebView
   * @returns true to allow, false to block
   */
  const handleShouldStartLoadWithRequest = useCallback(
    (request: WebViewNavigation): boolean => {
      const { url, navigationType } = request;

      // Always allow about:blank and data: URLs (internal WebView pages)
      if (url.startsWith('about:') || url.startsWith('data:')) {
        return true;
      }

      // Parse the URL to extract domain
      let domain: string;
      try {
        const urlObj = new URL(url);
        domain = urlObj.hostname.toLowerCase();
      } catch {
        // Invalid URL - block it
        console.debug('[ArticleWebViewer] Blocked invalid URL');
        return false;
      }

      // Check against blocked domains first (ad networks, trackers)
      for (const blocked of BLOCKED_DOMAINS) {
        if (domain.includes(blocked)) {
          console.debug('[ArticleWebViewer] Blocked ad/tracking domain:', domain);
          return false;
        }
      }

      // Check if domain is in allowed list
      const isAllowed = ALLOWED_DOMAINS.some((allowed) => {
        // Exact match or subdomain match
        return domain === allowed || domain.endsWith('.' + allowed);
      });

      // Special handling for consent/privacy URLs - allow any dpgmedia subdomain
      const isConsentUrl = domain.includes('dpgmedia') ||
                           domain.includes('consent') ||
                           domain.includes('privacy') ||
                           url.includes('consent') ||
                           url.includes('privacy') ||
                           url.includes('cookie');

      console.debug('[ArticleWebViewer] URL check:', {
        url: url.substring(0, 120),
        domain,
        isAllowed,
        isConsentUrl,
        navigationType,
      });

      // Allow consent-related URLs even if not in explicit list
      if (isConsentUrl && !isAllowed) {
        console.info('[ArticleWebViewer] Allowing consent URL:', domain);
        return true;
      }

      if (!isAllowed) {
        // External link detected!
        // Only intercept user-initiated clicks (not automatic redirects)
        // navigationType 'click' on iOS, undefined on Android for user taps
        const isUserClick = navigationType === 'click' || Platform.OS === 'android';

        if (isUserClick) {
          // If "always open" preference is set, open directly
          if (alwaysOpenExternal) {
            console.debug('[ArticleWebViewer] Opening external URL (always):', domain);
            Linking.openURL(url).catch((error) => {
              console.warn('[ArticleWebViewer] Failed to open URL:', error);
            });
          } else {
            // Show confirmation modal
            console.debug('[ArticleWebViewer] External link, showing confirmation:', domain);
            setPendingExternalUrl(url);
          }
        }

        // Block navigation in WebView (we handle it via Linking)
        return false;
      }

      return true;
    },
    [alwaysOpenExternal],
  );

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
          {/* Spacer for symmetry */}
          <View style={{ width: 48 }} />

          <Text style={styles.headerTitle} numberOfLines={1}>
            {article.title}
          </Text>

          {/* Close button - always visible */}
          <IconButton
            icon="close"
            onPress={handleClose}
            size={48}
            color={colors.textOnPrimary}
            accessibilityLabel={t('articleViewer.close')}
          />
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
              // ============================================================
              // Load Event Handlers
              // ============================================================
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              onHttpError={handleHttpError}
              startInLoadingState={false}
              // ============================================================
              // Message Handler (for text extraction)
              // ============================================================
              onMessage={handleWebViewMessage}
              // ============================================================
              // URL Filtering (Problem 2: Prevent external navigation)
              // ============================================================
              // This callback is called before any URL is loaded.
              // We use it to block navigation to external sites.
              // Only nu.nl domains are allowed - everything else is blocked.
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              // Track navigation state for back button
              onNavigationStateChange={handleNavigationStateChange}
              // ============================================================
              // Window.open / target="_blank" Interception
              // ============================================================
              // CRITICAL: Handle window.open() and target="_blank" clicks
              // Without this, cookie accept buttons may open the nu.nl app
              // via Universal Links, or open Safari
              onOpenWindow={handleOpenWindow}
              // Android: Block new windows/tabs from opening
              // This prevents ads from opening in new browser tabs
              setSupportMultipleWindows={false}
              // Android: Additional protection - don't open links in external browser
              // Note: cacheEnabled helps with performance after first load
              cacheEnabled={true}
              // ============================================================
              // Cookie Consent (Problem 1: Auto-accept GDPR popup)
              // ============================================================
              // Enable shared cookies so consent persists across sessions
              // This means users only see the popup once (auto-accepted)
              sharedCookiesEnabled={true}
              // Third-party cookies needed for OneTrust consent to work
              thirdPartyCookiesEnabled={true}
              // Inject cookie consent script BEFORE page content loads
              // This hides the OneTrust popup immediately and auto-accepts
              injectedJavaScriptBeforeContentLoaded={COOKIE_CONSENT_SCRIPT}
              // ============================================================
              // CSS/JS Injection (Senior-friendly styling)
              // ============================================================
              // Inject CSS AFTER page load for improved readability:
              // - Larger fonts (20px body, 32px h1)
              // - Better line height (1.7)
              // - Hide ads, navigation, clutter
              // - Disable links (pointer-events: none)
              injectedJavaScript={NUNL_CSS_INJECTION}
              // JavaScript must be enabled for injections to work
              javaScriptEnabled={true}
              // ============================================================
              // General WebView Settings
              // ============================================================
              // DOM storage for modern web features
              domStorageEnabled={true}
              // Scale page to fit viewport
              scalesPageToFit={true}
              // Video playback settings
              // allowsInlineMediaPlayback=false lets iOS show native fullscreen video
              // which triggers our orientation unlock automatically
              allowsInlineMediaPlayback={false}
              mediaPlaybackRequiresUserAction={false}
              // Allow fullscreen video (triggers device rotation when user goes fullscreen)
              allowsFullscreenVideo={true}
              // Fullscreen video callbacks for orientation control
              onContentProcessDidTerminate={() => {
                // Reset orientation if WebView crashes during video
                orientationService.lockToPortrait();
              }}
              // ============================================================
              // Scrolling Performance
              // ============================================================
              decelerationRate="normal"
              showsVerticalScrollIndicator={true}
              showsHorizontalScrollIndicator={false}
              // iOS: Bounce effect when scrolling past content
              bounces={true}
              // iOS: Overscroll behavior
              overScrollMode="always"
              // ============================================================
              // Security & Universal Links Prevention
              // ============================================================
              // Allow only HTTPS (iOS 9+/Android uses this by default)
              // Note: nu.nl uses HTTPS, so this is fine
              mixedContentMode="never"
              // Only allow http/https URLs - blocks intent://, tel:, mailto: etc.
              // This prevents consent buttons from opening external apps
              originWhitelist={['https://*', 'http://*']}
              // CRITICAL: Disable automatic scheme handling
              // This prevents iOS from automatically opening Universal Links
              // when navigating to URLs that other apps have registered
              automaticallyAdjustContentInsets={false}
              // Disable "Open in App" banners that iOS shows for Universal Links
              allowsBackForwardNavigationGestures={false}
              // ============================================================
              // User Agent (Prevent app detection)
              // ============================================================
              // Use a FULL desktop Safari user agent to prevent:
              // 1. nu.nl from detecting mobile WebView
              // 2. iOS from triggering Universal Links (they check user agent)
              // This makes the WebView appear as desktop Safari on macOS
              userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
              // Disable link preview (3D Touch / long press preview)
              // This can trigger Universal Links on iOS
              allowsLinkPreview={false}
              // ============================================================
              // Accessibility
              // ============================================================
              accessibilityLabel={t('articleViewer.webViewLabel', { title: article.title })}
            />
          )}
        </View>

        {/* Bottom Controls - Two buttons: Back + TTS */}
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.bottomButtonsRow}>
            {/* Back Button - always visible, RED when user has navigated within WebView */}
            <TouchableOpacity
              style={[
                styles.bottomButton,
                {
                  backgroundColor: canGoBack ? colors.error : accentColor,
                },
              ]}
              onPress={handleClose}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('articleViewer.goBack')}
              accessibilityHint={
                canGoBack
                  ? t('articleViewer.goBackHint')
                  : undefined
              }
            >
              <Icon
                name="chevron-left"
                size={24}
                color={colors.textOnPrimary}
              />
              <Text style={styles.bottomButtonText}>
                {t('articleViewer.goBack')}
              </Text>
            </TouchableOpacity>

            {/* TTS Button */}
            <TouchableOpacity
              style={[
                styles.bottomButton,
                { backgroundColor: accentColor },
                (isTTSLoading || isExtractingText) && styles.bottomButtonDisabled,
              ]}
              onPress={handleTTSToggle}
              disabled={isTTSLoading || isExtractingText}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={
                isTTSPlaying
                  ? t('articleViewer.stop')
                  : t('articleViewer.readAloud')
              }
              accessibilityState={{ disabled: isTTSLoading || isExtractingText }}
            >
              {(isTTSLoading || isExtractingText) ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Icon
                  name={isTTSPlaying ? 'pause' : 'volume-up'}
                  size={24}
                  color={colors.textOnPrimary}
                />
              )}
              <Text style={styles.bottomButtonText}>
                {(isTTSLoading || isExtractingText)
                  ? t('articleViewer.loading')
                  : isTTSPlaying
                    ? t('articleViewer.stop')
                    : t('articleViewer.readAloud')
                }
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* External Link Confirmation Modal */}
        <Modal
          visible={pendingExternalUrl !== null}
          animationType={reducedMotion ? 'fade' : 'slide'}
          transparent
          onRequestClose={handleExternalLinkCancel}
        >
          <View style={styles.externalLinkOverlay}>
            <View style={styles.externalLinkModal}>
              {/* Icon */}
              <View style={[styles.externalLinkIconContainer, { backgroundColor: accentColor }]}>
                <Icon name="external-link" size={32} color={colors.textOnPrimary} />
              </View>

              {/* Title */}
              <Text style={styles.externalLinkTitle}>
                {t('articleViewer.externalLink.title')}
              </Text>

              {/* Description */}
              <Text style={styles.externalLinkDescription}>
                {t('articleViewer.externalLink.description')}
              </Text>

              {/* URL Preview */}
              {pendingExternalUrl && (
                <Text style={styles.externalLinkUrl} numberOfLines={2}>
                  {pendingExternalUrl}
                </Text>
              )}

              {/* Settings Hint */}
              <Text style={styles.externalLinkSettingsHint}>
                {t('articleViewer.externalLink.settingsHint')}
              </Text>

              {/* Buttons */}
              <View style={styles.externalLinkButtons}>
                {/* Cancel */}
                <TouchableOpacity
                  style={styles.externalLinkButtonSecondary}
                  onPress={handleExternalLinkCancel}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}
                >
                  <Text style={styles.externalLinkButtonSecondaryText}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>

                {/* Open Once */}
                <TouchableOpacity
                  style={[styles.externalLinkButton, { backgroundColor: accentColor }]}
                  onPress={handleExternalLinkOpen}
                  accessibilityRole="button"
                  accessibilityLabel={t('articleViewer.externalLink.open')}
                >
                  <Text style={styles.externalLinkButtonText}>
                    {t('articleViewer.externalLink.open')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Always Open Button */}
              <TouchableOpacity
                style={styles.externalLinkAlwaysButton}
                onPress={handleExternalLinkAlways}
                accessibilityRole="button"
                accessibilityLabel={t('articleViewer.externalLink.always')}
              >
                <Text style={[styles.externalLinkAlwaysText, { color: accentColor }]}>
                  {t('articleViewer.externalLink.always')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  bottomButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
    gap: spacing.sm,
  },
  bottomButtonDisabled: {
    opacity: 0.6,
  },
  bottomButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },

  // External Link Confirmation Modal
  externalLinkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  externalLinkModal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    alignItems: 'center',
    padding: spacing.lg,
  },
  externalLinkIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  externalLinkTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  externalLinkDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  externalLinkUrl: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    fontStyle: 'italic',
  },
  externalLinkSettingsHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  externalLinkButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    marginBottom: spacing.md,
  },
  externalLinkButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
  },
  externalLinkButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  externalLinkButtonSecondary: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  externalLinkButtonSecondaryText: {
    ...typography.button,
    color: colors.textPrimary,
  },
  externalLinkAlwaysButton: {
    paddingVertical: spacing.sm,
  },
  externalLinkAlwaysText: {
    ...typography.body,
    textDecorationLine: 'underline',
  },
});

export default ArticleWebViewer;
