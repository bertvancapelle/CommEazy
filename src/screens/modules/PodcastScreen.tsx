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
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  AccessibilityInfo,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Image,
  Animated,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, IconButton, VoiceFocusable, SeekSlider, PlayingWaveIcon, MiniPlayer, ExpandedAudioPlayer, ModuleHeader, FavoriteTabButton, SearchTabButton } from '@/components';
import { useVoiceFocusList, useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import { useHoldGestureContextSafe } from '@/contexts/HoldGestureContext';
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

// ============================================================
// Constants
// ============================================================

const PODCAST_MODULE_COLOR = '#E91E63';
const SEARCH_MAX_LENGTH = 100;
const PLAYBACK_RATES = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const SLEEP_TIMER_OPTIONS = [15, 30, 45, 60, 90]; // minutes

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
  const searchInputRef = useRef<TextInput>(null);

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

  // State
  const [searchResults, setSearchResults] = useState<PodcastShow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<'network' | 'timeout' | 'server' | 'parse' | null>(null);
  const [showSubscriptions, setShowSubscriptions] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const hasShownWelcomeRef = useRef(false);
  const [selectedCountry, setSelectedCountry] = useState('NL');

  // Show detail modal
  const [selectedShow, setSelectedShow] = useState<PodcastShow | null>(null);
  const [showEpisodes, setShowEpisodes] = useState<PodcastEpisode[]>([]);
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

  // Pulse animation for artwork (when buffering)
  const [pulseAnim] = useState(new Animated.Value(1));

  // Seek slider state — for smooth dragging
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);

  useEffect(() => {
    if (isBuffering && !isReducedMotion) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.85,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isBuffering, isReducedMotion, pulseAnim]);

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

  // Show welcome modal for first-time users
  useEffect(() => {
    if (!hasShownWelcomeRef.current && subscriptions.length === 0) {
      hasShownWelcomeRef.current = true;
      setShowWelcomeModal(true);
    }
  }, [subscriptions.length]);

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

    if (!selectedShow) return;
    triggerFeedback('tap');
    // Store the episode list in context for next/previous navigation
    setCurrentShowEpisodes(showEpisodes);
    await playEpisode(episode, selectedShow);
    setSelectedShow(null);
  }, [holdGesture, selectedShow, showEpisodes, playEpisode, setCurrentShowEpisodes, triggerFeedback]);

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

  // Voice focus for show list
  // Sort shows so currently playing show appears at the top
  const displayedShows = useMemo(() => {
    const baseList = showSubscriptions ? subscriptions : searchResults;
    if (!currentShow) return baseList;

    // Find the currently playing show and move it to the top
    const playingShow = baseList.find((s) => s.id === currentShow.id);
    if (!playingShow) return baseList;

    // Put playing show first, then the rest
    const otherShows = baseList.filter((s) => s.id !== currentShow.id);
    return [playingShow, ...otherShows];
  }, [showSubscriptions, subscriptions, searchResults, currentShow]);

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.innerContainer}>
        {/* Module Header — standardized component with AdMob placeholder */}
        <ModuleHeader
          moduleId="podcast"
          icon="podcast"
          title={t('modules.podcast.title')}
          currentSource="podcast"
          showAdMob={true}
        />

        {/* Tab selector — uses standardized FavoriteTabButton/SearchTabButton */}
        <View style={styles.tabBar}>
          <FavoriteTabButton
            isActive={showSubscriptions}
            onPress={() => setShowSubscriptions(true)}
            count={subscriptions.length}
            label={t('modules.podcast.favorites')}
          />
          <SearchTabButton
            isActive={!showSubscriptions}
            onPress={() => setShowSubscriptions(false)}
            label={t('modules.podcast.discover')}
          />
        </View>

        {/* Search section (Discover tab only) */}
        {!showSubscriptions && (
          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder={t('modules.podcast.searchPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => {
                  Keyboard.dismiss();
                  handleSearch();
                }}
                returnKeyType="search"
                maxLength={SEARCH_MAX_LENGTH}
                autoCorrect={false}
                autoCapitalize="none"
                accessibilityLabel={t('modules.podcast.searchPlaceholder')}
              />
              <TouchableOpacity
                style={[styles.searchButton, { backgroundColor: accentColor.primary }]}
                onPress={() => {
                  Keyboard.dismiss();
                  handleSearch();
                }}
                accessibilityRole="button"
                accessibilityLabel={t('modules.podcast.searchButton')}
              >
                <Icon name="search" size={24} color={colors.textOnPrimary} />
              </TouchableOpacity>
            </View>

            {/* Country selector */}
            <View style={styles.countrySelector}>
              <Text style={styles.filterLabel}>{t('modules.podcast.country')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.countryScrollContent}
              >
                {COUNTRIES.map(country => (
                  <TouchableOpacity
                    key={country.code}
                    style={[
                      styles.countryChip,
                      selectedCountry === country.code && {
                        backgroundColor: accentColor.primary,
                        borderColor: accentColor.primary,
                      },
                    ]}
                    onPress={() => handleCountryChange(country.code)}
                    onLongPress={() => {}}
                    delayLongPress={300}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedCountry === country.code }}
                    accessibilityLabel={`${country.flag} ${country.nativeName}`}
                  >
                    <Text
                      style={[
                        styles.countryChipText,
                        selectedCountry === country.code && styles.countryChipTextActive,
                      ]}
                    >
                      {country.flag} {country.nativeName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

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
            <TouchableOpacity
              style={[styles.errorBannerDismiss, { backgroundColor: accentColor.primary }]}
              onPress={() => {
                triggerFeedback('tap');
                setPlaybackError(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.errorBannerDismissText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show list */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={accentColor.primary} />
            <Text style={styles.loadingText}>{t('modules.podcast.loading')}</Text>
          </View>
        ) : apiError ? (
          <View style={styles.errorContainer}>
            <Icon name="warning" size={64} color={colors.error} />
            <Text style={styles.errorTitle}>{t(`modules.podcast.errors.${apiError}Title`)}</Text>
            <Text style={styles.errorMessage}>{t(`modules.podcast.errors.${apiError}`)}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: accentColor.primary }]}
              onPress={() => {
                triggerFeedback('tap');
                handleSearch();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('common.tryAgain')}
            >
              <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
            </TouchableOpacity>
          </View>
        ) : displayedShows.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name={showSubscriptions ? 'heart' : 'podcast'} size={64} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              {showSubscriptions ? t('modules.podcast.noFavorites') : t('modules.podcast.noResults')}
            </Text>
            {showSubscriptions && (
              <>
                <Text style={styles.emptyHint}>{t('modules.podcast.noFavoritesHint')}</Text>
                <TouchableOpacity
                  style={[styles.emptyActionButton, { backgroundColor: accentColor.primary }]}
                  onPress={() => {
                    triggerFeedback('tap');
                    setShowSubscriptions(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('modules.podcast.goToDiscover')}
                >
                  <Icon name="search" size={24} color={colors.textOnPrimary} />
                  <Text style={styles.emptyActionButtonText}>{t('modules.podcast.goToDiscover')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.showList}
            contentContainerStyle={[
              styles.showListContent,
              currentEpisode && { paddingBottom: touchTargets.comfortable + spacing.md },
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
                  <TouchableOpacity
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
                    delayLongPress={300}
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
                    {show.artwork ? (
                      <Image
                        source={{ uri: show.artwork }}
                        style={styles.showArtwork}
                        accessibilityLabel={t('modules.podcast.showArtwork', { show: show.title })}
                      />
                    ) : (
                      <View style={[styles.showArtwork, styles.showArtworkPlaceholder]}>
                        <Icon name="podcast" size={32} color={colors.textOnPrimary} />
                      </View>
                    )}

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
                  </TouchableOpacity>
                </VoiceFocusable>
              );
            })}
          </ScrollView>
        )}

        {/* Mini-player — using standardized component */}
        {currentEpisode && currentShow && !isPlayerExpanded && !showSpeedPicker && !showSleepTimerPicker && (
          <MiniPlayer
            artwork={currentEpisode.artwork || currentShow.artwork || null}
            title={currentEpisode.title}
            subtitle={currentShow.title}
            accentColor={accentColor.primary}
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
            progressType="bar"
            progress={progress.duration > 0 ? progress.position / progress.duration : 0}
            expandAccessibilityLabel={t('modules.podcast.expandPlayer')}
            expandAccessibilityHint={t('modules.podcast.expandPlayerHint')}
          />
        )}

        {/* Show Detail Modal */}
        <Modal
          visible={selectedShow !== null}
          transparent={true}
          animationType={isReducedMotion ? 'none' : 'slide'}
          onRequestClose={() => setSelectedShow(null)}
          accessibilityViewIsModal={true}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.showDetailModal, { paddingTop: insets.top + spacing.md }]}>
              {selectedShow && (
                <>
                  {/* Header */}
                  <View style={styles.showDetailHeader}>
                    {selectedShow.artwork ? (
                      <Image
                        source={{ uri: selectedShow.artwork }}
                        style={styles.showDetailArtwork}
                      />
                    ) : (
                      <View style={[styles.showDetailArtwork, styles.showArtworkPlaceholder]}>
                        <Icon name="podcast" size={48} color={colors.textOnPrimary} />
                      </View>
                    )}
                    <View style={styles.showDetailInfo}>
                      <Text style={styles.showDetailTitle} numberOfLines={2}>
                        {selectedShow.title}
                      </Text>
                      <Text style={styles.showDetailAuthor} numberOfLines={1}>
                        {selectedShow.author}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.subscribeButton,
                          isSubscribed(selectedShow.id)
                            ? styles.subscribeButtonActive
                            : { borderColor: accentColor.primary },
                        ]}
                        onPress={() => handleToggleSubscribe(selectedShow)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isSubscribed(selectedShow.id)
                            ? t('modules.podcast.removeFromFavorites', { name: selectedShow.title })
                            : t('modules.podcast.addToFavorites', { name: selectedShow.title })
                        }
                      >
                        <Icon
                          name={isSubscribed(selectedShow.id) ? 'heart-filled' : 'heart'}
                          size={20}
                          color={isSubscribed(selectedShow.id) ? colors.textOnPrimary : accentColor.primary}
                        />
                        <Text
                          style={[
                            styles.subscribeButtonText,
                            isSubscribed(selectedShow.id)
                              ? styles.subscribeButtonTextActive
                              : { color: accentColor.primary },
                          ]}
                        >
                          {isSubscribed(selectedShow.id)
                            ? t('modules.podcast.isFavorite')
                            : t('modules.podcast.addToFavorites')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Episodes */}
                  <Text style={styles.episodesTitle}>
                    {t('modules.podcast.episodes')} ({showEpisodes.length})
                  </Text>

                  {isLoadingEpisodes ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color={accentColor.primary} />
                    </View>
                  ) : (
                    <ScrollView style={styles.episodeList}>
                      {sortedShowEpisodes.map((episode) => {
                        const episodeProgress = getEpisodeProgress(episode.id);
                        const completed = isEpisodeCompleted(episode.id);
                        const isCurrentEpisode = currentEpisode && currentEpisode.id === episode.id;

                        return (
                          <TouchableOpacity
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
                            delayLongPress={300}
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
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}

                  {/* Close button */}
                  <TouchableOpacity
                    style={[styles.closeButton, { backgroundColor: accentColor.primary }]}
                    onPress={() => setSelectedShow(null)}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.close')}
                  >
                    <Text style={styles.closeButtonText}>{t('common.close')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Expanded Player Modal */}
        <Modal
          visible={isPlayerExpanded && !!currentEpisode}
          transparent={true}
          animationType={isReducedMotion ? 'none' : 'slide'}
          onRequestClose={() => setIsPlayerExpanded(false)}
          accessibilityViewIsModal={true}
        >
          <View style={styles.expandedPlayerOverlay}>
            <View style={[styles.expandedPlayerContent, { paddingTop: insets.top + spacing.md }]}>
              {currentEpisode && currentShow && (
                <>
                  {/* Artwork */}
                  <Animated.View
                    style={[
                      styles.expandedArtworkContainer,
                      { transform: [{ scale: pulseAnim }] },
                    ]}
                  >
                    {(currentEpisode.artwork || currentShow.artwork) ? (
                      <Image
                        source={{ uri: currentEpisode.artwork || currentShow.artwork }}
                        style={styles.expandedArtwork}
                      />
                    ) : (
                      <View style={[styles.expandedArtwork, styles.expandedArtworkPlaceholder]}>
                        <Icon name="podcast" size={80} color={colors.textOnPrimary} />
                      </View>
                    )}
                    {(isPlaybackLoading || isBuffering) && (
                      <View style={styles.expandedArtworkOverlay}>
                        <ActivityIndicator size="large" color={colors.textOnPrimary} />
                      </View>
                    )}
                  </Animated.View>

                  {/* Episode info */}
                  <View style={styles.expandedInfo}>
                    <Text style={styles.expandedShowTitle} numberOfLines={1}>
                      {currentShow.title}
                    </Text>
                    <Text style={styles.expandedEpisodeTitle} numberOfLines={2}>
                      {currentEpisode.title}
                    </Text>
                  </View>

                  {/* Progress bar — smooth draggable slider */}
                  <View style={styles.progressSection}>
                    <SeekSlider
                      value={progress.position}
                      duration={progress.duration || currentEpisode.duration || 1}
                      onSeekStart={() => setIsSeeking(true)}
                      onSeeking={(position) => setSeekPosition(position)}
                      onSeekEnd={(position) => {
                        seekTo(position);
                        setIsSeeking(false);
                      }}
                      accentColor={accentColor.primary}
                      accessibilityLabel={`${formatTime(isSeeking ? seekPosition : progress.position)} van ${formatTime(progress.duration || currentEpisode.duration)}`}
                      accessibilityStep={10}
                      testID="podcast-seek-slider"
                    />
                    <View style={styles.progressLabels}>
                      <Text style={styles.progressTime}>
                        {formatTime(isSeeking ? seekPosition : progress.position)}
                      </Text>
                      <Text style={styles.progressTime}>
                        -{formatTime((progress.duration || currentEpisode.duration) - (isSeeking ? seekPosition : progress.position))}
                      </Text>
                    </View>
                  </View>

                  {/* Controls */}
                  <View style={styles.expandedControls}>
                    {/* Speed */}
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => {
                        console.log('[PodcastScreen] Speed button pressed');
                        triggerFeedback('tap');
                        // Close expanded player first, then open speed picker
                        setIsPlayerExpanded(false);
                        // Small delay to let modal close animation complete
                        setTimeout(() => {
                          setShowSpeedPicker(true);
                        }, 100);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.podcast.playbackSpeed', { rate: `${playbackRate}x` })}
                    >
                      <Text style={styles.secondaryButtonText}>{playbackRate}x</Text>
                    </TouchableOpacity>

                    {/* Skip backward */}
                    <TouchableOpacity
                      style={styles.skipButton}
                      onPress={() => skipBackward()}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.podcast.skipBackward', { seconds: 10 })}
                    >
                      <Icon name="chevron-left" size={24} color={colors.textPrimary} />
                      <Text style={styles.skipButtonText}>10</Text>
                    </TouchableOpacity>

                    {/* Play/Pause */}
                    <TouchableOpacity
                      style={[styles.mainPlayButton, { backgroundColor: accentColor.primary }]}
                      onPress={async () => {
                        await triggerFeedback('tap');
                        if (isPlaying) {
                          await pause();
                        } else {
                          await play();
                        }
                      }}
                      disabled={isPlaybackLoading}
                      accessibilityRole="button"
                      accessibilityLabel={isPlaying ? t('modules.podcast.pause') : t('modules.podcast.play')}
                    >
                      {isPlaybackLoading ? (
                        <ActivityIndicator size="large" color={colors.textOnPrimary} />
                      ) : (
                        <Icon
                          name={isPlaying ? 'pause' : 'play'}
                          size={40}
                          color={colors.textOnPrimary}
                        />
                      )}
                    </TouchableOpacity>

                    {/* Skip forward */}
                    <TouchableOpacity
                      style={styles.skipButton}
                      onPress={() => skipForward()}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.podcast.skipForward', { seconds: 30 })}
                    >
                      <Text style={styles.skipButtonText}>30</Text>
                      <Icon name="chevron-right" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>

                    {/* Sleep timer */}
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => {
                        console.log('[PodcastScreen] Sleep timer button pressed');
                        triggerFeedback('tap');
                        // Close expanded player first, then open sleep timer picker
                        setIsPlayerExpanded(false);
                        // Small delay to let modal close animation complete
                        setTimeout(() => {
                          setShowSleepTimerPicker(true);
                        }, 100);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        sleepTimerMinutes
                          ? t('modules.podcast.sleepTimerActive', { minutes: sleepTimerMinutes })
                          : t('modules.podcast.sleepTimer')
                      }
                    >
                      <Icon
                        name="time"
                        size={20}
                        color={sleepTimerMinutes ? accentColor.primary : colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Buffering text */}
                  {isBuffering && (
                    <Text style={styles.bufferingText}>{t('modules.podcast.buffering')}</Text>
                  )}

                  {/* Minimize button — positioned below controls with proper spacing */}
                  <View style={styles.expandedCloseContainer}>
                    <TouchableOpacity
                      style={styles.minimizeButton}
                      onPress={() => {
                        triggerFeedback('tap');
                        setIsPlayerExpanded(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('modules.podcast.collapsePlayer')}
                    >
                      <Icon name="chevron-down" size={28} color={colors.textSecondary} />
                      <Text style={styles.minimizeButtonText}>{t('modules.podcast.collapsePlayer')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Speed Picker Modal */}
        <Modal
          visible={showSpeedPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowSpeedPicker(false);
            // Return to expanded player
            setTimeout(() => setIsPlayerExpanded(true), 100);
          }}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            onPress={() => {
              setShowSpeedPicker(false);
              // Return to expanded player
              setTimeout(() => setIsPlayerExpanded(true), 100);
            }}
            activeOpacity={1}
          >
            <View style={styles.pickerContent} onStartShouldSetResponder={() => true}>
              <Text style={styles.pickerTitle}>{t('modules.podcast.playbackSpeedTitle')}</Text>
              {PLAYBACK_RATES.map((rate) => (
                <TouchableOpacity
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
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Sleep Timer Picker Modal */}
        <Modal
          visible={showSleepTimerPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowSleepTimerPicker(false);
            // Return to expanded player
            setTimeout(() => setIsPlayerExpanded(true), 100);
          }}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            onPress={() => {
              setShowSleepTimerPicker(false);
              // Return to expanded player
              setTimeout(() => setIsPlayerExpanded(true), 100);
            }}
            activeOpacity={1}
          >
            <View style={styles.pickerContent} onStartShouldSetResponder={() => true}>
              <Text style={styles.pickerTitle}>{t('modules.podcast.sleepTimerTitle')}</Text>
              {sleepTimerMinutes && (
                <TouchableOpacity
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
                </TouchableOpacity>
              )}
              {SLEEP_TIMER_OPTIONS.map((minutes) => (
                <TouchableOpacity
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
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Welcome Modal */}
        <Modal
          visible={showWelcomeModal}
          transparent={true}
          animationType={isReducedMotion ? 'none' : 'fade'}
          onRequestClose={() => {
            setShowWelcomeModal(false);
            setShowSubscriptions(false);
          }}
          accessibilityViewIsModal={true}
        >
          <View style={styles.welcomeOverlay}>
            <View style={styles.welcomeContent}>
              <View style={styles.welcomeHeader}>
                <Icon name="podcast" size={48} color={accentColor.primary} />
                <Text style={styles.welcomeTitle}>{t('modules.podcast.welcomeTitle')}</Text>
              </View>

              <Text style={styles.welcomeText}>{t('modules.podcast.welcomeText')}</Text>

              <View style={styles.welcomeStep}>
                <View style={styles.welcomeStepNumber}>
                  <Text style={styles.welcomeStepNumberText}>1</Text>
                </View>
                <Text style={styles.welcomeStepText}>{t('modules.podcast.welcomeStep1')}</Text>
              </View>

              <View style={styles.welcomeStep}>
                <View style={styles.welcomeStepNumber}>
                  <Text style={styles.welcomeStepNumberText}>2</Text>
                </View>
                <View style={styles.welcomeStepContent}>
                  <Text style={styles.welcomeStepText}>{t('modules.podcast.welcomeStep2')}</Text>
                  <Icon name="heart" size={24} color={accentColor.primary} style={styles.welcomeStepIcon} />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.welcomeButton, { backgroundColor: accentColor.primary }]}
                onPress={() => {
                  triggerFeedback('tap');
                  setShowWelcomeModal(false);
                  setShowSubscriptions(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('modules.podcast.welcomeButton')}
              >
                <Icon name="search" size={24} color={colors.textOnPrimary} />
                <Text style={styles.welcomeButtonText}>{t('modules.podcast.welcomeButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Continue Listening Dialog */}
        <Modal
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
            <View style={styles.continueListeningContent}>
              {continueListeningEpisode && continueListeningShow && (
                <>
                  {/* Episode artwork */}
                  {(continueListeningEpisode.artwork || continueListeningShow.artwork) && (
                    <Image
                      source={{ uri: continueListeningEpisode.artwork || continueListeningShow.artwork }}
                      style={styles.continueListeningArtwork}
                    />
                  )}

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
                    <TouchableOpacity
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
                    </TouchableOpacity>

                    {/* No - Show episodes */}
                    <TouchableOpacity
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
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Next Episode Dialog — shown when current episode ends and there's a next one */}
        <Modal
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
            <View style={styles.nextEpisodeContent}>
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
                  {(nextEpisodeInfo.nextEpisode.artwork || nextEpisodeInfo.show.artwork) && (
                    <Image
                      source={{ uri: nextEpisodeInfo.nextEpisode.artwork || nextEpisodeInfo.show.artwork }}
                      style={styles.nextEpisodeArtwork}
                    />
                  )}

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
                    <TouchableOpacity
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
                    </TouchableOpacity>

                    {/* No - Stop and go to main menu */}
                    <TouchableOpacity
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
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Voice hint */}
        {isVoiceSessionActive && (
          <View style={styles.voiceHint}>
            <Text style={styles.voiceHintText}>{t('modules.podcast.voiceHint')}</Text>
          </View>
        )}
      </View>
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
  innerContainer: {
    flex: 1,
  },
  // moduleHeader styles removed — using standardized ModuleHeader component
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
  },
  searchContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    minHeight: touchTargets.minimum,
  },
  searchButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countrySelector: {
    marginTop: spacing.md,
  },
  filterLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  countryScrollContent: {
    paddingRight: spacing.md,
    gap: spacing.xs,
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: touchTargets.minimum,
  },
  countryChipText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  countryChipTextActive: {
    color: colors.textOnPrimary,
  },
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
    minHeight: 44,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
  },
  errorMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  retryButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
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
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
    marginTop: spacing.md,
  },
  emptyActionButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
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
  showArtworkPlaceholder: {
    backgroundColor: PODCAST_MODULE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  showDetailModal: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    marginTop: 60,
    paddingHorizontal: spacing.md,
  },
  showDetailHeader: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
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
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    marginTop: spacing.md,
    minHeight: 44,
  },
  subscribeButtonActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  subscribeButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
  subscribeButtonTextActive: {
    color: colors.textOnPrimary,
  },
  episodesTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  episodeList: {
    flex: 1,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    minHeight: touchTargets.minimum,
  },
  closeButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  // Expanded Player
  expandedPlayerOverlay: {
    flex: 1,
    backgroundColor: colors.background,
  },
  expandedPlayerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  expandedArtworkContainer: {
    marginBottom: spacing.xl,
    // Shadow properties on container (elevation not valid on Image)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  expandedArtwork: {
    width: 240,
    height: 240,
    borderRadius: borderRadius.lg,
  },
  expandedArtworkPlaceholder: {
    backgroundColor: PODCAST_MODULE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedArtworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  expandedInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    width: '100%',
  },
  expandedShowTitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  expandedEpisodeTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  progressSection: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.sm,
  },
  progressTime: {
    ...typography.small,
    color: colors.textSecondary,
  },
  expandedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  secondaryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: touchTargets.minimum,
    height: touchTargets.minimum,
  },
  skipButtonText: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  mainPlayButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  bufferingText: {
    ...typography.small,
    color: colors.textTertiary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  expandedCloseContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  minimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: touchTargets.minimum,
    minWidth: 160,
  },
  minimizeButtonText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
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
  // Welcome Modal
  welcomeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  welcomeContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    maxWidth: 400,
    width: '100%',
  },
  welcomeHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  welcomeTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
  },
  welcomeText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 26,
  },
  welcomeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  welcomeStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeStepNumberText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  welcomeStepContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  welcomeStepText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  welcomeStepIcon: {
    marginLeft: spacing.xs,
  },
  welcomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
    marginTop: spacing.lg,
  },
  welcomeButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
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
