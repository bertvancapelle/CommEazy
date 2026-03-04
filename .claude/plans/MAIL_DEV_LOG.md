# CommEazy Mail Module — Ontwikkelverslag

> **Doel:** Handoff-document tussen sessies. Elke fase wordt hier bijgehouden met status, beslissingen, en openstaande punten.
> **Referentie:** `MAIL_MODULE_PROMPT.md` v3.0

---

## Sessie Overzicht

| Sessie | Datum | Fasen | Status |
|--------|-------|-------|--------|
| 1 | 2026-03-03 | Fase 3 (iOS native module) | ✅ Voltooid |
| 2 | 2026-03-03 | Fase 5 (TS bridge + SQLite) | ✅ Voltooid |
| 3 | 2026-03-03 | Fase 6-7 (OAuth2 + Providers) | ✅ Voltooid |
| 4 | 2026-03-03 | Fase 8 (Onboarding wizard) | ✅ Voltooid |
| 5 | TBD | Fase 9-10 (Settings + Mail UI) | ⏳ Gepland |
| 6 | TBD | Fase 11-12 (Tests + QA) | ⏳ Gepland |
| 7 | TBD | Fase 13-14 (Contacten + Bijlagen) | ⏳ Gepland |
| 8 | TBD | Fase 15-17 (Integraties + Opslaan) | ⏳ Gepland |

---

## Test Checkpoints

### 🧪 Test 1: Na Fase 8 (Onboarding Wizard)
**Wat testen:**
- App openen → Mail module zichtbaar in wheel menu
- Mail module openen → Welcome modal verschijnt
- Onboarding doorlopen met echt e-mailaccount (Gmail/Outlook/KPN)
- Verbinding succesvol → bevestigingsscherm
- Verbinding mislukt → foutmelding met herstelactie

**Verwacht resultaat:** Een echt e-mailaccount kan worden gekoppeld.

### 🧪 Test 2: Na Fase 10 (Inbox + Detail + Compose)
**Wat testen:**
- Inbox toont e-mails van gekoppeld account
- Mail openen → detail weergave (HTML + plaintext)
- Zoeken werkt (lokaal + server)
- Nieuw bericht opstellen en verzenden
- Beantwoorden en doorsturen
- Pull-to-refresh synchroniseert nieuwe mails

**Verwacht resultaat:** Volledige mail workflow werkt.

### 🧪 Test 3: Na Fase 17 (Alle Integraties)
**Wat testen:**
- Contacten selecteren bij mail opstellen
- Foto's uit album bijvoegen
- Foto's uit ontvangen mail opslaan in album
- Bulk opslaan van meerdere bijlagen
- Voice commands voor mail acties
- iPad Split View layout
- Liquid Glass op iOS 26+

**Verwacht resultaat:** Alle cross-module integraties werken.

---

## Fase 3: Native iOS Module (SwiftMail) — Sessie 1

### Status: ✅ Voltooid

### Beslissingen
- SwiftMail v1.0.3 via SPM (niet CocoaPod)
- `MailModule.swift` als `RCTEventEmitter` subclass (patroon van AppleMusicModule)
- `MailModule.m` ObjC bridge met `RCT_EXTERN_MODULE` + `RCT_EXTERN_METHOD` macros
- Privacy Manifest: geen aanpassingen nodig (geen Required Reason APIs buiten bestaande)

### SwiftMail API Samenvatting (geverifieerd)

**IMAPServer:**
- `init(host:port:numberOfThreads:)` — geen encryption parameter in init, SSL based on port
- `connect()` → `login(username:password:)` of `authenticateXOAUTH2(email:accessToken:)`
- `selectMailbox(_:)` → `fetchMessageInfosBulk(using:)` — retourneert `[MessageInfo]`
- `fetchStructure(_:)` → `fetchPart(section:of:)` — voor body en bijlagen
- `search(identifierSet:criteria:calendar:)` — retourneert `MessageIdentifierSet`
- `store(flags:on:operation:)` — voor markeren gelezen/verwijderd
- `expunge()` — definitief verwijderen
- `logout()` / `disconnect()`

**SMTPServer:**
- `init(host:port:numberOfThreads:)` — SSL/STARTTLS based on port
- `connect()` → `login(username:password:)` of `authenticateXOAUTH2(email:accessToken:)`
- `sendEmail(_:)` — verstuurt Email object
- `disconnect()`

