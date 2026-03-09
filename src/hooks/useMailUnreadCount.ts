/**
 * useMailUnreadCount — Track unread mail count for badge display
 *
 * Reads unread count from native MailBackgroundFetchModule and listens
 * for updates via NativeEventEmitter. Used by HomeScreen grid to
 * show a badge on the mail module icon.
 *
 * @see ios/MailBackgroundFetchModule.swift
 */

import { useState, useEffect, useCallback } from 'react';
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const MailBGModule = Platform.OS === 'ios'
  ? NativeModules.MailBackgroundFetchModule
  : null;

interface UseMailUnreadCountReturn {
  /** Number of unread mail messages */
  unreadCount: number;
  /** Clear the unread badge (call when user views mail) */
  clearUnread: () => Promise<void>;
  /** Manually check for new mail */
  checkNow: () => Promise<number>;
}

export function useMailUnreadCount(): UseMailUnreadCountReturn {
  const [unreadCount, setUnreadCount] = useState(0);

  // Load initial count
  useEffect(() => {
    if (!MailBGModule) return;

    MailBGModule.getUnreadCount()
      .then((count: number) => setUnreadCount(count))
      .catch(() => {});
  }, []);

  // Listen for NSNotification bridged events via polling
  // (Native NSNotification.Name("MailUnreadCountChanged") can't be
  //  directly observed from RN without a dedicated EventEmitter)
  useEffect(() => {
    if (!MailBGModule) return;

    // Poll every 30 seconds when mounted (lightweight check via UserDefaults)
    const interval = setInterval(() => {
      MailBGModule.getUnreadCount()
        .then((count: number) => setUnreadCount(count))
        .catch(() => {});
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  const clearUnread = useCallback(async () => {
    if (!MailBGModule) return;
    try {
      await MailBGModule.clearUnreadBadge();
      setUnreadCount(0);
    } catch {
      // Ignore errors
    }
  }, []);

  const checkNow = useCallback(async (): Promise<number> => {
    if (!MailBGModule) return 0;
    try {
      const newCount: number = await MailBGModule.checkMailNow();
      // Refresh the badge count
      const total: number = await MailBGModule.getUnreadCount();
      setUnreadCount(total);
      return newCount;
    } catch {
      return 0;
    }
  }, []);

  return { unreadCount, clearUnread, checkNow };
}
