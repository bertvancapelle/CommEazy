/**
 * HapticTouchable — Senior-inclusive TouchableOpacity wrapper
 *
 * Drop-in replacement for TouchableOpacity with:
 * - Built-in haptic feedback (via useFeedback hook)
 * - Built-in hold gesture guard (prevents double-action on long-press)
 * - Built-in empty onLongPress handler (blocks onPress after long-press)
 *
 * All three behaviors are ON by default. Opt out per-instance:
 * - hapticDisabled: skip haptic feedback (e.g. decorative touches)
 * - longPressGuardDisabled: skip hold gesture guard (e.g. no wheel menu context)
 * - hapticType: override feedback type (default: 'tap')
 *
 * @example
 * // Standard usage (haptic + guard included automatically)
 * <HapticTouchable onPress={handlePress} accessibilityLabel="Open contact">
 *   <Text>Oma Maria</Text>
 * </HapticTouchable>
 *
 * @example
 * // Opt-out haptic for decorative element
 * <HapticTouchable onPress={handlePress} hapticDisabled accessibilityLabel="...">
 *   <Text>Subtle touch</Text>
 * </HapticTouchable>
 *
 * @see .claude/skills/ui-designer/SKILL.md Section 10b
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';
import { useFeedback, type FeedbackType } from '@/hooks/useFeedback';
import { useHoldGestureGuard } from '@/contexts/HoldGestureContext';

export interface HapticTouchableProps extends TouchableOpacityProps {
  /** Disable haptic feedback for this instance (default: false) */
  hapticDisabled?: boolean;
  /** Disable hold gesture guard for this instance (default: false) */
  longPressGuardDisabled?: boolean;
  /** Override feedback type (default: 'tap') */
  hapticType?: FeedbackType;
}

export function HapticTouchable({
  onPress,
  onLongPress,
  hapticDisabled = false,
  longPressGuardDisabled = false,
  hapticType = 'tap',
  delayLongPress,
  children,
  ...rest
}: HapticTouchableProps) {
  const { triggerFeedback } = useFeedback();

  // Wrap onPress with hold gesture guard (unless opted out)
  const guardedOnPress = useHoldGestureGuard(
    longPressGuardDisabled ? undefined : onPress
  );

  // The effective onPress: guarded (if enabled) or raw
  const effectiveOnPress = longPressGuardDisabled ? onPress : guardedOnPress;

  // Combine haptic feedback with onPress
  const handlePress = useCallback(() => {
    if (!hapticDisabled) {
      triggerFeedback(hapticType);
    }
    effectiveOnPress?.();
  }, [hapticDisabled, hapticType, triggerFeedback, effectiveOnPress]);

  // Empty onLongPress handler to prevent onPress from firing after long-press
  // React Native's TouchableOpacity: if onLongPress is set, onPress does NOT fire
  // when touch duration exceeds delayLongPress. This is the primary defense.
  const effectiveLongPress = onLongPress ?? (() => {});

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={effectiveLongPress}
      delayLongPress={delayLongPress ?? 300}
      {...rest}
    >
      {children}
    </TouchableOpacity>
  );
}
