/**
 * WebRTC Service
 *
 * Manages WebRTC PeerConnections for P2P video/voice calling.
 * Handles local media (camera/microphone), remote streams, and ICE negotiation.
 *
 * This service is used by CallService for both 1-on-1 and 3-way mesh calls.
 *
 * @see types.ts for type definitions
 * @see meshManager.ts for multi-participant mesh logic
 */

import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { Platform } from 'react-native';

import type { IceServer, CallType } from '../interfaces';
import {
  VOICE_MEDIA_CONSTRAINTS,
  VIDEO_MEDIA_CONSTRAINTS,
  PEER_CONNECTION_CONFIG,
  CALL_TIMEOUTS,
  type PeerConnectionState,
  type LocalMediaState,
  type MediaStreamTrack,
} from './types';

// ============================================================
// WebRTC Service
// ============================================================

export class WebRTCService {
  private iceServers: IceServer[] = [];
  private localMedia: LocalMediaState = {
    stream: null,
    audioTrack: null,
    videoTrack: null,
    isMuted: false,
    isVideoEnabled: true,
    isFrontCamera: true,
  };

  // Event handlers (set by CallService)
  public onIceCandidate: ((jid: string, candidate: RTCIceCandidate) => void) | null = null;
  public onRemoteStream: ((jid: string, stream: MediaStream) => void) | null = null;
  public onConnectionStateChange: ((jid: string, state: string) => void) | null = null;
  public onNegotiationNeeded: ((jid: string) => void) | null = null;

  // ============================================================
  // Initialization
  // ============================================================

  /**
   * Initialize WebRTC with ICE servers
   */
  initialize(iceServers: IceServer[]): void {
    this.iceServers = iceServers;
    console.info('[WebRTC] Initialized with', iceServers.length, 'ICE servers');
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    this.stopLocalMedia();
    this.iceServers = [];
    console.info('[WebRTC] Cleaned up');
  }

  // ============================================================
  // Local Media
  // ============================================================

  /**
   * Start local media capture (camera and/or microphone)
   */
  async startLocalMedia(callType: CallType): Promise<MediaStream> {
    try {
      const constraints = callType === 'video'
        ? VIDEO_MEDIA_CONSTRAINTS
        : VOICE_MEDIA_CONSTRAINTS;

      console.info('[WebRTC] Requesting local media:', callType);

      const stream = await mediaDevices.getUserMedia(constraints);

      // Extract tracks
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();

      this.localMedia = {
        stream,
        audioTrack: audioTracks[0] || null,
        videoTrack: videoTracks[0] || null,
        isMuted: false,
        isVideoEnabled: callType === 'video',
        isFrontCamera: true,
      };

      console.info('[WebRTC] Local media started:', {
        audio: audioTracks.length > 0,
        video: videoTracks.length > 0,
      });

      return stream;
    } catch (error) {
      console.error('[WebRTC] Failed to start local media:', error);
      throw error;
    }
  }

  /**
   * Stop local media capture
   */
  stopLocalMedia(): void {
    if (this.localMedia.stream) {
      this.localMedia.stream.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
      this.localMedia.stream = null;
      this.localMedia.audioTrack = null;
      this.localMedia.videoTrack = null;
      console.info('[WebRTC] Local media stopped');
    }
  }

  /**
   * Get the current local media stream
   */
  getLocalStream(): MediaStream | null {
    return this.localMedia.stream;
  }

  /**
   * Toggle local microphone mute
   */
  toggleMute(): boolean {
    if (this.localMedia.audioTrack) {
      this.localMedia.isMuted = !this.localMedia.isMuted;
      this.localMedia.audioTrack.enabled = !this.localMedia.isMuted;
      console.info('[WebRTC] Mute toggled:', this.localMedia.isMuted);
    }
    return this.localMedia.isMuted;
  }

