/**
 * ModuleHeader — Standardized header component for all module screens
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────────┐
 * │  Safe Area (notch/Dynamic Island)                             │
 * ├──────────────────────────────────────────────────────────────┤
 * │  [═══════════ AdMob Banner ═══════════════════]              │
 * ├──────────────────────────────────────────────────────────────┤
 * │  📻 Radio                              🔊 [MediaIndicator]    │
 * │  ↑ Links (spacing.md)                  ↑ Rechts (spacing.md)  │
 * ├──────────────────────────────────────────────────────────────┤
 * │  ─ ─ ─ ─ ─ ─ ─  Separator line (1pt) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Liquid Glass Support (iOS 26+):
 * - Uses LiquidGlassView wrapper when available
 * - Falls back to solid color on iOS <26 and Android
 * - Module tint colors defined in MODULE_TINT_COLORS
 *
 * Senior-inclusive design:
 * - Touch targets ≥60pt for MediaIndicator
 * - High contrast text on colored background
 * - Consistent layout across all modules
 *
 * @see .claude/CLAUDE.md Section 12.2 (ModuleHeader Component)
 * @see .claude/CLAUDE.md Section 16 (Liquid Glass Compliance)
 * @see .claude/skills/ui-designer/SKILL.md Section 7c
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { MediaIndicator } from './MediaIndicator';
import { AdMobBanner } from './AdMobBanner';
import { LiquidGlassView } from './LiquidGlassView';
import { colors, typography, spacing, touchTargets } from '@/theme';
import { useLiquidGlassContextSafe } from '@/contexts/LiquidGlassContext';
import type { ModuleColorId } from '@/types/liquidGlass';
import type { IconName } from './Icon';

// ============================================================
// Types
// ============================================================

export interface ModuleHeaderProps {
  /** Module identifier for color lookup */
  moduleId: string;
  /** Module icon name */
  icon: IconName;
  /** Module title (use t('modules.xxx.title')) */
  title: string;
  /** Current module source for MediaIndicator filtering */
  currentSource?: 'radio' | 'podcast' | 'books' | 'appleMusic';
  /** Show AdMob banner in header (default: true) */
  showAdMob?: boolean;
  /** AdMob unit ID (optional, uses default if not provided) */
  adMobUnitId?: string;
  /** Show back button (for detail screens) */
  showBackButton?: boolean;
  /** Callback when back button is pressed */
  onBackPress?: () => void;
  /** Accessibility label for back button (default: "Terug") */
  backButtonLabel?: string;
  /** Custom logo component to render instead of icon (for source attribution) */
  customLogo?: React.ReactNode;
  /**
   * Optional style override for container positioning
   * Used for absolute positioning when ModuleHeader overlays content
   * @example style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
   */
  style?: StyleProp<ViewStyle>;
}

// ============================================================
// Module Colors
// ============================================================

/**
 * Module colors — consistent with WheelNavigationMenu
 */
const MODULE_COLORS: Record<string, string> = {
  radio: '#00897B',      // Teal
  podcast: '#E91E63',    // Pink
  audiobook: '#7B1FA2',  // Purple
  books: '#7B1FA2',      // Purple (alias for audiobook)
  ebook: '#F57C00',      // Orange
  videocall: '#C62828',  // Red
  calls: '#1565C0',      // Blue
  contacts: '#2E7D32',   // Green
  groups: '#00796B',     // Teal (darker)
  messages: '#1976D2',   // Blue (primary)
  settings: '#5E35B1',   // Deep Purple
  nunl: '#E65100',       // nu.nl Orange
  weather: '#03A9F4',    // Sky Blue
  appleMusic: '#FC3C44', // Apple Music red
};

// ============================================================
// Component
// ============================================================

export function ModuleHeader({
  moduleId,
  icon,
  title,
  currentSource,
  showAdMob = true,
  adMobUnitId,
  showBackButton = false,
  onBackPress,
  backButtonLabel = 'Terug',
  customLogo,
  style,
}: ModuleHeaderProps) {
  const insets = useSafeAreaInsets();
  const moduleColor = MODULE_COLORS[moduleId] || colors.primary;

  // Check if Liquid Glass is available (safe to call outside provider)
  const liquidGlassContext = useLiquidGlassContextSafe();
  const useLiquidGlass = liquidGlassContext?.isEnabled ?? false;

  // Common header content
  const headerContent = (
    <>
      {/* Safe Area Spacer */}
      <View style={{ height: insets.top }} />

      {/* AdMob Row (optional) — BOVEN de module naam */}
      {showAdMob && (
        <View style={styles.adMobRow}>
          <AdMobBanner unitId={adMobUnitId} size="banner" />
        </View>
      )}

      {/* Title Row */}
      <View style={styles.titleRow}>
        {/* Left: Back button (optional) + Icon + Title */}
        <View style={styles.titleContent}>
          {showBackButton && onBackPress && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBackPress}
              accessibilityRole="button"
              accessibilityLabel={backButtonLabel}
            >
              <Icon name="chevron-left" size={28} color={colors.textOnPrimary} />
            </TouchableOpacity>
          )}
          {customLogo ? customLogo : <Icon name={icon} size={28} color={colors.textOnPrimary} />}
          <Text style={styles.title}>{title}</Text>
        </View>

        {/* Right: MediaIndicator with ≥60pt touch wrapper */}
        <View style={styles.mediaIndicatorWrapper}>
          <MediaIndicator
            moduleColor={moduleColor}
            currentSource={currentSource}
          />
        </View>
      </View>

      {/* Separator Line */}
      <View style={styles.separator} />
    </>
  );

  // ModuleHeader uses solid color background, NOT Liquid Glass
  // Liquid Glass is reserved for floating elements (MiniPlayer, ExpandedPlayer)
  // that overlay content and benefit from transparency effects
  return (
    <View style={[styles.container, { backgroundColor: moduleColor }, style]}>
      {headerContent}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    // Container grows with content
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,    // 16pt padding beide kanten
    paddingVertical: 3,                // Compact: 3px boven en onder
  },
  titleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,                   // 8pt tussen icon en titel
  },
  backButton: {
    // Senior-inclusive touch target ≥60pt
    minWidth: touchTargets.minimum,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  mediaIndicatorWrapper: {
    // Ensure ≥60pt touch target for seniors
    minWidth: touchTargets.minimum,    // 60pt
    minHeight: touchTargets.minimum,   // 60pt
    justifyContent: 'center',
    alignItems: 'center',
  },
  adMobRow: {
    paddingHorizontal: spacing.sm,
    paddingTop: 0,                     // Geen extra afstand boven AdMob
    paddingBottom: 0,                  // Geen extra afstand onder AdMob
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',  // Subtle white line
  },
});

export default ModuleHeader;
