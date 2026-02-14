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
 * Schema Version History:
 * - v1: Initial schema
 * - v2: Added is_read to messages
 * - v3: Added photo_path to contacts and user_profile
 * - v4: Added user_uuid (stable identifier), freemium fields (subscription, demographics)
 * - v6: Added gender to user_profile
 * - v7: Added Hold-to-Navigate settings (longPressDelay, menuButtonPosition)
 * - v8: Added edgeExclusionSize for Hold-to-Navigate accessibility
 *
 * @see services/interfaces.ts for domain models
 */

import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 8,
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
        { name: 'is_read', type: 'boolean' }, // Unread message tracking
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
        { name: 'user_uuid', type: 'string', isIndexed: true }, // Stable identifier (v4)
        { name: 'jid', type: 'string', isIndexed: true },        // = {user_uuid}@commeazy.local
        { name: 'name', type: 'string' },
        { name: 'phone_number', type: 'string', isOptional: true }, // Now optional (v4)
        { name: 'public_key', type: 'string' }, // Base64
        { name: 'verified', type: 'boolean' }, // QR verified
        { name: 'last_seen', type: 'number' },
        { name: 'photo_path', type: 'string', isOptional: true }, // Local file path to avatar
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
        // Identity (v4: UUID is stable, phone/name can change)
        { name: 'user_uuid', type: 'string' },                    // Stable identifier, never changes
        { name: 'jid', type: 'string' },                          // = {user_uuid}@commeazy.local
        { name: 'name', type: 'string' },                         // Display name, can change
        { name: 'phone_number', type: 'string' },                 // Can change
        { name: 'public_key', type: 'string' },

        // Preferences
        { name: 'language', type: 'string' },                     // 'nl' | 'en' | 'de' | 'fr' | 'es'
        { name: 'audio_feedback_enabled', type: 'boolean' },
        { name: 'haptic_feedback_enabled', type: 'boolean' },
        { name: 'photo_path', type: 'string', isOptional: true }, // Local file path to own avatar

        // Subscription (v4: freemium model)
        { name: 'subscription_tier', type: 'string' },            // 'free' | 'premium'
        { name: 'subscription_expires', type: 'number', isOptional: true },

        // Demographics (v4: required for free, optional for premium; v5: added city; v6: added gender)
        { name: 'country_code', type: 'string', isOptional: true },   // ISO 3166-1: 'NL', 'BE', 'DE'
        { name: 'region_code', type: 'string', isOptional: true },    // ISO 3166-2: 'NL-NH', 'BE-VLG'
        { name: 'city', type: 'string', isOptional: true },           // Free text city name
        { name: 'age_bracket', type: 'string', isOptional: true },    // '18-24', '25-34', etc.
        { name: 'gender', type: 'string', isOptional: true },         // 'male', 'female', 'other'

        // Hold-to-Navigate settings (v7: accessibility, v8: edge exclusion)
        { name: 'long_press_delay', type: 'number', isOptional: true },       // 500-3000ms, default 1000
        { name: 'menu_button_position_x', type: 'number', isOptional: true }, // 0-1 as % of screen width
        { name: 'menu_button_position_y', type: 'number', isOptional: true }, // 0-1 as % of screen height
        { name: 'edge_exclusion_size', type: 'number', isOptional: true },    // 0-100px, default 40

        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
