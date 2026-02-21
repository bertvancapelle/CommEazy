/**
 * FavoriteLocationsContext — Shared location management for Weather and Radar
 *
 * Provides a shared location state across Weather and Radar tabs.
 * Manages favorite locations, GPS "current location", and location search.
 *
 * Features:
 * - Fixed "Huidige locatie" (GPS) option at top, not removable
 * - Saved favorite locations (max 10)
 * - Location search via Open-Meteo geocoding
 * - Migrates existing weather_saved_locations data
 *
 * Usage:
 * ```tsx
 * const { locations, selectedLocationId, selectLocation } = useFavoriteLocations();
 * ```
 *
 * @see .claude/plans/buienradar-module-plan.md
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { weatherService } from '@/services/weatherService';
import type { GeocodingResult } from '@/types/weather';

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = 'favorite_locations';
const LEGACY_STORAGE_KEY = 'weather_saved_locations';
const MIGRATED_KEY = 'favorite_locations_migrated';
const CURRENT_LOCATION_ID = 'current';
const MAX_LOCATIONS = 10;
const GPS_TIMEOUT_MS = 15000;

// ============================================================
// Types
// ============================================================

export interface FavoriteLocation {
  /** Unique ID: "latitude,longitude" or "current" for GPS */
  id: string;
  /** Place name (e.g., "Amsterdam") */
  name: string;
  /** Latitude coordinate */
  latitude: number;
  /** Longitude coordinate */
  longitude: number;
  /** Country name (optional) */
  country?: string;
  /** Province/state (optional) */
  admin1?: string;
  /** Whether this is the current GPS location */
  isCurrentLocation: boolean;
}

export interface FavoriteLocationsContextValue {
  // Locations
  /** All locations: GPS location (if available) + saved favorites */
  locations: FavoriteLocation[];
  /** Currently selected location ID */
  selectedLocationId: string | null;
  /** The GPS location (always id="current", coordinates dynamic) */
  currentLocation: FavoriteLocation | null;
  /** Currently selected location object */
  selectedLocation: FavoriteLocation | null;

  // Actions
  /** Select a location by ID */
  selectLocation: (id: string) => void;
  /** Add a new favorite location */
  addLocation: (location: Omit<FavoriteLocation, 'id' | 'isCurrentLocation'>) => Promise<void>;
  /** Remove a favorite location (cannot remove GPS location) */
  removeLocation: (id: string) => Promise<void>;

  // GPS
  /** Request current GPS location, returns the location or null on error */
  requestCurrentLocation: () => Promise<FavoriteLocation | null>;
  /** Whether GPS lookup is in progress */
  isLoadingGps: boolean;
  /** GPS error message (if any) */
  gpsError: string | null;

  // Search
  /** Search for locations by name */
  searchLocations: (query: string, countryCode?: string) => Promise<GeocodingResult[]>;
  /** Whether search is in progress */
  isSearching: boolean;

  // State
  /** Whether initial load is complete */
  isLoaded: boolean;
}

const FavoriteLocationsContext = createContext<FavoriteLocationsContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface FavoriteLocationsProviderProps {
  children: ReactNode;
}

