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
5b. **Test Validatie** — Zijn tests geschreven? Is coverage ≥80%?
6. **Skill Standaardisatie Check** — Na nieuwe functionaliteit ALTIJD vragen:
   - "Moet dit worden toegevoegd aan skills voor standaardisatie?"
   - "Is dit pattern herbruikbaar in andere modules?"
   - Zo ja: update SKILL.md en/of CLAUDE.md
7. **Mini-Retrospectief** — Na elke ontwikkelstap analyseren:
   - Wat ging goed? Wat kan beter?
   - Aanbevelingen voor skills?
8. **Recursieve Implementatie** — Bij skill wijzigingen:
   - Pas nieuwe regels toe op ALLE bestaande code
   - Zie `COORDINATION_PROTOCOL.md` voor volledige workflow

### Automatische Triggers

| Wijziging bevat... | Verplichte validatie door |
|-------------------|---------------------------|
| UI componenten, styling | ui-designer, accessibility-specialist |
| Formuliervelden, inputs | ui-designer, accessibility-specialist |
| Lijsten met >3 items | ui-designer, accessibility-specialist, react-native-expert |
| Voice control, spraak | accessibility-specialist, react-native-expert |
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
| **Media modules (Radio/Podcast/Audiobook)** | **ui-designer, accessibility-specialist, react-native-expert, ios-specialist** |

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

### 10b. Hold Gesture Exclusivity (VERPLICHT)

**UI PRINCIPE: Bij een long-press gesture wordt ALLEEN de hold-actie uitgevoerd, NIET beide.**

Wanneer een gebruiker een long-press gesture uitvoert (voor navigatie wheel of voice commands),
mag het onderliggende tappable element NIET ook zijn `onPress` handler uitvoeren.

**Probleem:**
```typescript
// FOUT: Beide acties worden uitgevoerd
// 1. Gebruiker houdt vinger op picker field
// 2. Na 800ms: hold gesture voltooid → menu opent
// 3. Vinger loslaten → picker onPress viert ook → field wordt geactiveerd
```

**Oplossing:**
CommEazy gebruikt `HoldGestureContext` om dit te voorkomen:

```typescript
// HoldToNavigateWrapper roept aan wanneer gesture voltooid is:
holdGesture.consumeGesture();

// Componenten die dit gedrag moeten respecteren gebruiken:
import { useHoldGestureGuard } from '@/contexts/HoldGestureContext';

function MyComponent({ onPress }: Props) {
  // Wrap onPress om te skippen wanneer hold gesture net is voltooid
  const guardedOnPress = useHoldGestureGuard(onPress);

  return (
    <TouchableOpacity onPress={guardedOnPress}>
      ...
    </TouchableOpacity>
  );
}
```

**Wanneer `useHoldGestureGuard` te gebruiken:**
- Picker fields (land, taal, etc.)
- Modale triggers
- Elke tappable die ook lang ingedrukt kan worden

**Implementatie details:**
- `consumeGesture()` markeert timestamp wanneer hold voltooid is
- `isGestureConsumed()` checkt of <300ms geleden een gesture was voltooid
- Guard wrapper skipt onPress automatisch wanneer gesture consumed is

**⚠️ KRITIEK: TouchableOpacity onLongPress Pattern (VERPLICHT)**

React Native's `TouchableOpacity` heeft een belangrijk gedrag:
- **Zonder `onLongPress`:** `onPress` fired bij ELKE touch release, ongeacht duur
- **Met `onLongPress`:** `onPress` fired NIET als touch langer dan `delayLongPress` was

Dit is de PRIMAIRE verdediging tegen double-action:

```typescript
// ❌ FOUT — veroorzaakt double-action
<TouchableOpacity onPress={() => handleAction()}>

// ✅ GOED — voorkomt double-action
<TouchableOpacity
  onPress={() => handleAction()}
  onLongPress={() => {}}  // Lege handler blokkeert onPress na long-press
  delayLongPress={300}    // Match HoldGestureContext timing
>
```

