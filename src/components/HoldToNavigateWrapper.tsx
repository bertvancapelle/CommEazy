/**
 * HoldToNavigateWrapper — Global Hold-to-Navigate overlay
 *
 * Wraps the main app content and provides:
 * - Long-press detection anywhere on screen (1 finger = navigation wheel)
 * - Two-finger long-press for voice commands (same timing as single-finger)
 * - DraggableMenuButton display
 * - NavigationMenu overlay
 * - Voice command overlay
 *
 * This component should wrap the main navigation container.
 *
 * IMPORTANT: Uses onTouchStart/onTouchMove/onTouchEnd instead of PanResponder
 * to observe touches WITHOUT stealing them from the content. This allows
 * normal interaction with the app while still detecting long presses.
 *
 * Gesture Detection:
 * - 1 finger long-press: Opens navigation wheel
 * - 2 finger long-press: Opens voice command mode (same delay, threshold, haptic)
 *
 * @see .claude/skills/ui-designer/SKILL.md#hold-to-navigate
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  GestureResponderEvent,
  AppState,
  AppStateStatus,
  DeviceEventEmitter,
  LayoutChangeEvent,
} from 'react-native';
import { WheelNavigationMenu, NavigationDestination } from './WheelNavigationMenu';
import { usePaneContext } from '@/contexts/PaneContext';
import { HoldIndicator } from './HoldIndicator';
import { VoiceCommandOverlay } from './VoiceCommandOverlay';
import { FloatingMicIndicator } from './FloatingMicIndicator';
import { ContactSelectionModal, ContactMatch as ModalContactMatch, ContactSelectionMode } from './ContactSelectionModal';
import { useHoldToNavigate } from '@/hooks/useHoldToNavigate';
import { useVoiceCommands, MicIndicatorPosition, VoiceCommandResult } from '@/hooks/useVoiceCommands';
import { useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import { useVoiceFormContext } from '@/contexts/VoiceFormContext';
import { useHoldGestureContextSafe } from '@/contexts/HoldGestureContext';
import { ServiceContainer } from '@/services/container';
import type { Contact } from '@/services/interfaces';

// ============================================================
// Pending Voice Action (for multi-match contact selection)
// ============================================================

/**
 * Represents a pending voice action that requires contact selection
 */
interface PendingVoiceAction {
  /** The type of action to perform after selection */
  action: 'call' | 'message';
  /** The original search term */
  searchTerm: string;
}

/**
 * Represents a pending voice list navigation (focus on a name in a list)
 */
interface PendingVoiceListNavigation {
  /** The original search term */
  searchTerm: string;
}

// ============================================================
// Contact Lookup Helpers
// ============================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between search term and contact name
 *
 * Supports WORD-LEVEL matching:
 * - "oma" matches "Oma Jansen" (exact word match → score 0.95)
 * - "maria" matches "Tante Maria" (exact word match → score 0.95)
 * - "jansen" matches "Oma Jansen" (exact word match → score 0.95)
 *
 * Also supports partial matching:
 * - "jan" matches "Jansen" (prefix → score 0.85)
 * - "oma" matches "omas" (prefix → score 0.85)
 */
function similarityScore(searchTerm: string, contactName: string): number {
  const searchLower = searchTerm.toLowerCase().trim();
  const nameLower = contactName.toLowerCase().trim();

  if (searchLower === nameLower) return 1;
  if (searchLower.length === 0 || nameLower.length === 0) return 0;

  // Split contact name into words
  const nameWords = nameLower.split(/\s+/);

  // Check for exact word match (highest priority for voice commands)
  // "oma" in "Oma Jansen" → exact word match
  for (const word of nameWords) {
    if (word === searchLower) {
      return 0.95; // Exact word match
    }
  }

  // Check if search term is a prefix of any word
  // "jan" in "Jansen" → prefix match
  for (const word of nameWords) {
    if (word.startsWith(searchLower)) {
      return 0.85; // Prefix match within a word
    }
  }

  // Check if full name starts with search term
  // "oma j" matches "Oma Jansen"
  if (nameLower.startsWith(searchLower)) {
    return 0.9;
  }

  // Check for fuzzy word match using Levenshtein
  // "omaa" → "oma" (typo tolerance)
  let bestWordScore = 0;
  for (const word of nameWords) {
    const distance = levenshteinDistance(searchLower, word);
    const maxLen = Math.max(searchLower.length, word.length);
    const wordScore = 1 - distance / maxLen;
    if (wordScore > bestWordScore) {
      bestWordScore = wordScore;
    }
  }

  // If we found a good word match, return it
  if (bestWordScore >= 0.7) {
    return bestWordScore * 0.9; // Slight penalty for fuzzy match
  }

  // Fallback: full string Levenshtein
  const fullDistance = levenshteinDistance(searchLower, nameLower);
  const fullMaxLen = Math.max(searchLower.length, nameLower.length);
  return 1 - fullDistance / fullMaxLen;
}

/**
 * Contact match result with score for multi-match handling
 */
export interface ContactMatch {
  contact: Contact;
  score: number;
}

/**
 * Find ALL matching contacts by name using fuzzy matching
 * Returns all contacts with similarity score above threshold, sorted by score (highest first)
 */
