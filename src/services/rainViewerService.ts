/**
 * RainViewer Service
 *
 * Provides radar tile URLs for the weather radar module.
 * Uses the RainViewer API (free, no API key required).
 *
 * Features:
 * - Fetch available radar frames (past + forecast)
 * - Generate tile URLs for MapView overlay
 * - 10-minute memory cache
 *
 * @see https://www.rainviewer.com/api.html
 * @see .claude/plans/buienradar-module-plan.md
 */

import {
  RainViewerData,
  RainViewerFrame,
  RainViewerTileOptions,
  DEFAULT_RADAR_TILE_OPTIONS,
  RADAR_MODULE_CONFIG,
} from '@/types/weather';

// ============================================================
// Cache Management
// ============================================================

interface CacheEntry {
  data: RainViewerData;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
  if (!cache) return false;
  const now = Date.now();
  return now - cache.fetchedAt < RADAR_MODULE_CONFIG.cacheTtl;
}

/**
 * Clear the cache
 */
export function clearRadarCache(): void {
  cache = null;
  console.debug('[rainViewerService] Cache cleared');
}

// ============================================================
// API Functions
// ============================================================

/**
 * Fetch available radar frames from RainViewer API
 *
 * Returns cached data if still valid (10 min TTL)
 */
export async function fetchRadarFrames(): Promise<RainViewerData> {
  // Return cached data if valid
  if (isCacheValid() && cache) {
    console.debug('[rainViewerService] Returning cached data');
    return cache.data;
  }

  console.info('[rainViewerService] Fetching radar frames from API:', RADAR_MODULE_CONFIG.apiUrl);

  try {
    const response = await fetch(RADAR_MODULE_CONFIG.apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CommEazy/1.0',
      },
    });

    console.debug('[rainViewerService] Response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[rainViewerService] Error response body:', errorBody);
      throw new Error(`RainViewer API error: ${response.status}`);
    }

    const data: RainViewerData = await response.json();

    // Validate response structure
    if (!data.radar || !data.host) {
      throw new Error('Invalid RainViewer API response structure');
    }

    // Update cache
    cache = {
      data,
      fetchedAt: Date.now(),
    };

    const totalFrames = (data.radar.past?.length || 0) + (data.radar.nowcast?.length || 0);
    console.info('[rainViewerService] Fetched', totalFrames, 'frames');

    return data;
  } catch (error) {
    console.error('[rainViewerService] Fetch failed:', error);
    throw error;
  }
}

// ============================================================
// Tile URL Generation
// ============================================================

/**
 * Generate a radar tile URL for a specific frame
 *
 * @param host - RainViewer tile host URL
 * @param frame - Radar frame with path
 * @param options - Tile rendering options
 * @returns URL template for MapView UrlTile (with {z}, {x}, {y} placeholders)
 */
export function getRadarTileUrl(
  host: string,
  frame: RainViewerFrame,
  options: RainViewerTileOptions = DEFAULT_RADAR_TILE_OPTIONS
): string {
  // RainViewer tile URL format:
  // {host}{path}/{size}/{z}/{x}/{y}/{color}/{smooth}_{snow}.png
  //
  // Note: API response path already includes /v2/radar/ prefix
  // Example path from API: "/v2/radar/1234567890"
  // Full URL: https://tilecache.rainviewer.com/v2/radar/1234567890/256/{z}/{x}/{y}/2/1_1.png

  const { size, color, smooth, snow } = options;

  return `${host}${frame.path}/${size}/{z}/{x}/{y}/${color}/${smooth}_${snow}.png`;
}

/**
 * Get all radar frames (past + nowcast) sorted by time
 *
 * @param data - RainViewer API response
 * @returns Array of all frames sorted chronologically
 */
export function getAllFrames(data: RainViewerData): RainViewerFrame[] {
  const past = data.radar.past || [];
  const nowcast = data.radar.nowcast || [];

  // Combine and sort by time
  return [...past, ...nowcast].sort((a, b) => a.time - b.time);
}

/**
 * Find the index of the "now" frame (closest to current time)
 *
 * @param frames - Array of radar frames
 * @returns Index of the frame closest to current time
 */
export function getNowFrameIndex(frames: RainViewerFrame[]): number {
  if (frames.length === 0) return 0;

  const now = Math.floor(Date.now() / 1000); // Current time in seconds

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
 *
 * @param frameTime - Unix timestamp in seconds
 * @param nowTime - Current time in seconds (optional, defaults to now)
 * @param t - i18n translation function
 * @returns Human-readable relative time (e.g., "Nu", "10 min geleden", "Over 15 min")
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
    return t
      ? t('modules.radar.inMinutes', { minutes: diffMinutes })
      : `Over ${diffMinutes} min`;
  }
}

/**
 * Format a frame timestamp to absolute time (HH:mm)
 *
 * @param frameTime - Unix timestamp in seconds
 * @returns Time string in HH:mm format
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

export const rainViewerService = {
  fetchRadarFrames,
  getRadarTileUrl,
  getAllFrames,
  getNowFrameIndex,
  formatFrameTime,
  formatFrameAbsoluteTime,
  clearCache: clearRadarCache,
};

export default rainViewerService;
