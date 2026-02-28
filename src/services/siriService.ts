/**
 * SiriService — Handles Siri call intent integration
 *
 * This service:
 * 1. Listens for Siri call intents from SiriCallModule
 * 2. Resolves contact names to JIDs
 * 3. Initiates calls via the call service
 * 4. Donates call shortcuts to Siri for suggestions
 *
 * Usage:
 * - "Hey Siri, bel Oma met CommEazy"
 * - "Hey Siri, start een videogesprek met Jan via CommEazy"
 *
 * @see ios/CommEazyTemp/SiriCallModule.swift for native implementation
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// ============================================================
// Types
// ============================================================

export interface SiriCallIntent {
  /** The activity type that triggered the intent */
  activityType: string;
  /** The name of the contact to call (spoken by user) */
  contactName: string;
  /** The contact handle (phone number, email, or custom ID) */
  contactHandle: string;
  /** The type of call requested */
  callType: 'audio' | 'video';
  /** Custom identifier set by IntentHandler (format: "commeazy:contactId") */
  customIdentifier: string;
}

export type SiriAuthorizationStatus =
  | 'authorized'
  | 'denied'
  | 'restricted'
  | 'notDetermined'
  | 'unknown';

export interface SiriCallHandler {
  (intent: SiriCallIntent): void;
}

// ============================================================
// Native Module
// ============================================================

interface SiriCallModuleInterface {
  requestSiriAuthorization(): Promise<{ status: SiriAuthorizationStatus }>;
  getSiriAuthorizationStatus(): Promise<SiriAuthorizationStatus>;
  donateCallShortcut(
    contactName: string,
    contactId: string,
    callType: string
  ): Promise<{ success: boolean }>;
}

// Check if native module is available (iOS only)
const SiriCallModule: SiriCallModuleInterface | null =
  Platform.OS === 'ios' ? NativeModules.SiriCallModule : null;

// ============================================================
// Service Implementation
// ============================================================

class SiriService {
  private eventEmitter: NativeEventEmitter | null = null;
  private intentHandler: SiriCallHandler | null = null;
  private isListening = false;

  constructor() {
    if (SiriCallModule) {
      this.eventEmitter = new NativeEventEmitter(NativeModules.SiriCallModule);
    }
  }

  /**
   * Check if Siri integration is available on this device
   */
  isAvailable(): boolean {
    return Platform.OS === 'ios' && SiriCallModule !== null;
  }

  /**
   * Request Siri authorization from the user
   * This shows a system dialog asking for permission
   */
  async requestAuthorization(): Promise<SiriAuthorizationStatus> {
    if (!SiriCallModule) {
      console.warn('[SiriService] Not available on this platform');
      return 'notDetermined';
    }

    try {
      const result = await SiriCallModule.requestSiriAuthorization();
      console.info('[SiriService] Authorization status:', result.status);
      return result.status;
    } catch (error) {
      console.error('[SiriService] Failed to request authorization:', error);
      return 'unknown';
    }
  }

  /**
   * Get the current Siri authorization status
   */
  async getAuthorizationStatus(): Promise<SiriAuthorizationStatus> {
    if (!SiriCallModule) {
      return 'notDetermined';
    }

    try {
      return await SiriCallModule.getSiriAuthorizationStatus();
    } catch (error) {
      console.error('[SiriService] Failed to get authorization status:', error);
      return 'unknown';
    }
  }

  /**
   * Register a handler for Siri call intents
   * Only one handler can be registered at a time
   */
  setCallIntentHandler(handler: SiriCallHandler | null): void {
    this.intentHandler = handler;

    if (handler && !this.isListening) {
      this.startListening();
    } else if (!handler && this.isListening) {
      this.stopListening();
    }
  }

  /**
   * Donate a call shortcut to Siri
   * This helps Siri suggest "Call [contact] with CommEazy" to the user
   *
   * Call this after successfully completing a call to improve Siri suggestions
   */
  async donateCallShortcut(
    contactName: string,
    contactId: string,
    callType: 'audio' | 'video' = 'audio'
  ): Promise<boolean> {
    if (!SiriCallModule) {
      console.debug('[SiriService] Not available, skipping shortcut donation');
      return false;
    }

    try {
      const result = await SiriCallModule.donateCallShortcut(
        contactName,
        contactId,
        callType
      );
      console.info('[SiriService] Donated shortcut for', contactName);
      return result.success;
    } catch (error) {
      console.warn('[SiriService] Failed to donate shortcut:', error);
      return false;
    }
  }

  /**
   * Start listening for Siri call intent events
   */
  private startListening(): void {
    if (!this.eventEmitter || this.isListening) {
      return;
    }

    this.eventEmitter.addListener('onSiriCallIntent', this.handleCallIntent);
    this.isListening = true;
    console.info('[SiriService] Started listening for Siri call intents');
  }

  /**
   * Stop listening for Siri call intent events
   */
  private stopListening(): void {
    if (!this.eventEmitter || !this.isListening) {
      return;
    }

    this.eventEmitter.removeAllListeners('onSiriCallIntent');
    this.isListening = false;
    console.info('[SiriService] Stopped listening for Siri call intents');
  }

  /**
   * Handle an incoming Siri call intent
   */
  private handleCallIntent = (data: Record<string, unknown>): void => {
    console.info('[SiriService] Received call intent:', data);

    const intent: SiriCallIntent = {
      activityType: (data.activityType as string) || 'INStartCallIntent',
      contactName: (data.contactName as string) || 'Unknown',
      contactHandle: (data.contactHandle as string) || '',
      callType: data.callType === 'video' ? 'video' : 'audio',
      customIdentifier: (data.customIdentifier as string) || '',
    };

    if (this.intentHandler) {
      this.intentHandler(intent);
    } else {
      console.warn('[SiriService] No handler registered for call intent');
    }
  };

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopListening();
    this.intentHandler = null;
  }
}

// ============================================================
// Export Singleton
// ============================================================

export const siriService = new SiriService();
