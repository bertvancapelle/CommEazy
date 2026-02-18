/**
 * Books Storage Service — Download and filesystem management for e-books
 *
 * Handles downloading books from Gutenberg and managing local storage.
 * Implements offline-first architecture where books are always downloaded
 * before reading.
 *
 * Features:
 * - Download books (EPUB/TXT) with progress tracking
 * - Store downloaded books in app documents directory
 * - Track reading progress per book
 * - Storage usage monitoring
 * - Book cleanup/deletion
 *
 * @see .claude/skills/react-native-expert/SKILL.md
 * @see .claude/skills/ios-specialist/SKILL.md
 * @see .claude/skills/android-specialist/SKILL.md
 */

import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Book, DownloadedBook } from './gutenbergService';

// ============================================================
// Types
// ============================================================

/**
 * Reading progress for a book
 */
export interface ReadingProgress {
  bookId: string;
  currentPage: number;           // 1-based page number
  totalPages: number;
  currentChapter?: string;
  characterPosition: number;     // For TTS resume
  percentComplete: number;       // 0-100
  lastReadAt: number;            // Timestamp
  completedAt?: number;          // Timestamp when finished
}

/**
 * Audio listening progress for a book chapter
 */
export interface ChapterProgress {
  bookId: string;
  chapterIndex: number;
  position: number;              // TTS character position
  completedAt?: number;          // Timestamp when completed
  lastPlayedAt: number;          // Timestamp
}

/**
 * Book chapter for audio playback
 * Each chapter is like a "podcast episode"
 */
export interface BookChapter {
  index: number;                 // 0-based chapter index
  title: string;                 // Chapter title (e.g., "Hoofdstuk 1" or "Chapter 1")
  content: string;               // Full chapter text
  startPosition: number;         // Character position in full book
  endPosition: number;           // End character position
  estimatedDuration: number;     // Estimated TTS duration in seconds (rough)
}

/**
 * TTS settings per language
 */
export interface TtsSettings {
  voices: {
    nl?: string;                 // Voice identifier
    en?: string;
    de?: string;
    fr?: string;
    es?: string;
  };
  playbackRate: number;          // 0.5 - 2.0
  pitch: number;                 // 0.5 - 2.0
  sleepTimerMinutes: number | null;
}

/**
 * Reader settings for display
 */
export interface ReaderSettings {
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  lineHeight: 'normal' | 'relaxed' | 'loose';
  theme: 'light' | 'sepia' | 'dark';
  fontFamily: 'system' | 'serif' | 'dyslexic';
}

/**
 * Storage info for UI display
 */
export interface StorageInfo {
  usedBytes: number;
  bookCount: number;
  formattedUsed: string;        // e.g., "45 MB"
}

/**
 * Download progress callback
 */
export type DownloadProgressCallback = (progress: number) => void;

// ============================================================
// Constants
// ============================================================

const BOOKS_DIR = `${RNFS.DocumentDirectoryPath}/books`;
const STORAGE_KEYS = {
  library: '@books:library',
  progress: '@books:progress',
  chapterProgress: '@books:chapterProgress',
  ttsSettings: '@books:ttsSettings',
  readerSettings: '@books:readerSettings',
};

// Default settings
const DEFAULT_TTS_SETTINGS: TtsSettings = {
  voices: {},
  playbackRate: 1.0,
  pitch: 1.0,
  sleepTimerMinutes: null,
};

const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 'medium',
  lineHeight: 'relaxed',
  theme: 'light',
  fontFamily: 'system',
};

// ============================================================
// Books Storage Service
// ============================================================

class BooksStorageService {
  private initialized = false;

  /**
   * Initialize the storage service
   * Creates the books directory if it doesn't exist
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.info('[BooksStorageService] Initializing...');

    try {
      // Create books directory if not exists
      const exists = await RNFS.exists(BOOKS_DIR);
      if (!exists) {
        await RNFS.mkdir(BOOKS_DIR);
        console.debug('[BooksStorageService] Created books directory');
      }

      this.initialized = true;
      console.info('[BooksStorageService] Initialized');
    } catch (error) {
      console.error('[BooksStorageService] Initialization failed:', error);
      throw error;
    }
  }

  // ============================================================
  // Library Management
  // ============================================================

  /**
   * Get all downloaded books (library)
   */
  async getLibrary(): Promise<DownloadedBook[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.library);
      if (!data) return [];

