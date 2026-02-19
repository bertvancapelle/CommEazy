/**
 * NunlLogo — nu.nl logo component for source attribution
 *
 * Uses a remote PNG image for the nu.nl logo.
 * This is more reliable than SVG rendering in React Native.
 *
 * @see .claude/CLAUDE.md (Module Headers)
 */

import React from 'react';
import { Image, StyleSheet } from 'react-native';

interface NunlLogoProps {
  /** Logo size in points (default: 28) */
  size?: number;
}

// nu.nl favicon/logo URL - PNG format for better compatibility
const NUNL_LOGO_URL = 'https://www.nu.nl/assets/favicon/android-chrome-192x192.png';

/**
 * Nu.nl logo component
 *
 * Renders the official nu.nl logo at the specified size.
 * Uses Image component with remote URL for reliability.
 */
export function NunlLogo({ size = 28 }: NunlLogoProps) {
  return (
    <Image
      source={{ uri: NUNL_LOGO_URL }}
      style={[styles.logo, { width: size, height: size }]}
      resizeMode="contain"
      accessibilityLabel="nu.nl logo"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    borderRadius: 4,
  },
});

export default NunlLogo;
