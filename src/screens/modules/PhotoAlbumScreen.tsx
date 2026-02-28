/**
 * PhotoAlbumScreen — Photo gallery and sharing module
 *
 * Standalone gallery module for viewing, selecting, and sharing photos.
 * All photo-related actions happen here (view, send, delete).
 *
 * Design principles (from PNA discussion):
 * - Photo Album is the ONLY place for photo actions
 * - Select 1 or more photos → Send to 1-8 people
 * - Clear multi-select UX for seniors
 * - Consistent with Camera (which only captures)
 *
 * @see .claude/plans/PHOTO_VIDEO_MESSAGING.md for architecture
 * @see src/services/media/ for media storage services
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  Image,
  Dimensions,
  RefreshControl,
  Vibration,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import RNFS from 'react-native-fs';

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
import { usePaneContextSafe, type PaneId } from '@/contexts/PaneContext';
import { usePanelId } from '@/contexts/PanelIdContext';
import {
  deleteMediaBatch,
  getStorageUsage,
  getThumbnailUri,
} from '@/services/media';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[PhotoAlbumScreen]';

// Maximum recipients for photo sharing (dual-path encryption limit)
const MAX_RECIPIENTS = 8;

// Grid layout
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = spacing.sm;
const GRID_GAP = spacing.xs;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

// Haptic feedback
const HAPTIC_DURATION = 50;

// ============================================================
// Types
// ============================================================

interface PhotoItem {
  id: string;
  uri: string;
  thumbnailUri: string;
  timestamp: number;
  size: number;
}

// ============================================================
// Component
// ============================================================

export function PhotoAlbumScreen() {
  const { t } = useTranslation();
  const moduleColor = useModuleColor('photoAlbum');
  const paneContext = usePaneContextSafe();
  const panelId = usePanelId();

  // Photo state
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selection state
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Storage info
  const [storageUsed, setStorageUsed] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);

  // Check for pending navigation (e.g., photo ID from Camera)
  useEffect(() => {
    if (paneContext && panelId) {
      const pending = paneContext.consumePendingNavigation(panelId as PaneId);
      if (pending?.params?.selectPhotoId) {
        const photoId = pending.params.selectPhotoId as string;
        console.info(LOG_PREFIX, 'Received photo selection from Camera:', photoId);
        // Enter selection mode with this photo selected
        setIsSelectionMode(true);
        setSelectedPhotos(new Set([photoId]));
      }
    }
  }, [paneContext, panelId]);

  // Load photos from storage
  const loadPhotos = useCallback(async () => {
    try {
      console.info(LOG_PREFIX, 'Loading photos...');

      const mediaDir = `${RNFS.DocumentDirectoryPath}/media`;
      const dirExists = await RNFS.exists(mediaDir);

      if (!dirExists) {
        setPhotos([]);
        setPhotoCount(0);
        return;
      }

      // Read all files in media directory
      const files = await RNFS.readDir(mediaDir);

      // Filter for photos (not thumbnails or temp)
      const photoFiles = files.filter(
        f => f.isFile() &&
             !f.name.includes('_thumb') && !f.name.startsWith('.') &&
             (f.name.endsWith('.jpg') || f.name.endsWith('.jpeg') || f.name.endsWith('.png'))
      );

      // Build photo items
      const items: PhotoItem[] = [];

      for (const file of photoFiles) {
        const mediaId = file.name.replace(/\.(jpg|jpeg|png)$/i, '');
        const uri = file.path;

        // Get thumbnail
        const thumbnailUri = await getThumbnailUri(mediaId);

        items.push({
          id: mediaId,
          uri,
          thumbnailUri: thumbnailUri || uri,
          timestamp: file.mtime ? new Date(file.mtime).getTime() : Date.now(),
          size: Number(file.size) || 0,
        });
      }

      // Sort by timestamp (newest first)
      items.sort((a, b) => b.timestamp - a.timestamp);

      setPhotos(items);
      setPhotoCount(items.length);

      // Get storage usage
      const usage = await getStorageUsage();
      setStorageUsed(usage);

      console.info(LOG_PREFIX, 'Loaded photos:', items.length);
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to load photos:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    loadPhotos().finally(() => setIsLoading(false));
  }, [loadPhotos]);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadPhotos();
    setIsRefreshing(false);
  }, [loadPhotos]);

  // Toggle selection mode
  const handleToggleSelectionMode = useCallback(() => {
    Vibration.vibrate(HAPTIC_DURATION);
    setIsSelectionMode(prev => {
      if (prev) {
        setSelectedPhotos(new Set()); // Clear selection when exiting
      }
      return !prev;
    });
  }, []);

  // Toggle photo selection
  const handleTogglePhoto = useCallback((photoId: string) => {
    Vibration.vibrate(HAPTIC_DURATION);
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  }, []);

  // Handle photo tap (view or select)
  const handlePhotoPress = useCallback((photoId: string) => {
    if (isSelectionMode) {
      handleTogglePhoto(photoId);
    } else {
      // TODO: Open full-screen viewer
      console.info(LOG_PREFIX, 'View photo:', photoId);
      Alert.alert(
        t('modules.photoAlbum.viewTitle', 'View Photo'),
        t('modules.photoAlbum.viewerComingSoon', 'Full-screen photo viewer coming soon!'),
        [{ text: t('common.ok', 'OK') }]
      );
    }
  }, [isSelectionMode, handleTogglePhoto, t]);

  // Long-press to start selection mode
  const handlePhotoLongPress = useCallback((photoId: string) => {
    if (!isSelectionMode) {
      Vibration.vibrate(HAPTIC_DURATION * 2);
      setIsSelectionMode(true);
      setSelectedPhotos(new Set([photoId]));
    }
  }, [isSelectionMode]);

  // Handle send photos action
  const handleSendPhotos = useCallback(() => {
    if (selectedPhotos.size === 0) {
      Alert.alert(
        t('modules.photoAlbum.noSelection', 'No photos selected'),
        t('modules.photoAlbum.selectFirst', 'Please select one or more photos to send.'),
        [{ text: t('common.ok', 'OK') }]
      );
      return;
    }

    console.info(LOG_PREFIX, 'Send photos pressed:', selectedPhotos.size);

    Alert.alert(
      t('modules.photoAlbum.sendTitle', 'Send Photos'),
      t('modules.photoAlbum.sendComingSoon', 'Photo sharing coming soon!\n\nYou will be able to send photos to up to {{max}} contacts.', { max: MAX_RECIPIENTS }),
      [{ text: t('common.ok', 'OK') }]
    );
  }, [selectedPhotos, t]);

  // Handle delete photos action
  const handleDeletePhotos = useCallback(() => {
    if (selectedPhotos.size === 0) return;

    Alert.alert(
      t('modules.photoAlbum.deleteTitle', 'Delete Photos'),
      t('modules.photoAlbum.deleteConfirm', 'Delete {{count}} selected photo(s)?', { count: selectedPhotos.size }),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            console.info(LOG_PREFIX, 'Deleting photos:', selectedPhotos.size);
            Vibration.vibrate(HAPTIC_DURATION);

            try {
              const idsToDelete = Array.from(selectedPhotos);
              const deleted = await deleteMediaBatch(idsToDelete);

              console.info(LOG_PREFIX, 'Deleted photos:', deleted);

              // Refresh list
              await loadPhotos();

              // Exit selection mode
              setSelectedPhotos(new Set());
              setIsSelectionMode(false);
            } catch (error) {
              console.error(LOG_PREFIX, 'Failed to delete photos:', error);
              Alert.alert(
                t('common.error', 'Error'),
                t('modules.photoAlbum.deleteError', 'Could not delete photos. Please try again.'),
                [{ text: t('common.ok', 'OK') }]
              );
            }
          },
        },
      ]
    );
  }, [selectedPhotos, t, loadPhotos]);

  // Format storage size
  const formatStorageSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="image" size={80} color={colors.textSecondary} />
      <Text style={styles.emptyTitle}>
        {t('modules.photoAlbum.emptyTitle', 'No photos yet')}
      </Text>
      <Text style={styles.emptyHint}>
        {t('modules.photoAlbum.emptyHint', 'Use the Camera module to take photos.\nThey will appear here automatically.')}
      </Text>
    </View>
  );

  // Render photo grid item
  const renderPhotoItem = (photo: PhotoItem) => {
    const isSelected = selectedPhotos.has(photo.id);

    return (
      <TouchableOpacity
        key={photo.id}
        style={[
          styles.photoItem,
          isSelected && { borderColor: moduleColor, borderWidth: 3 },
        ]}
        onPress={() => handlePhotoPress(photo.id)}
        onLongPress={() => handlePhotoLongPress(photo.id)}
        accessibilityRole="button"
        accessibilityLabel={
          isSelected
            ? t('modules.photoAlbum.photoSelected', 'Photo selected')
            : t('modules.photoAlbum.photo', 'Photo')
        }
        accessibilityState={{ selected: isSelected }}
      >
        <Image
          source={{ uri: photo.thumbnailUri }}
          style={styles.photoThumbnail}
          resizeMode="cover"
        />
        {isSelectionMode && isSelected && (
          <View style={[styles.selectionBadge, { backgroundColor: moduleColor }]}>
            <Icon name="checkmark" size={16} color={colors.textOnPrimary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ModuleHeader
        moduleId="photoAlbum"
        icon="image"
        title={t('navigation.photoAlbum', 'Photo Album')}
        showAdMob={false}
      />

      {/* Selection Mode Header */}
      {isSelectionMode && (
        <View style={[styles.selectionHeader, { backgroundColor: moduleColor }]}>
          <Text style={styles.selectionText}>
            {selectedPhotos.size > 0
              ? t('modules.photoAlbum.selectedCount', '{{count}} selected', { count: selectedPhotos.size })
              : t('modules.photoAlbum.selectPhotos', 'Select photos')}
          </Text>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleToggleSelectionMode}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel', 'Cancel')}
          >
            <Icon name="x" size={24} color={colors.textOnPrimary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Storage info bar */}
      {!isSelectionMode && photoCount > 0 && (
        <View style={styles.storageBar}>
          <Icon name="image" size={16} color={colors.textSecondary} />
          <Text style={styles.storageText}>
            {t('modules.photoAlbum.storageInfo', '{{count}} photos • {{size}}', {
              count: photoCount,
              size: formatStorageSize(storageUsed),
            })}
          </Text>
        </View>
      )}

      {/* Photo Grid */}
      <ScrollView
        style={styles.gridContainer}
        contentContainerStyle={[
          styles.gridContent,
          photos.length === 0 && styles.gridContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={moduleColor}
          />
        }
      >
        {photos.length === 0 && !isLoading ? (
          renderEmptyState()
        ) : (
          <View style={styles.grid}>
            {photos.map(renderPhotoItem)}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        {isSelectionMode ? (
          // Selection mode actions
          <>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: moduleColor },
                selectedPhotos.size === 0 && styles.actionButtonDisabled,
              ]}
              onPress={handleSendPhotos}
              accessibilityRole="button"
              accessibilityLabel={t('modules.photoAlbum.send', 'Send')}
              disabled={selectedPhotos.size === 0}
            >
              <Icon name="chat" size={24} color={colors.textOnPrimary} />
              <Text style={styles.actionText}>
                {t('modules.photoAlbum.send', 'Send')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.deleteButton,
                selectedPhotos.size === 0 && styles.actionButtonDisabled,
              ]}
              onPress={handleDeletePhotos}
              accessibilityRole="button"
              accessibilityLabel={t('common.delete', 'Delete')}
              disabled={selectedPhotos.size === 0}
            >
              <Icon name="trash" size={24} color={colors.textOnPrimary} />
              <Text style={styles.actionText}>
                {t('common.delete', 'Delete')}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          // Normal mode: Select button
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: moduleColor },
              photos.length === 0 && styles.actionButtonDisabled,
            ]}
            onPress={handleToggleSelectionMode}
            accessibilityRole="button"
            accessibilityLabel={t('modules.photoAlbum.select', 'Select photos')}
            disabled={photos.length === 0}
          >
            <Icon name="checkmark" size={24} color={colors.textOnPrimary} />
            <Text style={styles.actionText}>
              {t('modules.photoAlbum.select', 'Select')}
            </Text>
          </TouchableOpacity>
        )}
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
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  selectionText: {
    ...typography.h3,
    color: colors.textOnPrimary,
  },
  cancelButton: {
    padding: spacing.sm,
  },
  storageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  storageText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  gridContainer: {
    flex: 1,
  },
  gridContent: {
    padding: GRID_PADDING,
  },
  gridContentEmpty: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  photoItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  selectionBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptyHint: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    minHeight: touchTargets.comfortable,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  actionText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
});

export default PhotoAlbumScreen;
