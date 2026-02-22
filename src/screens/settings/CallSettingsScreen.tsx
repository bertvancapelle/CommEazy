/**
 * CallSettingsScreen — Call sound and vibration settings
 *
 * Contains:
 * - Ringtone toggle + sound selection
 * - Incoming call vibration toggle
 * - Dial tone toggle
 * - Outgoing call vibration toggle
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear labels ABOVE controls
 * - VoiceOver/TalkBack support
 * - Simple on/off toggles
 *
 * @see src/services/call/callSoundService.ts
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from '@/theme';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback, type HapticIntensity } from '@/hooks/useFeedback';
import { ServiceContainer } from '@/services/container';
import {
  callSoundService,
  type RingtoneSound,
  DEFAULT_CALL_SOUND_SETTINGS,
} from '@/services/call';
import { Icon } from '@/components';
import { useVoiceFocusList } from '@/contexts/VoiceFocusContext';

// ============================================================
// Toggle Row Component
// ============================================================

interface ToggleRowProps {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  accentColor: string;
  accentColorLight: string;
  triggerHaptic: () => void;
}

function ToggleRow({ label, hint, value, onValueChange, accentColor, accentColorLight, triggerHaptic }: ToggleRowProps) {
  const handleValueChange = (newValue: boolean) => {
    triggerHaptic();
    onValueChange(newValue);
  };

  return (
    <View style={styles.toggleContainer}>
      <View style={styles.toggleLabelContainer}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint && <Text style={styles.toggleHint}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={handleValueChange}
        trackColor={{ false: colors.border, true: accentColorLight }}
        thumbColor={value ? accentColor : colors.textTertiary}
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
      />
    </View>
  );
}

// ============================================================
// Ringtone Selector Component
// ============================================================

interface RingtoneSelectorProps {
  value: RingtoneSound;
  onValueChange: (sound: RingtoneSound) => void;
  accentColor: string;
  accentColorLight: string;
  triggerHaptic: () => void;
}

const RINGTONE_OPTIONS: RingtoneSound[] = ['default', 'classic', 'gentle', 'urgent'];

function RingtoneSelector({ value, onValueChange, accentColor, accentColorLight, triggerHaptic }: RingtoneSelectorProps) {
  const { t } = useTranslation();

  const handleRingtonePress = (ringtone: RingtoneSound) => {
    triggerHaptic();
    onValueChange(ringtone);
  };

  return (
    <View style={styles.ringtoneSelectorContainer}>
      <Text style={styles.ringtoneSelectorLabel}>{t('callSettings.ringtoneSound')}</Text>
      <Text style={styles.ringtoneSelectorHint}>{t('callSettings.ringtoneSoundHint')}</Text>
      <View style={styles.ringtoneOptions}>
        {RINGTONE_OPTIONS.map((ringtone) => {
          const isSelected = value === ringtone;
          return (
            <TouchableOpacity
              key={ringtone}
              style={[
                styles.ringtoneOption,
                isSelected && { borderColor: accentColor, backgroundColor: accentColorLight + '20' },
              ]}
              onPress={() => handleRingtonePress(ringtone)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(`callSettings.ringtones.${ringtone}`)}
            >
              <Text style={[
                styles.ringtoneOptionText,
                isSelected && { color: accentColor, fontWeight: '700' },
              ]}>
                {t(`callSettings.ringtones.${ringtone}`)}
              </Text>
              {isSelected && (
                <Icon name="check" size={20} color={accentColor} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ============================================================
// Main Component
// ============================================================

export function CallSettingsScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const { accentColor } = useAccentColor();
  const { triggerFeedback } = useFeedback();

  // Haptic feedback for toggles - always triggers on any toggle change
  const triggerToggleHaptic = useCallback(() => {
    void triggerFeedback('tap');
  }, [triggerFeedback]);

  // Settings state
  const [ringtoneEnabled, setRingtoneEnabled] = useState(DEFAULT_CALL_SOUND_SETTINGS.ringtoneEnabled);
  const [ringtoneSound, setRingtoneSound] = useState<RingtoneSound>(DEFAULT_CALL_SOUND_SETTINGS.ringtoneSound);
  const [dialToneEnabled, setDialToneEnabled] = useState(DEFAULT_CALL_SOUND_SETTINGS.dialToneEnabled);
  const [incomingVibration, setIncomingVibration] = useState(DEFAULT_CALL_SOUND_SETTINGS.incomingCallVibration);
  const [outgoingVibration, setOutgoingVibration] = useState(DEFAULT_CALL_SOUND_SETTINGS.outgoingCallVibration);

  // Load settings from database
  useEffect(() => {
    async function loadSettings() {
      try {
        if (!ServiceContainer.isInitialized) return;

        const profile = await ServiceContainer.database.getUserProfile();
        if (profile) {
          setRingtoneEnabled(profile.ringtoneEnabled ?? DEFAULT_CALL_SOUND_SETTINGS.ringtoneEnabled);
          setRingtoneSound((profile.ringtoneSound as RingtoneSound) ?? DEFAULT_CALL_SOUND_SETTINGS.ringtoneSound);
          setDialToneEnabled(profile.dialToneEnabled ?? DEFAULT_CALL_SOUND_SETTINGS.dialToneEnabled);
          setIncomingVibration(profile.incomingCallVibration ?? DEFAULT_CALL_SOUND_SETTINGS.incomingCallVibration);
          setOutgoingVibration(profile.outgoingCallVibration ?? DEFAULT_CALL_SOUND_SETTINGS.outgoingCallVibration);

          // Update callSoundService with loaded settings
          callSoundService.updateSettings({
            ringtoneEnabled: profile.ringtoneEnabled ?? DEFAULT_CALL_SOUND_SETTINGS.ringtoneEnabled,
            ringtoneSound: (profile.ringtoneSound as RingtoneSound) ?? DEFAULT_CALL_SOUND_SETTINGS.ringtoneSound,
            dialToneEnabled: profile.dialToneEnabled ?? DEFAULT_CALL_SOUND_SETTINGS.dialToneEnabled,
            incomingCallVibration: profile.incomingCallVibration ?? DEFAULT_CALL_SOUND_SETTINGS.incomingCallVibration,
            outgoingCallVibration: profile.outgoingCallVibration ?? DEFAULT_CALL_SOUND_SETTINGS.outgoingCallVibration,
            hapticIntensity: (profile.hapticIntensity as HapticIntensity) ?? 'normal',
          });
        }
      } catch (error) {
        console.error('[CallSettingsScreen] Failed to load settings:', error);
      }
    }

    void loadSettings();
  }, []);

  // Save setting to database
  const saveSetting = useCallback(async (key: string, value: boolean | string) => {
    try {
      if (!ServiceContainer.isInitialized) return;

      const profile = await ServiceContainer.database.getUserProfile();
      if (profile) {
        await ServiceContainer.database.saveUserProfile({
          ...profile,
          [key]: value,
        });
      }
    } catch (error) {
      console.error('[CallSettingsScreen] Failed to save setting:', error);
    }
  }, []);

  // Handle ringtone toggle (haptic feedback handled by ToggleRow)
  const handleRingtoneToggle = useCallback((enabled: boolean) => {
    setRingtoneEnabled(enabled);
    callSoundService.updateSettings({ ringtoneEnabled: enabled });
    void saveSetting('ringtoneEnabled', enabled);
  }, [saveSetting]);

  // Handle ringtone sound change
  const handleRingtoneSoundChange = useCallback((sound: RingtoneSound) => {
    setRingtoneSound(sound);
    callSoundService.updateSettings({ ringtoneSound: sound });
    void saveSetting('ringtoneSound', sound);

    // Play a preview of the selected ringtone
    callSoundService.startRingtone();
    setTimeout(() => callSoundService.stopRingtone(), 2000); // Stop after 2 seconds
  }, [saveSetting]);

  // Handle dial tone toggle (haptic feedback handled by ToggleRow)
  const handleDialToneToggle = useCallback((enabled: boolean) => {
    setDialToneEnabled(enabled);
    callSoundService.updateSettings({ dialToneEnabled: enabled });
    void saveSetting('dialToneEnabled', enabled);
  }, [saveSetting]);

  // Handle incoming vibration toggle (haptic feedback handled by ToggleRow)
  const handleIncomingVibrationToggle = useCallback((enabled: boolean) => {
    setIncomingVibration(enabled);
    callSoundService.updateSettings({ incomingCallVibration: enabled });
    void saveSetting('incomingCallVibration', enabled);
  }, [saveSetting]);

  // Handle outgoing vibration toggle (haptic feedback handled by ToggleRow)
  const handleOutgoingVibrationToggle = useCallback((enabled: boolean) => {
    setOutgoingVibration(enabled);
    callSoundService.updateSettings({ outgoingCallVibration: enabled });
    void saveSetting('outgoingCallVibration', enabled);
  }, [saveSetting]);

  // Voice focus items
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return [];

    let index = 0;
    return [
      {
        id: 'ringtone-enabled',
        label: t('callSettings.ringtoneEnabled'),
        index: index++,
        onSelect: () => handleRingtoneToggle(!ringtoneEnabled),
      },
      {
        id: 'incoming-vibration',
        label: t('callSettings.incomingVibration'),
        index: index++,
        onSelect: () => handleIncomingVibrationToggle(!incomingVibration),
      },
      {
        id: 'dial-tone',
        label: t('callSettings.dialToneEnabled'),
        index: index++,
        onSelect: () => handleDialToneToggle(!dialToneEnabled),
      },
      {
        id: 'outgoing-vibration',
        label: t('callSettings.outgoingVibration'),
        index: index++,
        onSelect: () => handleOutgoingVibrationToggle(!outgoingVibration),
      },
    ];
  }, [
    isFocused,
    t,
    ringtoneEnabled,
    incomingVibration,
    dialToneEnabled,
    outgoingVibration,
    handleRingtoneToggle,
    handleIncomingVibrationToggle,
    handleDialToneToggle,
    handleOutgoingVibrationToggle,
  ]);

  const { scrollRef } = useVoiceFocusList('call-settings-list', voiceFocusItems);

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Incoming calls section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('callSettings.ringtoneSection')}</Text>

        {/* Ringtone toggle */}
        <ToggleRow
          label={t('callSettings.ringtoneEnabled')}
          hint={t('callSettings.ringtoneEnabledHint')}
          value={ringtoneEnabled}
          onValueChange={handleRingtoneToggle}
          accentColor={accentColor.primary}
          accentColorLight={accentColor.primaryLight}
          triggerHaptic={triggerToggleHaptic}
        />

        {/* Ringtone sound selector (only shown when enabled) */}
        {ringtoneEnabled && (
          <RingtoneSelector
            value={ringtoneSound}
            onValueChange={handleRingtoneSoundChange}
            accentColor={accentColor.primary}
            accentColorLight={accentColor.primaryLight}
            triggerHaptic={triggerToggleHaptic}
          />
        )}

        {/* Incoming vibration toggle */}
        <ToggleRow
          label={t('callSettings.incomingVibration')}
          hint={t('callSettings.incomingVibrationHint')}
          value={incomingVibration}
          onValueChange={handleIncomingVibrationToggle}
          accentColor={accentColor.primary}
          accentColorLight={accentColor.primaryLight}
          triggerHaptic={triggerToggleHaptic}
        />
      </View>

      {/* Outgoing calls section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('callSettings.outgoingSection')}</Text>

        {/* Dial tone toggle */}
        <ToggleRow
          label={t('callSettings.dialToneEnabled')}
          hint={t('callSettings.dialToneEnabledHint')}
          value={dialToneEnabled}
          onValueChange={handleDialToneToggle}
          accentColor={accentColor.primary}
          accentColorLight={accentColor.primaryLight}
          triggerHaptic={triggerToggleHaptic}
        />

        {/* Outgoing vibration toggle */}
        <ToggleRow
          label={t('callSettings.outgoingVibration')}
          hint={t('callSettings.outgoingVibrationHint')}
          value={outgoingVibration}
          onValueChange={handleOutgoingVibrationToggle}
          accentColor={accentColor.primary}
          accentColorLight={accentColor.primaryLight}
          triggerHaptic={triggerToggleHaptic}
        />
      </View>
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
    paddingBottom: spacing.sm,
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
  // Ringtone selector styles
  ringtoneSelectorContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ringtoneSelectorLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  ringtoneSelectorHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  ringtoneOptions: {
    gap: spacing.sm,
  },
  ringtoneOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: touchTargets.comfortable,
  },
  ringtoneOptionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
