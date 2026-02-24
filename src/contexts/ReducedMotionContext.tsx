/**
 * ReducedMotionContext — Centralized reduced motion accessibility state
 *
 * This context ensures that AccessibilityInfo.isReduceMotionEnabled() is only
 * called ONCE at app startup, instead of once per component that needs it.
 *
 * PROBLEM SOLVED:
 * When useReducedMotion was a standalone hook, each IconButton (500+ in a song list)
 * would call AccessibilityInfo.isReduceMotionEnabled(), causing:
 * "Excessive number of pending callbacks: 501"
 *
 * SOLUTION:
 * Single context provider at app root that shares the value with all consumers.
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

// ============================================================
// Types
// ============================================================

interface ReducedMotionContextValue {
  /** Whether reduced motion is enabled in system settings */
  isReducedMotion: boolean;
}

// ============================================================
// Context
// ============================================================

const ReducedMotionContext = createContext<ReducedMotionContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface ReducedMotionProviderProps {
  children: ReactNode;
}

/**
 * Provider that fetches reduced motion preference ONCE and shares with all consumers.
 * Must be placed at app root, above any components that use useReducedMotion.
 */
export function ReducedMotionProvider({ children }: ReducedMotionProviderProps) {
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    // Get initial value - only called ONCE
    AccessibilityInfo.isReduceMotionEnabled().then(setIsReducedMotion);

    // Listen for changes
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReducedMotion
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const value = useMemo(
    () => ({ isReducedMotion }),
    [isReducedMotion]
  );

  return (
    <ReducedMotionContext.Provider value={value}>
      {children}
    </ReducedMotionContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook that returns whether reduced motion is enabled.
 * Uses context for efficiency - avoids redundant native calls.
 *
 * @returns boolean indicating if reduced motion is preferred
 * @throws Error if used outside ReducedMotionProvider
 */
export function useReducedMotionContext(): boolean {
  const context = useContext(ReducedMotionContext);
  if (!context) {
    throw new Error('useReducedMotionContext must be used within ReducedMotionProvider');
  }
  return context.isReducedMotion;
}

/**
 * Safe hook that returns false if used outside provider.
 * Use this in components that may be rendered before provider is mounted.
 *
 * @returns boolean indicating if reduced motion is preferred (defaults to false)
 */
export function useReducedMotionSafe(): boolean {
  const context = useContext(ReducedMotionContext);
  return context?.isReducedMotion ?? false;
}

// ============================================================
// Exports
// ============================================================

export type { ReducedMotionContextValue };