**Waar dit toepassen:**
- Alle lijst items (contacten, berichten, stations, episodes)
- Cards en klikbare rijen
- Alle `TouchableOpacity` binnen HoldToNavigateWrapper scope

**Twee-laagse bescherming:**
1. **`onLongPress={() => {}}`** — Primaire blokkade (React Native niveau)
2. **`useHoldGestureGuard()`** — Backup voor edge cases (HoldGestureContext niveau)

### 11. Voice Interaction Architecture (VERPLICHT)

CommEazy heeft **spraakbesturing als kernfunctie**, niet als optionele toegankelijkheidsfunctie. ALLE modules MOETEN voice interactions ondersteunen volgens deze architectuur.

#### 11.1 Voice Command Framework

Alle voice commands zijn **configureerbaar per gebruiker** en worden centraal beheerd:

```
src/
  types/
    voiceCommands.ts      ← Type definities (VERPLICHT)
  services/
    voiceSettings.ts      ← AsyncStorage persistence
  contexts/
    VoiceSettingsContext.tsx  ← App-wide settings provider
    VoiceFocusContext.tsx     ← Focus management voor lijsten
  hooks/
    useVoiceCommands.ts       ← Speech recognition + command parsing
    useVoiceSettings.ts       ← Settings hook
```

#### 11.2 Command Categorieën

Elke module MOET de relevante command categorieën implementeren:

| Categorie | Commands | Gebruik |
|-----------|----------|---------|
| **navigation** | "contacten", "berichten", "instellingen" | Navigatie tussen schermen |
| **list** | "volgende", "vorige", "open" | Navigatie binnen lijsten |
| **form** | "pas aan", "wis", "dicteer", "bevestig" | Formulier interacties |
| **action** | "bel", "stuur bericht", "verwijder" | Directe acties op items |
| **media** | "stuur", "foto", "speel", "pauze" | Media gerelateerde acties |
| **session** | "stop", "help" | Voice session control |
| **confirmation** | "ja", "nee", "annuleer" | Bevestigingsdialogen |

#### 11.3 Standaard Commando's per Taal

Alle commando's hebben synoniemen en zijn beschikbaar in 5 talen:

```typescript
// types/voiceCommands.ts
interface VoiceCommand {
  id: string;                     // 'next', 'previous', 'open', etc.
  category: VoiceCommandCategory;
  action: string;                 // Technische actie naam
  defaultPatterns: Record<Language, string[]>;  // Per taal
  customPatterns: string[];       // Door gebruiker toegevoegd
  isEnabled: boolean;
}

// Voorbeeld: 'next' commando
const nextCommand: VoiceCommand = {
  id: 'next',
  category: 'list',
  action: 'focusNext',
  defaultPatterns: {
    nl: ['volgende', 'verder', 'door'],
    en: ['next', 'forward'],
    de: ['nächste', 'weiter'],
    fr: ['suivant', 'prochain'],
    es: ['siguiente', 'adelante'],
  },
  customPatterns: [],
  isEnabled: true,
};
```

#### 11.4 Voice Session Mode

Na activatie van voice control blijft de sessie actief:

**Activatie:**
- Twee-vinger tap ergens op scherm
- Of: tik op FloatingMicIndicator

**Tijdens sessie:**
- FloatingMicIndicator zichtbaar (zwevende microfoon)
- Pulserende animatie tijdens luisteren
- Automatische herstart na elk commando
- 30s timeout → sessie stopt automatisch

**Implementatie in ELKE module:**
```typescript
// Check of voice session actief is
const { isVoiceSessionActive } = useVoiceFocusContext();

// Registreer acties die via voice bereikbaar moeten zijn
useVoiceAction('call', handleCall, { label: contactName });
useVoiceAction('message', handleSendMessage, { label: t('chat.send') });
```

