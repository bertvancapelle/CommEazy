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
 * IMPORTANT: Dutch articles use the HIGH-QUALITY Piper TTS (nl_NL-rdh-high)
 * for the best listening experience. Other languages fall back to system TTS.
 *
 * @see .claude/plans/COUNTRY_SPECIFIC_MODULES.md (Fase 4)
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ttsService, TtsProgress } from '@/services/ttsService';
import { piperTtsService, type PiperTtsEvent } from '@/services/piperTtsService';
import { newsService } from '@/services/newsService';
import type { NewsArticle } from '@/types/modules';

// Default TTS settings
const DEFAULT_SPEECH_RATE = 1.0;

// Languages that use Piper TTS (high-quality offline voices)
const PIPER_SUPPORTED_LANGUAGES = ['nl-NL', 'nl-BE'];

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
// NOTE: All Dutch modules use nl-NL with the high-quality nl_NL-rdh-high voice
const MODULE_LANGUAGE_MAP: Record<string, string> = {
  nunl: 'nl-NL',      // nu.nl - Uses nl_NL-rdh-high (high quality male voice)
  nos: 'nl-NL',       // NOS - Uses nl_NL-rdh-high (high quality male voice)
  rtl: 'nl-NL',       // RTL Nieuws - Uses nl_NL-rdh-high (high quality male voice)
  vrt: 'nl-NL',       // VRT - Uses nl_NL-rdh-high (high quality male voice)
  bbc: 'en-GB',       // BBC - British English
  tagesschau: 'de-DE', // Tagesschau - German
  franceinfo: 'fr-FR', // France Info - French
  rtve: 'es-ES',      // RTVE - Spanish
};

function getLanguageForModule(moduleId: string): string {
  return MODULE_LANGUAGE_MAP[moduleId] || 'nl-NL';  // Default to Dutch (high quality RDH voice)
}

/**
 * Check if Piper TTS should be used for this language
 * Piper provides high-quality offline voices for Dutch
 */
