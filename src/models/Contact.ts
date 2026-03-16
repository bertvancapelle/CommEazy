/**
 * Contact Model — WatermelonDB
 *
 * Stores contact information including public keys for encryption,
 * address details, and important dates.
 */

import { Model, Q } from '@nozbe/watermelondb';
import { field, date, readonly, writer } from '@nozbe/watermelondb/decorators';

export class ContactModel extends Model {
  static table = 'contacts';

  @field('user_uuid') userUuid!: string;    // Stable identifier (never changes)
  @field('jid') jid!: string;               // = {userUuid}@commeazy.local
  @field('first_name') firstName!: string;
  @field('last_name') lastName!: string;
  @field('phone_number') phoneNumber?: string;  // Optional landline (privacy: can be hidden)
  @field('mobile_number') mobileNumber?: string;  // Optional mobile phone (v23)
  @field('email') email?: string;              // Optional email address (v22)
  @field('public_key') publicKey!: string; // Base64
  @field('verified') verified!: boolean; // QR verified
  @field('last_seen') lastSeen!: number;
  @field('photo_path') photoPath?: string;  // Local file path to avatar
  // Address fields (all optional)
  @field('address_street') addressStreet?: string;
  @field('address_postal_code') addressPostalCode?: string;
  @field('address_city') addressCity?: string;
  @field('address_country') addressCountry?: string;
  // Important dates (ISO date strings: "YYYY-MM-DD")
  @field('birth_date') birthDate?: string;
  @field('wedding_date') weddingDate?: string;
  @field('death_date') deathDate?: string;
  @field('is_deceased') isDeceased?: boolean;
  // Emergency contact (v15)
  @field('is_emergency_contact') isEmergencyContact?: boolean;
  // Trust level (v16): 0=Unknown, 1=Invited, 2=Connected, 3=Verified
  @field('trust_level') trustLevel!: number;
  // Agenda categories (v20): JSON array of AgendaCategoryId strings
  @field('categories') categories?: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /** Get full display name */
  get displayName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  /** Get agenda category IDs as array */
  get categoryIds(): string[] {
    if (!this.categories) return [];
    try {
      return JSON.parse(this.categories);
    } catch {
      return [];
    }
  }

  /**
   * Update agenda categories for this contact
   */
  @writer async updateCategories(categoryIds: string[]): Promise<void> {
    await this.update(record => {
      record.categories = categoryIds.length > 0 ? JSON.stringify(categoryIds) : undefined;
    });
  }

  /**
   * Mark contact as verified (via QR code scan) — sets trust level to 3
   */
  @writer async markVerified(): Promise<void> {
    await this.update(record => {
      record.verified = true;
      record.trustLevel = 3;
    });
  }

  /**
   * Update trust level
   * 0 = Unknown (manual add, no CommEazy)
   * 1 = Invited (invitation sent, not yet accepted)
   * 2 = Connected (invitation accepted via relay)
   * 3 = Verified (QR code scan, highest trust)
   */
  @writer async setTrustLevel(level: number): Promise<void> {
    await this.update(record => {
      record.trustLevel = level;
      if (level >= 3) {
        record.verified = true;
      }
    });
  }

  /**
   * Update last seen timestamp
   */
  @writer async updateLastSeen(timestamp?: number): Promise<void> {
    await this.update(record => {
      record.lastSeen = timestamp ?? Date.now();
    });
  }

  /**
   * Update contact name
   */
  @writer async updateName(newFirstName: string, newLastName: string): Promise<void> {
    await this.update(record => {
      record.firstName = newFirstName;
      record.lastName = newLastName;
    });
  }

  /**
   * Update contact address
   */
  @writer async updateAddress(address: {
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  }): Promise<void> {
    await this.update(record => {
      record.addressStreet = address.street;
      record.addressPostalCode = address.postalCode;
      record.addressCity = address.city;
      record.addressCountry = address.country;
    });
  }

  /**
   * Toggle emergency contact (ICE) status
   */
  @writer async setEmergencyContact(isICE: boolean): Promise<void> {
    await this.update(record => {
      record.isEmergencyContact = isICE;
    });
  }

  /**
   * Update contact dates
   */
  @writer async updateDates(dates: {
    birthDate?: string;
    weddingDate?: string;
    deathDate?: string;
    isDeceased?: boolean;
  }): Promise<void> {
    await this.update(record => {
      record.birthDate = dates.birthDate;
      record.weddingDate = dates.weddingDate;
      record.deathDate = dates.deathDate;
      record.isDeceased = dates.isDeceased;
    });
  }

  /**
   * Query contact by JID
   */
  static queryByJid(collection: ContactModel['collection'], jid: string) {
    return collection.query(Q.where('jid', jid));
  }

  /**
   * Query contact by UUID
   */
  static queryByUuid(collection: ContactModel['collection'], userUuid: string) {
    return collection.query(Q.where('user_uuid', userUuid));
  }

  /**
   * Query all contacts, sorted by first name
   */
  static queryAll(collection: ContactModel['collection']) {
    return collection.query(Q.sortBy('first_name', Q.asc));
  }
}
