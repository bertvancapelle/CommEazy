/**
 * ModuleScreenLayout — Renders module screen blocks in configurable order
 *
 * Uses ModuleLayoutContext to determine the order of:
 * 1. "module" — Module icon + title area (spacer under overlaid header)
 * 2. "controls" — Tabs, ChipSelector, SearchBar
 * 3. "content" — Main scrollable content (list, grid, etc.)
 *
 * AdMob stays fixed at the top (within the overlay ModuleHeader).
 *
 * The overlay architecture means the ModuleHeader is always rendered
 * in the overlay layer. The "module" block here is a spacer View that
 * provides clearance under the overlaid header. When the layout is
 * reordered, the spacer moves with the module block.
 *
 * Usage:
 * ```tsx
 * <View style={styles.contentLayer}>
 *   <ModuleScreenLayout
 *     headerPadding={contentPaddingTop}
 *     controlsBlock={<View>tabs + chips + search</View>}
 *     contentBlock={<ScrollView>station list</ScrollView>}
 *   />
 * </View>
 * ```
 *
 * @see src/contexts/ModuleLayoutContext.tsx
 * @see src/screens/settings/AppearanceSettingsScreen.tsx
 */

import React, { type ReactNode } from 'react';
import { View } from 'react-native';
import { useModuleLayoutSafe, type LayoutBlock } from '@/contexts/ModuleLayoutContext';

interface ModuleScreenLayoutProps {
  /** Padding for header clearance (space under the overlaid ModuleHeader) */
  headerPadding: number;
  /** Controls block (tabs, chips, search) */
  controlsBlock: ReactNode;
  /** Main content block (scrollable list/grid) */
  contentBlock: ReactNode;
}

/**
 * Renders module screen blocks in the user's configured order.
 *
 * The "module" block is rendered as an empty spacer that provides
 * clearance under the overlaid ModuleHeader. When the user reorders
 * blocks, this spacer moves accordingly.
 *
 * Uses useModuleLayoutSafe (graceful fallback) so it works
 * even if rendered outside of ModuleLayoutProvider.
 */
export function ModuleScreenLayout({
  headerPadding,
  controlsBlock,
  contentBlock,
}: ModuleScreenLayoutProps) {
  const { layoutOrder } = useModuleLayoutSafe();

  const blockMap: Record<LayoutBlock, ReactNode> = {
    module: <View style={{ height: headerPadding }} />,
    controls: controlsBlock,
    content: contentBlock,
  };

  return (
    <>
      {layoutOrder.map((block) => (
        <React.Fragment key={block}>
          {blockMap[block]}
        </React.Fragment>
      ))}
    </>
  );
}
