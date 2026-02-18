/**
 * Podcast Service — API client for podcast discovery
 *
 * Uses iTunes Search API for podcast discovery (no API key required).
 * iTunes provides reliable podcast data with artwork and feed URLs.
 *
 * For episode fetching, we parse RSS feeds directly since iTunes
 * doesn't provide episode-level data in search results.
 *
 * Features:
 * - Rate limiting (~15 req/min to stay under iTunes limit of ~20/min)
 * - Two-tier caching (memory + AsyncStorage)
 * - Automatic fallback to cache when rate limited
 *
 * Future: Apple Enterprise Partner Feed will remove rate limits.
 *
 * @see .claude/skills/react-native-expert/SKILL.md
 * @see .claude/skills/performance-optimizer/SKILL.md
 */

import type { PodcastShow, PodcastEpisode } from '@/contexts/PodcastContext';
import { podcastCacheService } from './podcastCacheService';

// ============================================================
// Types
// ============================================================

interface iTunesPodcast {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl600: string;
  feedUrl: string;
  primaryGenreName: string;
  trackCount: number;
  country: string;
}

interface iTunesSearchResponse {
  resultCount: number;
  results: iTunesPodcast[];
}

interface RSSChannel {
  title: string;
  description: string;
  image?: { url: string };
  'itunes:author'?: string;
  'itunes:image'?: { href: string };
  item: RSSItem | RSSItem[];
}

interface RSSItem {
  title: string;
  description?: string;
  'itunes:summary'?: string;
  pubDate: string;
  'itunes:duration'?: string;
  'itunes:image'?: { href: string };
  enclosure?: {
    url: string;
    type: string;
    length?: string;
  };
  guid?: string | { '#text': string };
}

export type ApiResult<T> = {
  data: T | null;
  error: 'network' | 'timeout' | 'server' | 'parse' | null;
};

// ============================================================
// Constants
// ============================================================

const ITUNES_API = 'https://itunes.apple.com';
const API_TIMEOUT_MS = 15000;
const RSS_TIMEOUT_MS = 20000;

// Language to country code mapping for iTunes
const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  nl: 'NL',
  en: 'US',
  de: 'DE',
  fr: 'FR',
  es: 'ES',
};

// ============================================================
// Utilities
// ============================================================

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

/**
 * Decode HTML entities in a string
 * Handles common entities like &amp; &lt; &gt; &quot; &apos;
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Parse duration string to seconds
 * Supports formats: "HH:MM:SS", "MM:SS", "SSSS" (seconds only)
 */
function parseDuration(duration: string | undefined): number {
  if (!duration) return 0;

  // If it's just a number, assume seconds
  if (/^\d+$/.test(duration)) {
    return parseInt(duration, 10);
  }

  // Parse HH:MM:SS or MM:SS
  const parts = duration.split(':').map(p => parseInt(p, 10));
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return 0;
}

/**
 * Extract text from a tag, handling CDATA sections
 */
