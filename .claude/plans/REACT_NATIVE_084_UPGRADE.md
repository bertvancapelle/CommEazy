# CommEazy: React Native 0.73.6 → 0.84 Upgrade Plan

## Samenvatting

Gefaseerde upgrade van React Native 0.73.6 naar 0.84.x via een **3-stop strategie** (0.76 → 0.78 → 0.84). Inclusief New Architecture activatie, React 19, React Navigation 7, en dependency-modernisering. Liquid Glass blijft ongewijzigd werken.

**Geschatte doorlooptijd:** 13-21 werkdagen (excl. 30% buffer)

---

## Strategische Beslissingen

| Beslissing | Keuze | Reden |
|------------|-------|-------|
| **Version jumps** | 3-stop (0.76 → 0.78 → 0.84) | Isoleert architectural boundaries; niet elke minor version nodig |
| **TurboModules** | Uitstellen, interop layer gebruiken | Alle 19 native modules werken via backward compat in 0.84 |
| **AppDelegate** | Behouden als `.mm` (Obj-C++) | C++ deps (sherpa-onnx, libsodium) maken Swift onhaalbaar |
| **React Navigation** | 6→7 in Phase 2 | Vereist react-native-screens 4.x (min RN 0.76) |
| **react-native-fs** | Behouden, later vervangen | 10 import sites; te risicovol tijdens framework upgrade |
| **react-native-fast-image** | Direct vervangen → @d11/react-native-fast-image | Origineel is dood project, drop-in replacement |
| **Node.js** | Upgrade naar 22.11+ | Vereist door RN 0.84 |

---

## Overzicht Fasen

```
Phase 0: Voorbereiding               (1-2 dagen)  ← Risico: Laag
Phase 1: RN 0.76 + deps              (3-5 dagen)  ← Risico: Medium
Phase 2: RN 0.78 + New Arch + RN7    (5-8 dagen)  ← Risico: Hoog
Phase 3: RN 0.84 + Hermes V1         (2-3 dagen)  ← Risico: Laag
Phase 4: Opschonen + validatie        (2-3 dagen)  ← Risico: Laag
```

---

## Phase 0: Voorbereiding (1-2 dagen)

**Doel:** Upgrade-omgeving inrichten zonder code te wijzigen.

### Taken

1. **Feature branch aanmaken:** `git checkout -b upgrade/rn-0.84`
2. **Node.js upgraden** naar 22.11+ (`nvm install 22 && nvm use 22`)
3. **Baseline vastleggen:**
   - Succesvolle build op simulator + fysiek device
   - `npm test` resultaten documenteren
   - Bestaande build warnings noteren
4. **Upgrade Helper diffs genereren** voor de 3 stops:
   - https://react-native-community.github.io/upgrade-helper/?from=0.73.6&to=0.76.7
   - https://react-native-community.github.io/upgrade-helper/?from=0.76.7&to=0.78.4
   - https://react-native-community.github.io/upgrade-helper/?from=0.78.4&to=0.84.0
5. **Dependency compatibiliteit matrix** afmaken (zie bijlage)

---

## Phase 1 (Stop 1): Upgrade naar RN 0.76.x (3-5 dagen)

**Doel:** App draaiend op RN 0.76 met alle dependencies gecompileerd. Old Architecture werkt nog.

### 1a. Core Framework Upgrade

**Bestanden te wijzigen:**

| Bestand | Wijziging |
|---------|-----------|
| `package.json` | `react-native` → 0.76.x, `react` → 18.3.1 |
| `ios/Podfile` | Flipper config VERWIJDEREN, `use_react_native!` updaten, post_install hook updaten |
| `ios/CommEazyTemp/AppDelegate.mm` | `sourceURLForBridge:` → nieuw `bundleURL` pattern (0.74 change) |
| `ios/CommEazyTemp/AppDelegate.h` | Superclass updaten conform 0.76 template |
| `metro.config.js` | `@react-native/metro-config` naar 0.76.x format |
| `babel.config.js` | `metro-react-native-babel-preset` → `@react-native/babel-preset` (hernoemd) |
| `react-native.config.js` | Format updates indien nodig |

**AppDelegate bundleURL change (0.74+):**
```objc
// OUD (0.73):
- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge { ... }
- (NSURL *)getBundleURL { ... }

// NIEUW (0.76):
// bundleURL is nu een method die NSURL* returnt
// Exacte signature volgt uit Upgrade Helper diff
```

### 1b. Dependency Upgrades (Stop 1)

