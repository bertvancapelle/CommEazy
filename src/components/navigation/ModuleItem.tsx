/**
 * ModuleItem — Shared module button component
 *
 * A reusable module button used by both:
 * - WheelNavigationMenu (iPhone)
 * - Sidebar (iPad)
 *
 * Supports different variants for each context while sharing core logic.
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Vibration,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  colors,
  typography,
  spacing,
  touchTargets,
  borderRadius,
  shadows,
} from '@/theme';
import { useFeedback } from '@/hooks/useFeedback';
import type { ModuleDefinition, ModuleIconType } from '@/types/navigation';
import { ModuleIcon } from './ModuleIcon';

// ============================================================
// Types
// ============================================================

export type ModuleItemVariant = 'wheel' | 'sidebar' | 'sidebar-compact';

export type ModuleItemSize = 'small' | 'medium' | 'large';

export interface ModuleItemProps {
  /** Module definition */
  module: ModuleDefinition;

  /** Whether this is the currently active module */
  isActive: boolean;

  /** Called when the module is pressed */
  onPress: () => void;

  /**
   * Visual variant:
   * - 'wheel': Full-width button with color background (iPhone wheel menu)
   * - 'sidebar': Horizontal row with icon + label (iPad sidebar expanded)
   * - 'sidebar-compact': Icon-only button (iPad sidebar collapsed)
   */
  variant: ModuleItemVariant;

  /**
   * Size variant:
   * - 'small': Compact icon (24pt)
   * - 'medium': Standard icon (32pt)
   * - 'large': Large icon (40pt)
   */
  size?: ModuleItemSize;

  /** Accent color for active state (defaults to module color) */
  accentColor?: string;
}

// ============================================================
// Constants
// ============================================================

const ICON_SIZES: Record<ModuleItemSize, number> = {
  small: 24,
  medium: 32,
  large: 40,
};

// ============================================================
// Component
// ============================================================

export function ModuleItem({
  module,
  isActive,
  onPress,
  variant,
  size = 'medium',
  accentColor,
}: ModuleItemProps) {
  const { t } = useTranslation();
  const { triggerFeedback } = useFeedback();

  const iconSize = ICON_SIZES[size];
  const activeColor = accentColor ?? module.color;

  const handlePress = useCallback(() => {
    void triggerFeedback('tap');
    onPress();
  }, [onPress, triggerFeedback]);

  // Render based on variant
  switch (variant) {
    case 'wheel':
      return (
        <WheelVariant
          module={module}
          isActive={isActive}
          onPress={handlePress}
          iconSize={iconSize}
          label={t(module.labelKey)}
        />
      );

    case 'sidebar':
      return (
        <SidebarVariant
          module={module}
          isActive={isActive}
          onPress={handlePress}
          iconSize={iconSize}
          activeColor={activeColor}
          label={t(module.labelKey)}
        />
      );

    case 'sidebar-compact':
      return (
        <SidebarCompactVariant
          module={module}
          isActive={isActive}
          onPress={handlePress}
          iconSize={iconSize}
          activeColor={activeColor}
          label={t(module.labelKey)}
        />
      );
  }
}

// ============================================================
// Wheel Variant (iPhone)
// ============================================================

interface WheelVariantProps {
  module: ModuleDefinition;
  isActive: boolean;
  onPress: () => void;
  iconSize: number;
  label: string;
}

function WheelVariant({
  module,
  isActive,
  onPress,
  iconSize,
  label,
}: WheelVariantProps) {
  return (
    <TouchableOpacity
      style={[
        styles.wheelButton,
        { backgroundColor: module.color },
        isActive && styles.wheelButtonActive,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
    >
      {module.customLogo ? (
        <View style={styles.customLogoContainer}>
          {module.customLogo}
        </View>
      ) : (
        <ModuleIcon type={module.icon} size={iconSize} color={colors.textOnPrimary} />
      )}
      <Text style={styles.wheelLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Sidebar Variant (iPad expanded)
// ============================================================

interface SidebarVariantProps {
  module: ModuleDefinition;
  isActive: boolean;
  onPress: () => void;
  iconSize: number;
  activeColor: string;
  label: string;
}

function SidebarVariant({
  module,
  isActive,
  onPress,
  iconSize,
  activeColor,
  label,
}: SidebarVariantProps) {
  return (
    <TouchableOpacity
      style={[
        styles.sidebarButton,
        isActive && [styles.sidebarButtonActive, { backgroundColor: activeColor + '15' }],
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
    >
      <View
        style={[
          styles.sidebarIconContainer,
          { backgroundColor: module.color },
        ]}
      >
        {module.customLogo ? (
          module.customLogo
        ) : (
          <ModuleIcon type={module.icon} size={iconSize} color={colors.textOnPrimary} />
        )}
      </View>
      <Text
        style={[
          styles.sidebarLabel,
          isActive && [styles.sidebarLabelActive, { color: activeColor }],
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {isActive && (
        <View style={[styles.activeIndicator, { backgroundColor: activeColor }]} />
      )}
    </TouchableOpacity>
  );
}

// ============================================================
// Sidebar Compact Variant (iPad collapsed)
// ============================================================

interface SidebarCompactVariantProps {
  module: ModuleDefinition;
  isActive: boolean;
  onPress: () => void;
  iconSize: number;
  activeColor: string;
  label: string;
}

function SidebarCompactVariant({
  module,
  isActive,
  onPress,
  iconSize,
  activeColor,
  label,
}: SidebarCompactVariantProps) {
  return (
    <TouchableOpacity
      style={[
        styles.compactButton,
        isActive && [styles.compactButtonActive, { borderColor: activeColor }],
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
    >
      <View
        style={[
          styles.compactIconContainer,
          { backgroundColor: module.color },
        ]}
      >
        {module.customLogo ? (
          module.customLogo
        ) : (
          <ModuleIcon type={module.icon} size={iconSize} color={colors.textOnPrimary} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  // Wheel variant (iPhone)
  wheelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.md,
    minHeight: 80,
    ...shadows.small,
  },
  wheelButtonActive: {
    borderWidth: 3,
    borderColor: colors.textOnPrimary,
  },
  wheelLabel: {
    ...typography.h3,
    color: colors.textOnPrimary,
    marginLeft: spacing.md,
    flex: 1,
  },
  customLogoContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sidebar variant (iPad expanded)
  sidebarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
  },
  sidebarButtonActive: {
    // Background color applied dynamically
  },
  sidebarIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarLabel: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.md,
    flex: 1,
  },
  sidebarLabelActive: {
    fontWeight: '700',
  },
  activeIndicator: {
    width: 4,
    height: 24,
    borderRadius: 2,
    marginLeft: spacing.sm,
  },

  // Sidebar compact variant (iPad collapsed)
  compactButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  compactButtonActive: {
    // Border color applied dynamically
  },
  compactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ModuleItem;
