/**
 * Mail OAuth2 Client Configuration
 *
 * Contains OAuth2 client IDs for Google and Microsoft.
 * These are NOT secrets — mobile OAuth2 client IDs are public
 * (embedded in the app binary, no client_secret used).
 *
 * Setup:
 * 1. Google: Create iOS OAuth client at console.cloud.google.com
 *    - Application type: iOS
 *    - Bundle ID: com.commeazy.app (or your bundle identifier)
 *    - Download the reversed client ID for URL scheme
 *
 * 2. Microsoft: Register app at portal.azure.com > Azure AD > App registrations
 *    - Platform: iOS/macOS
 *    - Redirect URI: com.commeazy://oauth2redirect
 *    - Enable "Mobile and desktop applications"
 *
 * @see src/services/mail/oauth2Service.ts — Uses these values
 */

// ============================================================
// Google OAuth2 (Gmail)
// ============================================================

/**
 * Google OAuth2 Client ID for iOS.
 *
 * Obtain from Google Cloud Console:
 * 1. Go to console.cloud.google.com > APIs & Services > Credentials
 * 2. Create OAuth 2.0 Client ID (type: iOS)
 * 3. Set bundle ID to match Xcode project
 * 4. Enable Gmail API in API Library
 *
 * Format: XXXX.apps.googleusercontent.com
 */
export const GOOGLE_CLIENT_ID = '__GOOGLE_CLIENT_ID__';

// ============================================================
// Microsoft OAuth2 (Outlook / Hotmail / Live)
// ============================================================

/**
 * Microsoft OAuth2 Client ID (Application ID).
 *
 * Obtain from Azure Portal:
 * 1. Go to portal.azure.com > Azure Active Directory > App registrations
 * 2. New registration > Name: "CommEazy Mail"
 * 3. Supported account types: "Personal Microsoft accounts only"
 *    (for Outlook.com/Hotmail/Live)
 *    or "Accounts in any organizational directory + personal"
 *    (for both Office 365 and personal accounts)
 * 4. Add platform: iOS/macOS, Redirect URI: com.commeazy://oauth2redirect
 * 5. Under API permissions, add:
 *    - IMAP.AccessAsUser.All
 *    - SMTP.Send
 *    - offline_access
 *    - openid
 *    - email
 *
 * Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (UUID)
 */
export const MICROSOFT_CLIENT_ID = '__MICROSOFT_CLIENT_ID__';
