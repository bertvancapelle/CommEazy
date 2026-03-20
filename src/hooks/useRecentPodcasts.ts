/**
 * useRecentPodcasts — Persists the 10 most recently played podcast shows
 *
 * Stores shows in AsyncStorage, sorted from newest to oldest.
 * Used by PodcastScreen to show a "Recent" tab as the default landing page.
 *
 * Design decision: Shows recent SHOWS (not episodes) because:
 * - Consistent with Radio's useRecentStations (shows stations, not songs)
 * - Tap on show → opens show detail modal with episode progress indicators
 * - Seniors think in terms of "which podcast was I listening to?"
 *
 * Episode progress (position, completed, etc.) is managed separately by
 * PodcastContext — this hook only tracks which shows were recently played.
 *
 * Features:
 * - Max 10 shows (configurable via MAX_RECENT)
 * - Duplicate detection by show ID (moves to top on replay)
 * - AsyncStorage persistence
 * - Sorted newest → oldest (by lastPlayedAt timestamp)
 *
 * @see useRecentStations.ts — Radio equivalent
 * @see PodcastContext.tsx — Episode progress tracking
 * @see PodcastScreen.tsx — Recent tab UI
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──────────────────────────────────────────────────────

export interface RecentPodcastShow {
  /** Show identifier (matches PodcastContext.PodcastShow.id) */
  id: string;
  /** Show display name */
  title: string;
  /** Show author/creator */
  author: string;
  /** Show artwork URL */
  artwork?: string;
  /** Show RSS feed URL (for reloading episodes) */
  feedUrl: string;
  /** Timestamp when last played (Date.now()) */
  lastPlayedAt: number;
}

// ── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = '@commeazy/podcast/recentShows';
const MAX_RECENT = 10;

// ── Hook ───────────────────────────────────────────────────────

export function useRecentPodcasts() {
  const [recentShows, setRecentShows] = useState<RecentPodcastShow[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const isMountedRef = useRef(true);

  // Load from AsyncStorage on mount
  useEffect(() => {
    isMountedRef.current = true;

    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && isMountedRef.current) {
          const parsed: RecentPodcastShow[] = JSON.parse(stored);
          // Sort newest first (in case storage was corrupted)
          parsed.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
          setRecentShows(parsed.slice(0, MAX_RECENT));
        }
      } catch (error) {
        console.error('[useRecentPodcasts] Failed to load:', error);
      } finally {
        if (isMountedRef.current) {
          setIsLoaded(true);
        }
      }
    };

    load();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Persist to AsyncStorage
  const persist = useCallback(async (shows: RecentPodcastShow[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(shows));
    } catch (error) {
      console.error('[useRecentPodcasts] Failed to persist:', error);
    }
  }, []);

  // Add a show to recent history (or move it to the top if already present)
  const addRecentShow = useCallback((show: {
    id: string;
    title: string;
    author: string;
    artwork?: string;
    feedUrl: string;
  }) => {
    setRecentShows(prev => {
      // Remove existing entry for this show (if any)
      const filtered = prev.filter(s => s.id !== show.id);

      // Create new entry at the top
      const newEntry: RecentPodcastShow = {
        ...show,
        lastPlayedAt: Date.now(),
      };

      // Prepend and cap at MAX_RECENT
      const updated = [newEntry, ...filtered].slice(0, MAX_RECENT);

      // Persist asynchronously
      persist(updated);

      return updated;
    });
  }, [persist]);

  // Remove a single show from recent history
  const removeRecentShow = useCallback((showId: string) => {
    setRecentShows(prev => {
      const updated = prev.filter(s => s.id !== showId);
      persist(updated);
      return updated;
    });
  }, [persist]);

  // Clear all recent shows
  const clearRecentShows = useCallback(() => {
    setRecentShows([]);
    persist([]);
  }, [persist]);

  return {
    recentShows,
    isLoaded,
    addRecentShow,
    removeRecentShow,
    clearRecentShows,
  };
}
