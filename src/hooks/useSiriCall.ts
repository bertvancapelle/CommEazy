/**
 * useSiriCall — Hook to handle Siri call intents
 *
 * This hook:
 * 1. Listens for Siri call intents
 * 2. Resolves contact names to JIDs using the contact service
 * 3. Initiates calls via CallContext
 *
 * Usage:
 * ```tsx
 * function App() {
 *   useSiriCall(); // Enable Siri call handling
 *   return <AppNavigator />;
 * }
 * ```
 *
 * @see services/siriService.ts for native module bridge
 */

import { useEffect, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { siriService, type SiriCallIntent, type SiriAuthorizationStatus } from '@/services/siriService';
import { useCallContext } from '@/contexts/CallContext';

// ============================================================
// Types
// ============================================================

export interface UseSiriCallOptions {
  /**
   * Function to resolve a contact name to a JID
   * Returns null if contact not found
   */
  resolveContactToJid?: (name: string) => string | null;

  /**
   * Callback when Siri call intent is received
   * Useful for logging or analytics
   */
  onCallIntent?: (intent: SiriCallIntent) => void;

  /**
   * Show alert when contact not found (default: true)
   */
  showContactNotFoundAlert?: boolean;
}

export interface UseSiriCallReturn {
  /**
   * Whether Siri integration is available on this device
   */
  isAvailable: boolean;

  /**
   * Request Siri authorization from the user
   */
  requestAuthorization: () => Promise<SiriAuthorizationStatus>;

  /**
   * Donate a call shortcut to Siri
   */
  donateCallShortcut: (contactName: string, contactId: string, callType?: 'audio' | 'video') => Promise<boolean>;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useSiriCall(options: UseSiriCallOptions = {}): UseSiriCallReturn {
  const { t } = useTranslation();
  const callContext = useCallContext();

  const {
    resolveContactToJid,
    onCallIntent,
    showContactNotFoundAlert = true,
  } = options;

  // Keep options in ref to avoid re-registering handler
  const optionsRef = useRef(options);
  optionsRef.current = options;

  /**
   * Handle incoming Siri call intent
   */
  const handleCallIntent = useCallback(
    async (intent: SiriCallIntent) => {
      console.info('[useSiriCall] Received intent:', intent);

      // Notify callback
      optionsRef.current.onCallIntent?.(intent);

      // Try to resolve contact name to JID
      let contactJid: string | null = null;

      if (optionsRef.current.resolveContactToJid) {
        contactJid = optionsRef.current.resolveContactToJid(intent.contactName);
      }

      // If no custom resolver, try to use customIdentifier from intent
      if (!contactJid && intent.customIdentifier) {
        // Format: "commeazy:contactId"
        const parts = intent.customIdentifier.split(':');
        if (parts.length >= 2) {
          contactJid = parts.slice(1).join(':'); // Handle JIDs with colons
        }
      }

      // If still no JID, try the contact handle
      if (!contactJid && intent.contactHandle) {
        contactJid = intent.contactHandle;
      }

      // If we couldn't resolve the contact, show error
      if (!contactJid) {
        console.warn('[useSiriCall] Could not resolve contact:', intent.contactName);

        if (optionsRef.current.showContactNotFoundAlert !== false) {
          Alert.alert(
            t('siri.contactNotFound.title', 'Contact niet gevonden'),
            t('siri.contactNotFound.message', {
              defaultValue: '{{name}} is niet gevonden in je contacten.',
              name: intent.contactName,
            }),
            [{ text: t('common.ok', 'OK') }]
          );
        }
        return;
      }

      // Initiate the call
      console.info('[useSiriCall] Initiating call to:', contactJid, 'type:', intent.callType);

      try {
        await callContext.initiateCall(contactJid, intent.callType);

        // Donate shortcut on successful call start
        void siriService.donateCallShortcut(
          intent.contactName,
          contactJid,
          intent.callType
        );
      } catch (error) {
        console.error('[useSiriCall] Failed to initiate call:', error);

        Alert.alert(
          t('call.error.title', 'Bellen niet mogelijk'),
          t('call.error.message', 'Er is een probleem opgetreden bij het starten van het gesprek.'),
          [{ text: t('common.ok', 'OK') }]
        );
      }
    },
    [callContext, t]
  );

  /**
   * Set up Siri intent handler on mount
   */
  useEffect(() => {
    if (!siriService.isAvailable()) {
      console.debug('[useSiriCall] Siri not available on this platform');
      return;
    }

    console.info('[useSiriCall] Setting up Siri call handler');
    siriService.setCallIntentHandler(handleCallIntent);

    return () => {
      siriService.setCallIntentHandler(null);
    };
  }, [handleCallIntent]);

  /**
   * Request Siri authorization
   */
  const requestAuthorization = useCallback(async () => {
    return siriService.requestAuthorization();
  }, []);

  /**
   * Donate a call shortcut
   */
  const donateCallShortcut = useCallback(
    async (contactName: string, contactId: string, callType: 'audio' | 'video' = 'audio') => {
      return siriService.donateCallShortcut(contactName, contactId, callType);
    },
    []
  );

  return {
    isAvailable: Platform.OS === 'ios' && siriService.isAvailable(),
    requestAuthorization,
    donateCallShortcut,
  };
}

// ============================================================
// Re-exports
// ============================================================

export type { SiriCallIntent, SiriAuthorizationStatus } from '@/services/siriService';
