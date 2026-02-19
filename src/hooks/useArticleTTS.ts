/**
 * useArticleTTS — Hook for TTS playback of news articles
 *
 * Provides text-to-speech functionality for reading news articles aloud.
 * Supports both RSS summary and full article text extraction.
 *
 * Features:
 * - Automatic language detection based on module
 * - Progress tracking during playback
 * - Full text extraction (when supported)
 * - Playback rate control
 * - Pause/resume support
 *
 * @see .claude/plans/COUNTRY_SPECIFIC_MODULES.md (Fase 4)
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ttsService, TtsProgress } from '@/services/ttsService';
import { newsService } from '@/services/newsService';
import type { NewsArticle } from '@/types/modules';

// Default TTS settings
const DEFAULT_SPEECH_RATE = 1.0;

// ============================================================
// Types
// ============================================================

export interface UseArticleTTSReturn {
  /** Start TTS playback for an article */
  startTTS: (article: NewsArticle, useFullText: boolean) => Promise<void>;

  /** Stop TTS playback */
  stopTTS: () => Promise<void>;

  /** Pause TTS playback */
  pauseTTS: () => Promise<void>;

  /** Resume TTS playback */
  resumeTTS: () => Promise<void>;

  /** Whether TTS is currently playing */
  isPlaying: boolean;

  /** Whether TTS is paused */
  isPaused: boolean;

  /** Whether TTS is loading (extracting full text) */
  isLoading: boolean;

  /** Current progress (0-1) */
  progress: number;

  /** Current sentence being spoken (if available) */
  currentSentence: string;

  /** Error message (if any) */
  error: string | null;

  /** The article currently being read */
  currentArticle: NewsArticle | null;
}

// ============================================================
// Language Mapping
// ============================================================

// Map module IDs to TTS language codes
const MODULE_LANGUAGE_MAP: Record<string, string> = {
  nunl: 'nl-NL',      // nu.nl - Dutch
  nos: 'nl-NL',       // NOS - Dutch
  rtl: 'nl-NL',       // RTL Nieuws - Dutch
  vrt: 'nl-BE',       // VRT - Belgian Dutch
  bbc: 'en-GB',       // BBC - British English
  tagesschau: 'de-DE', // Tagesschau - German
  franceinfo: 'fr-FR', // France Info - French
  rtve: 'es-ES',      // RTVE - Spanish
};

function getLanguageForModule(moduleId: string): string {
  return MODULE_LANGUAGE_MAP[moduleId] || 'nl-NL';
}

// ============================================================
// Hook Implementation
// ============================================================

export function useArticleTTS(): UseArticleTTSReturn {
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSentence, setCurrentSentence] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentArticle, setCurrentArticle] = useState<NewsArticle | null>(null);

  // Track if TTS service is initialized
  const isInitializedRef = useRef(false);

  // Initialize TTS service
  useEffect(() => {
    const initTTS = async () => {
      if (isInitializedRef.current) return;

      const success = await ttsService.initialize();
      isInitializedRef.current = success;

      if (!success) {
        console.warn('[useArticleTTS] TTS service initialization failed');
      }
    };

    void initTTS();
  }, []);

  // Set up TTS event listeners
  useEffect(() => {
    // Progress updates
    const unsubProgress = ttsService.onProgress((prog: TtsProgress) => {
      setProgress(prog.percentage / 100);
    });

    // Completion
    const unsubComplete = ttsService.addEventListener('ttsComplete', () => {
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(1);
      setCurrentArticle(null);
    });

    // Pause
    const unsubPause = ttsService.addEventListener('ttsPause', () => {
      setIsPaused(true);
    });

    // Resume
    const unsubResume = ttsService.addEventListener('ttsResume', () => {
      setIsPaused(false);
    });

    // Cancelled
    const unsubCancel = ttsService.addEventListener('ttsCancelled', () => {
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(0);
      setCurrentArticle(null);
    });

    // Error
    const unsubError = ttsService.onError((errorMsg: string) => {
      setError(errorMsg);
      setIsPlaying(false);
      setIsLoading(false);
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubPause();
      unsubResume();
      unsubCancel();
      unsubError();
    };
  }, []);

  /**
   * Start TTS playback
   */
  const startTTS = useCallback(
    async (article: NewsArticle, useFullText: boolean) => {
      try {
        setError(null);
        setIsLoading(true);
        setCurrentArticle(article);
        setProgress(0);

        let textToSpeak: string;

        if (useFullText) {
          // Try to extract full article text
          const fullText = await newsService.fetchFullArticleText(article);
          if (fullText) {
            textToSpeak = fullText;
          } else {
            // Fall back to summary
            textToSpeak = newsService.formatForTts(article);
            console.debug('[useArticleTTS] Full text not available, using summary');
          }
        } else {
          // Use RSS summary
          textToSpeak = newsService.formatForTts(article);
        }

        setIsLoading(false);

        // Get language for this module
        const language = getLanguageForModule(article.moduleId);

        // Get best voice for this language
        const bestVoice = await ttsService.getBestVoiceForLanguage(language);
        const selectedVoiceId = bestVoice?.id;

        // Start speaking
        const success = await ttsService.speak(
          textToSpeak,
          selectedVoiceId,
          DEFAULT_SPEECH_RATE
        );

        if (success) {
          setIsPlaying(true);
          setCurrentSentence(textToSpeak.substring(0, 100) + '...');
        } else {
          setError('TTS playback failed');
          setCurrentArticle(null);
        }
      } catch (err) {
        console.error('[useArticleTTS] Error starting TTS:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoading(false);
        setCurrentArticle(null);
      }
    },
    []
  );

  /**
   * Stop TTS playback
   */
  const stopTTS = useCallback(async () => {
    await ttsService.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentSentence('');
    setCurrentArticle(null);
  }, []);

  /**
   * Pause TTS playback
   */
  const pauseTTS = useCallback(async () => {
    await ttsService.pause();
    // State will be updated by event listener
  }, []);

  /**
   * Resume TTS playback
   */
  const resumeTTS = useCallback(async () => {
    await ttsService.resume();
    // State will be updated by event listener
  }, []);

  return {
    startTTS,
    stopTTS,
    pauseTTS,
    resumeTTS,
    isPlaying,
    isPaused,
    isLoading,
    progress,
    currentSentence,
    error,
    currentArticle,
  };
}

export default useArticleTTS;
