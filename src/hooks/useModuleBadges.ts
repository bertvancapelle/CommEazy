/**
 * useModuleBadges — Aggregated badge counts for HomeScreen grid
 *
 * Provides badge counts for communication modules:
 * - chats: Total unread messages across all 1-on-1 chats
 * - groups: Total unread messages across all group chats
 * - calls: Missed call count
 * - mail: Unread email count
 *
 * Currently implemented:
 * - ✅ mail (via useMailUnreadCount)
 * - ⏳ chats (requires ChatContext/service integration)
 * - ⏳ groups (requires GroupChatContext/service integration)
 * - ⏳ calls (requires call history tracking)
 *
 * @see src/screens/HomeScreen.tsx
 * @see src/hooks/useMailUnreadCount.ts
 */

import { useCallback } from 'react';
import { useMailUnreadCount } from './useMailUnreadCount';

// ============================================================
// Types
// ============================================================

export interface UseModuleBadgesReturn {
  /** Get badge count for a specific module (undefined = no badge) */
  getBadgeCount: (moduleId: string) => number | undefined;
  /** Total unread mail count */
  mailCount: number;
}

// ============================================================
// Hook
// ============================================================

export function useModuleBadges(): UseModuleBadgesReturn {
  const { unreadCount: mailCount } = useMailUnreadCount();

  // TODO: Add chat unread count from ChatContext/ChatService
  // TODO: Add group unread count from GroupChatContext/GroupChatService
  // TODO: Add missed call count from CallHistory (not yet implemented)

  const getBadgeCount = useCallback((moduleId: string): number | undefined => {
    switch (moduleId) {
      case 'mail':
        return mailCount > 0 ? mailCount : undefined;
      // case 'chats':
      //   return chatUnreadCount > 0 ? chatUnreadCount : undefined;
      // case 'groups':
      //   return groupUnreadCount > 0 ? groupUnreadCount : undefined;
      // case 'calls':
      //   return missedCallCount > 0 ? missedCallCount : undefined;
      default:
        return undefined;
    }
  }, [mailCount]);

  return {
    getBadgeCount,
    mailCount,
  };
}
