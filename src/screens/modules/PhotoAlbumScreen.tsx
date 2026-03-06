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

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  Image,
  RefreshControl,
  useWindowDimensions,
  ActivityIndicator,
  InteractionManager,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import RNFS from 'react-native-fs';
import { launchImageLibrary } from 'react-native-image-picker';

import {
  ModuleHeader,
  PhotoRecipientModal,
  HapticTouchable,
  FullscreenImageViewer,
} from '@/components';
import type { ViewerImage } from '@/components';
import { Icon } from '@/components/Icon';
import {
  typography,
  spacing,
  touchTargets,
  borderRadius,
} from '@/theme';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { usePaneContextSafe, type PaneId } from '@/contexts/PaneContext';
import { usePanelId } from '@/contexts/PanelIdContext';
import {
  deleteMediaBatch,
  getStorageUsage,
  getThumbnailUri,
  saveMedia,
} from '@/services/media';
import { chatService } from '@/services/chat';
import { ServiceContainer } from '@/services/container';
import type { Contact } from '@/services/interfaces';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[PhotoAlbumScreen]';

// Maximum recipients for photo sharing (dual-path encryption limit)
const MAX_RECIPIENTS = 8;

// Grid layout
const GRID_PADDING = spacing.sm;
const GRID_GAP = spacing.xs;
const NUM_COLUMNS = 3;

// ============================================================
// Date Grouping Utility
// ============================================================

interface DateGroup {
  label: string;
  photos: PhotoItem[];
}

/**
 * Group photos by date label for section headers.
 * Uses i18n keys for "Today", "Yesterday"; locale date for older items.
 */
