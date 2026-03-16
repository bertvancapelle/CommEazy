/**
 * PhotoAlbumScreen — Photo gallery and sharing module
 *
 * Standalone gallery module for viewing, selecting, and sharing photos.
 * All photo-related actions happen here (view, send, delete).
 *
 * Design principles (from PNA discussion):
 * - Photo Album is the ONLY place for photo actions
 * - Select 1 or more photos → Send to any number of people
 * - Clear multi-select UX for seniors
 * - Consistent with Camera (which only captures)
 *
 * @see .claude/plans/PHOTO_VIDEO_MESSAGING.md for architecture
 * @see src/services/media/ for media storage services
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  Image,
  RefreshControl,
  useWindowDimensions,
  InteractionManager,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';

import { ModuleHeader,
  ModuleScreenLayout,
  PhotoRecipientModal,
  HapticTouchable,
  FullscreenImageViewer,
  LoadingView,
  ErrorView,
  SlideshowViewer, ScrollViewWithIndicator, LiquidGlassView } from '@/components';
import type { ViewerImage, SlideshowPhoto } from '@/components';
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
import { usePhotoAlbums } from '@/hooks/usePhotoAlbums';
import type { PhotoAlbum } from '@/types/media';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[PhotoAlbumScreen]';

// Grid layout
const GRID_PADDING = spacing.sm;
const GRID_GAP = spacing.xs;
const NUM_COLUMNS = 3;

// Tab types
type AlbumTab = 'albums' | 'allPhotos' | 'received';

// Received photos metadata store
const RECEIVED_PHOTOS_KEY = '@commeazy/receivedPhotos';

interface ReceivedPhotoMeta {
  id: string;
  senderName: string;
  timestamp: number;
}

/**
 * Read received photos metadata from AsyncStorage.
 * Maps mediaId → sender/timestamp info for quick lookup.
 */
