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
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors, typography, spacing, touchTargets, borderRadius, shadows } from '@/theme';
import { Icon, ModuleHeader, VoiceFocusable, SearchBar, FavoriteButton, RadarMap, TimeSlider } from '@/components';
import { useVoiceFocusList } from '@/contexts/VoiceFocusContext';
import { useFavoriteLocations } from '@/contexts/FavoriteLocationsContext';
import { useHoldGestureContextSafe } from '@/contexts/HoldGestureContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';
import { useWeather } from '@/hooks/useWeather';
import { weatherService } from '@/services/weatherService';
import {
  getRadarFrames,
  getNowFrameIndex,
  getRadarTileUrl,
  clearRadarCache,
  type RadarData,
} from '@/services/radarService';
import type { WeatherLocation, DailyForecast, RadarFrame } from '@/types/weather';
import { WEATHER_MODULE_CONFIG } from '@/types/weather';

// ============================================================
// Constants
// ============================================================

const MODULE_ID = 'weather';
const MODULE_COLOR = WEATHER_MODULE_CONFIG.accentColor;
const WELCOME_SHOWN_KEY = 'weather_welcome_shown';

// Tab types for Weather/Radar
type WeatherTab = 'weather' | 'radar';

// ============================================================
// Tab Button Component
// ============================================================

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  icon: 'weather-partly-cloudy' | 'radar';
}

function TabButton({ label, isActive, onPress, icon }: TabButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.tabButton, isActive && styles.tabButtonActive]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
    >
      <Icon
        name={icon}
        size={20}
        color={isActive ? colors.textOnPrimary : MODULE_COLOR}
      />
      <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Radar Tab Component
// ============================================================

interface RadarTabProps {
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
}

