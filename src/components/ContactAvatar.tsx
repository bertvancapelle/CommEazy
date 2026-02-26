/**
 * ContactAvatar — Profile photo with fallback to initials + presence dot
 *
 * Senior-inclusive design:
 * - Large default size (60px) for easy recognition
 * - High contrast fallback initials
 * - Rounded for friendly appearance
 * - Optional presence dot (bottom-right, 30% diameter)
 *
 * Presence dot visual states:
 * - Online: green filled dot
 * - Away: orange filled dot
 * - Offline: grey open ring (outline only)
 *
 * @see .claude/plans/UNIVERSAL_PRESENCE.md
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '@/theme';
import type { VisualPresence } from '@/contexts/PresenceContext';

interface ContactAvatarProps {
  /** Contact's display name (used for initials fallback) */
  name: string;
  /** Optional photo URL */
  photoUrl?: string;
  /** Size in pixels (default 60) */
  size?: number;
  /** Accessibility label override */
  accessibilityLabel?: string;
  /** Visual presence data from useVisualPresence() — omit to hide dot */
  presence?: VisualPresence;
}

/**
 * Displays a contact's profile photo or their initials as fallback.
 * Optionally shows a presence dot overlay at bottom-right.
 *
 * - If photoUrl is provided and loads successfully: shows photo
 * - Otherwise: shows first letter of name in colored circle
 * - If presence is provided: shows presence dot
 */
export function ContactAvatar({
  name,
  photoUrl,
  size = 60,
  accessibilityLabel,
  presence,
}: ContactAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const showImage = photoUrl && !imageError;

  const initial = name.charAt(0).toUpperCase();
  const borderRadius = size / 2;

  // Scale font size based on avatar size
  const fontSize = size * 0.4;

  // Presence dot sizing: 30% of avatar diameter
  const dotSize = Math.round(size * 0.3);
  const dotBorder = Math.max(2, Math.round(size * 0.04)); // 2-3pt white border

  // Build accessibility label
  const a11y = presence
    ? presence.a11yLabel(name)
    : (accessibilityLabel ?? `${name} profielfoto`);

  return (
    <View
      style={{
        width: size,
        height: size,
      }}
      accessibilityLabel={a11y}
      accessibilityRole="image"
    >
      {/* Avatar circle */}
      <View
        style={[
          styles.avatarCircle,
          {
            width: size,
            height: size,
            borderRadius,
          },
        ]}
      >
        {showImage ? (
          <Image
            source={{ uri: photoUrl }}
            style={[
              styles.image,
              {
                width: size,
                height: size,
                borderRadius,
              },
            ]}
            onError={() => setImageError(true)}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.fallback,
              {
                width: size,
                height: size,
                borderRadius,
                backgroundColor: getAvatarColor(name),
              },
            ]}
          >
            <Text
              style={[
                styles.initial,
                { fontSize },
              ]}
            >
              {initial}
            </Text>
          </View>
        )}
      </View>

      {/* Presence dot overlay (bottom-right) */}
      {presence && (
        <View
          style={[
            styles.presenceDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              borderWidth: dotBorder,
              borderColor: '#FFFFFF',
              // Offline = open ring (outline), online/away = filled
              backgroundColor: presence.isRing ? 'transparent' : presence.color,
            },
            // For ring style (offline), use inner border for the grey ring
            presence.isRing && {
              borderColor: '#FFFFFF',
              backgroundColor: '#FFFFFF',
            },
          ]}
        >
          {/* Inner ring for offline state */}
          {presence.isRing && (
            <View
              style={{
                flex: 1,
                borderRadius: dotSize / 2,
                borderWidth: Math.max(1.5, dotBorder * 0.6),
                borderColor: presence.color,
                backgroundColor: 'transparent',
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

// Warm, friendly colors for avatar backgrounds (based on name initial)
const AVATAR_COLORS = [
  '#E57373', // Warm red
  '#F06292', // Pink
  '#BA68C8', // Purple
  '#7986CB', // Indigo
  '#64B5F6', // Blue
  '#4DB6AC', // Teal
  '#81C784', // Green
  '#FFB74D', // Orange
  '#A1887F', // Brown
  '#90A4AE', // Blue grey
];

/**
 * Get a consistent color based on the name.
 * Same name always gets same color.
 */
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

const styles = StyleSheet.create({
  avatarCircle: {
    overflow: 'hidden',
  },
  image: {
    backgroundColor: colors.backgroundSecondary,
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  presenceDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
