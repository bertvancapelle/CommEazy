# Weather Module Implementatieplan

## Design Beslissingen

| Aspect | Beslissing |
|--------|------------|
| **Data bronnen** | Open-Meteo (weer) + RainViewer (radar) |
| **Radar visualisatie** | Tekst samenvatting + optionele kaart button |
| **Locatie zoeken** | Op plaatsnaam (Open-Meteo geocoding) |
| **TTS** | Volledige TTS met aparte knoppen per sectie |
| **Max locaties** | 10 (GPS + 9 favorieten) |
| **Module kleur** | Hemelsblauw `#03A9F4` |
| **Module icoon** | `weather-partly-cloudy` |
| **Cache TTL** | 15 minuten (weer verandert, maar niet te vaak refreshen) |

---

## API Informatie

### Open-Meteo Weather API

**Base URL:** `https://api.open-meteo.com/v1/forecast`

**Voorbeeld request:**
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=52.52
  &longitude=13.41
  &current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m
  &daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum
  &timezone=auto
```

**Geen API key nodig!**

### Open-Meteo Geocoding API

**Base URL:** `https://geocoding-api.open-meteo.com/v1/search`

**Voorbeeld request:**
```
GET https://geocoding-api.open-meteo.com/v1/search
  ?name=Groningen
  &count=5
  &language=nl
```

### RainViewer API (Radar)

**Base URL:** `https://api.rainviewer.com/public/weather-maps.json`

**Geeft radar tiles die in MapView geladen kunnen worden.**

---

## Implementatie Fases

### Fase 1: Foundation (Types + Service)

#### 1.1 Types definiëren

**Bestand:** `src/types/weather.ts`

```typescript
// Locatie
export interface WeatherLocation {
  id: string;              // Unieke ID (bijv. "52.37,4.89")
  name: string;            // "Amsterdam"
  country: string;         // "Netherlands"
  admin1?: string;         // "Noord-Holland" (provincie/staat)
  latitude: number;
  longitude: number;
  isCurrentLocation: boolean;
  isFavorite: boolean;
}

// Huidige weer
export interface CurrentWeather {
  temperature: number;     // Celsius
  feelsLike: number;
  humidity: number;        // Percentage
  windSpeed: number;       // km/h
  windDirection: number;   // Graden
  weatherCode: number;     // WMO code
  isDay: boolean;
  precipitation: number;   // mm
}

// Dagelijkse voorspelling
export interface DailyForecast {
  date: Date;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  precipitationProbability: number;
  sunrise: Date;
  sunset: Date;
}

// Regenvoorspelling (tekstueel)
export interface RainPrediction {
  summary: string;         // "Droog tot 15:00, daarna lichte regen"
  nextRainTime?: Date;
  nextRainIntensity?: 'light' | 'moderate' | 'heavy';
}

// Volledige weerdata
export interface WeatherData {
  location: WeatherLocation;
  current: CurrentWeather;
  daily: DailyForecast[];  // 7 dagen
  rain: RainPrediction;
  fetchedAt: Date;
}

// Module configuratie
export interface WeatherModuleConfig {
  id: 'weather';
  accentColor: '#03A9F4';
  icon: 'weather-partly-cloudy';
}
```

#### 1.2 Weather Service implementeren

