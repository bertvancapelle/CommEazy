/**
 * PhotoMessageBubble — Photo message display component
 *
 * Renders a photo message in chat with:
 * - Thumbnail preview in chat bubble
 * - Tap to view fullscreen
 * - Loading state with placeholder
 * - Error state with retry option
 * - Download progress for received photos
 *
 * @see .claude/plans/PHOTO_VIDEO_MESSAGING.md
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import {
  colors,
  typography,
  spacing,
  touchTargets,
  borderRadius,
} from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[PhotoMessageBubble]';

// Thumbnail size in chat bubble
const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 150;

// Haptic feedback duration
const HAPTIC_DURATION = 50;

// ============================================================
// Types
// ============================================================

export interface PhotoMessageBubbleProps {
  /** Photo URI (full resolution) */
  uri: string;
  /** Thumbnail URI (optional, uses uri if not provided) */
  thumbnailUri?: string;
  /** Photo width in pixels */
  width?: number;
  /** Photo height in pixels */
  height?: number;
  /** Optional caption text */
  caption?: string;
  /** Whether this is the sender's own message */
  isOwn: boolean;
  /** Message timestamp */
  timestamp: number;
  /** Download progress (0-1) for received photos */
  downloadProgress?: number;
  /** Whether the photo is currently downloading */
  isDownloading?: boolean;
  /** Whether the photo failed to load */
  hasError?: boolean;
  /** Callback when retry is pressed */
  onRetry?: () => void;
  /** Callback when photo is viewed */
  onView?: () => void;
}

// ============================================================
// Component
// ============================================================

