/**
 * OAuth2 Service — Gmail and Outlook OAuth2 authentication flows
 *
 * Uses react-native-app-auth for the browser-based OAuth2 flow.
 * Handles authorization, token exchange, and token refresh.
 *
 * SECURITY:
 * - Client IDs loaded from environment config (never hardcoded)
 * - State parameter automatically managed by react-native-app-auth (CSRF protection)
 * - All tokens stored in Keychain via credentialManager
 * - PII (email, tokens) NEVER logged
 *
 * DEPENDENCY: react-native-app-auth must be installed:
 *   npm install react-native-app-auth && cd ios && pod install
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md — Fase 6
 */

import type { OAuth2TokenResponse, OAuth2ProviderConfig } from '@/types/mail';
import * as credentialManager from './credentialManager';

// ============================================================
// App Auth Library (dynamic import)
// ============================================================

/**
 * Lazily loaded react-native-app-auth module.
 * Dynamic require avoids crash if library is not yet installed.
 */
function getAppAuth(): {
  authorize: (config: AppAuthConfig) => Promise<AppAuthResult>;
  refresh: (config: AppAuthConfig, params: { refreshToken: string }) => Promise<AppAuthResult>;
} {
  try {
    return require('react-native-app-auth');
  } catch {
    throw new Error(
      '[oauth2Service] react-native-app-auth is not installed. ' +
      'Run: npm install react-native-app-auth && cd ios && pod install',
    );
  }
}

/** react-native-app-auth configuration type */
interface AppAuthConfig {
  issuer: string;
  clientId: string;
  redirectUrl: string;
  scopes: string[];
  usePKCE?: boolean;
  serviceConfiguration?: {
    authorizationEndpoint: string;
    tokenEndpoint: string;
  };
}

/** react-native-app-auth result type */
interface AppAuthResult {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  accessTokenExpirationDate: string;
  tokenType: string;
  scopes: string[];
}

// ============================================================
// OAuth2 Provider Configurations
// ============================================================

/**
 * Get the OAuth2 redirect URL for the app.
 * Uses the app's custom URL scheme.
 */
const REDIRECT_URL = 'com.commeazy://oauth2redirect';

/**
 * Gmail OAuth2 configuration.
 *
 * Scopes:
 * - https://mail.google.com/ — Full IMAP/SMTP access
 * - openid — OpenID Connect (user identity)
 * - email — User's email address
 * - profile — User's name (for display)
 *
 * Note: Client ID must be configured in environment config.
 * App Store review notes must declare the mail.google.com scope.
 */
function getGmailConfig(): OAuth2ProviderConfig {
  const clientId = getOAuth2ClientId('google');

  return {
    issuer: 'https://accounts.google.com',
    clientId,
    redirectUrl: REDIRECT_URL,
    scopes: [
      'https://mail.google.com/',
      'openid',
      'email',
      'profile',
    ],
  };
}

/**
 * Microsoft Outlook OAuth2 configuration.
 *
 * Scopes:
 * - IMAP.AccessAsUser.All — IMAP access
 * - SMTP.Send — SMTP send permission
 * - offline_access — Refresh token
 * - openid, email — User identity
 *
 * Note: Client ID must be configured in Azure AD / Microsoft Entra.
 */
function getOutlookConfig(): OAuth2ProviderConfig {
  const clientId = getOAuth2ClientId('microsoft');

  return {
    issuer: 'https://login.microsoftonline.com/common/v2.0',
    clientId,
    redirectUrl: REDIRECT_URL,
    scopes: [
      'https://outlook.office.com/IMAP.AccessAsUser.All',
      'https://outlook.office.com/SMTP.Send',
      'offline_access',
      'openid',
      'email',
    ],
  };
}

// ============================================================
// Client ID Management
// ============================================================

/**
 * Get OAuth2 client ID from environment config.
 *
 * Client IDs are stored in the app's environment config,
 * NOT hardcoded in source code.
 *
 * @param provider - 'google' or 'microsoft'
 * @returns Client ID string
 * @throws If client ID is not configured
 */
function getOAuth2ClientId(provider: 'google' | 'microsoft'): string {
  // Try to load from environment config
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('@/config/mailOAuth2Config');
    if (provider === 'google' && config.GOOGLE_CLIENT_ID) {
      return config.GOOGLE_CLIENT_ID;
    }
    if (provider === 'microsoft' && config.MICROSOFT_CLIENT_ID) {
      return config.MICROSOFT_CLIENT_ID;
    }
  } catch {
    // Config not yet created
  }

  throw new Error(
    `[oauth2Service] OAuth2 client ID for ${provider} is not configured. ` +
    'Create src/config/mailOAuth2Config.ts with the client IDs.',
  );
}

// ============================================================
// Authorization Flows
// ============================================================

