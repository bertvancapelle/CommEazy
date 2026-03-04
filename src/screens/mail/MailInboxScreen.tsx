/**
 * MailInboxScreen — Inbox / folder view with mail list
 *
 * Displays mail headers from the selected folder. Supports:
 * - Folder selection (INBOX, Sent, Drafts, etc.)
 * - Pull-to-refresh to sync new messages
 * - Search via SearchBar (local FTS5 + remote IMAP)
 * - Unread count per folder
 *
 * Senior-inclusive design:
 * - Large touch targets (≥60pt)
 * - Clear unread indicators
 * - Haptic feedback on interactions
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  NativeModules,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { Icon } from '@/components';
import type { CachedMailHeader, MailAccount, MailboxInfo } from '@/types/mail';
import { MailListItem } from './MailListItem';

// ============================================================
// Types
// ============================================================

export interface MailInboxScreenProps {
  /** Current account to show mail for */
  account: MailAccount;
  /** Navigate to detail screen */
  onOpenMail: (header: CachedMailHeader) => void;
  /** Navigate to compose screen */
  onCompose: () => void;
  /** Navigate to settings */
  onSettings?: () => void;
}

// ============================================================
// Haptic Helper
// ============================================================

const triggerHaptic = () => {
  const options = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };
  const hapticType = Platform.select({
    ios: 'impactMedium',
    android: 'effectClick',
    default: 'impactMedium',
  }) as string;
  ReactNativeHapticFeedback.trigger(hapticType, options);
};

// ============================================================
// Folder Icons
// ============================================================

const FOLDER_ICONS: Record<string, string> = {
  INBOX: 'mail',
  Sent: 'send',
  Drafts: 'edit',
  Trash: 'trash',
  Junk: 'warning',
  Archive: 'archive',
  Spam: 'warning',
};

function getFolderIcon(folderName: string): string {
  // Normalize folder name for matching
  const normalized = folderName.replace(/^.*[/.]/, '');
  return FOLDER_ICONS[normalized] || 'folder';
}

function getFolderDisplayName(
  folderName: string,
  t: (key: string, opts?: Record<string, string>) => string,
): string {
  const normalized = folderName.replace(/^.*[/.]/, '');
  const key = `modules.mail.inbox.folders.${normalized.toLowerCase()}`;
  const translated = t(key);
  // If translation is the key itself, use the original folder name
  if (translated === key) return normalized;
  return translated;
}

// ============================================================
// Component
// ============================================================

