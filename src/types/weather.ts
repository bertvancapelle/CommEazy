/**
 * Weather Module Types
 *
 * Type definitions for the weather module.
 * Uses Open-Meteo API for weather data and geocoding.
 *
 * @see .claude/plans/WEATHER_MODULE.md
 */

// ============================================================
// Location Types
// ============================================================

/**
 * A weather location (either GPS or saved favorite)
 */
export interface WeatherLocation {
  /** Unique ID (format: "latitude,longitude") */
  id: string;

  /** Place name (e.g., "Amsterdam") */
  name: string;

  /** Country name (e.g., "Netherlands") */
  country: string;

  /** Province/state (e.g., "Noord-Holland") */
  admin1?: string;

  /** District/municipality (e.g., "Gemeente Amsterdam") */
  admin2?: string;

  /** Latitude coordinate */
  latitude: number;

  /** Longitude coordinate */
  longitude: number;

  /** Whether this is the current GPS location */
  isCurrentLocation: boolean;

  /** Whether this is a saved favorite */
  isFavorite: boolean;
}

// ============================================================
// Current Weather
// ============================================================

/**
 * Current weather conditions
 */
export interface CurrentWeather {
  /** Temperature in Celsius */
  temperature: number;

  /** Feels-like temperature in Celsius */
  feelsLike: number;

  /** Relative humidity percentage */
  humidity: number;

  /** Wind speed in km/h */
  windSpeed: number;

  /** Wind direction in degrees */
  windDirection: number;

  /** WMO weather interpretation code */
  weatherCode: number;

  /** Whether it's currently daytime */
  isDay: boolean;

  /** Current precipitation in mm */
  precipitation: number;
}

// ============================================================
// Daily Forecast
// ============================================================

/**
 * Daily weather forecast
 */
export interface DailyForecast {
  /** Forecast date */
  date: Date;

  /** WMO weather interpretation code */
  weatherCode: number;

  /** Maximum temperature in Celsius */
  temperatureMax: number;

  /** Minimum temperature in Celsius */
  temperatureMin: number;

  /** Total precipitation in mm */
  precipitationSum: number;

  /** Maximum precipitation probability (0-100) */
  precipitationProbability: number;

  /** Sunrise time */
  sunrise: Date;

  /** Sunset time */
  sunset: Date;
}

// ============================================================
// Rain Prediction
// ============================================================

/**
 * Rain intensity levels
 */
export type RainIntensity = 'light' | 'moderate' | 'heavy';

/**
 * Rain prediction summary
 */
export interface RainPrediction {
  /** Human-readable summary (e.g., "Droog tot 15:00, daarna lichte regen") */
  summary: string;

  /** Next expected rain time (if any) */
  nextRainTime?: Date;

  /** Expected rain intensity */
  nextRainIntensity?: RainIntensity;

  /** Expected precipitation amount in mm (today) */
  precipitationMm?: number;

  /** Precipitation probability percentage (0-100) */
  precipitationProbability?: number;
}

// ============================================================
// Weather Data (Complete)
// ============================================================

/**
 * Complete weather data for a location
 */
export interface WeatherData {
  /** Location information */
  location: WeatherLocation;

  /** Current weather conditions */
  current: CurrentWeather;

  /** 7-day forecast */
  daily: DailyForecast[];

  /** Rain prediction */
  rain: RainPrediction;

  /** When the data was fetched */
  fetchedAt: Date;
}

// ============================================================
// Module Configuration
// ============================================================

/**
 * Weather module configuration constants
 */
export interface WeatherModuleConfig {
  /** Module ID */
  id: 'weather';

  /** Accent color (Sky Blue) */
  accentColor: '#03A9F4';

  /** Module icon name */
  icon: 'weather-partly-cloudy';

  /** Cache TTL in milliseconds (15 minutes) */
  cacheTtl: 900000;

  /** Maximum saved locations */
  maxLocations: 10;
}

/**
 * Default weather module configuration
 */
export const WEATHER_MODULE_CONFIG: WeatherModuleConfig = {
  id: 'weather',
  accentColor: '#03A9F4',
  icon: 'weather-partly-cloudy',
  cacheTtl: 15 * 60 * 1000, // 15 minutes
  maxLocations: 10,
};

// ============================================================
// API Response Types (Open-Meteo)
// ============================================================

/**
 * Open-Meteo geocoding result
 */
export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  admin1?: string;
  admin2?: string;
  timezone: string;
}

/**
 * Open-Meteo geocoding API response
 */
export interface GeocodingResponse {
  results?: GeocodingResult[];
}

/**
 * Open-Meteo weather API response (current section)
 */
export interface OpenMeteoCurrentResponse {
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  precipitation: number;
  is_day: number;
}

/**
 * Open-Meteo weather API response (daily section)
 */
