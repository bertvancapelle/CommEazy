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
 * Toolbar position (user's "Schermindeling" setting):
 * - "top" (default): ModuleHeader → Controls → Content
 * - "bottom": Content → Controls (reversed rows) → ModuleHeader
 *
 * When toolbar is at bottom, the controls children are rendered in
 * reverse order so that rows closest to the header stay adjacent.
 *
 * When using ModuleScreenLayout, pass `skipSafeArea` to ModuleHeader
 * to avoid double Safe Area spacing.
 *
 * @see src/contexts/ModuleLayoutContext.tsx
 * @see src/screens/settings/AppearanceSettingsScreen.tsx
 */

import React, { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
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

      {isBottom ? (
        <>
          {/* Bottom layout: Content → Controls (reversed) → ModuleHeader */}
          {contentBlock}
          {reverseChildren(controlsBlock)}
          {moduleBlock}
        </>
      ) : (
        <>
          {/* Top layout (default): ModuleHeader → Controls → Content */}
          {moduleBlock}
          {controlsBlock}
          {contentBlock}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  adMobRow: {
    paddingHorizontal: spacing.sm,
    paddingTop: 0,
    paddingBottom: 0,
  },
});
