/**
 * CameraScreen — Photo/Video capture module
 *
 * Standalone camera module for capturing photos and videos.
 * Captured media is automatically saved to the local Photo Album.
 *
 * Design principles (from PNA discussion):
 * - Camera is ONLY for capturing — no sharing from here
 * - Tap thumbnail → navigate to Photo Album for all photo actions
 * - Clear, single-purpose interface for seniors
 *
 * @see .claude/plans/PHOTO_VIDEO_MESSAGING.md for architecture
 * @see src/services/media/ for media processing services
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { ModuleHeader } from '@/components';
import { Icon } from '@/components/Icon';
import {
  colors,
  typography,
  spacing,
  touchTargets,
  borderRadius,
} from '@/theme';
import { useModuleColor } from '@/contexts/ModuleColorsContext';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[CameraScreen]';

// ============================================================
// Component
// ============================================================

export function CameraScreen() {
  const { t } = useTranslation();
  const moduleColor = useModuleColor('camera');

  // Placeholder state for last captured photo
  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);

  // Placeholder: Simulate photo capture
  const handleCapturePhoto = useCallback(() => {
    console.info(LOG_PREFIX, 'Capture photo pressed');
    Alert.alert(
      t('modules.camera.title', 'Camera'),
      t('modules.camera.comingSoon', 'Camera module coming soon!\n\nThis will allow you to take photos and videos.'),
      [{ text: t('common.ok', 'OK') }]
    );
  }, [t]);

  // Placeholder: Simulate video capture
  const handleCaptureVideo = useCallback(() => {
    console.info(LOG_PREFIX, 'Capture video pressed');
    Alert.alert(
      t('modules.camera.title', 'Camera'),
      t('modules.camera.videoComingSoon', 'Video recording coming soon!'),
      [{ text: t('common.ok', 'OK') }]
    );
  }, [t]);

  // Placeholder: Switch camera (front/back)
  const handleSwitchCamera = useCallback(() => {
    console.info(LOG_PREFIX, 'Switch camera pressed');
    // TODO: Toggle between front and back camera
  }, []);

  // Placeholder: Navigate to photo album
  const handleOpenAlbum = useCallback(() => {
    console.info(LOG_PREFIX, 'Open album pressed');
    Alert.alert(
      t('navigation.photoAlbum', 'Photo Album'),
      t('modules.camera.albumHint', 'Tap the Photo Album module in the menu to view your photos.'),
      [{ text: t('common.ok', 'OK') }]
    );
  }, [t]);

  return (
    <SafeAreaView style={styles.container}>
      <ModuleHeader
        moduleId="camera"
        icon="camera"
        title={t('navigation.camera', 'Camera')}
        showAdMob={false}
      />

      {/* Camera Preview Placeholder */}
      <View style={styles.cameraPreview}>
        <Icon name="camera" size={80} color={colors.textSecondary} />
        <Text style={styles.previewText}>
          {t('modules.camera.previewPlaceholder', 'Camera preview')}
        </Text>
        <Text style={styles.previewHint}>
          {t('modules.camera.comingSoonHint', 'Full camera integration coming in next update')}
        </Text>
      </View>

      {/* Camera Controls */}
      <View style={styles.controlsContainer}>
        {/* Top row: Album thumbnail + Switch camera */}
        <View style={styles.topControls}>
          {/* Album thumbnail / last photo */}
          <TouchableOpacity
            style={styles.albumButton}
            onPress={handleOpenAlbum}
            accessibilityRole="button"
            accessibilityLabel={t('modules.camera.viewAlbum', 'View photo album')}
          >
            {lastPhotoUri ? (
              <Image source={{ uri: lastPhotoUri }} style={styles.albumThumbnail} />
            ) : (
              <Icon name="image" size={32} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          {/* Switch camera */}
          <TouchableOpacity
            style={styles.switchButton}
            onPress={handleSwitchCamera}
            accessibilityRole="button"
            accessibilityLabel={t('modules.camera.switchCamera', 'Switch camera')}
          >
            <Icon name="camera-reverse" size={28} color={colors.textOnPrimary} />
          </TouchableOpacity>
        </View>

        {/* Bottom row: Capture buttons */}
        <View style={styles.captureControls}>
          {/* Photo capture button */}
          <TouchableOpacity
            style={[styles.captureButton, { backgroundColor: moduleColor }]}
            onPress={handleCapturePhoto}
            accessibilityRole="button"
            accessibilityLabel={t('modules.camera.takePhoto', 'Take photo')}
          >
            <View style={styles.captureInner} />
          </TouchableOpacity>

          {/* Video mode indicator */}
          <TouchableOpacity
            style={styles.modeButton}
            onPress={handleCaptureVideo}
            accessibilityRole="button"
            accessibilityLabel={t('modules.camera.recordVideo', 'Record video')}
          >
            <Icon name="videocam" size={24} color={colors.textSecondary} />
            <Text style={styles.modeText}>
              {t('modules.camera.video', 'Video')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cameraPreview: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    margin: spacing.md,
    borderRadius: borderRadius.lg,
  },
  previewText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  previewHint: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  controlsContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  albumButton: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  albumThumbnail: {
    width: 58,
    height: 58,
    borderRadius: borderRadius.md - 1,
  },
  switchButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
  },
  captureButton: {
    width: touchTargets.large,
    height: touchTargets.large,
    borderRadius: touchTargets.large / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: touchTargets.large - 12,
    height: touchTargets.large - 12,
    borderRadius: (touchTargets.large - 12) / 2,
    backgroundColor: colors.textOnPrimary,
    borderWidth: 3,
    borderColor: colors.textOnPrimary,
  },
  modeButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  modeText: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});

export default CameraScreen;