export interface OpenMeteoDailyResponse {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  sunrise: string[];
  sunset: string[];
}

/**
 * Open-Meteo weather API response
 */
export interface OpenMeteoWeatherResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current: OpenMeteoCurrentResponse;
  daily: OpenMeteoDailyResponse;
}

// ============================================================
// TTS Section Types
// ============================================================

/**
 * Weather TTS section types
 */
export type WeatherTtsSection = 'current' | 'forecast' | 'rain';

// ============================================================
// Weather Icon Mapping
// ============================================================

/**
 * WMO weather code to description mapping
 */
export interface WeatherCodeDescription {
  nl: string;
  en: string;
  de: string;
  fr: string;
  es: string;
}

/**
 * WMO weather codes and their meanings
 * @see https://open-meteo.com/en/docs
 */
export const WMO_WEATHER_CODES: Record<number, WeatherCodeDescription> = {
  0: { nl: 'helder', en: 'clear', de: 'klar', fr: 'dégagé', es: 'despejado' },
  1: { nl: 'overwegend helder', en: 'mainly clear', de: 'überwiegend klar', fr: 'principalement dégagé', es: 'mayormente despejado' },
  2: { nl: 'gedeeltelijk bewolkt', en: 'partly cloudy', de: 'teilweise bewölkt', fr: 'partiellement nuageux', es: 'parcialmente nublado' },
  3: { nl: 'bewolkt', en: 'overcast', de: 'bedeckt', fr: 'couvert', es: 'nublado' },
  45: { nl: 'mistig', en: 'fog', de: 'Nebel', fr: 'brouillard', es: 'niebla' },
  48: { nl: 'ijsmist', en: 'freezing fog', de: 'Eisnebel', fr: 'brouillard givrant', es: 'niebla helada' },
  51: { nl: 'lichte motregen', en: 'light drizzle', de: 'leichter Nieselregen', fr: 'bruine légère', es: 'llovizna ligera' },
  53: { nl: 'motregen', en: 'drizzle', de: 'Nieselregen', fr: 'bruine', es: 'llovizna' },
  55: { nl: 'zware motregen', en: 'heavy drizzle', de: 'starker Nieselregen', fr: 'forte bruine', es: 'llovizna intensa' },
  56: { nl: 'lichte ijzel', en: 'light freezing drizzle', de: 'leichter gefrierender Nieselregen', fr: 'bruine verglaçante légère', es: 'llovizna helada ligera' },
  57: { nl: 'ijzel', en: 'freezing drizzle', de: 'gefrierender Nieselregen', fr: 'bruine verglaçante', es: 'llovizna helada' },
  61: { nl: 'lichte regen', en: 'light rain', de: 'leichter Regen', fr: 'pluie légère', es: 'lluvia ligera' },
  63: { nl: 'regen', en: 'rain', de: 'Regen', fr: 'pluie', es: 'lluvia' },
  65: { nl: 'zware regen', en: 'heavy rain', de: 'starker Regen', fr: 'forte pluie', es: 'lluvia intensa' },
  66: { nl: 'lichte ijsregen', en: 'light freezing rain', de: 'leichter gefrierender Regen', fr: 'pluie verglaçante légère', es: 'lluvia helada ligera' },
  67: { nl: 'ijsregen', en: 'freezing rain', de: 'gefrierender Regen', fr: 'pluie verglaçante', es: 'lluvia helada' },
  71: { nl: 'lichte sneeuw', en: 'light snow', de: 'leichter Schnee', fr: 'neige légère', es: 'nieve ligera' },
  73: { nl: 'sneeuw', en: 'snow', de: 'Schnee', fr: 'neige', es: 'nieve' },
  75: { nl: 'zware sneeuw', en: 'heavy snow', de: 'starker Schnee', fr: 'forte neige', es: 'nieve intensa' },
  77: { nl: 'sneeuwkorrels', en: 'snow grains', de: 'Schneekörner', fr: 'grains de neige', es: 'granos de nieve' },
  80: { nl: 'lichte buien', en: 'light showers', de: 'leichte Schauer', fr: 'averses légères', es: 'chubascos ligeros' },
  81: { nl: 'buien', en: 'showers', de: 'Schauer', fr: 'averses', es: 'chubascos' },
  82: { nl: 'zware buien', en: 'heavy showers', de: 'starke Schauer', fr: 'fortes averses', es: 'chubascos intensos' },
  85: { nl: 'lichte sneeuwbuien', en: 'light snow showers', de: 'leichte Schneeschauer', fr: 'averses de neige légères', es: 'chubascos de nieve ligeros' },
  86: { nl: 'sneeuwbuien', en: 'snow showers', de: 'Schneeschauer', fr: 'averses de neige', es: 'chubascos de nieve' },
  95: { nl: 'onweer', en: 'thunderstorm', de: 'Gewitter', fr: 'orage', es: 'tormenta' },
  96: { nl: 'onweer met lichte hagel', en: 'thunderstorm with light hail', de: 'Gewitter mit leichtem Hagel', fr: 'orage avec grêle légère', es: 'tormenta con granizo ligero' },
  99: { nl: 'onweer met zware hagel', en: 'thunderstorm with heavy hail', de: 'Gewitter mit schwerem Hagel', fr: 'orage avec forte grêle', es: 'tormenta con granizo intenso' },
};