export function PhotoMessageBubble({
  uri,
  thumbnailUri,
  width,
  height,
  caption,
  isOwn,
  timestamp,
  downloadProgress,
  isDownloading = false,
  hasError = false,
  onRetry,
  onView,
}: PhotoMessageBubbleProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor('photoAlbum');
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Fullscreen viewer state
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isViewerLoading, setIsViewerLoading] = useState(true);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);

  // Calculate aspect ratio for thumbnail
  const aspectRatio = width && height ? width / height : 4 / 3;
  const displayHeight = Math.min(THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH / aspectRatio);
  const displayWidth = displayHeight * aspectRatio;

  // Format timestamp
  const formatTime = useCallback((ts: number): string => {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Handle thumbnail tap
  const handlePress = useCallback(() => {
    if (hasError || isDownloading) return;

    Vibration.vibrate(HAPTIC_DURATION);
    console.info(LOG_PREFIX, 'Opening fullscreen viewer');
    setIsViewerLoading(true);
    setIsViewerOpen(true);
    onView?.();
  }, [hasError, isDownloading, onView]);

  // Handle close viewer
  const handleCloseViewer = useCallback(() => {
    setIsViewerOpen(false);
    setIsViewerLoading(true);
  }, []);

  // Handle retry
  const handleRetry = useCallback(() => {
    Vibration.vibrate(HAPTIC_DURATION);
    console.info(LOG_PREFIX, 'Retry loading photo');
    setThumbnailError(false);
    onRetry?.();
  }, [onRetry]);

  // Render loading state
  const renderLoading = () => (
    <View style={[styles.placeholder, { backgroundColor: themeColors.backgroundSecondary }]}>
      {isDownloading && downloadProgress !== undefined ? (
        <View style={styles.downloadProgress}>
          <ActivityIndicator size="large" color={moduleColor} />
          <Text style={[styles.downloadText, { color: themeColors.textSecondary }]}>
            {Math.round(downloadProgress * 100)}%
          </Text>
        </View>
      ) : (
        <ActivityIndicator size="large" color={moduleColor} />
      )}
    </View>
  );

  // Render error state
  const renderError = () => (
    <TouchableOpacity
      style={[styles.placeholder, styles.errorPlaceholder, { backgroundColor: themeColors.backgroundSecondary }]}
      onPress={handleRetry}
      accessibilityRole="button"
      accessibilityLabel={t('modules.photoAlbum.retryLoad', 'Retry loading photo')}
    >
      <Icon name="warning" size={32} color={colors.error} />
      <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>
        {t('modules.photoAlbum.loadError', 'Could not load photo')}
      </Text>
      <Text style={[styles.retryText, { color: moduleColor }]}>
        {t('common.tapToRetry', 'Tap to retry')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      <View
        style={[
          styles.container,
          isOwn
            ? [styles.ownMessage, { backgroundColor: themeColors.primary }]
            : [styles.otherMessage, { backgroundColor: themeColors.surface }],
        ]}
        accessible={true}
        accessibilityLabel={
          caption
            ? t('modules.photoAlbum.photoWithCaption', 'Photo: {{caption}}', { caption })
            : t('modules.photoAlbum.photo', 'Photo')
        }
        accessibilityHint={t('modules.photoAlbum.tapToView', 'Tap to view fullscreen')}
      >
        {/* Photo thumbnail */}
        <TouchableOpacity
          onPress={handlePress}
          disabled={hasError || isDownloading}
          style={[
            styles.thumbnailContainer,
            { width: displayWidth, height: displayHeight },
          ]}
          accessibilityRole="imagebutton"
        >
          {(hasError || thumbnailError) ? (
            renderError()
          ) : isDownloading ? (
            renderLoading()
          ) : (
            <>
              {!thumbnailLoaded && (
                <View style={[styles.placeholder, { backgroundColor: themeColors.backgroundSecondary }]}>
                  <ActivityIndicator size="small" color={moduleColor} />
                </View>
              )}
              <Image
                source={{ uri: thumbnailUri || uri }}
                style={[
                  styles.thumbnail,
                  !thumbnailLoaded && styles.thumbnailHidden,
                ]}
                resizeMode="cover"
                onLoadStart={() => setThumbnailLoaded(false)}
                onLoad={() => setThumbnailLoaded(true)}
                onError={() => setThumbnailError(true)}
              />
            </>
          )}
        </TouchableOpacity>

        {/* Caption (if any) */}
        {caption && (
          <Text
            style={[
              styles.caption,
              { color: isOwn ? colors.textOnPrimary : themeColors.textPrimary },
            ]}
            numberOfLines={3}
          >
            {caption}
          </Text>
        )}

        {/* Timestamp */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.timestamp,
              { color: isOwn ? 'rgba(255, 255, 255, 0.7)' : themeColors.textTertiary },
            ]}
          >
            {formatTime(timestamp)}
          </Text>
        </View>
      </View>

      {/* Fullscreen Viewer Modal */}
      <Modal
        visible={isViewerOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseViewer}
      >
        <StatusBar hidden />
        <View style={styles.viewerContainer}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.viewerCloseButton}
            onPress={handleCloseViewer}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
          >
            <Icon name="x" size={28} color={colors.textOnPrimary} />
          </TouchableOpacity>

          {/* Loading indicator */}
          {isViewerLoading && (
            <View style={styles.viewerLoadingOverlay}>
              <ActivityIndicator size="large" color={moduleColor} />
            </View>
          )}

          {/* Full resolution photo */}
          <Image
            source={{ uri }}
            style={{
              width: windowWidth,
              height: windowHeight,
            }}
            resizeMode="contain"
            onLoadStart={() => setIsViewerLoading(true)}
            onLoadEnd={() => setIsViewerLoading(false)}
            accessibilityLabel={t('modules.photoAlbum.fullPhoto', 'Full size photo')}
          />
        </View>
      </Modal>
    </>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    maxWidth: '80%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: borderRadius.sm,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: borderRadius.sm,
  },
  thumbnailContainer: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    margin: spacing.xs,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailHidden: {
    position: 'absolute',
    opacity: 0,
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  errorPlaceholder: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  errorText: {
    ...typography.label,
    textAlign: 'center',
  },
  retryText: {
    ...typography.label,
    fontWeight: '600',
  },
  downloadProgress: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  downloadText: {
    ...typography.label,
    fontWeight: '600',
  },
  caption: {
    ...typography.body,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  timestamp: {
    ...typography.small,
  },
  // Fullscreen viewer styles
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerCloseButton: {
    position: 'absolute',
    top: spacing.xl + 20,
    left: spacing.lg,
    zIndex: 10,
    width: touchTargets.comfortable,
    height: touchTargets.comfortable,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: borderRadius.full,
  },
  viewerLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
});

export default PhotoMessageBubble;
