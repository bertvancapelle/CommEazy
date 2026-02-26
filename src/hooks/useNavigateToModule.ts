/**
 * useNavigateToModule — Unified cross-module navigation hook
 *
 * Provides a single API for navigating between modules, regardless of device:
 * - iPhone (1 pane): Replaces the current module in 'main' pane
 * - iPad (2 panes): Can navigate within own pane or to the other pane
 *
 * Eliminates all `if (panelId && splitView) { iPad } else { iPhone }` branches.
 *
 * @see .claude/plans/sunny-yawning-sunset.md
 */

import { useCallback } from 'react';
import { usePaneContext, type PaneId, type PendingNavigation } from '@/contexts/PaneContext';
import { usePaneId } from '@/contexts/PanelIdContext';
import type { NavigationDestination } from '@/types/navigation';

export interface UseNavigateToModuleReturn {
  /** Navigate to a module in the current pane */
  navigateToModule: (moduleId: NavigationDestination, pending?: PendingNavigation) => void;
  /** Navigate to a module in the other pane (iPad), or in own pane (iPhone) */
  navigateToModuleInOtherPane: (moduleId: NavigationDestination, pending?: PendingNavigation) => void;
  /** Current pane ID */
  currentPaneId: PaneId;
  /** Number of panes (1 = iPhone, 2 = iPad) */
  paneCount: 1 | 2;
}

/**
 * Hook for unified cross-module navigation.
 *
 * Usage:
 * ```typescript
 * const { navigateToModule, navigateToModuleInOtherPane } = useNavigateToModule();
 *
 * // Navigate within own pane
 * navigateToModule('settings');
 *
 * // Navigate to other pane (iPad) or own pane (iPhone)
 * navigateToModuleInOtherPane('chats', {
 *   screen: 'ChatDetail',
 *   params: { chatId: '123', name: 'Oma' },
 * });
 * ```
 */
export function useNavigateToModule(): UseNavigateToModuleReturn {
  const paneCtx = usePaneContext();
  const currentPaneId = usePaneId();

  const navigateToModule = useCallback(
    (moduleId: NavigationDestination, pending?: PendingNavigation) => {
      paneCtx.setPaneModule(currentPaneId, moduleId, pending);
    },
    [paneCtx, currentPaneId]
  );

  const navigateToModuleInOtherPane = useCallback(
    (moduleId: NavigationDestination, pending?: PendingNavigation) => {
      if (paneCtx.paneCount === 1) {
        // iPhone: navigate in own pane (there's only one)
        paneCtx.setPaneModule('main', moduleId, pending);
      } else {
        // iPad: navigate in the OTHER pane
        const otherPaneId: PaneId = currentPaneId === 'left' ? 'right' : 'left';
        paneCtx.setPaneModule(otherPaneId, moduleId, pending);
      }
    },
    [paneCtx, currentPaneId]
  );

  return {
    navigateToModule,
    navigateToModuleInOtherPane,
    currentPaneId,
    paneCount: paneCtx.paneCount,
  };
}
