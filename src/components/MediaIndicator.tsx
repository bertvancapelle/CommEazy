/**
 * MediaIndicator — Small animated icon showing active audio/video stream
 *
 * Shows a small animated waveform icon when media is playing:
 * - Audio wave for radio/podcast/audio calls
 * - Video wave for video calls
 *
 * Design requirements (from user feedback):
 * - Small icon (36x36pt)
 * - Contrast color relative to module header color
 * - Animated waveform
 * - Tappable to return to the active stream
 * - Only ONE stream active at a time
 *
 * iPad collapsible panes:
 * - When tapped, opens collapsed pane if audio source is in that pane
 * - Uses openCollapsedPane from PaneContext
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 * @see .claude/plans/COLLAPSIBLE_PANES_IPAD.md
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useRadioContext } from '@/contexts/RadioContext';
import { usePodcastContextSafe } from '@/contexts/PodcastContext';
import { useBooksContextSafe } from '@/contexts/BooksContext';
import { useAppleMusicContextSafe } from '@/contexts/AppleMusicContext';
import { usePaneContextSafe } from '@/contexts/PaneContext';
import { usePanelId } from '@/contexts/PanelIdContext';
import { useFeedback } from '@/hooks/useFeedback';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { glassPlayer } from '@/services/glassPlayer';
import type { NavigationDestination } from '@/types/navigation';

// ============================================================
// Types
// ============================================================

type MediaType = 'audio' | 'video';

interface MediaIndicatorProps {
  /**
   * The background color of the module header.
   * Used to calculate contrast color for the indicator.
   */
  moduleColor: string;

  /**
   * Optional: The current module's media source.
   * If this matches the active media source, the indicator is hidden.
   * E.g., pass 'radio' on RadioScreen to hide when radio is playing.
   */
  currentSource?: string;
}

// ============================================================
// Color Utilities
// ============================================================

/**
 * Darken a hex color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Get contrast colors for the indicator based on module color
 * Returns: { fill: darker shade, border: even darker shade }
 */
function getContrastColors(moduleColor: string): { fill: string; border: string } {
  return {
    fill: darkenColor(moduleColor, 25),
    border: darkenColor(moduleColor, 40),
  };
}

// ============================================================
// Audio source → NavigationDestination mapping
// ============================================================

const AUDIO_SOURCE_TO_MODULE: Record<string, NavigationDestination> = {
  radio: 'radio',
  podcast: 'podcast',
  books: 'books',
  appleMusic: 'appleMusic',
  audioCall: 'calls',
  videoCall: 'calls',
};

// ============================================================
// Component
// ============================================================

