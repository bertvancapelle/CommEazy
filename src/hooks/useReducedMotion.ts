/**
 * useReducedMotion — Accessibility hook for reduced motion preference
 *
 * Respects the user's system preference for reduced motion.
 * When enabled, animations should be disabled or reduced.
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import { useState, useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Hook that returns whether reduced motion is enabled
 * @returns boolean indicating if reduced motion is preferred
 */
export function useReducedMotion(): boolean {
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    // Get initial value
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

  return isReducedMotion;
}
