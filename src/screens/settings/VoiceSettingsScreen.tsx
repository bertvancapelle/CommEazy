/**
 * VoiceSettingsScreen — Voice command customization settings
 *
 * Allows users to:
 * - Enable/disable voice control globally
 * - View all voice commands per category
 * - Add custom synonyms for commands
 * - Disable specific command patterns
 * - Configure session timeout and confidence thresholds
 * - Reset to defaults
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear labels and descriptions
 * - Grouped by category for easy navigation
 * - VoiceOver/TalkBack support
 *
 * @see .claude/CLAUDE.md § 11. Voice Interaction Architecture
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  AccessibilityInfo,
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
import { Icon, VoiceFocusable, VoiceToggle } from '@/components';
import { useVoiceFocusList, useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useVoiceSettingsContext } from '@/contexts/VoiceSettingsContext';
import {
  type VoiceCommandCategory,
  type VoiceCommand,
  DEFAULT_VOICE_COMMANDS,
  CATEGORY_I18N_KEYS,
} from '@/types/voiceCommands';

// ============================================================
// Sub-components
// ============================================================

// Toggle row component
interface ToggleRowProps {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  accentColor: string;
  accentColorLight: string;
}

function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  accentColor,
  accentColorLight,
}: ToggleRowProps) {
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

// Command row component
interface CommandRowProps {
  command: VoiceCommand;
  patterns: string[];
  isEnabled: boolean;
  onToggle: () => void;
  onAddPattern: () => void;
  accentColor: string;
  accentColorLight: string;
}

function CommandRow({
  command,
  patterns,
  isEnabled,
  onToggle,
  onAddPattern,
  accentColor,
  accentColorLight,
}: CommandRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  // Get human-readable command name with fallback
  const commandName = t(command.nameKey, { defaultValue: command.id });

  return (
    <View style={styles.commandContainer}>
      <TouchableOpacity
        style={styles.commandHeader}
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityLabel={commandName}
        accessibilityHint={t('voiceSettings.tapToExpand')}
        accessibilityState={{ expanded }}
      >
        <View style={styles.commandInfo}>
          <Text style={styles.commandName}>{commandName}</Text>
          <Text style={styles.commandDescription} numberOfLines={1}>
            {patterns.slice(0, 3).join(', ')}
            {patterns.length > 3 ? ` +${patterns.length - 3}` : ''}
          </Text>
        </View>

        {/* Right side controls: switch (if disableable) + chevron */}
        <View style={styles.commandControls}>
          {command.canDisable && (
            <Switch
              value={isEnabled}
              onValueChange={onToggle}
              trackColor={{ false: colors.border, true: accentColorLight }}
              thumbColor={isEnabled ? accentColor : colors.textTertiary}
              accessibilityLabel={t('voiceSettings.enableCommand')}
              style={styles.commandSwitch}
            />
          )}

          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textTertiary}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.commandExpanded}>
          <Text style={styles.patternsLabel}>{t('voiceSettings.patterns')}</Text>

          {/* Pattern chips */}
          <View style={styles.patternsContainer}>
            {patterns.map((pattern, index) => (
              <View
                key={`${pattern}-${index}`}
                style={[styles.patternChip, { borderColor: accentColor }]}
              >
                <Text style={[styles.patternText, { color: accentColor }]}>
                  "{pattern}"
                </Text>
              </View>
            ))}

            {/* Add pattern button */}
            <TouchableOpacity
              style={[styles.addPatternButton, { borderColor: accentColor }]}
              onPress={onAddPattern}
              accessibilityRole="button"
              accessibilityLabel={t('voiceSettings.addPattern')}
            >
              <Icon name="plus" size={16} color={accentColor} />
              <Text style={[styles.addPatternText, { color: accentColor }]}>
                {t('voiceSettings.addPattern')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// Category section component
interface CategorySectionProps {
  category: VoiceCommandCategory;
  commands: VoiceCommand[];
  accentColor: string;
  accentColorLight: string;
}

function CategorySection({
  category,
  commands,
  accentColor,
  accentColorLight,
}: CategorySectionProps) {
  const { t } = useTranslation();
  const {
    getPatternsForCommand,
    isCommandEnabled,
    enableCommand,
    disableCommand,
    addCustomPattern,
  } = useVoiceSettingsContext();

  const handleToggleCommand = useCallback(
    async (commandId: string, currentlyEnabled: boolean) => {
      if (currentlyEnabled) {
        await disableCommand(commandId);
      } else {
        await enableCommand(commandId);
      }
    },
    [enableCommand, disableCommand]
  );

  const handleAddPattern = useCallback(
    (commandId: string, commandName: string) => {
      Alert.prompt(
        t('voiceSettings.addPatternTitle'),
        t('voiceSettings.addPatternMessage', { command: commandName }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.save'),
            onPress: async (text) => {
              if (text && text.trim()) {
                await addCustomPattern(commandId, text.trim().toLowerCase());
                AccessibilityInfo.announceForAccessibility(
                  t('voiceSettings.patternAdded', { pattern: text.trim() })
                );
              }
            },
          },
        ],
        'plain-text'
      );
    },
    [t, addCustomPattern]
  );

  return (
    <View style={styles.categorySection}>
      <Text style={styles.categoryTitle}>{t(CATEGORY_I18N_KEYS[category])}</Text>

      {commands.map((command) => (
        <CommandRow
          key={command.id}
          command={command}
          patterns={getPatternsForCommand(command.id)}
          isEnabled={isCommandEnabled(command.id)}
          onToggle={() =>
            void handleToggleCommand(command.id, isCommandEnabled(command.id))
          }
          onAddPattern={() => handleAddPattern(command.id, t(command.nameKey))}
          accentColor={accentColor}
          accentColorLight={accentColorLight}
        />
      ))}
    </View>
  );
}

