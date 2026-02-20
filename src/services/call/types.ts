/**
 * Call Service Types
 *
 * Internal types for WebRTC call management.
 * Public types are in interfaces.ts (CallService, ActiveCall, etc.)
 *
 * @see src/services/interfaces.ts for public API types
 */

import type { MediaStream, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';
import type { CallType, CallState, CallParticipant } from '../interfaces';

// ============================================================
// XMPP Signaling Types
// ============================================================

/** Namespace for call signaling stanzas */
export const NS_CALL = 'urn:commeazy:call:1';

/**
 * Call offer sent from initiator to recipient
 */
export interface CallOfferPayload {
  type: 'offer';
  callId: string;
  callType: CallType;
  sdp: string;  // Base64 encoded SDP
  participants?: string[];  // JIDs for 3-way calls
}

/**
 * Call answer sent from recipient to initiator
 */
export interface CallAnswerPayload {
  type: 'answer';
  callId: string;
  sdp: string;  // Base64 encoded SDP
}

/**
 * ICE candidate for NAT traversal
 */
export interface IceCandidatePayload {
  type: 'ice-candidate';
  callId: string;
  candidate: string;  // Base64 encoded JSON
}

/**
 * Call control messages
 */
export interface CallControlPayload {
  type: 'hangup' | 'decline' | 'busy' | 'ringing';
  callId: string;
  reason?: string;
}

/**
 * Invite for adding participant to existing call (3-way)
 */
export interface CallInvitePayload {
  type: 'invite';
  callId: string;
  callType: CallType;
  existingParticipants: string[];  // Current JIDs in call
  sdp: string;
}

/**
 * Union of all call signaling payloads
 */
export type CallSignalingPayload =
  | CallOfferPayload
  | CallAnswerPayload
  | IceCandidatePayload
  | CallControlPayload
  | CallInvitePayload;

// ============================================================
// WebRTC Internal Types
// ============================================================

/**
 * Peer connection state for a single remote participant
 */
export interface PeerConnectionState {
  jid: string;
  connection: RTCPeerConnection;
  remoteStream: MediaStream | null;
  iceCandidatesQueue: RTCIceCandidate[];
  isNegotiating: boolean;
}

/**
 * Local media state
 */
export interface LocalMediaState {
  stream: MediaStream | null;
  audioTrack: MediaStreamTrack | null;
  videoTrack: MediaStreamTrack | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isFrontCamera: boolean;
}

/**
 * Internal call state (extends public ActiveCall)
 */
export interface InternalCallState {
  id: string;
  type: CallType;
  direction: 'incoming' | 'outgoing';
  state: CallState;
  participants: Map<string, CallParticipant>;
  peerConnections: Map<string, PeerConnectionState>;
  localMedia: LocalMediaState;
  startTime?: number;
  isSpeakerOn: boolean;
  ringTimeout?: ReturnType<typeof setTimeout>;
  durationInterval?: ReturnType<typeof setInterval>;
  /** Pending offer SDP for incoming calls - set when answering */
  pendingOfferSdp?: RTCSessionDescription;
}

// ============================================================
// WebRTC Configuration
// ============================================================

/**
 * Default ICE servers for development
 * Production should use CommEazy's own STUN/TURN servers
 *
 * TURN server is essential for NAT traversal when direct P2P fails.
 * Without TURN, calls will stay in "connecting" state indefinitely
 * when both devices are behind symmetric NAT.
 */
export const DEFAULT_ICE_SERVERS = [
  // Google's public STUN servers (for discovering public IP)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },

  // OpenRelay TURN server (free, for development/testing only)
  // Production: Replace with CommEazy's own Coturn server
  // See: https://www.metered.ca/tools/openrelay/
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

/**
 * Media constraints for voice calls
 */
export const VOICE_MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

/**
 * Media constraints for video calls
 */
export const VIDEO_MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    facingMode: 'user',  // Front camera
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
};

/**
 * PeerConnection configuration
 */
export const PEER_CONNECTION_CONFIG = {
  bundlePolicy: 'max-bundle' as RTCBundlePolicy,
  rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
  iceCandidatePoolSize: 10,
};

/**
 * Timeouts and limits
 */
export const CALL_TIMEOUTS = {
  /** How long to ring before timeout (30 seconds) */
  RING_TIMEOUT_MS: 30000,
  /** ICE gathering timeout (10 seconds) */
  ICE_GATHERING_TIMEOUT_MS: 10000,
  /** Connection establishment timeout (15 seconds) */
  CONNECTION_TIMEOUT_MS: 15000,
  /** Reconnection attempt timeout (5 seconds) */
  RECONNECTION_TIMEOUT_MS: 5000,
};

export const CALL_LIMITS = {
  /** Maximum participants in a mesh call */
  MAX_PARTICIPANTS: 3,
  /** Maximum reconnection attempts */
  MAX_RECONNECTION_ATTEMPTS: 3,
};

// ============================================================
// Helper Types
// ============================================================

/**
 * RTCPeerConnection type with proper typing
 * (react-native-webrtc types can be incomplete)
 */
export interface RTCPeerConnection {
  createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescription>;
  createAnswer(options?: RTCAnswerOptions): Promise<RTCSessionDescription>;
  setLocalDescription(description: RTCSessionDescription): Promise<void>;
  setRemoteDescription(description: RTCSessionDescription): Promise<void>;
  addIceCandidate(candidate: RTCIceCandidate): Promise<void>;
  addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender;
  removeTrack(sender: RTCRtpSender): void;
  getTransceivers(): RTCRtpTransceiver[];
  close(): void;

  // Event handlers
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
  ontrack: ((event: RTCTrackEvent) => void) | null;
  oniceconnectionstatechange: (() => void) | null;
  onconnectionstatechange: (() => void) | null;
  onnegotiationneeded: (() => void) | null;

  // State
  iceConnectionState: RTCIceConnectionState;
  connectionState: RTCPeerConnectionState;
  signalingState: RTCSignalingState;
  localDescription: RTCSessionDescription | null;
  remoteDescription: RTCSessionDescription | null;
}

interface RTCOfferOptions {
  offerToReceiveAudio?: boolean;
  offerToReceiveVideo?: boolean;
  iceRestart?: boolean;
}

interface RTCAnswerOptions {
  // Currently no options defined
}

interface RTCPeerConnectionIceEvent {
  candidate: RTCIceCandidate | null;
}

interface RTCTrackEvent {
  track: MediaStreamTrack;
  streams: MediaStream[];
  receiver: RTCRtpReceiver;
  transceiver: RTCRtpTransceiver;
}

interface RTCRtpSender {
  track: MediaStreamTrack | null;
  replaceTrack(track: MediaStreamTrack | null): Promise<void>;
}

interface RTCRtpReceiver {
  track: MediaStreamTrack;
}

interface RTCRtpTransceiver {
  mid: string | null;
  sender: RTCRtpSender;
  receiver: RTCRtpReceiver;
  direction: RTCRtpTransceiverDirection;
  currentDirection: RTCRtpTransceiverDirection | null;
}

type RTCRtpTransceiverDirection = 'sendrecv' | 'sendonly' | 'recvonly' | 'inactive';
type RTCIceConnectionState = 'new' | 'checking' | 'connected' | 'completed' | 'failed' | 'disconnected' | 'closed';
type RTCPeerConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
type RTCSignalingState = 'stable' | 'have-local-offer' | 'have-remote-offer' | 'have-local-pranswer' | 'have-remote-pranswer' | 'closed';

// Export react-native-webrtc types
export type { MediaStream, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';

// MediaStreamTrack is not exported from react-native-webrtc, define minimal interface
export interface MediaStreamTrack {
  kind: 'audio' | 'video';
  id: string;
  enabled: boolean;
  muted: boolean;
  readyState: 'live' | 'ended';
  stop(): void;
}
