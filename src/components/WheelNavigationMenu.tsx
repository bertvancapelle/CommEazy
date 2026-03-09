/**
 * WheelNavigationMenu — Smart navigation menu with usage-based ordering
 *
 * @deprecated The WheelNavigationMenu component is deprecated in favor of
 * the HomeScreen grid navigation (see src/screens/HomeScreen.tsx).
 * The component is kept for backward compatibility but navigation now
 * flows through the HomeScreen grid.
 *
 * This file still exports critical types and constants used throughout
 * the codebase:
 * - NavigationDestination, StaticNavigationDestination types
 * - STATIC_MODULE_DEFINITIONS constant
 * - mapModuleIconToIconName helper
 * - ModuleItem, ModuleIconType types
 *
 * @see src/screens/HomeScreen.tsx — New grid navigation
 * @see .claude/plans/HOMESCREEN_GRID_NAVIGATION.md
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  AccessibilityInfo,
  ScrollView,
  Vibration,
  GestureResponderEvent,
  type LayoutChangeEvent,
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
import { Icon, type IconName } from './Icon';
import { useHoldToNavigate } from '@/hooks/useHoldToNavigate';
import { useModuleUsage, ALL_MODULES } from '@/hooks/useModuleUsage';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useModuleConfig } from '@/contexts/ModuleConfigContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useAppleMusicContextSafe } from '@/contexts/AppleMusicContext';
import { useMailUnreadCount } from '@/hooks/useMailUnreadCount';
import type { ModuleColorId } from '@/types/liquidGlass';

// Configuration
const MODULE_ITEM_HEIGHT = 80;
const MODULES_PER_PAGE = 4;

// Static navigation destinations (built-in modules)
export type StaticNavigationDestination =
  | 'home'         // HomeScreen grid (start screen)
  | 'chats'
  | 'contacts'
  | 'groups'
  | 'settings'
  | 'help'
  | 'calls'  // Combined voice + video calling
  | 'podcast'
  | 'radio'
  | 'books'
  | 'weather'
  | 'appleMusic'   // Apple Music integration
  | 'camera'       // Camera module (photo/video capture)
  | 'photoAlbum'   // Photo Album (view, send, delete photos)
  | 'askAI'        // Ask AI assistant module
  | 'mail'         // E-mail module
  | 'agenda';      // Agenda module (appointments, reminders, medication)

// Dynamic navigation destinations for country-specific modules
// Format: 'module:{moduleId}' (e.g., 'module:nunl')
export type DynamicNavigationDestination = `module:${string}`;

// Combined navigation destination type
export type NavigationDestination =
  | StaticNavigationDestination
  | DynamicNavigationDestination;

// Helper to check if destination is dynamic
export function isDynamicDestination(dest: NavigationDestination): dest is DynamicNavigationDestination {
  return dest.startsWith('module:');
}

// Helper to extract module ID from dynamic destination
export function getModuleIdFromDest(dest: DynamicNavigationDestination): string {
  return dest.replace('module:', '');
}

// All available icon types for modules
export type ModuleIconType =
  | 'chat'
  | 'contacts'
  | 'groups'
  | 'settings'
  | 'help'
  | 'phone'
  | 'video'
  | 'book'
  | 'headphones'
  | 'podcast'
  | 'radio'
  | 'news'        // For country-specific news modules
  | 'weather'     // Weather module
  | 'appleMusic'  // Apple Music module
  | 'camera'      // Camera module
  | 'image'       // Photo Album module
  | 'chatbubble'  // Ask AI module
  | 'mail'        // E-mail module
  | 'calendar';   // Agenda module

/**
 * Map ModuleIconType to IconName for unified SVG icons
 * This allows WheelNavigationMenu to use the same Icon component as modules
 */
export function mapModuleIconToIconName(type: ModuleIconType): IconName {
  switch (type) {
    case 'chat':
      return 'chat';
    case 'contacts':
      return 'contacts';
    case 'groups':
      return 'groups';
    case 'settings':
      return 'settings';
    case 'help':
      return 'help';
    case 'phone':
      return 'phone';
    case 'video':
      return 'videocam';
    case 'book':
      return 'book';
    case 'headphones':
      return 'headphones';
    case 'podcast':
      return 'podcast';
    case 'radio':
      return 'radio';
    case 'news':
      return 'news';
    case 'weather':
      return 'weather';
    case 'appleMusic':
      return 'appleMusic';
    case 'camera':
      return 'camera';
    case 'image':
      return 'image';
    case 'chatbubble':
      return 'chatbubble';
    case 'mail':
      return 'mail';
    case 'calendar':
      return 'calendar';
    default:
      return 'info'; // fallback
  }
}

