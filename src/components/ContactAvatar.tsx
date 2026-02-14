/**
 * ContactAvatar — Profile photo with fallback to initials
 *
 * Senior-inclusive design:
 * - Large default size (60px) for easy recognition
 * - High contrast fallback initials
 * - Rounded for friendly appearance
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, typography } from '@/theme';

interface ContactAvatarProps {
  /** Contact's display name (used for initials fallback) */
  name: string;
  /** Optional photo URL */
  photoUrl?: string;
  /** Size in pixels (default 60) */
  size?: number;
  /** Accessibility label override */
  accessibilityLabel?: string;
}

/**
 * Displays a contact's profile photo or their initials as fallback.
 *
 * - If photoUrl is provided and loads successfully: shows photo
 * - Otherwise: shows first letter of name in colored circle
 */
export function ContactAvatar({
  name,
  photoUrl,
  size = 60,
  accessibilityLabel,
}: ContactAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const showImage = photoUrl && !imageError;

  const initial = name.charAt(0).toUpperCase();
  const borderRadius = size / 2;

  // Scale font size based on avatar size
  const fontSize = size * 0.4;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
        },
      ]}
      accessibilityLabel={accessibilityLabel ?? `${name} profielfoto`}
      accessibilityRole="image"
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
  container: {
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
});
