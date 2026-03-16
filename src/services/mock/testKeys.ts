/**
 * Test Keypairs for Multi-Device Development Testing
 *
 * These are DETERMINISTIC test keypairs used for E2E encryption testing
 * between development devices (physical + simulator).
 *
 * SECURITY WARNING: These keys are PUBLIC and should NEVER be used in production!
 * They are included in the source code intentionally for development testing only.
 *
 * Test devices (physical):
 * - bert@commeazy.local: iPhone 14 (physical, Bert)
 * - jeanine@commeazy.local: iPhone 12 (physical, Jeanine)
 * - pipo@commeazy.local: iPad (physical, Pipo)
 *
 * Test devices (simulator):
 * - sim1@commeazy.local: iPhone 17 Pro (simulator)
 * - sim2@commeazy.local: iPhone 16e (simulator)
 * - simipad@commeazy.local: iPad (simulator)
 *
 * The keys are generated from deterministic seeds using crypto_box_seed_keypair.
 * This ensures all devices generate identical keypairs.
 *
 * NOTE: Seeds are intentionally kept at their original values to preserve
 * keypair continuity. The seed string does NOT need to match the JID.
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
// Seeds are kept at original values for keypair continuity across JID rename
const BERT_SEED = 'commeazy_dev_test_keypair_test_v1';       // was TEST_SEED (bert = old test@)
const JEANINE_SEED = 'commeazy_dev_test_keypair_jeanine_v1'; // unchanged
const PIPO_SEED = 'commeazy_dev_test_keypair_ipadphys_v1';   // was IPADPHYS_SEED (pipo = old ipadphys@)
const SIM1_SEED = 'commeazy_dev_test_keypair_ik_v1';         // was IK_SEED (sim1 = old ik@)
const SIM2_SEED = 'commeazy_dev_test_keypair_oma_v1';        // was OMA_SEED (sim2 = old oma@)
const SIMIPAD_SEED = 'commeazy_dev_test_keypair_ipad_v1';    // was IPAD_SEED (simipad = old ipad@)

// Cached keypairs (generated once on first access)
let bertKeypairCache: { publicKey: string; privateKey: string } | null = null;
let jeanineKeypairCache: { publicKey: string; privateKey: string } | null = null;
let pipoKeypairCache: { publicKey: string; privateKey: string } | null = null;
let sim1KeypairCache: { publicKey: string; privateKey: string } | null = null;
let sim2KeypairCache: { publicKey: string; privateKey: string } | null = null;
let simipadKeypairCache: { publicKey: string; privateKey: string } | null = null;
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
 * Get or generate the test keypair for 'bert@commeazy.local'.
 * Physical iPhone 14 (Bert).
 */
export const getBertKeypair = async (): Promise<{ publicKey: string; privateKey: string }> => {
  if (!__DEV__) throw new Error('Test keypairs only available in dev mode');

  if (!bertKeypairCache) {
    bertKeypairCache = await generateKeypairFromSeed(BERT_SEED);
    console.log('[TestKeys] Generated BERT keypair:', bertKeypairCache.publicKey.substring(0, 20) + '...');
  }
  return bertKeypairCache;
};

/**
 * Get or generate the test keypair for 'jeanine@commeazy.local'.
 * Physical iPhone 12 (Jeanine).
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
 * Get or generate the test keypair for 'pipo@commeazy.local'.
 * Physical iPad (Pipo).
 */
export const getPipoKeypair = async (): Promise<{ publicKey: string; privateKey: string }> => {
  if (!__DEV__) throw new Error('Test keypairs only available in dev mode');

  if (!pipoKeypairCache) {
    pipoKeypairCache = await generateKeypairFromSeed(PIPO_SEED);
    console.log('[TestKeys] Generated PIPO keypair:', pipoKeypairCache.publicKey.substring(0, 20) + '...');
  }
  return pipoKeypairCache;
};

/**
 * Get or generate the test keypair for 'sim1@commeazy.local'.
 * iPhone 17 Pro simulator.
 */
export const getSim1Keypair = async (): Promise<{ publicKey: string; privateKey: string }> => {
  if (!__DEV__) throw new Error('Test keypairs only available in dev mode');

  if (!sim1KeypairCache) {
    sim1KeypairCache = await generateKeypairFromSeed(SIM1_SEED);
    console.log('[TestKeys] Generated SIM1 keypair:', sim1KeypairCache.publicKey.substring(0, 20) + '...');
  }
  return sim1KeypairCache;
};

/**
 * Get or generate the test keypair for 'sim2@commeazy.local'.
 * iPhone 16e simulator.
 */
export const getSim2Keypair = async (): Promise<{ publicKey: string; privateKey: string }> => {
  if (!__DEV__) throw new Error('Test keypairs only available in dev mode');

  if (!sim2KeypairCache) {
    sim2KeypairCache = await generateKeypairFromSeed(SIM2_SEED);
    console.log('[TestKeys] Generated SIM2 keypair:', sim2KeypairCache.publicKey.substring(0, 20) + '...');
  }
  return sim2KeypairCache;
};

/**
 * Get or generate the test keypair for 'simipad@commeazy.local'.
 * iPad simulator.
 */
export const getSimipadKeypair = async (): Promise<{ publicKey: string; privateKey: string }> => {
  if (!__DEV__) throw new Error('Test keypairs only available in dev mode');

  if (!simipadKeypairCache) {
    simipadKeypairCache = await generateKeypairFromSeed(SIMIPAD_SEED);
    console.log('[TestKeys] Generated SIMIPAD keypair:', simipadKeypairCache.publicKey.substring(0, 20) + '...');
  }
  return simipadKeypairCache;
};

/**
 * Get the test keypair for a given JID.
 * Returns null if the JID is not a test account.
 */
export const getTestKeypairForJid = async (jid: string): Promise<{ publicKey: string; privateKey: string } | null> => {
  if (!__DEV__) return null;

  switch (jid) {
    case 'bert@commeazy.local':
      return getBertKeypair();
    case 'jeanine@commeazy.local':
      return getJeanineKeypair();
    case 'pipo@commeazy.local':
      return getPipoKeypair();
    case 'sim1@commeazy.local':
      return getSim1Keypair();
    case 'sim2@commeazy.local':
      return getSim2Keypair();
    case 'simipad@commeazy.local':
      return getSimipadKeypair();
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

  const allTestJids = ['bert@commeazy.local', 'jeanine@commeazy.local', 'pipo@commeazy.local', 'sim1@commeazy.local', 'sim2@commeazy.local', 'simipad@commeazy.local'];
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
