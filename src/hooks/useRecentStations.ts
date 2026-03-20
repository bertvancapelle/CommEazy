/**
 * useRecentStations — Persists the 10 most recently played radio stations
 *
 * Stores stations in AsyncStorage, sorted from newest to oldest.
 * Used by RadioScreen to show a "Recent" tab as the default landing page.
 *
 * Features:
 * - Max 10 stations (configurable via MAX_RECENT)
 * - Duplicate detection by station ID (moves to top on replay)
 * - AsyncStorage persistence
 * - Sorted newest → oldest (by lastPlayedAt timestamp)
 *
 * @see RadioScreen.tsx
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──────────────────────────────────────────────────────

export interface RecentStation {
  /** Station identifier (matches RadioContext.RadioStation.id) */
  id: string;
  /** Station display name */
  name: string;
  /** Direct stream URL */
  streamUrl: string;
  /** Full country name */
  country: string;
  /** ISO country code (e.g., 'NL') */
  countryCode: string;
  /** Station logo URL */
  favicon?: string;
  /** Station homepage URL */
  homepage?: string;
  /** Timestamp when last played (Date.now()) */
  lastPlayedAt: number;
}

// ── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = '@commeazy/radio/recentStations';
const MAX_RECENT = 10;

// ── Hook ───────────────────────────────────────────────────────

export function useRecentStations() {
  const [recentStations, setRecentStations] = useState<RecentStation[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const isMountedRef = useRef(true);

  // Load from AsyncStorage on mount
  useEffect(() => {
    isMountedRef.current = true;

    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && isMountedRef.current) {
          const parsed: RecentStation[] = JSON.parse(stored);
          // Sort newest first (in case storage was corrupted)
          parsed.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
          setRecentStations(parsed.slice(0, MAX_RECENT));
        }
      } catch (error) {
        console.error('[useRecentStations] Failed to load:', error);
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
  const persist = useCallback(async (stations: RecentStation[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stations));
    } catch (error) {
      console.error('[useRecentStations] Failed to persist:', error);
    }
  }, []);

  // Add a station to recent history (or move it to the top if already present)
  const addRecentStation = useCallback((station: {
    id: string;
    name: string;
    streamUrl: string;
    country: string;
    countryCode: string;
    favicon?: string;
    homepage?: string;
  }) => {
    setRecentStations(prev => {
      // Remove existing entry for this station (if any)
      const filtered = prev.filter(s => s.id !== station.id);

      // Create new entry at the top
      const newEntry: RecentStation = {
        ...station,
        lastPlayedAt: Date.now(),
      };

      // Prepend and cap at MAX_RECENT
      const updated = [newEntry, ...filtered].slice(0, MAX_RECENT);

      // Persist asynchronously
      persist(updated);

      return updated;
    });
  }, [persist]);

  // Remove a single station from recent history
  const removeRecentStation = useCallback((stationId: string) => {
    setRecentStations(prev => {
      const updated = prev.filter(s => s.id !== stationId);
      persist(updated);
      return updated;
    });
  }, [persist]);

  // Clear all recent stations
  const clearRecentStations = useCallback(() => {
    setRecentStations([]);
    persist([]);
  }, [persist]);

  return {
    recentStations,
    isLoaded,
    addRecentStation,
    removeRecentStation,
    clearRecentStations,
  };
}
