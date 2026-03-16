/**
 * Token Manager — JWT token storage and renewal
 *
 * Manages JWT access and refresh tokens for API Gateway authentication.
 * Tokens are stored in Keychain (WHEN_UNLOCKED accessibility).
 *
 * Flow:
 * 1. First launch: attestation → tokens stored
 * 2. Normal use: getAccessToken() returns cached token
 * 3. Token expired: automatic refresh via refresh token
 * 4. Refresh expired: re-attestation triggered
 *
 * @see TRUST_AND_ATTESTATION_PLAN.md section 3.2
 * @see TESTFLIGHT_SECURITY_HARDENING.md Item 2.1
 */

import { Platform } from 'react-native';
import { secureSet, secureGet, secureRemove, migrateFromAsyncStorage } from '../secureStorage';
import { isAppAttestSupported, generateAttestKey, attestKey } from './appAttest';

const LOG_PREFIX = '[tokenManager]';

// Secure storage keys (Keychain)
const KEYS = {
  ACCESS_TOKEN: 'jwt_access_token',
  REFRESH_TOKEN: 'jwt_refresh_token',
  ATTEST_KEY_ID: 'attest_key_id',
  TOKEN_EXPIRY: 'jwt_token_expiry',
};

// Legacy AsyncStorage keys (for migration)
const LEGACY_KEYS = {
  ACCESS_TOKEN: '@commeazy/jwt_access_token',
  REFRESH_TOKEN: '@commeazy/jwt_refresh_token',
  ATTEST_KEY_ID: '@commeazy/attest_key_id',
  TOKEN_EXPIRY: '@commeazy/jwt_token_expiry',
};

/**
 * Migrate tokens from AsyncStorage to Keychain (one-time, on app update).
 */
export async function migrateTokenStorage(): Promise<void> {
  await Promise.all([
    migrateFromAsyncStorage(LEGACY_KEYS.ACCESS_TOKEN, KEYS.ACCESS_TOKEN),
    migrateFromAsyncStorage(LEGACY_KEYS.REFRESH_TOKEN, KEYS.REFRESH_TOKEN),
    migrateFromAsyncStorage(LEGACY_KEYS.ATTEST_KEY_ID, KEYS.ATTEST_KEY_ID),
    migrateFromAsyncStorage(LEGACY_KEYS.TOKEN_EXPIRY, KEYS.TOKEN_EXPIRY),
  ]);
}

// API Gateway base URL (configurable for dev/production)
const API_GATEWAY_URL = __DEV__
  ? 'http://localhost:8443'
  : 'https://api.commeazy.com';

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * Get a valid access token, refreshing if necessary.
 * Returns null if no token is available (attestation needed).
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const [token, expiryStr] = await Promise.all([
      secureGet(KEYS.ACCESS_TOKEN),
      secureGet(KEYS.TOKEN_EXPIRY),
    ]);

    if (!token) return null;

    // Check if token is expired (with 5 min buffer)
    const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
    const now = Date.now();
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (now + bufferMs >= expiry) {
      console.debug(LOG_PREFIX, 'Token expired or expiring soon, refreshing');
      return await refreshAccessToken();
    }

    return token;
  } catch {
    console.warn(LOG_PREFIX, 'Failed to get access token');
    return null;
  }
}