export function FavoriteLocationsProvider({ children }: FavoriteLocationsProviderProps) {
  // Saved locations (excluding GPS)
  const [savedLocations, setSavedLocations] = useState<FavoriteLocation[]>([]);
  // GPS location
  const [currentLocation, setCurrentLocation] = useState<FavoriteLocation | null>(null);
  // Selected location ID
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  // Loading states
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // ============================================================
  // Initialization & Migration
  // ============================================================

  useEffect(() => {
    void loadAndMigrateLocations();
  }, []);

  const loadAndMigrateLocations = async () => {
    try {
      // Check if migration is needed
      const migrated = await AsyncStorage.getItem(MIGRATED_KEY);

      if (!migrated) {
        // Migrate from legacy storage
        const legacyData = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyData) {
          const legacyLocations = JSON.parse(legacyData);
          // Convert legacy WeatherLocation format to FavoriteLocation
          const converted: FavoriteLocation[] = legacyLocations.map((loc: Record<string, unknown>) => ({
            id: loc.id as string,
            name: loc.name as string,
            latitude: loc.latitude as number,
            longitude: loc.longitude as number,
            country: loc.country as string | undefined,
            admin1: loc.admin1 as string | undefined,
            isCurrentLocation: false,
          }));

          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(converted));
          await AsyncStorage.setItem(MIGRATED_KEY, 'true');
          setSavedLocations(converted);
          console.info('[FavoriteLocationsContext] Migrated', converted.length, 'locations from legacy storage');
        } else {
          await AsyncStorage.setItem(MIGRATED_KEY, 'true');
        }
      } else {
        // Load from new storage
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setSavedLocations(JSON.parse(stored));
        }
      }

      // Auto-select first location if available
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const locations: FavoriteLocation[] = stored ? JSON.parse(stored) : [];
      if (locations.length > 0 && !selectedLocationId) {
        setSelectedLocationId(locations[0].id);
      }
    } catch (error) {
      console.error('[FavoriteLocationsContext] Load error:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  // ============================================================
  // Combined Locations
  // ============================================================

  const locations = useMemo(() => {
    // GPS location at top (if available), then saved favorites
    const result: FavoriteLocation[] = [];
    if (currentLocation) {
      result.push(currentLocation);
    }
    result.push(...savedLocations);
    return result;
  }, [currentLocation, savedLocations]);

  const selectedLocation = useMemo(() => {
    if (!selectedLocationId) return null;
    return locations.find(loc => loc.id === selectedLocationId) ?? null;
  }, [locations, selectedLocationId]);

  // ============================================================
  // Actions
  // ============================================================

  const selectLocation = useCallback((id: string) => {
    setSelectedLocationId(id);

    // If selecting GPS location and we don't have coordinates yet, request them
    if (id === CURRENT_LOCATION_ID && !currentLocation) {
      void requestCurrentLocation();
    }
  }, [currentLocation]);

  const addLocation = useCallback(async (
    location: Omit<FavoriteLocation, 'id' | 'isCurrentLocation'>
  ) => {
    const id = `${location.latitude},${location.longitude}`;

    // Check if already exists
    if (savedLocations.some(loc => loc.id === id)) {
      console.debug('[FavoriteLocationsContext] Location already exists:', id);
      return;
    }

    // Check max limit
    if (savedLocations.length >= MAX_LOCATIONS) {
      throw new Error('max_locations_reached');
    }

    const newLocation: FavoriteLocation = {
      ...location,
      id,
      isCurrentLocation: false,
    };

    const updated = [...savedLocations, newLocation];
    setSavedLocations(updated);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      console.info('[FavoriteLocationsContext] Location added:', newLocation.name);
    } catch (error) {
      console.error('[FavoriteLocationsContext] Save error:', error);
      // Rollback
      setSavedLocations(savedLocations);
      throw error;
    }
  }, [savedLocations]);

  const removeLocation = useCallback(async (id: string) => {
    // Cannot remove GPS location
    if (id === CURRENT_LOCATION_ID) {
      console.warn('[FavoriteLocationsContext] Cannot remove GPS location');
      return;
    }

    const updated = savedLocations.filter(loc => loc.id !== id);
    setSavedLocations(updated);

    // If removed location was selected, select first available
    if (selectedLocationId === id) {
      if (currentLocation) {
        setSelectedLocationId(CURRENT_LOCATION_ID);
      } else if (updated.length > 0) {
        setSelectedLocationId(updated[0].id);
      } else {
        setSelectedLocationId(null);
      }
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      console.info('[FavoriteLocationsContext] Location removed:', id);
    } catch (error) {
      console.error('[FavoriteLocationsContext] Remove error:', error);
      // Rollback
      setSavedLocations(savedLocations);
      throw error;
    }
  }, [savedLocations, selectedLocationId, currentLocation]);

  // ============================================================
  // GPS
  // ============================================================

  const requestCurrentLocation = useCallback(async (): Promise<FavoriteLocation | null> => {
    setIsLoadingGps(true);
    setGpsError(null);

    try {
      // Request location permission and get current position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          (error) => reject(error),
          {
            enableHighAccuracy: true,
            timeout: GPS_TIMEOUT_MS,
            maximumAge: 60000, // Accept cached position up to 1 minute old
          }
        );
      });

      const { latitude, longitude } = position.coords;
      console.info('[FavoriteLocationsContext] GPS position:', { latitude, longitude });

      // Reverse geocode to get location name
      let locationName = 'Huidige locatie';
      let country: string | undefined;
      let admin1: string | undefined;

      try {
        // Use weatherService to search for nearest location
        const searchResults = await weatherService.searchLocations(
          `${latitude.toFixed(2)},${longitude.toFixed(2)}`,
          'nl'
        );

        // If no results from coordinate search, try reverse geocoding via Open-Meteo
        // For now, just use a fallback name
        if (searchResults.length > 0) {
          const nearest = searchResults[0];
          locationName = nearest.name;
          country = nearest.country;
          admin1 = nearest.admin1;
        }
      } catch (geocodeError) {
        // Fallback: use coordinates as name
        console.warn('[FavoriteLocationsContext] Reverse geocoding failed:', geocodeError);
        locationName = 'Huidige locatie';
      }

      const gpsLocation: FavoriteLocation = {
        id: CURRENT_LOCATION_ID,
        name: locationName,
        latitude,
        longitude,
        country,
        admin1,
        isCurrentLocation: true,
      };

      setCurrentLocation(gpsLocation);

      // Auto-select if no location selected
      if (!selectedLocationId) {
        setSelectedLocationId(CURRENT_LOCATION_ID);
      }

      console.info('[FavoriteLocationsContext] GPS location set:', gpsLocation.name, { latitude, longitude });

      // Return the location so callers can use it immediately
      return gpsLocation;
    } catch (error) {
      const geoError = error as GeolocationPositionError;
      let errorKey = 'modules.weather.gpsError';

      if (geoError.code === 1) {
        // PERMISSION_DENIED
        errorKey = 'modules.weather.gpsPermissionDenied';
        console.warn('[FavoriteLocationsContext] GPS permission denied');
      } else if (geoError.code === 2) {
        // POSITION_UNAVAILABLE
        errorKey = 'modules.weather.gpsUnavailable';
        console.warn('[FavoriteLocationsContext] GPS position unavailable');
      } else if (geoError.code === 3) {
        // TIMEOUT
        errorKey = 'modules.weather.gpsTimeout';
        console.warn('[FavoriteLocationsContext] GPS timeout');
      } else {
        console.error('[FavoriteLocationsContext] GPS error:', geoError.message);
      }

      setGpsError(errorKey);
      return null;
    } finally {
      setIsLoadingGps(false);
    }
  }, [selectedLocationId]);

  // ============================================================
  // Search
  // ============================================================

  const searchLocations = useCallback(async (
    query: string,
    countryCode?: string
  ): Promise<GeocodingResult[]> => {
    if (!query || query.length < 2) {
      return [];
    }

    setIsSearching(true);
    try {
      const results = await weatherService.searchLocations(query, 'nl', countryCode);
      return results.map(loc => ({
        id: parseInt(loc.id, 10) || 0,
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        country: loc.country,
        country_code: '',
        admin1: loc.admin1,
        admin2: loc.admin2,
        timezone: 'Europe/Amsterdam',
      }));
    } catch (error) {
      console.error('[FavoriteLocationsContext] Search error:', error);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo<FavoriteLocationsContextValue>(() => ({
    locations,
    selectedLocationId,
    currentLocation,
    selectedLocation,
    selectLocation,
    addLocation,
    removeLocation,
    requestCurrentLocation,
    isLoadingGps,
    gpsError,
    searchLocations,
    isSearching,
    isLoaded,
  }), [
    locations,
    selectedLocationId,
    currentLocation,
    selectedLocation,
    selectLocation,
    addLocation,
    removeLocation,
    requestCurrentLocation,
    isLoadingGps,
    gpsError,
    searchLocations,
    isSearching,
    isLoaded,
  ]);

  return (
    <FavoriteLocationsContext.Provider value={value}>
      {children}
    </FavoriteLocationsContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useFavoriteLocations(): FavoriteLocationsContextValue {
  const context = useContext(FavoriteLocationsContext);
  if (!context) {
    throw new Error('useFavoriteLocations must be used within a FavoriteLocationsProvider');
  }
  return context;
}

// ============================================================
// Exports
// ============================================================

export { FavoriteLocationsContext, CURRENT_LOCATION_ID };