function groupPhotosByDate(
  photos: PhotoItem[],
  t: (key: string) => string,
): DateGroup[] {
  if (photos.length === 0) return [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000; // 24h in ms
  const lastWeekStart = todayStart - 7 * 86400000;

  const groups: Record<string, PhotoItem[]> = {};
  const groupOrder: string[] = [];

  for (const photo of photos) {
    let label: string;
    if (photo.timestamp >= todayStart) {
      label = t('chat.today');
    } else if (photo.timestamp >= yesterdayStart) {
      label = t('chat.yesterday');
    } else if (photo.timestamp >= lastWeekStart) {
      label = t('modules.photoAlbum.dateLastWeek');
    } else {
      // Format as localized month + year (e.g., "Februari 2026")
      const d = new Date(photo.timestamp);
      label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }

    if (!groups[label]) {
      groups[label] = [];
      groupOrder.push(label);
    }
    groups[label].push(photo);
  }

  return groupOrder.map(label => ({ label, photos: groups[label] }));
}

// ============================================================
// Types
// ============================================================

type MediaItemType = 'photo' | 'video';

interface PhotoItem {
  id: string;
  uri: string;
  thumbnailUri: string;
  timestamp: number;
  size: number;
  type: MediaItemType;
  /** Video duration in seconds (only for videos) */
  duration?: number;
}

/**
 * Format video duration as "M:SS" or "H:MM:SS".
 */
function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ============================================================
// Component
// ============================================================

export function PhotoAlbumScreen() {
  const { t } = useTranslation();
  const themeColors = useColors();
  const moduleColor = useModuleColor('photoAlbum');
  const paneContext = usePaneContextSafe();
  const panelId = usePanelId();
  const { width: screenWidth } = useWindowDimensions();

  // Responsive grid item size
  const itemSize = useMemo(
    () => (screenWidth - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS,
    [screenWidth],
  );

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

  // Fullscreen viewer state (uses FullscreenImageViewer)
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  // Recipient modal state
  const [isRecipientModalVisible, setIsRecipientModalVisible] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Map photos to FullscreenImageViewer format (exclude videos — viewer is image-only)
  const photoOnlyItems = useMemo(
    () => photos.filter(p => p.type === 'photo'),
    [photos],
  );
  const viewerImages: ViewerImage[] = useMemo(
    () => photoOnlyItems.map(p => ({ id: p.id, uri: p.uri })),
    [photoOnlyItems],
  );

  // Group photos by date for section headers
  const dateGroups = useMemo(
    () => groupPhotosByDate(photos, t),
    [photos, t],
  );

  // Check for pending navigation (e.g., photo ID from Camera)
  useEffect(() => {
    if (paneContext && panelId) {
      const pending = paneContext.consumePendingNavigation(panelId as PaneId);
      if (pending?.params?.selectPhotoId) {
        const photoId = pending.params.selectPhotoId as string;
        console.debug(LOG_PREFIX, 'Received photo selection from Camera');
        // Enter selection mode with this photo selected
        setIsSelectionMode(true);
        setSelectedPhotos(new Set([photoId]));
      }
    }
  }, [paneContext, panelId]);

  // Load photos from storage
  const loadPhotos = useCallback(async () => {
    try {
      console.debug(LOG_PREFIX, 'Loading photos...');

      const mediaDir = `${RNFS.DocumentDirectoryPath}/media`;
      const dirExists = await RNFS.exists(mediaDir);

      if (!dirExists) {
        setPhotos([]);
        setPhotoCount(0);
        return;
      }

      // Read all files in media directory
      const files = await RNFS.readDir(mediaDir);

      // Filter for photos and videos (not thumbnails or temp)
      const mediaFiles = files.filter(
        f => f.isFile() &&
             !f.name.includes('_thumb') && !f.name.startsWith('.') &&
             /\.(jpg|jpeg|png|mp4|mov)$/i.test(f.name)
      );

      // Build media items
      const items: PhotoItem[] = [];

      for (const file of mediaFiles) {
        const mediaId = file.name.replace(/\.(jpg|jpeg|png|mp4|mov)$/i, '');
        const uri = file.path;
        const isVideo = /\.(mp4|mov)$/i.test(file.name);

        // Get thumbnail
        const thumbnailUri = await getThumbnailUri(mediaId);

        items.push({
          id: mediaId,
          uri,
          thumbnailUri: thumbnailUri || uri,
          timestamp: file.mtime ? new Date(file.mtime).getTime() : Date.now(),
          size: Number(file.size) || 0,
          type: isVideo ? 'video' : 'photo',
        });
      }

      // Sort by timestamp (newest first)
      items.sort((a, b) => b.timestamp - a.timestamp);

      setPhotos(items);
      setPhotoCount(items.length);

      // Get storage usage
      const usage = await getStorageUsage();
      setStorageUsed(usage);

      console.debug(LOG_PREFIX, 'Loaded photos:', { count: items.length });
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to load photos');
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

  // Toggle selection mode (haptic handled by HapticTouchable)
  const handleToggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => {
      if (prev) {
        setSelectedPhotos(new Set()); // Clear selection when exiting
      }
      return !prev;
    });
  }, []);

  // Toggle photo selection (haptic handled by HapticTouchable)
  const handleTogglePhoto = useCallback((photoId: string) => {
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
      return;
    }

    const item = photos.find(p => p.id === photoId);
    if (!item) return;

    if (item.type === 'video') {
      // Open video in system player
      console.debug(LOG_PREFIX, 'Opening video in system player');
      Linking.openURL(item.uri).catch(() => {
        console.error(LOG_PREFIX, 'Failed to open video');
      });
    } else {
      // Open FullscreenImageViewer at the correct index (photo-only index)
      const photoIndex = photoOnlyItems.findIndex(p => p.id === photoId);
      if (photoIndex >= 0) {
        console.debug(LOG_PREFIX, 'Opening viewer');
        setViewerInitialIndex(photoIndex);
        setViewerVisible(true);
      }
    }
  }, [isSelectionMode, handleTogglePhoto, photos, photoOnlyItems]);

  // Close fullscreen viewer
  const handleCloseViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  // Long-press to start selection mode
  const handlePhotoLongPress = useCallback((photoId: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedPhotos(new Set([photoId]));
    }
  }, [isSelectionMode]);

  // Load contacts for recipient modal
  const loadContacts = useCallback(async () => {
    setIsLoadingContacts(true);
    try {
      if (ServiceContainer.isInitialized && chatService.isInitialized) {
        const contactList = await chatService.getContacts();
        setContacts(contactList);
        console.debug(LOG_PREFIX, 'Loaded contacts:', { count: contactList.length });
      } else if (__DEV__) {
        // Use mock contacts in dev mode
        const { getMockContactsForDevice } = await import('@/services/mock');
        const { getOtherDevicesPublicKeys } = await import('@/services/mock/testKeys');
        const publicKeyMap = await getOtherDevicesPublicKeys('ik@commeazy.local');
        const deviceContacts = getMockContactsForDevice('ik@commeazy.local', publicKeyMap);
        setContacts(deviceContacts);
        console.debug(LOG_PREFIX, 'Using test device contacts:', { count: deviceContacts.length });
      }
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to load contacts');
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  // Handle send photos action — opens recipient modal
  const handleSendPhotos = useCallback(() => {
    if (selectedPhotos.size === 0) {
      Alert.alert(
        t('modules.photoAlbum.noSelection', 'No photos selected'),
        t('modules.photoAlbum.selectFirst', 'Please select one or more photos to send.'),
        [{ text: t('common.ok', 'OK') }]
      );
      return;
    }

    console.debug(LOG_PREFIX, 'Send photos pressed:', { count: selectedPhotos.size });

    // Load contacts and show recipient modal
    loadContacts();
    setIsRecipientModalVisible(true);
  }, [selectedPhotos, t, loadContacts]);

  // Handle recipient selection confirmation — send photos to selected contacts
  const handleRecipientConfirm = useCallback(async (recipients: Contact[]) => {
    console.debug(LOG_PREFIX, 'Sending photos', { photos: selectedPhotos.size, recipients: recipients.length });
    setIsRecipientModalVisible(false);
    setIsSending(true);

    const photoIds = Array.from(selectedPhotos);
    const photoItems = photos.filter(p => photoIds.includes(p.id));

    let successCount = 0;
    let failCount = 0;

    try {
      // Send each photo to each recipient
      for (const photo of photoItems) {
        for (const recipient of recipients) {
          try {
            // Check if chat service is available
            if (ServiceContainer.isInitialized && chatService.isInitialized) {
              const result = await chatService.sendPhotoMessage(recipient.jid, photo.uri, {
                width: 0, // Will be read from file
                height: 0, // Will be read from file
              });

              if (result.success) {
                successCount++;
              } else {
                failCount++;
                console.error(LOG_PREFIX, 'Failed to send photo');
              }
            } else if (__DEV__) {
              // In dev mode without service, simulate success
              console.debug(LOG_PREFIX, '[DEV] Simulating photo send success');
              successCount++;
            }
          } catch (error) {
            failCount++;
            console.error(LOG_PREFIX, 'Error sending photo');
          }
        }
      }

      // Show result
      if (failCount === 0) {
        Alert.alert(
          t('modules.photoAlbum.sendSuccess', 'Photos Sent'),
          t('modules.photoAlbum.sendSuccessMessage', 'Successfully sent {{count}} photo(s) to {{recipients}} contact(s).', {
            count: photoItems.length,
            recipients: recipients.length,
          }),
          [{ text: t('common.ok', 'OK') }]
        );

        // Exit selection mode
        setSelectedPhotos(new Set());
        setIsSelectionMode(false);
      } else if (successCount > 0) {
        Alert.alert(
          t('modules.photoAlbum.sendPartial', 'Partially Sent'),
          t('modules.photoAlbum.sendPartialMessage', 'Sent {{success}} photo(s), but {{fail}} failed.', {
            success: successCount,
            fail: failCount,
          }),
          [{ text: t('common.ok', 'OK') }]
        );
      } else {
        Alert.alert(
          t('common.error', 'Error'),
          t('modules.photoAlbum.sendFailed', 'Failed to send photos. Please try again.'),
          [{ text: t('common.ok', 'OK') }]
        );
      }
    } catch (error) {
      console.error(LOG_PREFIX, 'Send photos error');
      Alert.alert(
        t('common.error', 'Error'),
        t('modules.photoAlbum.sendFailed', 'Failed to send photos. Please try again.'),
        [{ text: t('common.ok', 'OK') }]
      );
    } finally {
      setIsSending(false);
    }
  }, [selectedPhotos, photos, t]);

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
            console.debug(LOG_PREFIX, 'Deleting photos:', { count: selectedPhotos.size });

            try {
              const idsToDelete = Array.from(selectedPhotos);
              await deleteMediaBatch(idsToDelete);

              console.debug(LOG_PREFIX, 'Photos deleted');

              // Refresh list
              await loadPhotos();

              // Exit selection mode
              setSelectedPhotos(new Set());
              setIsSelectionMode(false);
            } catch (error) {
              console.error(LOG_PREFIX, 'Failed to delete photos');
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

  // Import photos from device gallery
  const handleImportFromGallery = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed',
        selectionLimit: 20,
        quality: 0.9,
      });

      if (result.didCancel || !result.assets?.length) return;

      console.debug(LOG_PREFIX, 'Importing photos', { count: result.assets.length });

      let importCount = 0;
      for (const asset of result.assets) {
        if (asset.uri) {
          const saved = await saveMedia(asset.uri, 'album', 'gallery');
          if (saved) importCount++;
        }
      }

      if (importCount > 0) {
        console.debug(LOG_PREFIX, 'Import complete', { imported: importCount });
        await loadPhotos();
      }
    } catch (error) {
      console.error(LOG_PREFIX, 'Gallery import failed');
      Alert.alert(
        t('common.error', 'Error'),
        t('modules.photoAlbum.importError', 'Could not import photos. Please try again.'),
        [{ text: t('common.ok', 'OK') }],
      );
    }
  }, [loadPhotos, t]);

  // Format storage size
  const formatStorageSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  // Render empty state with CTA buttons
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="image" size={80} color={themeColors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
        {t('modules.photoAlbum.emptyTitle', 'No photos yet')}
      </Text>
      <Text style={[styles.emptyHint, { color: themeColors.textSecondary }]}>
        {t('modules.photoAlbum.emptyHint', 'Use the Camera module to take photos.\nThey will appear here automatically.')}
      </Text>

      {/* CTA: Import from gallery */}
      <HapticTouchable
        style={[styles.emptyCtaButton, { backgroundColor: moduleColor }]}
        onPress={handleImportFromGallery}
        accessibilityRole="button"
        accessibilityLabel={t('modules.photoAlbum.importFromGallery', 'Import from gallery')}
      >
        <Icon name="download" size={24} color={themeColors.textOnPrimary} />
        <Text style={styles.emptyCtaText}>
          {t('modules.photoAlbum.importFromGallery', 'Import from gallery')}
        </Text>
      </HapticTouchable>
    </View>
  );

  // Render photo/video grid item
  const renderPhotoItem = (photo: PhotoItem) => {
    const isSelected = selectedPhotos.has(photo.id);
    const isVideo = photo.type === 'video';

    return (
      <HapticTouchable
        key={photo.id}
        style={[
          styles.photoItem,
          { width: itemSize, height: itemSize },
          isSelected && { borderColor: moduleColor, borderWidth: 3 },
        ]}
        onPress={() => handlePhotoPress(photo.id)}
        onLongPress={() => handlePhotoLongPress(photo.id)}
        longPressGuardDisabled
        accessibilityRole="button"
        accessibilityLabel={
          isSelected
            ? t('modules.photoAlbum.photoSelected', 'Photo selected')
            : isVideo
              ? t('modules.photoAlbum.video', 'Video')
              : t('modules.photoAlbum.photo', 'Photo')
        }
        accessibilityState={{ selected: isSelected }}
      >
        <Image
          source={{ uri: photo.thumbnailUri }}
          style={styles.photoThumbnail}
          resizeMode="cover"
        />

        {/* Video overlay: play icon + duration badge */}
        {isVideo && (
          <>
            <View style={styles.videoPlayOverlay}>
              <Icon name="play" size={32} color="#FFFFFF" />
            </View>
            {photo.duration != null && photo.duration > 0 && (
              <View style={styles.videoDurationBadge}>
                <Text style={styles.videoDurationText}>
                  {formatDuration(photo.duration)}
                </Text>
              </View>
            )}
          </>
        )}

        {isSelectionMode && isSelected && (
          <View style={[styles.selectionBadge, { backgroundColor: moduleColor }]}>
            <Icon name="checkmark" size={16} color={themeColors.textOnPrimary} />
          </View>
        )}
      </HapticTouchable>
    );
  };

  // Handle send from viewer — uses InteractionManager instead of setTimeout
  const handleViewerSend = useCallback(() => {
    // viewerInitialIndex maps to photoOnlyItems (viewer excludes videos)
    const photo = photoOnlyItems[viewerInitialIndex];
    if (photo) {
      setSelectedPhotos(new Set([photo.id]));
      setIsSelectionMode(true);
      handleCloseViewer();
      InteractionManager.runAfterInteractions(() => {
        loadContacts();
        setIsRecipientModalVisible(true);
      });
    }
  }, [photoOnlyItems, viewerInitialIndex, handleCloseViewer, loadContacts]);

  // Handle delete from viewer — uses InteractionManager instead of setTimeout
  const handleViewerDelete = useCallback(() => {
    const photo = photoOnlyItems[viewerInitialIndex];
    if (photo) {
      setSelectedPhotos(new Set([photo.id]));
      handleCloseViewer();
      InteractionManager.runAfterInteractions(() => {
        handleDeletePhotos();
      });
    }
  }, [photoOnlyItems, viewerInitialIndex, handleCloseViewer, handleDeletePhotos]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
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
          <HapticTouchable
            style={styles.cancelButton}
            onPress={handleToggleSelectionMode}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel', 'Cancel')}
          >
            <Icon name="x" size={24} color={themeColors.textOnPrimary} />
          </HapticTouchable>
        </View>
      )}

      {/* Storage info bar */}
      {!isSelectionMode && photoCount > 0 && (
        <View style={styles.storageBar}>
          <Icon name="image" size={16} color={themeColors.textSecondary} />
          <Text style={[styles.storageText, { color: themeColors.textSecondary }]}>
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
          dateGroups.map((group) => (
            <View key={group.label}>
              {/* Date section header */}
              <Text style={[styles.dateHeader, { color: themeColors.textPrimary }]}>
                {group.label}
              </Text>
              <View style={styles.grid}>
                {group.photos.map(renderPhotoItem)}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.actionBar, { borderTopColor: themeColors.border }]}>
        {isSelectionMode ? (
          // Selection mode actions
          <>
            <HapticTouchable
              style={[
                styles.actionButton,
                { backgroundColor: moduleColor },
                selectedPhotos.size === 0 && styles.actionButtonDisabled,
              ]}
              onPress={handleSendPhotos}
              hapticDisabled={selectedPhotos.size === 0}
              accessibilityRole="button"
              accessibilityLabel={t('modules.photoAlbum.send', 'Send')}
              disabled={selectedPhotos.size === 0}
            >
              <Icon name="chat" size={24} color={themeColors.textOnPrimary} />
              <Text style={styles.actionText}>
                {t('modules.photoAlbum.send', 'Send')}
              </Text>
            </HapticTouchable>

            <HapticTouchable
              style={[
                styles.actionButton,
                styles.deleteButton,
                selectedPhotos.size === 0 && styles.actionButtonDisabled,
              ]}
              onPress={handleDeletePhotos}
              hapticType="warning"
              hapticDisabled={selectedPhotos.size === 0}
              accessibilityRole="button"
              accessibilityLabel={t('common.delete', 'Delete')}
              disabled={selectedPhotos.size === 0}
            >
              <Icon name="trash" size={24} color={themeColors.textOnPrimary} />
              <Text style={styles.actionText}>
                {t('common.delete', 'Delete')}
              </Text>
            </HapticTouchable>
          </>
        ) : (
          // Normal mode: Select button
          <HapticTouchable
            style={[
              styles.actionButton,
              { backgroundColor: moduleColor },
              photos.length === 0 && styles.actionButtonDisabled,
            ]}
            onPress={handleToggleSelectionMode}
            hapticDisabled={photos.length === 0}
            accessibilityRole="button"
            accessibilityLabel={t('modules.photoAlbum.select', 'Select photos')}
            disabled={photos.length === 0}
          >
            <Icon name="checkmark" size={24} color={themeColors.textOnPrimary} />
            <Text style={styles.actionText}>
              {t('modules.photoAlbum.select', 'Select')}
            </Text>
          </HapticTouchable>
        )}
      </View>

      {/* Fullscreen Photo Viewer — uses shared FullscreenImageViewer component */}
      <FullscreenImageViewer
        visible={viewerVisible}
        images={viewerImages}
        initialIndex={viewerInitialIndex}
        onClose={handleCloseViewer}
        accentColor={moduleColor}
      />

      {/* Recipient Selection Modal */}
      <PhotoRecipientModal
        visible={isRecipientModalVisible}
        contacts={contacts}
        photoCount={selectedPhotos.size}
        isLoading={isLoadingContacts}
        onConfirm={handleRecipientConfirm}
        onClose={() => setIsRecipientModalVisible(false)}
        accentColor={moduleColor}
      />

      {/* Sending overlay */}
      {isSending && (
        <View style={styles.sendingOverlay}>
          <ActivityIndicator size="large" color={moduleColor} />
          <Text style={styles.sendingText}>
            {t('modules.photoAlbum.sending', 'Sending photos...')}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    color: '#FFFFFF',
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
  dateHeader: {
    ...typography.h3,
    fontWeight: '700',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  photoItem: {
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  videoDurationBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  videoDurationText: {
    ...typography.small,
    color: '#FFFFFF',
    fontWeight: '600',
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
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptyHint: {
    ...typography.body,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
  },
  emptyCtaText: {
    ...typography.button,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
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
    backgroundColor: '#D32F2F',
  },
  actionText: {
    ...typography.button,
    color: '#FFFFFF',
  },
  // Sending overlay styles
  sendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  sendingText: {
    ...typography.h3,
    color: '#FFFFFF',
  },
});

export default PhotoAlbumScreen;
