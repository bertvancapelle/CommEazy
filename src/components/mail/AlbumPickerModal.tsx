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
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { typography, touchTargets, borderRadius, spacing } from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useFeedback } from '@/hooks/useFeedback';
import { Icon, PanelAwareModal } from '@/components';

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
        // @react-native-camera-roll/camera-roll is not installed.
        // When the package is added to the project, replace this block
        // with CameraRoll.getPhotos() to load device photos.
        console.warn('[AlbumPicker] @react-native-camera-roll/camera-roll is not installed');
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
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleClose}
            onLongPress={() => {}}
            delayLongPress={300}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={[styles.headerButtonText, { color: accentColor.primary }]}>
              {t('common.cancel')}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {t('modules.mail.compose.selectPhotos')}
          </Text>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleConfirm}
            onLongPress={() => {}}
            delayLongPress={300}
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
          </TouchableOpacity>
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
          </View>
        ) : isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={accentColor.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.gridContent}>
            <View style={styles.grid}>
              {photos.map(photo => {
                const isSelected = selectedPhotos.has(photo.uri);
                return (
                  <TouchableOpacity
                    key={photo.uri}
                    style={[
                      styles.gridItem,
                      { width: itemSize, height: itemSize },
                      isSelected && { borderColor: accentColor.primary, borderWidth: 3 },
                    ]}
                    onPress={() => handleToggle(photo.uri)}
                    onLongPress={() => {}}
                    delayLongPress={300}
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
                  </TouchableOpacity>
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
