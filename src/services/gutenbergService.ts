/**
 * Gutenberg Service — API client for Project Gutenberg books
 *
 * Uses Gutendex API (gutendex.com) for book search and metadata.
 * Gutendex is an unofficial JSON API for Project Gutenberg.
 *
 * Features:
 * - Search books by title, author, or subject
 * - Filter by language (NL, EN, DE, FR, ES)
 * - Get popular books (sorted by download count)
 * - Two-tier caching (memory + AsyncStorage)
 *
 * Note: Gutendex has no official rate limits, but we implement
 * reasonable delays to be a good API citizen.
 *
 * @see .claude/skills/react-native-expert/SKILL.md
 * @see .claude/skills/performance-optimizer/SKILL.md
 */

import { booksCacheService } from './booksCacheService';

// ============================================================
// Types
// ============================================================

/**
 * Book model for the Books module
 */
export interface Book {
  id: string;                    // Gutenberg ID
  title: string;
  author: string;
  language: string;              // 'en', 'nl', 'de', 'fr', 'es'
  coverUrl?: string;
  downloadUrl: string;           // EPUB or plain text URL
  fileSize?: number;             // bytes (estimated)
  subjects?: string[];           // genres/categories
}

/**
 * Downloaded book with local file info
 */
export interface DownloadedBook extends Book {
  localPath: string;             // Filesystem path to EPUB/TXT
  downloadedAt: number;          // Timestamp
  lastOpenedAt?: number;
}

/**
 * API result wrapper for consistent error handling
 */
export type ApiResult<T> = {
  data: T | null;
  error: 'network' | 'timeout' | 'server' | 'parse' | null;
};

// Gutendex API response types
interface GutendexAuthor {
  name: string;
  birth_year?: number;
  death_year?: number;
}

interface GutendexBook {
  id: number;
  title: string;
  authors: GutendexAuthor[];
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  copyright: boolean;
  media_type: string;
  formats: {
    'text/plain; charset=utf-8'?: string;
    'text/plain'?: string;
    'application/epub+zip'?: string;
    'image/jpeg'?: string;
    'text/html'?: string;
    'text/html; charset=utf-8'?: string;
  };
  download_count: number;
}

interface GutendexResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutendexBook[];
}

// ============================================================
// Constants
// ============================================================

const GUTENDEX_API = 'https://gutendex.com';
const API_TIMEOUT_MS = 15000;
const MIN_REQUEST_DELAY_MS = 200; // Be kind to the API

// Language codes mapping (Gutenberg uses ISO 639-1)
const SUPPORTED_LANGUAGES = ['en', 'nl', 'de', 'fr', 'es'];

// ============================================================
// Utilities
// ============================================================

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Transform Gutendex book to our Book model
 */
function transformGutendexBook(book: GutendexBook): Book | null {
  // Get download URL - ONLY plain text is supported (EPUB requires ZIP parsing which we don't have)
  // Plain text is easier to read with TTS and doesn't need additional libraries
  const downloadUrl =
    book.formats['text/plain; charset=utf-8'] ||
    book.formats['text/plain'];

  // Skip books without plain text format - we can't read EPUB files
  if (!downloadUrl) {
    return null;
  }

  // Get cover image
  const coverUrl = book.formats['image/jpeg'];

  // Get author name(s)
  const author = book.authors
    .map(a => a.name)
    .join(', ') || 'Unknown Author';

  return {
    id: String(book.id),
    title: book.title,
    author,
    language: book.languages[0] || 'en',
    coverUrl,
    downloadUrl,
    subjects: book.subjects,
  };
}

// ============================================================
// API Functions
// ============================================================

/**
 * Search for books by query
 *
 * @param query - Search term (title, author, or subject)
 * @param language - Language code (e.g., 'en', 'nl')
 * @param limit - Maximum number of results
 */
export async function searchBooks(
  query: string,
  language: string = 'en',
  limit: number = 30
): Promise<ApiResult<Book[]>> {
  // Normalize language code
  const lang = language.toLowerCase().substring(0, 2);

  // Check cache first
  const cached = booksCacheService.getSearchResults(query, lang);
  if (cached) {
    console.debug('[gutenbergService] Returning cached search results for:', query);
    return { data: cached, error: null };
  }

  try {
    // Build URL with search parameters
    const params = new URLSearchParams();
    if (query.trim()) {
      params.append('search', query.trim());
    }
    if (SUPPORTED_LANGUAGES.includes(lang)) {
      params.append('languages', lang);
    }

    const url = `${GUTENDEX_API}/books?${params.toString()}`;

    console.debug('[gutenbergService] Searching books:', url);

    const response = await fetchWithTimeout(url, API_TIMEOUT_MS);

    if (!response.ok) {
      console.error('[gutenbergService] Search API error:', response.status);
      return { data: null, error: 'server' };
    }

    const data: GutendexResponse = await response.json();

    // Transform and filter results
    const books: Book[] = data.results
      .filter(book => !book.copyright) // Only public domain
      .map(transformGutendexBook)
      .filter((book): book is Book => book !== null)
      .slice(0, limit);

    // Cache the results
    await booksCacheService.setSearchResults(query, lang, books);

    console.debug('[gutenbergService] Found', books.length, 'books (cached)');
    return { data: books, error: null };
  } catch (error) {
    console.error('[gutenbergService] Search failed:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'timeout' };
    }
    return { data: null, error: 'network' };
  }
}

