/**
 * HomeScreen — iPhone-style app grid as the main start screen
 *
 * Displays all modules in a 3-column scrollable grid.
 * Supports:
 * - User-defined order via swap reordering (Fase 5)
 * - Notification badges on communication modules (Fase 6)
 * - Audio activity indicator on playing modules
 * - Mini-player bar when audio is active (Fase 7)
 * - Wiggle mode for reordering (Fase 5)
 * - iPad pane variant (compact, no branding) (Fase 4)
 *
 * Senior-inclusive design:
 * - Large touch targets (96×96pt cells)
 * - 72pt colored circles with 48pt icons
 * - Labels: 14pt, max 2 lines, auto-shrink
 * - Scrollable (no pagination)
 *
 * Reorder mode:
 * - Long-press (800ms) activates wiggle mode
 * - Tap first item → selected (highlighted)
 * - Tap second item → items swap positions
 * - "Klaar" button exits wiggle mode and saves order
 *
 * @see .claude/plans/HOMESCREEN_GRID_NAVIGATION.md
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { HomeGridItem } from '@/components/HomeGridItem';
import { HomeMiniPlayer } from '@/components/HomeMiniPlayer';
import {
  STATIC_MODULE_DEFINITIONS,
  mapModuleIconToIconName,
} from '@/components/WheelNavigationMenu';
import type {
  NavigationDestination,
  StaticNavigationDestination,
} from '@/components/WheelNavigationMenu';
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

const GRID_GAP = 12;
const GRID_PADDING_H = spacing.md; // 16pt

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
  const [selectedModuleId, setSelectedModuleId] = useState<NavigationDestination | null>(null);
  // Local order for reordering (only used during wiggle mode)
  const [localOrder, setLocalOrder] = useState<NavigationDestination[]>([]);

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

  // Enter wiggle mode (long-press on any grid item)
  const handleEnterWiggleMode = useCallback(() => {
    void triggerFeedback('warning'); // Strong haptic for mode change
    setLocalOrder([...orderedModules]);
    setIsWiggleMode(true);
    setSelectedModuleId(null);
  }, [orderedModules, triggerFeedback]);

  // Exit wiggle mode and save order
  const handleExitWiggleMode = useCallback(async () => {
    void triggerFeedback('success');
    setIsWiggleMode(false);
    setSelectedModuleId(null);
    // Save the new order
    await updateOrder(localOrder);
  }, [localOrder, updateOrder, triggerFeedback]);

  // Handle tap during wiggle mode (swap logic)
  const handleWiggleTap = useCallback((moduleId: NavigationDestination) => {
    if (!selectedModuleId) {
      // First tap: select this item
      void triggerFeedback('tap');
      setSelectedModuleId(moduleId);
    } else if (selectedModuleId === moduleId) {
      // Tap same item: deselect
      void triggerFeedback('tap');
      setSelectedModuleId(null);
    } else {
      // Second tap on different item: swap positions
      void triggerFeedback('success');
      setLocalOrder(prev => {
        const newOrder = [...prev];
        const indexA = newOrder.indexOf(selectedModuleId);
        const indexB = newOrder.indexOf(moduleId);
        if (indexA !== -1 && indexB !== -1) {
          newOrder[indexA] = moduleId;
          newOrder[indexB] = selectedModuleId;
        }
        return newOrder;
      });
      setSelectedModuleId(null);
    }
  }, [selectedModuleId, triggerFeedback]);

  // Handle module press — navigate or swap depending on mode
  const handleModulePress = useCallback((moduleId: NavigationDestination) => {
    if (isWiggleMode) {
      handleWiggleTap(moduleId);
    } else {
      onModulePress(moduleId);
    }
  }, [isWiggleMode, handleWiggleTap, onModulePress]);

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
            {selectedModuleId
              ? t('homeScreen.tapToSwap', 'Tik op een ander icoon om te wisselen')
              : t('homeScreen.tapToSelect', 'Tik op een icoon om te verplaatsen')}
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
      >
        <View style={styles.grid}>
          {displayModules.map((moduleId) => (
            <HomeGridItem
              key={moduleId}
              moduleId={moduleId}
              icon={getIconName(moduleId)}
              label={getLabel(moduleId)}
              color={getModuleColor(moduleId)}
              badgeCount={getBadgeCount(moduleId)}
              isAudioActive={!isWiggleMode && activeAudioModule === moduleId}
              isWiggling={isWiggleMode}
              isSelected={selectedModuleId === moduleId}
              onPress={() => handleModulePress(moduleId)}
              onLongPress={isWiggleMode ? undefined : handleEnterWiggleMode}
            />
          ))}
        </View>
      </ScrollView>

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
});
