/**
 * PanelIdContext — Provides panel identity to nested components
 *
 * On iPad Split View, ModulePanel wraps its children in PanelIdProvider
 * so any nested component (e.g., ModuleHeader) can know which panel
 * it belongs to without prop drilling.
 *
 * On iPhone (single-pane), no provider exists — usePanelId() returns null.
 *
 * @see src/components/navigation/ModulePanel.tsx
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import type { PanelId } from './SplitViewContext';

// ============================================================
// Context
// ============================================================

const PanelIdContext = createContext<PanelId | null>(null);

// ============================================================
// Provider
// ============================================================

export interface PanelIdProviderProps {
  /** Panel identifier ('left' | 'right') */
  value: PanelId;
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
// Hook
// ============================================================

/**
 * Get the current panel ID.
 * Returns 'left' | 'right' on iPad Split View, null on iPhone.
 * Safe to call outside PanelIdProvider.
 */
export function usePanelId(): PanelId | null {
  return useContext(PanelIdContext);
}
