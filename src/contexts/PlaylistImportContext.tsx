/**
 * PlaylistImportContext — Shares import progress state between
 * AppleMusicScreen (producer) and FloatingImportIndicator (consumer).
 *
 * This lightweight context avoids duplicating useMusicCollections hook
 * at the root level. The AppleMusicScreen pushes state updates, and
 * the FloatingImportIndicator reads them from anywhere in the tree.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { PlaylistImportProgress } from '@/services/music';

// ============================================================
// Types
// ============================================================

interface PlaylistImportContextValue {
  /** Whether an import is currently in progress */
  isImporting: boolean;
  /** Current import progress */
  importProgress: PlaylistImportProgress | null;
  /** Set the importing state (called by AppleMusicScreen) */
  setImporting: (importing: boolean) => void;
  /** Update import progress (called by AppleMusicScreen) */
  updateProgress: (progress: PlaylistImportProgress | null) => void;
}

// ============================================================
// Context
// ============================================================

const PlaylistImportContext = createContext<PlaylistImportContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export function PlaylistImportProvider({ children }: { children: React.ReactNode }) {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<PlaylistImportProgress | null>(null);

  const setImporting = useCallback((importing: boolean) => {
    setIsImporting(importing);
    if (!importing) {
      setImportProgress(null);
    }
  }, []);

  const updateProgress = useCallback((progress: PlaylistImportProgress | null) => {
    setImportProgress(progress);
  }, []);

  const value = useMemo(() => ({
    isImporting,
    importProgress,
    setImporting,
    updateProgress,
  }), [isImporting, importProgress, setImporting, updateProgress]);

  return (
    <PlaylistImportContext.Provider value={value}>
      {children}
    </PlaylistImportContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function usePlaylistImportContext(): PlaylistImportContextValue {
  const context = useContext(PlaylistImportContext);
  if (!context) {
    throw new Error('usePlaylistImportContext must be used within PlaylistImportProvider');
  }
  return context;
}

/**
 * Safe version that returns null outside of provider.
 * Use this in FloatingImportIndicator which may render before provider.
 */
export function usePlaylistImportContextSafe(): PlaylistImportContextValue | null {
  return useContext(PlaylistImportContext);
}
