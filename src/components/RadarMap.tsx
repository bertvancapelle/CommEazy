/**
 * RadarMap Component
 *
 * Interactive map with radar overlay for the weather module.
 * Uses WebView with Leaflet.js for reliable cross-platform tile support.
 *
 * Features:
 * - Radar tile overlay from RainViewer
 * - Location marker with accent color
 * - Pinch-to-zoom support
 * - Centered on provided location
 *
 * Note: We use WebView + Leaflet instead of react-native-maps because
 * react-native-maps v1.10.3 has compatibility issues with UrlTile/Marker
 * on React Native 0.73.
 *
 * @see .claude/plans/buienradar-module-plan.md
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useAccentColorContext } from '@/contexts/AccentColorContext';
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
  onRegionChange?: (region: { latitude: number; longitude: number }) => void;
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
}: RadarMapProps): React.ReactElement {
  const { accentColor } = useAccentColorContext();

  // Determine marker color
  const dotColor = markerColor || accentColor.primary;

  // Generate the HTML for Leaflet map
  const mapHtml = useMemo(() => {
    // Convert {z}/{x}/{y} to Leaflet format if needed
    const leafletTileUrl = radarTileUrl
      ? radarTileUrl.replace('{z}', '{z}').replace('{x}', '{x}').replace('{y}', '{y}')
      : null;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; width: 100%; overflow: hidden; }
    #map { height: 100%; width: 100%; }
    .location-marker {
      width: 24px;
      height: 24px;
      background-color: ${dotColor};
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Initialize map
    var map = L.map('map', {
      center: [${latitude}, ${longitude}],
      zoom: ${RADAR_MODULE_CONFIG.defaultZoom},
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: false
    });

    // Add OpenStreetMap base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 1
    }).addTo(map);

    ${leafletTileUrl ? `
    // Add radar overlay
    L.tileLayer('${leafletTileUrl}', {
      maxZoom: ${RADAR_MODULE_CONFIG.maxTileZoom},
      opacity: ${RADAR_MODULE_CONFIG.tileOpacity},
      tileSize: 256
    }).addTo(map);
    ` : ''}

    ${showMarker ? `
    // Add location marker
    var markerIcon = L.divIcon({
      className: 'location-marker-container',
      html: '<div class="location-marker"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    L.marker([${latitude}, ${longitude}], { icon: markerIcon }).addTo(map);
    ` : ''}
  </script>
</body>
</html>
    `;
  }, [latitude, longitude, radarTileUrl, dotColor, showMarker]);

  // Container style
  const containerStyle = useMemo(() => [
    styles.container,
    height ? { height } : { flex: 1 },
  ], [height]);

  return (
    <View style={containerStyle}>
      <WebView
        source={{ html: mapHtml }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        accessibilityLabel="Buienradar kaart"
        accessibilityHint="Toont neerslagradar voor uw locatie"
      />
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
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default RadarMap;
