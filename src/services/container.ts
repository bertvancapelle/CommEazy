/**
 * CommEazy Service Container
 *
 * Singleton service registry for dependency injection.
 * Solo-dev friendly: no framework overhead, just typed getters.
 *
 * Usage:
 *   const xmpp = ServiceContainer.xmpp;
 *   const db = ServiceContainer.database;
 *   const crypto = ServiceContainer.encryption;
 *
 * Initialization (in App.tsx):
 *   await ServiceContainer.initialize();
 */

import type {
  DatabaseService,
  EncryptionService,
  XMPPService,
  NotificationService,
} from './interfaces';
import { SodiumEncryptionService } from './encryption';
import { XmppJsService } from './xmpp';
// TODO: import { WatermelonDBService } from './database/watermelondb';
// TODO: import { FCMNotificationService } from './notifications';

class ServiceContainerClass {
  private _encryption: EncryptionService | null = null;
  private _xmpp: XMPPService | null = null;
  private _database: DatabaseService | null = null;
  private _notifications: NotificationService | null = null;
  private _initialized = false;

  /**
   * Initialize all services in correct order.
   * Call once at app startup (App.tsx).
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    // 1. Encryption first (needed for database encryption key)
    this._encryption = new SodiumEncryptionService();
    await this._encryption.initialize();

    // 2. Database (encrypted with key from encryption service)
    // TODO: Uncomment when WatermelonDB implementation is ready
    // this._database = new WatermelonDBService();
    // const dbKey = await this._encryption.getDatabaseKey();
    // await this._database.initialize(dbKey);

    // 3. XMPP (needs encryption for message handling)
    this._xmpp = new XmppJsService();

    // 4. Notifications
    // TODO: Uncomment when FCM implementation is ready
    // this._notifications = new FCMNotificationService();
    // await this._notifications.initialize();

    this._initialized = true;
  }

  get encryption(): EncryptionService {
    this.ensureInitialized();
    return this._encryption!;
  }

  get xmpp(): XMPPService {
    this.ensureInitialized();
    return this._xmpp!;
  }

  get database(): DatabaseService {
    this.ensureInitialized();
    if (!this._database) throw new Error('DatabaseService not yet implemented');
    return this._database!;
  }

  get notifications(): NotificationService {
    this.ensureInitialized();
    if (!this._notifications) throw new Error('NotificationService not yet implemented');
    return this._notifications!;
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  /** Reset all services (for testing) */
  async reset(): Promise<void> {
    if (this._xmpp) await (this._xmpp as XmppJsService).disconnect();
    this._encryption = null;
    this._xmpp = null;
    this._database = null;
    this._notifications = null;
    this._initialized = false;
  }

  private ensureInitialized(): void {
    if (!this._initialized) {
      throw new Error('ServiceContainer not initialized — call initialize() first');
    }
  }
}

/** Singleton instance */
export const ServiceContainer = new ServiceContainerClass();