#### 11.5 Voice Focusable Lijsten (VERPLICHT voor lijsten >3 items)

```typescript
import { VoiceFocusable, useVoiceFocusList } from '@/contexts/VoiceFocusContext';

function ContactListScreen() {
  // Registreer lijst — alleen als scherm gefocust is
  const isFocused = useIsFocused();

  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return []; // Voorkom registratie op andere tabs
    return contacts.map((contact, index) => ({
      id: contact.jid,
      label: contact.name,  // Menselijke naam voor voice matching
      index,
      onSelect: () => handleContactPress(contact),
    }));
  }, [contacts, isFocused]);

  const { scrollRef } = useVoiceFocusList('contact-list', voiceFocusItems);

  return (
    <ScrollView ref={scrollRef}>
      {contacts.map((contact, index) => (
        <VoiceFocusable
          key={contact.jid}
          id={contact.jid}
          label={contact.name}
          index={index}
          onSelect={() => handleContactPress(contact)}
        >
          <ContactListItem contact={contact} />
        </VoiceFocusable>
      ))}
    </ScrollView>
  );
}
```

#### 11.6 Multi-Match Voice Navigation

Bij meerdere matches op een naam (bijv. "maria" → "Oma Maria" + "Tante Maria"):

**Gedrag:**
1. Eerste/beste match krijgt focus
2. Systeem kondigt aan: "Oma Maria, 2 resultaten. Zeg 'volgende' voor meer."
3. "Volgende"/"Vorige" navigeert binnen matches (niet hele lijst)
4. "Tante Maria, 2 van 2" → context bij elke navigatie

**Filter reset bij:**
- Nieuwe naam-zoekopdracht (ander woord)
- Session stop
- Geen matches gevonden

**Implementatie (automatisch via VoiceFocusContext):**
```typescript
// focusByName() slaat matches automatisch op
const matches = voiceFocus.focusByName('maria');
// matches.length > 1 → activeNameFilter wordt gezet

// focusNext()/focusPrevious() respecteren activeNameFilter
// → navigeert binnen matches, niet hele lijst

// Toegang tot huidige filter state:
const { activeNameFilter, clearNameFilter } = useVoiceFocusContext();
// activeNameFilter: { query: 'maria', matches: [...], currentIndex: 0 }
```

**Accessibility announcements (alle 5 talen):**
- `voiceCommands.multipleMatches`: "{{name}}, {{count}} resultaten gevonden. Zeg 'volgende' voor meer."
- `voiceCommands.focusedOnMatch`: "{{name}}, {{current}} van {{total}}"
- `voiceCommands.endOfMatches`: "Terug naar eerste resultaat"

#### 11.7 Voice Focus Styling

- Gefocust item: 4px border in `accentColor.primary`
- Subtiele achtergrond tint (accent color op 10% opacity)
- Pulserende border animatie (accent ↔ wit, 600ms)
- Scale 1.02x (respecteert reduced motion)

#### 11.8 Formulier Voice Interactions

ELKE formulier veld MOET voice dicteren ondersteunen:

```typescript
function VoiceTextField({
  label,
  value,
  onChangeText,
  voiceFieldId,  // Uniek ID voor voice targeting
}: Props) {
  const { isVoiceSessionActive, registerFormField } = useVoiceFormContext();

  // Registreer veld voor voice targeting
  useEffect(() => {
    registerFormField(voiceFieldId, {
      label,
      onEdit: () => inputRef.current?.focus(),
      onClear: () => onChangeText(''),
      onDictate: (text) => onChangeText(text),
    });
  }, [voiceFieldId, label]);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        accessibilityHint={
          isVoiceSessionActive
            ? t('a11y.voiceFieldHint', 'Zeg "pas aan" om te bewerken')
            : undefined
        }
      />
    </View>
  );
}
```

#### 11.8 Bevestigingsdialogen

Destructieve acties MOETEN voice-confirmeerbaar zijn:

