/**
 * GameSoundService — Manages game tap and win celebration sounds
 *
 * Uses iOS system sounds via the native AudioServices module.
 * All settings are shared across all 6 games and persisted in AsyncStorage.
 *
 * Sound categories:
 * - Tap sounds: Short feedback on each interaction (button press, card tap, etc.)
 * - Win sounds: Celebration sound on game win
 *
 * @see ios/CommEazyTemp/AudioServices.m
 */

import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { AudioServices } = NativeModules;

// ============================================================
// Types
// ============================================================

export type TapSoundId = 'off' | 'click' | 'pop' | 'tick' | 'ping' | 'swoosh';
export type WinSoundId = 'off' | 'horn' | 'firework' | 'twinkle' | 'chime' | 'balloonpop';

export interface GameSoundSettings {
  tapSound: TapSoundId;
  winSound: WinSoundId;
}

export interface SoundOption<T extends string> {
  id: T;
  labelKey: string; // i18n key
  soundId: number;  // iOS system sound ID (0 = off)
}

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY_TAP = '@commeazy/games_tapSound';
const STORAGE_KEY_WIN = '@commeazy/games_winSound';

/**
 * iOS System Sound IDs for tap feedback
 * Reference: https://iphonedev.wiki/index.php/AudioServices
 */
export const TAP_SOUND_OPTIONS: SoundOption<TapSoundId>[] = [
  { id: 'off',    labelKey: 'games.sounds.off',    soundId: 0 },
  { id: 'click',  labelKey: 'games.sounds.click',  soundId: 1104 }, // Tock
  { id: 'pop',    labelKey: 'games.sounds.pop',    soundId: 1306 }, // Begin Recording (pop)
  { id: 'tick',   labelKey: 'games.sounds.tick',   soundId: 1103 }, // Tick
  { id: 'ping',   labelKey: 'games.sounds.ping',   soundId: 1057 }, // Mail Sent (whoosh/ping)
  { id: 'swoosh', labelKey: 'games.sounds.swoosh', soundId: 1001 }, // New Mail
];

/**
 * iOS System Sound IDs for win celebration
 * These are louder/more celebratory sounds
 */
export const WIN_SOUND_OPTIONS: SoundOption<WinSoundId>[] = [
  { id: 'off',        labelKey: 'games.sounds.off',        soundId: 0 },
  { id: 'horn',       labelKey: 'games.sounds.horn',       soundId: 1025 }, // New Voicemail
  { id: 'firework',   labelKey: 'games.sounds.firework',   soundId: 1020 }, // Anticipate
  { id: 'twinkle',    labelKey: 'games.sounds.twinkle',    soundId: 1016 }, // Tweet Sent
  { id: 'chime',      labelKey: 'games.sounds.chime',      soundId: 1007 }, // SMS Received (tri-tone)
  { id: 'balloonpop', labelKey: 'games.sounds.balloonpop', soundId: 1052 }, // Payment Success
];

export const DEFAULT_SETTINGS: GameSoundSettings = {
  tapSound: 'click',
  winSound: 'horn',
};

// ============================================================
// Service
// ============================================================

class GameSoundService {
  private settings: GameSoundSettings = { ...DEFAULT_SETTINGS };
  private loaded = false;

  /**
   * Load settings from AsyncStorage (call once on app start or first game open)
   */
  async loadSettings(): Promise<GameSoundSettings> {
    if (this.loaded) return { ...this.settings };

    try {
      const [tapVal, winVal] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_TAP),
        AsyncStorage.getItem(STORAGE_KEY_WIN),
      ]);

      if (tapVal !== null) this.settings.tapSound = tapVal as TapSoundId;
      if (winVal !== null) this.settings.winSound = winVal as WinSoundId;
      this.loaded = true;
    } catch {
      // Silently use defaults
    }

    return { ...this.settings };
  }

  /**
   * Get current settings (synchronous — call loadSettings first)
   */
  getSettings(): GameSoundSettings {
    return { ...this.settings };
  }

  /**
   * Set tap sound and persist
   */
  async setTapSound(id: TapSoundId): Promise<void> {
    this.settings.tapSound = id;
    await AsyncStorage.setItem(STORAGE_KEY_TAP, id);
  }

  /**
   * Set win sound and persist
   */
  async setWinSound(id: WinSoundId): Promise<void> {
    this.settings.winSound = id;
    await AsyncStorage.setItem(STORAGE_KEY_WIN, id);
  }

  /**
   * Play the configured tap sound (short, immediate feedback)
   */
  playTapSound(): void {
    const option = TAP_SOUND_OPTIONS.find(o => o.id === this.settings.tapSound);
    if (!option || option.soundId === 0) return;
    this.playSystemSound(option.soundId);
  }

  /**
   * Play the configured win celebration sound
   */
  playWinSound(): void {
    const option = WIN_SOUND_OPTIONS.find(o => o.id === this.settings.winSound);
    if (!option || option.soundId === 0) return;
    // Use alert sound (louder) for celebrations
    this.playAlertSound(option.soundId);
  }

  /**
   * Preview a specific sound (for settings picker)
   */
  previewTapSound(id: TapSoundId): void {
    const option = TAP_SOUND_OPTIONS.find(o => o.id === id);
    if (!option || option.soundId === 0) return;
    this.playSystemSound(option.soundId);
  }

  /**
   * Preview a specific win sound (for settings picker)
   */
  previewWinSound(id: WinSoundId): void {
    const option = WIN_SOUND_OPTIONS.find(o => o.id === id);
    if (!option || option.soundId === 0) return;
    this.playAlertSound(option.soundId);
  }

  // ============================================================
  // Private
  // ============================================================

  private playSystemSound(soundId: number): void {
    if (Platform.OS === 'ios' && AudioServices) {
      AudioServices.playSystemSound(soundId);
    }
    // Android: no-op for now (system sounds are iOS-specific)
  }

  private playAlertSound(soundId: number): void {
    if (Platform.OS === 'ios' && AudioServices) {
      AudioServices.playAlertSound(soundId);
    }
  }
}

// Singleton
export const gameSoundService = new GameSoundService();
