/**
 * Module Screens — Built-in and country-specific modules
 *
 * These screens are used by PanelNavigator for
 * module switching via HomeScreen grid navigation.
 */

// Built-in modules
export { CallsScreen } from './CallsScreen';  // Combined voice + video calling
export { PodcastScreen } from './PodcastScreen';
export { RadioScreen } from './RadioScreen';
export { BooksScreen } from './BooksScreen';
export { BookReaderScreen } from './BookReaderScreen';
export { BookPlayerScreen } from './BookPlayerScreen';
export { AppleMusicScreen } from './AppleMusicScreen';
export { EBookScreen } from './EBookScreen';
export { AudioBookScreen } from './AudioBookScreen';

// Country-specific modules
export { NuNlScreen } from './NuNlScreen';

// Static modules (not country-specific)
export { WeatherScreen } from './WeatherScreen';

// Media modules (photo/video)
export { CameraScreen } from './CameraScreen';
export { PhotoAlbumScreen } from './PhotoAlbumScreen';

// AI modules
export { AskAIScreen } from './AskAIScreen';

// Agenda module
export { AgendaScreen } from './AgendaScreen';

// Game placeholder (used for all 5 game modules)
export { GamePlaceholderScreen } from './GamePlaceholderScreen';

// Help module placeholder
export { HelpPlaceholderScreen } from './HelpPlaceholderScreen';

// Communication modules
export { MailScreen } from '../mail/MailScreen';
