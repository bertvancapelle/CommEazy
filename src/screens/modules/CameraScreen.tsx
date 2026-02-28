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

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
  Platform,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Camera, CameraType } from 'react-native-camera-kit';

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
import { savePhoto } from '@/services/media';
import { usePaneContextSafe } from '@/contexts/PaneContext';
import { usePanelId } from '@/contexts/PanelIdContext';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[CameraScreen]';

/** Haptic feedback duration in ms */
const HAPTIC_DURATION = 50;

/** Flash modes */
type FlashMode = 'on' | 'off' | 'auto';

// ============================================================
// Component
// ============================================================

export function CameraScreen() {
  const { t } = useTranslation();
  const moduleColor = useModuleColor('camera');
  const paneContext = usePaneContextSafe();
  const panelId = usePanelId();

  // Camera state
  const cameraRef = useRef<Camera>(null);
  const [cameraType, setCameraType] = useState<CameraType>(CameraType.Back);
  const [flashMode, setFlashMode] = useState<FlashMode>('auto');
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  // Last captured photo for thumbnail
  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
  const [lastPhotoThumbnail, setLastPhotoThumbnail] = useState<string | null>(null);

  // Error state
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Handle camera ready
  const handleCameraReady = useCallback(() => {
    console.info(LOG_PREFIX, 'Camera ready');
    setCameraReady(true);
    setCameraError(null);
  }, []);

  // Switch between front and back camera
  const handleSwitchCamera = useCallback(() => {
    console.info(LOG_PREFIX, 'Switching camera');
    Vibration.vibrate(HAPTIC_DURATION);
    setCameraType(prev =>
      prev === CameraType.Back ? CameraType.Front : CameraType.Back
    );
  }, []);

  // Toggle flash mode: auto → on → off → auto
  const handleToggleFlash = useCallback(() => {
    console.info(LOG_PREFIX, 'Toggling flash');
    Vibration.vibrate(HAPTIC_DURATION);
    setFlashMode(prev => {
      switch (prev) {
        case 'auto': return 'on';
        case 'on': return 'off';
        case 'off': return 'auto';
        default: return 'auto';
      }
    });
  }, []);

  // Get flash icon based on current mode
  const getFlashIcon = useCallback((): 'flash' | 'flash-off' => {
    switch (flashMode) {
      case 'on': return 'flash';
      case 'off': return 'flash-off';
      case 'auto': return 'flash'; // Same icon but different label
      default: return 'flash';
    }
  }, [flashMode]);

  // Capture photo
  const handleCapturePhoto = useCallback(async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }

    console.info(LOG_PREFIX, 'Capturing photo...');
    setIsCapturing(true);
    Vibration.vibrate(HAPTIC_DURATION);

    try {
      // Capture photo
      const photo = await cameraRef.current.capture();

      if (!photo?.uri) {
        throw new Error('No photo data received');
      }

      console.info(LOG_PREFIX, 'Photo captured:', photo.uri);

      // Save to media storage
      const savedMedia = await savePhoto(
        photo.uri,
        'album', // chatId — using 'album' for photos not yet sent
        'camera'
      );

      if (savedMedia) {
        console.info(LOG_PREFIX, 'Photo saved:', savedMedia.id);

        // Update thumbnail
        setLastPhotoUri(savedMedia.localUri);
        setLastPhotoThumbnail(savedMedia.thumbnailUri);

        // Show success feedback
        Vibration.vibrate([0, HAPTIC_DURATION, HAPTIC_DURATION, HAPTIC_DURATION]);
      } else {
        throw new Error('Failed to save photo');
      }
    } catch (error) {
      console.error(LOG_PREFIX, 'Capture failed:', error);
      Alert.alert(
        t('modules.camera.error', 'Error'),
        t('modules.camera.captureError', 'Could not capture photo. Please try again.'),
        [{ text: t('common.ok', 'OK') }]
      );
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, t]);

  // Navigate to photo album
  const handleOpenAlbum = useCallback(() => {
    console.info(LOG_PREFIX, 'Opening photo album');

    if (paneContext && panelId) {
      // Navigate to photo album in same pane
      paneContext.setPanelModule(panelId, 'photoAlbum');
    } else {
      // Fallback: show hint
      Alert.alert(
        t('navigation.photoAlbum', 'Photo Album'),
        t('modules.camera.albumHint', 'Use the menu to open Photo Album and view your photos.'),
        [{ text: t('common.ok', 'OK') }]
      );
    }
  }, [paneContext, panelId, t]);

  // Flash label for accessibility
  const flashLabel = flashMode === 'auto'
    ? t('modules.camera.flashAuto', 'Flash: Auto')
    : flashMode === 'on'
      ? t('modules.camera.flashOn', 'Flash: On')
      : t('modules.camera.flashOff', 'Flash: Off');

  return (
    <SafeAreaView style={styles.container}>
      <ModuleHeader
        moduleId="camera"
        icon="camera"
        title={t('navigation.camera', 'Camera')}
        showAdMob={false}
      />

      {/* Camera Preview */}
      <View style={styles.cameraContainer}>
        {cameraError ? (
          <View style={styles.errorContainer}>
            <Icon name="warning" size={60} color={colors.error} />
            <Text style={styles.errorText}>{cameraError}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: moduleColor }]}
              onPress={() => setCameraError(null)}
            >
              <Text style={styles.retryButtonText}>
                {t('common.tryAgain', 'Try Again')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Camera
            ref={cameraRef}
            style={styles.camera}
            cameraType={cameraType}
            flashMode={flashMode}
            onReadCode={() => {}} // Required but unused
            showFrame={false}
            scanBarcode={false}
          />
        )}

        {/* Top overlay: Flash toggle */}
        <View style={styles.topOverlay}>
          <TouchableOpacity
            style={styles.overlayButton}
            onPress={handleToggleFlash}
            accessibilityRole="button"
            accessibilityLabel={flashLabel}
          >
            <Icon name={getFlashIcon()} size={24} color={colors.textOnPrimary} />
            {flashMode === 'auto' && (
              <Text style={styles.flashAutoLabel}>A</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Camera Controls */}
      <View style={styles.controlsContainer}>
        {/* Control row */}
        <View style={styles.controlRow}>
          {/* Album thumbnail / last photo */}
          <TouchableOpacity
            style={styles.albumButton}
            onPress={handleOpenAlbum}
            accessibilityRole="button"
            accessibilityLabel={t('modules.camera.viewAlbum', 'View photo album')}
          >
            {lastPhotoThumbnail || lastPhotoUri ? (
              <Image
                source={{ uri: lastPhotoThumbnail || lastPhotoUri || undefined }}
                style={styles.albumThumbnail}
              />
            ) : (
              <Icon name="image" size={28} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          {/* Photo capture button */}
          <TouchableOpacity
            style={[styles.captureButton, { borderColor: moduleColor }]}
            onPress={handleCapturePhoto}
            disabled={isCapturing || !cameraReady}
            accessibilityRole="button"
            accessibilityLabel={t('modules.camera.takePhoto', 'Take photo')}
          >
            {isCapturing ? (
              <ActivityIndicator size="large" color={moduleColor} />
            ) : (
              <View style={[styles.captureInner, { backgroundColor: moduleColor }]} />
            )}
          </TouchableOpacity>

          {/* Switch camera */}
          <TouchableOpacity
            style={styles.switchButton}
            onPress={handleSwitchCamera}
            accessibilityRole="button"
            accessibilityLabel={t('modules.camera.switchCamera', 'Switch camera')}
          >
            <Icon name="camera-reverse" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Capture hint */}
        <Text style={styles.captureHint}>
          {t('modules.camera.captureHint', 'Tap to take a photo')}
        </Text>
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
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  topOverlay: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  overlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  flashAutoLabel: {
    ...typography.label,
    color: colors.textOnPrimary,
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 2,
  },
  controlsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
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
    overflow: 'hidden',
  },
  albumThumbnail: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
  },
  captureButton: {
    width: touchTargets.large,
    height: touchTargets.large,
    borderRadius: touchTargets.large / 2,
    borderWidth: 4,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: touchTargets.large - 16,
    height: touchTargets.large - 16,
    borderRadius: (touchTargets.large - 16) / 2,
  },
  switchButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  captureHint: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});

export default CameraScreen;
