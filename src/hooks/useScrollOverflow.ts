/**
 * useScrollOverflow — Detects whether a ScrollView has content that overflows
 *
 * Tracks contentSize vs layoutSize to determine if there's more content
 * below the visible area. Returns state needed for ScrollMoreIndicator.
 *
 * @example
 * const { scrollRef, hasOverflow, isAtBottom, scrollDownByViewport } = useScrollOverflow();
 *
 * <ScrollView
 *   ref={scrollRef}
 *   onContentSizeChange={onContentSizeChange}
 *   onLayout={onLayout}
 *   onScroll={onScroll}
 *   scrollEventThrottle={16}
 * >
 *   {children}
 * </ScrollView>
 *
 * {hasOverflow && !isAtBottom && (
 *   <ScrollMoreIndicator onPress={scrollDownByViewport} />
 * )}
 */

import { useRef, useState, useCallback } from 'react';
import {
  type ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type LayoutChangeEvent,
} from 'react-native';

export interface UseScrollOverflowReturn {
  /** Ref to attach to the ScrollView */
  scrollRef: React.RefObject<ScrollView>;
  /** Whether content exceeds the visible area */
  hasOverflow: boolean;
  /** Whether the user has scrolled to (near) the bottom */
  isAtBottom: boolean;
  /** Whether the user is at (near) the top */
  isAtTop: boolean;
  /** Scroll down by ~80% of the viewport height */
  scrollDownByViewport: () => void;
  /** Scroll up by ~80% of the viewport height */
  scrollUpByViewport: () => void;
  /** Attach to ScrollView onContentSizeChange */
  onContentSizeChange: (w: number, h: number) => void;
  /** Attach to ScrollView onLayout */
  onLayout: (event: LayoutChangeEvent) => void;
  /** Attach to ScrollView onScroll (use scrollEventThrottle={16}) */
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

/** Threshold in points for "at bottom" detection */
const BOTTOM_THRESHOLD = 40;

/** Threshold in points for "at top" detection */
const TOP_THRESHOLD = 40;

/**
 * @param externalRef - Optional external ScrollView ref (e.g. from forwardRef).
 *                      When provided, scrollDownByViewport uses this ref instead.
 */
export function useScrollOverflow(
  externalRef?: React.RefObject<ScrollView> | React.ForwardedRef<ScrollView>,
): UseScrollOverflowReturn {
  const internalRef = useRef<ScrollView>(null);

  // Resolve the ref to use for scrollTo() calls
  const getScrollView = useCallback((): ScrollView | null => {
    if (externalRef) {
      if (typeof externalRef === 'function') return null; // callback refs not supported for scrollTo
      return (externalRef as React.RefObject<ScrollView>).current;
    }
    return internalRef.current;
  }, [externalRef]);

  const [hasOverflow, setHasOverflow] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);

  // Store mutable refs for layout values (avoid re-renders)
  const contentHeight = useRef(0);
  const layoutHeight = useRef(0);
  const currentOffset = useRef(0);

  const updateOverflow = useCallback(() => {
    const overflow = contentHeight.current > layoutHeight.current + BOTTOM_THRESHOLD;
    setHasOverflow(overflow);

    const atBottom =
      currentOffset.current + layoutHeight.current >=
      contentHeight.current - BOTTOM_THRESHOLD;
    setIsAtBottom(atBottom);

    const atTop = currentOffset.current <= TOP_THRESHOLD;
    setIsAtTop(atTop);
  }, []);

  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      contentHeight.current = h;
      updateOverflow();
    },
    [updateOverflow],
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      layoutHeight.current = event.nativeEvent.layout.height;
      updateOverflow();
    },
    [updateOverflow],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      currentOffset.current = event.nativeEvent.contentOffset.y;
      updateOverflow();
    },
    [updateOverflow],
  );

  const scrollDownByViewport = useCallback(() => {
    const sv = getScrollView();
    if (!sv) return;
    const scrollAmount = layoutHeight.current * 0.8;
    const targetOffset = Math.min(
      currentOffset.current + scrollAmount,
      contentHeight.current - layoutHeight.current,
    );
    sv.scrollTo({ y: targetOffset, animated: true });
  }, [getScrollView]);

  const scrollUpByViewport = useCallback(() => {
    const sv = getScrollView();
    if (!sv) return;
    const scrollAmount = layoutHeight.current * 0.8;
    const targetOffset = Math.max(currentOffset.current - scrollAmount, 0);
    sv.scrollTo({ y: targetOffset, animated: true });
  }, [getScrollView]);

  return {
    scrollRef: internalRef,
    hasOverflow,
    isAtBottom,
    isAtTop,
    scrollDownByViewport,
    scrollUpByViewport,
    onContentSizeChange,
    onLayout,
    onScroll,
  };
}
