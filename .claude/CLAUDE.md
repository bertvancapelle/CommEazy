# CommEazy — Agent Teams Master Context

## What is CommEazy?
Privacy-first family communication app. End-to-end encrypted messaging, photos, and video calls for families — designed specifically for seniors (65+) while being enjoyable for all ages.

## Architecture Overview
- **Frontend:** React Native 0.73+ (iOS, iPadOS, Android)
- **Protocol:** XMPP (xmpp.js) via Prosody server — routing only, zero message storage
- **Database:** WatermelonDB (local, encrypted with SQLCipher)
- **Encryption:** libsodium, dual-path (encrypt-to-all ≤8 members, shared-key >8)
- **Auth:** Firebase Auth (phone verification only)
- **Push:** Firebase Cloud Messaging
- **Calls:** WebRTC (P2P via Coturn STUN/TURN)
- **Languages:** NL, EN, DE, FR, ES (react-i18next)

## Non-Negotiable Requirements
1. **Zero server storage** — Prosody routes only, never stores message content
2. **Senior-inclusive UX** — Body ≥18pt, touch ≥60pt, WCAG AAA, max 3 steps per flow
3. **5-language support** — All UI strings via t(), zero hardcoded text
4. **Store compliance** — Apple Privacy Manifest + Google Data Safety Section
5. **Encryption export** — US BIS Self-Classification Report filed

## Project Structure
```
src/
  services/         ← Core business logic (interfaces + implementations)
    interfaces.ts   ← Technology-agnostic contracts (READ THIS FIRST)
    container.ts    ← Dependency injection singleton
    encryption.ts   ← libsodium dual-path implementation
    xmpp.ts         ← xmpp.js XMPP client
  screens/          ← Screen components
  components/       ← Reusable UI components
  navigation/       ← React Navigation setup (max 2 levels)
  hooks/            ← Custom React hooks
  locales/          ← i18n translation files (NL/EN/DE/FR/ES)
  theme/            ← Colours, typography, spacing (senior-inclusive)
  config/           ← App configuration
  models/           ← WatermelonDB models
  utils/            ← Shared utilities
```

## Agent Team Skills
All 13 skill definitions are in `.claude/skills/[name]/SKILL.md`. Each skill has:
- Core Responsibilities
- Store Compliance Gate
- Senior Inclusive Design Principles
- i18n Requirements
- Interface Contracts (provides/expects)
- Error Scenarios with recovery
- Code Examples
- Quality Checklist

## ⚠️ VERPLICHTE SKILL VALIDATIE (COORDINATION PROTOCOL)

**VOORDAT** enige wijziging wordt uitgevoerd, MOET het coördinatie-protocol worden gevolgd. Zie `.claude/COORDINATION_PROTOCOL.md` voor volledige details.

### Korte Samenvatting

```
GEBRUIKER VRAAGT → CLASSIFICATIE → SKILL IDENTIFICATIE → VALIDATIE → RAPPORTAGE → UITVOERING
```

### Stappen (VERPLICHT)

1. **Classificeer** de wijziging (UI, security, database, etc.)
2. **Identificeer** welke skills moeten valideren (zie `CHANGE_VALIDATION_MATRIX.md`)
3. **Valideer** tegen elke relevante skill's checklist en regels
4. **Rapporteer** resultaten aan gebruiker:
   - ✅ Voldoet aan alle regels
   - ⚠️ Waarschuwingen — bespreken
   - ❌ Blokkeerders — NIET uitvoeren
5. **Voer uit** alleen als alle validaties slagen

### Automatische Triggers

| Wijziging bevat... | Verplichte validatie door |
|-------------------|---------------------------|
| UI componenten, styling | ui-designer, accessibility-specialist |
| Formuliervelden, inputs | ui-designer, accessibility-specialist |
| Encryptie, keys, tokens | security-expert |
| Database, storage | architecture-lead, security-expert |
| XMPP, messaging | xmpp-specialist, security-expert |
| Navigatie | architecture-lead, ui-designer |
| i18n, vertalingen | ui-designer, documentation-writer |
| Native modules | ios-specialist OF android-specialist |
| Tests | testing-qa |
| CI/CD, deployment | devops-specialist |
| Onboarding flow | onboarding-recovery-specialist, ui-designer |
| Performance | performance-optimizer |

### Conflict Resolutie Hiërarchie

1. **Security wint altijd** — Veiligheid gaat voor usability
2. **Accessibility tweede** — Toegankelijkheid is niet onderhandelbaar
3. **Senior-inclusive design derde** — Core doelgroep
4. **Performance vierde** — Belangrijk maar niet ten koste van bovenstaande
5. **Store compliance** — Moet altijd voldoen (Apple/Google)

### Coördinator

De **architecture-lead** skill is verantwoordelijk voor:
- Orchestratie van multi-skill validaties
- Conflict resolutie tussen skills
- Handhaving van het protocol

