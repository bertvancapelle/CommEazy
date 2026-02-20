/**
 * TimeSlider Component
 *
 * Slider for navigating through radar time frames.
 * Shows past data (-2 hours) and forecast (+30 minutes).
 *
 * Features:
 * - Senior-inclusive touch target (60pt height)
 * - Relative time display ("Nu", "10 min geleden", "Over 15 min")
 * - Absolute time display (HH:mm)
 * - Haptic feedback on value changes
 * - i18n support for all 5 languages
 *
 * @see .claude/plans/buienradar-module-plan.md
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useTranslation } from 'react-i18next';

import { useAccentColorContext } from '@/contexts/AccentColorContext';
import { colors, typography, spacing, touchTargets } from '@/theme';
import { RainViewerFrame } from '@/types/weather';
import { formatFrameTime, formatFrameAbsoluteTime } from '@/services/rainViewerService';

// ============================================================
// Props
// ============================================================

export interface TimeSliderProps {
  /** Array of all radar frames (past + nowcast) */
  frames: RainViewerFrame[];

  /** Currently selected frame index */
  currentIndex: number;

  /** Called when user changes the selected frame */
  onIndexChange: (index: number) => void;

  /** Whether the slider is disabled */
  disabled?: boolean;
}

// ============================================================
// Component
// ============================================================

export function TimeSlider({
  frames,
  currentIndex,
  onIndexChange,
  disabled = false,
}: TimeSliderProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { accentColor } = useAccentColorContext();

  // Don't render if no frames
  if (frames.length === 0) {
    return null;
  }

  // Calculate min/max values
  const minIndex = 0;
  const maxIndex = frames.length - 1;

  // Current frame
  const currentFrame = frames[currentIndex];

  // Format time strings
  const relativeTime = useMemo(() => {
    if (!currentFrame) return '';
    return formatFrameTime(currentFrame.time, undefined, t);
  }, [currentFrame, t]);

  const absoluteTime = useMemo(() => {
    if (!currentFrame) return '';
    return formatFrameAbsoluteTime(currentFrame.time);
  }, [currentFrame]);

  // Handle slider value change
  const handleValueChange = useCallback((value: number) => {
    const newIndex = Math.round(value);
    if (newIndex !== currentIndex) {
      // Haptic feedback
      if (Platform.OS === 'ios') {
        ReactNativeHapticFeedback.trigger('selection', {
          enableVibrateFallback: false,
          ignoreAndroidSystemSettings: false,
        });
      }
      onIndexChange(newIndex);
    }
  }, [currentIndex, onIndexChange]);

  // Handle sliding complete (for accessibility announcement)
  const handleSlidingComplete = useCallback((value: number) => {
    const newIndex = Math.round(value);
    onIndexChange(newIndex);
  }, [onIndexChange]);

  return (
    <View style={styles.container}>
      {/* Labels row */}
      <View style={styles.labelsRow}>
        <Text style={styles.labelText}>{t('modules.weather.radar.past')}</Text>
        <Text style={styles.labelText}>{t('modules.weather.radar.forecast')}</Text>
      </View>

      {/* Slider */}
      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={minIndex}
          maximumValue={maxIndex}
          step={1}
          value={currentIndex}
          onValueChange={handleValueChange}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor={accentColor.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={accentColor.primary}
          disabled={disabled}
          accessibilityLabel={t('modules.weather.radar.timeSlider')}
          accessibilityHint={t('modules.weather.radar.timeSliderHint')}
          accessibilityRole="adjustable"
        />
      </View>

      {/* Time display */}
      <View
        style={styles.timeDisplay}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${relativeTime}, ${absoluteTime}`}
      >
        <Text style={styles.relativeTime}>{relativeTime}</Text>
        <Text style={styles.absoluteTime}>{absoluteTime}</Text>
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  labelText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  sliderContainer: {
    height: touchTargets.minimum,
    justifyContent: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  relativeTime: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  absoluteTime: {
    ...typography.small,
    color: colors.textSecondary,
  },
});

export default TimeSlider;
