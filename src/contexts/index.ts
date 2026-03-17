/**
 * Context exports
 *
 * Centralized exports for all React contexts used in the app.
 */

export { AccentColorProvider, useAccentColorContext, type AccentColorContextValue } from './AccentColorContext';

export {
  VoiceFocusProvider,
  useVoiceFocusContext,
  useVoiceSessionStatus,
  useVoiceFocusList,
  type VoiceFocusContextValue,
  type VoiceFocusableItem,
  type VoiceFocusList,
  type VoiceCommands,
  type VoiceSessionSettings,
  type FuzzyMatchResult,
} from './VoiceFocusContext';

export {
  VoiceSettingsProvider,
  useVoiceSettingsContext,
  useVoiceSettings,
  useCommandPatterns,
  type VoiceSettingsContextValue,
} from './VoiceSettingsContext';

export {
  VoiceFormProvider,
  useVoiceFormContext,
  useVoiceField,
  useVoiceForm,
  type VoiceFormContextValue,
} from './VoiceFormContext';

export {
  CallProvider,
  useCall,
  type CallContextValue,
  type CallProviderProps,
} from './CallContext';

export {
  NavigationProvider,
  useNavigationContext,
  useNavigationContextSafe,
  type NavigationContextValue,
  type NavigateCallback,
} from './NavigationContext';

export {
  LiquidGlassProvider,
  useLiquidGlassContext,
  useLiquidGlassContextSafe,
  useLiquidGlassEnabled,
} from './LiquidGlassContext';

export {
  AppleMusicProvider,
  useAppleMusicContext,
  useAppleMusicContextSafe,
  useAppleMusicState,
  useAppleMusicControls,
  useAppleMusicSearch,
  type AppleMusicContextValue,
  type AppleMusicAuthStatus,
  type AppleMusicSong,
  type AppleMusicAlbum,
  type AppleMusicArtist,
  type AppleMusicPlaylist,
  type SearchResults,
  type PlaybackState,
  type ShuffleMode,
  type RepeatMode,
  type PlatformCapabilities,
  type LibraryCounts,
  type LibraryPaginatedResponse,
} from './AppleMusicContext';

export {
  AudioOrchestratorProvider,
  useAudioOrchestrator,
  useAudioOrchestratorOptional,
  type AudioSource,
} from './AudioOrchestratorContext';

export {
  ThemeProvider,
  useTheme,
  useThemeSafe,
  useColors,
  useIsDarkMode,
  getDarkAccentColor,
  type ThemeMode,
  type ResolvedTheme,
  type ColorPalette,
  type ThemeContextValue,
} from './ThemeContext';

export {
  ModuleColorsProvider,
  useModuleColorsContext,
  useModuleColorsContextSafe,
  useModuleColor,
  CUSTOMIZABLE_MODULES,
  MODULE_COLOR_OPTIONS,
  MODULE_LABELS,
  type ModuleColorsContextValue,
  type ModuleColorOverrides,
} from './ModuleColorsContext';

export {
  ReducedMotionProvider,
  useReducedMotionContext,
  useReducedMotionSafe,
  type ReducedMotionContextValue,
} from './ReducedMotionContext';

export {
  PanelIdProvider,
  usePanelId,
} from './PanelIdContext';

export {
  PaneProvider,
  usePaneContext,
  usePaneContextSafe,
  type PaneId,
  type PaneState,
  type PaneContextValue,
  type PendingNavigation,
} from './PaneContext';

export {
  PresenceProvider,
  usePresence,
  usePresenceSafe,
  useVisualPresence,
  mapToVisualState,
  type VisualPresenceState,
  type VisualPresence,
} from './PresenceContext';

export {
  ButtonStyleProvider,
  useButtonStyle,
  useButtonStyleSafe,
  type ButtonStyleContextValue,
  type ButtonStyleSettings,
  type ButtonBorderColor,
} from './ButtonStyleContext';

export {
  AirPlayProvider,
  useAirPlayContext,
  useAirPlayContextSafe,
  type AirPlayContextValue,
  type AirPlayPreset,
  type AirPlayOutput,
} from './AirPlayContext';

export {
  AskAIProvider,
  useAskAI,
} from './AskAIContext';

export {
  HoldGestureProvider,
  useHoldGestureContext,
  useHoldGestureContextSafe,
  useHoldGestureGuard,
} from './HoldGestureContext';

export {
  PlaylistImportProvider,
  usePlaylistImportContext,
  usePlaylistImportContextSafe,
} from './PlaylistImportContext';
export type { ImportResultInfo } from './PlaylistImportContext';

export {
  FeedbackProvider,
  useFeedbackContext,
  useFeedbackContextSafe,
  DEFAULT_FEEDBACK_SETTINGS,
  type FeedbackContextValue,
  type FeedbackSettings,
  type HapticIntensity,
} from './FeedbackContext';

export {
  AgendaProvider,
  useAgendaContext,
  useAgendaContextSafe,
  type AgendaContextValue,
  type TimelineItem,
  type TimelineDay,
  type CreateAgendaItemData,
} from './AgendaContext';

export {
  ModuleLayoutProvider,
  useModuleLayout,
  useModuleLayoutSafe,
  type ToolbarPosition,
  type ModuleLayoutContextValue,
} from './ModuleLayoutContext';

export {
  ModuleBrowsingProvider,
  useModuleBrowsingContext,
  useModuleBrowsingContextSafe,
  useModuleBrowsingState,
  type ModuleBrowsingState,
  type RadioBrowsingState,
  type PodcastBrowsingState,
  type BooksBrowsingState,
  type AppleMusicBrowsingState,
  type BrowsableModuleId,
} from './ModuleBrowsingContext';

export {
  FieldTextStyleProvider,
  useFieldTextStyleContext,
  useFieldTextStyleContextSafe,
  useLabelStyle,
  useFieldTextStyle,
  useModalTextStyle,
  getTextStyleColorHex,
  DEFAULT_FIELD_TEXT_STYLE_SETTINGS,
  type FieldTextStyleContextValue,
  type FieldTextStyleSettings,
  type TextStyleColor,
  type FontStyleOption,
  type TextStyleSetting,
  type ResolvedTextStyle,
} from './FieldTextStyleContext';
