/**
 * FavoriteButton — Senior-inclusive favorite toggle with optional count badge
 *
 * Two variants:
 * 1. Tab button: Shows icon + label + optional count badge (for tab bars)
 * 2. Icon button: Shows just icon (for list items, mini-player)
 *
 * Senior-inclusive design:
 * - Touch targets ≥60pt
 * - Haptic feedback on press
 * - Clear visual feedback (filled vs outline heart)
 * - Count badge properly centered
 *
 * @see .claude/CLAUDE.md Section 12 (Media Module Design Principles)
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';

// ============================================================
// Types
// ============================================================

export interface FavoriteButtonProps {
  /** Whether this item is favorited */
  isFavorite: boolean;
  /** Callback when toggled */
  onToggle: () => void;
  /** Accessibility label (for icon-only variant) */
  accessibilityLabel: string;
  /** Accessibility hint (optional) */
  accessibilityHint?: string;
  /** Icon size for icon-only variant (default: 24) */
  size?: number;
  /** Disabled state */
  disabled?: boolean;
}

export interface FavoriteTabButtonProps {
  /** Whether this tab is active */
  isActive: boolean;
  /** Callback when pressed */
  onPress: () => void;
  /** Number of favorites (shows badge if > 0) */
  count?: number;
  /** Tab label (default: uses i18n 'common.favorites') */
  label?: string;
}

// ============================================================
// FavoriteButton — Icon-only variant for list items
// ============================================================

/**
 * Icon-only favorite button for use in list items and mini-player
 *
 * @example
 * <FavoriteButton
 *   isFavorite={isFavorite(station)}
 *   onToggle={() => toggleFavorite(station)}
 *   accessibilityLabel={t('radio.addToFavorites', { name: station.name })}
 * />
 */
export function FavoriteButton({
  isFavorite,
  onToggle,
  accessibilityLabel,
  accessibilityHint,
  size = 24,
  disabled = false,
}: FavoriteButtonProps) {
  return (
    <IconButton
      icon="heart"
      iconActive="heart-filled"
      isActive={isFavorite}
      onPress={onToggle}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      size={size}
      disabled={disabled}
    />
  );
}

// ============================================================
// FavoriteTabButton — Tab variant with label and count badge
// ============================================================

/**
 * Tab-style favorite button with label and optional count badge
 *
 * @example
 * <FavoriteTabButton
 *   isActive={showFavorites}
 *   onPress={() => setShowFavorites(true)}
 *   count={favorites.length}
 * />
 */
export function FavoriteTabButton({
  isActive,
  onPress,
  count = 0,
  label,
}: FavoriteTabButtonProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const { triggerFeedback } = useFeedback();

  const displayLabel = label ?? t('common.favorites');

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
      accessibilityLabel={
        count > 0
          ? `${displayLabel}, ${count} ${t('common.items')}`
          : displayLabel
      }
    >
      <View style={styles.tabIconRow}>
        <Icon
          name={isActive ? 'heart-filled' : 'heart'}
          size={28}
          color={isActive ? colors.textOnPrimary : colors.textSecondary}
        />
        {count > 0 && (
          <View style={[
            styles.countBadge,
            { backgroundColor: isActive ? 'rgba(255, 255, 255, 0.3)' : accentColor.primary },
          ]}>
            <Text style={[
              styles.countText,
              { color: colors.textOnPrimary },
            ]}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        )}
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
  // Tab button styles
  tab: {
    flex: 1,
    flexDirection: 'column',
    paddingVertical: spacing.sm,      // 8pt (was 16pt)
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

  // Count badge styles — uses accentColor for background
  countBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
    includeFontPadding: false,  // Android: remove extra padding
  },
});

export default FavoriteButton;
