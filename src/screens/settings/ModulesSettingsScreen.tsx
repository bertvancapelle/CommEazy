/**
 * ModulesSettingsScreen — Settings for country-specific modules
 *
 * Allows users to:
 * - View all available modules grouped by country
 * - Enable/disable modules for their account
 * - See which modules are auto-enabled for their country
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear toggle switches with labels
 * - Country flags for visual distinction
 * - VoiceOver support
 *
 * @see .claude/plans/COUNTRY_SPECIFIC_MODULES.md (Fase 6)
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, VoiceFocusable, IconButton, type IconName } from '@/components';
import { useVoiceFocusList } from '@/contexts/VoiceFocusContext';
import { useFeedback } from '@/hooks/useFeedback';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useModuleConfig, useAvailableModules } from '@/contexts/ModuleConfigContext';
import type { SettingsStackParams } from '@/navigation';
import type { CountryModuleDefinition } from '@/types/modules';

type NavigationProp = NativeStackNavigationProp<SettingsStackParams, 'ModulesSettings'>;

// ============================================================
// Country Flag Emojis
// ============================================================

const COUNTRY_FLAGS: Record<string, string> = {
  NL: '🇳🇱',
  BE: '🇧🇪',
  GB: '🇬🇧',
  DE: '🇩🇪',
  FR: '🇫🇷',
  ES: '🇪🇸',
};

// ============================================================
// Module Icon Mapping
// ============================================================

const MODULE_ICONS: Record<string, IconName> = {
  news: 'news',
  newspaper: 'news',
  weather: 'weather',
  sports: 'sports',
  tv: 'tv',
};

// ============================================================
// Module Toggle Row Component
// ============================================================

interface ModuleToggleRowProps {
  module: CountryModuleDefinition & { isEnabled: boolean };
  isUserCountry: boolean;
  onToggle: (moduleId: string, enabled: boolean) => void;
  focused?: boolean;
  focusStyle?: { borderColor: string; borderWidth: number; backgroundColor: string };
  accentColor: string;
}

function ModuleToggleRow({
  module,
  isUserCountry,
  onToggle,
  focused,
  focusStyle,
  accentColor,
}: ModuleToggleRowProps) {
  const { t } = useTranslation();
  const { triggerFeedback } = useFeedback();

  const handleToggle = useCallback(
    (value: boolean) => {
      void triggerFeedback('tap');
      onToggle(module.id, value);
    },
    [module.id, onToggle, triggerFeedback]
  );

  const iconName = MODULE_ICONS[module.icon] ?? 'news';

  return (
    <View
      style={[
        styles.moduleRow,
        focused && focusStyle && {
          borderColor: focusStyle.borderColor,
          borderWidth: focusStyle.borderWidth,
          backgroundColor: focusStyle.backgroundColor,
        },
      ]}
    >
      {/* Module icon with color */}
      <View style={[styles.moduleIconContainer, { backgroundColor: module.color }]}>
        <Icon name={iconName} size={20} color={colors.textOnPrimary} />
      </View>

      {/* Module info */}
      <View style={styles.moduleInfo}>
        <Text style={styles.moduleName}>{t(module.labelKey)}</Text>
        {isUserCountry && (
          <Text style={styles.moduleAutoEnabled}>
            {t('settings.modules.autoEnabled')}
          </Text>
        )}
      </View>

      {/* Toggle switch */}
      <Switch
        value={module.isEnabled}
        onValueChange={handleToggle}
        trackColor={{
          false: colors.border,
          true: accentColor,
        }}
        thumbColor={module.isEnabled ? colors.textOnPrimary : colors.surface}
        ios_backgroundColor={colors.border}
        accessibilityLabel={t(module.labelKey)}
        accessibilityHint={
          module.isEnabled
            ? t('settings.modules.tapToDisable')
            : t('settings.modules.tapToEnable')
        }
      />
    </View>
  );
}

// ============================================================
// Country Section Component
// ============================================================

interface CountrySectionProps {
  countryCode: string;
  modules: Array<CountryModuleDefinition & { isEnabled: boolean }>;
  isUserCountry: boolean;
  onToggle: (moduleId: string, enabled: boolean) => void;
  startIndex: number;
  isItemFocused: (id: string) => boolean;
  getFocusStyle: () => { borderColor: string; borderWidth: number; backgroundColor: string };
  accentColor: string;
}

