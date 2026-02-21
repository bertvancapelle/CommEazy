/**
 * Weather Service — Open-Meteo API Integration
 *
 * Fetches weather data and geocoding from Open-Meteo API.
 * Provides caching, location management, and TTS formatting.
 *
 * Features:
 * - Weather forecast (current + 7-day)
 * - Location geocoding search
 * - In-memory + AsyncStorage caching (15 min TTL)
 * - Saved locations management (max 10)
 * - TTS text formatting for all 5 languages
 *
 * @see .claude/plans/WEATHER_MODULE.md
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  WeatherData,
  WeatherLocation,
  CurrentWeather,
  DailyForecast,
  RainPrediction,
  GeocodingResponse,
  OpenMeteoWeatherResponse,
  WMO_WEATHER_CODES,
} from '@/types/weather';
import { WEATHER_MODULE_CONFIG } from '@/types/weather';

// ============================================================
// Constants
// ============================================================

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

const CACHE_KEY_PREFIX = 'weather_cache_';
const LOCATIONS_KEY = 'weather_saved_locations';
const FETCH_TIMEOUT_MS = 15000;

// ============================================================
// Types
// ============================================================

interface CacheEntry {
  data: WeatherData;
  fetchedAt: number;
}

// ============================================================
// Weather Service Implementation
// ============================================================

class WeatherServiceImpl {
  private memoryCache = new Map<string, CacheEntry>();

  // =====================
  // GEOCODING
  // =====================

  /**
   * Search for locations by name
   * @param query - Search query (min 2 characters)
   * @param language - Language for results (default: 'nl')
   * @param countryCode - Optional ISO 3166-1 alpha-2 country code to filter results (e.g., 'NL', 'DE')
   */
  async searchLocations(query: string, language: string = 'nl', countryCode?: string): Promise<WeatherLocation[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const url = new URL(OPEN_METEO_GEOCODING_URL);
    url.searchParams.set('name', query);
    url.searchParams.set('count', '10');
    url.searchParams.set('language', language.split('-')[0]); // Use base language code

    // Filter by country if provided
    if (countryCode) {
      url.searchParams.set('country', countryCode);
    }

    console.debug('[weatherService] Searching locations:', query);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CommEazy/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Geocoding failed: HTTP ${response.status}`);
      }

      const data: GeocodingResponse = await response.json();

      const locations: WeatherLocation[] = (data.results || []).map((result) => ({
        id: `${result.latitude},${result.longitude}`,
        name: result.name,
        country: result.country,
        admin1: result.admin1,
        admin2: result.admin2,
        latitude: result.latitude,
        longitude: result.longitude,
        isCurrentLocation: false,
        isFavorite: false,
      }));

      console.info('[weatherService] Found', locations.length, 'locations');
      return locations;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[weatherService] Search failed:', error);
      throw error;
    }
  }

  // =====================
  // WEATHER DATA
  // =====================

  /**
   * Fetch weather data for a location
   */
  async fetchWeather(location: WeatherLocation): Promise<WeatherData> {
    const cacheKey = `${location.latitude},${location.longitude}`;

    // Check memory cache
    const cached = this.memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < WEATHER_MODULE_CONFIG.cacheTtl) {
      console.debug('[weatherService] Memory cache hit for', location.name);
      return cached.data;
    }

    // Check AsyncStorage cache
    try {
      const storedCache = await AsyncStorage.getItem(CACHE_KEY_PREFIX + cacheKey);
      if (storedCache) {
        const parsed = JSON.parse(storedCache) as CacheEntry;
        if (Date.now() - parsed.fetchedAt < WEATHER_MODULE_CONFIG.cacheTtl) {
          console.debug('[weatherService] AsyncStorage cache hit for', location.name);
          // Also store in memory cache
          this.memoryCache.set(cacheKey, parsed);
          return this.rehydrateWeatherData(parsed.data);
        }
      }
    } catch (error) {
      console.warn('[weatherService] Cache read error:', error);
    }

    // Fetch from API
    console.info('[weatherService] Fetching weather for', location.name);

    const url = new URL(OPEN_METEO_FORECAST_URL);
    url.searchParams.set('latitude', String(location.latitude));
    url.searchParams.set('longitude', String(location.longitude));
    url.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,is_day'
    );
    url.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset'
    );
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '7');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CommEazy/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Weather fetch failed: HTTP ${response.status}`);
      }

      const data: OpenMeteoWeatherResponse = await response.json();
      const weatherData = this.parseWeatherResponse(data, location);

      // Update memory cache
      const cacheEntry: CacheEntry = {
        data: weatherData,
        fetchedAt: Date.now(),
      };
      this.memoryCache.set(cacheKey, cacheEntry);

      // Persist to AsyncStorage
      try {
        await AsyncStorage.setItem(CACHE_KEY_PREFIX + cacheKey, JSON.stringify(cacheEntry));
      } catch (error) {
        console.warn('[weatherService] Cache write error:', error);
      }

      console.info('[weatherService] Weather fetched successfully for', location.name);
      return weatherData;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[weatherService] Fetch failed:', error);

      // Try to return cached data even if stale
      const cached = this.memoryCache.get(cacheKey);
      if (cached) {
        console.warn('[weatherService] Returning stale cache');
        return cached.data;
      }

      throw error;
    }
  }

  /**
   * Parse Open-Meteo response to WeatherData
   */
  private parseWeatherResponse(
    data: OpenMeteoWeatherResponse,
    location: WeatherLocation
  ): WeatherData {
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

    const daily: DailyForecast[] = data.daily.time.map((date, i) => ({
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

  /**
   * Generate rain prediction from weather data
   */
  private generateRainPrediction(
    data: OpenMeteoWeatherResponse,
    current: CurrentWeather
  ): RainPrediction {
    const todayPrecip = data.daily.precipitation_sum[0];
    const todayProb = data.daily.precipitation_probability_max[0];

    // Base rain data always included
    const baseRainData = {
      precipitationMm: todayPrecip,
      precipitationProbability: todayProb,
    };

    if (current.precipitation > 0) {
      return {
        ...baseRainData,
        summary: 'raining_now',
        nextRainTime: new Date(),
        nextRainIntensity: current.precipitation > 5 ? 'heavy' : current.precipitation > 1 ? 'moderate' : 'light',
      };
    } else if (todayProb > 70) {
      return {
        ...baseRainData,
        summary: 'rain_expected',
        nextRainIntensity: todayPrecip > 10 ? 'heavy' : todayPrecip > 3 ? 'moderate' : 'light',
      };
    } else if (todayProb > 30) {
      return {
        ...baseRainData,
        summary: 'rain_possible',
      };
    } else {
      return {
        ...baseRainData,
        summary: 'dry_weather',
      };
    }
  }

  /**
   * Rehydrate dates from JSON storage
   */
  private rehydrateWeatherData(data: WeatherData): WeatherData {
    return {
      ...data,
      fetchedAt: new Date(data.fetchedAt),
      daily: data.daily.map((day) => ({
        ...day,
        date: new Date(day.date),
        sunrise: new Date(day.sunrise),
        sunset: new Date(day.sunset),
      })),
      rain: {
        ...data.rain,
        nextRainTime: data.rain.nextRainTime ? new Date(data.rain.nextRainTime) : undefined,
      },
    };
  }

  // =====================
  // SAVED LOCATIONS
  // =====================

  /**
   * Get saved locations from AsyncStorage
   */
  async getSavedLocations(): Promise<WeatherLocation[]> {
    try {
      const stored = await AsyncStorage.getItem(LOCATIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[weatherService] getSavedLocations error:', error);
      return [];
    }
  }

  /**
   * Save a location to favorites
   */
  async saveLocation(location: WeatherLocation): Promise<void> {
    const locations = await this.getSavedLocations();

    // Check max locations limit
    if (
      locations.length >= WEATHER_MODULE_CONFIG.maxLocations &&
      !locations.some((l) => l.id === location.id)
    ) {
      throw new Error('max_locations_reached');
    }

    // Update or add location
    const existingIndex = locations.findIndex((l) => l.id === location.id);
    if (existingIndex >= 0) {
      locations[existingIndex] = { ...location, isFavorite: true };
    } else {
      locations.push({ ...location, isFavorite: true });
    }

    await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
    console.info('[weatherService] Location saved:', location.name);
  }

  /**
   * Remove a location from favorites
   */
  async removeLocation(locationId: string): Promise<void> {
    const locations = await this.getSavedLocations();
    const filtered = locations.filter((l) => l.id !== locationId);
    await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(filtered));
    console.info('[weatherService] Location removed:', locationId);
  }

  // =====================
  // TTS FORMATTING
  // =====================

  /**
   * Format current weather for TTS
   * Includes: location, temperature, feels like, condition, precipitation (mm + %), humidity, wind speed
   */
  formatCurrentWeatherForTts(weather: WeatherData, language: string): string {
    const condition = this.getWeatherDescription(weather.current.weatherCode, language);
    const temp = Math.round(weather.current.temperature);
    const feelsLike = Math.round(weather.current.feelsLike);
    const humidity = weather.current.humidity;

    // Wind speed: mph for English, km/h for others
    const langCode = language.split('-')[0].toLowerCase();
    const windSpeed = Math.round(weather.current.windSpeed);
    const windSpeedMph = Math.round(weather.current.windSpeed * 0.621371);

    // Precipitation data
    const precipMm = weather.rain.precipitationMm ?? 0;
    const precipProb = weather.rain.precipitationProbability ?? 0;

    // Build precipitation text per language
    const getPrecipText = (): string => {
      if (precipMm === 0 && precipProb === 0) {
        switch (langCode) {
          case 'nl': return 'Geen neerslag verwacht';
          case 'de': return 'Kein Niederschlag erwartet';
          case 'fr': return 'Pas de précipitations prévues';
          case 'es': return 'No se esperan precipitaciones';
          case 'it': return 'Nessuna precipitazione prevista';
          case 'no': return 'Ingen nedbør forventet';
          case 'sv': return 'Ingen nederbörd förväntas';
          case 'da': return 'Ingen nedbør forventet';
          case 'pt': return 'Sem precipitação prevista';
          default: return 'No precipitation expected';
        }
      }

      switch (langCode) {
        case 'nl': return `Neerslag: ${precipMm.toFixed(1)} millimeter, ${precipProb} procent kans`;
        case 'de': return `Niederschlag: ${precipMm.toFixed(1)} Millimeter, ${precipProb} Prozent Wahrscheinlichkeit`;
        case 'fr': return `Précipitations: ${precipMm.toFixed(1)} millimètres, ${precipProb} pour cent de chance`;
        case 'es': return `Precipitación: ${precipMm.toFixed(1)} milímetros, ${precipProb} por ciento de probabilidad`;
        case 'it': return `Precipitazioni: ${precipMm.toFixed(1)} millimetri, ${precipProb} percento di probabilità`;
        case 'no': return `Nedbør: ${precipMm.toFixed(1)} millimeter, ${precipProb} prosent sjanse`;
        case 'sv': return `Nederbörd: ${precipMm.toFixed(1)} millimeter, ${precipProb} procent chans`;
        case 'da': return `Nedbør: ${precipMm.toFixed(1)} millimeter, ${precipProb} procent chance`;
        case 'pt': return `Precipitação: ${precipMm.toFixed(1)} milímetros, ${precipProb} por cento de chance`;
        default: return `Precipitation: ${precipMm.toFixed(1)} millimeters, ${precipProb} percent chance`;
      }
    };

    const precipText = getPrecipText();

    switch (langCode) {
      case 'nl':
        return `Het weer in ${weather.location.name}. Het is nu ${temp} graden, voelt als ${feelsLike} graden, ${condition}. ${precipText}. De luchtvochtigheid is ${humidity} procent. De wind is ${windSpeed} kilometer per uur.`;
      case 'de':
        return `Das Wetter in ${weather.location.name}. Es sind jetzt ${temp} Grad, gefühlt ${feelsLike} Grad, ${condition}. ${precipText}. Die Luftfeuchtigkeit beträgt ${humidity} Prozent. Der Wind weht mit ${windSpeed} Kilometer pro Stunde.`;
      case 'fr':
        return `La météo à ${weather.location.name}. Il fait actuellement ${temp} degrés, ressenti ${feelsLike} degrés, ${condition}. ${precipText}. L'humidité est de ${humidity} pour cent. Le vent souffle à ${windSpeed} kilomètres par heure.`;
      case 'es':
        return `El tiempo en ${weather.location.name}. Actualmente ${temp} grados, sensación de ${feelsLike} grados, ${condition}. ${precipText}. La humedad es del ${humidity} por ciento. El viento sopla a ${windSpeed} kilómetros por hora.`;
      case 'it':
        return `Il meteo a ${weather.location.name}. Attualmente ${temp} gradi, percepiti ${feelsLike} gradi, ${condition}. ${precipText}. L'umidità è del ${humidity} percento. Il vento soffia a ${windSpeed} chilometri orari.`;
      case 'no':
        return `Været i ${weather.location.name}. Det er nå ${temp} grader, føles som ${feelsLike} grader, ${condition}. ${precipText}. Luftfuktigheten er ${humidity} prosent. Vinden er ${windSpeed} kilometer i timen.`;
      case 'sv':
        return `Vädret i ${weather.location.name}. Det är nu ${temp} grader, känns som ${feelsLike} grader, ${condition}. ${precipText}. Luftfuktigheten är ${humidity} procent. Vinden är ${windSpeed} kilometer i timmen.`;
      case 'da':
        return `Vejret i ${weather.location.name}. Det er nu ${temp} grader, føles som ${feelsLike} grader, ${condition}. ${precipText}. Luftfugtigheden er ${humidity} procent. Vinden er ${windSpeed} kilometer i timen.`;
      case 'pt':
        return `O tempo em ${weather.location.name}. Atualmente ${temp} graus, sensação de ${feelsLike} graus, ${condition}. ${precipText}. A umidade é de ${humidity} por cento. O vento sopra a ${windSpeed} quilômetros por hora.`;
      default: // en - uses mph for wind
        return `Weather in ${weather.location.name}. Currently ${temp} degrees, feels like ${feelsLike} degrees, ${condition}. ${precipText}. Humidity ${humidity} percent. Wind speed ${windSpeedMph} miles per hour.`;
    }
  }

  /**
   * Format 7-day forecast for TTS
   */
  formatForecastForTts(weather: WeatherData, language: string): string {
    const langCode = language.split('-')[0].toLowerCase();

    const lines = weather.daily.slice(0, 7).map((day, i) => {
      const dayName = this.getDayName(day.date, language, i);
      const condition = this.getWeatherDescription(day.weatherCode, language);
      const high = Math.round(day.temperatureMax);
      const low = Math.round(day.temperatureMin);

      switch (langCode) {
        case 'nl':
          return `${dayName}: ${high} graden, ${low} graden 's nachts, ${condition}`;
        case 'de':
          return `${dayName}: ${high} Grad, nachts ${low} Grad, ${condition}`;
        case 'fr':
          return `${dayName}: ${high} degrés, ${low} degrés la nuit, ${condition}`;
        case 'es':
          return `${dayName}: ${high} grados, ${low} grados de noche, ${condition}`;
        default:
          return `${dayName}: ${high} degrees, low ${low}, ${condition}`;
      }
    });

    const intro = {
      nl: 'Vooruitzicht voor de komende week.',
      de: 'Wettervorhersage für die nächste Woche.',
      fr: 'Prévisions pour la semaine à venir.',
      es: 'Pronóstico para la próxima semana.',
      en: 'Forecast for the coming week.',
    };

    return `${intro[langCode as keyof typeof intro] || intro.en} ${lines.join('. ')}.`;
  }

  /**
   * Format rain prediction for TTS
   */
  formatRainForTts(weather: WeatherData, language: string): string {
    const rainSummary = this.getRainSummary(weather.rain.summary, language);
    const langCode = language.split('-')[0].toLowerCase();

    const prefix = {
      nl: 'Neerslagverwachting:',
      de: 'Niederschlagsvorhersage:',
      fr: 'Prévisions de précipitations :',
      es: 'Pronóstico de precipitaciones:',
      en: 'Precipitation forecast:',
    };

    // Add mm info if rain is expected
    let mmInfo = '';
    if (weather.rain.precipitationMm !== undefined && weather.rain.precipitationMm > 0) {
      const mmText = {
        nl: `Verwachte hoeveelheid: ${weather.rain.precipitationMm.toFixed(1)} millimeter`,
        de: `Erwartete Menge: ${weather.rain.precipitationMm.toFixed(1)} Millimeter`,
        fr: `Quantité prévue : ${weather.rain.precipitationMm.toFixed(1)} millimètres`,
        es: `Cantidad esperada: ${weather.rain.precipitationMm.toFixed(1)} milímetros`,
        en: `Expected amount: ${weather.rain.precipitationMm.toFixed(1)} millimeters`,
      };
      mmInfo = ` ${mmText[langCode as keyof typeof mmText] || mmText.en}.`;
    }

    return `${prefix[langCode as keyof typeof prefix] || prefix.en} ${rainSummary}.${mmInfo}`;
  }

  /**
   * Get weather description from WMO code
   */
  getWeatherDescription(code: number, language: string): string {
    const langCode = language.split('-')[0].toLowerCase();

    // WMO weather codes mapping
    const descriptions: Record<number, Record<string, string>> = {
      0: { nl: 'helder', en: 'clear', de: 'klar', fr: 'dégagé', es: 'despejado' },
      1: { nl: 'overwegend helder', en: 'mainly clear', de: 'überwiegend klar', fr: 'principalement dégagé', es: 'mayormente despejado' },
      2: { nl: 'gedeeltelijk bewolkt', en: 'partly cloudy', de: 'teilweise bewölkt', fr: 'partiellement nuageux', es: 'parcialmente nublado' },
      3: { nl: 'bewolkt', en: 'overcast', de: 'bedeckt', fr: 'couvert', es: 'nublado' },
      45: { nl: 'mistig', en: 'fog', de: 'Nebel', fr: 'brouillard', es: 'niebla' },
      48: { nl: 'ijsmist', en: 'freezing fog', de: 'Eisnebel', fr: 'brouillard givrant', es: 'niebla helada' },
      51: { nl: 'lichte motregen', en: 'light drizzle', de: 'leichter Nieselregen', fr: 'bruine légère', es: 'llovizna ligera' },
      53: { nl: 'motregen', en: 'drizzle', de: 'Nieselregen', fr: 'bruine', es: 'llovizna' },
      55: { nl: 'zware motregen', en: 'heavy drizzle', de: 'starker Nieselregen', fr: 'forte bruine', es: 'llovizna intensa' },
      61: { nl: 'lichte regen', en: 'light rain', de: 'leichter Regen', fr: 'pluie légère', es: 'lluvia ligera' },
      63: { nl: 'regen', en: 'rain', de: 'Regen', fr: 'pluie', es: 'lluvia' },
      65: { nl: 'zware regen', en: 'heavy rain', de: 'starker Regen', fr: 'forte pluie', es: 'lluvia intensa' },
      71: { nl: 'lichte sneeuw', en: 'light snow', de: 'leichter Schnee', fr: 'neige légère', es: 'nieve ligera' },
      73: { nl: 'sneeuw', en: 'snow', de: 'Schnee', fr: 'neige', es: 'nieve' },
      75: { nl: 'zware sneeuw', en: 'heavy snow', de: 'starker Schnee', fr: 'forte neige', es: 'nieve intensa' },
      80: { nl: 'lichte buien', en: 'light showers', de: 'leichte Schauer', fr: 'averses légères', es: 'chubascos ligeros' },
      81: { nl: 'buien', en: 'showers', de: 'Schauer', fr: 'averses', es: 'chubascos' },
      82: { nl: 'zware buien', en: 'heavy showers', de: 'starke Schauer', fr: 'fortes averses', es: 'chubascos intensos' },
      95: { nl: 'onweer', en: 'thunderstorm', de: 'Gewitter', fr: 'orage', es: 'tormenta' },
    };

    const desc = descriptions[code];
    if (desc) {
      return desc[langCode] || desc.en;
    }

    return { nl: 'onbekend', en: 'unknown', de: 'unbekannt', fr: 'inconnu', es: 'desconocido' }[langCode] || 'unknown';
  }

  /**
   * Get rain summary text in language
   */
  getRainSummary(summaryKey: string, language: string): string {
    const langCode = language.split('-')[0].toLowerCase();

    const summaries: Record<string, Record<string, string>> = {
      raining_now: {
        nl: 'Het regent momenteel',
        de: 'Es regnet gerade',
        fr: 'Il pleut actuellement',
        es: 'Está lloviendo ahora',
        en: 'It is currently raining',
      },
      rain_expected: {
        nl: 'Regen verwacht vandaag',
        de: 'Regen erwartet heute',
        fr: 'Pluie attendue aujourd\'hui',
        es: 'Se espera lluvia hoy',
        en: 'Rain expected today',
      },
      rain_possible: {
        nl: 'Kans op regen vandaag',
        de: 'Regenwahrscheinlichkeit heute',
        fr: 'Risque de pluie aujourd\'hui',
        es: 'Posibilidad de lluvia hoy',
        en: 'Chance of rain today',
      },
      dry_weather: {
        nl: 'Droog weer verwacht',
        de: 'Trockenes Wetter erwartet',
        fr: 'Temps sec attendu',
        es: 'Se espera tiempo seco',
        en: 'Dry weather expected',
      },
    };

    const summary = summaries[summaryKey];
    if (summary) {
      return summary[langCode] || summary.en;
    }

    return summaryKey;
  }

  /**
   * Get day name for forecast
   */
  private getDayName(date: Date, language: string, dayIndex: number): string {
    const langCode = language.split('-')[0].toLowerCase();

    if (dayIndex === 0) {
      return { nl: 'Vandaag', de: 'Heute', fr: "Aujourd'hui", es: 'Hoy', en: 'Today' }[langCode] || 'Today';
    }
    if (dayIndex === 1) {
      return { nl: 'Morgen', de: 'Morgen', fr: 'Demain', es: 'Mañana', en: 'Tomorrow' }[langCode] || 'Tomorrow';
    }

    return date.toLocaleDateString(language, { weekday: 'long' });
  }

  // =====================
  // WEATHER ICONS
  // =====================

  /**
   * Get MaterialCommunityIcons name for weather code
   */
  getWeatherIcon(code: number, isDay: boolean): string {
    const iconMap: Record<number, { day: string; night: string }> = {
      0: { day: 'weather-sunny', night: 'weather-night' },
      1: { day: 'weather-partly-cloudy', night: 'weather-night-partly-cloudy' },
      2: { day: 'weather-partly-cloudy', night: 'weather-night-partly-cloudy' },
      3: { day: 'weather-cloudy', night: 'weather-cloudy' },
      45: { day: 'weather-fog', night: 'weather-fog' },
      48: { day: 'weather-fog', night: 'weather-fog' },
      51: { day: 'weather-rainy', night: 'weather-rainy' },
      53: { day: 'weather-rainy', night: 'weather-rainy' },
      55: { day: 'weather-pouring', night: 'weather-pouring' },
      61: { day: 'weather-rainy', night: 'weather-rainy' },
      63: { day: 'weather-rainy', night: 'weather-rainy' },
      65: { day: 'weather-pouring', night: 'weather-pouring' },
      71: { day: 'weather-snowy', night: 'weather-snowy' },
      73: { day: 'weather-snowy', night: 'weather-snowy' },
      75: { day: 'weather-snowy-heavy', night: 'weather-snowy-heavy' },
      80: { day: 'weather-rainy', night: 'weather-rainy' },
      81: { day: 'weather-pouring', night: 'weather-pouring' },
      82: { day: 'weather-pouring', night: 'weather-pouring' },
      95: { day: 'weather-lightning-rainy', night: 'weather-lightning-rainy' },
    };

    const icons = iconMap[code] || { day: 'weather-cloudy', night: 'weather-cloudy' };
    return isDay ? icons.day : icons.night;
  }

  // =====================
  // CACHE MANAGEMENT
  // =====================

  /**
   * Clear all weather cache
   */
  async clearCache(): Promise<void> {
    this.memoryCache.clear();

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const weatherKeys = allKeys.filter((key) => key.startsWith(CACHE_KEY_PREFIX));
      await AsyncStorage.multiRemove(weatherKeys);
      console.debug('[weatherService] Cache cleared');
    } catch (error) {
      console.error('[weatherService] Cache clear error:', error);
    }
  }

  /**
   * Get debug info
   */
  getDebugInfo(): {
    memoryCacheSize: number;
    cachedLocations: string[];
  } {
    return {
      memoryCacheSize: this.memoryCache.size,
      cachedLocations: Array.from(this.memoryCache.keys()),
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const weatherService = new WeatherServiceImpl();
