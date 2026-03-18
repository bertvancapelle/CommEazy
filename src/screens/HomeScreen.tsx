/**
 * HomeScreen — iPhone-style app grid as the main start screen
 *
 * Displays all modules in a 3-column scrollable grid.
 * Supports:
 * - User-defined order via drag-and-drop reordering
 * - Notification badges on communication modules
 * - Audio activity indicator on playing modules
 * - Mini-player bar when audio is active
 * - Wiggle mode for reordering (long-press to activate)
 * - iPad pane variant (compact, no branding)
 *
 * Senior-inclusive design:
 * - Large touch targets (96×96pt cells)
 * - 72pt colored circles with 48pt icons
 * - Labels: 14pt, max 2 lines, auto-shrink
 * - Scrollable (no pagination)
 * - Drop target indicator with accent border during drag
 *
 * Reorder mode:
 * - Long-press (800ms) activates wiggle mode
 * - Drag item to new position (iOS-style)
 * - Drop target shows dashed accent border
 * - Other icons shift to make room
 * - "Klaar" button exits wiggle mode and saves order
 *
 * Drag-and-drop architecture:
 * - Single PanResponder on grid container (not per-item)
 * - Hit-test on grant to determine which item is touched
 * - Dragged moduleId tracked in ref (not index — immune to reorder)
 * - No state updates during drag (only refs) to avoid PanResponder recreation
 * - State committed on release via setLocalOrder
 *
 * @see .claude/plans/HOMESCREEN_GRID_NAVIGATION.md
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { ScrollViewWithIndicator } from '@/components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { HomeGridItem, GRID_CELL_WIDTH, type CollectionMiniIcon } from '@/components/HomeGridItem';
import { CollectionOverlay } from '@/components/CollectionOverlay';
import { UnifiedMiniPlayer } from '@/components/UnifiedMiniPlayer';
import { useActivePlayback } from '@/hooks/useActivePlayback';
import {
  STATIC_MODULE_DEFINITIONS,
  mapModuleIconToIconName,
  isCollectionReference,
  getCollectionId,
  isDynamicDestination,
  getModuleIdFromDest,
} from '@/types/navigation';
import type {
  NavigationDestination,
  StaticNavigationDestination,
  DynamicNavigationDestination,
  GridItem,
  CollectionReference,
  ModuleCollection,
} from '@/types/navigation';
import { getModuleById } from '@/config/moduleRegistry';
import { LoadingView } from '@/components/LoadingView';
import { useModuleOrder } from '@/hooks/useModuleOrder';
import { useModuleCollections } from '@/hooks/useModuleCollections';
import { useModuleColorsContextSafe } from '@/contexts/ModuleColorsContext';
import { MODULE_TINT_COLORS } from '@/types/liquidGlass';
import { useFeedback } from '@/hooks/useFeedback';
import { useModuleBadges } from '@/hooks/useModuleBadges';
import { useModuleLayoutSafe } from '@/contexts/ModuleLayoutContext';
import {
  spacing,
  colors,
  typography,
  touchTargets,
  borderRadius,
} from '@/theme';

// ============================================================
// Types
// ============================================================

export type HomeScreenVariant = 'fullscreen' | 'pane';

interface HomeScreenProps {
  /** Called when a module grid item is tapped (also used by mini-player) */
  onModulePress: (moduleId: NavigationDestination) => void;
  /** Display variant — fullscreen (iPhone) or pane (iPad split view) */
  variant?: HomeScreenVariant;
}

// ============================================================
// Constants
// ============================================================

const GRID_COLUMNS = 3;
const GRID_GAP = 12;
const GRID_PADDING_H = spacing.md; // 16pt

/**
 * Row height for position calculations.
 * Must match the actual rendered cell height:
 * - HomeGridItem container has marginBottom: spacing.md (16pt)
 * - HomeGridItem touchable has minHeight: 96pt + paddingVertical: spacing.sm * 2 (16pt)
 * - No CSS gap in vertical direction (we use marginBottom only)
 */
const CELL_CONTENT_HEIGHT = 96 + spacing.sm * 2; // 112pt — touchable minHeight + padding
const CELL_MARGIN_BOTTOM = spacing.md; // 16pt
const ROW_HEIGHT = CELL_CONTENT_HEIGHT + CELL_MARGIN_BOTTOM; // 128pt

// Auto-scroll edge zones when dragging near top/bottom of visible ScrollView
const AUTO_SCROLL_EDGE_ZONE = 80; // 80pt from top/bottom edge triggers auto-scroll
const AUTO_SCROLL_MAX_SPEED = 8; // Max pixels per frame (~480pt/sec at 60fps)
const AUTO_SCROLL_MIN_SPEED = 2; // Min pixels per frame when barely in zone

