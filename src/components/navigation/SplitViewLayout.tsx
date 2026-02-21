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
import { ModulePickerModal } from './ModulePickerModal';
import { DraggableDivider } from './DraggableDivider';
import { colors } from '@/theme';

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
    activePickerPanel,
    closeModulePicker,
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

      {/* Module Picker Modal (shown when long-pressing a panel) */}
      {activePickerPanel !== null && (
        <ModulePickerModal
          targetPanel={activePickerPanel}
          onClose={closeModulePicker}
        />
      )}
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
