/**
 * HoldGestureContext — Prevents double-action on hold gestures
 *
 * When a user performs a long-press gesture (for navigation wheel or voice commands),
 * the underlying tappable element should NOT also trigger its onPress handler.
 *
 * This context provides:
 * - `isGestureConsumed`: true when a hold gesture just completed
 * - `consumeGesture()`: marks the gesture as consumed (called by HoldToNavigateWrapper)
 * - `useHoldGestureGuard()`: hook that wraps onPress handlers to skip when gesture consumed
 *
 * UI PRINCIPLE: When a long-press gesture completes, ONLY the hold action executes,
 * NOT both the hold action AND the underlying tap. This prevents accidental activations.
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { createContext, useContext, useRef, useCallback, useMemo } from 'react';

// ============================================================
// Types
// ============================================================

interface HoldGestureContextValue {
  /**
   * Check if a gesture was recently consumed (within the guard window).
   * Components should check this before executing onPress handlers.
   */
  isGestureConsumed: () => boolean;

  /**
   * Mark the current gesture as consumed.
   * Called by HoldToNavigateWrapper when a long-press completes.
   * The consumed state automatically resets after GESTURE_GUARD_MS.
   */
  consumeGesture: () => void;
}

// ============================================================
// Constants
// ============================================================

/**
 * Time window (in ms) during which onPress handlers should be blocked
 * after a hold gesture completes.
 *
 * This should be long enough to cover:
 * - The time between touchEnd and onPress firing
 * - Any animation or state update delays
 *
 * 300ms is safe: touchEnd to onPress is typically <100ms,
 * but we add buffer for slower devices.
 */
const GESTURE_GUARD_MS = 300;

// ============================================================
// Context
// ============================================================

const HoldGestureContext = createContext<HoldGestureContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface HoldGestureProviderProps {
  children: React.ReactNode;
}

export function HoldGestureProvider({ children }: HoldGestureProviderProps) {
  // Use ref for consumed timestamp to avoid re-renders
  // The timestamp approach allows us to check "was gesture consumed recently?"
  // without needing to manage clearing state with timeouts
  const consumedAtRef = useRef<number>(0);

  const isGestureConsumed = useCallback((): boolean => {
    const elapsed = Date.now() - consumedAtRef.current;
    const consumed = elapsed < GESTURE_GUARD_MS;
    if (consumed) {
      console.log('[HoldGestureContext] Gesture is consumed, blocking onPress (elapsed:', elapsed, 'ms)');
    }
    return consumed;
  }, []);

  const consumeGesture = useCallback((): void => {
    console.log('[HoldGestureContext] Gesture consumed, blocking onPress for', GESTURE_GUARD_MS, 'ms');
    consumedAtRef.current = Date.now();
  }, []);

  const value = useMemo(
    () => ({ isGestureConsumed, consumeGesture }),
    [isGestureConsumed, consumeGesture]
  );

  return (
    <HoldGestureContext.Provider value={value}>
      {children}
    </HoldGestureContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Access the HoldGestureContext directly.
 * Throws if used outside provider.
 */
export function useHoldGestureContext(): HoldGestureContextValue {
  const context = useContext(HoldGestureContext);
  if (!context) {
    throw new Error('useHoldGestureContext must be used within a HoldGestureProvider');
  }
  return context;
}

/**
 * Safe version that returns null if used outside provider.
 * Useful for components that may be rendered before provider is ready.
 */
export function useHoldGestureContextSafe(): HoldGestureContextValue | null {
  return useContext(HoldGestureContext);
}

/**
 * Hook that wraps an onPress handler to skip execution when a hold gesture was consumed.
 *
 * Usage:
 * ```tsx
 * const guardedOnPress = useHoldGestureGuard(onPress);
 * <TouchableOpacity onPress={guardedOnPress}>
 * ```
 *
 * When a hold gesture completes (user long-pressed to open menu/voice),
 * the wrapped handler will NOT execute, preventing double-action.
 */
export function useHoldGestureGuard<T extends (...args: any[]) => any>(
  handler: T | undefined
): T | undefined {
  const context = useHoldGestureContextSafe();

  return useMemo(() => {
    if (!handler) return undefined;

    // If no context (provider not mounted), return original handler
    if (!context) return handler;

    // Return wrapped handler that checks consumed state
    const guardedHandler = ((...args: Parameters<T>) => {
      if (context.isGestureConsumed()) {
        // Gesture was consumed by hold - skip this onPress
        return;
      }
      return handler(...args);
    }) as T;

    return guardedHandler;
  }, [handler, context]);
}
