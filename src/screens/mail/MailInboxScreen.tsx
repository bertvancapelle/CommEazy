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
  TouchableOpacity,
  Platform,
  NativeModules,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { Icon, SearchBar, LoadingView, ErrorView } from '@/components';
import type { CachedMailHeader, MailAccount, MailboxInfo } from '@/types/mail';
import { parseEmailAddress } from '@/types/mail';
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
// Module-Level State (persists across unmount/remount)
// ============================================================

/** Timestamp of last successful IMAP fetch — prevents re-fetch on quick return from detail */
let lastImapFetchTimestamp = 0;
/** Minimum interval (ms) between automatic IMAP reconnects */
const IMAP_REFETCH_INTERVAL_MS = 60_000; // 60 seconds

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
  const { triggerHaptic } = useFeedback();

  // State
  const [folders, setFolders] = useState<MailboxInfo[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('INBOX');
  const [headers, setHeaders] = useState<CachedMailHeader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFolders, setShowFolders] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CachedMailHeader[] | null>(null);

  const mountedRef = useRef(true);
  const loadDataRef = useRef<(isRefresh?: boolean) => Promise<void>>();
  const foldersLoadedRef = useRef(false);

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
   * Server data ALWAYS replaces cached data when available.
   */
  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    setError(null);

    let hasCachedData = false;

    const timeSinceLastFetch = Date.now() - lastImapFetchTimestamp;
    const skipImapFetch = !isRefresh && timeSinceLastFetch < IMAP_REFETCH_INTERVAL_MS;
    console.debug('[MailInbox] loadData called — isRefresh:', isRefresh, 'accountId:', account.id, 'folder:', selectedFolder, 'skipImap:', skipImapFetch, 'msSinceLastFetch:', timeSinceLastFetch);

    try {
      // Try to connect and fetch data
      const imapBridge = await import('@/services/mail/imapBridge');
      const mailCache = await import('@/services/mail/mailCache');

      // First try to show cached data (instant display while server loads)
      try {
        const db = await mailCache.getMailCacheDb();
        const cachedHeaders = await mailCache.getHeaders(db, account.id, selectedFolder, 50);
        console.debug('[MailInbox] Cache has', cachedHeaders.length, 'headers');
        if (cachedHeaders.length > 0 && mountedRef.current) {
          setHeaders(cachedHeaders);
          hasCachedData = true;
          if (!isRefresh) setIsLoading(false);
        }
      } catch (cacheErr) {
        console.debug('[MailInbox] Cache read failed:', cacheErr instanceof Error ? cacheErr.message : String(cacheErr));
      }

      // Skip full IMAP reconnect if we fetched recently (e.g. returning from detail screen)
      if (skipImapFetch && hasCachedData) {
        console.debug('[MailInbox] Skipping IMAP fetch — using cached data');
        return;
      }

      // Connect to IMAP (disconnect first to ensure fresh connection)
      try {
        console.debug('[MailInbox] Disconnecting before reconnect...');
        await imapBridge.disconnect().catch(() => {});
        console.debug('[MailInbox] Connecting to IMAP...');
        await imapBridge.connectIMAPWithRefresh(account.id, account.providerId);
        console.debug('[MailInbox] IMAP connected successfully');
      } catch (connectErr) {
        const connectMsg = connectErr instanceof Error ? connectErr.message : String(connectErr);
        console.debug('[MailInbox] Connection failed:', connectMsg);
        // If connection fails, show cached data if available
        if (hasCachedData) {
          if (mountedRef.current) {
            setError(t('modules.mail.inbox.offlineMode'));
            setIsLoading(false);
          }
          return;
        }
        // Re-throw the original native error (preserves error code)
        throw connectErr;
      }

      // Fetch folders (only on first load)
      if (!foldersLoadedRef.current) {
        try {
          const serverFolders = await imapBridge.listMailboxes();
          if (mountedRef.current) {
            setFolders(serverFolders);
            foldersLoadedRef.current = true;
          }
        } catch {
          console.debug('[MailInbox] Failed to list mailboxes');
        }
      }

      // Fetch headers from server (with one retry on connection error)
      console.debug('[MailInbox] Fetching headers from', selectedFolder);
      let serverHeaders: Awaited<ReturnType<typeof imapBridge.fetchHeaders>>;
      try {
        serverHeaders = await imapBridge.fetchHeaders(selectedFolder, 50);
      } catch (fetchErr) {
        // If fetch fails, try reconnecting once and retry
        const code = imapBridge.getMailErrorCode(fetchErr);
        console.debug('[MailInbox] fetchHeaders failed with code:', code, '— retrying with fresh connection');
        await imapBridge.disconnect().catch(() => {});
        await imapBridge.connectIMAPWithRefresh(account.id, account.providerId);
        serverHeaders = await imapBridge.fetchHeaders(selectedFolder, 50);
      }
      console.debug('[MailInbox] Got', serverHeaders.length, 'headers from server');
      lastImapFetchTimestamp = Date.now();

      // Cache the headers and display fresh data
      // Clear old cached headers first so stale entries don't persist
      console.debug('[MailInbox] Updating cache with', serverHeaders.length, 'fresh headers');
      try {
        const db = await mailCache.getMailCacheDb();
        await db.execute(
          'DELETE FROM mail_headers WHERE account_id = ? AND folder = ?',
          [account.id, selectedFolder],
        );
        await mailCache.upsertHeaders(db, account.id, selectedFolder, serverHeaders);

        // Read back from cache (includes parsed fromName/fromAddress)
        const freshHeaders = await mailCache.getHeaders(db, account.id, selectedFolder, 50);
        console.debug('[MailInbox] Fresh headers from cache:', freshHeaders.length, '— newest subject:', freshHeaders[0]?.subject ?? 'none');
        if (mountedRef.current) setHeaders(freshHeaders);
      } catch (cacheUpdateErr) {
        console.debug('[MailInbox] Cache update failed:', cacheUpdateErr instanceof Error ? cacheUpdateErr.message : String(cacheUpdateErr));
        // If cache fails, use server headers directly with parsed from fields
        if (mountedRef.current) {
          const { parseEmailAddress } = await import('@/types/mail');
          setHeaders(serverHeaders.map(h => {
            const parsed = parseEmailAddress(h.from ?? '');
            return {
              ...h,
              accountId: account.id,
              folder: selectedFolder,
              fromName: parsed.name ?? undefined,
              fromAddress: parsed.address ?? undefined,
              isLocal: false,
            };
          }));
        }
      }
    } catch (err: unknown) {
      // Map native error codes to translated messages
      const rawMessage = err instanceof Error ? err.message : String(err);
      console.debug('[MailInbox] Error:', rawMessage);

      let errorCode = 'UNKNOWN_ERROR';
      try {
        const bridge = await import('@/services/mail/imapBridge');
        errorCode = bridge.getMailErrorCode(err);
      } catch { /* bridge not available */ }

      // Translate error code to user-friendly message
      const errorMessages: Record<string, string> = {
        AUTH_FAILED: t('modules.mail.inbox.errors.authFailed'),
        CONNECTION_FAILED: t('modules.mail.inbox.errors.connectionFailed'),
        TIMEOUT: t('modules.mail.inbox.errors.timeout'),
        NOT_CONNECTED: t('modules.mail.inbox.errors.notConnected'),
        CERTIFICATE_ERROR: t('modules.mail.inbox.errors.certificateError'),
      };
      const translatedError = errorMessages[errorCode] || t('modules.mail.inbox.errors.generic');

      if (mountedRef.current) {
        setError(translatedError);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [account.id, account.providerId, selectedFolder, t]);

  // Keep ref in sync so handleRefresh always uses latest loadData
  loadDataRef.current = loadData;

  // Load data on mount and folder change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Pull-to-refresh — use ref to avoid stale closure
  const handleRefresh = useCallback(() => {
    triggerHaptic('tap');
    setIsRefreshing(true);
    console.debug('[MailInbox] Pull-to-refresh triggered');
    loadDataRef.current?.(true);
  }, []);

  // ============================================================
  // Folder Selection
  // ============================================================

  const handleFolderToggle = useCallback(() => {
    triggerHaptic('tap');
    setShowFolders(prev => !prev);
  }, []);

  const handleFolderSelect = useCallback((folderName: string) => {
    triggerHaptic('tap');
    setSelectedFolder(folderName);
    setShowFolders(false);
    setHeaders([]); // Clear while loading new folder
  }, []);

  // ============================================================
  // Mail Actions
  // ============================================================

  const handleToggleFlag = useCallback(async (header: CachedMailHeader) => {
    triggerHaptic('tap');
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
  // Search
  // ============================================================

  /**
   * Server-side IMAP search (OR-query: subject, from, body).
   * Returns UIDs from the server, then fetches headers for those UIDs.
   */
  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) return;

    triggerHaptic('tap');
    setIsSearching(true);
    setSearchResults(null);
    setError(null);

    try {
      const imapBridge = await import('@/services/mail/imapBridge');

      // Ensure IMAP is connected
      try {
        await imapBridge.connectIMAPWithRefresh(account.id, account.providerId);
      } catch {
        // If connection fails, try disconnect + reconnect
        await imapBridge.disconnect().catch(() => {});
        await imapBridge.connectIMAPWithRefresh(account.id, account.providerId);
      }

      // Step 1: Search server for matching UIDs (OR-query: subject, from, body)
      console.debug('[MailInbox] Searching server for:', query.length, 'chars');
      const uids = await imapBridge.searchMessages(selectedFolder, query);
      console.debug('[MailInbox] Search returned', uids.length, 'UIDs');

      if (!mountedRef.current) return;

      if (uids.length === 0) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      // Step 2: Fetch headers for the found UIDs
      const rawHeaders = await imapBridge.fetchHeadersByUIDs(selectedFolder, uids);
      console.debug('[MailInbox] Fetched', rawHeaders.length, 'headers for search results');

      if (!mountedRef.current) return;

      // Map to CachedMailHeader format
      const mapped: CachedMailHeader[] = rawHeaders.map(h => {
        const parsed = parseEmailAddress(h.from ?? '');
        return {
          ...h,
          accountId: account.id,
          folder: selectedFolder,
          fromName: parsed.name ?? undefined,
          fromAddress: parsed.address ?? undefined,
          isLocal: false,
        };
      });

      // Sort by date descending (newest first)
      mapped.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      setSearchResults(mapped);
    } catch (err) {
      console.debug('[MailInbox] Search failed:', err instanceof Error ? err.message : String(err));
      setError(t('modules.mail.inbox.search.error'));
    } finally {
      if (mountedRef.current) {
        setIsSearching(false);
      }
    }
  }, [searchQuery, selectedFolder, account.id, account.providerId, t]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults(null);
    setIsSearching(false);
  }, []);

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
            triggerHaptic('tap');
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

      {/* Search bar */}
      <View style={[styles.searchContainer, { borderBottomColor: themeColors.border }]}>
        <SearchBar
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            // Clear results when query is emptied
            if (!text.trim()) {
              setSearchResults(null);
            }
          }}
          onSubmit={handleSearch}
          placeholder={t('modules.mail.inbox.search.placeholder')}
          searchButtonLabel={t('modules.mail.inbox.search.button')}
        />
      </View>

      {/* Search results header */}
      {searchResults !== null && (
        <View style={[styles.searchResultsBar, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.searchResultsText, { color: themeColors.textPrimary }]}>
            {searchResults.length === 0
              ? t('modules.mail.inbox.search.noResults')
              : t('modules.mail.inbox.search.resultsCount', { count: String(searchResults.length) })}
          </Text>
          <TouchableOpacity
            style={[styles.searchClearPill, { backgroundColor: 'rgba(128, 128, 128, 0.15)' }]}
            onPress={handleClearSearch}
            onLongPress={() => {}}
            delayLongPress={300}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('modules.mail.inbox.search.clear')}
          >
            <Icon name="x" size={16} color={accentColor.primary} />
            <Text style={[styles.searchClearButtonText, { color: accentColor.primary }]}>
              {t('modules.mail.inbox.search.clear')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error banner */}
      {error && (
        <ErrorView
          message={error}
          onRetry={() => setError(null)}
          retryText={t('common.dismiss')}
          type="warning"
        />
      )}

      {/* Mail list */}
      {isSearching ? (
        <LoadingView message={t('modules.mail.inbox.search.searching')} />
      ) : isLoading ? (
        <LoadingView message={t('modules.mail.inbox.loading')} />
      ) : searchResults !== null ? (
        // Show search results
        searchResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="search" size={48} color={themeColors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
              {t('modules.mail.inbox.search.noResults')}
            </Text>
            <Text style={[styles.emptyHint, { color: themeColors.textSecondary }]}>
              {t('modules.mail.inbox.search.noResultsHint')}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {searchResults.map((header) => (
              <MailListItem
                key={`search-${header.uid}-${header.folder}`}
                header={header}
                onPress={onOpenMail}
                onToggleFlag={handleToggleFlag}
              />
            ))}
          </ScrollView>
        )
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
    fontSize: 14,
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
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  searchResultsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchResultsText: {
    ...typography.body,
    fontWeight: '700',
    flex: 1,
  },
  searchClearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  searchClearButtonText: {
    ...typography.label,
    fontWeight: '600',
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
