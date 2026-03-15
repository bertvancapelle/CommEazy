/**
 * ModuleScreenLayout — Renders module screen blocks with configurable toolbar position
 *
 * Fixed-at-top elements (not affected by position setting):
 * - Safe Area spacer (notch/Dynamic Island)
 * - AdMob banner (optional)
 *
 * Toolbar (coupled pair):
 * - ModuleHeader (icon + title + separator)
 * - Controls (tabs, ChipSelector, SearchBar)
 *
 * Content:
 * - Main scrollable content (list, grid, etc.)
 *
 * Separator:
 * - Colored line (4pt, module color) between toolbar and content
 *
 * Controls background tint:
 * - When controlsBlock has content: 10% opacity module color background
 * - When controlsBlock is empty (<></>): no background rendered
 *
 * Toolbar position (user's "Schermindeling" setting):
 * - "top" (default): ModuleHeader → Controls → [separator] → Content
 * - "bottom": Content → [separator] → Controls (reversed rows) → ModuleHeader
 *
 * When toolbar is at bottom, the controls children are rendered in
 * reverse order so that rows closest to the header stay adjacent.
 *
 * Keyboard avoidance (bottom layout only):
 * - When toolbar is at bottom, the entire bottom section (controls +
 *   header) is wrapped in KeyboardAvoidingView so the toolbar slides
 *   above the keyboard when a SearchBar in controlsBlock is focused.
 *
 * When using ModuleScreenLayout, pass `skipSafeArea` to ModuleHeader
 * to avoid double Safe Area spacing.
 *
 * @see src/contexts/ModuleLayoutContext.tsx
 * @see src/screens/settings/AppearanceSettingsScreen.tsx
 */

import React, { type ReactNode } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdMobBanner } from './AdMobBanner';
import { spacing } from '@/theme';
import { useModuleLayoutSafe } from '@/contexts/ModuleLayoutContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import type { ModuleColorId } from '@/types/liquidGlass';

interface ModuleScreenLayoutProps {
  /** Module identifier for Safe Area + AdMob background color */
  moduleId: string;
  /** Module block — typically the ModuleHeader component */
  moduleBlock: ReactNode;
  /** Controls block (tabs, chips, search) */
  controlsBlock: ReactNode;
  /** Main content block (scrollable list/grid) */
  contentBlock: ReactNode;
  /** Show AdMob banner fixed at top (default: true) */
  showAdMob?: boolean;
  /** AdMob unit ID (optional, uses default if not provided) */
  adMobUnitId?: string;
}

/**
 * Converts a hex color string to an rgba() string with given opacity.
 * Handles both 3-digit (#RGB) and 6-digit (#RRGGBB) hex values.
 */
function hexToRgba(hex: string, opacity: number): string {
  const cleaned = hex.replace('#', '');
  const fullHex =
    cleaned.length === 3
      ? cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2]
      : cleaned;
  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Returns true when a ReactNode has renderable children.
 * Empty fragments (<></>) return 0 children.
 */
function hasChildren(node: ReactNode): boolean {
  return React.Children.count(node) > 0;
}

/**
 * Reverses the top-level children of a ReactNode fragment.
 *
 * When controlsBlock is a fragment like:
 *   <>{row1}{row2}{row3}</>
 * this returns the children in reverse order: row3, row2, row1.
 *
 * This ensures that when the toolbar is at the bottom, controls rows
 * closest to the header stay closest to the header.
 */
function reverseChildren(node: ReactNode): ReactNode {
  const children = React.Children.toArray(node);
  if (children.length <= 1) return node;
  return <>{children.reverse()}</>;
}

/**
 * Renders module screen blocks with toolbar positioned above or below content.
 *
 * Fixed at top: Safe Area spacer + AdMob banner.
 * Toolbar (module header + controls) sits above or below the content
 * based on the user's "Schermindeling" setting.
 *
 * Uses useModuleLayoutSafe (graceful fallback) so it works
 * even if rendered outside of ModuleLayoutProvider.
 */
export function ModuleScreenLayout({
  moduleId,
  moduleBlock,
  controlsBlock,
  contentBlock,
  showAdMob = true,
  adMobUnitId,
}: ModuleScreenLayoutProps) {
  const { toolbarPosition } = useModuleLayoutSafe();
  const insets = useSafeAreaInsets();
  const moduleColor = useModuleColor(moduleId as ModuleColorId);

  const isBottom = toolbarPosition === 'bottom';
  const controlsHasContent = hasChildren(controlsBlock);
  const controlsBg = controlsHasContent
    ? { backgroundColor: hexToRgba(moduleColor, 0.10) }
    : undefined;

  return (
    <>
      {/* Safe Area Spacer — FIXED at top, module color background */}
      <View style={{ height: insets.top, backgroundColor: moduleColor }} />

      {/* AdMob — FIXED below safe area, module color background */}
      {showAdMob && (
        <View style={[styles.adMobRow, { backgroundColor: moduleColor }]}>
          <AdMobBanner unitId={adMobUnitId} size="banner" />
        </View>
      )}

      {/* Separator below AdMob / Safe Area — always visible */}
      <View style={[styles.separator, { backgroundColor: moduleColor }]} />

      {isBottom ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Bottom layout: Content → Separator → Controls (reversed) → ModuleHeader */}
          {contentBlock}
          <View style={[styles.separator, { backgroundColor: moduleColor }]} />
          {controlsHasContent ? (
            <View style={controlsBg}>
              {reverseChildren(controlsBlock)}
            </View>
          ) : (
            reverseChildren(controlsBlock)
          )}
          {moduleBlock}
        </KeyboardAvoidingView>
      ) : (
        <>
          {/* Top layout (default): ModuleHeader → Controls → Separator → Content */}
          {moduleBlock}
          {controlsHasContent ? (
            <View style={controlsBg}>
              {controlsBlock}
            </View>
          ) : (
            controlsBlock
          )}
          <View style={[styles.separator, { backgroundColor: moduleColor }]} />
          {contentBlock}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  adMobRow: {
    paddingHorizontal: spacing.sm,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: -2,
  },
  separator: {
    height: 4,
  },
});
