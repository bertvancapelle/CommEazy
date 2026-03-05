/**
 * Retry Utilities — Shared retry logic for all CommEazy services
 *
 * Provides a unified RetryConfig interface and calculateRetryDelay function
 * used across XMPP, VoIP push, call ICE restart, book downloads, and media queue.
 *
 * Strategies:
 * - 'exponential': baseDelayMs * 2^attempt, capped at maxDelayMs, optional jitter
 * - 'fixed-schedule': lookup from fixedDelays array, last value repeats
 *
 * @see .claude/skills/architecture-lead/SKILL.md (Retry Pattern Standaardisatie)
 */

// ============================================================
// Types
// ============================================================

export interface RetryConfig {
  /** Maximum number of retry attempts (not counting the initial attempt) */
  maxAttempts: number;
  /** Base delay in ms for exponential strategy */
  baseDelayMs: number;
  /** Maximum delay cap in ms */
  maxDelayMs: number;
  /** Backoff strategy */
  strategy: 'exponential' | 'fixed-schedule';
  /** Fixed delay schedule in ms (used when strategy is 'fixed-schedule') */
  fixedDelays?: number[];
  /** Jitter factor 0-1 (e.g. 0.2 = ±20% random variation). Default: 0 */
  jitter?: number;
}

// ============================================================
// Core Function
// ============================================================

/**
 * Calculate the delay before the next retry attempt.
 *
 * @param config - The retry configuration
 * @param attempt - The current attempt number (1-based: 1 = first retry)
 * @returns Delay in milliseconds before the next retry
 */
export function calculateRetryDelay(config: RetryConfig, attempt: number): number {
  if (attempt <= 0) return 0;

  let delay: number;

  if (config.strategy === 'fixed-schedule' && config.fixedDelays && config.fixedDelays.length > 0) {
    // Fixed schedule: use array index, repeat last value if exceeded
    const index = Math.min(attempt - 1, config.fixedDelays.length - 1);
    delay = config.fixedDelays[index];
  } else {
    // Exponential backoff: baseDelay * 2^(attempt-1)
    delay = config.baseDelayMs * Math.pow(2, attempt - 1);
  }

  // Apply cap
  delay = Math.min(delay, config.maxDelayMs);

  // Apply jitter (±jitter%)
  const jitter = config.jitter ?? 0;
  if (jitter > 0) {
    const jitterRange = delay * jitter;
    delay += (Math.random() * 2 - 1) * jitterRange;
    delay = Math.max(0, Math.round(delay));
  }

  return delay;
}

// ============================================================
// Pre-defined Configs
// ============================================================

/** VoIP Push token registration retry (short, 2 attempts) */
export const VOIP_PUSH_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 2,
  baseDelayMs: 1000,
  maxDelayMs: 3000,
  strategy: 'exponential',
};

/** Book download retry (2 attempts, moderate delays) */
export const BOOKS_DOWNLOAD_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 2,
  baseDelayMs: 3000,
  maxDelayMs: 10000,
  strategy: 'exponential',
};

/** XMPP reconnection (10 attempts, exponential with jitter) */
export const XMPP_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 10,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  strategy: 'exponential',
  jitter: 0.2,
};

/** Call ICE restart retry (3 attempts, starts at 5s) */
export const CALL_ICE_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 5000,
  maxDelayMs: 16000,
  strategy: 'exponential',
};

/** Media queue offline retry (5 attempts, fixed escalating schedule) */
export const MEDIA_QUEUE_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 300000,
  strategy: 'fixed-schedule',
  fixedDelays: [
    1000,      // 1 second
    5000,      // 5 seconds
    30000,     // 30 seconds
    120000,    // 2 minutes
    300000,    // 5 minutes
  ],
};
