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
 *
 * Reorder mode:
 * - Long-press (800ms) activates wiggle mode
 * - Drag item to new position (iOS-style)
 * - Other icons shift to make room
 * - "Klaar" button exits wiggle mode and saves order
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
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { HomeGridItem, GRID_CELL_WIDTH } from '@/components/HomeGridItem';
import { HomeMiniPlayer } from '@/components/HomeMiniPlayer';
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
import { useRadioContext } from '@/contexts/RadioContext';
import { usePodcastContextSafe } from '@/contexts/PodcastContext';
import { useBooksContextSafe } from '@/contexts/BooksContext';
import { useAppleMusicContextSafe } from '@/contexts/AppleMusicContext';
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
  /** Called when a module grid item is tapped (also used by HomeMiniPlayer) */
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
// Row height: cell content + marginBottom
const CELL_MARGIN_BOTTOM = spacing.md; // 16pt
const CELL_HEIGHT = 96 + spacing.sm * 2 + CELL_MARGIN_BOTTOM; // touchable minHeight + padding + margin

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
  // Local order for reordering (only used during wiggle mode)
  const [localOrder, setLocalOrder] = useState<NavigationDestination[]>([]);

  // Drag state
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  // Track the grid container's position on screen
  const gridLayoutRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  // Track scroll offset for correct position calculation
  const scrollOffsetRef = useRef(0);
  // Track the current drag order separately to avoid stale closure issues
  const currentDragOrderRef = useRef<NavigationDestination[]>([]);
  // Track the original index where drag started
  const dragStartIndexRef = useRef<number>(0);

  // Active audio detection
  const radioCtx = useRadioContext();
  const podcastCtx = usePodcastContextSafe();
  const booksCtx = useBooksContextSafe();
  const appleMusicCtx = useAppleMusicContextSafe();

  // Determine which module is currently playing audio
  const activeAudioModule = useMemo((): NavigationDestination | null => {
    // Priority: appleMusic > radio > podcast > books
    if (appleMusicCtx?.isPlaying && appleMusicCtx?.nowPlaying) return 'appleMusic';
    if (radioCtx?.isPlaying && radioCtx?.currentStation) return 'radio';
    if (podcastCtx?.isPlaying && podcastCtx?.currentEpisode) return 'podcast';
    if (booksCtx?.isReading && booksCtx?.currentBook) return 'books';
    return null;
  }, [
    appleMusicCtx?.isPlaying,
    appleMusicCtx?.nowPlaying,
    radioCtx?.isPlaying,
    radioCtx?.currentStation,
    podcastCtx?.isPlaying,
    podcastCtx?.currentEpisode,
    booksCtx?.isReading,
    booksCtx?.currentBook,
  ]);

  // The modules to display — local order during wiggle, stored order otherwise
  const displayModules = isWiggleMode ? localOrder : orderedModules;

  // Get module color for a specific module
  const getModuleColor = useCallback((moduleId: string): string => {
    if (moduleColors) {
      return moduleColors.getModuleHex(moduleId as any);
    }
    // Fallback when outside provider
    return MODULE_TINT_COLORS[moduleId as keyof typeof MODULE_TINT_COLORS]?.tintColor || '#607D8B';
  }, [moduleColors]);

  // Get icon name for a module
  const getIconName = useCallback((moduleId: NavigationDestination) => {
    const staticDef = STATIC_MODULE_DEFINITIONS[moduleId as StaticNavigationDestination];
    if (staticDef) {
      return mapModuleIconToIconName(staticDef.icon);
    }
    return 'grid' as const; // fallback for dynamic modules
  }, []);

  // Get translated label for a module
  const getLabel = useCallback((moduleId: NavigationDestination) => {
    const staticDef = STATIC_MODULE_DEFINITIONS[moduleId as StaticNavigationDestination];
    if (staticDef) {
      return t(staticDef.labelKey);
    }
    // Dynamic module: try navigation key
    return t(`navigation.${moduleId}`, moduleId);
  }, [t]);

  // Calculate grid position for a given index
  const getGridPosition = useCallback((index: number) => {
    const col = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    const x = GRID_PADDING_H + col * (GRID_CELL_WIDTH + GRID_GAP);
    const y = row * CELL_HEIGHT;
    return { x, y };
  }, []);

  // Calculate which grid index a screen position maps to
  const getIndexFromPosition = useCallback((pageX: number, pageY: number, itemCount: number): number => {
    const gridX = pageX - gridLayoutRef.current.x;
    const gridY = pageY - gridLayoutRef.current.y + scrollOffsetRef.current;

    const col = Math.round((gridX - GRID_PADDING_H) / (GRID_CELL_WIDTH + GRID_GAP));
    const row = Math.round(gridY / CELL_HEIGHT);

    const clampedCol = Math.max(0, Math.min(GRID_COLUMNS - 1, col));
    const clampedRow = Math.max(0, Math.min(Math.ceil(itemCount / GRID_COLUMNS) - 1, row));

    const index = clampedRow * GRID_COLUMNS + clampedCol;
    return Math.max(0, Math.min(itemCount - 1, index));
  }, []);

  // Enter wiggle mode (long-press on any grid item)
  const handleEnterWiggleMode = useCallback(() => {
    void triggerFeedback('warning'); // Strong haptic for mode change
    setLocalOrder([...orderedModules]);
    currentDragOrderRef.current = [...orderedModules];
    setIsWiggleMode(true);
  }, [orderedModules, triggerFeedback]);

  // Exit wiggle mode and save order
  const handleExitWiggleMode = useCallback(async () => {
    void triggerFeedback('success');
    setIsWiggleMode(false);
    setDraggingIndex(null);
    // Save the new order
    await updateOrder(localOrder);
  }, [localOrder, updateOrder, triggerFeedback]);

  // Handle module press — navigate (only when NOT in wiggle mode)
  const handleModulePress = useCallback((moduleId: NavigationDestination) => {
    if (!isWiggleMode) {
      onModulePress(moduleId);
    }
    // In wiggle mode, taps are ignored — only drag works
  }, [isWiggleMode, onModulePress]);

  // Start dragging a specific item
  const handleDragStart = useCallback((index: number, _evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
    void triggerFeedback('tap');
    setDraggingIndex(index);
    dragStartIndexRef.current = index;

    // Set initial position of the dragged item
    const pos = getGridPosition(index);
    dragPosition.setValue({ x: pos.x, y: pos.y - scrollOffsetRef.current });

    // Scale up the dragged item
    Animated.spring(dragScale, {
      toValue: 1.1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [triggerFeedback, getGridPosition, dragPosition, dragScale]);

  // Handle drag movement
  const handleDragMove = useCallback((index: number, _evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
    // Update position of dragged item
    const startPos = getGridPosition(dragStartIndexRef.current);
    const newX = startPos.x + gestureState.dx;
    const newY = startPos.y - scrollOffsetRef.current + gestureState.dy;
    dragPosition.setValue({ x: newX, y: newY });

    // Determine which slot the finger is over
    const fingerX = gestureState.moveX;
    const fingerY = gestureState.moveY;
    const targetIndex = getIndexFromPosition(fingerX, fingerY, currentDragOrderRef.current.length);

    // Find where the dragged item currently is in the order
    const currentOrder = currentDragOrderRef.current;
    const draggedModuleId = currentOrder[dragStartIndexRef.current];
    const currentDragIndex = currentOrder.indexOf(draggedModuleId);

    if (targetIndex !== currentDragIndex && targetIndex >= 0) {
      void triggerFeedback('tap');
      // Move the item in the array
      const newOrder = [...currentOrder];
      newOrder.splice(currentDragIndex, 1);
      newOrder.splice(targetIndex, 0, draggedModuleId);
      currentDragOrderRef.current = newOrder;
      setLocalOrder(newOrder);
    }
  }, [getGridPosition, getIndexFromPosition, dragPosition, triggerFeedback]);

  // Handle drag end
  const handleDragEnd = useCallback((_index: number, _evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
    // Find where the dragged item ended up
    const draggedModuleId = currentDragOrderRef.current[dragStartIndexRef.current];
    const finalIndex = currentDragOrderRef.current.indexOf(draggedModuleId);

    // Animate to the final grid position
    const finalPos = getGridPosition(finalIndex);
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
      setDraggingIndex(null);
    });
  }, [getGridPosition, dragPosition, dragScale]);

  // Create PanResponder for each grid item (only active in wiggle mode)
  const createItemPanResponder = useCallback((index: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => isWiggleMode,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Only capture if moved more than 5pt (prevent accidental drags)
        return isWiggleMode && (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5);
      },
      onPanResponderGrant: (evt, gestureState) => {
        handleDragStart(index, evt, gestureState);
      },
      onPanResponderMove: (evt, gestureState) => {
        handleDragMove(index, evt, gestureState);
      },
      onPanResponderRelease: (evt, gestureState) => {
        handleDragEnd(index, evt, gestureState);
      },
      onPanResponderTerminate: (evt, gestureState) => {
        handleDragEnd(index, evt, gestureState);
      },
    });
  }, [isWiggleMode, handleDragStart, handleDragMove, handleDragEnd]);

  // Store pan responders per index (recreated when wiggle mode or order changes)
  const panResponders = useMemo(() => {
    if (!isWiggleMode) return {};
    const responders: Record<number, ReturnType<typeof PanResponder.create>> = {};
    displayModules.forEach((_moduleId, index) => {
      responders[index] = createItemPanResponder(index);
    });
    return responders;
  }, [isWiggleMode, displayModules, createItemPanResponder]);

  // Handle grid layout measurement
  const handleGridLayout = useCallback((event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    // We need the position on screen, not relative to parent
    // Use measure for accurate screen coordinates
    gridRef.current?.measureInWindow((wx, wy) => {
      gridLayoutRef.current = { x: wx, y: wy, width, height };
    });
  }, []);

  const gridRef = useRef<View>(null);

  if (!isLoaded) {
    return <LoadingView fullscreen />;
  }

  const isPaneVariant = variant === 'pane';
  const Wrapper = isPaneVariant ? View : SafeAreaView;

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
        scrollEnabled={!isWiggleMode} // Disable scroll during reorder
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <View
          ref={gridRef}
          style={styles.grid}
          onLayout={handleGridLayout}
        >
          {displayModules.map((moduleId, index) => {
            const isDragging = draggingIndex !== null &&
              currentDragOrderRef.current[dragStartIndexRef.current] === moduleId &&
              draggingIndex !== null;

            return (
              <View
                key={moduleId}
                style={[isDragging && styles.placeholderItem]}
                {...(isWiggleMode && panResponders[index]
                  ? panResponders[index].panHandlers
                  : {})}
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
                  isDragging={isDragging}
                  onPress={() => handleModulePress(moduleId)}
                  onLongPress={isWiggleMode ? undefined : handleEnterWiggleMode}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Dragged item overlay — follows the finger */}
      {draggingIndex !== null && (
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
          {(() => {
            const draggedModuleId = currentDragOrderRef.current[dragStartIndexRef.current];
            if (!draggedModuleId) return null;
            return (
              <HomeGridItem
                moduleId={draggedModuleId}
                icon={getIconName(draggedModuleId)}
                label={getLabel(draggedModuleId)}
                color={getModuleColor(draggedModuleId)}
                badgeCount={getBadgeCount(draggedModuleId)}
                isAudioActive={false}
                isWiggling={false}
                isSelected={false}
                isDragging={false}
                onPress={() => {}}
              />
            );
          })()}
        </Animated.View>
      )}

      {/* Mini-player — shown when audio is playing (fullscreen variant only) */}
      {!isPaneVariant && !isWiggleMode && (
        <HomeMiniPlayer onPress={onModulePress} />
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
    gap: GRID_GAP,
  },
  placeholderItem: {
    opacity: 0.15,
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