**Bestand:** `src/services/weatherService.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeatherData, WeatherLocation, CurrentWeather, DailyForecast, RainPrediction } from '@/types/weather';

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const RAINVIEWER_API_URL = 'https://api.rainviewer.com/public/weather-maps.json';

const CACHE_KEY_PREFIX = 'weather_cache_';
const LOCATIONS_KEY = 'weather_saved_locations';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minuten

class WeatherServiceImpl {
  private memoryCache = new Map<string, { data: WeatherData; fetchedAt: number }>();

  // =====================
  // GEOCODING
  // =====================

  async searchLocations(query: string, language: string = 'nl'): Promise<WeatherLocation[]> {
    if (!query || query.length < 2) return [];

    const url = `${OPEN_METEO_GEOCODING_URL}?name=${encodeURIComponent(query)}&count=10&language=${language}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Geocoding failed');

    const data = await response.json();

    return (data.results || []).map((result: any) => ({
      id: `${result.latitude},${result.longitude}`,
      name: result.name,
      country: result.country,
      admin1: result.admin1,
      latitude: result.latitude,
      longitude: result.longitude,
      isCurrentLocation: false,
      isFavorite: false,
    }));
  }

  // =====================
  // WEATHER DATA
  // =====================

  async fetchWeather(location: WeatherLocation): Promise<WeatherData> {
    const cacheKey = `${location.latitude},${location.longitude}`;

    // Check memory cache
    const cached = this.memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      console.debug('[weatherService] Using memory cache');
      return cached.data;
    }

    // Fetch from API
    const url = new URL(OPEN_METEO_FORECAST_URL);
    url.searchParams.set('latitude', String(location.latitude));
    url.searchParams.set('longitude', String(location.longitude));
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,is_day');
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '7');

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Weather fetch failed');

    const data = await response.json();

    const weatherData = this.parseWeatherResponse(data, location);

    // Update cache
    this.memoryCache.set(cacheKey, { data: weatherData, fetchedAt: Date.now() });

    // Persist to AsyncStorage for offline
    await AsyncStorage.setItem(CACHE_KEY_PREFIX + cacheKey, JSON.stringify(weatherData));

    return weatherData;
  }

  private parseWeatherResponse(data: any, location: WeatherLocation): WeatherData {
    const current: CurrentWeather = {
      temperature: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      windDirection: data.current.wind_direction_10m,
      weatherCode: data.current.weather_code,
      isDay: data.current.is_day === 1,
      precipitation: data.current.precipitation,
    };

    const daily: DailyForecast[] = data.daily.time.map((date: string, i: number) => ({
      date: new Date(date),
      weatherCode: data.daily.weather_code[i],
      temperatureMax: data.daily.temperature_2m_max[i],
      temperatureMin: data.daily.temperature_2m_min[i],
      precipitationSum: data.daily.precipitation_sum[i],
      precipitationProbability: data.daily.precipitation_probability_max[i],
      sunrise: new Date(data.daily.sunrise[i]),
      sunset: new Date(data.daily.sunset[i]),
    }));

    const rain = this.generateRainPrediction(data, current);

    return {
      location,
      current,
      daily,
      rain,
      fetchedAt: new Date(),
    };
  }

  private generateRainPrediction(data: any, current: CurrentWeather): RainPrediction {
    // Simplified rain prediction based on current + daily data
    const todayPrecip = data.daily.precipitation_sum[0];
    const todayProb = data.daily.precipitation_probability_max[0];

    if (current.precipitation > 0) {
      return {
        summary: 'Het regent momenteel',
        nextRainTime: new Date(),
        nextRainIntensity: current.precipitation > 5 ? 'heavy' : current.precipitation > 1 ? 'moderate' : 'light',
      };
    } else if (todayProb > 70) {
      return {
        summary: 'Regen verwacht vandaag',
        nextRainIntensity: todayPrecip > 10 ? 'heavy' : todayPrecip > 3 ? 'moderate' : 'light',
      };
    } else if (todayProb > 30) {
      return {
        summary: 'Kans op regen vandaag',
      };
    } else {
      return {
        summary: 'Droog weer verwacht',
      };
    }
  }

  // =====================
  // SAVED LOCATIONS
  // =====================

  async getSavedLocations(): Promise<WeatherLocation[]> {
    const stored = await AsyncStorage.getItem(LOCATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  async saveLocation(location: WeatherLocation): Promise<void> {
    const locations = await this.getSavedLocations();

    // Max 10 locations
    if (locations.length >= 10 && !locations.some(l => l.id === location.id)) {
      throw new Error('Maximum 10 locaties bereikt');
    }

    const exists = locations.findIndex(l => l.id === location.id);
    if (exists >= 0) {
      locations[exists] = { ...location, isFavorite: true };
    } else {
      locations.push({ ...location, isFavorite: true });
    }

    await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
  }

  async removeLocation(locationId: string): Promise<void> {
    const locations = await this.getSavedLocations();
    const filtered = locations.filter(l => l.id !== locationId);
    await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(filtered));
  }

  // =====================
  // TTS FORMATTING
  // =====================

  formatCurrentWeatherForTts(weather: WeatherData, language: string): string {
    const condition = this.getWeatherDescription(weather.current.weatherCode, language);

    if (language.startsWith('nl')) {
      return `Het weer in ${weather.location.name}. ` +
        `Het is nu ${Math.round(weather.current.temperature)} graden, ${condition}. ` +
        `De luchtvochtigheid is ${weather.current.humidity} procent. ` +
        `${weather.rain.summary}.`;
    }
    // Add other languages...
    return `Weather in ${weather.location.name}. ` +
      `Currently ${Math.round(weather.current.temperature)} degrees, ${condition}. ` +
      `Humidity ${weather.current.humidity} percent.`;
  }

  formatForecastForTts(weather: WeatherData, language: string): string {
    const lines = weather.daily.slice(0, 7).map((day, i) => {
      const dayName = this.getDayName(day.date, language, i);
      const condition = this.getWeatherDescription(day.weatherCode, language);

      if (language.startsWith('nl')) {
        return `${dayName}: ${Math.round(day.temperatureMax)} graden, ${condition}`;
      }
      return `${dayName}: ${Math.round(day.temperatureMax)} degrees, ${condition}`;
    });

    if (language.startsWith('nl')) {
      return `Vooruitzicht voor de komende week. ${lines.join('. ')}.`;
    }
    return `Forecast for the coming week. ${lines.join('. ')}.`;
  }

  formatRainForTts(weather: WeatherData, language: string): string {
    if (language.startsWith('nl')) {
      return `Neerslagverwachting: ${weather.rain.summary}.`;
    }
    return `Precipitation: ${weather.rain.summary}.`;
  }

  private getWeatherDescription(code: number, language: string): string {
    // WMO Weather codes mapping
    const descriptions: Record<number, { nl: string; en: string }> = {
      0: { nl: 'helder', en: 'clear' },
      1: { nl: 'overwegend helder', en: 'mainly clear' },
      2: { nl: 'gedeeltelijk bewolkt', en: 'partly cloudy' },
      3: { nl: 'bewolkt', en: 'overcast' },
      45: { nl: 'mistig', en: 'fog' },
      48: { nl: 'ijsmist', en: 'freezing fog' },
      51: { nl: 'lichte motregen', en: 'light drizzle' },
      53: { nl: 'motregen', en: 'drizzle' },
      55: { nl: 'zware motregen', en: 'heavy drizzle' },
      61: { nl: 'lichte regen', en: 'light rain' },
      63: { nl: 'regen', en: 'rain' },
      65: { nl: 'zware regen', en: 'heavy rain' },
      71: { nl: 'lichte sneeuw', en: 'light snow' },
      73: { nl: 'sneeuw', en: 'snow' },
      75: { nl: 'zware sneeuw', en: 'heavy snow' },
      80: { nl: 'lichte buien', en: 'light showers' },
      81: { nl: 'buien', en: 'showers' },
      82: { nl: 'zware buien', en: 'heavy showers' },
      95: { nl: 'onweer', en: 'thunderstorm' },
    };

    const desc = descriptions[code] || { nl: 'onbekend', en: 'unknown' };
    return language.startsWith('nl') ? desc.nl : desc.en;
  }

  private getDayName(date: Date, language: string, dayIndex: number): string {
    if (dayIndex === 0) return language.startsWith('nl') ? 'Vandaag' : 'Today';
    if (dayIndex === 1) return language.startsWith('nl') ? 'Morgen' : 'Tomorrow';

    return date.toLocaleDateString(language, { weekday: 'long' });
  }

  // =====================
  // WEATHER ICONS
  // =====================

  getWeatherIcon(code: number, isDay: boolean): string {
    // Map WMO codes to icon names
    const iconMap: Record<number, string> = {
      0: isDay ? 'weather-sunny' : 'weather-night',
      1: isDay ? 'weather-partly-cloudy' : 'weather-night-partly-cloudy',
      2: 'weather-partly-cloudy',
      3: 'weather-cloudy',
      45: 'weather-fog',
      48: 'weather-fog',
      51: 'weather-rainy',
      53: 'weather-rainy',
      55: 'weather-pouring',
      61: 'weather-rainy',
      63: 'weather-rainy',
      65: 'weather-pouring',
      71: 'weather-snowy',
      73: 'weather-snowy',
      75: 'weather-snowy-heavy',
      80: 'weather-rainy',
      81: 'weather-pouring',
      82: 'weather-pouring',
      95: 'weather-lightning-rainy',
    };

    return iconMap[code] || 'weather-cloudy';
  }
}

