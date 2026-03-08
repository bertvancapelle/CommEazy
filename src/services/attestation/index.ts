/**
 * Attestation Service — Exports
 *
 * @see appAttest.ts — iOS App Attest native wrapper
 * @see tokenManager.ts — JWT token storage and renewal
 */

export {
  isAppAttestSupported,
  generateAttestKey,
  attestKey,
  generateAssertion,
} from './appAttest';

export {
  getAccessToken,
  performAttestation,
  clearTokens,
  hasValidTokens,
  getApiGatewayUrl,
} from './tokenManager';