  /**
   * Toggle local camera
   */
  toggleVideo(): boolean {
    if (this.localMedia.videoTrack) {
      this.localMedia.isVideoEnabled = !this.localMedia.isVideoEnabled;
      this.localMedia.videoTrack.enabled = this.localMedia.isVideoEnabled;
      console.info('[WebRTC] Video toggled:', this.localMedia.isVideoEnabled);
    }
    return this.localMedia.isVideoEnabled;
  }

  /**
   * Switch between front and back camera
   */
  async switchCamera(): Promise<boolean> {
    if (!this.localMedia.videoTrack || !this.localMedia.stream) {
      return this.localMedia.isFrontCamera;
    }

    try {
      // Stop current video track
      this.localMedia.videoTrack.stop();

      // Request new camera
      this.localMedia.isFrontCamera = !this.localMedia.isFrontCamera;
      const facingMode = this.localMedia.isFrontCamera ? 'user' : 'environment';

      const newStream = await mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        // Replace track in local stream
        this.localMedia.stream.removeTrack(this.localMedia.videoTrack);
        this.localMedia.stream.addTrack(newVideoTrack);
        this.localMedia.videoTrack = newVideoTrack;

        console.info('[WebRTC] Camera switched to:', facingMode);
      }
    } catch (error) {
      console.error('[WebRTC] Failed to switch camera:', error);
      // Revert
      this.localMedia.isFrontCamera = !this.localMedia.isFrontCamera;
    }

