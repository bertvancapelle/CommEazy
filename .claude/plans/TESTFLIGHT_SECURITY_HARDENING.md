# TestFlight Security Hardening — Implementatieplan (Fase 1-4)

> **Status:** ✅ Fase 1-3 VOLTOOID — Fase 4 evalueren tijdens TestFlight
> **Doelgroep:** 5-10 externe testers via TestFlight
> **Aanpak:** Fase 4-fundamenten worden in Fase 1-3 ingebouwd
> **Aangemaakt:** Maart 2026 (PNA sessie)
> **Laatste update:** 16 maart 2026 — Fase 1-3 geïmplementeerd

---

## Overzicht

Dit plan dekt alle 36 bevindingen uit de security audit (7 CRITICAL, 13 HIGH, 10 MEDIUM, 6 LOW).

| Fase | Doel | Items | Status |
|------|------|-------|--------|
| **Fase 1** | BLOKKEERDERS — zonder deze geen TestFlight | 6 items | ✅ VOLTOOID |
| **Fase 2** | HIGH-PRIORITY — noodzakelijk voor externe testers | 6 items | ✅ VOLTOOID (2.5 deferred) |
| **Fase 3** | LOGGING & HYGIENE — polijsten voor externe testers | 4 items | ✅ VOLTOOID |
| **Fase 4** | EVALUATE DURING TESTFLIGHT — fundamenten nu, evaluatie later | 5 items | ⏳ TestFlight |

---

## Fase 1: BLOKKEERDERS ✅

### 1.1 Database Encryptie Fix ✅

**Severity:** CRITICAL
**Huidig:** `container.ts:241` maakt een zero-filled `ArrayBuffer(32)`. `database.ts:55-63` berekent `keyHex` maar geeft deze NIET door aan `SQLiteAdapter`.

**Nieuw:**
- Genereer random 256-bit key bij eerste app-launch via `react-native-libsodium` (`randombytes_buf(32)`)
- Sla de key op in iOS Keychain (via `react-native-keychain`) met `accessible: AFTER_FIRST_UNLOCK` (overleeft iCloud Backup)
- Geef de key door als `encryptionKey` parameter aan `SQLiteAdapter`
- Bij volgende launches: haal key op uit Keychain

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `src/services/database.ts` | `SQLiteAdapter({ ..., encryptionKey: keyHex })` |
| `src/services/container.ts` | Keychain read/write ipv `new ArrayBuffer(32)` |
| `src/services/keyManager.ts` | **NIEUW** — dedicated key management service (Fase 4 fundament: key rotation interface) |

**Fase 4 fundament:** `keyManager.ts` krijgt nu al een `rotateKey()` stub met `// TODO: implement key rotation` zodat we bij Fase 4 niet de hele architectuur hoeven om te gooien.

**Risico:** Bestaande databases worden onleesbaar na deze fix (key verandert van 0x00... naar random). **Mitigatie:** Dit is acceptabel — testers beginnen met schone database. Documenteer in TestFlight release notes.

---

### 1.2 App Transport Security (ATS) Hardening ✅

**Severity:** MEDIUM-HIGH
**Huidig:** `Info.plist:60` — `NSAllowsArbitraryLoads: true` (alles HTTP toegestaan)

**Nieuw:**
```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <false/>
  <key>NSAllowsLocalNetworking</key>
  <true/>  <!-- Metro bundler op localhost -->
  <key>NSAllowsArbitraryLoadsForMedia</key>
  <true/>  <!-- Radio streams vaak via HTTP -->
  <key>NSExceptionDomains</key>
  <dict>
    <key>gutenberg.org</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
      <key>NSExceptionMinimumTLSVersion</key>
      <string>TLSv1.2</string>
    </dict>
  </dict>
</dict>
```

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `ios/CommEazyTemp/Info.plist` | ATS hardening zoals hierboven |

**Uitzondering `NSAllowsArbitraryLoadsForMedia`:** Radio streams (ShoutCast/Icecast) gebruiken vaak HTTP. Zonder deze uitzondering stopt radio voor ~40% van de zenders. Apple accepteert deze uitzondering bij App Review.

---

### 1.3 Dev Credentials Verwijderen uit Production Bundle ✅

**Severity:** HIGH
**Huidig:** `devConfig.ts` bevat hardcoded passwords (`'test123'`), API keys (OWM, KNMI), en test accounts.

