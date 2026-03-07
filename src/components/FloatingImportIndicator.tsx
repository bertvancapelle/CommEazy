/**
 * FloatingImportIndicator — Floating overlay for Apple Music playlist import
 *
 * Shows import progress as a collapsible floating indicator on the right side
 * of the screen. User can navigate freely while import runs in background.
 *
 * States:
 * 1. Hidden: Not importing → component returns null
 * 2. Collapsed: Spinning wheel only (~60pt circle) on right edge, center-Y
 * 3. Expanded: Shows "X/Y — playlist name" next to the wheel (tap to toggle)
 * 4. Complete: Green checkmark for 3 seconds, then auto-disappear
 *
 * Reads state from PlaylistImportContext (producer: AppleMusicScreen).
 *
 * Senior-inclusive design:
 * - 60pt minimum touch target
 * - Clear visual feedback (spinner → checkmark)
 * - Non-blocking — user can use the app normally
 * - Tap to expand/collapse for more detail
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing, shadows, zIndex } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useReducedMotionContext } from '@/contexts/ReducedMotionContext';
import { usePlaylistImportContextSafe } from '@/contexts/PlaylistImportContext';
import { HapticTouchable } from './HapticTouchable';
import { Icon } from './Icon';

// ============================================================
// Constants
// ============================================================

const INDICATOR_SIZE = 60; // 60pt touch target
const EXPANDED_MAX_WIDTH = 280;
const COMPLETION_DISPLAY_MS = 3000;
const FADE_DURATION_MS = 300;
const EXPAND_DURATION_MS = 250;
const RIGHT_MARGIN = 12;

// ============================================================
// Component
// ============================================================

export function FloatingImportIndicator() {
  const { t } = useTranslation();
  const themeColors = useColors();
  const reducedMotion = useReducedMotionContext();
  const importContext = usePlaylistImportContextSafe();

  const isImporting = importContext?.isImporting ?? false;
  const importProgress = importContext?.importProgress ?? null;

  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Track previous importing state to detect completion
  const wasImportingRef = useRef(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Spin animation loop
  useEffect(() => {
    if (!isImporting || reducedMotion) return;

    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => spin.stop();
  }, [isImporting, reducedMotion, spinAnim]);

  // Show/hide based on importing state
  useEffect(() => {
    if (isImporting && !isVisible) {
      // Start importing → show indicator
      setIsVisible(true);
      setShowComplete(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: reducedMotion ? 0 : FADE_DURATION_MS,
        useNativeDriver: true,
      }).start();
    }

    if (wasImportingRef.current && !isImporting) {
      // Import just finished → show completion state
      setShowComplete(true);
      setIsExpanded(false);

      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: reducedMotion ? 0 : FADE_DURATION_MS,
          useNativeDriver: true,
        }).start(() => {
          setIsVisible(false);
          setShowComplete(false);
        });
      }, COMPLETION_DISPLAY_MS);

      return () => clearTimeout(timer);
    }

    wasImportingRef.current = isImporting;
  }, [isImporting, isVisible, fadeAnim, reducedMotion]);

  // Expand/collapse animation
  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: reducedMotion ? 0 : EXPAND_DURATION_MS,
      useNativeDriver: false, // width animation can't use native driver
    }).start();
  }, [isExpanded, expandAnim, reducedMotion]);

  // Toggle expand/collapse
  const handlePress = useCallback(() => {
    if (showComplete) return; // Don't toggle during completion
    setIsExpanded(prev => !prev);
  }, [showComplete]);

  // Don't render when not visible or no context
  if (!isVisible || !importContext) return null;

  // Compute progress text
  const progressText = importProgress
    ? `${importProgress.current}/${importProgress.total}`
    : '';
  const playlistName = importProgress?.currentName || '';
  const trackCount = importProgress?.currentTrackCount;

  // Spin interpolation
  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Width interpolation for expand/collapse
  const containerWidth = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [INDICATOR_SIZE, EXPANDED_MAX_WIDTH],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View style={{ width: containerWidth }}>
      <HapticTouchable
        style={[
          styles.indicator,
          {
            backgroundColor: showComplete
              ? themeColors.success || '#1B5E20'
              : themeColors.surface,
            borderColor: showComplete
              ? themeColors.success || '#1B5E20'
              : themeColors.border,
          },
          shadows.medium,
        ]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={
          showComplete
            ? t('appleMusic.import.floatingComplete', 'Import voltooid')
            : isExpanded && importProgress
              ? t('appleMusic.import.floatingProgress', '{{current}} van {{total}}: {{name}}', {
                  current: importProgress.current,
                  total: importProgress.total,
                  name: playlistName,
                })
              : t('appleMusic.import.floatingImporting', 'Bezig met importeren')
        }
        accessibilityHint={
          showComplete
            ? undefined
            : t('appleMusic.import.floatingHint', 'Tik om details te tonen')
        }
      >
        {/* Icon area: spinner or checkmark */}
        <View style={styles.iconContainer}>
          {showComplete ? (
            <Icon name="checkmark" size={28} color="#FFFFFF" />
          ) : (
            <Animated.View
              style={
                reducedMotion
                  ? undefined
                  : { transform: [{ rotate: spinInterpolation }] }
              }
            >
              <ActivityIndicator
                size="small"
                color={themeColors.primary}
              />
            </Animated.View>
          )}
        </View>

        {/* Expanded content */}
        {isExpanded && !showComplete && (
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
            {trackCount != null && trackCount > 0 ? (
              <Text
                style={[styles.trackCount, { color: themeColors.textSecondary }]}
                numberOfLines={1}
              >
                {t('appleMusic.import.floatingTrackCount', '{{count}} nummers', { count: trackCount })}
              </Text>
            ) : null}
          </View>
        )}

        {/* Complete text */}
        {showComplete && (
          <View style={styles.expandedContent}>
            <Text
              style={[styles.completeText, { color: '#FFFFFF' }]}
              numberOfLines={1}
            >
              {t('appleMusic.import.floatingDone', 'Klaar!')}
            </Text>
          </View>
        )}
      </HapticTouchable>
      </Animated.View>
    </Animated.View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: RIGHT_MARGIN,
    top: '45%', // Roughly vertically centered
    zIndex: zIndex.toast,
    elevation: 10,
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
  trackCount: {
    ...typography.small,
  },
  completeText: {
    ...typography.label,
    fontWeight: '700',
  },
});
