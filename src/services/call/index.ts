/**
 * Call Service — WebRTC P2P Video/Voice Calling
 *
 * Main implementation of CallService interface.
 * Coordinates WebRTC, signaling, and mesh management.
 *
 * Features:
 * - 1-on-1 P2P calls (voice and video)
 * - 3-way mesh calls (max 3 participants)
 * - XMPP signaling for SDP/ICE exchange
 * - On-device media processing (privacy-first)
 *
 * @see interfaces.ts for CallService interface
 */

import uuid from 'react-native-uuid';
import type { MediaStream, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';

import type {
  CallService,
  CallType,
  ActiveCall,
  CallEndReason,
  CallParticipant,
  IceServer,
  Observable,
  Unsubscribe,
} from '../interfaces';

import { webrtcService, WebRTCService } from './webrtcService';
import { signalingService, CallSignalingService, type XMPPSignaling } from './signalingService';
import { MeshManager } from './meshManager';
import {
  CALL_TIMEOUTS,
  CALL_LIMITS,
  type CallOfferPayload,
  type CallAnswerPayload,
  type IceCandidatePayload,
  type CallControlPayload,
  type CallInvitePayload,
  type InternalCallState,
} from './types';
import { callSoundService, type CallSoundSettings } from './callSoundService';
import { callKitService } from './callKitService';

// ============================================================
// Helper Functions
// ============================================================

/**
 * Normalize JID by removing the resource suffix
 * e.g., "user@domain/resource" -> "user@domain"
 *
 * This is necessary because XMPP messages arrive with full JID (including resource),
 * but we store participants by their bare JID.
 */
function normalizeJid(jid: string): string {
  const slashIndex = jid.indexOf('/');
  return slashIndex > 0 ? jid.substring(0, slashIndex) : jid;
}

// ============================================================
// WebRTC Call Service Implementation
// ============================================================

export class WebRTCCallService implements CallService {
  private webrtc: WebRTCService = webrtcService;
  private signaling: CallSignalingService = signalingService;
  private mesh: MeshManager;

  private localJid: string = '';
  private currentCall: InternalCallState | null = null;

  // Observers
  private stateObservers: Set<(call: ActiveCall | null) => void> = new Set();
  private incomingCallHandlers: Set<(call: ActiveCall) => void> = new Set();
  private callEndedHandlers: Set<(callId: string, reason: CallEndReason) => void> = new Set();

  // Contact name lookup (set by CallContext)
  public getContactName: ((jid: string) => string) | null = null;

  constructor() {
    this.mesh = new MeshManager(this.webrtc);
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  async initialize(iceServers: IceServer[]): Promise<void> {
    this.webrtc.initialize(iceServers);

    // Set up signaling handlers
    this.signaling.setHandlers({
      onCallOffer: this.handleIncomingOffer.bind(this),
      onCallAnswer: this.handleAnswer.bind(this),
      onIceCandidate: this.handleRemoteIceCandidate.bind(this),
      onCallControl: this.handleCallControl.bind(this),
      onCallInvite: this.handleCallInvite.bind(this),
    });

    // Set up CallKit for native iOS call UI
    try {
      await callKitService.setup();
      callKitService.setHandlers({
        onAnswerCall: (callUUID) => {
          const callId = callKitService.getCallId(callUUID);
          if (callId) {
            void this.answerCall(callId);
          }
        },
        onEndCall: (callUUID) => {
          const callId = callKitService.getCallId(callUUID);
          if (callId) {
            void this.endCall(callId);
          }
        },
        onMuteCall: (_callUUID, muted) => {
          if (this.currentCall && this.currentCall.localMedia.isMuted !== muted) {
            this.toggleMute();
          }
        },
        onDTMF: (_callUUID, _digits) => {
          // DTMF not used in CommEazy
        },
        onAudioSessionActivated: () => {
          console.info('[CallService] CallKit audio session activated');
        },
      });
    } catch (error) {
      console.warn('[CallService] CallKit setup failed, continuing without native UI:', error);
    }

    console.info('[CallService] Initialized');
  }

  /**
   * Initialize with XMPP service and local JID
   * Called after XMPPService is connected
   */
  initializeWithXMPP(xmpp: XMPPSignaling, localJid: string): void {
    this.localJid = localJid;
    this.signaling.initialize(xmpp);
    console.info('[CallService] Connected to XMPP as:', localJid);
  }

  async cleanup(): Promise<void> {
    // End any active call
    if (this.currentCall) {
      await this.endCall(this.currentCall.id);
    }

    this.mesh.cleanup();
    this.webrtc.cleanup();
    this.signaling.cleanup();

    this.stateObservers.clear();
    this.incomingCallHandlers.clear();
    this.callEndedHandlers.clear();

    console.info('[CallService] Cleaned up');
  }

  // ============================================================
  // Call Management
  // ============================================================

  async initiateCall(contactJid: string, type: CallType): Promise<string> {
    if (this.currentCall) {
      throw new Error('[CallService] Already in a call');
    }

    const callId = uuid.v4() as string;
    console.info('[CallService] Initiating', type, 'call to:', contactJid, 'id:', callId);

    // Start local media
    await this.webrtc.startLocalMedia(type);

    // Initialize mesh
    this.mesh.initialize(this.localJid, type, {
      onIceCandidate: (jid, candidate) => {
        void this.signaling.sendIceCandidate(jid, callId, candidate);
      },
      onParticipantConnectionStateChange: (jid, state) => {
        this.handleConnectionStateChange(jid, state);
      },
      onParticipantStreamReady: (jid, stream) => {
        this.notifyStateChange();
      },
    });

    // Add remote participant
    const participantName = this.getContactName?.(contactJid) || contactJid;
    const peerState = this.mesh.addParticipant(contactJid, participantName);

    // Create internal call state
    this.currentCall = {
      id: callId,
      type,
      direction: 'outgoing',
      state: 'ringing',
      participants: new Map([[contactJid, {
        jid: contactJid,
        name: participantName,
        isMuted: false,
        isVideoEnabled: type === 'video',
        connectionState: 'connecting',
      }]]),
      peerConnections: new Map([[contactJid, peerState]]),
      localMedia: this.webrtc.getLocalMediaState(),
      isSpeakerOn: type === 'video', // Video calls default to speaker
    };

    // Create and send offer
    const offer = await this.mesh.createOffer(contactJid);
    await this.signaling.sendOffer(contactJid, callId, type, offer);

    // Start ring timeout
    this.startRingTimeout();

    // Report outgoing call to CallKit for native UI
    callKitService.startOutgoingCall(
      callId,
      contactJid,
      participantName,
      type === 'video'
    );

    // Note: Dial tone starts when we receive 'ringing' acknowledgment from remote
    // See handleCallControl case 'ringing'

    this.notifyStateChange();
    return callId;
  }

  /**
   * Update call sound settings from user profile
   */
  updateSoundSettings(settings: Partial<CallSoundSettings>): void {
    callSoundService.updateSettings(settings);
  }

  async answerCall(callId: string): Promise<void> {
    if (!this.currentCall || this.currentCall.id !== callId) {
      throw new Error('[CallService] No incoming call to answer');
    }

    if (this.currentCall.direction !== 'incoming') {
      throw new Error('[CallService] Cannot answer outgoing call');
    }

    if (!this.currentCall.pendingOfferSdp) {
      throw new Error('[CallService] No pending offer SDP');
    }

    console.info('[CallService] Answering call:', callId);

    // Stop ringtone when answering
    callSoundService.onIncomingCallEnded();

    // Clear ring timeout
    this.clearRingTimeout();

    // Get the caller JID (first participant)
    const callerJid = Array.from(this.currentCall.participants.keys())[0];

    // CORRECT ORDER for WebRTC answer flow:
    // 1. Start local media first
    console.info('[CallService] Step 1: Starting local media');
    await this.webrtc.startLocalMedia(this.currentCall.type);
    this.currentCall.localMedia = this.webrtc.getLocalMediaState();

    // 2. Add local tracks to the PeerConnection BEFORE setting remote description
    // This ensures the tracks are available when creating the answer
    console.info('[CallService] Step 2: Adding local tracks to PeerConnection');
    this.mesh.addLocalTracksToAllConnections();

    // 3. Set the remote description (the offer)
    console.info('[CallService] Step 3: Setting remote description');
    await this.mesh.setRemoteDescription(callerJid, this.currentCall.pendingOfferSdp);

    // 4. Create and send answer
    console.info('[CallService] Step 4: Creating and sending answer');
    const answer = await this.mesh.createAnswer(callerJid);
    await this.signaling.sendAnswer(callerJid, callId, answer);

    // Clean up pending SDP
    delete this.currentCall.pendingOfferSdp;

    // Update state
    this.currentCall.state = 'connecting';
    this.notifyStateChange();
  }

  async declineCall(callId: string): Promise<void> {
    if (!this.currentCall || this.currentCall.id !== callId) {
      console.warn('[CallService] No call to decline:', callId);
      return;
    }

    console.info('[CallService] Declining call:', callId);

    // Stop ringtone when declining
    callSoundService.onIncomingCallEnded();

    // Clear ring timeout
    this.clearRingTimeout();

    // Send decline to all participants
    const participants = this.mesh.getParticipantJids();
    await Promise.all(
      participants.map((jid) => this.signaling.sendControl(jid, callId, 'decline'))
    );

    // Clean up
    this.endCallInternal('declined');
  }

  async endCall(callId: string): Promise<void> {
    if (!this.currentCall || this.currentCall.id !== callId) {
      console.warn('[CallService] No call to end:', callId);
      return;
    }

    console.info('[CallService] Ending call:', callId);

    // Clear timers
    this.clearRingTimeout();
    this.clearDurationInterval();

    // Send hangup to all participants
    const participants = this.mesh.getParticipantJids();
    await Promise.all(
      participants.map((jid) => this.signaling.sendControl(jid, callId, 'hangup'))
    );

    // Clean up
    this.endCallInternal('hangup');
  }

  // ============================================================
  // 3-Way Mesh Calls
  // ============================================================

  async addParticipant(callId: string, contactJid: string): Promise<void> {
    if (!this.currentCall || this.currentCall.id !== callId) {
      throw new Error('[CallService] No active call');
    }

    if (!this.canAddParticipant(callId)) {
      throw new Error('[CallService] Max participants reached');
    }

    console.info('[CallService] Adding participant:', contactJid, 'to call:', callId);

    const participantName = this.getContactName?.(contactJid) || contactJid;

    // Add to mesh (creates PeerConnection)
    const peerState = this.mesh.addParticipant(contactJid, participantName);

    // Update internal state
    this.currentCall.participants.set(contactJid, {
      jid: contactJid,
      name: participantName,
      isMuted: false,
      isVideoEnabled: this.currentCall.type === 'video',
      connectionState: 'connecting',
    });
    this.currentCall.peerConnections.set(contactJid, peerState);

    // Create offer and send invite
    const offer = await this.mesh.createOffer(contactJid);
    const existingParticipants = this.mesh.getParticipantJids().filter((jid) => jid !== contactJid);

    await this.signaling.sendInvite(
      contactJid,
      callId,
      this.currentCall.type,
      existingParticipants,
      offer
    );

    this.notifyStateChange();
  }

  async removeParticipant(callId: string, contactJid: string): Promise<void> {
    if (!this.currentCall || this.currentCall.id !== callId) {
      throw new Error('[CallService] No active call');
    }

    console.info('[CallService] Removing participant:', contactJid, 'from call:', callId);

    // Send hangup to the specific participant
    await this.signaling.sendControl(contactJid, callId, 'hangup');

    // Remove from mesh
    this.mesh.removeParticipant(contactJid);
    this.currentCall.participants.delete(contactJid);
    this.currentCall.peerConnections.delete(contactJid);

    // If only self left, end the call
    if (this.currentCall.participants.size === 0) {
      this.endCallInternal('hangup');
      return;
    }

    this.notifyStateChange();
  }

  canAddParticipant(callId: string): boolean {
    if (!this.currentCall || this.currentCall.id !== callId) {
      return false;
    }
    return this.mesh.canAddParticipant();
  }

  // ============================================================
  // Local Controls
  // ============================================================

  toggleMute(): void {
    const isMuted = this.webrtc.toggleMute();
    if (this.currentCall) {
      this.currentCall.localMedia.isMuted = isMuted;
      // Sync mute state with CallKit
      callKitService.setMuted(this.currentCall.id, isMuted);
      this.notifyStateChange();
    }
  }

  toggleSpeaker(): void {
    if (this.currentCall) {
      this.currentCall.isSpeakerOn = !this.currentCall.isSpeakerOn;
      void this.webrtc.setSpeakerMode(this.currentCall.isSpeakerOn);
      this.notifyStateChange();
    }
  }

  toggleVideo(): void {
    const isVideoEnabled = this.webrtc.toggleVideo();
    if (this.currentCall) {
      this.currentCall.localMedia.isVideoEnabled = isVideoEnabled;
      this.notifyStateChange();
    }
  }

  switchCamera(): void {
    void this.webrtc.switchCamera().then((isFrontCamera) => {
      if (this.currentCall) {
        this.currentCall.localMedia.isFrontCamera = isFrontCamera;
        this.notifyStateChange();
      }
    });
  }

  // ============================================================
  // State & Observables
  // ============================================================

  getActiveCall(): ActiveCall | null {
    if (!this.currentCall) {
      return null;
    }
    return this.toActiveCall(this.currentCall);
  }

  observeCallState(): Observable<ActiveCall | null> {
    return {
      subscribe: (observer) => {
        this.stateObservers.add(observer);
        // Emit current state immediately
        observer(this.getActiveCall());

        return () => {
          this.stateObservers.delete(observer);
        };
      },
    };
  }

  onIncomingCall(handler: (call: ActiveCall) => void): Unsubscribe {
    this.incomingCallHandlers.add(handler);
    return () => {
      this.incomingCallHandlers.delete(handler);
    };
  }

  onCallEnded(handler: (callId: string, reason: CallEndReason) => void): Unsubscribe {
    this.callEndedHandlers.add(handler);
    return () => {
      this.callEndedHandlers.delete(handler);
    };
  }

  // ============================================================
  // Stream Access (for UI)
  // ============================================================

  /**
   * Get local media stream for UI preview
   */
  getLocalStream(): MediaStream | null {
    return this.webrtc.getLocalStream();
  }

  /**
   * Get all remote streams mapped by JID
   */
  getRemoteStreams(): Map<string, MediaStream> {
    return this.mesh.getRemoteStreams();
  }

  // ============================================================
  // Signaling Handlers
  // ============================================================

  private handleIncomingOffer(from: string, payload: CallOfferPayload): void {
    if (this.currentCall) {
      // Already in a call, send busy
      console.info('[CallService] Busy, declining offer from:', from);
      void this.signaling.sendControl(from, payload.callId, 'busy');
      return;
    }

    console.info('[CallService] Incoming', payload.callType, 'call from:', from);

    const participantName = this.getContactName?.(from) || from;

    // Initialize mesh for incoming call
    this.mesh.initialize(this.localJid, payload.callType, {
      onIceCandidate: (jid, candidate) => {
        void this.signaling.sendIceCandidate(jid, payload.callId, candidate);
      },
      onParticipantConnectionStateChange: (jid, state) => {
        this.handleConnectionStateChange(jid, state);
      },
      onParticipantStreamReady: (jid, stream) => {
        this.notifyStateChange();
      },
    });

    // Add caller as participant
    const peerState = this.mesh.addParticipant(from, participantName);

    // Parse the SDP - we'll set it when answering
    // DON'T set remote description here - we need to add local tracks first when answering
    const sdp = CallSignalingService.parseSdp(payload.sdp);

    // Create internal call state
    this.currentCall = {
      id: payload.callId,
      type: payload.callType,
      direction: 'incoming',
      state: 'ringing',
      participants: new Map([[from, {
        jid: from,
        name: participantName,
        isMuted: false,
        isVideoEnabled: payload.callType === 'video',
        connectionState: 'connecting',
      }]]),
      peerConnections: new Map([[from, peerState]]),
      localMedia: {
        stream: null,
        audioTrack: null,
        videoTrack: null,
        isMuted: false,
        isVideoEnabled: payload.callType === 'video',
        isFrontCamera: true,
      },
      isSpeakerOn: payload.callType === 'video',
      // Store the pending offer SDP for when we answer
      pendingOfferSdp: sdp,
    };

    // Send ringing acknowledgment
    void this.signaling.sendControl(from, payload.callId, 'ringing');

    // Display native iOS call UI via CallKit
    // This shows the incoming call on lockscreen!
    callKitService.displayIncomingCall(
      payload.callId,
      from,
      participantName,
      payload.callType === 'video'
    );

    // Start ringtone for incoming call (CallKit also plays its own)
    callSoundService.onIncomingCallRinging();

    // Start ring timeout
    this.startRingTimeout();

    // Notify incoming call handlers
    const activeCall = this.toActiveCall(this.currentCall);
    this.incomingCallHandlers.forEach((handler) => handler(activeCall));
    this.notifyStateChange();
  }

  private handleAnswer(from: string, payload: CallAnswerPayload): void {
    if (!this.currentCall || this.currentCall.id !== payload.callId) {
      console.warn('[CallService] Received answer for unknown call:', payload.callId);
      return;
    }

    // Normalize JID (strip resource suffix)
    // XMPP sends full JID like "user@domain/resource" but we store bare JID "user@domain"
    const bareJid = normalizeJid(from);
    console.info('[CallService] Received answer from:', from, '(normalized:', bareJid + ')');

    // Clear ring timeout
    this.clearRingTimeout();

    // Set remote description (the answer)
    const sdp = CallSignalingService.parseSdp(payload.sdp);
    void this.mesh.setRemoteDescription(bareJid, sdp);

    // Update state
    this.currentCall.state = 'connecting';
    this.notifyStateChange();
  }

  private handleRemoteIceCandidate(from: string, payload: IceCandidatePayload): void {
    if (!this.currentCall || this.currentCall.id !== payload.callId) {
      console.warn('[CallService] Received ICE for unknown call:', payload.callId);
      return;
    }

    // Normalize JID (strip resource suffix)
    const bareJid = normalizeJid(from);
    const candidate = CallSignalingService.parseIceCandidate(payload.candidate);
    void this.mesh.addIceCandidate(bareJid, candidate);
  }

  private handleCallControl(from: string, payload: CallControlPayload): void {
    if (!this.currentCall || this.currentCall.id !== payload.callId) {
      console.warn('[CallService] Received control for unknown call:', payload.callId);
      return;
    }

    console.info('[CallService] Received control:', payload.type, 'from:', from);

    switch (payload.type) {
      case 'hangup':
        this.handleRemoteHangup(from);
        break;
      case 'decline':
        this.handleRemoteDecline(from);
        break;
      case 'busy':
        this.endCallInternal('busy');
        break;
      case 'ringing':
        // Remote is ringing, start dial tone for caller
        if (this.currentCall.direction === 'outgoing') {
          callSoundService.onOutgoingCallRinging();
        }
        break;
    }
  }

  private handleCallInvite(from: string, payload: CallInvitePayload): void {
    // Handle being invited to a 3-way call
    if (this.currentCall) {
      // Already in a call, send busy
      console.info('[CallService] Busy, declining invite from:', from);
      void this.signaling.sendControl(from, payload.callId, 'busy');
      return;
    }

    // Treat invite like an offer, but note the existing participants
    console.info('[CallService] Invited to 3-way call by:', from, 'with:', payload.existingParticipants);

    // For now, handle like a regular incoming call
    // In a full implementation, we'd also need to connect to existing participants
    this.handleIncomingOffer(from, {
      type: 'offer',
      callId: payload.callId,
      callType: payload.callType,
      sdp: payload.sdp,
      participants: [from, ...payload.existingParticipants],
    });
  }

  private handleRemoteHangup(from: string): void {
    if (!this.currentCall) return;

    // Remove the participant who hung up
    this.mesh.removeParticipant(from);
    this.currentCall.participants.delete(from);
    this.currentCall.peerConnections.delete(from);

    // If no participants left, end the call
    if (this.currentCall.participants.size === 0) {
      this.endCallInternal('hangup');
      return;
    }

    this.notifyStateChange();
  }

  private handleRemoteDecline(from: string): void {
    if (!this.currentCall) return;

    // If this is a 1-on-1 call, end it
    if (this.currentCall.participants.size === 1) {
      this.endCallInternal('declined');
      return;
    }

    // Otherwise, just remove this participant
    this.handleRemoteHangup(from);
  }

  // ============================================================
  // Connection State Handling
  // ============================================================

  private handleConnectionStateChange(jid: string, state: string): void {
    if (!this.currentCall) return;

    console.info('[CallService] Connection state for', jid, ':', state);

    switch (state) {
      case 'connected':
      case 'completed':
        // At least one connection is up
        if (this.currentCall.state === 'connecting' || this.currentCall.state === 'reconnecting') {
          this.currentCall.state = 'connected';
          this.currentCall.startTime = Date.now();
          this.startDurationInterval();

          // Stop dial tone when call connects
          if (this.currentCall.direction === 'outgoing') {
            callSoundService.onOutgoingCallEnded();
            // Report to CallKit that outgoing call is now connected
            callKitService.reportOutgoingCallConnected(this.currentCall.id);
          }
        }
        break;

      case 'disconnected':
        // Temporary disconnection, try to recover
        if (this.currentCall.state === 'connected') {
          this.currentCall.state = 'reconnecting';
        }
        break;

      case 'failed':
        // Connection failed, check if all connections failed
        if (this.mesh.getAllParticipants().every((p) => p.connectionState === 'disconnected')) {
          this.endCallInternal('failed');
        }
        break;

      case 'closed':
        // Connection closed, participant may have left
        break;
    }

    this.notifyStateChange();
  }

  // ============================================================
  // Internal Helpers
  // ============================================================

  private endCallInternal(reason: CallEndReason): void {
    if (!this.currentCall) return;

    const callId = this.currentCall.id;
    console.info('[CallService] Call ended:', callId, 'reason:', reason);

    // Stop all call sounds
    callSoundService.stopAll();

    // Clear timers
    this.clearRingTimeout();
    this.clearDurationInterval();

    // Report to CallKit
    callKitService.endCall(callId);

    // Clean up mesh and media
    this.mesh.cleanup();
    this.webrtc.stopLocalMedia();

    // Notify handlers
    this.callEndedHandlers.forEach((handler) => handler(callId, reason));

    // Clear call state
    this.currentCall = null;
    this.notifyStateChange();
  }

  private notifyStateChange(): void {
    const activeCall = this.getActiveCall();
    this.stateObservers.forEach((observer) => observer(activeCall));
  }

  private toActiveCall(internal: InternalCallState): ActiveCall {
    return {
      id: internal.id,
      type: internal.type,
      direction: internal.direction,
      state: internal.state,
      participants: this.mesh.toCallParticipants(),
      startTime: internal.startTime,
      duration: this.calculateDuration(internal),
      isMuted: internal.localMedia.isMuted,
      isSpeakerOn: internal.isSpeakerOn,
      isVideoEnabled: internal.localMedia.isVideoEnabled,
      isFrontCamera: internal.localMedia.isFrontCamera,
    };
  }

  private calculateDuration(internal: InternalCallState): number {
    if (!internal.startTime) return 0;
    return Math.floor((Date.now() - internal.startTime) / 1000);
  }

  // ============================================================
  // Timers
  // ============================================================

  private startRingTimeout(): void {
    if (this.currentCall) {
      this.currentCall.ringTimeout = setTimeout(() => {
        console.info('[CallService] Ring timeout');
        this.endCallInternal('timeout');
      }, CALL_TIMEOUTS.RING_TIMEOUT_MS);
    }
  }

  private clearRingTimeout(): void {
    if (this.currentCall?.ringTimeout) {
      clearTimeout(this.currentCall.ringTimeout);
      this.currentCall.ringTimeout = undefined;
    }
  }

  private startDurationInterval(): void {
    if (this.currentCall) {
      this.currentCall.durationInterval = setInterval(() => {
        this.notifyStateChange();
      }, 1000);
    }
  }

  private clearDurationInterval(): void {
    if (this.currentCall?.durationInterval) {
      clearInterval(this.currentCall.durationInterval);
      this.currentCall.durationInterval = undefined;
    }
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const callService = new WebRTCCallService();

// Re-export types and services
export { webrtcService } from './webrtcService';
export { signalingService } from './signalingService';
export { MeshManager } from './meshManager';
export { callSoundService, DEFAULT_CALL_SOUND_SETTINGS } from './callSoundService';
export type { CallSoundSettings, RingtoneSound } from './callSoundService';
export { callKitService } from './callKitService';
export * from './types';
