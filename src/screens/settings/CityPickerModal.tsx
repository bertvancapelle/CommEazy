/**
 * CityPicker — City search and selection components
 *
 * Provides two variants:
 * - CitySearchInline: Renders search + results inline (preferred, no modal)
 * - CityPickerModal: Legacy modal wrapper for onboarding flow
 *
 * Features:
 * - Debounced weather API search (Open-Meteo geocoding)
 * - Country-filtered results
 * - Disambiguation metadata (state/province, country)
 * - Senior-inclusive touch targets (≥60pt)
 * - Theme-aware styling
 *
 * @see CLAUDE.md Section 15.1 — Search must NOT be inside a modal
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius, touchTargets } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { weatherService } from '@/services/weatherService';
import type { WeatherLocation } from '@/types/weather';

// ============================================================
// Helpers
// ============================================================

/** Format city display with disambiguation metadata */
export function formatCityDisplay(location: WeatherLocation): string {
  const parts = [location.name];

  // Add admin1 (state/province) if different from city name
  if (location.admin1 && location.admin1 !== location.name) {
    parts.push(location.admin1);
  }

  // Add country
  if (location.country) {
    parts.push(location.country);
  }

  return parts.join(', ');
}

// ============================================================
// Inline Search Component (Preferred — no modal)
// ============================================================

export interface CitySearchInlineProps {
  /** Whether the search panel is visible/expanded */
  visible: boolean;
  /** Called when a city is selected */
  onSelect: (location: WeatherLocation) => void;
  /** Called to collapse/close the search panel */
  onClose: () => void;
  /** Current app language for geocoding API */
  language: string;
  /** Optional ISO 3166-1 alpha-2 country code to filter results */
  countryCode?: string;
}

/**
 * Inline city search panel — renders directly in the parent screen layout.
 * Use this instead of CityPickerModal to comply with Section 15.1.
 */
export function CitySearchInline({ visible, onSelect, onClose, language, countryCode }: CitySearchInlineProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();
  const themeColors = useColors();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WeatherLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setSearchError(null);

    // Debounce search by 500ms
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        console.debug('[CitySearchInline] Searching with countryCode:', countryCode, 'query:', searchQuery);
        const results = await weatherService.searchLocations(searchQuery, language, countryCode);
        setSearchResults(results);
        if (results.length === 0) {
          setSearchError(t('demographics.noCitiesFound'));
        }
      } catch (error) {
        console.error('[CitySearchInline] City search failed:', error);
        setSearchError(t('demographics.citySearchError'));
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, language, countryCode, t]);

  // Reset state when panel hides
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchResults([]);
      setSearchError(null);
    }
  }, [visible]);

  const handleSelectCity = useCallback((location: WeatherLocation) => {
    onSelect(location);
    onClose();
  }, [onSelect, onClose]);

  if (!visible) return null;

  return (
    <View style={[styles.inlineContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      {/* Header with close button */}
      <View style={[styles.inlineHeader, { borderBottomColor: themeColors.border }]}>
        <Text style={[styles.inlineTitle, { color: themeColors.textPrimary }]}>{t('demographics.selectCity')}</Text>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Text style={[styles.closeText, { color: themeColors.textSecondary }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Search input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.textPrimary }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('demographics.citySearchPlaceholder')}
          placeholderTextColor={themeColors.textTertiary}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus={true}
          accessibilityLabel={t('demographics.citySearchPlaceholder')}
        />
        {isSearching && (
          <ActivityIndicator
            style={styles.searchSpinner}
            size="small"
            color={accentColor.primary}
          />
        )}
      </View>

      {/* Search hint */}
      {searchQuery.length === 0 && (
        <View style={styles.hintContainer}>
          <Text style={[styles.hintText, { color: themeColors.textSecondary }]}>
            {t('demographics.citySearchHint')}
          </Text>
        </View>
      )}

      {/* Search error */}
      {searchError && !isSearching && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: themeColors.error }]}>{searchError}</Text>
        </View>
      )}

      {/* Search results (max height to stay inline) */}
      <ScrollView style={styles.inlineResultsList} nestedScrollEnabled>
        {searchResults.map((location) => (
          <TouchableOpacity
            key={location.id}
            style={[styles.resultItem, { borderBottomColor: themeColors.border }]}
            onPress={() => handleSelectCity(location)}
            accessibilityRole="button"
            accessibilityLabel={formatCityDisplay(location)}
          >
            <View style={styles.resultContent}>
              <Text style={[styles.cityName, { color: themeColors.textPrimary }]}>{location.name}</Text>
              <Text style={[styles.cityMeta, { color: themeColors.textSecondary }]}>
                {[location.admin1, location.country].filter(Boolean).join(', ')}
              </Text>
            </View>
            <Text style={[styles.selectIcon, { color: themeColors.textTertiary }]}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================================
// Modal Wrapper (Legacy — for onboarding flow)
// ============================================================

export interface CityPickerModalProps {
  visible: boolean;
  onSelect: (location: WeatherLocation) => void;
  onClose: () => void;
  language: string;
  countryCode?: string;
}

/**
 * @deprecated Use CitySearchInline instead for settings screens.
 * This modal wrapper is kept for the onboarding flow where
 * the city picker appears as a step within a multi-step wizard.
 */
export function CityPickerModal({ visible, onSelect, onClose, language, countryCode }: CityPickerModalProps) {
  const themeColors = useColors();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: themeColors.background }]}>
        <CitySearchInline
          visible={true}
          onSelect={onSelect}
          onClose={onClose}
          language={language}
          countryCode={countryCode}
        />
      </View>
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  // Modal container (legacy)
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Inline container — rendered within parent screen
  inlineContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  inlineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inlineTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    minHeight: touchTargets.comfortable,
  },
  searchSpinner: {
    marginLeft: spacing.sm,
  },
  hintContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  hintText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
  },
  // Inline results — capped height so it doesn't take over the screen
  inlineResultsList: {
    maxHeight: 300,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultContent: {
    flex: 1,
  },
  cityName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  cityMeta: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  selectIcon: {
    ...typography.h2,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
});

export default CityPickerModal;
