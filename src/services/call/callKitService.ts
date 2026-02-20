/**
 * CallKit Service — Native iOS Call UI Integration
 *
 * Integrates with iOS CallKit framework via react-native-callkeep.
 * Provides native call UI on lockscreen, "Do Not Disturb" bypass,
 * and integration with iOS Phone app recents.
 *
 * Features:
 * - Native incoming call UI (lockscreen, banner)
 * - Answer/decline from lockscreen
 * - Call history in iOS Phone app
 * - Siri integration ("Call Oma via CommEazy")
 * - Audio routing (speaker, bluetooth, AirPods)
 *
 * @see https://github.com/react-native-webrtc/react-native-callkeep
 */

import { Platform, AppState, type AppStateStatus } from 'react-native';
import RNCallKeep, { type IOptions } from 'react-native-callkeep';
import uuid from 'react-native-uuid';

import type { CallType } from '../interfaces';

// ============================================================
// Types
// ============================================================

export interface CallKitCallInfo {
  uuid: string;
  handle: string;        // Contact JID or phone-like identifier
  callerName: string;    // Display name
  hasVideo: boolean;
  callId: string;        // Our internal call ID
}

export interface CallKitHandlers {
  onAnswerCall: (callUUID: string) => void;
  onEndCall: (callUUID: string) => void;
  onMuteCall: (callUUID: string, muted: boolean) => void;
  onDTMF: (callUUID: string, digits: string) => void;
  onAudioSessionActivated: () => void;
}

// ============================================================
// CallKit Service
// ============================================================

class CallKitService {
  private isSetup = false;
  private activeCalls: Map<string, CallKitCallInfo> = new Map();
  private handlers: CallKitHandlers | null = null;
  private appState: AppStateStatus = 'active';

  // Map our callId to CallKit UUID
  private callIdToUuid: Map<string, string> = new Map();

  /**
   * Initialize CallKit with app configuration
   * Must be called early in app lifecycle (before any calls)
   */
  async setup(): Promise<void> {
    if (Platform.OS !== 'ios') {
      console.info('[CallKit] Skipping setup — not iOS');
      return;
    }

    if (this.isSetup) {
      console.info('[CallKit] Already set up');
      return;
    }

    const options: IOptions = {
      ios: {
        appName: 'CommEazy',
        // Use generic handle type for JID-based calls
        handleType: 'generic',
        // Support video calls
        supportsVideo: true,
        // Maximum calls in a group (we support 3-way)
        maximumCallGroups: 1,
        maximumCallsPerCallGroup: 3,
        // Ring sound (use default iOS ringtone)
        // Custom ringtone: 'ringtone.wav' in app bundle
        includesCallsInRecents: true,
        // Image to show in call UI (optional)
        // imageName: 'AppIcon',
      },
      android: {
        // Android ConnectionService config (for future)
        alertTitle: 'Oproep toestaan',
        alertDescription: 'CommEazy heeft toestemming nodig om oproepen te beheren',
        cancelButton: 'Annuleren',
        okButton: 'Toestaan',
        additionalPermissions: [],
        selfManaged: true,
      },
    };

    try {
      await RNCallKeep.setup(options);
      this.setupEventListeners();
      this.setupAppStateListener();
      this.isSetup = true;
      console.info('[CallKit] Setup complete');
    } catch (error) {
      console.error('[CallKit] Setup failed:', error);
      throw error;
    }
  }

  /**
   * Set handlers for CallKit events
   * These connect CallKit actions to our CallService
   */
  setHandlers(handlers: CallKitHandlers): void {
    this.handlers = handlers;
  }

  // ============================================================
  // Outgoing Calls
  // ============================================================

  /**
   * Report an outgoing call to CallKit
   * Call this when initiating a call
   */
  startOutgoingCall(
    callId: string,
    handle: string,
    callerName: string,
    hasVideo: boolean
  ): string {
    if (Platform.OS !== 'ios' || !this.isSetup) {
      return callId;
    }

    const callUUID = uuid.v4() as string;

    // Store mapping
    this.callIdToUuid.set(callId, callUUID);
    this.activeCalls.set(callUUID, {
      uuid: callUUID,
      handle,
      callerName,
      hasVideo,
      callId,
    });

    // Report to CallKit
    RNCallKeep.startCall(callUUID, handle, callerName, 'generic', hasVideo);

    console.info('[CallKit] Started outgoing call:', callUUID);
    return callUUID;
  }

  /**
   * Report that outgoing call is connecting (ringing on remote)
   */
  reportOutgoingCallConnecting(callId: string): void {
    const callUUID = this.callIdToUuid.get(callId);
    if (!callUUID || Platform.OS !== 'ios') return;

    // No direct API for "connecting" — CallKit handles this automatically
    console.info('[CallKit] Outgoing call connecting:', callUUID);
  }

  /**
   * Report that outgoing call is connected (answered by remote)
   */
  reportOutgoingCallConnected(callId: string): void {
    const callUUID = this.callIdToUuid.get(callId);
    if (!callUUID || Platform.OS !== 'ios') return;

    RNCallKeep.reportConnectedOutgoingCallWithUUID(callUUID);
    console.info('[CallKit] Outgoing call connected:', callUUID);
  }

  // ============================================================
  // Incoming Calls
  // ============================================================

  /**
   * Display incoming call UI
   * This triggers the native iOS call screen (works on lockscreen!)
   */
  displayIncomingCall(
    callId: string,
    handle: string,
    callerName: string,
    hasVideo: boolean
  ): string {
    if (Platform.OS !== 'ios' || !this.isSetup) {
      return callId;
    }

    const callUUID = uuid.v4() as string;

    // Store mapping
    this.callIdToUuid.set(callId, callUUID);
    this.activeCalls.set(callUUID, {
      uuid: callUUID,
      handle,
      callerName,
      hasVideo,
      callId,
    });

    // Display native incoming call UI
    RNCallKeep.displayIncomingCall(
      callUUID,
      handle,
      callerName,
      'generic',
      hasVideo
    );

    console.info('[CallKit] Displaying incoming call:', callUUID, 'from:', callerName);
    return callUUID;
  }

