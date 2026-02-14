/**
 * WheelNavigationMenu — Rotating wheel navigation
 *
 * A 3D rotating wheel for module selection, designed for seniors:
 * - Vertical swipe to rotate through modules
 * - Current module highlighted in center
 * - Haptic feedback on each "tick" (module change)
 * - Large touch targets and clear labels
 *
 * @see .claude/skills/ui-designer/SKILL.md#hold-to-navigate
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  AccessibilityInfo,
  PanResponder,
  Vibration,
  GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  colors,
  typography,
  spacing,
  touchTargets,
  borderRadius,
  shadows,
} from '@/theme';
import { useHoldToNavigate } from '@/hooks/useHoldToNavigate';

// Wheel configuration
const WHEEL_ITEM_HEIGHT = 160;
const VISIBLE_ITEMS = 3;

// Helper function for modulo that handles negative numbers correctly
const mod = (n: number, m: number): number => ((n % m) + m) % m;

export type NavigationDestination =
  | 'chats'
  | 'contacts'
  | 'groups'
  | 'settings'
  | 'help'
  | 'calls'
  | 'videocall'
  | 'ebook'
  | 'audiobook'
  | 'podcast';

interface WheelItem {
  id: NavigationDestination;
  labelKey: string;
  icon: 'chat' | 'contacts' | 'groups' | 'settings' | 'help' | 'phone' | 'video' | 'book' | 'headphones' | 'podcast';
  color: string;
}

const WHEEL_ITEMS: WheelItem[] = [
  { id: 'chats', labelKey: 'navigation.chats', icon: 'chat', color: colors.primary },
  { id: 'contacts', labelKey: 'navigation.contacts', icon: 'contacts', color: '#2E7D32' },
  { id: 'groups', labelKey: 'navigation.groups', icon: 'groups', color: '#00796B' },
  { id: 'calls', labelKey: 'navigation.calls', icon: 'phone', color: '#1565C0' },
  { id: 'videocall', labelKey: 'navigation.videocall', icon: 'video', color: '#C62828' },
  { id: 'ebook', labelKey: 'navigation.ebook', icon: 'book', color: '#F57C00' },
  { id: 'audiobook', labelKey: 'navigation.audiobook', icon: 'headphones', color: '#7B1FA2' },
  { id: 'podcast', labelKey: 'navigation.podcast', icon: 'podcast', color: '#E91E63' },
  { id: 'settings', labelKey: 'navigation.settings', icon: 'settings', color: '#5E35B1' },
  { id: 'help', labelKey: 'navigation.help', icon: 'help', color: '#00838F' },
];

interface WheelNavigationMenuProps {
  onNavigate: (destination: NavigationDestination) => void;
  onClose: () => void;
  visible: boolean;
  activeScreen?: NavigationDestination;
}

export function WheelNavigationMenu({
  onNavigate,
  onClose,
  visible,
  activeScreen,
}: WheelNavigationMenuProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { reducedMotion, triggerHaptic, settings } = useHoldToNavigate();

  const blurIntensity = settings.wheelBlurIntensity;
  const dismissMargin = settings.wheelDismissMargin;

  // Find initial index based on active screen
  const getInitialIndex = useCallback(() => {
    if (!activeScreen) return 0;
    const index = WHEEL_ITEMS.findIndex(item => item.id === activeScreen);
    return index >= 0 ? index : 0;
  }, [activeScreen]);

  // Current selected index (the item in the center)
  const [selectedIndex, setSelectedIndex] = useState(getInitialIndex);

  // Animation for visual offset during drag (small movement to show direction)
  const dragOffset = useRef(new Animated.Value(0)).current;

  // Animation for fade in/out
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Wheel container layout for tap-outside detection
  const wheelLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const { width: screenWidth } = Dimensions.get('window');

  // Reset when menu opens - set selected index to current active screen
  useEffect(() => {
    if (visible) {
      // Always start at the current screen when opening the menu
      const newIndex = getInitialIndex();
      console.log('[WheelNavigationMenu] Opening menu, activeScreen:', activeScreen, 'newIndex:', newIndex);
      setSelectedIndex(newIndex);
      dragOffset.setValue(0);

      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(t('navigation.menu_opened'));
      }

      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: reducedMotion ? 0 : 200,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: reducedMotion ? 0 : 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: reducedMotion ? 0 : 150,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: reducedMotion ? 0 : 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, activeScreen, getInitialIndex, reducedMotion, overlayOpacity, contentOpacity, dragOffset, t]);

  // Haptic feedback
  const triggerWheelHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Vibration.vibrate(5);
    } else {
      Vibration.vibrate(10);
    }
  }, []);

  // Move to a specific index with animation
  const moveToIndex = useCallback((newIndex: number) => {
    const normalizedIndex = mod(newIndex, WHEEL_ITEMS.length);

    // Animate drag offset back to 0 with a quick snap
    Animated.spring(dragOffset, {
      toValue: 0,
      tension: 300,
      friction: 25,
      useNativeDriver: true,
    }).start();

    setSelectedIndex(normalizedIndex);
    triggerWheelHaptic();
  }, [dragOffset, triggerWheelHaptic]);

  // Swipe thresholds
  // Minimum swipe distance to move 1 step
  const MIN_SWIPE_THRESHOLD = WHEEL_ITEM_HEIGHT * 0.25;
  // Distance per additional step (for multi-step swiping)
  const STEP_DISTANCE = WHEEL_ITEM_HEIGHT * 0.6;
  // Maximum steps per swipe (to prevent accidental extreme jumps)
  const MAX_STEPS = 3;

  // Pan responder for swipe navigation
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },

      onPanResponderGrant: () => {
        dragOffset.stopAnimation();
        dragOffset.setValue(0);
      },

      onPanResponderMove: (_, gestureState) => {
        // Allow larger drag for visual feedback during multi-step swipes
        const maxDrag = WHEEL_ITEM_HEIGHT * 0.6;
        const clampedDy = Math.max(-maxDrag, Math.min(maxDrag, gestureState.dy));
        dragOffset.setValue(clampedDy);
      },

      onPanResponderRelease: (_, gestureState) => {
        const { dy, vy } = gestureState;

        // Calculate number of steps based on swipe distance AND velocity
        // Swipe UP (negative dy) = next item (index + 1)
        // Swipe DOWN (positive dy) = previous item (index - 1)
        let steps = 0;

        const absDy = Math.abs(dy);
        const absVy = Math.abs(vy);

        if (absDy >= MIN_SWIPE_THRESHOLD) {
          // Base steps from distance
          // First step at MIN_SWIPE_THRESHOLD, then additional steps for each STEP_DISTANCE
          const distanceSteps = 1 + Math.floor((absDy - MIN_SWIPE_THRESHOLD) / STEP_DISTANCE);

          // Velocity bonus: fast swipes can add extra steps
          // Velocity > 0.8 adds 1 step, > 1.5 adds 2 steps
          let velocityBonus = 0;
          if (absVy > 1.5) {
            velocityBonus = 2;
          } else if (absVy > 0.8) {
            velocityBonus = 1;
          }

          steps = Math.min(distanceSteps + velocityBonus, MAX_STEPS);

          // Apply direction
          if (dy < 0) {
            // Swiped up - go to next items (increase index)
            steps = steps;
          } else {
            // Swiped down - go to previous items (decrease index)
            steps = -steps;
          }
        }

        if (steps !== 0) {
          // Get current index from state (we need to use a callback to get latest)
          setSelectedIndex(currentIndex => {
            const newIndex = mod(currentIndex + steps, WHEEL_ITEMS.length);
            triggerWheelHaptic();
            return newIndex;
          });
        }

        // Animate back to center
        Animated.spring(dragOffset, {
          toValue: 0,
          tension: 300,
          friction: 25,
          useNativeDriver: true,
        }).start();
      },

      onPanResponderTerminate: () => {
        Animated.spring(dragOffset, {
          toValue: 0,
          tension: 300,
          friction: 25,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Handle item selection
  const handleSelect = useCallback(() => {
    const selectedItem = WHEEL_ITEMS[selectedIndex];
    if (selectedItem) {
      triggerHaptic();
      onNavigate(selectedItem.id);
    }
  }, [selectedIndex, triggerHaptic, onNavigate]);

  // Handle close
  const handleClose = useCallback(() => {
    triggerHaptic();
    onClose();
  }, [triggerHaptic, onClose]);

  // Handle tap on backdrop
  const handleBackdropPress = useCallback((event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const wheel = wheelLayout.current;

    const isOutsideLeft = pageX < wheel.x - dismissMargin;
    const isOutsideRight = pageX > wheel.x + wheel.width + dismissMargin;
    const isOutsideTop = pageY < wheel.y - dismissMargin;
    const isOutsideBottom = pageY > wheel.y + wheel.height + dismissMargin;

    if (isOutsideLeft || isOutsideRight || isOutsideTop || isOutsideBottom) {
      handleClose();
    }
  }, [dismissMargin, handleClose]);

  // Store wheel layout
  const handleWheelLayout = useCallback((event: any) => {
    event.target.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
      wheelLayout.current = { x: pageX, y: pageY, width, height };
    });
  }, []);

  // Handle tap on item
  const handleItemTap = useCallback((itemIndex: number) => {
    if (itemIndex === selectedIndex) {
      handleSelect();
    } else {
      moveToIndex(itemIndex);
    }
  }, [selectedIndex, handleSelect, moveToIndex]);

  if (!visible) {
    return null;
  }

  // Much darker overlay for cleaner UI - less distraction from background
  const overlayBackgroundOpacity = blurIntensity > 0
    ? 0.85 + (blurIntensity / 30) * 0.1  // 0.85 to 0.95 based on blur setting
    : 0.92;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: `rgba(0, 0, 0, ${overlayBackgroundOpacity})` }
          ]}
        />
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
          activeOpacity={1}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
      </Animated.View>

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
            opacity: contentOpacity,
          },
        ]}
        pointerEvents="box-none"
      >
        <Text style={styles.title}>{t('navigation.huiskamer')}</Text>
        <Text style={styles.subtitle}>{t('navigation.swipe_to_select')}</Text>

        {/* Wheel container */}
        <View
          style={[styles.wheelContainer, { width: screenWidth - spacing.lg * 2 }]}
          {...panResponder.panHandlers}
          onLayout={handleWheelLayout}
        >
          {/* Render 3 visible items: previous, current, next */}
          {[-1, 0, 1].map((offset) => {
            const itemIndex = mod(selectedIndex + offset, WHEEL_ITEMS.length);
            const item = WHEEL_ITEMS[itemIndex];
            const isCenter = offset === 0;

            // Base position for this slot
            const baseY = offset * WHEEL_ITEM_HEIGHT;

            // Visual styling based on position
            const scale = isCenter ? 1 : 0.75;
            const itemOpacity = isCenter ? 1 : 0.6;

            // 3D effect
            const rotateX = offset === -1 ? '25deg' : offset === 1 ? '-25deg' : '0deg';

            return (
              <Animated.View
                key={`slot-${offset}`}
                style={[
                  styles.wheelItem,
                  {
                    transform: [
                      // Apply drag offset to all items
                      { translateY: Animated.add(new Animated.Value(baseY), dragOffset) },
                      { scale },
                      { perspective: 1000 },
                      { rotateX },
                    ],
                    opacity: itemOpacity,
                    zIndex: isCenter ? 10 : 5,
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.wheelItemButton,
                    { backgroundColor: item.color },
                    isCenter && styles.wheelItemCenter,
                  ]}
                  onPress={() => handleItemTap(itemIndex)}
                  activeOpacity={0.8}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t(item.labelKey)}
                  accessibilityState={{ selected: isCenter }}
                  accessibilityHint={isCenter ? t('navigation.tap_to_go') : t('navigation.tap_to_select')}
                >
                  <WheelIcon type={item.icon} size={56} />
                  <Text style={styles.wheelItemLabel}>{t(item.labelKey)}</Text>

                  {/* Desaturation overlay for non-center items */}
                  {!isCenter && (
                    <View style={styles.desaturationOverlay} pointerEvents="none" />
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          {/* Selection frame */}
          <View style={styles.selectionFrame} pointerEvents="none" />
        </View>

        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <View style={styles.closeIcon}>
            <View style={styles.closeIconLine1} />
            <View style={styles.closeIconLine2} />
          </View>
          <Text style={styles.closeButtonText}>{t('common.close')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// Icon component for wheel items
interface WheelIconProps {
  type: 'chat' | 'contacts' | 'groups' | 'settings' | 'help' | 'phone' | 'video' | 'book' | 'headphones' | 'podcast';
  size: number;
}

function WheelIcon({ type, size }: WheelIconProps) {
  switch (type) {
    case 'chat':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View style={[styles.chatBubble, { width: size * 0.8, height: size * 0.6, borderRadius: size * 0.15 }]} />
          <View style={[styles.chatBubbleTail, { bottom: size * 0.05, left: size * 0.1 }]} />
        </View>
      );

    case 'contacts':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View style={[styles.personHead, { width: size * 0.4, height: size * 0.4 }]} />
          <View style={[styles.personBody, { width: size * 0.6, height: size * 0.3 }]} />
        </View>
      );

    case 'groups':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View style={styles.groupsContainer}>
            <View style={[styles.groupPersonSmall, { left: size * 0.05 }]}>
              <View style={[styles.personHead, { width: size * 0.25, height: size * 0.25 }]} />
              <View style={[styles.personBody, { width: size * 0.35, height: size * 0.18 }]} />
            </View>
            <View style={[styles.groupPersonSmall, { right: size * 0.05 }]}>
              <View style={[styles.personHead, { width: size * 0.25, height: size * 0.25 }]} />
              <View style={[styles.personBody, { width: size * 0.35, height: size * 0.18 }]} />
            </View>
            <View style={styles.groupPersonCenter}>
              <View style={[styles.personHead, { width: size * 0.35, height: size * 0.35 }]} />
              <View style={[styles.personBody, { width: size * 0.5, height: size * 0.25 }]} />
            </View>
          </View>
        </View>
      );

    case 'settings':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View style={[styles.gear, { width: size * 0.7, height: size * 0.7, borderWidth: size * 0.08 }]} />
          <View style={[styles.gearCenter, { width: size * 0.25, height: size * 0.25 }]} />
        </View>
      );

    case 'help':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <Text style={[styles.helpIcon, { fontSize: size * 0.7 }]}>?</Text>
        </View>
      );

    case 'phone':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View style={[styles.phoneBody, { width: size * 0.35, height: size * 0.7, borderRadius: size * 0.1 }]} />
          <View style={[styles.phoneEarpiece, { width: size * 0.25, height: size * 0.12, top: size * 0.08 }]} />
          <View style={[styles.phoneMouthpiece, { width: size * 0.25, height: size * 0.12, bottom: size * 0.08 }]} />
        </View>
      );

    case 'video':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View style={[styles.videoBody, { width: size * 0.6, height: size * 0.45, borderRadius: size * 0.08 }]} />
          <View style={[styles.videoLens, {
            width: 0,
            height: 0,
            borderLeftWidth: size * 0.25,
            borderTopWidth: size * 0.15,
            borderBottomWidth: size * 0.15,
            left: size * 0.55,
          }]} />
        </View>
      );

    case 'book':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View style={[styles.bookLeft, { width: size * 0.4, height: size * 0.6, borderRadius: size * 0.05 }]} />
          <View style={[styles.bookRight, { width: size * 0.4, height: size * 0.6, borderRadius: size * 0.05 }]} />
          <View style={[styles.bookSpine, { width: size * 0.06, height: size * 0.55 }]} />
        </View>
      );

    case 'headphones':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View style={[styles.headphonesBand, {
            width: size * 0.6,
            height: size * 0.35,
            borderTopLeftRadius: size * 0.3,
            borderTopRightRadius: size * 0.3,
            borderWidth: size * 0.06,
          }]} />
          <View style={[styles.headphonesLeft, { width: size * 0.2, height: size * 0.3, borderRadius: size * 0.06, left: size * 0.15, top: size * 0.35 }]} />
          <View style={[styles.headphonesRight, { width: size * 0.2, height: size * 0.3, borderRadius: size * 0.06, right: size * 0.15, top: size * 0.35 }]} />
        </View>
      );

    case 'podcast':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View style={[styles.podcastMic, {
            width: size * 0.35,
            height: size * 0.5,
            borderRadius: size * 0.175,
          }]} />
          <View style={[styles.podcastStand, {
            width: size * 0.5,
            height: size * 0.25,
            borderBottomLeftRadius: size * 0.25,
            borderBottomRightRadius: size * 0.25,
            borderWidth: size * 0.05,
            top: size * 0.35,
          }]} />
          <View style={[styles.podcastBase, {
            width: size * 0.08,
            height: size * 0.15,
            top: size * 0.55,
          }]} />
          <View style={[styles.podcastFoot, {
            width: size * 0.3,
            height: size * 0.06,
            borderRadius: size * 0.03,
            top: size * 0.68,
          }]} />
        </View>
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.textOnPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textOnPrimary,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  wheelContainer: {
    height: WHEEL_ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItem: {
    position: 'absolute',
    width: '100%',
    height: WHEEL_ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemButton: {
    width: '90%',
    height: WHEEL_ITEM_HEIGHT - 16,
    borderRadius: borderRadius.lg,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadows.medium,
  },
  wheelItemCenter: {
    borderWidth: 3,
    borderColor: colors.textOnPrimary,
  },
  wheelItemLabel: {
    ...typography.h3,
    color: colors.textOnPrimary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  desaturationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: borderRadius.lg,
  },
  selectionFrame: {
    position: 'absolute',
    width: '94%',
    height: WHEEL_ITEM_HEIGHT,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: borderRadius.lg + 4,
    borderStyle: 'dashed',
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.full,
    minHeight: touchTargets.minimum,
  },
  closeIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  closeIconLine1: {
    position: 'absolute',
    width: 20,
    height: 3,
    backgroundColor: colors.textOnPrimary,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  closeIconLine2: {
    position: 'absolute',
    width: 20,
    height: 3,
    backgroundColor: colors.textOnPrimary,
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
  },
  closeButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },

  // Icon styles
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBubble: {
    backgroundColor: colors.textOnPrimary,
  },
  chatBubbleTail: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.textOnPrimary,
  },
  personHead: {
    backgroundColor: colors.textOnPrimary,
    borderRadius: 100,
    marginBottom: 4,
  },
  personBody: {
    backgroundColor: colors.textOnPrimary,
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
  },
  groupsContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupPersonSmall: {
    position: 'absolute',
    alignItems: 'center',
    opacity: 0.7,
    top: '15%',
  },
  groupPersonCenter: {
    alignItems: 'center',
    zIndex: 1,
  },
  gear: {
    borderColor: colors.textOnPrimary,
    borderRadius: 100,
  },
  gearCenter: {
    position: 'absolute',
    backgroundColor: colors.textOnPrimary,
    borderRadius: 100,
  },
  helpIcon: {
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  phoneBody: {
    backgroundColor: colors.textOnPrimary,
  },
  phoneEarpiece: {
    position: 'absolute',
    backgroundColor: colors.textOnPrimary,
  },
  phoneMouthpiece: {
    position: 'absolute',
    backgroundColor: colors.textOnPrimary,
  },
  videoBody: {
    backgroundColor: colors.textOnPrimary,
  },
  videoLens: {
    position: 'absolute',
    borderLeftColor: colors.textOnPrimary,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  bookLeft: {
    position: 'absolute',
    left: '5%',
    backgroundColor: colors.textOnPrimary,
    transform: [{ rotate: '-5deg' }],
  },
  bookRight: {
    position: 'absolute',
    right: '5%',
    backgroundColor: colors.textOnPrimary,
    transform: [{ rotate: '5deg' }],
  },
  bookSpine: {
    position: 'absolute',
    backgroundColor: colors.textOnPrimary,
  },
  headphonesBand: {
    position: 'absolute',
    top: '10%',
    borderColor: colors.textOnPrimary,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  headphonesLeft: {
    position: 'absolute',
    backgroundColor: colors.textOnPrimary,
  },
  headphonesRight: {
    position: 'absolute',
    backgroundColor: colors.textOnPrimary,
  },
  podcastMic: {
    position: 'absolute',
    backgroundColor: colors.textOnPrimary,
    top: '5%',
  },
  podcastStand: {
    position: 'absolute',
    borderColor: colors.textOnPrimary,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  podcastBase: {
    position: 'absolute',
    backgroundColor: colors.textOnPrimary,
  },
  podcastFoot: {
    position: 'absolute',
    backgroundColor: colors.textOnPrimary,
  },
});
