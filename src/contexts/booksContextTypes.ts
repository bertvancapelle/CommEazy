/**
 * BooksContext Types & Constants
 *
 * Extracted from BooksContext for better separation of concerns.
 *
 * Contains:
 * - Type definitions (VoiceQualityStatus, BookMode, AudioProgress, BooksContextValue)
 * - Constants (intervals, page sizes, skip durations)
 * - Helper functions (formatTime, formatSecondsToTime)
 * - Re-exported types from services
 */

import type { TtsVoice, TtsProgress } from '@/services/ttsService';
import type {
  ReadingProgress,
  TtsSettings,
  ReaderSettings,
  StorageInfo,
  BookChapter,
  ChapterProgress,
} from '@/services/booksStorageService';
import type {
  Book,
  DownloadedBook,
} from '@/services/gutenbergService';

// ============================================================
// Types
// ============================================================

/**
 * Voice quality status for TTS
 * Enhanced = minimum required quality for good read-aloud
 * Premium = recommended for best experience
 */
export interface VoiceQualityStatus {
  hasHighQualityVoice: boolean;  // Has Enhanced OR Premium (minimum requirement)
  hasPremiumVoice: boolean;      // Has Premium (recommended)
  highQualityVoices: TtsVoice[]; // All Enhanced + Premium voices
  premiumVoices: TtsVoice[];     // Only Premium voices
  selectedVoice: TtsVoice | null;
  userHasSelectedVoice: boolean; // True if user explicitly chose a voice (vs auto-selected)
  language: string;
}

/**
 * Book mode: 'read' shows text, 'listen' shows podcast-style audio player
 */
export type BookMode = 'read' | 'listen';

/**
 * Audio playback progress (for listen mode)
 */
export interface AudioProgress {
  position: number;      // Character position in current chapter
  duration: number;      // Total characters in current chapter
  percentage: number;    // 0-100
}

export interface BooksContextValue {
  // Library
  library: DownloadedBook[];
  isLibraryLoading: boolean;

  // Download
  downloadQueue: Book[];
  isDownloading: boolean;
  downloadProgress: number; // 0-1
  currentDownload: Book | null;

  // Reading
  currentBook: DownloadedBook | null;
  currentPage: string;
  currentPageNumber: number;
  totalPages: number;
  readingProgress: ReadingProgress | null;

  // TTS Playback (read mode)
  isSpeaking: boolean;
  isPaused: boolean;
  isLoading: boolean;
  ttsProgress: TtsProgress;

  // Audio Player Mode (listen mode - podcast-style chapter playback)
  bookMode: BookMode;
  chapters: BookChapter[];
  currentChapter: BookChapter | null;
  currentChapterIndex: number;
  audioProgress: AudioProgress;
  isAudioLoading: boolean;
  isAudioPlaying: boolean;
  isAudioPaused: boolean;
  playbackRate: number;

  // Voice Quality Status (Enhanced = minimum, Premium = recommended)
  voiceQualityStatus: VoiceQualityStatus | null;

  // Settings
  ttsSettings: TtsSettings;
  readerSettings: ReaderSettings;
  availableVoices: TtsVoice[];

  // Storage
  storageInfo: StorageInfo | null;

  // Player visibility
  showPlayer: boolean;
  setShowPlayer: (show: boolean) => void;

  // Library Actions
  refreshLibrary: () => Promise<void>;
  downloadBook: (book: Book) => Promise<void>;
  deleteBook: (bookId: string) => Promise<void>;
  deleteBooks: (bookIds: string[]) => Promise<void>;
  cancelDownload: (bookId: string) => void;
  isBookDownloaded: (bookId: string) => boolean;

  // Reading Actions
  openBook: (book: DownloadedBook) => Promise<void>;
  closeBook: () => void;
  goToPage: (page: number) => Promise<void>;
  nextPage: () => Promise<void>;
  previousPage: () => Promise<void>;

  // TTS Actions (read mode)
  startReading: () => Promise<void>;
  pauseReading: () => Promise<void>;
  resumeReading: () => Promise<void>;
  stopReading: () => Promise<void>;

  // Audio Player Actions (listen mode)
  setBookMode: (mode: BookMode) => void;
  openBookForListening: (book: DownloadedBook) => Promise<void>;
  playChapter: (chapterIndex: number) => Promise<void>;
  playAudio: () => Promise<void>;
  pauseAudio: () => Promise<void>;
  stopAudio: () => Promise<void>;
  nextChapter: () => Promise<void>;
  previousChapter: () => Promise<void>;
  seekAudioTo: (position: number) => Promise<void>;
  skipAudioForward: (seconds?: number) => Promise<void>;
  skipAudioBackward: (seconds?: number) => Promise<void>;
  setAudioPlaybackRate: (rate: number) => Promise<void>;
  getChapterProgress: (chapterIndex: number) => ChapterProgress | null;
  isChapterCompleted: (chapterIndex: number) => boolean;

  // Settings Actions
  setTtsRate: (rate: number) => Promise<void>;
  setTtsPitch: (pitch: number) => Promise<void>;
  setTtsVoice: (language: string, voiceId: string) => Promise<void>;
  setSleepTimer: (minutes: number | null) => void;
  updateReaderSettings: (settings: Partial<ReaderSettings>) => Promise<void>;

  // Voices
  getVoicesForLanguage: (language: string) => Promise<TtsVoice[]>;
  getHighQualityVoicesForLanguage: (language: string) => Promise<TtsVoice[]>;
  selectVoice: (voice: TtsVoice) => Promise<void>;
  refreshVoiceQualityStatus: () => Promise<void>;
}

// ============================================================
// Constants
// ============================================================

export const PROGRESS_SAVE_INTERVAL = 30000; // Save progress every 30 seconds
export const CHARS_PER_PAGE = 2000; // Characters per page for text files
export const CHAPTER_PROGRESS_SAVE_INTERVAL = 5000; // Save chapter progress every 5 seconds
export const DEFAULT_SKIP_FORWARD = 30; // seconds
export const DEFAULT_SKIP_BACKWARD = 10; // seconds
export const TTS_CHARS_PER_SECOND = 15; // Estimated TTS reading speed

// ============================================================
// Helpers
// ============================================================

/**
 * Format seconds to time string (mm:ss or hh:mm:ss)
 * Exported for use in UI components
 */
export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================
// Re-exported types from services
// ============================================================

export type {
  Book,
  DownloadedBook,
  ReadingProgress,
  TtsSettings,
  ReaderSettings,
  TtsVoice,
  BookChapter,
  ChapterProgress,
  StorageInfo,
  TtsProgress,
};
