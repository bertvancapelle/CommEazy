/**
 * Books Cache Service — Caching layer for Gutenberg API responses
 *
 * Implements a two-tier cache strategy:
 * 1. In-memory cache for fast access
 * 2. AsyncStorage persistence for offline/restart scenarios
 *
 * Unlike podcast caching, we don't need strict rate limiting since
 * Gutendex has no official rate limits. However, we still implement
 * reasonable caching to improve UX and reduce network requests.
 *
 * @see .claude/skills/react-native-expert/SKILL.md
 * @see .claude/skills/performance-optimizer/SKILL.md
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Book } from './gutenbergService';

// ============================================================
// Types
// ============================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// ============================================================
// Constants
// ============================================================

// Cache configuration
const CACHE_PREFIX = '@books_cache:';
const SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const POPULAR_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours
const BOOK_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days (book metadata rarely changes)

// Storage keys
const STORAGE_KEYS = {
  searchCache: `${CACHE_PREFIX}search`,
  popularCache: `${CACHE_PREFIX}popular`,
  bookCache: `${CACHE_PREFIX}book`,
  cacheVersion: `${CACHE_PREFIX}version`,
};

// Cache version - increment this when changing format priorities or API response handling
// v1: Initial version (EPUB preferred)
// v2: Plain text preferred over EPUB for TTS compatibility
// v3: EPUB completely removed - only plain text books are now returned
const CURRENT_CACHE_VERSION = 3;

// ============================================================
// In-Memory Cache
// ============================================================

class MemoryCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: T, ttl: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Get all entries (for persistence)
  getAll(): Array<[string, CacheEntry<T>]> {
    return Array.from(this.cache.entries());
  }

  // Clean up expired entries
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// ============================================================
// Books Cache Service
// ============================================================

class BooksCacheService {
  private searchCache = new MemoryCache<Book[]>();
  private popularCache = new MemoryCache<Book[]>();
  private bookCache = new MemoryCache<Book>();
  private initialized = false;

  /**
   * Initialize the cache service
   * Call this at app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.info('[BooksCacheService] Initializing...');

    // Check cache version and clear if outdated
    const storedVersion = await AsyncStorage.getItem(STORAGE_KEYS.cacheVersion);
    const version = storedVersion ? parseInt(storedVersion, 10) : 0;

    if (version < CURRENT_CACHE_VERSION) {
      console.info('[BooksCacheService] Cache version outdated, clearing cache...');
      await this.clearAll();
      await AsyncStorage.setItem(STORAGE_KEYS.cacheVersion, String(CURRENT_CACHE_VERSION));
      console.info('[BooksCacheService] Cache cleared and version updated to', CURRENT_CACHE_VERSION);
    } else {
      // Load cached data from AsyncStorage
      await this.loadFromStorage();
    }

    this.initialized = true;
    console.info('[BooksCacheService] Initialized');
  }

  // ============================================================
  // Search Cache
  // ============================================================

  /**
   * Generate cache key for search query
   */
  private getSearchCacheKey(query: string, language: string): string {
    return `${query.toLowerCase().trim()}:${language}`;
  }

  /**
   * Get cached search results
   */
  getSearchResults(query: string, language: string): Book[] | null {
    const key = this.getSearchCacheKey(query, language);
    return this.searchCache.get(key);
  }

  /**
   * Cache search results
   */
  async setSearchResults(
    query: string,
    language: string,
    results: Book[]
  ): Promise<void> {
    const key = this.getSearchCacheKey(query, language);
    this.searchCache.set(key, results, SEARCH_CACHE_TTL);

    // Persist to AsyncStorage
    await this.persistSearchCache();
  }

  // ============================================================
  // Popular Cache
  // ============================================================

  /**
   * Get cached popular books
   */
  getPopular(language: string): Book[] | null {
    return this.popularCache.get(language);
  }

  /**
   * Cache popular books
   */
  async setPopular(language: string, books: Book[]): Promise<void> {
    this.popularCache.set(language, books, POPULAR_CACHE_TTL);
    await this.persistPopularCache();
  }

  // ============================================================
  // Book Cache (individual books)
  // ============================================================

  /**
   * Get cached book by ID
   */
  getBook(bookId: string): Book | null {
    return this.bookCache.get(bookId);
  }

  /**
   * Cache individual book
   */
  async setBook(bookId: string, book: Book): Promise<void> {
    this.bookCache.set(bookId, book, BOOK_CACHE_TTL);
    await this.persistBookCache();
  }

  // ============================================================
  // Persistence
  // ============================================================

  /**
   * Load all caches from AsyncStorage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const [searchData, popularData, bookData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.searchCache),
        AsyncStorage.getItem(STORAGE_KEYS.popularCache),
        AsyncStorage.getItem(STORAGE_KEYS.bookCache),
      ]);

      const now = Date.now();

      if (searchData) {
        const entries = JSON.parse(searchData) as Array<[string, CacheEntry<Book[]>]>;
        let validCount = 0;
        entries.forEach(([key, entry]) => {
          if (now < entry.expiresAt) {
            this.searchCache.set(key, entry.data, entry.expiresAt - now);
            validCount++;
          }
        });
        console.debug('[BooksCacheService] Loaded', validCount, 'search cache entries');
      }

      if (popularData) {
        const entries = JSON.parse(popularData) as Array<[string, CacheEntry<Book[]>]>;
        let validCount = 0;
        entries.forEach(([key, entry]) => {
          if (now < entry.expiresAt) {
            this.popularCache.set(key, entry.data, entry.expiresAt - now);
            validCount++;
          }
        });
        console.debug('[BooksCacheService] Loaded', validCount, 'popular cache entries');
      }

      if (bookData) {
        const entries = JSON.parse(bookData) as Array<[string, CacheEntry<Book>]>;
        let validCount = 0;
        entries.forEach(([key, entry]) => {
          if (now < entry.expiresAt) {
            this.bookCache.set(key, entry.data, entry.expiresAt - now);
            validCount++;
          }
        });
        console.debug('[BooksCacheService] Loaded', validCount, 'book cache entries');
      }
    } catch (error) {
      console.warn('[BooksCacheService] Failed to load from storage:', error);
    }
  }

  /**
   * Persist search cache to AsyncStorage
   */
  private async persistSearchCache(): Promise<void> {
    try {
      const entries = this.searchCache.getAll();
      await AsyncStorage.setItem(STORAGE_KEYS.searchCache, JSON.stringify(entries));
    } catch (error) {
      console.warn('[BooksCacheService] Failed to persist search cache:', error);
    }
  }

  /**
   * Persist popular cache to AsyncStorage
   */
  private async persistPopularCache(): Promise<void> {
    try {
      const entries = this.popularCache.getAll();
      await AsyncStorage.setItem(STORAGE_KEYS.popularCache, JSON.stringify(entries));
    } catch (error) {
      console.warn('[BooksCacheService] Failed to persist popular cache:', error);
    }
  }

  /**
   * Persist book cache to AsyncStorage
   */
  private async persistBookCache(): Promise<void> {
    try {
      const entries = this.bookCache.getAll();
      await AsyncStorage.setItem(STORAGE_KEYS.bookCache, JSON.stringify(entries));
    } catch (error) {
      console.warn('[BooksCacheService] Failed to persist book cache:', error);
    }
  }

  // ============================================================
  // Cache Management
  // ============================================================

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    this.searchCache.clear();
    this.popularCache.clear();
    this.bookCache.clear();

    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.searchCache),
      AsyncStorage.removeItem(STORAGE_KEYS.popularCache),
      AsyncStorage.removeItem(STORAGE_KEYS.bookCache),
    ]);

    console.info('[BooksCacheService] All caches cleared');
  }

  /**
   * Prune expired entries from memory caches
   */
  prune(): void {
    this.searchCache.prune();
    this.popularCache.prune();
    this.bookCache.prune();
  }

  /**
   * Get cache statistics (for debugging)
   */
  getStats(): {
    searchEntries: number;
    popularEntries: number;
    bookEntries: number;
  } {
    return {
      searchEntries: this.searchCache.getAll().length,
      popularEntries: this.popularCache.getAll().length,
      bookEntries: this.bookCache.getAll().length,
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const booksCacheService = new BooksCacheService();

// Export types for use in other modules
export type { CacheEntry };
