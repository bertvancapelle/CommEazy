/**
 * StationArtworkService — Scrape high-res artwork from radio station homepages
 *
 * Many radio stations have low-quality or missing favicons in the Radio Browser API.
 * This service fetches the station's homepage HTML and extracts high-res artwork
 * from standard meta tags (apple-touch-icon, og:image, large favicon).
 *
 * Results are cached in AsyncStorage to avoid repeated network requests.
 *
 * @see ArtworkImage component (fallbackUri prop)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Types
// ============================================================

interface ScrapedArtwork {
  /** Best artwork URL found, or null if none */
  url: string | null;
  /** Source where the artwork was found */
  source: 'apple-touch-icon' | 'og-image' | 'favicon-large' | 'cache' | null;
  /** Timestamp when scraped */
  timestamp: number;
}

// ============================================================
// Constants
// ============================================================

const CACHE_PREFIX = '@commeazy/stationArt/';
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FETCH_TIMEOUT_MS = 8000;

// In-memory cache to avoid AsyncStorage reads on every render
const memoryCache = new Map<string, ScrapedArtwork>();

// ============================================================
// Helpers
// ============================================================

/**
 * Fetch with timeout and abort
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Some sites block requests without a browser user agent
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    // Only read a limited amount of HTML (head section is usually in first 16KB)
    const text = await response.text();
    // Limit to first 32KB to avoid processing huge pages
    return text.slice(0, 32768);
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Resolve relative URL to absolute
 */
function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith('http://') || relative.startsWith('https://')) {
    return relative;
  }
  if (relative.startsWith('//')) {
    return 'https:' + relative;
  }
  try {
    // Use URL constructor for proper resolution
    const baseUrl = new URL(base);
    if (relative.startsWith('/')) {
      return `${baseUrl.protocol}//${baseUrl.host}${relative}`;
    }
    // Relative path
    const basePath = baseUrl.pathname.replace(/\/[^/]*$/, '/');
    return `${baseUrl.protocol}//${baseUrl.host}${basePath}${relative}`;
  } catch {
    return relative;
  }
}

/**
 * Extract artwork URLs from HTML head section
 * Returns URLs in priority order (best first)
 */
