/**
 * CollectionOverlay — iOS folder-style overlay for module collections
 *
 * Opens when a user taps a collection folder on the HomeScreen grid.
 * Displays the collection's modules in a 3-column grid with Liquid Glass
 * background on iOS 26+ (solid color fallback elsewhere).
 *
 * Senior-inclusive design:
 * - Touch targets ≥60pt for all module items
 * - Title text 24pt bold
 * - Spring animation (respects reduced motion)
 * - Close by tapping outside or pressing close button
 *
 * @see src/hooks/useModuleCollections.ts
 * @see src/components/LiquidGlassView.tsx
 * @see .claude/plans/MODULE_COLLECTIONS_AND_GAMES.md — Fase 4
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  // Modal removed — using PanelAwareModal
  Animated,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { PanelAwareModal } from './PanelAwareModal';
import { useTranslation } from 'react-i18next';
import { HapticTouchable } from '@/components/HapticTouchable';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import {
  STATIC_MODULE_DEFINITIONS,
  mapModuleIconToIconName,
} from '@/types/navigation';
import type {
  NavigationDestination,
  ModuleCollection,
  StaticNavigationDestination,
} from '@/types/navigation';
import { isDynamicDestination } from '@/types/navigation';
import { useModuleColorsContextSafe } from '@/contexts/ModuleColorsContext';
import { MODULE_TINT_COLORS, type ModuleColorId } from '@/types/liquidGlass';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { spacing, touchTargets } from '@/theme';

// ============================================================
// Types
// ============================================================

export interface CollectionOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** The collection to display */
  collection: ModuleCollection | null;
  /** Called when the overlay should close */
  onClose: () => void;
  /** Called when a module inside the collection is tapped */
  onModulePress: (moduleId: NavigationDestination) => void;
}

// ============================================================
// Constants
// ============================================================

const SCREEN_WIDTH = Dimensions.get('window').width;
const OVERLAY_HORIZONTAL_MARGIN = 24;
const OVERLAY_WIDTH = SCREEN_WIDTH - OVERLAY_HORIZONTAL_MARGIN * 2;
const OVERLAY_CORNER_RADIUS = 24;

const GRID_COLUMNS = 3;
const GRID_GAP = 12;
const GRID_PADDING = spacing.md; // 16pt
const ITEM_ICON_SIZE = 48;
const ITEM_CIRCLE_SIZE = 72;
const ITEM_LABEL_FONT_SIZE = 14;
const TITLE_FONT_SIZE = 24;

// ============================================================
// Component
// ============================================================

