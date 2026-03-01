/**
 * GlassPlayerService — React Native bridge for native Glass Player Window
 *
 * Provides a TypeScript API to control the native iOS Glass Player Window
 * which uses UIGlassEffect for Liquid Glass visuals.
 *
 * @see ios/GlassPlayerWindow/GlassPlayerWindowModule.swift
 * @see .claude/plans/LIQUID_GLASS_PLAYER_WINDOW.md
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// ============================================================
// Types
// ============================================================

export type ProgressType = 'bar' | 'duration';

export interface GlassPlayerContent {
  /** Module ID for color lookup */
  moduleId: string;
  /** Hex color for glass tint (e.g., "#00897B") */
  tintColorHex: string;
  /** Artwork URL */
  artwork: string | null;
  /** Primary title */
  title: string;
  /** Secondary text (artist, show name, etc.) */
  subtitle?: string;
  /** Progress display type */
  progressType: ProgressType;
  /** Progress value 0-1 (for 'bar' type) */
  progress?: number;
  /** Listen duration in seconds (for 'duration' type) */
  listenDuration?: number;
  /** Show stop button */
  showStopButton?: boolean;
  /** Panel bounds for iPad Split View (x, y, width, height in points) */
  panelBounds?: { x: number; y: number; width: number; height: number };
}

export type ShuffleMode = 'off' | 'songs';
export type RepeatMode = 'off' | 'one' | 'all';

export interface GlassPlayerPlaybackState {
  /** Is currently playing */
  isPlaying: boolean;
  /** Is loading/buffering */
  isLoading?: boolean;
  /** Is buffering mid-playback */
  isBuffering?: boolean;
  /** Progress 0-1 (for podcast/books) */
  progress?: number;
  /** Current position in seconds */
  position?: number;
  /** Total duration in seconds */
  duration?: number;
  /** Listen duration in seconds (for radio - cumulative listening time) */
  listenDuration?: number;
  /** Is favorited */
  isFavorite?: boolean;
  /** Shuffle mode */
  shuffleMode?: ShuffleMode;
  /** Repeat mode */
  repeatMode?: RepeatMode;
}

export interface GlassPlayerFullConfig {
  /** Show seek slider */
  seekSlider?: boolean;
  /** Show skip buttons */
  skipButtons?: boolean;
  /** Show speed control */
  speedControl?: boolean;
  /** Show sleep timer */
  sleepTimer?: boolean;
  /** Show favorite button */
  favorite?: boolean;
  /** Show stop button */
  stopButton?: boolean;
  /** Show shuffle button */
  shuffle?: boolean;
  /** Show repeat button */
  repeat?: boolean;
}

export type GlassPlayerEventType =
  | 'onPlayPause'
  | 'onStop'
  | 'onExpand'
  | 'onCollapse'
  | 'onMinimize'
  | 'onSeek'
  | 'onSkipForward'
  | 'onSkipBackward'
  | 'onClose'
  | 'onFavoriteToggle'
  | 'onSleepTimerSet'
  | 'onSpeedChange'
  | 'onShuffleToggle'
  | 'onRepeatToggle';

export interface GlassPlayerSeekEvent {
  position: number;
}

export interface GlassPlayerSleepTimerEvent {
  minutes: number | null;
}

export interface GlassPlayerSpeedEvent {
  speed: number;
}

// ============================================================
// Native Module Interface
// ============================================================

interface GlassPlayerWindowModuleInterface {
  isAvailable(): Promise<boolean>;
  showMiniPlayer(config: GlassPlayerContent): Promise<boolean>;
  expandToFullPlayer(): Promise<boolean>;
  collapseToMini(): Promise<boolean>;
  hidePlayer(): Promise<boolean>;
  minimizePlayer(): Promise<boolean>;
  showFromMinimized(): Promise<boolean>;
  isMinimized(): Promise<boolean>;
  setMinimizeButtonVisible(visible: boolean): void;
  updateContent(config: Partial<GlassPlayerContent>): void;
  updatePlaybackState(state: GlassPlayerPlaybackState): void;
  configureControls(controls: GlassPlayerFullConfig): void;
  setTemporarilyHidden(hidden: boolean): void;
  updatePanelBounds(bounds: { x: number; y: number; width: number; height: number } | null): void;
  configureButtonStyle(borderEnabled: boolean, borderColorHex: string): void;
}

