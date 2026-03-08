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
  addFavoritesBatch,
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
  // Playlist Import
  createCollectionFromPlaylist,
  getCollectionByPlaylistId,
} from './musicCollectionService';
export type { MusicCollection } from './musicCollectionService';

// Playlist Import
export {
  importSinglePlaylist,
} from './playlistImportService';
export type {
  PlaylistImportProgress,
  PlaylistImportResult,
} from './playlistImportService';
