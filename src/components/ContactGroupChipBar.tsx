/**
 * ContactGroupChipBar — Horizontal scrollable chip bar for contact groups
 *
 * Displays:
 * 1. "Alle" chip (default, shows all contacts)
 * 2. Smart sections (ICE, Birthdays, etc.) — hidden when empty
 * 3. Visual divider between smart/manual sections
 * 4. Manual groups (user-created)
 * 5. [+] create button at the end
 *
 * Senior-inclusive design:
 * - Touch targets >= 60pt
 * - Typography >= 18pt
 * - Haptic feedback on selection
 * - Clear selection indicator
 *
 * @see .claude/plans/CONTACT_GROUPS.md
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { typography, spacing, touchTargets, borderRadius } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { HapticTouchable } from './HapticTouchable';
import type { ContactGroup } from '@/services/contacts';
import type { SmartSection } from '@/services/contacts';

// ============================================================
// Types
// ============================================================

export type ChipId = 'all' | `smart:${string}` | `group:${string}`;

export interface ContactGroupChipBarProps {
  /** Currently selected chip ID */
  selectedChipId: ChipId;
  /** Smart sections with their contacts (empty sections are hidden) */
  smartSections: SmartSection[];
  /** User-created manual groups */
  groups: ContactGroup[];
  /** Callback when a chip is selected */
  onSelectChip: (chipId: ChipId) => void;
  /** Callback when the [+] create button is pressed */
  onCreateGroup: () => void;
  /** Callback when a manual group chip is long-pressed (for editing) */
  onLongPressGroup?: (groupId: string) => void;
  /** Module accent color */
  accentColor?: string;
}

// ============================================================
// Component
// ============================================================

export function ContactGroupChipBar({
  selectedChipId,
  smartSections,
  groups,
  onSelectChip,
  onCreateGroup,
  onLongPressGroup,
  accentColor,
}: ContactGroupChipBarProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const resolvedAccent = accentColor || themeColors.primary;
  const scrollRef = useRef<ScrollView>(null);

  // Only show smart sections that have contacts
  const visibleSmartSections = smartSections.filter(s => s.contacts.length > 0);

  // Whether we need a divider (smart sections AND manual groups both present)
  const showDivider = visibleSmartSections.length > 0 && groups.length > 0;

  const handleChipPress = useCallback((chipId: ChipId) => {
    onSelectChip(chipId);
  }, [onSelectChip]);

  const renderChip = useCallback((
    chipId: ChipId,
    label: string,
    emoji?: string,
    count?: number,
    chipOnLongPress?: () => void,
  ) => {
    const isSelected = selectedChipId === chipId;

    return (
      <HapticTouchable
        key={chipId}
        style={[
          styles.chip,
          {
            backgroundColor: isSelected ? resolvedAccent : themeColors.surface,
            borderColor: isSelected ? resolvedAccent : themeColors.border,
          },
        ]}
        onPress={() => handleChipPress(chipId)}
        onLongPress={chipOnLongPress}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={
          count !== undefined
            ? `${emoji ? emoji + ' ' : ''}${label}, ${count}`
            : `${emoji ? emoji + ' ' : ''}${label}`
        }
      >
        <Text
          style={[
            styles.chipText,
            { color: isSelected ? themeColors.textOnPrimary : themeColors.textPrimary },
          ]}
          numberOfLines={1}
        >
          {emoji ? `${emoji} ${label}` : label}
        </Text>
        {count !== undefined && count > 0 && (
          <View
            style={[
              styles.chipCount,
              {
                backgroundColor: isSelected
                  ? 'rgba(255, 255, 255, 0.3)'
                  : 'rgba(0, 0, 0, 0.08)',
              },
            ]}
          >
            <Text
              style={[
                styles.chipCountText,
                { color: isSelected ? themeColors.textOnPrimary : themeColors.textSecondary },
              ]}
            >
              {count}
            </Text>
          </View>
        )}
      </HapticTouchable>
    );
  }, [selectedChipId, resolvedAccent, themeColors, handleChipPress]);

  return (
    <View style={[styles.container, { borderBottomColor: themeColors.divider }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        accessibilityRole="tablist"
      >
        {/* "Alle" chip — always first */}
        {renderChip('all', t('contacts.groups.all', 'Alle'), '\uD83D\uDC65')}

        {/* Smart sections — only visible ones */}
        {visibleSmartSections.map(section =>
          renderChip(
            `smart:${section.id}` as ChipId,
            t(section.labelKey, section.id),
            section.emoji,
            section.contacts.length,
          )
        )}

        {/* Visual divider between smart and manual sections */}
        {showDivider && (
          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
        )}

        {/* Manual groups — long-press to edit */}
        {groups.map(group =>
          renderChip(
            `group:${group.id}` as ChipId,
            group.name,
            group.emoji,
            group.contactJids.length,
            onLongPressGroup ? () => onLongPressGroup(group.id) : undefined,
          )
        )}

        {/* [+] Create group button */}
        <HapticTouchable
          style={[
            styles.chip,
            styles.createChip,
            { borderColor: themeColors.border, borderStyle: 'dashed' },
          ]}
          onPress={onCreateGroup}
          accessibilityRole="button"
          accessibilityLabel={t('contacts.groups.createGroup', 'Nieuwe groep')}
        >
          <Text style={[styles.chipText, { color: themeColors.textSecondary }]}>
            {`\u2795 ${t('contacts.groups.createGroup', 'Nieuw')}`}
          </Text>
        </HapticTouchable>
      </ScrollView>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    minHeight: touchTargets.minimum,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: spacing.xs,
  },
  chipText: {
    ...typography.body,
    fontWeight: '600',
  },
  chipCount: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    minWidth: 24,
    alignItems: 'center',
  },
  chipCountText: {
    ...typography.label,
    fontWeight: '700',
  },
  createChip: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  divider: {
    width: 1,
    height: 36,
    marginHorizontal: spacing.xs,
  },
});

export default ContactGroupChipBar;
