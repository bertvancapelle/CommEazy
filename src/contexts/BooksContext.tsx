/**
 * BooksContext — Global e-books reader state management
 *
 * Provides app-wide access to book reading state:
 * - Library of downloaded books
 * - Current book and reading progress
 * - TTS (text-to-speech) playback controls
 * - Reader settings (font, theme, etc.)
 *
 * Uses native TTS (AVSpeechSynthesizer on iOS, TextToSpeech on Android)
 * for read-aloud functionality.
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  DeviceEventEmitter,
  AppState,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { ttsService, type TtsVoice, type TtsProgress } from '@/services/ttsService';
import { piperTtsService, type PiperTtsEvent } from '@/services/piperTtsService';
import {
  booksStorageService,
  type ReadingProgress,
  type TtsSettings,
  type ReaderSettings,
  type StorageInfo,
  type BookChapter,
  type ChapterProgress,
  DEFAULT_TTS_SETTINGS,
  DEFAULT_READER_SETTINGS,
} from '@/services/booksStorageService';
import {
  searchBooks,
  getPopularBooks,
  initializeBooksCache,
  type Book,
  type DownloadedBook,
} from '@/services/gutenbergService';
import { useAudioOrchestrator } from './AudioOrchestratorContext';

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

const PROGRESS_SAVE_INTERVAL = 30000; // Save progress every 30 seconds
const CHARS_PER_PAGE = 2000; // Characters per page for text files
const CHAPTER_PROGRESS_SAVE_INTERVAL = 5000; // Save chapter progress every 5 seconds
const DEFAULT_SKIP_FORWARD = 30; // seconds
const DEFAULT_SKIP_BACKWARD = 10; // seconds
const TTS_CHARS_PER_SECOND = 15; // Estimated TTS reading speed

// ============================================================
// Context
// ============================================================

const BooksContext = createContext<BooksContextValue | null>(null);

interface BooksProviderProps {
  children: ReactNode;
}

/**
 * Provider component for books context
 */
