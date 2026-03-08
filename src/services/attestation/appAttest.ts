/**
 * App Attest Service — iOS App Attest wrapper
 *
 * Wraps the native AppAttestModule for React Native.
 * Handles key generation, attestation, and assertion generation.
 *
 * @see ios/AppAttestModule.swift for native implementation
 * @see TRUST_AND_ATTESTATION_PLAN.md section 3.1
 */

import { NativeModules, Platform } from 'react-native';

const { AppAttestModule } = NativeModules;

const LOG_PREFIX = '[appAttest]';

/**
 * Check if App Attest is supported on this device.
 * Returns false on Android and iOS <14.
 */
export async function isAppAttestSupported(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;

  try {
    return await AppAttestModule.isSupported();
  } catch {
    console.warn(LOG_PREFIX, 'isSupported check failed');
    return false;
  }
}

/**
 * Generate a new attestation key pair.
 * The keyId should be stored for future attestation and assertion calls.
 */
export async function generateAttestKey(): Promise<string> {
  if (Platform.OS !== 'ios') {
    throw new Error('App Attest is only available on iOS');
  }

  return await AppAttestModule.generateKey();
}

/**
 * Attest a key with Apple's servers.
 *
 * @param keyId - Key ID from generateAttestKey()
 * @param challenge - Server challenge string to hash
 * @returns Base64-encoded attestation object
 */
export async function attestKey(keyId: string, challenge: string): Promise<string> {
  if (Platform.OS !== 'ios') {
    throw new Error('App Attest is only available on iOS');
  }

  // Hash the challenge to create clientDataHash
  const clientDataHash = await AppAttestModule.sha256Hash(challenge);
  return await AppAttestModule.attestKey(keyId, clientDataHash);
}

/**
 * Generate a signed assertion for an already-attested key.
 *
 * @param keyId - The attested key ID
 * @param requestData - Data to sign (typically request body hash)
 * @returns Base64-encoded assertion object
 */
export async function generateAssertion(keyId: string, requestData: string): Promise<string> {
  if (Platform.OS !== 'ios') {
    throw new Error('App Attest is only available on iOS');
  }

  const clientDataHash = await AppAttestModule.sha256Hash(requestData);
  return await AppAttestModule.generateAssertion(keyId, clientDataHash);
}
