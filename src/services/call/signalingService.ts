/**
 * Call Signaling Service
 *
 * Handles WebRTC signaling via XMPP:
 * - Sending and receiving call offers/answers
 * - ICE candidate exchange
 * - Call control messages (hangup, decline, busy, ringing)
 *
 * Uses custom XMPP stanzas with namespace 'urn:commeazy:call:1'
 *
 * @see types.ts for signaling payload types
 */

import type { RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import type { CallType, Unsubscribe } from '../interfaces';
import {
  NS_CALL,
  type CallOfferPayload,
  type CallAnswerPayload,
  type IceCandidatePayload,
  type CallControlPayload,
  type CallInvitePayload,
  type CallSignalingPayload,
} from './types';

// ============================================================
// Base64 Encoding/Decoding
// ============================================================

/**
 * Encode string to Base64
 */
function toBase64(str: string): string {
  // React Native doesn't have btoa, use global
  if (typeof btoa === 'function') {
    return btoa(str);
  }
  // Fallback for older RN versions
  return Buffer.from(str, 'utf-8').toString('base64');
}

/**
 * Decode Base64 to string
 */
function fromBase64(base64: string): string {
  // React Native doesn't have atob, use global
  if (typeof atob === 'function') {
    return atob(base64);
  }
  // Fallback for older RN versions
  return Buffer.from(base64, 'base64').toString('utf-8');
}

// ============================================================
// Signaling Service
// ============================================================

export interface SignalingHandlers {
  onCallOffer: (from: string, payload: CallOfferPayload) => void;
  onCallAnswer: (from: string, payload: CallAnswerPayload) => void;
  onIceCandidate: (from: string, payload: IceCandidatePayload) => void;
  onCallControl: (from: string, payload: CallControlPayload) => void;
  onCallInvite: (from: string, payload: CallInvitePayload) => void;
}

/**
 * XMPP Signaling interface (subset of XMPPService methods we need)
 * This allows us to decouple from the full XMPP service
 */
export interface XMPPSignaling {
  sendCallSignaling(to: string, payload: CallSignalingPayload): Promise<void>;
  onCallSignaling(handler: (from: string, payload: CallSignalingPayload) => void): Unsubscribe;
}

export class CallSignalingService {
  private xmpp: XMPPSignaling | null = null;
  private handlers: Partial<SignalingHandlers> = {};
  private unsubscribe: Unsubscribe | null = null;

  // ============================================================
  // Initialization
  // ============================================================

  /**
   * Initialize with XMPP service reference
   */
  initialize(xmpp: XMPPSignaling): void {
    this.xmpp = xmpp;

    // Subscribe to incoming call signaling
    this.unsubscribe = xmpp.onCallSignaling((from, payload) => {
      this.handleIncomingSignaling(from, payload);
    });

    console.info('[CallSignaling] Initialized');
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.xmpp = null;
    this.handlers = {};
    console.info('[CallSignaling] Cleaned up');
  }

  /**
   * Register signaling event handlers
   */
  setHandlers(handlers: Partial<SignalingHandlers>): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  // ============================================================
  // Sending Signaling Messages
  // ============================================================

  /**
   * Send call offer (initiator → recipient)
   */
  async sendOffer(
    to: string,
    callId: string,
    callType: CallType,
    sdp: RTCSessionDescription,
    participants?: string[]
  ): Promise<void> {
    if (!this.xmpp) {
      throw new Error('[CallSignaling] Not initialized');
    }

    const payload: CallOfferPayload = {
      type: 'offer',
      callId,
      callType,
      sdp: toBase64(JSON.stringify(sdp)),
      participants,
    };

    await this.xmpp.sendCallSignaling(to, payload);
    console.info('[CallSignaling] Sent offer to:', to);
  }

  /**
   * Send call answer (recipient → initiator)
   */
  async sendAnswer(
    to: string,
    callId: string,
    sdp: RTCSessionDescription
  ): Promise<void> {
    if (!this.xmpp) {
      throw new Error('[CallSignaling] Not initialized');
    }

    const payload: CallAnswerPayload = {
      type: 'answer',
      callId,
      sdp: toBase64(JSON.stringify(sdp)),
    };

    await this.xmpp.sendCallSignaling(to, payload);
    console.info('[CallSignaling] Sent answer to:', to);
  }

  /**
   * Send ICE candidate
   */
  async sendIceCandidate(
    to: string,
    callId: string,
    candidate: RTCIceCandidate
  ): Promise<void> {
    if (!this.xmpp) {
      throw new Error('[CallSignaling] Not initialized');
    }

    const payload: IceCandidatePayload = {
      type: 'ice-candidate',
      callId,
      candidate: toBase64(JSON.stringify(candidate)),
    };

    await this.xmpp.sendCallSignaling(to, payload);
    console.debug('[CallSignaling] Sent ICE candidate to:', to);
  }

  /**
   * Send call control message (hangup, decline, busy, ringing)
   */
  async sendControl(
    to: string,
    callId: string,
    action: 'hangup' | 'decline' | 'busy' | 'ringing',
    reason?: string
  ): Promise<void> {
    if (!this.xmpp) {
      throw new Error('[CallSignaling] Not initialized');
    }

    const payload: CallControlPayload = {
      type: action,
      callId,
      reason,
    };

    await this.xmpp.sendCallSignaling(to, payload);
    console.info('[CallSignaling] Sent control:', action, 'to:', to);
  }

  /**
   * Send call invite for 3-way call
   */
  async sendInvite(
    to: string,
    callId: string,
    callType: CallType,
    existingParticipants: string[],
    sdp: RTCSessionDescription
  ): Promise<void> {
    if (!this.xmpp) {
      throw new Error('[CallSignaling] Not initialized');
    }

    const payload: CallInvitePayload = {
      type: 'invite',
      callId,
      callType,
      existingParticipants,
      sdp: toBase64(JSON.stringify(sdp)),
    };

    await this.xmpp.sendCallSignaling(to, payload);
    console.info('[CallSignaling] Sent invite to:', to, 'existing:', existingParticipants);
  }

  // ============================================================
  // Receiving Signaling Messages
  // ============================================================

  /**
   * Handle incoming signaling message
   */
  private handleIncomingSignaling(from: string, payload: CallSignalingPayload): void {
    console.debug('[CallSignaling] Received', payload.type, 'from:', from);

    switch (payload.type) {
      case 'offer':
        this.handleOffer(from, payload);
        break;
      case 'answer':
        this.handleAnswer(from, payload);
        break;
      case 'ice-candidate':
        this.handleIceCandidate(from, payload);
        break;
      case 'hangup':
      case 'decline':
      case 'busy':
      case 'ringing':
        this.handleControl(from, payload);
        break;
      case 'invite':
        this.handleInvite(from, payload);
        break;
      default:
        console.warn('[CallSignaling] Unknown payload type:', (payload as CallSignalingPayload).type);
    }
  }

  private handleOffer(from: string, payload: CallOfferPayload): void {
    if (this.handlers.onCallOffer) {
      // Decode SDP
      const decodedPayload: CallOfferPayload = {
        ...payload,
        sdp: fromBase64(payload.sdp),
      };
      this.handlers.onCallOffer(from, decodedPayload);
    }
  }

  private handleAnswer(from: string, payload: CallAnswerPayload): void {
    if (this.handlers.onCallAnswer) {
      // Decode SDP
      const decodedPayload: CallAnswerPayload = {
        ...payload,
        sdp: fromBase64(payload.sdp),
      };
      this.handlers.onCallAnswer(from, decodedPayload);
    }
  }

  private handleIceCandidate(from: string, payload: IceCandidatePayload): void {
    if (this.handlers.onIceCandidate) {
      // Decode candidate
      const decodedPayload: IceCandidatePayload = {
        ...payload,
        candidate: fromBase64(payload.candidate),
      };
      this.handlers.onIceCandidate(from, decodedPayload);
    }
  }

  private handleControl(from: string, payload: CallControlPayload): void {
    if (this.handlers.onCallControl) {
      this.handlers.onCallControl(from, payload);
    }
  }

  private handleInvite(from: string, payload: CallInvitePayload): void {
    if (this.handlers.onCallInvite) {
      // Decode SDP
      const decodedPayload: CallInvitePayload = {
        ...payload,
        sdp: fromBase64(payload.sdp),
      };
      this.handlers.onCallInvite(from, decodedPayload);
    }
  }

  // ============================================================
  // Helper: Parse SDP
  // ============================================================

  /**
   * Parse a JSON-encoded SDP string into RTCSessionDescription
   */
  static parseSdp(sdpJson: string): RTCSessionDescription {
    const parsed = JSON.parse(sdpJson);
    return new RTCSessionDescription(parsed);
  }

  /**
   * Parse a JSON-encoded ICE candidate string
   */
  static parseIceCandidate(candidateJson: string): RTCIceCandidate {
    const parsed = JSON.parse(candidateJson);
    return new RTCIceCandidate(parsed);
  }
}

// Singleton instance
export const signalingService = new CallSignalingService();