**Nieuw:**
- `devConfig.ts` wordt ALLEEN geladen achter `__DEV__` check (tree-shaking verwijdert het uit release bundle)
- API keys verplaatsen naar `react-native-config` (`.env` bestand, niet in git)
- Verificatie: build release bundle en grep op `test123` / API key strings

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `src/config/devConfig.ts` | Wrap hele module in `if (__DEV__)` export guard |
| `.env` | **NIEUW** — `OWM_API_KEY=xxx`, `KNMI_API_KEY=xxx` |
| `.env.example` | **NIEUW** — template zonder waarden |
| `.gitignore` | Toevoegen: `.env` |
| `src/config/apiKeys.ts` | **NIEUW** — leest uit `react-native-config` met fallback naar devConfig |

**Fase 4 fundament:** `apiKeys.ts` krijgt een `SecureConfig` interface die later kan switchen naar server-side config (API keys niet in bundle).

---

### 1.4 PIN Setup Implementeren ✅

**Severity:** CRITICAL
**Huidig:** `PinSetupScreen.tsx:90` — PIN wordt gecollecteerd maar weggegooid (`setTimeout(500)` als placeholder).

**Nieuw:**
- Na PIN bevestiging: sla PIN hash op in Keychain (Argon2id hash, niet plaintext)
- Roep `encryptionService.createBackup(pin)` aan om E2E key backup te maken
- Sla backup versleuteld op in Keychain (apart van de key zelf)

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `src/screens/onboarding/PinSetupScreen.tsx` | `await encryptionService.createBackup(pin)` + Keychain store |
| `src/services/encryption.ts` | Verifieer `createBackup()` correct werkt (al geïmplementeerd) |
| `src/services/keyManager.ts` | PIN hash + backup storage functies |

---

### 1.5 Plaintext Mode / Test Keys Verwijderen ✅

**Severity:** CRITICAL
**Huidig:** `chat.ts:200-211` — `isPlaintextMode()` bypass. `chat.ts:220-224` — test key fallback. `chat.ts:748` — plaintext reception handler.

**Nieuw:**
- **Verwijder** `isPlaintextMode()` functie volledig
- **Verwijder** `mock/testKeys.ts` import en fallback
- **Verwijder** plaintext reception handler
- **Validatie:** `__DEV__` guards zijn acceptabel als extra laag, maar de plaintext paden moeten weg

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `src/services/chat.ts` | Verwijder plaintext bypass (3 locaties) |
| `src/services/mock/testKeys.ts` | Markeer als dev-only of verwijder |

---

### 1.6 Console Log Stripping (Production Build) ✅

**Severity:** MEDIUM
**Huidig:** Honderden `console.log`/`console.debug` statements. `babel-plugin-transform-remove-console` is gepland maar niet geconfigureerd.

**Nieuw:**
- Configureer `babel.config.js` met `transform-remove-console` plugin voor release builds
- Behoud `console.warn` en `console.error` (nuttig voor crash diagnostiek)
- Native logging: wrap NSLog statements in `#if DEBUG`

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `babel.config.js` | `plugins: [['transform-remove-console', { exclude: ['warn', 'error'] }]]` in production |
| `ios/` alle `.swift` bestanden | `NSLog` → `#if DEBUG` wrapper |

---

## Fase 2: HIGH-PRIORITY ✅

### 2.1 Token Migratie naar Keychain ✅

**Severity:** HIGH (Google OAuth) / MEDIUM (JWT)
**Huidig:** `tokenManager.ts:276-286` — JWT tokens in AsyncStorage. `AskAIContext.tsx:43,250` — Google OAuth token in AsyncStorage.

**Nieuw:**
- JWT access/refresh tokens → Keychain met `accessible: WHEN_UNLOCKED`
- Google OAuth token → Keychain met `accessible: WHEN_UNLOCKED`
- Migratie: bij app update, lees uit AsyncStorage → schrijf naar Keychain → verwijder uit AsyncStorage

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `src/services/attestation/tokenManager.ts` | Keychain ipv AsyncStorage |
| `src/contexts/AskAIContext.tsx` | Keychain ipv AsyncStorage |
| `src/services/secureStorage.ts` | **NIEUW** — abstractielaag (Fase 4 fundament: unified secure storage) |

**Fase 4 fundament:** `secureStorage.ts` biedt een uniforme API voor Keychain/Keystore access. Alle toekomstige gevoelige data gaat via deze service.

