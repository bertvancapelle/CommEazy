/**
 * useMailTTS — Hook for TTS playback of email body text
 *
 * Provides text-to-speech functionality for reading emails aloud.
 * Uses the same dual-engine architecture as useArticleTTS:
 * - Dutch emails → Piper TTS (nl_NL-rdh-high, high-quality offline)
 * - Other languages → System TTS (AVSpeechSynthesizer)
 *
 * @see useArticleTTS for the original pattern
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { NativeModules } from 'react-native';
import { ttsService, type TtsProgress } from '@/services/ttsService';
import { piperTtsService } from '@/services/piperTtsService';
import { useAudioOrchestratorOptional, type AudioSourceState } from '@/contexts/AudioOrchestratorContext';

/** Audio source key for mail TTS */
const TTS_SOURCE = 'tts:mail' as const;

// Languages that use Piper TTS (high-quality offline voices)
const PIPER_SUPPORTED_LANGUAGES = ['nl-NL', 'nl-BE'];

// ============================================================
// Types
// ============================================================

export interface UseMailTTSReturn {
  /** Start reading the given text aloud */
  startReading: (text: string, language?: string) => Promise<void>;
  /** Stop reading */
  stopReading: () => Promise<void>;
  /** Pause reading */
  pauseReading: () => Promise<void>;
  /** Resume reading */
  resumeReading: () => Promise<void>;
  /** Whether TTS is currently playing */
  isPlaying: boolean;
  /** Whether TTS is paused */
  isPaused: boolean;
  /** Whether TTS is initializing */
  isLoading: boolean;
  /** Current progress (0-1) */
  progress: number;
  /** Error message (if any) */
  error: string | null;
}

// ============================================================
// Helpers
// ============================================================

