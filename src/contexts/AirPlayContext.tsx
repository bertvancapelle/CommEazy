/**
 * AirPlayContext — Route detection and preset management
 *
 * Provides AirPlay speaker detection state and preset storage to the app.
 * iOS only — returns inactive state on Android.
 *
 * Features:
 * - AVRouteDetector integration (speakers available/unavailable)
 * - AVAudioSession route observation (active output name)
 * - Preset management (AsyncStorage, static memory aids)
 *
 * @see AirPlayModule.swift for native iOS implementation
 * @see .claude/CLAUDE.md Section 13 (AudioPlayer Architecture)
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import {
  NativeModules,
  NativeEventEmitter,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Types
// ============================================================

/** Output route information from native module */
export interface AirPlayOutput {
  portName: string;
  portType: string;
  uid: string;
  isAirPlay: boolean;
}

/** AirPlay preset — static memory aid for speaker combinations */
export interface AirPlayPreset {
  id: string;
  name: string;
  speakerNames: string[];
  createdAt: number;
}

export interface AirPlayContextValue {
  /** Whether AirPlay routes are available (speakers on network) */
  routesAvailable: boolean;
  /** Whether audio is currently being output to AirPlay */
  isAirPlayActive: boolean;
  /** Name of the current output device (e.g., "HomePod Woonkamer") */
  activeOutputName: string | null;
  /** Saved presets (memory aids) */
  presets: AirPlayPreset[];
  /** Add a new preset */
  addPreset: (name: string, speakerNames: string[]) => Promise<void>;
  /** Remove a preset by ID */
  removePreset: (id: string) => Promise<void>;
  /** Update a preset */
  updatePreset: (id: string, name: string, speakerNames: string[]) => Promise<void>;
  /** The first/active preset (for hint display) */
  activePreset: AirPlayPreset | null;
}

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = '@commeazy/airplay_presets';

// ============================================================
// Context
// ============================================================

const AirPlayContext = createContext<AirPlayContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface AirPlayProviderProps {
  children: ReactNode;
}

export function AirPlayProvider({ children }: AirPlayProviderProps) {
  const [routesAvailable, setRoutesAvailable] = useState(false);
  const [isAirPlayActive, setIsAirPlayActive] = useState(false);
  const [activeOutputName, setActiveOutputName] = useState<string | null>(null);
  const [presets, setPresets] = useState<AirPlayPreset[]>([]);

  // Load presets from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((data) => {
        if (data) {
          try {
            setPresets(JSON.parse(data));
          } catch {
            console.warn('[AirPlayContext] Failed to parse stored presets');
          }
        }
      })
      .catch(() => {
        console.warn('[AirPlayContext] Failed to load presets');
      });
  }, []);

  // Native module integration (iOS only)
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const AirPlayNative = NativeModules.AirPlayModule;
    if (!AirPlayNative) {
      console.warn('[AirPlayContext] AirPlayModule not available');
      return;
    }

    const emitter = new NativeEventEmitter(AirPlayNative);

    // Listen for route detection changes
    const routesSub = emitter.addListener('airPlayRoutesDetected', (event) => {
      setRoutesAvailable(event.available);
      console.debug('[AirPlayContext] Routes available:', event.available);
    });

    // Listen for route changes (active output)
    const routeChangeSub = emitter.addListener('airPlayRouteChanged', (event) => {
      setIsAirPlayActive(event.isAirPlay);
      setActiveOutputName(event.isAirPlay ? event.outputName : null);
      console.debug('[AirPlayContext] Route changed:', event.outputName, 'isAirPlay:', event.isAirPlay);
    });

    // Start detection
    AirPlayNative.startDetection()
      .then((result: { available: boolean }) => {
        setRoutesAvailable(result.available);
      })
      .catch((error: Error) => {
        console.warn('[AirPlayContext] Failed to start detection:', error);
      });

    // Get initial route
    AirPlayNative.getCurrentRoute()
      .then((result: { outputs: AirPlayOutput[]; isAirPlayActive: boolean }) => {
        setIsAirPlayActive(result.isAirPlayActive);
        const airPlayOutput = result.outputs.find((o) => o.isAirPlay);
        setActiveOutputName(airPlayOutput?.portName ?? null);
      })
      .catch((error: Error) => {
        console.warn('[AirPlayContext] Failed to get current route:', error);
      });

    return () => {
      routesSub.remove();
      routeChangeSub.remove();
      AirPlayNative.stopDetection().catch(() => {});
    };
  }, []);

  // Save presets to AsyncStorage
  const savePresets = useCallback(async (newPresets: AirPlayPreset[]) => {
    setPresets(newPresets);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets));
    } catch {
      console.warn('[AirPlayContext] Failed to save presets');
    }
  }, []);

  const addPreset = useCallback(async (name: string, speakerNames: string[]) => {
    const newPreset: AirPlayPreset = {
      id: `preset_${Date.now()}`,
      name,
      speakerNames,
      createdAt: Date.now(),
    };
    await savePresets([...presets, newPreset]);
  }, [presets, savePresets]);

  const removePreset = useCallback(async (id: string) => {
    await savePresets(presets.filter((p) => p.id !== id));
  }, [presets, savePresets]);

  const updatePreset = useCallback(async (id: string, name: string, speakerNames: string[]) => {
    await savePresets(
      presets.map((p) =>
        p.id === id ? { ...p, name, speakerNames } : p
      )
    );
  }, [presets, savePresets]);

  // First preset as the "active" hint
  const activePreset = presets.length > 0 ? presets[0] : null;

  const value = useMemo<AirPlayContextValue>(
    () => ({
      routesAvailable,
      isAirPlayActive,
      activeOutputName,
      presets,
      addPreset,
      removePreset,
      updatePreset,
      activePreset,
    }),
    [routesAvailable, isAirPlayActive, activeOutputName, presets, addPreset, removePreset, updatePreset, activePreset]
  );

  return (
    <AirPlayContext.Provider value={value}>
      {children}
    </AirPlayContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

export function useAirPlayContext(): AirPlayContextValue {
  const context = useContext(AirPlayContext);
  if (!context) {
    throw new Error('useAirPlayContext must be used within an AirPlayProvider');
  }
  return context;
}

export function useAirPlayContextSafe(): AirPlayContextValue | null {
  return useContext(AirPlayContext);
}
