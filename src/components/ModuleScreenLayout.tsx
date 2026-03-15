/**
 * ModuleScreenLayout — Renders module screen blocks in configurable order
 *
 * Fixed-at-top elements (not reorderable):
 * - Safe Area spacer (notch/Dynamic Island)
 * - AdMob banner (optional)
 *
 * Reorderable blocks (user's "Schermindeling" setting):
 * 1. "module" — ModuleHeader (icon + title + separator)
 * 2. "controls" — Tabs, ChipSelector, SearchBar
 * 3. "content" — Main scrollable content (list, grid, etc.)
 *
 * When using ModuleScreenLayout, pass `skipSafeArea` to ModuleHeader
 * to avoid double Safe Area spacing.
 *
 * Usage:
 * ```tsx
 * <ModuleScreenLayout
 *   showAdMob={true}
 *   moduleBlock={
 *     <ModuleHeader moduleId="radio" icon="radio" title={t('...')} skipSafeArea />
 *   }
 *   controlsBlock={<View>tabs + chips + search</View>}
 *   contentBlock={<ScrollView>station list</ScrollView>}
 * />
 * ```
 *
 * @see src/contexts/ModuleLayoutContext.tsx
 * @see src/screens/settings/AppearanceSettingsScreen.tsx
 */

import React, { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdMobBanner } from './AdMobBanner';
import { spacing } from '@/theme';
import { useModuleLayoutSafe, type LayoutBlock } from '@/contexts/ModuleLayoutContext';

interface ModuleScreenLayoutProps {
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
 * Renders module screen blocks in the user's configured order.
 *
 * Fixed at top: Safe Area spacer + AdMob banner.
 * The three blocks (module, controls, content) are reorderable
 * based on the user's "Schermindeling" setting.
 *
 * Uses useModuleLayoutSafe (graceful fallback) so it works
 * even if rendered outside of ModuleLayoutProvider.
 */
export function ModuleScreenLayout({
  moduleBlock,
  controlsBlock,
  contentBlock,
  showAdMob = true,
  adMobUnitId,
}: ModuleScreenLayoutProps) {
  const { layoutOrder } = useModuleLayoutSafe();
  const insets = useSafeAreaInsets();

  const blockMap: Record<LayoutBlock, ReactNode> = {
    module: moduleBlock,
    controls: controlsBlock,
    content: contentBlock,
  };

  return (
    <>
      {/* Safe Area Spacer — FIXED at top, not reorderable */}
      <View style={{ height: insets.top }} />

      {/* AdMob — FIXED below safe area, not reorderable */}
      {showAdMob && (
        <View style={styles.adMobRow}>
          <AdMobBanner unitId={adMobUnitId} size="banner" />
        </View>
      )}

      {/* Reorderable blocks */}
      {layoutOrder.map((block) => (
        <React.Fragment key={block}>
          {blockMap[block]}
        </React.Fragment>
      ))}
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
