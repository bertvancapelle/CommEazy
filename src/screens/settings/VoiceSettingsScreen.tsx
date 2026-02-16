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

import React, { useCallback, useState } from 'react';
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

import {
  colors,
  typography,
  spacing,
  touchTargets,
  borderRadius,
} from '@/theme';
import { Icon } from '@/components';
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

  return (
    <View style={styles.commandContainer}>
      <TouchableOpacity
        style={styles.commandHeader}
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityLabel={t(command.nameKey)}
        accessibilityHint={t('voiceSettings.tapToExpand')}
        accessibilityState={{ expanded }}
      >
        <View style={styles.commandInfo}>
          <Text style={styles.commandName}>{t(command.nameKey)}</Text>
          <Text style={styles.commandDescription} numberOfLines={1}>
            {patterns.slice(0, 3).join(', ')}
            {patterns.length > 3 ? ` +${patterns.length - 3}` : ''}
          </Text>
        </View>

        {command.canDisable && (
          <Switch
            value={isEnabled}
            onValueChange={onToggle}
            trackColor={{ false: colors.border, true: accentColorLight }}
            thumbColor={isEnabled ? accentColor : colors.textTertiary}
            accessibilityLabel={t('voiceSettings.enableCommand')}
          />
        )}

        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textTertiary}
        />
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Global settings section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('voiceSettings.generalTitle')}</Text>

        <ToggleRow
          label={t('voiceSettings.enableVoiceControl')}
          hint={t('voiceSettings.enableVoiceControlHint')}
          value={settings.isEnabled}
          onValueChange={(v) => void handleGlobalToggle(v)}
          accentColor={accentColor.primary}
          accentColorLight={accentColor.primaryLight}
        />
      </View>

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
      <TouchableOpacity
        style={styles.resetButton}
        onPress={handleResetToDefaults}
        accessibilityRole="button"
        accessibilityLabel={t('voiceSettings.resetToDefaults')}
      >
        <Text style={styles.resetButtonText}>
          {t('voiceSettings.resetToDefaults')}
        </Text>
      </TouchableOpacity>

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
    marginRight: spacing.sm,
  },
  commandName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
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