/**
 * Get the OAuth2 configuration for a provider.
 *
 * @param providerId - 'gmail' or 'outlook'
 * @returns OAuth2 provider configuration
 */
export function getOAuth2Config(providerId: string): OAuth2ProviderConfig {
  switch (providerId) {
    case 'gmail':
      return getGmailConfig();
    case 'outlook':
      return getOutlookConfig();
    default:
      throw new Error(`[oauth2Service] Unknown OAuth2 provider: ${providerId}`);
  }
}

/**
 * Start OAuth2 authorization flow for a provider.
 *
 * Opens a browser window for the user to authenticate with Google/Microsoft.
 * Returns tokens on success.
 *
 * @param providerId - 'gmail' or 'outlook'
 * @returns OAuth2 token response
 * @throws On user cancellation or auth failure
 */
export async function authorize(
  providerId: string,
): Promise<OAuth2TokenResponse> {
  const config = getOAuth2Config(providerId);
  const appAuth = getAppAuth();

  const appAuthConfig: AppAuthConfig = {
    issuer: config.issuer,
    clientId: config.clientId,
    redirectUrl: config.redirectUrl,
    scopes: config.scopes,
    usePKCE: true,
  };

  console.debug('[oauth2Service] Starting authorization flow for provider');

  const result = await appAuth.authorize(appAuthConfig);

  return mapAuthResult(result);
}

/**
 * Refresh an expired OAuth2 access token.
 *
 * Uses the stored refresh token to obtain a new access token
 * without requiring user interaction.
 *
 * @param providerId - 'gmail' or 'outlook'
 * @param refreshToken - Current refresh token
 * @returns New token response
 * @throws If refresh fails (user may need to re-authorize)
 */
export async function refreshAccessToken(
  providerId: string,
  refreshToken: string,
): Promise<OAuth2TokenResponse> {
  const config = getOAuth2Config(providerId);
  const appAuth = getAppAuth();

  const appAuthConfig: AppAuthConfig = {
    issuer: config.issuer,
    clientId: config.clientId,
    redirectUrl: config.redirectUrl,
    scopes: config.scopes,
  };

  console.debug('[oauth2Service] Refreshing access token');

  const result = await appAuth.refresh(appAuthConfig, { refreshToken });

  return mapAuthResult(result);
}

// ============================================================
// Token Refresh for Existing Accounts
// ============================================================

/**
 * Ensure an account has a valid (non-expired) access token.
 *
 * If the token is expired or about to expire (within 60s),
 * automatically refreshes it and updates the Keychain.
 *
 * @param accountId - Account identifier
 * @param providerId - Provider identifier ('gmail' or 'outlook')
 * @returns Updated credentials with fresh access token
 * @throws If token refresh fails
 */
export async function ensureValidToken(
  accountId: string,
  providerId: string,
): Promise<{
  accessToken: string;
  refreshed: boolean;
}> {
  const credentials = await credentialManager.getCredentials(accountId);

  if (!credentials || credentials.type !== 'oauth2') {
    throw new Error('[oauth2Service] No OAuth2 credentials found for account');
  }

  // Check if token needs refresh
  if (!credentialManager.needsTokenRefresh(credentials)) {
    return {
      accessToken: credentials.accessToken!,
      refreshed: false,
    };
  }

  // Token expired or about to expire — refresh it
  if (!credentials.refreshToken) {
    throw new Error(
      '[oauth2Service] No refresh token available. User must re-authorize.',
    );
  }

  const newTokens = await refreshAccessToken(
    providerId,
    credentials.refreshToken,
  );

  // Update tokens in Keychain
  await credentialManager.updateOAuth2Tokens(
    accountId,
    newTokens.accessToken,
    newTokens.refreshToken,
    newTokens.expiresAt,
  );

  return {
    accessToken: newTokens.accessToken,
    refreshed: true,
  };
}

// ============================================================
// Helpers
// ============================================================

/**
 * Map react-native-app-auth result to our OAuth2TokenResponse type.
 */
function mapAuthResult(result: AppAuthResult): OAuth2TokenResponse {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken || undefined,
    expiresAt: new Date(result.accessTokenExpirationDate).getTime(),
    idToken: result.idToken || undefined,
    tokenType: result.tokenType || 'Bearer',
  };
}

/**
 * Extract email from an OpenID Connect ID token.
 * Decodes the JWT payload (no signature verification needed —
 * token was received directly from the authorization server).
 *
 * @param idToken - JWT ID token
 * @returns Email address or null
 */
export function extractEmailFromIdToken(idToken: string): string | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;

    // Base64url decode the payload
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const decoded = JSON.parse(
      // Global atob is available in React Native (Hermes)
      decodeURIComponent(
        atob(payload)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      ),
    );

    return decoded.email || decoded.preferred_username || null;
  } catch {
    return null;
  }
}