**Email type:**
- `Email(sender:recipients:ccRecipients:bccRecipients:subject:textBody:htmlBody:attachments:)`
- `EmailAddress(name:address:)`
- `Attachment(filename:mimeType:data:contentID:isInline:)` of `Attachment(fileURL:)`

### Geïmplementeerde Methods

**IMAP (via IMAPServer actor):**
| Method | Parameters | Retourneert |
|--------|-----------|-------------|
| `connectIMAP` | host, port, username, password?, accessToken? | `true` |
| `disconnect` | — | `true` |
| `listMailboxes` | — | `[{name, delimiter}]` |
| `fetchHeaders` | folderName, limit | `[{uid, sequenceNumber, subject, date, from, to, isRead, isFlagged, hasAttachment}]` |
| `fetchMessageBody` | uid, folderName | `{html?, plainText?, attachments:[{index, name, size, mimeType}]}` |
| `fetchAttachmentData` | uid, folderName, partIndex | `{base64?, filePath?, fileName, mimeType, fileSize}` |
| `searchMessages` | folderName, query | `[uid, ...]` (array of UIDs) |
| `markAsRead` | uid, folderName | `true` |
| `markAsFlagged` | uid, folderName, flagged | `true` |
| `deleteMessage` | uid, folderName | `true` |
| `moveMessage` | uid, fromFolder, toFolder | `true` |
| `testConnection` | imapHost, imapPort, smtpHost, smtpPort, username, password?, accessToken? | `{imapSuccess, smtpSuccess, inboxCount}` |

**SMTP (via SMTPServer actor):**
| Method | Parameters | Retourneert |
|--------|-----------|-------------|
| `sendMessage` | smtpHost, smtpPort, username, password?, accessToken?, from, to, cc?, bcc?, subject, body, htmlBody?, attachments? | `true` |

**Events:**
| Event | Body | Wanneer |
|-------|------|---------|
| `MailAttachmentProgress` | `{uid, partIndex, progress, status}` | Tijdens attachment download |

### Bestanden Aangemaakt
- `ios/MailModule.swift` (847 regels) — Native IMAP/SMTP module met SwiftMail
- `ios/MailModule.m` (124 regels) — ObjC bridge header

### Bestanden Gewijzigd
- (geen — SPM dependency moet handmatig in Xcode worden toegevoegd)

### Openstaande Punten na Fase 3
- [x] **SwiftMail SPM dependency toevoegen** — Opgelost via lokaal SPM package (git submodule)
- [x] **Build validatie** — Build succesvol (0 errors, 44s)

### SwiftMail Integratie Details
- Remote SPM mislukt (complexe dependency tree: swift-testing 0.12.0 exact pin, SwiftText main branch)
- Opgelost via git submodule: `ios/LocalPackages/SwiftMail` (v1.0.3 tag)
- Xcode referentie: `ios/SwiftMail/` als lokaal Swift Package
- pbxproj bevat: `XCLocalSwiftPackageReference`, `XCSwiftPackageProductDependency`, `PBXBuildFile`

### API Correcties (v1.0.3 vs originele aannames)
| Origineel (fout) | Gecorrigeerd | Reden |
|-------------------|-------------|-------|
| `Mailbox.Info.path` | `.name` | Property heet `name` in SwiftMail |
| `Mailbox.Info.delimiter` | `.hierarchyDelimiter` | Property heet `hierarchyDelimiter` |
| `MessageIdentifierRange<T>` | `MessageIdentifierSet<T>(range)` | Type bestaat niet, gebruik ClosedRange in init |
| `MessagePart.type` | `.contentType` | Property heet `contentType` |
| `MessagePart.section` (optional) | `.section` (non-optional) | Section is altijd aanwezig |
| `MessagePart.size` | `.data?.count` | Geen `size` property, gebruik data length |
| `MessageIdentifierSet.map` | `.toArray().map` | Set heeft geen map, wel toArray() |
| `UID.rawValue` | `.value` | SwiftMail UID heeft `value` property |
| `SequenceNumber?.rawValue` | `.value` (non-optional) | SequenceNumber is niet optional in MessageInfo |
| `msg.flags?` (optional) | `msg.flags` (non-optional) | flags is `[Flag]`, niet optional |
| `msg.from` als `[EmailAddress]` | als `String?` | SwiftMail retourneert from als plain string |
| `msg.to` als `[EmailAddress]?` | als `[String]` | SwiftMail retourneert to als string array |

