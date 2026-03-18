/**
 * FullscreenImageViewer — Reusable fullscreen photo viewer with overlay controls
 *
 * Generic component used by:
 * - Mail module (view + save mail photo attachments)
 * - Chat module (view received photos)
 * - PhotoAlbum module (can replace inline viewer)
 *
 * Features:
 * - Fullscreen modal with black background
 * - Semi-transparent overlay controls (always visible, senior-friendly)
 * - Previous/Next navigation with counter ("foto 2 van 5")
 * - Save button with duplicate prevention feedback
 * - Close button (top-left)
 *
 * Senior-inclusive design:
 * - Touch targets ≥ 60pt
 * - Always-visible controls (no auto-hide)
 * - Semi-transparent overlay (rgba(0,0,0,0.4)) for readability
 * - Haptic feedback on all interactions
 * - Clear counter text ("2 van 5")
 *
 * @see CLAUDE.md — Section 10d (Unified Button Styling)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  // Modal removed — using PanelAwareModal
  Image,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { PanelAwareModal } from './PanelAwareModal';
import { HapticTouchable } from './HapticTouchable';
import { useTranslation } from 'react-i18next';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { Icon } from './Icon';
import { LoadingView } from './LoadingView';
import { LiquidGlassView } from './LiquidGlassView';

// ============================================================
// Types
// ============================================================

export interface ViewerImage {
  /** Unique identifier for this image */
  id: string;
  /** Local file URI or remote URL */
  uri: string;
  /** Whether this image has already been saved */
  savedToAlbum?: boolean;
}

export interface FullscreenImageViewerProps {
  /** Whether the viewer modal is visible */
  visible: boolean;
  /** Array of images to display */
  images: ViewerImage[];
  /** Initial image index to show (0-based) */
  initialIndex?: number;
  /** Called when the viewer is closed */
  onClose: () => void;
  /** Called when the user taps the save button. Returns true on success. */
  onSave?: (image: ViewerImage, index: number) => Promise<boolean>;
  /** Accent color for save button (module color) */
  accentColor?: string;
}

// ============================================================
// Haptic helper
// ============================================================

function triggerHaptic() {
  ReactNativeHapticFeedback.trigger('impactMedium', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });
}

// ============================================================
// Component
// ============================================================

