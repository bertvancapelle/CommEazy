/**
 * UserProfile Model — WatermelonDB
 *
 * Stores current user settings (single row).
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, writer } from '@nozbe/watermelondb/decorators';
import type { SupportedLanguage } from '@/services/interfaces';

export class UserProfileModel extends Model {
  static table = 'user_profile';

  @field('jid') jid!: string;
  @field('name') name!: string;
  @field('phone_number') phoneNumber!: string;
  @field('public_key') publicKey!: string;
  @field('language') language!: SupportedLanguage;
  @field('audio_feedback_enabled') audioFeedbackEnabled!: boolean;
  @field('haptic_feedback_enabled') hapticFeedbackEnabled!: boolean;
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
  @writer async updateName(newName: string): Promise<void> {
    await this.update(record => {
      record.name = newName;
    });
  }
}
