/**
 * SplitViewLayout — iPad Split View container
 *
 * Renders two module panels side-by-side with configurable ratio.
 * Each panel can display any module independently.
 * Users can drag the divider to resize panels.
 *
 * Collapsible panes:
 * - Ratio 0.0: Left pane collapsed (right pane = 100%)
 * - Ratio 1.0: Right pane collapsed (left pane = 100%)
 * - Divider remains visible with arrow indicator to restore
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
 * @see .claude/plans/COLLAPSIBLE_PANES_IPAD.md
 */

import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

import { usePaneContext } from '@/contexts/PaneContext';
import { ModulePanel } from './ModulePanel';
import { DraggableDivider } from './DraggableDivider';
import { CollapsedPaneIndicator } from './CollapsedPaneIndicator';
import { colors } from '@/theme';

// ============================================================
// Component
// ============================================================

export function SplitViewLayout() {
  const { width: screenWidth } = useWindowDimensions();
  const {
    panes,
    panelRatio,
    setPanelRatio,
    isLeftCollapsed,
    isRightCollapsed,
  } = usePaneContext();

  const leftPane = panes.left;
  const rightPane = panes.right;

  // Indicator width when collapsed
  const INDICATOR_WIDTH = 28;

  // Calculate panel widths
  // When a pane is collapsed, the other pane takes full width MINUS the indicator width
  const leftWidth = isLeftCollapsed
    ? 0
    : isRightCollapsed
      ? screenWidth - INDICATOR_WIDTH  // Full width minus right indicator
      : screenWidth * panelRatio;

  const rightWidth = isRightCollapsed
    ? 0
    : isLeftCollapsed
      ? screenWidth - INDICATOR_WIDTH  // Full width minus left indicator
      : screenWidth * (1 - panelRatio);

  if (!leftPane || !rightPane) return null;

  return (
    <View style={styles.container}>
      {/* Left Collapsed Indicator — shows when left pane is hidden */}
      {isLeftCollapsed && (
        <CollapsedPaneIndicator
          side="left"
          moduleId={leftPane.moduleId}
        />
      )}

      {/* Left Panel — hidden when collapsed (ratio = 0) */}
      {!isLeftCollapsed && (
        <View style={[styles.panel, { width: leftWidth }]}>
          <ModulePanel
            panelId="left"
            moduleId={leftPane.moduleId}
          />
        </View>
      )}

      {/* Draggable Divider — only visible when BOTH panes are visible */}
      {!isLeftCollapsed && !isRightCollapsed && (
        <DraggableDivider
          ratio={panelRatio}
          onRatioChange={setPanelRatio}
        />
      )}

      {/* Right Panel — hidden when collapsed (ratio = 1) */}
      {!isRightCollapsed && (
        <View style={[styles.panel, { width: rightWidth }]}>
          <ModulePanel
            panelId="right"
            moduleId={rightPane.moduleId}
          />
        </View>
      )}

      {/* Right Collapsed Indicator — shows when right pane is hidden */}
      {isRightCollapsed && (
        <CollapsedPaneIndicator
          side="right"
          moduleId={rightPane.moduleId}
        />
      )}

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