export function FullscreenImageViewer({
  visible,
  images,
  initialIndex = 0,
  onClose,
  onSave,
  accentColor = '#1976D2',
}: FullscreenImageViewerProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const colors = useColors();
  const { t } = useTranslation();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());

  // Reset state when modal opens with new initialIndex
  const handleShow = useCallback(() => {
    setCurrentIndex(initialIndex);
    setIsImageLoading(true);
    setIsSaving(false);
    setSavedIndices(new Set());
  }, [initialIndex]);

  const currentImage = images[currentIndex];
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= images.length - 1;
  const isSaved = currentImage?.savedToAlbum || savedIndices.has(currentIndex);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      triggerHaptic();
      setCurrentIndex(currentIndex - 1);
      setIsImageLoading(true);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      triggerHaptic();
      setCurrentIndex(currentIndex + 1);
      setIsImageLoading(true);
    }
  }, [currentIndex, images.length]);

  const handleSave = useCallback(async () => {
    if (!onSave || !currentImage || isSaving || isSaved) return;

    triggerHaptic();
    setIsSaving(true);

    try {
      const success = await onSave(currentImage, currentIndex);
      if (success) {
        setSavedIndices((prev) => new Set(prev).add(currentIndex));
      }
    } finally {
      setIsSaving(false);
    }
  }, [onSave, currentImage, currentIndex, isSaving, isSaved]);

  const handleClose = useCallback(() => {
    triggerHaptic();
    onClose();
  }, [onClose]);

  if (!currentImage) return null;

  return (
    <PanelAwareModal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
      onShow={handleShow}
    >
      <StatusBar hidden />
      <LiquidGlassView moduleId="photos" style={styles.container} cornerRadius={0}>
        {/* Photo display */}
        <Image
          source={{ uri: currentImage.uri }}
          style={{
            width: windowWidth,
            height: windowHeight,
          }}
          resizeMode="contain"
          onLoadStart={() => setIsImageLoading(true)}
          onLoadEnd={() => setIsImageLoading(false)}
          accessibilityLabel={t('components.imageViewer.photo', {
            current: currentIndex + 1,
            total: images.length,
          })}
        />

        {/* Loading indicator */}
        {isImageLoading && (
          <View style={styles.loadingOverlay}>
            <LoadingView message={t('common.loading')} />
          </View>
        )}

        {/* Top overlay bar — close button + counter */}
        <View style={styles.topOverlay}>
          {/* Close button */}
          <HapticTouchable hapticDisabled
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={styles.closeButtonText}>{t('common.close')}</Text>
          </HapticTouchable>

          {/* Counter */}
          {images.length > 1 && (
            <View style={styles.counterPill}>
              <Text style={styles.counterText}>
                {t('components.imageViewer.counter', {
                  current: currentIndex + 1,
                  total: images.length,
                })}
              </Text>
            </View>
          )}
        </View>

        {/* Navigation buttons (only if multiple images) */}
        {images.length > 1 && (
          <View style={styles.navigation} pointerEvents="box-none">
            {/* Previous button */}
            <HapticTouchable hapticDisabled
              style={[styles.navButton, isFirst && styles.navButtonDisabled]}
              onPress={handlePrevious}
              disabled={isFirst}
              accessibilityRole="button"
              accessibilityLabel={t('components.imageViewer.previous')}
            >
              <Icon
                name="chevron-left"
                size={32}
                color={isFirst ? 'rgba(255,255,255,0.3)' : colors.textOnPrimary}
              />
            </HapticTouchable>

            {/* Next button */}
            <HapticTouchable hapticDisabled
              style={[styles.navButton, isLast && styles.navButtonDisabled]}
              onPress={handleNext}
              disabled={isLast}
              accessibilityRole="button"
              accessibilityLabel={t('components.imageViewer.next')}
            >
              <Icon
                name="chevron-right"
                size={32}
                color={isLast ? 'rgba(255,255,255,0.3)' : colors.textOnPrimary}
              />
            </HapticTouchable>
          </View>
        )}

        {/* Bottom overlay — save button */}
        {onSave && (
          <View style={styles.bottomOverlay}>
            <HapticTouchable hapticDisabled
              style={[
                styles.saveButton,
                { backgroundColor: isSaved ? 'rgba(76, 175, 80, 0.7)' : accentColor },
              ]}
              onPress={handleSave}
              disabled={isSaving || isSaved}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                isSaved
                  ? t('components.imageViewer.alreadySaved')
                  : t('components.imageViewer.saveToAlbum')
              }
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : isSaved ? (
                <>
                  <Icon name="check" size={22} color={colors.textOnPrimary} />
                  <Text style={styles.saveButtonText}>
                    {t('components.imageViewer.saved')}
                  </Text>
                </>
              ) : (
                <>
                  <Icon name="download" size={22} color={colors.textOnPrimary} />
                  <Text style={styles.saveButtonText}>
                    {t('components.imageViewer.saveToAlbum')}
                  </Text>
                </>
              )}
            </HapticTouchable>
          </View>
        )}
      </LiquidGlassView>
    </PanelAwareModal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },

  // Top overlay
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: spacing.xl + 20, // Account for status bar / Dynamic Island
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
  closeButton: {
    height: touchTargets.comfortable,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: borderRadius.md,
  },
  closeButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  counterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  counterText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Navigation
  navigation: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    pointerEvents: 'box-none',
    zIndex: 15,
  },
  navButton: {
    width: touchTargets.comfortable,
    height: touchTargets.comfortable * 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: borderRadius.md,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },

  // Bottom overlay
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.xl + 20, // Account for home indicator
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    zIndex: 10,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  saveButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
