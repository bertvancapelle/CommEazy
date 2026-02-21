/**
 * Radar Service
 *
 * Unified radar tile service that supports multiple providers:
 * - KNMI: 2 hour forecast (Netherlands only), API key required, high resolution
 * - RainViewer: 30 min forecast, no API key required, worldwide (fallback)
 *
 * Location-based provider selection:
 * - NL locations (lat 50.5-53.7, lon 3.2-7.3) → KNMI
 * - All other locations → RainViewer
 *
 * Features:
 * - Generate radar tile URLs with timestamps
 * - Calculate available time frames (past + forecast)
 * - 10-minute memory cache
 * - Automatic fallback to RainViewer if KNMI fails
 *
 * @see https://developer.dataplatform.knmi.nl/wms
 * @see https://www.rainviewer.com/api.html
 */

import { RADAR_PROVIDER_CONFIG, RadarFrame } from '@/types/weather';
import { KNMI_API_KEY, KNMI_PROXY_URL } from '@/config/devConfig';

// ============================================================
// Types
// ============================================================

export type RadarProvider = 'knmi' | 'rainviewer';

export interface RadarServiceConfig {
  /** KNMI API key (required for KNMI provider) */
  knmiApiKey?: string;

  /** Past duration in minutes (default: 60 for balanced view) */
  pastMinutes: number;

  /** Forecast duration in minutes (KNMI: 120, RainViewer: 30) */
  forecastMinutes: number;

  /** Frame interval in minutes (KNMI: 5, RainViewer: 10) */
  frameIntervalMinutes: number;
}

export interface RadarData {
  /** All available frames (past + forecast) */
  frames: RadarFrame[];

  /** Active provider */
  provider: RadarProvider;

  /** When data was generated */
  generated: number;

  /** Number of past frames (before "now") */
  pastFrameCount: number;

  /** Number of forecast frames (after "now") */
  forecastFrameCount: number;
}

// ============================================================
// Netherlands Bounding Box
// ============================================================

/**
 * Check if coordinates are within Netherlands
 * Bounding box: lat 50.5-53.7, lon 3.2-7.3
 */
export function isInNetherlands(latitude: number, longitude: number): boolean {
  return (
    latitude >= 50.5 &&
    latitude <= 53.7 &&
    longitude >= 3.2 &&
    longitude <= 7.3
  );
}

// ============================================================
// Configuration
// ============================================================

const DEFAULT_CONFIG: RadarServiceConfig = {
  knmiApiKey: KNMI_API_KEY,
  pastMinutes: 60, // 1 hour past (balanced slider)
  forecastMinutes: 120, // 2 hours forecast (KNMI)
  frameIntervalMinutes: 5, // 5 minute intervals (KNMI resolution)
};

let config: RadarServiceConfig = { ...DEFAULT_CONFIG };

/**
 * Configure the radar service
 */
