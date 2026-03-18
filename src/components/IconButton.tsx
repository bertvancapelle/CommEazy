/**
 * IconButton — Senior-inclusive icon-only button component
 *
 * Icon-only buttons (like favorites heart, stop button) must be clearly
 * recognizable as buttons. Seniors may not realize a standalone icon is
 * interactive.
 *
 * Variants:
 * - "default": For use on light/content backgrounds
 *   - Rest (inactive): 2px accent border, transparent bg, outline icon in accent
 *   - Rest (active): 2px accent border, transparent bg, filled icon in accent
 *   - Pressed: Accent fill, white icon
 *
 * - "onPrimary": For use on colored headers (module headers, modal headers)
 *   - Rest: rgba(255,255,255,0.15) bg, no border, white icon
 *   - Pressed: rgba(255,255,255,0.3) bg, white icon
 *   - Consistent with ModuleHeader button styling
 *
 * @see .claude/skills/ui-designer/SKILL.md Section 10
 */

import React, { useState, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { HapticTouchable } from './HapticTouchable';
import { Icon, type IconName } from './Icon';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';
import { useHoldGestureGuard } from '@/contexts/HoldGestureContext';
import { useButtonStyleSafe } from '@/contexts/ButtonStyleContext';
import { colors, borderRadius, touchTargets } from '@/theme';

export type IconButtonVariant = 'default' | 'onPrimary';

export interface IconButtonProps {
  /** Icon name (outline version) */
  icon: IconName;
  /** Icon name when active (filled version), optional */
  iconActive?: IconName;
  /** Whether the button is in active state (e.g. favorited) */
  isActive?: boolean;
  /** Callback when pressed */
  onPress: () => void;
  /** Accessibility label (REQUIRED) */
  accessibilityLabel: string;
  /** Accessibility hint (optional) */
  accessibilityHint?: string;
  /** Icon size, default 28 */
  size?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Custom container style */
  style?: object;
  /**
   * Visual variant:
   * - "default": accent border + transparent bg (for content areas)
   * - "onPrimary": white semi-transparent bg + white icon (for colored headers)
   */
  variant?: IconButtonVariant;
}

/**
 * Icon-only button with visible container for senior-inclusive design
 *
 * @example
 * // Favorite toggle
 * <IconButton
 *   icon="heart"
 *   iconActive="heart-filled"
 *   isActive={isFavorite}
 *   onPress={handleToggleFavorite}
 *   accessibilityLabel={t('radio.addFavorite', { name: station.name })}
 * />
 *
 * @example
 * // Stop button
 * <IconButton
 *   icon="stop"
 *   onPress={handleStop}
 *   accessibilityLabel={t('radio.stop')}
 * />
 *
 * @example
 * // Close button on colored modal header
 * <IconButton
 *   icon="chevron-down"
 *   variant="onPrimary"
 *   onPress={handleClose}
 *   accessibilityLabel={t('common.close')}
 * />
 */
export function IconButton({
  icon,
  iconActive,
  isActive = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  size = 28,
  disabled = false,
  style,
  variant = 'default',
}: IconButtonProps) {
  const { accentColor } = useAccentColor();
  const reduceMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();
  const buttonStyleContext = useButtonStyleSafe();
  const [isPressed, setIsPressed] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  const isOnPrimary = variant === 'onPrimary';

  const handlePressIn = useCallback(() => {
    setIsPressed(true);
  }, []);

  const handlePressOut = useCallback(() => {
    setIsPressed(false);

    // Flash effect after release (unless reduced motion)
    if (!reduceMotion) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 250);
    }
  }, [reduceMotion]);

  const handlePress = useCallback(async () => {
    await triggerFeedback('tap');
    onPress();
  }, [onPress, triggerFeedback]);

  // Wrap with hold gesture guard to prevent double-action on long-press
  const guardedPress = useHoldGestureGuard(handlePress);

  // Determine visual state
  const showFilled = isPressed || isFlashing;
  const currentIcon = isActive ? (iconActive || icon) : icon;

  // Icon color depends on variant
  const iconColor = isOnPrimary
    ? colors.textOnPrimary  // Always white on colored headers
    : showFilled ? colors.textOnPrimary : accentColor.primary;

  // User-configurable button border (only for default variant)
  const userBorderStyle = !isOnPrimary && buttonStyleContext?.settings.borderEnabled
    ? { borderColor: buttonStyleContext.getBorderColorHex() }
    : undefined;

  // Container style depends on variant
  const variantStyle = isOnPrimary
    ? [
        styles.containerOnPrimary,
        showFilled && { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
      ]
    : [
        styles.container,
        { borderColor: accentColor.primary },
        userBorderStyle,
        showFilled && { backgroundColor: accentColor.primary },
      ];

  return (
    <HapticTouchable
      hapticDisabled
      onPress={guardedPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        ...variantStyle,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        selected: isActive,
        disabled,
      }}
    >
      <Icon name={currentIcon} size={size} color={iconColor} />
    </HapticTouchable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: touchTargets.minimum,      // 60pt
    height: touchTargets.minimum,     // 60pt
    borderWidth: 2,
    borderRadius: borderRadius.md,    // 12pt (consistent with search/favorites tabs)
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerOnPrimary: {
    width: touchTargets.minimum,      // 60pt
    height: touchTargets.minimum,     // 60pt
    borderRadius: borderRadius.md,    // 12pt
    backgroundColor: 'rgba(255, 255, 255, 0.15)',  // Consistent with ModuleHeader buttons
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