export const weatherService = new WeatherServiceImpl();
```

---

### Fase 2: Hook + Screen

#### 2.1 useWeather Hook

**Bestand:** `src/hooks/useWeather.ts`

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { weatherService } from '@/services/weatherService';
import { WeatherData, WeatherLocation } from '@/types/weather';
import { piperTtsService } from '@/services/piperTtsService';
import { ttsService } from '@/services/ttsService';
import i18n from '@/i18n';

const PIPER_SUPPORTED_LANGUAGES = ['nl-NL', 'nl-BE'];

export interface UseWeatherReturn {
  // Data
  weather: WeatherData | null;
  savedLocations: WeatherLocation[];
  searchResults: WeatherLocation[];

  // State
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;

  // TTS
  isTtsPlaying: boolean;
  ttsSection: 'current' | 'forecast' | 'rain' | null;

  // Actions
  selectLocation: (location: WeatherLocation) => Promise<void>;
  searchLocations: (query: string) => Promise<void>;
  saveCurrentLocation: () => Promise<void>;
  removeLocation: (id: string) => Promise<void>;
  refresh: () => Promise<void>;

  // TTS Actions
  readCurrentWeather: () => Promise<void>;
  readForecast: () => Promise<void>;
  readRainPrediction: () => Promise<void>;
  stopTts: () => Promise<void>;
}

export function useWeather(): UseWeatherReturn {
  // State
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [savedLocations, setSavedLocations] = useState<WeatherLocation[]>([]);
  const [searchResults, setSearchResults] = useState<WeatherLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TTS State
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [ttsSection, setTtsSection] = useState<'current' | 'forecast' | 'rain' | null>(null);
  const currentEngineRef = useRef<'piper' | 'system' | null>(null);

  // Load saved locations on mount
  useEffect(() => {
    loadSavedLocations();
  }, []);

  const loadSavedLocations = useCallback(async () => {
    const locations = await weatherService.getSavedLocations();
    setSavedLocations(locations);

    // Auto-load weather for first saved location
    if (locations.length > 0 && !weather) {
      await selectLocation(locations[0]);
    }
  }, []);

  const selectLocation = useCallback(async (location: WeatherLocation) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await weatherService.fetchWeather(location);
      setWeather(data);
    } catch (err) {
      setError('Kan weerdata niet ophalen');
      console.error('[useWeather] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchLocations = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await weatherService.searchLocations(query, i18n.language);
      setSearchResults(results);
    } catch (err) {
      console.error('[useWeather] Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const saveCurrentLocation = useCallback(async () => {
    if (!weather) return;

    await weatherService.saveLocation(weather.location);
    await loadSavedLocations();
  }, [weather, loadSavedLocations]);

  const removeLocation = useCallback(async (id: string) => {
    await weatherService.removeLocation(id);
    await loadSavedLocations();
  }, [loadSavedLocations]);

  const refresh = useCallback(async () => {
    if (!weather) return;
    await selectLocation(weather.location);
  }, [weather, selectLocation]);

  // =====================
  // TTS Functions
  // =====================

  const shouldUsePiperTTS = useCallback((language: string): boolean => {
    return PIPER_SUPPORTED_LANGUAGES.some(lang =>
      language.toLowerCase().startsWith(lang.toLowerCase().split('-')[0])
    );
  }, []);

  const speakText = useCallback(async (text: string, section: 'current' | 'forecast' | 'rain') => {
    const language = i18n.language;
    const usePiper = shouldUsePiperTTS(language);

    // Stop any existing playback
    await piperTtsService.stop();
    await ttsService.stop();

    setIsTtsPlaying(true);
    setTtsSection(section);

    try {
      if (usePiper) {
        currentEngineRef.current = 'piper';
        await piperTtsService.speakChunked(text);
      } else {
        currentEngineRef.current = 'system';
        const voice = await ttsService.getBestVoiceForLanguage(language);
        await ttsService.speak(text, voice?.id);
      }
    } catch (err) {
      console.error('[useWeather] TTS error:', err);
    } finally {
      setIsTtsPlaying(false);
      setTtsSection(null);
      currentEngineRef.current = null;
    }
  }, [shouldUsePiperTTS]);

  const readCurrentWeather = useCallback(async () => {
    if (!weather) return;
    const text = weatherService.formatCurrentWeatherForTts(weather, i18n.language);
    await speakText(text, 'current');
  }, [weather, speakText]);

  const readForecast = useCallback(async () => {
    if (!weather) return;
    const text = weatherService.formatForecastForTts(weather, i18n.language);
    await speakText(text, 'forecast');
  }, [weather, speakText]);

  const readRainPrediction = useCallback(async () => {
    if (!weather) return;
    const text = weatherService.formatRainForTts(weather, i18n.language);
    await speakText(text, 'rain');
  }, [weather, speakText]);

  const stopTts = useCallback(async () => {
    await piperTtsService.stop();
    await ttsService.stop();
    setIsTtsPlaying(false);
    setTtsSection(null);
    currentEngineRef.current = null;
  }, []);

  return {
    weather,
    savedLocations,
    searchResults,
    isLoading,
    isSearching,
    error,
    isTtsPlaying,
    ttsSection,
    selectLocation,
    searchLocations,
    saveCurrentLocation,
    removeLocation,
    refresh,
    readCurrentWeather,
    readForecast,
    readRainPrediction,
    stopTts,
  };
}
```