export function BooksProvider({ children }: BooksProviderProps) {
  const { t, i18n } = useTranslation();
  const audioOrchestrator = useAudioOrchestrator();

  // ============================================================
  // State
  // ============================================================

  // Library state
  const [library, setLibrary] = useState<DownloadedBook[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

  // Download state
  const [downloadQueue, setDownloadQueue] = useState<Book[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentDownload, setCurrentDownload] = useState<Book | null>(null);

  // Reading state
  const [currentBook, setCurrentBook] = useState<DownloadedBook | null>(null);
  const [currentPage, setCurrentPage] = useState<string>('');
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(null);

  // TTS state (read mode)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ttsProgress, setTtsProgress] = useState<TtsProgress>({
    position: 0,
    length: 0,
    percentage: 0,
  });

  // Audio Player state (listen mode)
  const [bookMode, setBookMode] = useState<BookMode>('read');
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<BookChapter | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [audioProgress, setAudioProgress] = useState<AudioProgress>({
    position: 0,
    duration: 0,
    percentage: 0,
  });
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1.0);
  const [chapterProgressMap, setChapterProgressMap] = useState<Record<string, ChapterProgress>>({});

  // Settings
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(DEFAULT_TTS_SETTINGS);
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS);
  const [availableVoices, setAvailableVoices] = useState<TtsVoice[]>([]);

  // Voice Quality Status
  const [voiceQualityStatus, setVoiceQualityStatus] = useState<VoiceQualityStatus | null>(null);

  // Player visibility
  const [showPlayer, setShowPlayer] = useState(false);

  // Refs
  const progressSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const downloadedBookIds = useRef<Set<string>>(new Set());
  const chapterProgressSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const playbackRateRef = useRef(1.0); // Ref for immediate access to current rate
  const pageTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For TTS page transition

  // ============================================================
  // Initialization
  // ============================================================

  useEffect(() => {
    const init = async () => {
      console.info('[BooksContext] Initializing...');

      try {
        // Initialize services
        await Promise.all([
          booksStorageService.initialize(),
          initializeBooksCache(),
          ttsService.initialize(),
        ]);

        // Load library
        const savedLibrary = await booksStorageService.getLibrary();
        setLibrary(savedLibrary);
        downloadedBookIds.current = new Set(savedLibrary.map(b => b.id));

        // Load settings
        const [savedTtsSettings, savedReaderSettings] = await Promise.all([
          booksStorageService.getTtsSettings(),
          booksStorageService.getReaderSettings(),
        ]);
        setTtsSettings(savedTtsSettings);
        setReaderSettings(savedReaderSettings);

        // Load storage info
        const info = await booksStorageService.getStorageInfo();
        setStorageInfo(info);

        // Load available voices for current language
        const voices = await ttsService.getVoicesForLanguage(i18n.language);
        setAvailableVoices(voices);

        setIsLibraryLoading(false);
        console.info('[BooksContext] Initialized');
      } catch (error) {
        console.error('[BooksContext] Initialization failed:', error);
        setIsLibraryLoading(false);
      }
    };

    init();

    // TTS event listeners
    const progressUnsubscribe = ttsService.onProgress((progress) => {
      setTtsProgress(progress);
    });

    const completeUnsubscribe = ttsService.onComplete(() => {
      handleTtsComplete();
    });

    const errorUnsubscribe = ttsService.onError((error) => {
      console.error('[BooksContext] TTS error:', error);
      setIsSpeaking(false);
      setIsPaused(false);
      DeviceEventEmitter.emit('booksTtsError', { error });
    });

    return () => {
      progressUnsubscribe();
      completeUnsubscribe();
      errorUnsubscribe();

      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current);
      }
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
      }
      if (chapterProgressSaveIntervalRef.current) {
        clearInterval(chapterProgressSaveIntervalRef.current);
      }
      if (pageTransitionTimeoutRef.current) {
        clearTimeout(pageTransitionTimeoutRef.current);
      }

      ttsService.cleanup();
      piperTtsService.cleanup();
    };
  }, []);

  // Load voices when language changes
  useEffect(() => {
    const loadVoices = async () => {
      const voices = await ttsService.getVoicesForLanguage(i18n.language);
      setAvailableVoices(voices);
    };
    loadVoices();
  }, [i18n.language]);

  // Save progress periodically while reading
  useEffect(() => {
    if (currentBook && readingProgress) {
      progressSaveIntervalRef.current = setInterval(async () => {
        if (readingProgress) {
          await booksStorageService.saveProgress(readingProgress);
        }
      }, PROGRESS_SAVE_INTERVAL);

      return () => {
        if (progressSaveIntervalRef.current) {
          clearInterval(progressSaveIntervalRef.current);
        }
      };
    }
  }, [currentBook, readingProgress]);

  // Handle app state changes (save progress when backgrounded)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background' && readingProgress) {
        await booksStorageService.saveProgress(readingProgress);
      }
    });

    return () => subscription.remove();
  }, [readingProgress]);

  // ============================================================
  // TTS Completion Handler
  // ============================================================

  const handleTtsComplete = useCallback(async () => {
    console.debug('[BooksContext] TTS complete');
    setIsSpeaking(false);
    setIsPaused(false);

    // Move to next page if available
    if (currentPageNumber < totalPages) {
      await goToPage(currentPageNumber + 1);
      // Continue reading on next page (with cleanup to prevent memory leak)
      if (pageTransitionTimeoutRef.current) {
        clearTimeout(pageTransitionTimeoutRef.current);
      }
      pageTransitionTimeoutRef.current = setTimeout(async () => {
        pageTransitionTimeoutRef.current = null;
        await startReadingInternal();
      }, 500);
    } else {
      // Book completed
      if (currentBook) {
        await booksStorageService.markAsCompleted(currentBook.id);
        AccessibilityInfo.announceForAccessibility(
          t('modules.books.reading.completed')
        );
      }
    }
  }, [currentPageNumber, totalPages, currentBook, t]);

  // ============================================================
  // Voice Command Listeners
  // ============================================================

  useEffect(() => {
    const playSubscription = DeviceEventEmitter.addListener('voiceCommand:booksPlay', () => {
      if (currentBook && !isSpeaking) {
        startReading();
      } else if (isPaused) {
        resumeReading();
      }
    });

    const pauseSubscription = DeviceEventEmitter.addListener('voiceCommand:booksPause', () => {
      if (isSpeaking) {
        pauseReading();
      }
    });

    const stopSubscription = DeviceEventEmitter.addListener('voiceCommand:booksStop', () => {
      stopReading();
    });

    const nextSubscription = DeviceEventEmitter.addListener('voiceCommand:booksNextPage', () => {
      nextPage();
    });

    const prevSubscription = DeviceEventEmitter.addListener('voiceCommand:booksPrevPage', () => {
      previousPage();
    });

    return () => {
      playSubscription.remove();
      pauseSubscription.remove();
      stopSubscription.remove();
      nextSubscription.remove();
      prevSubscription.remove();
    };
  }, [currentBook, isSpeaking, isPaused]);

  // ============================================================
  // Library Actions
  // ============================================================

  const refreshLibrary = useCallback(async () => {
    setIsLibraryLoading(true);
    try {
      const savedLibrary = await booksStorageService.getLibrary();
      setLibrary(savedLibrary);
      downloadedBookIds.current = new Set(savedLibrary.map(b => b.id));

      const info = await booksStorageService.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('[BooksContext] refreshLibrary failed:', error);
    }
    setIsLibraryLoading(false);
  }, []);

  const downloadBook = useCallback(async (book: Book) => {
    // Add to queue
    setDownloadQueue(prev => [...prev, book]);

    // If not already downloading, start
    if (!isDownloading) {
      processDownloadQueue();
    }
  }, [isDownloading]);

  const processDownloadQueue = useCallback(async () => {
    if (downloadQueue.length === 0) {
      setIsDownloading(false);
      setCurrentDownload(null);
      return;
    }

    setIsDownloading(true);
    const book = downloadQueue[0];
    setCurrentDownload(book);
    setDownloadProgress(0);

    try {
      const downloadedBook = await booksStorageService.downloadBook(
        book,
        (progress) => setDownloadProgress(progress)
      );

      // Update library
      setLibrary(prev => [downloadedBook, ...prev.filter(b => b.id !== book.id)]);
      downloadedBookIds.current.add(book.id);

      // Update storage info
      const info = await booksStorageService.getStorageInfo();
      setStorageInfo(info);

      // Announce completion
      AccessibilityInfo.announceForAccessibility(
        t('modules.books.downloadComplete')
      );

      // Remove from queue and process next
      setDownloadQueue(prev => prev.slice(1));
      setCurrentDownload(null);
      setDownloadProgress(0);

      // Process next in queue
      if (downloadQueue.length > 1) {
        processDownloadQueue();
      } else {
        setIsDownloading(false);
      }
    } catch (error) {
      console.error('[BooksContext] Download failed:', error);

      // Remove from queue
      setDownloadQueue(prev => prev.slice(1));
      setCurrentDownload(null);
      setIsDownloading(false);

      DeviceEventEmitter.emit('booksDownloadError', { book, error });
    }
  }, [downloadQueue, t]);

  // Start processing when queue changes
  useEffect(() => {
    if (downloadQueue.length > 0 && !isDownloading) {
      processDownloadQueue();
    }
  }, [downloadQueue, isDownloading, processDownloadQueue]);

  const deleteBook = useCallback(async (bookId: string) => {
    try {
      // If this is the current book, close it first
      if (currentBook?.id === bookId) {
        closeBook();
      }

      await booksStorageService.deleteBook(bookId);

      // Update library
      setLibrary(prev => prev.filter(b => b.id !== bookId));
      downloadedBookIds.current.delete(bookId);

      // Update storage info
      const info = await booksStorageService.getStorageInfo();
      setStorageInfo(info);

      AccessibilityInfo.announceForAccessibility(
        t('modules.books.deleted')
      );
    } catch (error) {
      console.error('[BooksContext] Delete failed:', error);
      throw error;
    }
  }, [currentBook, t]);

  const deleteBooks = useCallback(async (bookIds: string[]) => {
    for (const bookId of bookIds) {
      await deleteBook(bookId);
    }
  }, [deleteBook]);

  const cancelDownload = useCallback((bookId: string) => {
    setDownloadQueue(prev => prev.filter(b => b.id !== bookId));

    if (currentDownload?.id === bookId) {
      // TODO: Actually cancel the download (needs RNFS support)
      setCurrentDownload(null);
      setIsDownloading(false);
    }
  }, [currentDownload]);

  const isBookDownloaded = useCallback((bookId: string): boolean => {
    return downloadedBookIds.current.has(bookId);
  }, []);

  // ============================================================
  // Reading Actions
  // ============================================================

  const openBook = useCallback(async (book: DownloadedBook) => {
    console.info('[BooksContext] Opening book:', book.id);

    try {
      setIsLoading(true);
      setCurrentBook(book);

      // Check if format is supported
      if (!booksStorageService.isFormatSupported(book)) {
        console.warn('[BooksContext] Book format not supported (EPUB):', book.localPath);
        // Delete the EPUB file and inform user to re-download
        await booksStorageService.deleteBook(book.id);
        setLibrary(prev => prev.filter(b => b.id !== book.id));
        downloadedBookIds.current.delete(book.id);

        setIsLoading(false);
        setCurrentBook(null);

        // Emit event to show error and suggestion to re-download
        DeviceEventEmitter.emit('booksFormatError', {
          book,
          message: t('modules.books.errors.formatNotSupported'),
        });
        return;
      }

      // Update last opened
      await booksStorageService.updateLastOpened(book.id);

      // Load reading progress
      const progress = await booksStorageService.getProgress(book.id);

      if (progress) {
        setReadingProgress(progress);
        setCurrentPageNumber(progress.currentPage);
        setTotalPages(progress.totalPages);

        // Load the page
        const pageData = await booksStorageService.getPage(book, progress.currentPage, CHARS_PER_PAGE);
        setCurrentPage(pageData.content);
        setTotalPages(pageData.totalPages);

        // Announce resume
        AccessibilityInfo.announceForAccessibility(
          t('modules.books.reading.resumeFrom', { page: progress.currentPage })
        );
      } else {
        // Start from beginning
        const pageData = await booksStorageService.getPage(book, 1, CHARS_PER_PAGE);
        setCurrentPage(pageData.content);
        setCurrentPageNumber(1);
        setTotalPages(pageData.totalPages);

        // Create initial progress
        const newProgress: ReadingProgress = {
          bookId: book.id,
          currentPage: 1,
          totalPages: pageData.totalPages,
          characterPosition: 0,
          percentComplete: 0,
          lastReadAt: Date.now(),
        };
        setReadingProgress(newProgress);
        await booksStorageService.saveProgress(newProgress);
      }

      // Check for voice quality availability
      // Enhanced = minimum required, Premium = recommended
      const bookLanguage = book.language || i18n.language;
      const highQualityVoices = await ttsService.getHighQualityVoicesForLanguage(bookLanguage);
      const premiumVoices = await ttsService.getPremiumVoicesForLanguage(bookLanguage);
      const hasHighQualityVoice = highQualityVoices.length > 0;
      const hasPremiumVoice = premiumVoices.length > 0;

      // Get saved voice preference for this language
      const savedVoiceId = ttsSettings.voices[bookLanguage as keyof typeof ttsSettings.voices];
      let selectedVoice: TtsVoice | null = null;
      let userHasSelectedVoice = false;

      if (savedVoiceId && hasHighQualityVoice) {
        // Try to find saved voice in high-quality voices
        selectedVoice = highQualityVoices.find(v => v.id === savedVoiceId) || null;
        // User has explicitly selected a voice if we found it in the saved settings
        userHasSelectedVoice = selectedVoice !== null;
      }
      if (!selectedVoice && hasHighQualityVoice) {
        // Auto-select best available: prefer Premium over Enhanced
        // Note: userHasSelectedVoice stays false - this is auto-selection
        selectedVoice = premiumVoices[0] || highQualityVoices[0];
      }

      setVoiceQualityStatus({
        hasHighQualityVoice,
        hasPremiumVoice,
        highQualityVoices,
        premiumVoices,
        selectedVoice,
        userHasSelectedVoice,
        language: bookLanguage,
      });

      console.info('[BooksContext] Voice quality status for', bookLanguage, ':', {
        hasHighQualityVoice,
        hasPremiumVoice,
        highQualityCount: highQualityVoices.length,
        premiumCount: premiumVoices.length,
        selectedVoice: selectedVoice?.name,
        selectedQuality: selectedVoice?.quality,
      });

      setIsLoading(false);
    } catch (error) {
      console.error('[BooksContext] openBook failed:', error);
      setIsLoading(false);
      setCurrentBook(null);
      throw error;
    }
  }, [t, i18n.language, ttsSettings.voices]);

  const closeBook = useCallback(() => {
    // Save progress before closing
    if (readingProgress) {
      booksStorageService.saveProgress(readingProgress);
    }

    // Stop TTS if playing
    if (isSpeaking) {
      ttsService.stop();
    }

    setCurrentBook(null);
    setCurrentPage('');
    setCurrentPageNumber(1);
    setTotalPages(0);
    setReadingProgress(null);
    setIsSpeaking(false);
    setIsPaused(false);
    setShowPlayer(false);

    console.debug('[BooksContext] Book closed');
  }, [readingProgress, isSpeaking]);

  const goToPage = useCallback(async (page: number) => {
    if (!currentBook) return;

    const clampedPage = Math.max(1, Math.min(page, totalPages));

    try {
      const pageData = await booksStorageService.getPage(currentBook, clampedPage, CHARS_PER_PAGE);
      setCurrentPage(pageData.content);
      setCurrentPageNumber(clampedPage);

      // Update progress
      const percentComplete = (clampedPage / pageData.totalPages) * 100;
      const newProgress: ReadingProgress = {
        ...readingProgress!,
        currentPage: clampedPage,
        totalPages: pageData.totalPages,
        percentComplete,
        lastReadAt: Date.now(),
      };
      setReadingProgress(newProgress);

      // If TTS was playing, restart on new page
      if (isSpeaking) {
        await ttsService.stop();
        await startReadingInternal();
      }
    } catch (error) {
      console.error('[BooksContext] goToPage failed:', error);
    }
  }, [currentBook, totalPages, readingProgress, isSpeaking]);

  const nextPage = useCallback(async () => {
    if (currentPageNumber < totalPages) {
      await goToPage(currentPageNumber + 1);

      AccessibilityInfo.announceForAccessibility(
        t('modules.books.reading.page', {
          current: currentPageNumber + 1,
          total: totalPages,
        })
      );
    }
  }, [currentPageNumber, totalPages, goToPage, t]);

  const previousPage = useCallback(async () => {
    if (currentPageNumber > 1) {
      await goToPage(currentPageNumber - 1);

      AccessibilityInfo.announceForAccessibility(
        t('modules.books.reading.page', {
          current: currentPageNumber - 1,
          total: totalPages,
        })
      );
    }
  }, [currentPageNumber, goToPage, t]);

  // ============================================================
  // TTS Actions
  // ============================================================

  const startReadingInternal = useCallback(async () => {
    if (!currentPage) return;

    // Request playback from orchestrator (stops other audio sources)
    await audioOrchestrator.requestPlayback('books');

    setIsLoading(true);

    // Get voice for book language
    const bookLanguage = currentBook?.language || i18n.language;
    const voiceId = ttsSettings.voices[bookLanguage as keyof typeof ttsSettings.voices];

    try {
      await ttsService.speak(
        currentPage,
        voiceId,
        ttsSettings.playbackRate,
        ttsSettings.pitch
      );

      setIsSpeaking(true);
      setIsPaused(false);
      setIsLoading(false);
      setShowPlayer(true);

      console.debug('[BooksContext] TTS started');
    } catch (error) {
      console.error('[BooksContext] startReading failed:', error);
      setIsLoading(false);
    }
  }, [currentPage, currentBook, ttsSettings, i18n.language, audioOrchestrator]);

  const startReading = useCallback(async () => {
    await startReadingInternal();

    AccessibilityInfo.announceForAccessibility(
      t('modules.books.tts.readAloud')
    );
  }, [startReadingInternal, t]);

  const pauseReading = useCallback(async () => {
    await ttsService.pause();
    setIsSpeaking(false);
    setIsPaused(true);

    AccessibilityInfo.announceForAccessibility(
      t('modules.books.tts.pause')
    );
  }, [t]);

  const resumeReading = useCallback(async () => {
    await ttsService.resume();
    setIsSpeaking(true);
    setIsPaused(false);

    AccessibilityInfo.announceForAccessibility(
      t('modules.books.tts.resume')
    );
  }, [t]);

  const stopReading = useCallback(async () => {
    await ttsService.stop();
    setIsSpeaking(false);
    setIsPaused(false);
    setShowPlayer(false);
    setTtsProgress({ position: 0, length: 0, percentage: 0 });
    audioOrchestrator.releasePlayback('books');

    // Clear sleep timer
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    AccessibilityInfo.announceForAccessibility(
      t('modules.books.tts.stop')
    );
  }, [audioOrchestrator, t]);

  // ============================================================
  // Audio Player Actions (Listen Mode)
  // ============================================================

  /**
   * Open a book for listening (podcast-style chapter playback)
   * Parses the book into chapters and loads saved progress
   */
  const openBookForListening = useCallback(async (book: DownloadedBook) => {
    console.info('[BooksContext] Opening book for listening:', book.id);

    try {
      setIsAudioLoading(true);
      setCurrentBook(book);
      setBookMode('listen');

      // Check if format is supported
      if (!booksStorageService.isFormatSupported(book)) {
        console.warn('[BooksContext] Book format not supported (EPUB):', book.localPath);
        setIsAudioLoading(false);
        setCurrentBook(null);
        setBookMode('read');
        DeviceEventEmitter.emit('booksFormatError', {
          book,
          message: t('modules.books.errors.formatNotSupported'),
        });
        return;
      }

      // Parse book into chapters
      const bookChapters = await booksStorageService.getBookChapters(book);
      setChapters(bookChapters);

      console.info('[BooksContext] Parsed', bookChapters.length, 'chapters');

      // Load saved chapter progress for this book
      const savedProgress = await booksStorageService.getBookChapterProgress(book.id);
      const progressMap: Record<string, ChapterProgress> = {};
      for (const progress of savedProgress) {
        const key = `${book.id}:${progress.chapterIndex}`;
        progressMap[key] = progress;
      }
      setChapterProgressMap(progressMap);

      // Find the last played chapter or start from beginning
      let resumeChapterIndex = 0;
      let lastPlayedAt = 0;

      for (const progress of savedProgress) {
        if (!progress.completedAt && progress.lastPlayedAt > lastPlayedAt) {
          resumeChapterIndex = progress.chapterIndex;
          lastPlayedAt = progress.lastPlayedAt;
        }
      }

      // If all chapters are completed, start from beginning
      const allCompleted = savedProgress.length > 0 &&
        savedProgress.every(p => p.completedAt !== undefined);
      if (allCompleted) {
        resumeChapterIndex = 0;
      }

      // Set current chapter
      if (bookChapters.length > 0) {
        setCurrentChapter(bookChapters[resumeChapterIndex]);
        setCurrentChapterIndex(resumeChapterIndex);

        // Load progress for this chapter
        const chapterProgress = savedProgress.find(p => p.chapterIndex === resumeChapterIndex);
        if (chapterProgress && !chapterProgress.completedAt) {
          setAudioProgress({
            position: chapterProgress.position,
            duration: bookChapters[resumeChapterIndex].content.length,
            percentage: (chapterProgress.position / bookChapters[resumeChapterIndex].content.length) * 100,
          });
        } else {
          setAudioProgress({
            position: 0,
            duration: bookChapters[resumeChapterIndex].content.length,
            percentage: 0,
          });
        }
      }

      // Check voice quality
      const bookLanguage = book.language || i18n.language;
      const highQualityVoices = await ttsService.getHighQualityVoicesForLanguage(bookLanguage);
      const premiumVoices = await ttsService.getPremiumVoicesForLanguage(bookLanguage);
      const hasHighQualityVoice = highQualityVoices.length > 0;
      const hasPremiumVoice = premiumVoices.length > 0;

      // Get saved voice preference
      const savedVoiceId = ttsSettings.voices[bookLanguage as keyof typeof ttsSettings.voices];
      let selectedVoice: TtsVoice | null = null;
      let userHasSelectedVoice = false;

      if (savedVoiceId && hasHighQualityVoice) {
        selectedVoice = highQualityVoices.find(v => v.id === savedVoiceId) || null;
        userHasSelectedVoice = selectedVoice !== null;
      }
      if (!selectedVoice && hasHighQualityVoice) {
        selectedVoice = premiumVoices[0] || highQualityVoices[0];
      }

      setVoiceQualityStatus({
        hasHighQualityVoice,
        hasPremiumVoice,
        highQualityVoices,
        premiumVoices,
        selectedVoice,
        userHasSelectedVoice,
        language: bookLanguage,
      });

      setIsAudioLoading(false);
      console.info('[BooksContext] Book ready for listening, starting at chapter', resumeChapterIndex);
    } catch (error) {
      console.error('[BooksContext] openBookForListening failed:', error);
      setIsAudioLoading(false);
      setCurrentBook(null);
      setBookMode('read');
      throw error;
    }
  }, [t, i18n.language, ttsSettings.voices]);

  /**
   * Play a specific chapter using Piper TTS (high-quality offline voice)
   */
  const playChapter = useCallback(async (chapterIndex: number) => {
    if (!currentBook || chapterIndex < 0 || chapterIndex >= chapters.length) {
      console.warn('[BooksContext] Invalid chapter index:', chapterIndex);
      return;
    }

    const chapter = chapters[chapterIndex];
    console.info('[BooksContext] Playing chapter with Piper TTS:', chapterIndex, chapter.title);

    try {
      // Request playback from orchestrator (stops other audio sources)
      await audioOrchestrator.requestPlayback('books');

      setIsAudioLoading(true);
      setCurrentChapter(chapter);
      setCurrentChapterIndex(chapterIndex);

      // Load saved progress for this chapter BEFORE stopping/starting TTS
      const key = `${currentBook.id}:${chapterIndex}`;
      const savedProgress = chapterProgressMap[key];
      let startPosition = 0;

      if (savedProgress && !savedProgress.completedAt) {
        startPosition = savedProgress.position;
      }

      // CRITICAL: Set audio progress BEFORE stopping TTS to prevent duration reset
      // This ensures the UI shows correct time immediately
      setAudioProgress({
        position: startPosition,
        duration: chapter.content.length,
        percentage: (startPosition / chapter.content.length) * 100,
      });

      // Update start position ref for progress calculation
      playbackStartPositionRef.current = startPosition;

      // Stop any existing TTS (both system and Piper) - but DON'T call stopAudio()
      // which would reset audioProgress
      await ttsService.stop();
      await piperTtsService.stop();

      // Initialize Piper TTS if not already initialized
      const piperInitialized = await piperTtsService.initialize();
      if (!piperInitialized) {
        console.warn('[BooksContext] Piper TTS not available, falling back to system TTS');
        // Fallback to system TTS
        await playChapterWithSystemTts(chapterIndex);
        return;
      }

      if (startPosition > 0) {
        AccessibilityInfo.announceForAccessibility(
          t('modules.books.audio.resumeFrom', {
            time: formatSecondsToTime(Math.floor(startPosition / TTS_CHARS_PER_SECOND)),
          })
        );
      }

      // Start TTS from position (or beginning)
      const textToSpeak = startPosition > 0
        ? chapter.content.substring(startPosition)
        : chapter.content;

      // Use Piper TTS with chunked playback for faster first-audio
      // This splits text into paragraphs and starts playing immediately
      // after the first paragraph is generated (~2-3 seconds)
      // Use playbackRateRef for immediate access to the latest rate value
      const success = await piperTtsService.speakChunked(textToSpeak, playbackRateRef.current);

      if (!success) {
        console.warn('[BooksContext] Piper TTS speak failed, falling back to system TTS');
        await playChapterWithSystemTts(chapterIndex);
        return;
      }

      setIsAudioPlaying(true);
      setIsAudioPaused(false);
      setIsAudioLoading(false);
      setShowPlayer(true);

      // Announce
      AccessibilityInfo.announceForAccessibility(
        t('modules.books.audio.nowPlaying', { chapter: chapter.title })
      );
    } catch (error) {
      console.error('[BooksContext] playChapter failed:', error);
      setIsAudioLoading(false);
      DeviceEventEmitter.emit('booksAudioError', { error });
    }
  }, [currentBook, chapters, chapterProgressMap, audioOrchestrator, t]);

  /**
   * Fallback: Play chapter with system TTS (when Piper is not available)
   */
  const playChapterWithSystemTts = useCallback(async (chapterIndex: number) => {
    if (!currentBook || chapterIndex < 0 || chapterIndex >= chapters.length) {
      return;
    }

    const chapter = chapters[chapterIndex];
    console.info('[BooksContext] Playing chapter with system TTS:', chapterIndex, chapter.title);

    try {
      setCurrentChapter(chapter);
      setCurrentChapterIndex(chapterIndex);

      // Load saved progress for this chapter
      const key = `${currentBook.id}:${chapterIndex}`;
      const savedProgress = chapterProgressMap[key];
      let startPosition = 0;

      if (savedProgress && !savedProgress.completedAt) {
        startPosition = savedProgress.position;
      }

      // CRITICAL: Set audio progress BEFORE starting TTS
      // This ensures the UI shows correct time immediately
      setAudioProgress({
        position: startPosition,
        duration: chapter.content.length,
        percentage: (startPosition / chapter.content.length) * 100,
      });

      // Update start position ref for progress calculation
      playbackStartPositionRef.current = startPosition;

      // Get voice for book language
      const bookLanguage = currentBook.language || i18n.language;
      const voiceId = ttsSettings.voices[bookLanguage as keyof typeof ttsSettings.voices];

      const textToSpeak = startPosition > 0
        ? chapter.content.substring(startPosition)
        : chapter.content;

      // Use playbackRateRef for immediate access to the latest rate value
      await ttsService.speak(
        textToSpeak,
        voiceId,
        ttsSettings.playbackRate * playbackRateRef.current,
        ttsSettings.pitch
      );

      setIsAudioPlaying(true);
      setIsAudioPaused(false);
      setIsAudioLoading(false);
      setShowPlayer(true);

      AccessibilityInfo.announceForAccessibility(
        t('modules.books.audio.nowPlaying', { chapter: chapter.title })
      );
    } catch (error) {
      console.error('[BooksContext] playChapterWithSystemTts failed:', error);
      setIsAudioLoading(false);
      DeviceEventEmitter.emit('booksAudioError', { error });
    }
  }, [currentBook, chapters, chapterProgressMap, t, i18n.language, ttsSettings]);

  /**
   * Resume audio playback (Piper TTS with system TTS fallback)
   */
  const playAudio = useCallback(async () => {
    if (!currentChapter) return;

    try {
      // Request playback from orchestrator (stops other audio sources)
      await audioOrchestrator.requestPlayback('books');

      // Try Piper TTS first, then system TTS
      await piperTtsService.resume();
      await ttsService.resume();
      setIsAudioPlaying(true);
      setIsAudioPaused(false);

      AccessibilityInfo.announceForAccessibility(
        t('modules.books.audio.resumed')
      );
    } catch (error) {
      console.error('[BooksContext] playAudio failed:', error);
    }
  }, [currentChapter, audioOrchestrator, t]);

  /**
   * Pause audio playback (both Piper and system TTS)
   */
  const pauseAudio = useCallback(async () => {
    try {
      // Pause both Piper TTS and system TTS
      await piperTtsService.pause();
      await ttsService.pause();
      setIsAudioPlaying(false);
      setIsAudioPaused(true);

      // Save progress immediately on pause
      if (currentBook && currentChapter) {
        const progress: ChapterProgress = {
          bookId: currentBook.id,
          chapterIndex: currentChapterIndex,
          position: audioProgress.position,
          lastPlayedAt: Date.now(),
        };
        await booksStorageService.saveChapterProgress(progress);

        // Update local state
        const key = `${currentBook.id}:${currentChapterIndex}`;
        setChapterProgressMap(prev => ({ ...prev, [key]: progress }));
      }

      AccessibilityInfo.announceForAccessibility(
        t('modules.books.audio.paused')
      );
    } catch (error) {
      console.error('[BooksContext] pauseAudio failed:', error);
    }
  }, [currentBook, currentChapter, currentChapterIndex, audioProgress, t]);

  /**
   * Stop audio playback completely (both Piper and system TTS)
   */
  const stopAudio = useCallback(async () => {
    try {
      // Save progress before stopping
      if (currentBook && currentChapter) {
        const progress: ChapterProgress = {
          bookId: currentBook.id,
          chapterIndex: currentChapterIndex,
          position: audioProgress.position,
          lastPlayedAt: Date.now(),
        };
        await booksStorageService.saveChapterProgress(progress);
      }

      // Stop both Piper TTS and system TTS
      await piperTtsService.stop();
      await ttsService.stop();
      setIsAudioPlaying(false);
      setIsAudioPaused(false);
      setShowPlayer(false);
      setAudioProgress({ position: 0, duration: 0, percentage: 0 });
      audioOrchestrator.releasePlayback('books');

      // Clear sleep timer
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }

      AccessibilityInfo.announceForAccessibility(
        t('modules.books.audio.stopped')
      );
    } catch (error) {
      console.error('[BooksContext] stopAudio failed:', error);
    }
  }, [currentBook, currentChapter, currentChapterIndex, audioProgress, audioOrchestrator, t]);

  /**
   * Go to next chapter
   */
  const nextChapter = useCallback(async () => {
    if (currentChapterIndex < chapters.length - 1) {
      // Mark current chapter as completed
      if (currentBook && currentChapter) {
        const progress: ChapterProgress = {
          bookId: currentBook.id,
          chapterIndex: currentChapterIndex,
          position: currentChapter.content.length,
          completedAt: Date.now(),
          lastPlayedAt: Date.now(),
        };
        await booksStorageService.saveChapterProgress(progress);

        const key = `${currentBook.id}:${currentChapterIndex}`;
        setChapterProgressMap(prev => ({ ...prev, [key]: progress }));
      }

      // Play next chapter
      await playChapter(currentChapterIndex + 1);

      AccessibilityInfo.announceForAccessibility(
        t('modules.books.audio.nextChapter')
      );
    } else {
      // Book completed
      AccessibilityInfo.announceForAccessibility(
        t('modules.books.audio.bookCompleted')
      );
    }
  }, [currentBook, currentChapter, currentChapterIndex, chapters, playChapter, t]);

  /**
   * Go to previous chapter
   */
  const previousChapter = useCallback(async () => {
    if (currentChapterIndex > 0) {
      await playChapter(currentChapterIndex - 1);

      AccessibilityInfo.announceForAccessibility(
        t('modules.books.audio.previousChapter')
      );
    }
  }, [currentChapterIndex, playChapter, t]);

  /**
   * Seek to a specific position (character position)
   *
   * NOTE: With chunked TTS, seeking mid-playback is not supported because
   * audio is pre-generated in chunks. The position is saved and will be
   * used when playback is stopped and restarted.
   */
  const seekAudioTo = useCallback(async (position: number) => {
    if (!currentChapter) return;

    const clampedPosition = Math.max(0, Math.min(position, currentChapter.content.length));

    // Update progress state - this will be used when chapter is replayed
    setAudioProgress({
      position: clampedPosition,
      duration: currentChapter.content.length,
      percentage: (clampedPosition / currentChapter.content.length) * 100,
    });

    // Update start position ref for progress calculation
    playbackStartPositionRef.current = clampedPosition;

    // Save progress so it persists
    if (currentBook) {
      const progress: ChapterProgress = {
        bookId: currentBook.id,
        chapterIndex: currentChapterIndex,
        position: clampedPosition,
        lastPlayedAt: Date.now(),
      };
      await booksStorageService.saveChapterProgress(progress);

      const key = `${currentBook.id}:${currentChapterIndex}`;
      setChapterProgressMap(prev => ({ ...prev, [key]: progress }));
    }

    // Note: With chunked TTS, we don't restart mid-playback
    // The new position will be used when the chapter is replayed
  }, [currentBook, currentChapter, currentChapterIndex]);

  /**
   * Skip forward by a number of seconds
   */
  const skipAudioForward = useCallback(async (seconds: number = DEFAULT_SKIP_FORWARD) => {
    if (!currentChapter) return;

    const charsToSkip = seconds * TTS_CHARS_PER_SECOND;
    const newPosition = Math.min(
      audioProgress.position + charsToSkip,
      currentChapter.content.length
    );

    await seekAudioTo(newPosition);

    AccessibilityInfo.announceForAccessibility(
      t('modules.books.audio.skippedForward', { seconds })
    );
  }, [currentChapter, audioProgress, seekAudioTo, t]);

  /**
   * Skip backward by a number of seconds
   */
  const skipAudioBackward = useCallback(async (seconds: number = DEFAULT_SKIP_BACKWARD) => {
    if (!currentChapter) return;

    const charsToSkip = seconds * TTS_CHARS_PER_SECOND;
    const newPosition = Math.max(audioProgress.position - charsToSkip, 0);

    await seekAudioTo(newPosition);

    AccessibilityInfo.announceForAccessibility(
      t('modules.books.audio.skippedBackward', { seconds })
    );
  }, [currentChapter, audioProgress, seekAudioTo, t]);

  /**
   * Set audio playback rate
   *
   * Seamless rate change: saves current position, stops playback,
   * and automatically restarts at the saved position with the new rate.
   */
  const setAudioPlaybackRate = useCallback(async (rate: number) => {
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));

    // Update ref immediately for playChapter to use
    playbackRateRef.current = clampedRate;

    // If currently playing, restart with new rate from current position
    if (isAudioPlaying && currentBook && currentChapter) {
      // 1. Save current position BEFORE updating state
      const savedPosition = audioProgress.position;
      const chapterIdx = currentChapterIndex;

      console.debug('[BooksContext] Rate change: restarting from position', savedPosition, 'with rate', clampedRate);

      // 2. Update rate state (for UI display)
      setPlaybackRateState(clampedRate);

      // 3. Save progress to database
      const progress: ChapterProgress = {
        bookId: currentBook.id,
        chapterIndex: chapterIdx,
        position: savedPosition,
        lastPlayedAt: Date.now(),
      };
      await booksStorageService.saveChapterProgress(progress);

      // 4. Update local chapterProgressMap synchronously via direct mutation
      // This ensures playChapter reads the correct position
      const key = `${currentBook.id}:${chapterIdx}`;
      chapterProgressMap[key] = progress;
      setChapterProgressMap(prev => ({ ...prev, [key]: progress }));

      // 5. Stop current playback (don't use stopAudio which resets progress)
      await piperTtsService.stop();
      await ttsService.stop();

      // 6. Brief pause for cleanup
      await new Promise(resolve => setTimeout(resolve, 150));

      // 7. Restart from saved position with new rate
      // playChapter reads rate from playbackRateRef.current
      await playChapter(chapterIdx);

      AccessibilityInfo.announceForAccessibility(
        t('modules.books.audio.playbackRateChanged', { rate: `${clampedRate}x` })
      );
    } else {
      // Not playing, just save the rate for next playback
      setPlaybackRateState(clampedRate);
      AccessibilityInfo.announceForAccessibility(
        t('modules.books.audio.playbackRateChanged', { rate: `${clampedRate}x` })
      );
    }
  }, [isAudioPlaying, currentBook, currentChapter, currentChapterIndex, audioProgress, chapterProgressMap, playChapter, t]);

  /**
   * Get chapter progress
   */
  const getChapterProgress = useCallback((chapterIndex: number): ChapterProgress | null => {
    if (!currentBook) return null;
    const key = `${currentBook.id}:${chapterIndex}`;
    return chapterProgressMap[key] || null;
  }, [currentBook, chapterProgressMap]);

  /**
   * Check if chapter is completed
   */
  const isChapterCompletedFn = useCallback((chapterIndex: number): boolean => {
    const progress = getChapterProgress(chapterIndex);
    return progress?.completedAt !== undefined;
  }, [getChapterProgress]);

  /**
   * Helper: Format seconds to time string (mm:ss or hh:mm:ss)
   */
  const formatSecondsToTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================================
  // Audio Player TTS Event Handlers (Piper TTS + System TTS)
  // ============================================================

  // Track the start position when playback began (for progress calculation)
  const playbackStartPositionRef = useRef(0);

  // Shared handler for chapter completion (auto-advance to next chapter)
  const handleChapterComplete = useCallback(() => {
    // Mark chapter as completed
    if (currentBook && currentChapter) {
      const progress: ChapterProgress = {
        bookId: currentBook.id,
        chapterIndex: currentChapterIndex,
        position: currentChapter.content.length,
        completedAt: Date.now(),
        lastPlayedAt: Date.now(),
      };
      booksStorageService.saveChapterProgress(progress);

      const key = `${currentBook.id}:${currentChapterIndex}`;
      setChapterProgressMap(prev => ({ ...prev, [key]: progress }));
    }

    // Auto-advance to next chapter if available
    if (currentChapterIndex < chapters.length - 1) {
      playChapter(currentChapterIndex + 1);
    } else {
      // Book completed
      setIsAudioPlaying(false);
      setIsAudioPaused(false);
      AccessibilityInfo.announceForAccessibility(
        t('modules.books.audio.bookCompleted')
      );
    }
  }, [currentBook, currentChapter, currentChapterIndex, chapters, playChapter, t]);

  // Update start position when chapter starts playing
  useEffect(() => {
    if (isAudioPlaying && !isAudioPaused) {
      playbackStartPositionRef.current = audioProgress.position;
    }
  }, [isAudioPlaying, isAudioPaused]);

  // Listen to Piper TTS progress events
  useEffect(() => {
    if (bookMode === 'listen' && currentChapter && isAudioPlaying) {
      const unsubscribePiper = piperTtsService.addEventListener('piperProgress', (event) => {
        if (event.progress !== undefined) {
          // Piper reports progress as 0-100 percentage
          const chapterLength = currentChapter.content.length;
          const startOffset = playbackStartPositionRef.current;
          const remainingLength = chapterLength - startOffset;
          const newPosition = startOffset + Math.floor((event.progress / 100) * remainingLength);

          setAudioProgress({
            position: newPosition,
            duration: chapterLength,
            percentage: (newPosition / chapterLength) * 100,
          });
        }
      });

      return () => unsubscribePiper();
    }
  }, [bookMode, currentChapter, isAudioPlaying]);

  // Listen to Piper TTS completion events
  useEffect(() => {
    if (bookMode === 'listen' && currentChapter) {
      const unsubscribePiper = piperTtsService.addEventListener('piperComplete', () => {
        console.debug('[BooksContext] Chapter Piper TTS complete');
        handleChapterComplete();
      });

      return () => unsubscribePiper();
    }
  }, [bookMode, currentChapter, handleChapterComplete]);

  // Fallback: Listen to system TTS progress events
  useEffect(() => {
    if (bookMode === 'listen' && currentChapter && isAudioPlaying) {
      const unsubscribe = ttsService.onProgress((progress) => {
        // Calculate position based on TTS progress
        const startOffset = playbackStartPositionRef.current;
        const newPosition = startOffset + progress.position;

        setAudioProgress({
          position: newPosition,
          duration: currentChapter.content.length,
          percentage: (newPosition / currentChapter.content.length) * 100,
        });
      });

      return () => unsubscribe();
    }
  }, [bookMode, currentChapter, isAudioPlaying]);

  // Fallback: Listen to system TTS completion events
  useEffect(() => {
    if (bookMode === 'listen' && currentChapter) {
      const unsubscribe = ttsService.onComplete(() => {
        console.debug('[BooksContext] Chapter system TTS complete');
        handleChapterComplete();
      });

      return () => unsubscribe();
    }
  }, [bookMode, currentChapter, handleChapterComplete]);

  // Save chapter progress periodically while playing
  useEffect(() => {
    if (bookMode === 'listen' && isAudioPlaying && currentBook && currentChapter) {
      chapterProgressSaveIntervalRef.current = setInterval(async () => {
        const progress: ChapterProgress = {
          bookId: currentBook.id,
          chapterIndex: currentChapterIndex,
          position: audioProgress.position,
          lastPlayedAt: Date.now(),
        };
        await booksStorageService.saveChapterProgress(progress);

        const key = `${currentBook.id}:${currentChapterIndex}`;
        setChapterProgressMap(prev => ({ ...prev, [key]: progress }));

        console.debug('[BooksContext] Saved chapter progress:', currentChapterIndex, audioProgress.position);
      }, CHAPTER_PROGRESS_SAVE_INTERVAL);

      return () => {
        if (chapterProgressSaveIntervalRef.current) {
          clearInterval(chapterProgressSaveIntervalRef.current);
        }
      };
    }
  }, [bookMode, isAudioPlaying, currentBook, currentChapter, currentChapterIndex, audioProgress]);

  // ============================================================
  // Settings Actions
  // ============================================================

  const setTtsRate = useCallback(async (rate: number) => {
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    const newSettings = { ...ttsSettings, playbackRate: clampedRate };
    setTtsSettings(newSettings);
    await booksStorageService.saveTtsSettings(newSettings);
  }, [ttsSettings]);

  const setTtsPitch = useCallback(async (pitch: number) => {
    const clampedPitch = Math.max(0.5, Math.min(2.0, pitch));
    const newSettings = { ...ttsSettings, pitch: clampedPitch };
    setTtsSettings(newSettings);
    await booksStorageService.saveTtsSettings(newSettings);
  }, [ttsSettings]);

  const setTtsVoice = useCallback(async (language: string, voiceId: string) => {
    const newSettings = {
      ...ttsSettings,
      voices: {
        ...ttsSettings.voices,
        [language]: voiceId,
      },
    };
    setTtsSettings(newSettings);
    await booksStorageService.saveTtsSettings(newSettings);
  }, [ttsSettings]);

  const setSleepTimer = useCallback((minutes: number | null) => {
    // Clear existing timer
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    // Update settings
    const newSettings = { ...ttsSettings, sleepTimerMinutes: minutes };
    setTtsSettings(newSettings);
    booksStorageService.saveTtsSettings(newSettings);

    if (minutes !== null && minutes > 0) {
      // Set new timer
      sleepTimerRef.current = setTimeout(() => {
        stopReading();
        AccessibilityInfo.announceForAccessibility(
          t('modules.books.tts.sleepTimerEnded')
        );
      }, minutes * 60 * 1000);

      AccessibilityInfo.announceForAccessibility(
        t('modules.books.tts.sleepTimerSet', { minutes })
      );
    }
  }, [ttsSettings, stopReading, t]);

  const updateReaderSettings = useCallback(async (settings: Partial<ReaderSettings>) => {
    const newSettings = { ...readerSettings, ...settings };
    setReaderSettings(newSettings);
    await booksStorageService.saveReaderSettings(newSettings);
  }, [readerSettings]);

  const getVoicesForLanguage = useCallback(async (language: string): Promise<TtsVoice[]> => {
    return ttsService.getVoicesForLanguage(language);
  }, []);

  const getHighQualityVoicesForLanguage = useCallback(async (language: string): Promise<TtsVoice[]> => {
    return ttsService.getHighQualityVoicesForLanguage(language);
  }, []);

  /**
   * Refresh voice quality status for current book language
   */
  const refreshVoiceQualityStatus = useCallback(async () => {
    const bookLanguage = currentBook?.language || i18n.language;
    const highQualityVoices = await ttsService.getHighQualityVoicesForLanguage(bookLanguage);
    const premiumVoices = await ttsService.getPremiumVoicesForLanguage(bookLanguage);
    const hasHighQualityVoice = highQualityVoices.length > 0;
    const hasPremiumVoice = premiumVoices.length > 0;

    // Check if user has a selected voice for this language
    const savedVoiceId = ttsSettings.voices[bookLanguage as keyof typeof ttsSettings.voices];
    let selectedVoice: TtsVoice | null = null;
    let userHasSelectedVoice = false;

    if (savedVoiceId && hasHighQualityVoice) {
      // Find the saved voice in high-quality voices
      selectedVoice = highQualityVoices.find(v => v.id === savedVoiceId) || null;
      userHasSelectedVoice = selectedVoice !== null;
    }

    // If no saved voice, auto-select best available
    if (!selectedVoice && hasHighQualityVoice) {
      selectedVoice = premiumVoices[0] || highQualityVoices[0];
    }

    setVoiceQualityStatus({
      hasHighQualityVoice,
      hasPremiumVoice,
      highQualityVoices,
      premiumVoices,
      selectedVoice,
      userHasSelectedVoice,
      language: bookLanguage,
    });

    console.debug('[BooksContext] Voice quality status:', {
      language: bookLanguage,
      hasHighQualityVoice,
      hasPremiumVoice,
      highQualityCount: highQualityVoices.length,
      selectedVoice: selectedVoice?.name,
    });
  }, [currentBook, i18n.language, ttsSettings.voices]);

  /**
   * Select a high-quality voice (Enhanced or Premium) for TTS
   */
  const selectVoice = useCallback(async (voice: TtsVoice) => {
    if (voice.quality === 'default') {
      console.warn('[BooksContext] Attempted to select default quality voice:', voice.id);
      return;
    }

    const language = voice.language.split('-')[0]; // e.g., 'nl-NL' -> 'nl'

    // Update TTS settings
    const newSettings = {
      ...ttsSettings,
      voices: {
        ...ttsSettings.voices,
        [language]: voice.id,
      },
    };
    setTtsSettings(newSettings);
    await booksStorageService.saveTtsSettings(newSettings);

    // Update voice quality status - user explicitly selected this voice
    setVoiceQualityStatus(prev => prev ? {
      ...prev,
      selectedVoice: voice,
      userHasSelectedVoice: true,
    } : null);

    console.info('[BooksContext] Selected voice:', voice.name, '(', voice.quality, ') for', language);
  }, [ttsSettings]);

  // ============================================================
  // Audio Orchestrator Registration
  // ============================================================

  // Use ref to provide stable stop function for orchestrator
  const stopAudioRef = useRef(stopAudio);
  stopAudioRef.current = stopAudio;

  const stopReadingRef = useRef(stopReading);
  stopReadingRef.current = stopReading;

  useEffect(() => {
    // Register books as an audio source with the orchestrator
    audioOrchestrator.registerSource('books', {
      stop: async () => {
        // Stop both TTS reading and audio playback
        await stopReadingRef.current();
        await stopAudioRef.current();
      },
      isPlaying: () => isSpeaking || isAudioPlaying,
    });

    return () => {
      audioOrchestrator.unregisterSource('books');
    };
  }, [audioOrchestrator, isSpeaking, isAudioPlaying]);

  // ============================================================
  // Context Value
  // ============================================================

  const value = useMemo(
    (): BooksContextValue => ({
      // Library
      library,
      isLibraryLoading,

      // Download
      downloadQueue,
      isDownloading,
      downloadProgress,
      currentDownload,

      // Reading
      currentBook,
      currentPage,
      currentPageNumber,
      totalPages,
      readingProgress,

      // TTS (read mode)
      isSpeaking,
      isPaused,
      isLoading,
      ttsProgress,

      // Audio Player Mode (listen mode)
      bookMode,
      chapters,
      currentChapter,
      currentChapterIndex,
      audioProgress,
      isAudioLoading,
      isAudioPlaying,
      isAudioPaused,
      playbackRate,

      // Voice Quality Status
      voiceQualityStatus,

      // Settings
      ttsSettings,
      readerSettings,
      availableVoices,

      // Storage
      storageInfo,

      // Player
      showPlayer,
      setShowPlayer,

      // Library Actions
      refreshLibrary,
      downloadBook,
      deleteBook,
      deleteBooks,
      cancelDownload,
      isBookDownloaded,

      // Reading Actions
      openBook,
      closeBook,
      goToPage,
      nextPage,
      previousPage,

      // TTS Actions (read mode)
      startReading,
      pauseReading,
      resumeReading,
      stopReading,

      // Audio Player Actions (listen mode)
      setBookMode,
      openBookForListening,
      playChapter,
      playAudio,
      pauseAudio,
      stopAudio,
      nextChapter,
      previousChapter,
      seekAudioTo,
      skipAudioForward,
      skipAudioBackward,
      setAudioPlaybackRate,
      getChapterProgress,
      isChapterCompleted: isChapterCompletedFn,

      // Settings Actions
      setTtsRate,
      setTtsPitch,
      setTtsVoice,
      setSleepTimer,
      updateReaderSettings,
      getVoicesForLanguage,
      getHighQualityVoicesForLanguage,
      selectVoice,
      refreshVoiceQualityStatus,
    }),
    [
      library,
      isLibraryLoading,
      downloadQueue,
      isDownloading,
      downloadProgress,
      currentDownload,
      currentBook,
      currentPage,
      currentPageNumber,
      totalPages,
      readingProgress,
      isSpeaking,
      isPaused,
      isLoading,
      ttsProgress,
      bookMode,
      chapters,
      currentChapter,
      currentChapterIndex,
      audioProgress,
      isAudioLoading,
      isAudioPlaying,
      isAudioPaused,
      playbackRate,
      voiceQualityStatus,
      ttsSettings,
      readerSettings,
      availableVoices,
      storageInfo,
      showPlayer,
      refreshLibrary,
      downloadBook,
      deleteBook,
      deleteBooks,
      cancelDownload,
      isBookDownloaded,
      openBook,
      closeBook,
      goToPage,
      nextPage,
      previousPage,
      startReading,
      pauseReading,
      resumeReading,
      stopReading,
      openBookForListening,
      playChapter,
      playAudio,
      pauseAudio,
      stopAudio,
      nextChapter,
      previousChapter,
      seekAudioTo,
      skipAudioForward,
      skipAudioBackward,
      setAudioPlaybackRate,
      getChapterProgress,
      isChapterCompletedFn,
      setTtsRate,
      setTtsPitch,
      setTtsVoice,
      setSleepTimer,
      updateReaderSettings,
      getVoicesForLanguage,
      getHighQualityVoicesForLanguage,
      selectVoice,
      refreshVoiceQualityStatus,
    ]
  );

  return (
    <BooksContext.Provider value={value}>
      {children}
    </BooksContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook to access books context
 * Must be used within a BooksProvider
 */
export function useBooksContext(): BooksContextValue {
  const context = useContext(BooksContext);
  if (!context) {
    throw new Error('useBooksContext must be used within a BooksProvider');
  }
  return context;
}

/**
 * Safe hook that returns null if outside provider
 */
export function useBooksContextSafe(): BooksContextValue | null {
  return useContext(BooksContext);
}

/**
 * Hook for library state
 */
export function useBooksLibrary(): {
  library: DownloadedBook[];
  isLoading: boolean;
  refreshLibrary: () => Promise<void>;
  storageInfo: StorageInfo | null;
} {
  const {
    library,
    isLibraryLoading: isLoading,
    refreshLibrary,
    storageInfo,
  } = useBooksContext();
  return { library, isLoading, refreshLibrary, storageInfo };
}

/**
 * Hook for TTS controls
 */
export function useBooksTts(): {
  isSpeaking: boolean;
  isPaused: boolean;
  progress: TtsProgress;
  startReading: () => Promise<void>;
  pauseReading: () => Promise<void>;
  resumeReading: () => Promise<void>;
  stopReading: () => Promise<void>;
} {
  const {
    isSpeaking,
    isPaused,
    ttsProgress: progress,
    startReading,
    pauseReading,
    resumeReading,
    stopReading,
  } = useBooksContext();
  return {
    isSpeaking,
    isPaused,
    progress,
    startReading,
    pauseReading,
    resumeReading,
    stopReading,
  };
}

/**
 * Hook for audio player controls (listen mode)
 */
export function useBooksAudioPlayer(): {
  // State
  bookMode: BookMode;
  chapters: BookChapter[];
  currentChapter: BookChapter | null;
  currentChapterIndex: number;
  audioProgress: AudioProgress;
  isAudioLoading: boolean;
  isAudioPlaying: boolean;
  isAudioPaused: boolean;
  playbackRate: number;
  // Actions
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
} {
  const {
    bookMode,
    chapters,
    currentChapter,
    currentChapterIndex,
    audioProgress,
    isAudioLoading,
    isAudioPlaying,
    isAudioPaused,
    playbackRate,
    setBookMode,
    openBookForListening,
    playChapter,
    playAudio,
    pauseAudio,
    stopAudio,
    nextChapter,
    previousChapter,
    seekAudioTo,
    skipAudioForward,
    skipAudioBackward,
    setAudioPlaybackRate,
    getChapterProgress,
    isChapterCompleted,
  } = useBooksContext();
  return {
    bookMode,
    chapters,
    currentChapter,
    currentChapterIndex,
    audioProgress,
    isAudioLoading,
    isAudioPlaying,
    isAudioPaused,
    playbackRate,
    setBookMode,
    openBookForListening,
    playChapter,
    playAudio,
    pauseAudio,
    stopAudio,
    nextChapter,
    previousChapter,
    seekAudioTo,
    skipAudioForward,
    skipAudioBackward,
    setAudioPlaybackRate,
    getChapterProgress,
    isChapterCompleted,
  };
}

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

// Re-export types
export type {
  Book,
  DownloadedBook,
  ReadingProgress,
  TtsSettings,
  ReaderSettings,
  TtsVoice,
  BookChapter,
  ChapterProgress,
};
