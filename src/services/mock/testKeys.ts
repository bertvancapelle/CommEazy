/**
 * Test Keypairs for 2-Device Development Testing
 *
 * These are DETERMINISTIC test keypairs used for E2E encryption testing
 * between the two development devices (iPhone 17 Pro and iPhone 16e).
 *
 * SECURITY WARNING: These keys are PUBLIC and should NEVER be used in production!
 * They are included in the source code intentionally for development testing only.
 *
 * How it works:
 * - iPhone 17 Pro runs as 'ik@commeazy.local' and uses IK_KEYPAIR
 * - iPhone 16e runs as 'oma@commeazy.local' and uses OMA_KEYPAIR
 * - When 'ik' sends to 'oma', it encrypts with OMA_KEYPAIR.publicKey
 * - When 'oma' receives from 'ik', it decrypts using OMA_KEYPAIR.privateKey
 *
 * The keys are generated from deterministic seeds using crypto_box_seed_keypair.
 * This ensures both devices generate identical keypairs.
 */

import {
  crypto_box_seed_keypair,
  crypto_generichash,
  to_base64,
  from_base64,
  base64_variants,
  ready as sodiumReady,
} from 'react-native-libsodium';

// Seeds for deterministic key generation (32 bytes each, as UTF-8 hash)
const IK_SEED = 'commeazy_dev_test_keypair_ik_v1';
const OMA_SEED = 'commeazy_dev_test_keypair_oma_v1';
const TEST_SEED = 'commeazy_dev_test_keypair_test_v1';
const JEANINE_SEED = 'commeazy_dev_test_keypair_jeanine_v1';
const IPAD_SEED = 'commeazy_dev_test_keypair_ipad_v1';
const IPADPHYS_SEED = 'commeazy_dev_test_keypair_ipadphys_v1';

// Cached keypairs (generated once on first access)
let ikKeypairCache: { publicKey: string; privateKey: string } | null = null;
let omaKeypairCache: { publicKey: string; privateKey: string } | null = null;
let testKeypairCache: { publicKey: string; privateKey: string } | null = null;
let jeanineKeypairCache: { publicKey: string; privateKey: string } | null = null;
let ipadKeypairCache: { publicKey: string; privateKey: string } | null = null;
let ipadphysKeypairCache: { publicKey: string; privateKey: string } | null = null;
let sodiumReadyPromise: Promise<void> | null = null;

/**
 * Ensure libsodium is ready
 */
const ensureSodiumReady = async (): Promise<void> => {
  if (!sodiumReadyPromise) {
    sodiumReadyPromise = sodiumReady;
  }
  await sodiumReadyPromise;
};

/**
 * Generate a deterministic keypair from a seed string.
 * Uses BLAKE2b hash to convert string seed to 32-byte seed.
 */
const generateKeypairFromSeed = async (seedString: string): Promise<{ publicKey: string; privateKey: string }> => {
  await ensureSodiumReady();

  // Convert string to UTF-8 bytes and hash to get 32-byte seed
  const seedBytes = new Uint8Array(seedString.split('').map(c => c.charCodeAt(0)));
  const seed = crypto_generichash(32, seedBytes, null);

  // Generate keypair from seed
  const keypair = crypto_box_seed_keypair(seed);

  // Use ORIGINAL variant for consistent encoding/decoding
  return {
    publicKey: to_base64(keypair.publicKey, base64_variants.ORIGINAL),
    privateKey: to_base64(keypair.privateKey, base64_variants.ORIGINAL),
  };
};

/**
 * Get or generate the test keypair for 'ik@commeazy.local'.
 */
export const getIkKeypair = async (): Promise<{ publicKey: string; privateKey: string }> => {
  if (!__DEV__) throw new Error('Test keypairs only available in dev mode');

  if (!ikKeypairCache) {
    ikKeypairCache = await generateKeypairFromSeed(IK_SEED);
    console.log('[TestKeys] Generated IK keypair:', ikKeypairCache.publicKey.substring(0, 20) + '...');
  }
  return ikKeypairCache;
};

/**
 * Get or generate the test keypair for 'oma@commeazy.local'.
 */
export const getOmaKeypair = async (): Promise<{ publicKey: string; privateKey: string }> => {
  if (!__DEV__) throw new Error('Test keypairs only available in dev mode');

  if (!omaKeypairCache) {
    omaKeypairCache = await generateKeypairFromSeed(OMA_SEED);
    console.log('[TestKeys] Generated OMA keypair:', omaKeypairCache.publicKey.substring(0, 20) + '...');
  }
  return omaKeypairCache;
};

/**
 * Get or generate the test keypair for 'test@commeazy.local'.
 * Used for physical test devices (e.g., iPhone 14, Bert).
 */
