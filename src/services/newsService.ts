/**
 * News Service — RSS Feed Parsing & Article Management
 *
 * Fetches and parses RSS feeds from country-specific news modules.
 * Provides article caching, full-text extraction, and TTS preparation.
 *
 * Features:
 * - RSS XML parsing (nu.nl and similar feeds)
 * - Image extraction from enclosure/media:content
 * - In-memory cache with configurable TTL
 * - Full article text extraction for TTS
 *
 * @see .claude/plans/COUNTRY_SPECIFIC_MODULES.md
 */

import type { NewsArticle, CountryModuleDefinition, ModuleCategory } from '@/types/modules';
import { getModuleById } from '@/config/moduleRegistry';

// ============================================================
// Constants
// ============================================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 15000; // 15 seconds
const MAX_ARTICLES_PER_CATEGORY = 50;

// ============================================================
// Types
// ============================================================

interface CacheEntry {
  articles: NewsArticle[];
  fetchedAt: number;
}

interface FetchResult {
  articles: NewsArticle[];
  error?: string;
  fromCache: boolean;
}

// ============================================================
// News Service Implementation
// ============================================================

class NewsServiceImpl {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Fetch articles for a module category
   */
  async fetchArticles(
    moduleId: string,
    categoryId: string
  ): Promise<FetchResult> {
    const cacheKey = `${moduleId}:${categoryId}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      console.debug('[newsService] Cache hit for', cacheKey);
      return { articles: cached.articles, fromCache: true };
    }

    // Get module definition
    const moduleDef = getModuleById(moduleId);
    if (!moduleDef) {
      console.error('[newsService] Unknown module:', moduleId);
      return { articles: [], error: 'Unknown module', fromCache: false };
    }

    // Find category
    const category = moduleDef.categories.find((c) => c.id === categoryId);
    if (!category) {
      console.error('[newsService] Unknown category:', categoryId);
      return { articles: [], error: 'Unknown category', fromCache: false };
    }

    // Build RSS URL
    const rssUrl = `${moduleDef.rssBaseUrl}${category.rssPath}`;
    console.info('[newsService] Fetching RSS:', rssUrl);

    try {
      const articles = await this.fetchAndParseRss(
        rssUrl,
        moduleId,
        categoryId
      );

      // Update cache
      this.cache.set(cacheKey, {
        articles,
        fetchedAt: Date.now(),
      });

      console.info(
        '[newsService] Fetched',
        articles.length,
        'articles for',
        cacheKey
      );
      return { articles, fromCache: false };
    } catch (error) {
      console.error('[newsService] Fetch failed:', error);

      // Return cached data if available (even if stale)
      if (cached) {
        console.warn('[newsService] Returning stale cache');
        return { articles: cached.articles, error: 'Network error', fromCache: true };
      }

      return { articles: [], error: this.getErrorMessage(error), fromCache: false };
    }
  }

  /**
   * Fetch and parse RSS feed
   */
  private async fetchAndParseRss(
    url: string,
    moduleId: string,
    categoryId: string
  ): Promise<NewsArticle[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/rss+xml, application/xml, text/xml',
          'User-Agent': 'CommEazy/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const xml = await response.text();
      return this.parseRssXml(xml, moduleId, categoryId);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse RSS XML to NewsArticle array
   */
  private parseRssXml(
    xml: string,
    moduleId: string,
    categoryId: string
  ): NewsArticle[] {
    const articles: NewsArticle[] = [];

    // Extract all <item> elements
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && articles.length < MAX_ARTICLES_PER_CATEGORY) {
      const itemXml = match[1];
      const article = this.parseItem(itemXml, moduleId, categoryId);
      if (article) {
        articles.push(article);
      }
    }

    return articles;
  }

  /**
   * Parse a single RSS item
   */
  private parseItem(
    itemXml: string,
    moduleId: string,
    categoryId: string
  ): NewsArticle | null {
    const title = this.extractTag(itemXml, 'title');
    const link = this.extractTag(itemXml, 'link');
    const description = this.extractTag(itemXml, 'description');
    const guid = this.extractTag(itemXml, 'guid') || link;
    const pubDateStr = this.extractTag(itemXml, 'pubDate');

    if (!title || !link) {
      return null;
    }

    // Parse publication date
    let pubDate = new Date();
    if (pubDateStr) {
      try {
        pubDate = new Date(pubDateStr);
        if (isNaN(pubDate.getTime())) {
          pubDate = new Date();
        }
      } catch {
        pubDate = new Date();
      }
    }

    // Extract image URL from various sources
    const imageUrl = this.extractImageUrl(itemXml);

    // Clean description (remove HTML tags, decode entities)
    const cleanDescription = this.cleanHtml(description || '');

    return {
      id: guid || `${moduleId}:${link}`,
      title: this.cleanHtml(title),
      description: cleanDescription,
      link,
      pubDate,
      imageUrl,
      category: categoryId,
      moduleId,
    };
  }

  /**
   * Extract tag content from XML
   */
  private extractTag(xml: string, tagName: string): string | null {
    // Handle CDATA sections
    const cdataRegex = new RegExp(
      `<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`,
      'i'
    );
    const cdataMatch = cdataRegex.exec(xml);
    if (cdataMatch) {
      return cdataMatch[1].trim();
    }

    // Handle regular content
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = regex.exec(xml);
    return match ? match[1].trim() : null;
  }

  /**
   * Extract image URL from RSS item
   */
  private extractImageUrl(itemXml: string): string | undefined {
    // Try enclosure first (most common for nu.nl)
    const enclosureMatch = /enclosure[^>]+url=["']([^"']+)["']/i.exec(itemXml);
    if (enclosureMatch) {
      return enclosureMatch[1];
    }

    // Try media:content
    const mediaMatch = /media:content[^>]+url=["']([^"']+)["']/i.exec(itemXml);
    if (mediaMatch) {
      return mediaMatch[1];
    }

    // Try image tag
    const imageMatch = /<image[^>]*>[\s\S]*?<url>([^<]+)<\/url>/i.exec(itemXml);
    if (imageMatch) {
      return imageMatch[1].trim();
    }

    // Try extracting from description (inline images)
    const imgMatch = /<img[^>]+src=["']([^"']+)["']/i.exec(itemXml);
    if (imgMatch) {
      return imgMatch[1];
    }

    return undefined;
  }

  /**
   * Clean HTML tags and decode entities
   */
  private cleanHtml(html: string): string {
    // Remove HTML tags
    let text = html.replace(/<[^>]+>/g, '');

    // Decode common HTML entities
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return 'timeout';
      }
      if (error.message.includes('network')) {
        return 'network';
      }
      return 'server';
    }
    return 'unknown';
  }

  /**
   * Clear cache for a specific module or all modules
   */
  clearCache(moduleId?: string): void {
    if (moduleId) {
      // Clear specific module's cache
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${moduleId}:`)) {
          this.cache.delete(key);
        }
      }
      console.debug('[newsService] Cleared cache for', moduleId);
    } else {
      // Clear all cache
      this.cache.clear();
      console.debug('[newsService] Cleared all cache');
    }
  }

  /**
   * Get all available categories for a module
   */
  getCategories(moduleId: string): ModuleCategory[] {
    const moduleDef = getModuleById(moduleId);
    return moduleDef?.categories ?? [];
  }

  /**
   * Get module definition
   */
  getModule(moduleId: string): CountryModuleDefinition | undefined {
    return getModuleById(moduleId);
  }

  /**
   * Fetch full article text for TTS
   *
   * Extracts the main article content from the webpage HTML.
   * Uses site-specific selectors for known news sources (nu.nl).
   *
   * @param article - The article to extract text from
   * @returns Full article text formatted for TTS, or null if extraction fails
   */
  async fetchFullArticleText(article: NewsArticle): Promise<string | null> {
    const moduleDef = getModuleById(article.moduleId);
    if (!moduleDef?.supportsFullTextExtraction) {
      console.debug('[newsService] Full text extraction not supported for', article.moduleId);
      return null;
    }

    try {
      console.info('[newsService] Fetching full article text:', article.link);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(article.link, {
        signal: controller.signal,
        headers: {
          Accept: 'text/html',
          'User-Agent': 'CommEazy/1.0 (Article Reader)',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('[newsService] Failed to fetch article:', response.status);
        return null;
      }

      const html = await response.text();
      const extractedText = this.extractArticleContent(html, article.moduleId);

      if (extractedText && extractedText.length > article.description.length) {
        console.info('[newsService] Extracted', extractedText.length, 'chars of full text');
        return `${article.title}. ${extractedText}`;
      }

      // Fallback to description if extraction failed or returned less content
      console.debug('[newsService] Using RSS description as fallback');
      return `${article.title}. ${article.description}`;

    } catch (error) {
      console.warn('[newsService] Full text extraction failed:', error);
      // Fallback to description
      return `${article.title}. ${article.description}`;
    }
  }

  /**
   * Extract article content from HTML using site-specific selectors
   *
   * nu.nl article structure:
   * - Main content: <div class="block block--paragraph"> or <p> within article
   * - Also: <div class="article-body">
   */
  private extractArticleContent(html: string, moduleId: string): string | null {
    // Site-specific extraction rules
    const extractionRules: Record<string, RegExp[]> = {
      nunl: [
        // nu.nl uses various paragraph blocks
        /<div[^>]*class="[^"]*block--paragraph[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<div[^>]*class="[^"]*article-body[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        // Fallback: all <p> tags within article content
        /<article[^>]*>([\s\S]*?)<\/article>/i,
      ],
    };

    const rules = extractionRules[moduleId];
    if (!rules) {
      // Generic extraction: try to find <article> content or main paragraphs
      return this.extractGenericContent(html);
    }

    const paragraphs: string[] = [];

    // Try each extraction rule
    for (const rule of rules) {
      rule.lastIndex = 0; // Reset regex state
      let match;

      while ((match = rule.exec(html)) !== null) {
        const content = match[1] || match[0];
        const cleanContent = this.cleanHtmlForTts(content);
        if (cleanContent && cleanContent.length > 20) {
          paragraphs.push(cleanContent);
        }
      }

      // If we found content with this rule, use it
      if (paragraphs.length > 0) {
        break;
      }
    }

    // If site-specific rules didn't work, try generic extraction
    if (paragraphs.length === 0) {
      return this.extractGenericContent(html);
    }

    // Join paragraphs with proper sentence separation
    return paragraphs.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Generic content extraction for unknown sites
   * Extracts all meaningful <p> tags from the page
   */
  private extractGenericContent(html: string): string | null {
    const paragraphs: string[] = [];

    // Extract all <p> tags
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;

    while ((match = pRegex.exec(html)) !== null) {
      const cleanContent = this.cleanHtmlForTts(match[1]);
      // Only include paragraphs that look like article content
      // (longer than 50 chars, not just links or metadata)
      if (cleanContent && cleanContent.length > 50 && !this.isMetadataText(cleanContent)) {
        paragraphs.push(cleanContent);
      }
    }

    if (paragraphs.length === 0) {
      return null;
    }

    return paragraphs.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Check if text looks like metadata rather than article content
   */
  private isMetadataText(text: string): boolean {
    const metadataPatterns = [
      /^(door|by|geschreven|written|auteur|author)/i,
      /^\d{1,2}[:\-\/]\d{1,2}/,  // Looks like a date/time
      /^(lees ook|read also|bekijk ook|see also)/i,
      /cookie|privacy|advertentie|advertisement/i,
      /^copyright|alle rechten|all rights/i,
    ];

    return metadataPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Clean HTML content specifically for TTS output
   * More aggressive cleaning than general cleanHtml
   */
  private cleanHtmlForTts(html: string): string {
    let text = html;

    // Remove script and style tags completely
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Remove common non-content elements
    text = text.replace(/<(nav|header|footer|aside|figure|figcaption)[^>]*>[\s\S]*?<\/\1>/gi, '');

    // Remove links but keep the text
    text = text.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1');

    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = this.cleanHtml(text);

    // Clean up excessive whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Format article for TTS reading
   */
  formatForTts(article: NewsArticle): string {
    const dateStr = article.pubDate.toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    return `${article.title}. Gepubliceerd op ${dateStr}. ${article.description}`;
  }

  /**
   * Get debug info
   */
  getDebugInfo(): {
    cacheSize: number;
    cacheKeys: string[];
  } {
    return {
      cacheSize: this.cache.size,
      cacheKeys: Array.from(this.cache.keys()),
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const newsService = new NewsServiceImpl();
