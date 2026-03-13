/**
 * AlbumPickerModal — Pick photos/videos from device for mail attachment
 *
 * Uses PanelAwareModal for iPad Split View compatibility.
 * Shows device photos in a grid with multi-select support.
 *
 * Size warnings:
 * - > 20MB: inline banner warning
 * - > 25MB: banner + button disabled
 *
 * Senior-inclusive:
 * - Large grid items (touch target ≥60pt)
 * - Clear selection indicators
 * - Haptic feedback
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 14
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { HapticTouchable } from '@/components/HapticTouchable';
import { useTranslation } from 'react-i18next';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { Icon, LoadingView, PanelAwareModal } from '@/components';

// ============================================================
// Types
// ============================================================

interface PhotoItem {
  uri: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface AlbumPickerModalProps {
  visible: boolean;
  onSelect: (photos: PhotoItem[]) => void;
  onClose: () => void;
  maxTotalSize?: number;
}

// ============================================================
// Constants
// ============================================================

const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
const WARNING_SIZE = 20 * 1024 * 1024; // 20MB
const GRID_COLUMNS = 3;
const GRID_SPACING = 4;

// ============================================================
// Component
// ============================================================

export function AlbumPickerModal({
  visible,
  onSelect,
  onClose,
  maxTotalSize = MAX_TOTAL_SIZE,
}: AlbumPickerModalProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const { accentColor } = useAccentColor();
  const { triggerHaptic } = useFeedback();

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const itemSize = (screenWidth - spacing.md * 2 - GRID_SPACING * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  // ============================================================
  // Load Photos
  // ============================================================

  useEffect(() => {
    if (!visible) {
      setSelectedPhotos(new Set());
      return;
    }

    const loadPhotos = async () => {
      setIsLoading(true);
      setLoadError(false);
      try {
        // Request photo library permission
        const permission = Platform.OS === 'ios'
          ? PERMISSIONS.IOS.PHOTO_LIBRARY
          : PERMISSIONS.ANDROID.READ_MEDIA_IMAGES;

        let status = await check(permission);
        if (status === RESULTS.DENIED) {
          status = await request(permission);
        }

        if (status !== RESULTS.GRANTED && status !== RESULTS.LIMITED) {
          console.debug('[AlbumPicker] Photo library permission denied:', status);
          setLoadError(true);
          return;
        }

        // Fetch recent photos from device
        const result = await CameraRoll.getPhotos({
          first: 100,
          assetType: 'Photos',
          include: ['filename', 'fileSize', 'imageSize'],
        });

        const items: PhotoItem[] = result.edges.map(edge => ({
          uri: edge.node.image.uri,
          fileName: edge.node.image.filename || 'photo.jpg',
          fileSize: edge.node.image.fileSize || 0,
          mimeType: edge.node.type || 'image/jpeg',
          width: edge.node.image.width,
          height: edge.node.image.height,
        }));

        setPhotos(items);
      } catch (error) {
        console.debug('[AlbumPicker] Failed to load photos:', (error as Error).message);
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadPhotos();
  }, [visible]);

  // ============================================================
  // Selection
  // ============================================================

  const selectedTotalSize = Array.from(selectedPhotos).reduce((sum, uri) => {
    const photo = photos.find(p => p.uri === uri);
    return sum + (photo?.fileSize || 0);
  }, 0);

  const isOverWarning = selectedTotalSize > WARNING_SIZE;
  const isOverLimit = selectedTotalSize > maxTotalSize;

  const handleToggle = useCallback(
    (uri: string) => {
      triggerHaptic('tap');
      setSelectedPhotos(prev => {
        const next = new Set(prev);
        if (next.has(uri)) {
          next.delete(uri);
        } else {
          next.add(uri);
        }
        return next;
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    if (isOverLimit || selectedPhotos.size === 0) return;
    triggerHaptic('tap');

    const selected = photos.filter(p => selectedPhotos.has(p.uri));
    onSelect(selected);
    onClose();
  }, [isOverLimit, selectedPhotos, photos, onSelect, onClose]);

  const handleClose = useCallback(() => {
    triggerHaptic('tap');
    onClose();
  }, [onClose]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <PanelAwareModal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <HapticTouchable hapticDisabled
            style={styles.headerButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={[styles.headerButtonText, { color: accentColor.primary }]}>
              {t('common.cancel')}
            </Text>
          </HapticTouchable>

          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {t('modules.mail.compose.selectPhotos')}
          </Text>

          <HapticTouchable hapticDisabled
            style={styles.headerButton}
            onPress={handleConfirm}
            disabled={isOverLimit || selectedPhotos.size === 0}
            accessibilityRole="button"
            accessibilityLabel={t('modules.mail.compose.attachSelected')}
          >
            <Text
              style={[
                styles.headerButtonText,
                { color: isOverLimit || selectedPhotos.size === 0
                  ? themeColors.textSecondary
                  : accentColor.primary
                },
              ]}
            >
              {selectedPhotos.size > 0
                ? `${t('modules.mail.compose.attach')} (${selectedPhotos.size})`
                : t('modules.mail.compose.attach')
              }
            </Text>
          </HapticTouchable>
        </View>

        {/* Size warning */}
        {isOverWarning && (
          <View style={[styles.warningBanner, { backgroundColor: isOverLimit ? '#FFEBEE' : '#FFF3E0' }]}>
            <Icon name="warning" size={20} color={isOverLimit ? '#D32F2F' : '#F57C00'} />
            <Text style={[styles.warningText, { color: isOverLimit ? '#D32F2F' : '#F57C00' }]}>
              {isOverLimit
                ? t('modules.mail.compose.totalSizeExceeded')
                : t('modules.mail.compose.totalSizeWarning')
              }
            </Text>
          </View>
        )}

        {/* Photo Grid */}
        {loadError ? (
          <View style={styles.loadingContainer}>
            <Icon name="warning" size={48} color={themeColors.textSecondary} />
            <Text style={[styles.errorText, { color: themeColors.textPrimary }]}>
              {t('modules.mail.compose.photoAccessUnavailable')}
            </Text>
            <Text style={[styles.errorHint, { color: themeColors.textSecondary }]}>
              {t('modules.mail.compose.photoAccessHint')}
            </Text>
            <HapticTouchable hapticDisabled
              style={[styles.settingsButton, { backgroundColor: accentColor.primary }]}
              onPress={() => Linking.openSettings()}
              accessibilityRole="button"
              accessibilityLabel={t('modules.mail.compose.openSettings')}
            >
              <Text style={styles.settingsButtonText}>
                {t('modules.mail.compose.openSettings')}
              </Text>
            </HapticTouchable>
          </View>
        ) : isLoading ? (
          <LoadingView message={t('common.loading')} />
        ) : (
          <ScrollView contentContainerStyle={styles.gridContent}>
            <View style={styles.grid}>
              {photos.map(photo => {
                const isSelected = selectedPhotos.has(photo.uri);
                return (
                  <HapticTouchable hapticDisabled
                    key={photo.uri}
                    style={[
                      styles.gridItem,
                      { width: itemSize, height: itemSize },
                      isSelected && { borderColor: accentColor.primary, borderWidth: 3 },
                    ]}
                    onPress={() => handleToggle(photo.uri)}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={photo.fileName}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.gridImage}
                      resizeMode="cover"
                    />
                    {isSelected && (
                      <View style={[styles.checkmark, { backgroundColor: accentColor.primary }]}>
                        <Icon name="check" size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </HapticTouchable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </PanelAwareModal>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerButton: {
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
  title: {
    ...typography.body,
    fontWeight: '700',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  warningText: {
    ...typography.small,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    ...typography.h3,
    textAlign: 'center',
  },
  errorHint: {
    ...typography.body,
    textAlign: 'center',
  },
  settingsButton: {
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  settingsButtonText: {
    ...typography.body,
    color: 'white',
    fontWeight: '700',
  },
  gridContent: {
    padding: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_SPACING,
  },
  gridItem: {
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  checkmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
