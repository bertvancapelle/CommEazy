/**
 * Piper TTS Service — Privacy-First Offline Text-to-Speech
 *
 * Uses Sherpa-ONNX with Piper VITS models for high-quality,
 * fully offline text-to-speech synthesis.
 *
 * CRITICAL PRIVACY GUARANTEE:
 * - ALL processing happens 100% on-device
 * - NO network calls are made by this service
 * - NO data leaves the device
 * - Models are bundled in the app
 *
 * @see https://github.com/rhasspy/piper
 * @see https://github.com/k2-fsa/sherpa-onnx
 */

import { NativeModules, NativeEventEmitter } from 'react-native';

// Native module interface
const { PiperTtsModule } = NativeModules;
const piperEmitter = PiperTtsModule ? new NativeEventEmitter(PiperTtsModule) : null;

// ============================================================
// Types
// ============================================================

export interface PiperVoice {
  id: string;           // Model identifier (e.g., 'nl_NL-mls-medium')
  name: string;         // Human-readable name
  language: string;     // Language code (e.g., 'nl-NL')
  quality: 'low' | 'medium' | 'high';
  modelPath: string;    // Path to model directory
}

export interface PiperTtsState {
  isInitialized: boolean;
  isGenerating: boolean;
  isPlaying: boolean;
  currentVoice: PiperVoice | null;
  error: string | null;
}

export type PiperTtsEventType =
  | 'piperStart'
  | 'piperProgress'
  | 'piperComplete'
  | 'piperError';

export interface PiperTtsEvent {
  type: PiperTtsEventType;
  progress?: number;  // 0-100 for generation progress
  position?: number;  // Current position in seconds (chunked mode)
  duration?: number;  // Total duration in seconds (chunked mode)
  error?: string;
}

// Minimum paragraph length to be worth chunking
const MIN_CHUNK_LENGTH = 100;

// Maximum chunk length to prevent very long generation times
const MAX_CHUNK_LENGTH = 2000;

// ============================================================
// Available Voices (bundled in app)
// ============================================================

const BUNDLED_VOICES: PiperVoice[] = [
  {
    id: 'nl_NL-mls-medium',
    name: 'Dutch (MLS)',
    language: 'nl-NL',
    quality: 'medium',
    modelPath: 'piper-models/nl_NL-mls-medium',
  },
];

// ============================================================
// Service Implementation
// ============================================================

class PiperTtsService {
  private isInitialized: boolean = false;
  private currentVoice: PiperVoice | null = null;
  private listeners: Map<PiperTtsEventType, Set<(event: PiperTtsEvent) => void>> = new Map();
  private nativeEventSubscriptions: any[] = [];

  /**
   * Initialize the Piper TTS service.
   *
   * PRIVACY: This method only loads local model files.
   * No network requests are made.
   */
  async initialize(voiceId?: string): Promise<boolean> {
    if (this.isInitialized && this.currentVoice?.id === voiceId) {
      console.debug('[piperTtsService] Already initialized with voice:', voiceId);
      return true;
    }

    // Check if native module is available
    if (!PiperTtsModule) {
      console.error('[piperTtsService] PiperTtsModule not available');
      return false;
    }

    try {
      // Select voice (default to first bundled voice)
      const voice = voiceId
        ? BUNDLED_VOICES.find(v => v.id === voiceId)
        : BUNDLED_VOICES[0];

      if (!voice) {
        console.error('[piperTtsService] Voice not found:', voiceId);
        return false;
      }

      console.info('[piperTtsService] Initializing with voice:', voice.name);

      // Initialize TTS with bundled model
      // PRIVACY: Model is loaded from local app bundle, no network access
      const result = await PiperTtsModule.initialize(voice.modelPath);

      if (!result.success) {
        console.error('[piperTtsService] Failed to initialize TTS');
        return false;
      }

      console.info('[piperTtsService] Model loaded:', {
        sampleRate: result.sampleRate,
        numSpeakers: result.numSpeakers,
      });

      // Set up native event listeners
      this.setupNativeEventListeners();

      this.currentVoice = voice;
      this.isInitialized = true;

      console.info('[piperTtsService] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[piperTtsService] Initialization failed:', error);
      this.emit('piperError', { type: 'piperError', error: String(error) });
      return false;
    }
  }

