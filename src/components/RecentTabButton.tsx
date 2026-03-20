/**
 * RecentTabButton — Senior-inclusive tab button for "Recently Played" list
 *
 * Follows the same visual pattern as FavoriteTabButton and SearchTabButton:
 * - Icon (clock) + label in vertical column layout
 * - No counter badge (design decision — user discussed in PNA)
 * - 72pt min height touch target
 * - Haptic feedback on press
 * - User-configurable button border support
 *
 * @see FavoriteButton.tsx (FavoriteTabButton)
 * @see SearchButton.tsx (SearchTabButton)
 * @see .claude/CLAUDE.md Section 14 (Component Registry)
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { HapticTouchable } from './HapticTouchable';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useButtonStyleSafe } from '@/contexts/ButtonStyleContext';
import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';

// ============================================================
// Types
// ============================================================

export interface RecentTabButtonProps {
  /** Whether this tab is active */
  isActive: boolean;
  /** Callback when pressed */
  onPress: () => void;
  /** Tab label (default: uses i18n 'common.recent') */
  label?: string;
}

// ============================================================
// RecentTabButton — Tab variant with clock icon + label
// ============================================================

/**
 * Tab-style "recent" button with clock icon and label
 *
 * @example
 * <RecentTabButton
 *   isActive={activeTab === 'recent'}
 *   onPress={() => setActiveTab('recent')}
 * />
 */
export function RecentTabButton({
  isActive,
  onPress,
  label,
}: RecentTabButtonProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const buttonStyleContext = useButtonStyleSafe();

  const displayLabel = label ?? t('common.recent');

  // User-configurable button border
  const userBorderStyle = buttonStyleContext?.settings.borderEnabled
    ? { borderWidth: 2, borderColor: buttonStyleContext.getBorderColorHex() }
    : undefined;

  return (
    <HapticTouchable
      style={[
        styles.tab,
        isActive
          ? { backgroundColor: accentColor.primary }
          : styles.tabInactive,
        userBorderStyle,
      ]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={displayLabel}
    >
      <Icon
        name="clock"
        size={28}
        color={isActive ? colors.textOnPrimary : colors.textSecondary}
      />
      <Text
        style={[
          styles.tabText,
          isActive && styles.tabTextActive,
        ]}
        numberOfLines={2}
      >
        {displayLabel}
      </Text>
    </HapticTouchable>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    flexDirection: 'column',
    paddingVertical: spacing.sm,
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

export default RecentTabButton;