## Quality Gates (ALL code must pass)
1. **Store Compliance** — Privacy Manifest (iOS), Data Safety (Android)
2. **Senior Inclusive** — Typography, touch targets, contrast, VoiceOver/TalkBack
3. **i18n** — All 5 languages, text expansion tested, no hardcoded strings
4. **Security** — E2E encryption verified, keys never logged, zero storage audit
5. **Performance** — Cold start <3s, 60fps scroll, memory <200MB
6. **Code Quality** — TypeScript strict, 80% coverage, zero warnings

## Key Design Decisions
- **Abstraction layers** — XMPPService and DatabaseService interfaces allow swapping implementations without touching business logic
- **Dual-path encryption** — Threshold 8 validated by benchmark (see poc/results/)
- **7-day outbox** — Messages stored on-device, synced member-to-member
- **No hamburger menu** — Bottom tabs only, max 2 navigation levels
- **Respectful language** — Never "elderly mode" or "simple mode"

## UI Architectural Principles

### Senior-Inclusive Design (MANDATORY)

Deze principes zijn NIET "ouderen-aanpassingen" — het zijn universele design standaarden die de app beter maken voor IEDEREEN.

### 1. Typography
- **Body text:** 18pt minimum (zie `typography.body`)
- **Headings:** 24pt minimum (zie `typography.h3`)
- **Labels:** 16pt minimum (zie `typography.label`)
- **Line height:** 1.5× font size voor leesbaarheid
- **Dynamic Type:** Respecteer systeem font scaling (iOS/Android)
- Test op 200% font scale — layout mag niet breken

### 2. Touch Targets
- **Alle interactieve elementen:** 60×60pt minimum (zie `touchTargets.minimum`)
- **Spacing tussen targets:** 12pt minimum (voorkom mis-taps)
- **Primaire acties:** 72-84pt (zie `touchTargets.comfortable`, `touchTargets.large`)