export function configureRadarService(newConfig: Partial<RadarServiceConfig>): void {
  config = { ...config, ...newConfig };
  console.info('[radarService] Configuration updated:', {
    hasKnmiKey: !!config.knmiApiKey,
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
  locationKey: string; // Cache per location to handle provider switching
}

let cache: CacheEntry | null = null;

function isCacheValid(locationKey: string): boolean {
  if (!cache) return false;
  if (cache.locationKey !== locationKey) return false;
  const now = Date.now();
  return now - cache.fetchedAt < RADAR_PROVIDER_CONFIG.cacheTtl;
}

export function clearRadarCache(): void {
  cache = null;
  console.debug('[radarService] Cache cleared');
}

// ============================================================
// KNMI Provider (Netherlands)
// ============================================================

/**
 * Generate KNMI WMS tile URL for a specific timestamp
 *
 * KNMI uses WMS (Web Map Service) standard with TIME parameter.
 * Layer: precipitation forecast (precipitationfc)
 *
 * WMS URL format:
 * https://api.dataplatform.knmi.nl/wms/adaguc-server?
 *   DATASET=radar_forecast
 *   &SERVICE=WMS
 *   &VERSION=1.3.0
 *   &REQUEST=GetMap
 *   &LAYERS=precipitation
 *   &CRS=EPSG:3857
 *   &BBOX={bbox}
 *   &WIDTH=256
 *   &HEIGHT=256
 *   &FORMAT=image/png
 *   &TRANSPARENT=true
 *   &TIME={iso_timestamp}
 *
 * For Leaflet TileLayer.WMS, we use the URL template format
 */
function getKNMIWmsUrl(timestamp: number, apiKey: string): string {
  // Convert Unix timestamp to ISO format for WMS TIME parameter
  const date = new Date(timestamp * 1000);
  const isoTime = date.toISOString();

  // KNMI WMS endpoint with API key in Authorization header
  // For tile layers, we need to embed the key as a query param since headers don't work
  // The Leaflet TileLayer.WMS will handle the {s}, {z}, {x}, {y} placeholders
  const baseUrl = 'https://api.dataplatform.knmi.nl/wms/adaguc-server';

  // Build WMS GetMap URL template for Leaflet
  // Note: Leaflet's TileLayer.WMS handles the BBOX calculation automatically
  const params = new URLSearchParams({
    DATASET: 'radar_forecast',
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: 'precipitation',
    CRS: 'EPSG:3857',
    WIDTH: '256',
    HEIGHT: '256',
    FORMAT: 'image/png',
    TRANSPARENT: 'true',
    TIME: isoTime,
    api_key: apiKey, // KNMI accepts API key as query param
  });

  // Return URL template - Leaflet will add BBOX
  // We use a special format that RadarMap's Leaflet can parse
  return `${baseUrl}?${params.toString()}&BBOX={bbox}`;
}

/**
 * Generate KNMI tile URL via local proxy
 *
 * The proxy adds the Authorization header that WebView/Leaflet cannot add.
 * Start the proxy with: ./scripts/knmi-proxy-start.sh
 *
 * URL format: http://10.10.15.75:3001/knmi-wms?url=<encoded_knmi_url>
 * The proxy forwards to KNMI with Authorization header and returns the tile.
 */
function getKNMITileUrl(timestamp: number, _apiKey: string): string {
  const date = new Date(timestamp * 1000);
  const isoTime = date.toISOString();

  // Build the actual KNMI WMS URL (without api_key - proxy adds Authorization header)
  const knmiUrl = `https://api.dataplatform.knmi.nl/wms/adaguc-server?` +
    `DATASET=radar_forecast&` +
    `SERVICE=WMS&` +
    `VERSION=1.3.0&` +
    `REQUEST=GetMap&` +
    `LAYERS=precipitation&` +
    `CRS=EPSG:3857&` +
    `WIDTH=256&` +
    `HEIGHT=256&` +
    `FORMAT=image/png&` +
    `TRANSPARENT=true&` +
    `TIME=${encodeURIComponent(isoTime)}&` +
    `BBOX={bbox-epsg-3857}`;

  // Wrap in proxy URL
  // Note: We encode the KNMI URL but keep {bbox-epsg-3857} as placeholder
  // The RadarMap Leaflet code will replace this before making the request
  if (KNMI_PROXY_URL) {
    // URL will be: http://10.10.15.75:3001/knmi-wms?url=https://api.dataplatform.knmi.nl/...&BBOX={bbox-epsg-3857}
    // RadarMap's Leaflet will replace {bbox-epsg-3857} with actual coordinates
    return `${KNMI_PROXY_URL}?url=${encodeURIComponent(knmiUrl.replace('&BBOX={bbox-epsg-3857}', ''))}&BBOX={bbox-epsg-3857}`;
  }

  // Fallback: direct KNMI URL (won't work without proxy)
  return knmiUrl;
}

interface KNMIResult {
  frames: RadarFrame[];
  pastFrameCount: number;
  forecastFrameCount: number;
}

/**
 * Generate frames for KNMI provider
 *
 * KNMI Radar Forecast 2.0:
 * - 25 time steps: now to +120 minutes (2 hours)
 * - 5 minute intervals
 * - 1km resolution
 *
 * We also add past frames using historical radar data
 */
async function fetchKNMIFrames(): Promise<KNMIResult> {
  if (!config.knmiApiKey) {
    throw new Error('KNMI API key not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const intervalSeconds = config.frameIntervalMinutes * 60;

  // Round to nearest 5-minute interval
  const roundedNow = Math.floor(now / intervalSeconds) * intervalSeconds;

  const frames: RadarFrame[] = [];

  // Generate past frames (1 hour = 12 frames at 5-min intervals)
  const pastFrameCount = Math.floor(config.pastMinutes / config.frameIntervalMinutes);
  for (let i = pastFrameCount; i > 0; i--) {
    const timestamp = roundedNow - i * intervalSeconds;
    frames.push({
      time: timestamp,
      path: getKNMITileUrl(timestamp, config.knmiApiKey),
    });
  }

  // Add current frame
  frames.push({
    time: roundedNow,
    path: getKNMITileUrl(roundedNow, config.knmiApiKey),
  });

  // Generate forecast frames (2 hours = 24 frames at 5-min intervals)
  const forecastFrameCount = Math.floor(config.forecastMinutes / config.frameIntervalMinutes);
  for (let i = 1; i <= forecastFrameCount; i++) {
    const timestamp = roundedNow + i * intervalSeconds;
    frames.push({
      time: timestamp,
      path: getKNMITileUrl(timestamp, config.knmiApiKey),
    });
  }

  console.debug('[radarService] KNMI frames generated:', {
    past: pastFrameCount,
    forecast: forecastFrameCount,
    total: frames.length,
    firstTime: new Date(frames[0].time * 1000).toLocaleTimeString(),
    lastTime: new Date(frames[frames.length - 1].time * 1000).toLocaleTimeString(),
  });

  return {
    frames,
    pastFrameCount,
    forecastFrameCount,
  };
}

// ============================================================
// RainViewer Provider (Worldwide Fallback)
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

interface RainViewerResult {
  frames: RadarFrame[];
  pastFrameCount: number;
  forecastFrameCount: number;
}

/**
 * Fetch frames from RainViewer API
 *
 * RainViewer provides ~2 hours past + ~30 min forecast (nowcast).
 * We balance the frames so "now" appears roughly in the middle of the slider.
 */
async function fetchRainViewerFrames(): Promise<RainViewerResult> {
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

  // Convert to RadarFrame format with full tile URLs
  // RainViewer API returns paths like "/v2/radar/1234567890" (without tile coords)
  // We need to append: /256/{z}/{x}/{y}/{color}/{smooth}_{snow}.png
  // Color 2 = Universal Blue, Smooth 1, Snow 1
  const pastFrames = (data.radar.past || [])
    .map((frame) => ({
      time: frame.time,
      path: `${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
    }))
    .sort((a, b) => a.time - b.time);

  const forecastFrames = (data.radar.nowcast || [])
    .map((frame) => ({
      time: frame.time,
      path: `${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
    }))
    .sort((a, b) => a.time - b.time);

  // Debug: Log first tile URL to verify format
  if (pastFrames.length > 0) {
    console.debug('[radarService] RainViewer sample URL:', pastFrames[0].path.replace('{z}/{x}/{y}', '7/67/42'));
  }

  // Balance frames so "now" is roughly in the middle
  const forecastCount = forecastFrames.length;
  let maxPastFrames = forecastCount > 0 ? forecastCount + 1 : 6;
  maxPastFrames = Math.max(maxPastFrames, 4);

  const balancedPastFrames = pastFrames.slice(-maxPastFrames);
  const allFrames = [...balancedPastFrames, ...forecastFrames];

  console.debug('[radarService] RainViewer frames:', {
    totalPast: pastFrames.length,
    keptPast: balancedPastFrames.length,
    forecast: forecastCount,
    total: allFrames.length,
  });

  return {
    frames: allFrames,
    pastFrameCount: balancedPastFrames.length,
    forecastFrameCount: forecastCount,
  };
}

// ============================================================
// Main API
// ============================================================

/**
 * Get radar frames based on location
 *
 * Provider selection:
 * - Netherlands + proxy available → KNMI (2 hour forecast, high resolution)
 * - Elsewhere or no proxy → RainViewer (30 min forecast, worldwide)
 *
 * KNMI requires the local proxy server to add Authorization header.
 * Start proxy with: ./scripts/knmi-proxy-start.sh
 *
 * @see https://developer.dataplatform.knmi.nl/wms
 */
export async function getRadarFrames(
  latitude?: number,
  longitude?: number
): Promise<RadarData> {
  // Use KNMI for Netherlands locations when proxy is configured
  const useKNMI = latitude !== undefined &&
    longitude !== undefined &&
    isInNetherlands(latitude, longitude) &&
    !!config.knmiApiKey &&
    !!KNMI_PROXY_URL;

  const locationKey = useKNMI ? 'nl' : 'world';

  // Return cached data if valid for this location
  if (isCacheValid(locationKey) && cache) {
    console.debug('[radarService] Returning cached data for', locationKey);
    return cache.data;
  }

  let frames: RadarFrame[];
  let pastFrameCount = 0;
  let forecastFrameCount = 0;
  let provider: RadarProvider;

  if (useKNMI) {
    try {
      console.info('[radarService] Fetching KNMI frames (Netherlands)');
      const result = await fetchKNMIFrames();
      frames = result.frames;
      pastFrameCount = result.pastFrameCount;
      forecastFrameCount = result.forecastFrameCount;
      provider = 'knmi';
    } catch (error) {
      console.warn('[radarService] KNMI failed, falling back to RainViewer:', error);
      // Fallback to RainViewer
      const result = await fetchRainViewerFrames();
      frames = result.frames;
      pastFrameCount = result.pastFrameCount;
      forecastFrameCount = result.forecastFrameCount;
      provider = 'rainviewer';
    }
  } else {
    // Use RainViewer (free, worldwide, no auth required)
    console.info('[radarService] Fetching RainViewer frames');
    const result = await fetchRainViewerFrames();
    frames = result.frames;
    pastFrameCount = result.pastFrameCount;
    forecastFrameCount = result.forecastFrameCount;
    provider = 'rainviewer';
  }

  const data: RadarData = {
    frames,
    provider,
    generated: Math.floor(Date.now() / 1000),
    pastFrameCount,
    forecastFrameCount,
  };

  // Update cache
  cache = {
    data,
    fetchedAt: Date.now(),
    locationKey,
  };

  console.info('[radarService] Loaded', frames.length, 'frames from', provider, {
    past: pastFrameCount,
    forecast: forecastFrameCount,
  });

  return data;
}

/**
 * Get tile URL for a specific frame
 *
 * The frame.path contains the URL template with placeholders
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
    return t ? t('modules.weather.radar.now') : 'Nu';
  }

  if (diffMinutes < 0) {
    // Past
    const absMinutes = Math.abs(diffMinutes);
    if (absMinutes >= 60) {
      const hours = Math.round(absMinutes / 60);
      return t
        ? t('modules.weather.radar.hoursAgo', { hours })
        : `${hours} uur geleden`;
    }
    return t
      ? t('modules.weather.radar.minutesAgo', { minutes: absMinutes })
      : `${absMinutes} min geleden`;
  } else {
    // Future
    if (diffMinutes >= 60) {
      const hours = Math.round(diffMinutes / 60);
      return t
        ? t('modules.weather.radar.inHours', { hours })
        : `Over ${hours} uur`;
    }
    return t
      ? t('modules.weather.radar.inMinutes', { minutes: diffMinutes })
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
  isInNetherlands,
};

export default radarService;
