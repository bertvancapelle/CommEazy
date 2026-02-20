/**
 * RadarMap Component
 *
 * Interactive map with radar overlay for the weather module.
 * Uses Apple Maps on iOS and Google Maps on Android.
 *
 * Features:
 * - Radar tile overlay from RainViewer
 * - Location marker with accent color
 * - Pinch-to-zoom support
 * - Centered on provided location
 *
 * @see .claude/plans/buienradar-module-plan.md
 */

import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { UrlTile, Marker, Region } from 'react-native-maps';

import { useAccentColor } from '@/contexts/AccentColorContext';
import { RADAR_MODULE_CONFIG } from '@/types/weather';

// ============================================================
// Props
// ============================================================

export interface RadarMapProps {
  /** Latitude coordinate */
  latitude: number;

  /** Longitude coordinate */
  longitude: number;

  /** Radar tile URL template (with {z}, {x}, {y} placeholders) */
  radarTileUrl: string | null;

  /** Whether to show the location marker */
  showMarker?: boolean;

  /** Optional custom accent color (defaults to user's accent color) */
  markerColor?: string;

  /** Map height (defaults to flex: 1) */
  height?: number;

  /** Called when user interacts with the map */
  onRegionChange?: (region: Region) => void;
}

// ============================================================
// Component
// ============================================================

export function RadarMap({
  latitude,
  longitude,
  radarTileUrl,
  showMarker = true,
  markerColor,
  height,
  onRegionChange,
}: RadarMapProps): React.ReactElement {
  const mapRef = useRef<MapView>(null);
  const { accentColor } = useAccentColor();

  // Determine marker color
  const dotColor = markerColor || accentColor.primary;

  // Calculate initial region (centered on location)
  const initialRegion = useMemo<Region>(() => ({
    latitude,
    longitude,
    latitudeDelta: 2.0,  // ~200km visible at this zoom
    longitudeDelta: 2.0,
  }), [latitude, longitude]);

  // Container style
  const containerStyle = useMemo(() => [
    styles.container,
    height ? { height } : { flex: 1 },
  ], [height]);

  return (
    <View style={containerStyle}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={onRegionChange}
        accessibilityLabel="Buienradar kaart"
        accessibilityHint="Toont neerslagradar voor uw locatie"
      >
        {/* Radar tile overlay */}
        {radarTileUrl && (
          <UrlTile
            urlTemplate={radarTileUrl}
            maximumZ={RADAR_MODULE_CONFIG.maxTileZoom}
            tileSize={256}
            zIndex={1}
            opacity={RADAR_MODULE_CONFIG.tileOpacity}
          />
        )}

        {/* Location marker */}
        {showMarker && (
          <Marker
            coordinate={{ latitude, longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View
              style={[
                styles.locationDot,
                { backgroundColor: dotColor },
              ]}
            >
              <View style={styles.locationDotInner} />
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  locationDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow for visibility on any map background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  locationDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'white',
  },
});

export default RadarMap;
