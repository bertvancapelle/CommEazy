/**
 * CommEazy WatermelonDB Models
 *
 * Export all models for database initialization.
 */

export { schema, SCHEMA_VERSION } from './schema';
export { migrations } from './migrations';
export { MessageModel } from './Message';
export { OutboxMessageModel } from './OutboxMessage';
export { ContactModel } from './Contact';
export { GroupModel } from './Group';
export { UserProfileModel } from './UserProfile';
export { MediaMessageModel } from './MediaMessage';
export { AgendaItemModel, type MedicationLogEntry } from './AgendaItem';
export { SharedDataConsentModel } from './SharedDataConsent';
export { GameSessionModel } from './GameSession';
export { GameStatModel } from './GameStat';

// Model classes array for database initialization
export const modelClasses = [
  require('./Message').MessageModel,
  require('./OutboxMessage').OutboxMessageModel,
  require('./Contact').ContactModel,
  require('./Group').GroupModel,
  require('./UserProfile').UserProfileModel,
  require('./MediaMessage').MediaMessageModel,
  require('./AgendaItem').AgendaItemModel,
  require('./SharedDataConsent').SharedDataConsentModel,
  require('./GameSession').GameSessionModel,
  require('./GameStat').GameStatModel,
];
