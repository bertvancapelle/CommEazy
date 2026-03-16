/**
 * SharedDataConsent Model — WatermelonDB
 *
 * Per-contact consent record for sharing personal data.
 * One record per contact, all-or-nothing toggle.
 *
 * @see CONTACT_DATA_SHARING.md for architecture details
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, writer } from '@nozbe/watermelondb/decorators';

export class SharedDataConsentModel extends Model {
  static table = 'shared_data_consents';

  /** Contact JID this consent applies to */
  @field('contact_jid') contactJid!: string;
  /** Whether current user consents to share personal data with this contact */
  @field('is_sharing_enabled') isSharingEnabled!: boolean;
  /** Timestamp when consent was last changed */
  @field('consent_changed_at') consentChangedAt!: number;
  /** Timestamp when shared data was last synced to this contact */
  @field('last_synced_at') lastSyncedAt?: number;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Toggle sharing consent for this contact
   */
  @writer async toggleSharing(enabled: boolean): Promise<void> {
    await this.update(record => {
      record.isSharingEnabled = enabled;
      record.consentChangedAt = Date.now();
    });
  }

  /**
   * Mark that shared data was synced to this contact
   */
  @writer async markSynced(): Promise<void> {
    await this.update(record => {
      record.lastSyncedAt = Date.now();
    });
  }
}
