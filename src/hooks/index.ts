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

// Form Field Scroll Management
export {
  useScrollToField,
  type UseScrollToFieldReturn,
  type ScrollToFieldOptions,
} from './useScrollToField';

// Search Cache (module-level search persistence)
export { useSearchCache, type SearchCacheEntry } from './useSearchCache';

// Game hooks
export { useGameSession } from './games/useGameSession';
export { useGameStats } from './games/useGameStats';
export { useGameMultiplayer } from './games/useGameMultiplayer';
export { useGameInvite } from './games/useGameInvite';
export type { OutgoingInviteStatus, IncomingInvite } from './games/useGameInvite';
