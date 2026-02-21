/**
 * useWeather — Hook for Weather Module
 *
 * Provides weather data fetching, location management, and TTS functionality.
 *
 * Features:
 * - Weather data fetching with caching
 * - Location search and favorites management
 * - TTS for current weather, forecast, and rain prediction
 * - Dual-engine TTS: Piper for Dutch, System for others
 *
 * IMPORTANT: Dutch weather readings use the HIGH-QUALITY Piper TTS (nl_NL-rdh-high)
 * for the best listening experience. Other languages fall back to system TTS.
 *
 * @see .claude/plans/WEATHER_MODULE.md
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { weatherService } from '@/services/weatherService';
import { piperTtsService } from '@/services/piperTtsService';
import { ttsService } from '@/services/ttsService';
import type { WeatherData, WeatherLocation, WeatherTtsSection } from '@/types/weather';
import i18n from '@/i18n';

// ============================================================
// Constants
// ============================================================

// Languages that use Piper TTS (high-quality offline voices)
const PIPER_SUPPORTED_LANGUAGES = ['nl-NL', 'nl-BE', 'nl'];

// ============================================================
// Types
// ============================================================

export interface UseWeatherReturn {
  // Data
  weather: WeatherData | null;
  savedLocations: WeatherLocation[];
  searchResults: WeatherLocation[];

  // State
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;

  // TTS State
  isTtsPlaying: boolean;
  ttsSection: WeatherTtsSection | null;

  // Actions
  selectLocation: (location: WeatherLocation) => Promise<void>;
  searchLocations: (query: string) => Promise<void>;
  clearSearchResults: () => void;
  saveLocation: (location: WeatherLocation) => Promise<void>;
  saveCurrentLocation: () => Promise<void>;
  removeLocation: (id: string) => Promise<void>;
  refresh: () => Promise<void>;

  // TTS Actions
  readCurrentWeather: () => Promise<void>;
  readForecast: () => Promise<void>;
  readRainPrediction: () => Promise<void>;
  stopTts: () => Promise<void>;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useWeather(): UseWeatherReturn {
  // Data state
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [savedLocations, setSavedLocations] = useState<WeatherLocation[]>([]);
  const [searchResults, setSearchResults] = useState<WeatherLocation[]>([]);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TTS state
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [ttsSection, setTtsSection] = useState<WeatherTtsSection | null>(null);

  // TTS service refs
  const isPiperTtsInitializedRef = useRef(false);
  const isSystemTtsInitializedRef = useRef(false);
  const currentEngineRef = useRef<'piper' | 'system' | null>(null);

  // =====================
  // Initialization
  // =====================

  // Initialize TTS services
  useEffect(() => {
    const initTTS = async () => {
      // Initialize system TTS
      if (!isSystemTtsInitializedRef.current) {
        const systemSuccess = await ttsService.initialize();
        isSystemTtsInitializedRef.current = systemSuccess;
        if (!systemSuccess) {
          console.warn('[useWeather] System TTS initialization failed');
        }
      }

      // Initialize Piper TTS (for Dutch)
      if (!isPiperTtsInitializedRef.current) {
        const piperSuccess = await piperTtsService.initialize();
        isPiperTtsInitializedRef.current = piperSuccess;
        if (piperSuccess) {
          console.info('[useWeather] Piper TTS initialized with nl_NL-rdh-high voice');
        } else {
          console.warn('[useWeather] Piper TTS initialization failed, will use system TTS');
        }
      }
    };

    void initTTS();
  }, []);

  // Set up TTS event listeners
  useEffect(() => {
    // Piper TTS events
    const unsubPiperComplete = piperTtsService.addEventListener('piperComplete', () => {
      if (currentEngineRef.current === 'piper') {
        setIsTtsPlaying(false);
        setTtsSection(null);
        currentEngineRef.current = null;
      }
    });

    const unsubPiperError = piperTtsService.addEventListener('piperError', () => {
      if (currentEngineRef.current === 'piper') {
        setIsTtsPlaying(false);
        setTtsSection(null);
        currentEngineRef.current = null;
      }
    });

    // System TTS events
    const unsubComplete = ttsService.addEventListener('ttsComplete', () => {
      if (currentEngineRef.current === 'system') {
        setIsTtsPlaying(false);
        setTtsSection(null);
        currentEngineRef.current = null;
      }
    });

    const unsubCancel = ttsService.addEventListener('ttsCancelled', () => {
      if (currentEngineRef.current === 'system') {
        setIsTtsPlaying(false);
        setTtsSection(null);
        currentEngineRef.current = null;
      }
    });

    const unsubError = ttsService.onError(() => {
      if (currentEngineRef.current === 'system') {
        setIsTtsPlaying(false);
        setTtsSection(null);
        currentEngineRef.current = null;
      }
    });

    return () => {
      unsubPiperComplete();
      unsubPiperError();
      unsubComplete();
      unsubCancel();
      unsubError();
    };
  }, []);

  // Load saved locations on mount
  useEffect(() => {
    void loadSavedLocations();
  }, []);

  // =====================
  // Location Management
  // =====================

  const loadSavedLocations = useCallback(async () => {
    try {
      const locations = await weatherService.getSavedLocations();
      setSavedLocations(locations);

      // Auto-load weather for first saved location if no weather loaded
      if (locations.length > 0 && !weather) {
        await selectLocation(locations[0]);
      }
    } catch (err) {
      console.error('[useWeather] Failed to load saved locations:', err);
    }
  }, [weather]);

  const selectLocation = useCallback(async (location: WeatherLocation) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await weatherService.fetchWeather(location);
      setWeather(data);
      console.info('[useWeather] Weather loaded for', location.name);
    } catch (err) {
      console.error('[useWeather] Fetch error:', err);
      setError('modules.weather.errors.network');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchLocations = useCallback(async (query: string) => {
    // Validate minimum length
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    // Validate characters: only letters (including accented), spaces, hyphens, apostrophes
    // This regex uses Unicode property escapes for international character support
    const validCharsRegex = /^[\p{L}\s\-']+$/u;
    if (!validCharsRegex.test(query)) {
      console.warn('[useWeather] Invalid characters in search query, skipping API call');
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await weatherService.searchLocations(query, i18n.language);
      setSearchResults(results);
    } catch (err) {
      console.error('[useWeather] Search error:', err);
      // Don't set error - just show empty results
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
  }, []);

  const saveLocation = useCallback(async (location: WeatherLocation) => {
    try {
      await weatherService.saveLocation(location);
      await loadSavedLocations();
      console.info('[useWeather] Location saved:', location.name);
    } catch (err) {
      console.error('[useWeather] Save error:', err);
      if (err instanceof Error && err.message === 'max_locations_reached') {
        setError('modules.weather.maxLocationsReached');
      }
    }
  }, [loadSavedLocations]);

  const saveCurrentLocation = useCallback(async () => {
    if (!weather) return;

    try {
      await weatherService.saveLocation(weather.location);
      await loadSavedLocations();
      console.info('[useWeather] Location saved:', weather.location.name);
    } catch (err) {
      console.error('[useWeather] Save error:', err);
      if (err instanceof Error && err.message === 'max_locations_reached') {
        setError('modules.weather.maxLocationsReached');
      }
    }
  }, [weather, loadSavedLocations]);

  const removeLocation = useCallback(async (id: string) => {
    try {
      await weatherService.removeLocation(id);
      await loadSavedLocations();
      console.info('[useWeather] Location removed:', id);
    } catch (err) {
      console.error('[useWeather] Remove error:', err);
    }
  }, [loadSavedLocations]);

  const refresh = useCallback(async () => {
    if (!weather) return;

    setIsLoading(true);
    setError(null);

    try {
      // Clear cache and refetch
      await weatherService.clearCache();
      const data = await weatherService.fetchWeather(weather.location);
      setWeather(data);
    } catch (err) {
      console.error('[useWeather] Refresh error:', err);
      setError('modules.weather.errors.network');
    } finally {
      setIsLoading(false);
    }
  }, [weather]);

  // =====================
  // TTS Functions
  // =====================

  /**
   * Check if Piper TTS should be used for this language
   */
  const shouldUsePiperTTS = useCallback((language: string): boolean => {
    return PIPER_SUPPORTED_LANGUAGES.some(lang =>
      language.toLowerCase().startsWith(lang.toLowerCase().split('-')[0])
    );
  }, []);

  /**
   * Speak text with appropriate TTS engine
   */
  const speakText = useCallback(async (text: string, section: WeatherTtsSection) => {
    const language = i18n.language;
    const usePiper = shouldUsePiperTTS(language) && isPiperTtsInitializedRef.current;

    // Stop any existing playback
    await piperTtsService.stop();
    await ttsService.stop();

    setIsTtsPlaying(true);
    setTtsSection(section);

    try {
      let success = false;

      if (usePiper) {
        console.info('[useWeather] Using Piper TTS for Dutch');
        currentEngineRef.current = 'piper';
        success = await piperTtsService.speakChunked(text);

        if (!success) {
          // Fallback to system TTS
          console.warn('[useWeather] Piper TTS failed, falling back to system TTS');
          currentEngineRef.current = 'system';
          const voice = await ttsService.getBestVoiceForLanguage(language);
          success = await ttsService.speak(text, voice?.id);
        }
      } else {
        console.info('[useWeather] Using system TTS for', language);
        currentEngineRef.current = 'system';
        const voice = await ttsService.getBestVoiceForLanguage(language);
        success = await ttsService.speak(text, voice?.id);
      }

      if (!success) {
        throw new Error('TTS playback failed');
      }
    } catch (err) {
      console.error('[useWeather] TTS error:', err);
      setIsTtsPlaying(false);
      setTtsSection(null);
      currentEngineRef.current = null;
    }
  }, [shouldUsePiperTTS]);

  const readCurrentWeather = useCallback(async () => {
    if (!weather) return;

    // If already playing this section, stop it
    if (isTtsPlaying && ttsSection === 'current') {
      await stopTts();
      return;
    }

    const text = weatherService.formatCurrentWeatherForTts(weather, i18n.language);
    await speakText(text, 'current');
  }, [weather, isTtsPlaying, ttsSection, speakText]);

  const readForecast = useCallback(async () => {
    if (!weather) return;

    // If already playing this section, stop it
    if (isTtsPlaying && ttsSection === 'forecast') {
      await stopTts();
      return;
    }

    const text = weatherService.formatForecastForTts(weather, i18n.language);
    await speakText(text, 'forecast');
  }, [weather, isTtsPlaying, ttsSection, speakText]);

  const readRainPrediction = useCallback(async () => {
    if (!weather) return;

    // If already playing this section, stop it
    if (isTtsPlaying && ttsSection === 'rain') {
      await stopTts();
      return;
    }

    const text = weatherService.formatRainForTts(weather, i18n.language);
    await speakText(text, 'rain');
  }, [weather, isTtsPlaying, ttsSection, speakText]);

  const stopTts = useCallback(async () => {
    // Stop both engines
    await piperTtsService.stop();
    await ttsService.stop();

    setIsTtsPlaying(false);
    setTtsSection(null);
    currentEngineRef.current = null;
  }, []);

  // =====================
  // Return
  // =====================

  return {
    // Data
    weather,
    savedLocations,
    searchResults,

    // State
    isLoading,
    isSearching,
    error,

    // TTS State
    isTtsPlaying,
    ttsSection,

    // Actions
    selectLocation,
    searchLocations,
    clearSearchResults,
    saveLocation,
    saveCurrentLocation,
    removeLocation,
    refresh,

    // TTS Actions
    readCurrentWeather,
    readForecast,
    readRainPrediction,
    stopTts,
  };
}

export default useWeather;