### 3. Contrast & Kleur
- **Body text:** WCAG AAA (7:1 ratio) — zie `colors.textPrimary` (#1A1A1A)
- **Large text (24pt+):** WCAG AA (4.5:1) minimum
- **NOOIT kleur als enige indicator** — altijd icoon/tekst toevoegen

```typescript
// FOUT: Alleen kleur
<View style={{ backgroundColor: colors.success }} />

// GOED: Kleur + icoon + tekst
<View style={{ backgroundColor: colors.success }}>
  <Text>✓ {t('status.sent')}</Text>
</View>
```

### 4. Haptic Feedback (VERPLICHT)
Alle interactieve elementen moeten haptic feedback geven:

```typescript
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';  // of react-native-haptic-feedback

const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(
      type === 'light' ? Haptics.ImpactFeedbackStyle.Light :
      type === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy :
      Haptics.ImpactFeedbackStyle.Medium
    );
  }
};

// Gebruik in button
<TouchableOpacity onPress={() => {
  triggerHaptic('medium');
  onPress();
}}>
```

### 5. Error Display Pattern
Errors moeten menselijk zijn en een herstelactie bieden:

```typescript
// FOUT: Technische error
<Text>Error: ETIMEDOUT port 5281</Text>

// GOED: Menselijke error met herstel
<View style={styles.errorContainer}>
  <Text style={styles.errorIcon}>⚠️</Text>
  <Text style={styles.errorTitle}>{t('errors.network.title')}</Text>
  <Text style={styles.errorHelp}>{t('errors.network.help')}</Text>
  <Button title={t('common.try_again')} onPress={retry} />
</View>
```

### 6. Loading States
Altijd spinner + tekst combineren:

```typescript
// FOUT: Alleen spinner
<ActivityIndicator />

// GOED: Spinner + tekst
<View style={styles.loadingContainer}>
  <ActivityIndicator size="large" />
  <Text style={styles.loadingText}>{t('common.loading')}</Text>
</View>
```

### 7. Text Expansion (i18n)
Gebruik flexibele containers voor tekst die langer kan worden:

```typescript
// Text expansion vs English: DE +30%, FR +20%, ES +15%, NL +10%

// FOUT: Vaste breedte
<View style={{ width: 200 }}>
  <Text>{t('button.create_group')}</Text>
</View>

// GOED: Flexibele container
<View style={{ flexShrink: 1, maxWidth: '80%' }}>
  <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
    {t('button.create_group')}
  </Text>
</View>
```

### 8. Reduced Motion
Respecteer systeem reduced motion instellingen:

```typescript
import { AccessibilityInfo } from 'react-native';

const [reduceMotion, setReduceMotion] = useState(false);

useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  const subscription = AccessibilityInfo.addEventListener(
    'reduceMotionChanged',
    setReduceMotion
  );
  return () => subscription.remove();
}, []);

// Gebruik
const animationDuration = reduceMotion ? 0 : animation.normal;
```

### 9. Accessibility Labels (VERPLICHT)
Alle interactieve elementen moeten accessibility labels hebben:

```typescript
<TouchableOpacity
  accessibilityRole="button"
  accessibilityLabel={t('chat.send_message')}
  accessibilityHint={t('chat.send_message_hint')}
  accessibilityState={{ disabled: isDisabled }}
>
```

### 10. Flow Simplicity
- **Max 3 stappen** per user flow (bericht sturen, bellen, groep maken)
- **Max 2 niveaus** navigatie diepte
- Elk scherm heeft één duidelijke primaire actie
- Terug-knop altijd zichtbaar en groot
- Geen verborgen gestures — elk gesture heeft een button alternatief

---

### Form Field Styling (MANDATORY)
All interactive form elements must follow these rules:

1. **Labels ABOVE the field** — Labels are positioned ABOVE the interactive element, NEVER inline inside the border
2. **Labels OUTSIDE the border** — The label text must be outside/above the bordered area, giving seniors more room to tap the field
3. **Labels always bold** — Every field label uses `fontWeight: '700'`
4. **No uppercase labels** — Labels use normal capitalization ("Land", "Taal"), NOT uppercase ("LAND", "TAAL")
5. **Bordered interactive elements** — All fields, dropdowns, and interactive inputs have a thin border (`borderWidth: 1, borderColor: colors.border`)
6. **Consistent picker rows** — Use `borderRadius: borderRadius.md` for rounded corners

**CORRECT layout — label ABOVE, OUTSIDE border:**
```
Land                          ← Label (bold, above, outside border)
┌─────────────────────────┐
│ 🇳🇱 Nederland         › │   ← Bordered interactive area
└─────────────────────────┘
```

**WRONG layout — label INSIDE border:**
```
┌─────────────────────────┐
│ Land | 🇳🇱 Nederland  › │   ← WRONG: label inside border
└─────────────────────────┘
```

**Standard picker field style:**
```typescript
// Container wraps label + bordered picker
fieldContainer: {
  marginBottom: spacing.md,
},
// Label: ABOVE and OUTSIDE the bordered element
fieldLabel: {
  ...typography.body,
  color: colors.textPrimary,
  fontWeight: '700',
  marginBottom: spacing.xs,
},
// Bordered interactive area (NO label inside)
pickerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: colors.surface,
  borderRadius: borderRadius.md,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.md,
  minHeight: touchTargets.comfortable,
},
pickerValue: {
  ...typography.body,
  color: colors.textPrimary,
  flex: 1,
},
```

**Standard text input style:**
```typescript
// Container wraps label + bordered input
inputContainer: {
  marginBottom: spacing.md,
},
// Label: ABOVE and OUTSIDE the bordered element
inputLabel: {
  ...typography.body,
  fontWeight: '700',
  color: colors.textPrimary,
  marginBottom: spacing.xs,
},
// Bordered input area
textInput: {
  ...typography.body,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: borderRadius.md,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  color: colors.textPrimary,
  backgroundColor: colors.surface,
  minHeight: touchTargets.comfortable,
},
```

**Section title style (for grouping fields):**
```typescript
sectionTitle: {
  ...typography.label,
  color: colors.textSecondary,
  fontWeight: '700',           // Bold
  marginBottom: spacing.sm,
  // NO textTransform: 'uppercase' — use normal capitalization
},
```

## Build Order
1. Onboarding flow (language → phone → name → PIN → done)
2. Encryption service (key generation, backup, restore)
3. 1-on-1 chat (XMPP connect, send, receive, receipts)
4. Group chat (MUC, dual-path encryption)
5. Photos (compression, encryption, send)
6. Video calls (WebRTC P2P)
7. Settings & accessibility
8. Store submission

## Commands
```bash
npm start          # Metro bundler
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run lint       # ESLint (zero warnings)
npm run typecheck  # TypeScript strict
npm test           # Jest with coverage
```

## Known Issues: React Native 0.73 + Hermes

> **BELANGRIJK:** Lees `.claude/MOCK_MODE_CHANGES.md` voor volledige details

### FlatList Bug
FlatList/VirtualizedList crasht met `getItem undefined` error. **Workaround:** Gebruik ScrollView + `.map()` voor lijsten <100 items.

### Native Module Race Conditions
Top-level imports van native-afhankelijke modules falen. **Oplossing:** Gebruik dynamische imports (`await import()`) + 50-100ms delay bij startup.

### uuid/libsodium Incompatibiliteit
`uuid` en `libsodium-wrappers` werken niet correct met Hermes JS engine.
- **uuid:** Vervang door `react-native-uuid`
- **libsodium:** Vereist native module of correcte WASM polyfills

### Mock Mode
App draait momenteel in mock mode voor development. Zie `MOCK_MODE_CHANGES.md` voor:
- Lijst van alle gewijzigde bestanden
- Exacte code om terug te draaien voor productie
- Checklist voor productie test versie

## Development Environment

### Prosody XMPP Server
**BELANGRIJK:** Prosody is NIET geïnstalleerd via Homebrew!

Prosody locatie en commando's:
```bash
# Start Prosody (handmatige installatie)
sudo prosodyctl start

# Stop Prosody
sudo prosodyctl stop

# Check status
sudo prosodyctl status

# Configuratie
/etc/prosody/prosody.cfg.lua
```

### Test Devices
- **iPhone 17 Pro**: ik@commeazy.local (simulator)
- **iPhone 16e**: oma@commeazy.local (simulator)
- **iPhone 14**: test@commeazy.local (fysiek device)

Metro starten voor fysiek device op LAN:
```bash
npx react-native start --host 10.10.15.75
```