function extractArtworkFromHTML(html: string, baseUrl: string): Array<{ url: string; source: ScrapedArtwork['source'] }> {
  const results: Array<{ url: string; source: ScrapedArtwork['source'] }> = [];

  // 1. Apple Touch Icon (highest priority — always high-res, 180x180+)
  const appleTouchIconRegex = /<link[^>]+rel=["']apple-touch-icon(?:-precomposed)?["'][^>]+href=["']([^"']+)["']/gi;
  let match;
  while ((match = appleTouchIconRegex.exec(html)) !== null) {
    if (match[1]) {
      results.push({ url: resolveUrl(baseUrl, match[1]), source: 'apple-touch-icon' });
    }
  }
  // Also try reversed attribute order: href before rel
  const appleTouchIconRegex2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon(?:-precomposed)?["']/gi;
  while ((match = appleTouchIconRegex2.exec(html)) !== null) {
    if (match[1]) {
      results.push({ url: resolveUrl(baseUrl, match[1]), source: 'apple-touch-icon' });
    }
  }

  // 2. Open Graph Image (good quality, often used for social sharing)
  const ogImageRegex = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
  while ((match = ogImageRegex.exec(html)) !== null) {
    if (match[1]) {
      results.push({ url: resolveUrl(baseUrl, match[1]), source: 'og-image' });
    }
  }
  // Reversed attribute order
  const ogImageRegex2 = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi;
  while ((match = ogImageRegex2.exec(html)) !== null) {
    if (match[1]) {
      results.push({ url: resolveUrl(baseUrl, match[1]), source: 'og-image' });
    }
  }

  // 3. Large favicon (sizes >= 96px)
  const faviconRegex = /<link[^>]+rel=["']icon["'][^>]+sizes=["'](\d+)x\d+["'][^>]+href=["']([^"']+)["']/gi;
  while ((match = faviconRegex.exec(html)) !== null) {
    const size = parseInt(match[1] || '0', 10);
    if (size >= 96 && match[2]) {
      results.push({ url: resolveUrl(baseUrl, match[2]), source: 'favicon-large' });
    }
  }
  // Reversed: href before sizes
  const faviconRegex2 = /<link[^>]+href=["']([^"']+)["'][^>]+sizes=["'](\d+)x\d+["'][^>]+rel=["']icon["']/gi;
  while ((match = faviconRegex2.exec(html)) !== null) {
    const size = parseInt(match[2] || '0', 10);
    if (size >= 96 && match[1]) {
      results.push({ url: resolveUrl(baseUrl, match[1]), source: 'favicon-large' });
    }
  }

  return results;
}

/**
 * Validate that a URL actually returns an image
 */
async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return false;

    const contentType = response.headers.get('content-type') || '';
    return contentType.startsWith('image/');
  } catch {
    return false;
  }
}

// ============================================================
// Cache Management
// ============================================================

function getCacheKey(homepageUrl: string): string {
  // Normalize: strip trailing slash, lowercase
  return CACHE_PREFIX + homepageUrl.replace(/\/+$/, '').toLowerCase();
}

async function getCachedArtwork(homepageUrl: string): Promise<ScrapedArtwork | null> {
  const key = getCacheKey(homepageUrl);

  // Check memory cache first
  const memCached = memoryCache.get(key);
  if (memCached && Date.now() - memCached.timestamp < CACHE_DURATION_MS) {
    return memCached;
  }

  // Check AsyncStorage
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const parsed: ScrapedArtwork = JSON.parse(stored);
      if (Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
        // Populate memory cache
        memoryCache.set(key, parsed);
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }

  return null;
}

async function setCachedArtwork(homepageUrl: string, artwork: ScrapedArtwork): Promise<void> {
  const key = getCacheKey(homepageUrl);
  memoryCache.set(key, artwork);

  try {
    await AsyncStorage.setItem(key, JSON.stringify(artwork));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Scrape high-res artwork from a radio station's homepage
 *
 * Fetches the homepage HTML and looks for:
 * 1. apple-touch-icon (180x180+ — highest quality)
 * 2. og:image (social sharing image — good quality)
 * 3. Large favicon (96x96+ — better than default 16x16)
 *
 * Results are cached for 7 days in AsyncStorage.
 *
 * @param homepageUrl - Station homepage URL (e.g., "https://www.radio538.nl")
 * @returns Artwork URL or null
 */
export async function scrapeStationArtwork(homepageUrl: string): Promise<ScrapedArtwork> {
  if (!homepageUrl?.trim()) {
    return { url: null, source: null, timestamp: Date.now() };
  }

  // Ensure URL has protocol
  let normalizedUrl = homepageUrl.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  // Check cache first
  const cached = await getCachedArtwork(normalizedUrl);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  console.debug('[StationArtwork] Scraping:', normalizedUrl);

  // Fetch homepage HTML
  const html = await fetchWithTimeout(normalizedUrl, FETCH_TIMEOUT_MS);
  if (!html) {
    // Cache negative result to avoid retrying
    const result: ScrapedArtwork = { url: null, source: null, timestamp: Date.now() };
    await setCachedArtwork(normalizedUrl, result);
    return result;
  }

  // Extract artwork candidates
  const candidates = extractArtworkFromHTML(html, normalizedUrl);

  // Validate candidates (first valid one wins)
  for (const candidate of candidates) {
    const isValid = await validateImageUrl(candidate.url);
    if (isValid) {
      console.debug('[StationArtwork] Found:', candidate.source, candidate.url);
      const result: ScrapedArtwork = {
        url: candidate.url,
        source: candidate.source,
        timestamp: Date.now(),
      };
      await setCachedArtwork(normalizedUrl, result);
      return result;
    }
  }

  // No valid artwork found — also try /favicon.ico at larger size
  // (some stations have high-res favicons at the default path)
  try {
    const faviconUrl = new URL('/favicon.ico', normalizedUrl).href;
    const faviconValid = await validateImageUrl(faviconUrl);
    if (faviconValid) {
      console.debug('[StationArtwork] Found favicon.ico:', faviconUrl);
      const result: ScrapedArtwork = {
        url: faviconUrl,
        source: 'favicon-large',
        timestamp: Date.now(),
      };
      await setCachedArtwork(normalizedUrl, result);
      return result;
    }
  } catch {
    // Ignore
  }

  // Cache negative result
  console.debug('[StationArtwork] No artwork found for:', normalizedUrl);
  const result: ScrapedArtwork = { url: null, source: null, timestamp: Date.now() };
  await setCachedArtwork(normalizedUrl, result);
  return result;
}

/**
 * Get cached artwork synchronously from memory (no async)
 * Returns null if not in memory cache
 */
export function getCachedArtworkSync(homepageUrl: string): string | null {
  if (!homepageUrl?.trim()) return null;

  let normalizedUrl = homepageUrl.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  const key = getCacheKey(normalizedUrl);
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return cached.url;
  }
  return null;
}

/**
 * Clear all scraped artwork cache
 */
export async function clearStationArtworkCache(): Promise<void> {
  memoryCache.clear();
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const artworkKeys = allKeys.filter(k => k.startsWith(CACHE_PREFIX));
    if (artworkKeys.length > 0) {
      await AsyncStorage.multiRemove(artworkKeys);
    }
  } catch {
    // Ignore
  }
}