| Package | Huidig | Doel | Breaking? |
|---------|--------|------|-----------|
| `react` | 18.2.0 | 18.3.1 | Minor |
| `react-native` | 0.73.6 | 0.76.x | Ja |
| `@op-engineering/op-sqlite` | 9.3.0 | 11.x-12.x | Ja — API changes |
| `react-native-fast-image` | 8.6.3 | Vervangen door `@d11/react-native-fast-image` | Drop-in |
| `@react-native/metro-config` | 0.73.0 | 0.76.x | Ja |
| `metro-react-native-babel-preset` | 0.77.0 | Vervangen door `@react-native/babel-preset` | Hernoemd |
| `@types/react-native` | 0.73.0 | VERWIJDEREN (types bundled in RN 0.76+) | - |
| `react-native-maps` | 1.10.3 | 1.14+ (test re-enabling) | TBD |

**FastImage vervanging (1 bestand):**
```typescript
// Oud: import FastImage from 'react-native-fast-image';
// Nieuw: import FastImage from '@d11/react-native-fast-image';
```

### 1c. Validatiepunten

- **Yoga 3.0** (0.74): `row-reverse` layout gedrag gewijzigd → visuele inspectie alle schermen
- **Batched state updates** (0.74): Meerdere `setState` calls worden gebatched → test formulieren
- **op-sqlite + WatermelonDB**: Onafhankelijke SQLite instances, apart testen

### 1d. Test Checkpoint

| Test | Criterium |
|------|-----------|
| Xcode build | Nul errors |
| Metro bundler | Start en serveert bundle |
| Fysiek device | Bundle laadt via LAN |
| 19 native modules | Importeren zonder crash |
| WatermelonDB | DB init + CRUD werkt |
| Sherpa-ONNX TTS | Piper TTS spreekt Nederlands |
| Liquid Glass | UIGlassEffect rendert op iOS 26 |
| CallKit | Inkomend bel-UI verschijnt |
| XMPP | WebSocket verbindt met Prosody |

**Commit na succes:** `chore: upgrade React Native to 0.76.x (stop 1/3)`

---

## Phase 2 (Stop 2): RN 0.78.x + New Architecture + React 19 + Nav 7 (5-8 dagen)

**Doel:** New Architecture activeren, React 19, en React Navigation 7 migratie. **Dit is de moeilijkste fase.**

### 2a. Core Framework Upgrade

| Bestand | Wijziging |
|---------|-----------|
| `package.json` | `react-native` → 0.78.x, `react` → 19.x |
| `ios/Podfile` | New Architecture is default, flags updaten |
| `ios/CommEazyTemp/AppDelegate.mm` | Compatibiliteit met 0.78 template valideren |

### 2b. React 19 Migratie

**Breaking changes relevant voor CommEazy:**

1. **`forwardRef` deprecated** (5 bestanden):
   - `src/hooks/useScrollOverflow.ts`
   - `src/components/VoiceTextInput.tsx`
   - `src/components/ScrollViewWithIndicator.tsx`
   - `src/components/TextInput.tsx`
   - `src/components/SearchBar.tsx`
   - **Actie:** Werkt nog in React 19 (deprecated, niet verwijderd). Converteren naar ref-as-prop in Phase 4.

2. **`defaultProps` deprecated voor function components** — zoek in codebase, converteer naar default parameters
3. **`react-test-renderer` verwijderd** — vervangen door `@testing-library/react-native`
4. **`@types/react`** → 19.x

### 2c. React Navigation 6 → 7

**Package upgrades:**

| Package | Huidig | Doel |
|---------|--------|------|
| `@react-navigation/native` | 6.1.17 | 7.x |
| `@react-navigation/native-stack` | 6.9.26 | 7.x |
| `@react-navigation/bottom-tabs` | 6.5.20 | 7.x |
| `react-native-screens` | 3.30.1 | 4.x |
| `react-native-safe-area-context` | 4.9.0 | 5.x |

**Bestanden te wijzigen:**
- `src/navigation/index.tsx` — Root navigation setup (7 stack navigators)
- `src/components/navigation/PanelNavigator.tsx` — 5 stack navigators voor iPad Split View

**Migratieaanpak:**
1. Voeg `navigationInChildEnabled` toe aan `NavigationContainer` (backward compat bridge)
2. Controleer alle `navigation.navigate()` calls op geneste navigators
3. Gebruik `navigateDeprecated` tijdelijk indien nodig
4. Verwijder `navigationInChildEnabled` in Phase 4

