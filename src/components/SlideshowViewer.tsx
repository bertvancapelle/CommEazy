/**
 * SlideshowViewer — Digital photo frame / "Fotolijst" mode
 *
 * Fullscreen slideshow for seniors with:
 * - Configurable interval (3s / 5s / 10s / 30s)
 * - Shuffle or chronological order
 * - Auto-hide controls after 3s inactivity (tap to show)
 * - KeepAwake during playback
 * - Crossfade transitions (direct if Reduce Motion)
 * - Date overlay on photos
 *
 * @see .claude/plans/PHOTO_ALBUM_OPTIMIZATION.md Phase 4.1
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  // Modal removed — using PanelAwareModal
  Image,
  StatusBar,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { PanelAwareModal } from './PanelAwareModal';
import { useTranslation } from 'react-i18next';
import KeepAwake from 'react-native-keep-awake';

import { typography, spacing, borderRadius, touchTargets } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { HapticTouchable } from './HapticTouchable';
import { Icon } from './Icon';
import { LiquidGlassView } from './LiquidGlassView';

// ============================================================
// Constants
// ============================================================

/** Available slideshow intervals in seconds */
const INTERVALS = [3, 5, 10, 30] as const;
type SlideshowInterval = typeof INTERVALS[number];

/** Default interval */
const DEFAULT_INTERVAL: SlideshowInterval = 5;

/** Time before controls auto-hide (ms) */
const CONTROLS_HIDE_DELAY = 3000;

/** Crossfade animation duration (ms) */
const CROSSFADE_DURATION = 600;

// ============================================================
// Types
// ============================================================

export interface SlideshowPhoto {
  /** Unique photo ID */
  id: string;
  /** Full-resolution URI */
  uri: string;
  /** Photo timestamp (epoch ms) */
  timestamp: number;
}

export interface SlideshowViewerProps {
  /** Whether the slideshow modal is visible */
  visible: boolean;
  /** Photos to display */
  photos: SlideshowPhoto[];
  /** Callback when slideshow is closed */
  onClose: () => void;
  /** Module accent color */
  accentColor?: string;
}

// ============================================================
// Date formatting helper
// ============================================================

function formatPhotoDate(timestamp: number, locale: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isThisYear = date.getFullYear() === now.getFullYear();

  try {
    if (isThisYear) {
      return date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
      });
    }
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    // Fallback for unsupported locales
    return date.toLocaleDateString();
  }
}

// ============================================================
// Component
// ============================================================

