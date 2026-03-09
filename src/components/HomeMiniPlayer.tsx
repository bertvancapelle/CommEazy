/**
 * HomeMiniPlayer — Compact audio player bar for the HomeScreen
 *
 * Shown at the bottom of the HomeScreen when audio is playing.
 * Displays metadata from the active audio module and provides
 * play/pause + stop controls.
 *
 * Tap on the bar (not controls) navigates to the audio module.
 *
 * On iOS 26+, the native GlassPlayer overlay may also be visible;
 * this component serves as the React Native fallback and also
 * works on iOS <26 and Android.
 *
 * Senior-inclusive design:
 * - Height: 72pt
 * - Control buttons: 60pt touch targets
 * - High contrast text on colored background
 *
 * @see .claude/plans/HOMESCREEN_GRID_NAVIGATION.md (Fase 7)
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { useRadioContext } from '@/contexts/RadioContext';
import { usePodcastContextSafe } from '@/contexts/PodcastContext';
import { useBooksContextSafe } from '@/contexts/BooksContext';
import { useAppleMusicContextSafe } from '@/contexts/AppleMusicContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useFeedback } from '@/hooks/useFeedback';
import type { NavigationDestination } from '@/types/navigation';
import {
  spacing,
  touchTargets,
  borderRadius,
} from '@/theme';

// ============================================================
// Types
// ============================================================

interface HomeMiniPlayerProps {
  /** Called when the bar is tapped (navigate to the audio module) */
  onPress: (moduleId: NavigationDestination) => void;
}

interface ActiveAudioInfo {
  moduleId: NavigationDestination;
  title: string;
  subtitle: string;
  artworkUrl: string | null;
  isPlaying: boolean;
}

// ============================================================
// Constants
// ============================================================

const MINI_PLAYER_HEIGHT = 72;
const ARTWORK_SIZE = 48;

// ============================================================
// Component
// ============================================================

export function HomeMiniPlayer({ onPress }: HomeMiniPlayerProps) {
  const { t } = useTranslation();
  const { triggerFeedback } = useFeedback();

  // Audio contexts
  const radioCtx = useRadioContext();
  const podcastCtx = usePodcastContextSafe();
  const booksCtx = useBooksContextSafe();
  const appleMusicCtx = useAppleMusicContextSafe();

  // Determine active audio source and metadata
  const activeAudio = useMemo((): ActiveAudioInfo | null => {
    // Priority: appleMusic > radio > podcast > books
    if (appleMusicCtx?.isPlaying && appleMusicCtx?.nowPlaying) {
      return {
        moduleId: 'appleMusic',
        title: appleMusicCtx.nowPlaying.title || t('homeScreen.miniPlayer.nowPlaying', 'Nu aan het spelen'),
        subtitle: (appleMusicCtx.nowPlaying as any).artistName || '',
        artworkUrl: appleMusicCtx.effectiveArtworkUrl ?? null,
        isPlaying: true,
      };
    }

    if (radioCtx?.isPlaying && radioCtx?.currentStation) {
      return {
        moduleId: 'radio',
        title: radioCtx.metadata?.title || radioCtx.currentStation.name,
        subtitle: radioCtx.metadata?.artist || radioCtx.currentStation.name,
        artworkUrl: radioCtx.metadata?.artwork || radioCtx.currentStation.favicon || null,
        isPlaying: true,
      };
    }

    if (podcastCtx?.isPlaying && podcastCtx?.currentEpisode) {
      return {
        moduleId: 'podcast',
        title: podcastCtx.currentEpisode.title || '',
        subtitle: podcastCtx.currentShow?.title || '',
        artworkUrl: podcastCtx.currentEpisode.artwork || podcastCtx.currentShow?.artwork || null,
        isPlaying: true,
      };
    }

    if (booksCtx?.isReading && booksCtx?.currentBook) {
      return {
        moduleId: 'books',
        title: booksCtx.currentBook.title || '',
        subtitle: booksCtx.currentBook.author || '',
        artworkUrl: null, // Books typically don't have artwork URLs
        isPlaying: true,
      };
    }

    return null;
  }, [
    appleMusicCtx?.isPlaying,
    appleMusicCtx?.nowPlaying,
    appleMusicCtx?.effectiveArtworkUrl,
    radioCtx?.isPlaying,
    radioCtx?.currentStation,
    radioCtx?.metadata,
    podcastCtx?.isPlaying,
    podcastCtx?.currentEpisode,
    podcastCtx?.currentShow,
    booksCtx?.isReading,
    booksCtx?.currentBook,
  ]);

  // Get module color for the active audio module
  const moduleColor = useModuleColor(
    (activeAudio?.moduleId ?? 'radio') as any,
  );

  if (!activeAudio) {
    return null;
  }

  const handleBarPress = () => {
    void triggerFeedback('navigation');
    onPress(activeAudio.moduleId);
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: moduleColor }]}
      onPress={handleBarPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={t('homeScreen.miniPlayer.tapToOpen', 'Tik om te openen')}
      accessibilityHint={activeAudio.title}
    >
      {/* Artwork */}
      {activeAudio.artworkUrl ? (
        <Image
          source={{ uri: activeAudio.artworkUrl }}
          style={styles.artwork}
        />
      ) : (
        <View style={[styles.artworkPlaceholder, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Icon name="music" size={24} color="#FFFFFF" />
        </View>
      )}

      {/* Title + Subtitle */}
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {activeAudio.title}
        </Text>
        {activeAudio.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {activeAudio.subtitle}
          </Text>
        ) : null}
      </View>

      {/* Now Playing indicator */}
      <View style={styles.indicator}>
        <Icon name="volume-2" size={20} color="rgba(255,255,255,0.8)" />
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: MINI_PLAYER_HEIGHT,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: borderRadius.sm,
  },
  artworkPlaceholder: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  indicator: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
