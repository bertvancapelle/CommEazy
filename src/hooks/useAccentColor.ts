/**
 * useAccentColor — Hook for managing user's accent color preference
 *
 * Provides:
 * - Current accent color (from user profile)
 * - Function to update accent color
 * - Resolved color values for use in styles
 *
 * All accent colors are WCAG AAA compliant (7:1 contrast ratio).
 *
 * NOTE: This hook uses AccentColorContext for shared state.
 * Make sure your app is wrapped with <AccentColorProvider>.
 *
 * @see src/theme/index.ts for color definitions
 * @see src/contexts/AccentColorContext.tsx for the context provider
 */

import { useAccentColorContext, type AccentColorContextValue } from '@/contexts/AccentColorContext';
import type { AccentColorKey } from '@/theme';

export type UseAccentColorReturn = AccentColorContextValue;

/**
 * Hook for managing accent color preference
 * Uses shared context so all components update together
 */
export function useAccentColor(): UseAccentColorReturn {
  return useAccentColorContext();
}

// Export accent color constants for UI
export const ACCENT_COLOR_KEYS: AccentColorKey[] = ['blue', 'green', 'purple', 'orange', 'red'];