### Volgende Sessie: Fase 5
**Voorbereid:**
- MailModule.swift is klaar met alle IMAP/SMTP methods (build-validated)
- Bridge header (MailModule.m) exporteert alle methods
- SwiftMail v1.0.3 lokaal gelinkt en gevalideerd
- Privacy Manifest ongewijzigd (geen nieuwe Required Reason APIs)

**Te doen in Fase 5:**
- `src/types/mail.ts` — TypeScript interfaces
- `src/services/mail/imapBridge.ts` — NativeModules wrapper
- `src/services/mail/smtpBridge.ts` — SMTP wrapper
- `src/services/mail/imapService.ts` — Sync strategie
- `src/services/mail/imapSearch.ts` — Gecombineerd zoeken
- `src/services/mail/mailCache.ts` — SQLite + FTS5 database
- `src/models/mailDatabase.ts` — Database setup

---

## Fase 5: TypeScript Bridge + SQLite — Sessie 2

### Status: ✅ Voltooid

### Beslissingen
- **SQLite library:** `op-sqlite` gekozen (modern, maintained, FTS5 support, SQLCipher)
  - WatermelonDB ondersteunt geen FTS5 virtual tables → aparte database nodig
  - `op-sqlite` nog niet geïnstalleerd — dependency toevoegen in latere fase (voor Test 1)
- **Database apart van WatermelonDB:** Eigen `mail_cache.db` met SQLCipher encryptie
- **TypeScript types matchen native return types:** `from` is `String` (niet `[EmailAddress]`), `to` is `string[]`
- **Email address parsing op TS-side:** `parseEmailAddress()` en `formatEmailAddress()` utilities in types
- **FTS5 tokenizer:** `unicode61` (goede multi-taal ondersteuning)
- **Sync state:** Via AsyncStorage (lichtgewicht, per account+folder)

### Architectuur

