/**
 * UserProfile Model — WatermelonDB
 *
 * Stores current user settings (single row).
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, writer } from '@nozbe/watermelondb/decorators';
import type { SupportedLanguage, SubscriptionTier, AgeBracket, Gender } from '@/services/interfaces';

export class UserProfileModel extends Model {
  static table = 'user_profile';

  // Identity (UUID is stable, phone/name can change)
  @field('user_uuid') userUuid!: string;               // Stable identifier, never changes
  @field('jid') jid!: string;                          // = {userUuid}@commeazy.local
  @field('first_name') firstName!: string;              // Voornaam
  @field('last_name') lastName!: string;                // Achternaam
  @field('phone_number') phoneNumber!: string;         // Can change
  @field('public_key') publicKey!: string;

  // Preferences
  @field('language') language!: SupportedLanguage;
  @field('audio_feedback_enabled') audioFeedbackEnabled!: boolean;
  @field('haptic_feedback_enabled') hapticFeedbackEnabled!: boolean;
  @field('photo_path') photoPath?: string;             // Local file path to own avatar

  // Personal contact details (shareable with contacts via consent, v24)
  @field('email') email?: string;                        // E-mailadres
  @field('mobile_number') mobileNumber?: string;         // Mobiel nummer (apart van verificatie phoneNumber)
  @field('landline_number') landlineNumber?: string;     // Vast telefoonnummer
  @field('address_street') addressStreet?: string;       // Straat + huisnummer
  @field('address_postal_code') addressPostalCode?: string; // Postcode
  @field('address_city') addressCity?: string;           // Stad
  @field('address_country') addressCountry?: string;     // Land
  @field('address_province') addressProvince?: string;   // Provincie/staat (v28)
  @field('birth_date') birthDate?: string;               // Geboortedatum (ISO: YYYY-MM-DD)
  @field('wedding_date') weddingDate?: string;           // Trouwdatum (ISO: YYYY-MM-DD)

  // Subscription (freemium model)
  @field('subscription_tier') subscriptionTier!: SubscriptionTier;  // 'free' | 'premium'
  @field('subscription_expires') subscriptionExpires?: number;       // Timestamp when premium expires

  // Demographics (required for free, optional for premium)
  @field('country_code') countryCode?: string;         // ISO 3166-1: 'NL', 'BE', 'DE'
  @field('region_code') regionCode?: string;           // ISO 3166-2: 'NL-NH', 'BE-VLG'
  @field('city') city?: string;                        // Free text city name
  @field('age_bracket') ageBracket?: AgeBracket;       // '18-24', '25-34', etc.
  @field('gender') gender?: Gender;                    // 'male', 'female', 'other'

  // Hold-to-Navigate settings (accessibility)
  @field('long_press_delay') longPressDelay?: number;              // 500-3000ms, default 1000
  @field('menu_button_position_x') menuButtonPositionX?: number;   // 0-1 as % of screen width
  @field('menu_button_position_y') menuButtonPositionY?: number;   // 0-1 as % of screen height
  @field('edge_exclusion_size') edgeExclusionSize?: number;        // 0-100px, default 40
  @field('wheel_blur_intensity') wheelBlurIntensity?: number;      // 0-30, default 15 (v9)
  @field('wheel_dismiss_margin') wheelDismissMargin?: number;      // 20-100, default 50 (v9)

  // Granular feedback settings (v9)
  @field('haptic_intensity') hapticIntensity?: string;             // 'off'|'veryLight'|'light'|'normal'|'strong'
  @field('audio_feedback_boost') audioFeedbackBoost?: boolean;     // +20% volume boost

  // UI personalization (v10)
  @field('accent_color') accentColor?: string;                     // 'blue'|'green'|'purple'|'orange'|'red'

  // Voice commands (v11)
  @field('voice_commands_enabled') voiceCommandsEnabled?: boolean; // Two-finger long press activation

  // Call sound settings (v12)
  @field('ringtone_enabled') ringtoneEnabled?: boolean;             // Play ringtone for incoming calls
  @field('ringtone_sound') ringtoneSound?: string;                  // 'default'|'classic'|'gentle'|'urgent'
  @field('dial_tone_enabled') dialToneEnabled?: boolean;            // Play dial tone for outgoing calls
  @field('incoming_call_vibration') incomingCallVibration?: boolean; // Vibrate for incoming calls
  @field('outgoing_call_vibration') outgoingCallVibration?: boolean; // Vibrate when outgoing call connects

  // Profile sync version (v26): incremented on each profile change
  @field('profile_version') profileVersion?: number;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Update language preference
   */
  @writer async updateLanguage(newLanguage: SupportedLanguage): Promise<void> {
    await this.update(record => {
      record.language = newLanguage;
    });
  }

  /**
   * Update audio feedback setting
   */
  @writer async updateAudioFeedback(enabled: boolean): Promise<void> {
    await this.update(record => {
      record.audioFeedbackEnabled = enabled;
    });
  }

  /**
   * Update haptic feedback setting
   */
  @writer async updateHapticFeedback(enabled: boolean): Promise<void> {
    await this.update(record => {
      record.hapticFeedbackEnabled = enabled;
    });
  }

  /**
   * Update user name
   */
  @writer async updateName(newFirstName: string, newLastName: string): Promise<void> {
    await this.update(record => {
      record.firstName = newFirstName;
      record.lastName = newLastName;
    });
  }

  /**
   * Update phone number
   */
  @writer async updatePhoneNumber(newPhoneNumber: string): Promise<void> {
    await this.update(record => {
      record.phoneNumber = newPhoneNumber;
    });
  }

  /**
   * Update demographics (country, region, city, age bracket, gender)
   */
  @writer async updateDemographics(
    countryCode?: string,
    regionCode?: string,
    city?: string,
    ageBracket?: AgeBracket,
    gender?: Gender
  ): Promise<void> {
    await this.update(record => {
      if (countryCode !== undefined) record.countryCode = countryCode;
      if (regionCode !== undefined) record.regionCode = regionCode;
      if (city !== undefined) record.city = city;
      if (ageBracket !== undefined) record.ageBracket = ageBracket;
      if (gender !== undefined) record.gender = gender;
    });
  }

  /**
   * Update subscription tier
   */
  @writer async updateSubscription(
    tier: SubscriptionTier,
    expiresAt?: number
  ): Promise<void> {
    await this.update(record => {
      record.subscriptionTier = tier;
      record.subscriptionExpires = expiresAt;
    });
  }

  /**
   * Update Hold-to-Navigate settings
   */
  @writer async updateHoldToNavigateSettings(
    longPressDelay?: number,
    menuButtonPositionX?: number,
    menuButtonPositionY?: number,
    edgeExclusionSize?: number
  ): Promise<void> {
    await this.update(record => {
      if (longPressDelay !== undefined) record.longPressDelay = longPressDelay;
      if (menuButtonPositionX !== undefined) record.menuButtonPositionX = menuButtonPositionX;
      if (menuButtonPositionY !== undefined) record.menuButtonPositionY = menuButtonPositionY;
      if (edgeExclusionSize !== undefined) record.edgeExclusionSize = edgeExclusionSize;
    });
  }

  /**
   * Update accent color preference
   */
  @writer async updateAccentColor(newAccentColor: string): Promise<void> {
    await this.update(record => {
      record.accentColor = newAccentColor;
    });
  }

  /**
   * Update personal contact details (shareable with contacts via consent)
   */
  @writer async updatePersonalData(data: {
    email?: string;
    mobileNumber?: string;
    landlineNumber?: string;
    addressStreet?: string;
    addressPostalCode?: string;
    addressCity?: string;
    addressCountry?: string;
    addressProvince?: string;
    birthDate?: string;
    weddingDate?: string;
  }): Promise<void> {
    await this.update(record => {
      if (data.email !== undefined) record.email = data.email;
      if (data.mobileNumber !== undefined) record.mobileNumber = data.mobileNumber;
      if (data.landlineNumber !== undefined) record.landlineNumber = data.landlineNumber;
      if (data.addressStreet !== undefined) record.addressStreet = data.addressStreet;
      if (data.addressPostalCode !== undefined) record.addressPostalCode = data.addressPostalCode;
      if (data.addressCity !== undefined) record.addressCity = data.addressCity;
      if (data.addressCountry !== undefined) record.addressCountry = data.addressCountry;
      if (data.addressProvince !== undefined) record.addressProvince = data.addressProvince;
      if (data.birthDate !== undefined) record.birthDate = data.birthDate;
      if (data.weddingDate !== undefined) record.weddingDate = data.weddingDate;
    });
  }
}
