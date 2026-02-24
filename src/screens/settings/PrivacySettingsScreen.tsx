/**
 * PrivacySettingsScreen — Privacy settings
 *
 * Contains:
 * - External links preference toggle (open in system browser)
 *
 * Senior-inclusive design:
 * - Large touch targets (60pt+)
 * - Clear labels ABOVE controls
 * - VoiceOver/TalkBack support
 * - Simple on/off toggles
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  colors,
  typography,
  spacing,
  touchTargets,
  borderRadius,
} from '@/theme';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { useVoiceFocusList } from '@/contexts/VoiceFocusContext';
import { useColors } from '@/contexts/ThemeContext';

// AsyncStorage key — same as used in ArticleWebViewer
const ALWAYS_OPEN_EXTERNAL_LINKS_KEY = 'article_always_open_external_links';

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

export function PrivacySettingsScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const themeColors = useColors();

  // Accent color for styling
  const { accentColor } = useAccentColor();

  // Feedback for haptic/audio
  const { triggerFeedback } = useFeedback();

  // External links preference state
  const [alwaysOpenExternalLinks, setAlwaysOpenExternalLinks] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load preference from AsyncStorage
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const value = await AsyncStorage.getItem(ALWAYS_OPEN_EXTERNAL_LINKS_KEY);
        setAlwaysOpenExternalLinks(value === 'true');
      } catch (error) {
        console.warn('[PrivacySettings] Failed to load preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPreference();
  }, []);

  // Handle toggle change
  const handleExternalLinksToggle = useCallback(
    async (value: boolean) => {
      try {
        await AsyncStorage.setItem(ALWAYS_OPEN_EXTERNAL_LINKS_KEY, value.toString());
        setAlwaysOpenExternalLinks(value);
        void triggerFeedback('tap');
      } catch (error) {
        console.warn('[PrivacySettings] Failed to save preference:', error);
      }
    },
    [triggerFeedback]
  );

  // Voice focus items for voice navigation
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return [];

    return [
      {
        id: 'external-links',
        label: t('privacySettings.externalLinksLabel'),
        index: 0,
        onSelect: () => void handleExternalLinksToggle(!alwaysOpenExternalLinks),
      },
    ];
  }, [isFocused, t, alwaysOpenExternalLinks, handleExternalLinksToggle]);

  const { scrollRef } = useVoiceFocusList(
    'privacy-settings-list',
    voiceFocusItems
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            {t('common.loading')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* External Links section */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
          {t('privacySettings.externalLinksTitle')}
        </Text>
        <Text style={[styles.sectionHint, { color: themeColors.textSecondary }]}>
          {t('privacySettings.externalLinksHint')}
        </Text>

        <ToggleRow
          label={t('privacySettings.externalLinksLabel')}
          hint={t('privacySettings.externalLinksToggleHint')}
          value={alwaysOpenExternalLinks}
          onValueChange={handleExternalLinksToggle}
          accentColor={accentColor.primary}
          accentColorLight={accentColor.primaryLight}
        />
      </View>

      {/* Info text */}
      <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
        {t('privacySettings.info')}
      </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
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
  infoText: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