```typescript
// Bij verwijderen, uitloggen, etc.
showVoiceConfirmation({
  title: t('confirm.delete.title'),
  message: t('confirm.delete.message', { name: contactName }),
  confirmLabel: t('common.delete'),     // "ja" of "verwijder" activeert
  cancelLabel: t('common.cancel'),      // "nee" of "annuleer" activeert
  onConfirm: handleDelete,
  onCancel: closeDialog,
});
```

#### 11.9 Voice Settings in Instellingen

Gebruikers kunnen alle commando's bekijken en aanpassen:

```
Instellingen
└── Spraakbesturing
    ├── Spraakbesturing aan/uit
    ├── Commando's aanpassen
    │   ├── Navigatie (volgende, vorige, ...)
    │   ├── Lijsten (open, selecteer, ...)
    │   ├── Formulieren (pas aan, wis, ...)
    │   └── Sessie (stop, help, ...)
    ├── Standaard herstellen
    └── Exporteren / Importeren
```

#### 11.10 Module Implementatie Checklist

Bij het bouwen van ELKE nieuwe module, valideer:

- [ ] **Lijsten >3 items:** VoiceFocusable wrappers aanwezig
- [ ] **Formulieren:** Alle velden voice-dicteerbaar
- [ ] **Acties:** Primaire acties voice-triggerable
- [ ] **Bevestigingen:** Destructieve acties via voice bevestigbaar
- [ ] **Labels:** Alle voice labels zijn menselijke namen (niet technische IDs)
- [ ] **i18n:** Voice commands in alle 5 talen gedefinieerd
- [ ] **Settings:** Nieuwe commands toegevoegd aan settings schema

---

### 12. Media Module Design Principles (Radio/Podcast/Audiobook)

Bij het bouwen van media modules (Radio, Podcast, Luisterboek) MOETEN de volgende patterns worden toegepast:

#### 12.1 Mini-Player + Expandable Modal Pattern

**Probleem:** Full-screen players blokkeren navigatie — senioren kunnen niet wisselen tussen tabs terwijl muziek speelt.

**Oplossing:**
- Content lijst ALTIJD zichtbaar (niet geblokkeerd door player)
- Mini-player bar aan onderkant (compact, niet blokkerend)
- Tap op mini-player → expand naar full-screen modal
- Modal kan altijd gesloten worden met IconButton (chevron-down)

```typescript
// Mini-player bar
{isPlaying && (
  <TouchableOpacity style={styles.miniPlayer} onPress={() => setIsExpanded(true)}>
    <Image source={{ uri: artwork }} style={styles.miniArtwork} />
    <Text style={styles.miniTitle}>{station.name}</Text>
    <IconButton icon={isPlaying ? 'pause' : 'play'} onPress={handlePlayPause} />
  </TouchableOpacity>
)}

// Expanded modal
<Modal visible={isExpanded} animationType="slide">
  <SafeAreaView style={styles.expandedPlayer}>
    <IconButton icon="chevron-down" onPress={() => setIsExpanded(false)} />
    {/* Full player controls */}
  </SafeAreaView>
</Modal>
```

#### 12.2 MediaIndicator in Module Headers

Elke module MOET een MediaIndicator in de header hebben om cross-module media awareness te tonen:

```typescript
<View style={[styles.moduleHeader, { backgroundColor: MODULE_COLOR }]}>
  <Icon name="radio" size={28} color={colors.textOnPrimary} />
  <Text style={styles.moduleTitle}>{t('modules.radio.title')}</Text>
  <MediaIndicator currentSource="radio" />
</View>
```

De `currentSource` prop voorkomt dubbele indicator in de bron-module zelf.

#### 12.3 Welcome Modal voor First-Time Users

**VERPLICHT:** Elke nieuwe module MOET een welcome modal tonen bij eerste gebruik:

