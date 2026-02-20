/**
 * CallContext — Global call state provider
 *
 * Provides call state and actions to the entire app.
 * Handles incoming call notifications and navigation.
 *
 * Usage:
 * ```tsx
 * const { activeCall, initiateCall, endCall } = useCall();
 *
 * // Start a call
 * await initiateCall('oma@commeazy.local', 'video');
 *
 * // End current call
 * endCall();
 * ```
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { MediaStream } from 'react-native-webrtc';

import type { ActiveCall, CallType, CallEndReason, IceServer, Contact } from '@/services/interfaces';
import { callService, WebRTCCallService } from '@/services/call';
import { DEFAULT_ICE_SERVERS } from '@/services/call/types';

// ============================================================
// Context Types
// ============================================================

interface CallContextValue {
  // State
  activeCall: ActiveCall | null;
  isInCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;

  // Actions
  initiateCall: (contactJid: string, type: CallType) => Promise<void>;
  answerCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  addParticipant: (contactJid: string) => Promise<void>;

  // Controls
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleVideo: () => void;
  switchCamera: () => void;

  // Helpers
  canAddParticipant: boolean;
  getContactName: (jid: string) => string;
}

const CallContext = createContext<CallContextValue | null>(null);

// ============================================================
// Provider Props
// ============================================================

interface CallProviderProps {
  children: ReactNode;
  /** Custom ICE servers (optional, uses defaults if not provided) */
  iceServers?: IceServer[];
  /** Contact lookup function for displaying names */
  getContactByJid?: (jid: string) => Contact | null;
  /** Callback when incoming call is received */
  onIncomingCall?: (call: ActiveCall) => void;
  /** Callback when call ends */
  onCallEnded?: (callId: string, reason: CallEndReason) => void;
}

// ============================================================
// Provider Component
// ============================================================

export function CallProvider({
  children,
  iceServers = DEFAULT_ICE_SERVERS,
  getContactByJid,
  onIncomingCall,
  onCallEnded,
}: CallProviderProps) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isInitialized, setIsInitialized] = useState(false);

  // ============================================================
  // Contact Name Lookup
  // ============================================================

  const getContactName = useCallback(
    (jid: string): string => {
      if (getContactByJid) {
        const contact = getContactByJid(jid);
        if (contact) return contact.name;
      }
      // Fallback: extract username from JID
      return jid.split('@')[0];
    },
    [getContactByJid]
  );

  // ============================================================
  // Initialization
  // ============================================================

  useEffect(() => {
    const init = async () => {
      try {
        // Initialize call service with ICE servers
        await callService.initialize(iceServers);

        // Set contact name lookup
        callService.getContactName = getContactName;

        setIsInitialized(true);
        console.info('[CallContext] Initialized');
      } catch (error) {
        console.error('[CallContext] Failed to initialize:', error);
      }
    };

    void init();

    return () => {
      void callService.cleanup();
    };
  }, [iceServers, getContactName]);

  // ============================================================
  // Subscribe to Call State Changes
  // ============================================================

  useEffect(() => {
    if (!isInitialized) return;

    const unsubscribeState = callService.observeCallState().subscribe((call) => {
      setActiveCall(call);

      // Update streams
      setLocalStream(callService.getLocalStream());
      setRemoteStreams(callService.getRemoteStreams());
    });

    const unsubscribeIncoming = callService.onIncomingCall((call) => {
      console.info('[CallContext] Incoming call:', call.id);
      setActiveCall(call);

      // Notify callback
      if (onIncomingCall) {
        onIncomingCall(call);
      }
    });

    const unsubscribeEnded = callService.onCallEnded((callId, reason) => {
      console.info('[CallContext] Call ended:', callId, 'reason:', reason);
      setActiveCall(null);
      setLocalStream(null);
      setRemoteStreams(new Map());

      // Notify callback
      if (onCallEnded) {
        onCallEnded(callId, reason);
      }
    });

    return () => {
      unsubscribeState();
      unsubscribeIncoming();
      unsubscribeEnded();
    };
  }, [isInitialized, onIncomingCall, onCallEnded]);

  // ============================================================
  // App State Handling (background/foreground)
  // ============================================================

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' && activeCall?.state === 'ringing') {
        // If app goes to background while ringing, keep alive for CallKit/VoIP
        console.info('[CallContext] App backgrounded during incoming call');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [activeCall]);

  // ============================================================
  // Actions
  // ============================================================

  const initiateCall = useCallback(
    async (contactJid: string, type: CallType) => {
      if (!isInitialized) {
        throw new Error('[CallContext] Not initialized');
      }

      try {
        await callService.initiateCall(contactJid, type);
      } catch (error) {
        console.error('[CallContext] Failed to initiate call:', error);
        throw error;
      }
    },
    [isInitialized]
  );

  const answerCall = useCallback(async () => {
    if (!activeCall) {
      console.warn('[CallContext] No call to answer');
      return;
    }

    try {
      await callService.answerCall(activeCall.id);
    } catch (error) {
      console.error('[CallContext] Failed to answer call:', error);
      throw error;
    }
  }, [activeCall]);

  const declineCall = useCallback(async () => {
    if (!activeCall) {
      console.warn('[CallContext] No call to decline');
      return;
    }

    try {
      await callService.declineCall(activeCall.id);
    } catch (error) {
      console.error('[CallContext] Failed to decline call:', error);
    }
  }, [activeCall]);

  const endCall = useCallback(async () => {
    if (!activeCall) {
      console.warn('[CallContext] No call to end');
      return;
    }

    try {
      await callService.endCall(activeCall.id);
    } catch (error) {
      console.error('[CallContext] Failed to end call:', error);
    }
  }, [activeCall]);

  const addParticipant = useCallback(
    async (contactJid: string) => {
      if (!activeCall) {
        console.warn('[CallContext] No active call');
        return;
      }

      try {
        await callService.addParticipant(activeCall.id, contactJid);
      } catch (error) {
        console.error('[CallContext] Failed to add participant:', error);
        throw error;
      }
    },
    [activeCall]
  );

  // ============================================================
  // Controls
  // ============================================================

  const toggleMute = useCallback(() => {
    callService.toggleMute();
  }, []);

  const toggleSpeaker = useCallback(() => {
    callService.toggleSpeaker();
  }, []);

  const toggleVideo = useCallback(() => {
    callService.toggleVideo();
  }, []);

  const switchCamera = useCallback(() => {
    callService.switchCamera();
  }, []);

  // ============================================================
  // Derived State
  // ============================================================

  const isInCall = activeCall !== null && activeCall.state !== 'ended';

  const canAddParticipant = useMemo(() => {
    if (!activeCall) return false;
    return callService.canAddParticipant(activeCall.id);
  }, [activeCall]);

  // ============================================================
  // Context Value
  // ============================================================

  const value: CallContextValue = useMemo(
    () => ({
      activeCall,
      isInCall,
      localStream,
      remoteStreams,
      initiateCall,
      answerCall,
      declineCall,
      endCall,
      addParticipant,
      toggleMute,
      toggleSpeaker,
      toggleVideo,
      switchCamera,
      canAddParticipant,
      getContactName,
    }),
    [
      activeCall,
      isInCall,
      localStream,
      remoteStreams,
      initiateCall,
      answerCall,
      declineCall,
      endCall,
      addParticipant,
      toggleMute,
      toggleSpeaker,
      toggleVideo,
      switchCamera,
      canAddParticipant,
      getContactName,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

// ============================================================
// Hook
// ============================================================

export function useCall(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

// ============================================================
// Exports
// ============================================================

export { CallContext };
export type { CallContextValue, CallProviderProps };
