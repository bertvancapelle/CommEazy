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

// Model classes array for database initialization
export const modelClasses = [
  require('./Message').MessageModel,
  require('./OutboxMessage').OutboxMessageModel,
  require('./Contact').ContactModel,
  require('./Group').GroupModel,
  require('./UserProfile').UserProfileModel,
  require('./MediaMessage').MediaMessageModel,
];