async function readReceivedMeta(): Promise<Map<string, ReceivedPhotoMeta>> {
  try {
    const raw = await AsyncStorage.getItem(RECEIVED_PHOTOS_KEY);
    if (!raw) return new Map();
    const list = JSON.parse(raw) as ReceivedPhotoMeta[];
    return new Map(list.map(item => [item.id, item]));
  } catch {
    return new Map();
  }
}

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
  /** Source of the media */
  source?: 'camera' | 'gallery' | 'received';
  /** Sender name (for received photos) */
  senderName?: string;
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

  // Tab state
  const [activeTab, setActiveTab] = useState<AlbumTab>('allPhotos');

  // Album state
  const albumHook = usePhotoAlbums();
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [isCreateAlbumModalVisible, setIsCreateAlbumModalVisible] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [isAddToAlbumModalVisible, setIsAddToAlbumModalVisible] = useState(false);
  const albumNameInputRef = useRef<TextInput>(null);

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

  // Slideshow state
  const [isSlideshowVisible, setIsSlideshowVisible] = useState(false);

  // Inline notification state (replaces Alert.alert for single-button notifications)
  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);

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

      // Read received photos metadata for source annotation
      const receivedMeta = await readReceivedMeta();

      // Build media items
      const items: PhotoItem[] = [];

      for (const file of mediaFiles) {
        const mediaId = file.name.replace(/\.(jpg|jpeg|png|mp4|mov)$/i, '');
        const uri = file.path;
        const isVideo = /\.(mp4|mov)$/i.test(file.name);

        // Get thumbnail
        const thumbnailUri = await getThumbnailUri(mediaId);

        // Check if this is a received photo
        const meta = receivedMeta.get(mediaId);

        items.push({
          id: mediaId,
          uri,
          thumbnailUri: thumbnailUri || uri,
          timestamp: meta?.timestamp || (file.mtime ? new Date(file.mtime).getTime() : Date.now()),
          size: Number(file.size) || 0,
          type: isVideo ? 'video' : 'photo',
          source: meta ? 'received' : 'camera',
          senderName: meta?.senderName,
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
        // Use mock contacts in dev mode — detect current user dynamically
        const currentUserJid = chatService.isInitialized ? chatService.getMyJid() : 'f6a7b8c9-d0e1-4f6a-3b7c-4d5e6f7a8b9c@commeazy.local';
        const { getMockContactsForDevice } = await import('@/services/mock');
        let publicKeyMap: Record<string, string> | undefined;
        try {
          const { getOtherDevicesPublicKeys } = await import('@/services/mock/testKeys');
          publicKeyMap = await getOtherDevicesPublicKeys(currentUserJid);
        } catch (keyError) {
          console.warn(LOG_PREFIX, 'Could not load test keys (libsodium not ready?), loading contacts without keys');
        }
        const deviceContacts = getMockContactsForDevice(currentUserJid, publicKeyMap);
        setContacts(deviceContacts);
        console.debug(LOG_PREFIX, 'Using test device contacts:', { count: deviceContacts.length, currentUser: currentUserJid });
      }
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to load contacts:', error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  // Handle send photos action — opens recipient modal
  const handleSendPhotos = useCallback(() => {
    if (selectedPhotos.size === 0) {
      setNotification({
        type: 'info',
        title: t('modules.photoAlbum.noSelection', 'No photos selected'),
        message: t('modules.photoAlbum.selectFirst', 'Please select one or more photos to send.'),
      });
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
        setNotification({
          type: 'success',
          title: t('modules.photoAlbum.sendSuccess', 'Photos Sent'),
          message: t('modules.photoAlbum.sendSuccessMessage', 'Successfully sent {{count}} photo(s) to {{recipients}} contact(s).', {
            count: photoItems.length,
            recipients: recipients.length,
          }),
        });

        // Exit selection mode
        setSelectedPhotos(new Set());
        setIsSelectionMode(false);
      } else if (successCount > 0) {
        setNotification({
          type: 'warning',
          title: t('modules.photoAlbum.sendPartial', 'Partially Sent'),
          message: t('modules.photoAlbum.sendPartialMessage', 'Sent {{success}} photo(s), but {{fail}} failed.', {
            success: successCount,
            fail: failCount,
          }),
        });
      } else {
        setNotification({
          type: 'error',
          title: t('common.error', 'Error'),
          message: t('modules.photoAlbum.sendFailed', 'Failed to send photos. Please try again.'),
        });
      }
    } catch (error) {
      console.error(LOG_PREFIX, 'Send photos error');
      setNotification({
        type: 'error',
        title: t('common.error', 'Error'),
        message: t('modules.photoAlbum.sendFailed', 'Failed to send photos. Please try again.'),
      });
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
              setNotification({
                type: 'error',
                title: t('common.error', 'Error'),
                message: t('modules.photoAlbum.deleteError', 'Could not delete photos. Please try again.'),
              });
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
      setNotification({
        type: 'error',
        title: t('common.error', 'Error'),
        message: t('modules.photoAlbum.importError', 'Could not import photos. Please try again.'),
      });
    }
  }, [loadPhotos, t]);

  // Active album object (when viewing an album)
  const activeAlbum = useMemo(
    () => activeAlbumId ? albumHook.albums.find(a => a.id === activeAlbumId) : null,
    [activeAlbumId, albumHook.albums],
  );

  // Photos filtered by active tab/album
  const displayPhotos = useMemo(() => {
    if (activeTab === 'albums' && activeAlbum) {
      const idSet = new Set(activeAlbum.photoIds);
      return photos.filter(p => idSet.has(p.id));
    }
    if (activeTab === 'received') {
      return photos.filter(p => p.source === 'received');
    }
    return photos;
  }, [activeTab, activeAlbum, photos]);

  // Count received photos for tab badge
  const receivedCount = useMemo(
    () => photos.filter(p => p.source === 'received').length,
    [photos],
  );

  // Date groups based on display photos
  const displayDateGroups = useMemo(
    () => groupPhotosByDate(displayPhotos, t),
    [displayPhotos, t],
  );

  // Handle tab change
  const handleTabChange = useCallback((tab: AlbumTab) => {
    setActiveTab(tab);
    setActiveAlbumId(null);
    setIsSelectionMode(false);
    setSelectedPhotos(new Set());
  }, []);

  // Handle opening an album
  const handleOpenAlbum = useCallback((albumId: string) => {
    setActiveAlbumId(albumId);
    setIsSelectionMode(false);
    setSelectedPhotos(new Set());
  }, []);

  // Handle going back from album detail to album list
  const handleBackToAlbums = useCallback(() => {
    setActiveAlbumId(null);
    setIsSelectionMode(false);
    setSelectedPhotos(new Set());
  }, []);

  // Handle create album
  const handleCreateAlbum = useCallback(async () => {
    const name = newAlbumName.trim();
    if (!name) return;

    const album = await albumHook.create(name);
    if (album) {
      console.debug(LOG_PREFIX, 'Album created');
      setIsCreateAlbumModalVisible(false);
      setNewAlbumName('');
      setActiveTab('albums');
      setActiveAlbumId(album.id);
    }
  }, [newAlbumName, albumHook]);

  // Handle rename album
  const handleRenameAlbum = useCallback((albumId: string, currentName: string) => {
    Alert.prompt(
      t('modules.photoAlbum.renameAlbum', 'Rename album'),
      '',
      async (text: string) => {
        if (text?.trim()) {
          await albumHook.rename(albumId, text);
        }
      },
      'plain-text',
      currentName,
    );
  }, [albumHook, t]);

  // Handle delete album
  const handleDeleteAlbum = useCallback((albumId: string) => {
    Alert.alert(
      t('modules.photoAlbum.deleteAlbum', 'Delete album'),
      t('modules.photoAlbum.deleteAlbumConfirm', 'Delete album? Photos will be kept.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            const success = await albumHook.remove(albumId);
            if (success && activeAlbumId === albumId) {
              setActiveAlbumId(null);
            }
          },
        },
      ],
    );
  }, [albumHook, activeAlbumId, t]);

  // Handle "Add to album" from selection mode
  const handleAddToAlbumPress = useCallback(() => {
    if (selectedPhotos.size === 0) return;
    setIsAddToAlbumModalVisible(true);
  }, [selectedPhotos]);

  // Handle selecting an album to add photos to
  const handleAddToAlbumSelect = useCallback(async (albumId: string) => {
    const ids = Array.from(selectedPhotos);
    const success = await albumHook.addPhotos(albumId, ids);
    if (success) {
      setIsAddToAlbumModalVisible(false);
      setIsSelectionMode(false);
      setSelectedPhotos(new Set());
      setNotification({
        type: 'success',
        title: t('modules.photoAlbum.addedToAlbum', 'Added to album'),
        message: t('modules.photoAlbum.addedToAlbumMessage', '{{count}} photo(s) added to album.', { count: ids.length }),
      });
    }
  }, [selectedPhotos, albumHook, t]);

  // Handle creating a new album from the "Add to album" modal
  const handleCreateAndAddToAlbum = useCallback(async (name: string) => {
    const ids = Array.from(selectedPhotos);
    const album = await albumHook.create(name, ids);
    if (album) {
      setIsAddToAlbumModalVisible(false);
      setIsSelectionMode(false);
      setSelectedPhotos(new Set());
    }
  }, [selectedPhotos, albumHook]);

  // Handle removing photos from current album
  const handleRemoveFromAlbum = useCallback(async () => {
    if (!activeAlbumId || selectedPhotos.size === 0) return;

    const ids = Array.from(selectedPhotos);
    const success = await albumHook.removePhotos(activeAlbumId, ids);
    if (success) {
      setIsSelectionMode(false);
      setSelectedPhotos(new Set());
    }
  }, [activeAlbumId, selectedPhotos, albumHook]);

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

  // Render album card
  const renderAlbumCard = (album: PhotoAlbum) => {
    // Find cover photo URI
    const coverPhoto = album.coverPhotoId
      ? photos.find(p => p.id === album.coverPhotoId)
      : album.photoIds.length > 0
        ? photos.find(p => p.id === album.photoIds[0])
        : null;

    return (
      <HapticTouchable
        key={album.id}
        style={[
          styles.albumCard,
          { width: itemSize, backgroundColor: themeColors.surface, borderColor: themeColors.border },
        ]}
        onPress={() => handleOpenAlbum(album.id)}
        onLongPress={() => {
          Alert.alert(
            album.name,
            '',
            [
              {
                text: t('modules.photoAlbum.renameAlbum', 'Rename'),
                onPress: () => handleRenameAlbum(album.id, album.name),
              },
              {
                text: t('modules.photoAlbum.deleteAlbum', 'Delete album'),
                style: 'destructive',
                onPress: () => handleDeleteAlbum(album.id),
              },
              { text: t('common.cancel', 'Cancel'), style: 'cancel' },
            ],
          );
        }}
        longPressGuardDisabled
        accessibilityRole="button"
        accessibilityLabel={`${album.name}, ${album.photoIds.length} ${t('modules.photoAlbum.photoCount', '{{count}} photos', { count: album.photoIds.length })}`}
      >
        {/* Cover image or placeholder */}
        <View style={[styles.albumCover, { height: itemSize * 0.75 }]}>
          {coverPhoto ? (
            <Image
              source={{ uri: coverPhoto.thumbnailUri }}
              style={styles.albumCoverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.albumCoverPlaceholder, { backgroundColor: themeColors.backgroundSecondary }]}>
              <Icon name="image" size={32} color={themeColors.textSecondary} />
            </View>
          )}
        </View>
        {/* Album info */}
        <View style={styles.albumInfo}>
          <Text style={[styles.albumName, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {album.name}
          </Text>
          <Text style={[styles.albumPhotoCount, { color: themeColors.textSecondary }]}>
            {t('modules.photoAlbum.photoCount', '{{count}} photos', { count: album.photoIds.length })}
          </Text>
        </View>
      </HapticTouchable>
    );
  };

  // Render "New album" card
  const renderNewAlbumCard = () => (
    <HapticTouchable
      key="new-album"
      style={[
        styles.albumCard,
        styles.newAlbumCard,
        { width: itemSize, borderColor: themeColors.border },
      ]}
      onPress={() => {
        setNewAlbumName('');
        setIsCreateAlbumModalVisible(true);
      }}
      accessibilityRole="button"
      accessibilityLabel={t('modules.photoAlbum.newAlbum', 'New album')}
    >
      <View style={[styles.albumCover, styles.newAlbumCover, { height: itemSize * 0.75, backgroundColor: themeColors.backgroundSecondary }]}>
        <Icon name="plus" size={40} color={moduleColor} />
      </View>
      <View style={styles.albumInfo}>
        <Text style={[styles.albumName, { color: moduleColor }]}>
          {t('modules.photoAlbum.newAlbum', 'New album')}
        </Text>
      </View>
    </HapticTouchable>
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

        {/* Sender name badge for received photos */}
        {photo.source === 'received' && photo.senderName && activeTab === 'received' && (
          <View style={styles.senderBadge}>
            <Text style={styles.senderBadgeText} numberOfLines={1}>
              {photo.senderName}
            </Text>
          </View>
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

  // Whether we're showing photos (all photos tab, album detail, or received tab)
  const isShowingPhotos = activeTab === 'allPhotos' || activeTab === 'received' || (activeTab === 'albums' && activeAlbumId != null);

  // Photos suitable for slideshow (only photos, not videos)
  const slideshowPhotos: SlideshowPhoto[] = useMemo(
    () => displayPhotos
      .filter(p => p.type === 'photo')
      .map(p => ({ id: p.id, uri: p.uri, timestamp: p.timestamp })),
    [displayPhotos],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {notification && (
        <ErrorView
          type={notification.type}
          title={notification.title}
          message={notification.message}
          autoDismiss={notification.type === 'success' || notification.type === 'info' ? 3000 : undefined}
          onDismiss={() => setNotification(null)}
        />
      )}
      <ModuleScreenLayout
        moduleId="photoAlbum"
        moduleBlock={
          <ModuleHeader
            moduleId="photoAlbum"
            icon="image"
            title={t('navigation.photoAlbum', 'Photo Album')}
            skipSafeArea
          />
        }
        controlsBlock={
          <>
            {/* Album detail header (back button + album name) */}
            {activeTab === 'albums' && activeAlbum && !isSelectionMode && (
              <View style={[styles.albumDetailHeader, { borderBottomColor: themeColors.border }]}>
                <HapticTouchable
                  style={styles.backButton}
                  onPress={handleBackToAlbums}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.back', 'Back')}
                >
                  <Icon name="chevron-left" size={24} color={themeColors.textPrimary} />
                </HapticTouchable>
                <Text style={[styles.albumDetailTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {activeAlbum.name}
                </Text>
                <HapticTouchable
                  style={styles.albumDetailAction}
                  onPress={() => {
                    Alert.alert(
                      activeAlbum.name,
                      '',
                      [
                        {
                          text: t('modules.photoAlbum.renameAlbum', 'Rename'),
                          onPress: () => handleRenameAlbum(activeAlbum.id, activeAlbum.name),
                        },
                        {
                          text: t('modules.photoAlbum.deleteAlbum', 'Delete album'),
                          style: 'destructive',
                          onPress: () => handleDeleteAlbum(activeAlbum.id),
                        },
                        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                      ],
                    );
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.options', 'Options')}
                >
                  <Icon name="settings" size={24} color={themeColors.textSecondary} />
                </HapticTouchable>
              </View>
            )}

            {/* Tab Bar — only when not in album detail or selection mode */}
            {!activeAlbumId && !isSelectionMode && (
              <View style={[styles.tabBar, { borderBottomColor: themeColors.border }]}>
                <HapticTouchable
                  style={[
                    styles.tab,
                    activeTab === 'albums' && [styles.tabActive, { borderBottomColor: moduleColor }],
                  ]}
                  onPress={() => handleTabChange('albums')}
                  accessibilityRole="tab"
                  accessibilityLabel={t('modules.photoAlbum.albums', 'Albums')}
                  accessibilityState={{ selected: activeTab === 'albums' }}
                >
                  <Icon name="folder" size={20} color={activeTab === 'albums' ? moduleColor : themeColors.textSecondary} />
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'albums' ? moduleColor : themeColors.textSecondary },
                    activeTab === 'albums' && styles.tabTextActive,
                  ]}>
                    {t('modules.photoAlbum.albums', 'Albums')}
                  </Text>
                </HapticTouchable>

                <HapticTouchable
                  style={[
                    styles.tab,
                    activeTab === 'allPhotos' && [styles.tabActive, { borderBottomColor: moduleColor }],
                  ]}
                  onPress={() => handleTabChange('allPhotos')}
                  accessibilityRole="tab"
                  accessibilityLabel={t('modules.photoAlbum.allPhotos', 'All photos')}
                  accessibilityState={{ selected: activeTab === 'allPhotos' }}
                >
                  <Icon name="image" size={20} color={activeTab === 'allPhotos' ? moduleColor : themeColors.textSecondary} />
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'allPhotos' ? moduleColor : themeColors.textSecondary },
                    activeTab === 'allPhotos' && styles.tabTextActive,
                  ]}>
                    {t('modules.photoAlbum.allPhotos', 'All photos')}
                  </Text>
                </HapticTouchable>

                <HapticTouchable
                  style={[
                    styles.tab,
                    activeTab === 'received' && [styles.tabActive, { borderBottomColor: moduleColor }],
                  ]}
                  onPress={() => handleTabChange('received')}
                  accessibilityRole="tab"
                  accessibilityLabel={t('modules.photoAlbum.received', 'Received')}
                  accessibilityState={{ selected: activeTab === 'received' }}
                >
                  <Icon name="download" size={20} color={activeTab === 'received' ? moduleColor : themeColors.textSecondary} />
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'received' ? moduleColor : themeColors.textSecondary },
                    activeTab === 'received' && styles.tabTextActive,
                  ]}>
                    {t('modules.photoAlbum.received', 'Received')}
                    {receivedCount > 0 ? ` (${receivedCount})` : ''}
                  </Text>
                </HapticTouchable>
              </View>
            )}

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
                  accessibilityLabel={t('common.cancel')}
                >
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </HapticTouchable>
              </View>
            )}

            {/* Storage info bar — only in all photos view */}
            {!isSelectionMode && activeTab === 'allPhotos' && photoCount > 0 && (
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
          </>
        }
        contentBlock={
          <>
            {/* Content area */}
            <ScrollViewWithIndicator
        style={styles.gridContainer}
        contentContainerStyle={[
          styles.gridContent,
          !isShowingPhotos && albumHook.albums.length === 0 && styles.gridContentEmpty,
          isShowingPhotos && displayPhotos.length === 0 && styles.gridContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={moduleColor}
          />
        }
      >
        {activeTab === 'albums' && !activeAlbumId ? (
          /* Albums grid view */
          <View style={styles.grid}>
            {albumHook.albums.map(renderAlbumCard)}
            {renderNewAlbumCard()}
          </View>
        ) : activeTab === 'received' && displayPhotos.length === 0 && !isLoading ? (
          /* Received photos empty state */
          <View style={styles.emptyState}>
            <Icon name="download" size={80} color={themeColors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
              {t('modules.photoAlbum.noReceivedPhotos', 'No received photos')}
            </Text>
            <Text style={[styles.emptyHint, { color: themeColors.textSecondary }]}>
              {t('modules.photoAlbum.noReceivedPhotosHint', 'Photos sent to you via chat will appear here.')}
            </Text>
          </View>
        ) : isShowingPhotos && displayPhotos.length === 0 && !isLoading ? (
          renderEmptyState()
        ) : (
          displayDateGroups.map((group) => (
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
      </ScrollViewWithIndicator>

      {/* Bottom Action Bar */}
      {isShowingPhotos && (
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

              {/* Add to Album button */}
              <HapticTouchable
                style={[
                  styles.actionButton,
                  { backgroundColor: themeColors.surface, borderWidth: 1, borderColor: moduleColor },
                  selectedPhotos.size === 0 && styles.actionButtonDisabled,
                ]}
                onPress={handleAddToAlbumPress}
                hapticDisabled={selectedPhotos.size === 0}
                accessibilityRole="button"
                accessibilityLabel={t('modules.photoAlbum.addToAlbum', 'Add to album')}
                disabled={selectedPhotos.size === 0}
              >
                <Icon name="folder" size={24} color={moduleColor} />
                <Text style={[styles.actionText, { color: moduleColor }]}>
                  {t('modules.photoAlbum.addToAlbum', 'Album')}
                </Text>
              </HapticTouchable>

              {/* Remove from album (only when inside an album) */}
              {activeAlbumId ? (
                <HapticTouchable
                  style={[
                    styles.actionButton,
                    styles.deleteButton,
                    selectedPhotos.size === 0 && styles.actionButtonDisabled,
                  ]}
                  onPress={handleRemoveFromAlbum}
                  hapticType="warning"
                  hapticDisabled={selectedPhotos.size === 0}
                  accessibilityRole="button"
                  accessibilityLabel={t('modules.photoAlbum.removeFromAlbum', 'Remove from album')}
                  disabled={selectedPhotos.size === 0}
                >
                  <Icon name="x" size={24} color={themeColors.textOnPrimary} />
                </HapticTouchable>
              ) : (
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
                </HapticTouchable>
              )}
            </>
          ) : (
            // Normal mode: Slideshow + Select buttons
            <>
              {/* Slideshow button — only when there are photos (not videos) */}
              <HapticTouchable
                style={[
                  styles.actionButton,
                  { backgroundColor: themeColors.surface, borderWidth: 1, borderColor: moduleColor },
                  slideshowPhotos.length === 0 && styles.actionButtonDisabled,
                ]}
                onPress={() => setIsSlideshowVisible(true)}
                hapticDisabled={slideshowPhotos.length === 0}
                accessibilityRole="button"
                accessibilityLabel={t('modules.photoAlbum.slideshowStart', 'Start slideshow')}
                disabled={slideshowPhotos.length === 0}
              >
                <Icon name="play" size={24} color={moduleColor} />
                <Text style={[styles.actionText, { color: moduleColor }]}>
                  {t('modules.photoAlbum.slideshow', 'Slideshow')}
                </Text>
              </HapticTouchable>

              <HapticTouchable
                style={[
                  styles.actionButton,
                  { backgroundColor: moduleColor },
                  displayPhotos.length === 0 && styles.actionButtonDisabled,
                ]}
                onPress={handleToggleSelectionMode}
                hapticDisabled={displayPhotos.length === 0}
                accessibilityRole="button"
                accessibilityLabel={t('modules.photoAlbum.select', 'Select photos')}
                disabled={displayPhotos.length === 0}
              >
                <Icon name="checkmark" size={24} color={themeColors.textOnPrimary} />
                <Text style={styles.actionText}>
                  {t('modules.photoAlbum.select', 'Select')}
                </Text>
              </HapticTouchable>
            </>
          )}
        </View>
      )}

      {/* Fullscreen Photo Viewer */}
      <FullscreenImageViewer
        visible={viewerVisible}
        images={viewerImages}
        initialIndex={viewerInitialIndex}
        onClose={handleCloseViewer}
        accentColor={moduleColor}
      />

      {/* Slideshow (Fotolijst) */}
      <SlideshowViewer
        visible={isSlideshowVisible}
        photos={slideshowPhotos}
        onClose={() => setIsSlideshowVisible(false)}
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

      {/* Create Album Modal */}
      <Modal
        visible={isCreateAlbumModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsCreateAlbumModalVisible(false)}
        onShow={() => {
          // Focus the text input after modal animation
          setTimeout(() => albumNameInputRef.current?.focus(), 300);
        }}
        accessibilityViewIsModal
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <LiquidGlassView moduleId="photoAlbum" style={{ flex: 1 }} cornerRadius={0}>
          {/* Modal header */}
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
            <HapticTouchable
              style={[styles.modalCloseButton, { backgroundColor: moduleColor }]}
              onPress={() => setIsCreateAlbumModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.modalCloseButtonText}>{t('common.close')}</Text>
            </HapticTouchable>
            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
              {t('modules.photoAlbum.newAlbum', 'New album')}
            </Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          {/* Album name input */}
          <View style={styles.modalContent}>
            <Text style={[styles.modalLabel, { color: themeColors.textPrimary }]}>
              {t('modules.photoAlbum.albumName', 'Album name')}
            </Text>
            <TextInput
              ref={albumNameInputRef}
              style={[
                styles.modalInput,
                {
                  color: themeColors.textPrimary,
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                },
              ]}
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              placeholder={t('modules.photoAlbum.albumNamePlaceholder', 'e.g. Vacation, Family...')}
              placeholderTextColor={themeColors.textSecondary}
              maxLength={50}
              returnKeyType="done"
              onSubmitEditing={handleCreateAlbum}
              autoCapitalize="sentences"
            />

            <HapticTouchable
              style={[
                styles.modalCreateButton,
                { backgroundColor: moduleColor },
                !newAlbumName.trim() && styles.actionButtonDisabled,
              ]}
              onPress={handleCreateAlbum}
              disabled={!newAlbumName.trim()}
              hapticDisabled={!newAlbumName.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('modules.photoAlbum.createAlbum', 'Create album')}
            >
              <Icon name="plus" size={24} color={themeColors.textOnPrimary} />
              <Text style={styles.actionText}>
                {t('modules.photoAlbum.createAlbum', 'Create album')}
              </Text>
            </HapticTouchable>
          </View>
          </LiquidGlassView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add to Album Modal */}
      <Modal
        visible={isAddToAlbumModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsAddToAlbumModalVisible(false)}
        accessibilityViewIsModal
      >
        <LiquidGlassView moduleId="photoAlbum" style={[styles.modalContainer]} cornerRadius={0}>
          {/* Modal header */}
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
            <HapticTouchable
              style={[styles.modalCloseButton, { backgroundColor: moduleColor }]}
              onPress={() => setIsAddToAlbumModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.modalCloseButtonText}>{t('common.close')}</Text>
            </HapticTouchable>
            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
              {t('modules.photoAlbum.addToAlbum', 'Add to album')}
            </Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          {/* Album list */}
          <ScrollViewWithIndicator style={styles.modalContent}>
            {/* New album option */}
            <HapticTouchable
              style={[styles.addToAlbumRow, { borderColor: themeColors.border }]}
              onPress={() => {
                setIsAddToAlbumModalVisible(false);
                setNewAlbumName('');
                setIsCreateAlbumModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('modules.photoAlbum.newAlbum', 'New album')}
            >
              <View style={[styles.addToAlbumIcon, { backgroundColor: moduleColor }]}>
                <Icon name="plus" size={24} color={themeColors.textOnPrimary} />
              </View>
              <Text style={[styles.addToAlbumName, { color: moduleColor }]}>
                {t('modules.photoAlbum.newAlbum', 'New album')}
              </Text>
            </HapticTouchable>

            {/* Existing albums */}
            {albumHook.albums.map((album) => {
              const coverPhoto = album.coverPhotoId
                ? photos.find(p => p.id === album.coverPhotoId)
                : album.photoIds.length > 0
                  ? photos.find(p => p.id === album.photoIds[0])
                  : null;

              return (
                <HapticTouchable
                  key={album.id}
                  style={[styles.addToAlbumRow, { borderColor: themeColors.border }]}
                  onPress={() => handleAddToAlbumSelect(album.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${album.name}, ${album.photoIds.length} ${t('modules.photoAlbum.photoCount', '{{count}} photos', { count: album.photoIds.length })}`}
                >
                  {coverPhoto ? (
                    <Image
                      source={{ uri: coverPhoto.thumbnailUri }}
                      style={styles.addToAlbumThumb}
                    />
                  ) : (
                    <View style={[styles.addToAlbumIcon, { backgroundColor: themeColors.backgroundSecondary }]}>
                      <Icon name="image" size={24} color={themeColors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.addToAlbumInfo}>
                    <Text style={[styles.addToAlbumName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                      {album.name}
                    </Text>
                    <Text style={[styles.addToAlbumCount, { color: themeColors.textSecondary }]}>
                      {t('modules.photoAlbum.photoCount', '{{count}} photos', { count: album.photoIds.length })}
                    </Text>
                  </View>
                </HapticTouchable>
              );
            })}
          </ScrollViewWithIndicator>
        </LiquidGlassView>
      </Modal>

            {/* Sending overlay */}
            {isSending && (
              <View style={styles.sendingOverlay}>
                <LoadingView message={t('modules.photoAlbum.sending', 'Sending photos...')} />
              </View>
            )}
          </>
        }
      />
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
    height: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,
  },
  cancelButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
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
  senderBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  senderBadgeText: {
    ...typography.small,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
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
    backgroundColor: colors.error,
  },
  actionText: {
    ...typography.button,
    color: '#FFFFFF',
  },
  // Tab bar styles
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    minHeight: touchTargets.minimum,
  },
  tabActive: {
    // borderBottomColor set inline
  },
  tabText: {
    ...typography.body,
  },
  tabTextActive: {
    fontWeight: '700',
  },
  // Album detail header
  albumDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    minHeight: touchTargets.minimum,
  },
  backButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumDetailTitle: {
    ...typography.h3,
    fontWeight: '700',
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  albumDetailAction: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Album card styles
  albumCard: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  newAlbumCard: {
    borderStyle: 'dashed',
  },
  albumCover: {
    width: '100%',
    overflow: 'hidden',
  },
  albumCoverImage: {
    width: '100%',
    height: '100%',
  },
  albumCoverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newAlbumCover: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumInfo: {
    padding: spacing.sm,
  },
  albumName: {
    ...typography.label,
    fontWeight: '700',
  },
  albumPhotoCount: {
    ...typography.small,
    marginTop: 2,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  modalCloseButton: {
    height: touchTargets.minimum,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  modalCloseButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  modalTitle: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  modalHeaderSpacer: {
    width: touchTargets.minimum,
  },
  modalContent: {
    padding: spacing.lg,
  },
  modalLabel: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  modalInput: {
    ...typography.body,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
  },
  modalCreateButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    minHeight: touchTargets.comfortable,
  },
  // Add to Album modal list
  addToAlbumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    minHeight: touchTargets.comfortable,
  },
  addToAlbumIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToAlbumThumb: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
  },
  addToAlbumInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  addToAlbumName: {
    ...typography.body,
    fontWeight: '600',
  },
  addToAlbumCount: {
    ...typography.small,
    marginTop: 2,
  },
  // Sending overlay styles
  sendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
});

export default PhotoAlbumScreen;
