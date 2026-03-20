/**
 * TabButtonRow — Synchronizes font size across tab buttons
 *
 * Algorithm:
 * 1. Split all labels into individual words
 * 2. Find the longest word (by character length)
 * 3. Render that word hidden at base font size (18pt)
 * 4. Measure its rendered width via onTextLayout
 * 5. Compare to available slot width (from onLayout)
 * 6. Calculate: syncedFontSize = baseFontSize × (slotWidth / textWidth)
 * 7. Pass syncedFontSize to children via render prop
 *
 * This ensures the longest word in ANY language always fits on one line,
 * and all buttons share the same font size for visual consistency.
 *
 * @see .claude/CLAUDE.md Section 14 (Component Registry)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LayoutChangeEvent, NativeSyntheticEvent, TextLayoutEventData } from 'react-native';

import { typography, spacing } from '@/theme';

// ============================================================
// Types
// ============================================================

export interface TabButtonRowProps {
  /** All button labels — used to find the longest word for font sizing */
  labels: string[];
  /** Render prop — receives the calculated synced font size */
  children: (syncedFontSize: number) => React.ReactNode;
}

// ============================================================
// Constants
// ============================================================

const BASE_FONT_SIZE = typography.body.fontSize ?? 18;
// Horizontal padding inside each button: paddingHorizontal = spacing.md (16pt) × 2
// Plus worst-case border: user-configurable borderWidth: 2 × 2 sides = 4pt
const BUTTON_HORIZONTAL_PADDING = spacing.md * 2 + 4;
// Gap between buttons in the row
const ROW_GAP = spacing.sm; // 8pt

// ============================================================
// TabButtonRow
// ============================================================

/**
 * Wrapper that measures the longest word across all labels and calculates
 * a synchronized font size that guarantees single-line word rendering.
 *
 * @example
 * <TabButtonRow labels={[t('recent'), t('favorites'), t('search')]}>
 *   {(syncedFontSize) => (
 *     <>
 *       <RecentTabButton syncedFontSize={syncedFontSize} ... />
 *       <FavoriteTabButton syncedFontSize={syncedFontSize} ... />
 *       <SearchTabButton syncedFontSize={syncedFontSize} ... />
 *     </>
 *   )}
 * </TabButtonRow>
 */
export function TabButtonRow({ labels, children }: TabButtonRowProps) {
  const [rowWidth, setRowWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const [ready, setReady] = useState(false);

  // Find the longest individual word across all labels
  const longestWord = useMemo(() => {
    let longest = '';
    for (const label of labels) {
      const words = label.split(/\s+/);
      for (const word of words) {
        if (word.length > longest.length) {
          longest = word;
        }
      }
    }
    return longest;
  }, [labels]);

  // Number of buttons = number of labels (each button gets equal width)
  const buttonCount = labels.length;

  // Available width per button slot (accounting for row gap between buttons)
  const slotWidth = rowWidth > 0
    ? (rowWidth - ROW_GAP * (buttonCount - 1)) / buttonCount - BUTTON_HORIZONTAL_PADDING
    : 0;

  // Calculate synced font size
  const syncedFontSize = useMemo(() => {
    if (slotWidth <= 0 || textWidth <= 0) return BASE_FONT_SIZE;
    if (textWidth <= slotWidth) return BASE_FONT_SIZE;
    // Scale down proportionally
    const scaled = BASE_FONT_SIZE * (slotWidth / textWidth);
    // Floor to avoid sub-pixel rendering issues, clamp to minimum readable size
    return Math.max(Math.floor(scaled), 12);
  }, [slotWidth, textWidth]);

  const handleRowLayout = useCallback((e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== rowWidth) {
      setRowWidth(width);
    }
  }, [rowWidth]);

  const handleTextLayout = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    const lines = e.nativeEvent.lines;
    if (lines.length > 0 && lines[0].width > 0) {
      const measuredWidth = lines[0].width;
      if (measuredWidth !== textWidth) {
        setTextWidth(measuredWidth);
        if (!ready) setReady(true);
      }
    }
  }, [textWidth, ready]);

  return (
    <View style={styles.container} onLayout={handleRowLayout}>
      {/* Hidden text for measuring the longest word's rendered width */}
      <Text
        style={styles.measurer}
        onTextLayout={handleTextLayout}
        numberOfLines={1}
      >
        {longestWord}
      </Text>

      {/* Render children with synced font size */}
      {/* Show immediately with BASE_FONT_SIZE, update when measurement completes */}
      <View style={styles.row}>
        {children(ready && rowWidth > 0 ? syncedFontSize : BASE_FONT_SIZE)}
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1, // Must fill parent width (parent tabBar has flexDirection: 'row')
  },
  row: {
    flexDirection: 'row',
    gap: ROW_GAP,
  },
  measurer: {
    // Hidden off-screen but rendered for measurement
    position: 'absolute',
    opacity: 0,
    // Must use same font properties as tab button text
    fontSize: BASE_FONT_SIZE,
    fontWeight: '600',
    // Prevent wrapping — we need the full single-line width
    // No maxWidth or width constraint — let it render freely
  },
});

export default TabButtonRow;
