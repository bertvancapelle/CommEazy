/**
 * MusicCollectionChipBar — Horizontal scrollable chip bar for music collections
 *
 * Displays:
 * 1. "Alle favorieten" chip (default, shows all favorites)
 * 2. User-created collections
 * 3. [+] create button at the end (always visible)
 *
 * Simplified version of ContactGroupChipBar — no smart sections, no emoji.
 *
 * Senior-inclusive design:
 * - Touch targets >= 60pt
 * - Typography >= 18pt
 * - Haptic feedback on selection
 * - Clear selection indicator
 *
 * @see ContactGroupChipBar.tsx (reference pattern)
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
import type { MusicCollection } from '@/services/music';

// ============================================================
// Types
// ============================================================

export type MusicChipId = 'all' | `collection:${string}`;

export interface MusicCollectionChipBarProps {
  /** Currently selected chip ID */
  selectedChipId: MusicChipId;
  /** User-created music collections */
  collections: MusicCollection[];
  /** Total count of all favorites (shown on "Alle" chip) */
  favoritesCount: number;
  /** Callback when a chip is selected */
  onSelectChip: (chipId: MusicChipId) => void;
  /** Callback when the [+] create button is pressed */
  onCreateCollection: () => void;
  /** Callback when a collection chip is long-pressed (for editing) */
  onLongPressCollection?: (collectionId: string) => void;
  /** Module accent color */
  accentColor?: string;
}

// ============================================================
// Component
// ============================================================

export function MusicCollectionChipBar({
  selectedChipId,
  collections,
  favoritesCount,
  onSelectChip,
  onCreateCollection,
  onLongPressCollection,
  accentColor,
}: MusicCollectionChipBarProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const resolvedAccent = accentColor || themeColors.primary;
  const scrollRef = useRef<ScrollView>(null);

  const handleChipPress = useCallback((chipId: MusicChipId) => {
    onSelectChip(chipId);
  }, [onSelectChip]);

  const renderChip = useCallback((
    chipId: MusicChipId,
    label: string,
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
            ? `${label}, ${count}`
            : label
        }
      >
        <Text
          style={[
            styles.chipText,
            { color: isSelected ? themeColors.textOnPrimary : themeColors.textPrimary },
          ]}
          numberOfLines={1}
        >
          {label}
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
        {/* "Alle favorieten" chip — always first */}
        {renderChip(
          'all',
          t('appleMusic.collections.allFavorites', 'Alle favorieten'),
          favoritesCount,
        )}

        {/* Collection chips — long-press to edit */}
        {collections.map(collection =>
          renderChip(
            `collection:${collection.id}` as MusicChipId,
            collection.name,
            collection.songCatalogIds.length,
            onLongPressCollection
              ? () => onLongPressCollection(collection.id)
              : undefined,
          )
        )}

        {/* [+] Create collection button — always visible */}
        <HapticTouchable
          style={[
            styles.chip,
            styles.createChip,
            { borderColor: themeColors.border, borderStyle: 'dashed' },
          ]}
          onPress={onCreateCollection}
          accessibilityRole="button"
          accessibilityLabel={t('appleMusic.collections.createCollection', 'Nieuwe verzameling')}
        >
          <Text style={[styles.chipText, { color: themeColors.textSecondary }]}>
            {`\u2795 ${t('appleMusic.collections.new', 'Nieuw')}`}
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
});

export default MusicCollectionChipBar;