// ============================================================
// Unified Radar Types (supports multiple providers)
// ============================================================

/**
 * A single radar frame (past or forecast)
 * Used by both OpenWeatherMap and RainViewer providers
 */
export interface RadarFrame {
  /** Unix timestamp (seconds) */
  time: number;

  /** Full tile URL template with {z}, {x}, {y} placeholders */
  path: string;
}

/**
 * Radar provider configuration
 */
export interface RadarProviderConfig {
  /** Cache TTL in milliseconds (10 minutes) */
  cacheTtl: number;

  /** RainViewer API URL (fallback) */
  rainViewerApiUrl: string;

  /** Default map zoom level */
  defaultZoom: number;

  /** Max tile zoom level (OWM limit: 7, RainViewer: 12) */
  maxTileZoom: number;

  /** Tile opacity (0-1) */
  tileOpacity: number;
}

/**
 * Default radar provider configuration
 */
export const RADAR_PROVIDER_CONFIG: RadarProviderConfig = {
  cacheTtl: 10 * 60 * 1000, // 10 minutes
  rainViewerApiUrl: 'https://api.rainviewer.com/public/weather-maps.json',
  defaultZoom: 7, // Good for regional view (~200km), within OWM limit
  maxTileZoom: 12, // RainViewer supports up to 12
  tileOpacity: 0.85, // Increased for better visibility
};

// ============================================================
// Legacy RainViewer Types (for backward compatibility)
// ============================================================

/**
 * @deprecated Use RadarFrame instead
 */
export interface RainViewerFrame {
  /** Unix timestamp (seconds) */
  time: number;

  /** Tile path segment (e.g., "/radar/1234567890/256/{z}/{x}/{y}/2/1_1.png") */
  path: string;
}

/**
 * RainViewer API radar section
 */
export interface RainViewerRadar {
  /** Past radar frames (~12 frames, 2 hours history) */
  past: RainViewerFrame[];

  /** Nowcast/forecast frames (~6 frames, 30 min forecast) */
  nowcast: RainViewerFrame[];
}

/**
 * RainViewer API response (weather-maps.json)
 */
export interface RainViewerData {
  /** API version */
  version: string;

  /** Unix timestamp when data was generated */
  generated: number;

  /** Host URL for tiles (e.g., "https://tilecache.rainviewer.com") */
  host: string;

  /** Radar data */
  radar: RainViewerRadar;
}

/**
 * RainViewer tile configuration options
 */
export interface RainViewerTileOptions {
  /** Tile size (256 or 512) */
  size: 256 | 512;

  /**
   * Color scheme
   * 1 = Original
   * 2 = Universal Blue
   * 3 = TITAN
   * 4 = The Weather Channel
   * 5 = Meteored
   * 6 = NEXRAD Level III
   * 7 = Rainbow @ SELEX-SI
   * 8 = Dark Sky
   */
  color: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

  /** Smooth rendering (0 = off, 1 = on) */
  smooth: 0 | 1;

  /** Snow detection (0 = off, 1 = on) */
  snow: 0 | 1;
}

/**
 * Default radar tile options
 */
export const DEFAULT_RADAR_TILE_OPTIONS: RainViewerTileOptions = {
  size: 256,
  color: 2, // Universal Blue - best visibility
  smooth: 1,
  snow: 1,
};

/**
 * @deprecated Use RADAR_PROVIDER_CONFIG instead
 */
export interface RadarModuleConfig {
  /** Cache TTL in milliseconds (10 minutes) */
  cacheTtl: number;

  /** API URL */
  apiUrl: string;

  /** Default map zoom level */
  defaultZoom: number;

  /** Max tile zoom level */
  maxTileZoom: number;

  /** Tile opacity (0-1) */
  tileOpacity: number;
}

/**
 * @deprecated Use RADAR_PROVIDER_CONFIG instead
 */
export const RADAR_MODULE_CONFIG: RadarModuleConfig = {
  cacheTtl: 10 * 60 * 1000, // 10 minutes
  apiUrl: 'https://api.rainviewer.com/public/weather-maps.json',
  defaultZoom: 7, // Good for regional view (~200km)
  maxTileZoom: 12,
  tileOpacity: 0.7,
};
