/**
 * Music Play Stats Service — Track play counts and last played per item
 *
 * Tracks how often and when the user last played items (playlists/albums/artists)
 * within CommEazy. Used to sort favorites by "most used" and show "last played".
 *
 * Every tap to play counts as one play — no minimum listen time.
 *
 * Follows the AsyncStorage read/write pattern from musicCollectionService.ts.
 *
 * @see AppleMusicScreen.tsx
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[musicPlayStatsService]';
const STORAGE_KEY = '@commeazy/musicPlayStats';

// ============================================================
// Types
// ============================================================

/** Categories of items we track play stats for */
export type PlayStatsCategory = 'playlist' | 'album' | 'artist';

/** A single play stat entry */
export interface PlayStatEntry {
  /** Category of the item */
  category: PlayStatsCategory;
  /** Unique identifier (collection ID for playlists, catalogId for albums/artists) */
  itemId: string;
  /** Display name (cached for "last played" display) */
  displayName: string;
  /** Artwork URL (cached for "last played" display) */
  artworkUrl: string | null;
  /** Total number of times played */
  playCount: number;
  /** Timestamp of last play */
  lastPlayedAt: number;
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Read all play stats from AsyncStorage.
 */
async function readStats(): Promise<PlayStatEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PlayStatEntry[];
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to read play stats');
    return [];
  }
}

/**
 * Write all play stats to AsyncStorage.
 */
async function writeStats(stats: PlayStatEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to write play stats');
    throw error;
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Record a play for an item. Increments play count and updates lastPlayedAt.
 * Creates a new entry if this is the first play.
 */
export async function recordPlay(
  category: PlayStatsCategory,
  itemId: string,
  metadata: { displayName: string; artworkUrl: string | null },
): Promise<void> {
  const stats = await readStats();
  const existing = stats.find(
    s => s.category === category && s.itemId === itemId,
  );

  if (existing) {
    existing.playCount += 1;
    existing.lastPlayedAt = Date.now();
    // Update cached metadata in case it changed
    existing.displayName = metadata.displayName;
    existing.artworkUrl = metadata.artworkUrl;
  } else {
    stats.push({
      category,
      itemId,
      displayName: metadata.displayName,
      artworkUrl: metadata.artworkUrl,
      playCount: 1,
      lastPlayedAt: Date.now(),
    });
  }

  await writeStats(stats);
  console.debug(LOG_PREFIX, 'Play recorded', { category, itemId });
}

/**
 * Get all play stats, optionally filtered by category.
 */
export async function getPlayStats(
  category?: PlayStatsCategory,
): Promise<PlayStatEntry[]> {
  const stats = await readStats();
  if (!category) return stats;
  return stats.filter(s => s.category === category);
}

/**
 * Get the most recently played item for a category, or null if none.
 */
export async function getLastPlayed(
  category: PlayStatsCategory,
): Promise<PlayStatEntry | null> {
  const stats = await readStats();
  const categoryStats = stats.filter(s => s.category === category);

  if (categoryStats.length === 0) return null;

  return categoryStats.reduce((latest, current) =>
    current.lastPlayedAt > latest.lastPlayedAt ? current : latest,
  );
}

/**
 * Get play stats for a category, sorted by play count descending (most used first).
 * Returns a Map of itemId → PlayStatEntry for quick lookup during sorting.
 */
export async function getStatsSortedByPlayCount(
  category: PlayStatsCategory,
): Promise<Map<string, PlayStatEntry>> {
  const stats = await readStats();
  const categoryStats = stats.filter(s => s.category === category);
  const map = new Map<string, PlayStatEntry>();

  // Sort by playCount descending, then lastPlayedAt descending as tiebreaker
  categoryStats
    .sort((a, b) => b.playCount - a.playCount || b.lastPlayedAt - a.lastPlayedAt)
    .forEach(s => map.set(s.itemId, s));

  return map;
}

/**
 * Remove play stats for a specific item (e.g., when a collection is deleted).
 */
export async function removePlayStats(
  category: PlayStatsCategory,
  itemId: string,
): Promise<void> {
  const stats = await readStats();
  const filtered = stats.filter(
    s => !(s.category === category && s.itemId === itemId),
  );

  if (filtered.length !== stats.length) {
    await writeStats(filtered);
    console.debug(LOG_PREFIX, 'Play stats removed', { category, itemId });
  }
}
