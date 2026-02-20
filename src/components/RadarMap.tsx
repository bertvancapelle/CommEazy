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
 * - Optimized: Only radar layer updates when time changes (not full page reload)
 *
 * Note: We use WebView + Leaflet instead of react-native-maps because
 * react-native-maps v1.10.3 has compatibility issues with UrlTile/Marker
 * on React Native 0.73.
 *
 * @see .claude/plans/buienradar-module-plan.md
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { accentColor } = useAccentColorContext();
  const webViewRef = useRef<WebView>(null);

  // Determine marker color
  const dotColor = markerColor || accentColor.primary;

  // Generate the HTML for Leaflet map (only re-generates when location/marker changes)
  // The radar tile URL is updated via injectJavaScript for performance
  const mapHtml = useMemo(() => {
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
    // Global reference to radar layer for dynamic updates
    var radarLayer = null;

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

    // Function to update radar layer (called from React Native)
    function updateRadarLayer(tileUrl) {
      // Remove existing radar layer if present
      if (radarLayer) {
        map.removeLayer(radarLayer);
        radarLayer = null;
      }

      // Add new radar layer if URL provided
      if (tileUrl) {
        radarLayer = L.tileLayer(tileUrl, {
          maxZoom: ${RADAR_MODULE_CONFIG.maxTileZoom},
          opacity: ${RADAR_MODULE_CONFIG.tileOpacity},
          tileSize: 256
        }).addTo(map);
      }
    }
  </script>
</body>
</html>
    `;
  }, [latitude, longitude, dotColor, showMarker]);

  // Update radar layer when tile URL changes (without reloading entire page)
  useEffect(() => {
    if (webViewRef.current && radarTileUrl !== undefined) {
      const script = `updateRadarLayer(${radarTileUrl ? `'${radarTileUrl}'` : 'null'}); true;`;
      webViewRef.current.injectJavaScript(script);
    }
  }, [radarTileUrl]);

  // Container style
  const containerStyle = useMemo(() => [
    styles.container,
    height ? { height } : { flex: 1 },
  ], [height]);

  return (
    <View style={containerStyle}>
      <WebView
        ref={webViewRef}
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
        accessibilityLabel={t('modules.weather.radar.title')}
        accessibilityHint={t('modules.weather.radar.mapHint')}
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
