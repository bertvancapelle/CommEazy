/**
 * Jest Setup File
 *
 * Configure global mocks for React Native modules
 */

// Silence console during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    // Keep error and warn for important messages
    // log: jest.fn(),
    // debug: jest.fn(),
    // info: jest.fn(),
  };
}

// Mock react-native-keychain
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn().mockResolvedValue(true),
  getGenericPassword: jest.fn().mockResolvedValue(null),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  SECURITY_LEVEL: {
    ANY: 'ANY',
    SECURE_SOFTWARE: 'SECURE_SOFTWARE',
    SECURE_HARDWARE: 'SECURE_HARDWARE',
  },
  ACCESSIBLE: {
    WHEN_UNLOCKED: 'WHEN_UNLOCKED',
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  },
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: {
      language: 'en',
      changeLanguage: jest.fn(),
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
  Trans: ({ children }) => children,
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock react-native-haptic-feedback
jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
  HapticFeedbackTypes: {
    impactLight: 'impactLight',
    impactMedium: 'impactMedium',
    impactHeavy: 'impactHeavy',
    selection: 'selection',
    notificationSuccess: 'notificationSuccess',
    notificationWarning: 'notificationWarning',
    notificationError: 'notificationError',
  },
}));

// Mock @nozbe/watermelondb
jest.mock('@nozbe/watermelondb', () => ({
  Database: jest.fn(),
  Model: class MockModel {
    static table = '';
    static associations = {};
  },
  Q: {
    where: jest.fn(),
    sortBy: jest.fn(),
    take: jest.fn(),
    and: jest.fn(),
    or: jest.fn(),
    gt: jest.fn(),
    lt: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
    eq: jest.fn(),
    notEq: jest.fn(),
    oneOf: jest.fn(),
    notIn: jest.fn(),
    like: jest.fn(),
    notLike: jest.fn(),
    sanitizeLikeString: jest.fn((s) => s),
  },
  appSchema: jest.fn((schema) => schema),
  tableSchema: jest.fn((schema) => schema),
}));

jest.mock('@nozbe/watermelondb/adapters/sqlite', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock decorators from WatermelonDB
jest.mock('@nozbe/watermelondb/decorators', () => ({
  field: () => () => {},
  text: () => () => {},
  date: () => () => {},
  readonly: () => () => {},
  children: () => () => {},
  immutableRelation: () => () => {},
  relation: () => () => {},
  action: () => () => {},
  writer: () => () => {},
  reader: () => () => {},
  lazy: () => () => {},
  json: () => () => {},
  nochange: () => () => {},
}));

// Mock @nozbe/with-observables
jest.mock('@nozbe/with-observables', () => ({
  __esModule: true,
  default: () => (component) => component,
}));

// Mock libsodium-wrappers with comprehensive functions
jest.mock('libsodium-wrappers', () => {
  const mockSodium = {
    ready: Promise.resolve(),
    crypto_box_NONCEBYTES: 24,
    crypto_box_PUBLICKEYBYTES: 32,
    crypto_box_SECRETKEYBYTES: 32,
    crypto_secretbox_KEYBYTES: 32,
    crypto_secretbox_NONCEBYTES: 24,
    crypto_pwhash_SALTBYTES: 16,
    crypto_pwhash_OPSLIMIT_INTERACTIVE: 2,
    crypto_pwhash_MEMLIMIT_INTERACTIVE: 67108864,
    crypto_pwhash_ALG_DEFAULT: 2,

    randombytes_buf: jest.fn((size) => new Uint8Array(size).fill(0)),

    crypto_box_keypair: jest.fn(() => ({
      publicKey: new Uint8Array(32).fill(1),
      privateKey: new Uint8Array(32).fill(2),
      keyType: 'x25519',
    })),

    crypto_box_easy: jest.fn((message, nonce, recipientPubKey, senderPrivKey) => {
      // Return ciphertext (message + 16 bytes auth tag)
      const ciphertext = new Uint8Array(message.length + 16);
      ciphertext.set(message);
      return ciphertext;
    }),

    crypto_box_open_easy: jest.fn((ciphertext, nonce, senderPubKey, recipientPrivKey) => {
      // Return decrypted message (ciphertext - 16 bytes auth tag)
      return ciphertext.slice(0, ciphertext.length - 16);
    }),

    crypto_secretbox_easy: jest.fn((message, nonce, key) => {
      const ciphertext = new Uint8Array(message.length + 16);
      ciphertext.set(message);
      return ciphertext;
    }),

    crypto_secretbox_open_easy: jest.fn((ciphertext, nonce, key) => {
      return ciphertext.slice(0, ciphertext.length - 16);
    }),

    crypto_secretbox_keygen: jest.fn(() => new Uint8Array(32).fill(3)),

    crypto_pwhash: jest.fn((keyLength, password, salt, opsLimit, memLimit, alg) => {
      // Return a derived key
      return new Uint8Array(keyLength).fill(4);
    }),

    memzero: jest.fn((arr) => {
      if (arr && arr.fill) {
        arr.fill(0);
      }
    }),

    to_base64: jest.fn((arr) => {
      // Simple mock: return a consistent base64-like string
      return Buffer.from(arr).toString('base64');
    }),

    from_base64: jest.fn((str) => {
      return new Uint8Array(Buffer.from(str, 'base64'));
    }),

    to_hex: jest.fn((arr) => {
      return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    }),

    from_hex: jest.fn((str) => {
      const bytes = [];
      for (let i = 0; i < str.length; i += 2) {
        bytes.push(parseInt(str.substr(i, 2), 16));
      }
      return new Uint8Array(bytes);
    }),

    from_string: jest.fn((str) => {
      return new TextEncoder().encode(str);
    }),

    to_string: jest.fn((arr) => {
      return new TextDecoder().decode(arr);
    }),

    crypto_generichash: jest.fn((hashLength, input, key) => {
      // Return a deterministic hash based on input length for testing
      const hash = new Uint8Array(hashLength);
      if (input) {
        for (let i = 0; i < hashLength; i++) {
          hash[i] = (input.length + i) % 256;
        }
      }
      return hash;
    }),

    crypto_scalarmult_base: jest.fn((privateKey) => {
      // Return a deterministic public key from private key
      const publicKey = new Uint8Array(32);
      if (privateKey && privateKey.length >= 32) {
        for (let i = 0; i < 32; i++) {
          publicKey[i] = privateKey[i] ^ 0xAA; // Simple transform
        }
      } else {
        publicKey.fill(1);
      }
      return publicKey;
    }),

    crypto_pwhash_OPSLIMIT_MODERATE: 3,
    crypto_pwhash_MEMLIMIT_MODERATE: 268435456,
    crypto_pwhash_ALG_ARGON2ID13: 2,
  };

  return {
    __esModule: true,
    default: mockSodium,
  };
});

// Set up global TextEncoder/TextDecoder for Node.js environment
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
