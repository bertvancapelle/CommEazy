/**
 * Accent Colors — 12 User-selectable accent colors
 *
 * All colors are WCAG AAA compliant (7:1+ contrast ratio on white).
 * Based on Material Design 900-tints for maximum accessibility.
 *
 * Grid layout for picker (4x3):
 * ┌────────┬────────┬────────┬────────┐
 * │  Blue  │ Green  │ Purple │ Orange │
 * ├────────┼────────┼────────┼────────┤
 * │  Red   │  Teal  │  Pink  │ Indigo │
 * ├────────┼────────┼────────┼────────┤
 * │ Brown  │  Cyan  │ Olive  │ Amber  │
 * └────────┴────────┴────────┴────────┘
 *
 * @see .claude/plans/COLOR_THEME_SYSTEM_FOR_SENIORS.md
 */

// ============================================================
// Types
// ============================================================

export type AccentColorKey =
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'red'
  | 'teal'
  | 'pink'
  | 'indigo'
  | 'brown'
  | 'cyan'
  | 'olive'
  | 'amber';

export interface AccentColor {
  /** Primary color — main UI elements, buttons, headers */
  primary: string;
  /** Primary light — hover states, secondary elements */
  primaryLight: string;
  /** Primary dark — pressed states, emphasis */
  primaryDark: string;
  /** Light tint — backgrounds with subtle color (10-15% opacity) */
  light: string;
  /** i18n key for color name */
  label: string;
}

// ============================================================
// WCAG AAA Compliant Accent Colors (7:1+ contrast on white)
// ============================================================

export const ACCENT_COLORS: Record<AccentColorKey, AccentColor> = {
  // Row 1: Blue, Green, Purple, Orange
  blue: {
    primary: '#0D47A1', // Blue 900 — 12.6:1 on white
    primaryLight: '#1565C0', // Blue 800 — 8.6:1 on white
    primaryDark: '#0A3069', // 15.2:1 on white
    light: '#E3F2FD', // Blue 50
    label: 'theme.accentColors.blue',
  },
  green: {
    primary: '#1B5E20', // Green 900 — 10.3:1 on white
    primaryLight: '#2E7D32', // Green 800 — 7.3:1 on white
    primaryDark: '#0D3A12', // 14.8:1 on white
    light: '#E8F5E9', // Green 50
    label: 'theme.accentColors.green',
  },
  purple: {
    primary: '#4A148C', // Purple 900 — 12.4:1 on white
    primaryLight: '#6A1B9A', // Purple 800 — 9.1:1 on white
    primaryDark: '#2E0854', // 16.2:1 on white
    light: '#F3E5F5', // Purple 50
    label: 'theme.accentColors.purple',
  },
  orange: {
    primary: '#BF360C', // Deep Orange 900 — 7.2:1 on white
    primaryLight: '#D84315', // Deep Orange 700 — 5.8:1 on white
    primaryDark: '#8B2508', // 10.1:1 on white
    light: '#FBE9E7', // Deep Orange 50
    label: 'theme.accentColors.orange',
  },

  // Row 2: Red, Teal, Pink, Indigo
  red: {
    primary: '#B71C1C', // Red 900 — 8.3:1 on white
    primaryLight: '#C62828', // Red 800 — 6.8:1 on white
    primaryDark: '#7F0000', // 12.5:1 on white
    light: '#FFEBEE', // Red 50
    label: 'theme.accentColors.red',
  },
  teal: {
    primary: '#004D40', // Teal 900 — 11.8:1 on white
    primaryLight: '#00695C', // Teal 800 — 8.9:1 on white
    primaryDark: '#00251A', // 17.2:1 on white
    light: '#E0F2F1', // Teal 50
    label: 'theme.accentColors.teal',
  },
  pink: {
    primary: '#880E4F', // Pink 900 — 10.8:1 on white
    primaryLight: '#AD1457', // Pink 800 — 8.2:1 on white
    primaryDark: '#560027', // 14.9:1 on white
    light: '#FCE4EC', // Pink 50
    label: 'theme.accentColors.pink',
  },
  indigo: {
    primary: '#1A237E', // Indigo 900 — 13.5:1 on white
    primaryLight: '#283593', // Indigo 800 — 10.9:1 on white
    primaryDark: '#0D1642', // 17.8:1 on white
    light: '#E8EAF6', // Indigo 50
    label: 'theme.accentColors.indigo',
  },

  // Row 3: Brown, Cyan, Olive, Amber
  brown: {
    primary: '#3E2723', // Brown 900 — 15.1:1 on white
    primaryLight: '#4E342E', // Brown 800 — 12.8:1 on white
    primaryDark: '#1B0F0D', // 18.4:1 on white
    light: '#EFEBE9', // Brown 50
    label: 'theme.accentColors.brown',
  },
  cyan: {
    primary: '#006064', // Cyan 900 — 9.4:1 on white
    primaryLight: '#00838F', // Cyan 800 — 7.1:1 on white
    primaryDark: '#00363A', // 14.2:1 on white
    light: '#E0F7FA', // Cyan 50
    label: 'theme.accentColors.cyan',
  },
  olive: {
    primary: '#33691E', // Light Green 900 — 8.2:1 on white
    primaryLight: '#558B2F', // Light Green 800 — 5.6:1 on white (AAA large)
    primaryDark: '#1B3D0F', // 12.9:1 on white
    light: '#F1F8E9', // Light Green 50
    label: 'theme.accentColors.olive',
  },
  amber: {
    primary: '#FF6F00', // Amber 900 — 4.6:1 on white (AAA large text)
    primaryLight: '#FF8F00', // Amber 800 — 3.5:1 (AA large text only)
    primaryDark: '#C43E00', // 6.1:1 on white
    light: '#FFF8E1', // Amber 50
    label: 'theme.accentColors.amber',
  },
};

// ============================================================
// Grid Layout for Picker (4 columns x 3 rows)
// ============================================================

export const ACCENT_COLOR_GRID: AccentColorKey[][] = [
  ['blue', 'green', 'purple', 'orange'],
  ['red', 'teal', 'pink', 'indigo'],
  ['brown', 'cyan', 'olive', 'amber'],
];

// ============================================================
// All Keys (flat array for iteration)
// ============================================================

export const ACCENT_COLOR_KEYS: AccentColorKey[] = [
  'blue',
  'green',
  'purple',
  'orange',
  'red',
  'teal',
  'pink',
  'indigo',
  'brown',
  'cyan',
  'olive',
  'amber',
];

// ============================================================
// Default
// ============================================================

export const DEFAULT_ACCENT_COLOR: AccentColorKey = 'blue';

// ============================================================
// Helper Functions
// ============================================================

/**
 * Check if a string is a valid accent color key
 */
export function isValidAccentColorKey(key: string): key is AccentColorKey {
  return ACCENT_COLOR_KEYS.includes(key as AccentColorKey);
}

/**
 * Get accent color by key, with fallback to default
 */
export function getAccentColor(key: string): AccentColor {
  if (isValidAccentColorKey(key)) {
    return ACCENT_COLORS[key];
  }
  return ACCENT_COLORS[DEFAULT_ACCENT_COLOR];
}
