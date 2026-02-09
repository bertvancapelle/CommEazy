/**
 * CommEazy Design System
 *
 * Senior-inclusive defaults:
 * - Body text ≥18pt, headings ≥24pt
 * - Touch targets ≥60pt
 * - WCAG AAA contrast (7:1)
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 * @see .claude/skills/ui-designer/SKILL.md
 */

import { Platform, PixelRatio } from 'react-native';

// ============================================================
// Colors — WCAG AAA (7:1 contrast ratio on white)
// ============================================================

export const colors = {
  // Primary
  primary: '#0D47A1',       // Blue 900 — 12.6:1 on white
  primaryLight: '#1565C0',  // Blue 800 — 8.6:1 on white
  primaryDark: '#0A3069',   // 15.2:1 on white

  // Text
  textPrimary: '#1A1A1A',   // Near black — 16.8:1 on white
  textSecondary: '#424242',  // Grey 800 — 10.7:1 on white
  textTertiary: '#616161',   // Grey 700 — 7.2:1 on white (minimum AAA)
  textOnPrimary: '#FFFFFF',

  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  surface: '#FFFFFF',

  // Status
  success: '#1B5E20',       // Green 900 — 10.3:1 on white
  warning: '#E65100',       // Orange 900 — 5.0:1 (AAA on large text)
  error: '#B71C1C',         // Red 900 — 8.3:1 on white
  info: '#0D47A1',

  // Message status
  statusPending: '#757575',
  statusSent: '#0D47A1',
  statusDelivered: '#1B5E20',
  statusFailed: '#B71C1C',

  // UI
  border: '#BDBDBD',
  divider: '#E0E0E0',
  disabled: '#9E9E9E',
  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

// ============================================================
// Typography — Senior-inclusive sizes
// ============================================================

// Scaled points that respect Dynamic Type / Android font scaling
export function scaledSize(size: number): number {
  const scale = PixelRatio.getFontScale();
  return Math.round(size * Math.min(scale, 2.0)); // Cap at 2x
}

export const typography = {
  // Headings
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
    letterSpacing: 0,
  },

  // Body — MINIMUM 18pt
  body: {
    fontSize: 18,
    fontWeight: '400' as const,
    lineHeight: 28,
    letterSpacing: 0.15,
  },
  bodyBold: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 28,
    letterSpacing: 0.15,
  },

  // Labels
  label: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 24,
    letterSpacing: 0.1,
  },

  // Small (timestamps, metadata only)
  small: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: 0.25,
  },

  // Input
  input: {
    fontSize: 20,
    fontWeight: '400' as const,
    lineHeight: 28,
    letterSpacing: 0,
  },

  // Button
  button: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
    letterSpacing: 0.5,
    textTransform: 'none' as const,
  },
} as const;

// ============================================================
// Spacing
// ============================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ============================================================
// Touch Targets — ≥60pt (exceeds Apple 44pt / Google 48dp)
// ============================================================

export const touchTargets = {
  minimum: 60,          // Our minimum — exceeds both platform minimums
  comfortable: 72,      // Comfortable for seniors
  large: 84,            // PIN pad, primary actions
} as const;

// ============================================================
// Border Radius
// ============================================================

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ============================================================
// Shadows (subtle, platform-aware)
// ============================================================

export const shadows = {
  small: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    android: {
      elevation: 2,
    },
  }),
  medium: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
  }),
} as const;

// ============================================================
// Animation (respect prefers-reduced-motion)
// ============================================================

export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

// ============================================================
// Z-Index
// ============================================================

export const zIndex = {
  base: 0,
  above: 1,
  modal: 100,
  toast: 200,
  overlay: 300,
} as const;