export function CollectionOverlay({
  visible,
  collection,
  onClose,
  onModulePress,
}: CollectionOverlayProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const moduleColors = useModuleColorsContextSafe();

  // Animation values
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const dimAnim = useRef(new Animated.Value(0)).current;

  // Get module color — mirrors HomeScreen logic
  const getModuleColor = useCallback(
    (moduleId: string): string => {
      if (moduleColors) {
        return moduleColors.getModuleHex(moduleId as ModuleColorId);
      }
      return (
        MODULE_TINT_COLORS[moduleId as keyof typeof MODULE_TINT_COLORS]
          ?.tintColor || '#607D8B'
      );
    },
    [moduleColors],
  );

  // Get icon name for a module
  const getIconName = useCallback((moduleId: NavigationDestination): IconName => {
    if (isDynamicDestination(moduleId)) {
      return 'news';
    }
    const def = STATIC_MODULE_DEFINITIONS[moduleId as StaticNavigationDestination];
    return def ? mapModuleIconToIconName(def.icon) : 'info';
  }, []);

  // Get translated label for a module
  const getLabel = useCallback(
    (moduleId: NavigationDestination): string => {
      if (isDynamicDestination(moduleId)) {
        return moduleId;
      }
      const def = STATIC_MODULE_DEFINITIONS[moduleId as StaticNavigationDestination];
      return def ? t(def.labelKey) : moduleId;
    },
    [t],
  );

  // Animate open/close
  useEffect(() => {
    if (visible) {
      // Open animation
      const springConfig = reduceMotion
        ? { toValue: 1, duration: 150, useNativeDriver: true }
        : { toValue: 1, speed: 18, bounciness: 4, useNativeDriver: true };

      Animated.parallel([
        Animated.timing(dimAnim, {
          toValue: 1,
          duration: reduceMotion ? 100 : 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: reduceMotion ? 100 : 200,
          useNativeDriver: true,
        }),
        reduceMotion
          ? Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            })
          : Animated.spring(scaleAnim, springConfig),
      ]).start();
    } else {
      // Close animation
      Animated.parallel([
        Animated.timing(dimAnim, {
          toValue: 0,
          duration: reduceMotion ? 100 : 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: reduceMotion ? 100 : 180,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: reduceMotion ? 100 : 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, reduceMotion, scaleAnim, opacityAnim, dimAnim]);

  // Handle module press inside overlay
  const handleModulePress = useCallback(
    (moduleId: NavigationDestination) => {
      onModulePress(moduleId);
      onClose();
    },
    [onModulePress, onClose],
  );

  if (!collection) return null;

  // Determine collection color — use first module's color as tint
  const collectionModuleId =
    collection.moduleIds.length > 0
      ? collection.moduleIds[0]
      : ('woordraad' as NavigationDestination);

  // Translate collection name
  const collectionTitle = collection.name.startsWith('collections.')
    ? t(collection.name)
    : collection.name;

  // Build grid items
  const modules = collection.moduleIds;
  const rows: NavigationDestination[][] = [];
  for (let i = 0; i < modules.length; i += GRID_COLUMNS) {
    rows.push(modules.slice(i, i + GRID_COLUMNS));
  }

  return (
    <PanelAwareModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dim background — tap to close */}
      <Pressable style={styles.dimBackground} onPress={onClose}>
        <Animated.View
          style={[styles.dimLayer, { opacity: dimAnim }]}
        />
      </Pressable>

      {/* Centered glass container */}
      <View style={styles.centeredContainer} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.overlayContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: reduceMotion ? 1 : scaleAnim }],
            },
          ]}
        >
          <LiquidGlassView
            moduleId={collectionModuleId as ModuleColorId}
            glassStyle="regular"
            cornerRadius={OVERLAY_CORNER_RADIUS}
            style={styles.glassContainer}
          >
            {/* Close button */}
            <View style={styles.closeButtonRow}>
              <HapticTouchable
                onPress={onClose}
                hapticType="tap"
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Icon name="x" size={24} color="#FFFFFF" />
              </HapticTouchable>
            </View>

            {/* Title */}
            <Text
              style={styles.title}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {collectionTitle}
            </Text>

            {/* Module grid */}
            <View style={styles.grid}>
              {rows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.gridRow}>
                  {row.map((moduleId) => (
                    <HapticTouchable
                      key={moduleId}
                      onPress={() => handleModulePress(moduleId)}
                      hapticType="tap"
                      style={styles.gridItem}
                      accessibilityRole="button"
                      accessibilityLabel={getLabel(moduleId)}
                    >
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: getModuleColor(moduleId) },
                        ]}
                      >
                        <Icon
                          name={getIconName(moduleId)}
                          size={ITEM_ICON_SIZE}
                          color="#FFFFFF"
                        />
                      </View>
                      <Text
                        style={styles.itemLabel}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                      >
                        {getLabel(moduleId)}
                      </Text>
                    </HapticTouchable>
                  ))}
                  {/* Fill empty cells for alignment */}
                  {row.length < GRID_COLUMNS &&
                    Array.from({ length: GRID_COLUMNS - row.length }).map(
                      (_, i) => (
                        <View key={`empty-${i}`} style={styles.gridItem} />
                      ),
                    )}
                </View>
              ))}
            </View>
          </LiquidGlassView>
        </Animated.View>
      </View>
    </PanelAwareModal>
  );
}

// ============================================================
// Styles
// ============================================================

const ITEM_CELL_WIDTH =
  (OVERLAY_WIDTH - GRID_PADDING * 2 - (GRID_COLUMNS - 1) * GRID_GAP) /
  GRID_COLUMNS;

const styles = StyleSheet.create({
  dimBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  dimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContainer: {
    width: OVERLAY_WIDTH,
    maxHeight: 540,
  },
  glassContainer: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: GRID_PADDING + spacing.sm,
    paddingTop: spacing.sm,
  },
  closeButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.xs,
  },
  closeButton: {
    width: touchTargets.minimum,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  grid: {
    gap: GRID_GAP,
  },
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  gridItem: {
    width: ITEM_CELL_WIDTH,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
  },
  iconCircle: {
    width: ITEM_CIRCLE_SIZE,
    height: ITEM_CIRCLE_SIZE,
    borderRadius: ITEM_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  itemLabel: {
    fontSize: ITEM_LABEL_FONT_SIZE,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: ITEM_CELL_WIDTH - 4,
  },
});
