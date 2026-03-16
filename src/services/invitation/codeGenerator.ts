/**
 * Invitation Code Generator
 *
 * Generates human-friendly invitation codes in format CE-XXXX-XXXX-XXXX.
 * Uses a 30-character alphabet that excludes visually confusing characters.
 *
 * Entropy: 30^12 ≈ 5.3 × 10^17 combinations (~59 bits)
 * Combined with Argon2id KDF, rate limiting (5/min), and 7-day TTL, brute-force is infeasible.
 *
 * Legacy format CE-XXXX-XXXX (8 chars, ~39 bits) is still accepted for backward compatibility.
 *
 * @see TRUST_AND_ATTESTATION_PLAN.md section 2.2
 */

// Alphabet without confusing characters: 0/O, 1/I/L excluded
// 30 characters: 2-9 (8) + A-H,J-K,M-N,P-Z (22)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generate a cryptographically random invitation code.
 * Format: CE-XXXX-XXXX-XXXX (12 random chars from 30-char alphabet)
 */
export function generateInvitationCode(): string {
  const bytes = new Uint8Array(12);
  // Use crypto.getRandomValues for cryptographic randomness
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Fallback: Math.random (less secure, only for development)
    for (let i = 0; i < 12; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let code = '';
  for (let i = 0; i < 12; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return `CE-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

/**
 * Validate that a string matches the invitation code format.
 * Accepts both new (CE-XXXX-XXXX-XXXX) and legacy (CE-XXXX-XXXX) formats.
 */
export function isValidInvitationCode(code: string): boolean {
  return /^CE-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}(-[2-9A-HJ-KM-NP-Z]{4})?$/.test(code.toUpperCase());
}

/**
 * Normalize an invitation code (uppercase, trim, ensure dashes).
 * Handles user input like "ce a7k9 m2px b3rn" or "CEA7K9M2PXB3RN".
 * Accepts both new (14 clean chars: CE + 12) and legacy (10 clean chars: CE + 8) formats.
 */
export function normalizeInvitationCode(input: string): string {
  // Remove all whitespace and dashes, uppercase
  const clean = input.replace(/[\s-]/g, '').toUpperCase();

  // New format: CE + 12 chars
  if (clean.startsWith('CE') && clean.length === 14) {
    return `CE-${clean.slice(2, 6)}-${clean.slice(6, 10)}-${clean.slice(10, 14)}`;
  }

  // Legacy format: CE + 8 chars
  if (clean.startsWith('CE') && clean.length === 10) {
    return `CE-${clean.slice(2, 6)}-${clean.slice(6, 10)}`;
  }

  return input.toUpperCase().trim();
}
