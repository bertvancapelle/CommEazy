/**
 * useNewsArticles — Hook for fetching news articles from RSS feeds
 *
 * Provides a simple interface for fetching and displaying news articles
 * from country-specific modules like nu.nl.
 *
 * Features:
 * - Loading and error states
 * - Automatic cache management
 * - Category switching
 * - Pull-to-refresh support
 *
 * @see .claude/plans/COUNTRY_SPECIFIC_MODULES.md
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { newsService } from '@/services/newsService';
import type { NewsArticle, ModuleCategory, CountryModuleDefinition } from '@/types/modules';

// ============================================================
// Types
// ============================================================

interface UseNewsArticlesReturn {
  /** Current articles for selected category */
  articles: NewsArticle[];

  /** Loading state */
  isLoading: boolean;

  /** Error message (if any) */
  error: string | null;

  /** Whether data came from cache */
  fromCache: boolean;

  /** Available categories for this module */
  categories: ModuleCategory[];

  /** Currently selected category ID */
  selectedCategory: string;

  /** Change the selected category */
  setSelectedCategory: (categoryId: string) => void;

  /** Refresh articles (force fetch, bypass cache) */
  refresh: () => Promise<void>;

  /** Module definition */
  module: CountryModuleDefinition | undefined;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useNewsArticles(moduleId: string): UseNewsArticlesReturn {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Get module and categories
  const module = useMemo(() => newsService.getModule(moduleId), [moduleId]);
  const categories = useMemo(() => newsService.getCategories(moduleId), [moduleId]);

  // Set default category on mount or when categories change
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  // Fetch articles when category changes
  const fetchArticles = useCallback(async (categoryId: string, forceRefresh = false) => {
    if (!categoryId) return;

    setIsLoading(true);
    setError(null);

    // Clear cache if force refresh
    if (forceRefresh) {
      newsService.clearCache(moduleId);
    }

    const result = await newsService.fetchArticles(moduleId, categoryId);

    setArticles(result.articles);
    setFromCache(result.fromCache);
    setError(result.error ?? null);
    setIsLoading(false);
  }, [moduleId]);

  // Fetch when category changes
  useEffect(() => {
    if (selectedCategory) {
      void fetchArticles(selectedCategory);
    }
  }, [selectedCategory, fetchArticles]);

  // Refresh function for pull-to-refresh
  const refresh = useCallback(async () => {
    await fetchArticles(selectedCategory, true);
  }, [fetchArticles, selectedCategory]);

  // Category change handler
  const handleCategoryChange = useCallback((categoryId: string) => {
    if (categoryId !== selectedCategory) {
      setSelectedCategory(categoryId);
    }
  }, [selectedCategory]);

  return {
    articles,
    isLoading,
    error,
    fromCache,
    categories,
    selectedCategory,
    setSelectedCategory: handleCategoryChange,
    refresh,
    module,
  };
}

// ============================================================
// TTS Hook
// ============================================================

interface UseArticleTtsReturn {
  /** Get TTS-formatted text for an article */
  getTtsText: (article: NewsArticle) => string;

  /** Fetch full article text for TTS (async) */
  fetchFullText: (article: NewsArticle) => Promise<string | null>;
}

export function useArticleTts(): UseArticleTtsReturn {
  const getTtsText = useCallback((article: NewsArticle) => {
    return newsService.formatForTts(article);
  }, []);

  const fetchFullText = useCallback(async (article: NewsArticle) => {
    return newsService.fetchFullArticleText(article);
  }, []);

  return {
    getTtsText,
    fetchFullText,
  };
}
