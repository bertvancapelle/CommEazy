/**
 * PlaylistImportContext — Shares import progress state between
 * AppleMusicScreen (producer) and FloatingImportIndicator (consumer).
 *
 * This lightweight context avoids duplicating useMusicCollections hook
 * at the root level. The AppleMusicScreen pushes state updates, and
 * the FloatingImportIndicator reads them from anywhere in the tree.
 *
 * Extended with import result state for success/failure screens.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { PlaylistImportProgress, PlaylistImportResult } from '@/services/music';

// ============================================================
// Types
// ============================================================

export interface ImportResultInfo {
  /** Import result data */
  result: PlaylistImportResult;
  /** Name of the imported playlist */
  playlistName: string;
  /** ID of the created collection (for navigation) */
  collectionId?: string;
}

interface PlaylistImportContextValue {
  /** Whether an import is currently in progress */
  isImporting: boolean;
  /** Current import progress */
  importProgress: PlaylistImportProgress | null;
  /** Result of the last completed import (null when not applicable) */
  importResult: ImportResultInfo | null;
  /** Set the importing state (called by AppleMusicScreen) */
  setImporting: (importing: boolean) => void;
  /** Update import progress (called by AppleMusicScreen) */
  updateProgress: (progress: PlaylistImportProgress | null) => void;
  /** Set the import result (called by AppleMusicScreen after import completes) */
  setImportResult: (result: ImportResultInfo | null) => void;
  /** Callback when user taps "View playlist" on success screen */
  onViewPlaylist: (() => void) | null;
  /** Register the "View playlist" callback (called by AppleMusicScreen) */
  setOnViewPlaylist: (callback: (() => void) | null) => void;
  /** Dismiss the result indicator */
  dismissResult: () => void;
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
  const [importResult, setImportResultState] = useState<ImportResultInfo | null>(null);
  const [onViewPlaylist, setOnViewPlaylistState] = useState<(() => void) | null>(null);

  const setImporting = useCallback((importing: boolean) => {
    setIsImporting(importing);
    if (!importing) {
      setImportProgress(null);
    }
  }, []);

  const updateProgress = useCallback((progress: PlaylistImportProgress | null) => {
    setImportProgress(progress);
  }, []);

  const setImportResult = useCallback((result: ImportResultInfo | null) => {
    setImportResultState(result);
  }, []);

  const setOnViewPlaylist = useCallback((callback: (() => void) | null) => {
    // Wrap in function to prevent React from calling it as a state updater
    setOnViewPlaylistState(() => callback);
  }, []);

  const dismissResult = useCallback(() => {
    setImportResultState(null);
    setOnViewPlaylistState(null);
  }, []);

  const value = useMemo(() => ({
    isImporting,
    importProgress,
    importResult,
    setImporting,
    updateProgress,
    setImportResult,
    onViewPlaylist,
    setOnViewPlaylist,
    dismissResult,
  }), [isImporting, importProgress, importResult, setImporting, updateProgress, setImportResult, onViewPlaylist, setOnViewPlaylist, dismissResult]);

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