  private setupNativeEventListeners(): void {
    if (!piperEmitter) return;

    // Clean up any existing subscriptions
    this.nativeEventSubscriptions.forEach(sub => sub.remove());
    this.nativeEventSubscriptions = [];

    // Subscribe to native events
    this.nativeEventSubscriptions.push(
      piperEmitter.addListener('piperStart', () => {
        this.emit('piperStart', { type: 'piperStart' });
      }),
      piperEmitter.addListener('piperProgress', (data: { progress: number }) => {
        this.emit('piperProgress', { type: 'piperProgress', progress: data.progress });
      }),
      piperEmitter.addListener('piperComplete', () => {
        this.emit('piperComplete', { type: 'piperComplete' });
      }),
      piperEmitter.addListener('piperError', (data: { error: string }) => {
        this.emit('piperError', { type: 'piperError', error: data.error });
      })
    );
  }

  /**
   * Get available voices for a language.
   *
   * PRIVACY: Returns only locally bundled voices.
   * No network requests are made.
   */
  getVoicesForLanguage(language: string): PiperVoice[] {
    const langPrefix = language.toLowerCase().split('-')[0];
    return BUNDLED_VOICES.filter(v =>
      v.language.toLowerCase().startsWith(langPrefix)
    );
  }

  /**
   * Get all available voices.
   *
   * PRIVACY: Returns only locally bundled voices.
   */
  getAllVoices(): PiperVoice[] {
    return [...BUNDLED_VOICES];
  }

  /**
   * Generate and play speech from text.
   *
   * PRIVACY GUARANTEE:
   * - Text is processed 100% locally using the ONNX model
   * - Audio is generated on-device
   * - No data is sent to any server
   *
   * @param text - Text to speak (processed locally)
   * @param speed - Playback speed (0.5 - 2.0, default 1.0)
   */
  async speak(text: string, speed: number = 1.0): Promise<boolean> {
    if (!this.isInitialized || !PiperTtsModule) {
      console.warn('[piperTtsService] Not initialized');
      return false;
    }

    if (!text || text.trim().length === 0) {
      console.warn('[piperTtsService] Empty text provided');
      return false;
    }

    try {
      // Clamp speed to valid range
      const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));

      console.debug('[piperTtsService] Generating speech for text length:', text.length);

      // Generate and play speech locally using ONNX model
      // PRIVACY: All processing happens on-device
      const result = await PiperTtsModule.speak(text, clampedSpeed);

