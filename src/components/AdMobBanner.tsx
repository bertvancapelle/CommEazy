/**
 * AdMobBanner — Placeholder component for AdMob banners
 *
 * Currently shows a tappable placeholder that opens a test URL.
 * To enable real ads, install react-native-google-mobile-ads and
 * replace this implementation.
 *
 * @see https://docs.page/invertase/react-native-google-mobile-ads
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { colors, typography, spacing } from '@/theme';

// ============================================================
// Types
// ============================================================

export interface AdMobBannerProps {
  /** AdMob unit ID (for future real implementation) */
  unitId?: string;
  /** Banner size variant */
  size?: 'banner' | 'largeBanner' | 'mediumRectangle';
  /** Background color variant */
  variant?: 'light' | 'dark';
  /** Callback when ad is tapped */
  onAdPress?: () => void;
}

// ============================================================
// Test Ad Configuration
// ============================================================

// Google's official test ad unit IDs (safe to use in development)
// These show real-looking ads but don't generate revenue
const TEST_AD_UNIT_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  largeBanner: 'ca-app-pub-3940256099942544/6300978111',
  mediumRectangle: 'ca-app-pub-3940256099942544/6300978111',
};

// Placeholder ad content (simulates real ad appearance)
const PLACEHOLDER_ADS = [
  {
    title: 'CommEazy Premium',
    subtitle: 'Advertentievrij & extra functies',
    url: 'https://commeazy.com/premium',
    backgroundColor: '#1976D2',
  },
  {
    title: 'Probeer Premium Gratis',
    subtitle: '7 dagen geen advertenties',
    url: 'https://commeazy.com/trial',
    backgroundColor: '#2E7D32',
  },
  {
    title: 'Support CommEazy',
    subtitle: 'Help ons de app te verbeteren',
    url: 'https://commeazy.com/support',
    backgroundColor: '#7B1FA2',
  },
];

// ============================================================
// Component
// ============================================================

export function AdMobBanner({
  unitId,
  size = 'banner',
  variant = 'dark',
  onAdPress,
}: AdMobBannerProps) {
  // Select a random placeholder ad
  const [adIndex] = React.useState(() =>
    Math.floor(Math.random() * PLACEHOLDER_ADS.length)
  );
  const ad = PLACEHOLDER_ADS[adIndex];

  const handlePress = async () => {
    onAdPress?.();

    // Open the ad URL
    try {
      const canOpen = await Linking.canOpenURL(ad.url);
      if (canOpen) {
        await Linking.openURL(ad.url);
      }
    } catch (error) {
      console.warn('[AdMobBanner] Failed to open URL:', error);
    }
  };

  const bannerHeight = size === 'banner' ? 50 : size === 'largeBanner' ? 100 : 250;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { height: bannerHeight, backgroundColor: ad.backgroundColor },
      ]}
      onPress={handlePress}
      activeOpacity={0.9}
      accessibilityRole="link"
      accessibilityLabel={`Advertentie: ${ad.title}`}
      accessibilityHint="Tik om te openen"
    >
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {ad.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {ad.subtitle}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Ad</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.small,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    ...typography.small,
    color: colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 10,
  },
});

export default AdMobBanner;