/**
 * Get popular books for a language
 * Gutendex returns results sorted by download_count by default
 *
 * @param language - Language code
 * @param limit - Maximum number of results
 */
export async function getPopularBooks(
  language: string = 'en',
  limit: number = 50
): Promise<ApiResult<Book[]>> {
  const lang = language.toLowerCase().substring(0, 2);

  // Check cache first
  const cached = booksCacheService.getPopular(lang);
  if (cached) {
    console.debug('[gutenbergService] Returning cached popular books');
    return { data: cached, error: null };
  }

  try {
    const params = new URLSearchParams();
    if (SUPPORTED_LANGUAGES.includes(lang)) {
      params.append('languages', lang);
    }
    // Results are sorted by download_count by default (most popular first)

    const url = `${GUTENDEX_API}/books?${params.toString()}`;

    console.debug('[gutenbergService] Fetching popular books:', url);

    const response = await fetchWithTimeout(url, API_TIMEOUT_MS);

    if (!response.ok) {
      console.error('[gutenbergService] Popular API error:', response.status);
      return { data: null, error: 'server' };
    }

    const data: GutendexResponse = await response.json();

    const books: Book[] = data.results
      .filter(book => !book.copyright)
      .map(transformGutendexBook)
      .filter((book): book is Book => book !== null)
      .slice(0, limit);

    // Cache the results
    await booksCacheService.setPopular(lang, books);

    console.debug('[gutenbergService] Found', books.length, 'popular books (cached)');
    return { data: books, error: null };
  } catch (error) {
    console.error('[gutenbergService] Popular fetch failed:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'timeout' };
    }
    return { data: null, error: 'network' };
  }
}

/**
 * Get a single book by ID
 *
 * @param bookId - Gutenberg book ID
 */
export async function getBookById(bookId: string): Promise<ApiResult<Book>> {
  // Check cache first
  const cached = booksCacheService.getBook(bookId);
  if (cached) {
    console.debug('[gutenbergService] Returning cached book:', bookId);
    return { data: cached, error: null };
  }

  try {
    const url = `${GUTENDEX_API}/books/${bookId}`;

    console.debug('[gutenbergService] Fetching book:', bookId);

    const response = await fetchWithTimeout(url, API_TIMEOUT_MS);

    if (!response.ok) {
      if (response.status === 404) {
        return { data: null, error: 'parse' };
      }
      console.error('[gutenbergService] Book API error:', response.status);
      return { data: null, error: 'server' };
    }

    const data: GutendexBook = await response.json();

    const book = transformGutendexBook(data);
    if (!book) {
      return { data: null, error: 'parse' };
    }

    // Cache the result
    await booksCacheService.setBook(bookId, book);

    return { data: book, error: null };
  } catch (error) {
    console.error('[gutenbergService] Book fetch failed:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'timeout' };
    }
    return { data: null, error: 'network' };
  }
}

/**
 * Get books by subject/genre
 *
 * @param subject - Subject/genre to filter by
 * @param language - Language code
 * @param limit - Maximum number of results
 */
export async function getBooksBySubject(
  subject: string,
  language: string = 'en',
  limit: number = 30
): Promise<ApiResult<Book[]>> {
  const lang = language.toLowerCase().substring(0, 2);

  // Check cache first
  const cacheKey = `subject:${subject}:${lang}`;
  const cached = booksCacheService.getSearchResults(cacheKey, lang);
  if (cached) {
    console.debug('[gutenbergService] Returning cached subject results for:', subject);
    return { data: cached, error: null };
  }

  try {
    const params = new URLSearchParams();
    params.append('topic', subject);
    if (SUPPORTED_LANGUAGES.includes(lang)) {
      params.append('languages', lang);
    }

    const url = `${GUTENDEX_API}/books?${params.toString()}`;

    console.debug('[gutenbergService] Fetching books by subject:', subject);

    const response = await fetchWithTimeout(url, API_TIMEOUT_MS);

    if (!response.ok) {
      console.error('[gutenbergService] Subject API error:', response.status);
      return { data: null, error: 'server' };
    }

    const data: GutendexResponse = await response.json();

    const books: Book[] = data.results
      .filter(book => !book.copyright)
      .map(transformGutendexBook)
      .filter((book): book is Book => book !== null)
      .slice(0, limit);

    // Cache the results
    await booksCacheService.setSearchResults(cacheKey, lang, books);

    console.debug('[gutenbergService] Found', books.length, 'books for subject:', subject);
    return { data: books, error: null };
  } catch (error) {
    console.error('[gutenbergService] Subject fetch failed:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'timeout' };
    }
    return { data: null, error: 'network' };
  }
}

// ============================================================
// Cache Service Initialization
// ============================================================

/**
 * Initialize the books cache service
 * Call this at app startup
 */
export async function initializeBooksCache(): Promise<void> {
  return booksCacheService.initialize();
}

/**
 * Clear all books caches
 */
export async function clearBooksCache(): Promise<void> {
  return booksCacheService.clearAll();
}
