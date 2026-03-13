/**
 * MailSettingsScreen — E-mail module settings
 *
 * Fase 9: Settings Menu Integration
 *
 * Sections:
 * 1. Mijn e-mailaccounts — linked accounts list, add/remove
 * 2. Synchronisatie-instellingen — message count, auto-sync, auto-download
 * 3. Opslag — cache size, clear cache
 * 4. Beveiliging — notifications toggle, biometric lock toggle
 * 5. Vertrouwde afzenders — per-domain image whitelist management
 *
 * UI-ready with placeholder actions (OAuth2 deferred).
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Alert,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SettingsStackParams } from '@/navigation';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, VoiceFocusable, ScrollViewWithIndicator, ErrorView } from '@/components';
import { useVoiceFocusList } from '@/contexts/VoiceFocusContext';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { getAllAccounts } from '@/services/mail/credentialManager';
import {
  getAllWhitelistedDomains,
  removeDomain as removeWhitelistedDomain,
} from '@/services/mail/imageWhitelistService';
import type { MailAccount } from '@/types/mail';

// Message count options for sync settings
const MESSAGE_COUNT_OPTIONS = [50, 100, 200, 500] as const;

// AsyncStorage keys for persistent settings
const SETTINGS_KEYS = {
  messageCount: '@commeazy/mail/messageCount',
  autoSync: '@commeazy/mail/autoSync',
  autoDownload: '@commeazy/mail/autoDownload',
  emailNotifications: '@commeazy/mail/emailNotifications',
  biometricLock: '@commeazy/mail/biometricLock',
} as const;

export function MailSettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParams>>();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { triggerFeedback } = useFeedback();
  const isFocused = useIsFocused();

  // State
  const [messageCount, setMessageCount] = useState<number>(100);
  const [autoSync, setAutoSync] = useState(true);
  const [autoDownload, setAutoDownload] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [biometricLock, setBiometricLock] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState<MailAccount[]>([]);
  const [whitelistedDomains, setWhitelistedDomains] = useState<string[]>([]);
  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);

  // Load accounts and whitelist on mount and when screen regains focus
  useEffect(() => {
    if (!isFocused) return;
    getAllAccounts()
      .then(setLinkedAccounts)
      .catch((err) => console.error('[MailSettings] Failed to load accounts:', err));
    getAllWhitelistedDomains()
      .then(setWhitelistedDomains)
      .catch((err) => console.error('[MailSettings] Failed to load whitelist:', err));
  }, [isFocused]);

  // Load persisted settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [count, sync, download, notifications, biometric] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEYS.messageCount),
          AsyncStorage.getItem(SETTINGS_KEYS.autoSync),
          AsyncStorage.getItem(SETTINGS_KEYS.autoDownload),
          AsyncStorage.getItem(SETTINGS_KEYS.emailNotifications),
          AsyncStorage.getItem(SETTINGS_KEYS.biometricLock),
        ]);
        if (count !== null) {
          const parsed = parseInt(count, 10);
          if ((MESSAGE_COUNT_OPTIONS as readonly number[]).includes(parsed)) {
            setMessageCount(parsed);
          }
        }
        if (sync !== null) setAutoSync(sync === 'true');
        if (download !== null) setAutoDownload(download === 'true');
        if (notifications !== null) setEmailNotifications(notifications === 'true');
        if (biometric !== null) setBiometricLock(biometric === 'true');
      } catch {
        // Non-critical — defaults will be used
      }
    };
    loadSettings();
  }, []);

  // Cache size placeholder
  const cacheSize = '0 MB';

  // Voice focus items
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return [];
    return [
      { id: 'accounts', label: t('mailSettings.accounts.title'), index: 0, onSelect: () => {} },
      { id: 'sync', label: t('mailSettings.sync.title'), index: 1, onSelect: () => {} },
      { id: 'storage', label: t('mailSettings.storage.title'), index: 2, onSelect: () => {} },
      { id: 'security', label: t('mailSettings.security.title'), index: 3, onSelect: () => {} },
      { id: 'whitelist', label: t('mailSettings.whitelist.title'), index: 4, onSelect: () => {} },
    ];
  }, [isFocused, t]);

  const { scrollRef, isFocused: isItemFocused, getFocusStyle } = useVoiceFocusList(
    'mail-settings-list',
    voiceFocusItems
  );

  // Handle add account — navigate to mail onboarding wizard
  const handleAddAccount = useCallback(() => {
    void triggerFeedback('tap');
    navigation.navigate('MailOnboarding');
  }, [triggerFeedback, navigation]);

  // Handle message count selection
  const handleMessageCountPress = useCallback(() => {
    void triggerFeedback('tap');
    const options = MESSAGE_COUNT_OPTIONS.map((count) =>
      t('mailSettings.sync.messageCountOption', { count })
    );
    options.push(t('common.cancel'));

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options],
          cancelButtonIndex: options.length - 1,
          title: t('mailSettings.sync.messageCount'),
        },
        (buttonIndex) => {
          if (buttonIndex < MESSAGE_COUNT_OPTIONS.length) {
            const newCount = MESSAGE_COUNT_OPTIONS[buttonIndex];
            setMessageCount(newCount);
            AsyncStorage.setItem(SETTINGS_KEYS.messageCount, String(newCount)).catch(() => {});
          }
        }
      );
    } else {
      Alert.alert(
        t('mailSettings.sync.messageCount'),
        undefined,
        [
          ...MESSAGE_COUNT_OPTIONS.map((count) => ({
            text: t('mailSettings.sync.messageCountOption', { count }),
            onPress: () => {
              setMessageCount(count);
              AsyncStorage.setItem(SETTINGS_KEYS.messageCount, String(count)).catch(() => {});
            },
          })),
          { text: t('common.cancel'), style: 'cancel' as const },
        ]
      );
    }
  }, [t, triggerFeedback]);

  // Handle sync now — placeholder
  const handleSyncNow = useCallback(() => {
    void triggerFeedback('tap');
    setNotification({ type: 'info', title: t('mailSettings.sync.syncNow'), message: t('mailSettings.sync.syncNowPlaceholder') });
  }, [t, triggerFeedback]);

  // Handle clear cache
  const handleClearCache = useCallback(() => {
    void triggerFeedback('tap');
    Alert.alert(
      t('mailSettings.storage.clearCache'),
      t('mailSettings.storage.clearCacheConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('mailSettings.storage.clearCacheButton'),
          style: 'destructive',
          onPress: () => {
            // Placeholder — will clear SQLite cache in later phases
            setNotification({ type: 'success', title: t('mailSettings.storage.cacheCleared'), message: '' });
          },
        },
      ]
    );
  }, [t, triggerFeedback]);

  // Handle remove whitelisted domain
  const handleRemoveDomain = useCallback((domain: string) => {
    void triggerFeedback('tap');
    Alert.alert(
      t('mailSettings.whitelist.removeConfirmTitle'),
      t('mailSettings.whitelist.removeConfirmMessage', { domain }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('mailSettings.whitelist.removeDomain'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeWhitelistedDomain(domain);
              setWhitelistedDomains((prev) => prev.filter((d) => d !== domain));
            } catch {
              // Non-critical
            }
          },
        },
      ]
    );
  }, [t, triggerFeedback]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {notification && (
        <ErrorView
          type={notification.type}
          title={notification.title}
          message={notification.message}
          autoDismiss={notification.type === 'success' || notification.type === 'info' ? 3000 : undefined}
          onDismiss={() => setNotification(null)}
        />
      )}
      <ScrollViewWithIndicator
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Section 1: Mijn e-mailaccounts */}
        <VoiceFocusable
          id="accounts"
          label={t('mailSettings.accounts.title')}
          index={0}
          onSelect={() => {}}
        >
          <View
            style={[
              styles.section,
              { backgroundColor: themeColors.surface },
              isItemFocused('accounts') && getFocusStyle(),
            ]}
          >
            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
              {t('mailSettings.accounts.title')}
            </Text>

            {/* Account list */}
            {linkedAccounts.length === 0 ? (
              <View style={styles.emptyAccountsContainer}>
                <Icon name="mail" size={32} color={themeColors.textTertiary} />
                <Text style={[styles.emptyAccountsText, { color: themeColors.textSecondary }]}>
                  {t('mailSettings.accounts.noAccounts')}
                </Text>
              </View>
            ) : (
              linkedAccounts.map((account) => (
                <View
                  key={account.id}
                  style={[styles.accountRow, { borderBottomColor: themeColors.border }]}
                >
                  <View style={styles.accountInfo}>
                    <Text style={[styles.accountEmail, { color: themeColors.textPrimary }]}>
                      {account.email}
                    </Text>
                    <Text style={[styles.accountProvider, { color: themeColors.textSecondary }]}>
                      {account.displayName}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>
                      {t('mailSettings.accounts.active')}
                    </Text>
                  </View>
                </View>
              ))
            )}

            {/* Add account button */}
            <HapticTouchable hapticDisabled
              style={[styles.addAccountButton, { borderColor: accentColor.primary }]}
              onPress={handleAddAccount}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('mailSettings.accounts.addAccount')}
              accessibilityHint={t('mailSettings.accounts.addAccountHint')}
            >
              <Icon name="plus" size={20} color={accentColor.primary} />
              <Text style={[styles.addAccountText, { color: accentColor.primary }]}>
                {t('mailSettings.accounts.addAccount')}
              </Text>
            </HapticTouchable>
          </View>
        </VoiceFocusable>

        {/* Section 2: Synchronisatie-instellingen */}
        <VoiceFocusable
          id="sync"
          label={t('mailSettings.sync.title')}
          index={1}
          onSelect={() => {}}
        >
          <View
            style={[
              styles.section,
              { backgroundColor: themeColors.surface },
              isItemFocused('sync') && getFocusStyle(),
            ]}
          >
            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
              {t('mailSettings.sync.title')}
            </Text>

            {/* Message count picker */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                {t('mailSettings.sync.messageCount')}
              </Text>
            </View>
            <HapticTouchable hapticDisabled
              style={[styles.pickerRow, { borderColor: themeColors.border }]}
              onPress={handleMessageCountPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('mailSettings.sync.messageCount')}
              accessibilityHint={t('mailSettings.sync.messageCountHint')}
            >
              <Text style={[styles.pickerValue, { color: themeColors.textPrimary }]}>
                {t('mailSettings.sync.messageCountOption', { count: messageCount })}
              </Text>
              <Icon name="chevron-right" size={20} color={themeColors.textTertiary} />
            </HapticTouchable>

            {/* Auto-sync toggle */}
            <View style={[styles.toggleRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                {t('mailSettings.sync.autoSync')}
              </Text>
              <Switch
                value={autoSync}
                onValueChange={(value) => {
                  void triggerFeedback('tap');
                  setAutoSync(value);
                  AsyncStorage.setItem(SETTINGS_KEYS.autoSync, String(value)).catch(() => {});
                }}
                trackColor={{ false: themeColors.disabled, true: accentColor.primary }}
                thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                accessibilityLabel={t('mailSettings.sync.autoSync')}
                accessibilityHint={t('mailSettings.sync.autoSyncHint')}
              />
            </View>

            {/* Auto-download attachments toggle */}
            <View style={[styles.toggleRow, { borderBottomColor: 'transparent' }]}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                {t('mailSettings.sync.autoDownload')}
              </Text>
              <Switch
                value={autoDownload}
                onValueChange={(value) => {
                  void triggerFeedback('tap');
                  setAutoDownload(value);
                  AsyncStorage.setItem(SETTINGS_KEYS.autoDownload, String(value)).catch(() => {});
                }}
                trackColor={{ false: themeColors.disabled, true: accentColor.primary }}
                thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                accessibilityLabel={t('mailSettings.sync.autoDownload')}
                accessibilityHint={t('mailSettings.sync.autoDownloadHint')}
              />
            </View>

            {/* Sync now button */}
            <HapticTouchable hapticDisabled
              style={[styles.actionButton, { backgroundColor: accentColor.primary }]}
              onPress={handleSyncNow}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('mailSettings.sync.syncNow')}
            >
              <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
                {t('mailSettings.sync.syncNow')}
              </Text>
            </HapticTouchable>
          </View>
        </VoiceFocusable>

        {/* Section 3: Opslag */}
        <VoiceFocusable
          id="storage"
          label={t('mailSettings.storage.title')}
          index={2}
          onSelect={() => {}}
        >
          <View
            style={[
              styles.section,
              { backgroundColor: themeColors.surface },
              isItemFocused('storage') && getFocusStyle(),
            ]}
          >
            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
              {t('mailSettings.storage.title')}
            </Text>

            {/* Cache size display */}
            <View style={styles.infoRow}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                {t('mailSettings.storage.cacheSize')}
              </Text>
              <Text style={[styles.infoValue, { color: themeColors.textSecondary }]}>
                {cacheSize}
              </Text>
            </View>

            {/* Clear cache button */}
            <HapticTouchable hapticDisabled
              style={[styles.destructiveButton, { borderColor: colors.error }]}
              onPress={handleClearCache}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('mailSettings.storage.clearCache')}
              accessibilityHint={t('mailSettings.storage.clearCacheHint')}
            >
              <Icon name="trash" size={20} color={colors.error} />
              <Text style={[styles.destructiveButtonText, { color: colors.error }]}>
                {t('mailSettings.storage.clearCache')}
              </Text>
            </HapticTouchable>
          </View>
        </VoiceFocusable>

        {/* Section 4: Beveiliging */}
        <VoiceFocusable
          id="security"
          label={t('mailSettings.security.title')}
          index={3}
          onSelect={() => {}}
        >
          <View
            style={[
              styles.section,
              { backgroundColor: themeColors.surface },
              isItemFocused('security') && getFocusStyle(),
            ]}
          >
            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
              {t('mailSettings.security.title')}
            </Text>

            {/* Email notifications toggle */}
            <View style={[styles.toggleRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                {t('mailSettings.security.emailNotifications')}
              </Text>
              <Switch
                value={emailNotifications}
                onValueChange={(value) => {
                  void triggerFeedback('tap');
                  setEmailNotifications(value);
                  AsyncStorage.setItem(SETTINGS_KEYS.emailNotifications, String(value)).catch(() => {});
                }}
                trackColor={{ false: themeColors.disabled, true: accentColor.primary }}
                thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                accessibilityLabel={t('mailSettings.security.emailNotifications')}
                accessibilityHint={t('mailSettings.security.emailNotificationsHint')}
              />
            </View>

            {/* Biometric lock toggle */}
            <View style={[styles.toggleRow, { borderBottomColor: 'transparent' }]}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                {t('mailSettings.security.biometricLock')}
              </Text>
              <Switch
                value={biometricLock}
                onValueChange={(value) => {
                  void triggerFeedback('tap');
                  setBiometricLock(value);
                  AsyncStorage.setItem(SETTINGS_KEYS.biometricLock, String(value)).catch(() => {});
                }}
                trackColor={{ false: themeColors.disabled, true: accentColor.primary }}
                thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                accessibilityLabel={t('mailSettings.security.biometricLock')}
                accessibilityHint={t('mailSettings.security.biometricLockHint')}
              />
            </View>
          </View>
        </VoiceFocusable>

        {/* Section 5: Vertrouwde afzenders (image whitelist) */}
        <VoiceFocusable
          id="whitelist"
          label={t('mailSettings.whitelist.title')}
          index={4}
          onSelect={() => {}}
        >
          <View
            style={[
              styles.section,
              { backgroundColor: themeColors.surface },
              isItemFocused('whitelist') && getFocusStyle(),
            ]}
          >
            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
              {t('mailSettings.whitelist.title')}
            </Text>

            <Text style={[styles.whitelistDescription, { color: themeColors.textSecondary }]}>
              {t('mailSettings.whitelist.description')}
            </Text>

            {whitelistedDomains.length === 0 ? (
              <View style={styles.emptyWhitelistContainer}>
                <Icon name="shield" size={32} color={themeColors.textTertiary} />
                <Text style={[styles.emptyWhitelistTitle, { color: themeColors.textSecondary }]}>
                  {t('mailSettings.whitelist.emptyTitle')}
                </Text>
                <Text style={[styles.emptyWhitelistText, { color: themeColors.textTertiary }]}>
                  {t('mailSettings.whitelist.emptyDescription')}
                </Text>
              </View>
            ) : (
              whitelistedDomains.map((domain) => (
                <View
                  key={domain}
                  style={[styles.domainRow, { borderBottomColor: themeColors.border }]}
                >
                  <Text style={[styles.domainText, { color: themeColors.textPrimary }]}>
                    {domain}
                  </Text>
                  <HapticTouchable hapticDisabled
                    style={[styles.removeDomainButton, { borderColor: colors.error }]}
                    onPress={() => handleRemoveDomain(domain)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('mailSettings.whitelist.removeDomain')}
                    accessibilityHint={domain}
                  >
                    <Text style={[styles.removeDomainText, { color: colors.error }]}>
                      {t('mailSettings.whitelist.removeDomain')}
                    </Text>
                  </HapticTouchable>
                </View>
              ))
            )}
          </View>
        </VoiceFocusable>
      </ScrollViewWithIndicator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  // Section container
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  // Account list
  emptyAccountsContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyAccountsText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: touchTargets.comfortable,
  },
  accountInfo: {
    flex: 1,
  },
  accountEmail: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  accountProvider: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  statusText: {
    ...typography.small,
    color: colors.success,
    fontWeight: '700',
  },
  // Add account button
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    minHeight: touchTargets.minimum,
  },
  addAccountText: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  // Setting rows
  settingRow: {
    marginBottom: spacing.xs,
  },
  settingLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  // Picker row (label ABOVE, bordered interactive area)
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    minHeight: touchTargets.minimum,
  },
  pickerValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: touchTargets.minimum,
  },
  // Info row (label + value)
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    minHeight: touchTargets.minimum,
  },
  infoValue: {
    ...typography.body,
    color: colors.textSecondary,
  },
  // Action button (primary)
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
  },
  actionButtonText: {
    ...typography.body,
    fontWeight: '700',
  },
  // Destructive button (e.g., clear cache)
  destructiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
  },
  destructiveButtonText: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  // Whitelist section
  whitelistDescription: {
    ...typography.body,
    marginBottom: spacing.md,
    lineHeight: 26,
  },
  emptyWhitelistContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyWhitelistTitle: {
    ...typography.body,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyWhitelistText: {
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    minHeight: touchTargets.minimum,
  },
  domainText: {
    ...typography.body,
    flex: 1,
  },
  removeDomainButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginLeft: spacing.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  removeDomainText: {
    ...typography.small,
    fontWeight: '600',
  },
});
