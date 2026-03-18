/**
 * ArtworkImage — Image with onError fallback to placeholder
 *
 * Renders an artwork image from a URL. When the URL fails to load (404,
 * network error, etc.), automatically falls back to a styled placeholder
 * with an icon on a colored background.
 *
 * Each instance manages its own error state internally — no external
 * tracking needed, making it safe to use in .map() lists.
 *
 * @example
 * <ArtworkImage
 *   uri={station.favicon}
 *   style={styles.stationArtwork}
 *   placeholderIcon="radio"
 *   placeholderColor={radioModuleColor}
 *   accessibilityLabel={station.name}
 * />
 */

import React, { useState, useCallback } from 'react';
import { Image, View, type StyleProp, type ViewStyle, type ImageStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { colors } from '@/theme';

export interface ArtworkImageProps {
  /** Image URL — when null/undefined/empty, placeholder is shown immediately */
  uri: string | null | undefined;
  /** Style for the image and placeholder container */
  style: StyleProp<ImageStyle>;
  /** Icon to show in placeholder */
  placeholderIcon: IconName;
  /** Background color for placeholder */
  placeholderColor: string;
  /** Icon size in placeholder (default 32) */
  placeholderIconSize?: number;
  /** Accessibility label for the image */
  accessibilityLabel?: string;
}

export function ArtworkImage({
  uri,
  style,
  placeholderIcon,
  placeholderColor,
  placeholderIconSize = 32,
  accessibilityLabel,
}: ArtworkImageProps) {
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  // Show placeholder when no URI or when load failed
  if (!uri || hasError) {
    return (
      <View
        style={[style, { backgroundColor: placeholderColor, justifyContent: 'center', alignItems: 'center' }]}
        accessibilityLabel={accessibilityLabel}
      >
        <Icon name={placeholderIcon} size={placeholderIconSize} color={colors.textOnPrimary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      onError={handleError}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
