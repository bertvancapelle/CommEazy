/**
 * TimeSlider Component
 *
 * Slider for navigating through radar time frames.
 * Shows past data (-2 hours) and forecast (+2 hours with OWM, +30 min with RainViewer).
 *
 * Features:
 * - "Nu" marker ALWAYS centered at 50% position
 * - Senior-inclusive touch target (60pt height)
 * - Relative time display ("Nu", "10 min geleden", "Over 15 min", "Over 1 uur")
 * - Absolute time display (HH:mm)
 * - Haptic feedback on value changes
 * - Warning popup when sliding beyond available data
 * - i18n support for all 5 languages
 *
 * @see .claude/plans/buienradar-module-plan.md
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, Platform, Modal, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useTranslation } from 'react-i18next';

import { useAccentColorContext } from '@/contexts/AccentColorContext';
import { colors, typography, spacing, touchTargets } from '@/theme';
import { RadarFrame } from '@/types/weather';
import { formatFrameTime, formatFrameAbsoluteTime, getNowFrameIndex } from '@/services/radarService';

// ============================================================
// Props
// ============================================================

export interface TimeSliderProps {
  /** Array of all radar frames (past + forecast) */
  frames: RadarFrame[];

  /** Currently selected frame index */
  currentIndex: number;

  /** Called when user changes the selected frame */
  onIndexChange: (index: number) => void;

  /** Whether the slider is disabled */
  disabled?: boolean;

  /** Number of past frames (for boundary detection) */
  pastFrameCount?: number;

  /** Number of forecast frames (for boundary detection) */
  forecastFrameCount?: number;
}

// ============================================================
// Component
// ============================================================

