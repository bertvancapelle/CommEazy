/**
 * AccessibilitySettingsScreen — All accessibility settings in one place
 *
 * Contains:
 * - Haptic feedback toggle + intensity (4 levels when enabled)
 * - Audio feedback toggle + volume boost
 * - Hold-to-Navigate settings (delay, edge exclusion, blur, dismiss margin)
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear labels ABOVE controls
 * - Values displayed in BLUE
 * - VoiceOver/TalkBack support
 * - Simple on/off toggles for main settings
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';

import {
  colors,
  typography,
  spacing,
  touchTargets,
  borderRadius,
  accentColors,
  type AccentColorKey,
} from '@/theme';
import {
  useHoldToNavigate,
  HOLD_TO_NAVIGATE_CONSTANTS,
} from '@/hooks/useHoldToNavigate';
import {
  useFeedback,
  type HapticIntensity,
} from '@/hooks/useFeedback';
import { useAccentColor, ACCENT_COLOR_KEYS } from '@/hooks/useAccentColor';
import { useVoiceCommands } from '@/hooks/useVoiceCommands';
import { useTtsSettings, TTS_SPEED_OPTIONS, type TtsSpeechRate } from '@/hooks/useTtsSettings';
import { Icon, VoiceToggle, VoiceStepper, VoiceFocusable } from '@/components';
import { useVoiceFocusList } from '@/contexts/VoiceFocusContext';

// Stepper component for numeric values with +/- buttons
interface StepperProps {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseDisabled?: boolean;
  increaseDisabled?: boolean;
  accentColor: string;
}

function Stepper({
  label,
  value,
  onDecrease,
  onIncrease,
  decreaseDisabled,
  increaseDisabled,
  accentColor,
}: StepperProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.stepperContainer}>
      <View style={styles.stepperLabelContainer}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <Text style={[styles.stepperValue, { color: accentColor }]}>{value}</Text>
      </View>
      <View style={styles.stepperButtons}>
        <TouchableOpacity
          style={[
            styles.stepperButton,
            { backgroundColor: accentColor },
            decreaseDisabled && styles.stepperButtonDisabled,
          ]}
          onPress={onDecrease}
          disabled={decreaseDisabled}
          accessibilityLabel={t('common.decrease')}
          accessibilityRole="button"
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.stepperButton,
            { backgroundColor: accentColor },
            increaseDisabled && styles.stepperButtonDisabled,
          ]}
          onPress={onIncrease}
          disabled={increaseDisabled}
          accessibilityLabel={t('common.increase')}
          accessibilityRole="button"
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Toggle row component
interface ToggleRowProps {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  accentColor: string;
  accentColorLight: string;
}

function ToggleRow({ label, hint, value, onValueChange, accentColor, accentColorLight }: ToggleRowProps) {
  return (
    <View style={styles.toggleContainer}>
      <View style={styles.toggleLabelContainer}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint && <Text style={styles.toggleHint}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: accentColorLight }}
        thumbColor={value ? accentColor : colors.textTertiary}
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
      />
    </View>
  );
}

// Haptic intensity selector (only shown when haptic is enabled)
// Only 4 levels: veryLight, light, normal, strong (no 'off' - that's handled by toggle)
// Uses dot grid visualization: 1-4 filled dots to indicate intensity level
interface HapticIntensitySelectorProps {
  value: HapticIntensity;
  onValueChange: (intensity: HapticIntensity) => void;
  onDemoIntensity: (intensity: HapticIntensity) => void;
  accentColor: string;
  accentColorLight: string;
}

// Dot grid component - shows 4 dots in 2x2 grid, filled based on intensity level
function IntensityDots({ level, isSelected, accentColor }: { level: number; isSelected: boolean; accentColor: string }) {
  const filledColor = isSelected ? accentColor : colors.textSecondary;
  const emptyColor = colors.border;

  return (
    <View style={styles.dotsContainer}>
      <View style={styles.dotsRow}>
        <View style={[styles.dot, { backgroundColor: level >= 1 ? filledColor : emptyColor }]} />
        <View style={[styles.dot, { backgroundColor: level >= 2 ? filledColor : emptyColor }]} />
      </View>
      <View style={styles.dotsRow}>
        <View style={[styles.dot, { backgroundColor: level >= 3 ? filledColor : emptyColor }]} />
        <View style={[styles.dot, { backgroundColor: level >= 4 ? filledColor : emptyColor }]} />
      </View>
    </View>
  );
}

function HapticIntensitySelector({ value, onValueChange, onDemoIntensity, accentColor, accentColorLight }: HapticIntensitySelectorProps) {
  const { t } = useTranslation();

  // Intensity levels with their dot counts
  const intensities: { key: HapticIntensity; dots: number }[] = [
    { key: 'veryLight', dots: 1 },
    { key: 'light', dots: 2 },
    { key: 'normal', dots: 3 },
    { key: 'strong', dots: 4 },
  ];

  const getIntensityLabel = (intensity: HapticIntensity): string => {
    switch (intensity) {
      case 'veryLight':
        return t('accessibilitySettings.hapticVeryLight');
      case 'light':
        return t('accessibilitySettings.hapticLight');
      case 'normal':
        return t('accessibilitySettings.hapticNormal');
      case 'strong':
        return t('accessibilitySettings.hapticStrong');
      default:
        return '';
    }
  };

  const handleSelect = (intensity: HapticIntensity) => {
    onValueChange(intensity);
    // Demonstrate the selected intensity immediately
    onDemoIntensity(intensity);
  };

  // If current value is 'off', default to 'normal' for display
  const displayValue = value === 'off' ? 'normal' : value;

  return (
    <View style={styles.intensityContainer}>
      <Text style={styles.intensityLabel}>{t('accessibilitySettings.hapticIntensity')}</Text>
      <View style={styles.intensityOptions}>
        {intensities.map(({ key, dots }) => {
          const isSelected = displayValue === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.intensityOption,
                isSelected && { borderColor: accentColor, backgroundColor: accentColorLight + '20' },
              ]}
              onPress={() => handleSelect(key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={getIntensityLabel(key)}
            >
              <IntensityDots level={dots} isSelected={isSelected} accentColor={accentColor} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Accent color picker component
interface AccentColorPickerProps {
  value: AccentColorKey;
  onValueChange: (color: AccentColorKey) => void;
  onFeedback: () => void;
}

function AccentColorPicker({ value, onValueChange, onFeedback }: AccentColorPickerProps) {
  const { t } = useTranslation();

  const handleSelect = (colorKey: AccentColorKey) => {
    onValueChange(colorKey);
    onFeedback();
  };

  return (
    <View style={styles.colorPickerContainer}>
      <Text style={styles.colorPickerLabel}>{t('accessibilitySettings.accentColor')}</Text>
      <Text style={styles.colorPickerHint}>{t('accessibilitySettings.accentColorHint')}</Text>
      <View style={styles.colorOptions}>
        {ACCENT_COLOR_KEYS.map((colorKey) => {
          const isSelected = value === colorKey;
          const color = accentColors[colorKey];
          return (
            <TouchableOpacity
              key={colorKey}
              style={[
                styles.colorOption,
                { borderColor: isSelected ? color.primary : colors.border },
              ]}
              onPress={() => handleSelect(colorKey)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(color.label)}
            >
              <View style={[styles.colorSwatch, { backgroundColor: color.primary }]}>
                {isSelected && (
                  <Icon name="check" size={24} color={colors.textOnPrimary} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// TTS Speech Rate selector component
interface TtsSpeechRateSelectorProps {
  value: TtsSpeechRate;
  onValueChange: (rate: TtsSpeechRate) => void;
  accentColor: string;
}

function TtsSpeechRateSelector({ value, onValueChange, accentColor }: TtsSpeechRateSelectorProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.ttsSpeedContainer}>
      <Text style={styles.ttsSpeedLabel}>{t('accessibilitySettings.ttsSpeed')}</Text>
      <Text style={styles.ttsSpeedHint}>{t('accessibilitySettings.ttsSpeedHint')}</Text>
      <View style={styles.ttsSpeedOptions}>
        {TTS_SPEED_OPTIONS.map(({ value: optionValue, label }) => {
          const isSelected = value === optionValue;
          return (
            <TouchableOpacity
              key={optionValue}
              style={[
                styles.ttsSpeedOption,
                isSelected && { borderColor: accentColor, backgroundColor: accentColor + '20' },
              ]}
              onPress={() => onValueChange(optionValue)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t('accessibilitySettings.ttsSpeedOption', { percent: label })}
            >
              <Text
                style={[
                  styles.ttsSpeedOptionText,
                  isSelected && { color: accentColor, fontWeight: '700' },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function AccessibilitySettingsScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();

  // Hold-to-Navigate settings
  const {
    settings: holdSettings,
    updateLongPressDelay,
    updateEdgeExclusionSize,
    updateWheelBlurIntensity,
    updateWheelDismissMargin,
  } = useHoldToNavigate();

  // Feedback settings
  const {
    settings: feedbackSettings,
    updateHapticIntensity,
    updateAudioFeedbackEnabled,
    updateAudioFeedbackBoost,
    triggerFeedback,
  } = useFeedback();

  // Accent color settings
  const { accentColorKey, accentColor, updateAccentColor } = useAccentColor();

  // Voice commands settings
  const {
    settings: voiceSettings,
    updateEnabled: updateVoiceEnabled,
  } = useVoiceCommands();

  // TTS settings
  const { speechRate, updateSpeechRate } = useTtsSettings();

  // Derived state: is haptic enabled?
  const isHapticEnabled = feedbackSettings.hapticIntensity !== 'off';

  // Handle haptic toggle
  const handleHapticToggle = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        // Turn on with 'normal' intensity
        void updateHapticIntensity('normal');
        void triggerFeedback('tap');
      } else {
        // Turn off
        void updateHapticIntensity('off');
      }
    },
    [updateHapticIntensity, triggerFeedback],
  );

  // Handle haptic intensity change (only when enabled)
  const handleHapticIntensityChange = useCallback(
    (intensity: HapticIntensity) => {
      void updateHapticIntensity(intensity);
    },
    [updateHapticIntensity],
  );

  // Demo feedback with specific intensity (called immediately when selecting)
  // Plays both haptic AND audio so user can experience the intensity
  const handleDemoHapticIntensity = useCallback(
    (intensity: HapticIntensity) => {
      void triggerFeedback('tap', intensity);
    },
    [triggerFeedback],
  );

  // Handle audio toggle
  const handleAudioToggle = useCallback(
    (enabled: boolean) => {
      void updateAudioFeedbackEnabled(enabled);
      if (enabled) {
        void triggerFeedback('tap');
      }
    },
    [updateAudioFeedbackEnabled, triggerFeedback],
  );

  // Handle audio boost toggle
  // Pass the NEW boost value explicitly to triggerFeedback so user hears the difference
  const handleAudioBoostToggle = useCallback(
    (boost: boolean) => {
      void updateAudioFeedbackBoost(boost);
      // Trigger feedback with the NEW boost value so user can immediately hear the difference
      // Third parameter is the audioBoost override
      void triggerFeedback('tap', undefined, boost);
    },
    [updateAudioFeedbackBoost, triggerFeedback],
  );

  // Handlers for hold-to-navigate settings
  const handleDelayDecrease = useCallback(() => {
    const newValue = Math.max(
      HOLD_TO_NAVIGATE_CONSTANTS.MIN_LONG_PRESS_DELAY,
      holdSettings.longPressDelay - 250
    );
    void updateLongPressDelay(newValue);
    void triggerFeedback('tap');
  }, [holdSettings.longPressDelay, updateLongPressDelay, triggerFeedback]);

  const handleDelayIncrease = useCallback(() => {
    const newValue = Math.min(
      HOLD_TO_NAVIGATE_CONSTANTS.MAX_LONG_PRESS_DELAY,
      holdSettings.longPressDelay + 250
    );
    void updateLongPressDelay(newValue);
    void triggerFeedback('tap');
  }, [holdSettings.longPressDelay, updateLongPressDelay, triggerFeedback]);

  const handleEdgeDecrease = useCallback(() => {
    const newValue = Math.max(
      HOLD_TO_NAVIGATE_CONSTANTS.MIN_EDGE_EXCLUSION_SIZE,
      holdSettings.edgeExclusionSize - 10
    );
    void updateEdgeExclusionSize(newValue);
    void triggerFeedback('tap');
  }, [holdSettings.edgeExclusionSize, updateEdgeExclusionSize, triggerFeedback]);

  const handleEdgeIncrease = useCallback(() => {
    const newValue = Math.min(
      HOLD_TO_NAVIGATE_CONSTANTS.MAX_EDGE_EXCLUSION_SIZE,
      holdSettings.edgeExclusionSize + 10
    );
    void updateEdgeExclusionSize(newValue);
    void triggerFeedback('tap');
  }, [holdSettings.edgeExclusionSize, updateEdgeExclusionSize, triggerFeedback]);

  const handleBlurDecrease = useCallback(() => {
    const newValue = Math.max(
      HOLD_TO_NAVIGATE_CONSTANTS.MIN_WHEEL_BLUR_INTENSITY,
      holdSettings.wheelBlurIntensity - 5
    );
    void updateWheelBlurIntensity(newValue);
    void triggerFeedback('tap');
  }, [holdSettings.wheelBlurIntensity, updateWheelBlurIntensity, triggerFeedback]);

  const handleBlurIncrease = useCallback(() => {
    const newValue = Math.min(
      HOLD_TO_NAVIGATE_CONSTANTS.MAX_WHEEL_BLUR_INTENSITY,
      holdSettings.wheelBlurIntensity + 5
    );
    void updateWheelBlurIntensity(newValue);
    void triggerFeedback('tap');
  }, [holdSettings.wheelBlurIntensity, updateWheelBlurIntensity, triggerFeedback]);

  const handleDismissDecrease = useCallback(() => {
    const newValue = Math.max(
      HOLD_TO_NAVIGATE_CONSTANTS.MIN_WHEEL_DISMISS_MARGIN,
      holdSettings.wheelDismissMargin - 10
    );
    void updateWheelDismissMargin(newValue);
    void triggerFeedback('tap');
  }, [holdSettings.wheelDismissMargin, updateWheelDismissMargin, triggerFeedback]);

  const handleDismissIncrease = useCallback(() => {
    const newValue = Math.min(
      HOLD_TO_NAVIGATE_CONSTANTS.MAX_WHEEL_DISMISS_MARGIN,
      holdSettings.wheelDismissMargin + 10
    );
    void updateWheelDismissMargin(newValue);
    void triggerFeedback('tap');
  }, [holdSettings.wheelDismissMargin, updateWheelDismissMargin, triggerFeedback]);

  // Handle voice commands toggle
  const handleVoiceToggle = useCallback(
    (enabled: boolean) => {
      void updateVoiceEnabled(enabled);
      if (enabled) {
        void triggerFeedback('tap');
      }
    },
    [updateVoiceEnabled, triggerFeedback],
  );

  // Handle accent color change
  const handleAccentColorChange = useCallback(
    (colorKey: AccentColorKey) => {
      void updateAccentColor(colorKey);
    },
    [updateAccentColor],
  );

  // Handle feedback for accent color picker
  const handleAccentColorFeedback = useCallback(() => {
    void triggerFeedback('tap');
  }, [triggerFeedback]);

  // Voice focus items for voice navigation
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return [];

    let index = 0;
    const items = [
      {
        id: 'haptic-feedback',
        label: t('accessibilitySettings.hapticFeedback'),
        index: index++,
        onSelect: () => handleHapticToggle(!isHapticEnabled),
      },
      {
        id: 'audio-feedback',
        label: t('accessibilitySettings.audioFeedback'),
        index: index++,
        onSelect: () => handleAudioToggle(!feedbackSettings.audioFeedbackEnabled),
      },
    ];

    // Add audio boost if audio is enabled
    if (feedbackSettings.audioFeedbackEnabled) {
      items.push({
        id: 'audio-boost',
        label: t('accessibilitySettings.audioBoost'),
        index: index++,
        onSelect: () => handleAudioBoostToggle(!feedbackSettings.audioFeedbackBoost),
      });
    }

    // Add voice commands toggle
    items.push({
      id: 'voice-commands',
      label: t('voiceCommands.enabled'),
      index: index++,
      onSelect: () => handleVoiceToggle(!voiceSettings.enabled),
    });

    // Add hold-to-navigate steppers
    items.push(
      {
        id: 'hold-delay',
        label: t('settings.holdDelay'),
        index: index++,
        onSelect: () => {}, // Steppers handle their own +/- actions
      },
      {
        id: 'edge-exclusion',
        label: t('settings.edgeExclusion'),
        index: index++,
        onSelect: () => {},
      },
      {
        id: 'wheel-blur',
        label: t('settings.wheelBlur'),
        index: index++,
        onSelect: () => {},
      },
      {
        id: 'wheel-dismiss',
        label: t('settings.wheelDismissMargin'),
        index: index++,
        onSelect: () => {},
      },
      {
        id: 'test-feedback',
        label: t('accessibilitySettings.testFeedback'),
        index: index++,
        onSelect: () => void triggerFeedback('tap'),
      }
    );

    return items;
  }, [
    isFocused,
    t,
    isHapticEnabled,
    feedbackSettings.audioFeedbackEnabled,
    feedbackSettings.audioFeedbackBoost,
    voiceSettings.enabled,
    handleHapticToggle,
    handleAudioToggle,
    handleAudioBoostToggle,
    handleVoiceToggle,
    triggerFeedback,
  ]);

  const { scrollRef, isFocused: isItemFocused, getFocusStyle } = useVoiceFocusList(
    'accessibility-settings-list',
    voiceFocusItems
  );

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Feedback section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('accessibilitySettings.feedbackTitle')}</Text>
        <Text style={styles.sectionHint}>{t('accessibilitySettings.feedbackHint')}</Text>

        {/* Haptic feedback toggle */}
        <ToggleRow
          label={t('accessibilitySettings.hapticFeedback')}
          hint={t('accessibilitySettings.hapticFeedbackHint')}
          value={isHapticEnabled}
          onValueChange={handleHapticToggle}
          accentColor={accentColor.primary}
          accentColorLight={accentColor.primaryLight}
        />

        {/* Haptic intensity selector (only visible when haptic is enabled) */}
        {isHapticEnabled && (
          <HapticIntensitySelector
            value={feedbackSettings.hapticIntensity}
            onValueChange={handleHapticIntensityChange}
            onDemoIntensity={handleDemoHapticIntensity}
            accentColor={accentColor.primary}
            accentColorLight={accentColor.primaryLight}
          />
        )}

        {/* Audio feedback toggle */}
        <ToggleRow
          label={t('accessibilitySettings.audioFeedback')}
          hint={t('accessibilitySettings.audioFeedbackHint')}
          value={feedbackSettings.audioFeedbackEnabled}
          onValueChange={handleAudioToggle}
          accentColor={accentColor.primary}
          accentColorLight={accentColor.primaryLight}
        />

        {/* Audio boost toggle (only visible when audio is enabled) */}
        {feedbackSettings.audioFeedbackEnabled && (
          <ToggleRow
            label={t('accessibilitySettings.audioBoost')}
            hint={t('accessibilitySettings.audioBoostHint')}
            value={feedbackSettings.audioFeedbackBoost}
            onValueChange={handleAudioBoostToggle}
            accentColor={accentColor.primary}
            accentColorLight={accentColor.primaryLight}
          />
        )}

        {/* Voice commands toggle */}
        <ToggleRow
          label={t('voiceCommands.enabled')}
          hint={t('voiceCommands.enabledHint')}
          value={voiceSettings.enabled}
          onValueChange={handleVoiceToggle}
          accentColor={accentColor.primary}
          accentColorLight={accentColor.primaryLight}
        />

        {/* TTS Speech Rate selector */}
        <TtsSpeechRateSelector
          value={speechRate}
          onValueChange={(rate) => {
            void updateSpeechRate(rate);
            void triggerFeedback('tap');
          }}
          accentColor={accentColor.primary}
        />
      </View>

      {/* Appearance section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('accessibilitySettings.appearanceTitle')}</Text>
        <AccentColorPicker
          value={accentColorKey}
          onValueChange={handleAccentColorChange}
          onFeedback={handleAccentColorFeedback}
        />
      </View>

      {/* Hold-to-Navigate section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('accessibilitySettings.holdToNavigateTitle')}</Text>
        <Text style={styles.sectionHint}>{t('settings.accessibilityHint')}</Text>

        {/* Long press delay */}
        <Stepper
          label={t('settings.holdDelay')}
          value={t('settings.holdDelaySeconds', {
            seconds: (holdSettings.longPressDelay / 1000).toFixed(1),
          })}
          onDecrease={handleDelayDecrease}
          onIncrease={handleDelayIncrease}
          decreaseDisabled={holdSettings.longPressDelay <= HOLD_TO_NAVIGATE_CONSTANTS.MIN_LONG_PRESS_DELAY}
          increaseDisabled={holdSettings.longPressDelay >= HOLD_TO_NAVIGATE_CONSTANTS.MAX_LONG_PRESS_DELAY}
          accentColor={accentColor.primary}
        />

        {/* Edge exclusion */}
        <Stepper
          label={t('settings.edgeExclusion')}
          value={
            holdSettings.edgeExclusionSize === 0
              ? t('settings.edgeExclusionOff')
              : t('settings.edgeExclusionPixels', { pixels: holdSettings.edgeExclusionSize })
          }
          onDecrease={handleEdgeDecrease}
          onIncrease={handleEdgeIncrease}
          decreaseDisabled={holdSettings.edgeExclusionSize <= HOLD_TO_NAVIGATE_CONSTANTS.MIN_EDGE_EXCLUSION_SIZE}
          increaseDisabled={holdSettings.edgeExclusionSize >= HOLD_TO_NAVIGATE_CONSTANTS.MAX_EDGE_EXCLUSION_SIZE}
          accentColor={accentColor.primary}
        />

        {/* Wheel blur intensity */}
        <Stepper
          label={t('settings.wheelBlur')}
          value={
            holdSettings.wheelBlurIntensity === 0
              ? t('settings.wheelBlurOff')
              : t('settings.wheelBlurLevel', { level: holdSettings.wheelBlurIntensity })
          }
          onDecrease={handleBlurDecrease}
          onIncrease={handleBlurIncrease}
          decreaseDisabled={holdSettings.wheelBlurIntensity <= HOLD_TO_NAVIGATE_CONSTANTS.MIN_WHEEL_BLUR_INTENSITY}
          increaseDisabled={holdSettings.wheelBlurIntensity >= HOLD_TO_NAVIGATE_CONSTANTS.MAX_WHEEL_BLUR_INTENSITY}
          accentColor={accentColor.primary}
        />

        {/* Wheel dismiss margin */}
        <Stepper
          label={t('settings.wheelDismissMargin')}
          value={t('settings.wheelDismissMarginPixels', { pixels: holdSettings.wheelDismissMargin })}
          onDecrease={handleDismissDecrease}
          onIncrease={handleDismissIncrease}
          decreaseDisabled={holdSettings.wheelDismissMargin <= HOLD_TO_NAVIGATE_CONSTANTS.MIN_WHEEL_DISMISS_MARGIN}
          increaseDisabled={holdSettings.wheelDismissMargin >= HOLD_TO_NAVIGATE_CONSTANTS.MAX_WHEEL_DISMISS_MARGIN}
          accentColor={accentColor.primary}
        />
      </View>

      {/* Test feedback button */}
      <TouchableOpacity
        style={[styles.testButton, { backgroundColor: accentColor.primary }]}
        onPress={() => void triggerFeedback('tap')}
        accessibilityRole="button"
        accessibilityLabel={t('accessibilitySettings.testFeedback')}
      >
        <Text style={styles.testButtonText}>{t('accessibilitySettings.testFeedback')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.small,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  // Stepper styles
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: touchTargets.comfortable,
  },
  stepperLabelContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  stepperLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  stepperValue: {
    ...typography.small,
    // Color is set dynamically via accentColor prop
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  stepperButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepperButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonDisabled: {
    backgroundColor: colors.border,
  },
  stepperButtonText: {
    ...typography.h2,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  // Toggle styles
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: touchTargets.comfortable,
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  toggleHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  // Haptic intensity selector styles
  intensityContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  intensityLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  intensityOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  intensityOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: touchTargets.comfortable,
    justifyContent: 'center',
    alignItems: 'center',
  },
  intensityOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '20',
  },
  // Dot grid styles for intensity visualization
  dotsContainer: {
    gap: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // Accent color picker styles
  colorPickerContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  colorPickerLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  colorPickerHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  colorOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  colorOption: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    borderWidth: 3,
    padding: 4,
    minHeight: touchTargets.minimum,
    maxWidth: touchTargets.large,
  },
  colorSwatch: {
    flex: 1,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Test button
  testButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    marginBottom: spacing.xl,
  },
  testButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  // TTS Speech Rate selector styles
  ttsSpeedContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ttsSpeedLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  ttsSpeedHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  ttsSpeedOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ttsSpeedOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ttsSpeedOptionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
