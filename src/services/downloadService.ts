/**
 * Download Service — Shared download service for game data
 *
 * Downloads trivia questions, woordy dictionaries, and woordraad word lists
 * from a public GitHub Releases repository. Files are stored locally for
 * offline play.
 *
 * Architecture:
 * - Bundle size: 0 MB (no questions/dictionaries bundled)
 * - Download per language: ~1.5 MB (trivia), ~2 MB (woordy), ~0.5 MB (woordraad)
 * - Stored in DocumentDirectory for persistence across app updates
 * - Language determined by app language setting
 *
 * @see .claude/plans/TRIVIA_DESIGN.md §8.3-8.4
 */

import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Constants
// ============================================================

/** Base URL for game data files on GitHub Releases */
const GITHUB_REPO_BASE_URL =
  'https://github.com/CommEazy/game-data/releases/download';

/** Current data version — bump when question format changes */
const DATA_VERSION = 'v1.0';

/** Local storage directory for game data */
const GAME_DATA_DIR = `${RNFS.DocumentDirectoryPath}/game-data`;

/** Subdirectories per game type */
const TRIVIA_DIR = `${GAME_DATA_DIR}/trivia`;
const WOORDY_DIR = `${GAME_DATA_DIR}/woordy`;
const WOORDRAAD_DIR = `${GAME_DATA_DIR}/woordraad`;

/** AsyncStorage keys for tracking download metadata */
const STORAGE_KEYS = {
  triviaVersion: '@commeazy/trivia-data-version',
  triviaLanguage: '@commeazy/trivia-data-language',
  woordyVersion: '@commeazy/woordy-data-version',
  woordyLanguage: '@commeazy/woordy-data-language',
  woordraadVersion: '@commeazy/woordraad-data-version',
  woordraadLanguage: '@commeazy/woordraad-data-language',
} as const;

/** Download timeout in ms */
const DOWNLOAD_TIMEOUT_MS = 60_000;

/** Maximum retry attempts */
const MAX_RETRIES = 3;

// ============================================================
// Types
// ============================================================

export type GameDataType = 'trivia' | 'woordy' | 'woordraad';

export interface DownloadProgress {
  /** Progress 0-1 */
  progress: number;
  /** Bytes downloaded so far */
  bytesWritten: number;
  /** Total file size in bytes */
  contentLength: number;
}

export interface DownloadResult {
  success: boolean;
  error?: string;
}

export interface DataStatus {
  /** Whether data files exist locally */
  isAvailable: boolean;
  /** Language of downloaded data (e.g. 'nl', 'en') */
  language: string | null;
  /** Data version string */
  version: string | null;
  /** Whether an update is available (version mismatch) */
  needsUpdate: boolean;
}

// ============================================================
// Directory Setup
// ============================================================

/**
 * Ensure game data directories exist
 */
async function ensureDirectories(): Promise<void> {
  const dirs = [GAME_DATA_DIR, TRIVIA_DIR, WOORDY_DIR, WOORDRAAD_DIR];
  for (const dir of dirs) {
    const exists = await RNFS.exists(dir);
    if (!exists) {
      await RNFS.mkdir(dir);
    }
  }
}

// ============================================================
// URL Construction
// ============================================================

/**
 * Build the download URL for a game data file
 */
function getDownloadUrl(type: GameDataType, language: string): string {
  // e.g. https://github.com/CommEazy/game-data/releases/download/v1.0/trivia-nl.json
  return `${GITHUB_REPO_BASE_URL}/${DATA_VERSION}/${type}-${language}.json`;
}

/** Directory mapping per game type */
const TYPE_DIRS: Record<GameDataType, string> = {
  trivia: TRIVIA_DIR,
  woordy: WOORDY_DIR,
  woordraad: WOORDRAAD_DIR,
};

/**
 * Get the local file path for a game data file
 */
function getLocalPath(type: GameDataType, language: string): string {
  return `${TYPE_DIRS[type]}/${type}-${language}.json`;
}

// ============================================================
// Storage Key Helper
// ============================================================

/**
 * Get AsyncStorage keys for a game type
 */
