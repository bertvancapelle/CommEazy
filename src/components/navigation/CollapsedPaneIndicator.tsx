/**
 * CollapsedPaneIndicator — Visual indicator for collapsed panes on iPad
 *
 * When a pane is collapsed (dragged off-screen), this component shows a
 * vertical bar at the screen edge with an arrow indicating a hidden pane.
 *
 * Design considerations:
 * - Full height vertical bar (24pt wide) at screen edge
 * - Large arrow pointing toward the hidden pane
 * - Colored with the hidden pane's module accent color
 * - Tappable to restore the collapsed pane
 * - Senior-inclusive: large touch target, clear visual indicator
 *
 * @see .claude/plans/COLLAPSIBLE_PANES_IPAD.md
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { usePaneContext } from '@/contexts/PaneContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { colors } from '@/theme';

// ============================================================
// Constants
// ============================================================

/** Width of the collapsed indicator bar */
const INDICATOR_WIDTH = 28;

/** Size of the arrow icon */
const ARROW_SIZE = 28;

// ============================================================
// Types
// ============================================================

export interface CollapsedPaneIndicatorProps {
  /** Which side the indicator is on */
  side: 'left' | 'right';
  /** Module ID of the collapsed pane (for color) */
  moduleId: string;
}

// ============================================================
// Component
// ============================================================

export function CollapsedPaneIndicator({ side, moduleId }: CollapsedPaneIndicatorProps) {
  const { openCollapsedPane } = usePaneContext();
  const moduleColor = useModuleColor(moduleId as any);

  const handlePress = () => {
    // Haptic feedback
    if (Platform.OS === 'ios') {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    // Open the collapsed pane
    openCollapsedPane(side);
  };

  // Arrow direction: points TOWARD the hidden pane
  // - Left collapsed: indicator at LEFT edge, arrow points LEFT (◀) to show "pane is here"
  // - Right collapsed: indicator at RIGHT edge, arrow points RIGHT (▶) to show "pane is here"
  //
  // Actually, let's point AWAY from the edge to indicate "drag this way to restore"
  // - Left collapsed: indicator at LEFT edge, arrow points RIGHT (▶) meaning "drag right to restore"
  // - Right collapsed: indicator at RIGHT edge, arrow points LEFT (◀) meaning "drag left to restore"
  const arrowChar = side === 'left' ? '▶' : '◀';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        side === 'left' ? styles.containerLeft : styles.containerRight,
        { backgroundColor: moduleColor },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={
        side === 'left'
          ? 'Linker paneel is verborgen. Tik om te openen.'
          : 'Rechter paneel is verborgen. Tik om te openen.'
      }
      accessibilityHint="Dubbeltik om het verborgen paneel te openen"
    >
      <View style={styles.arrowContainer}>
        <Text style={styles.arrowText}>{arrowChar}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    width: INDICATOR_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
  },
  containerLeft: {
    // At the left edge of the screen
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  containerRight: {
    // At the right edge of the screen
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  arrowContainer: {
    width: INDICATOR_WIDTH,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: ARROW_SIZE,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default CollapsedPaneIndicator;