export function SlideshowViewer({
  visible,
  photos,
  onClose,
  accentColor = '#4CAF50',
}: SlideshowViewerProps) {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Slideshow state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [interval, setInterval_] = useState<SlideshowInterval>(DEFAULT_INTERVAL);
  const [isShuffle, setIsShuffle] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shuffled order
  const shuffledOrder = useMemo(() => {
    if (!isShuffle || photos.length === 0) return null;
    const indices = photos.map((_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [isShuffle, photos.length]);

  // Get the actual photo index (considering shuffle)
  const getPhotoIndex = useCallback((displayIndex: number): number => {
    if (shuffledOrder) {
      return shuffledOrder[displayIndex % shuffledOrder.length];
    }
    return displayIndex;
  }, [shuffledOrder]);

  // Current photo
  const currentPhoto = useMemo(() => {
    if (photos.length === 0) return null;
    const photoIdx = getPhotoIndex(currentIndex);
    return photos[photoIdx];
  }, [photos, currentIndex, getPhotoIndex]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      setIsPlaying(true);
      setControlsVisible(true);
      fadeAnim.setValue(1);
      controlsOpacity.setValue(1);
    } else {
      // Cleanup timers when closing
      if (timerRef.current) clearTimeout(timerRef.current);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    }
  }, [visible, fadeAnim, controlsOpacity]);

  // Auto-advance timer
  useEffect(() => {
    if (!visible || !isPlaying || photos.length <= 1) return;

    timerRef.current = setTimeout(() => {
      // Advance to next photo
      const nextIndex = (currentIndex + 1) % photos.length;

      if (reduceMotion) {
        // Direct switch — no animation
        setCurrentIndex(nextIndex);
      } else {
        // Crossfade transition
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: CROSSFADE_DURATION / 2,
          useNativeDriver: true,
        }).start(() => {
          setCurrentIndex(nextIndex);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: CROSSFADE_DURATION / 2,
            useNativeDriver: true,
          }).start();
        });
      }
    }, interval * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, isPlaying, currentIndex, interval, photos.length, reduceMotion, fadeAnim]);

  // Auto-hide controls
  const scheduleControlsHide = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);

    controlsTimerRef.current = setTimeout(() => {
      if (reduceMotion) {
        setControlsVisible(false);
      } else {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setControlsVisible(false));
      }
    }, CONTROLS_HIDE_DELAY);
  }, [reduceMotion, controlsOpacity]);

  // Show controls and schedule hide
  const showControls = useCallback(() => {
    setControlsVisible(true);
    controlsOpacity.setValue(1);
    scheduleControlsHide();
  }, [controlsOpacity, scheduleControlsHide]);

  // Initially schedule hiding controls
  useEffect(() => {
    if (visible && isPlaying) {
      scheduleControlsHide();
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [visible, isPlaying, scheduleControlsHide]);

  // Toggle play/pause
  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => {
      const newState = !prev;
      if (!newState) {
        // Paused — keep controls visible
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      } else {
        // Playing — schedule hide
        scheduleControlsHide();
      }
      return newState;
    });
  }, [scheduleControlsHide]);

  // Cycle interval
  const handleCycleInterval = useCallback(() => {
    setInterval_(prev => {
      const idx = INTERVALS.indexOf(prev);
      return INTERVALS[(idx + 1) % INTERVALS.length];
    });
    showControls();
  }, [showControls]);

  // Toggle shuffle
  const handleToggleShuffle = useCallback(() => {
    setIsShuffle(prev => !prev);
    setCurrentIndex(0);
    showControls();
  }, [showControls]);

  // Handle tap on photo area (toggle controls)
  const handleTapArea = useCallback(() => {
    if (controlsVisible) {
      // Hide controls immediately
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      if (reduceMotion) {
        setControlsVisible(false);
      } else {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setControlsVisible(false));
      }
    } else {
      showControls();
    }
  }, [controlsVisible, reduceMotion, controlsOpacity, showControls]);

  // Handle close
  const handleClose = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    onClose();
  }, [onClose]);

  if (photos.length === 0) return null;

  return (
    <PanelAwareModal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={handleClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <StatusBar hidden />
      {visible && <KeepAwake />}

      <LiquidGlassView moduleId="photos" style={styles.container} cornerRadius={0}>
        {/* Photo */}
        <HapticTouchable
          style={styles.photoArea}
          onPress={handleTapArea}
          hapticDisabled
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel={
            controlsVisible
              ? t('modules.photoAlbum.slideshowHideControls', 'Tap to hide controls')
              : t('modules.photoAlbum.slideshowShowControls', 'Tap to show controls')
          }
        >
          {currentPhoto && (
            <Animated.View style={[styles.photoWrapper, { opacity: fadeAnim }]}>
              <Image
                source={{ uri: currentPhoto.uri }}
                style={[styles.photo, { width: screenWidth, height: screenHeight }]}
                resizeMode="contain"
              />
            </Animated.View>
          )}
        </HapticTouchable>

        {/* Date overlay (always visible) */}
        {currentPhoto && (
          <View style={styles.dateOverlay} pointerEvents="none">
            <Text style={styles.dateText}>
              {formatPhotoDate(currentPhoto.timestamp, i18n.language)}
            </Text>
          </View>
        )}

        {/* Counter overlay (always visible) */}
        {photos.length > 1 && (
          <View style={styles.counterOverlay} pointerEvents="none">
            <Text style={styles.counterText}>
              {`${(getPhotoIndex(currentIndex)) + 1} / ${photos.length}`}
            </Text>
          </View>
        )}

        {/* Controls overlay */}
        {controlsVisible && (
          <Animated.View
            style={[styles.controlsOverlay, { opacity: controlsOpacity }]}
            pointerEvents="box-none"
          >
            {/* Close button (top-left) */}
            <View style={styles.topBar}>
              <HapticTouchable
                style={styles.closeButton}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel={t('modules.photoAlbum.slideshowStop', 'Stop')}
              >
                <Text style={styles.closeButtonText}>{t('common.close')}</Text>
              </HapticTouchable>
            </View>

            {/* Bottom controls */}
            <View style={styles.bottomBar}>
              {/* Play/Pause */}
              <HapticTouchable
                style={[styles.controlButton, styles.controlButtonLarge]}
                onPress={handlePlayPause}
                accessibilityRole="button"
                accessibilityLabel={
                  isPlaying
                    ? t('modules.photoAlbum.slideshowPause', 'Pause')
                    : t('modules.photoAlbum.slideshowResume', 'Resume')
                }
              >
                <Icon
                  name={isPlaying ? 'pause' : 'play'}
                  size={32}
                  color="#FFFFFF"
                />
              </HapticTouchable>

              {/* Interval selector */}
              <HapticTouchable
                style={styles.controlButton}
                onPress={handleCycleInterval}
                accessibilityRole="button"
                accessibilityLabel={t('modules.photoAlbum.slideshowInterval', 'Interval') + `: ${interval}s`}
              >
                <Icon name="clock" size={24} color="#FFFFFF" />
                <Text style={styles.controlButtonText}>
                  {t('modules.photoAlbum.slideshowSeconds', '{{count}}s', { count: interval })}
                </Text>
              </HapticTouchable>

              {/* Shuffle toggle */}
              <HapticTouchable
                style={[
                  styles.controlButton,
                  isShuffle && { backgroundColor: accentColor },
                ]}
                onPress={handleToggleShuffle}
                accessibilityRole="button"
                accessibilityLabel={t('modules.photoAlbum.slideshowShuffle', 'Shuffle')}
                accessibilityState={{ selected: isShuffle }}
              >
                <Icon name="shuffle" size={24} color="#FFFFFF" />
              </HapticTouchable>
            </View>
          </Animated.View>
        )}
      </LiquidGlassView>
    </PanelAwareModal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  photoArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    flex: 1,
  },
  dateOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dateText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  counterOverlay: {
    position: 'absolute',
    top: 60,
    right: spacing.lg,
  },
  counterText: {
    ...typography.label,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: 50,
    paddingHorizontal: spacing.md,
  },
  closeButton: {
    height: touchTargets.comfortable,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: 50,
    paddingHorizontal: spacing.lg,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minWidth: touchTargets.minimum,
    height: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  controlButtonLarge: {
    width: touchTargets.comfortable,
    height: touchTargets.comfortable,
    paddingHorizontal: 0,
  },
  controlButtonText: {
    ...typography.label,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default SlideshowViewer;