```typescript
// AsyncStorage key: {module}_welcome_shown
useEffect(() => {
  AsyncStorage.getItem('radio_welcome_shown').then((value) => {
    if (!value) setShowWelcome(true);
  });
}, []);
```

Modal bevat genummerde stappen (1, 2, 3...) met duidelijke instructies en één "Begrepen" button.

#### 12.4 Error Banners met TEXT Dismiss Button

Playback errors MOETEN dismissable zijn met een TEKST button (niet icon-only):

```typescript
{playbackError && (
  <View style={styles.errorBanner}>
    <Icon name="warning" color={colors.error} />
    <Text>{t('modules.radio.playbackErrorTitle')}</Text>
    {/* TEKST button, niet alleen X icoon */}
    <TouchableOpacity onPress={() => setPlaybackError(null)}>
      <Text style={styles.errorDismissText}>{t('common.dismiss')}</Text>
    </TouchableOpacity>
  </View>
)}
```

#### 12.5 Module-Specific Color Coding

Elke module heeft een unieke kleur consistent met WheelNavigationMenu:

| Module | Kleur | Hex |
|--------|-------|-----|
| Radio | Teal | `#00897B` |
| Podcast | Paars | `#7B1FA2` |
| Luisterboek | Amber | `#FF8F00` |
| E-book | Indigo | `#303F9F` |

#### 12.6 Media Module Implementatie Checklist

Bij ELKE nieuwe media module:

- [ ] Mini-player + expandable modal pattern
- [ ] MediaIndicator in module header met correcte `currentSource`
- [ ] Welcome modal voor first-time users (AsyncStorage)
- [ ] Error banner met TEKST dismiss button
- [ ] Module-specific color consistent met WheelNavigationMenu
- [ ] Artwork validation via artworkService (geen broken images)
- [ ] Buffering indicator met reduced motion support
- [ ] Dynamic bottom padding voor mini-player floating element
- [ ] VoiceFocusable wrappers voor content lijsten
- [ ] Accessibility announcements voor playback state changes
- [ ] iOS `audio` background mode in Info.plist

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

## Logging Richtlijnen

### Log Levels

| Level | Wanneer gebruiken | Production |
|-------|-------------------|------------|
| `console.debug()` | Development details, state changes | Gefilterd |
| `console.info()` | Belangrijke events, user actions | Zichtbaar |
| `console.warn()` | Recoverable issues, fallbacks | Zichtbaar |
| `console.error()` | Failures, onverwachte errors | Zichtbaar |

### NOOIT Loggen (PII/Security)

```typescript
// ❌ NOOIT loggen:
console.log('User:', user.name, user.phone);        // PII
console.log('Search:', searchQuery);                 // Kan namen bevatten
console.log('Key:', encryptionKey);                  // Security
console.log('Token:', authToken);                    // Security
console.log('Message:', message.content);            // Privacy
console.error('Full error:', error);                 // Kan PII bevatten

// ✅ WEL loggen:
console.info('User logged in');                      // Event zonder PII
console.info('Search completed', { count: 5 });      // Resultaat, geen query
console.debug('Encryption completed', { ms: 45 });   // Performance metric
console.error('Stream failed', { code: error.code }); // Alleen error code
```

### Performance Logging

```typescript
// Voor API calls en kritieke operaties
const start = performance.now();
await fetchData();
console.debug('[Module] Operation completed', {
  operation: 'fetchData',
  duration: Math.round(performance.now() - start),
  resultCount: data.length,
});
```

### Module Prefix Convention

```typescript
// Consistent prefix format: [ModuleName]
console.info('[RadioContext] Station started playing');
console.warn('[RadioScreen] Using cached stations');
console.error('[artworkService] Fetch failed', { code: 'TIMEOUT' });
```

### Logging in useEffect

```typescript
// Log bij mount/unmount voor debugging
useEffect(() => {
  console.debug('[Component] Mounted');
  return () => console.debug('[Component] Unmounted');
}, []);
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

