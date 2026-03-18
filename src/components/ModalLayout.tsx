/**
 * ModalLayout — Consistent layout for modal header, content, and footer
 *
 * Respects the user's "Schermindeling" (toolbar position) setting:
 * - "top" (default): Header → Content → Footer
 * - "bottom": Content → Footer → Header
 *
 * This matches ModuleScreenLayout behavior so that modals opened from
 * a bottom-toolbar screen keep controls near the same edge. The user's
 * muscle memory is preserved: action buttons stay where they expect them.
 *
 * Uses useModuleLayoutSafe (graceful fallback) so it works even outside
 * ModuleLayoutProvider.
 *
 * @see src/components/ModuleScreenLayout.tsx — screen-level reordering
 * @see src/contexts/ModuleLayoutContext.tsx — toolbar position setting
 */

import React, { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
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
// Component
// ============================================================

export function ModalLayout({
  headerBlock,
  contentBlock,
  footerBlock,
}: ModalLayoutProps) {
  const { toolbarPosition } = useModuleLayoutSafe();
  const isBottom = toolbarPosition === 'bottom';

  if (isBottom) {
    // Bottom layout: Content → Footer → Header
    // Header (title + action buttons) moves to the bottom of the modal
    // so action buttons stay near the user's thumb zone.
    return (
      <View style={styles.flex}>
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
});
