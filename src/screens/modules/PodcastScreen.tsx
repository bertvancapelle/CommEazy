/**
 * PodcastScreen — Podcast streaming module
 *
 * Senior-inclusive podcast player with:
 * - Search and discover podcasts
 * - Subscriptions with episode lists
 * - Background playback with progress saving
 * - Large touch targets (60pt+)
 * - VoiceFocusable podcast and episode lists
 *
 * Voice commands supported:
 * - "speel" / "play" — Play selected episode
 * - "pauze" / "pause" — Pause playback
 * - "stop" — Stop playback
 * - "vooruit" / "skip" — Skip forward 30s
 * - "terug" / "back" — Skip backward 10s
 * - "[podcast name]" — Focus on podcast
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  AccessibilityInfo,
  KeyboardAvoidingView,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, IconButton, VoiceFocusable, PlayingWaveIcon, UnifiedMiniPlayer, UnifiedFullPlayer, ModuleHeader, ModuleScreenLayout, FavoriteTabButton, SearchTabButton, SearchBar, ChipSelector, LoadingView, ErrorView, ArtworkImage, ScrollViewWithIndicator, type SearchBarRef, PanelAwareModal } from '@/components';
import { useVoiceFocusList, useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import { useHoldGestureContextSafe } from '@/contexts/HoldGestureContext';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useGlassPlayer } from '@/hooks/useGlassPlayer';
import {
  usePodcastContext,
  formatTime,
  type PodcastShow,
  type PodcastEpisode,
} from '@/contexts/PodcastContext';
import {
  searchPodcasts,
  getPodcastEpisodes,
} from '@/services/podcastService';
import { COUNTRIES } from '@/constants/demographics';
import { ServiceContainer } from '@/services/container';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';
import { useModuleBrowsingState, type PodcastBrowsingState } from '@/contexts/ModuleBrowsingContext';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { ModalLayout } from '@/components/ModalLayout';
import { useModuleLayoutSafe } from '@/contexts/ModuleLayoutContext';

// ============================================================
// Constants
// ============================================================

const SEARCH_MAX_LENGTH = 100;
const PLAYBACK_RATES = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const SLEEP_TIMER_OPTIONS = [15, 30, 45, 60, 90]; // minutes

// Layout constants for overlay positioning
// ModuleHeader height: icon row (44pt) + AdMob placeholder (50pt) + separator + padding
const MODULE_HEADER_HEIGHT = 120;
// MiniPlayer height: touchTargets.comfortable (72pt) + vertical padding
const MINI_PLAYER_HEIGHT = 84;

// ============================================================
// Component
// ============================================================

export function PodcastScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { accentColor } = useAccentColor();
  const { isVoiceSessionActive } = useVoiceFocusContext();
  const holdGesture = useHoldGestureContextSafe();
  const isReducedMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();
  const themeColors = useColors();
  const layoutContext = useModuleLayoutSafe();
  const toolbarPosition = layoutContext?.toolbarPosition ?? 'top';
  const searchInputRef = useRef<SearchBarRef>(null);

  // User-customizable module color for Liquid Glass
  const podcastModuleColor = useModuleColor('podcast');

  // Podcast Context
  const {
    isPlaying,
    isLoading: isPlaybackLoading,
    isBuffering,
    currentEpisode,
    currentShow,
    progress,
    playbackRate,
    subscriptions,
    currentShowEpisodes,
    setCurrentShowEpisodes,
    getEpisodeProgress,
    isEpisodeCompleted,
    playEpisode,
    play,
    pause,
    stop,
    seekTo,
    skipForward,
    skipBackward,
    setPlaybackRate,
    getNextEpisode,
    playNextEpisode,
    subscribe,
    unsubscribe,
    isSubscribed,
    sleepTimerMinutes,
    setSleepTimer,
  } = usePodcastContext();

  // Glass Player for iOS 26+ Liquid Glass effect
  const {
    isAvailable: isGlassPlayerAvailable,
    isVisible: isGlassPlayerVisible,
    isExpanded: isGlassPlayerExpanded,
    showMiniPlayer: showGlassMiniPlayer,
    expandToFull: expandGlassPlayer,
    collapseToMini: collapseGlassPlayer,
    hide: hideGlassPlayer,
    updateContent: updateGlassContent,
    updatePlaybackState: updateGlassPlaybackState,
    configureControls: configureGlassControls,
    showFromMinimized: showGlassFromMinimized,
  } = useGlassPlayer({
    onPlayPause: async () => {
      if (isPlaying) {
        await pause();
      } else {
        await play();
      }
    },
    onStop: async () => {
      await stop();
    },
    onExpand: () => {
      // Native player expanded — sync state
      setIsPlayerExpanded(true);
    },
    onCollapse: () => {
      // Native player collapsed — sync state
      setIsPlayerExpanded(false);
    },
    onSeek: async (position: number) => {
      // position is 0-1, convert to seconds
      const newPosition = position * progress.duration;
      await seekTo(newPosition);
    },
    onSkipForward: async () => {
      await skipForward();
    },
    onSkipBackward: async () => {
      await skipBackward();
    },
    onClose: async () => {
      // User closed the glass player
      await stop();
    },
    onFavoriteToggle: () => {
      // Toggle subscription for current show
      if (currentShow) {
        if (isSubscribed(currentShow.id)) {
          unsubscribe(currentShow.id);
        } else {
          subscribe(currentShow);
        }
      }
    },
    onSleepTimerSet: (minutes: number | null) => {
      setSleepTimer(minutes);
    },
    onSpeedChange: (speed: number) => {
      setPlaybackRate(speed);
    },
  });

  // Browsing state persistence — restores tab, search, filters on return
  const { savedState: savedBrowsing, save: saveBrowsing } = useModuleBrowsingState<PodcastBrowsingState>('podcast');

  // State — initialized from saved browsing state if available
  const [searchResults, setSearchResults] = useState<PodcastShow[]>(savedBrowsing?.searchResults as PodcastShow[] ?? []);
  const [searchQuery, setSearchQuery] = useState(savedBrowsing?.searchQuery ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<'network' | 'timeout' | 'server' | 'parse' | null>(null);
  // Discovery search modal — opens on SearchTabButton tap
  const [showSearchModal, setShowSearchModal] = useState(false);
  // Podcast uses country filter (iTunes API is store/region-based, not language-based)
  const [selectedCountry, setSelectedCountry] = useState(savedBrowsing?.selectedCountry ?? 'NL');

  // Show detail modal
  const [selectedShow, setSelectedShow] = useState<PodcastShow | null>(savedBrowsing?.selectedShow as PodcastShow | null ?? null);
  const [showEpisodes, setShowEpisodes] = useState<PodcastEpisode[]>(savedBrowsing?.showEpisodes as PodcastEpisode[] ?? []);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);

  // Expanded player
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [showSleepTimerPicker, setShowSleepTimerPicker] = useState(false);

  // Continue listening dialog
  const [showContinueListeningDialog, setShowContinueListeningDialog] = useState(false);
  const [continueListeningEpisode, setContinueListeningEpisode] = useState<PodcastEpisode | null>(null);
  const [continueListeningShow, setContinueListeningShow] = useState<PodcastShow | null>(null);

  // Playback error
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Next episode dialog (shown at end of episode when there's a next one)
  const [showNextEpisodeDialog, setShowNextEpisodeDialog] = useState(false);
  const [nextEpisodeInfo, setNextEpisodeInfo] = useState<{
    completedEpisode: PodcastEpisode;
    nextEpisode: PodcastEpisode;
    show: PodcastShow;
  } | null>(null);



  // Save browsing state on every change — restored on return navigation
  useEffect(() => {
    saveBrowsing({
      module: 'podcast',
      showSubscriptions: true, // Always subscriptions on main screen (search is modal)
      searchQuery,
      selectedCountry,
      selectedShow,
      showEpisodes,
      searchResults,
    });
  }, [searchQuery, selectedCountry, selectedShow, showEpisodes, searchResults, saveBrowsing]);

  // Close expanded player when episode ends
  useEffect(() => {
    if (!currentEpisode) {
      setIsPlayerExpanded(false);
    }
  }, [currentEpisode]);

  // Listen for playback errors
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'podcastPlaybackError',
      (error: { error?: string; message?: string }) => {
        console.log('[PodcastScreen] Received playback error:', error);
        triggerFeedback('error');
        setPlaybackError(currentEpisode?.title || t('modules.podcast.unknownEpisode'));
        setIsPlayerExpanded(false);
        AccessibilityInfo.announceForAccessibility(t('modules.podcast.playbackError'));
      }
    );

    return () => subscription.remove();
  }, [currentEpisode, t, triggerFeedback]);

  // Listen for episode ended event — show "next episode" dialog if available
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'podcastEpisodeEnded',
      (data: {
        completedEpisode: PodcastEpisode;
        nextEpisode: PodcastEpisode | null;
        show: PodcastShow;
      }) => {
        console.log('[PodcastScreen] Episode ended, nextEpisode:', data.nextEpisode?.title);

        // Close expanded player
        setIsPlayerExpanded(false);

        if (data.nextEpisode) {
          // Show "play next episode?" dialog
          setNextEpisodeInfo({
            completedEpisode: data.completedEpisode,
            nextEpisode: data.nextEpisode,
            show: data.show,
          });
          setShowNextEpisodeDialog(true);

          // Announce for accessibility
          AccessibilityInfo.announceForAccessibility(
            t('modules.podcast.episodeEndedNextAvailable', {
              nextTitle: data.nextEpisode.title,
            })
          );
        } else {
          // No next episode — just announce completion
          AccessibilityInfo.announceForAccessibility(
            t('modules.podcast.episodeCompleted', {
              title: data.completedEpisode.title,
            })
          );
        }
      }
    );

    return () => subscription.remove();
  }, [t]);

  // Clear playback error when playback starts
  useEffect(() => {
    if (isPlaying) {
      setPlaybackError(null);
    }
  }, [isPlaying]);

  // ============================================================
  // Glass Player Effects (iOS 26+ Liquid Glass)
  // ============================================================

  // Glass Player visibility during module switch is handled by PaneContext
  // (setTemporarilyHidden with auto-restore). No navigation cleanup needed here.

  // Show Glass Mini Player when episode is playing
  useEffect(() => {
    if (!isGlassPlayerAvailable || !currentEpisode || !currentShow || !isFocused) return;

    // Configure full player controls for Podcast
    configureGlassControls({
      seekSlider: true,
      skipButtons: true,
      speedControl: true,
      sleepTimer: true,
      favorite: true,
      stopButton: false,
      shuffle: false,
      repeat: false,
    });

    // Show mini player with podcast content
    showGlassMiniPlayer({
      moduleId: 'podcast',
      tintColorHex: podcastModuleColor,
      artwork: currentEpisode.artwork || currentShow.artwork || null,
      title: currentEpisode.title,
      subtitle: currentShow.title,
      progressType: 'bar',
      progress: progress.duration > 0 ? progress.position / progress.duration : 0,
      showStopButton: true,
    });
  }, [
    isGlassPlayerAvailable,
    currentEpisode,
    currentShow,
    isFocused,
    podcastModuleColor,
    configureGlassControls,
    showGlassMiniPlayer,
    progress.position,
    progress.duration,
  ]);

  // Update Glass Player playback state
  useEffect(() => {
    if (!isGlassPlayerAvailable || !currentEpisode) return;

    updateGlassPlaybackState({
      isPlaying,
      isLoading: isPlaybackLoading,
      isBuffering,
      progress: progress.duration > 0 ? progress.position / progress.duration : 0,
      position: progress.position,
      duration: progress.duration,
      isFavorite: currentShow ? isSubscribed(currentShow.id) : false,
    });
  }, [
    isGlassPlayerAvailable,
    currentEpisode,
    currentShow,
    isPlaying,
    isPlaybackLoading,
    isBuffering,
    progress.position,
    progress.duration,
    isSubscribed,
    updateGlassPlaybackState,
  ]);

  // Update Glass Player content when metadata changes
  useEffect(() => {
    if (!isGlassPlayerAvailable || !currentEpisode || !currentShow) return;

    updateGlassContent({
      tintColorHex: podcastModuleColor,
      artwork: currentEpisode.artwork || currentShow.artwork || null,
      title: currentEpisode.title,
      subtitle: currentShow.title,
      progress: progress.duration > 0 ? progress.position / progress.duration : 0,
      showStopButton: true,
    });
  }, [
    isGlassPlayerAvailable,
    currentEpisode,
    currentShow,
    podcastModuleColor,
    progress.position,
    progress.duration,
    updateGlassContent,
  ]);

  // Load user's country from profile
  useEffect(() => {
    const loadUserCountry = async () => {
      if (ServiceContainer.isInitialized) {
        try {
          const profile = await ServiceContainer.database.getUserProfile();
          if (profile?.country) {
            // Verify the country exists in our list
            const countryExists = COUNTRIES.some(c => c.code === profile.country);
            if (countryExists) {
              setSelectedCountry(profile.country);
            }
          }
        } catch (error) {
          console.warn('[PodcastScreen] Failed to load user country:', error);
        }
      }
    };
    void loadUserCountry();
  }, []);

  // Handle country change
  const handleCountryChange = useCallback((countryCode: string) => {
    triggerFeedback('tap');
    setSelectedCountry(countryCode);
    // Clear search results when changing country
    setSearchResults([]);
  }, [triggerFeedback]);

  // Search function
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setApiError(null);

    // iTunes API uses country/store parameter (not language)
    const result = await searchPodcasts(searchQuery, selectedCountry);

    if (result.error) {
      setApiError(result.error);
      setSearchResults([]);
      await triggerFeedback('error');
      AccessibilityInfo.announceForAccessibility(
        t(`modules.podcast.errors.${result.error}`)
      );
    } else {
      setSearchResults(result.data ?? []);
      if (result.data?.length === 0) {
        AccessibilityInfo.announceForAccessibility(t('modules.podcast.noResults'));
      }
    }
    setIsLoading(false);
  }, [searchQuery, selectedCountry, triggerFeedback, t]);

  // Find the last played episode with progress for a show
  const findLastPlayedEpisode = useCallback((episodes: PodcastEpisode[]): PodcastEpisode | null => {
    let lastPlayed: PodcastEpisode | null = null;
    let lastPlayedAt = 0;

    for (const episode of episodes) {
      const progress = getEpisodeProgress(episode.id);
      // Only consider episodes that have progress but are NOT completed
      if (progress && !progress.completedAt && progress.position > 0) {
        if (progress.lastPlayedAt > lastPlayedAt) {
          lastPlayedAt = progress.lastPlayedAt;
          lastPlayed = episode;
        }
      }
    }

    return lastPlayed;
  }, [getEpisodeProgress]);

  // Open show detail modal
  const handleShowPress = useCallback(async (show: PodcastShow) => {
    // CRITICAL: Block onPress if a hold gesture was just completed (opens menu/voice)
    // This prevents the show from opening when user is trying to use hold-to-navigate
    if (holdGesture?.isGestureConsumed()) {
      console.log('[PodcastScreen] Show press blocked - hold gesture was consumed');
      return;
    }

    triggerFeedback('tap');
    setIsLoadingEpisodes(true);

    const result = await getPodcastEpisodes(show);
    if (result.error) {
      setShowEpisodes([]);
      setSelectedShow(show);
      AccessibilityInfo.announceForAccessibility(
        t(`modules.podcast.errors.${result.error}`)
      );
      setIsLoadingEpisodes(false);
      return;
    }

    const episodes = result.data ?? [];
    setShowEpisodes(episodes);

    // Check if this is a subscribed show with an in-progress episode
    if (isSubscribed(show.id) && episodes.length > 0) {
      const lastPlayedEpisode = findLastPlayedEpisode(episodes);
      if (lastPlayedEpisode) {
        // Show continue listening dialog
        setContinueListeningEpisode(lastPlayedEpisode);
        setContinueListeningShow(show);
        setShowContinueListeningDialog(true);
        setIsLoadingEpisodes(false);
        return;
      }
    }

    // No in-progress episode, show episode list directly
    setSelectedShow(show);
    setIsLoadingEpisodes(false);
  }, [holdGesture, triggerFeedback, t, isSubscribed, findLastPlayedEpisode]);

  // Play episode
  const handlePlayEpisode = useCallback(async (episode: PodcastEpisode) => {
    // CRITICAL: Block onPress if a hold gesture was just completed (opens menu/voice)
    if (holdGesture?.isGestureConsumed()) {
      console.log('[PodcastScreen] Episode press blocked - hold gesture was consumed');
      return;
    }

    triggerFeedback('tap');

    // If this episode is already playing, just restore the mini player (don't restart)
    if (currentEpisode && currentEpisode.id === episode.id && isPlaying) {
      console.log('[PodcastScreen] Episode already playing, restoring mini player');
      await showGlassFromMinimized();
      return;
    }

    if (!selectedShow) return;
    // Store the episode list in context for next/previous navigation
    setCurrentShowEpisodes(showEpisodes);
    await playEpisode(episode, selectedShow);
    // Keep the show detail view open so the senior stays in context
    // (previously setSelectedShow(null) closed the modal, which was confusing)
  }, [holdGesture, selectedShow, showEpisodes, playEpisode, setCurrentShowEpisodes, triggerFeedback, currentEpisode, isPlaying, showGlassFromMinimized]);

  // Subscribe/unsubscribe
  const handleToggleSubscribe = useCallback(async (show: PodcastShow) => {
    triggerFeedback('tap');

    if (isSubscribed(show.id)) {
      Alert.alert(
        t('modules.podcast.removeFavoriteTitle'),
        t('modules.podcast.removeFavoriteMessage', { name: show.title }),
        [
          { text: t('common.no'), style: 'cancel' },
          {
            text: t('common.yes'),
            style: 'destructive',
            onPress: () => unsubscribe(show.id),
          },
        ]
      );
    } else {
      await subscribe(show);
    }
  }, [isSubscribed, subscribe, unsubscribe, triggerFeedback, t]);

  // Voice focus for show list — main screen always shows subscriptions
  // Sort so currently playing show appears at the top
  const displayedShows = useMemo(() => {
    const baseList = subscriptions;
    if (!currentShow) return baseList;

    // Find the currently playing show and move it to the top
    const playingShow = baseList.find((s) => s.id === currentShow.id);
    if (!playingShow) return baseList;

    // Put playing show first, then the rest
    const otherShows = baseList.filter((s) => s.id !== currentShow.id);
    return [playingShow, ...otherShows];
  }, [subscriptions, currentShow]);

  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return [];
    return displayedShows.map((show, index) => ({
      id: show.id,
      label: show.title,
      index,
      onSelect: () => handleShowPress(show),
    }));
  }, [displayedShows, isFocused, handleShowPress]);

  const { scrollRef, isFocused: isItemFocused, getFocusStyle } = useVoiceFocusList(
    'podcast-shows',
    voiceFocusItems
  );

  // Sort episodes so currently playing episode appears at the top
  const sortedShowEpisodes = useMemo(() => {
    if (!currentEpisode) return showEpisodes;

    // Find the currently playing episode and move it to the top
    const playingEpisode = showEpisodes.find((e) => e.id === currentEpisode.id);
    if (!playingEpisode) return showEpisodes;

    // Put playing episode first, then the rest
    const otherEpisodes = showEpisodes.filter((e) => e.id !== currentEpisode.id);
    return [playingEpisode, ...otherEpisodes];
  }, [showEpisodes, currentEpisode]);

  // Format episode date
  const formatEpisodeDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  // Calculate dynamic padding for content to extend under overlays
  const contentPaddingTop = MODULE_HEADER_HEIGHT + insets.top;
  const contentPaddingBottom = currentEpisode && !isPlayerExpanded && !showSpeedPicker && !showSleepTimerPicker
    ? MINI_PLAYER_HEIGHT + insets.bottom
    : insets.bottom;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* ============================================================
          CONTENT LAYER — Full height, ModuleHeader participates in layout
          ============================================================ */}
      <View style={styles.contentLayer}>
        <ModuleScreenLayout
          moduleId="podcast"
          moduleBlock={
            <ModuleHeader
              moduleId="podcast"
              icon="podcast"
              title={t('modules.podcast.title')}
              currentSource="podcast"
              skipSafeArea
            />
          }
          controlsBlock={<>
        {/* Tab selector — Subscriptions (main) + Discover (opens modal) */}
        <View style={styles.tabBar}>
          <FavoriteTabButton
            isActive={!showSearchModal}
            onPress={() => setShowSearchModal(false)}
            count={subscriptions.length}
            label={t('modules.podcast.favorites')}
          />
          <SearchTabButton
            isActive={showSearchModal}
            onPress={() => setShowSearchModal(true)}
            label={t('modules.podcast.discover')}
            pulse={subscriptions.length === 0}
          />
        </View>

        {/* Playback Error Banner */}
        {playbackError && (
          <View style={styles.errorBanner}>
            <Icon name="warning" size={24} color={colors.error} />
            <View style={styles.errorBannerTextContainer}>
              <Text style={styles.errorBannerTitle}>
                {t('modules.podcast.playbackErrorTitle')}
              </Text>
              <Text style={styles.errorBannerMessage}>
                {t('modules.podcast.playbackErrorMessage')}
              </Text>
            </View>
            <HapticTouchable hapticDisabled
              style={[styles.errorBannerDismiss, { backgroundColor: accentColor.primary }]}
              onPress={() => {
                triggerFeedback('tap');
                setPlaybackError(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.errorBannerDismissText}>{t('common.close')}</Text>
            </HapticTouchable>
          </View>
        )}
        </>}
        contentBlock={<>
        {/* Subscriptions list — always shown on main screen */}
        {displayedShows.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="podcast" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              {t('modules.podcast.noFavorites')}
            </Text>
            <Text style={styles.emptyHint}>
              {t('modules.podcast.emptyStateHint')}
            </Text>
          </View>
        ) : (
          <ScrollViewWithIndicator
            ref={scrollRef}
            style={styles.showList}
            contentContainerStyle={[
              styles.showListContent,
              // Add bottom padding for MiniPlayer overlay when visible
              { paddingBottom: contentPaddingBottom + spacing.md },
            ]}
          >
            {displayedShows.map((show, index) => {
              const isCurrentShow = currentShow && currentShow.id === show.id;

              return (
                <VoiceFocusable
                  key={show.id}
                  id={show.id}
                  label={show.title}
                  index={index}
                  onSelect={() => handleShowPress(show)}
                >
                  <HapticTouchable hapticDisabled
                    style={[
                      styles.showItem,
                      // Playing show: thin accent border
                      isCurrentShow && {
                        borderWidth: 2,
                        borderColor: accentColor.primary,
                      },
                      isItemFocused(show.id) && getFocusStyle(),
                    ]}
                    onPress={() => handleShowPress(show)}
                    onLongPress={() => {
                      // Empty handler prevents onPress from firing after long press
                      // The HoldToNavigateWrapper handles the actual long-press action
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={show.title}
                    accessibilityState={{ selected: isCurrentShow ?? false }}
                    accessibilityHint={t('modules.podcast.showHint')}
                  >
                    {/* Playing wave icon — shown for currently playing show */}
                    {isCurrentShow && (
                      <View style={styles.playingWaveContainer}>
                        <PlayingWaveIcon
                          color={accentColor.primary}
                          size={24}
                          isPlaying={isPlaying}
                        />
                      </View>
                    )}

                    {/* Artwork */}
                    <ArtworkImage
                      uri={show.artwork}
                      style={styles.showArtwork}
                      placeholderIcon="podcast"
                      placeholderColor={podcastModuleColor}
                      accessibilityLabel={t('modules.podcast.showArtwork', { show: show.title })}
                    />

                    {/* Info */}
                    <View style={styles.showInfo}>
                      <Text style={styles.showTitle} numberOfLines={2}>
                        {show.title}
                      </Text>
                      <Text style={styles.showAuthor} numberOfLines={1}>
                        {show.author}
                      </Text>
                    </View>

                  {/* Subscribe button */}
                  <IconButton
                    icon="heart"
                    iconActive="heart-filled"
                    isActive={isSubscribed(show.id)}
                    onPress={() => handleToggleSubscribe(show)}
                    accessibilityLabel={
                      isSubscribed(show.id)
                        ? t('modules.podcast.removeFromFavorites', { name: show.title })
                        : t('modules.podcast.addToFavorites', { name: show.title })
                    }
                    size={24}
                  />
                  </HapticTouchable>
                </VoiceFocusable>
              );
            })}
          </ScrollViewWithIndicator>
        )}
        </>}
        />
      </View>

      {/* ============================================================
          OVERLAY LAYER — Floating MiniPlayer (position-aware)
          pointerEvents="box-none" allows touches to pass through
          Toolbar 'top' → player at bottom; Toolbar 'bottom' → player at top
          ============================================================ */}
      <View style={styles.overlayLayer} pointerEvents="box-none">
        {/* Spacer: pushes MiniPlayer to bottom when toolbar is at top */}
        {toolbarPosition !== 'bottom' && <View style={styles.overlaySpacer} pointerEvents="none" />}

        {/* Mini-player — React Native fallback when Glass Player not available */}
        {currentEpisode && currentShow && !isPlayerExpanded && !showSpeedPicker && !showSleepTimerPicker && !isGlassPlayerAvailable && (
          <UnifiedMiniPlayer
            moduleId="podcast"
            artwork={currentEpisode.artwork || currentShow.artwork || null}
            title={currentEpisode.title}
            subtitle={currentShow.title}
            placeholderIcon="podcast"
            isPlaying={isPlaying}
            isLoading={isPlaybackLoading}
            onPress={() => {
              setShowSpeedPicker(false);
              setShowSleepTimerPicker(false);
              setIsPlayerExpanded(true);
            }}
            onPlayPause={async () => {
              if (isPlaying) {
                await pause();
              } else {
                await play();
              }
            }}
            onStop={async () => {
              await stop();
            }}
            progressType="bar"
            progress={progress.duration > 0 ? progress.position / progress.duration : 0}
            onDismiss={() => {
              // Swipe-to-dismiss: hide mini player, audio continues
            }}
            style={styles.absolutePlayer}
          />
        )}

        {/* Spacer: pushes MiniPlayer to top when toolbar is at bottom */}
        {toolbarPosition === 'bottom' && <View style={styles.overlaySpacer} pointerEvents="none" />}
      </View>

      {/* Show Detail Modal */}
        <PanelAwareModal
          visible={selectedShow !== null}
          animationType={isReducedMotion ? 'none' : 'slide'}
          onRequestClose={() => setSelectedShow(null)}
          accessibilityViewIsModal={true}
        >
          <LiquidGlassView moduleId="podcast" style={[styles.showDetailModalContainer, { backgroundColor: themeColors.background }]} cornerRadius={0}>
            {selectedShow && (
              <>
                {/* Header — consistent with search modal */}
                <View style={[styles.showDetailModalHeader, { backgroundColor: podcastModuleColor }]}>
                  <View style={{ height: insets.top }} />
                  <View style={styles.showDetailModalHeaderRow}>
                    <IconButton
                      icon="chevron-down"
                      variant="onPrimary"
                      onPress={() => setSelectedShow(null)}
                      accessibilityLabel={t('common.close')}
                      size={28}
                    />
                    <Text style={styles.showDetailModalTitle} numberOfLines={1}>
                      {selectedShow.title}
                    </Text>
                    <IconButton
                      icon={isSubscribed(selectedShow.id) ? 'heart-filled' : 'heart'}
                      variant="onPrimary"
                      onPress={() => handleToggleSubscribe(selectedShow)}
                      accessibilityLabel={
                        isSubscribed(selectedShow.id)
                          ? t('modules.podcast.removeFromFavorites', { name: selectedShow.title })
                          : t('modules.podcast.addToFavorites', { name: selectedShow.title })
                      }
                      size={28}
                    />
                  </View>
                </View>

                {/* Scrollable content: artwork + info + episodes */}
                {isLoadingEpisodes ? (
                  <LoadingView />
                ) : (
                  <ScrollViewWithIndicator
                    style={styles.episodeList}
                    contentContainerStyle={{ paddingBottom: spacing.xxl }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {/* Show artwork + info */}
                    <View style={styles.showDetailHeader}>
                      <ArtworkImage
                        uri={selectedShow.artwork}
                        style={styles.showDetailArtwork}
                        placeholderIcon="podcast"
                        placeholderColor={podcastModuleColor}
                        placeholderIconSize={48}
                      />
                      <View style={styles.showDetailInfo}>
                        <Text style={styles.showDetailTitle} numberOfLines={2}>
                          {selectedShow.title}
                        </Text>
                        <Text style={styles.showDetailAuthor} numberOfLines={1}>
                          {selectedShow.author}
                        </Text>
                      </View>
                    </View>

                    {/* Episodes title */}
                    <Text style={styles.episodesTitle}>
                      {t('modules.podcast.episodes')} ({showEpisodes.length})
                    </Text>

                    {/* Episodes list */}
                    {sortedShowEpisodes.map((episode) => {
                      const episodeProgress = getEpisodeProgress(episode.id);
                      const completed = isEpisodeCompleted(episode.id);
                      const isCurrentEpisode = currentEpisode && currentEpisode.id === episode.id;

                      return (
                        <HapticTouchable hapticDisabled
                          key={episode.id}
                          style={[
                            styles.episodeItem,
                            // Playing episode: thin accent border
                            isCurrentEpisode && {
                              borderWidth: 2,
                              borderColor: accentColor.primary,
                            },
                          ]}
                          onPress={() => handlePlayEpisode(episode)}
                          onLongPress={() => {
                            // Empty handler prevents onPress from firing after long press
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={episode.title}
                          accessibilityState={{ selected: isCurrentEpisode ?? false }}
                          accessibilityHint={t('modules.podcast.episodeHint')}
                        >
                          {/* Playing wave icon — shown for currently playing episode */}
                          {isCurrentEpisode && (
                            <View style={styles.episodePlayingWaveContainer}>
                              <PlayingWaveIcon
                                color={accentColor.primary}
                                size={20}
                                isPlaying={isPlaying}
                              />
                            </View>
                          )}

                          <View style={styles.episodeInfo}>
                            <Text style={styles.episodeTitle} numberOfLines={2}>
                              {episode.title}
                            </Text>
                            <View style={styles.episodeMeta}>
                              <Text style={styles.episodeDate}>
                                {formatEpisodeDate(episode.publishedAt)}
                              </Text>
                              <Text style={styles.episodeDuration}>
                                {formatTime(episode.duration)}
                              </Text>
                              {completed && (
                                <View style={styles.completedBadge}>
                                  <Icon name="check" size={20} color={colors.textOnPrimary} />
                                </View>
                              )}
                            </View>
                            {episodeProgress && !completed && (
                              <View style={styles.episodeProgressContainer}>
                                <View
                                  style={[
                                    styles.episodeProgressBar,
                                    {
                                      width: `${(episodeProgress.position / episodeProgress.duration) * 100}%`,
                                      backgroundColor: accentColor.primary,
                                    },
                                  ]}
                                />
                              </View>
                            )}
                          </View>
                          <View style={[styles.playButton, { backgroundColor: accentColor.primary }]}>
                            <Icon name={isCurrentEpisode && isPlaying ? 'pause' : 'play'} size={20} color={colors.textOnPrimary} />
                          </View>
                        </HapticTouchable>
                      );
                    })}
                  </ScrollViewWithIndicator>
                )}
              </>
            )}
          </LiquidGlassView>
        </PanelAwareModal>

        {/* Expanded Player — React Native fallback when Glass Player not available */}
        <UnifiedFullPlayer
          visible={isPlayerExpanded && !!currentEpisode && !isGlassPlayerAvailable}
          moduleId="podcast"
          artwork={currentEpisode?.artwork || currentShow?.artwork || null}
          title={currentEpisode?.title || ''}
          subtitle={currentShow?.title || ''}
          placeholderIcon="podcast"
          isPlaying={isPlaying}
          isLoading={isPlaybackLoading}
          isBuffering={isBuffering}
          onPlayPause={async () => {
            if (isPlaying) {
              await pause();
            } else {
              await play();
            }
          }}
          onStop={async () => {
            await stop();
            setIsPlayerExpanded(false);
          }}
          onClose={() => setIsPlayerExpanded(false)}
          position={progress.position}
          duration={progress.duration || currentEpisode?.duration || 0}
          onSeek={(pos) => seekTo(pos)}
          onSkipBackward={() => skipBackward()}
          onSkipForward={() => skipForward()}
          skipBackwardLabel="10"
          skipForwardLabel="30"
          playbackRate={playbackRate}
          onSpeedPress={() => {
            setIsPlayerExpanded(false);
            setTimeout(() => setShowSpeedPicker(true), 100);
          }}
          isFavorite={currentShow ? isSubscribed(currentShow.id) : false}
          onFavoritePress={() => {
            if (currentShow) {
              if (isSubscribed(currentShow.id)) {
                unsubscribe(currentShow.id);
              } else {
                subscribe(currentShow);
              }
            }
          }}
          sleepTimerMinutes={sleepTimerMinutes}
          onSleepTimerPress={() => {
            setIsPlayerExpanded(false);
            setTimeout(() => setShowSleepTimerPicker(true), 100);
          }}
        />

        {/* Speed Picker Modal */}
        <PanelAwareModal
          visible={showSpeedPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowSpeedPicker(false);
            // Return to expanded player
            setTimeout(() => setIsPlayerExpanded(true), 100);
          }}
        >
          <HapticTouchable hapticDisabled
            style={styles.pickerOverlay}
            onPress={() => {
              setShowSpeedPicker(false);
              // Return to expanded player
              setTimeout(() => setIsPlayerExpanded(true), 100);
            }}
            activeOpacity={1}
          >
            <LiquidGlassView moduleId="podcast" style={styles.pickerContent} cornerRadius={16} onStartShouldSetResponder={() => true}>
              <ModalLayout
                headerBlock={
                  <Text style={styles.pickerTitle}>{t('modules.podcast.playbackSpeedTitle')}</Text>
                }
                contentBlock={
                  <>
                    {PLAYBACK_RATES.map((rate) => (
                      <HapticTouchable hapticDisabled
                        key={rate}
                        style={[
                          styles.pickerOption,
                          playbackRate === rate && { backgroundColor: accentColor.primaryLight },
                        ]}
                        onPress={async () => {
                          await triggerFeedback('tap');
                          await setPlaybackRate(rate);
                          setShowSpeedPicker(false);
                          // Return to expanded player
                          setTimeout(() => setIsPlayerExpanded(true), 100);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            playbackRate === rate && { color: accentColor.primary, fontWeight: '700' },
                          ]}
                        >
                          {rate}x
                        </Text>
                      </HapticTouchable>
                    ))}
                  </>
                }
              />
            </LiquidGlassView>
          </HapticTouchable>
        </PanelAwareModal>

        {/* Sleep Timer Picker Modal */}
        <PanelAwareModal
          visible={showSleepTimerPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowSleepTimerPicker(false);
            // Return to expanded player
            setTimeout(() => setIsPlayerExpanded(true), 100);
          }}
        >
          <HapticTouchable hapticDisabled
            style={styles.pickerOverlay}
            onPress={() => {
              setShowSleepTimerPicker(false);
              // Return to expanded player
              setTimeout(() => setIsPlayerExpanded(true), 100);
            }}
            activeOpacity={1}
          >
            <LiquidGlassView moduleId="podcast" style={styles.pickerContent} cornerRadius={16} onStartShouldSetResponder={() => true}>
              <ModalLayout
                headerBlock={
                  <Text style={styles.pickerTitle}>{t('modules.podcast.sleepTimerTitle')}</Text>
                }
                contentBlock={
                  <>
                    {sleepTimerMinutes && (
                      <HapticTouchable hapticDisabled
                        style={[styles.pickerOption, { backgroundColor: colors.errorBackground }]}
                        onPress={() => {
                          triggerFeedback('tap');
                          setSleepTimer(null);
                          setShowSleepTimerPicker(false);
                          // Return to expanded player
                          setTimeout(() => setIsPlayerExpanded(true), 100);
                        }}
                      >
                        <Text style={[styles.pickerOptionText, { color: colors.error }]}>
                          {t('modules.podcast.sleepTimerCancel')}
                        </Text>
                      </HapticTouchable>
                    )}
                    {SLEEP_TIMER_OPTIONS.map((minutes) => (
                      <HapticTouchable hapticDisabled
                        key={minutes}
                        style={[
                          styles.pickerOption,
                          sleepTimerMinutes === minutes && { backgroundColor: accentColor.primaryLight },
                        ]}
                        onPress={() => {
                          triggerFeedback('tap');
                          setSleepTimer(minutes);
                          setShowSleepTimerPicker(false);
                          // Return to expanded player
                          setTimeout(() => setIsPlayerExpanded(true), 100);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            sleepTimerMinutes === minutes && { color: accentColor.primary, fontWeight: '700' },
                          ]}
                        >
                          {t('modules.podcast.sleepTimerMinutes', { minutes })}
                        </Text>
                      </HapticTouchable>
                    ))}
                  </>
                }
              />
            </LiquidGlassView>
          </HapticTouchable>
        </PanelAwareModal>

        {/* Continue Listening Dialog */}
        <PanelAwareModal
          visible={showContinueListeningDialog && continueListeningEpisode !== null}
          transparent={true}
          animationType={isReducedMotion ? 'none' : 'fade'}
          onRequestClose={() => {
            setShowContinueListeningDialog(false);
            // Show episode list instead
            if (continueListeningShow) {
              setSelectedShow(continueListeningShow);
            }
            setContinueListeningEpisode(null);
            setContinueListeningShow(null);
          }}
          accessibilityViewIsModal={true}
        >
          <View style={styles.continueListeningOverlay}>
            <LiquidGlassView moduleId="podcast" style={styles.continueListeningContent} cornerRadius={16}>
              {continueListeningEpisode && continueListeningShow && (
                <>
                  {/* Episode artwork */}
                  <ArtworkImage
                    uri={continueListeningEpisode.artwork || continueListeningShow.artwork}
                    style={styles.continueListeningArtwork}
                    placeholderIcon="podcast"
                    placeholderColor={podcastModuleColor}
                    placeholderIconSize={48}
                  />

                  {/* Title */}
                  <Text style={styles.continueListeningTitle}>
                    {t('modules.podcast.continueListeningTitle')}
                  </Text>

                  {/* Episode info */}
                  <Text style={styles.continueListeningEpisode} numberOfLines={2}>
                    {continueListeningEpisode.title}
                  </Text>

                  {/* Progress info */}
                  {(() => {
                    const progress = getEpisodeProgress(continueListeningEpisode.id);
                    if (progress) {
                      return (
                        <View style={styles.continueListeningProgress}>
                          <View style={styles.continueListeningProgressBar}>
                            <View
                              style={[
                                styles.continueListeningProgressFill,
                                {
                                  width: `${(progress.position / progress.duration) * 100}%`,
                                  backgroundColor: accentColor.primary,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.continueListeningProgressText}>
                            {formatTime(progress.position)} / {formatTime(progress.duration)}
                          </Text>
                        </View>
                      );
                    }
                    return null;
                  })()}

                  {/* Buttons */}
                  <View style={styles.continueListeningButtons}>
                    {/* Yes - Continue */}
                    <HapticTouchable hapticDisabled
                      style={[styles.continueListeningButton, { backgroundColor: accentColor.primary }]}
                      onPress={async () => {
                        triggerFeedback('tap');
                        setShowContinueListeningDialog(false);
                        // Store episode list for next/previous navigation
                        setCurrentShowEpisodes(showEpisodes);
                        // Play the episode
                        await playEpisode(continueListeningEpisode, continueListeningShow);
                        setContinueListeningEpisode(null);
                        setContinueListeningShow(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.podcast.continueYes')}
                    >
                      <Icon name="play" size={24} color={colors.textOnPrimary} />
                      <Text style={styles.continueListeningButtonText}>
                        {t('modules.podcast.continueYes')}
                      </Text>
                    </HapticTouchable>

                    {/* No - Show episodes */}
                    <HapticTouchable hapticDisabled
                      style={[styles.continueListeningButton, styles.continueListeningButtonSecondary]}
                      onPress={() => {
                        triggerFeedback('tap');
                        setShowContinueListeningDialog(false);
                        // Show episode list
                        if (continueListeningShow) {
                          setSelectedShow(continueListeningShow);
                        }
                        setContinueListeningEpisode(null);
                        setContinueListeningShow(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.podcast.continueNo')}
                    >
                      <Icon name="list" size={24} color={colors.textPrimary} />
                      <Text style={styles.continueListeningButtonTextSecondary}>
                        {t('modules.podcast.continueNo')}
                      </Text>
                    </HapticTouchable>
                  </View>
                </>
              )}
            </LiquidGlassView>
          </View>
        </PanelAwareModal>

        {/* Next Episode Dialog — shown when current episode ends and there's a next one */}
        <PanelAwareModal
          visible={showNextEpisodeDialog && nextEpisodeInfo !== null}
          transparent={true}
          animationType={isReducedMotion ? 'none' : 'fade'}
          onRequestClose={() => {
            setShowNextEpisodeDialog(false);
            setNextEpisodeInfo(null);
            // Stop playback and go to main podcast screen
            stop();
          }}
          accessibilityViewIsModal={true}
        >
          <View style={styles.nextEpisodeOverlay}>
            <LiquidGlassView moduleId="podcast" style={styles.nextEpisodeContent} cornerRadius={16}>
              {nextEpisodeInfo && (
                <>
                  {/* Checkmark icon for completed episode */}
                  <View style={[styles.nextEpisodeCheckIcon, { backgroundColor: accentColor.primary }]}>
                    <Icon name="check" size={32} color={colors.textOnPrimary} />
                  </View>

                  {/* Completed text */}
                  <Text style={styles.nextEpisodeCompletedText}>
                    {t('modules.podcast.episodeCompleted', {
                      title: nextEpisodeInfo.completedEpisode.title,
                    })}
                  </Text>

                  {/* Next episode artwork */}
                  <ArtworkImage
                    uri={nextEpisodeInfo.nextEpisode.artwork || nextEpisodeInfo.show.artwork}
                    style={styles.nextEpisodeArtwork}
                    placeholderIcon="podcast"
                    placeholderColor={podcastModuleColor}
                    placeholderIconSize={48}
                  />

                  {/* Question */}
                  <Text style={styles.nextEpisodeQuestion}>
                    {t('modules.podcast.playNextEpisodeQuestion')}
                  </Text>

                  {/* Next episode title */}
                  <Text style={styles.nextEpisodeTitle} numberOfLines={2}>
                    {nextEpisodeInfo.nextEpisode.title}
                  </Text>

                  {/* Duration */}
                  <Text style={styles.nextEpisodeDuration}>
                    {formatTime(nextEpisodeInfo.nextEpisode.duration)}
                  </Text>

                  {/* Buttons */}
                  <View style={styles.nextEpisodeButtons}>
                    {/* Yes - Play next */}
                    <HapticTouchable hapticDisabled
                      style={[styles.nextEpisodeButton, { backgroundColor: accentColor.primary }]}
                      onPress={async () => {
                        triggerFeedback('tap');
                        setShowNextEpisodeDialog(false);
                        // Play next episode
                        await playEpisode(nextEpisodeInfo.nextEpisode, nextEpisodeInfo.show);
                        setNextEpisodeInfo(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.podcast.playNextYes')}
                    >
                      <Icon name="play" size={24} color={colors.textOnPrimary} />
                      <Text style={styles.nextEpisodeButtonText}>
                        {t('modules.podcast.playNextYes')}
                      </Text>
                    </HapticTouchable>

                    {/* No - Stop and go to main menu */}
                    <HapticTouchable hapticDisabled
                      style={[styles.nextEpisodeButton, styles.nextEpisodeButtonSecondary]}
                      onPress={() => {
                        triggerFeedback('tap');
                        setShowNextEpisodeDialog(false);
                        setNextEpisodeInfo(null);
                        // Stop playback
                        stop();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.podcast.playNextNo')}
                    >
                      <Icon name="x" size={24} color={colors.textPrimary} />
                      <Text style={styles.nextEpisodeButtonTextSecondary}>
                        {t('modules.podcast.playNextNo')}
                      </Text>
                    </HapticTouchable>
                  </View>
                </>
              )}
            </LiquidGlassView>
          </View>
        </PanelAwareModal>

      {/* ============================================================
          DISCOVERY SEARCH MODAL — Opens when SearchTabButton is tapped
          Contains ChipSelector + SearchBar + search results list
          ============================================================ */}
      <PanelAwareModal
        visible={showSearchModal}
        animationType={isReducedMotion ? 'none' : 'slide'}
        onRequestClose={() => setShowSearchModal(false)}
      >
        <LiquidGlassView moduleId="podcast" style={[styles.searchModalContainer, { backgroundColor: themeColors.background }]} cornerRadius={0}>
          {/* Modal header with close button */}
          <View style={[styles.searchModalHeader, { backgroundColor: podcastModuleColor }]}>
            <View style={{ height: insets.top }} />
            <View style={styles.searchModalHeaderRow}>
              <Icon name="search" size={28} color={colors.textOnPrimary} />
              <Text style={styles.searchModalTitle}>{t('modules.podcast.discover')}</Text>
              <View style={{ flex: 1 }} />
              <IconButton
                icon="chevron-down"
                variant="onPrimary"
                onPress={() => setShowSearchModal(false)}
                accessibilityLabel={t('common.close')}
                size={28}
              />
            </View>
          </View>

          {/* Search controls: ChipSelector + SearchBar */}
          <View style={styles.searchSection}>
            <ChipSelector
              mode="country"
              options={COUNTRIES}
              selectedCode={selectedCountry}
              onSelect={handleCountryChange}
            />
            <SearchBar
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmit={handleSearch}
              placeholder={t('modules.podcast.searchPlaceholder')}
              searchButtonLabel={t('modules.podcast.searchButton')}
              maxLength={SEARCH_MAX_LENGTH}
            />
          </View>

          {/* Search results */}
          {isLoading ? (
            <LoadingView message={t('modules.podcast.loading')} fullscreen />
          ) : apiError ? (
            <ErrorView
              title={t(`modules.podcast.errors.${apiError}Title`)}
              message={t(`modules.podcast.errors.${apiError}`)}
              onRetry={() => {
                triggerFeedback('tap');
                handleSearch();
              }}
              fullscreen
            />
          ) : searchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="podcast" size={64} color={themeColors.textTertiary} />
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                {t('modules.podcast.noResults')}
              </Text>
            </View>
          ) : (
            <ScrollViewWithIndicator
              style={styles.showList}
              contentContainerStyle={styles.showListContent}
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.map((show) => {
                const isCurrentShow = currentShow && currentShow.id === show.id;

                return (
                  <View
                    key={show.id}
                    style={[
                      styles.showItem,
                      { backgroundColor: themeColors.surface },
                      isCurrentShow && {
                        borderWidth: 2,
                        borderColor: accentColor.primary,
                      },
                    ]}
                  >
                    {/* Playing wave icon */}
                    {isCurrentShow && (
                      <View style={styles.playingWaveContainer}>
                        <PlayingWaveIcon
                          color={accentColor.primary}
                          size={24}
                          isPlaying={isPlaying}
                        />
                      </View>
                    )}

                    {/* Show info - tap to open show detail and close modal */}
                    <HapticTouchable hapticDisabled
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
                      onPress={() => {
                        handleShowPress(show);
                        setShowSearchModal(false);
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={show.title}
                      accessibilityState={{ selected: isCurrentShow ?? false }}
                      accessibilityHint={t('modules.podcast.showHint')}
                    >
                      {/* Artwork */}
                      <ArtworkImage
                        uri={show.artwork}
                        style={styles.showArtwork}
                        placeholderIcon="podcast"
                        placeholderColor={podcastModuleColor}
                        accessibilityLabel={t('modules.podcast.showArtwork', { show: show.title })}
                      />

                      {/* Info */}
                      <View style={styles.showInfo}>
                        <Text style={[styles.showTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
                          {show.title}
                        </Text>
                        <Text style={[styles.showAuthor, { color: themeColors.textSecondary }]} numberOfLines={1}>
                          {show.author}
                        </Text>
                      </View>
                    </HapticTouchable>

                    {/* Subscribe button */}
                    <IconButton
                      icon="heart"
                      iconActive="heart-filled"
                      isActive={isSubscribed(show.id)}
                      onPress={() => handleToggleSubscribe(show)}
                      accessibilityLabel={
                        isSubscribed(show.id)
                          ? t('modules.podcast.removeFromFavorites', { name: show.title })
                          : t('modules.podcast.addToFavorites', { name: show.title })
                      }
                      size={24}
                    />
                  </View>
                );
              })}
            </ScrollViewWithIndicator>
          )}
        </LiquidGlassView>
      </PanelAwareModal>

      {/* Voice hint */}
      {isVoiceSessionActive && (
        <View style={styles.voiceHint}>
          <Text style={styles.voiceHintText}>{t('modules.podcast.voiceHint')}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
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
  // ============================================================
  // Overlay Architecture Styles (for Liquid Glass transparency)
  // ============================================================
  contentLayer: {
    flex: 1,
    // Content extends full height — padding handled by contentPaddingTop/Bottom
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    // pointerEvents="box-none" set on component allows touches to pass through
  },
  absoluteHeader: {
    // ModuleHeader positioned at top of overlay
    // No explicit positioning needed — it's the first child in flex column
  },
  overlaySpacer: {
    flex: 1,
    // Pushes MiniPlayer to bottom
  },
  absolutePlayer: {
    // MiniPlayer positioned at bottom of overlay
    // No explicit positioning needed — it's the last child in flex column
  },
  // ============================================================
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  // Tab styles removed — using standardized FavoriteTabButton/SearchTabButton components
  searchSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  // Discovery Search Modal styles
  searchModalContainer: {
    flex: 1,
  },
  searchModalHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchModalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTargets.minimum,
  },
  searchModalTitle: {
    ...typography.h3,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  // searchContainer, searchInput, searchButton removed — using standardized SearchBar component
  countrySelector: {
    marginTop: spacing.md,
  },
  // filterLabel, countryScrollContent, countryChip, countryChipText removed — using standardized ChipSelector component
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBackground,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorBannerTextContainer: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  errorBannerTitle: {
    ...typography.body,
    color: colors.error,
    fontWeight: '700',
  },
  errorBannerMessage: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  errorBannerDismiss: {
    minWidth: touchTargets.minimum,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  errorBannerDismissText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.h3,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyHint: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  showList: {
    flex: 1,
  },
  showListContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  showItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.md,
  },
  playingWaveContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showArtwork: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.sm,
  },
  showInfo: {
    flex: 1,
  },
  showTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  showAuthor: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  // Mini-player styles removed — using standardized MiniPlayer component
  // Show Detail Modal
  showDetailModalContainer: {
    flex: 1,
  },
  showDetailModalHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  showDetailModalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTargets.minimum,
  },
  showDetailModalTitle: {
    ...typography.h3,
    color: colors.textOnPrimary,
    fontWeight: '700',
    flex: 1,
  },
  showDetailHeader: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  showDetailArtwork: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.md,
  },
  showDetailInfo: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
  showDetailTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  showDetailAuthor: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  episodesTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  episodeList: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  episodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: touchTargets.comfortable,
  },
  episodePlayingWaveContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  episodeInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  episodeTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  episodeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  episodeDate: {
    ...typography.small,
    color: colors.textSecondary,
  },
  episodeDuration: {
    ...typography.small,
    color: colors.textTertiary,
  },
  completedBadge: {
    backgroundColor: colors.success,
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeProgressContainer: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 1.5,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  episodeProgressBar: {
    height: '100%',
    borderRadius: 1.5,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Picker Modals
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  pickerContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    minWidth: 200,
  },
  pickerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontWeight: '700',
  },
  pickerOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  pickerOptionText: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  voiceHint: {
    position: 'absolute',
    bottom: 120,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  voiceHintText: {
    ...typography.body,
    color: colors.textOnPrimary,
    textAlign: 'center',
  },
  // Continue Listening Dialog
  continueListeningOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  continueListeningContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  continueListeningArtwork: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  continueListeningTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  continueListeningEpisode: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  continueListeningProgress: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  continueListeningProgressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  continueListeningProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  continueListeningProgressText: {
    ...typography.small,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  continueListeningButtons: {
    width: '100%',
    gap: spacing.md,
  },
  continueListeningButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
  },
  continueListeningButtonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  continueListeningButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  continueListeningButtonTextSecondary: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  // Next Episode Dialog
  nextEpisodeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  nextEpisodeContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  nextEpisodeCheckIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  nextEpisodeCompletedText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  nextEpisodeArtwork: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  nextEpisodeQuestion: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  nextEpisodeTitle: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  nextEpisodeDuration: {
    ...typography.small,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  nextEpisodeButtons: {
    width: '100%',
    gap: spacing.md,
  },
  nextEpisodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
  },
  nextEpisodeButtonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextEpisodeButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  nextEpisodeButtonTextSecondary: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
