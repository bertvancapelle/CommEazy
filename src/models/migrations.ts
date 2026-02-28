/**
 * WatermelonDB Migrations
 *
 * Schema version history:
 * - v1: Initial schema (messages, outbox, contacts, groups, user_profile)
 * - v2: Added is_read column to messages for unread tracking
 * - v3: Added photo_path column to contacts and user_profile for avatars
 * - v4: Added user_uuid (stable identifier), freemium fields (subscription, demographics)
 * - v5: Added city field to user_profile for ad targeting
 * - v6: Added gender field to user_profile
 * - v7: Added Hold-to-Navigate settings (longPressDelay, menuButtonPosition)
 * - v8: Added edgeExclusionSize for Hold-to-Navigate accessibility
 * - v9: Added hapticIntensity, audioFeedbackBoost, wheelBlurIntensity, wheelDismissMargin
 * - v10: Added accentColor for UI personalization
 * - v11: Added voiceCommandsEnabled for two-finger voice commands
 * - v12: Added call sound settings (ringtone, dial tone, vibration)
 * - v13: Added media_messages table and media fields to messages
 */

import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // Migration from v1 to v2: Add is_read column
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'messages',
          columns: [
            { name: 'is_read', type: 'boolean' },
          ],
        }),
      ],
    },
    // Migration from v2 to v3: Add photo_path for avatars
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'contacts',
          columns: [
            { name: 'photo_path', type: 'string', isOptional: true },
          ],
        }),
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'photo_path', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v3 to v4: Add UUID-based identity and freemium fields
    {
      toVersion: 4,
      steps: [
        // Add user_uuid to contacts (stable identifier)
        addColumns({
          table: 'contacts',
          columns: [
            { name: 'user_uuid', type: 'string' },
          ],
        }),
        // Add user_uuid and freemium fields to user_profile
        addColumns({
          table: 'user_profile',
          columns: [
            // Stable identifier
            { name: 'user_uuid', type: 'string' },
            // Subscription status
            { name: 'subscription_tier', type: 'string' },
            { name: 'subscription_expires', type: 'number', isOptional: true },
            // Demographics (required for free users, optional for premium)
            { name: 'country_code', type: 'string', isOptional: true },
            { name: 'region_code', type: 'string', isOptional: true },
            { name: 'age_bracket', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v4 to v5: Add city field to user_profile
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'city', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v5 to v6: Add gender field to user_profile
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'gender', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v6 to v7: Add Hold-to-Navigate settings
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'long_press_delay', type: 'number', isOptional: true },
            { name: 'menu_button_position_x', type: 'number', isOptional: true },
            { name: 'menu_button_position_y', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v7 to v8: Add edge exclusion zone setting
    {
      toVersion: 8,
      steps: [
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'edge_exclusion_size', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v8 to v9: Add advanced accessibility settings
    {
      toVersion: 9,
      steps: [
        addColumns({
          table: 'user_profile',
          columns: [
            // Hold-to-Navigate advanced settings
            { name: 'wheel_blur_intensity', type: 'number', isOptional: true },
            { name: 'wheel_dismiss_margin', type: 'number', isOptional: true },
            // Granular feedback control
            { name: 'haptic_intensity', type: 'string', isOptional: true },
            { name: 'audio_feedback_boost', type: 'boolean', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v9 to v10: Add accent color for UI personalization
    {
      toVersion: 10,
      steps: [
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'accent_color', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v10 to v11: Add voice commands setting
    {
      toVersion: 11,
      steps: [
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'voice_commands_enabled', type: 'boolean', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v11 to v12: Add call sound settings
    {
      toVersion: 12,
      steps: [
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'ringtone_enabled', type: 'boolean', isOptional: true },
            { name: 'ringtone_sound', type: 'string', isOptional: true },
            { name: 'dial_tone_enabled', type: 'boolean', isOptional: true },
            { name: 'incoming_call_vibration', type: 'boolean', isOptional: true },
            { name: 'outgoing_call_vibration', type: 'boolean', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v12 to v13: Add media messaging support
    {
      toVersion: 13,
      steps: [
        // Add media fields to messages table
        addColumns({
          table: 'messages',
          columns: [
            { name: 'media_id', type: 'string', isOptional: true },
            { name: 'thumbnail_data', type: 'string', isOptional: true },
            { name: 'media_width', type: 'number', isOptional: true },
            { name: 'media_height', type: 'number', isOptional: true },
            { name: 'media_duration', type: 'number', isOptional: true },
          ],
        }),
        // Create media_messages table
        createTable({
          name: 'media_messages',
          columns: [
            { name: 'media_id', type: 'string', isIndexed: true },
            { name: 'message_id', type: 'string', isIndexed: true },
            { name: 'type', type: 'string' },
            { name: 'local_uri', type: 'string' },
            { name: 'thumbnail_uri', type: 'string' },
            { name: 'size', type: 'number' },
            { name: 'width', type: 'number' },
            { name: 'height', type: 'number' },
            { name: 'duration', type: 'number', isOptional: true },
            { name: 'source', type: 'string' },
            { name: 'sender_jid', type: 'string', isOptional: true },
            { name: 'sender_name', type: 'string', isOptional: true },
            { name: 'chat_id', type: 'string', isIndexed: true },
            { name: 'encryption_key', type: 'string' },
            { name: 'encryption_nonce', type: 'string' },
            { name: 'transfer_status', type: 'string' },
            { name: 'retry_count', type: 'number' },
            { name: 'expires_at', type: 'number', isIndexed: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
  ],
});