// ============================================================
// Component
// ============================================================

export function HomeScreen({
  onModulePress,
  variant = 'fullscreen',
}: HomeScreenProps) {
  const { t } = useTranslation();
  const { collections, isLoaded: collectionsLoaded } = useModuleCollections();
  const { orderedModules, isLoaded, updateOrder } = useModuleOrder(collections);
  const moduleColors = useModuleColorsContextSafe();
  const { triggerFeedback } = useFeedback();
  const { getBadgeCount } = useModuleBadges();
  const layoutContext = useModuleLayoutSafe();
  const toolbarPosition = layoutContext?.toolbarPosition ?? 'top';

  // Collection overlay state
  const [openCollection, setOpenCollection] = useState<ModuleCollection | null>(null);

  // Wiggle mode state
  const [isWiggleMode, setIsWiggleMode] = useState(false);
  // Local order for reordering (committed on drag end, NOT during drag)
  const [localOrder, setLocalOrder] = useState<GridItem[]>([]);

  // Drag state — all in refs to avoid re-renders during drag
  const [_dragRenderTick, setDragRenderTick] = useState(0); // Force render for overlay + drop target
  // Brief highlight when tapping without dragging in wiggle mode
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const isDraggingRef = useRef(false);
  const draggedModuleIdRef = useRef<GridItem | null>(null);
  const dragOrderRef = useRef<GridItem[]>([]); // Live order during drag
  const dropTargetIndexRef = useRef<number>(-1); // Current drop target slot
  const dragStartGridPosRef = useRef({ x: 0, y: 0 }); // Grid position at drag start
  const dragFingerOffsetRef = useRef({ x: 0, y: 0 }); // Finger offset within cell at drag start
  const containerScreenYRef = useRef(0); // Container's screen-space Y (for overlay math)
  const lastGestureRef = useRef({ dx: 0, dy: 0, moveX: 0, moveY: 0 }); // Last gesture for auto-scroll overlay updates

  // Track the grid container's position on screen
  const gridLayoutRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  // Scroll offset that was active when gridLayoutRef was measured
  const gridMeasuredAtScrollRef = useRef(0);
  // ScrollView's layout Y within Wrapper (header + hint row height) — scroll-independent
  const svLayoutYRef = useRef(0);
  // Track scroll offset
  const scrollOffsetRef = useRef(0);
  // Track wiggle mode in a ref for PanResponder (avoids recreation)
  const isWiggleModeRef = useRef(false);
  // Track feedback trigger in a ref for PanResponder
  const triggerFeedbackRef = useRef(triggerFeedback);
  triggerFeedbackRef.current = triggerFeedback;
  // Throttle haptic feedback during drag to prevent rapid-fire triggers
  const lastHapticTimeRef = useRef(0);
  const HAPTIC_THROTTLE_MS = 200; // Min 200ms between haptic triggers during drag

  const gridRef = useRef<View>(null);
  const containerRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  // Auto-scroll state — all refs to avoid PanResponder recreation
  const autoScrollTimerRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const autoScrollSpeedRef = useRef(0); // +speed = scroll down, -speed = scroll up
  // Track ScrollView visible bounds (measured via onLayout)
  const scrollViewLayoutRef = useRef({ y: 0, height: 0 });
  // Track total content height for scroll bounds clamping
  const scrollContentHeightRef = useRef(0);

  // Active audio detection via unified hook
  const activePlayback = useActivePlayback();
  const activeAudioModule = activePlayback?.moduleId as NavigationDestination | null ?? null;

  // The modules to display — local order during wiggle, stored order otherwise
  const displayModules = isWiggleMode ? localOrder : orderedModules;

  // ============================================================
  // Module helpers (stable — no drag dependencies)
  // ============================================================

  const getModuleColor = useCallback((moduleId: string): string => {
    // Dynamic modules use 'module:nunl' format — resolve to raw ID for color lookup
    const colorKey = moduleId.startsWith('module:') ? moduleId.replace('module:', '') : moduleId;
    if (moduleColors) {
      return moduleColors.getModuleHex(colorKey as any);
    }
    return MODULE_TINT_COLORS[colorKey as keyof typeof MODULE_TINT_COLORS]?.tintColor || '#607D8B';
  }, [moduleColors]);

  const getIconName = useCallback((moduleId: NavigationDestination) => {
    const staticDef = STATIC_MODULE_DEFINITIONS[moduleId as StaticNavigationDestination];
    if (staticDef) {
      return mapModuleIconToIconName(staticDef.icon);
    }
    // Dynamic modules: resolve icon from moduleRegistry
    if (isDynamicDestination(moduleId)) {
      const rawId = getModuleIdFromDest(moduleId as DynamicNavigationDestination);
      const def = getModuleById(rawId);
      if (def) {
        return mapModuleIconToIconName(def.icon);
      }
    }
    return 'grid' as const;
  }, []);

  const getLabel = useCallback((moduleId: NavigationDestination) => {
    const staticDef = STATIC_MODULE_DEFINITIONS[moduleId as StaticNavigationDestination];
    if (staticDef) {
      return t(staticDef.labelKey);
    }
    // Dynamic modules: resolve label from moduleRegistry
    if (isDynamicDestination(moduleId)) {
      const rawId = getModuleIdFromDest(moduleId as DynamicNavigationDestination);
      const def = getModuleById(rawId);
      if (def) {
        return t(def.labelKey);
      }
    }
    return t(`navigation.${moduleId}`, moduleId);
  }, [t]);

  // ============================================================
  // Grid position math — uses explicit margins, no CSS gap
  // ============================================================

  /** Calculate the grid-relative position for a given slot index */
  const getGridPosition = useCallback((index: number) => {
    const col = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    // Horizontal: padding + col * (cellWidth + gap)
    // First column has no left gap (matches manual margin layout)
    const x = GRID_PADDING_H + col * (GRID_CELL_WIDTH + GRID_GAP);
    const y = row * ROW_HEIGHT;
    return { x, y };
  }, []);

  /** Determine which grid slot a screen-space touch position maps to */
  const getIndexFromPosition = useCallback((pageX: number, pageY: number, itemCount: number): number => {
    const gridX = pageX - gridLayoutRef.current.x;
    // gridLayoutRef.y was measured at scroll offset gridMeasuredAtScrollRef.
    // Content Y = fingerScreenY - gridLayoutRef.y + (currentScroll - measureScroll)
    const gridY = pageY - gridLayoutRef.current.y + (scrollOffsetRef.current - gridMeasuredAtScrollRef.current);

    // Use floor to get the cell the finger is inside (not nearest center)
    const col = Math.floor((gridX - GRID_PADDING_H + GRID_GAP / 2) / (GRID_CELL_WIDTH + GRID_GAP));
    const row = Math.floor(gridY / ROW_HEIGHT);

    const clampedCol = Math.max(0, Math.min(GRID_COLUMNS - 1, col));
    const clampedRow = Math.max(0, Math.min(Math.ceil(itemCount / GRID_COLUMNS) - 1, row));

    const index = clampedRow * GRID_COLUMNS + clampedCol;
    return Math.max(0, Math.min(itemCount - 1, index));
  }, []);

  // ============================================================
  // Wiggle mode enter/exit
  // ============================================================

  /** Re-measure grid layout after layout changes (e.g., hint row appears) */
  const remeasureGridOffset = useCallback(() => {
    // Double rAF: first frame lets React commit the layout (hint row appears),
    // second frame lets native onLayout fire and update svLayoutYRef, then we measure.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gridRef.current?.measureInWindow((gx, gy, width, height) => {
          gridLayoutRef.current = { x: gx, y: gy, width, height };
          gridMeasuredAtScrollRef.current = scrollOffsetRef.current;
        });
        containerRef.current?.measureInWindow((_cx, cy) => {
          containerScreenYRef.current = cy;
          // Re-measure ScrollView screen-space Y for auto-scroll edge zones.
          // svLayoutYRef holds the ScrollView's Y within the container (set by onLayout).
          scrollViewLayoutRef.current.y = cy + svLayoutYRef.current;
        });
      });
    });
  }, []);

  // ============================================================
  // Auto-scroll during drag
  // ============================================================

  /** Stop the auto-scroll animation loop */
  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimerRef.current !== null) {
      cancelAnimationFrame(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
    autoScrollSpeedRef.current = 0;
  }, []);

  /** Start the auto-scroll animation loop (runs every frame via rAF) */
  const startAutoScroll = useCallback(() => {
    // Already running
    if (autoScrollTimerRef.current !== null) return;

    const tick = () => {
      const speed = autoScrollSpeedRef.current;
      if (speed === 0) {
        autoScrollTimerRef.current = null;
        return;
      }

      const currentOffset = scrollOffsetRef.current;
      const maxOffset = Math.max(0, scrollContentHeightRef.current - scrollViewLayoutRef.current.height);
      const newOffset = Math.max(0, Math.min(maxOffset, currentOffset + speed));

      if (newOffset !== currentOffset) {
        scrollViewRef.current?.scrollTo({ y: newOffset, animated: false });
        // Note: scrollOffsetRef won't be updated until the onScroll fires.
        // We update it here manually so the overlay position calc is accurate this frame.
        scrollOffsetRef.current = newOffset;

        // Re-position overlay to compensate for scroll change (finger hasn't moved)
        if (isDraggingRef.current) {
          const { moveX, moveY } = lastGestureRef.current;
          // Overlay follows finger screen position → container-relative
          const newX = moveX - dragFingerOffsetRef.current.x;
          const newY = moveY - dragFingerOffsetRef.current.y - containerScreenYRef.current;
          dragPosition.setValue({ x: newX, y: newY });

          // Update drop target as grid scrolls under the finger
          const currentOrder = dragOrderRef.current;
          const targetIndex = getIndexFromPosition(moveX, moveY, currentOrder.length);
          const draggedId = draggedModuleIdRef.current;
          const currentIndex = draggedId ? currentOrder.indexOf(draggedId) : -1;

          if (targetIndex !== currentIndex && targetIndex >= 0 && draggedId) {
            const reordered = [...currentOrder];
            reordered.splice(currentIndex, 1);
            reordered.splice(targetIndex, 0, draggedId);
            dragOrderRef.current = reordered;
            const now = Date.now();
            if (now - lastHapticTimeRef.current >= HAPTIC_THROTTLE_MS) {
              lastHapticTimeRef.current = now;
              void triggerFeedbackRef.current('tap');
            }
          }

          if (targetIndex !== dropTargetIndexRef.current) {
            dropTargetIndexRef.current = targetIndex;
            setDragRenderTick(prev => prev + 1);
          }
        }
      }

      autoScrollTimerRef.current = requestAnimationFrame(tick);
    };

    autoScrollTimerRef.current = requestAnimationFrame(tick);
  }, [dragPosition, getIndexFromPosition]);

  /**
   * Check if finger is in an auto-scroll edge zone and set speed accordingly.
   * Called from onPanResponderMove with the finger's screen-space Y.
   */
  const updateAutoScroll = useCallback((fingerScreenY: number) => {
    const svTop = scrollViewLayoutRef.current.y;
    const svHeight = scrollViewLayoutRef.current.height;
    const svBottom = svTop + svHeight;

    // Distance into the top edge zone (positive = inside zone)
    const topZoneDepth = AUTO_SCROLL_EDGE_ZONE - (fingerScreenY - svTop);
    // Distance into the bottom edge zone (positive = inside zone)
    const bottomZoneDepth = AUTO_SCROLL_EDGE_ZONE - (svBottom - fingerScreenY);

    if (topZoneDepth > 0) {
      // Finger is in top edge zone → scroll UP (negative speed)
      const ratio = Math.min(1, topZoneDepth / AUTO_SCROLL_EDGE_ZONE);
      autoScrollSpeedRef.current = -(AUTO_SCROLL_MIN_SPEED + ratio * (AUTO_SCROLL_MAX_SPEED - AUTO_SCROLL_MIN_SPEED));
      startAutoScroll();
    } else if (bottomZoneDepth > 0) {
      // Finger is in bottom edge zone → scroll DOWN (positive speed)
      const ratio = Math.min(1, bottomZoneDepth / AUTO_SCROLL_EDGE_ZONE);
      autoScrollSpeedRef.current = AUTO_SCROLL_MIN_SPEED + ratio * (AUTO_SCROLL_MAX_SPEED - AUTO_SCROLL_MIN_SPEED);
      startAutoScroll();
    } else {
      // Finger is in the safe middle zone → stop auto-scroll
      autoScrollSpeedRef.current = 0;
      // Timer will self-stop on next tick when speed === 0
    }
  }, [startAutoScroll]);

  const handleEnterWiggleMode = useCallback(() => {
    void triggerFeedback('warning');
    const order = [...orderedModules];
    setLocalOrder(order);
    dragOrderRef.current = order;
    isWiggleModeRef.current = true;
    setIsWiggleMode(true);
    // Re-measure after hint row appears (layout shift)
    remeasureGridOffset();
  }, [orderedModules, triggerFeedback, remeasureGridOffset]);

  const handleExitWiggleMode = useCallback(async () => {
    void triggerFeedback('success');
    stopAutoScroll();
    isWiggleModeRef.current = false;
    setIsWiggleMode(false);
    isDraggingRef.current = false;
    draggedModuleIdRef.current = null;
    dropTargetIndexRef.current = -1;
    setDragRenderTick(0);
    await updateOrder(localOrder);
  }, [localOrder, updateOrder, triggerFeedback, stopAutoScroll]);

  const handleModulePress = useCallback((moduleId: NavigationDestination) => {
    if (!isWiggleMode) {
      onModulePress(moduleId);
    }
  }, [isWiggleMode, onModulePress]);

  // ============================================================
  // Single grid-level PanResponder
  // ============================================================

  const gridPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // Capture touch only when in wiggle mode
        return isWiggleModeRef.current;
      },
      onMoveShouldSetPanResponder: (_evt, gs) => {
        // Capture move when dragging and moved more than 5pt
        return isWiggleModeRef.current && isDraggingRef.current &&
          (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5);
      },
      onPanResponderGrant: (evt) => {
        if (!isWiggleModeRef.current) return;

        const { pageX, pageY } = evt.nativeEvent;
        const currentOrder = dragOrderRef.current;
        const touchedIndex = getIndexFromPosition(pageX, pageY, currentOrder.length);

        if (touchedIndex < 0 || touchedIndex >= currentOrder.length) return;

        const moduleId = currentOrder[touchedIndex];
        draggedModuleIdRef.current = moduleId;
        isDraggingRef.current = true;
        dropTargetIndexRef.current = touchedIndex;

        // Calculate grid position of the touched item
        const gridPos = getGridPosition(touchedIndex);
        dragStartGridPosRef.current = gridPos;

        // Position overlay at the cell's screen position, relative to the container.
        // Use finger's screen position (pageY) minus finger's offset within the cell.
        // The cell's top-left in screen-space = gridLayoutRef.y - scrollDelta + gridPos.y
        // Convert to container-relative by subtracting containerScreenY.
        const scrollDelta = scrollOffsetRef.current - gridMeasuredAtScrollRef.current;
        const cellScreenY = gridLayoutRef.current.y - scrollDelta + gridPos.y;
        const cellScreenX = gridLayoutRef.current.x + gridPos.x - GRID_PADDING_H;
        // Store the offset between finger and cell top-left for use during move
        dragFingerOffsetRef.current = {
          x: pageX - cellScreenX,
          y: pageY - cellScreenY,
        };
        // Position overlay synchronously using pre-measured containerScreenYRef
        // (measured when entering wiggle mode in remeasureGridOffset)
        const overlayY = cellScreenY - containerScreenYRef.current;

        dragPosition.setValue({
          x: gridPos.x,
          y: overlayY,
        });

        // Scale up
        Animated.spring(dragScale, {
          toValue: 1.1,
          useNativeDriver: true,
          friction: 8,
        }).start();

        void triggerFeedbackRef.current('tap');
        setDragRenderTick(prev => prev + 1);
      },
      onPanResponderMove: (_evt, gs) => {
        if (!isDraggingRef.current || !draggedModuleIdRef.current) return;

        // Save gesture state for auto-scroll overlay updates
        lastGestureRef.current = { dx: gs.dx, dy: gs.dy, moveX: gs.moveX, moveY: gs.moveY };

        // Update overlay position: finger screen position → container-relative
        // moveX/moveY = finger's current screen-space position
        // Subtract finger offset within cell + container's screen Y
        const newX = gs.moveX - dragFingerOffsetRef.current.x;
        const newY = gs.moveY - dragFingerOffsetRef.current.y - containerScreenYRef.current;
        dragPosition.setValue({ x: newX, y: newY });

        // Auto-scroll when finger is near top/bottom edge of ScrollView
        updateAutoScroll(gs.moveY);

        // Determine target slot from finger position
        const currentOrder = dragOrderRef.current;
        const targetIndex = getIndexFromPosition(gs.moveX, gs.moveY, currentOrder.length);

        // Find where the dragged module currently sits
        const draggedId = draggedModuleIdRef.current;
        const currentIndex = currentOrder.indexOf(draggedId);

        if (targetIndex !== currentIndex && targetIndex >= 0) {
          // Rearrange the order in the ref (NO state update — no re-render)
          const newOrder = [...currentOrder];
          newOrder.splice(currentIndex, 1);
          newOrder.splice(targetIndex, 0, draggedId);
          dragOrderRef.current = newOrder;

          const now = Date.now();
          if (now - lastHapticTimeRef.current >= HAPTIC_THROTTLE_MS) {
            lastHapticTimeRef.current = now;
            void triggerFeedbackRef.current('tap');
          }
        }

        // Update drop target indicator (triggers re-render only when target changes)
        if (targetIndex !== dropTargetIndexRef.current) {
          dropTargetIndexRef.current = targetIndex;
          setDragRenderTick(prev => prev + 1);
        }
      },
      onPanResponderRelease: (_evt, gs) => {
        if (!isDraggingRef.current) return;

        // Stop auto-scroll immediately
        stopAutoScroll();

        // Detect tap-without-drag: finger barely moved
        const wasTap = Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5;

        if (wasTap) {
          // Show brief highlight on the tapped item, no reorder
          const currentOrder = dragOrderRef.current;
          const draggedId = draggedModuleIdRef.current;
          const tappedIdx = draggedId ? currentOrder.indexOf(draggedId) : -1;

          isDraggingRef.current = false;
          draggedModuleIdRef.current = null;
          dropTargetIndexRef.current = -1;
          dragScale.setValue(1);
          setDragRenderTick(prev => prev + 1);

          if (tappedIdx >= 0) {
            // Clear any previous highlight timer
            if (highlightTimerRef.current) {
              clearTimeout(highlightTimerRef.current);
            }
            setHighlightedIndex(tappedIdx);
            highlightTimerRef.current = setTimeout(() => {
              setHighlightedIndex(-1);
              highlightTimerRef.current = null;
            }, 300);
          }
          return;
        }

        // Commit the drag order to state
        const finalOrder = [...dragOrderRef.current];
        setLocalOrder(finalOrder);

        // Find final position of the dragged item
        const draggedId = draggedModuleIdRef.current;
        const finalIndex = draggedId ? finalOrder.indexOf(draggedId) : 0;
        const finalPos = getGridPosition(finalIndex);

        // Animate overlay to final position using the same screen-space math
        // as onPanResponderGrant (cell screen Y → Wrapper-relative)
        const scrollDelta = scrollOffsetRef.current - gridMeasuredAtScrollRef.current;
        const finalCellScreenY = gridLayoutRef.current.y - scrollDelta + finalPos.y;
        const finalOverlayY = finalCellScreenY - containerScreenYRef.current;
        Animated.parallel([
          Animated.spring(dragPosition, {
            toValue: { x: finalPos.x, y: finalOverlayY },
            useNativeDriver: true,
            friction: 8,
          }),
          Animated.spring(dragScale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
          }),
        ]).start(() => {
          isDraggingRef.current = false;
          draggedModuleIdRef.current = null;
          dropTargetIndexRef.current = -1;
          setDragRenderTick(prev => prev + 1);
        });
      },
      onPanResponderTerminationRequest: () => {
        // Never let ScrollView or other responders steal the drag
        return !isDraggingRef.current;
      },
      onPanResponderTerminate: () => {
        // Same as release — commit whatever order we have
        if (!isDraggingRef.current) return;

        stopAutoScroll();

        const finalOrder = [...dragOrderRef.current];
        setLocalOrder(finalOrder);

        isDraggingRef.current = false;
        draggedModuleIdRef.current = null;
        dropTargetIndexRef.current = -1;

        dragScale.setValue(1);
        setDragRenderTick(prev => prev + 1);
      },
    });
  }, [getGridPosition, getIndexFromPosition, dragPosition, dragScale, updateAutoScroll, stopAutoScroll]);

  // ============================================================
  // Grid layout measurement
  // ============================================================

  const handleGridLayout = useCallback((_event: LayoutChangeEvent) => {
    gridRef.current?.measureInWindow((gx, gy, width, height) => {
      gridLayoutRef.current = { x: gx, y: gy, width, height };
      gridMeasuredAtScrollRef.current = scrollOffsetRef.current;
    });
  }, []);

  // ============================================================
  // Render
  // ============================================================

  if (!isLoaded || !collectionsLoaded) {
    return <LoadingView fullscreen />;
  }

  const isPaneVariant = variant === 'pane';
  const Wrapper = isPaneVariant ? View : SafeAreaView;

  // During drag, use the live ref order for rendering grid items
  // This avoids the "state update → PanResponder recreation" problem
  const renderOrder = isDraggingRef.current ? dragOrderRef.current : displayModules;
  const currentDraggedId = draggedModuleIdRef.current;
  const currentDropTarget = dropTargetIndexRef.current;

  return (
    <Wrapper ref={containerRef} style={[styles.container, isPaneVariant && styles.paneContainer]}>
      {/* Header: branding or wiggle mode "Klaar" button */}
      {!isPaneVariant && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CommEazy</Text>
          {isWiggleMode && (
            <HapticTouchable hapticDisabled
              style={styles.doneButton}
              onPress={handleExitWiggleMode}
              accessibilityRole="button"
              accessibilityLabel={t('homeScreen.editModeDone', 'Klaar')}
            >
              <Text style={styles.doneButtonText}>
                {t('homeScreen.editModeDone', 'Klaar')}
              </Text>
            </HapticTouchable>
          )}
        </View>
      )}

      {/* Wiggle mode hint */}
      {isWiggleMode && (
        <View style={styles.hintRow}>
          <Text style={styles.hintText}>
            {t('homeScreen.dragToReorder', 'Houd vast en sleep om te verplaatsen')}
          </Text>
        </View>
      )}

      {/* iPad pane: show done button at top when in wiggle mode */}
      {isPaneVariant && isWiggleMode && (
        <View style={styles.paneDoneRow}>
          <HapticTouchable hapticDisabled
            style={styles.doneButton}
            onPress={handleExitWiggleMode}
            accessibilityRole="button"
            accessibilityLabel={t('homeScreen.editModeDone', 'Klaar')}
          >
            <Text style={styles.doneButtonText}>
              {t('homeScreen.editModeDone', 'Klaar')}
            </Text>
          </HapticTouchable>
        </View>
      )}

      {/* Mini-player at top — shown when toolbar is at bottom (fullscreen variant only) */}
      {toolbarPosition === 'bottom' && !isPaneVariant && !isWiggleMode && activePlayback && (
        <UnifiedMiniPlayer
          moduleId={activePlayback.moduleId}
          artwork={activePlayback.artwork}
          title={activePlayback.title}
          subtitle={activePlayback.subtitle}
          isPlaying={activePlayback.isPlaying}
          isLoading={activePlayback.isLoading}
          progressType={activePlayback.progressType}
          progress={activePlayback.progress}
          listenDuration={activePlayback.listenDuration}
          onPress={() => onModulePress(activePlayback.moduleId as NavigationDestination)}
          onPlayPause={activePlayback.onPlayPause}
          onStop={activePlayback.onStop}
        />
      )}

      <ScrollViewWithIndicator
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isWiggleMode}  // Disable touch-scrolling in wiggle mode so ScrollView doesn't steal vertical drags; programmatic scrollTo() works regardless
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        onLayout={(e) => {
          // Track ScrollView's position for overlay calculations and auto-scroll edge detection.
          const { y: layoutY, height } = e.nativeEvent.layout;
          // svLayoutYRef = ScrollView's Y within Wrapper (scroll-independent, for overlay math)
          svLayoutYRef.current = layoutY;
          // scrollViewLayoutRef = screen-space bounds (for auto-scroll edge zone detection)
          scrollViewLayoutRef.current.height = height;
          containerRef.current?.measureInWindow((_cx, cy) => {
            scrollViewLayoutRef.current.y = cy + layoutY;
          });
        }}
        onContentSizeChange={(_w, h) => {
          scrollContentHeightRef.current = h;
        }}
      >
        <View
          ref={gridRef}
          style={styles.grid}
          onLayout={handleGridLayout}
          {...(isWiggleMode ? gridPanResponder.panHandlers : {})}
        >
          {renderOrder.map((gridItem, index) => {
            const isDraggedItem = isDraggingRef.current && currentDraggedId === gridItem;
            const isDropTargetItem = isDraggingRef.current &&
              currentDropTarget === index &&
              currentDraggedId !== gridItem;
            const isHighlighted = highlightedIndex === index;

            // Collection reference — render as folder-style grid item
            if (isCollectionReference(gridItem)) {
              const colId = getCollectionId(gridItem);
              const collection = collections.find((c) => c.id === colId);
              if (!collection) return null;

              const colLabel = collection.name.startsWith('collections.')
                ? t(collection.name)
                : collection.name;

              // Build 2×2 mini-icon preview from collection modules
              const miniIcons: CollectionMiniIcon[] = collection.moduleIds
                .slice(0, 4)
                .map((mid) => ({
                  icon: getIconName(mid as NavigationDestination),
                  color: getModuleColor(mid),
                }));

              return (
                <View
                  key={gridItem}
                  style={[
                    styles.gridCell,
                    index >= GRID_COLUMNS && styles.gridCellRowGap,
                    index % GRID_COLUMNS !== 0 && styles.gridCellColGap,
                    isDraggedItem && styles.placeholderItem,
                    isHighlighted && styles.highlightedItem,
                  ]}
                >
                  <HomeGridItem
                    moduleId={gridItem}
                    icon="grid"
                    label={colLabel}
                    color={getModuleColor(collection.moduleIds[0] || 'woordraad')}
                    badgeCount={0}
                    isAudioActive={false}
                    isWiggling={isWiggleMode}
                    isSelected={false}
                    isDragging={isDraggedItem}
                    isDropTarget={isDropTargetItem}
                    isCollection={true}
                    collectionMiniIcons={miniIcons}
                    onPress={() => {
                      setOpenCollection(collection);
                    }}
                    onLongPress={isWiggleMode ? undefined : handleEnterWiggleMode}
                  />
                </View>
              );
            }

            // Regular module — render as before
            const moduleId = gridItem as NavigationDestination;

            return (
              <View
                key={moduleId}
                style={[
                  styles.gridCell,
                  // Row spacing: add top margin for rows after the first
                  index >= GRID_COLUMNS && styles.gridCellRowGap,
                  // Column spacing: add left margin for columns after the first
                  index % GRID_COLUMNS !== 0 && styles.gridCellColGap,
                  // Placeholder style for the dragged item
                  isDraggedItem && styles.placeholderItem,
                  // Brief highlight on tap-without-drag
                  isHighlighted && styles.highlightedItem,
                ]}
              >
                <HomeGridItem
                  moduleId={moduleId}
                  icon={getIconName(moduleId)}
                  label={getLabel(moduleId)}
                  color={getModuleColor(moduleId)}
                  badgeCount={getBadgeCount(moduleId)}
                  isAudioActive={!isWiggleMode && activeAudioModule === moduleId}
                  isWiggling={isWiggleMode}
                  isSelected={false}
                  isDragging={isDraggedItem}
                  isDropTarget={isDropTargetItem}
                  onPress={() => handleModulePress(moduleId)}
                  onLongPress={isWiggleMode ? undefined : handleEnterWiggleMode}
                />
              </View>
            );
          })}
        </View>
      </ScrollViewWithIndicator>

      {/* Dragged item overlay — follows the finger */}
      {isDraggingRef.current && currentDraggedId && (() => {
        const isCol = isCollectionReference(currentDraggedId);
        const dragModuleId = isCol ? null : currentDraggedId as NavigationDestination;
        const dragCollection = isCol
          ? collections.find((c) => c.id === getCollectionId(currentDraggedId as CollectionReference))
          : null;
        const dragLabel = isCol && dragCollection
          ? (dragCollection.name.startsWith('collections.') ? t(dragCollection.name) : dragCollection.name)
          : dragModuleId ? getLabel(dragModuleId) : '';

        return (
          <Animated.View
            style={[
              styles.dragOverlay,
              {
                transform: [
                  { translateX: dragPosition.x },
                  { translateY: dragPosition.y },
                  { scale: dragScale },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <HomeGridItem
              moduleId={currentDraggedId}
              icon={isCol ? 'grid' : getIconName(dragModuleId!)}
              label={dragLabel}
              color={isCol
                ? getModuleColor(dragCollection?.moduleIds[0] || 'woordraad')
                : getModuleColor(dragModuleId!)}
              badgeCount={isCol ? 0 : getBadgeCount(dragModuleId!)}
              isAudioActive={false}
              isWiggling={false}
              isSelected={false}
              isDragging={false}
              isDropTarget={false}
              isCollection={isCol}
              collectionMiniIcons={isCol && dragCollection
                ? dragCollection.moduleIds.slice(0, 4).map((mid) => ({
                    icon: getIconName(mid as NavigationDestination),
                    color: getModuleColor(mid),
                  }))
                : undefined}
              onPress={() => {}}
            />
          </Animated.View>
        );
      })()}

      {/* Mini-player — shown when audio is playing (fullscreen variant only)
          Position-aware: toolbar 'top' → player at bottom; toolbar 'bottom' → player at top
          When toolbar is at bottom, rendered before ScrollView (see above) */}
      {toolbarPosition !== 'bottom' && !isPaneVariant && !isWiggleMode && activePlayback && (
        <UnifiedMiniPlayer
          moduleId={activePlayback.moduleId}
          artwork={activePlayback.artwork}
          title={activePlayback.title}
          subtitle={activePlayback.subtitle}
          isPlaying={activePlayback.isPlaying}
          isLoading={activePlayback.isLoading}
          progressType={activePlayback.progressType}
          progress={activePlayback.progress}
          listenDuration={activePlayback.listenDuration}
          onPress={() => onModulePress(activePlayback.moduleId as NavigationDestination)}
          onPlayPause={activePlayback.onPlayPause}
          onStop={activePlayback.onStop}
        />
      )}

      {/* Collection overlay — iOS folder-style modal */}
      <CollectionOverlay
        visible={openCollection !== null}
        collection={openCollection}
        onClose={() => setOpenCollection(null)}
        onModulePress={onModulePress}
      />
    </Wrapper>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  paneContainer: {
    // No SafeAreaView padding in pane mode
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GRID_PADDING_H,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  doneButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum, // 60pt
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  hintRow: {
    paddingHorizontal: GRID_PADDING_H,
    paddingBottom: spacing.sm,
  },
  hintText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  paneDoneRow: {
    paddingHorizontal: GRID_PADDING_H,
    paddingVertical: spacing.sm,
    alignItems: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GRID_PADDING_H,
    // NO gap property — we use explicit margins for position calculation accuracy
  },
  gridCell: {
    width: GRID_CELL_WIDTH,
  },
  gridCellRowGap: {
    // No vertical gap needed — HomeGridItem has marginBottom: spacing.md
  },
  gridCellColGap: {
    marginLeft: GRID_GAP,
  },
  placeholderItem: {
    opacity: 0.15,
  },
  highlightedItem: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: borderRadius.md,
  },
  dragOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: GRID_CELL_WIDTH,
    zIndex: 999,
    // Shadow for elevated look
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
});
