/**
 * TabButtonRow — Wrapper that synchronizes font sizes across tab buttons
 *
 * Problem: When tab buttons use adjustsFontSizeToFit individually, each button
 * calculates its own font size based on its label length. This causes visual
 * inconsistency (e.g., "Recent" at 18pt vs "Favorieten" at 15pt).
 *
 * Solution: This wrapper extracts the longest word from each label, measures
 * them using hidden Text elements with adjustsFontSizeToFit, collects the
 * smallest calculated font size, and passes it to all child tab buttons.
 *
 * Why longest word? Multi-word labels ("Zoek Zenders") wrap to two lines,
 * so the font size only needs to fit the longest individual word on one line.
 * The determining word across all buttons sets the uniform font size.
 *
 * Icons always align to the top of each button for visual consistency.
 *
 * @see .claude/CLAUDE.md Section 14 (Component Registry)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeSyntheticEvent, TextLayoutEventData } from 'react-native';

import { typography, spacing } from '@/theme';

// ============================================================
// Types
// ============================================================

export interface TabButtonRowProps {
  /** Labels to measure (one per button, in order) */
  labels: string[];
  /** Render function that receives the synchronized font size */
  children: (syncedFontSize: number | undefined) => React.ReactNode;
}

// Base font size from typography.body
const BASE_FONT_SIZE = (typography.body as { fontSize: number }).fontSize; // 18

/** Extract the longest word from a label string */
function getLongestWord(label: string): string {
  const words = label.split(/\s+/);
  return words.reduce((longest, word) => word.length > longest.length ? word : longest, '');
}

// ============================================================
// TabButtonRow
// ============================================================

/**
 * Wrapper that synchronizes font sizes across tab buttons.
 *
 * Measures the longest word from each label in a hidden offscreen area,
 * then passes the minimum calculated font size to all children.
 *
 * @example
 * <TabButtonRow labels={[recentLabel, favoritesLabel, searchLabel]}>
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
  // Track measured font sizes per word index
  const [measuredSizes, setMeasuredSizes] = useState<Map<number, number>>(new Map());

  // Extract the longest word from each label for measurement
  const longestWords = useMemo(
    () => labels.map(getLongestWord),
    [labels],
  );

  const handleTextLayout = useCallback((index: number, event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const lines = event.nativeEvent.lines;
    if (lines.length > 0) {
      // When adjustsFontSizeToFit shrinks text, lines[0].ascender
      // approximates the calculated font size. We use this to determine
      // the minimum font size needed across all buttons.
      const measuredFontSize = lines[0]?.ascender != null
        ? Math.round(lines[0].ascender * 10) / 10
        : BASE_FONT_SIZE;

      setMeasuredSizes(prev => {
        const next = new Map(prev);
        next.set(index, measuredFontSize);
        return next;
      });
    }
  }, []);

  // Calculate the synced font size: minimum of all measured sizes
  // Only sync once all words have been measured
  const syncedFontSize = useMemo(() => {
    if (measuredSizes.size < longestWords.length) return undefined;
    const sizes = Array.from(measuredSizes.values());
    return Math.min(...sizes);
  }, [measuredSizes, longestWords.length]);

  return (
    <View style={styles.container}>
      {/* Hidden measuring area — offscreen, measures longest word per label */}
      <View style={styles.measuringContainer} pointerEvents="none">
        {longestWords.map((word, index) => (
          <View key={`measure-${index}`} style={styles.measuringSlot}>
            <Text
              style={styles.measuringText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              onTextLayout={(event) => handleTextLayout(index, event)}
            >
              {word}
            </Text>
          </View>
        ))}
      </View>

      {/* Visible buttons */}
      {children(syncedFontSize)}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    // No extra styling — takes parent's layout
  },
  // Hidden measuring container — positioned offscreen
  // Matches tabBar layout: marginHorizontal + gap so flex:1 slots
  // are the same width as actual tab buttons
  measuringContainer: {
    position: 'absolute',
    opacity: 0,
    flexDirection: 'row',
    left: spacing.md,     // Match tabBar marginHorizontal
    right: spacing.md,    // Match tabBar marginHorizontal
    top: -9999, // Offscreen
    gap: spacing.sm,      // Match tabBar gap
  },
  // Each measuring slot simulates the width of a tab button (flex: 1)
  measuringSlot: {
    flex: 1,
    paddingHorizontal: spacing.md, // Match tab button horizontal padding
  },
  // Measuring text matches tab button text style
  measuringText: {
    ...typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default TabButtonRow;