/** Strip HTML tags, URLs, email addresses, and signatures for clean TTS text */
function stripHtmlForTTS(html: string): string {
  let text = html;

  // Replace <br>, <br/>, <p>, <div> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|li|h[1-6])>/gi, '\n');
  text = text.replace(/<(p|div|li|h[1-6])[^>]*>/gi, '\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#039;/g, "'");
  text = text.replace(/&apos;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');

  // Remove URLs (http/https/www) — confusing when read aloud
  text = text.replace(/https?:\/\/[^\s<>"{}|\\^`[\]]+/gi, '');
  text = text.replace(/www\.[^\s<>"{}|\\^`[\]]+/gi, '');

  // Remove email addresses — confusing when read aloud
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');

  // Remove common email signature markers and everything after
  // Matches lines starting with: --, Verstuurd vanaf, Sent from, Envoyé de, Gesendet von
  text = text.replace(/\n\s*--\s*\n[\s\S]*$/m, '');
  text = text.replace(/\n\s*(Verstuurd vanaf|Sent from|Envoyé de|Gesendet von|Enviado desde|Inviato da|Sendt fra|Skickat från|Sendt fra|Enviado de|Wysłano z)[^\n]*[\s\S]*$/im, '');

  // Collapse multiple whitespace/newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');

  return text.trim();
}

/** Detect if text is likely Dutch (simple heuristic) */
function detectDutch(text: string): boolean {
  const dutchWords = [
    'de', 'het', 'een', 'van', 'en', 'in', 'is', 'dat', 'op', 'te',
    'zijn', 'voor', 'met', 'niet', 'aan', 'er', 'maar', 'om', 'ook',
    'dit', 'die', 'als', 'bij', 'nog', 'naar', 'uit', 'wel', 'dan',
    'hun', 'had', 'heb', 'heeft', 'werd', 'worden', 'kunnen', 'zou',
    'groeten', 'bedankt', 'dank', 'graag', 'beste', 'geachte',
  ];

  const words = text.toLowerCase().split(/\s+/).slice(0, 100);
  const dutchCount = words.filter(w => dutchWords.includes(w)).length;
  const ratio = dutchCount / Math.max(words.length, 1);

  return ratio > 0.15;
}

function shouldUsePiper(language: string): boolean {
  return PIPER_SUPPORTED_LANGUAGES.some(lang =>
    language.toLowerCase().startsWith(lang.toLowerCase().split('-')[0]),
  );
}

// ============================================================
// Hook
// ============================================================

export function useMailTTS(): UseMailTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isSystemTtsInitRef = useRef(false);
  const isPiperTtsInitRef = useRef(false);
  const currentEngineRef = useRef<'piper' | 'system' | null>(null);
  const mountedRef = useRef(true);

  const audioOrchestrator = useAudioOrchestratorOptional();
  const audioOrchestratorRef = useRef(audioOrchestrator);
  audioOrchestratorRef.current = audioOrchestrator;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      piperTtsService.stop().catch(() => {});
      ttsService.stop().catch(() => {});
    };
  }, []);

  // Initialize TTS engines lazily
  const ensureInitialized = useCallback(async () => {
    if (!isSystemTtsInitRef.current) {
      const ok = await ttsService.initialize();
      isSystemTtsInitRef.current = ok;
    }
    if (!isPiperTtsInitRef.current) {
      const ok = await piperTtsService.initialize();
      isPiperTtsInitRef.current = ok;
    }
  }, []);

  // TTS event listeners
  useEffect(() => {
    // System TTS events
    const unsubProgress = ttsService.onProgress((prog: TtsProgress) => {
      if (currentEngineRef.current === 'system') {
        setProgress(prog.percentage / 100);
      }
    });

    const unsubComplete = ttsService.addEventListener('ttsComplete', () => {
      if (currentEngineRef.current === 'system') {
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(1);
        currentEngineRef.current = null;
        audioOrchestratorRef.current?.releasePlayback(TTS_SOURCE);
      }
    });

    const unsubPause = ttsService.addEventListener('ttsPause', () => {
      if (currentEngineRef.current === 'system') setIsPaused(true);
    });

    const unsubResume = ttsService.addEventListener('ttsResume', () => {
      if (currentEngineRef.current === 'system') setIsPaused(false);
    });

    const unsubCancel = ttsService.addEventListener('ttsCancelled', () => {
      if (currentEngineRef.current === 'system') {
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(0);
        currentEngineRef.current = null;
        audioOrchestratorRef.current?.releasePlayback(TTS_SOURCE);
      }
    });

    const unsubError = ttsService.onError((msg: string) => {
      if (currentEngineRef.current === 'system') {
        setError(msg);
        setIsPlaying(false);
        setIsLoading(false);
        currentEngineRef.current = null;
        audioOrchestratorRef.current?.releasePlayback(TTS_SOURCE);
      }
    });

    // Piper TTS events
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
        currentEngineRef.current = null;
        audioOrchestratorRef.current?.releasePlayback(TTS_SOURCE);
      }
    });

    const unsubPiperError = piperTtsService.addEventListener('piperError', (event) => {
      if (currentEngineRef.current === 'piper') {
        setError(event.error || 'TTS error');
        setIsPlaying(false);
        setIsLoading(false);
        currentEngineRef.current = null;
        audioOrchestratorRef.current?.releasePlayback(TTS_SOURCE);
      }
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubPause();
      unsubResume();
      unsubCancel();
      unsubError();
      unsubPiperProgress();
      unsubPiperComplete();
      unsubPiperError();
    };
  }, []);

  // ── Refs for Audio Orchestrator Push+Pull ──
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  /** Build AudioSourceState for the orchestrator (Pull fallback) */
  const buildMailTtsState = useCallback((): AudioSourceState => {
    return {
      isPlaying: isPlayingRef.current,
      isBuffering: isLoadingRef.current,
      title: 'E-mail',
      subtitle: '',
      artwork: null,
      progressType: 'bar',
      progress: progressRef.current,
      listenDuration: 0,
      position: 0,
      duration: 0,
      isFavorite: false,
      sleepTimerActive: false,
      playbackRate: 1,
      moduleId: 'mail',
    };
  }, []);

  // Register with audio orchestrator
  useEffect(() => {
    if (!audioOrchestrator) return;

    audioOrchestrator.registerSource(TTS_SOURCE, {
      stop: async () => {
        await piperTtsService.stop();
        await ttsService.stop();
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(0);
        currentEngineRef.current = null;
      },
      isPlaying: () => isPlayingRef.current,
      getState: () => buildMailTtsState(),
    });

    return () => {
      audioOrchestrator.unregisterSource(TTS_SOURCE);
    };
  }, [audioOrchestrator, buildMailTtsState]);

  // ── Push state to orchestrator on every relevant change ──
  useEffect(() => {
    if (!isPlaying || !audioOrchestrator) return;
    audioOrchestrator.updateState(TTS_SOURCE, buildMailTtsState());
  }, [isPlaying, isLoading, progress, audioOrchestrator, buildMailTtsState]);

  // ============================================================
  // Start reading
  // ============================================================

  const startReading = useCallback(async (text: string, language?: string) => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      await ensureInitialized();

      // Stop any current playback
      await piperTtsService.stop();
      await ttsService.stop();

      // Clean text (strip HTML if present)
      const cleanText = text.includes('<') ? stripHtmlForTTS(text) : text;

      if (!cleanText.trim()) {
        setError('No text to read');
        setIsLoading(false);
        return;
      }

      // Determine language: explicit param, auto-detect, or default
      const lang = language || (detectDutch(cleanText) ? 'nl-NL' : 'en-US');
      const usePiper = shouldUsePiper(lang) && isPiperTtsInitRef.current;

      // Request exclusive playback (stops radio/podcast/music)
      await audioOrchestratorRef.current?.requestPlayback(TTS_SOURCE);

      let success = false;

      if (usePiper) {
        currentEngineRef.current = 'piper';
        success = await piperTtsService.speakChunked(cleanText, 1.0);
      } else {
        currentEngineRef.current = 'system';
        // Get best voice for language
        const bestVoice = await ttsService.getBestVoiceForLanguage(lang);
        success = await ttsService.speak(cleanText, bestVoice?.id, 1.0);
      }

      if (mountedRef.current) {
        if (success) {
          setIsPlaying(true);
          setIsLoading(false);
        } else {
          setError('TTS playback failed');
          setIsLoading(false);
          currentEngineRef.current = null;
          audioOrchestratorRef.current?.releasePlayback(TTS_SOURCE);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
        setIsLoading(false);
        currentEngineRef.current = null;
        audioOrchestratorRef.current?.releasePlayback(TTS_SOURCE);
      }
    }
  }, [ensureInitialized]);

  // ============================================================
  // Stop / Pause / Resume
  // ============================================================

  const stopReading = useCallback(async () => {
    if (currentEngineRef.current === 'piper') {
      await piperTtsService.stop();
    } else if (currentEngineRef.current === 'system') {
      await ttsService.stop();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    currentEngineRef.current = null;
    audioOrchestratorRef.current?.releasePlayback(TTS_SOURCE);
  }, []);

  const pauseReading = useCallback(async () => {
    if (currentEngineRef.current === 'piper') {
      await piperTtsService.pause();
    } else if (currentEngineRef.current === 'system') {
      await ttsService.pause();
    }
    setIsPaused(true);
    // Push paused state to orchestrator
    audioOrchestrator?.updateState(TTS_SOURCE, { isPlaying: false });
  }, [audioOrchestrator]);

  const resumeReading = useCallback(async () => {
    if (currentEngineRef.current === 'piper') {
      await piperTtsService.resume();
    } else if (currentEngineRef.current === 'system') {
      await ttsService.resume();
    }
    setIsPaused(false);
  }, []);

  return {
    startReading,
    stopReading,
    pauseReading,
    resumeReading,
    isPlaying,
    isPaused,
    isLoading,
    progress,
    error,
  };
}
