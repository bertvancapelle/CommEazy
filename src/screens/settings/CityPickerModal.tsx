/**
 * CityPickerModal — City search and selection modal
 *
 * Extracted from ProfileSettingsScreen for better separation of concerns.
 *
 * Features:
 * - Debounced weather API search (Open-Meteo geocoding)
 * - Country-filtered results
 * - Disambiguation metadata (state/province, country)
 * - Senior-inclusive touch targets (≥60pt)
 * - Theme-aware styling
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
// Props
// ============================================================

export interface CityPickerModalProps {
  visible: boolean;
  onSelect: (location: WeatherLocation) => void;
  onClose: () => void;
  language: string;
  countryCode?: string; // ISO 3166-1 alpha-2 country code to filter results
}

// ============================================================
// Component
// ============================================================

export function CityPickerModal({ visible, onSelect, onClose, language, countryCode }: CityPickerModalProps) {
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
        console.debug('[CityPickerModal] Searching with countryCode:', countryCode, 'query:', searchQuery);
        const results = await weatherService.searchLocations(searchQuery, language, countryCode);
        setSearchResults(results);
        if (results.length === 0) {
          setSearchError(t('demographics.noCitiesFound'));
        }
      } catch (error) {
        console.error('[CityPickerModal] City search failed:', error);
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

  // Reset state when modal closes
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{t('demographics.selectCity')}</Text>
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
        <View style={[styles.searchContainer, { borderBottomColor: themeColors.border }]}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.textPrimary }]}
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

        {/* Search results */}
        <ScrollView style={styles.resultsList}>
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
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h3,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    padding: spacing.lg,
    alignItems: 'center',
  },
  hintText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
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