// ============================================================
// Service Class
// ============================================================

class GlassPlayerService {
  private nativeModule: GlassPlayerWindowModuleInterface | null = null;
  private eventEmitter: NativeEventEmitter | null = null;
  private isAvailableCache: boolean | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private lastContentJSON: string = '';
  private lastPlaybackStateJSON: string = '';

  constructor() {
    if (Platform.OS === 'ios') {
      this.nativeModule = NativeModules.GlassPlayerWindowModule;
      if (this.nativeModule) {
        this.eventEmitter = new NativeEventEmitter(NativeModules.GlassPlayerWindowModule);
      }
    }
  }

  /**
   * Check if Glass Player Window is available (iOS 26+)
   */
  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }

    if (this.isAvailableCache !== null) {
      return this.isAvailableCache;
    }

    if (!this.nativeModule) {
      this.isAvailableCache = false;
      return false;
    }

    try {
      this.isAvailableCache = await this.nativeModule.isAvailable();
      console.debug('[GlassPlayer] isAvailable:', this.isAvailableCache);
      return this.isAvailableCache;
    } catch (error) {
      console.warn('[GlassPlayer] Error checking availability:', error);
      this.isAvailableCache = false;
      return false;
    }
  }

  /**
   * Show mini player with content
   */
  async showMiniPlayer(content: GlassPlayerContent): Promise<boolean> {
    if (!this.nativeModule) {
      console.warn('[GlassPlayer] Native module not available');
      return false;
    }

    try {
      return await this.nativeModule.showMiniPlayer(content);
    } catch (error) {
      console.error('[GlassPlayer] Error showing mini player:', error);
      return false;
    }
  }

  /**
   * Expand to full player
   */
  async expandToFull(): Promise<boolean> {
    if (!this.nativeModule) {
      return false;
    }

    try {
      return await this.nativeModule.expandToFullPlayer();
    } catch (error) {
      console.error('[GlassPlayer] Error expanding to full:', error);
      return false;
    }
  }

  /**
   * Collapse to mini player
   */
  async collapseToMini(): Promise<boolean> {
    if (!this.nativeModule) {
      return false;
    }

    try {
      return await this.nativeModule.collapseToMini();
    } catch (error) {
      console.error('[GlassPlayer] Error collapsing to mini:', error);
      return false;
    }
  }

  /**
   * Hide player completely
   */
  async hide(): Promise<boolean> {
    if (!this.nativeModule) {
      return false;
    }

    try {
      return await this.nativeModule.hidePlayer();
    } catch (error) {
      console.error('[GlassPlayer] Error hiding player:', error);
      return false;
    }
  }

  /**
   * Minimize player — hide without stopping audio (iPad only).
   * The player can be restored via showFromMinimized().
   */
  async minimize(): Promise<boolean> {
    if (!this.nativeModule) {
      return false;
    }

    try {
      return await this.nativeModule.minimizePlayer();
    } catch (error) {
      console.error('[GlassPlayer] Error minimizing player:', error);
      return false;
    }
  }

  /**
   * Show player from minimized state
   */
  async showFromMinimized(): Promise<boolean> {
    if (!this.nativeModule) {
      return false;
    }

    try {
      return await this.nativeModule.showFromMinimized();
    } catch (error) {
      console.error('[GlassPlayer] Error showing from minimized:', error);
      return false;
    }
  }

  /**
   * Check if the player is currently minimized
   */
  async isMinimized(): Promise<boolean> {
    if (!this.nativeModule) {
      return false;
    }

    try {
      return await this.nativeModule.isMinimized();
    } catch (error) {
      return false;
    }
  }

  /**
   * Enable or disable the minimize button on the mini player (iPad only)
   */
  setMinimizeButtonVisible(visible: boolean): void {
    if (!this.nativeModule) {
      return;
    }

    this.nativeModule.setMinimizeButtonVisible(visible);
  }

  /**
   * Update player content (artwork, title, progress, etc.)
   * Deduplicates calls by comparing with previous state.
   */
  updateContent(content: Partial<GlassPlayerContent>): void {
    if (!this.nativeModule) {
      return;
    }

    const json = JSON.stringify(content);
    if (json === this.lastContentJSON) {
      return;
    }
    this.lastContentJSON = json;
    this.nativeModule.updateContent(content);
  }

  /**
   * Update playback state (isPlaying, progress, etc.)
   * Deduplicates calls by comparing with previous state.
   */
  updatePlaybackState(state: GlassPlayerPlaybackState): void {
    if (!this.nativeModule) {
      return;
    }

    const json = JSON.stringify(state);
    if (json === this.lastPlaybackStateJSON) {
      return;
    }
    this.lastPlaybackStateJSON = json;
    this.nativeModule.updatePlaybackState(state);
  }

  /**
   * Configure full player controls (which buttons to show/hide)
   */
  configureControls(controls: GlassPlayerFullConfig): void {
    if (!this.nativeModule) {
      return;
    }

    this.nativeModule.configureControls(controls);
  }

  /**
   * Temporarily hide/show the player (e.g., when navigation menu is open)
   * This preserves state and allows resuming visibility without affecting playback
   */
  setTemporarilyHidden(hidden: boolean): void {
    if (!this.nativeModule) {
      return;
    }

    this.nativeModule.setTemporarilyHidden(hidden);
  }

  /**
   * Update panel bounds for iPad Split View positioning
   * Pass null to reset to full screen mode (iPhone)
   */
  updatePanelBounds(bounds: { x: number; y: number; width: number; height: number } | null): void {
    if (!this.nativeModule) {
      return;
    }

    this.nativeModule.updatePanelBounds(bounds);
  }

  /**
   * Configure button border styling (user setting)
   * @param borderEnabled Whether to show button borders
   * @param borderColorHex Hex color for button borders (e.g., "#FFFFFF")
   */
  configureButtonStyle(borderEnabled: boolean, borderColorHex: string): void {
    if (!this.nativeModule) {
      return;
    }

    this.nativeModule.configureButtonStyle(borderEnabled, borderColorHex);
  }

  /**
   * Add event listener
   */
  addEventListener(
    event: GlassPlayerEventType,
    callback: (data?: any) => void
  ): () => void {
    if (!this.eventEmitter) {
      return () => {};
    }

    // Track listener for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Subscribe to native event
    const subscription = this.eventEmitter.addListener(event, callback);

    // Return cleanup function
    return () => {
      subscription.remove();
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    if (!this.eventEmitter) {
      return;
    }

    this.eventEmitter.removeAllListeners('onPlayPause');
    this.eventEmitter.removeAllListeners('onStop');
    this.eventEmitter.removeAllListeners('onExpand');
    this.eventEmitter.removeAllListeners('onCollapse');
    this.eventEmitter.removeAllListeners('onMinimize');
    this.eventEmitter.removeAllListeners('onSeek');
    this.eventEmitter.removeAllListeners('onSkipForward');
    this.eventEmitter.removeAllListeners('onSkipBackward');
    this.eventEmitter.removeAllListeners('onClose');
    this.eventEmitter.removeAllListeners('onFavoriteToggle');
    this.eventEmitter.removeAllListeners('onSleepTimerSet');
    this.eventEmitter.removeAllListeners('onSpeedChange');
    this.eventEmitter.removeAllListeners('onShuffleToggle');
    this.eventEmitter.removeAllListeners('onRepeatToggle');

    this.listeners.clear();
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const glassPlayer = new GlassPlayerService();
export default glassPlayer;
