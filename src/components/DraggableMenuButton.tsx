/**
 * DraggableMenuButton — Repositionable menu button
 *
 * A floating action button that can be dragged to a new position.
 * Long-press enables drag mode, single tap opens navigation menu.
 *
 * Features:
 * - Snaps to screen edges when released
 * - Position is persisted for next session
 * - Accessible for left/right handed users
 * - Works with motor skill impairments
 *
 * @see .claude/skills/ui-designer/SKILL.md#hold-to-navigate
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Animated,
  PanResponder,
  StyleSheet,
  Dimensions,
  Text,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, touchTargets, borderRadius, shadows, typography } from '@/theme';
import { useHoldToNavigate } from '@/hooks/useHoldToNavigate';

// Button configuration
const BUTTON_SIZE = touchTargets.large; // 84pt for easy access
const EDGE_PADDING = 16;
const DRAG_ACTIVATION_DELAY = 500; // ms to hold before drag mode activates

interface DraggableMenuButtonProps {
  /** Called when the button is tapped (not dragged) */
  onPress?: () => void;
  /** Whether the button is visible */
  visible?: boolean;
  /** Test ID for testing */
  testID?: string;
}

export function DraggableMenuButton({
  onPress,
  visible = true,
  testID,
}: DraggableMenuButtonProps) {
  const { t } = useTranslation();
  const {
    settings,
    updateMenuButtonPosition,
    openNavigationMenu,
    triggerHaptic,
    reducedMotion,
  } = useHoldToNavigate();

  // Screen dimensions
  const screenDimensions = useRef(Dimensions.get('window'));
  const [dimensions, setDimensions] = useState(screenDimensions.current);

  // Animation values
  const pan = useRef(new Animated.ValueXY()).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const opacityAnimation = useRef(new Animated.Value(0)).current;

  // State
  const [isDragMode, setIsDragMode] = useState(false);
  const isDragModeRef = useRef(false); // Ref to avoid stale closure in PanResponder
  const dragModeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMoved = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isDragModeRef.current = isDragMode;
  }, [isDragMode]);

  // Update dimensions on rotation
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      screenDimensions.current = window;
      setDimensions(window);
    });
    return () => subscription.remove();
  }, []);

  // Set initial position from settings
  useEffect(() => {
    const x = settings.menuButtonPositionX * dimensions.width - BUTTON_SIZE / 2;
    const y = settings.menuButtonPositionY * dimensions.height - BUTTON_SIZE / 2;
    pan.setValue({ x, y });
  }, [settings.menuButtonPositionX, settings.menuButtonPositionY, dimensions, pan]);

  // Animate visibility
  useEffect(() => {
    Animated.timing(opacityAnimation, {
      toValue: visible ? 1 : 0,
      duration: reducedMotion ? 0 : 200,
      useNativeDriver: true,
    }).start();
  }, [visible, reducedMotion, opacityAnimation]);

  // Snap to nearest edge
  const snapToEdge = useCallback(
    (x: number, y: number) => {
      const { width, height } = dimensions;

      // Calculate distance to left/right edges
      const distanceToLeft = x + BUTTON_SIZE / 2;
      const distanceToRight = width - (x + BUTTON_SIZE / 2);

      // Snap to nearest horizontal edge
      let snapX: number;
      if (distanceToLeft < distanceToRight) {
        snapX = EDGE_PADDING;
      } else {
        snapX = width - BUTTON_SIZE - EDGE_PADDING;
      }

      // Clamp vertical position (with padding for safe areas)
      const snapY = Math.max(
        EDGE_PADDING + 50, // Top safe area
        Math.min(y, height - BUTTON_SIZE - EDGE_PADDING - 50) // Bottom safe area
      );

      return { x: snapX, y: snapY };
    },
    [dimensions],
  );

  // Pan responder for drag handling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only become responder if we've moved significantly
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 5 || Math.abs(dy) > 5;
      },

      onPanResponderGrant: () => {
        // Start drag mode timer
        dragModeTimer.current = setTimeout(() => {
          setIsDragMode(true);
          isDragModeRef.current = true;
          triggerHaptic();

          // Scale up slightly to indicate drag mode
          if (!reducedMotion) {
            Animated.spring(scaleAnimation, {
              toValue: 1.1,
              tension: 100,
              friction: 10,
              useNativeDriver: true,
            }).start();
          }

          // Announce to screen readers
          if (Platform.OS === 'ios') {
            AccessibilityInfo.announceForAccessibility(
              t('navigation.drag_mode_enabled'),
            );
          }
        }, DRAG_ACTIVATION_DELAY);

        hasMoved.current = false;

        // Store current position
        pan.extractOffset();
      },

      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;

        // Only move if in drag mode (use ref to avoid stale closure)
        if (isDragModeRef.current || Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          hasMoved.current = true;

          // Update position
          pan.setValue({ x: dx, y: dy });
        }
      },

      onPanResponderRelease: () => {
        // Clear drag mode timer
        if (dragModeTimer.current) {
          clearTimeout(dragModeTimer.current);
          dragModeTimer.current = null;
        }

        // If we didn't move, treat as tap
        if (!hasMoved.current) {
          handleTap();
        } else {
          // Calculate final position
          pan.flattenOffset();

          // Get current position safely using stopAnimation callback
          pan.stopAnimation((currentPosition) => {
            const currentX = currentPosition.x;
            const currentY = currentPosition.y;

            // Snap to edge
            const snappedPosition = snapToEdge(currentX, currentY);

            // Animate to snapped position
            Animated.spring(pan, {
              toValue: { x: snappedPosition.x, y: snappedPosition.y },
              tension: 100,
              friction: 10,
              useNativeDriver: false,
            }).start();

            // Save position as percentage
            const { width, height } = screenDimensions.current;
            const posX = (snappedPosition.x + BUTTON_SIZE / 2) / width;
            const posY = (snappedPosition.y + BUTTON_SIZE / 2) / height;

            // Wrap in try-catch to prevent unhandled promise rejection
            updateMenuButtonPosition(posX, posY).catch((error) => {
              console.warn('[DraggableMenuButton] Failed to save position:', error);
            });

            triggerHaptic();
          });
        }

        // Reset state
        setIsDragMode(false);
        isDragModeRef.current = false;

        // Reset scale
        if (!reducedMotion) {
          Animated.spring(scaleAnimation, {
            toValue: 1,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },

      onPanResponderTerminate: () => {
        // Clear timer and reset
        if (dragModeTimer.current) {
          clearTimeout(dragModeTimer.current);
          dragModeTimer.current = null;
        }
        setIsDragMode(false);
        isDragModeRef.current = false;
        scaleAnimation.setValue(1);
      },
    }),
  ).current;

  // Handle tap (open navigation)
  const handleTap = useCallback(() => {
    triggerHaptic();
    if (onPress) {
      onPress();
    } else {
      openNavigationMenu();
    }
  }, [onPress, openNavigationMenu, triggerHaptic]);

  if (!visible) {
    return null;
  }

  // Separate position (JS-driven) from scale/opacity (native-driven)
  // to avoid useNativeDriver conflict
  return (
    <Animated.View
      style={[
        styles.container,
        {
          // Position transform - JS driven (useNativeDriver: false)
          transform: pan.getTranslateTransform(),
        },
      ]}
    >
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.innerContainer,
          {
            // Scale and opacity - can use native driver
            transform: [{ scale: scaleAnimation }],
            opacity: opacityAnimation,
          },
        ]}
        testID={testID}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={t('navigation.menu_button')}
        accessibilityHint={t('navigation.menu_button_hint')}
      >
        <View style={[styles.button, isDragMode && styles.buttonDragging]}>
          {/* Home icon (simple house shape) */}
          <View style={styles.iconContainer}>
            <View style={styles.houseRoof} />
            <View style={styles.houseBody}>
              <View style={styles.houseDoor} />
            </View>
          </View>

          {/* Label */}
          <Text style={styles.label} numberOfLines={1}>
            {t('navigation.huiskamer')}
          </Text>
        </View>

        {/* Drag indicator (visible when in drag mode) */}
        {isDragMode && (
          <View style={styles.dragIndicator}>
            <Text style={styles.dragIndicatorText}>
              {t('navigation.drag_to_move')}
            </Text>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 999,
  },
  innerContainer: {
    // Inner container for scale/opacity animations (native driver)
    // Outer container handles position (JS driver)
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  buttonDragging: {
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.textOnPrimary,
  },
  iconContainer: {
    alignItems: 'center',
  },
  houseRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.textOnPrimary,
  },
  houseBody: {
    width: 24,
    height: 16,
    backgroundColor: colors.textOnPrimary,
    marginTop: -2,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  houseDoor: {
    width: 8,
    height: 10,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  label: {
    ...typography.small,
    color: colors.textOnPrimary,
    marginTop: 2,
    fontWeight: '600',
  },
  dragIndicator: {
    position: 'absolute',
    top: -30,
    left: -20,
    right: -20,
    alignItems: 'center',
  },
  dragIndicatorText: {
    ...typography.small,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    ...shadows.small,
  },
});
