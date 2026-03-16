/**
 * ScrollViewWithIndicator — Drop-in ScrollView replacement with overflow indicator
 *
 * Wraps a standard ScrollView with:
 * - Automatic overflow detection (content taller than viewport?)
 * - Bouncing chevron-up indicator when content extends above (after scrolling down)
 * - Bouncing chevron-down indicator when content extends below
 * - Indicators disappear once user reaches the respective edge
 * - Tapping an indicator scrolls by ~80% of the viewport in that direction
 * - Dynamic bottom offset above MiniPlayer when audio is playing
 * - Respects Reduced Motion system preference
 *
 * Usage: Replace `<ScrollView>` with `<ScrollViewWithIndicator>` — same props.
 * Supports ref forwarding for voice focus and other external refs.
 *
 * @example
 * import { ScrollViewWithIndicator } from '@/components';
 *
 * <ScrollViewWithIndicator style={{ flex: 1 }}>
 *   {longContent}
 * </ScrollViewWithIndicator>
 *
 * @example
 * // With external ref (e.g. for voice focus)
 * const scrollRef = useRef<ScrollView>(null);
 * <ScrollViewWithIndicator ref={scrollRef} style={{ flex: 1 }}>
 *   {longContent}
 * </ScrollViewWithIndicator>
 */

import React, { forwardRef, useCallback, useRef } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  type ScrollViewProps,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { ScrollMoreIndicator } from './ScrollMoreIndicator';
import { useScrollOverflow } from '@/hooks/useScrollOverflow';

export interface ScrollViewWithIndicatorProps extends ScrollViewProps {
  /** Additional bottom offset for the indicator (e.g. for custom bottom bars) */
  indicatorBottomOffset?: number;
  /** Disable the scroll indicator (default: false) */
  indicatorDisabled?: boolean;
}

export const ScrollViewWithIndicator = forwardRef<
  ScrollView,
  ScrollViewWithIndicatorProps
>(function ScrollViewWithIndicator(
  {
    children,
    onScroll,
    onContentSizeChange,
    onLayout,
    indicatorBottomOffset = 0,
    indicatorDisabled = false,
    ...rest
  },
  forwardedRef,
) {
  // Internal ref used when no external ref is provided
  const internalRef = useRef<ScrollView>(null);
  const effectiveRef = (forwardedRef || internalRef) as React.RefObject<ScrollView>;

  // Pass the effective ref so scrollDownByViewport can use it
  const overflow = useScrollOverflow(effectiveRef);

  // Merge external onScroll with our tracking
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      overflow.onScroll(event);
      onScroll?.(event);
    },
    [overflow.onScroll, onScroll],
  );

  // Merge external onContentSizeChange with our tracking
  const handleContentSizeChange = useCallback(
    (w: number, h: number) => {
      overflow.onContentSizeChange(w, h);
      onContentSizeChange?.(w, h);
    },
    [overflow.onContentSizeChange, onContentSizeChange],
  );

  // Merge external onLayout with our tracking
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      overflow.onLayout(event);
      onLayout?.(event);
    },
    [overflow.onLayout, onLayout],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        ref={effectiveRef}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        scrollEventThrottle={16}
        {...rest}
      >
        {children}
      </ScrollView>
      {!indicatorDisabled && (
        <>
          <ScrollMoreIndicator
            visible={overflow.hasOverflow && !overflow.isAtTop}
            onPress={overflow.scrollUpByViewport}
            direction="up"
          />
          <ScrollMoreIndicator
            visible={overflow.hasOverflow && !overflow.isAtBottom}
            onPress={overflow.scrollDownByViewport}
            direction="down"
            extraBottomOffset={indicatorBottomOffset}
          />
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