export const getTestKeypair = async (): Promise<{ publicKey: string; privateKey: string }> => {
  if (!__DEV__) throw new Error('Test keypairs only available in dev mode');

  if (!testKeypairCache) {
    testKeypairCache = await generateKeypairFromSeed(TEST_SEED);
    console.log('[TestKeys] Generated TEST keypair:', testKeypairCache.publicKey.substring(0, 20) + '...');
  }
  return testKeypairCache;
};

/**
 * Get or generate the test keypair for 'jeanine@commeazy.local'.
 * Used for Jeanine's physical iPhone.
 */
export const getJeanineKeypair = async (): Promise<{ publicKey: string; privateKey: string }> => {
  if (!__DEV__) throw new Error('Test keypairs only available in dev mode');

  if (!jeanineKeypairCache) {
    jeanineKeypairCache = await generateKeypairFromSeed(JEANINE_SEED);
    console.log('[TestKeys] Generated JEANINE keypair:', jeanineKeypairCache.publicKey.substring(0, 20) + '...');
  }
  return jeanineKeypairCache;
};

/**
 * Get or generate the test keypair for 'ipad@commeazy.local'.
 * Used for iPad simulator testing.
 */
export const getIpadKeypair = async (): Promise<{ publicKey: string; privateKey: string }> => {
  if (!__DEV__) throw new Error('Test keypairs only available in dev mode');

  if (!ipadKeypairCache) {
    ipadKeypairCache = await generateKeypairFromSeed(IPAD_SEED);
    console.log('[TestKeys] Generated IPAD keypair:', ipadKeypairCache.publicKey.substring(0, 20) + '...');
  }
  return ipadKeypairCache;
};

/**
 * Get or generate the test keypair for 'ipadphys@commeazy.local'.
 * Used for physical iPad testing.
 */
export const getIpadPhysKeypair = async (): Promise<{ publicKey: string; privateKey: string }> => {
  if (!__DEV__) throw new Error('Test keypairs only available in dev mode');

  if (!ipadphysKeypairCache) {
    ipadphysKeypairCache = await generateKeypairFromSeed(IPADPHYS_SEED);
    console.log('[TestKeys] Generated IPADPHYS keypair:', ipadphysKeypairCache.publicKey.substring(0, 20) + '...');
  }
  return ipadphysKeypairCache;
};

/**
 * Get the test keypair for a given JID.
 * Returns null if the JID is not a test account.
 */
export const getTestKeypairForJid = async (jid: string): Promise<{ publicKey: string; privateKey: string } | null> => {
  if (!__DEV__) return null;

  switch (jid) {
    case 'ik@commeazy.local':
      return getIkKeypair();
    case 'oma@commeazy.local':
      return getOmaKeypair();
    case 'test@commeazy.local':
      return getTestKeypair();
    case 'jeanine@commeazy.local':
      return getJeanineKeypair();
    case 'ipad@commeazy.local':
      return getIpadKeypair();
    case 'ipadphys@commeazy.local':
      return getIpadPhysKeypair();
    default:
      return null;
  }
};

/**
 * Get the test public key for a contact JID.
 * Used to populate the publicKey field of test device contacts.
 */
export const getTestPublicKeyForJid = async (jid: string): Promise<string | null> => {
  const keypair = await getTestKeypairForJid(jid);
  return keypair?.publicKey ?? null;
};

/**
 * Get the other devices' public keys.
 * Returns a map of JID → publicKey for all other test devices.
 */
export const getOtherDevicesPublicKeys = async (myJid: string): Promise<Record<string, string>> => {
  if (!__DEV__) return {};

  const allTestJids = ['ik@commeazy.local', 'oma@commeazy.local', 'test@commeazy.local', 'jeanine@commeazy.local', 'ipad@commeazy.local', 'ipadphys@commeazy.local'];
  const otherJids = allTestJids.filter(jid => jid !== myJid);

  const result: Record<string, string> = {};
  for (const jid of otherJids) {
    const publicKey = await getTestPublicKeyForJid(jid);
    if (publicKey) {
      result[jid] = publicKey;
    }
  }
  return result;
};

/**
 * Get the other device's public key (for backward compatibility).
 * When running as 'ik', returns 'oma's public key and vice versa.
 * @deprecated Use getOtherDevicesPublicKeys for 3+ device support
 */
export const getOtherDevicePublicKey = async (myJid: string): Promise<string | null> => {
  if (!__DEV__) return null;

  const otherJid = myJid === 'ik@commeazy.local' ? 'oma@commeazy.local' : 'ik@commeazy.local';
  return getTestPublicKeyForJid(otherJid);
};