      const library: DownloadedBook[] = JSON.parse(data);

      // Verify files still exist
      const validBooks: DownloadedBook[] = [];
      for (const book of library) {
        const exists = await RNFS.exists(book.localPath);
        if (exists) {
          validBooks.push(book);
        } else {
          console.warn('[BooksStorageService] Book file missing:', book.id);
        }
      }

      // Update library if some books were missing
      if (validBooks.length !== library.length) {
        await this.saveLibrary(validBooks);
      }

      return validBooks;
    } catch (error) {
      console.error('[BooksStorageService] getLibrary failed:', error);
      return [];
    }
  }

  /**
   * Save library to storage
   */
  private async saveLibrary(library: DownloadedBook[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.library, JSON.stringify(library));
  }

  /**
   * Add a book to the library
   */
  async addToLibrary(book: DownloadedBook): Promise<void> {
    const library = await this.getLibrary();
    const existingIndex = library.findIndex(b => b.id === book.id);

    if (existingIndex >= 0) {
      // Update existing entry
      library[existingIndex] = book;
    } else {
      // Add to start of library (most recent first)
      library.unshift(book);
    }

    await this.saveLibrary(library);
    console.debug('[BooksStorageService] Added book to library:', book.id);
  }

  /**
   * Check if a book is in the library
   */
  async isBookDownloaded(bookId: string): Promise<boolean> {
    const library = await this.getLibrary();
    return library.some(book => book.id === bookId);
  }

  /**
   * Get a single book from the library
   */
  async getDownloadedBook(bookId: string): Promise<DownloadedBook | null> {
    const library = await this.getLibrary();
    return library.find(book => book.id === bookId) || null;
  }

  // ============================================================
  // Download Management
  // ============================================================

  /**
   * Download a book from Gutenberg
   *
   * @param book - Book to download
   * @param onProgress - Progress callback (0-1)
   * @returns Downloaded book with local path
   */
  async downloadBook(
    book: Book,
    onProgress?: DownloadProgressCallback
  ): Promise<DownloadedBook> {
    await this.initialize();

    // Determine file extension from URL
    const isEpub = book.downloadUrl.includes('.epub');
    const extension = isEpub ? 'epub' : 'txt';
    const filename = `${book.id}.${extension}`;
    const localPath = `${BOOKS_DIR}/${filename}`;

    console.info('[BooksStorageService] Downloading book:', book.id, 'to', localPath);

    try {
      // Check if file already exists
      const exists = await RNFS.exists(localPath);
      if (exists) {
        console.debug('[BooksStorageService] Book already downloaded:', book.id);
        // Return existing entry from library or create new
        const existing = await this.getDownloadedBook(book.id);
        if (existing) {
          return existing;
        }
      }

      // Download file with progress
      const downloadResult = RNFS.downloadFile({
        fromUrl: book.downloadUrl,
        toFile: localPath,
        progress: (res) => {
          const progress = res.contentLength > 0
            ? res.bytesWritten / res.contentLength
            : 0;
          onProgress?.(progress);
        },
        progressInterval: 100, // Update every 100ms
        begin: (res) => {
          console.debug('[BooksStorageService] Download started, size:', res.contentLength);
        },
      });

      const result = await downloadResult.promise;

      if (result.statusCode !== 200) {
        throw new Error(`Download failed with status: ${result.statusCode}`);
      }

      // Get file size
      const stat = await RNFS.stat(localPath);
      const fileSize = Number(stat.size);

      console.info('[BooksStorageService] Download complete:', book.id, 'size:', fileSize);

      // Create downloaded book entry
      const downloadedBook: DownloadedBook = {
        ...book,
        localPath,
        downloadedAt: Date.now(),
        fileSize,
      };

      // Add to library
      await this.addToLibrary(downloadedBook);

      return downloadedBook;
    } catch (error) {
      console.error('[BooksStorageService] Download failed:', error);

      // Clean up partial download
      const exists = await RNFS.exists(localPath);
      if (exists) {
        await RNFS.unlink(localPath);
      }

      throw error;
    }
  }

  /**
   * Delete a downloaded book
   *
   * @param bookId - Book ID to delete
   */
  async deleteBook(bookId: string): Promise<void> {
    const library = await this.getLibrary();
    const book = library.find(b => b.id === bookId);

    if (!book) {
      console.warn('[BooksStorageService] Book not found:', bookId);
      return;
    }

    try {
      // Delete file
      const exists = await RNFS.exists(book.localPath);
      if (exists) {
        await RNFS.unlink(book.localPath);
        console.debug('[BooksStorageService] Deleted file:', book.localPath);
      }

      // Remove from library
      const newLibrary = library.filter(b => b.id !== bookId);
      await this.saveLibrary(newLibrary);

      // Remove progress data
      await this.deleteProgress(bookId);

      console.info('[BooksStorageService] Deleted book:', bookId);
    } catch (error) {
      console.error('[BooksStorageService] Delete failed:', error);
      throw error;
    }
  }

  /**
   * Delete multiple books
   *
   * @param bookIds - Array of book IDs to delete
   */
  async deleteBooks(bookIds: string[]): Promise<void> {
    for (const bookId of bookIds) {
      await this.deleteBook(bookId);
    }
  }

  // ============================================================
  // Reading Progress
  // ============================================================

  /**
   * Get all reading progress data
   */
  private async getAllProgress(): Promise<Record<string, ReadingProgress>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.progress);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('[BooksStorageService] getAllProgress failed:', error);
      return {};
    }
  }

  /**
   * Get reading progress for a book
   */
  async getProgress(bookId: string): Promise<ReadingProgress | null> {
    const progressMap = await this.getAllProgress();
    return progressMap[bookId] || null;
  }

  /**
   * Save reading progress for a book
   */
  async saveProgress(progress: ReadingProgress): Promise<void> {
    try {
      const progressMap = await this.getAllProgress();
      progressMap[progress.bookId] = {
        ...progress,
        lastReadAt: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progressMap));
      console.debug('[BooksStorageService] Saved progress for:', progress.bookId);
    } catch (error) {
      console.error('[BooksStorageService] saveProgress failed:', error);
    }
  }

  /**
   * Delete progress for a book
   */
  private async deleteProgress(bookId: string): Promise<void> {
    const progressMap = await this.getAllProgress();
    delete progressMap[bookId];
    await AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progressMap));
  }

  /**
   * Check if a book is completed
   */
  async isBookCompleted(bookId: string): Promise<boolean> {
    const progress = await this.getProgress(bookId);
    return progress?.completedAt != null;
  }

  /**
   * Mark a book as completed
   */
  async markAsCompleted(bookId: string): Promise<void> {
    const progress = await this.getProgress(bookId);
    if (progress) {
      progress.completedAt = Date.now();
      progress.percentComplete = 100;
      await this.saveProgress(progress);
    }
  }

  // ============================================================
  // Settings
  // ============================================================

  /**
   * Get TTS settings
   */
  async getTtsSettings(): Promise<TtsSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ttsSettings);
      return data ? { ...DEFAULT_TTS_SETTINGS, ...JSON.parse(data) } : DEFAULT_TTS_SETTINGS;
    } catch (error) {
      console.error('[BooksStorageService] getTtsSettings failed:', error);
      return DEFAULT_TTS_SETTINGS;
    }
  }

  /**
   * Save TTS settings
   */
  async saveTtsSettings(settings: TtsSettings): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.ttsSettings, JSON.stringify(settings));
  }

  /**
   * Get reader settings
   */
  async getReaderSettings(): Promise<ReaderSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.readerSettings);
      return data ? { ...DEFAULT_READER_SETTINGS, ...JSON.parse(data) } : DEFAULT_READER_SETTINGS;
    } catch (error) {
      console.error('[BooksStorageService] getReaderSettings failed:', error);
      return DEFAULT_READER_SETTINGS;
    }
  }

  /**
   * Save reader settings
   */
  async saveReaderSettings(settings: ReaderSettings): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.readerSettings, JSON.stringify(settings));
  }

  // ============================================================
  // Storage Info
  // ============================================================

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<StorageInfo> {
    const library = await this.getLibrary();

    let totalBytes = 0;
    for (const book of library) {
      try {
        const exists = await RNFS.exists(book.localPath);
        if (exists) {
          const stat = await RNFS.stat(book.localPath);
          totalBytes += Number(stat.size);
        }
      } catch (error) {
        // Skip files we can't stat
      }
    }

    return {
      usedBytes: totalBytes,
      bookCount: library.length,
      formattedUsed: this.formatBytes(totalBytes),
    };
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  }

  /**
   * Update last opened timestamp for a book
   */
  async updateLastOpened(bookId: string): Promise<void> {
    const library = await this.getLibrary();
    const bookIndex = library.findIndex(b => b.id === bookId);

    if (bookIndex >= 0) {
      library[bookIndex] = {
        ...library[bookIndex],
        lastOpenedAt: Date.now(),
      };
      await this.saveLibrary(library);
    }
  }

  // ============================================================
  // Book Content
  // ============================================================

  /**
   * Read book content from file
   *
   * @param book - Downloaded book to read
   * @returns Book content as string
   */
  async readBookContent(book: DownloadedBook): Promise<string> {
    try {
      const exists = await RNFS.exists(book.localPath);
      if (!exists) {
        throw new Error('Book file not found');
      }

      // Check if this is an EPUB file (binary ZIP archive)
      const isEpub = book.localPath.endsWith('.epub');
      if (isEpub) {
        // EPUB files are ZIP archives and cannot be read as plain text
        // Re-download as plain text format is needed
        throw new Error('EPUB_FORMAT_NOT_SUPPORTED');
      }

      const content = await RNFS.readFile(book.localPath, 'utf8');
      return content;
    } catch (error) {
      console.error('[BooksStorageService] readBookContent failed:', error);
      throw error;
    }
  }

  /**
   * Check if a book file format is supported for reading
   */
  isFormatSupported(book: DownloadedBook): boolean {
    return book.localPath.endsWith('.txt');
  }

  /**
   * Get a portion of book content for a page
   * For plain text files, we split by estimated page length
   *
   * @param book - Downloaded book
   * @param page - Page number (1-based)
   * @param charsPerPage - Characters per page (default 2000)
   */
  async getPage(
    book: DownloadedBook,
    page: number,
    charsPerPage: number = 2000
  ): Promise<{ content: string; totalPages: number }> {
    const fullContent = await this.readBookContent(book);
    const totalPages = Math.ceil(fullContent.length / charsPerPage);

    const startIndex = (page - 1) * charsPerPage;
    const endIndex = Math.min(startIndex + charsPerPage, fullContent.length);

    // Try to break at paragraph/sentence boundary
    let content = fullContent.substring(startIndex, endIndex);

    // Adjust start to not cut words (find nearest space)
    if (startIndex > 0 && fullContent[startIndex] !== ' ') {
      const spaceIndex = content.indexOf(' ');
      if (spaceIndex > 0 && spaceIndex < 50) {
        content = content.substring(spaceIndex + 1);
      }
    }

    return {
      content: content.trim(),
      totalPages,
    };
  }

  // ============================================================
  // Chapter Parsing (for Audio Player mode)
  // ============================================================

  /**
   * Average TTS reading speed in characters per second
   * Used for rough duration estimates
   */
  private readonly TTS_CHARS_PER_SECOND = 15;

  /**
   * Parse book content into chapters for audio playback
   * Detects common chapter patterns in multiple languages
   *
   * @param book - Downloaded book to parse
   * @returns Array of chapters
   */
  async getBookChapters(book: DownloadedBook): Promise<BookChapter[]> {
    const fullContent = await this.readBookContent(book);

    // Minimum content length for a valid chapter (skip table of contents entries)
    const MIN_CHAPTER_CONTENT = 500; // At least 500 characters = ~30 seconds of TTS

    // Chapter detection patterns for NL, EN, DE, FR, ES
    // Match: "Chapter X", "Hoofdstuk X", "Kapitel X", "Chapitre X", "Capítulo X"
    // Also match Roman numerals and just numbers
    const chapterPatterns = [
      // English
      /^(?:CHAPTER|Chapter)\s+(?:\d+|[IVXLCDM]+)(?:\s*[.:\-–—]\s*.*)?$/gm,
      // Dutch
      /^(?:HOOFDSTUK|Hoofdstuk)\s+(?:\d+|[IVXLCDM]+)(?:\s*[.:\-–—]\s*.*)?$/gm,
      // German
      /^(?:KAPITEL|Kapitel)\s+(?:\d+|[IVXLCDM]+)(?:\s*[.:\-–—]\s*.*)?$/gm,
      // French
      /^(?:CHAPITRE|Chapitre)\s+(?:\d+|[IVXLCDM]+)(?:\s*[.:\-–—]\s*.*)?$/gm,
      // Spanish
      /^(?:CAPÍTULO|Capítulo|CAPITULO|Capitulo)\s+(?:\d+|[IVXLCDM]+)(?:\s*[.:\-–—]\s*.*)?$/gm,
      // Generic numbered patterns (Roman numerals with title)
      /^\s*(?:[IVXLCDM]+)\s*[.:\-–—]\s+[A-Z].+$/gm,
    ];

    // Find all chapter markers
    const allMarkers: { position: number; title: string }[] = [];

    for (const pattern of chapterPatterns) {
      let match;
      // Reset lastIndex for global regex
      pattern.lastIndex = 0;
      while ((match = pattern.exec(fullContent)) !== null) {
        // Avoid duplicates at same position
        const exists = allMarkers.some(m => Math.abs(m.position - match.index) < 50);
        if (!exists) {
          allMarkers.push({
            position: match.index,
            title: match[0].trim(),
          });
        }
      }
    }

    // Sort by position
    allMarkers.sort((a, b) => a.position - b.position);

    // Filter out table of contents entries:
    // TOC entries are clustered together with short distances between them
    // Real chapters have substantial content between markers
    const chapterMarkers: { position: number; title: string }[] = [];

    for (let i = 0; i < allMarkers.length; i++) {
      const marker = allMarkers[i];
      const nextMarker = allMarkers[i + 1];

      // Calculate content length between this marker and the next
      const contentLength = nextMarker
        ? nextMarker.position - marker.position
        : fullContent.length - marker.position;

      // Only include markers with substantial content after them
      // This filters out table of contents entries which are short lines
      if (contentLength >= MIN_CHAPTER_CONTENT) {
        chapterMarkers.push(marker);
      } else {
        console.debug('[BooksStorageService] Skipping TOC entry:', marker.title, '(only', contentLength, 'chars)');
      }
    }

    console.debug('[BooksStorageService] Filtered from', allMarkers.length, 'to', chapterMarkers.length, 'real chapters');

    // If no chapters found, treat entire book as one chapter
    if (chapterMarkers.length === 0) {
      return [{
        index: 0,
        title: book.title,
        content: fullContent,
        startPosition: 0,
        endPosition: fullContent.length,
        estimatedDuration: Math.ceil(fullContent.length / this.TTS_CHARS_PER_SECOND),
      }];
    }

    // Build chapters array
    const chapters: BookChapter[] = [];

    // Check if there's content before first chapter (e.g., prologue, intro)
    if (chapterMarkers[0].position > MIN_CHAPTER_CONTENT) {
      const introContent = fullContent.substring(0, chapterMarkers[0].position).trim();
      if (introContent.length >= MIN_CHAPTER_CONTENT) {
        chapters.push({
          index: 0,
          title: 'Inleiding', // "Introduction" in Dutch
          content: introContent,
          startPosition: 0,
          endPosition: chapterMarkers[0].position,
          estimatedDuration: Math.ceil(introContent.length / this.TTS_CHARS_PER_SECOND),
        });
      }
    }

    // Create chapters from markers
    for (let i = 0; i < chapterMarkers.length; i++) {
      const marker = chapterMarkers[i];
      const nextMarker = chapterMarkers[i + 1];

      const startPosition = marker.position;
      const endPosition = nextMarker ? nextMarker.position : fullContent.length;
      const content = fullContent.substring(startPosition, endPosition).trim();

      chapters.push({
        index: chapters.length,
        title: marker.title,
        content,
        startPosition,
        endPosition,
        estimatedDuration: Math.ceil(content.length / this.TTS_CHARS_PER_SECOND),
      });
    }

    console.debug('[BooksStorageService] Parsed', chapters.length, 'chapters for book:', book.id);
    return chapters;
  }

  // ============================================================
  // Chapter Progress
  // ============================================================

  /**
   * Get all chapter progress data
   */
  private async getAllChapterProgress(): Promise<Record<string, ChapterProgress>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.chapterProgress);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('[BooksStorageService] getAllChapterProgress failed:', error);
      return {};
    }
  }

  /**
   * Get chapter progress key
   */
  private getChapterProgressKey(bookId: string, chapterIndex: number): string {
    return `${bookId}:${chapterIndex}`;
  }

  /**
   * Get listening progress for a chapter
   */
  async getChapterProgress(bookId: string, chapterIndex: number): Promise<ChapterProgress | null> {
    const progressMap = await this.getAllChapterProgress();
    const key = this.getChapterProgressKey(bookId, chapterIndex);
    return progressMap[key] || null;
  }

  /**
   * Save listening progress for a chapter
   */
  async saveChapterProgress(progress: ChapterProgress): Promise<void> {
    try {
      const progressMap = await this.getAllChapterProgress();
      const key = this.getChapterProgressKey(progress.bookId, progress.chapterIndex);
      progressMap[key] = {
        ...progress,
        lastPlayedAt: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.chapterProgress, JSON.stringify(progressMap));
      console.debug('[BooksStorageService] Saved chapter progress:', key);
    } catch (error) {
      console.error('[BooksStorageService] saveChapterProgress failed:', error);
    }
  }

  /**
   * Check if a chapter is completed
   */
  async isChapterCompleted(bookId: string, chapterIndex: number): Promise<boolean> {
    const progress = await this.getChapterProgress(bookId, chapterIndex);
    return progress?.completedAt != null;
  }

  /**
   * Get all chapter progress for a book
   */
  async getBookChapterProgress(bookId: string): Promise<ChapterProgress[]> {
    const progressMap = await this.getAllChapterProgress();
    const bookProgress: ChapterProgress[] = [];

    for (const [key, progress] of Object.entries(progressMap)) {
      if (key.startsWith(`${bookId}:`)) {
        bookProgress.push(progress);
      }
    }

    return bookProgress.sort((a, b) => a.chapterIndex - b.chapterIndex);
  }

  /**
   * Delete all chapter progress for a book
   */
  async deleteBookChapterProgress(bookId: string): Promise<void> {
    const progressMap = await this.getAllChapterProgress();
    const keysToDelete = Object.keys(progressMap).filter(key => key.startsWith(`${bookId}:`));

    for (const key of keysToDelete) {
      delete progressMap[key];
    }

    await AsyncStorage.setItem(STORAGE_KEYS.chapterProgress, JSON.stringify(progressMap));
    console.debug('[BooksStorageService] Deleted chapter progress for book:', bookId);
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const booksStorageService = new BooksStorageService();

// Export default settings for use elsewhere
export { DEFAULT_TTS_SETTINGS, DEFAULT_READER_SETTINGS };
