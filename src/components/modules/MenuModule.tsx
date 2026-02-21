/**
 * MenuModule — Module list for iPad Split View
 *
 * Displays a list of all available modules, grouped by category.
 * Selecting a module replaces this panel's content with that module.
 *
 * Initial state for left panel on iPad.
 *
 * Design:
 * - Touch targets ≥60pt (senior-inclusive)
 * - Text ≥18pt
 * - WCAG AAA contrast
 * - Haptic feedback on selection
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, { useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { useSplitViewContext, type PanelId } from '@/contexts/SplitViewContext';
import { useNavigationContext } from '@/contexts/NavigationContext';
import { ModuleIcon } from '@/components/navigation/ModuleIcon';
import type { ModuleDefinition, NavigationDestination } from '@/types/navigation';
import {
  colors,
  typography,
  spacing,
  borderRadius,
  touchTargets,
} from '@/theme';

// ============================================================
// Types
// ============================================================

export interface MenuModuleProps {
  /** Which panel this menu is in */
  panelId: PanelId;
}

// ============================================================
// Component
// ============================================================

export function MenuModule({ panelId }: MenuModuleProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { getModulesByGroup } = useNavigationContext();
  const { setLeftModule, setRightModule } = useSplitViewContext();

  // Get grouped modules
  const groupedModules = getModulesByGroup();

  // ============================================================
  // Handlers
  // ============================================================

  const handleModuleSelect = useCallback(
    (moduleId: NavigationDestination) => {
      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Replace this panel's module
      if (panelId === 'left') {
        setLeftModule(moduleId);
      } else {
        setRightModule(moduleId);
      }
    },
    [panelId, setLeftModule, setRightModule]
  );

  // ============================================================
  // Render
  // ============================================================

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('splitView.menu')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Primary Section (Communication) */}
        <MenuSection
          title={t('navigation.sections.communication')}
          modules={groupedModules.primary}
          onSelect={handleModuleSelect}
        />

        {/* Secondary Section (Media) */}
        <MenuSection
          title={t('navigation.sections.media')}
          modules={groupedModules.secondary}
          onSelect={handleModuleSelect}
        />

        {/* Dynamic Section (Country-specific) */}
        {groupedModules.dynamic.length > 0 && (
          <MenuSection
            title={t('navigation.sections.modules')}
            modules={groupedModules.dynamic}
            onSelect={handleModuleSelect}
          />
        )}

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Footer Section */}
        <MenuSection
          modules={groupedModules.footer}
          onSelect={handleModuleSelect}
          isFooter
        />
      </ScrollView>
    </View>
  );
}

// ============================================================
// Section Component
// ============================================================

interface MenuSectionProps {
  title?: string;
  modules: ModuleDefinition[];
  onSelect: (moduleId: NavigationDestination) => void;
  isFooter?: boolean;
}

function MenuSection({
  title,
  modules,
  onSelect,
  isFooter = false,
}: MenuSectionProps) {
  if (modules.length === 0) return null;

  return (
    <View style={[styles.section, isFooter && styles.sectionFooter]}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      {modules.map((module) => (
        <MenuListItem
          key={module.id}
          module={module}
          onPress={() => onSelect(module.id)}
        />
      ))}
      {!isFooter && <View style={styles.divider} />}
    </View>
  );
}

// ============================================================
// List Item Component
// ============================================================

interface MenuListItemProps {
  module: ModuleDefinition;
  onPress: () => void;
}

function MenuListItem({ module, onPress }: MenuListItemProps) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={styles.listItem}
      onPress={onPress}
      onLongPress={() => {}} // Block double-action from hold gesture
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={t(module.labelKey)}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: module.color + '20' },
        ]}
      >
        <ModuleIcon type={module.icon} size={24} color={module.color} />
      </View>
      <Text style={styles.itemLabel}>{t(module.labelKey)}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },

  // Header
  header: {
    height: 64,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.md,
  },

  // Section
  section: {
    marginBottom: spacing.xs,
  },
  sectionFooter: {
    marginTop: 'auto',
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textTertiary,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },

  // List Item
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: touchTargets.minimum,
    marginVertical: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
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
  chevron: {
    fontSize: 24,
    color: colors.textTertiary,
    fontWeight: '300',
  },
});

export default MenuModule;
