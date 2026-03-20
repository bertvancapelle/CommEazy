/**
 * SearchButton — Senior-inclusive search button variants
 *
 * Two variants:
 * 1. Tab button: Shows icon + label (for tab bars, paired with FavoriteTabButton)
 * 2. Icon button: Shows just icon (for compact search triggers)
 *
 * Senior-inclusive design:
 * - Touch targets ≥60pt
 * - Haptic feedback on press
 * - Clear visual feedback (active vs inactive)
 *
 * @see .claude/CLAUDE.md Section 12 (Media Module Design Principles)
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { HapticTouchable } from './HapticTouchable';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useButtonStyleSafe } from '@/contexts/ButtonStyleContext';
import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';

// ============================================================
// Types
// ============================================================

export interface SearchButtonProps {
  /** Callback when pressed */
  onPress: () => void;
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Icon size (default: 24) */
  size?: number;
  /** Disabled state */
  disabled?: boolean;
}

export interface SearchTabButtonProps {
  /** Whether this tab is active */
  isActive: boolean;
  /** Callback when pressed */
  onPress: () => void;
  /** Tab label (default: uses i18n 'common.search') */
  label?: string;
  /** Pulse animation to draw attention (e.g. when favorites are empty) */
  pulse?: boolean;
  /** Synchronized font size from TabButtonRow (overrides base size) */
  syncedFontSize?: number;
}

// ============================================================
// SearchButton — Icon-only variant
// ============================================================

/**
 * Icon-only search button for compact layouts
 *
 * @example
 * <SearchButton
 *   onPress={() => setShowSearch(true)}
 *   accessibilityLabel={t('common.search')}
 * />
 */
export function SearchButton({
  onPress,
  accessibilityLabel,
  size = 24,
  disabled = false,
}: SearchButtonProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const buttonStyleContext = useButtonStyleSafe();

  // User-configurable button border
  const userBorderStyle = buttonStyleContext?.settings.borderEnabled
    ? { borderWidth: 2, borderColor: buttonStyleContext.getBorderColorHex() }
    : undefined;

  return (
    <HapticTouchable
      style={[
        styles.iconButton,
        { backgroundColor: accentColor.primary },
        userBorderStyle,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t('common.search')}
    >
      <Icon name="search" size={size} color={colors.textOnPrimary} />
    </HapticTouchable>
  );
}

// ============================================================
// SearchTabButton — Tab variant with label
// ============================================================

/**
 * Tab-style search button with label
 *
 * @example
 * <View style={styles.tabRow}>
 *   <FavoriteTabButton isActive={showFavorites} onPress={() => setShowFavorites(true)} count={favorites.length} />
 *   <SearchTabButton isActive={!showFavorites} onPress={() => setShowFavorites(false)} />
 * </View>
 */
export function SearchTabButton({
  isActive,
  onPress,
  label,
  pulse = false,
  syncedFontSize,
}: SearchTabButtonProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const buttonStyleContext = useButtonStyleSafe();
  const reduceMotion = useReducedMotion();

  const displayLabel = label ?? t('common.search');

  // Pulse animation (opacity 1.0 → 0.4 → 1.0, 1200ms cycle)
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (pulse && !isActive && !reduceMotion) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }
    // Reset opacity when pulse stops
    pulseAnim.setValue(1);
  }, [pulse, isActive, reduceMotion, pulseAnim]);

  // User-configurable button border
  const userBorderStyle = buttonStyleContext?.settings.borderEnabled
    ? { borderWidth: 2, borderColor: buttonStyleContext.getBorderColorHex() }
    : undefined;

  // Reduce Motion fallback: static accent background when pulse is active
  const pulseStaticStyle = pulse && !isActive && reduceMotion
    ? { backgroundColor: accentColor.light }
    : undefined;

  const buttonContent = (
    <HapticTouchable
      style={[
        styles.tab,
        isActive
          ? { backgroundColor: accentColor.primary }
          : styles.tabInactive,
        pulseStaticStyle,
        userBorderStyle,
      ]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={displayLabel}
    >
      <View style={styles.tabIconRow}>
        <Icon
          name="search"
          size={28}
          color={isActive ? colors.textOnPrimary : colors.textSecondary}
        />
      </View>
      <Text
        style={[
          styles.tabText,
          isActive && styles.tabTextActive,
          syncedFontSize != null && { fontSize: syncedFontSize },
        ]}
        numberOfLines={2}
      >
        {displayLabel}
      </Text>
    </HapticTouchable>
  );

  // Wrap in Animated.View for pulse animation (non-reduced-motion)
  if (pulse && !isActive && !reduceMotion) {
    return (
      <Animated.View style={[styles.pulseWrapper, { opacity: pulseAnim }]}>
        {buttonContent}
      </Animated.View>
    );
  }

  return buttonContent;
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  // Icon-only button styles
  iconButton: {
    width: touchTargets.minimum,      // 60pt
    height: touchTargets.minimum,     // 60pt
    borderRadius: borderRadius.md,    // 12pt
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },

  // Tab button styles
  tab: {
    flex: 1,
    flexDirection: 'column',
    paddingVertical: spacing.sm,      // 8pt (was 16pt)
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'flex-start',  // Icons align to top across all buttons
    gap: spacing.xs,
    minHeight: touchTargets.comfortable,  // 72pt
  },
  tabInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  tabText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabTextActive: {
    color: colors.textOnPrimary,
  },

  // Pulse animation wrapper — must match tab flex layout
  pulseWrapper: {
    flex: 1,
  },
});

export default SearchButton;
