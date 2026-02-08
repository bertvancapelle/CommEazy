# CommEazy

**Privacy-first family communication.** End-to-end encrypted messaging, photos, and video calls — designed for seniors, loved by everyone.

## Quick Start

```bash
# Install dependencies
npm install

# iOS
cd ios && pod install && cd ..
npm run ios

# Android
npm run android
```

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React Native 0.73 + TypeScript strict | Cross-platform, single codebase |
| XMPP | xmpp.js (v0.14) | Native TypeScript, async/await, built-in reconnection |
| Database | WatermelonDB | No vendor lock-in, offline-first, SQLCipher encryption |
| Encryption | libsodium-wrappers | Proven crypto, dual-path (≤8: encrypt-to-all, >8: shared-key) |
| Auth | Firebase Auth | Phone verification only |
| Push | Firebase Cloud Messaging | Cross-platform push |
| Calls | react-native-webrtc | P2P via Coturn STUN/TURN |
| i18n | react-i18next | 5 languages: NL, EN, DE, FR, ES |

Technology choices validated by PoC benchmarks — see `poc/results/POC_RESULTS.md`.

## Architecture

```
┌─────────────────────────────────────────────┐
│                 React Native UI              │
│  (screens, components, navigation, theme)    │
├─────────────────────────────────────────────┤
│              Service Interfaces              │
│  DatabaseService │ XMPPService │ Encryption  │
├─────────────────────────────────────────────┤
│            Implementations                   │
│  WatermelonDB  │  xmpp.js   │  libsodium   │
├─────────────────────────────────────────────┤
│           Infrastructure                     │
│  Prosody (routing) │ Coturn │ Firebase      │
└─────────────────────────────────────────────┘
```

**Key principle:** Abstraction layers between UI and implementations. You can swap xmpp.js for Strophe.js or WatermelonDB for Realm by changing one file — business logic stays untouched.

## Privacy & Security

- **Zero server storage:** Prosody routes messages, never stores them
- **End-to-end encryption:** All messages encrypted on-device before transmission
- **Key backup:** PIN-protected (Argon2id key derivation), stored by user
- **7-day outbox:** Undelivered messages stored on-device, auto-expire
- **QR verification:** Optional contact verification via QR code scan
- **No analytics, no tracking, no ads**

## Senior-Inclusive Design

CommEazy is designed with seniors (65+) as primary users, without creating a "senior mode":

- Body text ≥18pt, headings ≥24pt
- Touch targets ≥60pt (exceeds Apple 44pt / Google 48dp minimums)
- WCAG AAA contrast (7:1)
- Max 3 steps per flow, max 2 navigation levels
- Dynamic Type (iOS) + font scaling (Android)
- VoiceOver + TalkBack fully tested
- Colour blindness safe palette
- Haptic + optional audio feedback
- Reduced motion option

## Supported Platforms

| Platform | Minimum | Target |
|----------|---------|--------|
| iOS | 15.0 | 17.0+ |
| iPadOS | 15.0 | 17.0+ (multitasking) |
| Android | 7.0 (API 24) | 14.0 (API 34) |

## Project Structure

```
src/
├── services/           # Core business logic
│   ├── interfaces.ts   # Technology-agnostic contracts
│   ├── container.ts    # Service singleton (DI)
│   ├── encryption.ts   # libsodium dual-path
│   └── xmpp.ts         # xmpp.js client
├── screens/            # Screen components
├── components/         # Reusable UI
├── navigation/         # React Navigation (tabs + stacks)
├── hooks/              # Custom hooks
├── locales/            # i18n (5 languages)
├── theme/              # Colours, typography, spacing
├── config/             # App config
└── models/             # WatermelonDB models

.claude/                # Agent Teams context
poc/                    # PoC benchmark results
```

## Development

```bash
npm run lint       # ESLint (zero warnings required)
npm run typecheck  # TypeScript strict mode
npm test           # Jest (80% coverage required)
```

## Agent Teams

This project is built solo with Claude Code / Agent Teams. The `.claude/CLAUDE.md` file provides master context. 13 specialist skills are available in the skills package (V2.0):

architecture-lead, security-expert, ui-designer, ios-specialist, android-specialist, react-native-expert, xmpp-specialist, accessibility-specialist, testing-qa, performance-optimizer, devops-specialist, onboarding-recovery-specialist, documentation-writer

## License

Proprietary — © 2026 CommEazy