function getStorageKeys(type: GameDataType): { versionKey: string; langKey: string } {
  switch (type) {
    case 'trivia':
      return { versionKey: STORAGE_KEYS.triviaVersion, langKey: STORAGE_KEYS.triviaLanguage };
    case 'woordy':
      return { versionKey: STORAGE_KEYS.woordyVersion, langKey: STORAGE_KEYS.woordyLanguage };
    case 'woordraad':
      return { versionKey: STORAGE_KEYS.woordraadVersion, langKey: STORAGE_KEYS.woordraadLanguage };
  }
}

// ============================================================
// Status Check
// ============================================================

/**
 * Check the status of locally downloaded game data
 */
export async function checkDataStatus(
  type: GameDataType,
  language: string,
): Promise<DataStatus> {
  try {
    const { versionKey, langKey } = getStorageKeys(type);

    const [storedVersion, storedLanguage] = await Promise.all([
      AsyncStorage.getItem(versionKey),
      AsyncStorage.getItem(langKey),
    ]);

    const localPath = getLocalPath(type, language);
    const fileExists = await RNFS.exists(localPath);

    return {
      isAvailable: fileExists && storedLanguage === language,
      language: storedLanguage,
      version: storedVersion,
      needsUpdate: storedVersion !== null && storedVersion !== DATA_VERSION,
    };
  } catch (error) {
    console.warn(`[DownloadService] checkDataStatus failed for ${type}/${language}:`, error);
    return {
      isAvailable: false,
      language: null,
      version: null,
      needsUpdate: false,
    };
  }
}

// ============================================================
// Download
// ============================================================

/**
 * Download game data for a specific language with progress tracking.
 *
 * Flow (per TRIVIA_DESIGN.md §8.4):
 * 1. Ensure directories exist
 * 2. Download file from GitHub Releases with progress callback
 * 3. Validate downloaded file (valid JSON, has expected structure)
 * 4. Persist metadata to AsyncStorage
 *
 * @param type - 'trivia' or 'woordy'
 * @param language - Language code (e.g. 'nl', 'en', 'de')
 * @param onProgress - Progress callback (0-1)
 * @returns DownloadResult
 */
