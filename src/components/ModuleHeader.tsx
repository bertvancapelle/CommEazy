/**
 * ModuleHeader — Standardized header component for all module screens
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────────┐
 * │  Safe Area (notch/Dynamic Island)                             │
 * ├──────────────────────────────────────────────────────────────┤
 * │  📻 Radio                              🔊 [MediaIndicator]    │
 * │  ↑ Links (spacing.md)                  ↑ Rechts (spacing.md)  │
 * ├──────────────────────────────────────────────────────────────┤
 * │  [═══════════ AdMob Banner ═══════════════════]              │
 * ├──────────────────────────────────────────────────────────────┤
 * │  ─ ─ ─ ─ ─ ─ ─  Separator line (1pt) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Senior-inclusive design:
 * - Touch targets ≥60pt for MediaIndicator
 * - High contrast text on colored background
 * - Consistent layout across all modules
 *
 * @see .claude/CLAUDE.md Section 12.2 (ModuleHeader Component)
 * @see .claude/skills/ui-designer/SKILL.md Section 7c
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { MediaIndicator } from './MediaIndicator';
import { colors, typography, spacing, touchTargets } from '@/theme';
import type { IconName } from './Icon';

// ============================================================
// Types
// ============================================================

export interface ModuleHeaderProps {
  /** Module identifier for color lookup */
  moduleId: string;
  /** Module icon name */
  icon: IconName;
  /** Module title (use t('modules.xxx.title')) */
  title: string;
  /** Current module source for MediaIndicator filtering */
  currentSource?: 'radio' | 'podcast' | 'books';
  /** Show AdMob banner in header (default: true) */
  showAdMob?: boolean;
  /** AdMob unit ID (optional, uses default if not provided) */
  adMobUnitId?: string;
  /** Show back button (for detail screens) */
  showBackButton?: boolean;
  /** Callback when back button is pressed */
  onBackPress?: () => void;
  /** Accessibility label for back button (default: "Terug") */
  backButtonLabel?: string;
}

// ============================================================
// Module Colors
// ============================================================

/**
 * Module colors — consistent with WheelNavigationMenu
 */
const MODULE_COLORS: Record<string, string> = {
  radio: '#00897B',      // Teal
  podcast: '#E91E63',    // Pink
  audiobook: '#7B1FA2',  // Purple
  books: '#7B1FA2',      // Purple (alias for audiobook)
  ebook: '#F57C00',      // Orange
  videocall: '#C62828',  // Red
  calls: '#1565C0',      // Blue
  contacts: '#2E7D32',   // Green
  groups: '#00796B',     // Teal (darker)
  messages: '#1976D2',   // Blue (primary)
  settings: '#5E35B1',   // Deep Purple
};

// ============================================================
// Component
// ============================================================

export function ModuleHeader({
  moduleId,
  icon,
  title,
  currentSource,
  showAdMob = true,
  adMobUnitId,
  showBackButton = false,
  onBackPress,
  backButtonLabel = 'Terug',
}: ModuleHeaderProps) {
  const insets = useSafeAreaInsets();
  const moduleColor = MODULE_COLORS[moduleId] || colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: moduleColor }]}>
      {/* Safe Area Spacer */}
      <View style={{ height: insets.top }} />

      {/* Title Row */}
      <View style={styles.titleRow}>
        {/* Left: Back button (optional) + Icon + Title */}
        <View style={styles.titleContent}>
          {showBackButton && onBackPress && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBackPress}
              accessibilityRole="button"
              accessibilityLabel={backButtonLabel}
            >
              <Icon name="chevron-left" size={28} color={colors.textOnPrimary} />
            </TouchableOpacity>
          )}
          <Icon name={icon} size={28} color={colors.textOnPrimary} />
          <Text style={styles.title}>{title}</Text>
        </View>

        {/* Right: MediaIndicator with ≥60pt touch wrapper */}
        <View style={styles.mediaIndicatorWrapper}>
          <MediaIndicator
            moduleColor={moduleColor}
            currentSource={currentSource}
          />
        </View>
      </View>

      {/* AdMob Row (optional) */}
      {showAdMob && (
        <View style={styles.adMobRow}>
          {/* TODO: Implement AdMobBanner component */}
          {/* <AdMobBanner unitId={adMobUnitId} /> */}
          <View style={styles.adMobPlaceholder}>
            <Text style={styles.adMobPlaceholderText}>AdMob Banner</Text>
          </View>
        </View>
      )}

      {/* Separator Line */}
      <View style={styles.separator} />
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    // No fixed height — grows with content
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,    // 16pt padding beide kanten
    paddingVertical: spacing.sm,       // Compact verticaal
  },
  titleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,                   // 8pt tussen icon en titel
  },
  backButton: {
    // Senior-inclusive touch target ≥60pt
    minWidth: touchTargets.minimum,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  mediaIndicatorWrapper: {
    // Ensure ≥60pt touch target for seniors
    minWidth: touchTargets.minimum,    // 60pt
    minHeight: touchTargets.minimum,   // 60pt
    justifyContent: 'center',
    alignItems: 'center',
  },
  adMobRow: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  adMobPlaceholder: {
    // Temporary placeholder until AdMobBanner is implemented
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adMobPlaceholderText: {
    ...typography.small,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',  // Subtle white line
  },
});

export default ModuleHeader;
