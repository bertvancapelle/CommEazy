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
  /**
   * @deprecated No longer needed — ModuleHeader auto-navigates to HomeScreen grid.
   * Only use this if you need to override the default behavior.
   */
  onModuleIconPress?: () => void;
  /**
   * @deprecated No longer needed — uses t('navigation.switchModule') automatically.
   * Only use this if you need a custom label.
   */
  moduleIconLabel?: string;
  /**
   * Disable automatic icon button navigation (default: false)
   * Set to true for detail screens or screens that shouldn't have quick navigation
   */
  disableIconNavigation?: boolean;
  /**
   * Show Home button to navigate back to HomeScreen grid (default: true on iPhone)
   * Hidden when showBackButton is true (detail screens show back instead of home)
   */
  showHomeButton?: boolean;
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
  onModuleIconPress,
  moduleIconLabel,
  disableIconNavigation = false,
  showHomeButton = true,
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

  // PaneContext for Home button navigation
  const paneCtx = usePaneContextSafe();

  // Navigate to HomeScreen grid
  const handleHomePress = useCallback(() => {
    if (paneCtx && panelId) {
      void triggerFeedback('navigation');
      paneCtx.setPaneModule(panelId, 'home');
    }
  }, [paneCtx, panelId, triggerFeedback]);

  // Show Home button only when:
  // - showHomeButton is true (default)
  // - showBackButton is false (detail screens show back, not home)
  // - PaneContext is available
  // - Not on the HomeScreen itself
  const shouldShowHomeButton =
    showHomeButton &&
    !showBackButton &&
    paneCtx &&
    moduleId !== 'home';

  // Auto-generated icon press handler — navigates to HomeScreen grid
  // On iPhone: navigates to fullscreen grid
  // On iPad: shows grid IN the pane (replaces module content)
  const handleAutoIconPress = useCallback(() => {
    if (paneCtx && panelId) {
      void triggerFeedback('navigation');
      paneCtx.setPaneModule(panelId, 'home');
    }
  }, [paneCtx, panelId, triggerFeedback]);

  // Determine if icon/logo should be tappable:
  // 1. Explicit onModuleIconPress overrides auto behavior
  // 2. Auto-enable when: PaneContext available + not disabled + not back button
  // Note: customLogo is now also tappable (e.g., nu.nl logo opens grid)
  const effectiveOnIconPress = onModuleIconPress ?? (
    !disableIconNavigation && !showBackButton && paneCtx
      ? handleAutoIconPress
      : undefined
  );

  // Use provided label or default translation
  const effectiveIconLabel = moduleIconLabel ?? t('navigation.switchModule');

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
        {/* Left: Home button + Back button (optional) + Icon + Title */}
        <View style={styles.titleContent}>
          {shouldShowHomeButton && (
            <TouchableOpacity
              style={[
                styles.homeButton,
                buttonStyle?.settings.borderEnabled && {
                  borderWidth: 2,
                  borderColor: buttonStyle.getBorderColorHex(),
                },
              ]}
              onPress={handleHomePress}
              accessibilityRole="button"
              accessibilityLabel={t('navigation.backToHome', 'Terug naar startscherm')}
            >
              <Icon name="grid" size={24} color={colors.textOnPrimary} />
            </TouchableOpacity>
          )}
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
            // Custom logo — wrap in TouchableOpacity if navigation is enabled
            effectiveOnIconPress ? (
              <TouchableOpacity
                style={[
                  styles.moduleIconButton,
                  buttonStyle?.settings.borderEnabled && {
                    borderWidth: 2,
                    borderColor: buttonStyle.getBorderColorHex(),
                  },
                ]}
                onPress={effectiveOnIconPress}
                accessibilityRole="button"
                accessibilityLabel={effectiveIconLabel}
                accessibilityHint={t('navigation.switchModuleHint')}
              >
                {customLogo}
              </TouchableOpacity>
            ) : (
              customLogo
            )
          ) : (
            // Default icon — wrap in TouchableOpacity if navigation is enabled
            effectiveOnIconPress ? (
              <TouchableOpacity
                style={[
                  styles.moduleIconButton,
                  buttonStyle?.settings.borderEnabled && {
                    borderWidth: 2,
                    borderColor: buttonStyle.getBorderColorHex(),
                  },
                ]}
                onPress={effectiveOnIconPress}
                accessibilityRole="button"
                accessibilityLabel={effectiveIconLabel}
                accessibilityHint={t('navigation.switchModuleHint')}
              >
                <Icon name={icon} size={32} color={colors.textOnPrimary} />
              </TouchableOpacity>
            ) : (
              <Icon name={icon} size={32} color={colors.textOnPrimary} />
            )
          )}
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
  homeButton: {
    // Senior-inclusive touch target ≥60pt
    width: touchTargets.minimum,           // 60pt (consistent with other header buttons)
    height: touchTargets.minimum,          // 60pt
    backgroundColor: 'rgba(255, 255, 255, 0.15)',  // Subtle white fill
    borderRadius: borderRadius.md,         // 12pt (consistent with other header buttons)
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  backButton: {
    // Senior-inclusive touch target ≥60pt
    width: touchTargets.minimum,           // 60pt (consistent with moduleIconButton)
    height: touchTargets.minimum,          // 60pt (consistent with moduleIconButton)
    backgroundColor: 'rgba(255, 255, 255, 0.15)',  // Subtle white fill (like moduleIconButton)
    borderRadius: borderRadius.md,         // 12pt (consistent with moduleIconButton)
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  moduleIconButton: {
    // Match SearchBar button size for visual uniformity
    width: touchTargets.minimum,        // 60pt (same as SearchBar button)
    height: touchTargets.minimum,       // 60pt (same as SearchBar button)
    backgroundColor: 'rgba(255, 255, 255, 0.15)',  // Subtle white fill (like SearchBar button style)
    borderRadius: borderRadius.md,      // Match SearchBar button (12pt)
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
