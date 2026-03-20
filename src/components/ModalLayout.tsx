/**
 * ModalLayout — Consistent layout for modal header, content, and footer
 *
 * Respects the user's "Schermindeling" (toolbar position) setting:
 * - "top" (default): Header → Content → Footer
 * - "bottom": Content → Footer → Header
 *
 * TWO levels of reordering at "bottom":
 * 1. Block-level (automatic): headerBlock moves below contentBlock/footerBlock
 * 2. Children-level (consumer responsibility): headerBlock Views with multiple
 *    vertical children MUST use useModalLayoutBottom() to reverse their order.
 *
 * This matches ModuleScreenLayout behavior so that modals opened from
 * a bottom-toolbar screen keep controls near the same edge. The user's
 * muscle memory is preserved: action buttons stay where they expect them.
 *
 * Uses useModuleLayoutSafe (graceful fallback) so it works even outside
 * ModuleLayoutProvider.
 *
 * ⚠️ VERPLICHT: Elke headerBlock met meerdere verticale children MOET
 * useModalLayoutBottom() gebruiken om flexDirection om te draaien bij
 * toolbar positie "bottom". Zie Consistency Safeguard in CLAUDE.md.
 *
 * @see src/components/ModuleScreenLayout.tsx — screen-level reordering
 * @see src/contexts/ModuleLayoutContext.tsx — toolbar position setting
 */

import React, { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModuleLayoutSafe } from '@/contexts/ModuleLayoutContext';

// ============================================================
// Types
// ============================================================

export interface ModalLayoutProps {
  /** Header block — typically contains title + action buttons */
  headerBlock: ReactNode;
  /** Main content block — scrollable content */
  contentBlock: ReactNode;
  /** Optional footer block — bottom action buttons (e.g., Save, Confirm) */
  footerBlock?: ReactNode;
}

// ============================================================
// Hook: useModalLayoutBottom
// ============================================================

/**
 * Hook for headerBlock consumers with multiple vertical children.
 *
 * Returns `isBottom` boolean and a `headerStyle` object that reverses
 * flexDirection when toolbar is at bottom. Apply this style to your
 * headerBlock's root View to automatically reverse the order of vertical
 * children (safe area spacer, controls, search bar, etc.).
 *
 * For headerBlocks with a single horizontal row (title + button),
 * this hook is not needed — the row stays the same at both positions.
 *
 * @example
 * const { isBottom, headerStyle } = useModalLayoutBottom();
 *
 * <ModalLayout
 *   headerBlock={
 *     <View style={[styles.searchSection, headerStyle]}>
 *       <View style={{ height: isBottom ? 4 : insets.top }} />
 *       <ChipSelector ... />
 *       <SearchBar ... />
 *     </View>
 *   }
 *   ...
 * />
 */
export function useModalLayoutBottom() {
  const { toolbarPosition } = useModuleLayoutSafe();
  const isBottom = toolbarPosition === 'bottom';

  return {
    isBottom,
    /** Apply to headerBlock root View to reverse children at bottom */
    headerStyle: isBottom ? styles.columnReverse : undefined,
  };
}

// ============================================================
// Component
// ============================================================

export function ModalLayout({
  headerBlock,
  contentBlock,
  footerBlock,
}: ModalLayoutProps) {
  const { toolbarPosition } = useModuleLayoutSafe();
  const insets = useSafeAreaInsets();
  const isBottom = toolbarPosition === 'bottom';

  if (isBottom) {
    // Bottom layout: Safe Area Spacer → Content → Footer → Header
    // Header (title + action buttons) moves to the bottom of the modal
    // so action buttons stay near the user's thumb zone.
    // The safe area spacer protects the top edge (Dynamic Island / notch)
    // because the headerBlock (which normally contains it) is now at the bottom.
    return (
      <View style={styles.flex}>
        <View style={{ height: insets.top }} />
        {contentBlock}
        {footerBlock}
        {headerBlock}
      </View>
    );
  }

  // Top layout (default): Header → Content → Footer
  return (
    <View style={styles.flex}>
      {headerBlock}
      {contentBlock}
      {footerBlock}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  columnReverse: {
    flexDirection: 'column-reverse',
  },
});
