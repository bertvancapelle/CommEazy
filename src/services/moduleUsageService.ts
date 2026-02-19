/**
 * Module Usage Service — 24-hour rolling window usage tracking
 *
 * Tracks time spent in each module to enable smart sorting
 * in the WheelNavigationMenu. Modules with more usage time
 * in the last 24 hours appear higher in the menu.
 *
 * Features:
 * - Session-based time tracking (start/end)
 * - 24-hour rolling window calculation
 * - Automatic session cleanup
 * - Persistence to AsyncStorage
 *
 * @see .claude/plans/COUNTRY_SPECIFIC_MODULES.md
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ModuleSession, ModuleUsageData } from '@/types/modules';

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = 'module_usage_sessions';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 1000; // Prevent unbounded growth

// ============================================================
// Module Usage Service
// ============================================================

class ModuleUsageServiceImpl {
  private sessions: ModuleSession[] = [];
  private currentSession: ModuleSession | null = null;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  /**
   * Initialize the service by loading persisted sessions
   */
  async initialize(): Promise<void> {
    if (this.isLoaded) return;

    if (this.loadPromise) {
      await this.loadPromise;
      return;
    }

    this.loadPromise = this.load();
    await this.loadPromise;
  }

  /**
   * Load sessions from storage
   */
  private async load(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: ModuleUsageData = JSON.parse(stored);
        this.sessions = data.sessions || [];
        // Prune old sessions on load
        await this.pruneOldSessions();
      }
      this.isLoaded = true;
      console.debug('[ModuleUsageService] Loaded', this.sessions.length, 'sessions');
    } catch (error) {
      console.error('[ModuleUsageService] Failed to load sessions:', error);
      this.sessions = [];
      this.isLoaded = true;
    }
  }

  /**
   * Save sessions to storage
   */
  private async save(): Promise<void> {
    try {
      const data: ModuleUsageData = { sessions: this.sessions };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[ModuleUsageService] Failed to save sessions:', error);
    }
  }

  /**
   * Start tracking time in a module
   * Automatically ends any previous active session
   */
  startSession(moduleId: string): void {
    // End current session first
    if (this.currentSession) {
      this.endSession();
    }

    this.currentSession = {
      moduleId,
      startedAt: Date.now(),
    };

    console.debug('[ModuleUsageService] Started session for', moduleId);
  }

  /**
   * End the current session
   */
  endSession(): void {
    if (!this.currentSession) return;

    const endedSession: ModuleSession = {
      ...this.currentSession,
      endedAt: Date.now(),
    };

    this.sessions.push(endedSession);
    console.debug(
      '[ModuleUsageService] Ended session for',
      endedSession.moduleId,
      'duration:',
      Math.round((endedSession.endedAt! - endedSession.startedAt) / 1000),
      's'
    );

    this.currentSession = null;

    // Persist in background
    void this.save();
  }

  /**
   * Get total time spent in a module in the last 24 hours (in seconds)
   */
  getUsageTime24h(moduleId: string): number {
    const now = Date.now();
    const cutoff = now - TWENTY_FOUR_HOURS_MS;

    let totalMs = 0;

    // Count completed sessions
    for (const session of this.sessions) {
      if (session.moduleId !== moduleId) continue;
      if (!session.endedAt) continue;

      // Session started before cutoff but ended after
      const effectiveStart = Math.max(session.startedAt, cutoff);
      if (session.endedAt > cutoff) {
        totalMs += session.endedAt - effectiveStart;
      }
    }

    // Add current session if it's for this module
    if (this.currentSession?.moduleId === moduleId) {
      const effectiveStart = Math.max(this.currentSession.startedAt, cutoff);
      totalMs += now - effectiveStart;
    }

    return Math.round(totalMs / 1000);
  }

  /**
   * Get all modules sorted by 24h usage time (descending)
   */
  getModulesByUsage(): Array<{ moduleId: string; seconds: number }> {
    // Get unique module IDs
    const moduleIds = new Set<string>();
    for (const session of this.sessions) {
      moduleIds.add(session.moduleId);
    }
    if (this.currentSession) {
      moduleIds.add(this.currentSession.moduleId);
    }

    // Calculate usage for each
    const usage: Array<{ moduleId: string; seconds: number }> = [];
    for (const moduleId of moduleIds) {
      const seconds = this.getUsageTime24h(moduleId);
      if (seconds > 0) {
        usage.push({ moduleId, seconds });
      }
    }

    // Sort by seconds descending
    usage.sort((a, b) => b.seconds - a.seconds);

    return usage;
  }

  /**
   * Get usage rank for a module (1 = most used)
   * Returns 0 if module has no usage
   */
  getUsageRank(moduleId: string): number {
    const sorted = this.getModulesByUsage();
    const index = sorted.findIndex((u) => u.moduleId === moduleId);
    return index >= 0 ? index + 1 : 0;
  }

  /**
   * Remove sessions older than 24 hours
   */
  async pruneOldSessions(): Promise<void> {
    const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;
    const before = this.sessions.length;

    this.sessions = this.sessions.filter((session) => {
      // Keep sessions that ended after cutoff (or haven't ended)
      return !session.endedAt || session.endedAt > cutoff;
    });

    // Also limit total number of sessions
    if (this.sessions.length > MAX_SESSIONS) {
      this.sessions = this.sessions.slice(-MAX_SESSIONS);
    }

    const after = this.sessions.length;
    if (before !== after) {
      console.debug('[ModuleUsageService] Pruned', before - after, 'old sessions');
      await this.save();
    }
  }

  /**
   * Clear all usage data (for testing/reset)
   */
  async clearAll(): Promise<void> {
    this.sessions = [];
    this.currentSession = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.debug('[ModuleUsageService] Cleared all usage data');
  }

  /**
   * Get debug info
   */
  getDebugInfo(): {
    sessionCount: number;
    currentModule: string | null;
    topModules: Array<{ moduleId: string; seconds: number }>;
  } {
    return {
      sessionCount: this.sessions.length,
      currentModule: this.currentSession?.moduleId ?? null,
      topModules: this.getModulesByUsage().slice(0, 5),
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const moduleUsageService = new ModuleUsageServiceImpl();

// Initialize on import (non-blocking)
void moduleUsageService.initialize();
