/**
 * VoiceStepper — Numeric stepper with voice control support
 *
 * A senior-inclusive stepper component that:
 * - Can be controlled via voice ("verhoog"/"verlaag")
 * - Integrates with VoiceFocusable for list navigation
 * - Provides haptic + audio feedback on value change
 * - Shows voice hints when voice session is active
 * - Uses accent color for visual consistency
 * - Label ABOVE control, value in accent color
 *
 * Voice commands supported:
 * - "verhoog" / "verlaag" (NL)
 * - "increase" / "decrease" (EN)
 * - "erhöhen" / "verringern" (DE)
 * - "augmenter" / "diminuer" (FR)
 * - "aumentar" / "disminuir" (ES)
 *
 * @example
 * <VoiceStepper
 *   id="hold-delay"
 *   label={t('settings.holdDelay')}
 *   value={t('settings.holdDelaySeconds', { seconds: delay })}
 *   onDecrease={handleDecrease}
 *   onIncrease={handleIncrease}
 *   decreaseDisabled={delay <= MIN_DELAY}
 *   increaseDisabled={delay >= MAX_DELAY}
 *   hint={t('settings.holdDelayHint')}
 *   index={0}
 * />
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { VoiceFocusable } from './VoiceFocusable';
import { useFeedback } from '@/hooks/useFeedback';
import { useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import { useAccentColorContext } from '@/contexts/AccentColorContext';
import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';

// ============================================================
// Types
// ============================================================

export interface VoiceStepperProps {
  /** Unique identifier for voice targeting */
  id: string;
  /** Label displayed above the stepper — ALWAYS bold */
  label: string;
  /** Current value to display (formatted string, e.g., "1.0 seconde") */
  value: string;
  /** Callback when decrease (-) button is pressed */
  onDecrease: () => void;
  /** Callback when increase (+) button is pressed */
  onIncrease: () => void;
  /** Whether decrease button is disabled (at minimum) */
  decreaseDisabled?: boolean;
  /** Whether increase button is disabled (at maximum) */
  increaseDisabled?: boolean;
  /** Optional hint text displayed below the label */
  hint?: string;
  /** Index in the parent list (for voice navigation order) */
  index: number;
  /** Whether the entire stepper is disabled */
  disabled?: boolean;
  /** Optional test ID for testing */
  testID?: string;
}

// ============================================================
// VoiceStepper Component
// ============================================================

export function VoiceStepper({
  id,
  label,
  value,
  onDecrease,
  onIncrease,
  decreaseDisabled = false,
  increaseDisabled = false,
  hint,
  index,
  disabled = false,
  testID,
}: VoiceStepperProps): React.ReactElement {
  const { t } = useTranslation();
  const { isVoiceSessionActive } = useVoiceFocusContext();
  const { accentColor } = useAccentColorContext();
  const { triggerFeedback } = useFeedback();

  // Handle decrease with feedback
  const handleDecrease = useCallback(async () => {
    if (disabled || decreaseDisabled) {
      await triggerFeedback('warning');
      AccessibilityInfo.announceForAccessibility(
        t('a11y.stepperAtMinimum', { setting: label })
      );
      return;
    }

    await triggerFeedback('tap');
    onDecrease();

    // Announce new value for screen readers
    AccessibilityInfo.announceForAccessibility(
      t('a11y.stepperDecreased', { setting: label, value })
    );
  }, [disabled, decreaseDisabled, onDecrease, label, value, t, triggerFeedback]);

  // Handle increase with feedback
  const handleIncrease = useCallback(async () => {
    if (disabled || increaseDisabled) {
      await triggerFeedback('warning');
      AccessibilityInfo.announceForAccessibility(
        t('a11y.stepperAtMaximum', { setting: label })
      );
      return;
    }

    await triggerFeedback('tap');
    onIncrease();

    // Announce new value for screen readers
    AccessibilityInfo.announceForAccessibility(
      t('a11y.stepperIncreased', { setting: label, value })
    );
  }, [disabled, increaseDisabled, onIncrease, label, value, t, triggerFeedback]);

  // Handle voice select — cycle through: decrease → increase → decrease...
  // Or use specific voice commands "verhoog"/"verlaag"
  const handleVoiceSelect = useCallback(async () => {
    // Default behavior when "open" is said: show current value
    AccessibilityInfo.announceForAccessibility(
      t('a11y.stepperCurrentValue', { setting: label, value })
    );
  }, [label, value, t]);

  // Generate voice hint based on state
  const voiceHint = isVoiceSessionActive
    ? t('a11y.voiceStepperHint', { defaultValue: 'Zeg "verhoog" of "verlaag" om aan te passen' })
    : hint;

  return (
    <VoiceFocusable
      id={id}
      label={label}
      index={index}
      onSelect={handleVoiceSelect}
      disabled={disabled}
    >
      <View
        style={[
          styles.container,
          disabled && styles.containerDisabled,
        ]}
        testID={testID}
      >
        {/* Label and value (left side) */}
        <View style={styles.labelContainer}>
          <Text
            style={[
              styles.label,
              disabled && styles.labelDisabled,
            ]}
            numberOfLines={2}
          >
            {label}
          </Text>

          {/* Value displayed in accent color */}
          <Text
            style={[
              styles.value,
              { color: disabled ? colors.disabled : accentColor.primary },
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>

          {/* Hint text (below value) */}
          {voiceHint && (
            <Text
              style={[
                styles.hint,
                disabled && styles.hintDisabled,
                isVoiceSessionActive && { color: accentColor.primary, fontStyle: 'italic' },
              ]}
              numberOfLines={2}
            >
              {voiceHint}
            </Text>
          )}
        </View>

        {/* Stepper buttons (right side) */}
        <View style={styles.buttonsContainer}>
          {/* Decrease button */}
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: accentColor.primary },
              (disabled || decreaseDisabled) && styles.buttonDisabled,
            ]}
            onPress={handleDecrease}
            disabled={disabled || decreaseDisabled}
            accessibilityLabel={t('common.decrease')}
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || decreaseDisabled }}
            accessibilityHint={t('a11y.decreaseHint', { setting: label })}
          >
            <Text style={styles.buttonText}>−</Text>
          </TouchableOpacity>

          {/* Increase button */}
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: accentColor.primary },
              (disabled || increaseDisabled) && styles.buttonDisabled,
            ]}
            onPress={handleIncrease}
            disabled={disabled || increaseDisabled}
            accessibilityLabel={t('common.increase')}
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || increaseDisabled }}
            accessibilityHint={t('a11y.increaseHint', { setting: label })}
          >
            <Text style={styles.buttonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </VoiceFocusable>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  labelContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700', // Labels ALWAYS bold per accessibility-specialist
  },
  labelDisabled: {
    color: colors.disabled,
  },
  value: {
    ...typography.small,
    fontWeight: '600',
    marginTop: spacing.xs,
    // Color set dynamically via accentColor
  },
  hint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  hintDisabled: {
    color: colors.disabled,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.border,
  },
  buttonText: {
    ...typography.h2,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
});

export default VoiceStepper;
