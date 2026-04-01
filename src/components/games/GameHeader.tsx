/**
 * GameHeader — In-game controls bar
 *
 * Used as controlsBlock in ModuleScreenLayout (NOT as a replacement for ModuleHeader).
 * Shows score, timer, and action buttons during gameplay.
 *
 * @see Prompt_1_Games_Foundation.md §5.1
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, borderRadius, touchTargets, typography } from '@/theme';
import { Icon, HapticTouchable } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import type { ModuleColorId } from '@/types/liquidGlass';
import type { IconName } from '@/components/Icon';

// ============================================================
// Types
// ============================================================

export interface GameHeaderAction {
  /** Icon name */
  icon: IconName;
  /** Accessibility label */
  label: string;
  /** Tap handler */
  onPress: () => void;
  /** Whether button is disabled */
  disabled?: boolean;
}

export interface GameHeaderProps {
  /** Module identifier for accent color */
  moduleId: ModuleColorId;
  /** Current score (optional) */
  score?: number;
  /** Seconds elapsed (optional) */
  timer?: number;
  /** Whether to show timer */
  showTimer?: boolean;
  /** Action buttons on the right */
  actions?: GameHeaderAction[];
}

// ============================================================
// Helpers
// ============================================================

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================
// Component
// ============================================================

export function GameHeader({
  moduleId,
  score,
  timer,
  showTimer = false,
  actions = [],
}: GameHeaderProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor(moduleId);

  // Compact mode: only timer, no score, no actions → slim single-line bar
  const isCompact = showTimer && score === undefined && actions.length === 0;

  if (isCompact && timer !== undefined) {
    return (
      <View style={[styles.compactContainer, { borderBottomColor: themeColors.border }]}>
        <Icon name="time" size={16} color={themeColors.textSecondary} />
        <Text style={[styles.compactTimer, { color: themeColors.textSecondary }]}>
          {formatTimer(timer)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderBottomColor: themeColors.border }]}>
      {/* Left: Score & Timer */}
      <View style={styles.statsRow}>
        {score !== undefined && (
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
              {t('games.common.score')}
            </Text>
            <Text style={[styles.statValue, { color: moduleColor }]}>
              {score}
            </Text>
          </View>
        )}
        {showTimer && timer !== undefined && (
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
              {t('games.common.time')}
            </Text>
            <Text style={[styles.statValue, { color: themeColors.textPrimary }]}>
              {formatTimer(timer)}
            </Text>
          </View>
        )}
      </View>

      {/* Right: Action buttons */}
      {actions.length > 0 && (
        <View style={styles.actionsRow}>
          {actions.map((action) => (
            <HapticTouchable
              key={action.icon}
              onPress={action.onPress}
              disabled={action.disabled}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityState={{ disabled: action.disabled }}
              style={[
                styles.actionButton,
                {
                  backgroundColor: moduleColor + '1A',
                  opacity: action.disabled ? 0.4 : 1,
                },
              ]}
            >
              <Icon
                name={action.icon}
                size={24}
                color={action.disabled ? themeColors.textTertiary : moduleColor}
              />
            </HapticTouchable>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    gap: 4,
  },
  compactTimer: {
    ...typography.label,
    fontSize: 14,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    ...typography.label,
    fontSize: 14,
  },
  statValue: {
    ...typography.body,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
