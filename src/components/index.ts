/**
 * CommEazy UI Components
 *
 * All components follow senior-inclusive design:
 * - Touch targets ≥ 60pt
 * - Body text ≥ 18pt
 * - WCAG AAA contrast
 * - Haptic feedback on interactions
 *
 * USE THESE COMPONENTS to enforce UI principles:
 * - LoadingView: spinner + text (never use ActivityIndicator alone)
 * - ErrorView: human error + recovery action (never use Alert.alert for errors)
 * - StatusIndicator: color + icon + text (never use color alone)
 * - Button: haptic feedback built-in
 */

// Core UI components
export { Button } from './Button';
export { TextInput } from './TextInput';
export { ProgressIndicator } from './ProgressIndicator';
export { PinInput } from './PinInput';
export { ContactAvatar } from './ContactAvatar';
export { Icon } from './Icon';
export type { IconName } from './Icon';
export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';

// Senior-inclusive pattern components (MANDATORY)
export { LoadingView } from './LoadingView';
export { ErrorView } from './ErrorView';
export { StatusIndicator, MessageStatus } from './StatusIndicator';
export type { StatusType } from './StatusIndicator';

// Hold-to-Navigate components
export { HoldIndicator } from './HoldIndicator';
export { DraggableMenuButton } from './DraggableMenuButton';
export { NavigationMenu } from './NavigationMenu';
export { WheelNavigationMenu } from './WheelNavigationMenu';
export type { NavigationDestination } from './WheelNavigationMenu';
export { HoldToNavigateWrapper } from './HoldToNavigateWrapper';

// Voice Focus components
export { VoiceFocusable } from './VoiceFocusable';

// Voice Form components
export { VoiceTextInput } from './VoiceTextInput';
export type { VoiceTextInputRef } from './VoiceTextInput';

// Voice Toggle component
export { VoiceToggle } from './VoiceToggle';
export type { VoiceToggleProps } from './VoiceToggle';

// Voice Stepper component
export { VoiceStepper } from './VoiceStepper';
export type { VoiceStepperProps } from './VoiceStepper';

// Contact Selection Modal (for multi-match disambiguation)
export { ContactSelectionModal } from './ContactSelectionModal';
export type { ContactMatch, ContactSelectionMode, ContactSelectionModalProps } from './ContactSelectionModal';

// Radio Player Overlay
export { RadioPlayerOverlay } from './RadioPlayerOverlay';

// Books Player Overlay (TTS read-aloud)
export { BooksPlayerOverlay } from './BooksPlayerOverlay';

// Media Indicator (small animated icon in headers for active audio/video)
export { MediaIndicator } from './MediaIndicator';

// Playing Wave Icon (small animated waveform for playing items in lists)
export { PlayingWaveIcon } from './PlayingWaveIcon';

// Seek Slider (for audio/video progress control)
export { SeekSlider } from './SeekSlider';
export type { default as SeekSliderProps } from './SeekSlider';

// Standardized Audio Player Components
export { MiniPlayer } from './MiniPlayer';
export type { MiniPlayerProps } from './MiniPlayer';
export { ExpandedAudioPlayer } from './ExpandedAudioPlayer';
export type { ExpandedAudioPlayerProps, AudioPlayerControls } from './ExpandedAudioPlayer';

// Panel-aware Modal (stays within panel on iPad Split View)
export { PanelAwareModal } from './PanelAwareModal';
export type { PanelAwareModalProps } from './PanelAwareModal';

// Module Header Component (standardized header for all module screens)
export { ModuleHeader } from './ModuleHeader';
export type { ModuleHeaderProps } from './ModuleHeader';

// AdMob Banner Component (placeholder until real SDK is installed)
export { AdMobBanner } from './AdMobBanner';
export type { AdMobBannerProps } from './AdMobBanner';

// Favorite Button Components (icon-only and tab variants)
export { FavoriteButton, FavoriteTabButton } from './FavoriteButton';
export type { FavoriteButtonProps, FavoriteTabButtonProps } from './FavoriteButton';

// Search Button Components (icon-only and tab variants)
export { SearchButton, SearchTabButton } from './SearchButton';
export type { SearchButtonProps, SearchTabButtonProps } from './SearchButton';

// Library Tab Button Component (for BooksScreen)
export { LibraryTabButton } from './LibraryTabButton';
export type { LibraryTabButtonProps } from './LibraryTabButton';

// SearchBar Component (standardized search input with button)
export { SearchBar } from './SearchBar';
export type { SearchBarProps, SearchBarRef } from './SearchBar';

// ChipSelector Component (standardized country/language selector)
export { ChipSelector } from './ChipSelector';
export type { ChipSelectorProps, ChipOption, FilterMode } from './ChipSelector';

// ArticleViewer Component (for news modules - Safari View Controller with TTS)
export { ArticleViewer } from './ArticleViewer';
export type { ArticleViewerProps } from './ArticleViewer';

// ArticlePreviewModal Component (article preview with choice options)
export { ArticlePreviewModal } from './ArticlePreviewModal';
export type { ArticlePreviewModalProps } from './ArticlePreviewModal';

// ArticleWebViewer Component (embedded WebView for full article reading)
export { ArticleWebViewer } from './ArticleWebViewer';
export type { ArticleWebViewerProps } from './ArticleWebViewer';

// Nu.nl Logo Component (for source attribution in news module)
export { NunlLogo } from './NunlLogo';

// Radar Map Component (for weather radar module)
export { RadarMap } from './RadarMap';
export type { RadarMapProps } from './RadarMap';

// Time Slider Component (for radar time navigation)
export { TimeSlider } from './TimeSlider';
export type { TimeSliderProps } from './TimeSlider';

// Photo Message Bubble (for photo messages in chat)
export { PhotoMessageBubble } from './PhotoMessageBubble';
export type { PhotoMessageBubbleProps } from './PhotoMessageBubble';

// Photo Recipient Modal (for selecting photo send recipients)
export { PhotoRecipientModal, MAX_RECIPIENTS as PHOTO_MAX_RECIPIENTS } from './PhotoRecipientModal';
export type { PhotoRecipientModalProps } from './PhotoRecipientModal';

// Liquid Glass View (Apple iOS 26+ glass effects with fallback)
export { LiquidGlassView } from './LiquidGlassView';
export type { LiquidGlassViewProps } from './LiquidGlassView';

// Apple Music Components
export { AppleMusicDetailModal } from './appleMusic';
export { QueueView } from './QueueView';
export type { QueueViewProps } from './QueueView';

// Note: DevModePanel is NOT exported here to avoid loading mock data at startup.
// Import directly from './DevModePanel' if needed:
//   import { DevModePanel, DevModeButton } from '@/components/DevModePanel';

// Adaptive Navigation Components (iPad/iPhone hybrid menu)
export {
  ModuleItem,
  ModuleIcon,
  Sidebar,
  AdaptiveNavigation,
  SplitViewLayout,
  AdaptiveNavigationWrapper,
} from './navigation';
export type {
  ModuleItemProps,
  ModuleItemVariant,
  ModuleItemSize,
  ModuleIconProps,
  SidebarProps,
  AdaptiveNavigationProps,
  SplitViewLayoutProps,
  AdaptiveNavigationWrapperProps,
} from './navigation';
