/**
 * useSearchCache — Persists the last search query + results per module
 *
 * Stores in AsyncStorage so reopening a search modal shows previous
 * search results immediately. Seniors often close a modal by accident
 * and expect to find their search still there.
 *
 * Design decisions:
 * - One cached search per module (not a history list — KISS)
 * - No expiration (simplicity for seniors)
 * - Only manual searches are cached (not auto-triggered searches)
 *
 * @see useRecentPodcasts.ts — Similar AsyncStorage pattern
 * @see useRecentStations.ts — Similar AsyncStorage pattern
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──────────────────────────────────────────────────────

export interface SearchCacheEntry<T = unknown> {
  /** The search query string */
  query: string;
  /** The cached search results */
  results: T[];
  /** Timestamp when cached (Date.now()) */
  cachedAt: number;
}

// ── Constants ──────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = '@commeazy/searchCache/';

// ── Hook ───────────────────────────────────────────────────────

export function useSearchCache<T = unknown>(moduleId: string) {
  const [cachedSearch, setCachedSearch] = useState<SearchCacheEntry<T> | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const isMountedRef = useRef(true);
  const storageKey = `${STORAGE_KEY_PREFIX}${moduleId}`;

  // Load from AsyncStorage on mount
  useEffect(() => {
    isMountedRef.current = true;

    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored && isMountedRef.current) {
          const parsed: SearchCacheEntry<T> = JSON.parse(stored);
          setCachedSearch(parsed);
        }
      } catch (error) {
        console.error(`[useSearchCache:${moduleId}] Failed to load:`, error);
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
  }, [storageKey, moduleId]);

  // Save search to cache
  const saveSearch = useCallback(
    async (query: string, results: T[]) => {
      const entry: SearchCacheEntry<T> = {
        query,
        results,
        cachedAt: Date.now(),
      };

      setCachedSearch(entry);

      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(entry));
      } catch (error) {
        console.error(`[useSearchCache:${moduleId}] Failed to persist:`, error);
      }
    },
    [storageKey, moduleId],
  );

  // Clear the cache
  const clearSearch = useCallback(async () => {
    setCachedSearch(null);

    try {
      await AsyncStorage.removeItem(storageKey);
    } catch (error) {
      console.error(`[useSearchCache:${moduleId}] Failed to clear:`, error);
    }
  }, [storageKey, moduleId]);

  return {
    cachedSearch,
    isLoaded,
    saveSearch,
    clearSearch,
  };
}