```
┌─────────────────────────────────────────────────────────────────┐
│  React Native Layer                                              │
│                                                                  │
│  src/types/mail.ts          ← TypeScript interfaces              │
│  src/services/mail/                                              │
│    imapBridge.ts            ← NativeModules wrapper (IMAP)       │
│    smtpBridge.ts            ← NativeModules wrapper (SMTP)       │
│    imapService.ts           ← Sync strategie (initial/incremental)│
│    imapSearch.ts            ← Gecombineerd FTS5 + IMAP zoeken    │
│    mailCache.ts             ← SQLite CRUD + FTS5 indexering       │
│    index.ts                 ← Public API exports                  │
│  src/models/                                                     │
│    mailDatabase.ts          ← Database setup, schema, migrations  │
├─────────────────────────────────────────────────────────────────┤
│  Native iOS Layer                                                │
│  ios/MailModule.swift       ← SwiftMail IMAP/SMTP (Fase 3)      │
│  ios/MailModule.m           ← ObjC bridge                        │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema (mail_cache.db)

**mail_headers:**
```sql
uid INTEGER, account_id TEXT, folder TEXT  -- PK: (uid, account_id, folder)
from_raw TEXT, from_name TEXT, from_address TEXT
to_addresses TEXT (JSON), subject TEXT, date_iso TEXT
has_attachment INTEGER, is_read INTEGER, is_flagged INTEGER
sequence_number INTEGER, is_local INTEGER DEFAULT 0
```

**mail_bodies:**
```sql
uid INTEGER, account_id TEXT  -- PK: (uid, account_id)
html TEXT, plain_text TEXT
```

**mail_fts (FTS5):**
```sql
uid UNINDEXED, account_id UNINDEXED
subject, from_address, plain_text
tokenize='unicode61'
```

**Indexes:**
- `idx_headers_account_folder_date` — Voor gesorteerde inbox weergave
- `idx_headers_account_folder_uid` — Voor UID-based sync queries

### Bestanden Aangemaakt
| Bestand | Regels | Doel |
|---------|--------|------|
| `src/types/mail.ts` | ~340 | TypeScript interfaces + email address parser |
| `src/services/mail/imapBridge.ts` | ~240 | NativeModules IMAP wrapper |
| `src/services/mail/smtpBridge.ts` | ~140 | NativeModules SMTP wrapper |
| `src/services/mail/imapService.ts` | ~310 | Sync strategie (initial + incremental) |
| `src/services/mail/imapSearch.ts` | ~160 | Gecombineerd FTS5 + IMAP zoeken |
| `src/services/mail/mailCache.ts` | ~410 | SQLite CRUD + FTS5 indexering |
| `src/services/mail/index.ts` | ~17 | Public API re-exports |
| `src/models/mailDatabase.ts` | ~190 | Database setup + schema |

### Sync Strategie
1. **initialSync(limit=200):** Verbind → fetchHeaders → cache → bewaar UID grenzen
2. **incrementalSync:** Haal alleen berichten met UID > hoogste cached UID
3. **getMessages(limit, offset):** Lees uit lokale cache (offline-first)
4. **Flag sync:** Optimistisch updaten cache → dan server sync

### Zoek Strategie
1. **Lokaal (FTS5):** Instant, offline — zoekt in subject, from, body
2. **Remote (IMAP SEARCH):** Parallel met lokaal — covers niet-gecachete berichten
3. **Combineer:** Dedupliceer op UID, server-only results markeren voor on-demand body fetch

### Dependency Check (voor volgende sessie)
- [ ] `npm install @op-engineering/op-sqlite` — Moet worden geïnstalleerd voor Test 1
- [ ] `cd ios && pod install` — Na op-sqlite installatie
- [ ] TypeScript typecheck — Moet worden gevalideerd na op-sqlite installatie

### Volgende Sessie: Fase 6-7 (OAuth2 + Providers)
**Voorbereid:**
- Alle TS bridge bestanden zijn klaar
- SQLite schema is gedefinieerd
- Sync + zoek strategie zijn geïmplementeerd
- Types matchen exact met native module return waarden

**Te doen in Fase 6-7:**
- OAuth2 authenticatie service (Gmail, Outlook, Yahoo)
- Provider configuratie database (bekende IMAP/SMTP instellingen)
- Auto-detectie op basis van e-mailadres domein

---

## Fase 6-7: OAuth2 + Providers — Sessie 3

### Status: ✅ Voltooid

### Beslissingen
- **react-native-app-auth** voor OAuth2 browser flow (nog niet geïnstalleerd — dependency voor Test 1)
- **react-native-keychain** reeds aanwezig (v8.2.0), hergebruikt voor mail credential opslag
- **Keychain security level:** `WHEN_UNLOCKED_THIS_DEVICE_ONLY` — credentials NIET in iCloud backup (zero-server-storage)
- **Account metadata** in AsyncStorage (niet-sensitief), credentials in Keychain (sensitief)
- **Client IDs via config bestand** (`src/config/mailOAuth2Config.ts`) — NOOIT hardcoded
- **Token refresh interceptor** in imapBridge.ts — automatisch bij elke IMAP-connectie
- **12 bekende providers** + custom optie voor handmatige configuratie
- **Domain auto-detectie** via pre-built lookup map (O(1) lookup)

### Architectuur

```
┌─────────────────────────────────────────────────────────────┐
│  Account Setup Flow                                          │
│                                                              │
│  1. Gebruiker kiest provider (mailConstants.ts)              │
│     └─ Of: email invoeren → detectProvider() → auto-detect   │
│  2a. OAuth2 provider → oauth2Service.authorize()             │
│      └─ Browser flow → tokens → Keychain                    │
│  2b. Password provider → wachtwoord invoer                   │
│      └─ Credentials → Keychain                              │
│  3. testConnection() → bevestiging                           │
│  4. Metadata → AsyncStorage, Credentials → Keychain          │
├─────────────────────────────────────────────────────────────┤
│  Runtime Flow                                                │
│                                                              │
│  imapBridge.connectIMAPWithRefresh(accountId, providerId)    │
│    └─ Laad credentials uit Keychain                         │
│    └─ OAuth2? → Check expiresAt → refresh indien nodig      │
│    └─ connectIMAP(config) → native module                   │
└─────────────────────────────────────────────────────────────┘
```

### Bekende Providers (mailConstants.ts)

| ID | Naam | Auth Type | IMAP Host | SMTP Host |
|----|------|-----------|-----------|-----------|
| gmail | Gmail | oauth2 | imap.gmail.com:993 | smtp.gmail.com:587 |
| outlook | Microsoft Outlook / Hotmail | oauth2 | outlook.office365.com:993 | smtp.office365.com:587 |
| kpn | KPN Mail | password | imap.kpnmail.nl:993 | smtp.kpnmail.nl:587 |
| ziggo | Ziggo Mail | password | imap.ziggo.nl:993 | smtp.ziggo.nl:587 |
| xs4all | XS4ALL / KPN Zakelijk | password | imap.xs4all.nl:993 | smtp.xs4all.nl:465 |
| yahoo | Yahoo Mail | password | imap.mail.yahoo.com:993 | smtp.mail.yahoo.com:587 |
| icloud | Apple iCloud Mail | password | imap.mail.me.com:993 | smtp.mail.me.com:587 |
| gmx | GMX Mail | password | imap.gmx.net:993 | mail.gmx.net:587 |
| webde | WEB.DE | password | imap.web.de:993 | smtp.web.de:587 |
| protonmail | ProtonMail (Bridge) | password | 127.0.0.1:1143 | 127.0.0.1:1025 |
| custom | Andere provider | password | (handmatig) | (handmatig) |

### Bestanden Aangemaakt
| Bestand | Regels | Doel |
|---------|--------|------|
| `src/services/mail/mailConstants.ts` | ~250 | Bekende providers + domain auto-detectie |
| `src/services/mail/credentialManager.ts` | ~280 | Keychain credential opslag + account metadata |
| `src/services/mail/oauth2Service.ts` | ~310 | OAuth2 flows (Gmail + Outlook) + token refresh |

### Bestanden Gewijzigd
| Bestand | Wijziging |
|---------|-----------|
| `src/types/mail.ts` | Toegevoegd: StoredCredentials, MailAccount, OAuth2TokenResponse, OAuth2ProviderConfig, MailAuthType |
| `src/services/mail/imapBridge.ts` | Toegevoegd: connectIMAPWithRefresh() token refresh interceptor |
| `src/services/mail/index.ts` | Toegevoegd: exports voor credentialManager, oauth2Service, mailConstants |

### Security Overzicht

| Wat | Waar opgeslagen | Beveiliging |
|-----|-----------------|-------------|
| IMAP/SMTP wachtwoorden | Keychain | WHEN_UNLOCKED_THIS_DEVICE_ONLY |
| OAuth2 access tokens | Keychain | WHEN_UNLOCKED_THIS_DEVICE_ONLY |
| OAuth2 refresh tokens | Keychain | WHEN_UNLOCKED_THIS_DEVICE_ONLY |
| OAuth2 client IDs | Config bestand | Niet in git (via .env of config) |
| Account metadata | AsyncStorage | Alleen niet-sensitieve data |
| Email adressen (PII) | AsyncStorage (metadata) | Nooit gelogd |

### Dependency Check (voor volgende sessie)
- [ ] `npm install react-native-app-auth` — Nodig voor OAuth2 browser flow
- [ ] `cd ios && pod install` — Na react-native-app-auth installatie
- [ ] `src/config/mailOAuth2Config.ts` aanmaken — Met Google + Microsoft client IDs
- [ ] Xcode URL scheme toevoegen: `com.commeazy` — Voor OAuth2 redirect
- [ ] (Bestaand) `npm install @op-engineering/op-sqlite` — Nodig voor SQLite cache

### Volgende Sessie: Fase 8 (Onboarding Wizard)
**Voorbereid:**
- Alle providers gedefinieerd met IMAP/SMTP configuratie
- Credential opslag in Keychain klaar
- OAuth2 flows voor Gmail en Outlook klaar
- Token refresh interceptor in imapBridge
- Types voor accounts en credentials

**Te doen in Fase 8:**
- `MailOnboardingStep1.tsx` — Provider kiezen
- `MailOnboardingStep2.tsx` — Authenticatie (OAuth2 / Password / Custom)
- `MailOnboardingStep3.tsx` — Test + Bevestiging
- Welcome modal voor eerste gebruik
- ProgressIndicator integratie
- i18n keys voor alle 13 talen

---

## Fase 8: Onboarding Wizard — Sessie 4

### Status: ✅ Voltooid
### Test Checkpoint: 🧪 Test 1 na deze fase

### Aangemaakt (5 bestanden)

| Bestand | Regels | Beschrijving |
|---------|--------|--------------|
| `src/screens/mail/MailOnboardingStep1.tsx` | ~185 | Provider kiezen — grote aanraakbare kaarten |
| `src/screens/mail/MailOnboardingStep2.tsx` | ~400 | Authenticatie — OAuth2 / Password / Custom |
| `src/screens/mail/MailOnboardingStep3.tsx` | ~310 | Test + Bevestiging — stapsgewijze voortgang |
| `src/screens/mail/MailWelcomeModal.tsx` | ~210 | Welcome modal — genummerde stappen |
| `src/screens/mail/MailOnboardingScreen.tsx` | ~310 | Wizard container — state management + flow |

### Architectuur

```
MailOnboardingScreen (wizard container)
├── Step 1: MailOnboardingStep1 — Provider selectie
│   └── getSelectableProviders() → grote kaarten met emoji + chevron
├── Step 2: MailOnboardingStep2 — Authenticatie
│   ├── OAuth2: "Inloggen met [provider]" → browser flow
│   ├── Password: Email + Wachtwoord velden
│   └── Custom: + Uitklapbare IMAP/SMTP server config
└── Step 3: MailOnboardingStep3 — Test + Bevestiging
    ├── Phase A: Stapsgewijze test (connect → auth → inbox → smtp)
    ├── Phase B Success: Groene bevestiging + actieknoppen
    └── Phase B Error: Foutmelding + "Instellingen aanpassen"