      return result === true;
    } catch (error) {
      console.error('[piperTtsService] speak failed:', error);
      this.emit('piperError', { type: 'piperError', error: String(error) });
      return false;
    }
  }

  /**
   * Split text into paragraphs for chunked playback.
   *
   * Strategy:
   * 1. Split on double newlines (paragraph breaks)
   * 2. If chunks are too long, split on sentence boundaries
   * 3. Merge very short chunks with neighbors
   *
   * @param text - Full text to split
   * @returns Array of text chunks suitable for TTS
   */
  splitIntoParagraphs(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // First pass: split on paragraph breaks (double newlines)
    let chunks = text
      .split(/\n\s*\n/)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 0);

    // Second pass: split long chunks on sentence boundaries
    const refinedChunks: string[] = [];
    for (const chunk of chunks) {
      if (chunk.length <= MAX_CHUNK_LENGTH) {
        refinedChunks.push(chunk);
      } else {
        // Split on sentence boundaries
        const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [chunk];
        let currentChunk = '';

        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length <= MAX_CHUNK_LENGTH) {
            currentChunk += sentence;
          } else {
            if (currentChunk.length > 0) {
              refinedChunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
          }
        }

        if (currentChunk.length > 0) {
          refinedChunks.push(currentChunk.trim());
        }
      }
    }

    // Third pass: merge very short chunks with neighbors
    const mergedChunks: string[] = [];
    let pendingChunk = '';

    for (const chunk of refinedChunks) {
      if (pendingChunk.length > 0) {
        // Merge with pending
        const combined = pendingChunk + ' ' + chunk;
        if (combined.length <= MAX_CHUNK_LENGTH) {
          pendingChunk = combined;
        } else {
          mergedChunks.push(pendingChunk);
          pendingChunk = chunk;
        }
      } else if (chunk.length < MIN_CHUNK_LENGTH) {
        // Too short, save for merging
        pendingChunk = chunk;
      } else {
        mergedChunks.push(chunk);
      }
    }

    // Don't forget the last pending chunk
    if (pendingChunk.length > 0) {
      mergedChunks.push(pendingChunk);
    }

    console.debug('[piperTtsService] Split text into', mergedChunks.length, 'chunks');

    return mergedChunks;
  }

  /**
   * Generate and play speech using chunked playback.
   *
   * BENEFITS:
   * - First audio starts much faster (~2-3 seconds vs potentially 30+ seconds)
   * - Smoother progress tracking
   * - Better memory usage for long texts
   *
   * PRIVACY GUARANTEE:
   * - All processing happens 100% on-device
   * - No data is sent to any server
   *
   * @param text - Full text to speak (will be split into paragraphs)
   * @param speed - Playback speed (0.5 - 2.0, default 1.0)
   */
  async speakChunked(text: string, speed: number = 1.0): Promise<boolean> {
    if (!this.isInitialized || !PiperTtsModule) {
      console.warn('[piperTtsService] Not initialized');
      return false;
    }

    if (!text || text.trim().length === 0) {
      console.warn('[piperTtsService] Empty text provided');
      return false;
    }

    // Split text into paragraphs
    const chunks = this.splitIntoParagraphs(text);

    if (chunks.length === 0) {
      console.warn('[piperTtsService] No valid chunks after splitting');
      return false;
    }

    // If only one chunk, use regular speak method
    if (chunks.length === 1) {
      console.debug('[piperTtsService] Only one chunk, using regular speak');
      return this.speak(chunks[0], speed);
    }

    try {
      // Clamp speed to valid range
      const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));

      console.info('[piperTtsService] Starting chunked playback:', {
        totalChunks: chunks.length,
        totalLength: text.length,
        speed: clampedSpeed,
      });

      // Call native chunked playback method
      // PRIVACY: All processing happens on-device
      const result = await PiperTtsModule.speakChunked(chunks, clampedSpeed);

      return result === true;
    } catch (error) {
      console.error('[piperTtsService] speakChunked failed:', error);
      this.emit('piperError', { type: 'piperError', error: String(error) });
      return false;
    }
  }

  /**
   * Pause playback.
   */
  async pause(): Promise<void> {
    if (!PiperTtsModule) return;
    try {
      await PiperTtsModule.pause();
    } catch (error) {
      console.error('[piperTtsService] pause failed:', error);
    }
  }

  /**
   * Resume playback.
   */
  async resume(): Promise<void> {
    if (!PiperTtsModule) return;
    try {
      await PiperTtsModule.resume();
    } catch (error) {
      console.error('[piperTtsService] resume failed:', error);
    }
  }

  /**
   * Stop playback.
   */
  async stop(): Promise<void> {
    if (!PiperTtsModule) return;
    try {
      await PiperTtsModule.stop();
    } catch (error) {
      console.error('[piperTtsService] stop failed:', error);
    }
  }

  /**
   * Check if audio is currently playing.
   */
  async isPlaying(): Promise<boolean> {
    if (!PiperTtsModule) return false;
    try {
      return await PiperTtsModule.isPlaying();
    } catch {
      return false;
    }
  }

  /**
   * Add event listener.
   */
  addEventListener(
    type: PiperTtsEventType,
    callback: (event: PiperTtsEvent) => void
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  private emit(type: PiperTtsEventType, event: PiperTtsEvent): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(listener => listener(event));
    }
  }

  /**
   * Release resources.
   *
   * Call when TTS is no longer needed.
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up native event subscriptions
      this.nativeEventSubscriptions.forEach(sub => sub.remove());
      this.nativeEventSubscriptions = [];

      // Release native module resources
      if (PiperTtsModule) {
        await PiperTtsModule.release();
      }

      this.isInitialized = false;
      this.currentVoice = null;
      this.listeners.clear();
      console.debug('[piperTtsService] Cleaned up');
    } catch (error) {
      console.error('[piperTtsService] cleanup failed:', error);
    }
  }

  /**
   * Get current state.
   */
  async getState(): Promise<PiperTtsState> {
    return {
      isInitialized: this.isInitialized,
      isGenerating: false,  // TODO: Track generation state
      isPlaying: await this.isPlaying(),
      currentVoice: this.currentVoice,
      error: null,
    };
  }
}

// Export singleton instance
export const piperTtsService = new PiperTtsService();

// Export for testing
export { PiperTtsService };
