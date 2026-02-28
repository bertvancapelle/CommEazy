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

// Module management
export { useModuleUsage } from './useModuleUsage';

// Content
export { useNewsArticles } from './useNewsArticles';
export { useWeather } from './useWeather';

// Siri integration
export {
  useSiriCall,
  type SiriCallIntent,
  type SiriAuthorizationStatus,
  type UseSiriCallOptions,
  type UseSiriCallReturn,
} from './useSiriCall';
