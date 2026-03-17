/**
 * ModalLayout — Positions modal header above or below content
 *
 * Reads the user's "Schermindeling" (toolbar position) setting from
 * ModuleLayoutContext and rearranges the modal layout accordingly:
 *
 * - "top" (default): Header → Content → Footer
 * - "bottom": Footer → Content → Header
 *
 * This ensures modals follow the same toolbar position as module screens,
 * providing a consistent experience for seniors.
 *
 * Exception: UnifiedFullPlayer is excluded — it keeps its own layout.
 *
 * @see src/contexts/ModuleLayoutContext.tsx
 * @see src/components/ModuleScreenLayout.tsx
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
    return (
      <View style={styles.flex}>
        {footerBlock}
        {contentBlock}
        {headerBlock}
      </View>
    );
  }

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