---

### 2.2 Biometric Key Restore Fix ✅

**Severity:** HIGH
**Huidig:** `encryption.ts` `restoreBackup()` slaat private key op in Keychain ZONDER `accessControl: BIOMETRY_ANY`. Key generation WEL (correct).

**Nieuw:**
- `restoreBackup()` krijgt dezelfde `accessControl: BIOMETRY_ANY` als key generation
- Consistent gedrag: key altijd beschermd door biometrie

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `src/services/encryption.ts` | `Keychain.setGenericPassword(...)` in `restoreBackup()` met `accessControl` |

---

### 2.3 Prosody Server Hardening ✅

**Severity:** CRITICAL (meerdere items)
**Huidig:**
- `allow_registration = true` (open registratie)
- `auto_accept_subscriptions` module actief
- `c2s_require_encryption = false`
- `push_http_secret = "commeazy-dev-push-secret-2024"`

**Nieuw:**

| Setting | Huidig | Nieuw |
|---------|--------|-------|
| `allow_registration` | `true` | `false` |
| `auto_accept_subscriptions` | Ingeschakeld | Verwijderd uit `modules_enabled` |
| `c2s_require_encryption` | `false` | `true` |
| `push_http_secret` | Hardcoded weak | `openssl rand -base64 32` output |
| `rate limit` | `100kb/s` | `10kb/s` |
| `log level` | `debug = "*console"` | `info = "/var/log/prosody/prosody.log"` |

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `/opt/homebrew/etc/prosody/commeazy.cfg.lua` | 6 wijzigingen (zie tabel) |
| `/opt/homebrew/etc/prosody/prosody.cfg.lua` | Push secret rotatie |
| `server/push-gateway/.env` | Nieuw push secret (match Prosody) |

**Impact op development:** Na deze wijziging werkt de dev-omgeving alleen met TLS.

**Oplossing:** Twee Prosody configs — `commeazy-dev.cfg.lua` (huidige permissieve config) en `commeazy-prod.cfg.lua` (geharde config). TestFlight build wijst naar productie config.

---

### 2.4 WebView originWhitelist Beperken ✅

**Severity:** CRITICAL (mismatch met domain whitelist)
**Huidig:** `ArticleWebViewer.tsx:1127` — `originWhitelist={['https://*', 'http://*']}` (alles toegestaan)

**Nieuw:**
```typescript
originWhitelist={['https://*']}  // Alleen HTTPS
```

De `onShouldStartLoadWithRequest` handler (domain whitelist) is de primaire verdediging. De `originWhitelist` wordt de backup verdediging door HTTP te blokkeren.

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `src/components/ArticleWebViewer.tsx` | `originWhitelist={['https://*']}` |

---

### 2.5 Certificate Pinning (Basis) ⏳ DEFERRED

**Severity:** HIGH
**Huidig:** Geen certificate pinning in de gehele codebase.

**Nieuw:**
- Pin het TLS certificaat voor `commeazy.nl` (XMPP WebSocket)
- Pin het TLS certificaat voor `api.commeazy.com` (API Gateway)
- Gebruik `TrustKit` (iOS native) voor pinning

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `ios/CommEazyTemp/TrustKit.plist` | **NIEUW** — pinned certificate hashes |
| `ios/CommEazyTemp/AppDelegate.mm` | TrustKit initialisatie |
| `src/services/xmpp.ts` | Pin check voor WebSocket verbinding |

**Fase 4 fundament:** TrustKit configuratie maakt het later eenvoudig om meer domeinen toe te voegen.

---

### 2.6 SMTP Path Sanitization ✅ (was al geïmplementeerd)

**Severity:** MEDIUM
**Huidig:** `MailModule.swift:783` — `filePath` direct als URL zonder sanitisatie bij send.

**Nieuw:**
```swift
let sanitizedPath = (filePath as NSString).lastPathComponent
let fileURL = tempDirectoryURL.appendingPathComponent(sanitizedPath)
```

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `ios/MailModule.swift` | Path sanitisatie in `sendMessage` functie |

---

## Fase 3: LOGGING & HYGIENE ✅

### 3.1 Native NSLog Audit ✅

**Scope:** Alle `.swift` en `.m` bestanden in `ios/`

