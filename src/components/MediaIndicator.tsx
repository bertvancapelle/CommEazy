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
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AccessibilityInfo,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@/theme';
import { useRadioContext } from '@/contexts/RadioContext';
import { usePodcastContextSafe } from '@/contexts/PodcastContext';
import { useBooksContextSafe } from '@/contexts/BooksContext';
import { useAppleMusicContextSafe } from '@/contexts/AppleMusicContext';
import { useFeedback } from '@/hooks/useFeedback';
import { useReducedMotion } from '@/hooks/useReducedMotion';

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
// Module Navigation Mapping
// ============================================================

const MEDIA_TABS: Record<string, string> = {
  radio: 'RadioTab',
  podcast: 'PodcastTab',
  books: 'BooksTab',
  appleMusic: 'AppleMusicTab',
  audioCall: 'CallsTab',
  videoCall: 'VideoCallTab',
};

// ============================================================
// Component
// ============================================================

export function MediaIndicator({ moduleColor, currentSource }: MediaIndicatorProps) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { triggerFeedback } = useFeedback();
  const reducedMotion = useReducedMotion();

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
  // TODO: Add sleepTimerActive to AppleMusicContext when sleep timer is implemented
  const appleMusicSleepTimerActive = false;

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
  const shouldHide = activeMedia && currentSource && activeMedia.source === currentSource;

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

  // Handle tap — navigate to source module
  const handlePress = useCallback(() => {
    if (!activeMedia) return;

    console.log('[MediaIndicator] Pressed, navigating to:', activeMedia.source);
    triggerFeedback('tap');

    const tabName = MEDIA_TABS[activeMedia.source];
    if (tabName) {
      console.log('[MediaIndicator] Dispatching navigate to:', tabName);
      // Navigate to the tab - this works across the tab navigator
      // @ts-ignore - navigation type doesn't know about all tabs
      navigation.navigate(tabName);

      AccessibilityInfo.announceForAccessibility(
        t('media.navigatingTo', { module: t(`modules.${activeMedia.source}.title`) })
      );
    }
  }, [activeMedia, navigation, triggerFeedback, t]);

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
          accessibilityLabel={t('media.sleepTimerActive')}
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
        accessibilityLabel={t('media.activeIndicatorLabel', {
          type: isVideo ? t('media.video') : t('media.audio'),
        })}
        accessibilityHint={t('media.activeIndicatorHint')}
      >
        {/* Animated waveform bars */}
        <View style={styles.waveContainer}>
        {isVideo ? (
          // Video: wider bars with play triangle
          <>
            <View style={[styles.playTriangle, { borderLeftColor: colors.textOnPrimary }]} />
          </>
        ) : (
          // Audio: animated waveform bars
          <>
            <Animated.View
              style={[
                styles.waveBar,
                {
                  backgroundColor: colors.textOnPrimary,
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
                  backgroundColor: colors.textOnPrimary,
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
                  backgroundColor: colors.textOnPrimary,
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