function shouldUsePiperTTS(language: string): boolean {
  return PIPER_SUPPORTED_LANGUAGES.some(lang =>
    language.toLowerCase().startsWith(lang.toLowerCase().split('-')[0])
  );
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

  // Track if TTS services are initialized
  const isSystemTtsInitializedRef = useRef(false);
  const isPiperTtsInitializedRef = useRef(false);

  // Track which TTS engine is currently being used
  const currentEngineRef = useRef<'piper' | 'system' | null>(null);

  // Initialize both TTS services
  useEffect(() => {
    const initTTS = async () => {
      // Initialize system TTS (for non-Dutch languages)
      if (!isSystemTtsInitializedRef.current) {
        const systemSuccess = await ttsService.initialize();
        isSystemTtsInitializedRef.current = systemSuccess;
        if (!systemSuccess) {
          console.warn('[useArticleTTS] System TTS initialization failed');
        }
      }

      // Initialize Piper TTS (for Dutch - high quality nl_NL-rdh-high voice)
      if (!isPiperTtsInitializedRef.current) {
        const piperSuccess = await piperTtsService.initialize();
        isPiperTtsInitializedRef.current = piperSuccess;
        if (piperSuccess) {
          console.info('[useArticleTTS] Piper TTS initialized with nl_NL-rdh-high voice');
        } else {
          console.warn('[useArticleTTS] Piper TTS initialization failed, will use system TTS');
        }
      }
    };

    void initTTS();
  }, []);

  // Set up TTS event listeners (both system TTS and Piper TTS)
  useEffect(() => {
    // === System TTS events ===
    // Progress updates
    const unsubProgress = ttsService.onProgress((prog: TtsProgress) => {
      if (currentEngineRef.current === 'system') {
        setProgress(prog.percentage / 100);
      }
    });

    // Completion
    const unsubComplete = ttsService.addEventListener('ttsComplete', () => {
      if (currentEngineRef.current === 'system') {
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(1);
        setCurrentArticle(null);
        currentEngineRef.current = null;
      }
    });

    // Pause
    const unsubPause = ttsService.addEventListener('ttsPause', () => {
      if (currentEngineRef.current === 'system') {
        setIsPaused(true);
      }
    });

    // Resume
    const unsubResume = ttsService.addEventListener('ttsResume', () => {
      if (currentEngineRef.current === 'system') {
        setIsPaused(false);
      }
    });

    // Cancelled
    const unsubCancel = ttsService.addEventListener('ttsCancelled', () => {
      if (currentEngineRef.current === 'system') {
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(0);
        setCurrentArticle(null);
        currentEngineRef.current = null;
      }
    });

    // Error
    const unsubError = ttsService.onError((errorMsg: string) => {
      if (currentEngineRef.current === 'system') {
        setError(errorMsg);
        setIsPlaying(false);
        setIsLoading(false);
        currentEngineRef.current = null;
      }
    });

    // === Piper TTS events ===
    const unsubPiperProgress = piperTtsService.addEventListener('piperProgress', (event) => {
      if (currentEngineRef.current === 'piper' && event.progress !== undefined) {
        setProgress(event.progress / 100);
      }
    });

    const unsubPiperComplete = piperTtsService.addEventListener('piperComplete', () => {
      if (currentEngineRef.current === 'piper') {
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(1);
        setCurrentArticle(null);
        currentEngineRef.current = null;
      }
    });

    const unsubPiperError = piperTtsService.addEventListener('piperError', (event) => {
      if (currentEngineRef.current === 'piper') {
        setError(event.error || 'Piper TTS error');
        setIsPlaying(false);
        setIsLoading(false);
        currentEngineRef.current = null;
      }
    });

    return () => {
      // System TTS cleanup
      unsubProgress();
      unsubComplete();
      unsubPause();
      unsubResume();
      unsubCancel();
      unsubError();
      // Piper TTS cleanup
      unsubPiperProgress();
      unsubPiperComplete();
      unsubPiperError();
    };
  }, []);

  /**
   * Start TTS playback
   *
   * IMPORTANT: For Dutch articles, uses the HIGH-QUALITY Piper TTS
   * with the nl_NL-rdh-high voice. Other languages use system TTS.
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

        // Determine which TTS engine to use
        const usePiper = shouldUsePiperTTS(language) && isPiperTtsInitializedRef.current;

        let success = false;

        if (usePiper) {
          // Use HIGH-QUALITY Piper TTS for Dutch
          console.info('[useArticleTTS] Using Piper TTS (nl_NL-rdh-high) for Dutch article');
          currentEngineRef.current = 'piper';

          // Stop any existing playback
          await piperTtsService.stop();
          await ttsService.stop();

          // Use chunked playback for better responsiveness
          success = await piperTtsService.speakChunked(textToSpeak, DEFAULT_SPEECH_RATE);

          if (!success) {
            // Fallback to system TTS if Piper fails
            console.warn('[useArticleTTS] Piper TTS failed, falling back to system TTS');
            currentEngineRef.current = 'system';
            const bestVoice = await ttsService.getBestVoiceForLanguage(language);
            success = await ttsService.speak(textToSpeak, bestVoice?.id, DEFAULT_SPEECH_RATE);
          }
        } else {
          // Use system TTS for non-Dutch languages
          console.info('[useArticleTTS] Using system TTS for', language);
          currentEngineRef.current = 'system';

          // Stop any existing playback
          await piperTtsService.stop();
          await ttsService.stop();

          const bestVoice = await ttsService.getBestVoiceForLanguage(language);
          success = await ttsService.speak(textToSpeak, bestVoice?.id, DEFAULT_SPEECH_RATE);
        }

        if (success) {
          setIsPlaying(true);
          setCurrentSentence(textToSpeak.substring(0, 100) + '...');
        } else {
          setError('TTS playback failed');
          setCurrentArticle(null);
          currentEngineRef.current = null;
        }
      } catch (err) {
        console.error('[useArticleTTS] Error starting TTS:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoading(false);
        setCurrentArticle(null);
        currentEngineRef.current = null;
      }
    },
    []
  );

  /**
   * Stop TTS playback (both Piper and system TTS)
   */
  const stopTTS = useCallback(async () => {
    // Stop both engines to be safe
    await piperTtsService.stop();
    await ttsService.stop();

    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentSentence('');
    setCurrentArticle(null);
    currentEngineRef.current = null;
  }, []);

  /**
   * Pause TTS playback
   */
  const pauseTTS = useCallback(async () => {
    if (currentEngineRef.current === 'piper') {
      await piperTtsService.pause();
      setIsPaused(true);  // Piper doesn't emit pause events
    } else {
      await ttsService.pause();
      // State will be updated by event listener
    }
  }, []);

  /**
   * Resume TTS playback
   */
  const resumeTTS = useCallback(async () => {
    if (currentEngineRef.current === 'piper') {
      await piperTtsService.resume();
      setIsPaused(false);  // Piper doesn't emit resume events
    } else {
      await ttsService.resume();
      // State will be updated by event listener
    }
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
