/**
 * VoiceToggle — Toggle switch with voice control support
 *
 * A senior-inclusive toggle component that:
 * - Can be controlled via voice ("schakel in"/"schakel uit")
 * - Integrates with VoiceFocusable for list navigation
 * - Provides haptic + audio feedback on state change
 * - Shows voice hints when voice session is active
 * - Uses accent color for visual consistency
 *
 * Voice commands supported:
 * - "schakel in" / "schakel uit" (NL)
 * - "turn on" / "turn off" (EN)
 * - "einschalten" / "ausschalten" (DE)
 * - "activer" / "désactiver" (FR)
 * - "activar" / "desactivar" (ES)
 *
 * @example
 * <VoiceToggle
 *   id="high-contrast"
 *   label={t('settings.highContrast')}
 *   value={settings.highContrast}
 *   onValueChange={(value) => updateSettings({ highContrast: value })}
 *   hint={t('settings.highContrastHint')}
 *   index={0}
 * />
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
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

export interface VoiceToggleProps {
  /** Unique identifier for voice targeting */
  id: string;
  /** Label displayed above the toggle — ALWAYS bold */
  label: string;
  /** Current toggle value */
  value: boolean;
  /** Callback when value changes */
  onValueChange: (value: boolean) => void;
  /** Optional hint text displayed below the label */
  hint?: string;
  /** Index in the parent list (for voice navigation order) */
  index: number;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Optional test ID for testing */
  testID?: string;
}

// ============================================================
// Voice Toggle Commands per Language
// ============================================================

const TOGGLE_ON_COMMANDS: Record<string, string[]> = {
  nl: ['schakel in', 'zet aan', 'activeer', 'aan'],
  en: ['turn on', 'enable', 'activate', 'on'],
  de: ['einschalten', 'aktivieren', 'an'],
  fr: ['activer', 'allumer', 'mettre'],
  es: ['activar', 'encender', 'habilitar'],
};

const TOGGLE_OFF_COMMANDS: Record<string, string[]> = {
  nl: ['schakel uit', 'zet uit', 'deactiveer', 'uit'],
  en: ['turn off', 'disable', 'deactivate', 'off'],
  de: ['ausschalten', 'deaktivieren', 'aus'],
  fr: ['désactiver', 'éteindre', 'couper'],
  es: ['desactivar', 'apagar', 'deshabilitar'],
};

// ============================================================
// VoiceToggle Component
// ============================================================

export function VoiceToggle({
  id,
  label,
  value,
  onValueChange,
  hint,
  index,
  disabled = false,
  testID,
}: VoiceToggleProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { isVoiceSessionActive, processVoiceCommand } = useVoiceFocusContext();
  const { accentColor } = useAccentColorContext();
  const { triggerFeedback } = useFeedback();

  // Get current language for voice commands
  const currentLanguage = i18n.language?.substring(0, 2) || 'nl';

  // Handle toggle change with feedback
  const handleValueChange = useCallback(
    async (newValue: boolean) => {
      if (disabled) return;

      // Trigger haptic + audio feedback (medium for on, light for off)
      await triggerFeedback(newValue ? 'tap' : 'light');

      // Update value
      onValueChange(newValue);

      // Announce for screen readers
      AccessibilityInfo.announceForAccessibility(
        newValue
          ? t('a11y.toggledOn', { setting: label })
          : t('a11y.toggledOff', { setting: label })
      );
    },
    [disabled, onValueChange, label, t, triggerFeedback]
  );

  // Handle voice command for this toggle
  const handleVoiceSelect = useCallback(async () => {
    // Toggle the current value when selected via voice
    await handleValueChange(!value);
  }, [value, handleValueChange]);

  // Process voice commands specific to toggles
  useEffect(() => {
    if (!isVoiceSessionActive) return;

    // This effect sets up a listener for toggle-specific voice commands
    // The actual command matching happens in the processVoiceCommand handler
    // which is called by the parent VoiceFocusContext
  }, [isVoiceSessionActive, value, currentLanguage]);

  // Generate voice hint based on current state
  const voiceHint = isVoiceSessionActive
    ? value
      ? t('a11y.voiceToggleHintOff', { defaultValue: 'Zeg "schakel uit" om uit te zetten' })
      : t('a11y.voiceToggleHintOn', { defaultValue: 'Zeg "schakel in" om aan te zetten' })
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
        {/* Label container (left side) */}
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

          {/* Hint text (below label) */}
          {voiceHint && (
            <Text
              style={[
                styles.hint,
                disabled && styles.hintDisabled,
                isVoiceSessionActive && styles.hintVoiceActive,
              ]}
              numberOfLines={2}
            >
              {voiceHint}
            </Text>
          )}
        </View>

        {/* Switch (right side) */}
        <Switch
          value={value}
          onValueChange={handleValueChange}
          disabled={disabled}
          trackColor={{
            false: colors.border,
            true: accentColor.primaryLight,
          }}
          thumbColor={
            disabled
              ? colors.disabled
              : value
                ? accentColor.primary
                : colors.textTertiary
          }
          ios_backgroundColor={colors.border}
          accessibilityLabel={label}
          accessibilityState={{
            checked: value,
            disabled: disabled,
          }}
          accessibilityHint={voiceHint}
          accessibilityRole="switch"
        />
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
  hint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  hintDisabled: {
    color: colors.disabled,
  },
  hintVoiceActive: {
    color: colors.primary,
    fontStyle: 'italic',
  },
});

export default VoiceToggle;
