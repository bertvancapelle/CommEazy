/**
 * Radar Service
 *
 * Unified radar tile service that supports multiple providers:
 * - OpenWeatherMap: 2 hour forecast (Europe), requires API key
 * - RainViewer: 30 min forecast, no API key required (fallback)
 *
 * Features:
 * - Generate radar tile URLs with timestamps
 * - Calculate available time frames (past + forecast)
 * - 10-minute memory cache
 * - Automatic fallback to RainViewer if OWM fails
 *
 * @see https://openweathermap.org/api/global-precipitation-map-forecast
 * @see https://www.rainviewer.com/api.html
 */

import { RADAR_PROVIDER_CONFIG, RadarFrame } from '@/types/weather';

// ============================================================
// Types
// ============================================================

export type RadarProvider = 'openweathermap' | 'rainviewer';

export interface RadarServiceConfig {
  /** Active provider */
  provider: RadarProvider;

  /** OpenWeatherMap API key (required for OWM provider) */
  owmApiKey?: string;

  /** Past duration in minutes (default: 120 = 2 hours) */
  pastMinutes: number;

  /** Forecast duration in minutes (default: 120 = 2 hours for OWM, 30 for RainViewer) */
  forecastMinutes: number;

  /** Frame interval in minutes (default: 10) */
  frameIntervalMinutes: number;
}

export interface RadarData {
  /** All available frames (past + forecast) */
  frames: RadarFrame[];

  /** Active provider */
  provider: RadarProvider;

  /** When data was generated */
  generated: number;
}

// ============================================================
// Configuration
// ============================================================

const DEFAULT_CONFIG: RadarServiceConfig = {
  provider: 'openweathermap',
  owmApiKey: undefined, // Must be set in environment or config
  pastMinutes: 120, // 2 hours
  forecastMinutes: 120, // 2 hours (OWM Europe limit)
  frameIntervalMinutes: 10,
};

let config: RadarServiceConfig = { ...DEFAULT_CONFIG };

/**
 * Configure the radar service
 */
export function configureRadarService(newConfig: Partial<RadarServiceConfig>): void {
  config = { ...config, ...newConfig };
  console.info('[radarService] Configuration updated:', {
    provider: config.provider,
    hasApiKey: !!config.owmApiKey,
    pastMinutes: config.pastMinutes,
    forecastMinutes: config.forecastMinutes,
  });
}

// ============================================================
// Cache Management
// ============================================================

