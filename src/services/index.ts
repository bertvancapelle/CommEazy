/**
 * Services — Central export for all service modules
 *
 * Import from '@/services' instead of individual files for consistency.
 *
 * Services are organized by domain:
 * - Core: Container, interfaces, encryption, database
 * - Communication: Chat, group chat, XMPP, notifications
 * - Media: Podcast, books, TTS, artwork
 * - Device: Device linking, image handling
 * - External APIs: Weather, news, radar
 */

// ============================================================
// Core Services
// ============================================================

export { ServiceContainer } from './container';
export type {
  Contact,
  Message,
  MessageStatus,
  PresenceShow,
  PresenceStatus,
  Group,
  GroupMember,
  DeviceInfo,
  DatabaseService,
  EncryptionService,
  XMPPService,
  NotificationService,
  CallService,
  SupportedLanguage,
} from './interfaces';

// ============================================================
// Communication Services
// ============================================================

export { chatService } from './chat';
export { groupChatService } from './groupChat';
export { notificationService } from './notifications';

// ============================================================
// Call Services
// ============================================================

export { callService } from './call';
export type { ActiveCall, CallType, CallState, CallParticipant } from './call';

// ============================================================
// Media Services
// ============================================================

// Podcast
export {
  searchPodcasts,
  getPodcastEpisodes,
  initializePodcastCache,
} from './podcastService';
export type { PodcastShow, PodcastEpisode, PodcastSearchResult } from './podcastService';

// Books (Gutenberg)
export {
  searchGutenbergBooks,
  getGutenbergBook,
  downloadBook,
} from './gutenbergService';
export type { GutenbergBook, GutenbergSearchResult } from './gutenbergService';

// Books storage & cache
export { booksStorageService } from './booksStorageService';
export { booksCacheService } from './booksCacheService';

// TTS
export { ttsService } from './ttsService';
export { piperTtsService } from './piperTtsService';

// Artwork
export { artworkService, getArtworkUrl, validateArtwork } from './artworkService';

// ============================================================
// Device Services
// ============================================================

export { deviceLinkService } from './deviceLink';
export {
  pickImage,
  takePicture,
  saveAvatar,
  getAvatarPath,
  deleteAvatar,
} from './imageService';

// ============================================================
// External API Services
// ============================================================

// Weather
export { weatherService, type WeatherData, type HourlyForecast, type DailyForecast } from './weatherService';

// News
export { newsService, type NewsArticle, type NewsCategory } from './newsService';

// Radar (rain/weather)
export { radarService, type RadarFrame, type RadarConfig } from './radarService';
export { rainViewerService } from './rainViewerService';

// ============================================================
// Module Management
// ============================================================

export { moduleUsageService } from './moduleUsageService';

// ============================================================
// Glass Player (iOS 26+)
// ============================================================

export {
  glassPlayerService,
  type GlassPlayerPlaybackState,
  type GlassPlayerConfig,
} from './glassPlayer';
