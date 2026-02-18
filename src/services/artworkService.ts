/**
 * ArtworkService — Fetch album/song artwork from external APIs
 *
 * Provides artwork fetching for radio streams:
 * - MusicBrainz API (free, no API key)
 * - Cover Art Archive (covers from MusicBrainz)
 * - iTunes Search API (fallback)
 *
 * Caches results to reduce API calls.
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

// ============================================================
// Types
// ============================================================

interface ArtworkResult {
  url: string | null;
  source: 'musicbrainz' | 'itunes' | 'cache' | null;
}

interface CacheEntry {
  url: string | null;
  timestamp: number;
}

// ============================================================
// Constants
// ============================================================

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const COVER_ART_API = 'https://coverartarchive.org';
const ITUNES_API = 'https://itunes.apple.com/search';

// Cache duration: 24 hours
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

// User agent required by MusicBrainz
const USER_AGENT = 'CommEazy/1.0.0 (bertvancapelle@gmail.com)';

// In-memory cache
const artworkCache: Map<string, CacheEntry> = new Map();

// ============================================================
// Helper Functions
// ============================================================

/**
 * Generate cache key from artist and title
 */
function getCacheKey(artist: string, title: string): string {
  return `${artist.toLowerCase().trim()}|${title.toLowerCase().trim()}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_DURATION_MS;
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================================
// MusicBrainz API
// ============================================================

/**
 * Search MusicBrainz for release with matching artist and title
 */
async function searchMusicBrainz(
  artist: string,
  title: string
): Promise<string | null> {
  try {
    // Search for recordings
    const query = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`);
    const url = `${MUSICBRAINZ_API}/recording?query=${query}&fmt=json&limit=1`;

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.log('[ArtworkService] MusicBrainz search failed:', response.status);
      return null;
    }

    const data = await response.json();
    const recording = data.recordings?.[0];

    if (!recording?.releases?.[0]?.id) {
      return null;
    }

    const releaseId = recording.releases[0].id;

    // Fetch cover art from Cover Art Archive
    return await fetchCoverArt(releaseId);
  } catch (error) {
    console.log('[ArtworkService] MusicBrainz error:', error);
    return null;
  }
}

/**
 * Fetch cover art from Cover Art Archive
 */
async function fetchCoverArt(releaseId: string): Promise<string | null> {
  try {
    const url = `${COVER_ART_API}/release/${releaseId}`;

    const response = await fetchWithTimeout(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const frontImage = data.images?.find(
      (img: { front?: boolean }) => img.front
    );

    // Prefer 250px thumbnail for performance
    return frontImage?.thumbnails?.['250'] || frontImage?.image || null;
  } catch (error) {
    console.log('[ArtworkService] Cover Art Archive error:', error);
    return null;
  }
}

// ============================================================
// iTunes API
// ============================================================

/**
 * Search iTunes for artwork
 */
async function searchItunes(
  artist: string,
  title: string
): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const url = `${ITUNES_API}?term=${query}&media=music&entity=song&limit=1`;

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.log('[ArtworkService] iTunes search failed:', response.status);
      return null;
    }

    const data = await response.json();
    const result = data.results?.[0];

    if (!result?.artworkUrl100) {
      return null;
    }

    // Get higher resolution (600x600) version
    return result.artworkUrl100.replace('100x100', '600x600');
  } catch (error) {
    console.log('[ArtworkService] iTunes error:', error);
    return null;
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Fetch artwork for a song
 *
 * Tries sources in order:
 * 1. Cache
 * 2. MusicBrainz / Cover Art Archive
 * 3. iTunes
 *
 * @param artist - Artist name
 * @param title - Song title
 * @returns Artwork URL or null
 */
export async function fetchArtwork(
  artist: string,
  title: string
): Promise<ArtworkResult> {
  // Validate input
  if (!artist?.trim() || !title?.trim()) {
    return { url: null, source: null };
  }

  const cacheKey = getCacheKey(artist, title);

  // Check cache first
  const cached = artworkCache.get(cacheKey);
  if (cached && isCacheValid(cached)) {
    return { url: cached.url, source: 'cache' };
  }

  // Try MusicBrainz
  console.log('[ArtworkService] Searching MusicBrainz for:', artist, '-', title);
  const musicBrainzUrl = await searchMusicBrainz(artist, title);
  if (musicBrainzUrl) {
    artworkCache.set(cacheKey, { url: musicBrainzUrl, timestamp: Date.now() });
    return { url: musicBrainzUrl, source: 'musicbrainz' };
  }

  // Try iTunes as fallback
  console.log('[ArtworkService] Searching iTunes for:', artist, '-', title);
  const itunesUrl = await searchItunes(artist, title);
  if (itunesUrl) {
    artworkCache.set(cacheKey, { url: itunesUrl, timestamp: Date.now() });
    return { url: itunesUrl, source: 'itunes' };
  }

  // Cache negative result too (to avoid repeated failed searches)
  artworkCache.set(cacheKey, { url: null, timestamp: Date.now() });
  return { url: null, source: null };
}

/**
 * Clear artwork cache
 */
export function clearArtworkCache(): void {
  artworkCache.clear();
}

/**
 * Get cache size (for debugging)
 */
export function getArtworkCacheSize(): number {
  return artworkCache.size;
}
