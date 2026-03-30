/**
 * Woordraad Word Bank — CommEazy
 *
 * Reads woordraad word lists from locally downloaded JSON files.
 * Word lists are downloaded per language via downloadService on first launch.
 *
 * Two-list architecture:
 * - targetWords: common 5-letter words (Hunspell ∩ OpenSubtitles top-5000) — game solutions
 * - validGuesses: all valid 5-letter words (full Hunspell dictionary) — accepted player input
 *
 * File format (woordraad-{lang}.json):
 * {
 *   "language": "nl",
 *   "version": "1.0",
 *   "generated": "2026-03-30",
 *   "source": "hunspell+opensubtitles",
 *   "targetWords": ["bloem", "regen", "storm", ...],
 *   "validGuesses": ["bloem", "regen", "storm", "aback", ...]
 * }
 *
 * @see src/engines/woordraad/engine.ts
 * @see src/services/downloadService.ts
 */

import { readLocalGameData } from '@/services/downloadService';
import type { WoordraadWordData } from './engine';

// ============================================================
// In-Memory Cache
// ============================================================

let cachedTargetWords: string[] = [];
let cachedValidGuesses: Set<string> = new Set();
let cachedLanguage: string | null = null;

/**
 * Load word lists from local storage into memory.
 * Called once when WoordraadScreen detects data is available.
 *
 * @param language - Language code (e.g. 'nl', 'en')
 * @returns true if word lists were loaded successfully
 */
export async function loadWordLists(language: string): Promise<boolean> {
  // Return cached if already loaded for this language
  if (cachedLanguage === language && cachedTargetWords.length > 0) {
    return true;
  }

  try {
    const data = await readLocalGameData<WoordraadWordData>('woordraad', language);
    if (!data || !data.targetWords || data.targetWords.length === 0) {
      console.warn(`[WordBank] No target words found for language: ${language}`);
      return false;
    }
    if (!data.validGuesses || data.validGuesses.length === 0) {
      console.warn(`[WordBank] No valid guesses found for language: ${language}`);
      return false;
    }

    // Cache target words as-is (lowercase from JSON)
    cachedTargetWords = data.targetWords;

    // Build uppercase Set for fast lookup during gameplay
    cachedValidGuesses = new Set(data.validGuesses.map(w => w.toUpperCase()));

    cachedLanguage = language;
    console.info(
      `[WordBank] Loaded ${cachedTargetWords.length} target words + ${cachedValidGuesses.size} valid guesses for ${language}`,
    );
    return true;
  } catch (error) {
    console.error(`[WordBank] Failed to load word lists for ${language}:`, error);
    return false;
  }
}

/**
 * Clear the in-memory word list cache
 */
export function clearWordCache(): void {
  cachedTargetWords = [];
  cachedValidGuesses = new Set();
  cachedLanguage = null;
}

// ============================================================
// Query Functions
// ============================================================

/**
 * Get the cached target words (game solutions).
 * Words MUST be loaded first via loadWordLists().
 */
export function getTargetWords(): string[] {
  return cachedTargetWords;
}

/**
 * Get the cached valid guesses set (uppercase, for fast lookup).
 * Words MUST be loaded first via loadWordLists().
 */
export function getValidGuesses(): Set<string> {
  return cachedValidGuesses;
}

/**
 * Check whether word lists are loaded in memory
 */
export function isWordListsLoaded(): boolean {
  return cachedTargetWords.length > 0;
}

/**
 * Get the language of the currently loaded word lists
 */
export function getLoadedLanguage(): string | null {
  return cachedLanguage;
}

/**
 * Get word list statistics
 */
export function getWordCounts(): { targetWords: number; validGuesses: number } {
  return {
    targetWords: cachedTargetWords.length,
    validGuesses: cachedValidGuesses.size,
  };
}
