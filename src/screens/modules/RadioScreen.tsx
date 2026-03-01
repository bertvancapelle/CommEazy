/**
 * RadioScreen — Internet radio streaming module
 *
 * Senior-inclusive radio player with:
 * - Country-based station search (default from user profile)
 * - Favorites (max 10 stations)
 * - Background playback with voice control integration
 * - Large touch targets (60pt+)
 * - VoiceFocusable station list
 *
 * Voice commands supported:
 * - "speel" / "play" — Play selected station
 * - "pauze" / "pause" — Pause playback
 * - "stop" — Stop playback
 * - "volgende" / "vorige" — Navigate station list
 * - "[station name]" — Focus on station
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
import { Icon, IconButton, VoiceFocusable, PlayingWaveIcon, MiniPlayer, ModuleHeader, SearchBar, ChipSelector, PanelAwareModal, type SearchBarRef, type FilterMode } from '@/components';
import { useVoiceFocusList, useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import { useHoldGestureContextSafe } from '@/contexts/HoldGestureContext';
import { useColors } from '@/contexts/ThemeContext';
import { useRadioContext, type RadioStation as RadioContextStation } from '@/contexts/RadioContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { usePanelId } from '@/contexts/PanelIdContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';
import { useGlassPlayer } from '@/hooks/useGlassPlayer';
import { useSleepTimer } from '@/hooks/useSleepTimer';
import { ServiceContainer } from '@/services/container';
import { COUNTRIES, LANGUAGES } from '@/constants/demographics';

// ============================================================
// Types
// ============================================================

interface RadioStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  country: string;
  countrycode: string;
  state: string;
  language: string;
  tags: string;
  votes: number;
  codec: string;
  bitrate: number;
}

interface FavoriteStation {
  id: string;
  name: string;
  streamUrl: string;
  country: string;
  countryCode: string;
  favicon: string;
  addedAt: number;
}

// ============================================================
// Radio Browser API Service
// ============================================================

const RADIO_BROWSER_API = 'https://de1.api.radio-browser.info/json';
const API_TIMEOUT_MS = 10000; // 10 seconds timeout

// Layout constants for overlay positioning
// ModuleHeader height: icon row (44pt) + AdMob placeholder (50pt) + separator + padding
const MODULE_HEADER_HEIGHT = 120;
// MiniPlayer height: touchTargets.comfortable (72pt) + vertical padding
const MINI_PLAYER_HEIGHT = 84;

type ApiResult<T> = {
  data: T | null;
  error: 'network' | 'timeout' | 'server' | null;
};

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function searchStationsByCountry(
  countryCode: string,
  limit = 50
): Promise<ApiResult<RadioStation[]>> {
  try {
    const response = await fetchWithTimeout(
      `${RADIO_BROWSER_API}/stations/bycountrycodeexact/${countryCode}?limit=${limit}&order=votes&reverse=true&hidebroken=true`,
      API_TIMEOUT_MS
    );
    if (!response.ok) {
      console.error('[RadioScreen] API error:', response.status);
      return { data: null, error: 'server' };
    }
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('[RadioScreen] Failed to fetch stations:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'timeout' };
    }
    return { data: null, error: 'network' };
  }
}

// Map ISO 639-1 language codes to Radio Browser API language names
// Radio Browser uses full language names, not ISO codes
const LANGUAGE_CODE_TO_NAME: Record<string, string> = {
  nl: 'dutch',
  en: 'english',
  de: 'german',
  fr: 'french',
  es: 'spanish',
  it: 'italian',
  no: 'norwegian',
  sv: 'swedish',
  da: 'danish',
  pt: 'portuguese',
  pl: 'polish',
};

async function searchStationsByLanguage(
  languageCode: string,
  limit = 50
): Promise<ApiResult<RadioStation[]>> {
  // Convert ISO 639-1 code to Radio Browser language name
  const languageName = LANGUAGE_CODE_TO_NAME[languageCode.toLowerCase()] || languageCode;

  try {
    const response = await fetchWithTimeout(
      `${RADIO_BROWSER_API}/stations/bylanguageexact/${languageName}?limit=${limit}&order=votes&reverse=true&hidebroken=true`,
      API_TIMEOUT_MS
    );
    if (!response.ok) {
      console.error('[RadioScreen] API error:', response.status);
      return { data: null, error: 'server' };
    }
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('[RadioScreen] Failed to fetch stations by language:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'timeout' };
    }
    return { data: null, error: 'network' };
  }
}

async function searchStationsByName(
  name: string,
  countryCode?: string,
  languageCode?: string,
  limit = 30
): Promise<ApiResult<RadioStation[]>> {
  try {
    // Use /stations/search endpoint which supports name, countrycode, and language filtering
    let url = `${RADIO_BROWSER_API}/stations/search?name=${encodeURIComponent(name)}&limit=${limit}&order=votes&reverse=true&hidebroken=true`;
    if (countryCode) {
      url += `&countrycode=${countryCode}`;
    }
    if (languageCode) {
      url += `&language=${languageCode}`;
    }

    const response = await fetchWithTimeout(url, API_TIMEOUT_MS);
    if (!response.ok) {
      console.error('[RadioScreen] API error:', response.status);
      return { data: null, error: 'server' };
    }
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('[RadioScreen] Failed to search stations:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'timeout' };
    }
    return { data: null, error: 'network' };
  }
}

// ============================================================
// Constants
// ============================================================

const MAX_FAVORITES = 10;

// ============================================================
// Component
// ============================================================

// Search input max length
const SEARCH_MAX_LENGTH = 100;

export function RadioScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { accentColor } = useAccentColor();
  const radioModuleColor = useModuleColor('radio');  // User-customizable module color
  const panelId = usePanelId(); // null on iPhone, 'left'|'right' on iPad Split View
  const { isVoiceSessionActive } = useVoiceFocusContext();
  const holdGesture = useHoldGestureContextSafe();
  const isReducedMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();
  const themeColors = useColors();
  const searchInputRef = useRef<SearchBarRef>(null);

  // Radio Context for playback
  const {
    isPlaying,
    isLoading: isPlaybackLoading,
    isBuffering,
    currentStation: contextStation,
    metadata,
    playStation,
    play,
    pause,
    stop,
    position,
    setSleepTimerActive,
  } = useRadioContext();

  // Ref for position to avoid re-triggering Glass Player effects every second
  const positionRef = useRef(position);
  positionRef.current = position;

  // Sleep timer hook - shared logic for all audio modules
  const { setSleepTimer } = useSleepTimer({
    onTimerExpired: stop,
    setSleepTimerActive,
    moduleName: 'RadioScreen',
    enableTestMode: true, // Allow 0 minutes = 30 seconds for testing
  });

  // Glass Player for iOS 26+ Liquid Glass effect
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
    onClose: () => {
      // Native player closed
      setIsPlayerExpanded(false);
    },
    onFavoriteToggle: () => {
      // Toggle favorite for currently playing station
      if (contextStation) {
        const station = favorites.find(f => f.id === contextStation.id) ||
          stations.find(s => s.stationuuid === contextStation.id);
        if (station) {
          handleToggleFavorite(station);
        }
      }
    },
    onSleepTimerSet: setSleepTimer,
  });

  // Debug: Log Glass Player availability
  useEffect(() => {
    console.log('[RadioScreen] isCheckingGlassPlayerAvailability:', isCheckingGlassPlayerAvailability, 'isGlassPlayerAvailable:', isGlassPlayerAvailable);
  }, [isCheckingGlassPlayerAvailability, isGlassPlayerAvailable]);

  // State
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [favorites, setFavorites] = useState<FavoriteStation[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('NL');
  const [selectedLanguage, setSelectedLanguage] = useState('nl');
  const [filterMode, setFilterMode] = useState<FilterMode>('country');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<'network' | 'timeout' | 'server' | null>(null);
  // Default to Favorites tab — seniors want quick access to their saved stations
  const [showFavorites, setShowFavorites] = useState(true);
  // Popup shown when no favorites exist — explains how to find and save stations
  const [showNoFavoritesModal, setShowNoFavoritesModal] = useState(false);
  // Track if we've already shown the modal this session
  const hasShownModalRef = useRef(false);
  // Expanded player view — tap mini-player to expand
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  // Playback error state — shown when a stream fails to play
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Pulse animation for player artwork (when buffering)
  const [pulseAnim] = useState(new Animated.Value(1));

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

  // Close expanded player when music stops
  useEffect(() => {
    if (!contextStation) {
      setIsPlayerExpanded(false);
      // Also hide glass player when station stops
      if (isGlassPlayerAvailable && isGlassPlayerVisible) {
        hideGlassPlayer();
      }
    }
  }, [contextStation, isGlassPlayerAvailable, isGlassPlayerVisible, hideGlassPlayer]);

  // Hide Glass Player when navigating away from this screen
  // Reset expanded player state when returning — ensures MiniPlayer reappears
  useEffect(() => {
    if (!isFocused && isGlassPlayerAvailable && isGlassPlayerVisible) {
      // User navigated to another module — hide the mini player
      hideGlassPlayer();
    }
    if (isFocused && isPlayerExpanded) {
      // User returned to RadioScreen — collapse expanded player so MiniPlayer shows
      setIsPlayerExpanded(false);
    }
  }, [isFocused, isGlassPlayerAvailable, isGlassPlayerVisible, hideGlassPlayer, isPlayerExpanded]);

  // Show/update Glass Player when station is playing (iOS 26+)
  // Only show when this screen is focused
  useEffect(() => {
    if (!isGlassPlayerAvailable || !contextStation || !isFocused) {
      return;
    }

    // Configure full player controls for Radio module
    configureGlassControls({
      seekSlider: false,
      skipButtons: false,
      speedControl: false,
      sleepTimer: true,
      favorite: true,
      stopButton: true,
      shuffle: false,
      repeat: false,
    });

    // Show native glass mini player with user-customized module color
    showGlassMiniPlayer({
      moduleId: 'radio',
      tintColorHex: radioModuleColor,
      artwork: metadata.artwork || contextStation.favicon || null,
      title: contextStation.name,
      subtitle: isBuffering ? t('modules.radio.buffering') : metadata.title,
      progressType: 'duration',
      listenDuration: positionRef.current,
      showStopButton: true,
    });
  }, [
    isGlassPlayerAvailable,
    contextStation,
    metadata.artwork,
    metadata.title,
    showGlassMiniPlayer,
    configureGlassControls,
    isBuffering,
    isFocused,
    radioModuleColor,
    t,
  ]);

  // Update Glass Player playback state
  useEffect(() => {
    if (!isGlassPlayerAvailable || !isGlassPlayerVisible) {
      return;
    }

    // Check if current station is a favorite
    const currentIsFavorite = contextStation
      ? favorites.some(f => f.id === contextStation.id)
      : false;

    updateGlassPlaybackState({
      isPlaying,
      isLoading: isPlaybackLoading,
      isBuffering,
      isFavorite: currentIsFavorite,
      // For radio, we track listen duration, not progress
      listenDuration: positionRef.current,
    });
  }, [
    isGlassPlayerAvailable,
    isGlassPlayerVisible,
    isPlaying,
    isPlaybackLoading,
    isBuffering,
    updateGlassPlaybackState,
    contextStation,
    favorites,
  ]);

  // Update Glass Player content when metadata changes
  useEffect(() => {
    if (!isGlassPlayerAvailable || !isGlassPlayerVisible || !contextStation) {
      return;
    }

    updateGlassContent({
      tintColorHex: radioModuleColor,  // MUST include to prevent fallback to default color
      artwork: metadata.artwork || contextStation.favicon || null,
      title: contextStation.name,
      subtitle: isBuffering ? t('modules.radio.buffering') : metadata.title,
      listenDuration: positionRef.current,
      showStopButton: true,  // Single source of truth for stop button visibility
    });
  }, [
    isGlassPlayerAvailable,
    isGlassPlayerVisible,
    contextStation,
    metadata.artwork,
    metadata.title,
    isBuffering,
    radioModuleColor,
    t,
    updateGlassContent,
  ]);

  // Periodic Glass Player position update (every 5s instead of every 1s via deps)
  useEffect(() => {
    if (!isGlassPlayerAvailable || !isGlassPlayerVisible || !isPlaying) {
      return;
    }

    const interval = setInterval(() => {
      updateGlassPlaybackState({
        isPlaying: true,
        isLoading: false,
        isBuffering: false,
        listenDuration: positionRef.current,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isGlassPlayerAvailable, isGlassPlayerVisible, isPlaying, updateGlassPlaybackState]);

  // Listen for playback errors from RadioContext
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'radioPlaybackError',
      (error: { error?: string; message?: string }) => {
        console.log('[RadioScreen] Received playback error:', error);

        // Show error alert to user
        const stationName = contextStation?.name || t('modules.radio.unknownStation');

        // Trigger error haptic feedback
        triggerFeedback('error');

        // Set error state to show in UI
        setPlaybackError(stationName);

        // Close expanded player on error
        setIsPlayerExpanded(false);

        // Announce error for accessibility
        AccessibilityInfo.announceForAccessibility(
          t('modules.radio.playbackError')
        );
      }
    );

    return () => subscription.remove();
  }, [contextStation, t, triggerFeedback]);

  // Clear playback error when a new station starts playing
  useEffect(() => {
    if (isPlaying) {
      setPlaybackError(null);
    }
  }, [isPlaying]);

  // Load user's default country and language from profile
  // Re-runs when screen gains focus (e.g., after changing profile settings)
  useEffect(() => {
    if (!isFocused) return; // Only load when screen is focused

    const loadUserDefaults = async () => {
      try {
        if (ServiceContainer.isInitialized) {
          const profile = await ServiceContainer.database.getUserProfile();
          if (profile) {
            // Set default country from profile (e.g., Belgian user sees Belgium as default)
            if (profile.countryCode) {
              const countryExists = COUNTRIES.some(c => c.code === profile.countryCode);
              if (countryExists) {
                setSelectedCountry(profile.countryCode);
              }
            }
            // Set default language from profile (e.g., French-speaking Belgian sees French as default)
            if (profile.language) {
              const languageExists = LANGUAGES.some(l => l.code === profile.language);
              if (languageExists) {
                setSelectedLanguage(profile.language);
              }
            }
          }
        }
      } catch (error) {
        console.error('[RadioScreen] Failed to load user defaults:', error);
      }
    };
    loadUserDefaults();
  }, [isFocused]);

  // Load favorites from storage
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        if (ServiceContainer.isInitialized) {
          const profile = await ServiceContainer.database.getUserProfile();
          if (profile?.radioFavorites && profile.radioFavorites.length > 0) {
            setFavorites(profile.radioFavorites);
          } else {
            // No favorites yet — switch to Search tab and auto-search with default country (NL)
            // This is more user-friendly than showing a modal asking to search
            if (!hasShownModalRef.current) {
              hasShownModalRef.current = true;
              setShowFavorites(false); // Switch to Search tab
              // selectedCountry defaults to 'NL', loadStations will trigger via useEffect
            }
          }
        } else {
          // Database not initialized — switch to Search tab with default country (NL)
          if (!hasShownModalRef.current) {
            hasShownModalRef.current = true;
            setShowFavorites(false); // Switch to Search tab
          }
        }
      } catch (error) {
        console.error('[RadioScreen] Failed to load favorites:', error);
      }
    };
    loadFavorites();
  }, []);

  // Note: In-app audio playback disabled until react-native-track-player is configured
  // Currently opens stream in external player (Safari)

  // Search stations when filter changes (country or language)
  useEffect(() => {
    if (!searchQuery) {
      loadStations();
    }
  }, [selectedCountry, selectedLanguage, filterMode]);

  // Handle filter mode change — reset to appropriate default
  const handleFilterModeChange = useCallback((newMode: FilterMode) => {
    setFilterMode(newMode);
    setSearchQuery(''); // Clear search when switching modes
    // No need to manually trigger load — useEffect will handle it
  }, []);

  // Handle country selection
  const handleCountryChange = useCallback((code: string) => {
    setSelectedCountry(code);
    setSearchQuery(''); // Clear search when changing filter
  }, []);

  // Handle language selection
  const handleLanguageChange = useCallback((code: string) => {
    setSelectedLanguage(code);
    setSearchQuery(''); // Clear search when changing filter
  }, []);

  const loadStations = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);

    let result: ApiResult<RadioStation[]>;

    if (filterMode === 'country') {
      result = await searchStationsByCountry(selectedCountry);
    } else {
      result = await searchStationsByLanguage(selectedLanguage);
    }

    if (result.error) {
      setApiError(result.error);
      setStations([]);
      // Error feedback for failed API call
      await triggerFeedback('error');
      AccessibilityInfo.announceForAccessibility(
        t(`modules.radio.errors.${result.error}`)
      );
    } else {
      setStations(result.data ?? []);
    }
    setIsLoading(false);
  }, [selectedCountry, selectedLanguage, filterMode, triggerFeedback, t]);

  const handleSearch = useCallback(async () => {
    console.info('[RadioScreen] handleSearch called, searchQuery:', searchQuery);
    if (!searchQuery.trim()) {
      loadStations();
      return;
    }
    setIsLoading(true);
    setApiError(null);

    // Pass appropriate filter based on mode
    const result = await searchStationsByName(
      searchQuery,
      filterMode === 'country' ? selectedCountry : undefined,
      filterMode === 'language' ? selectedLanguage : undefined
    );

    if (result.error) {
      setApiError(result.error);
      setStations([]);
      // Error feedback for failed search
      await triggerFeedback('error');
      AccessibilityInfo.announceForAccessibility(
        t(`modules.radio.errors.${result.error}`)
      );
    } else {
      setStations(result.data ?? []);
    }
    setIsLoading(false);
  }, [searchQuery, selectedCountry, selectedLanguage, filterMode, loadStations, triggerFeedback, t]);

  // Debounced search — automatically search 500ms after user stops typing
  useEffect(() => {
    // Don't auto-search when showing favorites
    if (showFavorites) return;

    // If search query is empty, load default stations immediately
    if (!searchQuery.trim()) {
      loadStations();
      return;
    }

    // Debounce: wait 500ms after user stops typing
    const timeoutId = setTimeout(() => {
      console.info('[RadioScreen] Debounced search triggered for:', searchQuery);
      handleSearch();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, showFavorites, loadStations, handleSearch]);

  // Convert RadioScreen station to RadioContext station format
  const toContextStation = useCallback((station: RadioStation | FavoriteStation): RadioContextStation => {
    return {
      id: 'stationuuid' in station ? station.stationuuid : station.id,
      name: station.name,
      streamUrl: 'url_resolved' in station
        ? station.url_resolved || station.url
        : station.streamUrl,
      country: station.country,
      countryCode: 'countrycode' in station ? station.countrycode : station.countryCode,
      favicon: 'favicon' in station ? station.favicon : undefined,
    };
  }, []);

  // Handle station selection — plays via RadioContext
  const handleSelectStation = useCallback(async (station: RadioStation | FavoriteStation) => {
    // CRITICAL: Block onPress if a hold gesture was just completed (opens menu/voice)
    // This prevents the station from playing when user is trying to use hold-to-navigate
    if (holdGesture?.isGestureConsumed()) {
      console.log('[RadioScreen] Station press blocked - hold gesture was consumed');
      return;
    }

    // Combined haptic + audio feedback (accessibility requirement)
    triggerFeedback('tap');

    const stationId = 'stationuuid' in station ? station.stationuuid : station.id;
    console.log('[RadioScreen] handleSelectStation called for:', station.name);

    // If this station is already playing, just restore the mini player (don't restart)
    if (contextStation && contextStation.id === stationId && isPlaying) {
      console.log('[RadioScreen] Station already playing, restoring mini player');
      await showGlassFromMinimized();
      triggerFeedback('success');
      return;
    }

    // Convert to context format and play
    const converted = toContextStation(station);
    await playStation(converted);

    // Success feedback
    triggerFeedback('success');
  }, [holdGesture, playStation, toContextStation, triggerFeedback, contextStation, isPlaying, showGlassFromMinimized]);

  // Favorites management
  const isFavorite = useCallback((station: RadioStation | FavoriteStation) => {
    const id = 'stationuuid' in station ? station.stationuuid : station.id;
    return favorites.some(f => f.id === id);
  }, [favorites]);

  // Internal function to actually remove a favorite (called after confirmation)
  const removeFavorite = useCallback(async (stationId: string, stationName: string) => {
    const newFavorites = favorites.filter(f => f.id !== stationId);
    setFavorites(newFavorites);

    AccessibilityInfo.announceForAccessibility(
      t('modules.radio.removedFromFavorites', { station: stationName })
    );

    // Persist to database
    try {
      if (ServiceContainer.isInitialized) {
        const profile = await ServiceContainer.database.getUserProfile();
        if (profile) {
          await ServiceContainer.database.saveUserProfile({
            ...profile,
            radioFavorites: newFavorites,
          });
        }
      }
    } catch (error) {
      console.error('[RadioScreen] Failed to save favorites:', error);
    }
  }, [favorites, t]);

  // Internal function to add a favorite
  const addFavorite = useCallback(async (station: RadioStation | FavoriteStation) => {
    if (favorites.length >= MAX_FAVORITES) {
      AccessibilityInfo.announceForAccessibility(
        t('modules.radio.maxFavoritesReached', { max: MAX_FAVORITES })
      );
      return;
    }

    const newFavorite: FavoriteStation = {
      id: 'stationuuid' in station ? station.stationuuid : station.id,
      name: station.name,
      streamUrl: 'url_resolved' in station ? station.url_resolved || station.url : station.streamUrl,
      country: station.country,
      countryCode: 'countrycode' in station ? station.countrycode : station.countryCode,
      favicon: 'favicon' in station ? station.favicon : '',
      addedAt: Date.now(),
    };

    const newFavorites = [...favorites, newFavorite];
    setFavorites(newFavorites);

    AccessibilityInfo.announceForAccessibility(
      t('modules.radio.addedToFavorites', { station: station.name })
    );

    // Persist to database
    try {
      if (ServiceContainer.isInitialized) {
        const profile = await ServiceContainer.database.getUserProfile();
        if (profile) {
          await ServiceContainer.database.saveUserProfile({
            ...profile,
            radioFavorites: newFavorites,
          });
        }
      }
    } catch (error) {
      console.error('[RadioScreen] Failed to save favorites:', error);
    }
  }, [favorites, t]);

  const handleToggleFavorite = useCallback(async (station: RadioStation | FavoriteStation) => {
    const id = 'stationuuid' in station ? station.stationuuid : station.id;
    const isCurrentlyFavorite = favorites.some(f => f.id === id);

    if (isCurrentlyFavorite) {
      // Show confirmation dialog before removing from favorites
      // This is important for seniors who may accidentally tap
      Alert.alert(
        t('modules.radio.removeFavoriteTitle'),
        t('modules.radio.removeFavoriteMessage', { name: station.name }),
        [
          {
            text: t('common.no'),
            style: 'cancel',
          },
          {
            text: t('common.yes'),
            style: 'destructive',
            onPress: () => removeFavorite(id, station.name),
          },
        ]
      );
    } else {
      // Add directly without confirmation
      await addFavorite(station);
    }
  }, [favorites, t, removeFavorite, addFavorite]);

  // Voice focus for station list
  // Sort stations so currently playing station appears at the top
  const displayedStations = useMemo(() => {
    const baseList = showFavorites ? favorites : stations;
    if (!contextStation) return baseList;

    // Find the currently playing station and move it to the top
    const currentStationId = contextStation.id;
    const playingStation = baseList.find((s) => {
      const id = 'stationuuid' in s ? s.stationuuid : s.id;
      return id === currentStationId;
    });

    if (!playingStation) return baseList;

    // Put playing station first, then the rest
    const otherStations = baseList.filter((s) => {
      const id = 'stationuuid' in s ? s.stationuuid : s.id;
      return id !== currentStationId;
    });

    return [playingStation, ...otherStations];
  }, [showFavorites, favorites, stations, contextStation]);

  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return [];
    return displayedStations.map((station, index) => ({
      id: 'stationuuid' in station ? station.stationuuid : station.id,
      label: station.name,
      index,
      onSelect: () => handleSelectStation(station),
    }));
  }, [displayedStations, isFocused, handleSelectStation]);

  const { scrollRef, isFocused: isItemFocused, getFocusStyle } = useVoiceFocusList(
    'radio-stations',
    voiceFocusItems
  );

  // Voice command listeners — play first station if none selected
  // Note: play/pause/stop are handled by RadioContext voice listeners

  // Calculate dynamic padding for content to extend under overlays
  const contentPaddingTop = MODULE_HEADER_HEIGHT + insets.top;
  // For iOS 26+, the native Glass Player Window handles its own positioning
  // so we don't need extra bottom padding. For older iOS/Android, we need
  // padding for the React Native MiniPlayer overlay.
  // IMPORTANT: Only show RN MiniPlayer when availability check is COMPLETE and Glass Player is NOT available
  const shouldShowRNMiniPlayer = !isCheckingGlassPlayerAvailability && !isGlassPlayerAvailable && contextStation && !isPlayerExpanded;
  const contentPaddingBottom = shouldShowRNMiniPlayer
    ? MINI_PLAYER_HEIGHT + insets.bottom
    : insets.bottom;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* ============================================================
          CONTENT LAYER — Extends full height under overlays
          Content scrolls UNDER the ModuleHeader and MiniPlayer
          ============================================================ */}
      <View style={styles.contentLayer}>
        {/* 3-way toggle: [❤️ Favorieten]  <space>  [Land] [Taal] */}
        <View style={[styles.toggleRow, { marginTop: contentPaddingTop + spacing.md }]}>
          {/* Favorites button — links */}
          <TouchableOpacity
            style={[
              styles.filterToggleButton,
              styles.favoritesToggleButton,
              showFavorites && { backgroundColor: accentColor.primary },
            ]}
            onPress={() => {
              triggerFeedback('tap');
              setShowFavorites(true);
            }}
            accessibilityRole="tab"
            accessibilityLabel={t('modules.radio.favorites')}
            accessibilityState={{ selected: showFavorites }}
          >
            <Icon
              name={showFavorites ? 'heart-filled' : 'heart'}
              size={24}
              color={showFavorites ? colors.textOnPrimary : accentColor.primary}
            />
            <Text style={[
              styles.filterToggleButtonText,
              showFavorites && styles.filterToggleButtonTextActive,
            ]}>
              {t('modules.radio.favorites')}
            </Text>
            {favorites.length > 0 && (
              <View style={[
                styles.favoritesCountBadge,
                { backgroundColor: showFavorites ? 'rgba(255, 255, 255, 0.3)' : accentColor.primary },
              ]}>
                <Text style={styles.favoritesCountText}>
                  {favorites.length > 99 ? '99+' : favorites.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Spacer — duwt Land/Taal naar rechts */}
          <View style={styles.toggleSpacer} />

          {/* Land/Taal toggle buttons — rechts */}
          <TouchableOpacity
            style={[
              styles.filterToggleButton,
              !showFavorites && filterMode === 'country' && { backgroundColor: accentColor.primary },
            ]}
            onPress={() => {
              triggerFeedback('tap');
              setShowFavorites(false);
              handleFilterModeChange('country');
            }}
            accessibilityRole="tab"
            accessibilityLabel={t('components.chipSelector.country')}
            accessibilityState={{ selected: !showFavorites && filterMode === 'country' }}
          >
            <Text style={[
              styles.filterToggleButtonText,
              !showFavorites && filterMode === 'country' && styles.filterToggleButtonTextActive,
            ]}>
              {t('components.chipSelector.country')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterToggleButton,
              !showFavorites && filterMode === 'language' && { backgroundColor: accentColor.primary },
            ]}
            onPress={() => {
              triggerFeedback('tap');
              setShowFavorites(false);
              handleFilterModeChange('language');
            }}
            accessibilityRole="tab"
            accessibilityLabel={t('components.chipSelector.language')}
            accessibilityState={{ selected: !showFavorites && filterMode === 'language' }}
          >
            <Text style={[
              styles.filterToggleButtonText,
              !showFavorites && filterMode === 'language' && styles.filterToggleButtonTextActive,
            ]}>
              {t('components.chipSelector.language')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search/Filter section — alleen zichtbaar wanneer NIET favorieten */}
        {!showFavorites && (
          <View style={styles.filterSection}>
            {/* Country/Language chips selector */}
            <ChipSelector
              mode={filterMode}
              options={filterMode === 'country' ? COUNTRIES : LANGUAGES}
              selectedCode={filterMode === 'country' ? selectedCountry : selectedLanguage}
              onSelect={filterMode === 'country' ? handleCountryChange : handleLanguageChange}
              allowModeToggle={false}
            />

            {/* Search bar — screen-wide, onderaan, placeholder dynamisch op basis van filterMode */}
            <View style={styles.searchBarContainer}>
              <SearchBar
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmit={handleSearch}
                placeholder={filterMode === 'country'
                  ? t('modules.radio.searchPlaceholderByCountry')
                  : t('modules.radio.searchPlaceholderByLanguage')
                }
                searchButtonLabel={t('modules.radio.searchButton')}
                maxLength={SEARCH_MAX_LENGTH}
              />
            </View>
          </View>
        )}

        {/* Playback Error Banner — shown when a stream fails */}
        {playbackError && (
          <View style={[styles.playbackErrorBanner, { backgroundColor: themeColors.errorBackground, borderColor: themeColors.error }]}>
            <Icon name="warning" size={24} color={themeColors.error} />
            <View style={styles.playbackErrorTextContainer}>
              <Text style={[styles.playbackErrorTitle, { color: themeColors.error }]}>
                {t('modules.radio.playbackErrorTitle')}
              </Text>
              <Text style={[styles.playbackErrorMessage, { color: themeColors.textSecondary }]}>
                {t('modules.radio.playbackErrorMessage')}
              </Text>
            </View>
            {/* Senior-inclusive: Text button instead of icon-only button */}
            <TouchableOpacity
              style={[styles.playbackErrorDismiss, { backgroundColor: accentColor.primary }]}
              onPress={() => {
                triggerFeedback('tap');
                setPlaybackError(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.playbackErrorDismissText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        )}

      {/* Station list — ALWAYS visible, with bottom padding for mini-player */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accentColor.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>{t('modules.radio.loading')}</Text>
        </View>
      ) : apiError ? (
        // Error state with user-friendly message and retry button
        <View style={styles.errorContainer}>
          <Icon name="warning" size={64} color={themeColors.error} />
          <Text style={[styles.errorTitle, { color: themeColors.textPrimary }]}>{t(`modules.radio.errors.${apiError}Title`)}</Text>
          <Text style={[styles.errorMessage, { color: themeColors.textSecondary }]}>{t(`modules.radio.errors.${apiError}`)}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: accentColor.primary }]}
            onPress={() => {
              triggerFeedback('tap');
              loadStationsByCountry();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('common.tryAgain')}
          >
            <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
          </TouchableOpacity>
        </View>
      ) : displayedStations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name={showFavorites ? 'heart' : 'radio'} size={64} color={themeColors.textTertiary} />
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
            {showFavorites ? t('modules.radio.noFavorites') : t('modules.radio.noStations')}
          </Text>
          {showFavorites && (
            <>
              <Text style={[styles.emptyHint, { color: themeColors.textTertiary }]}>{t('modules.radio.noFavoritesHintExtended')}</Text>
              {/* Clear call-to-action button for seniors */}
              <TouchableOpacity
                style={[styles.emptyActionButton, { backgroundColor: accentColor.primary }]}
                onPress={() => {
                  triggerFeedback('tap');
                  setShowFavorites(false); // Switch to search tab
                }}
                accessibilityRole="button"
                accessibilityLabel={t('modules.radio.goToSearch')}
              >
                <Icon name="search" size={24} color={colors.textOnPrimary} />
                <Text style={styles.emptyActionButtonText}>{t('modules.radio.goToSearch')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.stationList}
          contentContainerStyle={[
            styles.stationListContent,
            // Add bottom padding for MiniPlayer overlay when visible
            { paddingBottom: contentPaddingBottom + spacing.md },
          ]}
        >
          {displayedStations.map((station, index) => {
            const id = 'stationuuid' in station ? station.stationuuid : station.id;
            const isCurrentStation = contextStation &&
              (contextStation.id === id);

            return (
              <VoiceFocusable
                key={id}
                id={id}
                label={station.name}
                index={index}
                onSelect={() => handleSelectStation(station)}
              >
                <View
                  style={[
                    styles.stationItem,
                    { backgroundColor: themeColors.surface },
                    // Playing station: thin accent border instead of background fill
                    isCurrentStation && {
                      borderWidth: 2,
                      borderColor: accentColor.primary,
                    },
                    isItemFocused(id) && getFocusStyle(),
                  ]}
                >
                  {/* Playing wave icon — shown at left for currently playing station */}
                  {isCurrentStation && (
                    <View style={styles.playingWaveContainer}>
                      <PlayingWaveIcon
                        color={accentColor.primary}
                        size={24}
                        isPlaying={isPlaying}
                      />
                    </View>
                  )}

                  {/* Station info - tappable area for playing */}
                  <TouchableOpacity
                    style={styles.stationInfoTouchable}
                    onPress={() => {
                      console.log('[RadioScreen] Station pressed for:', station.name);
                      handleSelectStation(station);
                    }}
                    onLongPress={() => {
                      // Empty handler prevents onPress from firing after long press
                      // The HoldToNavigateWrapper handles the actual long-press action
                    }}
                    delayLongPress={300}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={station.name}
                    accessibilityState={{ selected: isCurrentStation ?? false }}
                    accessibilityHint={t('modules.radio.stationHint')}
                  >
                    <View style={styles.stationInfo}>
                      <Text style={[styles.stationName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                        {station.name}
                      </Text>
                      <Text style={[styles.stationCountry, { color: themeColors.textSecondary }]} numberOfLines={1}>
                        {station.country}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Favorite button — uses IconButton for senior-inclusive design */}
                  <IconButton
                    icon="heart"
                    iconActive="heart-filled"
                    isActive={isFavorite(station)}
                    onPress={() => {
                      console.log('[RadioScreen] Favorite button pressed for:', station.name);
                      handleToggleFavorite(station);
                    }}
                    accessibilityLabel={
                      isFavorite(station)
                        ? t('modules.radio.removeFromFavorites', { name: station.name })
                        : t('modules.radio.addToFavorites', { name: station.name })
                    }
                    size={24}
                  />
                </View>
              </VoiceFocusable>
            );
          })}
        </ScrollView>
      )}
      </View>

      {/* ============================================================
          OVERLAY LAYER — Absolute positioned over content
          Contains ModuleHeader (top) and MiniPlayer (bottom)
          pointerEvents="box-none" allows touches to pass through
          ============================================================ */}
      <View style={styles.overlayLayer} pointerEvents="box-none">
        {/* Module Header — absolute positioned at top */}
        <ModuleHeader
          moduleId="radio"
          icon="radio"
          title={t('modules.radio.title')}
          currentSource="radio"
          showAdMob={true}
          style={styles.absoluteHeader}
        />

        {/* Spacer pushes MiniPlayer to bottom */}
        <View style={styles.overlaySpacer} pointerEvents="none" />

        {/* Floating Mini-Player — absolute positioned at bottom
            ONLY shown when Glass Player is NOT available (iOS <26 or Android)
            On iOS 26+, the native GlassPlayerWindow handles this
            IMPORTANT: Wait for availability check to complete before rendering */}
        {shouldShowRNMiniPlayer && (
          <MiniPlayer
            moduleId="radio"
            artwork={metadata.artwork || contextStation.favicon || null}
            title={contextStation.name}
            subtitle={isBuffering ? t('modules.radio.buffering') : metadata.title}
            accentColor={accentColor.primary}
            isPlaying={isPlaying}
            isLoading={isPlaybackLoading}
            onPress={() => setIsPlayerExpanded(true)}
            onPlayPause={async () => {
              if (isPlaying) {
                await pause();
              } else {
                await play();
              }
            }}
            progressType="duration"
            listenDuration={position}
            showStopButton={true}
            onStop={stop}
            expandAccessibilityLabel={t('modules.radio.expandPlayer')}
            expandAccessibilityHint={t('modules.radio.expandPlayerHint')}
            style={styles.absolutePlayer}
          />
        )}
      </View>

      {/* Expanded Full Player
          ONLY shown when Glass Player is NOT available (iOS <26 or Android)
          On iOS 26+, the native GlassPlayerWindow handles this
          IMPORTANT: Wait for availability check to complete before rendering */}
      {!isCheckingGlassPlayerAvailability && !isGlassPlayerAvailable && (
      <PanelAwareModal
        visible={isPlayerExpanded && !!contextStation}
        animationType={isReducedMotion ? 'none' : 'slide'}
        onRequestClose={() => setIsPlayerExpanded(false)}
      >
        <View style={[styles.expandedPlayerOverlay, { backgroundColor: themeColors.background }]}>
          <View style={[styles.expandedPlayerContent, { paddingTop: insets.top + spacing.md }]}>
            {/* Large artwork with buffering pulse animation */}
            <Animated.View
              style={[
                styles.expandedPlayerArtwork,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              {metadata.artwork || contextStation?.favicon ? (
                <Image
                  source={{ uri: metadata.artwork || contextStation?.favicon }}
                  style={styles.expandedPlayerArtworkImage}
                  resizeMode="cover"
                  accessibilityLabel={t('modules.radio.stationArtwork', { station: contextStation?.name })}
                />
              ) : (
                <View style={[styles.expandedPlayerArtworkImage, styles.expandedPlayerArtworkPlaceholder, { backgroundColor: radioModuleColor }]}>
                  <Icon name="radio" size={100} color={colors.textOnPrimary} strokeWidth={1.5} />
                </View>
              )}
              {/* Loading/buffering overlay */}
              {(isPlaybackLoading || isBuffering) && (
                <View style={styles.expandedPlayerArtworkOverlay}>
                  <ActivityIndicator size="large" color={colors.textOnPrimary} />
                </View>
              )}
            </Animated.View>

            {/* Station info */}
            <View style={styles.expandedPlayerInfo}>
              <Text
                style={[styles.expandedPlayerStationName, { color: themeColors.textPrimary }]}
                numberOfLines={1}
                accessibilityRole="header"
              >
                {contextStation?.name}
              </Text>

              {/* Now playing metadata or country */}
              {metadata.title || metadata.artist ? (
                <View style={styles.expandedPlayerNowPlaying}>
                  <Text style={[styles.expandedPlayerNowPlayingLabel, { color: themeColors.textTertiary }]}>
                    {t('modules.radio.nowPlayingLabel')}
                  </Text>
                  <Text style={[styles.expandedPlayerSongTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
                    {metadata.title || contextStation?.name}
                  </Text>
                  {metadata.artist && (
                    <Text style={[styles.expandedPlayerArtistName, { color: themeColors.textSecondary }]} numberOfLines={1}>
                      {metadata.artist}
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={[styles.expandedPlayerCountryText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  {contextStation?.country}
                </Text>
              )}
            </View>

            {/* Large playback controls */}
            <View style={styles.expandedPlayerControls}>
              {/* Favorite button */}
              <IconButton
                icon="heart"
                iconActive="heart-filled"
                isActive={contextStation ? favorites.some(f => f.id === contextStation.id) : false}
                onPress={() => {
                  if (contextStation) {
                    const station = favorites.find(f => f.id === contextStation.id) ||
                      stations.find(s => s.stationuuid === contextStation.id);
                    if (station) {
                      handleToggleFavorite(station);
                    }
                  }
                }}
                accessibilityLabel={
                  contextStation && favorites.some(f => f.id === contextStation.id)
                    ? t('modules.radio.removeFromFavorites', { name: contextStation.name })
                    : t('modules.radio.addToFavorites', { name: contextStation?.name })
                }
                size={32}
              />

              {/* Play/Pause button (large, primary) */}
              <TouchableOpacity
                style={[styles.expandedPlayerPlayButton, { backgroundColor: accentColor.primary }]}
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
                accessibilityLabel={isPlaying ? t('modules.radio.pause') : t('modules.radio.play')}
                accessibilityState={{ disabled: isPlaybackLoading }}
              >
                {isPlaybackLoading ? (
                  <ActivityIndicator size="large" color={colors.textOnPrimary} />
                ) : (
                  <Icon
                    name={isPlaying ? 'pause' : 'play'}
                    size={48}
                    color={colors.textOnPrimary}
                  />
                )}
              </TouchableOpacity>

              {/* Stop button */}
              <IconButton
                icon="stop"
                onPress={async () => {
                  await stop();
                  setIsPlayerExpanded(false);
                }}
                accessibilityLabel={t('modules.radio.stop')}
                size={32}
              />
            </View>

            {/* Buffering indicator text */}
            {isBuffering && (
              <Text style={styles.expandedPlayerBufferingText}>
                {t('modules.radio.buffering')}
              </Text>
            )}

            {/* Close button / collapse — centered below controls */}
            <View style={styles.expandedPlayerCloseContainer}>
              <IconButton
                icon="chevron-down"
                onPress={() => setIsPlayerExpanded(false)}
                accessibilityLabel={t('modules.radio.collapsePlayer')}
                accessibilityHint={t('modules.radio.collapsePlayerHint')}
                size={28}
              />
            </View>
          </View>
        </View>
      </PanelAwareModal>
      )}

      {/* Voice hint */}
      {isVoiceSessionActive && (
        <View style={styles.voiceHint}>
          <Text style={styles.voiceHintText}>
            {t('modules.radio.voiceHint')}
          </Text>
        </View>
      )}

      {/* No Favorites Modal — explains how to find and save stations */}
      <Modal
        visible={showNoFavoritesModal}
        transparent={true}
        animationType={isReducedMotion ? 'none' : 'fade'}
        onRequestClose={() => {
          setShowNoFavoritesModal(false);
          setShowFavorites(false);
        }}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
            {/* Title */}
            <View style={styles.modalHeader}>
              <Icon name="heart" size={48} color={accentColor.primary} />
              <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>{t('modules.radio.welcomeTitle')}</Text>
            </View>

            {/* Explanation */}
            <Text style={[styles.modalText, { color: themeColors.textSecondary }]}>
              {t('modules.radio.welcomeText')}
            </Text>

            {/* Steps with heart icon */}
            <View style={styles.modalStep}>
              <View style={[styles.modalStepNumber, { backgroundColor: themeColors.border }]}>
                <Text style={[styles.modalStepNumberText, { color: themeColors.textPrimary }]}>1</Text>
              </View>
              <Text style={[styles.modalStepText, { color: themeColors.textPrimary }]}>
                {t('modules.radio.welcomeStep1')}
              </Text>
            </View>

            <View style={styles.modalStep}>
              <View style={[styles.modalStepNumber, { backgroundColor: themeColors.border }]}>
                <Text style={[styles.modalStepNumberText, { color: themeColors.textPrimary }]}>2</Text>
              </View>
              <View style={styles.modalStepContent}>
                <Text style={[styles.modalStepText, { color: themeColors.textPrimary }]}>
                  {t('modules.radio.welcomeStep2')}
                </Text>
                <Icon
                  name="heart"
                  size={24}
                  color={accentColor.primary}
                  style={styles.modalStepIcon}
                />
              </View>
            </View>

            {/* OK Button — goes to Search */}
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: accentColor.primary }]}
              onPress={() => {
                triggerFeedback('tap');
                setShowNoFavoritesModal(false);
                setShowFavorites(false); // Navigate to Search tab
              }}
              accessibilityRole="button"
              accessibilityLabel={t('modules.radio.welcomeButton')}
              accessibilityHint={t('modules.radio.welcomeButtonHint')}
            >
              <Icon name="search" size={24} color={colors.textOnPrimary} />
              <Text style={styles.modalButtonText}>{t('modules.radio.welcomeButton')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  // Expanded Player Modal styles
  expandedPlayerOverlay: {
    flex: 1,
    backgroundColor: colors.background,
  },
  expandedPlayerContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  expandedPlayerCloseContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  expandedPlayerArtwork: {
    width: 240,
    height: 240,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.xl,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  expandedPlayerArtworkImage: {
    width: '100%',
    height: '100%',
  },
  expandedPlayerArtworkPlaceholder: {
    // backgroundColor is set inline with dynamic radioModuleColor
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedPlayerArtworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedPlayerInfo: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  expandedPlayerStationName: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  expandedPlayerCountryText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  expandedPlayerNowPlaying: {
    alignItems: 'center',
    width: '100%',
  },
  expandedPlayerNowPlayingLabel: {
    ...typography.small,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  expandedPlayerSongTitle: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '600',
  },
  expandedPlayerArtistName: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  expandedPlayerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  expandedPlayerPlayButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  expandedPlayerBufferingText: {
    ...typography.small,
    color: colors.textTertiary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  // 3-way toggle row: [❤️ Favorieten] | [Land] [Taal]
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    gap: spacing.xs,
  },
  toggleSpacer: {
    flex: 1,  // Neemt alle beschikbare ruimte — duwt Land/Taal naar rechts
  },
  filterToggleButton: {
    height: touchTargets.minimum,  // 60pt — senior-inclusive
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoritesToggleButton: {
    // Extra width voor hart icoon + badge
    minWidth: touchTargets.minimum,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  favoritesCountBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoritesCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textOnPrimary,
    textAlign: 'center',
    lineHeight: 14,
    includeFontPadding: false,
  },
  filterToggleButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  filterToggleButtonTextActive: {
    color: colors.textOnPrimary,
  },
  filterSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  searchBarContainer: {
    // SearchBar is nu screen-wide (geen extra styling nodig)
  },
  // countryList, countryChip, countryChipText, filterLabel removed — using standardized ChipSelector component
  // searchContainer, searchInput, searchButton removed — using standardized SearchBar component
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
  // Playback error banner styles
  playbackErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBackground,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  playbackErrorTextContainer: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  playbackErrorTitle: {
    ...typography.body,
    color: colors.error,
    fontWeight: '700',
  },
  playbackErrorMessage: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  playbackErrorDismiss: {
    minWidth: touchTargets.minimum,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  playbackErrorDismissText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  stationList: {
    flex: 1,
  },
  stationListContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  stationItem: {
    flexDirection: 'row',
    // CRITICAL: alignItems center ensures IconButton (60pt) is vertically centered
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    // Padding around content
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    // paddingRight: 0 — IconButton edge aligns with SearchBar edge
    // (stationListContent has padding.md, filterSection has paddingHorizontal.md)
    paddingRight: 0,
    // Row height accommodates IconButton (60pt) + vertical padding
    minHeight: touchTargets.minimum + spacing.xs * 2,
  },
  stationInfoTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    // Match IconButton height for consistent vertical alignment
    minHeight: touchTargets.minimum,
    marginRight: spacing.xs,
  },
  stationInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  stationName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  stationCountry: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  playingIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  playingWaveContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  favoriteButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    maxWidth: 400,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
  },
  modalText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 26,
  },
  modalStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  modalStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalStepNumberText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  modalStepContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modalStepText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  modalStepIcon: {
    marginLeft: spacing.xs,
  },
  modalButton: {
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
  modalButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
});