export interface ModuleItem {
  id: NavigationDestination;
  labelKey: string;
  icon: ModuleIconType;
  /** @deprecated Colors now come from useModuleColor() hook - this property is unused */
  color?: string;
  /** Custom logo component to render instead of icon (for branded modules like nu.nl) */
  customLogo?: React.ReactNode;
}

// Static module definitions - built-in modules
// Colors come from ModuleColorsContext via useModuleColor() hook
export const STATIC_MODULE_DEFINITIONS: Record<StaticNavigationDestination, Omit<ModuleItem, 'id'>> = {
  chats: { labelKey: 'navigation.chats', icon: 'chat' },
  contacts: { labelKey: 'navigation.contacts', icon: 'contacts' },
  groups: { labelKey: 'navigation.groups', icon: 'groups' },
  calls: { labelKey: 'navigation.calls', icon: 'phone' },
  podcast: { labelKey: 'navigation.podcast', icon: 'podcast' },
  radio: { labelKey: 'navigation.radio', icon: 'radio' },
  books: { labelKey: 'navigation.books', icon: 'book' },
  weather: { labelKey: 'navigation.weather', icon: 'weather' },
  appleMusic: { labelKey: 'navigation.appleMusic', icon: 'appleMusic' },
  camera: { labelKey: 'navigation.camera', icon: 'camera' },
  photoAlbum: { labelKey: 'navigation.photoAlbum', icon: 'image' },
  askAI: { labelKey: 'navigation.askAI', icon: 'chatbubble' },
  mail: { labelKey: 'navigation.mail', icon: 'mail' },
  agenda: { labelKey: 'navigation.agenda', icon: 'calendar' },
  settings: { labelKey: 'navigation.settings', icon: 'settings' },
  help: { labelKey: 'navigation.help', icon: 'help' },
};

// Dynamic module definitions - country-specific modules
// These are loaded from moduleRegistry and mapped to ModuleItem format
import { getModuleById } from '@/config/moduleRegistry';
import type { CountryModuleDefinition } from '@/types/modules';
import { NunlLogo } from './NunlLogo';

// Map ModuleIconType from registry to WheelNavigationMenu icon type
function mapModuleIcon(icon: string): ModuleIconType {
  // Country modules use 'news' icon type
  if (icon === 'news' || icon === 'newspaper') return 'news';
  // Fallback for unknown icons
  return 'news';
}

/**
 * Custom logos for branded modules (rendered instead of generic icons)
 * Map moduleId to a React component
 */
function getCustomLogoForModule(moduleId: string, size: number): React.ReactNode | undefined {
  switch (moduleId) {
    case 'nunl':
      return <NunlLogo size={size} />;
    // Add more branded modules here as needed
    default:
      return undefined;
  }
}

function getModuleItem(id: NavigationDestination): ModuleItem {
  // Check if this is a dynamic module destination
  if (isDynamicDestination(id)) {
    const moduleId = getModuleIdFromDest(id);
    const moduleDef = getModuleById(moduleId);

    if (moduleDef) {
      return {
        id,
        labelKey: moduleDef.labelKey,
        icon: mapModuleIcon(moduleDef.icon),
        customLogo: getCustomLogoForModule(moduleId, 40),
      };
    }

    // Fallback for unknown dynamic module
    return {
      id,
      labelKey: `modules.${moduleId}.title`,
      icon: 'news',
    };
  }

  // Static module
  return { id, ...STATIC_MODULE_DEFINITIONS[id] };
}

interface WheelNavigationMenuProps {
  onNavigate: (destination: NavigationDestination) => void;
  onClose: () => void;
  visible: boolean;
  activeScreen?: NavigationDestination;
}