export function TimeSlider({
  frames,
  currentIndex,
  onIndexChange,
  disabled = false,
  pastFrameCount = 0,
  forecastFrameCount = 0,
}: TimeSliderProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { accentColor } = useAccentColorContext();

  // Warning popup state
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

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

  // "Now" index and marker position - ALWAYS at 50%
  const nowIndex = useMemo(() => getNowFrameIndex(frames), [frames]);
  const nowMarkerPosition = 50; // ALWAYS centered

  // Calculate if we have limited data (for warnings)
  const hasNoForecast = forecastFrameCount === 0;
  const hasNoPast = pastFrameCount === 0;

  // Log for debugging
  console.debug('[TimeSlider] Rendering:', {
    framesCount: frames.length,
    nowIndex,
    currentIndex,
    pastFrameCount,
    forecastFrameCount,
  });

  // Track previous index to detect crossing "now" and boundaries
  const previousIndexRef = useRef<number>(-1);
  const warningShownRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });

  // Handle slider value change
  const handleValueChange = useCallback((value: number) => {
    const newIndex = Math.round(value);
    const prevIndex = previousIndexRef.current;

    // Skip if same index (and not first interaction)
    if (newIndex === prevIndex && prevIndex !== -1) {
      return;
    }

    // Check if trying to go beyond available data
    const isAtRightEdge = newIndex === maxIndex;
    const isAtLeftEdge = newIndex === minIndex;

    // Show warning when hitting edge with no data beyond
    if (isAtRightEdge && hasNoForecast && !warningShownRef.current.right) {
      setWarningMessage(t('modules.weather.radar.noForecastWarning'));
      setShowWarning(true);
      warningShownRef.current.right = true;
      // Strong haptic for warning
      if (Platform.OS === 'ios') {
        ReactNativeHapticFeedback.trigger('notificationWarning', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
    } else if (isAtLeftEdge && hasNoPast && !warningShownRef.current.left) {
      setWarningMessage(t('modules.weather.radar.noPastWarning'));
      setShowWarning(true);
      warningShownRef.current.left = true;
      // Strong haptic for warning
      if (Platform.OS === 'ios') {
        ReactNativeHapticFeedback.trigger('notificationWarning', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
    }

    // Reset warning flags when moving away from edges
    if (!isAtRightEdge) warningShownRef.current.right = false;
    if (!isAtLeftEdge) warningShownRef.current.left = false;

    // Check if we're crossing or landing on the "now" marker
    const crossedNow =
      prevIndex !== -1 && (
        (prevIndex < nowIndex && newIndex >= nowIndex) ||
        (prevIndex > nowIndex && newIndex <= nowIndex)
      );
    const landedOnNow = newIndex === nowIndex;

    // Haptic feedback on iOS
    if (Platform.OS === 'ios') {
      if (crossedNow || landedOnNow) {
        // Strong haptic when crossing or landing on "now"
        console.debug('[TimeSlider] Haptic: impactMedium (crossed/landed on now)');
        ReactNativeHapticFeedback.trigger('impactMedium', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      } else if (prevIndex !== -1) {
        // Light haptic for normal steps (not on first load)
        console.debug('[TimeSlider] Haptic: selection');
        ReactNativeHapticFeedback.trigger('selection', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
    }

    previousIndexRef.current = newIndex;
    onIndexChange(newIndex);
  }, [onIndexChange, nowIndex, maxIndex, minIndex, hasNoForecast, hasNoPast, t]);

  // Handle sliding complete (for accessibility announcement)
  const handleSlidingComplete = useCallback((value: number) => {
    const newIndex = Math.round(value);
    onIndexChange(newIndex);
  }, [onIndexChange]);

  // Dismiss warning
  const dismissWarning = useCallback(() => {
    setShowWarning(false);
  }, []);

  return (
    <View style={styles.container}>
      {/* Labels row */}
      <View style={styles.labelsRow}>
        <Text style={styles.labelText}>{t('modules.weather.radar.past')}</Text>
        <Text style={styles.labelText}>{t('modules.weather.radar.forecast')}</Text>
      </View>

      {/* "Now" marker - ALWAYS centered at 50% */}
      <View style={styles.nowMarkerRow}>
        {/* Left spacer - always 50% minus half marker width */}
        <View style={styles.nowMarkerSpacer} />
        <View style={styles.nowMarkerContainer}>
          <Text style={[styles.nowMarkerLabel, { color: accentColor.primary }]}>
            {t('modules.weather.radar.now')}
          </Text>
          <View style={[styles.nowMarkerTriangle, { borderTopColor: accentColor.primary }]} />
        </View>
        {/* Right spacer - always 50% minus half marker width */}
        <View style={styles.nowMarkerSpacer} />
      </View>

      {/* Slider */}
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

      {/* Time display */}
      <View
        style={styles.timeDisplay}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${relativeTime}, ${absoluteTime}`}
      >
        <Text style={styles.relativeTime}>{relativeTime}</Text>
        <Text style={styles.absoluteTime}>{absoluteTime}</Text>
      </View>

      {/* Warning Modal */}
      <Modal
        visible={showWarning}
        transparent
        animationType="fade"
        onRequestClose={dismissWarning}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={dismissWarning}
        >
          <View style={styles.warningBox}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>{warningMessage}</Text>
            <TouchableOpacity
              style={[styles.warningButton, { backgroundColor: accentColor.primary }]}
              onPress={dismissWarning}
            >
              <Text style={styles.warningButtonText}>{t('common.ok')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  nowMarkerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 28, // Height for "Nu" label + triangle
    marginBottom: -4, // Small overlap with slider
  },
  nowMarkerSpacer: {
    flex: 1,
  },
  nowMarkerContainer: {
    alignItems: 'center',
    width: 40, // Fixed width for centering
  },
  nowMarkerLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  nowMarkerTriangle: {
    width: 0,
    height: 0,
    marginTop: 2,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    // borderTopColor set dynamically
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
  // Warning Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    alignItems: 'center',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  warningIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  warningText: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  warningButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
    minWidth: 120,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningButtonText: {
    ...typography.bodyBold,
    color: colors.white,
  },
});

export default TimeSlider;
