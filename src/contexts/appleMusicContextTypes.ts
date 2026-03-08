/**
 * AppleMusicContext Types & Helpers
 *
 * Extracted from AppleMusicContext for better separation of concerns.
 *
 * Contains:
 * - All type definitions (song, album, artist, playlist, playback state, etc.)
 * - Context value interface
 * - Constants (storage keys, limits)
 */

// ============================================================
// Types
// ============================================================

export type AppleMusicAuthStatus =
  | 'authorized'        // iOS: MusicKit authorized
  | 'denied'            // iOS: MusicKit denied
  | 'notDetermined'     // iOS: Not yet requested
  | 'restricted'        // iOS: Restricted (parental controls)
  | 'app_installed'     // Android: Apple Music app is installed
  | 'app_not_installed' // Android: Apple Music app not installed
  | 'unavailable';      // Module not available

export type ShuffleMode = 'off' | 'songs';
export type RepeatMode = 'off' | 'one' | 'all';

export interface AppleMusicSong {
  id: string;
  title: string;
  artistName: string;
  albumTitle: string;
  duration: number;       // seconds
  artworkUrl: string;
  trackNumber: number;
  discNumber: number;
  isExplicit: boolean;
}

export interface AppleMusicAlbum {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string;
  trackCount: number;
  releaseDate: string;
  isExplicit: boolean;
}

export interface AppleMusicArtist {
  id: string;
  name: string;
  artworkUrl: string;
}

export interface AppleMusicPlaylist {
  id: string;
  name: string;
  curatorName: string;
  artworkUrl: string;
  description: string;
  trackCount?: number;
}

export interface AppleMusicGenre {
  id: string;
  name: string;
}

export interface SearchResults {
  songs?: AppleMusicSong[];
  albums?: AppleMusicAlbum[];
  artists?: AppleMusicArtist[];
  playlists?: AppleMusicPlaylist[];
}

// Detail response types (for detail screens)
export interface AlbumDetails extends AppleMusicAlbum {
  tracks: AppleMusicSong[];
  artists?: AppleMusicArtist[];
}

export interface ArtistDetails extends AppleMusicArtist {
  topSongs: AppleMusicSong[];
  albums: AppleMusicAlbum[];
}

export interface PlaylistDetails extends AppleMusicPlaylist {
  tracks: AppleMusicSong[];
}

// Library pagination response
export interface LibraryPaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

// Library counts response
export interface LibraryCounts {
  songs: number;
  albums: number;
  artists: number;
  playlists: number;
}

export interface PlaybackState {
  status: 'playing' | 'paused' | 'stopped' | 'interrupted' | 'seekingForward' | 'seekingBackward' | 'unknown';
  playbackTime: number;
  currentTime: number;  // Alias for playbackTime
  duration: number;     // Current song duration in seconds
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
}

export interface Subscription {
  canPlayCatalogContent: boolean;
  hasCloudLibraryEnabled: boolean;
}

export interface PlatformCapabilities {
  platform: 'ios' | 'android';
  hasMusicKit: boolean;       // Full MusicKit (iOS only)
  canSearch: boolean;         // Search Apple Music catalog
  canPlayback: boolean;       // Control playback
  canDeepLink: boolean;       // Open content in Apple Music app
  appInstalled: boolean;      // Apple Music app installed (Android)
}

// Recently played item (container API returns albums/playlists/stations; song fallback returns songs)
export interface RecentlyPlayedItem {
  type: 'album' | 'playlist' | 'station' | 'song';
  id: string;
  title: string;
  subtitle: string;    // artist name or curator name
  artworkUrl: string;
  trackCount?: number; // Number of tracks (albums)
  playedAt: number;    // timestamp (ms)
  source?: 'musickit' | 'local'; // Where this item came from
}

export interface AppleMusicContextValue {
  // Platform info
  isIOS: boolean;
  isAndroid: boolean;
  capabilities: PlatformCapabilities | null;

