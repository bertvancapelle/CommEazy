/**
 * Orientation Service — Screen Orientation Control
 *
 * Controls screen orientation for the app. Default is portrait-only on iPhone,
 * with an exception for fullscreen video playback which allows landscape.
 *
 * iPad always allows all orientations.
 *
 * Usage:
 * - orientationService.unlockForVideo() — Call when entering fullscreen video
 * - orientationService.lockToPortrait() — Call when exiting fullscreen video
 *
 * @see ios/CommEazyTemp/OrientationModule.m
 */

import { NativeModules, Platform } from 'react-native';

// ============================================================
// Types
// ============================================================

interface OrientationModuleInterface {
  setLandscapeAllowed: (allowed: boolean) => void;
  isLandscapeAllowedAsync: () => Promise<boolean>;
  lockToPortrait: () => void;
  unlockForVideo: () => void;
}

// ============================================================
// Native Module Access
// ============================================================

const { OrientationModule } = NativeModules as {
  OrientationModule?: OrientationModuleInterface;
};

// ============================================================
// Service Implementation
// ============================================================

class OrientationServiceImpl {
  private isUnlocked = false;

  /**
   * Unlock orientation to allow landscape (for fullscreen video).
   * Call this when entering fullscreen video mode.
   */
  unlockForVideo(): void {
    if (Platform.OS !== 'ios') {
      console.debug('[orientationService] Android orientation not implemented');
      return;
    }

    if (!OrientationModule) {
      console.warn('[orientationService] OrientationModule not available');
      return;
    }

    if (this.isUnlocked) {
      console.debug('[orientationService] Already unlocked');
      return;
    }

    console.info('[orientationService] Unlocking orientation for video');
    OrientationModule.unlockForVideo();
    this.isUnlocked = true;
  }

  /**
   * Lock orientation back to portrait.
   * Call this when exiting fullscreen video mode.
   */
  lockToPortrait(): void {
    if (Platform.OS !== 'ios') {
      console.debug('[orientationService] Android orientation not implemented');
      return;
    }

    if (!OrientationModule) {
      console.warn('[orientationService] OrientationModule not available');
      return;
    }

    if (!this.isUnlocked) {
      console.debug('[orientationService] Already locked');
      return;
    }

    console.info('[orientationService] Locking orientation to portrait');
    OrientationModule.lockToPortrait();
    this.isUnlocked = false;
  }

  /**
   * Set landscape allowed state directly.
   * Prefer using unlockForVideo() and lockToPortrait() instead.
   */
  setLandscapeAllowed(allowed: boolean): void {
    if (Platform.OS !== 'ios' || !OrientationModule) {
      return;
    }

    OrientationModule.setLandscapeAllowed(allowed);
    this.isUnlocked = allowed;
  }

  /**
   * Check if landscape is currently allowed.
   */
  async isLandscapeAllowed(): Promise<boolean> {
    if (Platform.OS !== 'ios' || !OrientationModule) {
      return false;
    }

    return OrientationModule.isLandscapeAllowedAsync();
  }

  /**
   * Check if the orientation is currently unlocked (for video).
   * Synchronous version using cached state.
   */
  isUnlockedSync(): boolean {
    return this.isUnlocked;
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const orientationService = new OrientationServiceImpl();
