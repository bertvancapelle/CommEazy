/**
 * AppleMusicSettingsScreen — Apple Music sync settings
 *
 * Dedicated settings section for Apple Music playlist sync.
 *
 * Elements:
 * 1. Toggle "Apple Music synchroniseren" — on/off
 * 2. Last synced timestamp — informational
 * 3. "Nu synchroniseren" button — manual sync trigger
 *
 * Toggle off flow:
 * - Confirmation dialog with count of linked collections
 * - Deletes all linked collections + resets import status
 * - Favorites are preserved
 *
 * Toggle on flow:
 * - Resets import status → import modal reappears on next Apple Music visit
 *
 * Senior-inclusive design:
 * - 60pt minimum touch targets
 * - Clear labels above controls
 * - Informative confirmation dialog
 * - Haptic feedback on all interactions
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { useMusicCollections } from '@/hooks/useMusicCollections';
import { Icon, HapticTouchable, VoiceFocusable } from '@/components';
import { useVoiceFocusList } from '@/contexts/VoiceFocusContext';

// ============================================================
// Component
// ============================================================

export function AppleMusicSettingsScreen() {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { triggerFeedback } = useFeedback();
  const isFocused = useIsFocused();
  const musicCollections = useMusicCollections();

  // State
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [linkedCount, setLinkedCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load state on mount / focus
  useEffect(() => {
    if (!isFocused) return;

    const loadState = async () => {
      const count = await musicCollections.getLinkedCount();
      const timestamp = await musicCollections.getLastSyncTimestamp();
      setLinkedCount(count);
      setLastSyncedAt(timestamp);
      // Sync is "enabled" when import has been done (collections exist or importDone is true)
      setSyncEnabled(musicCollections.importDone && count > 0);
    };
    loadState();
  }, [isFocused, musicCollections.importDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Format last synced timestamp
  const lastSyncedText = useMemo(() => {
    if (!lastSyncedAt) return t('appleMusicSettings.neverSynced');

    const now = Date.now();
    const diff = now - lastSyncedAt;
    const date = new Date(lastSyncedAt);

    // Today
    if (diff < 24 * 60 * 60 * 1000) {
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return t('appleMusicSettings.lastSyncedToday', { time: timeStr });
    }

    // Yesterday
    if (diff < 48 * 60 * 60 * 1000) {
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return t('appleMusicSettings.lastSyncedYesterday', { time: timeStr });
    }

    // Older
    const dateStr = date.toLocaleDateString([], {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return t('appleMusicSettings.lastSyncedDate', { date: dateStr });
  }, [lastSyncedAt, t]);

  // Handle toggle change
  const handleToggleSync = useCallback(async (newValue: boolean) => {
    void triggerFeedback('tap');

    if (newValue) {
      // Enable sync → reset import status
      await musicCollections.enableSync();
      setSyncEnabled(true);
    } else {
      // Disable sync → confirmation dialog
      const count = await musicCollections.getLinkedCount();

      const message = count > 0
        ? t('appleMusicSettings.disableConfirmMessage', { count })
        : t('appleMusicSettings.disableConfirmMessageEmpty');

      Alert.alert(
        t('appleMusicSettings.disableConfirmTitle'),
        message,
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
          {
            text: t('appleMusicSettings.disableConfirmButton'),
            style: 'destructive',
            onPress: async () => {
              void triggerFeedback('warning');
              await musicCollections.disableSync();
              setSyncEnabled(false);
              setLinkedCount(0);
              setLastSyncedAt(null);
            },
          },
        ],
      );
    }
  }, [musicCollections, triggerFeedback, t]);

  // Handle manual sync — this is a placeholder since we need AppleMusicContext
  // The actual sync will be triggered when the user next visits Apple Music
  const handleManualSync = useCallback(async () => {
    void triggerFeedback('tap');

    // Show info that sync will happen on next Apple Music visit
    Alert.alert(
      t('appleMusicSettings.syncInfoTitle'),
      t('appleMusicSettings.syncInfoMessage'),
      [{ text: t('common.ok') }],
    );
  }, [triggerFeedback, t]);

  // Voice focus items
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return [];
    return [
      {
        id: 'sync-toggle',
        label: t('appleMusicSettings.syncToggle'),
        index: 0,
        onSelect: () => handleToggleSync(!syncEnabled),
      },
      ...(syncEnabled ? [{
        id: 'manual-sync',
        label: t('appleMusicSettings.syncNow'),
        index: 1,
        onSelect: handleManualSync,
      }] : []),
    ];
  }, [isFocused, syncEnabled, handleToggleSync, handleManualSync, t]);

  const { scrollRef } = useVoiceFocusList('apple-music-settings', voiceFocusItems);

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Section: Synchronisatie */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
          {t('appleMusicSettings.syncSectionTitle')}
        </Text>

        {/* Toggle row */}
        <VoiceFocusable
          id="sync-toggle"
          label={t('appleMusicSettings.syncToggle')}
          index={0}
          onSelect={() => handleToggleSync(!syncEnabled)}
        >
          <View style={[styles.toggleContainer, { borderTopColor: themeColors.border }]}>
            <View style={styles.toggleLabelContainer}>
              <Text style={[styles.toggleLabel, { color: themeColors.textPrimary }]}>
                {t('appleMusicSettings.syncToggle')}
              </Text>
              <Text style={[styles.toggleHint, { color: themeColors.textSecondary }]}>
                {t('appleMusicSettings.syncToggleHint')}
              </Text>
            </View>
            <Switch
              value={syncEnabled}
              onValueChange={handleToggleSync}
              trackColor={{ false: themeColors.border, true: accentColor.primaryLight }}
              thumbColor={syncEnabled ? accentColor.primary : themeColors.textTertiary}
              accessibilityLabel={t('appleMusicSettings.syncToggle')}
              accessibilityRole="switch"
              accessibilityState={{ checked: syncEnabled }}
            />
          </View>
        </VoiceFocusable>

        {/* Last synced info */}
        {syncEnabled && (
          <View style={[styles.infoRow, { borderTopColor: themeColors.border }]}>
            <Icon name="time" size={20} color={themeColors.textSecondary} />
            <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
              {lastSyncedText}
            </Text>
          </View>
        )}

        {/* Linked collections count */}
        {syncEnabled && linkedCount > 0 && (
          <View style={[styles.infoRow, { borderTopColor: themeColors.border }]}>
            <Icon name="musical-notes" size={20} color={themeColors.textSecondary} />
            <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
              {t('appleMusicSettings.linkedCollections', { count: linkedCount })}
            </Text>
          </View>
        )}
      </View>

      {/* Section: Handmatig synchroniseren */}
      {syncEnabled && (
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <VoiceFocusable
            id="manual-sync"
            label={t('appleMusicSettings.syncNow')}
            index={1}
            onSelect={handleManualSync}
          >
            <HapticTouchable
              style={[styles.syncButton, { borderColor: accentColor.primary }]}
              onPress={handleManualSync}
              accessibilityRole="button"
              accessibilityLabel={t('appleMusicSettings.syncNow')}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={accentColor.primary} />
              ) : (
                <Icon name="sync" size={22} color={accentColor.primary} />
              )}
              <Text style={[styles.syncButtonText, { color: accentColor.primary }]}>
                {isSyncing
                  ? t('appleMusicSettings.syncing')
                  : t('appleMusicSettings.syncNow')}
              </Text>
            </HapticTouchable>
          </VoiceFocusable>
        </View>
      )}

      {/* Info note */}
      <Text style={[styles.footerNote, { color: themeColors.textTertiary }]}>
        {t('appleMusicSettings.footerNote')}
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
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
    borderTopWidth: 1,
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    ...typography.body,
    fontWeight: '700',
  },
  toggleHint: {
    ...typography.small,
    marginTop: 2,
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
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
  },
  syncButtonText: {
    ...typography.button,
    fontWeight: '700',
  },
  footerNote: {
    ...typography.small,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 20,
  },
});
