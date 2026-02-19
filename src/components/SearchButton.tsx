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

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
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
  const { triggerFeedback } = useFeedback();

  const handlePress = async () => {
    await triggerFeedback('tap');
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.iconButton,
        { backgroundColor: accentColor.primary },
        disabled && styles.disabled,
      ]}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t('common.search')}
    >
      <Icon name="search" size={size} color={colors.textOnPrimary} />
    </TouchableOpacity>
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
}: SearchTabButtonProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const { triggerFeedback } = useFeedback();

  const displayLabel = label ?? t('common.search');

  const handlePress = async () => {
    await triggerFeedback('tap');
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.tab,
        isActive
          ? { backgroundColor: accentColor.primary }
          : styles.tabInactive,
      ]}
      onPress={handlePress}
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
      <Text style={[
        styles.tabText,
        isActive && styles.tabTextActive,
      ]}>
        {displayLabel}
      </Text>
    </TouchableOpacity>
  );
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
});

export default SearchButton;
