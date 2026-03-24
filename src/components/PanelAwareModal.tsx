/**
 * PanelAwareModal — Modal replacement for iPad Split View
 *
 * On iPhone (single-pane): renders a standard React Native Modal (full-screen).
 * On iPad Split View: renders as an absolutely-positioned View that stays
 * within the panel boundaries (Modal always escapes to full-screen).
 *
 * Drop-in replacement for <Modal> — same props interface.
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, { type ReactNode } from 'react';
import { View, Modal, StyleSheet } from 'react-native';

import { usePanelId } from '@/contexts/PanelIdContext';
import type { ModuleColorId } from '@/types/liquidGlass';

// ============================================================
// Types
// ============================================================

export interface PanelAwareModalProps {
  /** Is the modal visible */
  visible: boolean;
  /** Modal animation type (only used on iPhone) */
  animationType?: 'none' | 'slide' | 'fade';
  /** Transparent background (only used on iPhone) */
  transparent?: boolean;
  /** Called when Android back button or iOS swipe-down is pressed */
  onRequestClose?: () => void;
  /** Module color ID for Liquid Glass tint (passed through to children) */
  moduleId?: ModuleColorId;
  /** Modal presentation style (only used on iPhone) */
  presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
  /** Supported orientations (only used on iPhone) */
  supportedOrientations?: Array<'portrait' | 'portrait-upside-down' | 'landscape' | 'landscape-left' | 'landscape-right'>;
  /** Children to render inside the modal */
  children: ReactNode;
}

// ============================================================
// Component
// ============================================================

export function PanelAwareModal({
  visible,
  animationType = 'slide',
  transparent = true,
  onRequestClose,
  moduleId: _moduleId,
  presentationStyle,
  supportedOrientations,
  children,
}: PanelAwareModalProps) {
  const panelId = usePanelId();

  if (!visible) return null;

  // iPad Split View: render as panel-scoped absolute overlay
  // On iPhone panelId is 'main' — must use native Modal for proper pageSheet/transparent support
  if (panelId !== null && panelId !== 'main') {
    return (
      <View style={styles.panelOverlay} pointerEvents="box-none">
        {children}
      </View>
    );
  }

  // iOS ignores presentationStyle when transparent=true — force false for sheet styles
  const effectiveTransparent = presentationStyle ? false : transparent;

  // iPhone: render as standard full-screen Modal
  return (
    <Modal
      visible={true}
      transparent={effectiveTransparent}
      animationType={animationType}
      onRequestClose={onRequestClose}
      presentationStyle={presentationStyle}
      supportedOrientations={supportedOrientations}
      accessibilityViewIsModal={true}
    >
      {children}
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  panelOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    // Stays within panel boundaries because SplitViewLayout panel
    // has overflow: 'hidden' and fixed width
  },
});
