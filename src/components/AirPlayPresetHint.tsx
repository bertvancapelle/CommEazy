/**
 * AirPlayPresetHint — Non-interactive hint showing saved speaker preset
 *
 * Displays the user's saved AirPlay preset as a memory aid near the
 * AirPlay button. Shows which speakers to select in Apple's picker.
 *
 * When AirPlay is active, shows "Via: HomePod Woonkamer" instead.
 *
 * This component is NOT interactive — it's purely informational.
 *
 * @see .claude/CLAUDE.md Section 13 (AudioPlayer Architecture)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, typography, spacing } from '@/theme';
import { Icon } from './Icon';

// ============================================================
// Types
// ============================================================

interface AirPlayPresetHintProps {
  /** Whether AirPlay is currently active */
  isAirPlayActive: boolean;
  /** Name of current AirPlay output (when active) */
  activeOutputName?: string | null;
  /** Preset name (when not connected, as memory aid) */
  presetName?: string | null;
  /** Preset speaker names (when not connected) */
  presetSpeakers?: string[];
}

// ============================================================
// Component
// ============================================================

export function AirPlayPresetHint({
  isAirPlayActive,
  activeOutputName,
  presetName,
  presetSpeakers,
}: AirPlayPresetHintProps) {
  const { t } = useTranslation();

  // Show active connection status
  if (isAirPlayActive && activeOutputName) {
    return (
      <View style={[styles.container, styles.activeContainer]}>
        <Icon name="volume-up" size={14} color={colors.success} />
        <Text style={[styles.text, styles.activeText]} numberOfLines={1}>
          {t('airplay.viaDevice', { device: activeOutputName })}
        </Text>
      </View>
    );
  }

  // Show preset hint (memory aid)
  if (presetName && presetSpeakers && presetSpeakers.length > 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.presetIcon}>💡</Text>
        <View style={styles.textContainer}>
          <Text style={styles.presetName} numberOfLines={1}>
            {presetName}
          </Text>
          <Text style={styles.speakerNames} numberOfLines={1}>
            {presetSpeakers.join(' + ')}
          </Text>
        </View>
      </View>
    );
  }

  // Nothing to show
  return null;
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  textContainer: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  text: {
    ...typography.small,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  activeText: {
    color: colors.success,
  },
  presetIcon: {
    fontSize: 14,
  },
  presetName: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  speakerNames: {
    ...typography.small,
    color: colors.textSecondary,
    opacity: 0.7,
    fontSize: 13,
  },
});
