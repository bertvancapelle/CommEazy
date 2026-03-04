/**
 * DownloadProgressIndicator — Visual progress for attachment downloads
 *
 * Shows download progress with percentage, progress bar,
 * and cancel button (≥60pt touch target).
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 17
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { Icon } from '@/components';

// ============================================================
// Types
// ============================================================

export interface DownloadProgressIndicatorProps {
  /** File name being downloaded */
  fileName: string;
  /** Progress (0 to 1) */
  progress: number;
  /** Total bytes (for display) */
  totalBytes?: number;
  /** Cancel download */
  onCancel?: () => void;
}

// ============================================================
// Helpers
// ============================================================

const triggerHaptic = () => {
  const options = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };
  const hapticType = Platform.select({
    ios: 'impactMedium',
    android: 'effectClick',
    default: 'impactMedium',
  }) as string;
  ReactNativeHapticFeedback.trigger(hapticType, options);
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// Component
// ============================================================

export function DownloadProgressIndicator({
  fileName,
  progress,
  totalBytes,
  onCancel,
}: DownloadProgressIndicatorProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();

  const percentage = Math.round(progress * 100);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <View style={styles.infoRow}>
        <Icon name="download" size={20} color={accentColor.primary} />
        <View style={styles.textContainer}>
          <Text style={[styles.fileName, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {fileName}
          </Text>
          <Text style={[styles.progressText, { color: themeColors.textSecondary }]}>
            {percentage}%
            {totalBytes ? ` — ${formatBytes(Math.round(progress * totalBytes))} / ${formatBytes(totalBytes)}` : ''}
          </Text>
        </View>

        {onCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              triggerHaptic();
              onCancel();
            }}
            onLongPress={() => {}}
            delayLongPress={300}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Icon name="close" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBarBackground, { backgroundColor: themeColors.border }]}>
        <View
          style={[
            styles.progressBarFill,
            { backgroundColor: accentColor.primary, width: `${percentage}%` },
          ]}
        />
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    ...typography.body,
    fontWeight: '600',
  },
  progressText: {
    ...typography.small,
  },
  cancelButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
