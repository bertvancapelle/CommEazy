/**
 * FloatingImportIndicator — Draggable floating overlay for Apple Music playlist import
 *
 * Shows import progress as a draggable floating indicator. User can navigate
 * freely while import runs in background.
 *
 * States:
 * 1. Hidden: Not importing and no result → component returns null
 * 2. Importing: Spinner + progress text, collapsible via tap
 * 3. Success: Green card with "✓ Geslaagd" + two buttons (Bekijk / Sluiten)
 * 4. Failure: Orange card with partial import info + two buttons (Opnieuw / Bewaar)
 *
 * Draggable: PanResponder pattern from DraggableMenuButton.
 * Snaps to left/right edge on release.
 *
 * Reads state from PlaylistImportContext (producer: AppleMusicScreen).
 *
 * Senior-inclusive design:
 * - 60pt minimum touch target
 * - Clear visual feedback (spinner → checkmark/warning)
 * - Non-blocking — user can use the app normally
 * - Draggable — user can move out of the way
 * - Action buttons ≥60pt touch targets
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { typography, spacing, shadows, zIndex, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useReducedMotionContext } from '@/contexts/ReducedMotionContext';
import { usePlaylistImportContextSafe } from '@/contexts/PlaylistImportContext';
import { HapticTouchable } from './HapticTouchable';
import { Icon } from './Icon';

// ============================================================
// Constants
// ============================================================

const INDICATOR_SIZE = 60;
const EXPANDED_WIDTH = 300;
const RESULT_CARD_WIDTH = 280;
const EDGE_PADDING = 12;
const FADE_DURATION_MS = 300;
const DRAG_THRESHOLD = 5;

// ============================================================
// Component
// ============================================================

export function FloatingImportIndicator() {
  const { t } = useTranslation();
  const themeColors = useColors();
  const reducedMotion = useReducedMotionContext();
  const insets = useSafeAreaInsets();
  const importContext = usePlaylistImportContextSafe();

  const isImporting = importContext?.isImporting ?? false;
  const importProgress = importContext?.importProgress ?? null;
  const importResult = importContext?.importResult ?? null;
  const onViewPlaylist = importContext?.onViewPlaylist ?? null;
  const dismissResult = importContext?.dismissResult;

  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Track previous importing state to detect completion
  const wasImportingRef = useRef(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Draggable state
  const pan = useRef(new Animated.ValueXY()).current;
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const hasMoved = useRef(false);

  // Track dimensions
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription.remove();
  }, []);

  // Initialize position (right side, vertical center)
  useEffect(() => {
    const x = dimensions.width - INDICATOR_SIZE - EDGE_PADDING;
    const y = dimensions.height * 0.45;
    pan.setValue({ x, y });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Snap to nearest horizontal edge (ref to avoid stale closure in PanResponder)
  const snapToEdgeRef = useRef((x: number, y: number) => ({ x, y }));
  snapToEdgeRef.current = useCallback(
    (x: number, y: number) => {
      const distanceToLeft = x + INDICATOR_SIZE / 2;
      const distanceToRight = dimensions.width - (x + INDICATOR_SIZE / 2);

      let snapX: number;
      if (distanceToLeft < distanceToRight) {
        snapX = EDGE_PADDING;
      } else {
        snapX = dimensions.width - INDICATOR_SIZE - EDGE_PADDING;
      }

      const topBound = insets.top + EDGE_PADDING;
      const bottomBound = dimensions.height - INDICATOR_SIZE - insets.bottom - EDGE_PADDING;
      const snapY = Math.max(topBound, Math.min(y, bottomBound));

      return { x: snapX, y: snapY };
    },
    [dimensions, insets],
  );

  // PanResponder for drag
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > DRAG_THRESHOLD || Math.abs(gestureState.dy) > DRAG_THRESHOLD;
      },
      onPanResponderGrant: () => {
        pan.extractOffset();
        hasMoved.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        hasMoved.current = true;
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        pan.stopAnimation((currentPosition) => {
          const snapped = snapToEdgeRef.current(currentPosition.x, currentPosition.y);
          Animated.spring(pan, {
            toValue: { x: snapped.x, y: snapped.y },
            tension: 100,
            friction: 10,
            useNativeDriver: false,
          }).start();
        });
      },
    }),
  ).current;

  // Show/hide based on importing state
  useEffect(() => {
    if (isImporting && !isVisible) {
      setIsVisible(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: reducedMotion ? 0 : FADE_DURATION_MS,
        useNativeDriver: true,
      }).start();
    }

    wasImportingRef.current = isImporting;
  }, [isImporting, isVisible, fadeAnim, reducedMotion]);

  // Show result card when import finishes
  useEffect(() => {
    if (importResult && !isImporting) {
      setIsVisible(true);
      setIsExpanded(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: reducedMotion ? 0 : FADE_DURATION_MS,
        useNativeDriver: true,
      }).start();
    }
  }, [importResult, isImporting, fadeAnim, reducedMotion]);

  // Toggle expand/collapse (only during import, not on result screen)
  const handlePress = useCallback(() => {
    if (importResult) return;
    setIsExpanded(prev => !prev);
  }, [importResult]);

  // Handle dismiss (hide indicator)
  const handleDismiss = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: reducedMotion ? 0 : FADE_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      dismissResult?.();
    });
  }, [fadeAnim, reducedMotion, dismissResult]);

  // Handle "View playlist" button
  const handleViewPlaylist = useCallback(() => {
    onViewPlaylist?.();
    handleDismiss();
  }, [onViewPlaylist, handleDismiss]);

  // Don't render when not visible or no context
  if (!isVisible || !importContext) return null;

  // Determine if we show the result card or the progress indicator
  const showResultCard = importResult && !isImporting;
  const isSuccess = showResultCard && importResult.result.failures === 0;

  // Progress info
  const progressText = importProgress
    ? `${importProgress.current}/${importProgress.total}`
    : '';
  const playlistName = importProgress?.currentName || '';

  return (
    <Animated.View
      style={[
        styles.outerContainer,
        { opacity: fadeAnim },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          { transform: pan.getTranslateTransform() },
        ]}
        {...panResponder.panHandlers}
      >
        {showResultCard ? (
          // Success / Failure result card
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: isSuccess
                  ? '#1B5E20'
                  : '#E65100',
              },
              shadows.medium,
            ]}
          >
            {/* Header icon + title */}
            <View style={styles.resultHeader}>
              <Icon
                name={isSuccess ? 'checkmark-circle' : 'warning'}
                size={32}
                color="#FFFFFF"
              />
              <Text style={styles.resultTitle}>
                {isSuccess
                  ? t('appleMusic.import.successTitle', 'Geslaagd')
                  : t('appleMusic.import.failureTitle', 'Gedeeltelijk geïmporteerd')}
              </Text>
            </View>

            {/* Details */}
            <Text style={styles.resultDetail}>
              {isSuccess
                ? t('appleMusic.import.successDetail', '{{songs}} nummers toegevoegd aan "{{name}}"', {
                    songs: importResult.result.songsAdded,
                    name: importResult.playlistName,
                  })
                : t('appleMusic.import.failureDetail', '{{songs}} van {{total}} nummers geïmporteerd', {
                    songs: importResult.result.songsAdded,
                    total: importResult.result.songsAdded + importResult.result.failures,
                  })}
            </Text>

            {/* Action buttons */}
            <View style={styles.resultButtons}>
              {isSuccess && onViewPlaylist ? (
                <HapticTouchable
                  style={[styles.resultButton, styles.resultButtonPrimary]}
                  onPress={handleViewPlaylist}
                  accessibilityRole="button"
                  accessibilityLabel={t('appleMusic.import.viewPlaylist', 'Bekijk afspeellijst')}
                >
                  <Icon name="musical-notes" size={18} color="#1B5E20" />
                  <Text style={[styles.resultButtonText, { color: '#1B5E20' }]}>
                    {t('appleMusic.import.viewPlaylist', 'Bekijk afspeellijst')}
                  </Text>
                </HapticTouchable>
              ) : null}

              <HapticTouchable
                style={[styles.resultButton, styles.resultButtonSecondary]}
                onPress={handleDismiss}
                accessibilityRole="button"
                accessibilityLabel={t('common.close', 'Sluiten')}
              >
                <Text style={styles.resultButtonTextSecondary}>
                  {t('common.close', 'Sluiten')}
                </Text>
              </HapticTouchable>
            </View>
          </View>
        ) : (
          // Progress indicator (importing)
          <HapticTouchable
            style={[
              styles.indicator,
              isExpanded && styles.indicatorExpanded,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
              },
              shadows.medium,
            ]}
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded && importProgress
                ? t('appleMusic.import.floatingProgress', '{{current}} van {{total}}: {{name}}', {
                    current: importProgress.current,
                    total: importProgress.total,
                    name: playlistName,
                  })
                : t('appleMusic.import.floatingImporting', 'Bezig met importeren')
            }
            accessibilityHint={t('appleMusic.import.floatingHint', 'Tik om details te tonen')}
          >
            <View style={styles.iconContainer}>
              <ActivityIndicator size="small" color={themeColors.primary} />
            </View>

            {isExpanded && (
              <View style={styles.expandedContent}>
                <Text
                  style={[styles.progressText, { color: themeColors.textPrimary }]}
                  numberOfLines={1}
                >
                  {progressText}
                </Text>
                {playlistName ? (
                  <Text
                    style={[styles.playlistName, { color: themeColors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {playlistName}
                  </Text>
                ) : null}
              </View>
            )}
          </HapticTouchable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  outerContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: zIndex.toast,
    elevation: 10,
    pointerEvents: 'box-none',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: INDICATOR_SIZE,
    minWidth: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  indicatorExpanded: {
    width: EXPANDED_WIDTH,
  },
  iconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedContent: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
  },
  progressText: {
    ...typography.label,
    fontWeight: '700',
  },
  playlistName: {
    ...typography.small,
    fontStyle: 'italic',
  },
  // Result card styles
  resultCard: {
    width: RESULT_CARD_WIDTH,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  resultTitle: {
    ...typography.h3,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  resultDetail: {
    ...typography.body,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  resultButtons: {
    gap: spacing.sm,
  },
  resultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
  },
  resultButtonPrimary: {
    backgroundColor: '#FFFFFF',
  },
  resultButtonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  resultButtonText: {
    ...typography.button,
    fontWeight: '700',
  },
  resultButtonTextSecondary: {
    ...typography.button,
    color: '#FFFFFF',
  },
});
