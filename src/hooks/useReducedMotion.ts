/**
 * useReducedMotion — Accessibility hook for reduced motion preference
 *
 * Respects the user's system preference for reduced motion.
 * When enabled, animations should be disabled or reduced.
 *
 * NOTE: This hook now uses ReducedMotionContext under the hood.
 * This ensures that AccessibilityInfo.isReduceMotionEnabled() is only
 * called ONCE at app startup, instead of once per component.
 *
 * The original implementation caused "Excessive number of pending callbacks"
 * when used in list items (500+ IconButtons in a song list).
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 * @see src/contexts/ReducedMotionContext.tsx
 */

import { useReducedMotionSafe } from '@/contexts/ReducedMotionContext';

/**
 * Hook that returns whether reduced motion is enabled.
 * Uses ReducedMotionContext for efficiency - single native call shared by all components.
 *
 * @returns boolean indicating if reduced motion is preferred
 */
export function useReducedMotion(): boolean {
  return useReducedMotionSafe();
}
