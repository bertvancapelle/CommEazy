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
export { PresenceIndicator } from './PresenceIndicator';
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

// Note: DevModePanel is NOT exported here to avoid loading mock data at startup.
// Import directly from './DevModePanel' if needed:
//   import { DevModePanel, DevModeButton } from '@/components/DevModePanel';