export function MediaIndicator({ moduleColor, currentSource }: MediaIndicatorProps) {
  const { t } = useTranslation();
  const { triggerFeedback } = useFeedback();
  const reducedMotion = useReducedMotion();
  const themeColors = useColors();
  const paneCtx = usePaneContextSafe();
  const panelId = usePanelId();

  // Animation values for waveform bars
  const bar1Anim = useRef(new Animated.Value(0.3)).current;
  const bar2Anim = useRef(new Animated.Value(0.6)).current;
  const bar3Anim = useRef(new Animated.Value(0.4)).current;

  // Radio context
  const { isPlaying: isRadioPlaying, currentStation, sleepTimerActive } = useRadioContext();

  // Podcast context (safe - returns null if provider not ready)
  const podcastContext = usePodcastContextSafe();
  const isPodcastPlaying = podcastContext?.isPlaying ?? false;
  const currentEpisode = podcastContext?.currentEpisode ?? null;

  // Books TTS context (safe - returns null if provider not ready)
  const booksContext = useBooksContextSafe();
  const isBooksReading = booksContext?.isSpeaking ?? false;
  const currentBook = booksContext?.currentBook ?? null;

  // Apple Music context (safe - returns null if provider not ready)
  const appleMusicContext = useAppleMusicContextSafe();
  const isAppleMusicPlaying = appleMusicContext?.isPlaying ?? false;
  const appleMusicNowPlaying = appleMusicContext?.nowPlaying ?? null;
  const appleMusicSleepTimerActive = appleMusicContext?.sleepTimerActive ?? false;

  // Track Glass Player minimized state (for showing indicator on source module)
  const [isGlassMinimized, setIsGlassMinimized] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const unsubMinimize = glassPlayer.addEventListener('onMinimize', () => {
      setIsGlassMinimized(true);
    });
    // When Glass Player becomes visible again (expand, collapse, showFromMinimized),
    // it's no longer minimized. onExpand/onCollapse fire when player is shown.
    const unsubExpand = glassPlayer.addEventListener('onExpand', () => {
      setIsGlassMinimized(false);
    });
    const unsubCollapse = glassPlayer.addEventListener('onCollapse', () => {
      setIsGlassMinimized(false);
    });
    const unsubClose = glassPlayer.addEventListener('onClose', () => {
      setIsGlassMinimized(false);
    });

    return () => {
      unsubMinimize();
      unsubExpand();
      unsubCollapse();
      unsubClose();
    };
  }, []);

  // TODO: Add other media contexts when implemented
  // const { isInCall: isInAudioCall } = useAudioCallContext();
  // const { isInCall: isInVideoCall } = useVideoCallContext();

  // Determine active media type
  const getActiveMedia = useCallback((): { type: MediaType; source: string } | null => {
    // Priority: video calls > audio calls > apple music > radio/podcast/books
    // if (isInVideoCall) return { type: 'video', source: 'videoCall' };
    // if (isInAudioCall) return { type: 'audio', source: 'audioCall' };
    if (isAppleMusicPlaying && appleMusicNowPlaying) return { type: 'audio', source: 'appleMusic' };
    if (isRadioPlaying && currentStation) return { type: 'audio', source: 'radio' };
    if (isPodcastPlaying && currentEpisode) return { type: 'audio', source: 'podcast' };
    if (isBooksReading && currentBook) return { type: 'audio', source: 'books' };
    return null;
  }, [isAppleMusicPlaying, appleMusicNowPlaying, isRadioPlaying, currentStation, isPodcastPlaying, currentEpisode, isBooksReading, currentBook]);

  const activeMedia = getActiveMedia();

  // Check if we should hide (on source module) — used after all hooks
  // Exception: when Glass Player is minimized, ALWAYS show so user can restore it
  const shouldHide = activeMedia && currentSource && activeMedia.source === currentSource && !isGlassMinimized;

  // Start wave animation when active
  useEffect(() => {
    if (!activeMedia || reducedMotion) return;

    const createBarAnimation = (animValue: Animated.Value, toValue: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animValue, {
            toValue,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(animValue, {
            toValue: 0.2,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );
    };

    const anim1 = createBarAnimation(bar1Anim, 0.9, 400);
    const anim2 = createBarAnimation(bar2Anim, 1.0, 500);
    const anim3 = createBarAnimation(bar3Anim, 0.8, 450);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [activeMedia, reducedMotion, bar1Anim, bar2Anim, bar3Anim]);

  // Handle tap — navigate to source module via pane context + show Glass Player
  // Also opens collapsed panes if audio source is in that pane
  const handlePress = useCallback(async () => {
    if (!activeMedia) return;

    console.info('[MediaIndicator] Pressed, navigating to:', activeMedia.source);
    triggerFeedback('tap');

    const moduleId = AUDIO_SOURCE_TO_MODULE[activeMedia.source];
    if (!moduleId) return;

    // On iOS: show Glass Player from minimized state (if it was minimized)
    if (Platform.OS === 'ios') {
      try {
        const minimized = await glassPlayer.isMinimized();
        if (minimized) {
          console.info('[MediaIndicator] Restoring Glass Player from minimized state');
          await glassPlayer.showFromMinimized();
          setIsGlassMinimized(false);
        }
      } catch {
        // Glass Player not available (iOS <26 or Android) — continue with pane navigation
      }
    }

    // iPad: Check if audio source is in a collapsed pane and open it
    if (paneCtx && paneCtx.paneCount === 2) {
      const { panes, isLeftCollapsed, isRightCollapsed, openCollapsedPane } = paneCtx;

      // Find which pane the audio source module is in
      const leftModuleId = panes.left?.moduleId;
      const rightModuleId = panes.right?.moduleId;

      if (isLeftCollapsed && leftModuleId === moduleId) {
        console.info('[MediaIndicator] Opening collapsed left pane for module:', moduleId);
        openCollapsedPane('left');
      } else if (isRightCollapsed && rightModuleId === moduleId) {
        console.info('[MediaIndicator] Opening collapsed right pane for module:', moduleId);
        openCollapsedPane('right');
      }
    }

    // Only navigate if we're not already on the source module
    const alreadyOnSource = currentSource && activeMedia.source === currentSource;
    if (!alreadyOnSource && paneCtx && panelId) {
      console.info('[MediaIndicator] Navigating pane', panelId, 'to module:', moduleId);
      paneCtx.setPaneModule(panelId, moduleId);
    }

    AccessibilityInfo.announceForAccessibility(
      t('mediaIndicator.navigatingTo', { module: t(`modules.${activeMedia.source}.title`) })
    );
  }, [activeMedia, triggerFeedback, t, paneCtx, panelId, currentSource]);

  // Don't render if no active media OR we're on the source module
  if (!activeMedia || shouldHide) {
    return null;
  }

  const contrastColors = getContrastColors(moduleColor);
  const isVideo = activeMedia.type === 'video';

  // For reduced motion: show static bars
  const staticHeight = reducedMotion ? 0.5 : undefined;

  // Check if sleep timer is active for the current media source
  const showSleepTimerIndicator =
    (activeMedia?.source === 'radio' && sleepTimerActive) ||
    (activeMedia?.source === 'appleMusic' && appleMusicSleepTimerActive);

  return (
    <View style={styles.indicatorRow}>
      {/* Sleep timer indicator (moon) - shown before waveform when active */}
      {showSleepTimerIndicator && (
        <View
          style={[
            styles.sleepTimerBadge,
            {
              backgroundColor: contrastColors.fill,
              borderColor: contrastColors.border,
            },
          ]}
          accessibilityLabel={t('mediaIndicator.sleepTimerActive')}
        >
          <Text style={styles.moonIcon}>🌙</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.container,
          {
            backgroundColor: contrastColors.fill,
            borderColor: contrastColors.border,
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('mediaIndicator.activeIndicatorLabel', {
          type: isVideo ? t('mediaIndicator.video') : t('mediaIndicator.audio'),
        })}
        accessibilityHint={t('mediaIndicator.activeIndicatorHint')}
      >
        {/* Animated waveform bars */}
        <View style={styles.waveContainer}>
        {isVideo ? (
          // Video: wider bars with play triangle
          <>
            <View style={[styles.playTriangle, { borderLeftColor: themeColors.textOnPrimary }]} />
          </>
        ) : (
          // Audio: animated waveform bars
          <>
            <Animated.View
              style={[
                styles.waveBar,
                {
                  backgroundColor: themeColors.textOnPrimary,
                  height: staticHeight !== undefined
                    ? 16 * staticHeight
                    : bar1Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [4, 16],
                      }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.waveBar,
                {
                  backgroundColor: themeColors.textOnPrimary,
                  height: staticHeight !== undefined
                    ? 16 * staticHeight
                    : bar2Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [4, 16],
                      }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.waveBar,
                {
                  backgroundColor: themeColors.textOnPrimary,
                  height: staticHeight !== undefined
                    ? 16 * staticHeight
                    : bar3Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [4, 16],
                      }),
                },
              ]}
            />
          </>
        )}
      </View>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const INDICATOR_SIZE = 36;

const SLEEP_BADGE_SIZE = 28;

const styles = StyleSheet.create({
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  container: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sleepTimerBadge: {
    width: SLEEP_BADGE_SIZE,
    height: SLEEP_BADGE_SIZE,
    borderRadius: SLEEP_BADGE_SIZE / 2,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  moonIcon: {
    fontSize: 14,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 16,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    // borderLeftColor set dynamically
    marginLeft: 2,
  },
});