export const WheelNavigationMenu = React.memo(function WheelNavigationMenu({
  onNavigate,
  onClose,
  visible,
  activeScreen,
}: WheelNavigationMenuProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { reducedMotion, triggerHaptic, settings } = useHoldToNavigate();
  const { accentColor } = useAccentColor();
  const { unreadCount: mailUnreadCount } = useMailUnreadCount();

  // Apple Music authorization — hide module when not authorized
  const appleMusicContext = useAppleMusicContextSafe();
  const isAppleMusicAuthorized = appleMusicContext?.isAuthorized ?? false;

  // Get enabled dynamic modules from ModuleConfigContext
  const { enabledModules, isLoading: modulesLoading } = useModuleConfig();

  // Check if mail module should be visible (only when accounts are configured)
  const [hasMailAccounts, setHasMailAccounts] = useState(false);

  useEffect(() => {
    const checkMailAccounts = async () => {
      try {
        const credentialManager = await import('@/services/mail/credentialManager');
        const accounts = await credentialManager.getAllAccounts();
        setHasMailAccounts(accounts.length > 0);
      } catch {
        setHasMailAccounts(false);
      }
    };
    // Check on mount and re-check each time menu opens
    // so newly added/removed accounts are detected
    checkMailAccounts();
  }, [visible]);

  // Hide modules when not available
  const hiddenModules = useMemo((): NavigationDestination[] => {
    const hidden: NavigationDestination[] = [];
    if (!hasMailAccounts) hidden.push('mail');
    if (!isAppleMusicAuthorized) hidden.push('appleMusic');
    return hidden;
  }, [hasMailAccounts, isAppleMusicAuthorized]);

  // Convert enabled modules to NavigationDestination format
  const dynamicModules = useMemo(() => {
    return enabledModules.map(
      (m): DynamicNavigationDestination => `module:${m.moduleId}`
    );
  }, [enabledModules]);

  // Pass dynamic modules and hidden modules to useModuleUsage hook
  const { recordModuleUsage, getTopModules, getRemainingModules } = useModuleUsage({
    dynamicModules,
    hiddenModules,
  });

  const blurIntensity = settings.wheelBlurIntensity;
  const dismissMargin = settings.wheelDismissMargin;

  // State for pagination — currentPage: 0 = top modules, 1+ = remaining pages
  const [currentPage, setCurrentPage] = useState(0);

  // Animation values
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Container layout for tap-outside detection
  const containerLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const { width: screenWidth } = Dimensions.get('window');

  // Get sorted modules based on usage — always use MODULES_PER_PAGE
  const topModules = useMemo(() => {
    return getTopModules(activeScreen, MODULES_PER_PAGE);
  }, [activeScreen, getTopModules]);

  const remainingModules = useMemo(() => {
    return getRemainingModules(activeScreen, MODULES_PER_PAGE);
  }, [activeScreen, getRemainingModules]);

  // Calculate total pages (page 0 = top, page 1+ = remaining in chunks of MODULES_PER_PAGE)
  const totalRemainingPages = Math.ceil(remainingModules.length / MODULES_PER_PAGE);
  const totalPages = 1 + totalRemainingPages; // page 0 + remaining pages

  // Get modules to show on current page
  const modulesToShow = useMemo(() => {
    if (currentPage === 0) {
      // Page 0: show top modules
      return topModules;
    } else {
      // Page 1+: show slice of remaining modules (4 per page)
      const startIndex = (currentPage - 1) * MODULES_PER_PAGE;
      const endIndex = startIndex + MODULES_PER_PAGE;
      return remainingModules.slice(startIndex, endIndex);
    }
  }, [currentPage, topModules, remainingModules]);

  // Reset state when menu opens
  useEffect(() => {
    if (visible) {
      setCurrentPage(0);

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
  }, [visible, reducedMotion, overlayOpacity, contentOpacity, t]);

  // Haptic feedback
  const triggerItemHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Vibration.vibrate(5);
    } else {
      Vibration.vibrate(10);
    }
  }, []);

  // Handle module selection
  const handleModulePress = useCallback((moduleId: NavigationDestination) => {
    triggerItemHaptic();
    recordModuleUsage(moduleId);
    onNavigate(moduleId);
  }, [triggerItemHaptic, recordModuleUsage, onNavigate]);

  // Handle close
  const handleClose = useCallback(() => {
    triggerHaptic();
    onClose();
  }, [triggerHaptic, onClose]);

  // Handle "Meer" — go to next page, loop back to first page when at end
  const handleNextPage = useCallback(() => {
    triggerItemHaptic();
    setCurrentPage(prev => prev >= totalPages - 1 ? 0 : prev + 1);
  }, [triggerItemHaptic, totalPages]);

  // Handle "Terug" — go to previous page
  const handlePrevPage = useCallback(() => {
    triggerItemHaptic();
    setCurrentPage(prev => Math.max(prev - 1, 0));
  }, [triggerItemHaptic]);

  // Handle tap on backdrop
  const handleBackdropPress = useCallback((event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const container = containerLayout.current;

    const isOutsideLeft = pageX < container.x - dismissMargin;
    const isOutsideRight = pageX > container.x + container.width + dismissMargin;
    const isOutsideTop = pageY < container.y - dismissMargin;
    const isOutsideBottom = pageY > container.y + container.height + dismissMargin;

    if (isOutsideLeft || isOutsideRight || isOutsideTop || isOutsideBottom) {
      handleClose();
    }
  }, [dismissMargin, handleClose]);

  // Store container layout
  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    // event.target at runtime is a host component with measure(), but TypeScript types it as number
    const viewRef = event.target as unknown as {
      measure?: (callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void) => void;
    };
    if (viewRef && typeof viewRef.measure === 'function') {
      viewRef.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        containerLayout.current = { x: pageX, y: pageY, width, height };
      });
    }
  }, []);

  if (!visible) {
    return null;
  }

  // Pagination state helpers
  const isOnFirstPage = currentPage === 0;
  const isOnLastPage = currentPage >= totalPages - 1;
  const hasMorePages = totalPages > 1;

  // Calculate overlay background
  const overlayBackgroundOpacity = blurIntensity > 0
    ? 0.85 + (blurIntensity / 30) * 0.1
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
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            opacity: contentOpacity,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Module list container - title removed, users know this is a menu */}
        <View
          style={[styles.moduleContainer, { width: screenWidth - spacing.lg * 2 }]}
          onLayout={handleContainerLayout}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Active module (always at top, highlighted) */}
            {activeScreen && (
              <ModuleButton
                module={getModuleItem(activeScreen)}
                isActive={true}
                onPress={() => handleModulePress(activeScreen)}
                t={t}
                badgeCount={activeScreen === 'mail' ? mailUnreadCount : undefined}
              />
            )}

            {/* Divider */}
            {activeScreen && <View style={styles.divider} />}

            {/* Top modules or remaining modules */}
            {modulesToShow.map((moduleId) => (
              <ModuleButton
                key={moduleId}
                module={getModuleItem(moduleId)}
                isActive={false}
                onPress={() => handleModulePress(moduleId)}
                t={t}
                badgeCount={moduleId === 'mail' ? mailUnreadCount : undefined}
              />
            ))}

          </ScrollView>
        </View>

        {/* Navigation buttons row - pagination controls */}
        <View style={[styles.buttonRow, { width: screenWidth - spacing.lg * 2 }]}>
          {/* Layout depends on pagination state */}
          {hasMorePages ? (
            <>
              {/* Terug button - show when NOT on first page */}
              {!isOnFirstPage && (
                <TouchableOpacity
                  style={[styles.halfButton, { backgroundColor: accentColor.primary }]}
                  onPress={handlePrevPage}
                  activeOpacity={0.7}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t('navigation.back')}
                  accessibilityHint={t('navigation.back_hint', 'Toon de vorige modules')}
                >
                  <Text style={styles.buttonIcon}>▲</Text>
                  <Text style={styles.buttonText}>{t('navigation.back')}</Text>
                </TouchableOpacity>
              )}

              {/* Close button - show when on first page (left position) */}
              {isOnFirstPage && (
                <TouchableOpacity
                  style={[styles.halfButton, { backgroundColor: accentColor.primary }]}
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
                  <Text style={styles.buttonText}>{t('common.close')}</Text>
                </TouchableOpacity>
              )}

              {/* Meer button - always show (loops back to first page at end) */}
              <TouchableOpacity
                style={[styles.halfButton, { backgroundColor: accentColor.primary }]}
                onPress={handleNextPage}
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('navigation.more')}
                accessibilityHint={isOnLastPage
                  ? t('navigation.more_hint_loop', 'Terug naar eerste modules')
                  : t('navigation.more_hint', 'Toon meer modules')
                }
              >
                <Text style={styles.buttonIcon}>{isOnLastPage ? '↺' : '▼'}</Text>
                <Text style={styles.buttonText}>{t('navigation.more')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Only close button when no pagination needed */
            <TouchableOpacity
              style={[styles.fullButton, { backgroundColor: accentColor.primary }]}
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
              <Text style={styles.buttonText}>{t('common.close')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
});