### 2d. Dependency Upgrades (Stop 2)

| Package | Huidig | Doel |
|---------|--------|------|
| `@react-native-firebase/app` | 19.1.0 | 20.x |
| `@react-native-firebase/auth` | 19.1.0 | 20.x |
| `@react-native-firebase/messaging` | 19.1.0 | 20.x |
| `react-native-camera-kit` | 14.0.0 | 17.x |
| `react-native-webrtc` | 118.0.7 | 124.x |
| `react-native-webview` | 13.16.0 | Latest |
| `@types/react` | 18.2.64 | 19.x |

### 2e. Native Module Interop Validatie (KRITIEK)

Alle 19 native modules moeten getest worden tegen de New Architecture interop layer.

**Hoog risico (extra aandacht):**

| Module | Risico | Waarom |
|--------|--------|--------|
| **PiperTtsModule.mm** | Hoog | C++ bridge naar sherpa-onnx |
| **VoIPPushModule** | Hoog | Singleton pattern + AppDelegate NSClassFromString lookup |
| **GlassPlayerWindowModule** | Medium | Complex event flow + separate UIWindow |
| **LiquidGlassViewManager** | Medium | RCTViewManager → Fabric interop |
| **AirPlayRoutePickerViewManager** | Medium | RCTViewManager → Fabric interop |
| **MailBackgroundFetchModule** | Medium | Singleton + AppDelegate lookup |
| **SiriCallModule** | Medium | Singleton + AppDelegate lookup |

**Singleton validatie:**
De interop layer creëert module instances anders. Verifieer dat `NSClassFromString` lookups in `AppDelegate.mm` nog steeds de juiste singleton resolven:
```objc
// AppDelegate.mm — Deze lookups MOETEN werken onder New Architecture:
Class voipClass = NSClassFromString(@"VoIPPushModule");
Class mailBgClass = NSClassFromString(@"MailBackgroundFetchModule");
Class siriClass = NSClassFromString(@"SiriCallModule");
```

### 2f. Test Checkpoint

Alles uit Phase 1, plus:

| Test | Criterium |
|------|-----------|
| New Architecture actief | `global.__turboModuleProxy` bestaat |
| React 19 rendering | Alle schermen renderen correct |
| React Navigation 7 | Alle navigatie flows werken |
| iPad Split View | Panels + WheelNavigationMenu werken |
| Glass Player | MiniPlayer + FullPlayer met Liquid Glass |
| Video calls | WebRTC verbinding + audio/video |
| Firebase auth | Telefoon verificatie werkt |
| VoIP push | Push bereikt device, CallKit UI verschijnt |
| XMPP messaging | Berichten verzenden + ontvangen |

**Commit na succes:** `chore: upgrade React Native to 0.78.x + New Architecture + React 19 + Nav 7 (stop 2/3)`

---

## Phase 3 (Stop 3): Upgrade naar RN 0.84.x (2-3 dagen)

**Doel:** Finale target versie bereiken. Makkelijkste fase als Phase 2 gelukt is.

### 3a. Core Upgrade

| Bestand | Wijziging |
|---------|-----------|
| `package.json` | `react-native` → 0.84.x |
| `ios/Podfile` | Updaten naar 0.84 format |

**Wat wordt geabsorbeerd (0.79-0.84):**
- 0.80: Deep imports deprecated (`react-native/Libraries/...`) — audit nodig
- 0.81: Precompiled iOS builds, JSC verwijderd, node 20 minimum
- 0.82: New Architecture verplicht (al actief)
- 0.83: Geen breaking changes
- 0.84: Hermes V1 default, legacy code verwijderd, Node 22 vereist, precompiled binaries

### 3b. Deep Imports Audit (0.80 requirement)

Zoek in codebase naar `react-native/Libraries/` imports. Deze zijn deprecated in 0.80:
```bash
grep -r "react-native/Libraries" src/ --include="*.ts" --include="*.tsx"
```
Vervang door de publieke API equivalenten.

### 3c. Overige Dependency Upgrades

| Package | Actie |
|---------|-------|
| `@nozbe/watermelondb` | Test + upgrade indien nodig |
| `react-native-callkeep` | Grondig testen (niet actief onderhouden) |
| `react-native-track-player` | Upgrade naar latest |
| `react-native-keychain` | Upgrade naar latest |
| `react-native-permissions` | Upgrade naar latest |
| Alle overige | Upgrade naar latest compatible |

### 3d. Hermes V1 Validatie

Hermes V1 is default in 0.84 — automatisch actief.