function extractTagContent(content: string, tagName: string): string | null {
  // Try CDATA first - use string search instead of regex for CDATA brackets
  const cdataStart = `<${tagName}><![CDATA[`;
  const cdataEnd = `]]></${tagName}>`;
  const cdataStartIdx = content.indexOf(cdataStart);
  if (cdataStartIdx !== -1) {
    const contentStart = cdataStartIdx + cdataStart.length;
    const contentEnd = content.indexOf(cdataEnd, contentStart);
    if (contentEnd !== -1) {
      return content.substring(contentStart, contentEnd).trim();
    }
  }

  // Try plain text
  const plainRegex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`);
  const plainMatch = content.match(plainRegex);
  if (plainMatch) {
    return plainMatch[1].trim();
  }

  return null;
}

/**
 * Simple XML to JSON parser for RSS feeds
 * Note: This is a basic parser for podcast RSS feeds
 */
function parseXML(xml: string): Record<string, unknown> {
  // Remove XML declaration and clean up
  const cleanXml = xml
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '')
    .trim();

  const result: Record<string, unknown> = {};

  // Extract channel content
  const channelMatch = cleanXml.match(/<channel>([\s\S]*?)<\/channel>/);
  if (!channelMatch) {
    return result;
  }

  const channelContent = channelMatch[1];

  // Parse simple elements
  const simpleElements = ['title', 'description', 'link', 'language'];
  simpleElements.forEach(tag => {
    const content = extractTagContent(channelContent, tag);
    if (content) {
      result[tag] = content;
    }
  });

  // Parse iTunes specific elements
  const itunesAuthorMatch = channelContent.match(/<itunes:author>([^<]*)<\/itunes:author>/);
  if (itunesAuthorMatch) {
    result['itunes:author'] = itunesAuthorMatch[1];
  }

  const itunesImageMatch = channelContent.match(/<itunes:image[^>]*href="([^"]*)"[^>]*\/?>/);
  if (itunesImageMatch) {
    result['itunes:image'] = { href: itunesImageMatch[1] };
  }

  // Parse image element
  const imageMatch = channelContent.match(/<image>[\s\S]*?<url>([^<]*)<\/url>[\s\S]*?<\/image>/);
  if (imageMatch) {
    result.image = { url: imageMatch[1] };
  }

  // Parse items (episodes)
  const items: RSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(channelContent)) !== null) {
    const itemContent = itemMatch[1];
    const item: RSSItem = {
      title: '',
      pubDate: '',
    };

    // Title
    const title = extractTagContent(itemContent, 'title');
    if (title) {
      item.title = title;
    }

    // Description
    const description = extractTagContent(itemContent, 'description');
    if (description) {
      item.description = description;
    }

    // iTunes summary (often cleaner than description)
    const summary = extractTagContent(itemContent, 'itunes:summary');
    if (summary) {
      item['itunes:summary'] = summary;
    }

    // Pub date
    const pubDateMatch = itemContent.match(/<pubDate>([^<]*)<\/pubDate>/);
    if (pubDateMatch) {
      item.pubDate = pubDateMatch[1];
    }

    // Duration
    const durationMatch = itemContent.match(/<itunes:duration>([^<]*)<\/itunes:duration>/);
    if (durationMatch) {
      item['itunes:duration'] = durationMatch[1];
    }

    // Enclosure (audio file) - extract attributes separately for flexibility
    const enclosureTagMatch = itemContent.match(/<enclosure[^>]*\/?>/);
    if (enclosureTagMatch) {
      const enclosureTag = enclosureTagMatch[0];
      const urlMatch = enclosureTag.match(/url="([^"]*)"/);
      const typeMatch = enclosureTag.match(/type="([^"]*)"/);
      const lengthMatch = enclosureTag.match(/length="([^"]*)"/);
      if (urlMatch) {
        // Decode HTML entities in URL (e.g., &amp; -> &)
        const decodedUrl = decodeHtmlEntities(urlMatch[1]);
        item.enclosure = {
          url: decodedUrl,
          type: typeMatch?.[1] || 'audio/mpeg',
          length: lengthMatch?.[1],
        };
      }
    }

    // GUID
    const guidMatch = itemContent.match(/<guid[^>]*>([^<]*)<\/guid>/);
    if (guidMatch) {
      item.guid = guidMatch[1];
    }

    // iTunes image
    const itemImageMatch = itemContent.match(/<itunes:image[^>]*href="([^"]*)"[^>]*\/?>/);
    if (itemImageMatch) {
      item['itunes:image'] = { href: itemImageMatch[1] };
    }

    if (item.title && item.enclosure?.url) {
      items.push(item);
    }
  }

  result.item = items;

  return result;
}

// ============================================================
// API Functions
// ============================================================

/**
 * Search for podcasts by term
 * Uses caching and rate limiting to comply with iTunes API limits
 *
 * @param query - Search term
 * @param countryOrLanguage - Country code (e.g., 'NL', 'DE') or language code (e.g., 'nl', 'de')
 * @param limit - Maximum number of results
 */
export async function searchPodcasts(
  query: string,
  countryOrLanguage: string = 'NL',
  limit: number = 30
): Promise<ApiResult<PodcastShow[]>> {
  // Determine country code: if uppercase 2-letter code, use directly; otherwise map from language
  const country = countryOrLanguage.length === 2 && countryOrLanguage === countryOrLanguage.toUpperCase()
    ? countryOrLanguage
    : LANGUAGE_TO_COUNTRY[countryOrLanguage.toLowerCase()] || 'US';

  // Check cache first
  const cached = podcastCacheService.getSearchResults(query, country);
  if (cached) {
    console.log('[podcastService] Returning cached search results for:', query);
    return { data: cached, error: null };
  }

  try {
    // Wait for rate limit slot before making request
    await podcastCacheService.waitForRateLimitSlot();
    const url = `${ITUNES_API}/search?term=${encodeURIComponent(query)}&media=podcast&country=${country}&limit=${limit}`;

    console.log('[podcastService] Searching podcasts:', url);
    console.log('[podcastService] Remaining requests:', podcastCacheService.getRemainingRequests());

    const response = await fetchWithTimeout(url, API_TIMEOUT_MS);

    if (!response.ok) {
      console.error('[podcastService] Search API error:', response.status);
      // On 429 (rate limited), try to return stale cache if available
      if (response.status === 429) {
        console.warn('[podcastService] Rate limited by iTunes API');
        const staleCache = podcastCacheService.getSearchResults(query, country);
        if (staleCache) {
          return { data: staleCache, error: null };
        }
      }
      return { data: null, error: 'server' };
    }

    const data: iTunesSearchResponse = await response.json();

    const shows: PodcastShow[] = data.results.map(podcast => ({
      id: String(podcast.collectionId),
      title: podcast.collectionName,
      author: podcast.artistName,
      artwork: podcast.artworkUrl600,
      feedUrl: podcast.feedUrl,
      subscribedAt: 0, // Not subscribed yet
    }));

    // Cache the results
    await podcastCacheService.setSearchResults(query, country, shows);

    console.log('[podcastService] Found', shows.length, 'podcasts (cached)');
    return { data: shows, error: null };
  } catch (error) {
    console.error('[podcastService] Search failed:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'timeout' };
    }
    return { data: null, error: 'network' };
  }
}

/**
 * Get trending/top podcasts for a language
 * Uses caching and rate limiting to comply with iTunes API limits
 */
export async function getTrendingPodcasts(
  language: string = 'nl',
  limit: number = 20
): Promise<ApiResult<PodcastShow[]>> {
  // Check cache first
  const cached = podcastCacheService.getTrending(language);
  if (cached) {
    console.log('[podcastService] Returning cached trending podcasts');
    return { data: cached, error: null };
  }

  try {
    // Wait for rate limit slot before making request
    await podcastCacheService.waitForRateLimitSlot();

    const country = LANGUAGE_TO_COUNTRY[language] || 'US';
    // iTunes top podcasts feed
    const url = `${ITUNES_API}/search?term=podcast&media=podcast&country=${country}&limit=${limit}`;

    console.log('[podcastService] Fetching trending podcasts');
    console.log('[podcastService] Remaining requests:', podcastCacheService.getRemainingRequests());

    const response = await fetchWithTimeout(url, API_TIMEOUT_MS);

    if (!response.ok) {
      console.error('[podcastService] Trending API error:', response.status);
      // On 429 (rate limited), try to return stale cache if available
      if (response.status === 429) {
        console.warn('[podcastService] Rate limited by iTunes API');
        const staleCache = podcastCacheService.getTrending(language);
        if (staleCache) {
          return { data: staleCache, error: null };
        }
      }
      return { data: null, error: 'server' };
    }

    const data: iTunesSearchResponse = await response.json();

    const shows: PodcastShow[] = data.results.map(podcast => ({
      id: String(podcast.collectionId),
      title: podcast.collectionName,
      author: podcast.artistName,
      artwork: podcast.artworkUrl600,
      feedUrl: podcast.feedUrl,
      subscribedAt: 0,
    }));

    // Cache the results
    await podcastCacheService.setTrending(language, shows);

    console.log('[podcastService] Found', shows.length, 'trending podcasts (cached)');
    return { data: shows, error: null };
  } catch (error) {
    console.error('[podcastService] Trending fetch failed:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'timeout' };
    }
    return { data: null, error: 'network' };
  }
}

/**
 * Get episodes for a podcast from its RSS feed
 * Uses caching (RSS feeds are not rate limited, but caching improves UX)
 */
export async function getPodcastEpisodes(
  show: PodcastShow,
  limit: number = 50
): Promise<ApiResult<PodcastEpisode[]>> {
  // Check cache first
  const cached = podcastCacheService.getEpisodes(show.id);
  if (cached) {
    console.log('[podcastService] Returning cached episodes for:', show.title);
    return { data: cached.slice(0, limit), error: null };
  }

  try {
    if (!show.feedUrl) {
      console.error('[podcastService] No feed URL for show:', show.title);
      return { data: null, error: 'parse' };
    }

    console.log('[podcastService] Fetching episodes from:', show.feedUrl);

    const response = await fetchWithTimeout(show.feedUrl, RSS_TIMEOUT_MS);

    if (!response.ok) {
      console.error('[podcastService] Feed fetch error:', response.status);
      return { data: null, error: 'server' };
    }

    const xml = await response.text();
    const parsed = parseXML(xml) as unknown as RSSChannel;

    if (!parsed.item) {
      console.error('[podcastService] No items in feed');
      return { data: null, error: 'parse' };
    }

    // Ensure items is an array
    const items = Array.isArray(parsed.item) ? parsed.item : [parsed.item];

    const episodes: PodcastEpisode[] = items
      .slice(0, limit)
      .map((item, index) => {
        const guid = typeof item.guid === 'string'
          ? item.guid
          : item.guid?.['#text'] || `${show.id}-${index}`;

        return {
          id: guid,
          podcastId: show.id,
          title: item.title || 'Untitled Episode',
          description: item['itunes:summary'] || item.description || '',
          streamUrl: item.enclosure?.url || '',
          duration: parseDuration(item['itunes:duration']),
          publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
          artwork: item['itunes:image']?.href || show.artwork,
        };
      })
      .filter(ep => ep.streamUrl); // Only include episodes with audio

    // Cache the episodes
    await podcastCacheService.setEpisodes(show.id, episodes);

    console.log('[podcastService] Parsed', episodes.length, 'episodes (cached)');
    // Log first episode URL for debugging
    if (episodes.length > 0) {
      console.log('[podcastService] First episode URL:', episodes[0].streamUrl);
    }
    return { data: episodes, error: null };
  } catch (error) {
    console.error('[podcastService] Episode fetch failed:', error);
    // Try to return stale cache on network error
    const staleCache = podcastCacheService.getEpisodes(show.id);
    if (staleCache) {
      console.warn('[podcastService] Returning stale cache due to error');
      return { data: staleCache.slice(0, limit), error: null };
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'timeout' };
    }
    return { data: null, error: 'network' };
  }
}

/**
 * Get podcast details by iTunes ID
 * Uses rate limiting to comply with iTunes API limits
 */
export async function getPodcastById(
  podcastId: string
): Promise<ApiResult<PodcastShow>> {
  try {
    // Wait for rate limit slot before making request
    await podcastCacheService.waitForRateLimitSlot();

    const url = `${ITUNES_API}/lookup?id=${podcastId}`;

    console.log('[podcastService] Looking up podcast:', podcastId);
    console.log('[podcastService] Remaining requests:', podcastCacheService.getRemainingRequests());

    const response = await fetchWithTimeout(url, API_TIMEOUT_MS);

    if (!response.ok) {
      console.error('[podcastService] Lookup API error:', response.status);
      return { data: null, error: 'server' };
    }

    const data: iTunesSearchResponse = await response.json();

    if (data.resultCount === 0 || !data.results[0]) {
      return { data: null, error: 'parse' };
    }

    const podcast = data.results[0];
    const show: PodcastShow = {
      id: String(podcast.collectionId),
      title: podcast.collectionName,
      author: podcast.artistName,
      artwork: podcast.artworkUrl600,
      feedUrl: podcast.feedUrl,
      subscribedAt: 0,
    };

    return { data: show, error: null };
  } catch (error) {
    console.error('[podcastService] Lookup failed:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'timeout' };
    }
    return { data: null, error: 'network' };
  }
}

// ============================================================
// Cache Service Initialization
// ============================================================

/**
 * Initialize the podcast cache service
 * Call this at app startup
 */
export async function initializePodcastCache(): Promise<void> {
  return podcastCacheService.initialize();
}

/**
 * Clear all podcast caches
 */
export async function clearPodcastCache(): Promise<void> {
  return podcastCacheService.clearAll();
}

/**
 * Get cache service status for debugging
 */
export function getPodcastCacheStatus(): {
  canMakeRequest: boolean;
  remainingRequests: number;
} {
  return {
    canMakeRequest: podcastCacheService.canMakeRequest(),
    remainingRequests: podcastCacheService.getRemainingRequests(),
  };
}