async function findAllContactsByName(
  contactName: string,
  threshold: number = 0.7
): Promise<ContactMatch[]> {
  try {
    let contacts: Contact[] = [];

    if (__DEV__) {
      // Dynamic import to avoid module loading at bundle time
      const { getMockContactsForDevice } = await import('@/services/mock');
      const { getOtherDevicesPublicKeys } = await import('@/services/mock/testKeys');
      const { chatService } = await import('@/services/chat');

      const currentUserJid = chatService.isInitialized
        ? chatService.getMyJid()
        : 'ik@commeazy.local';

      // Get public keys for other test devices
      const publicKeyMap = await getOtherDevicesPublicKeys(currentUserJid || 'ik@commeazy.local');

      contacts = getMockContactsForDevice(currentUserJid || 'ik@commeazy.local', publicKeyMap);
    } else {
      // Production: use database service
      // TODO: Implement ServiceContainer.database.getContacts()
      contacts = [];
    }

    // Find all matches above threshold
    const matches: ContactMatch[] = [];

    for (const contact of contacts) {
      const score = similarityScore(contactName, contact.name);
      if (score >= threshold) {
        matches.push({ contact, score });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    console.log('[findAllContactsByName] Matches for:', contactName, '->', matches.map(m => `${m.contact.name}(${m.score.toFixed(2)})`).join(', '));
    return matches;
  } catch (error) {
    console.error('[findAllContactsByName] Failed to find contacts:', error);
    return [];
  }
}

/**
 * Find best matching contact by name using fuzzy matching
 * Returns the contact with highest similarity score above threshold
 */
async function findContactByName(
  contactName: string,
  threshold: number = 0.7
): Promise<Contact | null> {
  const matches = await findAllContactsByName(contactName, threshold);
  return matches.length > 0 ? matches[0].contact : null;
}

// ============================================================
// Component Props
// ============================================================

interface HoldToNavigateWrapperProps {
  children: React.ReactNode;
  /** Whether to enable hold-to-navigate (disable during onboarding) */
  enabled?: boolean;
}

// Tab-level navigation helpers (getTabNameForDestination, getInitialRouteForTab)
// removed — now handled by PaneContext.setPaneModule()

export function HoldToNavigateWrapper({
  children,
  enabled = true,
}: HoldToNavigateWrapperProps) {
  // Pane context for module-level navigation (replaces old tab navigation)
  const paneCtx = usePaneContext();

  // Track app state to avoid restarting voice recognition when app goes to background
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  // Current module from pane context (replaces old currentTabName tracking)
  const currentModuleId = paneCtx.panes.main?.moduleId ?? 'chats';

  const {
    settings,
    isNavigationMenuOpen,
    reducedMotion,
    openNavigationMenu,
    closeNavigationMenu,
    triggerHaptic,
    isTouchValid,
  } = useHoldToNavigate();

  // Voice commands hook
  const voiceCommands = useVoiceCommands();

  // Voice focus context for list navigation (volgende/vorige/open commands)
  const voiceFocus = useVoiceFocusContext();

  // Voice form context for form field interactions (pas aan/wis/dicteer/bevestig commands)
  const voiceForm = useVoiceFormContext();

  // Hold gesture context for preventing double-action on long-press
  // When a hold gesture completes, we mark it as consumed so child onPress handlers don't fire
  const holdGesture = useHoldGestureContextSafe();

  // CRITICAL: Ref for voiceFocus.focusByName to avoid stale closures in async callbacks
  // The voiceFocus context updates when lists are registered, but callbacks may have stale references
  const focusByNameRef = useRef(voiceFocus.focusByName);
  const voiceFocusActiveListIdRef = useRef(voiceFocus.activeListId);

  // Keep refs updated with latest function/value references
  useEffect(() => {
    focusByNameRef.current = voiceFocus.focusByName;
    voiceFocusActiveListIdRef.current = voiceFocus.activeListId;
  }, [voiceFocus.focusByName, voiceFocus.activeListId]);

  // Voice command overlay state
  const [isVoiceOverlayVisible, setIsVoiceOverlayVisible] = useState(false);

  // Voice Session Mode state
  const [isVoiceSessionActive, setIsVoiceSessionActive] = useState(false);
  const [micIndicatorPosition, setMicIndicatorPosition] = useState<MicIndicatorPosition>('top-right');
  const voiceSessionRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to track voice session active state (avoids stale closure issues in callbacks)
  const isVoiceSessionActiveRef = useRef(false);

  // Voice feedback toast state (shows when command is not recognized)
  const [voiceFeedbackMessage, setVoiceFeedbackMessage] = useState<string | null>(null);
  const voiceFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Contact selection modal state (for multi-match disambiguation)
  const [contactSelectionVisible, setContactSelectionVisible] = useState(false);
  const [contactSelectionMatches, setContactSelectionMatches] = useState<ModalContactMatch[]>([]);
  const [contactSelectionSearchTerm, setContactSelectionSearchTerm] = useState('');
  const [contactSelectionMode, setContactSelectionMode] = useState<ContactSelectionMode>('action');
  const [pendingVoiceAction, setPendingVoiceAction] = useState<PendingVoiceAction | null>(null);
  // Note: Modal manages its own internal focus index via internalFocusIndex state
  const contactSelectionVoiceNavRef = useRef<{
    focusNext: () => void;
    focusPrevious: () => void;
    selectFocused: () => void;
  } | null>(null);
  // Ref to track modal visibility (avoids stale closure issues in callbacks)
  const contactSelectionVisibleRef = useRef(false);

  // Show feedback toast for unrecognized commands
  const showVoiceFeedback = useCallback((message: string) => {
    // Clear existing timer
    if (voiceFeedbackTimerRef.current) {
      clearTimeout(voiceFeedbackTimerRef.current);
    }

    setVoiceFeedbackMessage(message);

    // Auto-hide after 2.5 seconds
    voiceFeedbackTimerRef.current = setTimeout(() => {
      setVoiceFeedbackMessage(null);
    }, 2500);
  }, []);

  // Load saved mic position from user profile
  useEffect(() => {
    async function loadMicPosition() {
      try {
        if (!ServiceContainer.isInitialized) return;
        const profile = await ServiceContainer.database.getUserProfile();
        if (profile?.voiceMicPosition) {
          setMicIndicatorPosition(profile.voiceMicPosition as MicIndicatorPosition);
        }
      } catch (error) {
        console.error('[HoldToNavigate] Failed to load mic position:', error);
      }
    }
    void loadMicPosition();
  }, []);

  // Save mic position to user profile
  const saveMicPosition = useCallback(async (position: MicIndicatorPosition) => {
    try {
      if (!ServiceContainer.isInitialized) return;
      const profile = await ServiceContainer.database.getUserProfile();
      if (profile) {
        await ServiceContainer.database.saveUserProfile({
          ...profile,
          voiceMicPosition: position,
        });
      }
    } catch (error) {
      console.error('[HoldToNavigate] Failed to save mic position:', error);
    }
  }, []);

  // Press state for hold indicator (single finger)
  const [isPressing, setIsPressing] = useState(false);
  const [pressPosition, setPressPosition] = useState({ x: 0, y: 0 });
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMoved = useRef(false);
  const longPressCompleted = useRef(false);
  const startPosition = useRef({ x: 0, y: 0 });
  const isPressingRef = useRef(false);

  // Two-finger gesture state (for voice commands)
  // Uses SAME timing and movement threshold as single-finger
  const [isTwoFingerPressing, setIsTwoFingerPressing] = useState(false);
  const twoFingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const twoFingerMoved = useRef(false);
  const twoFingerStartPosition = useRef({ x: 0, y: 0 });
  const isTwoFingerPressingRef = useRef(false);
  const currentTouchCount = useRef(0);

  // Track individual finger positions for two separate indicators
  const [finger1Position, setFinger1Position] = useState({ x: 0, y: 0 });
  const [finger2Position, setFinger2Position] = useState({ x: 0, y: 0 });

  // Track wrapper's screen position for coordinate conversion
  // On iPad with sidebar layout, the wrapper doesn't start at (0,0)
  // We need to subtract this offset from pageX/pageY to get local coordinates
  const wrapperOffset = useRef({ x: 0, y: 0 });

  // Delay before committing to single-finger gesture (allows second finger to arrive)
  // On physical devices, fingers don't arrive at exactly the same time
  const twoFingerDetectionDelay = 80; // ms to wait for second finger
  const singleFingerDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Voice command callback refs - declared early so they can be used in startTwoFingerGesture
  const clearCallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRegisteredRef = useRef(false);
  const handleVoiceCommandResultRef = useRef<((result: any) => void) | null>(null);

  // CRITICAL: Refs for voiceCommands functions to avoid stale closures in setTimeout
  // When setTimeout fires after 800ms, the voiceCommands object in the closure may be stale
  // Using refs ensures we always call the most recent version of these functions
  const setOnResultReadyRef = useRef(voiceCommands.setOnResultReady);
  const startListeningRef = useRef(voiceCommands.startListening);
  const clearStateRef = useRef(voiceCommands.clearState);
  const setProcessingStateRef = useRef(voiceCommands.setProcessingState);

  // Keep refs updated with latest function references
  useEffect(() => {
    setOnResultReadyRef.current = voiceCommands.setOnResultReady;
    startListeningRef.current = voiceCommands.startListening;
    clearStateRef.current = voiceCommands.clearState;
    setProcessingStateRef.current = voiceCommands.setProcessingState;
  }, [voiceCommands.setOnResultReady, voiceCommands.startListening, voiceCommands.clearState, voiceCommands.setProcessingState]);

  // Ref to hold voiceCommands functions to avoid dependency on the object
  const voiceCommandsRef = useRef(voiceCommands);
  useEffect(() => {
    voiceCommandsRef.current = voiceCommands;
  }, [voiceCommands]);

  // Register callback to be notified when VoiceFocusContext session ends (timeout)
  // This ensures we stop the microphone when the session times out
  // NOTE: We use voiceCommandsRef to avoid re-registering on every voiceCommands change
  useEffect(() => {
    const handleSessionEnd = () => {
      console.log('[HoldToNavigate] Session end callback received from VoiceFocusContext');
      // Stop microphone and clear state
      setIsVoiceSessionActive(false);
      isVoiceSessionActiveRef.current = false;
      voiceCommandsRef.current.stopListening();
      voiceCommandsRef.current.clearState();
      // Clear callback
      callbackRegisteredRef.current = false;
      setOnResultReadyRef.current(null);
      // Clear any pending restart timer
      if (voiceSessionRestartTimerRef.current) {
        clearTimeout(voiceSessionRestartTimerRef.current);
        voiceSessionRestartTimerRef.current = null;
      }
    };

    voiceFocus.registerSessionEndCallback(handleSessionEnd);

    return () => {
      voiceFocus.registerSessionEndCallback(null);
    };
  }, [voiceFocus.registerSessionEndCallback]);

  // Clear single-finger press timer helper
  const clearPressTimer = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  // Clear single-finger delay timer helper
  const clearSingleFingerDelayTimer = useCallback(() => {
    if (singleFingerDelayTimer.current) {
      clearTimeout(singleFingerDelayTimer.current);
      singleFingerDelayTimer.current = null;
    }
  }, []);

  // Clear two-finger press timer helper
  const clearTwoFingerTimer = useCallback(() => {
    if (twoFingerTimer.current) {
      clearTimeout(twoFingerTimer.current);
      twoFingerTimer.current = null;
    }
  }, []);

  // Clear all gesture state (used when gesture is cancelled or completed)
  const clearAllGestureState = useCallback(() => {
    clearSingleFingerDelayTimer();
    clearPressTimer();
    clearTwoFingerTimer();
    setIsPressing(false);
    setIsTwoFingerPressing(false);
    isPressingRef.current = false;
    isTwoFingerPressingRef.current = false;
    currentTouchCount.current = 0;
  }, [clearSingleFingerDelayTimer, clearPressTimer, clearTwoFingerTimer]);

  // Touch handlers that OBSERVE touches without consuming them
  // This allows normal app interaction while detecting long presses
  //
  // Gesture detection:
  // - 1 finger long-press: Opens navigation wheel
  // - 2 finger long-press: Opens voice command overlay (SAME timing & threshold)
  // Helper function to start two-finger gesture
  const startTwoFingerGesture = useCallback((touches: any[], pageX: number, pageY: number) => {
    // Cancel any single-finger gesture (including the delay timer)
    clearSingleFingerDelayTimer();
    clearPressTimer();
    setIsPressing(false);
    isPressingRef.current = false;

    // Only proceed if voice commands are enabled
    if (!voiceCommands.settings.enabled) {
      return;
    }

    // Get individual finger positions
    const touch1 = touches?.[0];
    const touch2 = touches?.[1];

    // Convert absolute screen coordinates to local coordinates
    // This is needed for iPad Split View where the wrapper doesn't start at (0,0)
    const offsetX = wrapperOffset.current.x;
    const offsetY = wrapperOffset.current.y;

    // Store individual finger positions for rendering two indicators (using local coordinates)
    if (touch1) {
      setFinger1Position({ x: touch1.pageX - offsetX, y: touch1.pageY - offsetY });
    }
    if (touch2) {
      setFinger2Position({ x: touch2.pageX - offsetX, y: touch2.pageY - offsetY });
    }

    // Calculate center point between two fingers (for start position tracking)
    // Note: pageX/pageY passed in are already converted to local coordinates
    const centerX = touch1 && touch2 ? ((touch1.pageX - offsetX) + (touch2.pageX - offsetX)) / 2 : pageX;
    const centerY = touch1 && touch2 ? ((touch1.pageY - offsetY) + (touch2.pageY - offsetY)) / 2 : pageY;

    twoFingerStartPosition.current = { x: centerX, y: centerY };
    setPressPosition({ x: centerX, y: centerY });
    setIsTwoFingerPressing(true);
    isTwoFingerPressingRef.current = true;
    twoFingerMoved.current = false;

    // Start two-finger long press timer
    clearTwoFingerTimer();
    twoFingerTimer.current = setTimeout(() => {
      if (!twoFingerMoved.current && isTwoFingerPressingRef.current && currentTouchCount.current === 2) {
        triggerHaptic();
        setIsTwoFingerPressing(false);
        isTwoFingerPressingRef.current = false;

        // CRITICAL: Mark gesture as consumed BEFORE opening overlay
        // This prevents underlying onPress handlers from firing when fingers are released
        holdGesture?.consumeGesture();

        // Register callback BEFORE opening overlay to ensure it's ready for results
        // CRITICAL: Use refs instead of voiceCommands directly to avoid stale closures
        callbackRegisteredRef.current = true;
        setOnResultReadyRef.current((result) => {
          if (handleVoiceCommandResultRef.current) {
            handleVoiceCommandResultRef.current(result);
          }
        });

        setIsVoiceOverlayVisible(true);
        startListeningRef.current();
      }
    }, settings.longPressDelay);
  }, [
    clearSingleFingerDelayTimer,
    clearPressTimer,
    clearTwoFingerTimer,
    voiceCommands.settings.enabled, // Only depend on the enabled setting, not the whole object
    triggerHaptic,
    settings.longPressDelay,
    holdGesture,
  ]);

  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    console.log('[HoldToNavigate] handleTouchStart:', {
      enabled,
      isNavigationMenuOpen,
      isVoiceOverlayVisible,
      touchCount: event.nativeEvent.touches?.length ?? 1,
    });
    if (!enabled || isNavigationMenuOpen || isVoiceOverlayVisible) return;

    // Convert absolute screen coordinates to local coordinates
    // This is needed for iPad Split View where the wrapper doesn't start at (0,0)
    const rawPageX = event.nativeEvent.pageX;
    const rawPageY = event.nativeEvent.pageY;
    const pageX = rawPageX - wrapperOffset.current.x;
    const pageY = rawPageY - wrapperOffset.current.y;

    const touches = event.nativeEvent.touches;
    const touchCount = touches?.length ?? 1;
    const previousTouchCount = currentTouchCount.current;

    // Track current touch count
    currentTouchCount.current = touchCount;

    // IMPORTANT: Detect transition from 1 to 2 fingers in touchStart
    // This happens when second finger is added on iOS
    if (previousTouchCount === 1 && touchCount === 2) {
      startTwoFingerGesture(touches as any, pageX, pageY);
      return;
    }

    // Handle based on touch count
    if (touchCount === 1) {
      // SINGLE FINGER: Navigation wheel gesture
      // But wait briefly in case a second finger is coming (for two-finger gesture)
      // Check if touch is valid (not in edge zone) - use raw coordinates for edge detection
      const touchValid = isTouchValid(rawPageX, rawPageY, 1);
      console.log('[HoldToNavigate] Touch validity check:', {
        rawPageX,
        rawPageY,
        touchValid,
      });
      if (!touchValid) {
        return;
      }

      // Store position for potential gesture (use local coordinates for indicator)
      startPosition.current = { x: pageX, y: pageY };
      setPressPosition({ x: pageX, y: pageY });
      hasMoved.current = false;
      longPressCompleted.current = false;

      // Wait briefly to see if a second finger arrives
      // This prevents race condition where first finger starts gesture before second arrives
      clearSingleFingerDelayTimer();
      singleFingerDelayTimer.current = setTimeout(() => {
        // Only start single-finger gesture if still only 1 finger
        if (currentTouchCount.current === 1 && !hasMoved.current) {
          setIsPressing(true);
          isPressingRef.current = true;

          // Start long press timer - opens wheel directly when complete
          clearPressTimer();
          pressTimer.current = setTimeout(() => {
            console.log('[HoldToNavigate] Long press timer fired:', {
              hasMoved: hasMoved.current,
              isPressing: isPressingRef.current,
              touchCount: currentTouchCount.current,
            });
            if (!hasMoved.current && isPressingRef.current && currentTouchCount.current === 1) {
              console.log('[HoldToNavigate] All checks passed, opening navigation menu');
              longPressCompleted.current = true;
              triggerHaptic();
              setIsPressing(false);
              isPressingRef.current = false;
              // CRITICAL: Mark gesture as consumed BEFORE opening menu
              // This prevents underlying onPress handlers from firing when finger is released
              holdGesture?.consumeGesture();
              openNavigationMenu();
            }
          }, settings.longPressDelay - twoFingerDetectionDelay); // Subtract delay already waited
        }
      }, twoFingerDetectionDelay);

    } else if (touchCount === 2) {
      // TWO FINGERS: Voice command gesture (both fingers started at same time)
      startTwoFingerGesture(touches as any, pageX, pageY);
    } else {
      // 3+ fingers: Cancel all gestures
      clearAllGestureState();
    }
  }, [
    enabled,
    isNavigationMenuOpen,
    isVoiceOverlayVisible,
    isTouchValid,
    settings.longPressDelay,
    openNavigationMenu,
    triggerHaptic,
    clearSingleFingerDelayTimer,
    clearPressTimer,
    clearAllGestureState,
    startTwoFingerGesture,
    holdGesture,
  ]);

  const handleTouchMove = useCallback((event: GestureResponderEvent) => {
    // Convert absolute screen coordinates to local coordinates
    // This is needed for iPad Split View where the wrapper doesn't start at (0,0)
    const rawPageX = event.nativeEvent.pageX;
    const rawPageY = event.nativeEvent.pageY;
    const pageX = rawPageX - wrapperOffset.current.x;
    const pageY = rawPageY - wrapperOffset.current.y;

    const touches = event.nativeEvent.touches;
    const touchCount = touches?.length ?? 1;
    const previousTouchCount = currentTouchCount.current;

    // Update touch count
    currentTouchCount.current = touchCount;

    // IMPORTANT: Detect when second finger is added during a gesture
    // onTouchStart may not be called again when second finger arrives on some devices
    if (previousTouchCount === 1 && touchCount === 2) {
      hasMoved.current = false;
      startTwoFingerGesture(touches as any, pageX, pageY);
      return;
    }

    // Also detect if we somehow jumped directly to 2 fingers
    if (previousTouchCount === 0 && touchCount === 2) {
      hasMoved.current = false;
      startTwoFingerGesture(touches as any, pageX, pageY);
      return;
    }

    // Handle single-finger movement (including during delay period)
    if (touchCount === 1) {
      const dx = pageX - startPosition.current.x;
      const dy = pageY - startPosition.current.y;

      // Cancel if moved more than 10px (SAME threshold)
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        hasMoved.current = true;
        // Cancel both the delay timer and the long press timer
        clearSingleFingerDelayTimer();
        clearPressTimer();
        setIsPressing(false);
        isPressingRef.current = false;
      }
    }

    // Handle two-finger movement (SAME 10px threshold)
    if (isTwoFingerPressingRef.current && touchCount === 2) {
      // Calculate center point between two fingers (using local coordinates)
      const touch1 = touches?.[0];
      const touch2 = touches?.[1];
      const offsetX = wrapperOffset.current.x;
      const offsetY = wrapperOffset.current.y;
      const centerX = touch1 && touch2 ? ((touch1.pageX - offsetX) + (touch2.pageX - offsetX)) / 2 : pageX;
      const centerY = touch1 && touch2 ? ((touch1.pageY - offsetY) + (touch2.pageY - offsetY)) / 2 : pageY;

      const dx = centerX - twoFingerStartPosition.current.x;
      const dy = centerY - twoFingerStartPosition.current.y;

      // Cancel if moved more than 10px (SAME threshold as single-finger)
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        twoFingerMoved.current = true;
        setIsTwoFingerPressing(false);
        isTwoFingerPressingRef.current = false;
        clearTwoFingerTimer();
      }
    }

    // If touch count changed during move, cancel all gestures
    if (touchCount !== 1 && touchCount !== 2) {
      clearAllGestureState();
    }
  }, [
    clearSingleFingerDelayTimer,
    clearPressTimer,
    clearTwoFingerTimer,
    clearAllGestureState,
    startTwoFingerGesture,
  ]);

  const handleTouchEnd = useCallback(() => {
    // Clear all gesture state on touch end
    clearAllGestureState();
  }, [clearAllGestureState]);

  // Handle navigation from menu (also used by voice commands)
  // Uses PaneContext to switch the 'main' pane's module
  const handleNavigate = useCallback(
    (destination: NavigationDestination, _resetStack: boolean = false) => {
      closeNavigationMenu();

      // Switch the main pane to the requested module
      console.log('[HoldToNavigate] Navigating to module:', destination);
      paneCtx.setPaneModule('main', destination);
    },
    [paneCtx, closeNavigationMenu],
  );

  // Handle menu close
  const handleCloseMenu = useCallback(() => {
    closeNavigationMenu();
  }, [closeNavigationMenu]);

  // Note: clearCallbackTimeoutRef, callbackRegisteredRef and isVoiceSessionActiveRef are declared earlier (near top of component)

  // Keep isVoiceSessionActiveRef in sync with state
  useEffect(() => {
    isVoiceSessionActiveRef.current = isVoiceSessionActive;
  }, [isVoiceSessionActive]);

  // Keep contactSelectionVisibleRef in sync with state
  useEffect(() => {
    contactSelectionVisibleRef.current = contactSelectionVisible;
    console.log('[HoldToNavigate] contactSelectionVisibleRef updated:', contactSelectionVisible);
  }, [contactSelectionVisible]);

  // Stop Voice Session Mode
  const stopVoiceSession = useCallback(() => {
    console.log('[HoldToNavigate] Stopping Voice Session Mode');
    setIsVoiceSessionActive(false);
    isVoiceSessionActiveRef.current = false; // Update ref immediately
    voiceFocus.stopVoiceSession(); // Notify VoiceFocusContext
    voiceCommands.stopListening();
    voiceCommands.clearState();

    // Clear the callback when stopping voice session
    callbackRegisteredRef.current = false;
    setOnResultReadyRef.current(null);

    // Clear any pending restart timer
    if (voiceSessionRestartTimerRef.current) {
      clearTimeout(voiceSessionRestartTimerRef.current);
      voiceSessionRestartTimerRef.current = null;
    }
  }, [voiceCommands, voiceFocus]);

  // Restart listening in Voice Session Mode (after processing a command)
  // Uses refs instead of state to avoid stale closure issues when called immediately after setState
  const restartVoiceSessionListening = useCallback(() => {
    console.log('[HoldToNavigate] restartVoiceSessionListening called, isVoiceSessionActiveRef:', isVoiceSessionActiveRef.current);
    // First, stop any current listening to avoid race conditions
    voiceCommands.stopListening();

    // Set processing state during the delay (shows ⏳ indicator)
    // This gives visual feedback that the system is "thinking" before restarting
    setProcessingStateRef.current?.(true);

    // Delay before restarting to allow iOS speech recognition to fully stop
    // iOS needs time to release the audio session before starting a new one
    voiceSessionRestartTimerRef.current = setTimeout(() => {
      // Don't restart if app went to background or voice session was stopped
      if (!isVoiceSessionActiveRef.current) {
        console.log('[HoldToNavigate] Voice session no longer active, skipping restart');
        setProcessingStateRef.current?.(false);
        return;
      }

      if (appStateRef.current !== 'active') {
        console.log('[HoldToNavigate] App not active, skipping voice restart');
        setProcessingStateRef.current?.(false);
        return;
      }

      console.log('[HoldToNavigate] Restarting listening in Voice Session Mode (idle until speech)');

      // Re-register callback before starting to listen
      // This ensures the callback is ready for session_control commands like "volgende"
      callbackRegisteredRef.current = true;
      setOnResultReadyRef.current((result) => {
        if (handleVoiceCommandResultRef.current) {
          handleVoiceCommandResultRef.current(result);
        }
      });

      // Use forceRestart=true to bypass the isListening check
      // Note: startListening now sets isListening=false initially (idle state)
      // The mic will start pulsing when user actually starts speaking (onSpeechStart event)
      startListeningRef.current(true);
    }, 800); // Increased delay to 800ms for iOS audio session release
  }, [voiceCommands.stopListening]);

  // Execute a contact action (call or message)
  // Extracted to avoid code duplication between single match and modal selection
  const executeContactAction = useCallback(
    (contact: Contact, action: 'call' | 'message') => {
      // Generate chat ID for this contact (format: chat:jid1:jid2 sorted)
      const myJid = 'ik@commeazy.local'; // TODO: Get from chat service
      const chatId = `chat:${[myJid, contact.jid].sort().join(':')}`;

      if (action === 'message') {
        // Navigate to chats module with pending deep navigation to ChatDetail
        console.log('[HoldToNavigate] Navigating to chat with:', contact.name, 'chatId:', chatId);
        paneCtx.setPaneModule('main', 'chats', {
          screen: 'ChatDetail',
          params: { chatId, name: contact.name },
        });
      } else if (action === 'call') {
        // Navigate to contacts module with pending deep navigation to ContactDetail
        // TODO: Implement direct call when AudioCall screen is ready
        console.log('[HoldToNavigate] Navigating to contact for call:', contact.name);
        paneCtx.setPaneModule('main', 'contacts', {
          screen: 'ContactDetail',
          params: { jid: contact.jid },
        });
      }
    },
    [paneCtx]
  );

  // Track if we've already started voice listening for this modal session
  // This prevents the infinite loop where state changes re-trigger handler registration
  const modalVoiceStartedRef = useRef(false);

  // Handle contact selection from modal
  const handleContactSelect = useCallback(
    (contact: Contact) => {
      console.log('[HoldToNavigate] Contact selected from modal:', contact.name);
      setContactSelectionVisible(false);
      contactSelectionVisibleRef.current = false; // Update ref immediately
      modalVoiceStartedRef.current = false; // Reset for next modal session

      if (contactSelectionMode === 'action' && pendingVoiceAction) {
        // Execute the pending action with the selected contact
        executeContactAction(contact, pendingVoiceAction.action);
        setPendingVoiceAction(null);
      } else if (contactSelectionMode === 'listNavigation') {
        // Focus on the selected item in the list
        // The item's onSelect callback should have been stored in the FuzzyMatchResult
        // For now, just focus by ID
        voiceFocus.focusById(contact.jid);
      }

      // Continue voice session
      restartVoiceSessionListening();
    },
    [contactSelectionMode, pendingVoiceAction, executeContactAction, voiceFocus, restartVoiceSessionListening]
  );

  // Handle "Bekijk contacten" from modal (when no matches found)
  const handleBrowseContacts = useCallback(() => {
    console.log('[HoldToNavigate] Browse contacts requested from modal');
    setContactSelectionVisible(false);
    contactSelectionVisibleRef.current = false; // Update ref immediately
    modalVoiceStartedRef.current = false; // Reset for next modal session
    setPendingVoiceAction(null);

    // Navigate to contacts module
    paneCtx.setPaneModule('main', 'contacts');

    // Continue voice session
    restartVoiceSessionListening();
  }, [paneCtx, restartVoiceSessionListening]);

  // Handle modal close
  const handleContactSelectionClose = useCallback(() => {
    console.log('[HoldToNavigate] Contact selection modal closed');
    setContactSelectionVisible(false);
    contactSelectionVisibleRef.current = false; // Update ref immediately
    modalVoiceStartedRef.current = false; // Reset for next modal session
    setPendingVoiceAction(null);

    // Continue voice session
    restartVoiceSessionListening();
  }, [restartVoiceSessionListening]);

  // Register voice navigation handlers for modal
  // CRITICAL: This is called when the modal mounts and registers its handlers
  // We need to restart voice listening after handlers are ready to avoid race conditions
  const handleRegisterModalVoiceNav = useCallback(
    (handlers: {
      focusNext: () => void;
      focusPrevious: () => void;
      selectFocused: () => void;
    }) => {
      // Store handlers
      contactSelectionVoiceNavRef.current = handlers;

      // Only start voice listening ONCE per modal session
      // The modal's useEffect will call this multiple times due to dependency changes,
      // but we only want to start listening once when the modal first opens
      if (!handlers || modalVoiceStartedRef.current) {
        return;
      }

      console.log('[HoldToNavigate] ========== MODAL VOICE NAV REGISTRATION (first time) ==========');
      console.log('[HoldToNavigate] isVoiceSessionActiveRef.current:', isVoiceSessionActiveRef.current);

      // Mark that we've started voice for this modal session
      modalVoiceStartedRef.current = true;

      // Cancel any existing restart timer to avoid double restart
      if (voiceSessionRestartTimerRef.current) {
        clearTimeout(voiceSessionRestartTimerRef.current);
        voiceSessionRestartTimerRef.current = null;
      }

      // Stop any current listening before restarting
      voiceCommands.stopListening();

      // Re-register callback to ensure it uses the latest handlers
      callbackRegisteredRef.current = true;
      setOnResultReadyRef.current((result) => {
        console.log('[HoldToNavigate] Modal callback received result:', result?.type);
        if (handleVoiceCommandResultRef.current) {
          handleVoiceCommandResultRef.current(result);
        }
      });

      // Restart listening with a delay to ensure native module is ready
      // Use longer delay (500ms) to ensure iOS speech recognizer has fully stopped
      voiceSessionRestartTimerRef.current = setTimeout(() => {
        console.log('[HoldToNavigate] Timeout fired - starting voice for modal');
        // Only check if session is active
        if (isVoiceSessionActiveRef.current) {
          console.log('[HoldToNavigate] *** STARTING VOICE LISTENING FOR MODAL ***');
          startListeningRef.current(true);
        } else {
          console.log('[HoldToNavigate] Voice session not active, skipping start');
        }
      }, 500);
    },
    [voiceCommands.stopListening]
  );

  // Handle voice commands while modal is open
  // This intercepts volgende/vorige/open commands and routes them to the modal
  useEffect(() => {
    if (contactSelectionVisible && contactSelectionVoiceNavRef.current) {
      // The modal is open - voice commands should control the modal
      // This is handled by session_control commands going to the modal handlers
    }
  }, [contactSelectionVisible]);

  // Handle voice command result (navigate to destination or perform action)
  const handleVoiceCommandResult = useCallback(
    (result: VoiceCommandResult | null) => {
      if (!result) return;

      // Cancel any pending callback clear timeout - we're handling the result now
      if (clearCallbackTimeoutRef.current) {
        clearTimeout(clearCallbackTimeoutRef.current);
        clearCallbackTimeoutRef.current = null;
      }

      console.log('[HoldToNavigate] Voice command result:', result.type, result);

      // Handle position change commands (Voice Session Mode)
      if (result.type === 'position_change' && result.position) {
        console.log('[HoldToNavigate] Changing mic position to:', result.position);
        setMicIndicatorPosition(result.position);
        void saveMicPosition(result.position);

        // If in voice session, restart listening
        if (isVoiceSessionActive) {
          restartVoiceSessionListening();
        }
        return;
      }

      // Handle session control commands (Voice Session Mode)
      if (result.type === 'session_control' && result.sessionAction) {
        console.log('[HoldToNavigate] ========== SESSION CONTROL ==========');
        console.log('[HoldToNavigate] Session action:', result.sessionAction);
        console.log('[HoldToNavigate] isVoiceSessionActive:', isVoiceSessionActive);
        console.log('[HoldToNavigate] isVoiceSessionActiveRef:', isVoiceSessionActiveRef.current);
        console.log('[HoldToNavigate] voiceFocus activeListId:', voiceFocus.activeListId);
        // Use ref for modal visibility to avoid stale closure issues
        const modalVisible = contactSelectionVisibleRef.current;
        const hasModalHandlers = !!contactSelectionVoiceNavRef.current;
        console.log('[HoldToNavigate] contactSelectionVisibleRef:', modalVisible, 'hasHandlers:', hasModalHandlers);
        if (hasModalHandlers) {
          console.log('[HoldToNavigate] Modal handlers:', Object.keys(contactSelectionVoiceNavRef.current!));
        }
        console.log('[HoldToNavigate] =====================================');

        switch (result.sessionAction) {
          case 'stop':
            // Stop voice session completely
            setIsVoiceOverlayVisible(false);
            stopVoiceSession();
            break;

          case 'back':
            // Go back within the pane's inner navigation stack
            // TODO: Implement via PaneContext goBack mechanism
            DeviceEventEmitter.emit('pane:goBack', { paneId: 'main' });
            // Continue listening in session mode
            if (isVoiceSessionActive) {
              restartVoiceSessionListening();
            }
            break;

          case 'next':
            // Navigate to next item in voice-focusable list (or modal)
            console.log('[HoldToNavigate] Focus next item, modalVisible:', modalVisible);
            if (modalVisible && contactSelectionVoiceNavRef.current) {
              // Modal is open - navigate within modal
              contactSelectionVoiceNavRef.current.focusNext();
            } else {
              voiceFocus.focusNext();
            }
            if (isVoiceSessionActive) {
              restartVoiceSessionListening();
            }
            break;

          case 'previous':
            // Navigate to previous item in voice-focusable list (or modal)
            console.log('[HoldToNavigate] Focus previous item, modalVisible:', modalVisible);
            if (modalVisible && contactSelectionVoiceNavRef.current) {
              // Modal is open - navigate within modal
              contactSelectionVoiceNavRef.current.focusPrevious();
            } else {
              voiceFocus.focusPrevious();
            }
            if (isVoiceSessionActive) {
              restartVoiceSessionListening();
            }
            break;

          case 'select':
            // Select the currently focused item (or modal selection)
            console.log('[HoldToNavigate] Select focused item, modalVisible:', modalVisible);
            if (modalVisible && contactSelectionVoiceNavRef.current) {
              // Modal is open - select from modal
              contactSelectionVoiceNavRef.current.selectFocused();
            } else {
              voiceFocus.selectFocused();
            }
            // Keep voice session active - user may want to give commands on the new screen
            // e.g., "bel Oma", "stuur bericht", etc.
            if (isVoiceSessionActive) {
              restartVoiceSessionListening();
            }
            break;

          case 'send':
            // Trigger send message in ChatScreen
            // Uses DeviceEventEmitter to communicate with ChatScreen
            console.log('[HoldToNavigate] Triggering send message');
            DeviceEventEmitter.emit('voiceCommand:send');
            if (isVoiceSessionActive) {
              restartVoiceSessionListening();
            }
            break;

          // Form interaction commands (VoiceFormContext)
          case 'edit':
            // "pas aan [veldnaam]" - extract field name from raw text
            // The raw text after removing the command pattern is the field name
            console.log('[HoldToNavigate] Form edit command, rawText:', result.rawText);
            // For now, just focus the active field. Future: parse field name from rawText
            if (voiceForm.activeFieldId) {
              const field = voiceForm.focusFieldByName(result.rawText);
              if (field.length === 0) {
                showVoiceFeedback('Geen veld gevonden');
              }
            } else {
              showVoiceFeedback('Zeg "pas aan [veldnaam]"');
            }
            if (isVoiceSessionActive) {
              restartVoiceSessionListening();
            }
            break;

          case 'clear':
            // "wis" - clear the active field
            console.log('[HoldToNavigate] Form clear command');
            voiceForm.clearActiveField();
            if (isVoiceSessionActive) {
              restartVoiceSessionListening();
            }
            break;

          case 'dictate':
            // "dicteer" - start dictation for active field
            console.log('[HoldToNavigate] Form dictate command');
            voiceForm.startDictation();
            // Note: Don't restart listening - dictation takes over the mic
            break;

          case 'confirm':
            // "bevestig" - submit the active form
            console.log('[HoldToNavigate] Form confirm command');
            voiceForm.submitForm();
            if (isVoiceSessionActive) {
              restartVoiceSessionListening();
            }
            break;
        }
        return;
      }

      // Reset callback registered flag so next time overlay opens, callback will be registered again
      callbackRegisteredRef.current = false;

      if (result.type === 'navigation' && result.destination) {
        // Close voice overlay and navigate
        setIsVoiceOverlayVisible(false);

        // Start Voice Session Mode if this is the first navigation from overlay
        if (!isVoiceSessionActive) {
          console.log('[HoldToNavigate] Starting Voice Session Mode');
          setIsVoiceSessionActive(true);
          isVoiceSessionActiveRef.current = true; // Update ref immediately for restartVoiceSessionListening
          voiceFocus.startVoiceSession(); // Notify VoiceFocusContext to register lists

          // Register callback for Voice Session Mode
          setOnResultReadyRef.current((sessionResult) => {
            if (handleVoiceCommandResultRef.current) {
              handleVoiceCommandResultRef.current(sessionResult);
            }
          });
        }

        // Check if we're already in the target module (same-module = reset focus)
        if (result.destination === currentModuleId) {
          // Same module - reset focus to first item
          console.log('[HoldToNavigate] Same module, resetting focus to first item');
          voiceFocus.resetFocusToFirst();
        } else {
          // Different module - navigate via pane context
          console.log('[HoldToNavigate] Navigating to module:', result.destination, 'from:', currentModuleId);
          handleNavigate(result.destination);
        }

        // Continue listening after navigation
        restartVoiceSessionListening();
      } else if (result.type === 'action' && result.contactName) {
        // Handle call/message action - look up contact and navigate
        // MULTI-MATCH: If multiple contacts match, show selection modal
        console.log('[HoldToNavigate] Voice action:', result.action, 'to', result.contactName);
        setIsVoiceOverlayVisible(false);

        // Start Voice Session Mode
        if (!isVoiceSessionActive) {
          setIsVoiceSessionActive(true);
          isVoiceSessionActiveRef.current = true;
          voiceFocus.startVoiceSession();
        }

        // Async contact lookup and navigation
        (async () => {
          const matches = await findAllContactsByName(result.contactName!);

          if (matches.length === 1) {
            // Single match - proceed directly
            const contact = matches[0].contact;
            executeContactAction(contact, result.action as 'call' | 'message');
            restartVoiceSessionListening();
          } else if (matches.length > 1) {
            // Multiple matches - show selection modal
            console.log('[HoldToNavigate] Multiple matches found, showing selection modal');
            setContactSelectionMatches(matches);
            setContactSelectionSearchTerm(result.contactName!);
            setContactSelectionMode('action');
            setPendingVoiceAction({
              action: result.action as 'call' | 'message',
              searchTerm: result.contactName!,
            });
            // Clear previous handlers and reset voice started flag before opening modal
            contactSelectionVoiceNavRef.current = null;
            modalVoiceStartedRef.current = false; // Reset so handlers can start voice
            setContactSelectionVisible(true);
            contactSelectionVisibleRef.current = true; // Update ref immediately
            // NOTE: Don't restart listening here - let handleRegisterModalVoiceNav do it
            // after the handlers are registered. This prevents race conditions.
            console.log('[HoldToNavigate] Modal opened, waiting for handler registration before starting voice');
          } else {
            // No matches - show modal with browse option
            console.log('[HoldToNavigate] No matches found, showing not found modal');
            setContactSelectionMatches([]);
            setContactSelectionSearchTerm(result.contactName!);
            setContactSelectionMode('action');
            setPendingVoiceAction({
              action: result.action as 'call' | 'message',
              searchTerm: result.contactName!,
            });
            // Clear previous handlers and reset voice started flag before opening modal
            contactSelectionVoiceNavRef.current = null;
            modalVoiceStartedRef.current = false; // Reset so handlers can start voice
            setContactSelectionVisible(true);
            contactSelectionVisibleRef.current = true; // Update ref immediately
            // NOTE: Don't restart listening here - handlers will do it
            console.log('[HoldToNavigate] No match modal opened, waiting for handler registration');
          }
        })();
      } else if (result.type === 'unknown') {
        // Unknown command - try direct name matching for voice session
        // This allows users to say "Oma" to focus on contact "Oma" in a list
        // MULTI-MATCH: If multiple items match, show selection modal
        // CRITICAL: Use refs instead of direct context access to avoid stale closure issues
        const sessionActive = isVoiceSessionActiveRef.current;
        const currentActiveListId = voiceFocusActiveListIdRef.current;
        console.log('[HoldToNavigate] Unknown command:', result.rawText, 'isVoiceSessionActive (ref):', sessionActive, 'activeListId (ref):', currentActiveListId);

        if (sessionActive) {
          // Use focusByNameRef to get the latest function that has access to current activeList
          const matches = focusByNameRef.current(result.rawText);

          if (matches.length === 1 || (matches.length > 0 && matches[0].score > 0.95)) {
            // Single match or very confident match - focus directly
            console.log('[HoldToNavigate] Single/confident match:', matches[0].item.label, 'score:', matches[0].score);
            // Focus was already set by focusByName
            restartVoiceSessionListening();
          } else if (matches.length > 1) {
            // Multiple matches - show selection modal
            console.log('[HoldToNavigate] Multiple list matches found, showing selection modal');

            // Convert VoiceFocusContext matches to ContactMatch format
            // Note: We need to fetch contact details for each match
            (async () => {
              // For list navigation, we need to convert FuzzyMatchResult to contact-like format
              // Each match has item.id (contact jid), item.label (contact name), item.onSelect
              const contactMatches: ModalContactMatch[] = matches.map((match) => ({
                contact: {
                  jid: match.item.id,
                  name: match.item.label,
                  // Other fields will be undefined, but modal only uses jid, name, avatarUrl
                } as Contact,
                score: match.score,
              }));

              setContactSelectionMatches(contactMatches);
              setContactSelectionSearchTerm(result.rawText);
              setContactSelectionMode('listNavigation');
              setPendingVoiceAction(null); // No action, just focus selection
              // Clear previous handlers and reset voice started flag before opening modal
              contactSelectionVoiceNavRef.current = null;
              modalVoiceStartedRef.current = false; // Reset so handlers can start voice
              setContactSelectionVisible(true);
              contactSelectionVisibleRef.current = true; // Update ref immediately
              // NOTE: Don't restart listening here - handlers will do it
              console.log('[HoldToNavigate] List nav modal opened, waiting for handler registration');
            })();
          } else {
            // No matches
            console.log('[HoldToNavigate] No name match for:', result.rawText);
            showVoiceFeedback(`"${result.rawText}" niet herkend`);
            restartVoiceSessionListening();
          }
        } else {
          // Not in voice session - just log
          console.log('[HoldToNavigate] Unknown command but not in voice session, ignoring');
        }
      }
    },
    [
      handleNavigate,
      isVoiceSessionActive,
      currentModuleId,
      saveMicPosition,
      stopVoiceSession,
      restartVoiceSessionListening,
      voiceFocus,
      voiceForm,
      showVoiceFeedback,
      executeContactAction,
      // Note: contactSelectionVisible is NOT in dependencies because we use contactSelectionVisibleRef
      // This avoids stale closure issues when the callback is called after state changes
    ],
  );

  // Update refs with latest values (refs are declared earlier in the component)
  useEffect(() => {
    handleVoiceCommandResultRef.current = handleVoiceCommandResult;
  }, [handleVoiceCommandResult]);

  // Handle voice overlay close
  // IMPORTANT: Do NOT clear the callback here - iOS may still send final results after stop
  const handleVoiceOverlayClose = useCallback(() => {
    setIsVoiceOverlayVisible(false);
    voiceCommands.stopListening();
    // Also stop Voice Session Mode if active
    if (isVoiceSessionActive) {
      stopVoiceSession();
    }
  }, [voiceCommands.stopListening, isVoiceSessionActive, stopVoiceSession]);

  // Handle floating mic indicator press (stop Voice Session Mode)
  const handleMicIndicatorPress = useCallback(() => {
    console.log('[HoldToNavigate] Mic indicator pressed, stopping Voice Session Mode');
    stopVoiceSession();
  }, [stopVoiceSession]);

  // Note: callbackRegisteredRef and clearCallbackTimeoutRef are declared earlier (before handleVoiceCommandResult)

  // Handle callback cleanup when overlay closes
  // IMPORTANT: Do NOT clear callback if Voice Session Mode is active - we need it for "volgende"/"vorige"
  useEffect(() => {
    if (isVoiceOverlayVisible) {
      // Cancel any pending clear timeout when overlay opens
      if (clearCallbackTimeoutRef.current) {
        clearTimeout(clearCallbackTimeoutRef.current);
        clearCallbackTimeoutRef.current = null;
      }
    } else if (!isVoiceOverlayVisible && callbackRegisteredRef.current && !isVoiceSessionActive) {
      // Only clear callback if NOT in Voice Session Mode
      // Delay clearing the callback to allow iOS to send final results
      clearCallbackTimeoutRef.current = setTimeout(() => {
        callbackRegisteredRef.current = false;
        setOnResultReadyRef.current(null);
        clearStateRef.current();
      }, 3000);
    }

    return () => {
      if (clearCallbackTimeoutRef.current) {
        clearTimeout(clearCallbackTimeoutRef.current);
      }
    };
  }, [isVoiceOverlayVisible, isVoiceSessionActive]);

  // Active screen is directly the module ID from pane context
  const activeScreen = currentModuleId as NavigationDestination | undefined;

  // Handle layout changes to track wrapper's screen position
  // This is needed for iPad Split View where the wrapper doesn't start at (0,0)
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    // Use measure() to get the wrapper's absolute screen position
    // LayoutChangeEvent only gives us relative dimensions, not screen position
    const { target } = event.nativeEvent;
    if (target) {
      // Cast to any to access measure() which isn't in TypeScript types
      const viewRef = event.target as any;
      if (viewRef && typeof viewRef.measure === 'function') {
        viewRef.measure((
          _x: number,
          _y: number,
          _width: number,
          _height: number,
          screenX: number,
          screenY: number
        ) => {
          wrapperOffset.current = { x: screenX, y: screenY };
          console.debug('[HoldToNavigate] Wrapper offset updated:', { x: screenX, y: screenY });
        });
      }
    }
  }, []);

  return (
    <View
      style={styles.container}
      onLayout={handleLayout}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Main content - receives all touches normally
          The touch handlers above observe but don't consume events */}
      <View style={styles.content}>
        {children}
      </View>

      {/* Hold indicator for single-finger (shows during long press) */}
      {isPressing && enabled && (
        <HoldIndicator
          isActive={isPressing}
          duration={settings.longPressDelay}
          x={pressPosition.x}
          y={pressPosition.y}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Two hold indicators for two-finger voice gesture - one per finger */}
      {isTwoFingerPressing && enabled && voiceCommands.settings.enabled && (
        <>
          {/* Indicator for finger 1 */}
          <HoldIndicator
            isActive={isTwoFingerPressing}
            duration={settings.longPressDelay}
            x={finger1Position.x}
            y={finger1Position.y}
            reducedMotion={reducedMotion}
          />
          {/* Indicator for finger 2 */}
          <HoldIndicator
            isActive={isTwoFingerPressing}
            duration={settings.longPressDelay}
            x={finger2Position.x}
            y={finger2Position.y}
            reducedMotion={reducedMotion}
          />
        </>
      )}

      {/* Navigation wheel overlay - opens directly after single-finger long press */}
      <WheelNavigationMenu
        visible={isNavigationMenuOpen}
        onNavigate={handleNavigate}
        onClose={handleCloseMenu}
        activeScreen={activeScreen}
      />

      {/* Voice command overlay - opens after two-finger long press */}
      <VoiceCommandOverlay
        visible={isVoiceOverlayVisible}
        voiceState={voiceCommands.state}
        onClose={handleVoiceOverlayClose}
        onResult={handleVoiceCommandResult}
        processTranscript={voiceCommands.processTranscript}
      />

      {/* Floating mic indicator - shown during Voice Session Mode (but NOT when modal is open) */}
      <FloatingMicIndicator
        visible={isVoiceSessionActive && !isVoiceOverlayVisible && !contactSelectionVisible}
        isListening={voiceCommands.state.isListening}
        isProcessing={voiceCommands.state.isProcessing}
        position={micIndicatorPosition}
        onPress={handleMicIndicatorPress}
        reducedMotion={reducedMotion}
      />

      {/* Contact selection modal - shown for multi-match disambiguation */}
      {/* NOTE: Modal renders its own FloatingMicIndicator inside so it appears above the modal */}
      {/* NOTE: voiceFocusedIndex is NOT passed - modal manages its own internal focus state */}
      <ContactSelectionModal
        visible={contactSelectionVisible}
        matches={contactSelectionMatches}
        searchTerm={contactSelectionSearchTerm}
        pendingAction={pendingVoiceAction?.action}
        mode={contactSelectionMode}
        onSelect={handleContactSelect}
        onBrowseContacts={handleBrowseContacts}
        onClose={handleContactSelectionClose}
        onRegisterVoiceNav={handleRegisterModalVoiceNav}
        isVoiceSessionActive={isVoiceSessionActive}
        isVoiceListening={voiceCommands.state.isListening}
        isVoiceProcessing={voiceCommands.state.isProcessing}
        micIndicatorPosition={micIndicatorPosition}
        onMicPress={handleMicIndicatorPress}
        reducedMotion={reducedMotion}
      />

      {/* Voice feedback toast - shows when command is not recognized */}
      {voiceFeedbackMessage && isVoiceSessionActive && (
        <View
          style={styles.voiceFeedbackToast}
          accessible={true}
          accessibilityLiveRegion="polite"
          accessibilityLabel={voiceFeedbackMessage}
        >
          <Text style={styles.voiceFeedbackText}>{voiceFeedbackMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  voiceFeedbackToast: {
    position: 'absolute',
    bottom: 120, // Above tab bar and mic indicator
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  voiceFeedbackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