// Module button component
interface ModuleButtonProps {
  module: ModuleItem;
  isActive: boolean;
  onPress: () => void;
  t: (key: string) => string;
  /** Badge count to show (e.g., unread mail) */
  badgeCount?: number;
}

/**
 * Extract moduleId from NavigationDestination for color lookup
 * Handles both static ('radio') and dynamic ('module:nunl') destinations
 */
function getModuleIdForColor(id: NavigationDestination): ModuleColorId {
  if (isDynamicDestination(id)) {
    return getModuleIdFromDest(id) as ModuleColorId;
  }
  // Map static destinations to ModuleColorId
  // Most match directly, some need mapping
  const staticToModuleId: Record<StaticNavigationDestination, ModuleColorId> = {
    chats: 'chats',
    contacts: 'contacts',
    groups: 'groups',
    calls: 'calls',
    podcast: 'podcast',
    radio: 'radio',
    books: 'books',
    weather: 'weather',
    appleMusic: 'appleMusic',
    camera: 'camera',
    photoAlbum: 'photoAlbum',
    askAI: 'askAI',
    mail: 'mail',
    agenda: 'agenda',
    settings: 'settings',
    help: 'help',
  };
  return staticToModuleId[id as StaticNavigationDestination] || 'chats';
}

function ModuleButton({ module, isActive, onPress, t, badgeCount }: ModuleButtonProps) {
  // Get color from context (respects user customization)
  const moduleColorId = getModuleIdForColor(module.id);
  const customColor = useModuleColor(moduleColorId);

  const badgeLabel = badgeCount && badgeCount > 0
    ? t('navigation.unread_badge', { count: badgeCount, defaultValue: '{{count}} nieuw' })
    : undefined;

  return (
    <TouchableOpacity
      style={[
        styles.moduleButton,
        { backgroundColor: customColor },
        isActive && styles.moduleButtonActive,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={
        badgeLabel
          ? `${t(module.labelKey)}, ${badgeLabel}`
          : t(module.labelKey)
      }
      accessibilityState={{ selected: isActive }}
      accessibilityHint={isActive
        ? t('navigation.current_module', 'Dit is je huidige module')
        : t('navigation.tap_to_go')
      }
    >
      {/* Icon with optional badge */}
      <View style={styles.iconWithBadge}>
        {/* Use custom logo if available, otherwise generic icon */}
        {module.customLogo ? (
          <View style={styles.customLogoContainer}>
            {module.customLogo}
          </View>
        ) : (
          <ModuleIcon type={module.icon} size={40} />
        )}
        {/* Badge indicator for unread count */}
        {badgeCount != null && badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badgeCount > 99 ? '99+' : badgeCount}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.moduleLabel}>{t(module.labelKey)}</Text>
    </TouchableOpacity>
  );
}

// Icon component for modules - uses unified Icon component from Icon.tsx
interface ModuleIconProps {
  type: ModuleIconType;
  size: number;
}

function ModuleIcon({ type, size }: ModuleIconProps) {
  const iconName = mapModuleIconToIconName(type);
  return (
    <Icon
      name={iconName}
      size={size}
      color={colors.textOnPrimary}
      strokeWidth={2}
    />
  );
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
    marginBottom: spacing.lg,
  },
  moduleContainer: {
    flex: 1,
    maxHeight: '70%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: spacing.sm,
    marginHorizontal: spacing.md,
  },
  moduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.md,
    minHeight: MODULE_ITEM_HEIGHT,
    ...shadows.small,
  },
  moduleButtonActive: {
    borderWidth: 3,
    borderColor: colors.textOnPrimary,
  },
  moduleLabel: {
    ...typography.h3,
    color: colors.textOnPrimary,
    marginLeft: spacing.md,
    flex: 1,
  },
  iconWithBadge: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#FF3B30', // iOS system red
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.3)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  customLogoContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  halfButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    minHeight: touchTargets.minimum,
  },
  fullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    minHeight: touchTargets.minimum,
    minWidth: 160,
  },
  buttonIcon: {
    ...typography.h3,
    color: colors.textOnPrimary,
    marginRight: spacing.xs,
  },
  buttonText: {
    ...typography.button,
    color: colors.textOnPrimary,
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
});
