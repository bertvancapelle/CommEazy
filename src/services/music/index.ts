/**
 * Music Services — Central export for music favorites and collections
 *
 * Import from '@/services/music' for consistency.
 */

// Music Favorites CRUD
export {
  getFavorites,
  isFavorite,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  getFavoritesCount,
  removeFavoriteFromAll,
  getFavoriteIds,
} from './musicFavoritesService';
export type { MusicFavorite } from './musicFavoritesService';

// Music Collections CRUD
export {
  getCollections,
  getCollectionById,
  createCollection,
  renameCollection,
  deleteCollection,
  addSongsToCollection,
  removeSongsFromCollection,
  removeSongFromAllCollections,
  getCollectionsForSong,
  // Playlist Import & Sync
  createCollectionFromPlaylist,
  getLinkedCollections,
  getCollectionByPlaylistId,
  syncCollection,
  deleteAllLinkedCollections,
  getLastSyncTimestamp,
} from './musicCollectionService';
export type { MusicCollection } from './musicCollectionService';

// Playlist Import & Sync
export {
  isImportDone,
  markImportDone,
  resetImportStatus,
  importAllPlaylists,
  syncAllLinkedCollections,
} from './playlistImportService';
export type {
  PlaylistImportProgress,
  PlaylistImportResult,
} from './playlistImportService';
