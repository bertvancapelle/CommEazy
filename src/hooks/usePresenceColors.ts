/**
 * usePresenceColors — Hook voor configureerbare presence status kleuren
 *
 * Ondersteunt kleurenblindheid door gebruikers hun eigen kleuren te laten kiezen.
 * Standaardkleuren zijn gekozen voor maximaal contrast en herkenbaarheid.
 *
 * Standaard kleurenschema:
 * - available/chat: #68C414 (groen - online)
 * - away: #FF8F35 (oranje - even weg)
 * - xa (not available): #F13400 (rood - langere tijd weg)
 * - dnd: #F13400 (rood - niet storen, met witte balk)
 * - offline: #A4A4A4 (grijs)
 */

import { useCallback, useState } from 'react';
import type { PresenceShow } from '@/services/interfaces';

// TODO: Add AsyncStorage for persistent user color preferences
// npm install @react-native-async-storage/async-storage
// const STORAGE_KEY = '@commeazy/presence_colors';

/**
 * Configureerbare kleuren per presence status.
 * Gebruikers kunnen deze aanpassen in instellingen.
 */
export interface PresenceColorConfig {
  available: string;
  chat: string;
  away: string;
  xa: string;
  dnd: string;
  offline: string;
}

/**
 * Standaard kleuren - geoptimaliseerd voor zichtbaarheid en kleurenblindheid.
 *
 * - Groen (#68C414): Helder, goed zichtbaar voor de meeste vormen van kleurenblindheid
 * - Oranje (#FF8F35): Duidelijk onderscheidbaar van groen en rood
 * - Rood (#F13400): Waarschuwingskleur, gecombineerd met witte balk voor extra herkenbaarheid
 * - Grijs (#A4A4A4): Neutraal, duidelijk "inactief"
 */
export const DEFAULT_PRESENCE_COLORS: PresenceColorConfig = {
  available: '#68C414',  // Groen - online en beschikbaar
  chat: '#68C414',       // Groen - zelfde als available (ook online)
  away: '#FF8F35',       // Oranje - even weg
  xa: '#F13400',         // Rood - langere tijd weg (not available)
  dnd: '#F13400',        // Rood - niet storen (met witte balk in UI)
  offline: '#A4A4A4',    // Grijs - offline
};

/**
 * Hook om presence kleuren op te halen en te configureren.
 *
 * @returns Object met huidige kleuren en functie om ze aan te passen
 *
 * @example
 * ```tsx
 * const { colors, setColor, resetToDefaults } = usePresenceColors();
 *
 * // Gebruik kleur voor een status
 * <View style={{ backgroundColor: colors.available }} />
 *
 * // Pas een kleur aan
 * await setColor('available', '#00FF00');
 *
 * // Reset naar standaard
 * await resetToDefaults();
 * ```
 */
export function usePresenceColors() {
  const [colors, setColors] = useState<PresenceColorConfig>(DEFAULT_PRESENCE_COLORS);
  // TODO: Load from AsyncStorage when installed
  const isLoaded = true;

  /**
   * Pas een enkele kleur aan.
   * TODO: Persist to AsyncStorage when installed
   */
  const setColor = useCallback((status: PresenceShow, color: string) => {
    setColors(prev => ({ ...prev, [status]: color }));
  }, []);

  /**
   * Pas meerdere kleuren tegelijk aan.
   * TODO: Persist to AsyncStorage when installed
   */
  const setMultipleColors = useCallback((updates: Partial<PresenceColorConfig>) => {
    setColors(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Reset alle kleuren naar standaard.
   */
  const resetToDefaults = useCallback(() => {
    setColors(DEFAULT_PRESENCE_COLORS);
  }, []);

  return {
    /** Huidige kleurenconfiguratie */
    colors,
    /** Of de kleuren geladen zijn uit storage */
    isLoaded,
    /** Pas een enkele kleur aan */
    setColor,
    /** Pas meerdere kleuren tegelijk aan */
    setMultipleColors,
    /** Reset naar standaardkleuren */
    resetToDefaults,
    /** Standaardkleuren voor referentie */
    defaults: DEFAULT_PRESENCE_COLORS,
  };
}

/**
 * Hulpfunctie om een kleur op te halen voor een specifieke status.
 * Gebruikt de standaardkleuren (voor gebruik buiten React componenten).
 */
export function getDefaultPresenceColor(show: PresenceShow): string {
  return DEFAULT_PRESENCE_COLORS[show];
}