interface CacheEntry {
  data: RadarData;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

function isCacheValid(): boolean {
  if (!cache) return false;
  const now = Date.now();
  return now - cache.fetchedAt < RADAR_PROVIDER_CONFIG.cacheTtl;
}

export function clearRadarCache(): void {
  cache = null;
  console.debug('[radarService] Cache cleared');
}

// ============================================================
// Frame Generation
// ============================================================

/**
 * Round timestamp to nearest 10-minute interval
 */
function roundToInterval(timestamp: number, intervalMinutes: number): number {
  const intervalSeconds = intervalMinutes * 60;
  return Math.floor(timestamp / intervalSeconds) * intervalSeconds;
}

/**
 * Generate frame timestamps for past + forecast
 */
function generateFrameTimestamps(
  pastMinutes: number,
  forecastMinutes: number,
  intervalMinutes: number
): number[] {
  const now = Math.floor(Date.now() / 1000);
  const roundedNow = roundToInterval(now, intervalMinutes);
  const intervalSeconds = intervalMinutes * 60;

  const timestamps: number[] = [];

  // Past frames
  const pastFrameCount = Math.floor(pastMinutes / intervalMinutes);
  for (let i = pastFrameCount; i > 0; i--) {
    timestamps.push(roundedNow - i * intervalSeconds);
  }

  // Current frame
  timestamps.push(roundedNow);

  // Forecast frames
  const forecastFrameCount = Math.floor(forecastMinutes / intervalMinutes);
  for (let i = 1; i <= forecastFrameCount; i++) {
    timestamps.push(roundedNow + i * intervalSeconds);
  }

  return timestamps;
}

// ============================================================
// OpenWeatherMap Provider
// ============================================================

/**
 * Generate OpenWeatherMap radar tile URL
 *
 * URL format: https://maps.openweathermap.org/maps/2.0/radar/forecast/{z}/{x}/{y}?appid={key}&tm={timestamp}
 */
function getOWMTileUrl(timestamp: number, apiKey: string): string {
  // Note: {z}, {x}, {y} are placeholders for Leaflet
  return `https://maps.openweathermap.org/maps/2.0/radar/forecast/{z}/{x}/{y}?appid=${apiKey}&tm=${timestamp}`;
}

/**
 * Generate frames for OpenWeatherMap provider
 */
function generateOWMFrames(apiKey: string): RadarFrame[] {
  const timestamps = generateFrameTimestamps(
    config.pastMinutes,
    config.forecastMinutes,
    config.frameIntervalMinutes
  );

  return timestamps.map((time) => ({
    time,
    path: getOWMTileUrl(time, apiKey),
  }));
}

// ============================================================
// RainViewer Provider (Fallback)
// ============================================================

interface RainViewerApiResponse {
  version: string;
  generated: number;
  host: string;
  radar: {
    past: Array<{ time: number; path: string }>;
    nowcast: Array<{ time: number; path: string }>;
  };
}

/**
 * Fetch frames from RainViewer API
 */
async function fetchRainViewerFrames(): Promise<RadarFrame[]> {
  const response = await fetch(RADAR_PROVIDER_CONFIG.rainViewerApiUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'CommEazy/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`RainViewer API error: ${response.status}`);
  }

  const data: RainViewerApiResponse = await response.json();

  if (!data.radar || !data.host) {
    throw new Error('Invalid RainViewer API response');
  }

  // Combine past and nowcast frames
  const allFrames = [...(data.radar.past || []), ...(data.radar.nowcast || [])];

  // Convert to RadarFrame format with full tile URLs
  return allFrames
    .sort((a, b) => a.time - b.time)
    .map((frame) => ({
      time: frame.time,
      // RainViewer URL format: {host}{path}/256/{z}/{x}/{y}/2/1_1.png
      path: `${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
    }));
}

// ============================================================
// Main API
// ============================================================

/**
 * Get radar frames from configured provider
 *
 * Returns cached data if valid, otherwise fetches new data.
 * Falls back to RainViewer if OpenWeatherMap fails.
 */
export async function getRadarFrames(): Promise<RadarData> {
  // Return cached data if valid
  if (isCacheValid() && cache) {
    console.debug('[radarService] Returning cached data');
    return cache.data;
  }

  let frames: RadarFrame[];
  let provider: RadarProvider = config.provider;

  try {
    if (config.provider === 'openweathermap' && config.owmApiKey) {
      console.info('[radarService] Generating OpenWeatherMap frames');
      frames = generateOWMFrames(config.owmApiKey);
    } else {
      // Fallback to RainViewer
      console.info('[radarService] Fetching RainViewer frames');
      frames = await fetchRainViewerFrames();
      provider = 'rainviewer';
    }
  } catch (error) {
    console.warn('[radarService] Primary provider failed, trying fallback:', error);

    // Try RainViewer as fallback
    try {
      frames = await fetchRainViewerFrames();
      provider = 'rainviewer';
    } catch (fallbackError) {
      console.error('[radarService] Both providers failed:', fallbackError);
      throw fallbackError;
    }
  }

  const data: RadarData = {
    frames,
    provider,
    generated: Math.floor(Date.now() / 1000),
  };

  // Update cache
  cache = {
    data,
    fetchedAt: Date.now(),
  };

  console.info('[radarService] Loaded', frames.length, 'frames from', provider);

  return data;
}

/**
 * Get tile URL for a specific frame
 *
 * The frame.path already contains the full URL template with {z}, {x}, {y} placeholders
 */
export function getRadarTileUrl(frame: RadarFrame): string {
  return frame.path;
}

/**
 * Find the index of the "now" frame (closest to current time)
 */
export function getNowFrameIndex(frames: RadarFrame[]): number {
  if (frames.length === 0) return 0;

  const now = Math.floor(Date.now() / 1000);

  let closestIndex = 0;
  let closestDiff = Math.abs(frames[0].time - now);

  for (let i = 1; i < frames.length; i++) {
    const diff = Math.abs(frames[i].time - now);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = i;
    }
  }

  return closestIndex;
}

/**
 * Format a frame timestamp to a relative time string
 */
export function formatFrameTime(
  frameTime: number,
  nowTime?: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t?: (key: string, options?: any) => string
): string {
  const now = nowTime || Math.floor(Date.now() / 1000);
  const diffSeconds = frameTime - now;
  const diffMinutes = Math.round(diffSeconds / 60);

  // Within 2.5 minutes of "now"
  if (Math.abs(diffMinutes) < 3) {
    return t ? t('modules.radar.now') : 'Nu';
  }

  if (diffMinutes < 0) {
    // Past
    const absMinutes = Math.abs(diffMinutes);
    if (absMinutes >= 60) {
      const hours = Math.round(absMinutes / 60);
      return t
        ? t('modules.radar.hoursAgo', { hours })
        : `${hours} uur geleden`;
    }
    return t
      ? t('modules.radar.minutesAgo', { minutes: absMinutes })
      : `${absMinutes} min geleden`;
  } else {
    // Future
    if (diffMinutes >= 60) {
      const hours = Math.round(diffMinutes / 60);
      return t
        ? t('modules.radar.inHours', { hours })
        : `Over ${hours} uur`;
    }
    return t
      ? t('modules.radar.inMinutes', { minutes: diffMinutes })
      : `Over ${diffMinutes} min`;
  }
}

/**
 * Format a frame timestamp to absolute time (HH:mm)
 */
export function formatFrameAbsoluteTime(frameTime: number): string {
  const date = new Date(frameTime * 1000);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// ============================================================
// Export Service Object
// ============================================================

export const radarService = {
  configure: configureRadarService,
  getFrames: getRadarFrames,
  getTileUrl: getRadarTileUrl,
  getNowFrameIndex,
  formatFrameTime,
  formatFrameAbsoluteTime,
  clearCache: clearRadarCache,
};

export default radarService;
