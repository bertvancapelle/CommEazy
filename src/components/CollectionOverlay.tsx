/**
 * CollectionOverlay — iOS folder-style overlay for module collections
 *
 * Opens when a user taps a collection folder on the HomeScreen grid.
 * Displays the collection's modules in a 3-column grid with Liquid Glass
 * background on iOS 26+ (solid color fallback elsewhere).
 *
 * Uses the standard modal pattern (PanelAwareModal + LiquidGlassView + ModalLayout)
 * consistent with QueueView, ContactSelectionModal, and other app modals.
 *
 * Senior-inclusive design:
 * - Touch targets ≥60pt for all module items
 * - Title text 24pt bold
 * - Close by tapping close button or Android back
 * - animationType="slide" for consistent UX across all modals
 *
 * @see src/hooks/useModuleCollections.ts
 * @see src/components/LiquidGlassView.tsx
 * @see .claude/plans/MODULE_COLLECTIONS_AND_GAMES.md — Fase 4
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { PanelAwareModal } from './PanelAwareModal';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticTouchable } from '@/components/HapticTouchable';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { ModalLayout } from '@/components/ModalLayout';
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
import { spacing, touchTargets, borderRadius } from '@/theme';

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
  const insets = useSafeAreaInsets();
  const moduleColors = useModuleColorsContextSafe();

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
      animationType="slide"
      onRequestClose={onClose}
    >
      <LiquidGlassView
        moduleId={collectionModuleId as ModuleColorId}
        glassStyle="regular"
        cornerRadius={0}
        style={styles.overlay}
      >
        <ModalLayout
          headerBlock={
            <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
              {/* Header row: title + close button */}
              <View style={styles.headerRow}>
                <Text
                  style={styles.title}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {collectionTitle}
                </Text>
                <HapticTouchable
                  onPress={onClose}
                  hapticType="tap"
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                >
                  <Text style={styles.closeButtonText}>{t('common.close')}</Text>
                </HapticTouchable>
              </View>
            </View>
          }
          contentBlock={
            <View style={styles.contentContainer}>
              {/* Module grid — centered */}
              <View style={styles.gridWrapper}>
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
              </View>
            </View>
          }
        />
      </LiquidGlassView>
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
  overlay: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTargets.minimum,
  },
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: spacing.md,
  },
  closeButton: {
    minWidth: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: GRID_PADDING,
  },
  gridWrapper: {
    alignItems: 'center',
  },
  grid: {
    gap: GRID_GAP,
    width: OVERLAY_WIDTH - GRID_PADDING * 2,
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
