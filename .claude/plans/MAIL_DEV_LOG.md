# CommEazy Mail Module — Ontwikkelverslag

> **Doel:** Handoff-document tussen sessies. Elke fase wordt hier bijgehouden met status, beslissingen, en openstaande punten.
> **Referentie:** `MAIL_MODULE_PROMPT.md` v3.0

---

## Sessie Overzicht

| Sessie | Datum | Fasen | Status |
|--------|-------|-------|--------|
| 1 | 2026-03-03 | Fase 3 (iOS native module) | ✅ Voltooid |
| 2 | 2026-03-03 | Fase 5 (TS bridge + SQLite) | ✅ Voltooid |
| 3 | TBD | Fase 6-7 (OAuth2 + Providers) | ⏳ Gepland |
| 4 | TBD | Fase 8 (Onboarding wizard) | ⏳ Gepland |
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

### Status: ⏳ Gepland

---

## Fase 8: Onboarding Wizard — Sessie 4

### Status: ⏳ Gepland
### Test Checkpoint: 🧪 Test 1 na deze fase

---

## Fase 9-10: Settings + Mail UI — Sessie 5

### Status: ⏳ Gepland
### Test Checkpoint: 🧪 Test 2 na deze fase

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