// ============================================================
// Main Screen
// ============================================================

export function VoiceSettingsScreen() {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const { settings, setEnabled, resetToDefaults } = useVoiceSettingsContext();
  const isFocused = useIsFocused();
  const { isVoiceSessionActive } = useVoiceFocusContext();

  // Group commands by category
  const commandsByCategory = React.useMemo(() => {
    const grouped = new Map<VoiceCommandCategory, VoiceCommand[]>();

    DEFAULT_VOICE_COMMANDS.forEach((cmd) => {
      const existing = grouped.get(cmd.category) || [];
      existing.push(cmd);
      grouped.set(cmd.category, existing);
    });

    return grouped;
  }, []);

  // Category order for display
  const categoryOrder: VoiceCommandCategory[] = [
    'navigation',
    'list',
    'form',
    'action',
    'media',
    'session',
    'confirmation',
  ];

  // Handle global toggle
  const handleGlobalToggle = useCallback(
    async (enabled: boolean) => {
      await setEnabled(enabled);
    },
    [setEnabled]
  );

  // Handle reset to defaults
  const handleResetToDefaults = useCallback(() => {
    Alert.alert(
      t('voiceSettings.resetTitle'),
      t('voiceSettings.resetMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('voiceSettings.reset'),
          style: 'destructive',
          onPress: async () => {
            await resetToDefaults();
            AccessibilityInfo.announceForAccessibility(
              t('voiceSettings.resetComplete')
            );
          },
        },
      ]
    );
  }, [t, resetToDefaults]);

  // Voice focus items for voice navigation
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return [];

    const items = [
      {
        id: 'voice-enabled',
        label: t('voiceSettings.enableVoiceControl'),
        index: 0,
        onSelect: () => void handleGlobalToggle(!settings.isEnabled),
      },
      {
        id: 'reset-defaults',
        label: t('voiceSettings.resetToDefaults'),
        index: 1,
        onSelect: handleResetToDefaults,
      },
    ];

    return items;
  }, [isFocused, t, settings.isEnabled, handleGlobalToggle, handleResetToDefaults]);

  const { scrollRef, isFocused: isItemFocused, getFocusStyle } = useVoiceFocusList(
    'voice-settings-list',
    voiceFocusItems
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Global settings section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('voiceSettings.generalTitle')}</Text>

        <VoiceToggle
          id="voice-enabled"
          label={t('voiceSettings.enableVoiceControl')}
          hint={t('voiceSettings.enableVoiceControlHint')}
          value={settings.isEnabled}
          onValueChange={(v) => void handleGlobalToggle(v)}
          index={0}
        />
      </View>

      {/* Tutorial / How to use section */}
      {settings.isEnabled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('voiceSettings.howToUseTitle')}</Text>

          {/* Step 1: Starting voice control */}
          <View style={styles.tutorialStep}>
            <View style={[styles.tutorialStepNumber, { backgroundColor: accentColor.primary }]}>
              <Text style={styles.tutorialStepNumberText}>1</Text>
            </View>
            <View style={styles.tutorialStepContent}>
              <Text style={styles.tutorialStepTitle}>{t('voiceSettings.step1Title')}</Text>
              <Text style={styles.tutorialStepDescription}>{t('voiceSettings.step1Description')}</Text>
            </View>
          </View>

          {/* Step 2: Speaking commands */}
          <View style={styles.tutorialStep}>
            <View style={[styles.tutorialStepNumber, { backgroundColor: accentColor.primary }]}>
              <Text style={styles.tutorialStepNumberText}>2</Text>
            </View>
            <View style={styles.tutorialStepContent}>
              <Text style={styles.tutorialStepTitle}>{t('voiceSettings.step2Title')}</Text>
              <Text style={styles.tutorialStepDescription}>{t('voiceSettings.step2Description')}</Text>
            </View>
          </View>

          {/* Step 3: Voice Session Mode */}
          <View style={styles.tutorialStep}>
            <View style={[styles.tutorialStepNumber, { backgroundColor: accentColor.primary }]}>
              <Text style={styles.tutorialStepNumberText}>3</Text>
            </View>
            <View style={styles.tutorialStepContent}>
              <Text style={styles.tutorialStepTitle}>{t('voiceSettings.step3Title')}</Text>
              <Text style={styles.tutorialStepDescription}>{t('voiceSettings.step3Description')}</Text>
            </View>
          </View>

          {/* Quick commands reference */}
          <View style={styles.quickCommandsBox}>
            <Text style={styles.quickCommandsTitle}>{t('voiceSettings.quickCommandsTitle')}</Text>
            <Text style={styles.quickCommandItem}>• "{t('voiceSettings.exampleContacts')}" → {t('voiceSettings.exampleContactsResult')}</Text>
            <Text style={styles.quickCommandItem}>• "{t('voiceSettings.exampleCall')}" → {t('voiceSettings.exampleCallResult')}</Text>
            <Text style={styles.quickCommandItem}>• "{t('voiceSettings.exampleMessage')}" → {t('voiceSettings.exampleMessageResult')}</Text>
            <Text style={styles.quickCommandItem}>• "{t('voiceSettings.exampleNext')}" → {t('voiceSettings.exampleNextResult')}</Text>
            <Text style={styles.quickCommandItem}>• "{t('voiceSettings.exampleSelect')}" → {t('voiceSettings.exampleSelectResult')}</Text>
            <Text style={styles.quickCommandItem}>• "{t('voiceSettings.exampleStop')}" → {t('voiceSettings.exampleStopResult')}</Text>
          </View>
        </View>
      )}

      {/* Commands by category */}
      {settings.isEnabled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('voiceSettings.commandsTitle')}</Text>
          <Text style={styles.sectionHint}>{t('voiceSettings.commandsHint')}</Text>

          {categoryOrder.map((category) => {
            const commands = commandsByCategory.get(category);
            if (!commands || commands.length === 0) return null;

            return (
              <CategorySection
                key={category}
                category={category}
                commands={commands}
                accentColor={accentColor.primary}
                accentColorLight={accentColor.primaryLight}
              />
            );
          })}
        </View>
      )}

      {/* Reset button */}
      <VoiceFocusable
        id="reset-defaults"
        label={t('voiceSettings.resetToDefaults')}
        index={1}
        onSelect={handleResetToDefaults}
      >
        <TouchableOpacity
          style={[
            styles.resetButton,
            isItemFocused('reset-defaults') && {
              borderColor: getFocusStyle().borderColor,
              borderWidth: getFocusStyle().borderWidth,
              backgroundColor: getFocusStyle().backgroundColor,
              borderRadius: borderRadius.md,
            },
          ]}
          onPress={handleResetToDefaults}
          accessibilityRole="button"
          accessibilityLabel={t('voiceSettings.resetToDefaults')}
          accessibilityHint={
            isVoiceSessionActive
              ? t('a11y.voiceResetHint')
              : undefined
          }
        >
          <Text style={styles.resetButtonText}>
            {t('voiceSettings.resetToDefaults')}
          </Text>
        </TouchableOpacity>
      </VoiceFocusable>

      {/* Spacer for bottom padding */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ============================================================
// Styles
// ============================================================

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
  // Category section styles
  categorySection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  categoryTitle: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  // Command row styles
  commandContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
  },
  commandInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  commandName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  commandControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  commandSwitch: {
    marginRight: spacing.xs,
  },
  commandDescription: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  commandExpanded: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  patternsLabel: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  patternsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  patternChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  patternText: {
    ...typography.small,
    fontWeight: '500',
  },
  addPatternButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  addPatternText: {
    ...typography.small,
    fontWeight: '500',
  },
  // Tutorial styles
  tutorialStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tutorialStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  tutorialStepNumberText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  tutorialStepContent: {
    flex: 1,
  },
  tutorialStepTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  tutorialStepDescription: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  quickCommandsBox: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickCommandsTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  quickCommandItem: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 26,
  },
  // Reset button
  resetButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
  },
  resetButtonText: {
    ...typography.body,
    color: colors.error,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});