**Kritieke tests:**
- FlatList/VirtualizedList crash → Is dit opgelost? Zo ja: ScrollView workaround verwijderen
- Native module race conditions → 100ms delay nog nodig?
- Cold start performance → meten en vergelijken met baseline

### 3e. Precompiled iOS Binaries

`pod install` zou ~8x sneller moeten zijn. Test:
```bash
rm -rf ios/Pods && cd ios && pod install
```
Verifieer dat custom frameworks (sherpa-onnx, SwiftMail) correct linken.

### 3f. Test Checkpoint

Volledige regressietest + specifiek:

| Test | Criterium |
|------|-----------|
| Hermes V1 actief | Check `HermesInternal` runtime versie |
| FlatList test | >100 items, geen crash |
| Cold start tijd | Meten vs baseline |
| Build tijd | `pod install` + full build meten |
| Geheugengebruik | Instruments profiling |
| Alle 13 talen | i18n laadt correct |
| Alle module schermen | Volledige visuele regressie |

**Commit na succes:** `chore: upgrade React Native to 0.84.x (stop 3/3)`

---

## Phase 4: Opschonen + Validatie (2-3 dagen)

**Doel:** Workarounds verwijderen, documentatie updaten, technische schuld afbouwen.

### Taken

1. **FlatList workaround verwijderen** als Hermes V1 de bug fixt
   - Zoek alle `ScrollView + .map()` patronen die FlatList vervingen
   - Herstel FlatList waar gepast
2. **Native module delay workaround verwijderen** als race conditions opgelost zijn
3. **`forwardRef` → ref-as-prop** converteren in 5 componenten
4. **`navigationInChildEnabled` verwijderen** na navigatie-verificatie
5. **CLAUDE.md updaten:**
   - RN versie bijwerken naar 0.84
   - Known Issues sectie updaten (opgeloste bugs verwijderen)
   - Build commands updaten
6. **`react-native.config.js` evalueren:**
   - `react-native-maps`: re-enablen? (folly conflict opgelost?)
   - `react-native-sherpa-onnx`: status evalueren
7. **MOCK_MODE_CHANGES.md updaten** — welke workarounds zijn nog relevant?
8. **Component validatie script draaien:** `./scripts/validate-components.sh --strict`
9. **Performance benchmarking:** Cold start, scroll FPS, geheugengebruik

**Commit:** `chore: post-upgrade cleanup — remove workarounds, update docs`

---

## Risico-overzicht

| Risico | Kans | Impact | Mitigatie |
|--------|------|--------|-----------|
| op-sqlite v15 incompatibel met WatermelonDB | Laag | Hoog | Onafhankelijke SQLite instances; apart testen |
| Native module faalt onder interop layer | Medium | Hoog | Die ene module converteren naar TurboModule |
| PiperTtsModule.mm C++ compilatie faalt | Medium | Hoog | sherpa-onnx compilatie isoleren; header search paths updaten |
| React Navigation 7 geneste navigatie breekt | Medium | Medium | `navigationInChildEnabled` bridge prop |
| react-native-callkeep incompatibel | Medium | Hoog | Custom CallKit native module schrijven (~200 LOC) |
| Liquid Glass UIGlassEffect regressie | Laag | Medium | `@available(iOS 26, *)` guards beschermen |
| SwiftMail local package conflicteert met Pods | Laag | Medium | SwiftMail is Xcode project-linked, niet via Pods |
| Singleton NSClassFromString faalt onder New Arch | Medium | Hoog | Module instantiatie patroon aanpassen |

---

## Kritieke Bestanden

De 10 meest kritieke bestanden voor deze upgrade:

| # | Bestand | Waarom kritiek |
|---|---------|----------------|
| 1 | `package.json` | Alle dependency versies |
| 2 | `ios/Podfile` | iOS deps, Flipper, New Arch flags, header paths |
| 3 | `ios/CommEazyTemp/AppDelegate.mm` | 268 regels: Firebase, PushKit, CallKit, Siri, bundleURL |
| 4 | `ios/CommEazyTemp/AppDelegate.h` | Superclass + protocol conformances |
| 5 | `src/navigation/index.tsx` | Root navigatie → React Nav 7 migratie |
| 6 | `src/components/navigation/PanelNavigator.tsx` | 5 stack navigators → React Nav 7 |
| 7 | `metro.config.js` | Metro config format + Node.js shims |
| 8 | `babel.config.js` | Preset hernoeming |
| 9 | `ios/CommEazyTemp/PiperTtsModule.mm` | C++ bridge — hoogste risico bij RN upgrade |
| 10 | `react-native.config.js` | Auto-linking configuratie |

