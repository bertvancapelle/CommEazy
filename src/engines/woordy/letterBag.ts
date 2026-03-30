/**
 * Woordy Letter Bag — CommEazy
 *
 * Manages the tile bag for Woordy. Each language has a specific
 * letter distribution based on letter frequency.
 *
 * @see .claude/plans/WOORDY_DESIGN.md §3.4
 */

import type { Tile } from './types';
import { LETTER_VALUES, BLANK_TILE_COUNT } from './types';

// ============================================================
// Letter Distributions per Language
// ============================================================

/**
 * Letter distribution: how many of each letter in the bag.
 * Based on standard Scrabble distributions adapted per language.
 */
const LETTER_DISTRIBUTIONS: Record<string, Record<string, number>> = {
  nl: {
    A: 6, B: 2, C: 2, D: 5, E: 18, F: 2, G: 3, H: 2, I: 4,
    J: 2, K: 3, L: 3, M: 3, N: 10, O: 6, P: 2, R: 5, S: 5,
    T: 5, U: 3, V: 2, W: 2, Z: 2,
  },
  en: {
    A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9,
    J: 1, K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6,
    S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
  },
  de: {
    A: 5, B: 2, C: 2, D: 4, E: 15, F: 2, G: 3, H: 4, I: 6,
    J: 1, K: 2, L: 3, M: 4, N: 9, O: 3, P: 1, Q: 1, R: 6,
    S: 7, T: 6, U: 6, V: 1, W: 1, X: 1, Y: 1, Z: 1,
  },
  fr: {
    A: 9, B: 2, C: 2, D: 3, E: 15, F: 2, G: 2, H: 2, I: 8,
    J: 1, K: 1, L: 5, M: 3, N: 6, O: 6, P: 2, Q: 1, R: 6,
    S: 6, T: 6, U: 6, V: 2, W: 1, X: 1, Y: 1, Z: 1,
  },
  es: {
    A: 12, B: 2, C: 4, D: 5, E: 12, F: 1, G: 2, H: 2, I: 6,
    J: 1, L: 4, M: 2, N: 5, O: 9, P: 2, Q: 1, R: 5, S: 6,
    T: 4, U: 5, V: 1, X: 1, Y: 1, Z: 2,
  },
  it: {
    A: 14, B: 3, C: 6, D: 3, E: 11, F: 3, G: 2, H: 2, I: 12,
    L: 5, M: 5, N: 5, O: 15, P: 3, Q: 1, R: 6, S: 6, T: 6,
    U: 5, V: 3, Z: 2,
  },
  pt: {
    A: 14, B: 3, C: 4, D: 5, E: 11, F: 2, G: 2, H: 2, I: 10,
    J: 2, L: 5, M: 6, N: 4, O: 10, P: 4, Q: 1, R: 6, S: 8,
    T: 5, U: 7, V: 2, X: 1, Z: 1,
  },
  no: {
    A: 7, B: 3, C: 1, D: 5, E: 9, F: 4, G: 4, H: 3, I: 5,
    J: 2, K: 4, L: 5, M: 3, N: 6, O: 4, P: 2, R: 6, S: 6,
    T: 6, U: 3, V: 3, Y: 1,
  },
  sv: {
    A: 8, B: 2, C: 1, D: 5, E: 7, F: 2, G: 3, H: 2, I: 5,
    J: 1, K: 3, L: 5, M: 3, N: 6, O: 5, P: 2, R: 8, S: 8,
    T: 8, U: 3, V: 2, X: 1, Y: 1,
  },
  da: {
    A: 7, B: 4, C: 2, D: 5, E: 9, F: 3, G: 3, H: 2, I: 4,
    J: 2, K: 4, L: 5, M: 3, N: 7, O: 5, P: 2, R: 6, S: 5,
    T: 6, U: 3, V: 3, Y: 2,
  },
  pl: {
    A: 9, B: 2, C: 3, D: 3, E: 7, F: 1, G: 2, H: 2, I: 8,
    J: 2, K: 3, L: 3, M: 3, N: 5, O: 6, P: 3, R: 4, S: 4,
    T: 3, U: 2, W: 4, Y: 4, Z: 5,
  },
};

/**
 * Default/fallback distribution (English)
 */
const DEFAULT_DISTRIBUTION = LETTER_DISTRIBUTIONS.en;

// ============================================================
// Bag Creation
// ============================================================

let tileIdCounter = 0;

/**
 * Generate a unique tile ID
 */
function generateTileId(): string {
  tileIdCounter += 1;
  return `tile-${tileIdCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Reset the tile ID counter (for testing)
 */
export function resetTileIdCounter(): void {
  tileIdCounter = 0;
}

/**
 * Create a full letter bag for the given language.
 * Includes letter tiles + blank tiles.
 */
export function createLetterBag(language: string): Tile[] {
  const tiles: Tile[] = [];

  // Get language-specific distribution (fall back to English)
  const langCode = language.split('-')[0].toLowerCase(); // 'en-GB' → 'en'
  const distribution = LETTER_DISTRIBUTIONS[langCode] ?? DEFAULT_DISTRIBUTION;

  // Add letter tiles
  for (const [letter, count] of Object.entries(distribution)) {
    for (let i = 0; i < count; i++) {
      tiles.push({
        id: generateTileId(),
        letter,
        value: LETTER_VALUES[letter] ?? 1,
        isBlank: false,
      });
    }
  }

  // Add blank tiles
  for (let i = 0; i < BLANK_TILE_COUNT; i++) {
    tiles.push({
      id: generateTileId(),
      letter: '',
      value: 0,
      isBlank: true,
    });
  }

  return tiles;
}

/**
 * Shuffle a tile bag using Fisher-Yates algorithm
 */
export function shuffleBag(bag: Tile[]): Tile[] {
  const result = [...bag];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Draw tiles from the bag
 * Returns [drawnTiles, remainingBag]
 */
export function drawTiles(bag: Tile[], count: number): [Tile[], Tile[]] {
  const toDraw = Math.min(count, bag.length);
  const drawn = bag.slice(0, toDraw);
  const remaining = bag.slice(toDraw);
  return [drawn, remaining];
}

/**
 * Return tiles to the bag (for tile swap action)
 * Returns the new shuffled bag
 */
export function returnTilesToBag(bag: Tile[], tiles: Tile[]): Tile[] {
  return shuffleBag([...bag, ...tiles]);
}

/**
 * Get the total number of tiles for a language
 */
export function getTotalTileCount(language: string): number {
  const langCode = language.split('-')[0].toLowerCase();
  const distribution = LETTER_DISTRIBUTIONS[langCode] ?? DEFAULT_DISTRIBUTION;
  const letterCount = Object.values(distribution).reduce((sum, n) => sum + n, 0);
  return letterCount + BLANK_TILE_COUNT;
}