**Actie per bestand:**
- `NSLog` met PII (contactnamen, nummers) → verwijderen of `#if DEBUG`
- `NSLog` met technische info (state changes) → `#if DEBUG`
- `NSLog` met errors → behouden (nuttig voor crash reporting)

**Bekende PII-logs:**

| Bestand | Lijn | Inhoud |
|---------|------|--------|
| `ios/SiriCallModule.swift` | ~97 | Contactnamen in NSLog |
| `ios/VoIPPushModule.swift` | ~85 | Raw push payload doorsturen |

---

### 3.2 VoIP Push Payload Filtering ✅

**Severity:** MEDIUM
**Huidig:** `VoIPPushModule.swift:85-89` — forwardt complete raw payload naar JS.

**Nieuw:**
```swift
@objc func didReceiveVoIPPush(_ payload: [AnyHashable: Any]) {
  // Extract only required fields
  let filtered: [String: Any] = [
    "callId": payload["callId"] ?? "",
    "callerJid": payload["from"] ?? "",
    "type": payload["type"] ?? "call"
  ]
  if hasListeners {
    sendEvent(withName: "onVoIPPush", body: filtered)
  }
}
```

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `ios/VoIPPushModule.swift` | Payload filtering |

---

### 3.3 Dead Code Eliminatie ✅

**Verwijder volledig:**
- `src/services/mock/testKeys.ts` (als niet al in Fase 1)
- Alle `isPlaintextMode()` referenties
- `console.log` statements die PII bevatten (namen, JIDs) — ook onder `__DEV__` guard

---

### 3.4 Push Gateway Hardening ✅

**Huidig:** `LOG_LEVEL=debug`, APNs environment = development

**Nieuw:**

| Setting | Huidig | Nieuw |
|---------|--------|-------|
| `LOG_LEVEL` | `debug` | `info` |
| `APNS_ENVIRONMENT` | `development` | `production` |
| `APNS_BUNDLE_ID` | `org.reactjs.native.example.CommEazyTemp` | Productie bundle ID |

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `server/push-gateway/.env` | LOG_LEVEL, APNS_ENVIRONMENT, APNS_BUNDLE_ID |

---

## Fase 4: EVALUATE DURING TESTFLIGHT

> **Strategie:** De *interfaces* en *abstracties* worden in Fase 1-3 al neergezet. De *implementatie* van Fase 4 items wordt geëvalueerd op basis van TestFlight bevindingen.

### 4.1 Invitation Code Versterking

**Fundament gelegd in Fase 1:** `keyManager.ts` heeft al crypto utilities.

**Evaluatie-criteria tijdens TestFlight:**
- Worden invitation codes daadwerkelijk onderschept? (monitor via Push Gateway logs)
- Hoeveel brute-force attempts worden gedetecteerd?

**Als nodig:**
- Upgrade van BLAKE2b direct hash → Argon2id met salt
- Verleng code van 8 naar 12 karakters (van ~41 bit naar ~62 bit entropy)
- Rate limiting op decryptie pogingen (max 5 per minuut)

**Bestanden (indien geactiveerd):**

| Bestand | Wijziging |
|---------|-----------|
| `src/services/invitation/invitationCrypto.ts` | Argon2id + salt + langere codes |

---

### 4.2 App-Level Biometric Lock

**Fundament gelegd in Fase 1:** PIN is opgeslagen in Keychain (Fase 1.4).

**Evaluatie-criteria:**
- Vragen testers om een app-lock feature?
- Hoeveel testers zijn senioren die hun device delen?

**Als nodig:**
- App-lock scherm bij terugkeer uit achtergrond (na X minuten inactief)
- Unlock via biometrie (FaceID/TouchID) of PIN fallback
- Configureerbaar timeout: 1/5/15/30 minuten of "nooit"

---

### 4.3 Presence Subscription Consent

**Fundament gelegd in Fase 2:** Prosody `auto_accept_subscriptions` is verwijderd.

**Evaluatie-criteria:**
- Hoe gedragen testers zich met presence? Vinden ze het verwarrend?
- Is de UX flow voor "toestemming geven" begrijpelijk voor senioren?

**Als nodig:**
- `xmpp.ts:623-632` — vervang auto-accept door UI prompt
- Modal: "**[Naam] wil zien wanneer je online bent. Toestaan?**"
- Senior-toets: Eenvoudige ja/nee keuze, geen technisch jargon

---

### 4.4 Key Rotation

