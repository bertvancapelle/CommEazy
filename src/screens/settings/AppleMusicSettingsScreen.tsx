/**
 * AppleMusicSettingsScreen — Apple Music import settings
 *
 * Shows the number of imported playlists/collections.
 * Import is user-initiated from the Apple Music module (one-time snapshot).
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Clear labels
 * - Haptic feedback on all interactions
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useMusicCollections } from '@/hooks/useMusicCollections';
import { Icon, VoiceFocusable } from '@/components';
import { useVoiceFocusList } from '@/contexts/VoiceFocusContext';

// ============================================================
// Component
// ============================================================

export function AppleMusicSettingsScreen() {
  const { t } = useTranslation();
  const themeColors = useColors();
  const isFocused = useIsFocused();
  const musicCollections = useMusicCollections();

  // Count imported (linked) collections
  const importedCount = useMemo(() => {
    return musicCollections.collections.filter(c => c.sourcePlaylistId).length;
  }, [musicCollections.collections]);

  // Voice focus items
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return [];
    return [];
  }, [isFocused]);

  const { scrollRef } = useVoiceFocusList('apple-music-settings', voiceFocusItems);

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Section: Imported playlists info */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
          {t('appleMusicSettings.importSectionTitle')}
        </Text>

        {/* Imported collections count */}
        <View style={[styles.infoRow, { borderTopColor: themeColors.border }]}>
          <Icon name="musical-notes" size={20} color={themeColors.textSecondary} />
          <Text style={[styles.infoText, { color: themeColors.textPrimary }]}>
            {importedCount > 0
              ? t('appleMusicSettings.importedCollections', { count: importedCount })
              : t('appleMusicSettings.noImportedCollections')}
          </Text>
        </View>
      </View>

      {/* Info note */}
      <Text style={[styles.footerNote, { color: themeColors.textTertiary }]}>
        {t('appleMusicSettings.importFooterNote')}
      </Text>
    </ScrollView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    minHeight: touchTargets.minimum,
  },
  infoText: {
    ...typography.body,
    flex: 1,
  },
  footerNote: {
    ...typography.small,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 20,
  },
});
