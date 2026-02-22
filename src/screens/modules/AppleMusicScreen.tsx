/**
 * AppleMusicScreen — Apple Music integration module
 *
 * Senior-inclusive Apple Music player with:
 * - Search and discover music (iOS only)
 * - Library access and playback (iOS only)
 * - Large touch targets (60pt+)
 * - VoiceFocusable song lists
 * - Android: App detection with Play Store / Open App buttons
 *
 * Voice commands supported:
 * - "speel" / "play" — Play selected song
 * - "pauze" / "pause" — Pause playback
 * - "stop" — Stop playback
 * - "volgende" / "next" — Next track
 * - "vorige" / "previous" — Previous track
 * - "[song name]" — Focus on song
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
  Platform,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import {
  Icon,
  IconButton,
  VoiceFocusable,
  MiniPlayer,
  ExpandedAudioPlayer,
  ModuleHeader,
  FavoriteTabButton,
  SearchTabButton,
  SearchBar,
  type SearchBarRef,
} from '@/components';
import { useVoiceFocusList, useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import { useHoldGestureContextSafe } from '@/contexts/HoldGestureContext';
import {
  useAppleMusicContext,
  type AppleMusicSong,
  type AppleMusicAlbum,
  type AppleMusicPlaylist,
  type SearchResults,
} from '@/contexts/AppleMusicContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';
import { useGlassPlayer } from '@/hooks/useGlassPlayer';

// ============================================================
// Constants
// ============================================================

const APPLE_MUSIC_COLOR = '#FC3C44';
const SEARCH_MAX_LENGTH = 100;

// Layout constants for overlay positioning
const MODULE_HEADER_HEIGHT = 120;
const MINI_PLAYER_HEIGHT = 84;

// ============================================================
// Types
// ============================================================

type TabType = 'search' | 'library' | 'playlists';

// ============================================================
// Component
// ============================================================

export function AppleMusicScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { accentColor } = useAccentColor();
  const { isVoiceSessionActive } = useVoiceFocusContext();
  const holdGesture = useHoldGestureContextSafe();
  const isReducedMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();

  // Apple Music Context
  const {
    authStatus,
    isAuthorized,
    capabilities,
    requestAuthorization,
    openPlayStore,
    openAppleMusicApp,
    // Playback
    isPlaying,
    isLoading: isPlaybackLoading,
    nowPlaying: currentSong,
    playbackState,
    shuffleMode,
    repeatMode,
    // Controls
    playSong,
    pause,
    resume,
    stop,
    skipToNext,
    skipToPrevious,
    setShuffleMode,
    setRepeatMode,
    // Search
    searchCatalog,
  } = useAppleMusicContext();

  // Local search state (context returns Promise, we manage state here)
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // State
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Check if platform supports full functionality
  const hasFullSupport = capabilities?.hasMusicKit && capabilities?.canPlayback;
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';

  // ============================================================
  // Glass Player (iOS 26+ native Liquid Glass player)
  // ============================================================

  const {
    isAvailable: isGlassPlayerAvailable,
    isCheckingAvailability: isCheckingGlassPlayerAvailability,
    isVisible: isGlassPlayerVisible,
    isExpanded: isGlassPlayerExpanded,
    showMiniPlayer: showGlassMiniPlayer,
    expandToFull: expandGlassPlayer,
    collapseToMini: collapseGlassPlayer,
    hide: hideGlassPlayer,
    updateContent: updateGlassContent,
    updatePlaybackState: updateGlassPlaybackState,
    configureControls: configureGlassControls,
  } = useGlassPlayer({
    onPlayPause: async () => {
      if (isPlaying) {
        await pause();
      } else {
        await resume();
      }
    },
    onStop: async () => {
      await stop();
    },
    onExpand: () => {
      setIsPlayerExpanded(true);
    },
    onCollapse: () => {
      setIsPlayerExpanded(false);
    },
    onClose: () => {
      setIsPlayerExpanded(false);
    },
    onSkipForward: async () => {
      await skipToNext();
    },
    onSkipBackward: async () => {
      await skipToPrevious();
    },
    onFavoriteToggle: () => {
      // Apple Music favorites not implemented yet
    },
    onSleepTimerSet: (minutes: number | null) => {
      // Sleep timer not implemented for Apple Music yet
    },
    onShuffleToggle: () => {
      // Toggle shuffle mode
      setShuffleMode(shuffleMode === 'off' ? 'songs' : 'off');
    },
    onRepeatToggle: () => {
      // Cycle through: off -> all -> one -> off
      const nextMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
      setRepeatMode(nextMode);
    },
  });

  // ============================================================
  // Glass Player Effects (iOS 26+ synchronization)
  // ============================================================

  // Effect 1: Show native mini player when song plays (iOS 26+ only)
  useEffect(() => {
    if (!isGlassPlayerAvailable || !currentSong || !isFocused) {
      return;
    }

    const artworkUrl = currentSong.artworkUrl?.startsWith('http')
      ? currentSong.artworkUrl.replace('{w}', '300').replace('{h}', '300')
      : null;

    // Configure controls for Apple Music (skip buttons, shuffle, repeat, etc.)
    configureGlassControls({
      seekSlider: true,
      skipButtons: true,
      speedControl: false,
      sleepTimer: true,
      favorite: true,
      stopButton: false,
      shuffle: true,
      repeat: true,
    });

    showGlassMiniPlayer({
      moduleId: 'appleMusic',
      tintColorHex: APPLE_MUSIC_COLOR,
      artwork: artworkUrl,
      title: currentSong.title,
      subtitle: currentSong.artistName,
      progressType: 'bar',
      progress: (playbackState?.currentTime ?? 0) / (playbackState?.duration || 1),
      showStopButton: false,
    });
  }, [isGlassPlayerAvailable, currentSong, isFocused, showGlassMiniPlayer, configureGlassControls]);

  // Effect 2: Update playback state when playing/paused changes
  useEffect(() => {
    if (!isGlassPlayerAvailable || !isGlassPlayerVisible) {
      return;
    }

    updateGlassPlaybackState({
      isPlaying,
      isLoading: isPlaybackLoading,
      isBuffering: false,
      progress: (playbackState?.currentTime ?? 0) / (playbackState?.duration || 1),
      position: playbackState?.currentTime ?? 0,
      duration: playbackState?.duration ?? 0,
      isFavorite: false,
      showStopButton: false,
    });
  }, [isGlassPlayerAvailable, isGlassPlayerVisible, isPlaying, isPlaybackLoading, playbackState, updateGlassPlaybackState]);

  // Effect 3: Update content when song/metadata changes
  useEffect(() => {
    if (!isGlassPlayerAvailable || !isGlassPlayerVisible || !currentSong) {
      return;
    }

    const artworkUrl = currentSong.artworkUrl?.startsWith('http')
      ? currentSong.artworkUrl.replace('{w}', '600').replace('{h}', '600')
      : null;

    updateGlassContent({
      artwork: artworkUrl,
      title: currentSong.title,
      subtitle: currentSong.artistName,
      progress: (playbackState?.currentTime ?? 0) / (playbackState?.duration || 1),
    });
  }, [isGlassPlayerAvailable, isGlassPlayerVisible, currentSong, playbackState?.currentTime, playbackState?.duration, updateGlassContent]);

  // Effect 4: Hide native player when navigating away
  useEffect(() => {
    if (!isFocused && isGlassPlayerAvailable && isGlassPlayerVisible) {
      hideGlassPlayer();
    }
  }, [isFocused, isGlassPlayerAvailable, isGlassPlayerVisible, hideGlassPlayer]);

  // Effect 5: Hide native player when song stops
  useEffect(() => {
    if (!currentSong && isGlassPlayerAvailable && isGlassPlayerVisible) {
      hideGlassPlayer();
    }
  }, [currentSong, isGlassPlayerAvailable, isGlassPlayerVisible, hideGlassPlayer]);

  // Effect 6: Re-show native player when navigating back to screen with active playback
  useEffect(() => {
    if (isFocused && isGlassPlayerAvailable && currentSong && !isGlassPlayerVisible) {
      console.debug('[AppleMusicScreen] Re-showing Glass Player after navigation');

      const artworkUrl = currentSong.artworkUrl?.startsWith('http')
        ? currentSong.artworkUrl.replace('{w}', '300').replace('{h}', '300')
        : null;

      // Configure controls for Apple Music
      configureGlassControls({
        seekSlider: true,
        skipButtons: true,
        speedControl: false,
        sleepTimer: true,
        favorite: true,
        stopButton: false,
        shuffle: true,
        repeat: true,
      });

      showGlassMiniPlayer({
        moduleId: 'appleMusic',
        tintColorHex: APPLE_MUSIC_COLOR,
        artwork: artworkUrl,
        title: currentSong.title,
        subtitle: currentSong.artistName,
        progressType: 'bar',
        progress: (playbackState?.currentTime ?? 0) / (playbackState?.duration || 1),
        showStopButton: false,
      });
    }
  }, [isFocused, isGlassPlayerAvailable, isGlassPlayerVisible, currentSong, playbackState, showGlassMiniPlayer, configureGlassControls]);

  // ============================================================
  // Handlers
  // ============================================================

  const handleSearch = useCallback(async () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      console.log('[AppleMusicScreen] Searching for:', trimmedQuery);
      const results = await searchCatalog(trimmedQuery);
      console.log('[AppleMusicScreen] Search results:', {
        songs: results.songs?.length ?? 0,
        albums: results.albums?.length ?? 0,
        artists: results.artists?.length ?? 0,
        playlists: results.playlists?.length ?? 0,
      });
      setSearchResults(results);
    } catch (error) {
      console.error('[AppleMusicScreen] Search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchCatalog]);

  const clearSearch = useCallback(() => {
    setSearchResults(null);
    setSearchError(null);
    setSearchQuery('');
  }, []);

  const handleAuthorize = useCallback(async () => {
    const success = await requestAuthorization();
    if (success) {
      setShowAuthModal(false);
    }
  }, [requestAuthorization]);

  const handlePlaySong = useCallback(async (song: AppleMusicSong) => {
    triggerFeedback('tap');
    try {
      console.log('[AppleMusicScreen] Playing song:', song.id, song.title);
      await playSong(song.id);
    } catch (error) {
      console.error('[AppleMusicScreen] Play song error:', error);
      Alert.alert(
        t('modules.appleMusic.playError.title'),
        t('modules.appleMusic.playError.message')
      );
    }
  }, [playSong, triggerFeedback, t]);

  const handlePlayPause = useCallback(() => {
    triggerFeedback('tap');
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume, triggerFeedback]);

  const handleOpenPlayStore = useCallback(async () => {
    triggerFeedback('tap');
    await openPlayStore();
  }, [openPlayStore, triggerFeedback]);

  const handleOpenAppleMusicApp = useCallback(async () => {
    triggerFeedback('tap');
    await openAppleMusicApp();
  }, [openAppleMusicApp, triggerFeedback]);

  // ============================================================
  // Voice Focus
  // ============================================================

  const voiceFocusItems = useMemo(() => {
    if (!isFocused || !searchResults?.songs) return [];
    return searchResults.songs.map((song, index) => ({
      id: song.id,
      label: `${song.title} ${song.artistName}`,
      index,
      onSelect: () => handlePlaySong(song),
    }));
  }, [isFocused, searchResults?.songs, handlePlaySong]);

  const { scrollRef } = useVoiceFocusList('apple-music-songs', voiceFocusItems);

  // ============================================================
  // Authorization Required Screen (iOS)
  // ============================================================

  const renderAuthRequired = () => (
    <View style={styles.centeredContainer}>
      <Icon name="appleMusic" size={80} color={APPLE_MUSIC_COLOR} />
      <Text style={styles.authTitle}>{t('modules.appleMusic.authRequired.title')}</Text>
      <Text style={styles.authDescription}>
        {t('modules.appleMusic.authRequired.description')}
      </Text>
      <TouchableOpacity
        style={[styles.authButton, { backgroundColor: APPLE_MUSIC_COLOR }]}
        onPress={handleAuthorize}
        accessibilityRole="button"
        accessibilityLabel={t('modules.appleMusic.authRequired.button')}
      >
        <Text style={styles.authButtonText}>
          {t('modules.appleMusic.authRequired.button')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ============================================================
  // Android App Not Installed Screen
  // ============================================================

  const renderAndroidNotInstalled = () => (
    <View style={styles.centeredContainer}>
      <Icon name="appleMusic" size={80} color={APPLE_MUSIC_COLOR} />
      <Text style={styles.authTitle}>{t('modules.appleMusic.android.notInstalled.title')}</Text>
      <Text style={styles.authDescription}>
        {t('modules.appleMusic.android.notInstalled.description')}
      </Text>
      <TouchableOpacity
        style={[styles.authButton, { backgroundColor: APPLE_MUSIC_COLOR }]}
        onPress={handleOpenPlayStore}
        accessibilityRole="button"
        accessibilityLabel={t('modules.appleMusic.android.notInstalled.downloadButton')}
      >
        <Icon name="external-link" size={20} color={colors.white} />
        <Text style={styles.authButtonText}>
          {t('modules.appleMusic.android.notInstalled.downloadButton')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ============================================================
  // Android App Installed Screen
  // ============================================================

  const renderAndroidInstalled = () => (
    <View style={styles.centeredContainer}>
      <Icon name="appleMusic" size={80} color={APPLE_MUSIC_COLOR} />
      <Text style={styles.authTitle}>{t('modules.appleMusic.android.installed.title')}</Text>
      <Text style={styles.authDescription}>
        {t('modules.appleMusic.android.installed.description')}
      </Text>
      <TouchableOpacity
        style={[styles.authButton, { backgroundColor: APPLE_MUSIC_COLOR }]}
        onPress={handleOpenAppleMusicApp}
        accessibilityRole="button"
        accessibilityLabel={t('modules.appleMusic.android.installed.openButton')}
      >
        <Icon name="external-link" size={20} color={colors.white} />
        <Text style={styles.authButtonText}>
          {t('modules.appleMusic.android.installed.openButton')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ============================================================
  // Search Tab Content
  // ============================================================

  const renderSearchTab = () => (
    <View style={styles.tabContent}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmit={handleSearch}
        placeholder={t('modules.appleMusic.search.placeholder')}
        searchButtonLabel={t('modules.appleMusic.search.button')}
        maxLength={SEARCH_MAX_LENGTH}
      />

      {isSearching && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={APPLE_MUSIC_COLOR} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      )}

      {searchError && (
        <View style={styles.errorBanner}>
          <Icon name="warning" size={24} color={colors.error} />
          <Text style={styles.errorText}>{t('modules.appleMusic.search.error')}</Text>
          <TouchableOpacity onPress={clearSearch}>
            <Text style={styles.errorDismiss}>{t('common.dismiss')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {searchResults?.songs && searchResults.songs.length > 0 && (
        <ScrollView
          ref={scrollRef}
          style={styles.resultsList}
          contentContainerStyle={styles.resultsContent}
        >
          <Text style={styles.sectionTitle}>
            {t('modules.appleMusic.search.songsTitle')}
          </Text>
          {searchResults?.songs?.map((song, index) => (
            <VoiceFocusable
              key={song.id}
              id={song.id}
              label={`${song.title} ${song.artistName}`}
              index={index}
              onSelect={() => handlePlaySong(song)}
            >
              <TouchableOpacity
                style={styles.songItem}
                onPress={() => handlePlaySong(song)}
                onLongPress={() => {}}
                delayLongPress={300}
                accessibilityRole="button"
                accessibilityLabel={`${song.title} ${t('common.by')} ${song.artistName}`}
              >
                {song.artworkUrl && song.artworkUrl.startsWith('http') ? (
                  <Image
                    source={{ uri: song.artworkUrl.replace('{w}', '60').replace('{h}', '60') }}
                    style={styles.songArtwork}
                  />
                ) : (
                  <View style={[styles.songArtwork, styles.songArtworkPlaceholder]}>
                    <Icon name="appleMusic" size={24} color={colors.textSecondary} />
                  </View>
                )}
                <View style={styles.songInfo}>
                  <Text style={styles.songTitle} numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text style={styles.songArtist} numberOfLines={1}>
                    {song.artistName}
                  </Text>
                </View>
                <IconButton
                  icon="play"
                  size={40}
                  onPress={() => handlePlaySong(song)}
                  accessibilityLabel={t('modules.appleMusic.play', { title: song.title })}
                />
              </TouchableOpacity>
            </VoiceFocusable>
          ))}
        </ScrollView>
      )}

      {!isSearching && !searchResults?.songs?.length && searchQuery && (
        <View style={styles.emptyState}>
          <Icon name="search" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyStateText}>
            {t('modules.appleMusic.search.noResults')}
          </Text>
        </View>
      )}
    </View>
  );

  // ============================================================
  // Library Tab Content
  // ============================================================

  const renderLibraryTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.emptyState}>
        <Icon name="appleMusic" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyStateText}>
          {t('modules.appleMusic.library.comingSoon')}
        </Text>
      </View>
    </View>
  );

  // ============================================================
  // Playlists Tab Content
  // ============================================================

  const renderPlaylistsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.emptyState}>
        <Icon name="list" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyStateText}>
          {t('modules.appleMusic.playlists.comingSoon')}
        </Text>
      </View>
    </View>
  );

  // ============================================================
  // Main iOS Content
  // ============================================================

  const renderIOSContent = () => {
    // Not authorized
    if (authStatus !== 'authorized') {
      return renderAuthRequired();
    }

    return (
      <View style={styles.mainContent}>
        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'search' && styles.tabActive]}
            onPress={() => setActiveTab('search')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'search' }}
          >
            <Icon
              name="search"
              size={20}
              color={activeTab === 'search' ? APPLE_MUSIC_COLOR : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'search' && { color: APPLE_MUSIC_COLOR },
              ]}
            >
              {t('modules.appleMusic.tabs.search')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'library' && styles.tabActive]}
            onPress={() => setActiveTab('library')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'library' }}
          >
            <Icon
              name="appleMusic"
              size={20}
              color={activeTab === 'library' ? APPLE_MUSIC_COLOR : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'library' && { color: APPLE_MUSIC_COLOR },
              ]}
            >
              {t('modules.appleMusic.tabs.library')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'playlists' && styles.tabActive]}
            onPress={() => setActiveTab('playlists')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'playlists' }}
          >
            <Icon
              name="list"
              size={20}
              color={activeTab === 'playlists' ? APPLE_MUSIC_COLOR : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'playlists' && { color: APPLE_MUSIC_COLOR },
              ]}
            >
              {t('modules.appleMusic.tabs.playlists')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'search' && renderSearchTab()}
        {activeTab === 'library' && renderLibraryTab()}
        {activeTab === 'playlists' && renderPlaylistsTab()}
      </View>
    );
  };

  // ============================================================
  // Render
  // ============================================================

  // Determine if we should show the React Native MiniPlayer
  // Only show RN player when Glass Player is NOT available (iOS <26 or Android)
  const shouldShowRNMiniPlayer =
    !isCheckingGlassPlayerAvailability &&
    !isGlassPlayerAvailable &&
    currentSong &&
    !isPlayerExpanded;

  // Calculate bottom padding - Glass Player handles its own spacing
  const bottomPadding = shouldShowRNMiniPlayer
    ? MINI_PLAYER_HEIGHT + spacing.md
    : spacing.md;

  return (
    <View style={styles.container}>
      <ModuleHeader
        moduleId="appleMusic"
        icon="appleMusic"
        title={t('modules.appleMusic.title')}
        showAdMob={true}
      />

      <View style={[styles.content, { paddingBottom: bottomPadding + insets.bottom }]}>
        {/* Android: Show app detection UI */}
        {isAndroid && (
          authStatus === 'app_installed'
            ? renderAndroidInstalled()
            : renderAndroidNotInstalled()
        )}

        {/* iOS: Show full functionality */}
        {!isAndroid && renderIOSContent()}
      </View>

      {/* Mini Player (iOS <26 / Android fallback)
          On iOS 26+, the native GlassPlayerWindow handles this */}
      {shouldShowRNMiniPlayer && (
        <MiniPlayer
          moduleId="appleMusic"
          artwork={currentSong.artworkUrl?.startsWith('http') ? currentSong.artworkUrl.replace('{w}', '120').replace('{h}', '120') : null}
          title={currentSong.title}
          subtitle={currentSong.artistName}
          accentColor={APPLE_MUSIC_COLOR}
          isPlaying={isPlaying}
          isLoading={isPlaybackLoading}
          progressType="bar"
          progress={(playbackState?.currentTime ?? 0) / (playbackState?.duration || 1)}
          onPress={() => setIsPlayerExpanded(true)}
          onPlayPause={handlePlayPause}
          style={styles.miniPlayer}
        />
      )}

      {/* Expanded Player (iOS <26 / Android fallback)
          On iOS 26+, the native GlassPlayerWindow handles this */}
      {!isAndroid && !isGlassPlayerExpanded && (
        <ExpandedAudioPlayer
          visible={isPlayerExpanded}
          moduleId="appleMusic"
          artwork={currentSong?.artworkUrl?.startsWith('http') ? currentSong.artworkUrl.replace('{w}', '600').replace('{h}', '600') : null}
          title={currentSong?.title || ''}
          subtitle={currentSong?.artistName}
          accentColor={APPLE_MUSIC_COLOR}
          isPlaying={isPlaying}
          isLoading={isPlaybackLoading}
          isBuffering={false}
          position={playbackState?.currentTime ?? 0}
          duration={playbackState?.duration ?? 0}
          onSeek={() => {}}
          onPlayPause={handlePlayPause}
          onClose={() => setIsPlayerExpanded(false)}
          showAdMob={true}
          controls={{
            seekSlider: true,
            skipButtons: true,
            speedControl: false,
            sleepTimer: true,
            favorite: true,
            shuffle: true,
            repeat: true,
          }}
          onSkipBackward={skipToPrevious}
          onSkipForward={skipToNext}
          shuffleMode={shuffleMode}
          onShufflePress={() => setShuffleMode(shuffleMode === 'off' ? 'songs' : 'off')}
          repeatMode={repeatMode}
          onRepeatPress={() => {
            // Cycle through: off -> all -> one -> off
            const nextMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
            setRepeatMode(nextMode);
          }}
        />
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
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  miniPlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  // Centered container (auth, android screens)
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  authTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  authDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    minHeight: touchTargets.comfortable,
  },
  authButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: APPLE_MUSIC_COLOR,
  },
  tabText: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // Tab content
  tabContent: {
    flex: 1,
    padding: spacing.md,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    flex: 1,
  },
  errorDismiss: {
    ...typography.label,
    color: colors.error,
    fontWeight: '600',
  },

  // Results list
  resultsList: {
    flex: 1,
  },
  resultsContent: {
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  // Song item
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    minHeight: touchTargets.comfortable,
  },
  songArtwork: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
  },
  songArtworkPlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  songArtist: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