export function MailInboxScreen({
  account,
  onOpenMail,
  onCompose,
  onSettings,
}: MailInboxScreenProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();

  // State
  const [folders, setFolders] = useState<MailboxInfo[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('INBOX');
  const [headers, setHeaders] = useState<CachedMailHeader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFolders, setShowFolders] = useState(false);

  const mountedRef = useRef(true);

  useEffect(() => {
    // Clear unread mail badge when inbox is viewed
    if (Platform.OS === 'ios') {
      NativeModules.MailBackgroundFetchModule?.clearUnreadBadge().catch(() => {});
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ============================================================
  // Data Loading
  // ============================================================

  /**
   * Load folders and headers.
   * Uses cached data first, then fetches from server.
   */
  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    setError(null);

    try {
      // Try to connect and fetch data
      const imapBridge = await import('@/services/mail/imapBridge');
      const credentialManager = await import('@/services/mail/credentialManager');
      const mailCache = await import('@/services/mail/mailCache');

      // First try to show cached data
      try {
        const db = await mailCache.getMailCacheDb();
        const cachedHeaders = await mailCache.getHeaders(db, account.id, selectedFolder, 50);
        if (cachedHeaders.length > 0 && mountedRef.current) {
          setHeaders(cachedHeaders);
          if (!isRefresh) setIsLoading(false);
        }
      } catch {
        // Cache not available yet — continue to fetch from server
      }

      // Connect to IMAP
      try {
        await imapBridge.connectIMAPWithRefresh(account.id, account.providerId);
      } catch {
        // If connection fails, show cached data if available
        if (headers.length > 0) {
          if (mountedRef.current) {
            setError(t('modules.mail.inbox.offlineMode'));
            setIsLoading(false);
          }
          return;
        }
        throw new Error(t('modules.mail.inbox.connectionFailed'));
      }

      // Fetch folders (only on first load)
      if (folders.length === 0) {
        try {
          const serverFolders = await imapBridge.listMailboxes();
          if (mountedRef.current) setFolders(serverFolders);
        } catch {
          console.debug('[MailInbox] Failed to list mailboxes');
        }
      }

      // Fetch headers from server
      const serverHeaders = await imapBridge.fetchHeaders(selectedFolder, 50);

      // Cache the headers
      try {
        const db = await mailCache.getMailCacheDb();
        await mailCache.upsertHeaders(db, account.id, selectedFolder, serverHeaders);

        // Read back from cache (includes parsed fromName/fromAddress)
        const cachedHeaders = await mailCache.getHeaders(db, account.id, selectedFolder, 50);
        if (mountedRef.current) setHeaders(cachedHeaders);
      } catch {
        // If cache fails, use server headers directly
        if (mountedRef.current) {
          setHeaders(serverHeaders.map(h => ({
            ...h,
            accountId: account.id,
            folder: selectedFolder,
            isLocal: false,
          })));
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (mountedRef.current) {
        setError(message);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [account.id, account.providerId, selectedFolder, folders.length, t, headers.length]);

  // Load data on mount and folder change
  useEffect(() => {
    loadData();
  }, [selectedFolder]);

  // Pull-to-refresh
  const handleRefresh = useCallback(() => {
    triggerHaptic();
    setIsRefreshing(true);
    loadData(true);
  }, [loadData]);

  // ============================================================
  // Folder Selection
  // ============================================================

  const handleFolderToggle = useCallback(() => {
    triggerHaptic();
    setShowFolders(prev => !prev);
  }, []);

  const handleFolderSelect = useCallback((folderName: string) => {
    triggerHaptic();
    setSelectedFolder(folderName);
    setShowFolders(false);
    setHeaders([]); // Clear while loading new folder
  }, []);

  // ============================================================
  // Mail Actions
  // ============================================================

  const handleToggleFlag = useCallback(async (header: CachedMailHeader) => {
    triggerHaptic();
    try {
      const imapBridge = await import('@/services/mail/imapBridge');
      const mailCache = await import('@/services/mail/mailCache');

      await imapBridge.markAsFlagged(header.uid, header.folder, !header.isFlagged);

      // Update cache
      try {
        const db = await mailCache.getMailCacheDb();
        await mailCache.updateFlaggedStatus(db, account.id, header.folder, header.uid, !header.isFlagged);
      } catch {
        // Cache update failed — non-critical
      }

      // Update local state
      setHeaders(prev =>
        prev.map(h =>
          h.uid === header.uid ? { ...h, isFlagged: !header.isFlagged } : h,
        ),
      );
    } catch {
      console.debug('[MailInbox] Failed to toggle flag');
    }
  }, [account.id]);

  // ============================================================
  // Render
  // ============================================================

  const unreadCount = headers.filter(h => !h.isRead).length;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Folder bar */}
      <View style={[styles.folderBar, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          style={[styles.folderButton, { backgroundColor: themeColors.surface }]}
          onPress={handleFolderToggle}
          onLongPress={() => {}}
          delayLongPress={300}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('modules.mail.inbox.selectFolder')}
        >
          <Icon name={getFolderIcon(selectedFolder)} size={20} color={accentColor.primary} />
          <Text style={[styles.folderName, { color: themeColors.textPrimary }]}>
            {getFolderDisplayName(selectedFolder, t)}
          </Text>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: accentColor.primary }]}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
          <Icon
            name={showFolders ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>

        {/* Compose button */}
        <TouchableOpacity
          style={[styles.composeButton, { backgroundColor: accentColor.primary }]}
          onPress={() => {
            triggerHaptic();
            onCompose();
          }}
          onLongPress={() => {}}
          delayLongPress={300}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('modules.mail.inbox.compose')}
        >
          <Icon name="edit" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Folder dropdown */}
      {showFolders && folders.length > 0 && (
        <View style={[styles.folderDropdown, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          {folders.map((folder) => (
            <TouchableOpacity
              key={folder.name}
              style={[
                styles.folderDropdownItem,
                selectedFolder === folder.name && {
                  backgroundColor: accentColor.light,
                },
              ]}
              onPress={() => handleFolderSelect(folder.name)}
              onLongPress={() => {}}
              delayLongPress={300}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={getFolderDisplayName(folder.name, t)}
            >
              <Icon
                name={getFolderIcon(folder.name)}
                size={20}
                color={selectedFolder === folder.name ? accentColor.primary : themeColors.textSecondary}
              />
              <Text
                style={[
                  styles.folderDropdownText,
                  { color: themeColors.textPrimary },
                  selectedFolder === folder.name && { fontWeight: '700' },
                ]}
              >
                {getFolderDisplayName(folder.name, t)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Error banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: themeColors.surface }]}>
          <Icon name="warning" size={20} color={accentColor.primary} />
          <Text style={[styles.errorText, { color: themeColors.textPrimary }]}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => setError(null)}
            onLongPress={() => {}}
            delayLongPress={300}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.dismiss')}
          >
            <Text style={[styles.errorDismiss, { color: accentColor.primary }]}>
              {t('common.dismiss')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Mail list */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accentColor.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            {t('modules.mail.inbox.loading')}
          </Text>
        </View>
      ) : headers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="mail" size={48} color={themeColors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
            {t('modules.mail.inbox.emptyTitle')}
          </Text>
          <Text style={[styles.emptyHint, { color: themeColors.textSecondary }]}>
            {t('modules.mail.inbox.emptyHint')}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={accentColor.primary}
            />
          }
        >
          {headers.map((header) => (
            <MailListItem
              key={`${header.uid}-${header.folder}`}
              header={header}
              onPress={onOpenMail}
              onToggleFlag={handleToggleFlag}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  folderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  folderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  folderName: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    ...typography.small,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  composeButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderDropdown: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  folderDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  folderDropdownText: {
    ...typography.body,
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.small,
    flex: 1,
  },
  errorDismiss: {
    ...typography.body,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  emptyHint: {
    ...typography.body,
    textAlign: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
});