  /**
   * Report that incoming call was answered (from our app UI)
   * Use this when user answers via in-app button (not CallKit UI)
   */
  reportCallAnswered(callId: string): void {
    const callUUID = this.callIdToUuid.get(callId);
    if (!callUUID || Platform.OS !== 'ios') return;

    RNCallKeep.answerIncomingCall(callUUID);
    console.info('[CallKit] Reported call answered:', callUUID);
  }

  // ============================================================
  // Call State Updates
  // ============================================================

  /**
   * Report that call has ended
   */
  endCall(callId: string): void {
    const callUUID = this.callIdToUuid.get(callId);
    if (!callUUID || Platform.OS !== 'ios') return;

    RNCallKeep.endCall(callUUID);
    this.removeCall(callUUID);
    console.info('[CallKit] Ended call:', callUUID);
  }

  /**
   * Report all calls ended (cleanup)
   */
  endAllCalls(): void {
    if (Platform.OS !== 'ios') return;

    RNCallKeep.endAllCalls();
    this.activeCalls.clear();
    this.callIdToUuid.clear();
    console.info('[CallKit] Ended all calls');
  }

  /**
   * Update call mute state
   */
  setMuted(callId: string, muted: boolean): void {
    const callUUID = this.callIdToUuid.get(callId);
    if (!callUUID || Platform.OS !== 'ios') return;

    RNCallKeep.setMutedCall(callUUID, muted);
  }

  /**
   * Update call on hold state
   */
  setOnHold(callId: string, onHold: boolean): void {
    const callUUID = this.callIdToUuid.get(callId);
    if (!callUUID || Platform.OS !== 'ios') return;

    RNCallKeep.setOnHold(callUUID, onHold);
  }

  /**
   * Update caller name (e.g., after contact lookup)
   */
  updateCallerName(callId: string, callerName: string): void {
    const callUUID = this.callIdToUuid.get(callId);
    if (!callUUID || Platform.OS !== 'ios') return;

    RNCallKeep.updateDisplay(callUUID, callerName, callUUID);
  }

  // ============================================================
  // Audio Routing
  // ============================================================

  /**
   * Check if audio route is available
   */
  async checkAudioRoute(): Promise<void> {
    if (Platform.OS !== 'ios') return;

    // CallKeep handles audio routing automatically via CXProvider
    // This method can be used to manually check/set routes if needed
  }

  /**
   * Set audio mode for active call
   */
  setAudioMode(speaker: boolean): void {
    if (Platform.OS !== 'ios') return;

    // Audio routing is handled by WebRTC's setSpeakerMode
    // CallKit automatically manages audio session activation
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Get CallKit UUID for our call ID
   */
  getCallUUID(callId: string): string | undefined {
    return this.callIdToUuid.get(callId);
  }

  /**
   * Get our call ID from CallKit UUID
   */
  getCallId(callUUID: string): string | undefined {
    return this.activeCalls.get(callUUID)?.callId;
  }

  /**
   * Check if CallKit is available and set up
   */
  isAvailable(): boolean {
    return Platform.OS === 'ios' && this.isSetup;
  }

  /**
   * Get number of active calls
   */
  getActiveCallCount(): number {
    return this.activeCalls.size;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private setupEventListeners(): void {
    // User answered call via CallKit UI
    RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
      console.info('[CallKit] Answer call event:', callUUID);
      this.handlers?.onAnswerCall(callUUID);
    });

    // User ended call via CallKit UI
    RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
      console.info('[CallKit] End call event:', callUUID);
      this.handlers?.onEndCall(callUUID);
      this.removeCall(callUUID);
    });

    // User toggled mute via CallKit UI
    RNCallKeep.addEventListener('didPerformSetMutedCallAction', ({ callUUID, muted }) => {
      console.info('[CallKit] Mute call event:', callUUID, 'muted:', muted);
      this.handlers?.onMuteCall(callUUID, muted);
    });

    // User pressed DTMF digit
    RNCallKeep.addEventListener('didPerformDTMFAction', ({ callUUID, digits }) => {
      console.info('[CallKit] DTMF event:', callUUID, 'digits:', digits);
      this.handlers?.onDTMF(callUUID, digits);
    });

    // Audio session activated by iOS
    RNCallKeep.addEventListener('didActivateAudioSession', () => {
      console.info('[CallKit] Audio session activated');
      this.handlers?.onAudioSessionActivated();
    });

    // Call started from native (e.g., Siri, Recents)
    RNCallKeep.addEventListener('didReceiveStartCallAction', ({ callUUID, handle, name }) => {
      console.info('[CallKit] Start call from native:', handle, name);
      // This would need to trigger our call initiation flow
      // For now, we don't support starting calls from outside the app
    });

    // Provider reset (rare, usually after crash)
    RNCallKeep.addEventListener('didLoadWithEvents', (events) => {
      console.info('[CallKit] Loaded with events:', events?.length || 0);
    });
  }

  private setupAppStateListener(): void {
    AppState.addEventListener('change', (nextAppState) => {
      this.appState = nextAppState;
    });
  }

  private removeCall(callUUID: string): void {
    const callInfo = this.activeCalls.get(callUUID);
    if (callInfo) {
      this.callIdToUuid.delete(callInfo.callId);
      this.activeCalls.delete(callUUID);
    }
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const callKitService = new CallKitService();