function CountrySection({
  countryCode,
  modules,
  isUserCountry,
  onToggle,
  startIndex,
  isItemFocused,
  getFocusStyle,
  accentColor,
}: CountrySectionProps) {
  const { t } = useTranslation();

  const flag = COUNTRY_FLAGS[countryCode] ?? '🌍';
  const countryName = t(`settings.modules.countries.${countryCode}`);

  return (
    <View style={styles.countrySection}>
      {/* Country header */}
      <View style={styles.countryHeader}>
        <Text style={styles.countryFlag}>{flag}</Text>
        <Text style={styles.countryName}>{countryName}</Text>
        {isUserCountry && (
          <View style={[styles.yourCountryBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.yourCountryText}>
              {t('settings.modules.yourCountry')}
            </Text>
          </View>
        )}
      </View>

      {/* Module toggles */}
      <View style={styles.modulesContainer}>
        {modules.map((module, index) => (
          <VoiceFocusable
            key={module.id}
            id={module.id}
            label={t(module.labelKey)}
            index={startIndex + index}
            onSelect={() => onToggle(module.id, !module.isEnabled)}
          >
            <ModuleToggleRow
              module={module}
              isUserCountry={isUserCountry}
              onToggle={onToggle}
              focused={isItemFocused(module.id)}
              focusStyle={getFocusStyle()}
              accentColor={accentColor}
            />
          </VoiceFocusable>
        ))}
      </View>
    </View>
  );
}

// ============================================================
// Main Screen Component
// ============================================================

export function ModulesSettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { accentColor } = useAccentColor();
  const { triggerFeedback } = useFeedback();

  // Module data
  const { enableModule, disableModule } = useModuleConfig();
  const { modulesByCountry, userCountryCode } = useAvailableModules();

  // Get sorted country codes (user's country first)
  const sortedCountries = useMemo(() => {
    const countries = Object.keys(modulesByCountry);
    // Put user's country first
    if (userCountryCode && countries.includes(userCountryCode)) {
      return [
        userCountryCode,
        ...countries.filter((c) => c !== userCountryCode).sort(),
      ];
    }
    return countries.sort();
  }, [modulesByCountry, userCountryCode]);

  // Build flat list of all modules for voice navigation
  const allModulesFlat = useMemo(() => {
    const flat: Array<{ id: string; label: string; index: number }> = [];
    let index = 0;

    for (const countryCode of sortedCountries) {
      const modules = modulesByCountry[countryCode] ?? [];
      for (const module of modules) {
        flat.push({
          id: module.id,
          label: t(module.labelKey),
          index,
        });
        index++;
      }
    }

    return flat;
  }, [sortedCountries, modulesByCountry, t]);

  // Voice Focus: Register modules for voice navigation
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return [];
    return allModulesFlat.map((item) => ({
      ...item,
      onSelect: () => {
        // Toggle the module
        const module = Object.values(modulesByCountry)
          .flat()
          .find((m) => m.id === item.id);
        if (module) {
          void handleModuleToggle(module.id, !module.isEnabled);
        }
      },
    }));
  }, [allModulesFlat, isFocused, modulesByCountry]);

  const { scrollRef, isFocused: isItemFocused, getFocusStyle } = useVoiceFocusList(
    'modules-settings-list',
    voiceFocusItems
  );

  // Handle module toggle
  const handleModuleToggle = useCallback(
    async (moduleId: string, enabled: boolean) => {
      try {
        if (enabled) {
          await enableModule(moduleId);
        } else {
          await disableModule(moduleId);
        }
      } catch (error) {
        console.error('[ModulesSettingsScreen] Toggle failed:', error);
      }
    },
    [enableModule, disableModule]
  );

  // Handle back navigation
  const handleBack = useCallback(() => {
    void triggerFeedback('tap');
    navigation.goBack();
  }, [navigation, triggerFeedback]);

  // Calculate starting index for each country section
  const countryStartIndexes = useMemo(() => {
    const indexes: Record<string, number> = {};
    let currentIndex = 0;

    for (const countryCode of sortedCountries) {
      indexes[countryCode] = currentIndex;
      currentIndex += (modulesByCountry[countryCode] ?? []).length;
    }

    return indexes;
  }, [sortedCountries, modulesByCountry]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="chevron-left"
          onPress={handleBack}
          size={48}
          color={accentColor.primary}
          accessibilityLabel={t('common.back')}
        />
        <Text style={styles.headerTitle}>{t('settings.modules.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Info box */}
      <View style={styles.infoBox}>
        <Icon name="info" size={20} color={accentColor.primary} />
        <Text style={styles.infoText}>{t('settings.modules.infoText')}</Text>
      </View>

      {/* Module list */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {sortedCountries.map((countryCode) => (
          <CountrySection
            key={countryCode}
            countryCode={countryCode}
            modules={modulesByCountry[countryCode] ?? []}
            isUserCountry={countryCode === userCountryCode}
            onToggle={handleModuleToggle}
            startIndex={countryStartIndexes[countryCode] ?? 0}
            isItemFocused={isItemFocused}
            getFocusStyle={getFocusStyle}
            accentColor={accentColor.primary}
          />
        ))}

        {/* Coming soon hint */}
        <View style={styles.comingSoonSection}>
          <Text style={styles.comingSoonTitle}>
            {t('settings.modules.moreComingSoon')}
          </Text>
          <Text style={styles.comingSoonText}>
            {t('settings.modules.moreComingSoonHint')}
          </Text>
        </View>
      </ScrollView>
    </View>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 48,
  },

  // Info box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 24,
  },

  // Scroll view
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },

  // Country section
  countrySection: {
    marginBottom: spacing.lg,
  },
  countryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  countryFlag: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  countryName: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  yourCountryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  yourCountryText: {
    ...typography.small,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },

  // Modules container
  modulesContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },

  // Module row
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moduleIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  moduleInfo: {
    flex: 1,
  },
  moduleName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  moduleAutoEnabled: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Coming soon
  comingSoonSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  comingSoonTitle: {
    ...typography.bodyBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  comingSoonText: {
    ...typography.small,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

export default ModulesSettingsScreen;
