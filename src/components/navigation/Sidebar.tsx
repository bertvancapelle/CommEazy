/**
 * Sidebar — iPad navigation sidebar
 *
 * Always visible in landscape, collapsible in portrait.
 * Shows modules grouped by category with visual separators.
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useNavigationContext } from '@/contexts/NavigationContext';
import { useAccentColorContext } from '@/contexts/AccentColorContext';
import { ModuleItem } from './ModuleItem';
import { ModuleIcon } from './ModuleIcon';
import {
  colors,
  spacing,
  typography,
  borderRadius,
  touchTargets,
} from '@/theme';
import type { ModuleDefinition, NavigationDestination } from '@/types/navigation';

// ============================================================
// Constants
// ============================================================

/** Sidebar width in regular mode */
const SIDEBAR_WIDTH = 280;

/** Sidebar width in collapsed mode (icon-only) */
const SIDEBAR_WIDTH_COLLAPSED = 72;

// ============================================================
// Types
// ============================================================

export interface SidebarProps {
  /** Whether sidebar is collapsed (portrait mode) */
  isCollapsed?: boolean;
  /** Callback when module is selected */
  onModuleSelect?: (module: ModuleDefinition) => void;
}

// ============================================================
// Component
// ============================================================

export function Sidebar({ isCollapsed = false, onModuleSelect }: SidebarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { accentColor } = useAccentColorContext();
  const {
    modules,
    getModulesByGroup,
    activeModule,
    navigateTo,
  } = useNavigationContext();

  // Get modules grouped by section
  const groups = useMemo(() => getModulesByGroup(), [getModulesByGroup]);

  // Handle module press
  const handleModulePress = (module: ModuleDefinition) => {
    navigateTo(module.id);
    onModuleSelect?.(module);
  };

  // Current width based on collapsed state
  const sidebarWidth = isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <View
      style={[
        styles.container,
        {
          width: sidebarWidth,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
      accessibilityRole="navigation"
      accessibilityLabel={t('navigation.sidebar')}
    >
      {/* App Logo / Header */}
      <View style={styles.header}>
        {isCollapsed ? (
          <View style={styles.logoCollapsed}>
            <Text style={styles.logoIcon}>📱</Text>
          </View>
        ) : (
          <Text style={styles.logoText}>CommEazy</Text>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Primary Section (Communication) */}
        <SidebarSection
          title={isCollapsed ? undefined : t('navigation.sections.communication')}
          modules={groups.primary}
          activeModule={activeModule}
          isCollapsed={isCollapsed}
          onModulePress={handleModulePress}
          accentColor={accentColor.primary}
        />

        {/* Secondary Section (Media) */}
        <SidebarSection
          title={isCollapsed ? undefined : t('navigation.sections.media')}
          modules={groups.secondary}
          activeModule={activeModule}
          isCollapsed={isCollapsed}
          onModulePress={handleModulePress}
          accentColor={accentColor.primary}
        />

        {/* Dynamic Section (Country-specific modules) */}
        {groups.dynamic.length > 0 && (
          <SidebarSection
            title={isCollapsed ? undefined : t('navigation.sections.modules')}
            modules={groups.dynamic}
            activeModule={activeModule}
            isCollapsed={isCollapsed}
            onModulePress={handleModulePress}
            accentColor={accentColor.primary}
          />
        )}

        {/* Spacer to push footer to bottom */}
        <View style={styles.spacer} />

        {/* Footer Section (Settings, Help) */}
        <SidebarSection
          modules={groups.footer}
          activeModule={activeModule}
          isCollapsed={isCollapsed}
          onModulePress={handleModulePress}
          accentColor={accentColor.primary}
          isFooter
        />
      </ScrollView>
    </View>
  );
}

// ============================================================
// Section Component
// ============================================================

interface SidebarSectionProps {
  title?: string;
  modules: ModuleDefinition[];
  activeModule: NavigationDestination | null;
  isCollapsed: boolean;
  onModulePress: (module: ModuleDefinition) => void;
  accentColor: string;
  isFooter?: boolean;
}

function SidebarSection({
  title,
  modules,
  activeModule,
  isCollapsed,
  onModulePress,
  accentColor,
  isFooter = false,
}: SidebarSectionProps) {
  const { t } = useTranslation();

  if (modules.length === 0) return null;

  return (
    <View style={[styles.section, isFooter && styles.sectionFooter]}>
      {/* Section Title */}
      {title && !isCollapsed && (
        <Text style={styles.sectionTitle}>{title}</Text>
      )}

      {/* Module Items */}
      {modules.map((module) => (
        <SidebarItem
          key={module.id}
          module={module}
          isActive={activeModule === module.id}
          isCollapsed={isCollapsed}
          onPress={() => onModulePress(module)}
          accentColor={accentColor}
        />
      ))}

      {/* Divider (not for footer) */}
      {!isFooter && !isCollapsed && <View style={styles.divider} />}
    </View>
  );
}

// ============================================================
// Item Component
// ============================================================

interface SidebarItemProps {
  module: ModuleDefinition;
  isActive: boolean;
  isCollapsed: boolean;
  onPress: () => void;
  accentColor: string;
}

function SidebarItem({
  module,
  isActive,
  isCollapsed,
  onPress,
  accentColor,
}: SidebarItemProps) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={[
        styles.item,
        isCollapsed && styles.itemCollapsed,
        isActive && [styles.itemActive, { backgroundColor: accentColor + '15' }],
      ]}
      onPress={onPress}
      onLongPress={() => {}} // Block double-action from hold gesture
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={t(module.labelKey)}
      accessibilityState={{ selected: isActive }}
    >
      {/* Icon */}
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: module.color + '20' },
        ]}
      >
        <ModuleIcon
          icon={module.icon}
          size={24}
          color={module.color}
        />
      </View>

      {/* Label (hidden when collapsed) */}
      {!isCollapsed && (
        <Text
          style={[
            styles.itemLabel,
            isActive && [styles.itemLabelActive, { color: accentColor }],
          ]}
          numberOfLines={1}
        >
          {t(module.labelKey)}
        </Text>
      )}

      {/* Active indicator */}
      {isActive && (
        <View
          style={[
            styles.activeIndicator,
            { backgroundColor: accentColor },
          ]}
        />
      )}
    </TouchableOpacity>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundSecondary,
    borderRightWidth: 1,
    borderRightColor: colors.divider,
    height: '100%',
  },

  // Header
  header: {
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    marginBottom: spacing.sm,
  },
  logoText: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  logoCollapsed: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 24,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.sm,
  },

  // Section
  section: {
    marginBottom: spacing.sm,
  },
  sectionFooter: {
    marginTop: 'auto',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textTertiary,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.md,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.lg,
  },

  // Item
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    marginVertical: 2,
    position: 'relative',
  },
  itemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  itemActive: {
    // Background color set inline with accent color
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemLabel: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.md,
    flex: 1,
  },
  itemLabelActive: {
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '25%',
    width: 4,
    height: '50%',
    borderRadius: 2,
  },
});

export default Sidebar;