---

## Dependency Matrix (Volledig)

### Moeten upgraden (breaking)

| Package | Huidig | Doel | Phase |
|---------|--------|------|-------|
| `react` | 18.2.0 | 19.x | 2 |
| `react-native` | 0.73.6 | 0.84.x | 1-3 |
| `@op-engineering/op-sqlite` | 9.3.0 | 15.x | 1 |
| `@react-navigation/native` | 6.1.17 | 7.x | 2 |
| `@react-navigation/native-stack` | 6.9.26 | 7.x | 2 |
| `@react-navigation/bottom-tabs` | 6.5.20 | 7.x | 2 |
| `react-native-screens` | 3.30.1 | 4.x | 2 |
| `react-native-safe-area-context` | 4.9.0 | 5.x | 2 |
| `@react-native-firebase/app` | 19.1.0 | 20.x | 2 |
| `@react-native-firebase/auth` | 19.1.0 | 20.x | 2 |
| `@react-native-firebase/messaging` | 19.1.0 | 20.x | 2 |
| `react-native-webrtc` | 118.0.7 | 124.x | 2 |
| `react-native-camera-kit` | 14.0.0 | 17.x | 2 |

### Moeten vervangen (dood project)

| Package | Vervanging | Phase |
|---------|------------|-------|
| `react-native-fast-image` | `@d11/react-native-fast-image` | 1 |
| `react-test-renderer` | `@testing-library/react-native` | 2 |
| `@types/react-native` | Verwijderen (bundled in RN 0.76+) | 1 |

### Moeten upgraden (minor/patch)

| Package | Phase |
|---------|-------|
| `@nozbe/watermelondb` | 1 (testen) |
| `react-native-webview` | 2 |
| `react-native-device-info` | 2 |
| `react-native-keychain` | 3 |
| `react-native-permissions` | 3 |
| `react-native-haptic-feedback` | 3 |
| `react-native-track-player` | 3 |
| `react-native-svg` | 3 |
| `react-native-image-crop-picker` | 3 |

### Monitoren (mogelijk problematisch)

| Package | Risico | Actie |
|---------|--------|-------|
| `react-native-callkeep` | Medium | Niet actief onderhouden. Als broken → custom CallKit module |
| `react-native-incall-manager` | Medium | Test audio routing bij Phase 2 |
| `react-native-fs` | Laag | Werkt via interop; vervangen post-upgrade |
| `@xmpp/client` | Laag | Pure JS, test WebSocket + Node shims |

---

## Verificatie Plan

### Na Phase 1 (RN 0.76)
- `cmd+B` in Xcode → 0 errors
- Metro start → bundle serveert naar simulator
- iPhone 14 (fysiek) → bundle laadt via LAN
- TTS → Piper spreekt Nederlands
- Liquid Glass → UIGlassEffect rendert

### Na Phase 2 (RN 0.78 + New Arch)
- `global.__turboModuleProxy` → bestaat in JS runtime
- Alle 19 native modules → geen crashes
- VoIP push → bereikt device, CallKit UI
- Video call → WebRTC verbinding
- iPad Split View → panels werken correct
- Navigatie → alle flows werken (onboarding, main, modals)

### Na Phase 3 (RN 0.84)
- `HermesInternal` → V1 versie
- FlatList → test met >100 items
- Cold start → meten vs Phase 0 baseline
- Build tijd → meten (`pod install` + full build)
- Alle 13 talen → correct geladen
- Volledige visuele regressie alle schermen

### Na Phase 4 (Opschonen)
- `./scripts/validate-components.sh --strict` → 0 violations
- Geen `console.log` debug statements in production code
- CLAUDE.md → correct bijgewerkt
- Git history → clean commits per fase

---

## Toekomstig Werk (Post-Upgrade, Separaat)

Deze taken zijn bewust NIET onderdeel van het upgrade plan:

1. **TurboModule migratie** — Alle 19 native modules converteren (apart project)
2. **react-native-fs vervangen** — Migreren naar `expo-file-system` (10 import sites)
3. **AppDelegate Swift migratie** — Pas wanneer Swift↔C++ interop stabiel is
4. **CocoaPods → SPM migratie** — Pas wanneer CocoaPods deprecated wordt (dec 2026)
5. **FlatList rehabilitatie** — ScrollView workarounds verwijderen als Hermes V1 bug fixt
