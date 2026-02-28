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
 * - v9: Added hapticIntensity, audioFeedbackBoost, wheelBlurIntensity, wheelDismissMargin
 * - v10: Added accentColor for UI personalization
 * - v11: Added voiceCommandsEnabled for two-finger voice commands
 * - v12: Added call sound settings (ringtone, dial tone, vibration)
 * - v13: Added media_messages table for photo/video messaging
 *
 * @see services/interfaces.ts for domain models
 * @see types/media.ts for media types
 */

import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * Schema Version Constant
 *
 * Export this constant for use in migration checks and app version logging.
 * Always keep this in sync with appSchema({ version: ... }) below.
 *
 * When to increment:
 * - Adding new tables → increment version
 * - Adding new columns → increment version
 * - Changing column types → increment version (requires migration)
 * - Removing columns → increment version (optional, for cleanup)
 *
 * Migration strategy (for V1.0+):
 * - Create migrations.ts with schemaMigrations()
 * - Add migration steps for each version increment
 * - Test on fresh install AND on upgrade from previous version
 */
export const SCHEMA_VERSION = 13;

export const schema = appSchema({
  version: 13,
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
        // Media fields (v13) — only populated for image/video content types
        { name: 'media_id', type: 'string', isOptional: true },           // Reference to media_messages
        { name: 'thumbnail_data', type: 'string', isOptional: true },     // Base64 thumbnail (~10KB)
        { name: 'media_width', type: 'number', isOptional: true },        // Width in pixels
        { name: 'media_height', type: 'number', isOptional: true },       // Height in pixels
        { name: 'media_duration', type: 'number', isOptional: true },     // Video duration in seconds
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Media messages table (v13) — stores media files metadata
    tableSchema({
      name: 'media_messages',
      columns: [
        { name: 'media_id', type: 'string', isIndexed: true },          // Unique media ID (UUID v4)
        { name: 'message_id', type: 'string', isIndexed: true },        // Reference to messages table
        { name: 'type', type: 'string' },                               // 'photo' | 'video'
        { name: 'local_uri', type: 'string' },                          // Local file path (decrypted)
        { name: 'thumbnail_uri', type: 'string' },                      // Local thumbnail path
        { name: 'size', type: 'number' },                               // File size in bytes
        { name: 'width', type: 'number' },                              // Width in pixels
        { name: 'height', type: 'number' },                             // Height in pixels
        { name: 'duration', type: 'number', isOptional: true },         // Video duration in seconds
        { name: 'source', type: 'string' },                             // 'camera' | 'gallery' | 'received'
        { name: 'sender_jid', type: 'string', isOptional: true },       // Sender JID (for received)
        { name: 'sender_name', type: 'string', isOptional: true },      // Sender name (for received)
        { name: 'chat_id', type: 'string', isIndexed: true },           // Associated chat
        { name: 'encryption_key', type: 'string' },                     // Base64 encryption key
        { name: 'encryption_nonce', type: 'string' },                   // Base64 encryption nonce
        { name: 'transfer_status', type: 'string' },                    // Transfer status
        { name: 'retry_count', type: 'number' },                        // Retry attempts
        { name: 'expires_at', type: 'number', isIndexed: true },        // 7-day expiration
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

        // Hold-to-Navigate settings (v7: accessibility, v8: edge exclusion, v9: blur/dismiss)
        { name: 'long_press_delay', type: 'number', isOptional: true },       // 500-3000ms, default 1000
        { name: 'menu_button_position_x', type: 'number', isOptional: true }, // 0-1 as % of screen width
        { name: 'menu_button_position_y', type: 'number', isOptional: true }, // 0-1 as % of screen height
        { name: 'edge_exclusion_size', type: 'number', isOptional: true },    // 0-100px, default 40
        { name: 'wheel_blur_intensity', type: 'number', isOptional: true },   // 0-30, default 15 (v9)
        { name: 'wheel_dismiss_margin', type: 'number', isOptional: true },   // 20-100, default 50 (v9)

        // Feedback settings (v9: granular haptic/audio control)
        { name: 'haptic_intensity', type: 'string', isOptional: true },       // 'off'|'veryLight'|'light'|'normal'|'strong' (v9)
        { name: 'audio_feedback_boost', type: 'boolean', isOptional: true },  // +20% volume boost (v9)

        // UI personalization (v10)
        { name: 'accent_color', type: 'string', isOptional: true },           // 'blue'|'green'|'purple'|'orange'|'red' (v10)

        // Voice commands (v11)
        { name: 'voice_commands_enabled', type: 'boolean', isOptional: true }, // Two-finger long press (v11)

        // Call sound settings (v12)
        { name: 'ringtone_enabled', type: 'boolean', isOptional: true },       // Play ringtone for incoming calls
        { name: 'ringtone_sound', type: 'string', isOptional: true },          // Selected ringtone: 'default'|'classic'|'gentle'|'urgent'
        { name: 'dial_tone_enabled', type: 'boolean', isOptional: true },      // Play dial tone when calling
        { name: 'incoming_call_vibration', type: 'boolean', isOptional: true }, // Vibrate on incoming call
        { name: 'outgoing_call_vibration', type: 'boolean', isOptional: true }, // Vibrate on outgoing call feedback

        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