    return this.localMedia.isFrontCamera;
  }

  /**
   * Get local media state
   */
  getLocalMediaState(): LocalMediaState {
    return { ...this.localMedia };
  }

  // ============================================================
  // PeerConnection Management
  // ============================================================

  /**
   * Create a new PeerConnection for a remote participant
   */
  createPeerConnection(remoteJid: string): PeerConnectionState {
    const config = {
      iceServers: this.iceServers,
      ...PEER_CONNECTION_CONFIG,
    };

    console.info('[WebRTC] Creating PeerConnection for:', remoteJid);

    const connection = new RTCPeerConnection(config);

    // Add local tracks to the connection
    if (this.localMedia.stream) {
      this.localMedia.stream.getTracks().forEach((track: MediaStreamTrack) => {
        if (this.localMedia.stream) {
          connection.addTrack(track, this.localMedia.stream);
        }
      });
    }

    const state: PeerConnectionState = {
      jid: remoteJid,
      connection,
      remoteStream: null,
      iceCandidatesQueue: [],
      isNegotiating: false,
    };

    // Set up event handlers
    this.setupPeerConnectionHandlers(state);

    return state;
  }

  /**
   * Set up event handlers for a PeerConnection
   */
  private setupPeerConnectionHandlers(state: PeerConnectionState): void {
    const { connection, jid } = state;

    // ICE candidate event
    connection.onicecandidate = (event: { candidate: RTCIceCandidate | null }) => {
      if (event.candidate && this.onIceCandidate) {
        console.debug('[WebRTC] ICE candidate for', jid);
        this.onIceCandidate(jid, event.candidate);
      }
    };

    // Remote track event
    connection.ontrack = (event: { streams: MediaStream[] }) => {
      if (event.streams && event.streams[0]) {
        state.remoteStream = event.streams[0];
        if (this.onRemoteStream) {
          console.info('[WebRTC] Remote stream received from', jid);
          this.onRemoteStream(jid, event.streams[0]);
        }
      }
    };

    // Connection state change
    connection.onconnectionstatechange = () => {
      console.info('[WebRTC] Connection state for', jid, ':', connection.connectionState);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(jid, connection.connectionState);
      }
    };

    // ICE connection state change
    connection.oniceconnectionstatechange = () => {
      console.debug('[WebRTC] ICE connection state for', jid, ':', connection.iceConnectionState);
    };

    // Negotiation needed
    connection.onnegotiationneeded = () => {
      if (!state.isNegotiating && this.onNegotiationNeeded) {
        console.debug('[WebRTC] Negotiation needed for', jid);
        this.onNegotiationNeeded(jid);
      }
    };
  }

  /**
   * Close a PeerConnection
   */
  closePeerConnection(state: PeerConnectionState): void {
    if (state.connection) {
      state.connection.close();
      console.info('[WebRTC] Closed PeerConnection for:', state.jid);
    }
  }

  // ============================================================
  // SDP Negotiation
  // ============================================================

  /**
   * Create an SDP offer
   */
  async createOffer(state: PeerConnectionState, callType: CallType): Promise<RTCSessionDescription> {
    state.isNegotiating = true;

    try {
      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      };

      const offer = await state.connection.createOffer(offerOptions);
      await state.connection.setLocalDescription(offer);

      console.info('[WebRTC] Created offer for:', state.jid);
      return offer;
    } finally {
      state.isNegotiating = false;
    }
  }

  /**
   * Create an SDP answer
   */
  async createAnswer(state: PeerConnectionState): Promise<RTCSessionDescription> {
    state.isNegotiating = true;

    try {
      const answer = await state.connection.createAnswer();
      await state.connection.setLocalDescription(answer);

      console.info('[WebRTC] Created answer for:', state.jid);
      return answer;
    } finally {
      state.isNegotiating = false;
    }
  }

  /**
   * Set remote SDP description (offer or answer)
   */
  async setRemoteDescription(
    state: PeerConnectionState,
    sdp: RTCSessionDescription
  ): Promise<void> {
    console.info('[WebRTC] Setting remote description for:', state.jid, 'type:', sdp.type);

    await state.connection.setRemoteDescription(sdp);

    // Process queued ICE candidates
    while (state.iceCandidatesQueue.length > 0) {
      const candidate = state.iceCandidatesQueue.shift();
      if (candidate) {
        await state.connection.addIceCandidate(candidate);
      }
    }
  }

  /**
   * Add an ICE candidate
   */
  async addIceCandidate(state: PeerConnectionState, candidate: RTCIceCandidate): Promise<void> {
    // Queue if remote description not set yet
    if (!state.connection.remoteDescription) {
      console.debug('[WebRTC] Queuing ICE candidate for:', state.jid);
      state.iceCandidatesQueue.push(candidate);
      return;
    }

    try {
      await state.connection.addIceCandidate(candidate);
      console.debug('[WebRTC] Added ICE candidate for:', state.jid);
    } catch (error) {
      console.error('[WebRTC] Failed to add ICE candidate:', error);
    }
  }

  // ============================================================
  // Track Management (for mesh calls)
  // ============================================================

  /**
   * Replace local tracks in an existing PeerConnection
   * Used when switching cameras or adding/removing video
   */
  async replaceTrack(
    state: PeerConnectionState,
    oldTrack: MediaStreamTrack,
    newTrack: MediaStreamTrack
  ): Promise<void> {
    const senders = state.connection.getSenders?.() || [];

    for (const sender of senders) {
      if (sender.track && sender.track.kind === oldTrack.kind) {
        await sender.replaceTrack(newTrack);
        console.info('[WebRTC] Replaced track for:', state.jid, 'kind:', oldTrack.kind);
        break;
      }
    }
  }

  // ============================================================
  // Speaker Mode (iOS specific)
  // ============================================================

  /**
   * Toggle speaker mode (earpiece vs speaker)
   * iOS-specific implementation using InCallManager would go here
   */
  async setSpeakerMode(enabled: boolean): Promise<void> {
    // TODO: Implement with react-native-incall-manager
    // For now, just log
    console.info('[WebRTC] Speaker mode:', enabled ? 'ON' : 'OFF');

    // On iOS, this requires InCallManager:
    // InCallManager.setSpeakerphoneOn(enabled);
    // InCallManager.setForceSpeakerphoneOn(enabled);
  }
}

// Singleton instance
export const webrtcService = new WebRTCService();
