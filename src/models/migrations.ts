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
 * - v14: Added contact details (firstName, lastName, address, dates, isDeceased)
 * - v15: Added is_emergency_contact to contacts (ICE — In Case of Emergency)
 * - v16: Added trust_level to contacts (0=Unknown, 1=Invited, 2=Connected, 3=Verified)
 * - v17: Added agenda_items table for appointments, reminders, medication
 * - v18: Added address fields to agenda_items (location_name, address_street, etc.)
 * - v19: Added category snapshot fields to agenda_items (category_icon, category_name, form_type)
 * - v20: Added categories to contacts (JSON array of agenda category IDs)
 * - v21: Added end_time, notes, source to agenda_items (ICS calendar import)
 * - v22: Added email to contacts (ICS calendar invitation via mail)
 * - v23: Added mobile_number to contacts (landline/mobile distinction)
 * - v24: Added personal contact details to user_profile (email, mobile, landline, address, dates) for contact data sharing
 * - v25: Added shared_data_consents table for per-contact data sharing consent
 * - v26: Added profile_version to contacts and user_profile for profile sync
 * - v27: Split name into first_name + last_name on user_profile
 * - v28: Added address_province to contacts and user_profile (personal address province/state)
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
    // Migration from v13 to v14: Add contact details (firstName, lastName, address, dates)
    {
      toVersion: 14,
      steps: [
        addColumns({
          table: 'contacts',
          columns: [
            { name: 'first_name', type: 'string' },
            { name: 'last_name', type: 'string' },
            // Address fields
            { name: 'address_street', type: 'string', isOptional: true },
            { name: 'address_postal_code', type: 'string', isOptional: true },
            { name: 'address_city', type: 'string', isOptional: true },
            { name: 'address_country', type: 'string', isOptional: true },
            // Date fields
            { name: 'birth_date', type: 'string', isOptional: true },
            { name: 'wedding_date', type: 'string', isOptional: true },
            { name: 'death_date', type: 'string', isOptional: true },
            { name: 'is_deceased', type: 'boolean', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v14 to v15: Add emergency contact (ICE) flag
    {
      toVersion: 15,
      steps: [
        addColumns({
          table: 'contacts',
          columns: [
            { name: 'is_emergency_contact', type: 'boolean', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v15 to v16: Add trust level for attestation-based trust
    {
      toVersion: 16,
      steps: [
        addColumns({
          table: 'contacts',
          columns: [
            { name: 'trust_level', type: 'number' },
          ],
        }),
      ],
    },
    // Migration from v16 to v17: Add agenda_items table
    {
      toVersion: 17,
      steps: [
        createTable({
          name: 'agenda_items',
          columns: [
            { name: 'category', type: 'string', isIndexed: true },
            { name: 'title', type: 'string' },
            { name: 'item_date', type: 'number', isIndexed: true },
            { name: 'time', type: 'string', isOptional: true },
            { name: 'times', type: 'string', isOptional: true },
            { name: 'repeat_type', type: 'string', isOptional: true },
            { name: 'end_date', type: 'number', isOptional: true },
            { name: 'reminder_offset', type: 'string' },
            { name: 'contact_ids', type: 'string', isOptional: true },
            { name: 'medication_log', type: 'string', isOptional: true },
            { name: 'shared_with', type: 'string', isOptional: true },
            { name: 'shared_from', type: 'string', isOptional: true },
            { name: 'is_hidden', type: 'boolean' },
            { name: 'parent_id', type: 'string', isOptional: true },
            { name: 'exception_date', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    // Migration from v17 to v18: Add address fields to agenda_items
    {
      toVersion: 18,
      steps: [
        addColumns({
          table: 'agenda_items',
          columns: [
            { name: 'location_name', type: 'string', isOptional: true },
            { name: 'address_street', type: 'string', isOptional: true },
            { name: 'address_postal_code', type: 'string', isOptional: true },
            { name: 'address_city', type: 'string', isOptional: true },
            { name: 'address_country', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v18 to v19: Add category snapshot fields to agenda_items
    {
      toVersion: 19,
      steps: [
        addColumns({
          table: 'agenda_items',
          columns: [
            { name: 'category_icon', type: 'string', isOptional: true },
            { name: 'category_name', type: 'string', isOptional: true },
            { name: 'form_type', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v19 to v20: Add categories to contacts (agenda category IDs)
    {
      toVersion: 20,
      steps: [
        addColumns({
          table: 'contacts',
          columns: [
            { name: 'categories', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v20 to v21: Add end_time, notes, source to agenda_items (ICS import)
    {
      toVersion: 21,
      steps: [
        addColumns({
          table: 'agenda_items',
          columns: [
            { name: 'end_time', type: 'string', isOptional: true },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'source', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v21 to v22: Add email to contacts (ICS calendar invitation via mail)
    {
      toVersion: 22,
      steps: [
        addColumns({
          table: 'contacts',
          columns: [
            { name: 'email', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v22 to v23: Add mobile_number to contacts (landline/mobile distinction)
    {
      toVersion: 23,
      steps: [
        addColumns({
          table: 'contacts',
          columns: [
            { name: 'mobile_number', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v23 to v24: Add personal contact details to user_profile (contact data sharing)
    {
      toVersion: 24,
      steps: [
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'email', type: 'string', isOptional: true },
            { name: 'mobile_number', type: 'string', isOptional: true },
            { name: 'landline_number', type: 'string', isOptional: true },
            { name: 'address_street', type: 'string', isOptional: true },
            { name: 'address_postal_code', type: 'string', isOptional: true },
            { name: 'address_city', type: 'string', isOptional: true },
            { name: 'address_country', type: 'string', isOptional: true },
            { name: 'birth_date', type: 'string', isOptional: true },
            { name: 'wedding_date', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v24 to v25: Add shared_data_consents table (per-contact data sharing consent)
    {
      toVersion: 25,
      steps: [
        createTable({
          name: 'shared_data_consents',
          columns: [
            { name: 'contact_jid', type: 'string', isIndexed: true },
            { name: 'is_sharing_enabled', type: 'boolean' },
            { name: 'consent_changed_at', type: 'number' },
            { name: 'last_synced_at', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    // Migration from v25 to v26: Add profile_version for profile sync
    {
      toVersion: 26,
      steps: [
        addColumns({
          table: 'contacts',
          columns: [
            { name: 'profile_version', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'profile_version', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v26 to v27: Split name into first_name + last_name on user_profile
    {
      toVersion: 27,
      steps: [
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'first_name', type: 'string' },
            { name: 'last_name', type: 'string' },
          ],
        }),
      ],
    },
    // Migration from v27 to v28: Add address_province to contacts and user_profile
    {
      toVersion: 28,
      steps: [
        addColumns({
          table: 'contacts',
          columns: [
            { name: 'address_province', type: 'string', isOptional: true },
          ],
        }),
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'address_province', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
