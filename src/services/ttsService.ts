/**
 * TTS Service — Text-to-Speech abstraction layer
 *
 * Platform-agnostic interface for Text-to-Speech functionality.
 * Uses native platform TTS (iOS AVSpeechSynthesizer / Android TextToSpeech).
 *
 * Features:
 * - Multi-language support (NL, EN, DE, FR, ES)
 * - Voice selection per language
 * - Playback rate and pitch control
 * - Progress tracking for reading position
 * - Background audio support
 *
 * @see .claude/skills/ios-specialist/SKILL.md
 * @see .claude/skills/android-specialist/SKILL.md
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// ============================================================
// Types
// ============================================================

export interface TtsVoice {
  id: string;           // Platform voice identifier
  name: string;         // Human-readable name (e.g., "Ellen", "Daniel")
  language: string;     // Language code (e.g., "nl-NL", "en-US")
  quality: 'default' | 'enhanced' | 'premium';  // Voice quality level (iOS: 0=default, 1=enhanced, 2=premium)
}

export interface TtsProgress {
  position: number;     // Current character position
  length: number;       // Total text length
  percentage: number;   // 0-100
}

export interface TtsState {
  isSpeaking: boolean;
  isPaused: boolean;
  isLoading: boolean;
  currentPosition: number;
}

export type TtsEventType =
  | 'ttsStart'
  | 'ttsProgress'
  | 'ttsPause'
  | 'ttsResume'
  | 'ttsComplete'
  | 'ttsError'
  | 'ttsCancelled';

export interface TtsEvent {
  type: TtsEventType;
  position?: number;
  length?: number;
  error?: string;
}

// ============================================================
// Native Module Interface
// ============================================================

interface TtsNativeModule {
  initialize(): Promise<boolean>;
  getVoicesForLanguage(language: string): Promise<TtsVoice[]>;
  getAllVoices(): Promise<TtsVoice[]>;
  speak(text: string, voiceId?: string, rate?: number, pitch?: number): Promise<boolean>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  isSpeaking(): Promise<boolean>;
  isPaused(): Promise<boolean>;
  getCurrentPosition(): Promise<number>;
}

// ============================================================
// Service Implementation
// ============================================================

class TtsService {
  private module: TtsNativeModule | null = null;
  private emitter: NativeEventEmitter | null = null;
  private isInitialized: boolean = false;
  private currentText: string = '';
  private listeners: Map<TtsEventType, Set<(event: TtsEvent) => void>> = new Map();

  /**
   * Initialize the TTS service
   * Must be called before any other method
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      console.debug('[ttsService] Already initialized');
      return true;
    }

    try {
      const { TtsModule } = NativeModules;

      if (!TtsModule) {
        console.error('[ttsService] TtsModule not found - native module not linked');
        return false;
      }

      this.module = TtsModule as TtsNativeModule;
      this.emitter = new NativeEventEmitter(TtsModule);

      // Set up native event listeners
      this.setupEventListeners();

      // Initialize native module
      const result = await this.module.initialize();
      this.isInitialized = result;

      console.info('[ttsService] Initialized:', result ? 'success' : 'failed');
      return result;
    } catch (error) {
      console.error('[ttsService] Initialization failed:', error);
      return false;
    }
  }

  private setupEventListeners(): void {
    if (!this.emitter) return;

    // Progress updates
    this.emitter.addListener('ttsProgress', (data: { position: number; length: number }) => {
      this.emit('ttsProgress', {
        type: 'ttsProgress',
        position: data.position,
        length: data.length,
      });
    });

    // Speech started
    this.emitter.addListener('ttsStart', () => {
      this.emit('ttsStart', { type: 'ttsStart' });
    });

    // Speech completed
    this.emitter.addListener('ttsComplete', () => {
      this.emit('ttsComplete', { type: 'ttsComplete' });
    });

    // Speech paused
    this.emitter.addListener('ttsPause', () => {
      this.emit('ttsPause', { type: 'ttsPause' });
    });

    // Speech resumed
    this.emitter.addListener('ttsResume', () => {
      this.emit('ttsResume', { type: 'ttsResume' });
    });

    // Speech cancelled
    this.emitter.addListener('ttsCancelled', () => {
      this.emit('ttsCancelled', { type: 'ttsCancelled' });
    });

    // Error
    this.emitter.addListener('ttsError', (data: { error: string }) => {
      console.error('[ttsService] Error:', data.error);
      this.emit('ttsError', { type: 'ttsError', error: data.error });
    });
  }

  private emit(type: TtsEventType, event: TtsEvent): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(listener => listener(event));
    }
  }

  /**
   * Get available voices for a specific language
   * @param language - Language code (e.g., 'nl', 'en', 'de')
   */
  async getVoicesForLanguage(language: string): Promise<TtsVoice[]> {
    if (!this.module) {
      console.warn('[ttsService] Not initialized');
      return [];
    }

    try {
      const voices = await this.module.getVoicesForLanguage(language);
      console.debug('[ttsService] Found', voices.length, 'voices for', language);
      return voices;
    } catch (error) {
      console.error('[ttsService] getVoicesForLanguage failed:', error);
      return [];
    }
  }

  /**
   * Get all available voices
   */
  async getAllVoices(): Promise<TtsVoice[]> {
    if (!this.module) {
      console.warn('[ttsService] Not initialized');
      return [];
    }

    try {
      const voices = await this.module.getAllVoices();
      console.debug('[ttsService] Found', voices.length, 'total voices');
      return voices;
    } catch (error) {
      console.error('[ttsService] getAllVoices failed:', error);
      return [];
    }
  }

  /**
   * Get Premium quality voices for a specific language
   * Premium voices provide the best quality for read-aloud experience
   * @param language - Language code (e.g., 'nl', 'en', 'de')
   */
  async getPremiumVoicesForLanguage(language: string): Promise<TtsVoice[]> {
    const voices = await this.getVoicesForLanguage(language);
    const premiumVoices = voices.filter(v => v.quality === 'premium');
    console.debug('[ttsService] Found', premiumVoices.length, 'premium voices for', language);
    return premiumVoices;
  }

  /**
   * Get Enhanced quality voices for a specific language
   * Enhanced voices are the minimum quality for good read-aloud experience
   * @param language - Language code (e.g., 'nl', 'en', 'de')
   */
  async getEnhancedVoicesForLanguage(language: string): Promise<TtsVoice[]> {
    const voices = await this.getVoicesForLanguage(language);
    const enhancedVoices = voices.filter(v => v.quality === 'enhanced');
    console.debug('[ttsService] Found', enhancedVoices.length, 'enhanced voices for', language);
    return enhancedVoices;
  }

  /**
   * Get high-quality voices (Enhanced OR Premium) for a specific language
   * These are the minimum required quality for read-aloud
   * @param language - Language code (e.g., 'nl', 'en', 'de')
   */
  async getHighQualityVoicesForLanguage(language: string): Promise<TtsVoice[]> {
    const voices = await this.getVoicesForLanguage(language);
    const highQualityVoices = voices.filter(v => v.quality === 'enhanced' || v.quality === 'premium');
    console.debug('[ttsService] Found', highQualityVoices.length, 'high-quality voices for', language);
    return highQualityVoices;
  }

  /**
   * Check if at least one Premium voice is available for a language
   * @param language - Language code (e.g., 'nl', 'en', 'de')
   */
  async hasPremiumVoice(language: string): Promise<boolean> {
    const premiumVoices = await this.getPremiumVoicesForLanguage(language);
    return premiumVoices.length > 0;
  }

  /**
   * Check if at least one high-quality voice (Enhanced or Premium) is available
   * This is the minimum requirement for read-aloud functionality
   * @param language - Language code (e.g., 'nl', 'en', 'de')
   */
  async hasHighQualityVoice(language: string): Promise<boolean> {
    const highQualityVoices = await this.getHighQualityVoicesForLanguage(language);
    return highQualityVoices.length > 0;
  }

  /**
   * Get the best available voice for a language (prefers Premium > Enhanced > Default)
   * @param language - Language code (e.g., 'nl', 'en', 'de')
   */
  async getBestVoiceForLanguage(language: string): Promise<TtsVoice | null> {
    const voices = await this.getVoicesForLanguage(language);
    if (voices.length === 0) return null;

    // Priority: premium > enhanced > default
    const premium = voices.find(v => v.quality === 'premium');
    if (premium) return premium;

    const enhanced = voices.find(v => v.quality === 'enhanced');
    if (enhanced) return enhanced;

    return voices[0];
  }

  /**
   * Speak text using TTS
   * @param text - Text to speak
   * @param voiceId - Optional voice identifier
   * @param rate - Playback rate (0.5 - 2.0, default 1.0)
   * @param pitch - Voice pitch (0.5 - 2.0, default 1.0)
   */
  async speak(
    text: string,
    voiceId?: string,
    rate: number = 1.0,
    pitch: number = 1.0
  ): Promise<boolean> {
    if (!this.module) {
      console.warn('[ttsService] Not initialized');
      return false;
    }

    // Validate rate and pitch
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    const clampedPitch = Math.max(0.5, Math.min(2.0, pitch));

    try {
      this.currentText = text;
      const result = await this.module.speak(text, voiceId, clampedRate, clampedPitch);
      console.debug('[ttsService] speak:', result ? 'started' : 'failed');
      return result;
    } catch (error) {
      console.error('[ttsService] speak failed:', error);
      return false;
    }
  }

  /**
   * Pause current speech
   */
  async pause(): Promise<void> {
    if (!this.module) return;

    try {
      await this.module.pause();
      console.debug('[ttsService] Paused');
    } catch (error) {
      console.error('[ttsService] pause failed:', error);
    }
  }

  /**
   * Resume paused speech
   */
  async resume(): Promise<void> {
    if (!this.module) return;

    try {
      await this.module.resume();
      console.debug('[ttsService] Resumed');
    } catch (error) {
      console.error('[ttsService] resume failed:', error);
    }
  }

  /**
   * Stop current speech
   */
  async stop(): Promise<void> {
    if (!this.module) return;

    try {
      await this.module.stop();
      this.currentText = '';
      console.debug('[ttsService] Stopped');
    } catch (error) {
      console.error('[ttsService] stop failed:', error);
    }
  }

  /**
   * Check if TTS is currently speaking
   */
  async isSpeaking(): Promise<boolean> {
    if (!this.module) return false;

    try {
      return await this.module.isSpeaking();
    } catch (error) {
      console.error('[ttsService] isSpeaking failed:', error);
      return false;
    }
  }

  /**
   * Check if TTS is paused
   */
  async isPaused(): Promise<boolean> {
    if (!this.module) return false;

    try {
      return await this.module.isPaused();
    } catch (error) {
      console.error('[ttsService] isPaused failed:', error);
      return false;
    }
  }

  /**
   * Get current character position in the text
   */
  async getCurrentPosition(): Promise<number> {
    if (!this.module) return 0;

    try {
      return await this.module.getCurrentPosition();
    } catch (error) {
      console.error('[ttsService] getCurrentPosition failed:', error);
      return 0;
    }
  }

  /**
   * Get the current text being spoken
   */
  getCurrentText(): string {
    return this.currentText;
  }

  /**
   * Add event listener
   * @param type - Event type to listen for
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  addEventListener(
    type: TtsEventType,
    callback: (event: TtsEvent) => void
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  /**
   * Add listener for progress updates
   * Convenience method for the most common use case
   */
  onProgress(callback: (progress: TtsProgress) => void): () => void {
    return this.addEventListener('ttsProgress', (event) => {
      if (event.position !== undefined && event.length !== undefined) {
        callback({
          position: event.position,
          length: event.length,
          percentage: event.length > 0 ? (event.position / event.length) * 100 : 0,
        });
      }
    });
  }

  /**
   * Add listener for completion
   */
  onComplete(callback: () => void): () => void {
    return this.addEventListener('ttsComplete', callback);
  }

  /**
   * Add listener for errors
   */
  onError(callback: (error: string) => void): () => void {
    return this.addEventListener('ttsError', (event) => {
      if (event.error) {
        callback(event.error);
      }
    });
  }

  /**
   * Clean up resources
   * Call when unmounting or when TTS is no longer needed
   */
  cleanup(): void {
    if (this.emitter) {
      this.emitter.removeAllListeners('ttsProgress');
      this.emitter.removeAllListeners('ttsStart');
      this.emitter.removeAllListeners('ttsComplete');
      this.emitter.removeAllListeners('ttsPause');
      this.emitter.removeAllListeners('ttsResume');
      this.emitter.removeAllListeners('ttsCancelled');
      this.emitter.removeAllListeners('ttsError');
    }
    this.listeners.clear();
    console.debug('[ttsService] Cleaned up');
  }
}

// Export singleton instance
export const ttsService = new TtsService();

// Export for testing
export { TtsService };
