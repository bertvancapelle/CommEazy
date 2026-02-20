/**
 * WeatherScreen — Weather Forecast Module
 *
 * Senior-inclusive weather forecast with:
 * - Current weather display
 * - 7-day forecast
 * - Rain prediction
 * - Location search and favorites (max 10)
 * - TTS support for all sections
 * - Large touch targets (60pt+)
 *
 * Voice commands supported:
 * - "volgende" / "vorige" — Navigate locations
 * - "[location name]" — Select location
 * - "voorlezen" — Read current weather
 *
 * @see .claude/plans/WEATHER_MODULE.md
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors, typography, spacing, touchTargets, borderRadius, shadows } from '@/theme';
import { Icon, ModuleHeader, VoiceFocusable } from '@/components';
import { useVoiceFocusList } from '@/contexts/VoiceFocusContext';
import { useHoldGestureContextSafe } from '@/contexts/HoldGestureContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';
import { useWeather } from '@/hooks/useWeather';
import { weatherService } from '@/services/weatherService';
import type { WeatherLocation, DailyForecast } from '@/types/weather';
import { WEATHER_MODULE_CONFIG } from '@/types/weather';

// ============================================================
// Constants
// ============================================================

const MODULE_ID = 'weather';
const MODULE_COLOR = WEATHER_MODULE_CONFIG.accentColor;
const WELCOME_SHOWN_KEY = 'weather_welcome_shown';

// ============================================================
// TTS Button Component
// ============================================================

interface TTSButtonProps {
  isPlaying: boolean;
  isActive: boolean;
  onPress: () => void;
  label: string;
  compact?: boolean;
}

function TTSButton({ isPlaying, isActive, onPress, label, compact }: TTSButtonProps) {
  const { t } = useTranslation();
  const holdGesture = useHoldGestureContextSafe();

  const handlePress = useCallback(() => {
    if (holdGesture?.isGestureConsumed?.()) {
      return;
    }
    onPress();
  }, [onPress, holdGesture]);

  return (
    <TouchableOpacity
      style={[
        compact ? styles.ttsButtonCompact : styles.ttsButton,
        isActive && styles.ttsButtonActive,
      ]}
      onPress={handlePress}
      onLongPress={() => {}}
      delayLongPress={300}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={isActive ? t('tts.stop') : label}
    >
      <Icon
        name={isActive ? 'stop' : 'volume-high'}
        size={compact ? 20 : 24}
        color={isActive ? colors.textOnPrimary : MODULE_COLOR}
      />
      {!compact && (
        <Text style={[styles.ttsButtonText, isActive && styles.ttsButtonTextActive]}>
          {isActive ? t('tts.stop') : t('tts.readAloud')}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ============================================================
// Forecast Day Component
// ============================================================

interface ForecastDayProps {
  day: DailyForecast;
  index: number;
}

function ForecastDay({ day, index }: ForecastDayProps) {
  const { t, i18n } = useTranslation();

  const dayName = useMemo(() => {
    if (index === 0) return t('modules.weather.today');
    if (index === 1) return t('modules.weather.tomorrow');
    return day.date.toLocaleDateString(i18n.language, { weekday: 'short' });
  }, [day.date, index, t, i18n.language]);

  const iconName = weatherService.getWeatherIcon(day.weatherCode, true);

  return (
    <View style={styles.forecastDay}>
      <Text style={styles.forecastDayName}>{dayName}</Text>
      <Icon name={iconName} size={32} color={MODULE_COLOR} />
      <Text style={styles.forecastTempHigh}>{Math.round(day.temperatureMax)}°</Text>
      <Text style={styles.forecastTempLow}>{Math.round(day.temperatureMin)}°</Text>
    </View>
  );
}

// ============================================================
// Location Item Component
// ============================================================

interface LocationItemProps {
  location: WeatherLocation;
  isSelected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

function LocationItem({ location, isSelected, onPress, onLongPress }: LocationItemProps) {
  const holdGesture = useHoldGestureContextSafe();

  const handlePress = useCallback(() => {
    if (holdGesture?.isGestureConsumed?.()) {
      return;
    }
    onPress();
  }, [onPress, holdGesture]);

  return (
    <TouchableOpacity
      style={[styles.locationItem, isSelected && styles.locationItemActive]}
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={500}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={location.name}
      accessibilityState={{ selected: isSelected }}
    >
      <Icon
        name={location.isCurrentLocation ? 'crosshairs-gps' : 'star'}
        size={20}
        color={isSelected ? colors.textOnPrimary : MODULE_COLOR}
      />
      <Text
        style={[styles.locationItemText, isSelected && styles.locationItemTextActive]}
        numberOfLines={1}
      >
        {location.name}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Search Result Item Component
// ============================================================

interface SearchResultItemProps {
  location: WeatherLocation;
  onPress: () => void;
}

function SearchResultItem({ location, onPress }: SearchResultItemProps) {
  return (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${location.name}, ${location.country}`}
    >
      <Icon name="map-marker" size={20} color={MODULE_COLOR} />
      <View style={styles.searchResultText}>
        <Text style={styles.searchResultName}>{location.name}</Text>
        <Text style={styles.searchResultCountry}>
          {location.admin1 ? `${location.admin1}, ` : ''}{location.country}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// Welcome Modal Component
// ============================================================

interface WelcomeModalProps {
  visible: boolean;
  onDismiss: () => void;
}

function WelcomeModal({ visible, onDismiss }: WelcomeModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { accentColor } = useAccentColor();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.welcomeModal, { paddingBottom: insets.bottom + spacing.lg }]}>
          {/* Header */}
          <View style={[styles.welcomeHeader, { backgroundColor: MODULE_COLOR }]}>
            <Icon name="weather-partly-cloudy" size={48} color={colors.textOnPrimary} />
            <Text style={styles.welcomeTitle}>{t('modules.weather.welcome.title')}</Text>
          </View>

          {/* Steps */}
          <View style={styles.welcomeContent}>
            <View style={styles.welcomeStep}>
              <View style={[styles.stepNumber, { backgroundColor: MODULE_COLOR }]}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>{t('modules.weather.welcome.step1')}</Text>
            </View>

            <View style={styles.welcomeStep}>
              <View style={[styles.stepNumber, { backgroundColor: MODULE_COLOR }]}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>{t('modules.weather.welcome.step2')}</Text>
            </View>

            <View style={styles.welcomeStep}>
              <View style={[styles.stepNumber, { backgroundColor: MODULE_COLOR }]}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>{t('modules.weather.welcome.step3')}</Text>
            </View>
          </View>

          {/* Button */}
          <TouchableOpacity
            style={[styles.welcomeButton, { backgroundColor: MODULE_COLOR }]}
            onPress={onDismiss}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('modules.weather.welcome.understood')}
          >
            <Text style={styles.welcomeButtonText}>{t('modules.weather.welcome.understood')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================
// Main Screen Component
// ============================================================

export function WeatherScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();

  // Weather data hook
  const {
    weather,
    savedLocations,
    searchResults,
    isLoading,
    isSearching,
    error,
    isTtsPlaying,
    ttsSection,
    selectLocation,
    searchLocations,
    clearSearchResults,
    saveCurrentLocation,
    removeLocation,
    refresh,
    readCurrentWeather,
    readForecast,
    readRainPrediction,
    stopTts,
  } = useWeather();

  // UI State
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Voice focus for locations
  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return [];
    return savedLocations.map((location, index) => ({
      id: location.id,
      label: location.name,
      index,
      onSelect: () => handleLocationSelect(location),
    }));
  }, [savedLocations, isFocused]);

  const { scrollRef } = useVoiceFocusList('weather-locations', voiceFocusItems);

  // Check for first-time use
  useEffect(() => {
    AsyncStorage.getItem(WELCOME_SHOWN_KEY).then((value) => {
      if (!value) {
        setShowWelcome(true);
      }
    });
  }, []);

  // Handle welcome dismiss
  const handleWelcomeDismiss = useCallback(async () => {
    setShowWelcome(false);
    await AsyncStorage.setItem(WELCOME_SHOWN_KEY, 'true');
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Handle location select
  const handleLocationSelect = useCallback(async (location: WeatherLocation) => {
    void triggerFeedback('tap');
    await selectLocation(location);
    setShowLocationSearch(false);
    setSearchQuery('');
    clearSearchResults();
  }, [selectLocation, clearSearchResults, triggerFeedback]);

  // Handle search query change
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    void searchLocations(text);
  }, [searchLocations]);

  // Handle location search modal open
  const handleOpenSearch = useCallback(() => {
    void triggerFeedback('tap');
    setShowLocationSearch(true);
  }, [triggerFeedback]);

  // Handle location search modal close
  const handleCloseSearch = useCallback(() => {
    setShowLocationSearch(false);
    setSearchQuery('');
    clearSearchResults();
  }, [clearSearchResults]);

  // Handle save current location
  const handleSaveLocation = useCallback(async () => {
    void triggerFeedback('tap');
    await saveCurrentLocation();
  }, [saveCurrentLocation, triggerFeedback]);

  // Handle TTS button press
  const handleTtsPress = useCallback((section: 'current' | 'forecast' | 'rain') => {
    void triggerFeedback('tap');
    if (section === 'current') void readCurrentWeather();
    if (section === 'forecast') void readForecast();
    if (section === 'rain') void readRainPrediction();
  }, [readCurrentWeather, readForecast, readRainPrediction, triggerFeedback]);

  // Get error message
  const errorMessage = useMemo(() => {
    if (!error) return null;
    return t(error);
  }, [error, t]);

  return (
    <View style={styles.container}>
      {/* Module Header */}
      <ModuleHeader
        moduleId={MODULE_ID}
        icon="weather-partly-cloudy"
        title={t('modules.weather.title')}
        showAdMob
      />

      {/* Location Selector */}
      <TouchableOpacity
        style={styles.locationSelector}
        onPress={handleOpenSearch}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={weather?.location.name || t('modules.weather.selectLocation')}
        accessibilityHint={t('modules.weather.selectLocationHint')}
      >
        <Icon name="map-marker" size={24} color={MODULE_COLOR} />
        <Text style={styles.locationName} numberOfLines={1}>
          {weather?.location.name || t('modules.weather.selectLocation')}
        </Text>
        <Icon name="chevron-down" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Error Banner */}
      {error && !isLoading && (
        <View style={styles.errorBanner}>
          <Icon name="alert" size={24} color={colors.error} />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity onPress={handleRefresh}>
            <Text style={styles.errorDismiss}>{t('common.try_again')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading State */}
      {isLoading && !weather && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MODULE_COLOR} />
          <Text style={styles.loadingText}>{t('modules.weather.loading')}</Text>
        </View>
      )}

      {/* Empty State - No location selected */}
      {!isLoading && !weather && !error && (
        <View style={styles.emptyContainer}>
          <Icon name="weather-partly-cloudy" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>{t('modules.weather.noLocation')}</Text>
          <Text style={styles.emptyHint}>{t('modules.weather.noLocationHint')}</Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: MODULE_COLOR }]}
            onPress={handleOpenSearch}
          >
            <Icon name="magnify" size={24} color={colors.textOnPrimary} />
            <Text style={styles.emptyButtonText}>{t('modules.weather.searchLocation')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Weather Content */}
      {weather && (
        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: insets.bottom + spacing.lg },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={MODULE_COLOR}
              colors={[MODULE_COLOR]}
            />
          }
        >
          {/* Current Weather Card */}
          <VoiceFocusable
            id="current-weather"
            label={t('modules.weather.currentWeather')}
            index={0}
            onSelect={() => handleTtsPress('current')}
          >
            <View style={styles.currentWeatherCard}>
              <View style={styles.currentWeatherMain}>
                <Icon
                  name={weatherService.getWeatherIcon(weather.current.weatherCode, weather.current.isDay)}
                  size={80}
                  color={MODULE_COLOR}
                />
                <View style={styles.currentWeatherTemp}>
                  <Text style={styles.temperature}>
                    {Math.round(weather.current.temperature)}°
                  </Text>
                  <Text style={styles.feelsLike}>
                    {t('modules.weather.feelsLike')} {Math.round(weather.current.feelsLike)}°
                  </Text>
                </View>
              </View>

              <Text style={styles.condition}>
                {weatherService.getWeatherDescription(weather.current.weatherCode, t('locale'))}
              </Text>

              <View style={styles.weatherDetails}>
                <View style={styles.weatherDetail}>
                  <Icon name="water-percent" size={20} color={colors.textSecondary} />
                  <Text style={styles.weatherDetailText}>
                    {weather.current.humidity}%
                  </Text>
                </View>
                <View style={styles.weatherDetail}>
                  <Icon name="weather-windy" size={20} color={colors.textSecondary} />
                  <Text style={styles.weatherDetailText}>
                    {Math.round(weather.current.windSpeed)} km/h
                  </Text>
                </View>
              </View>

              <TTSButton
                isPlaying={isTtsPlaying}
                isActive={isTtsPlaying && ttsSection === 'current'}
                onPress={() => handleTtsPress('current')}
                label={t('modules.weather.readCurrentWeather')}
              />
            </View>
          </VoiceFocusable>

          {/* Rain Prediction Card */}
          <VoiceFocusable
            id="rain-prediction"
            label={t('modules.weather.rainPrediction')}
            index={1}
            onSelect={() => handleTtsPress('rain')}
          >
            <View style={styles.rainCard}>
              <View style={styles.rainHeader}>
                <Icon name="weather-rainy" size={32} color={MODULE_COLOR} />
                <View style={styles.rainTextContainer}>
                  <Text style={styles.rainTitle}>{t('modules.weather.rainPrediction')}</Text>
                  <Text style={styles.rainSummary}>
                    {weatherService.getRainSummary(weather.rain.summary, t('locale'))}
                  </Text>
                </View>
                <TTSButton
                  isPlaying={isTtsPlaying}
                  isActive={isTtsPlaying && ttsSection === 'rain'}
                  onPress={() => handleTtsPress('rain')}
                  label={t('modules.weather.readRain')}
                  compact
                />
              </View>
            </View>
          </VoiceFocusable>

          {/* 7-Day Forecast Card */}
          <VoiceFocusable
            id="forecast"
            label={t('modules.weather.forecast')}
            index={2}
            onSelect={() => handleTtsPress('forecast')}
          >
            <View style={styles.forecastCard}>
              <View style={styles.forecastHeader}>
                <Text style={styles.forecastTitle}>{t('modules.weather.forecast')}</Text>
                <TTSButton
                  isPlaying={isTtsPlaying}
                  isActive={isTtsPlaying && ttsSection === 'forecast'}
                  onPress={() => handleTtsPress('forecast')}
                  label={t('modules.weather.readForecast')}
                  compact
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.forecastScroll}
              >
                {weather.daily.map((day, index) => (
                  <ForecastDay key={index} day={day} index={index} />
                ))}
              </ScrollView>
            </View>
          </VoiceFocusable>

          {/* Saved Locations Card */}
          <View style={styles.locationsCard}>
            <View style={styles.locationsHeader}>
              <Text style={styles.locationsTitle}>{t('modules.weather.myLocations')}</Text>
              <TouchableOpacity
                style={styles.addLocationButton}
                onPress={handleOpenSearch}
                accessibilityRole="button"
                accessibilityLabel={t('modules.weather.addLocation')}
              >
                <Icon name="plus" size={24} color={MODULE_COLOR} />
                <Text style={styles.addLocationText}>{t('modules.weather.addLocation')}</Text>
              </TouchableOpacity>
            </View>

            {savedLocations.length === 0 && (
              <Text style={styles.noLocationsText}>{t('modules.weather.noSavedLocations')}</Text>
            )}

            {savedLocations.map((location) => (
              <LocationItem
                key={location.id}
                location={location}
                isSelected={weather?.location.id === location.id}
                onPress={() => handleLocationSelect(location)}
                onLongPress={() => removeLocation(location.id)}
              />
            ))}

            {/* Save current location button */}
            {weather && !savedLocations.some(l => l.id === weather.location.id) && (
              <TouchableOpacity
                style={styles.saveLocationButton}
                onPress={handleSaveLocation}
                accessibilityRole="button"
                accessibilityLabel={t('modules.weather.saveCurrentLocation')}
              >
                <Icon name="star-outline" size={20} color={MODULE_COLOR} />
                <Text style={styles.saveLocationText}>
                  {t('modules.weather.saveCurrentLocation')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* Location Search Modal */}
      <Modal
        visible={showLocationSearch}
        animationType="slide"
        transparent
        onRequestClose={handleCloseSearch}
      >
        <View style={styles.searchModalOverlay}>
          <View style={[styles.searchModalContent, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.searchModalHeader}>
              <Text style={styles.searchModalTitle}>{t('modules.weather.searchLocation')}</Text>
              <TouchableOpacity onPress={handleCloseSearch} accessibilityRole="button">
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchInputContainer}>
              <Icon name="magnify" size={24} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('modules.weather.searchPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoFocus
                returnKeyType="search"
              />
              {isSearching && (
                <ActivityIndicator size="small" color={MODULE_COLOR} />
              )}
            </View>

            <ScrollView style={styles.searchResults}>
              {searchResults.map((result) => (
                <SearchResultItem
                  key={result.id}
                  location={result}
                  onPress={() => handleLocationSelect(result)}
                />
              ))}

              {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                <Text style={styles.noResultsText}>{t('modules.weather.noResults')}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Welcome Modal */}
      <WelcomeModal
        visible={showWelcome}
        onDismiss={handleWelcomeDismiss}
      />
    </View>
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

  // Location selector
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: touchTargets.minimum,
    gap: spacing.sm,
  },
  locationName: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.errorLight,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    flex: 1,
  },
  errorDismiss: {
    ...typography.body,
    color: colors.error,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyHint: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
    minHeight: touchTargets.minimum,
  },
  emptyButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },

  // Current weather card
  currentWeatherCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  currentWeatherMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  currentWeatherTemp: {
    alignItems: 'flex-start',
  },
  temperature: {
    fontSize: 64,
    fontWeight: '300',
    color: colors.textPrimary,
    lineHeight: 72,
  },
  feelsLike: {
    ...typography.body,
    color: colors.textSecondary,
  },
  condition: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    textTransform: 'capitalize',
    marginBottom: spacing.md,
  },
  weatherDetails: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  weatherDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  weatherDetailText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // TTS Button
  ttsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: MODULE_COLOR,
    gap: spacing.sm,
    minHeight: touchTargets.minimum,
  },
  ttsButtonCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: MODULE_COLOR,
  },
  ttsButtonActive: {
    backgroundColor: MODULE_COLOR,
    borderColor: MODULE_COLOR,
  },
  ttsButtonText: {
    ...typography.button,
    color: MODULE_COLOR,
  },
  ttsButtonTextActive: {
    color: colors.textOnPrimary,
  },

  // Rain card
  rainCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.small,
  },
  rainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rainTextContainer: {
    flex: 1,
  },
  rainTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  rainSummary: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },

  // Forecast card
  forecastCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.small,
  },
  forecastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  forecastTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  forecastScroll: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  forecastDay: {
    alignItems: 'center',
    width: 72,
    gap: spacing.xs,
  },
  forecastDayName: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  forecastTempHigh: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  forecastTempLow: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Locations card
  locationsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.small,
  },
  locationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  locationsTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  addLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  addLocationText: {
    ...typography.body,
    color: MODULE_COLOR,
    fontWeight: '500',
  },
  noLocationsText: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    marginBottom: spacing.xs,
    minHeight: touchTargets.minimum,
    gap: spacing.sm,
  },
  locationItemActive: {
    backgroundColor: MODULE_COLOR,
  },
  locationItemText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  locationItemTextActive: {
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  saveLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  saveLocationText: {
    ...typography.body,
    color: MODULE_COLOR,
  },

  // Welcome modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  welcomeModal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  welcomeHeader: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  welcomeTitle: {
    ...typography.h2,
    color: colors.textOnPrimary,
    textAlign: 'center',
  },
  welcomeContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  welcomeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  stepText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  welcomeButton: {
    margin: spacing.lg,
    marginTop: 0,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minHeight: touchTargets.minimum,
  },
  welcomeButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },

  // Search modal
  searchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  searchModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '80%',
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchModalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    margin: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  searchInput: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    marginBottom: spacing.xs,
    minHeight: touchTargets.minimum,
    gap: spacing.sm,
  },
  searchResultText: {
    flex: 1,
  },
  searchResultName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  searchResultCountry: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  noResultsText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
    fontStyle: 'italic',
  },
});

export default WeatherScreen;
