/**
 * Mesh Manager
 *
 * Manages multiple PeerConnections for 3-way mesh calls.
 *
 * Topology:
 *   In a 3-way call, each participant maintains N-1 peer connections.
 *   For 3 participants (A, B, C):
 *   - A has connections to B and C
 *   - B has connections to A and C
 *   - C has connections to A and B
 *
 * This results in 3 total connections (not 6) because each connection
 * is bidirectional and shared between two participants.
 *
 * @see types.ts for type definitions
 */

import type { MediaStream, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';
import type { CallType, CallParticipant } from '../interfaces';
import { CALL_LIMITS, type PeerConnectionState } from './types';
import { WebRTCService } from './webrtcService';

// ============================================================
// Types
// ============================================================

export interface MeshParticipant {
  jid: string;
  name: string;
  peerState: PeerConnectionState;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected';
}

export interface MeshCallbacks {
  onParticipantAdded: (jid: string) => void;
  onParticipantRemoved: (jid: string) => void;
  onParticipantStreamReady: (jid: string, stream: MediaStream) => void;
  onParticipantConnectionStateChange: (jid: string, state: string) => void;
  onNeedOffer: (jid: string) => void;
  onIceCandidate: (jid: string, candidate: RTCIceCandidate) => void;
}

// ============================================================
// Mesh Manager
// ============================================================

export class MeshManager {
  private webrtc: WebRTCService;
  private participants: Map<string, MeshParticipant> = new Map();
  private localJid: string = '';
  private callType: CallType = 'voice';
  private callbacks: Partial<MeshCallbacks> = {};

  constructor(webrtc: WebRTCService) {
    this.webrtc = webrtc;

    // Wire up WebRTC callbacks to mesh
    this.webrtc.onIceCandidate = this.handleIceCandidate.bind(this);
    this.webrtc.onRemoteStream = this.handleRemoteStream.bind(this);
    this.webrtc.onConnectionStateChange = this.handleConnectionStateChange.bind(this);
    this.webrtc.onNegotiationNeeded = this.handleNegotiationNeeded.bind(this);
  }

  // ============================================================
  // Initialization
  // ============================================================

  /**
   * Initialize mesh for a call
   */
  initialize(localJid: string, callType: CallType, callbacks: Partial<MeshCallbacks>): void {
    this.localJid = localJid;
    this.callType = callType;
    this.callbacks = callbacks;
    this.participants.clear();

    console.info('[MeshManager] Initialized for:', localJid, 'type:', callType);
  }

  /**
   * Clean up all connections
   */
  cleanup(): void {
    // Close all peer connections
    this.participants.forEach((participant) => {
      this.webrtc.closePeerConnection(participant.peerState);
    });
    this.participants.clear();

    console.info('[MeshManager] Cleaned up');
  }

  // ============================================================
  // Participant Management
  // ============================================================

  /**
   * Check if we can add another participant (max 3)
   */
  canAddParticipant(): boolean {
    // +1 for self
    return this.participants.size + 1 < CALL_LIMITS.MAX_PARTICIPANTS;
  }

  /**
   * Get current participant count (including self)
   */
  getParticipantCount(): number {
    return this.participants.size + 1; // +1 for self
  }

  /**
   * Add a new participant (creates PeerConnection)
   * Returns the PeerConnectionState for SDP negotiation
   */
  addParticipant(jid: string, name: string): PeerConnectionState {
    if (this.participants.has(jid)) {
      console.warn('[MeshManager] Participant already exists:', jid);
      return this.participants.get(jid)!.peerState;
    }

    if (!this.canAddParticipant()) {
      throw new Error(`[MeshManager] Max participants (${CALL_LIMITS.MAX_PARTICIPANTS}) reached`);
    }

    // Create peer connection
    const peerState = this.webrtc.createPeerConnection(jid);

    const participant: MeshParticipant = {
      jid,
      name,
      peerState,
      remoteStream: null,
      isMuted: false,
      isVideoEnabled: this.callType === 'video',
      connectionState: 'connecting',
    };

    this.participants.set(jid, participant);

    console.info('[MeshManager] Added participant:', jid, 'total:', this.getParticipantCount());

    if (this.callbacks.onParticipantAdded) {
      this.callbacks.onParticipantAdded(jid);
    }

    return peerState;
  }

  /**
   * Remove a participant (closes PeerConnection)
   */
  removeParticipant(jid: string): void {
    const participant = this.participants.get(jid);
    if (!participant) {
      console.warn('[MeshManager] Participant not found:', jid);
      return;
    }

    // Close peer connection
    this.webrtc.closePeerConnection(participant.peerState);

    this.participants.delete(jid);

    console.info('[MeshManager] Removed participant:', jid, 'remaining:', this.getParticipantCount());

    if (this.callbacks.onParticipantRemoved) {
      this.callbacks.onParticipantRemoved(jid);
    }
  }

  /**
   * Get a participant by JID
   */
  getParticipant(jid: string): MeshParticipant | undefined {
    return this.participants.get(jid);
  }

  /**
   * Get all participants (excluding self)
   */
  getAllParticipants(): MeshParticipant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Get all participant JIDs
   */
  getParticipantJids(): string[] {
    return Array.from(this.participants.keys());
  }

  /**
   * Convert to CallParticipant array for UI
   */
  toCallParticipants(): CallParticipant[] {
    return this.getAllParticipants().map((p) => ({
      jid: p.jid,
      name: p.name,
      isMuted: p.isMuted,
      isVideoEnabled: p.isVideoEnabled,
      connectionState: p.connectionState,
    }));
  }

  // ============================================================
  // SDP Negotiation
  // ============================================================

  /**
   * Create an offer for a specific participant
   */
  async createOffer(jid: string): Promise<RTCSessionDescription> {
    const participant = this.participants.get(jid);
    if (!participant) {
      throw new Error(`[MeshManager] Participant not found: ${jid}`);
    }

    return this.webrtc.createOffer(participant.peerState, this.callType);
  }

  /**
   * Create an answer for a specific participant
   */
  async createAnswer(jid: string): Promise<RTCSessionDescription> {
    const participant = this.participants.get(jid);
    if (!participant) {
      throw new Error(`[MeshManager] Participant not found: ${jid}`);
    }

    return this.webrtc.createAnswer(participant.peerState);
  }

  /**
   * Set remote description for a specific participant
   */
  async setRemoteDescription(jid: string, sdp: RTCSessionDescription): Promise<void> {
    const participant = this.participants.get(jid);
    if (!participant) {
      throw new Error(`[MeshManager] Participant not found: ${jid}`);
    }

    await this.webrtc.setRemoteDescription(participant.peerState, sdp);
  }

  /**
   * Add ICE candidate for a specific participant
   */
  async addIceCandidate(jid: string, candidate: RTCIceCandidate): Promise<void> {
    const participant = this.participants.get(jid);
    if (!participant) {
      console.warn('[MeshManager] Participant not found for ICE:', jid);
      return;
    }

    await this.webrtc.addIceCandidate(participant.peerState, candidate);
  }

  // ============================================================
  // Track Management
  // ============================================================

  /**
   * Add local tracks to all existing PeerConnections
   * Called after local media is started (e.g., when answering a call)
   */
  addLocalTracksToAllConnections(): void {
    this.participants.forEach((participant) => {
      this.webrtc.addTracksToConnection(participant.peerState);
    });
  }

  // ============================================================
  // Remote Stream Access
  // ============================================================

  /**
   * Get all remote streams mapped by JID
   */
  getRemoteStreams(): Map<string, MediaStream> {
    const streams = new Map<string, MediaStream>();
    this.participants.forEach((participant, jid) => {
      if (participant.remoteStream) {
        streams.set(jid, participant.remoteStream);
      }
    });
    return streams;
  }

  /**
   * Get remote stream for a specific participant
   */
  getRemoteStream(jid: string): MediaStream | null {
    return this.participants.get(jid)?.remoteStream || null;
  }

  // ============================================================
  // WebRTC Event Handlers
  // ============================================================

  private handleIceCandidate(jid: string, candidate: RTCIceCandidate): void {
    if (this.callbacks.onIceCandidate) {
      this.callbacks.onIceCandidate(jid, candidate);
    }
  }

  private handleRemoteStream(jid: string, stream: MediaStream): void {
    const participant = this.participants.get(jid);
    if (participant) {
      participant.remoteStream = stream;

      if (this.callbacks.onParticipantStreamReady) {
        this.callbacks.onParticipantStreamReady(jid, stream);
      }
    }
  }

  private handleConnectionStateChange(jid: string, state: string): void {
    const participant = this.participants.get(jid);
    if (participant) {
      // Map WebRTC connection state to our simplified state
      switch (state) {
        case 'new':
        case 'connecting':
        case 'checking':
          participant.connectionState = 'connecting';
          break;
        case 'connected':
        case 'completed':
          participant.connectionState = 'connected';
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          participant.connectionState = 'disconnected';
          break;
      }

      if (this.callbacks.onParticipantConnectionStateChange) {
        this.callbacks.onParticipantConnectionStateChange(jid, state);
      }
    }
  }

  private handleNegotiationNeeded(jid: string): void {
    if (this.callbacks.onNeedOffer) {
      this.callbacks.onNeedOffer(jid);
    }
  }

  // ============================================================
  // 3-Way Call: Topology Helpers
  // ============================================================

  /**
   * When a new participant joins a 3-way call, we need to:
   * 1. Create connections from existing participants to the new one
   * 2. The new participant creates connections to all existing ones
   *
   * This method returns the JIDs that need new connections from local device
   */
  getNewConnectionsNeeded(newParticipantJid: string): string[] {
    // The local device needs to connect to the new participant
    return [newParticipantJid];
  }

  /**
   * Check if all participants are connected
   */
  areAllConnected(): boolean {
    for (const participant of this.participants.values()) {
      if (participant.connectionState !== 'connected') {
        return false;
      }
    }
    return true;
  }

  /**
   * Get connection statistics for debugging
   */
  getStats(): { jid: string; state: string; hasStream: boolean }[] {
    return this.getAllParticipants().map((p) => ({
      jid: p.jid,
      state: p.connectionState,
      hasStream: p.remoteStream !== null,
    }));
  }
}
