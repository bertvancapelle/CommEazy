/**
 * ModuleHeader — Standardized header component for all module screens
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────────┐
 * │  Safe Area (notch/Dynamic Island)                             │
 * ├──────────────────────────────────────────────────────────────┤
 * │  📻 Radio                    🔊 [MediaIndicator] [🏠 Grid]    │
 * │  ↑ Icon (decoratief) + Title          ↑ Rechts (spacing.md)  │
 * ├──────────────────────────────────────────────────────────────┤
 * │  ─ ─ ─ ─ ─ ─ ─  Separator line (1pt) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
 * └──────────────────────────────────────────────────────────────┘
 *
 * AdMob is NOT part of ModuleHeader — it is rendered as a fixed
 * element above the reorderable blocks in ModuleScreenLayout.
 * This ensures AdMob stays at the top regardless of layout order.
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
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { HapticTouchable } from './HapticTouchable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { MediaIndicator } from './MediaIndicator';
import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useAccentColor } from '@/hooks/useAccentColor';
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
  /** Show back button (for detail screens) */
  showBackButton?: boolean;
  /** Callback when back button is pressed */
  onBackPress?: () => void;
  /** Custom icon for the back button (default: "chevron-left") */
  backIcon?: IconName;
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
  /**
   * Skip the internal Safe Area spacer (default: false).
   * Set to true when ModuleHeader is used inside ModuleScreenLayout,
   * which renders its own Safe Area spacer above the reorderable blocks.
   */
  skipSafeArea?: boolean;

  // ── Form Mode (Header Action Bar) ──────────────────────────
  // When formMode is true, the header replaces icon+title with
  // [Annuleer] (left) and [Opslaan] (right) action buttons.
  // Follows iOS edit-mode pattern (Contacts, Calendar, Notes).

  /** Enable form mode — replaces icon+title with Cancel/Save buttons */
  formMode?: boolean;
  /** Callback when Cancel button is pressed */
  onCancel?: () => void;
  /** Callback when Save button is pressed */
  onSave?: () => void;
  /** Disable the Save button (e.g. form not valid) */
  saveDisabled?: boolean;
  /** Optional accessory rendered in the right side of the header (before MediaIndicator) */
  rightAccessory?: React.ReactNode;
}

// ============================================================
// Component
// ============================================================

export function ModuleHeader({
  moduleId,
  icon,
  title,
  currentSource,
  showBackButton = false,
  onBackPress,
  backIcon = 'chevron-left',
  backButtonLabel = 'Terug',
  customLogo,
  style,
  showGridButton = true,
  skipSafeArea = false,
  formMode = false,
  onCancel,
  onSave,
  saveDisabled = false,
  rightAccessory,
}: ModuleHeaderProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Use module color from context (respects user customization)
  const moduleColor = useModuleColor(moduleId as ModuleColorId);
  // Accent color for Save button
  const { accentColor } = useAccentColor();

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
      {/* Safe Area Spacer — skipped when inside ModuleScreenLayout */}
      {!skipSafeArea && <View style={{ height: insets.top }} />}

      {/* Title Row — switches between normal mode and form mode */}
      {formMode ? (
        // ── Form Mode: [Annuleer] ... [Opslaan] ──
        <View style={styles.titleRow}>
          {/* Left: Cancel button */}
          <HapticTouchable
            hapticDisabled
            style={[
              styles.formCancelButton,
              buttonStyle?.settings.borderEnabled && {
                borderWidth: 2,
                borderColor: buttonStyle.getBorderColorHex(),
              },
            ]}
            onPress={() => {
              void triggerFeedback('tap');
              onCancel?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={styles.formCancelText}>{t('common.cancel')}</Text>
          </HapticTouchable>

          {/* Right: Save button */}
          <HapticTouchable
            hapticDisabled
            style={[
              styles.formSaveButton,
              { backgroundColor: accentColor.primary },
              saveDisabled && styles.formSaveButtonDisabled,
              buttonStyle?.settings.borderEnabled && {
                borderWidth: 2,
                borderColor: buttonStyle.getBorderColorHex(),
              },
            ]}
            onPress={() => {
              if (!saveDisabled) {
                void triggerFeedback('success');
                onSave?.();
              }
            }}
            disabled={saveDisabled}
            accessibilityRole="button"
            accessibilityLabel={t('common.save')}
            accessibilityState={{ disabled: saveDisabled }}
          >
            <Icon name="checkbox-checked" size={20} color={colors.textOnPrimary} />
            <Text style={styles.formSaveText}>{t('common.save')}</Text>
          </HapticTouchable>
        </View>
      ) : (
        // ── Normal Mode: Icon + Title + MediaIndicator + Grid ──
        <View style={styles.titleRow}>
          {/* Left: Back button (optional) + Icon (decorative) + Title */}
          <View style={styles.titleContent}>
            {showBackButton && onBackPress && (
              <HapticTouchable
                hapticDisabled
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
                <Icon name={backIcon} size={28} color={colors.textOnPrimary} />
              </HapticTouchable>
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

          {/* Right: rightAccessory + MediaIndicator + Grid button */}
          <View style={styles.rightControls}>
            {rightAccessory}
            <View style={styles.mediaIndicatorWrapper}>
              <MediaIndicator
                moduleColor={moduleColor}
                currentSource={currentSource}
              />
            </View>
            {shouldShowGridButton && (
              <HapticTouchable
                hapticDisabled
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
              </HapticTouchable>
            )}
          </View>
        </View>
      )}

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
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',  // Subtle white line
  },

  // ── Form Mode Styles ──────────────────────────────────────
  formCancelButton: {
    height: touchTargets.minimum,          // 60pt
    paddingHorizontal: spacing.md,         // 16pt
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,         // 12pt
    justifyContent: 'center',
    alignItems: 'center',
  },
  formCancelText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  formSaveButton: {
    height: touchTargets.minimum,          // 60pt
    paddingHorizontal: spacing.lg,         // 24pt
    borderRadius: borderRadius.md,         // 12pt
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,                       // 4pt between icon and text
  },
  formSaveButtonDisabled: {
    opacity: 0.4,
  },
  formSaveText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
});

export default ModuleHeader;
