/**
 * Invitation Code Generator
 *
 * Generates human-friendly invitation codes in format CE-XXXX-XXXX.
 * Uses a 30-character alphabet that excludes visually confusing characters.
 *
 * Entropy: 30^8 ≈ 6.56 × 10^11 combinations
 * Combined with rate limiting (60/min) and 7-day TTL, brute-force is infeasible.
 *
 * @see TRUST_AND_ATTESTATION_PLAN.md section 2.2
 */

// Alphabet without confusing characters: 0/O, 1/I/L excluded
// 30 characters: 2-9 (8) + A-H,J-K,M-N,P-Z (22)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generate a cryptographically random invitation code.
 * Format: CE-XXXX-XXXX
 */
export function generateInvitationCode(): string {
  const bytes = new Uint8Array(8);
  // Use crypto.getRandomValues for cryptographic randomness
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Fallback: Math.random (less secure, only for development)
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let code = '';
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return `CE-${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

/**
 * Validate that a string matches the invitation code format.
 */
export function isValidInvitationCode(code: string): boolean {
  return /^CE-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}$/.test(code.toUpperCase());
}

/**
 * Normalize an invitation code (uppercase, trim, ensure dashes).
 * Handles user input like "ce a7k9 m2px" or "CEA7K9M2PX".
 */
export function normalizeInvitationCode(input: string): string {
  // Remove all whitespace and dashes, uppercase
  const clean = input.replace(/[\s-]/g, '').toUpperCase();

  // Must start with CE and have 8 more characters
  if (!clean.startsWith('CE') || clean.length !== 10) {
    return input.toUpperCase().trim();
  }

  // Re-format as CE-XXXX-XXXX
  return `CE-${clean.slice(2, 6)}-${clean.slice(6, 10)}`;
}
