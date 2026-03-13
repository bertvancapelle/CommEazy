/**
 * Hooks — Central export for all custom React hooks
 *
 * Import from '@/hooks' instead of individual files for consistency.
 */

// User preferences
export { useAccentColor } from './useAccentColor';
export {
  useFeedback,
  type HapticIntensity,
  type FeedbackType,
  type FeedbackSettings,
  DEFAULT_FEEDBACK_SETTINGS,
} from './useFeedback';
// TTS & Voice
export {
  useTtsSettings,
  TTS_SPEED_OPTIONS,
  type TtsSpeechRate,
} from './useTtsSettings';
export { useArticleTTS, type UseArticleTTSReturn } from './useArticleTTS';
export { useVoiceCommands } from './useVoiceCommands';

// Device & Platform
export { useDeviceType } from './useDeviceType';
export { useReducedMotion } from './useReducedMotion';
export { useLiquidGlass } from './useLiquidGlass';
export { useGlassPlayer } from './useGlassPlayer';

// Audio playback utilities
export { useSleepTimer } from './useSleepTimer';
export {
  useActivePlayback,
  type ActivePlaybackInfo,
} from './useActivePlayback';

// Module management
export { useModuleUsage } from './useModuleUsage';
export { useModuleOrder, type UseModuleOrderReturn } from './useModuleOrder';
export { useModuleCollections, type UseModuleCollectionsReturn } from './useModuleCollections';

// Content
export { useNewsArticles } from './useNewsArticles';
export { useWeather } from './useWeather';

// Media / Photo Albums
export { usePhotoAlbums, type UsePhotoAlbumsReturn } from './usePhotoAlbums';

// Contact Groups
export { useContactGroups, type UseContactGroupsReturn } from './useContactGroups';

// Music Favorites & Collections
export { useMusicFavorites, type UseMusicFavoritesReturn } from './useMusicFavorites';
export { useMusicCollections, type UseMusicCollectionsReturn } from './useMusicCollections';
export { useAlbumFavorites, type UseAlbumFavoritesReturn } from './useAlbumFavorites';
export { useArtistFavorites, type UseArtistFavoritesReturn } from './useArtistFavorites';

// Siri integration
export {
  useSiriCall,
  type SiriCallIntent,
  type SiriAuthorizationStatus,
  type UseSiriCallOptions,
  type UseSiriCallReturn,
} from './useSiriCall';

// Music Play Stats
export { useMusicPlayStats, type UseMusicPlayStatsReturn } from './useMusicPlayStats';

// Agenda Notifications
export {
  useAgendaNotifications,
  type UseAgendaNotificationsReturn,
} from './useAgendaNotifications';

// HomeScreen Badges
export { useModuleBadges, type UseModuleBadgesReturn } from './useModuleBadges';

// Scroll Overflow Detection
export { useScrollOverflow, type UseScrollOverflowReturn } from './useScrollOverflow';
