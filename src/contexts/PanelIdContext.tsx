/**
 * PanelIdContext — Provides pane identity to nested components
 *
 * Every component rendered within a pane can call usePaneId() to get its
 * pane identifier:
 * - iPhone: 'main'
 * - iPad left panel: 'left'
 * - iPad right panel: 'right'
 *
 * IMPORTANT: usePaneId() returns PaneId (never null).
 * The legacy usePanelId() returns PaneId | null for backward compatibility
 * during the migration period.
 *
 * @see src/components/navigation/ModulePanel.tsx
 * @see src/contexts/PaneContext.tsx
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import type { PaneId } from './PaneContext';

// Re-export PaneId as PanelId for backward compatibility
export type { PaneId };
/** @deprecated Use PaneId instead */
export type PanelId = PaneId;

// ============================================================
// Context
// ============================================================

const PanelIdContext = createContext<PaneId | null>(null);

// ============================================================
// Provider
// ============================================================

export interface PanelIdProviderProps {
  /** Pane identifier ('main' | 'left' | 'right') */
  value: PaneId;
  children: ReactNode;
}

export function PanelIdProvider({ value, children }: PanelIdProviderProps) {
  return (
    <PanelIdContext.Provider value={value}>
      {children}
    </PanelIdContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * Get the current pane ID.
 * Returns 'main' | 'left' | 'right'.
 * @throws Error if used outside PanelIdProvider
 */
export function usePaneId(): PaneId {
  const paneId = useContext(PanelIdContext);
  if (!paneId) {
    throw new Error('usePaneId must be used within PanelIdProvider');
  }
  return paneId;
}

/**
 * Get the current panel ID (legacy, safe version).
 * Returns PaneId | null. Safe to call outside PanelIdProvider.
 * @deprecated Use usePaneId() instead (requires being inside PanelIdProvider)
 */
export function usePanelId(): PaneId | null {
  return useContext(PanelIdContext);
}
