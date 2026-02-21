/**
 * SplitViewLayout — iPad Split View container
 *
 * Renders two module panels side-by-side with configurable ratio.
 * Each panel can display any module independently.
 * Users can drag the divider to resize panels.
 *
 * Layout:
 * ┌──────────────────┬────────────────────────────────┐
 * │   LEFT PANEL     │        RIGHT PANEL             │
 * │     (33%)        │          (67%)                 │
 * │                  │  ┃                             │
 * │  [Module]        │ <┃> Draggable Divider          │
 * │                  │  ┃                             │
 * └──────────────────┴────────────────────────────────┘
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

import { useSplitViewContext } from '@/contexts/SplitViewContext';
import { ModulePanel } from './ModulePanel';
import { DraggableDivider } from './DraggableDivider';
import { colors } from '@/theme';
// Note: ModulePickerModal removed — WheelNavigationMenu is now used for consistent UX

// ============================================================
// Component
// ============================================================

export function SplitViewLayout() {
  const { width: screenWidth } = useWindowDimensions();
  const {
    leftPanel,
    rightPanel,
    panelRatio,
    setPanelRatio,
  } = useSplitViewContext();

  // Calculate panel widths (DraggableDivider handles its own touch area)
  const leftWidth = screenWidth * panelRatio;
  const rightWidth = screenWidth * (1 - panelRatio);

  return (
    <View style={styles.container}>
      {/* Left Panel */}
      <View style={[styles.panel, { width: leftWidth }]}>
        <ModulePanel
          panelId="left"
          moduleId={leftPanel.moduleId}
        />
      </View>

      {/* Draggable Divider */}
      <DraggableDivider
        ratio={panelRatio}
        onRatioChange={setPanelRatio}
      />

      {/* Right Panel */}
      <View style={[styles.panel, { width: rightWidth }]}>
        <ModulePanel
          panelId="right"
          moduleId={rightPanel.moduleId}
        />
      </View>

      {/* Note: WheelNavigationMenu is now rendered inside each ModulePanel
          for consistent UX with iPhone (long-press opens wheel, not list modal) */}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  panel: {
    flex: 0,
    height: '100%',
    overflow: 'hidden',
  },
});

export default SplitViewLayout;