**Fundament gelegd in Fase 1:** `keyManager.ts` heeft `rotateKey()` stub.

**Evaluatie-criteria:**
- Langlopende TestFlight testers (>30 dagen)
- Worden er verouderde keys gedetecteerd?

**Als nodig:**
- Automatische key rotation elke 90 dagen
- Re-encryptie van database met nieuwe key
- Notificatie aan gebruiker: "Je beveiliging is bijgewerkt"

---

### 4.5 Attestation Productie Verificatie

**Fundament gelegd in Fase 2:** Attestation middleware structuur bestaat al.

**Evaluatie-criteria:**
- TestFlight builds gebruiken al App Attest (development environment)
- Monitor: hoeveel attestation failures bij echte devices?

**Als nodig:**
- Volledige X.509 certificate chain verificatie (`attestation.js:107`)
- Redis ipv in-memory `Map()` voor attestation store
- Key expiratie (30 dagen)

---

## Implementatievolgorde (Dependency Graph)

```
Fase 1 (PARALLEL mogelijk):
  1.1 DB Encryptie ──────┐
  1.2 ATS Hardening      │
  1.3 Dev Credentials ───┤── Allemaal onafhankelijk
  1.4 PIN Setup ─────────┤
  1.5 Plaintext Removal  │
  1.6 Console Stripping ─┘

Fase 2 (NA Fase 1):
  2.1 Token Migratie ←── hangt af van 1.1 (keyManager.ts)
  2.2 Biometric Fix
  2.3 Prosody Hardening ←── apart van app (server config)
  2.4 WebView Fix
  2.5 Certificate Pinning ←── na 2.3 (pinnen op productie cert)
  2.6 SMTP Sanitization

Fase 3 (NA Fase 2):
  3.1 NSLog Audit
  3.2 VoIP Payload Filter
  3.3 Dead Code Cleanup ←── na 1.5 (plaintext removal)
  3.4 Push Gateway Hardening ←── na 2.3 (push secret sync)

Fase 4 (DURING TestFlight):
  4.1-4.5 ←── evaluatie op basis van tester feedback + monitoring
```

---

## TestFlight Evaluatiemomenten

| Moment | Wat evalueren | Data source |
|--------|---------------|-------------|
| **Na 1 week** | Crash reports, attestation failures | Xcode Organizer + API Gateway logs |
| **Na 2 weken** | Feature usage, invitation flow succes rate | Push Gateway logs + tester feedback |
| **Na 4 weken** | Performance degradation, key rotation behoefte | Memory profiling + database grootte |
| **Doorlopend** | Security incidents, onverwacht gedrag | Console logs (warn/error) + tester rapportage |

---

## Risico Analyse

| Item | Risico | Impact | Mitigatie |
|------|--------|--------|-----------|
| 1.1 DB Encryptie | Database wipe bij bestaande users | HOOG | TestFlight = nieuwe install |
| 1.2 ATS | Radio streams stoppen | MEDIUM | `NSAllowsArbitraryLoadsForMedia` behouden |
| 2.3 Prosody | Dev omgeving breekt | HOOG | Aparte dev/prod config |
| 2.5 Cert Pinning | App onbruikbaar bij cert rotatie | HOOG | Pin op intermediate CA, niet leaf cert |
| 4.3 Presence | Verwarrende UX voor senioren | MEDIUM | A/B test met subset testers |

---

## Wat de Externe Testers Krijgen

Na Fase 1-3 krijgen de 5-10 externe testers een app die:

- ✅ Versleutelde lokale database heeft (Fase 1.1)
- ✅ Geen hardcoded credentials bevat (Fase 1.3)
- ✅ Geen plaintext berichten kan versturen (Fase 1.5)
- ✅ TLS afdwingt voor alle communicatie (Fase 1.2 + 2.3)
- ✅ Tokens veilig opslaat in Keychain (Fase 2.1)
- ✅ Certificate pinning heeft (Fase 2.5)
- ✅ Geen debug logging lekt (Fase 1.6 + 3.1)
- ✅ Push payloads gefilterd (Fase 3.2)

---

## Referenties

- Security audit rapport: PNA sessie maart 2026
- Bevindingen: 7 CRITICAL, 13 HIGH, 10 MEDIUM, 6 LOW
- Gerelateerde plannen: `BACKUP_RESTORE_PLAN.md`, `TRUST_AND_ATTESTATION_PLAN.md`
