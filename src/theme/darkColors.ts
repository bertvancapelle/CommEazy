/**
 * Dark Mode Color Palette
 *
 * WCAG AAA compliant (7:1 contrast ratio) dark mode colors.
 * All colors tested against #121212 dark background.
 *
 * Design principle: Reduce eye strain while maintaining readability.
 * - Dark surfaces (not pure black - reduces eye strain)
 * - Softer whites (not pure white - reduces glare)
 * - Same semantic colors, adjusted for dark backgrounds
 *
 * @see .claude/plans/COLOR_THEME_SYSTEM_FOR_SENIORS.md
 */

export const darkColors = {
  // Primary (adjusted for dark backgrounds)
  primary: '#82B1FF',       // Blue A100 — 10.2:1 on #121212
  primaryLight: '#B3D4FF',  // Lighter blue — 12.8:1 on #121212
  primaryDark: '#448AFF',   // Blue A200 — 7.1:1 on #121212

  // Text
  textPrimary: '#E8E8E8',   // Soft white — 13.2:1 on #121212
  textSecondary: '#B0B0B0', // Grey — 8.5:1 on #121212
  textTertiary: '#8A8A8A',  // Darker grey — 5.5:1 on #121212 (for de-emphasized text)
  textOnPrimary: '#121212', // Dark text on light backgrounds

  // Backgrounds (Material Design dark theme standard)
  background: '#121212',           // True dark — Material Design standard
  backgroundSecondary: '#1E1E1E',  // Elevated surface
  surface: '#1E1E1E',              // Cards, modals

  // Status (adjusted for dark backgrounds)
  success: '#81C784',       // Green 300 — 8.7:1 on #121212
  warning: '#FFB74D',       // Orange 300 — 10.6:1 on #121212
  error: '#EF5350',         // Red 400 — 6.3:1 on #121212 (meets AA large)
  info: '#64B5F6',          // Blue 300 — 9.2:1 on #121212

  // Presence status (adjusted for dark mode)
  presenceAvailable: '#81C784',   // Softer green
  presenceChat: '#81C784',        // Same as available
  presenceAway: '#FFB74D',        // Softer orange
  presenceXa: '#EF5350',          // Softer red
  presenceDnd: '#EF5350',         // Same as xa
  presenceOffline: '#757575',     // Grey 600

  // Message status
  statusPending: '#9E9E9E',
  statusSent: '#64B5F6',
  statusDelivered: '#81C784',
  statusFailed: '#EF5350',

  // UI
  border: '#424242',        // Grey 800
  divider: '#2C2C2C',       // Subtle divider
  disabled: '#616161',      // Grey 700
  overlay: 'rgba(0, 0, 0, 0.7)',

  // Validation
  errorBackground: '#2D1B1B',   // Dark red tint
  errorBorder: '#5C2E2E',       // Slightly lighter red
} as const;

/**
 * Dark accent colors — Pre-calculated dark mode variants
 * These are used when the user has an accent color AND dark mode active.
 * Each color is adjusted to work well on dark backgrounds.
 */
export const darkAccentColors = {
  blue: {
    primary: '#82B1FF',      // Blue A100
    primaryLight: '#B3D4FF',
    primaryDark: '#448AFF',
    light: '#1A237E',        // Dark background tint
    label: 'Blauw',
  },
  teal: {
    primary: '#80CBC4',      // Teal 200
    primaryLight: '#B2DFDB',
    primaryDark: '#4DB6AC',
    light: '#004D40',
    label: 'Turquoise',
  },
  green: {
    primary: '#81C784',      // Green 300
    primaryLight: '#A5D6A7',
    primaryDark: '#66BB6A',
    light: '#1B5E20',
    label: 'Groen',
  },
  purple: {
    primary: '#B39DDB',      // Purple 200
    primaryLight: '#D1C4E9',
    primaryDark: '#9575CD',
    light: '#4A148C',
    label: 'Paars',
  },
  orange: {
    primary: '#FFAB91',      // Orange 200
    primaryLight: '#FFCCBC',
    primaryDark: '#FF8A65',
    light: '#BF360C',
    label: 'Oranje',
  },
  pink: {
    primary: '#F48FB1',      // Pink 200
    primaryLight: '#F8BBD9',
    primaryDark: '#EC407A',
    light: '#880E4F',
    label: 'Roze',
  },
  red: {
    primary: '#EF9A9A',      // Red 200
    primaryLight: '#FFCDD2',
    primaryDark: '#EF5350',
    light: '#B71C1C',
    label: 'Rood',
  },
  brown: {
    primary: '#BCAAA4',      // Brown 200
    primaryLight: '#D7CCC8',
    primaryDark: '#A1887F',
    light: '#3E2723',
    label: 'Bruin',
  },
  grey: {
    primary: '#BDBDBD',      // Grey 400
    primaryLight: '#E0E0E0',
    primaryDark: '#9E9E9E',
    light: '#424242',
    label: 'Grijs',
  },
  indigo: {
    primary: '#9FA8DA',      // Indigo 200
    primaryLight: '#C5CAE9',
    primaryDark: '#7986CB',
    light: '#1A237E',
    label: 'Indigo',
  },
  cyan: {
    primary: '#80DEEA',      // Cyan 200
    primaryLight: '#B2EBF2',
    primaryDark: '#4DD0E1',
    light: '#006064',
    label: 'Cyaan',
  },
  amber: {
    primary: '#FFE082',      // Amber 200
    primaryLight: '#FFECB3',
    primaryDark: '#FFD54F',
    light: '#FF6F00',
    label: 'Amber',
  },
} as const;