MailWelcomeModal (AsyncStorage: @commeazy/mail_welcome_shown)
├── 3 genummerde stappen (1️⃣ 2️⃣ 3️⃣)
├── Privacy notitie
└── "Begrepen" button
```

### Wizard Flow

```
[Stap 1: Provider]  ──select──▶  [Stap 2: Auth]  ──submit──▶  [Stap 3: Test]
                                       │                            │
                                  ◀──back──                   ◀──retry──
                                       │                            │
                                  OAuth2 flow                  Success:
                                  or Password                  ├── "Naar inbox"
                                                               └── "Nog een account"
```

### i18n Keys Toegevoegd

**32 onboarding keys** per locale:

| Categorie | Aantal | Voorbeelden |
|-----------|--------|-------------|
| `modules.mail.title` | 1 | Module naam |
| `modules.mail.welcome.*` | 8 | Modal stappen, privacy, "Begrepen" |
| `modules.mail.onboarding.*` | 20 | Provider selectie, OAuth, formulier, server config |
| `modules.mail.onboarding.testSteps.*` | 4 | connect, auth, inbox, smtp |
| `modules.mail.onboarding.testStatus.*` | 4 | pending, running, success, error |
| `modules.mail.providerNotes.*` | 3 | Yahoo, iCloud, ProtonMail waarschuwingen |

**Alle 13 locales bijgewerkt:** nl, en, en-GB, de, fr, es, it, no, sv, da, pt, pt-BR, pl

### UI Componenten Gebruikt

- `ProgressIndicator` — stappen voortgang (1/3, 2/3, 3/3)
- `Button` — primary + secondary variant
- `TextInput` — email, wachtwoord, server velden
- `Icon` — chevron-right, check, warning, mail, lock, settings, etc.
- `useColors()` + `useAccentColor()` — dynamische theming
- `ReactNativeHapticFeedback` — tactile bevestiging

### Bestaande Services Gebruikt

- `mailConstants.ts` → `getSelectableProviders()`, `getProvider()`, types
- `credentialManager.ts` → `saveCredentials()`, `saveAccount()`
- `oauth2Service.ts` → `authorize()`, `extractEmailFromIdToken()`
- `imapBridge.ts` → `connectIMAP()`, `fetchHeaders()`, `testConnection()`

### Veiligheid

- Wachtwoorden nooit gelogd (alleen via `secureTextEntry` + Keychain)
- OAuth2 tokens opgeslagen via credentialManager (Keychain)
- AsyncStorage alleen voor niet-gevoelige metadata (accountnaam, provider)
- Lazy imports voor oauth2Service/credentialManager (voorkomt circulaire deps)

### Dependencies Status

| Dependency | Status | Nodig voor |
|------------|--------|------------|
| react-native-app-auth | ❌ Niet geïnstalleerd | OAuth2 browser flow |
| @op-engineering/op-sqlite | ❌ Niet geïnstalleerd | SQLite FTS5 cache |
| react-native-keychain | ✅ Geïnstalleerd | Credential opslag |

### Volgende Sessie (Fase 9-10)

**Doel:** Settings menu + Mail inbox/detail/compose schermen

**Voorbereidende stappen (voor Test 1):**
1. `npm install react-native-app-auth && cd ios && pod install`
2. `npm install @op-engineering/op-sqlite && cd ios && pod install`
3. Maak `src/config/mailOAuth2Config.ts` met client IDs
4. Voeg URL scheme `com.commeazy` toe in Xcode (Info.plist)
5. Registreer MailOnboarding in `navigation/index.tsx`
6. Voeg mail module toe aan WheelNavigationMenu

---

## Fase 9: Settings Menu Integratie — Sessie 4b

### Status: ✅ Voltooid
### Commit: `5f04a36` — feat(mail): Register mail module in navigation + i18n (Pre-Test 1)

**Wat is gedaan:**
- Mail module geregistreerd in navigatie (WheelNavigationMenu, Tab.Screen)
- i18n keys voor navigatie in alle 13 locale bestanden

---

## Fase 10: Inbox, Detail & Compose Screens — Sessie 5

### Status: ✅ Voltooid
### Commit: `82cba24` — feat(mail): Fase 10 — Inbox, Detail & Compose screens + i18n 13 locales
### Test Checkpoint: 🧪 Test 2 na deze fase

**Wat is gedaan:**
- `MailScreen.tsx` — Herschreven met interne navigatie (MailView discriminated union: inbox | detail | compose)
- `MailInboxScreen.tsx` — Folder selectie, mail lijst, compose FAB, pull-to-refresh, cache-first loading
- `MailListItem.tsx` — Mail rij met unread dot, sender, subject, datum, attachment/flag indicators
- `MailDetailScreen.tsx` — Volledige bericht weergave met sender avatar, body, bijlagen, reply/forward/delete
- `MailComposeScreen.tsx` — Nieuw/reply/forward modes, To/CC/Subject/Body, SMTP send
- i18n: ~66 nieuwe keys per taal (inbox + detail + compose) in alle 13 locale bestanden

**Bestanden aangemaakt:**
- `src/screens/mail/MailInboxScreen.tsx`
- `src/screens/mail/MailListItem.tsx`
- `src/screens/mail/MailDetailScreen.tsx`
- `src/screens/mail/MailComposeScreen.tsx`

**Bestanden gewijzigd:**
- `src/screens/mail/MailScreen.tsx` (volledig herschreven)
- 13 locale bestanden (nl, en, en-GB, de, fr, es, it, no, sv, da, pt, pt-BR, pl)

---

## Fase 11-12: Tests + QA — Sessie 6

### Status: ⏳ Gepland

---

## Fase 13-14: Contacten + Bijlagen — Sessie 7

### Status: ⏳ Gepland

---

## Fase 15-17: Integraties + Opslaan — Sessie 8

### Status: ⏳ Gepland
### Test Checkpoint: 🧪 Test 3 na deze fase

> **⛔ BLOKKEERDER (PNA Beslissing #31):** Fase 17 (Bijlagen opslaan in CommEazy PhotoAlbum) is een **harde vereiste** voordat de mail module als voltooid mag worden beschouwd. Afbeeldingen ontvangen via e-mail MOETEN opgeslagen kunnen worden in de bestaande PhotoAlbum module (`src/screens/modules/PhotoAlbumScreen.tsx`).

---

## Architectuurnotities

### Native Module Patroon (CommEazy Conventie)
```
CommEazyTemp/CommEazyTemp/
  MailModule.swift     ← @objc(MailModule) class MailModule: RCTEventEmitter
  MailModule.m         ← RCT_EXTERN_MODULE(MailModule, RCTEventEmitter)
```

### SwiftMail SPM (naast CocoaPods)
- CocoaPods: React Native + andere deps (ongewijzigd)
- SPM: SwiftMail v1.0.3 (apart via Xcode)
- Beide package managers werken naast elkaar

### Foutcodes (consistent iOS ↔ Android)
`AUTH_FAILED`, `CONNECTION_FAILED`, `TIMEOUT`, `INVALID_CREDENTIALS`, `CERTIFICATE_ERROR`, `MAILBOX_NOT_FOUND`, `MESSAGE_NOT_FOUND`, `SEND_FAILED`
