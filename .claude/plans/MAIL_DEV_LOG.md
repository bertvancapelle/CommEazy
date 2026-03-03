# CommEazy Mail Module — Ontwikkelverslag

> **Doel:** Handoff-document tussen sessies. Elke fase wordt hier bijgehouden met status, beslissingen, en openstaande punten.
> **Referentie:** `MAIL_MODULE_PROMPT.md` v3.0

---

## Sessie Overzicht

| Sessie | Datum | Fasen | Status |
|--------|-------|-------|--------|
| 1 | 2026-03-03 | Fase 3 (iOS native module) | ✅ Voltooid |
| 2 | TBD | Fase 5 (TS bridge + SQLite) | ⏳ Gepland |
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

### Status: ⏳ Gepland

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