  // Authorization
  authStatus: AppleMusicAuthStatus;
  isAuthorized: boolean;
  requestAuthorization: () => Promise<AppleMusicAuthStatus>;

  // Subscription (iOS only)
  subscription: Subscription | null;
  checkSubscription: () => Promise<Subscription | null>;

  // Search (iOS only)
  searchCatalog: (query: string, types?: string[], limit?: number) => Promise<SearchResults>;
  getTopCharts: (types?: string[], limit?: number) => Promise<SearchResults>;

  // Content Details (iOS only, for detail screens)
  getAlbumDetails: (albumId: string) => Promise<AlbumDetails>;
  getArtistDetails: (artistId: string) => Promise<ArtistDetails>;
  getPlaylistDetails: (playlistId: string) => Promise<PlaylistDetails>;

  // Library Management (iOS only)
  addToLibrary: (songId: string) => Promise<boolean>;
  isInLibrary: (songId: string) => Promise<boolean>;
  removeFromLibrary: (songId: string) => Promise<void>;

  // Library Content Retrieval (iOS only)
  getLibrarySongs: (limit?: number, offset?: number) => Promise<LibraryPaginatedResponse<AppleMusicSong>>;
  getLibraryAlbums: (limit?: number, offset?: number) => Promise<LibraryPaginatedResponse<AppleMusicAlbum>>;
  getLibraryArtists: (limit?: number, offset?: number) => Promise<LibraryPaginatedResponse<AppleMusicArtist>>;
  getLibraryPlaylists: (limit?: number, offset?: number) => Promise<LibraryPaginatedResponse<AppleMusicPlaylist>>;
  getLibraryCounts: () => Promise<LibraryCounts>;

  // Playback (iOS only)
  playbackState: PlaybackState | null;
  nowPlaying: AppleMusicSong | null;
  /** Effective artwork URL (prefers search result URL over MusicKit queue URL) */
  effectiveArtworkUrl: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  /** Play a song - optionally pass artworkUrl from search results for reliable artwork display */
  playSong: (songId: string, artworkUrl?: string) => Promise<void>;
  playAlbum: (albumId: string, startIndex?: number) => Promise<void>;
  playPlaylist: (playlistId: string, startIndex?: number) => Promise<void>;
  playStation: (stationId: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  /** Toggle playback - uses native state to avoid race conditions */
  togglePlayback: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;

  // Shuffle & Repeat (iOS only)
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
  setShuffleMode: (mode: ShuffleMode) => Promise<void>;
  setRepeatMode: (mode: RepeatMode) => Promise<void>;

  // Queue (iOS only)
  queue: AppleMusicSong[];
  addToQueue: (songId: string, position?: 'next' | 'last') => Promise<void>;

  // Sleep timer
  sleepTimerActive: boolean;
  setSleepTimerActive: (active: boolean) => void;

  // Android-specific
  openPlayStore: () => Promise<void>;
  openAppleMusicApp: () => Promise<void>;
  openContent: (type: 'song' | 'album' | 'playlist' | 'artist', id: string) => Promise<void>;

  // Discovery: Recently Played (locally tracked)
  recentlyPlayed: RecentlyPlayedItem[];
  isRecentlyPlayedLoading: boolean;

  // Discovery: Top Charts
  topCharts: SearchResults | null;
  isTopChartsLoading: boolean;
  loadTopCharts: () => Promise<void>;

  // Discovery: Genres
  genres: AppleMusicGenre[];
  isGenresLoading: boolean;
  loadGenres: () => Promise<void>;
  getTopChartsByGenre: (genreId: string, types?: string[], limit?: number) => Promise<SearchResults>;

  // Player visibility
  showPlayer: boolean;
  setShowPlayer: (show: boolean) => void;
}

// ============================================================
// Constants
// ============================================================

export const RECENTLY_PLAYED_STORAGE_KEY = '@commeazy/apple-music-recently-played';
export const RECENTLY_PLAYED_MAX_ITEMS = 20;

