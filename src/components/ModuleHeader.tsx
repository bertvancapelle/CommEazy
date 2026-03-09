/**
 * ModuleHeader — Standardized header component for all module screens
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────────┐
 * │  Safe Area (notch/Dynamic Island)                             │
 * ├──────────────────────────────────────────────────────────────┤
 * │  [═══════════ AdMob Banner ═══════════════════]              │
 * ├──────────────────────────────────────────────────────────────┤
 * │  📻 Radio                    🔊 [MediaIndicator] [🏠 Grid]    │
 * │  ↑ Icon (decoratief) + Title          ↑ Rechts (spacing.md)  │
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
 * - Touch targets ≥60pt for MediaIndicator and Grid button
 * - High contrast text on colored background
 * - Consistent layout across all modules
 *
 * @see .claude/CLAUDE.md Section 12.2 (ModuleHeader Component)
 * @see .claude/CLAUDE.md Section 16 (Liquid Glass Compliance)
 * @see .claude/skills/ui-designer/SKILL.md Section 7c
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { MediaIndicator } from './MediaIndicator';
import { AdMobBanner } from './AdMobBanner';
import { LiquidGlassView } from './LiquidGlassView';
import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useLiquidGlassContextSafe } from '@/contexts/LiquidGlassContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useButtonStyleSafe } from '@/contexts/ButtonStyleContext';
import { usePanelId } from '@/contexts/PanelIdContext';
import { usePaneContextSafe } from '@/contexts/PaneContext';
import { useFeedback } from '@/hooks/useFeedback';
import type { ModuleColorId } from '@/types/liquidGlass';
import type { IconName } from './Icon';

// ============================================================
// Types
// ============================================================

export interface ModuleHeaderProps {
  /** Module identifier for color lookup */
  moduleId: string;
  /** Module icon name (displayed decoratively, not interactive) */
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
  /**
   * Show Grid button to navigate back to HomeScreen grid (default: true)
   * Hidden when showBackButton is true (detail screens show back instead)
   */
  showGridButton?: boolean;
}

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
  showGridButton = true,
}: ModuleHeaderProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Use module color from context (respects user customization)
  const moduleColor = useModuleColor(moduleId as ModuleColorId);

  // Check if Liquid Glass is available (safe to call outside provider)
  const liquidGlassContext = useLiquidGlassContextSafe();
  const useLiquidGlass = liquidGlassContext?.isEnabled ?? false;

  const panelId = usePanelId();
  const { triggerFeedback } = useFeedback();

  // Button style context for optional border styling
  const buttonStyle = useButtonStyleSafe();

  // PaneContext for Grid button navigation
  const paneCtx = usePaneContextSafe();

  // Navigate to HomeScreen grid
  const handleGridPress = useCallback(() => {
    if (paneCtx && panelId) {
      void triggerFeedback('navigation');
      paneCtx.setPaneModule(panelId, 'home');
    }
  }, [paneCtx, panelId, triggerFeedback]);

  // Show Grid button only when:
  // - showGridButton is true (default)
  // - showBackButton is false (detail screens show back, not grid)
  // - PaneContext is available
  // - Not on the HomeScreen itself
  const shouldShowGridButton =
    showGridButton &&
    !showBackButton &&
    paneCtx &&
    moduleId !== 'home';

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
        {/* Left: Back button (optional) + Icon (decorative) + Title */}
        <View style={styles.titleContent}>
          {showBackButton && onBackPress && (
            <TouchableOpacity
              style={[
                styles.backButton,
                buttonStyle?.settings.borderEnabled && {
                  borderWidth: 2,
                  borderColor: buttonStyle.getBorderColorHex(),
                },
              ]}
              onPress={onBackPress}
              accessibilityRole="button"
              accessibilityLabel={backButtonLabel}
            >
              <Icon name="chevron-left" size={28} color={colors.textOnPrimary} />
            </TouchableOpacity>
          )}
          {customLogo ? (
            // Custom logo — purely decorative
            customLogo
          ) : (
            // Default icon — purely decorative
            <Icon name={icon} size={32} color={colors.textOnPrimary} />
          )}
          <Text style={styles.title}>{title}</Text>
        </View>

        {/* Right: MediaIndicator + Grid button */}
        <View style={styles.rightControls}>
          <View style={styles.mediaIndicatorWrapper}>
            <MediaIndicator
              moduleColor={moduleColor}
              currentSource={currentSource}
            />
          </View>
          {shouldShowGridButton && (
            <TouchableOpacity
              style={[
                styles.gridButton,
                buttonStyle?.settings.borderEnabled && {
                  borderWidth: 2,
                  borderColor: buttonStyle.getBorderColorHex(),
                },
              ]}
              onPress={handleGridPress}
              accessibilityRole="button"
              accessibilityLabel={t('navigation.backToHome', 'Terug naar startscherm')}
            >
              <Icon name="grid" size={24} color={colors.textOnPrimary} />
            </TouchableOpacity>
          )}
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
    flex: 1,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,                   // 4pt tussen MediaIndicator en Grid button
  },
  backButton: {
    // Senior-inclusive touch target ≥60pt
    width: touchTargets.minimum,           // 60pt
    height: touchTargets.minimum,          // 60pt
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,         // 12pt
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  gridButton: {
    // Senior-inclusive touch target ≥60pt — far right position
    width: touchTargets.minimum,           // 60pt
    height: touchTargets.minimum,          // 60pt
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,         // 12pt
    justifyContent: 'center',
    alignItems: 'center',
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
