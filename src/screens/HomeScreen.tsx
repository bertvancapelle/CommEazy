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
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { HomeGridItem, GRID_CELL_WIDTH } from '@/components/HomeGridItem';
import { UnifiedMiniPlayer } from '@/components/UnifiedMiniPlayer';
import { useActivePlayback } from '@/hooks/useActivePlayback';
import {
  STATIC_MODULE_DEFINITIONS,
  mapModuleIconToIconName,
} from '@/types/navigation';
import type {
  NavigationDestination,
  StaticNavigationDestination,
} from '@/types/navigation';
import { LoadingView } from '@/components/LoadingView';
import { useModuleOrder } from '@/hooks/useModuleOrder';
import { useModuleColorsContextSafe } from '@/contexts/ModuleColorsContext';
import { MODULE_TINT_COLORS } from '@/types/liquidGlass';
import { useFeedback } from '@/hooks/useFeedback';
import { useModuleBadges } from '@/hooks/useModuleBadges';
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

// ============================================================
// Component
// ============================================================

export function HomeScreen({
  onModulePress,
  variant = 'fullscreen',
}: HomeScreenProps) {
  const { t } = useTranslation();
  const { orderedModules, isLoaded, updateOrder } = useModuleOrder();
  const moduleColors = useModuleColorsContextSafe();
  const { triggerFeedback } = useFeedback();
  const { getBadgeCount } = useModuleBadges();

  // Wiggle mode state
  const [isWiggleMode, setIsWiggleMode] = useState(false);
  // Local order for reordering (committed on drag end, NOT during drag)
  const [localOrder, setLocalOrder] = useState<NavigationDestination[]>([]);

  // Drag state — all in refs to avoid re-renders during drag
  const [_dragRenderTick, setDragRenderTick] = useState(0); // Force render for overlay + drop target
  // Brief highlight when tapping without dragging in wiggle mode
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const isDraggingRef = useRef(false);
  const draggedModuleIdRef = useRef<NavigationDestination | null>(null);
  const dragOrderRef = useRef<NavigationDestination[]>([]); // Live order during drag
  const dropTargetIndexRef = useRef<number>(-1); // Current drop target slot
  const dragStartGridPosRef = useRef({ x: 0, y: 0 }); // Grid position at drag start

  // Track the grid container's position on screen
  const gridLayoutRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  // Track scroll offset
  const scrollOffsetRef = useRef(0);
  // Track wiggle mode in a ref for PanResponder (avoids recreation)
  const isWiggleModeRef = useRef(false);
  // Track feedback trigger in a ref for PanResponder
  const triggerFeedbackRef = useRef(triggerFeedback);
  triggerFeedbackRef.current = triggerFeedback;

  const gridRef = useRef<View>(null);

  // Active audio detection via unified hook
  const activePlayback = useActivePlayback();
  const activeAudioModule = activePlayback?.moduleId as NavigationDestination | null ?? null;

  // The modules to display — local order during wiggle, stored order otherwise
  const displayModules = isWiggleMode ? localOrder : orderedModules;

  // ============================================================
  // Module helpers (stable — no drag dependencies)
  // ============================================================

  const getModuleColor = useCallback((moduleId: string): string => {
    if (moduleColors) {
      return moduleColors.getModuleHex(moduleId as any);
    }
    return MODULE_TINT_COLORS[moduleId as keyof typeof MODULE_TINT_COLORS]?.tintColor || '#607D8B';
  }, [moduleColors]);

  const getIconName = useCallback((moduleId: NavigationDestination) => {
    const staticDef = STATIC_MODULE_DEFINITIONS[moduleId as StaticNavigationDestination];
    if (staticDef) {
      return mapModuleIconToIconName(staticDef.icon);
    }
    return 'grid' as const;
  }, []);

  const getLabel = useCallback((moduleId: NavigationDestination) => {
    const staticDef = STATIC_MODULE_DEFINITIONS[moduleId as StaticNavigationDestination];
    if (staticDef) {
      return t(staticDef.labelKey);
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
    const gridY = pageY - gridLayoutRef.current.y + scrollOffsetRef.current;

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

  const handleEnterWiggleMode = useCallback(() => {
    void triggerFeedback('warning');
    const order = [...orderedModules];
    setLocalOrder(order);
    dragOrderRef.current = order;
    isWiggleModeRef.current = true;
    setIsWiggleMode(true);
  }, [orderedModules, triggerFeedback]);

  const handleExitWiggleMode = useCallback(async () => {
    void triggerFeedback('success');
    isWiggleModeRef.current = false;
    setIsWiggleMode(false);
    isDraggingRef.current = false;
    draggedModuleIdRef.current = null;
    dropTargetIndexRef.current = -1;
    setDragRenderTick(0);
    await updateOrder(localOrder);
  }, [localOrder, updateOrder, triggerFeedback]);

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

        // Set overlay position (grid-relative, adjusted for scroll)
        dragPosition.setValue({
          x: gridPos.x,
          y: gridPos.y - scrollOffsetRef.current,
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

        // Update overlay position
        const newX = dragStartGridPosRef.current.x + gs.dx;
        const newY = dragStartGridPosRef.current.y - scrollOffsetRef.current + gs.dy;
        dragPosition.setValue({ x: newX, y: newY });

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

          void triggerFeedbackRef.current('tap');
        }

        // Update drop target indicator (triggers re-render only when target changes)
        if (targetIndex !== dropTargetIndexRef.current) {
          dropTargetIndexRef.current = targetIndex;
          setDragRenderTick(prev => prev + 1);
        }
      },
      onPanResponderRelease: (_evt, gs) => {
        if (!isDraggingRef.current) return;

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

        // Animate overlay to final position, then clear drag state
        Animated.parallel([
          Animated.spring(dragPosition, {
            toValue: { x: finalPos.x, y: finalPos.y - scrollOffsetRef.current },
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
      onPanResponderTerminate: () => {
        // Same as release — commit whatever order we have
        if (!isDraggingRef.current) return;

        const finalOrder = [...dragOrderRef.current];
        setLocalOrder(finalOrder);

        isDraggingRef.current = false;
        draggedModuleIdRef.current = null;
        dropTargetIndexRef.current = -1;

        dragScale.setValue(1);
        setDragRenderTick(prev => prev + 1);
      },
    });
  }, [getGridPosition, getIndexFromPosition, dragPosition, dragScale]);

  // ============================================================
  // Grid layout measurement
  // ============================================================

  const handleGridLayout = useCallback((_event: LayoutChangeEvent) => {
    gridRef.current?.measureInWindow((wx, wy, width, height) => {
      gridLayoutRef.current = { x: wx, y: wy, width, height };
    });
  }, []);

  // ============================================================
  // Render
  // ============================================================

  if (!isLoaded) {
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
    <Wrapper style={[styles.container, isPaneVariant && styles.paneContainer]}>
      {/* Header: branding or wiggle mode "Klaar" button */}
      {!isPaneVariant && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CommEazy</Text>
          {isWiggleMode && (
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleExitWiggleMode}
              accessibilityRole="button"
              accessibilityLabel={t('homeScreen.editModeDone', 'Klaar')}
            >
              <Text style={styles.doneButtonText}>
                {t('homeScreen.editModeDone', 'Klaar')}
              </Text>
            </TouchableOpacity>
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
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleExitWiggleMode}
            accessibilityRole="button"
            accessibilityLabel={t('homeScreen.editModeDone', 'Klaar')}
          >
            <Text style={styles.doneButtonText}>
              {t('homeScreen.editModeDone', 'Klaar')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isWiggleMode}
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <View
          ref={gridRef}
          style={styles.grid}
          onLayout={handleGridLayout}
          {...(isWiggleMode ? gridPanResponder.panHandlers : {})}
        >
          {renderOrder.map((moduleId, index) => {
            const isDraggedItem = isDraggingRef.current && currentDraggedId === moduleId;
            const isDropTargetItem = isDraggingRef.current &&
              currentDropTarget === index &&
              currentDraggedId !== moduleId;
            const isHighlighted = highlightedIndex === index;

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
      </ScrollView>

      {/* Dragged item overlay — follows the finger */}
      {isDraggingRef.current && currentDraggedId && (
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
            icon={getIconName(currentDraggedId)}
            label={getLabel(currentDraggedId)}
            color={getModuleColor(currentDraggedId)}
            badgeCount={getBadgeCount(currentDraggedId)}
            isAudioActive={false}
            isWiggling={false}
            isSelected={false}
            isDragging={false}
            isDropTarget={false}
            onPress={() => {}}
          />
        </Animated.View>
      )}

      {/* Mini-player — shown when audio is playing (fullscreen variant only) */}
      {!isPaneVariant && !isWiggleMode && activePlayback && (
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