/**
 * Refresh the access token using the stored refresh token.
 * Returns null if refresh fails (re-attestation needed).
 */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await secureGet(KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      console.debug(LOG_PREFIX, 'No refresh token, attestation needed');
      return null;
    }

    const response = await fetch(`${API_GATEWAY_URL}/api/v1/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      console.warn(LOG_PREFIX, 'Token refresh failed', { status: response.status });
      // Clear tokens — re-attestation needed
      await clearTokens();
      return null;
    }

    const data: TokenResponse = await response.json();
    await storeTokens(data);

    console.debug(LOG_PREFIX, 'Token refreshed successfully');
    return data.accessToken;
  } catch {
    console.warn(LOG_PREFIX, 'Token refresh request failed');
    return null;
  }
}

/**
 * Perform device attestation and obtain new tokens.
 *
 * @param userUuid - The user's UUID
 * @param appVersion - App version string
 */
export async function performAttestation(
  userUuid: string,
  appVersion: string,
): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      return await performIOSAttestation(userUuid, appVersion);
    } else if (Platform.OS === 'android') {
      return await performAndroidAttestation(userUuid, appVersion);
    }
    return false;
  } catch (error) {
    console.error(LOG_PREFIX, 'Attestation failed');
    return false;
  }
}

/**
 * iOS attestation flow using App Attest.
 */
async function performIOSAttestation(
  userUuid: string,
  appVersion: string,
): Promise<boolean> {
  const supported = await isAppAttestSupported();

  if (!supported) {
    console.warn(LOG_PREFIX, 'App Attest not supported, using dev mode');
    // In development, request token without attestation
    return await requestDevModeToken(userUuid, appVersion, 'ios');
  }

  // Check if we already have an attested key
  let keyId = await secureGet(KEYS.ATTEST_KEY_ID);

  if (!keyId) {
    // Generate and attest a new key
    console.debug(LOG_PREFIX, 'Generating new attestation key');
    keyId = await generateAttestKey();

    // Create challenge from userUuid + timestamp
    const challenge = `${userUuid}:${Date.now()}`;
    const attestation = await attestKey(keyId, challenge);

    // Send attestation to API Gateway
    const response = await fetch(`${API_GATEWAY_URL}/api/v1/attest/ios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyId,
        attestation,
        clientDataHash: challenge,
        userUuid,
        appVersion,
      }),
    });

    if (!response.ok) {
      console.error(LOG_PREFIX, 'iOS attestation rejected by gateway');
      return false;
    }

    const data: TokenResponse = await response.json();
    await secureSet(KEYS.ATTEST_KEY_ID, keyId);
    await storeTokens(data);

    console.info(LOG_PREFIX, 'iOS attestation successful');
    return true;
  }

  // Key exists — try to refresh or re-attest
  const token = await getAccessToken();
  if (token) return true;

  // Need re-attestation with existing key
  const challenge = `${userUuid}:${Date.now()}`;
  const attestation = await attestKey(keyId, challenge);

  const response = await fetch(`${API_GATEWAY_URL}/api/v1/attest/ios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyId,
      attestation,
      clientDataHash: challenge,
      userUuid,
      appVersion,
    }),
  });

  if (!response.ok) {
    // Key may be invalidated — generate new one
    await secureRemove(KEYS.ATTEST_KEY_ID);
    console.warn(LOG_PREFIX, 'Re-attestation failed, key invalidated');
    return false;
  }

  const data: TokenResponse = await response.json();
  await storeTokens(data);
  return true;
}

/**
 * Android attestation flow using Play Integrity (placeholder).
 */
async function performAndroidAttestation(
  userUuid: string,
  appVersion: string,
): Promise<boolean> {
  // TODO: Implement Play Integrity when Android development starts
  console.warn(LOG_PREFIX, 'Android attestation not yet implemented');
  return await requestDevModeToken(userUuid, appVersion, 'android');
}

/**
 * Development mode: request token without attestation.
 * Only works when API Gateway is in development mode.
 */
async function requestDevModeToken(
  userUuid: string,
  appVersion: string,
  platform: 'ios' | 'android',
): Promise<boolean> {
  try {
    const endpoint = platform === 'ios'
      ? '/api/v1/attest/ios'
      : '/api/v1/attest/android';

    const body = platform === 'ios'
      ? {
          keyId: `dev-${userUuid}`,
          attestation: 'development-mode',
          clientDataHash: 'development-mode',
          userUuid,
          appVersion,
        }
      : {
          integrityToken: `dev-${userUuid}`,
          userUuid,
          appVersion,
        };

    const response = await fetch(`${API_GATEWAY_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) return false;

    const data: TokenResponse = await response.json();
    await storeTokens(data);
    return true;
  } catch {
    console.warn(LOG_PREFIX, 'Dev mode token request failed');
    return false;
  }
}

/**
 * Store tokens in Keychain (WHEN_UNLOCKED accessibility).
 */
async function storeTokens(data: TokenResponse): Promise<void> {
  const expiry = Date.now() + data.expiresIn * 1000;

  await Promise.all([
    secureSet(KEYS.ACCESS_TOKEN, data.accessToken),
    secureSet(KEYS.TOKEN_EXPIRY, expiry.toString()),
    ...(data.refreshToken
      ? [secureSet(KEYS.REFRESH_TOKEN, data.refreshToken)]
      : []),
  ]);
}

/**
 * Clear all stored tokens (used on logout or attestation failure).
 */
export async function clearTokens(): Promise<void> {
  await Promise.all([
    secureRemove(KEYS.ACCESS_TOKEN),
    secureRemove(KEYS.REFRESH_TOKEN),
    secureRemove(KEYS.TOKEN_EXPIRY),
  ]);
}

/**
 * Check if the user has valid tokens (without network call).
 */
export async function hasValidTokens(): Promise<boolean> {
  const [token, expiryStr] = await Promise.all([
    secureGet(KEYS.ACCESS_TOKEN),
    secureGet(KEYS.TOKEN_EXPIRY),
  ]);

  if (!token) return false;

  const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
  return Date.now() < expiry;
}

/**
 * Get the API Gateway base URL.
 */
export function getApiGatewayUrl(): string {
  return API_GATEWAY_URL;
}
