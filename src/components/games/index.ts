/**
 * Game Components — CommEazy Games
 *
 * Shared UI components for all 6 games.
 */

// Lobby
export { SpelTegel, type SpelTegelProps } from './SpelTegel';

// In-game controls
export { GameHeader, type GameHeaderProps, type GameHeaderAction } from './GameHeader';
export { DifficultyPicker, type DifficultyPickerProps, type DifficultyOption } from './DifficultyPicker';
export { GameStatsView, type GameStatsViewProps } from './GameStatsView';
export { GameSoundPicker } from './GameSoundPicker';
export { GameSettingsAccordion } from './GameSettingsAccordion';

// Animations
export { CelebrationAnimation } from './CelebrationAnimation';

// Modals
export { GameOverModal, type GameOverModalProps, type GameOverStat } from './GameOverModal';
export { GameInviteModal, type GameInviteModalProps, type GameContact } from './GameInviteModal';
export { GameWaitingModal, type GameWaitingModalProps, type WaitingInvitee } from './GameWaitingModal';

// Multiplayer
export { InGameChat, type InGameChatProps, type GameChatMessage, type PlayerInfo } from './InGameChat';
