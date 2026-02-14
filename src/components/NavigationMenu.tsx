/**
 * NavigationMenu — "Huiskamer" (Living Room) Navigation
 *
 * Full-screen overlay with large tiles for app modules.
 * Designed for seniors: big touch targets, clear icons, simple labels.
 *
 * Navigation tiles:
 * - Berichten (Messages)
 * - Contacten (Contacts)
 * - Instellingen (Settings)
 * - Hulp (Help) - optional
 *
 * @see .claude/skills/ui-designer/SKILL.md#hold-to-navigate
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  AccessibilityInfo,
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

// Tile configuration
const TILE_MARGIN = spacing.md;
const TILE_ICON_SIZE = 48;

export type NavigationDestination = 'chats' | 'contacts' | 'settings' | 'help';

interface NavigationTile {
  id: NavigationDestination;
  labelKey: string;
  icon: 'chat' | 'contacts' | 'settings' | 'help';
  color: string;
}

const NAVIGATION_TILES: NavigationTile[] = [
  {
    id: 'chats',
    labelKey: 'navigation.chats',
    icon: 'chat',
    color: colors.primary,
  },
  {
    id: 'contacts',
    labelKey: 'navigation.contacts',
    icon: 'contacts',
    color: '#2E7D32', // Green
  },
  {
    id: 'settings',
    labelKey: 'navigation.settings',
    icon: 'settings',
    color: '#5E35B1', // Purple
  },
  {
    id: 'help',
    labelKey: 'navigation.help',
    icon: 'help',
    color: '#00838F', // Teal
  },
];

interface NavigationMenuProps {
  /** Called when a navigation tile is pressed */
  onNavigate: (destination: NavigationDestination) => void;
  /** Called when the menu should be closed */
  onClose: () => void;
  /** Whether the menu is visible */
  visible: boolean;
  /** Current active screen (to highlight) */
  activeScreen?: NavigationDestination;
}

export function NavigationMenu({
  onNavigate,
  onClose,
  visible,
  activeScreen,
}: NavigationMenuProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { reducedMotion, triggerHaptic, closeNavigationMenu } = useHoldToNavigate();

  // Animation values
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.9)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Screen dimensions
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isLandscape = screenWidth > screenHeight;

  // Calculate tile size (2 columns in portrait, 4 in landscape)
  const columns = isLandscape ? 4 : 2;
  const availableWidth = screenWidth - (spacing.lg * 2) - (TILE_MARGIN * (columns - 1));
  const tileSize = Math.floor(availableWidth / columns);

  // Animate visibility
  useEffect(() => {
    if (visible) {
      // Announce to screen readers
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(t('navigation.menu_opened'));
      }

      // Show animation
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: reducedMotion ? 0 : 200,
          useNativeDriver: true,
        }),
        Animated.spring(contentScale, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: reducedMotion ? 0 : 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide animation
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
      ]).start(() => {
        contentScale.setValue(0.9);
      });
    }
  }, [visible, reducedMotion, overlayOpacity, contentScale, contentOpacity, t]);

  // Handle tile press
  const handleTilePress = (destination: NavigationDestination) => {
    triggerHaptic();
    closeNavigationMenu();
    onNavigate(destination);
  };

  // Handle close (tap outside tiles)
  const handleClose = () => {
    triggerHaptic();
    onClose();
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[styles.overlay, { opacity: overlayOpacity }]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
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
            paddingHorizontal: spacing.lg,
            opacity: contentOpacity,
            transform: [{ scale: contentScale }],
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Title */}
        <Text style={styles.title}>{t('navigation.huiskamer')}</Text>
        <Text style={styles.subtitle}>{t('navigation.where_to_go')}</Text>

        {/* Navigation tiles grid */}
        <View style={[styles.tilesContainer, { width: availableWidth + TILE_MARGIN * (columns - 1) }]}>
          {NAVIGATION_TILES.map((tile) => (
            <NavigationTileButton
              key={tile.id}
              tile={tile}
              size={tileSize}
              isActive={activeScreen === tile.id}
              onPress={() => handleTilePress(tile.id)}
            />
          ))}
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

// Individual tile component
interface NavigationTileButtonProps {
  tile: NavigationTile;
  size: number;
  isActive: boolean;
  onPress: () => void;
}

function NavigationTileButton({
  tile,
  size,
  isActive,
  onPress,
}: NavigationTileButtonProps) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          backgroundColor: tile.color,
          marginRight: TILE_MARGIN,
          marginBottom: TILE_MARGIN,
        },
        isActive && styles.tileActive,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={t(tile.labelKey)}
      accessibilityState={{ selected: isActive }}
    >
      {/* Icon */}
      <TileIcon type={tile.icon} size={TILE_ICON_SIZE} />

      {/* Label */}
      <Text style={styles.tileLabel} numberOfLines={2}>
        {t(tile.labelKey)}
      </Text>

      {/* Active indicator */}
      {isActive && <View style={styles.activeIndicator} />}
    </TouchableOpacity>
  );
}

// Simple icon components (no external dependencies)
interface TileIconProps {
  type: 'chat' | 'contacts' | 'settings' | 'help';
  size: number;
}

function TileIcon({ type, size }: TileIconProps) {
  switch (type) {
    case 'chat':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          {/* Speech bubble */}
          <View style={[styles.chatBubble, { width: size * 0.8, height: size * 0.6 }]} />
          <View style={[styles.chatBubbleTail, { bottom: size * 0.1, left: size * 0.1 }]} />
        </View>
      );

    case 'contacts':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          {/* Person head */}
          <View style={[styles.personHead, { width: size * 0.4, height: size * 0.4 }]} />
          {/* Person body */}
          <View style={[styles.personBody, { width: size * 0.6, height: size * 0.3 }]} />
        </View>
      );

    case 'settings':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          {/* Gear (simplified) */}
          <View style={[styles.gear, { width: size * 0.7, height: size * 0.7 }]} />
          <View style={[styles.gearCenter, { width: size * 0.25, height: size * 0.25 }]} />
        </View>
      );

    case 'help':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          {/* Question mark */}
          <Text style={[styles.helpIcon, { fontSize: size * 0.7 }]}>?</Text>
        </View>
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
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
  tilesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  tile: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
  tileActive: {
    borderWidth: 3,
    borderColor: colors.textOnPrimary,
  },
  tileLabel: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  activeIndicator: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.textOnPrimary,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
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
    borderRadius: 12,
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
  gear: {
    borderWidth: 4,
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
});