#### 2.2 WeatherScreen Component

**Bestand:** `src/screens/modules/WeatherScreen.tsx`

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ModuleHeader } from '@/components/ModuleHeader';
import { VoiceFocusable } from '@/contexts/VoiceFocusContext';
import { useWeather } from '@/hooks/useWeather';
import { useTheme } from '@/theme';
import { useFeedback } from '@/hooks/useFeedback';
import { WeatherLocation } from '@/types/weather';
import { weatherService } from '@/services/weatherService';

const WEATHER_ACCENT_COLOR = '#03A9F4';
const WELCOME_SHOWN_KEY = 'weather_welcome_shown';

export function WeatherScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing, touchTargets } = useTheme();
  const { triggerFeedback } = useFeedback();

  const {
    weather,
    savedLocations,
    searchResults,
    isLoading,
    isSearching,
    error,
    isTtsPlaying,
    ttsSection,
    selectLocation,
    searchLocations,
    saveCurrentLocation,
    removeLocation,
    refresh,
    readCurrentWeather,
    readForecast,
    readRainPrediction,
    stopTts,
  } = useWeather();

  // UI State
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [showLocationManager, setShowLocationManager] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Check welcome modal
  useEffect(() => {
    AsyncStorage.getItem(WELCOME_SHOWN_KEY).then((value) => {
      if (!value) setShowWelcome(true);
    });
  }, []);

  const handleWelcomeDismiss = async () => {
    setShowWelcome(false);
    await AsyncStorage.setItem(WELCOME_SHOWN_KEY, 'true');
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleLocationSelect = useCallback(async (location: WeatherLocation) => {
    void triggerFeedback('tap');
    await selectLocation(location);
    setShowLocationSearch(false);
    setSearchQuery('');
  }, [selectLocation, triggerFeedback]);

  const handleTtsPress = useCallback((section: 'current' | 'forecast' | 'rain') => {
    void triggerFeedback('tap');

    if (isTtsPlaying && ttsSection === section) {
      void stopTts();
    } else {
      if (section === 'current') void readCurrentWeather();
      if (section === 'forecast') void readForecast();
      if (section === 'rain') void readRainPrediction();
    }
  }, [isTtsPlaying, ttsSection, stopTts, readCurrentWeather, readForecast, readRainPrediction, triggerFeedback]);

  const styles = createStyles(colors, typography, spacing, touchTargets);

  return (
    <View style={styles.container}>
      <ModuleHeader
        moduleId="weather"
        icon="weather-partly-cloudy"
        title={t('modules.weather.title')}
        showAdMob={true}
      />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={WEATHER_ACCENT_COLOR}
          />
        }
      >
        {/* Location Selector */}
        <TouchableOpacity
          style={styles.locationSelector}
          onPress={() => setShowLocationSearch(true)}
          accessibilityRole="button"
          accessibilityLabel={weather?.location.name || t('modules.weather.selectLocation')}
        >
          <MaterialCommunityIcons name="map-marker" size={24} color={WEATHER_ACCENT_COLOR} />
          <Text style={styles.locationName}>
            {weather?.location.name || t('modules.weather.selectLocation')}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert" size={24} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={refresh}>
              <Text style={styles.errorDismiss}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Current Weather */}
        {weather && (
          <>
            <VoiceFocusable
              id="current-weather"
              label={t('modules.weather.currentWeather')}
              index={0}
              onSelect={() => handleTtsPress('current')}
            >
              <View style={styles.currentWeatherCard}>
                <View style={styles.currentWeatherMain}>
                  <MaterialCommunityIcons
                    name={weatherService.getWeatherIcon(weather.current.weatherCode, weather.current.isDay)}
                    size={80}
                    color={WEATHER_ACCENT_COLOR}
                  />
                  <Text style={styles.temperature}>
                    {Math.round(weather.current.temperature)}°
                  </Text>
                </View>
                <Text style={styles.condition}>
                  {weatherService.getWeatherDescription(weather.current.weatherCode, 'nl')}
                </Text>
                <Text style={styles.feelsLike}>
                  {t('modules.weather.feelsLike')}: {Math.round(weather.current.feelsLike)}°
                </Text>

                {/* TTS Button */}
                <TouchableOpacity
                  style={[styles.ttsButton, isTtsPlaying && ttsSection === 'current' && styles.ttsButtonActive]}
                  onPress={() => handleTtsPress('current')}
                  accessibilityRole="button"
                  accessibilityLabel={t('tts.readAloud')}
                >
                  <MaterialCommunityIcons
                    name={isTtsPlaying && ttsSection === 'current' ? 'stop' : 'volume-high'}
                    size={24}
                    color="white"
                  />
                  <Text style={styles.ttsButtonText}>
                    {isTtsPlaying && ttsSection === 'current' ? t('tts.stop') : t('tts.readAloud')}
                  </Text>
                </TouchableOpacity>
              </View>
            </VoiceFocusable>

            {/* Rain Prediction */}
            <VoiceFocusable
              id="rain-prediction"
              label={t('modules.weather.rainPrediction')}
              index={1}
              onSelect={() => handleTtsPress('rain')}
            >
              <View style={styles.rainCard}>
                <View style={styles.rainHeader}>
                  <MaterialCommunityIcons name="weather-rainy" size={32} color={WEATHER_ACCENT_COLOR} />
                  <Text style={styles.rainSummary}>{weather.rain.summary}</Text>
                </View>

                <View style={styles.rainActions}>
                  <TouchableOpacity
                    style={styles.ttsButtonSmall}
                    onPress={() => handleTtsPress('rain')}
                  >
                    <MaterialCommunityIcons
                      name={isTtsPlaying && ttsSection === 'rain' ? 'stop' : 'volume-high'}
                      size={20}
                      color={WEATHER_ACCENT_COLOR}
                    />
                    <Text style={styles.ttsButtonSmallText}>
                      {t('tts.readAloud')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.radarButton}
                    onPress={() => {/* TODO: Open radar modal */}}
                  >
                    <MaterialCommunityIcons name="radar" size={20} color={WEATHER_ACCENT_COLOR} />
                    <Text style={styles.radarButtonText}>
                      {t('modules.weather.viewRadar')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </VoiceFocusable>

            {/* 7-Day Forecast */}
            <VoiceFocusable
              id="forecast"
              label={t('modules.weather.forecast')}
              index={2}
              onSelect={() => handleTtsPress('forecast')}
            >
              <View style={styles.forecastCard}>
                <View style={styles.forecastHeader}>
                  <Text style={styles.forecastTitle}>{t('modules.weather.forecast')}</Text>
                  <TouchableOpacity
                    style={styles.ttsButtonSmall}
                    onPress={() => handleTtsPress('forecast')}
                  >
                    <MaterialCommunityIcons
                      name={isTtsPlaying && ttsSection === 'forecast' ? 'stop' : 'volume-high'}
                      size={20}
                      color={WEATHER_ACCENT_COLOR}
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {weather.daily.map((day, index) => (
                    <View key={index} style={styles.forecastDay}>
                      <Text style={styles.forecastDayName}>
                        {index === 0 ? t('modules.weather.today') :
                         index === 1 ? t('modules.weather.tomorrow') :
                         day.date.toLocaleDateString('nl', { weekday: 'short' })}
                      </Text>
                      <MaterialCommunityIcons
                        name={weatherService.getWeatherIcon(day.weatherCode, true)}
                        size={32}
                        color={WEATHER_ACCENT_COLOR}
                      />
                      <Text style={styles.forecastTempHigh}>{Math.round(day.temperatureMax)}°</Text>
                      <Text style={styles.forecastTempLow}>{Math.round(day.temperatureMin)}°</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </VoiceFocusable>

            {/* Saved Locations */}
            <View style={styles.locationsCard}>
              <View style={styles.locationsHeader}>
                <Text style={styles.locationsTitle}>{t('modules.weather.myLocations')}</Text>
                <TouchableOpacity
                  style={styles.addLocationButton}
                  onPress={() => setShowLocationSearch(true)}
                >
                  <MaterialCommunityIcons name="plus" size={24} color={WEATHER_ACCENT_COLOR} />
                  <Text style={styles.addLocationText}>{t('modules.weather.addLocation')}</Text>
                </TouchableOpacity>
              </View>

              {savedLocations.map((location, index) => (
                <TouchableOpacity
                  key={location.id}
                  style={[
                    styles.locationItem,
                    weather?.location.id === location.id && styles.locationItemActive,
                  ]}
                  onPress={() => handleLocationSelect(location)}
                  onLongPress={() => {/* TODO: Show delete confirmation */}}
                >
                  <MaterialCommunityIcons
                    name={location.isCurrentLocation ? 'crosshairs-gps' : 'star'}
                    size={20}
                    color={weather?.location.id === location.id ? 'white' : WEATHER_ACCENT_COLOR}
                  />
                  <Text
                    style={[
                      styles.locationItemText,
                      weather?.location.id === location.id && styles.locationItemTextActive,
                    ]}
                  >
                    {location.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Loading State */}
        {isLoading && !weather && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{t('modules.weather.loading')}</Text>
          </View>
        )}
      </ScrollView>

      {/* Location Search Modal */}
      <Modal visible={showLocationSearch} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('modules.weather.searchLocation')}</Text>
              <TouchableOpacity onPress={() => setShowLocationSearch(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder={t('modules.weather.searchPlaceholder')}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                void searchLocations(text);
              }}
              autoFocus
            />

            <ScrollView style={styles.searchResults}>
              {searchResults.map((result) => (
                <TouchableOpacity
                  key={result.id}
                  style={styles.searchResultItem}
                  onPress={() => handleLocationSelect(result)}
                >
                  <MaterialCommunityIcons name="map-marker" size={20} color={WEATHER_ACCENT_COLOR} />
                  <View style={styles.searchResultText}>
                    <Text style={styles.searchResultName}>{result.name}</Text>
                    <Text style={styles.searchResultCountry}>
                      {result.admin1 ? `${result.admin1}, ` : ''}{result.country}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Welcome Modal */}
      <Modal visible={showWelcome} animationType="fade" transparent>
        <View style={styles.welcomeOverlay}>
          <View style={styles.welcomeContent}>
            <MaterialCommunityIcons name="weather-partly-cloudy" size={64} color={WEATHER_ACCENT_COLOR} />
            <Text style={styles.welcomeTitle}>{t('modules.weather.welcome.title')}</Text>

            <View style={styles.welcomeSteps}>
              <Text style={styles.welcomeStep}>1. {t('modules.weather.welcome.step1')}</Text>
              <Text style={styles.welcomeStep}>2. {t('modules.weather.welcome.step2')}</Text>
              <Text style={styles.welcomeStep}>3. {t('modules.weather.welcome.step3')}</Text>
            </View>

            <TouchableOpacity
              style={styles.welcomeButton}
              onPress={handleWelcomeDismiss}
            >
              <Text style={styles.welcomeButtonText}>{t('modules.weather.welcome.understood')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Styles functie hier (voor leesbaarheid weggelaten)
function createStyles(colors, typography, spacing, touchTargets) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1 },
    // ... rest of styles
  });
}

export default WeatherScreen;
```

---

### Fase 3: i18n + Navigatie

#### 3.1 i18n Keys toevoegen

**Alle 5 taalbestanden updaten met:**

```json
{
  "modules": {
    "weather": {
      "title": "Weer",
      "loading": "Weerdata laden...",
      "selectLocation": "Selecteer locatie",
      "searchLocation": "Zoek locatie",
      "searchPlaceholder": "Voer plaatsnaam in...",
      "currentWeather": "Huidig weer",
      "feelsLike": "Voelt als",
      "rainPrediction": "Neerslagverwachting",
      "viewRadar": "Buienradar bekijken",
      "forecast": "7-daagse voorspelling",
      "today": "Vandaag",
      "tomorrow": "Morgen",
      "myLocations": "Mijn locaties",
      "addLocation": "Locatie toevoegen",
      "maxLocationsReached": "Maximum 10 locaties bereikt",
      "humidity": "Luchtvochtigheid",
      "windSpeed": "Windsnelheid",
      "sunrise": "Zonsopgang",
      "sunset": "Zonsondergang",
      "errors": {
        "network": "Kan weerdata niet ophalen. Controleer uw internetverbinding.",
        "locationNotFound": "Locatie niet gevonden."
      },
      "welcome": {
        "title": "Welkom bij Weer!",
        "step1": "Zoek een locatie om het weer te bekijken",
        "step2": "Tik op 'Voorlezen' om het weer te horen",
        "step3": "Sla maximaal 10 favoriete locaties op",
        "understood": "Begrepen"
      }
    }
  }
}
```

#### 3.2 Module Registratie

**Update `src/config/moduleRegistry.ts`:**

```typescript
// Voeg weather toe aan STATIC modules (niet land-specifiek)
{
  id: 'weather',
  labelKey: 'modules.weather.title',
  icon: 'weather-partly-cloudy',
  color: '#03A9F4',
}
```

**Update `src/components/WheelNavigationMenu.tsx`:**

```typescript
// Voeg weather toe aan STATIC_MODULE_DEFINITIONS
weather: {
  label: t('modules.weather.title'),
  icon: 'weather-partly-cloudy',
  color: '#03A9F4',
  screen: 'WeatherScreen',
},
```

---

### Fase 4: Testing Checklist

- [ ] **Functioneel**
  - [ ] Locatie zoeken werkt
  - [ ] Weer ophalen werkt
  - [ ] 7-daagse voorspelling toont correct
  - [ ] Regenvoorspelling toont correct
  - [ ] Locaties opslaan werkt (max 10)
  - [ ] Locaties verwijderen werkt
  - [ ] Pull-to-refresh werkt

- [ ] **TTS**
  - [ ] Huidige weer voorlezen werkt (Piper voor NL)
  - [ ] Voorspelling voorlezen werkt
  - [ ] Regenvoorspelling voorlezen werkt
  - [ ] Stop knop werkt

- [ ] **Accessibility**
  - [ ] VoiceOver labels correct
  - [ ] Touch targets ≥60pt
  - [ ] Contrast WCAG AAA
  - [ ] Dynamic Type ondersteund

- [ ] **Senior-Inclusive**
  - [ ] Tekst ≥18pt
  - [ ] Duidelijke foutmeldingen
  - [ ] Eenvoudige flow (max 3 stappen)

- [ ] **i18n**
  - [ ] Alle strings in 5 talen
  - [ ] Datum/tijd gelokaliseerd
  - [ ] Weerbeschrijvingen vertaald

---

## Benodigde Bestanden

| Bestand | Status | Beschrijving |
|---------|--------|--------------|
| `src/types/weather.ts` | Nieuw | Type definities |
| `src/services/weatherService.ts` | Nieuw | API service |
| `src/hooks/useWeather.ts` | Nieuw | React hook |
| `src/screens/modules/WeatherScreen.tsx` | Nieuw | Screen component |
| `src/screens/modules/index.ts` | Update | Export toevoegen |
| `src/locales/nl.json` | Update | i18n keys |
| `src/locales/en.json` | Update | i18n keys |
| `src/locales/de.json` | Update | i18n keys |
| `src/locales/fr.json` | Update | i18n keys |
| `src/locales/es.json` | Update | i18n keys |
| `src/config/moduleRegistry.ts` | Update | Module registratie |
| `src/components/WheelNavigationMenu.tsx` | Update | Navigatie |

---

## Volgende Stappen

1. **Types + Service implementeren** (Fase 1)
2. **Hook + Screen bouwen** (Fase 2)
3. **i18n + Navigatie configureren** (Fase 3)
4. **Testen en valideren** (Fase 4)
5. **Radar modal toevoegen** (optioneel, later)
