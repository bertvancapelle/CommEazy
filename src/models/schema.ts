/**
 * CommEazy WatermelonDB Schema
 *
 * Tables:
 * - messages: Chat messages (stored locally, decrypted)
 * - outbox: Pending messages (encrypted, 7-day TTL)
 * - contacts: User contacts with public keys
 * - groups: Group chat metadata
 * - user_profile: Current user settings
 *
 * @see services/interfaces.ts for domain models
 */

import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    // Messages table — stored locally after decryption
    tableSchema({
      name: 'messages',
      columns: [
        { name: 'chat_id', type: 'string', isIndexed: true },
        { name: 'sender_id', type: 'string' },
        { name: 'sender_name', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'content_type', type: 'string' }, // 'text' | 'image' | 'video'
        { name: 'timestamp', type: 'number', isIndexed: true },
        { name: 'status', type: 'string' }, // 'pending' | 'sent' | 'delivered' | 'failed' | 'expired'
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Outbox table — encrypted messages pending delivery (7-day TTL)
    tableSchema({
      name: 'outbox_messages',
      columns: [
        { name: 'chat_id', type: 'string', isIndexed: true },
        { name: 'encrypted_content', type: 'string' }, // NEVER plaintext
        { name: 'content_type', type: 'string' },
        { name: 'timestamp', type: 'number' },
        { name: 'expires_at', type: 'number', isIndexed: true },
        { name: 'pending_to', type: 'string' }, // JSON array of JIDs
        { name: 'delivered_to', type: 'string' }, // JSON array of JIDs
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Contacts table
    tableSchema({
      name: 'contacts',
      columns: [
        { name: 'jid', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'phone_number', type: 'string' },
        { name: 'public_key', type: 'string' }, // Base64
        { name: 'verified', type: 'boolean' }, // QR verified
        { name: 'last_seen', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Groups table
    tableSchema({
      name: 'groups',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'members', type: 'string' }, // JSON array of JIDs
        { name: 'created_by', type: 'string' },
        { name: 'encryption_mode', type: 'string' }, // 'encrypt-to-all' | 'shared-key'
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // User profile table (single row)
    tableSchema({
      name: 'user_profile',
      columns: [
        { name: 'jid', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'phone_number', type: 'string' },
        { name: 'public_key', type: 'string' },
        { name: 'language', type: 'string' }, // 'nl' | 'en' | 'de' | 'fr' | 'es'
        { name: 'audio_feedback_enabled', type: 'boolean' },
        { name: 'haptic_feedback_enabled', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
