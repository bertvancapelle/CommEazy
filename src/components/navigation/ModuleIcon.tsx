/**
 * ModuleIcon — SVG-style icons for navigation modules
 *
 * Renders icons for all module types using View primitives.
 * Used by ModuleItem component.
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme';
import type { ModuleIconType } from '@/types/navigation';

// ============================================================
// Types
// ============================================================

export interface ModuleIconProps {
  /** Icon type to render */
  type: ModuleIconType;

  /** Icon size in points */
  size: number;

  /** Icon color (defaults to white for contrast on colored backgrounds) */
  color?: string;
}

// ============================================================
// Component
// ============================================================

export function ModuleIcon({
  type,
  size,
  color = colors.textOnPrimary,
}: ModuleIconProps) {
  switch (type) {
    case 'menu':
      // Hamburger menu icon (three horizontal lines)
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View
            style={[
              styles.menuLine,
              {
                width: size * 0.7,
                height: size * 0.08,
                top: size * 0.22,
                borderRadius: size * 0.04,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.menuLine,
              {
                width: size * 0.7,
                height: size * 0.08,
                top: size * 0.46,
                borderRadius: size * 0.04,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.menuLine,
              {
                width: size * 0.7,
                height: size * 0.08,
                top: size * 0.70,
                borderRadius: size * 0.04,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      );

    case 'chat':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View
            style={[
              styles.chatBubble,
              {
                width: size * 0.8,
                height: size * 0.6,
                borderRadius: size * 0.15,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.chatBubbleTail,
              {
                bottom: size * 0.05,
                left: size * 0.1,
                borderTopColor: color,
              },
            ]}
          />
        </View>
      );

    case 'contacts':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View
            style={[
              styles.personHead,
              {
                width: size * 0.4,
                height: size * 0.4,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.personBody,
              {
                width: size * 0.6,
                height: size * 0.3,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      );

    case 'groups':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View style={styles.groupsContainer}>
            <View style={[styles.groupPersonSmall, { left: size * 0.05 }]}>
              <View
                style={[
                  styles.personHead,
                  {
                    width: size * 0.25,
                    height: size * 0.25,
                    backgroundColor: color,
                    opacity: 0.7,
                  },
                ]}
              />
              <View
                style={[
                  styles.personBody,
                  {
                    width: size * 0.35,
                    height: size * 0.18,
                    backgroundColor: color,
                    opacity: 0.7,
                  },
                ]}
              />
            </View>
            <View style={[styles.groupPersonSmall, { right: size * 0.05 }]}>
              <View
                style={[
                  styles.personHead,
                  {
                    width: size * 0.25,
                    height: size * 0.25,
                    backgroundColor: color,
                    opacity: 0.7,
                  },
                ]}
              />
              <View
                style={[
                  styles.personBody,
                  {
                    width: size * 0.35,
                    height: size * 0.18,
                    backgroundColor: color,
                    opacity: 0.7,
                  },
                ]}
              />
            </View>
            <View style={styles.groupPersonCenter}>
              <View
                style={[
                  styles.personHead,
                  {
                    width: size * 0.35,
                    height: size * 0.35,
                    backgroundColor: color,
                  },
                ]}
              />
              <View
                style={[
                  styles.personBody,
                  {
                    width: size * 0.5,
                    height: size * 0.25,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      );

    case 'settings':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View
            style={[
              styles.gear,
              {
                width: size * 0.7,
                height: size * 0.7,
                borderWidth: size * 0.08,
                borderColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.gearCenter,
              {
                width: size * 0.25,
                height: size * 0.25,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      );

    case 'help':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <Text style={[styles.helpIcon, { fontSize: size * 0.7, color }]}>?</Text>
        </View>
      );

    case 'phone':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View
            style={[
              styles.phoneBody,
              {
                width: size * 0.35,
                height: size * 0.7,
                borderRadius: size * 0.1,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.phoneEarpiece,
              {
                width: size * 0.25,
                height: size * 0.12,
                top: size * 0.08,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.phoneMouthpiece,
              {
                width: size * 0.25,
                height: size * 0.12,
                bottom: size * 0.08,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      );

    case 'video':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View
            style={[
              styles.videoBody,
              {
                width: size * 0.6,
                height: size * 0.45,
                borderRadius: size * 0.08,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.videoLens,
              {
                width: 0,
                height: 0,
                borderLeftWidth: size * 0.25,
                borderTopWidth: size * 0.15,
                borderBottomWidth: size * 0.15,
                left: size * 0.55,
                borderLeftColor: color,
              },
            ]}
          />
        </View>
      );

    case 'book':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View
            style={[
              styles.bookLeft,
              {
                width: size * 0.4,
                height: size * 0.6,
                borderRadius: size * 0.05,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.bookRight,
              {
                width: size * 0.4,
                height: size * 0.6,
                borderRadius: size * 0.05,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.bookSpine,
              {
                width: size * 0.06,
                height: size * 0.55,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      );

    case 'headphones':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View
            style={[
              styles.headphonesBand,
              {
                width: size * 0.6,
                height: size * 0.35,
                borderTopLeftRadius: size * 0.3,
                borderTopRightRadius: size * 0.3,
                borderWidth: size * 0.06,
                borderColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.headphonesLeft,
              {
                width: size * 0.2,
                height: size * 0.3,
                borderRadius: size * 0.06,
                left: size * 0.15,
                top: size * 0.35,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.headphonesRight,
              {
                width: size * 0.2,
                height: size * 0.3,
                borderRadius: size * 0.06,
                right: size * 0.15,
                top: size * 0.35,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      );

    case 'podcast':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View
            style={[
              styles.podcastMic,
              {
                width: size * 0.35,
                height: size * 0.5,
                borderRadius: size * 0.175,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.podcastStand,
              {
                width: size * 0.5,
                height: size * 0.25,
                borderBottomLeftRadius: size * 0.25,
                borderBottomRightRadius: size * 0.25,
                borderWidth: size * 0.05,
                borderColor: color,
                top: size * 0.35,
              },
            ]}
          />
          <View
            style={[
              styles.podcastBase,
              {
                width: size * 0.08,
                height: size * 0.15,
                top: size * 0.55,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.podcastFoot,
              {
                width: size * 0.3,
                height: size * 0.06,
                borderRadius: size * 0.03,
                top: size * 0.68,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      );

    case 'radio':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View
            style={[
              styles.radioBody,
              {
                width: size * 0.75,
                height: size * 0.5,
                borderRadius: size * 0.08,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.radioAntenna,
              {
                width: size * 0.06,
                height: size * 0.35,
                top: size * 0.05,
                left: size * 0.25,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.radioSpeaker,
              {
                width: size * 0.25,
                height: size * 0.25,
                borderRadius: size * 0.125,
                borderWidth: size * 0.04,
                top: size * 0.35,
                left: size * 0.18,
                borderColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.radioDialLine,
              {
                width: size * 0.2,
                height: size * 0.04,
                top: size * 0.38,
                right: size * 0.18,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.radioDialLine,
              {
                width: size * 0.2,
                height: size * 0.04,
                top: size * 0.46,
                right: size * 0.18,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.radioDialLine,
              {
                width: size * 0.2,
                height: size * 0.04,
                top: size * 0.54,
                right: size * 0.18,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      );

    case 'news':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View
            style={[
              styles.newsBody,
              {
                width: size * 0.75,
                height: size * 0.65,
                borderRadius: size * 0.06,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.newsHeadline,
              {
                width: size * 0.5,
                height: size * 0.08,
                top: size * 0.22,
                left: size * 0.15,
                borderRadius: size * 0.02,
              },
            ]}
          />
          <View
            style={[
              styles.newsLine,
              {
                width: size * 0.55,
                height: size * 0.04,
                top: size * 0.38,
                left: size * 0.15,
              },
            ]}
          />
          <View
            style={[
              styles.newsLine,
              {
                width: size * 0.45,
                height: size * 0.04,
                top: size * 0.46,
                left: size * 0.15,
              },
            ]}
          />
          <View
            style={[
              styles.newsLine,
              {
                width: size * 0.5,
                height: size * 0.04,
                top: size * 0.54,
                left: size * 0.15,
              },
            ]}
          />
          <View
            style={[
              styles.newsFold,
              {
                width: size * 0.15,
                height: size * 0.15,
                top: size * 0.15,
                right: size * 0.13,
              },
            ]}
          />
        </View>
      );

    case 'weather':
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <View
            style={[
              styles.weatherSun,
              {
                width: size * 0.35,
                height: size * 0.35,
                borderRadius: size * 0.175,
                top: size * 0.1,
                right: size * 0.15,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.weatherRay,
              {
                width: size * 0.08,
                height: size * 0.12,
                top: size * 0.02,
                right: size * 0.28,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.weatherRay,
              {
                width: size * 0.12,
                height: size * 0.08,
                top: size * 0.24,
                right: size * 0.02,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.weatherCloud,
              {
                width: size * 0.55,
                height: size * 0.3,
                borderRadius: size * 0.15,
                bottom: size * 0.15,
                left: size * 0.1,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.weatherCloudBump,
              {
                width: size * 0.25,
                height: size * 0.25,
                borderRadius: size * 0.125,
                bottom: size * 0.3,
                left: size * 0.15,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.weatherCloudBump,
              {
                width: size * 0.2,
                height: size * 0.2,
                borderRadius: size * 0.1,
                bottom: size * 0.35,
                left: size * 0.35,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      );

    default:
      return null;
  }
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Menu icon (hamburger)
  menuLine: {
    position: 'absolute',
  },

  // Chat icon
  chatBubble: {},
  chatBubbleTail: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },

  // Person icon (contacts/groups)
  personHead: {
    borderRadius: 100,
    marginBottom: 4,
  },
  personBody: {
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
  },
  groupsContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupPersonSmall: {
    position: 'absolute',
    alignItems: 'center',
    top: '15%',
  },
  groupPersonCenter: {
    alignItems: 'center',
    zIndex: 1,
  },

  // Settings icon
  gear: {
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  gearCenter: {
    position: 'absolute',
    borderRadius: 100,
  },

  // Help icon
  helpIcon: {
    fontWeight: '700',
  },

  // Phone icon
  phoneBody: {},
  phoneEarpiece: {
    position: 'absolute',
  },
  phoneMouthpiece: {
    position: 'absolute',
  },

  // Video icon
  videoBody: {},
  videoLens: {
    position: 'absolute',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },

  // Book icon
  bookLeft: {
    position: 'absolute',
    left: '5%',
    transform: [{ rotate: '-5deg' }],
  },
  bookRight: {
    position: 'absolute',
    right: '5%',
    transform: [{ rotate: '5deg' }],
  },
  bookSpine: {
    position: 'absolute',
  },

  // Headphones icon
  headphonesBand: {
    position: 'absolute',
    top: '10%',
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  headphonesLeft: {
    position: 'absolute',
  },
  headphonesRight: {
    position: 'absolute',
  },

  // Podcast icon
  podcastMic: {
    position: 'absolute',
    top: '5%',
  },
  podcastStand: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  podcastBase: {
    position: 'absolute',
  },
  podcastFoot: {
    position: 'absolute',
  },

  // Radio icon
  radioBody: {
    position: 'absolute',
    top: '30%',
  },
  radioAntenna: {
    position: 'absolute',
    transform: [{ rotate: '-20deg' }],
  },
  radioSpeaker: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  radioDialLine: {
    position: 'absolute',
    borderRadius: 2,
  },

  // News icon
  newsBody: {
    position: 'absolute',
    top: '15%',
  },
  newsHeadline: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  newsLine: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 1,
  },
  newsFold: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderBottomLeftRadius: 4,
  },

  // Weather icon
  weatherSun: {
    position: 'absolute',
  },
  weatherRay: {
    position: 'absolute',
    borderRadius: 2,
  },
  weatherCloud: {
    position: 'absolute',
  },
  weatherCloudBump: {
    position: 'absolute',
  },
});

export default ModuleIcon;