function RadarTab({ latitude, longitude, locationName }: RadarTabProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Radar state
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Start with -1 to indicate "not yet initialized", will be set to nowIndex after data loads
  const [currentFrameIndex, setCurrentFrameIndex] = useState(-1);

  // Get all frames from radar data
  const allFrames = useMemo(() => {
    if (!radarData) return [];
    return radarData.frames;
  }, [radarData]);

  // Current tile URL (only calculate when frame index is valid)
  const currentTileUrl = useMemo(() => {
    if (!radarData || allFrames.length === 0 || currentFrameIndex < 0) return null;
    const frame = allFrames[currentFrameIndex];
    if (!frame) return null;
    return getRadarTileUrl(frame);
  }, [radarData, allFrames, currentFrameIndex]);

  // Fetch radar data on mount and when location changes
  // Provider selection: KNMI for Netherlands, RainViewer for other locations
  // Frames are balanced so "now" appears in the middle of the slider
  useEffect(() => {
    let isMounted = true;

    const loadRadarData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Clear cache to ensure we get fresh balanced frames
        clearRadarCache();
        // Pass location coordinates for provider selection (KNMI for NL, RainViewer for others)
        const data = await getRadarFrames(latitude ?? undefined, longitude ?? undefined);
        if (isMounted) {
          setRadarData(data);
          // Set initial frame to "now" (should now be near the middle due to balancing)
          const nowIndex = getNowFrameIndex(data.frames);
          setCurrentFrameIndex(nowIndex);

          // Log time range for debugging
          const firstFrame = data.frames[0];
          const lastFrame = data.frames[data.frames.length - 1];
          console.info('[RadarTab] Loaded', data.frames.length, 'balanced frames:', {
            first: new Date(firstFrame.time * 1000).toLocaleTimeString(),
            last: new Date(lastFrame.time * 1000).toLocaleTimeString(),
            nowIndex,
            nowPosition: `${nowIndex}/${data.frames.length - 1}`,
          });
        }
      } catch (err) {
        console.error('[RadarTab] Failed to load radar data:', err);
        if (isMounted) {
          setError(t('modules.weather.radar.errors.network'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadRadarData();

    // Auto-refresh every 10 minutes
    const refreshInterval = setInterval(() => {
      void loadRadarData();
    }, 10 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, [t, latitude, longitude]);

  // Handle frame change from slider
  const handleFrameChange = useCallback((index: number) => {
    setCurrentFrameIndex(index);
  }, []);

  // No location selected
  if (latitude === null || longitude === null) {
    return (
      <View style={[styles.radarPlaceholder, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Icon name="radar" size={80} color={colors.textSecondary} />
        <Text style={styles.radarPlaceholderTitle}>
          {t('modules.weather.radar.title')}
        </Text>
        <Text style={styles.radarPlaceholderHint}>
          {t('modules.weather.noLocationHint')}
        </Text>
      </View>
    );
  }

  // Loading state
  if (isLoading && !radarData) {
    return (
      <View style={[styles.radarPlaceholder, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Icon name="radar" size={80} color={colors.textSecondary} />
        <Text style={styles.radarPlaceholderTitle}>
          {t('modules.weather.radar.title')}
        </Text>
        {locationName && (
          <Text style={styles.radarPlaceholderLocation}>
            📍 {locationName}
          </Text>
        )}
        <Text style={styles.radarPlaceholderHint}>
          {t('modules.weather.radar.loading')}
        </Text>
        <ActivityIndicator size="large" color={MODULE_COLOR} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  // Error state
  if (error && !radarData) {
    return (
      <View style={[styles.radarPlaceholder, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Icon name="alert" size={80} color={colors.error} />
        <Text style={styles.radarPlaceholderTitle}>
          {t('modules.weather.radar.noData')}
        </Text>
        <Text style={styles.radarPlaceholderHint}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.radarContainer, { paddingBottom: insets.bottom }]}>
      {/* Location name */}
      {locationName && (
        <View style={styles.radarLocationBar}>
          <Icon name="map-marker" size={20} color={MODULE_COLOR} />
          <Text style={styles.radarLocationName}>{locationName}</Text>
        </View>
      )}

      {/* Radar Map */}
      <View style={styles.radarMapContainer}>
        <RadarMap
          latitude={latitude}
          longitude={longitude}
          radarTileUrl={currentTileUrl}
          showMarker={true}
        />
      </View>

      {/* Time Slider - only render when frame index is initialized */}
      {currentFrameIndex >= 0 && (
        <View style={styles.radarSliderContainer}>
          <TimeSlider
            frames={allFrames}
            currentIndex={currentFrameIndex}
            onIndexChange={handleFrameChange}
            pastFrameCount={radarData?.pastFrameCount ?? 0}
            forecastFrameCount={radarData?.forecastFrameCount ?? 0}
          />
        </View>
      )}

      {/* Legend */}
      <View
        style={styles.radarLegend}
        accessibilityLabel={t('modules.weather.radar.legend')}
        accessibilityHint={`${t('modules.weather.radar.legendLight')} - ${t('modules.weather.radar.legendModerate')} - ${t('modules.weather.radar.legendHeavy')}`}
        accessibilityRole="image"
      >
        <Text style={styles.radarLegendLabel}>{t('modules.weather.radar.legendLight')}</Text>
        <View style={styles.radarLegendGradient} accessibilityElementsHidden={true}>
          <View style={[styles.radarLegendColor, { backgroundColor: '#00FF00' }]} />
          <View style={[styles.radarLegendColor, { backgroundColor: '#FFFF00' }]} />
          <View style={[styles.radarLegendColor, { backgroundColor: '#FF8000' }]} />
          <View style={[styles.radarLegendColor, { backgroundColor: '#FF0000' }]} />
        </View>
        <Text style={styles.radarLegendLabel}>{t('modules.weather.radar.legendHeavy')}</Text>
      </View>

      {/* Provider indicator + Attribution */}
      <View style={styles.radarFooter}>
        {/* Provider badge */}
        <View style={[
          styles.providerBadge,
          radarData?.provider === 'knmi' && styles.providerBadgeKnmi,
        ]}>
          <Text style={styles.providerBadgeText}>
            {radarData?.provider === 'knmi' ? 'KNMI' : 'RainViewer'}
          </Text>
        </View>

        {/* Attribution link */}
        <TouchableOpacity
          style={styles.radarAttribution}
          onPress={() => {
            const url = radarData?.provider === 'knmi'
              ? 'https://dataplatform.knmi.nl/'
              : 'https://www.rainviewer.com/';
            void Linking.openURL(url);
          }}
          accessibilityRole="link"
          accessibilityLabel={t('modules.weather.radar.attribution')}
        >
          <Text style={styles.radarAttributionText}>
            {radarData?.provider === 'knmi'
              ? t('modules.weather.radar.attributionKnmi')
              : t('modules.weather.radar.attributionRainViewer')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
        name={isActive ? 'stop' : 'volume-up'}
        size={compact ? 20 : 24}
        color={isActive ? colors.textOnPrimary : MODULE_COLOR}
      />
      {!compact && (
        <Text style={[styles.ttsButtonText, isActive && styles.ttsButtonTextActive]}>
          {isActive ? t('tts.stop') : label}
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
  onPress: () => void;
}

function ForecastDay({ day, index, onPress }: ForecastDayProps) {
  const { t, i18n } = useTranslation();
  const holdGesture = useHoldGestureContextSafe();

  const dayName = useMemo(() => {
    if (index === 0) return t('modules.weather.today');
    if (index === 1) return t('modules.weather.tomorrow');
    // Ensure day.date is a Date object (may be string from JSON/cache)
    const dateObj = day.date instanceof Date ? day.date : new Date(day.date);
    return dateObj.toLocaleDateString(i18n.language, { weekday: 'long' });
  }, [day.date, index, t, i18n.language]);

  const iconName = weatherService.getWeatherIcon(day.weatherCode, true);
  const weatherDesc = weatherService.getWeatherDescription(day.weatherCode, i18n.language);

  const handlePress = useCallback(() => {
    if (holdGesture?.isGestureConsumed?.()) {
      return;
    }
    onPress();
  }, [onPress, holdGesture]);

  return (
    <TouchableOpacity
      style={styles.forecastRow}
      onPress={handlePress}
      onLongPress={() => {}}
      delayLongPress={300}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${dayName}, ${weatherDesc}, ${Math.round(day.temperatureMax)}° tot ${Math.round(day.temperatureMin)}°`}
      accessibilityHint={t('modules.weather.tapForDetails')}
    >
      {/* Left: Day name and icon */}
      <View style={styles.forecastDayInfo}>
        <Icon name={iconName} size={36} color={MODULE_COLOR} />
        <View style={styles.forecastDayText}>
          <Text
            style={styles.forecastDayName}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {dayName}
          </Text>
          <Text style={styles.forecastCondition} numberOfLines={1}>
            {weatherDesc}
          </Text>
        </View>
      </View>
      {/* Right: Temperatures + chevron */}
      <View style={styles.forecastTemps}>
        <Text style={styles.forecastTempHigh}>{Math.round(day.temperatureMax)}°</Text>
        <Text style={styles.forecastTempLow}>{Math.round(day.temperatureMin)}°</Text>
        <Icon name="chevron-right" size={20} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// Day Detail Modal Component
// ============================================================

interface DayDetailModalProps {
  visible: boolean;
  day: DailyForecast | null;
  dayIndex: number;
  onClose: () => void;
}

function DayDetailModal({ visible, day, dayIndex, onClose }: DayDetailModalProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { triggerFeedback } = useFeedback();

  if (!day) return null;

  const dayName = (() => {
    if (dayIndex === 0) return t('modules.weather.today');
    if (dayIndex === 1) return t('modules.weather.tomorrow');
    // Ensure day.date is a Date object (may be string from JSON/cache)
    const dateObj = day.date instanceof Date ? day.date : new Date(day.date);
    return dateObj.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });
  })();

  const iconName = weatherService.getWeatherIcon(day.weatherCode, true);
  const weatherDesc = weatherService.getWeatherDescription(day.weatherCode, i18n.language);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  };

  const handleClose = () => {
    void triggerFeedback('tap');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.dayDetailModal, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.dayDetailHeader}>
          <TouchableOpacity
            style={styles.dayDetailCloseButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Icon name="chevron-down" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.dayDetailTitle}>{dayName}</Text>
          <View style={styles.dayDetailCloseButton} />
        </View>

        <ScrollView
          style={styles.dayDetailContent}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
        >
          {/* Main weather card */}
          <View style={styles.dayDetailMainCard}>
            <Icon name={iconName} size={80} color={MODULE_COLOR} />
            <Text style={styles.dayDetailCondition}>{weatherDesc}</Text>
            <View style={styles.dayDetailTempRow}>
              <View style={styles.dayDetailTempItem}>
                <Text style={styles.dayDetailTempLabel}>{t('modules.weather.high')}</Text>
                <Text style={styles.dayDetailTempValue}>{Math.round(day.temperatureMax)}°</Text>
              </View>
              <View style={styles.dayDetailTempDivider} />
              <View style={styles.dayDetailTempItem}>
                <Text style={styles.dayDetailTempLabel}>{t('modules.weather.low')}</Text>
                <Text style={styles.dayDetailTempValue}>{Math.round(day.temperatureMin)}°</Text>
              </View>
            </View>
          </View>

          {/* Details grid */}
          <View style={styles.dayDetailGrid}>
            {/* Precipitation */}
            <View style={styles.dayDetailGridItem}>
              <Icon name="weather-rainy" size={32} color={MODULE_COLOR} />
              <Text style={styles.dayDetailGridLabel}>{t('modules.weather.precipitation')}</Text>
              <Text style={styles.dayDetailGridValue}>
                {day.precipitationSum > 0 ? `${day.precipitationSum.toFixed(1)} mm` : t('modules.weather.noPrecipitation')}
              </Text>
            </View>

            {/* Precipitation probability */}
            <View style={styles.dayDetailGridItem}>
              <Icon name="water-percent" size={32} color={MODULE_COLOR} />
              <Text style={styles.dayDetailGridLabel}>{t('modules.weather.rainChance')}</Text>
              <Text style={styles.dayDetailGridValue}>{day.precipitationProbability}%</Text>
            </View>

            {/* Sunrise */}
            <View style={styles.dayDetailGridItem}>
              <Icon name="weather-sunny" size={32} color={MODULE_COLOR} />
              <Text style={styles.dayDetailGridLabel}>{t('modules.weather.sunrise')}</Text>
              <Text style={styles.dayDetailGridValue}>{formatTime(day.sunrise)}</Text>
            </View>

            {/* Sunset */}
            <View style={styles.dayDetailGridItem}>
              <Icon name="weather-night" size={32} color={MODULE_COLOR} />
              <Text style={styles.dayDetailGridLabel}>{t('modules.weather.sunset')}</Text>
              <Text style={styles.dayDetailGridValue}>{formatTime(day.sunset)}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ============================================================
// Search Result Item Component
// ============================================================

interface SearchResultItemProps {
  location: WeatherLocation;
  onPress: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

function SearchResultItem({ location, onPress, isFavorite, onToggleFavorite }: SearchResultItemProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.searchResultItem}>
      <TouchableOpacity
        style={styles.searchResultContent}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${location.name}, ${location.country}`}
      >
        <Icon name="map-marker" size={20} color={MODULE_COLOR} />
        <View style={styles.searchResultText}>
          <Text style={styles.searchResultName}>{location.name}</Text>
          <Text style={styles.searchResultCountry}>
            {[location.admin2, location.admin1, location.country].filter(Boolean).join(', ')}
          </Text>
        </View>
      </TouchableOpacity>
      <FavoriteButton
        isFavorite={isFavorite}
        onToggle={onToggleFavorite}
        accessibilityLabel={
          isFavorite
            ? t('modules.weather.removeFromFavorites', { name: location.name })
            : t('modules.weather.addToFavorites', { name: location.name })
        }
        size={28}
      />
    </View>
  );
}

// ============================================================
// Location Picker Modal Component
// ============================================================

interface LocationPickerModalProps {
  visible: boolean;
  locations: WeatherLocation[];
  currentLocationId: string | null;
  onSelect: (location: WeatherLocation) => void;
  onClose: () => void;
  onRemove: (id: string) => void;
  onRequestGps: () => void;
  isLoadingGps: boolean;
  gpsError: string | null;
  gpsLocationId: string | null;
}

function LocationPickerModal({
  visible,
  locations,
  currentLocationId,
  onSelect,
  onClose,
  onRemove,
  onRequestGps,
  isLoadingGps,
  gpsError,
  gpsLocationId,
}: LocationPickerModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { triggerFeedback } = useFeedback();

  const handleClose = () => {
    void triggerFeedback('tap');
    onClose();
  };

  const handleSelect = (location: WeatherLocation) => {
    void triggerFeedback('tap');
    onSelect(location);
  };

  const handleGpsPress = () => {
    void triggerFeedback('tap');
    onRequestGps();
  };

  const isGpsSelected = currentLocationId === 'current';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.locationPickerModal, { paddingTop: insets.top }]}>
        {/* Fixed Header */}
        <View style={styles.locationPickerHeader}>
          <TouchableOpacity
            style={styles.locationPickerCloseButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Icon name="chevron-down" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.locationPickerTitle}>{t('modules.weather.myLocations')}</Text>
          <View style={styles.locationPickerCloseButton} />
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.locationPickerContent}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
        >
          {/* GPS Location Option - Always at top */}
          <TouchableOpacity
            style={[
              styles.locationPickerItemContent,
              styles.gpsLocationItem,
              isGpsSelected && styles.locationPickerItemSelected,
            ]}
            onPress={handleGpsPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('modules.weather.currentLocation')}
            accessibilityHint={t('modules.weather.currentLocationHint')}
            accessibilityState={{ selected: isGpsSelected }}
            disabled={isLoadingGps}
          >
            {isLoadingGps ? (
              <ActivityIndicator size="small" color={MODULE_COLOR} />
            ) : (
              <Icon
                name="crosshairs-gps"
                size={24}
                color={isGpsSelected ? MODULE_COLOR : colors.textSecondary}
              />
            )}
            <View style={styles.locationPickerItemText}>
              <Text
                style={[
                  styles.locationPickerItemName,
                  isGpsSelected && styles.locationPickerItemNameSelected,
                ]}
                numberOfLines={1}
              >
                {t('modules.weather.currentLocation')}
              </Text>
              <Text style={styles.locationPickerItemCountry} numberOfLines={1}>
                {gpsError ? t(gpsError) : t('modules.weather.currentLocationHint')}
              </Text>
            </View>
            {isGpsSelected && !isLoadingGps && (
              <Icon name="check" size={24} color={MODULE_COLOR} />
            )}
          </TouchableOpacity>

          {/* Divider */}
          {locations.length > 0 && <View style={styles.locationPickerDivider} />}

          {/* Saved Locations */}
          {locations.length === 0 ? (
            <View style={styles.locationPickerEmpty}>
              <Icon name="map-marker-off" size={48} color={colors.textSecondary} />
              <Text style={styles.locationPickerEmptyText}>
                {t('modules.weather.noSavedLocations')}
              </Text>
            </View>
          ) : (
            locations.map((location) => {
              const isSelected = location.id === currentLocationId;
              return (
                <View key={location.id} style={styles.locationPickerItem}>
                  <TouchableOpacity
                    style={[
                      styles.locationPickerItemContent,
                      isSelected && styles.locationPickerItemSelected,
                    ]}
                    onPress={() => handleSelect(location)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${location.name}, ${location.country}`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Icon
                      name={isSelected ? 'map-marker-check' : 'map-marker'}
                      size={24}
                      color={isSelected ? MODULE_COLOR : colors.textSecondary}
                    />
                    <View style={styles.locationPickerItemText}>
                      <Text
                        style={[
                          styles.locationPickerItemName,
                          isSelected && styles.locationPickerItemNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {location.name}
                      </Text>
                      <Text style={styles.locationPickerItemCountry} numberOfLines={1}>
                        {[location.admin2, location.admin1, location.country].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                    {isSelected && (
                      <Icon name="check" size={24} color={MODULE_COLOR} />
                    )}
                  </TouchableOpacity>
                  {/* Heart icon to unfavorite - consistent with search results */}
                  <FavoriteButton
                    isFavorite={true}
                    onToggle={() => onRemove(location.id)}
                    accessibilityLabel={t('modules.weather.removeFromFavorites', { name: location.name })}
                    size={28}
                  />
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
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
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();

  // GPS location from FavoriteLocationsContext
  const {
    currentLocation: gpsLocation,
    requestCurrentLocation,
    isLoadingGps,
    gpsError,
  } = useFavoriteLocations();

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
    saveLocation,
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
  const [activeTab, setActiveTab] = useState<WeatherTab>('weather');  // Main tabs: weather | radar
  const [showSearchMode, setShowSearchMode] = useState(false);  // Search mode within weather tab
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // ============================================================
  // Location name validation
  // ============================================================
  // Only allow letters (including accented), spaces, hyphens, and apostrophes
  // This covers names like: "Den Haag", "Saint-Tropez", "L'Aquila", "München"
  const VALID_LOCATION_CHARS = /^[\p{L}\s\-']*$/u;

  // Check if query contains only valid characters
  const isValidLocationQuery = useCallback((query: string): boolean => {
    return VALID_LOCATION_CHARS.test(query);
  }, []);

  // Sanitize input by removing invalid characters
  const sanitizeLocationInput = useCallback((input: string): string => {
    // Remove any character that is not a letter, space, hyphen, or apostrophe
    return input.replace(/[^\p{L}\s\-']/gu, '');
  }, []);

  // Handle search query change with validation
  const handleSearchQueryChange = useCallback((text: string) => {
    // Sanitize the input to only allow valid characters
    const sanitized = sanitizeLocationInput(text);
    setSearchQuery(sanitized);
  }, [sanitizeLocationInput]);

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
    // Exit search mode after selecting a location
    setShowSearchMode(false);
    setSearchQuery('');
    clearSearchResults();
  }, [selectLocation, clearSearchResults, triggerFeedback]);

  // Handle search submit (explicit, not live filtering)
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    void triggerFeedback('tap');
    await searchLocations(searchQuery);
  }, [searchQuery, searchLocations, triggerFeedback]);

  // Handle main tab change (Weather | Radar)
  const handleTabChange = useCallback((tab: WeatherTab) => {
    void triggerFeedback('tap');
    setActiveTab(tab);
    // Clear search state when switching tabs
    setShowSearchMode(false);
    setSearchQuery('');
    clearSearchResults();
  }, [triggerFeedback, clearSearchResults]);

  // Toggle search mode within weather tab
  const toggleSearchMode = useCallback(() => {
    void triggerFeedback('tap');
    setShowSearchMode(prev => {
      if (prev) {
        // Exiting search mode - clear search
        setSearchQuery('');
        clearSearchResults();
      }
      return !prev;
    });
  }, [triggerFeedback, clearSearchResults]);

  // Handle save current location
  const handleSaveLocation = useCallback(async () => {
    void triggerFeedback('tap');
    await saveCurrentLocation();
  }, [saveCurrentLocation, triggerFeedback]);

  // Handle location picker open
  const handleOpenLocationPicker = useCallback(() => {
    void triggerFeedback('tap');
    setShowLocationPicker(true);
  }, [triggerFeedback]);

  // Handle location picker select
  const handleLocationPickerSelect = useCallback(async (location: WeatherLocation) => {
    await selectLocation(location);
    setShowLocationPicker(false);
  }, [selectLocation]);

  // Handle location picker remove
  const handleLocationPickerRemove = useCallback(async (id: string) => {
    await removeLocation(id);
  }, [removeLocation]);

  // Handle GPS location request from picker
  const handleGpsRequest = useCallback(async () => {
    // requestCurrentLocation now returns the location directly
    const location = await requestCurrentLocation();

    // If GPS location was obtained, select it and close picker
    if (location) {
      // Convert FavoriteLocation to WeatherLocation format
      const weatherLocation: WeatherLocation = {
        id: location.id,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        country: location.country,
        admin1: location.admin1,
      };
      await selectLocation(weatherLocation);
      setShowLocationPicker(false);
    }
    // If null returned, GPS failed - error is shown via gpsError state
  }, [requestCurrentLocation, selectLocation]);

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

      {/* Tab Bar: Weer | Radar */}
      <View style={styles.tabBar}>
        <TabButton
          label={t('modules.weather.tabs.weather')}
          isActive={activeTab === 'weather'}
          onPress={() => handleTabChange('weather')}
          icon="weather-partly-cloudy"
        />
        <TabButton
          label={t('modules.weather.tabs.radar')}
          isActive={activeTab === 'radar'}
          onPress={() => handleTabChange('radar')}
          icon="radar"
        />
      </View>

      {/* WEATHER TAB CONTENT */}
      {activeTab === 'weather' && (
        <>
          {/* Location Bar with Search Toggle */}
          <View style={styles.locationBar}>
            <TouchableOpacity
              style={styles.locationBarContent}
              onPress={handleOpenLocationPicker}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('modules.weather.tapToChangeLocation')}
            >
              <Icon name="map-marker" size={24} color={MODULE_COLOR} />
              <Text style={styles.currentLocationName} numberOfLines={1}>
                {weather?.location.name ?? t('modules.weather.noLocation')}
              </Text>
              <Icon name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.searchToggleButton, showSearchMode && styles.searchToggleButtonActive]}
              onPress={toggleSearchMode}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('modules.weather.searchLocation')}
            >
              <Icon
                name={showSearchMode ? 'close' : 'magnify'}
                size={24}
                color={showSearchMode ? colors.textOnPrimary : MODULE_COLOR}
              />
            </TouchableOpacity>
          </View>

          {/* Search Section (when search mode active) */}
          {showSearchMode && (
            <View style={styles.searchSection}>
              <SearchBar
                value={searchQuery}
                onChangeText={handleSearchQueryChange}
                onSubmit={handleSearch}
                placeholder={t('modules.weather.searchPlaceholder')}
                searchButtonLabel={t('modules.weather.searchButton')}
                maxLength={50}
              />
              {isSearching && (
                <ActivityIndicator size="small" color={MODULE_COLOR} style={styles.searchSpinner} />
              )}
            </View>
          )}

          {/* Search Results (when in search mode) */}
          {showSearchMode && (
            <ScrollView style={styles.searchResults}>
              {searchResults.map((result) => {
                const isFavorite = savedLocations.some((loc) => loc.id === result.id);
                return (
                  <SearchResultItem
                    key={result.id}
                    location={result}
                    onPress={() => handleLocationSelect(result)}
                    isFavorite={isFavorite}
                    onToggleFavorite={() => {
                      if (isFavorite) {
                        void removeLocation(result.id);
                      } else {
                        void saveLocation(result);
                      }
                    }}
                  />
                );
              })}

              {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                <Text style={styles.noResultsText}>{t('modules.weather.noResults')}</Text>
              )}

              {searchQuery.length < 2 && searchResults.length === 0 && (
                <Text style={styles.searchHintText}>{t('modules.weather.searchHint')}</Text>
              )}
            </ScrollView>
          )}

          {/* Error Banner */}
          {error && !isLoading && !showSearchMode && (
            <View style={styles.errorBanner}>
              <Icon name="alert" size={24} color={colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity onPress={handleRefresh}>
                <Text style={styles.errorDismiss}>{t('common.try_again')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Loading State */}
          {isLoading && !weather && !showSearchMode && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={MODULE_COLOR} />
              <Text style={styles.loadingText}>{t('modules.weather.loading')}</Text>
            </View>
          )}

          {/* Empty State - No location selected */}
          {!isLoading && !weather && !error && !showSearchMode && (
            <View style={styles.emptyContainer}>
              <Icon name="weather-partly-cloudy" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>{t('modules.weather.noLocation')}</Text>
              <Text style={styles.emptyHint}>{t('modules.weather.noLocationHint')}</Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: MODULE_COLOR }]}
                onPress={toggleSearchMode}
              >
                <Icon name="magnify" size={24} color={colors.textOnPrimary} />
                <Text style={styles.emptyButtonText}>{t('modules.weather.searchLocation')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Weather Content (when not in search mode and weather data available) */}
          {!showSearchMode && weather && (
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
                  {/* Main weather display: icon + temp + TTS button centered on one row */}
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
                    <TTSButton
                      isPlaying={isTtsPlaying}
                      isActive={isTtsPlaying && ttsSection === 'current'}
                      onPress={() => handleTtsPress('current')}
                      label={t('modules.weather.readCurrentWeather')}
                      compact
                    />
                  </View>

                  <Text style={styles.condition}>
                    {weatherService.getWeatherDescription(weather.current.weatherCode, i18n.language)}
                  </Text>

                  <View style={styles.weatherDetails}>
                    {/* Precipitation - mm and % */}
                    <View style={styles.weatherDetail}>
                      <Icon name="weather-rainy" size={20} color={colors.textSecondary} />
                      <Text style={styles.weatherDetailText}>
                        {weather.rain.precipitationMm !== undefined
                          ? `${weather.rain.precipitationMm.toFixed(1)} mm`
                          : '0.0 mm'}
                        {weather.rain.precipitationProbability !== undefined &&
                          ` · ${weather.rain.precipitationProbability}%`}
                      </Text>
                    </View>
                    {/* Humidity */}
                    <View style={styles.weatherDetail}>
                      <Icon name="water-percent" size={20} color={colors.textSecondary} />
                      <Text style={styles.weatherDetailText}>
                        {weather.current.humidity}%
                      </Text>
                    </View>
                    {/* Wind speed - locale-based units (en → mph, others → km/h) */}
                    <View style={styles.weatherDetail}>
                      <Icon name="weather-windy" size={20} color={colors.textSecondary} />
                      <Text style={styles.weatherDetailText}>
                        {i18n.language === 'en' || i18n.language === 'en-GB'
                          ? `${Math.round(weather.current.windSpeed * 0.621371)} mph`
                          : `${Math.round(weather.current.windSpeed)} km/h`}
                      </Text>
                    </View>
                  </View>
                </View>
              </VoiceFocusable>

              {/* 7-Day Forecast Card */}
              <VoiceFocusable
                id="forecast"
                label={t('modules.weather.forecast')}
                index={1}
                onSelect={() => handleTtsPress('forecast')}
              >
                <View style={styles.forecastCard}>
                  {/* Title centered, then TTS button centered below */}
                  <Text style={styles.forecastTitle}>{t('modules.weather.forecast')}</Text>
                  <View style={styles.forecastTtsRow}>
                    <TTSButton
                      isPlaying={isTtsPlaying}
                      isActive={isTtsPlaying && ttsSection === 'forecast'}
                      onPress={() => handleTtsPress('forecast')}
                      label={t('modules.weather.readForecast')}
                      compact
                    />
                  </View>

                  <View style={styles.forecastList}>
                    {weather.daily.map((day, index) => (
                      <ForecastDay
                        key={index}
                        day={day}
                        index={index}
                        onPress={() => {
                          void triggerFeedback('tap');
                          setSelectedDayIndex(index);
                        }}
                      />
                    ))}
                  </View>
                </View>
              </VoiceFocusable>
            </ScrollView>
          )}
        </>
      )}

      {/* RADAR TAB CONTENT */}
      {activeTab === 'radar' && (
        <RadarTab
          latitude={weather?.location.latitude ?? null}
          longitude={weather?.location.longitude ?? null}
          locationName={weather?.location.name ?? null}
        />
      )}

      {/* Day Detail Modal */}
      <DayDetailModal
        visible={selectedDayIndex !== null}
        day={selectedDayIndex !== null && weather ? weather.daily[selectedDayIndex] : null}
        dayIndex={selectedDayIndex ?? 0}
        onClose={() => setSelectedDayIndex(null)}
      />

      {/* Location Picker Modal */}
      <LocationPickerModal
        visible={showLocationPicker}
        locations={savedLocations}
        currentLocationId={weather?.location.id ?? null}
        onSelect={handleLocationPickerSelect}
        onClose={() => setShowLocationPicker(false)}
        onRemove={handleLocationPickerRemove}
        onRequestGps={handleGpsRequest}
        isLoadingGps={isLoadingGps}
        gpsError={gpsError}
        gpsLocationId={gpsLocation?.id ?? null}
      />

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

  // Tab bar (Weer | Radar)
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: MODULE_COLOR,
    minHeight: touchTargets.minimum,
  },
  tabButtonActive: {
    backgroundColor: MODULE_COLOR,
    borderColor: MODULE_COLOR,
  },
  tabButtonText: {
    ...typography.button,
    color: MODULE_COLOR,
  },
  tabButtonTextActive: {
    color: colors.textOnPrimary,
  },

  // Location bar with search toggle
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,  // Match tabBar padding for alignment
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: touchTargets.minimum,
    gap: spacing.sm,
  },
  locationBarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchToggleButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: MODULE_COLOR,
  },
  searchToggleButtonActive: {
    backgroundColor: MODULE_COLOR,
    borderColor: MODULE_COLOR,
  },
  currentLocationName: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },

  // Search section
  searchSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // Radar placeholder (loading/error states)
  radarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  radarPlaceholderTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  radarPlaceholderLocation: {
    ...typography.body,
    color: MODULE_COLOR,
    textAlign: 'center',
    fontWeight: '600',
  },
  radarPlaceholderHint: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Radar container (main radar view)
  radarContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  radarLocationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  radarLocationName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  radarMapContainer: {
    flex: 1,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  radarSliderContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
  },
  radarLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  radarLegendLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  radarLegendGradient: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  radarLegendColor: {
    width: 24,
    height: 12,
  },
  radarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  providerBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.textSecondary,
    borderRadius: borderRadius.sm,
  },
  providerBadgeKnmi: {
    backgroundColor: '#0066CC', // KNMI blue
  },
  providerBadgeText: {
    ...typography.small,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  radarAttribution: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  radarAttributionText: {
    ...typography.small,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
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
    alignItems: 'center',
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

  // Forecast card
  forecastCard: {
    backgroundColor: colors.surface,
    borderRadius: 0,  // Full width, no rounded corners
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginHorizontal: -spacing.md,  // Compensate for contentContainer padding
    ...shadows.small,
  },
  forecastTtsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  forecastTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  forecastList: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  forecastDayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  forecastDayText: {
    flex: 1,
  },
  forecastDayName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  forecastCondition: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  forecastTemps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  forecastTempHigh: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '600',
    minWidth: 44,
    textAlign: 'right',
  },
  forecastTempLow: {
    ...typography.body,
    color: colors.textSecondary,
    minWidth: 44,
    textAlign: 'right',
  },

  // Day detail modal
  dayDetailModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dayDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,  // Ensure header has solid background when scrolling
  },
  dayDetailCloseButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.full,
  },
  dayDetailTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    flex: 1,
    textTransform: 'capitalize',
  },
  dayDetailContent: {
    flex: 1,
  },
  dayDetailMainCard: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.small,
  },
  dayDetailCondition: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textTransform: 'capitalize',
  },
  dayDetailTempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.xl,
  },
  dayDetailTempItem: {
    alignItems: 'center',
  },
  dayDetailTempLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  dayDetailTempValue: {
    fontSize: 48,
    fontWeight: '300',
    color: colors.textPrimary,
  },
  dayDetailTempDivider: {
    width: 1,
    height: 60,
    backgroundColor: colors.border,
  },
  dayDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  dayDetailGridItem: {
    width: '47%',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.small,
  },
  dayDetailGridLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  dayDetailGridValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // Location picker modal
  locationPickerModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  locationPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  locationPickerCloseButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPickerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  locationPickerContent: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  locationPickerEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.md,
  },
  locationPickerEmptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  locationPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  locationPickerItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: touchTargets.comfortable,
    gap: spacing.md,
  },
  locationPickerItemSelected: {
    borderColor: MODULE_COLOR,
    borderWidth: 2,
    backgroundColor: `${MODULE_COLOR}10`,
  },
  locationPickerItemText: {
    flex: 1,
  },
  locationPickerItemName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  locationPickerItemNameSelected: {
    fontWeight: '700',
    color: MODULE_COLOR,
  },
  locationPickerItemCountry: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  gpsLocationItem: {
    marginBottom: spacing.sm,
  },
  locationPickerDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
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

  // Search results
  searchSpinner: {
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    marginBottom: spacing.xs,
    minHeight: touchTargets.minimum,
    gap: spacing.sm,
  },
  searchResultContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  searchHintText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
});

export default WeatherScreen;