export async function downloadGameData(
  type: GameDataType,
  language: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<DownloadResult> {
  try {
    await ensureDirectories();

    const url = getDownloadUrl(type, language);
    const localPath = getLocalPath(type, language);

    // Remove existing file if present (clean re-download)
    const exists = await RNFS.exists(localPath);
    if (exists) {
      await RNFS.unlink(localPath);
    }

    // Download with retry
    let lastError: string | undefined;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await executeDownload(url, localPath, onProgress);

        if (result.statusCode >= 200 && result.statusCode < 300) {
          // Validate the downloaded file
          const isValid = await validateDownloadedFile(type, localPath);
          if (!isValid) {
            await cleanupFailedDownload(localPath);
            return { success: false, error: 'invalid_data' };
          }

          // Persist metadata
          const { versionKey, langKey } = getStorageKeys(type);
          await AsyncStorage.multiSet([
            [versionKey, DATA_VERSION],
            [langKey, language],
          ]);

          console.info(`[DownloadService] ${type}/${language} downloaded successfully`);
          return { success: true };
        }

        if (result.statusCode === 404) {
          // File not available for this language — no retry
          await cleanupFailedDownload(localPath);
          return { success: false, error: 'not_found' };
        }

        lastError = `HTTP ${result.statusCode}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`[DownloadService] Attempt ${attempt}/${MAX_RETRIES} failed:`, lastError);
      }

      // Exponential backoff before retry
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries exhausted
    await cleanupFailedDownload(localPath);
    return { success: false, error: lastError || 'download_failed' };
  } catch (error) {
    console.error(`[DownloadService] downloadGameData failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

/**
 * Execute a single download attempt with progress tracking
 */
async function executeDownload(
  url: string,
  localPath: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<{ statusCode: number }> {
  const downloadResult = RNFS.downloadFile({
    fromUrl: url,
    toFile: localPath,
    connectionTimeout: DOWNLOAD_TIMEOUT_MS,
    readTimeout: DOWNLOAD_TIMEOUT_MS,
    progressInterval: 100,
    begin: (res) => {
      console.debug(`[DownloadService] Download started, size: ${res.contentLength} bytes`);
    },
    progress: (res) => {
      if (onProgress && res.contentLength > 0) {
        onProgress({
          progress: res.bytesWritten / res.contentLength,
          bytesWritten: res.bytesWritten,
          contentLength: res.contentLength,
        });
      }
    },
  });

  const result = await downloadResult.promise;
  return { statusCode: result.statusCode };
}

// ============================================================
// Validation
// ============================================================

/**
 * Validate that the downloaded file is valid JSON with expected structure
 */
async function validateDownloadedFile(
  type: GameDataType,
  localPath: string,
): Promise<boolean> {
  try {
    const content = await RNFS.readFile(localPath, 'utf8');
    const data = JSON.parse(content);

    if (type === 'trivia') {
      // Expect an object with a "questions" array
      if (!data.questions || !Array.isArray(data.questions)) {
        console.warn('[DownloadService] Trivia file missing "questions" array');
        return false;
      }
      // Spot-check first question has required fields
      if (data.questions.length > 0) {
        const q = data.questions[0];
        if (!q.id || !q.question || !q.correctAnswer || !q.incorrectAnswers) {
          console.warn('[DownloadService] Trivia question missing required fields');
          return false;
        }
      }
      return true;
    }

    if (type === 'woordy') {
      // Expect an object with a "words" array
      if (!data.words || !Array.isArray(data.words)) {
        console.warn('[DownloadService] Woordy file missing "words" array');
        return false;
      }
      return true;
    }

    if (type === 'woordraad') {
      // Expect an object with "targetWords" and "validGuesses" arrays
      if (!data.targetWords || !Array.isArray(data.targetWords)) {
        console.warn('[DownloadService] Woordraad file missing "targetWords" array');
        return false;
      }
      if (!data.validGuesses || !Array.isArray(data.validGuesses)) {
        console.warn('[DownloadService] Woordraad file missing "validGuesses" array');
        return false;
      }
      // Spot-check that arrays contain strings of expected length
      if (data.targetWords.length > 0 && typeof data.targetWords[0] !== 'string') {
        console.warn('[DownloadService] Woordraad targetWords should contain strings');
        return false;
      }
      return true;
    }

    return false;
  } catch (error) {
    console.warn('[DownloadService] File validation failed:', error);
    return false;
  }
}

// ============================================================
// Cleanup & Data Access
// ============================================================

/**
 * Clean up a failed/partial download
 */
async function cleanupFailedDownload(localPath: string): Promise<void> {
  try {
    const exists = await RNFS.exists(localPath);
    if (exists) {
      await RNFS.unlink(localPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Read and parse downloaded game data from local storage
 *
 * @returns Parsed JSON data or null if not available
 */
export async function readLocalGameData<T>(
  type: GameDataType,
  language: string,
): Promise<T | null> {
  try {
    const localPath = getLocalPath(type, language);
    const exists = await RNFS.exists(localPath);
    if (!exists) return null;

    const content = await RNFS.readFile(localPath, 'utf8');
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`[DownloadService] readLocalGameData failed for ${type}/${language}:`, error);
    return null;
  }
}

/**
 * Delete all downloaded data for a game type
 */
export async function clearGameData(type: GameDataType): Promise<void> {
  try {
    const dir = TYPE_DIRS[type];
    const exists = await RNFS.exists(dir);
    if (exists) {
      await RNFS.unlink(dir);
      await RNFS.mkdir(dir);
    }

    const { versionKey, langKey } = getStorageKeys(type);
    await AsyncStorage.multiRemove([versionKey, langKey]);

    console.info(`[DownloadService] Cleared ${type} data`);
  } catch (error) {
    console.error(`[DownloadService] clearGameData failed:`, error);
  }
}

/**
 * Get the total size of downloaded game data in bytes
 */
export async function getStorageUsage(type: GameDataType): Promise<number> {
  try {
    const dir = TYPE_DIRS[type];
    const exists = await RNFS.exists(dir);
    if (!exists) return 0;

    const files = await RNFS.readDir(dir);
    return files.reduce((total, file) => total + (file.size || 0), 0);
  } catch {
    return 0;
  }
}
