/**
 * IconButton — Senior-inclusive icon-only button component
 *
 * Icon-only buttons (like favorites heart, stop button) must be clearly
 * recognizable as buttons. Seniors may not realize a standalone icon is
 * interactive.
 *
 * Visual states:
 * - Rest (inactive): 2px accent border, transparent bg, outline icon in accent
 * - Rest (active): 2px accent border, transparent bg, filled icon in accent
 * - Pressed: Accent fill, white icon
 * - Flash after release: Brief (250ms) return to rest state
 *
 * @see .claude/skills/ui-designer/SKILL.md Section 10
 */

import React, { useState, useCallback } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Icon, type IconName } from './Icon';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';
import { colors, borderRadius, touchTargets } from '@/theme';

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
}: IconButtonProps) {
  const { accentColor } = useAccentColor();
  const reduceMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();
  const [isPressed, setIsPressed] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

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

  // Determine visual state
  const showFilled = isPressed || isFlashing;
  const currentIcon = isActive ? (iconActive || icon) : icon;
  const iconColor = showFilled ? colors.textOnPrimary : accentColor.primary;

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        styles.container,
        { borderColor: accentColor.primary },
        showFilled && { backgroundColor: accentColor.primary },
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
    </TouchableOpacity>
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
  disabled: {
    opacity: 0.5,
  },
});
