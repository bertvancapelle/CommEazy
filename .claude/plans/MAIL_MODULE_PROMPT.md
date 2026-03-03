# CommEazy Mail Module — Implementatie Prompt

> **Versie:** 2.0 (met 23 bevindingen uit review verwerkt)
> **Datum:** 2026-03-03
> **Status:** Klaar voor implementatie na goedkeuring

---

## VERPLICHTE VOORKENNIS

Deze prompt beschrijft de implementatie van een **e-mail module binnen de bestaande CommEazy app**. De mail module is GEEN losstaand project maar integreert volledig in de bestaande architectuur, componenten, patronen en principes van CommEazy.

### CommEazy Kernprincipes (ALTIJD van toepassing)

| Principe | Vereiste |
|----------|----------|
| **Naamgeving** | "CommEazy" (hoofdletter C, hoofdletter E) — overal consistent |
| **Zero server storage** | CommEazy slaat niets op de server op. Mail cache is lokaal, encrypted |
| **Senior-inclusive UX** | Body >= 18pt, touch targets >= 60pt, WCAG AAA (7:1), haptic feedback |
| **13-taal support** | Alle UI strings via `t()`, ALLE 13 locales MOETEN tegelijk worden bijgewerkt |
| **Store compliance** | Apple Privacy Manifest + Google Data Safety Section |
| **Encryption export** | US BIS Self-Classification compliance |
| **Liquid Glass** | iOS/iPadOS 26+ MOET Liquid Glass gebruiken; fallback op iOS <26 en Android |

### Ondersteunde Talen (BLOKKEERDER)

Alle nieuwe i18n keys MOETEN in ALLE 13 locale bestanden worden toegevoegd:
`nl.json`, `en.json`, `en-GB.json`, `de.json`, `fr.json`, `es.json`, `it.json`, `no.json`, `sv.json`, `da.json`, `pt.json`, `pt-BR.json`, `pl.json`

Referentiebestand voor structuur: `nl.json`

### Bestaande Standaard Componenten (VERPLICHT)

De volgende componenten MOETEN worden hergebruikt — NOOIT eigen varianten maken:

| Component | Doel | Import |
|-----------|------|--------|
| `ModuleHeader` | Header voor alle module screens | `@/components` |
| `SearchBar` | Zoekfunctionaliteit | `@/components` |
| `LoadingView` | Laadstatus (spinner + tekst) | `@/components` |
| `ErrorView` | Foutweergave (menselijk + herstelactie) | `@/components` |
| `StatusIndicator` | Status (kleur + icoon + tekst) | `@/components` |
| `Button` | Knop met haptic feedback | `@/components` |
| `IconButton` | Icoon-knop | `@/components` |
| `Icon` | Iconen (MOET bestaan in IconName type) | `@/components` |
| `TextInput` | Tekstveld | `@/components` |
| `PanelAwareModal` | Modal voor iPad Split View | `@/components` |
| `ContactSelectionModal` | Contact selectie | `@/components` |
| `AdMobBanner` | Advertenties | `@/components` |
| `VoiceFocusable` | Voice navigatie wrapper | `@/components` |
| `VoiceTextInput` | Voice dictation input | `@/components` |
| `HoldToNavigateWrapper` | Long-press navigatie | `@/components` |
| `SeniorDatePicker` | Datum selectie | `@/components` |
| `ProgressIndicator` | Voortgangsbalk | `@/components` |

### Bestaande Hooks en Contexts (VERPLICHT)

| Hook/Context | Doel |
|-------------|------|
| `useModuleColor('mail')` | Module kleur (user-customizable, NOOIT hardcoded) |
| `useColors()` | Theme kleuren (light/dark) |
| `useHoldGestureGuard()` | Voorkom double-action bij long-press |
| `useVoiceCommands()` | Spraakbesturing |
| `useVoiceFocusList()` | Voice navigatie in lijsten |
| `useFeedback()` | Haptic feedback |
| `useReducedMotion()` | Respecteer systeem reduced motion |
| `useDeviceType()` | iPhone/iPad detectie |

### Theme Systeem (NOOIT hardcoded kleuren)

```typescript
// GOED:
import { useColors } from '@/theme';
const themeColors = useColors();
<Text style={{ color: themeColors.textPrimary }}>...</Text>

// FOUT:
<Text style={{ color: '#1A1A1A' }}>...</Text>
```

Gebruik: `colors.textPrimary`, `colors.surface`, `colors.border`, `typography.body`, `typography.h3`, `spacing.md`, `spacing.lg`, `borderRadius.md`, `touchTargets.minimum` (60pt), `touchTargets.comfortable` (72pt).

### Form Field Styling (VERPLICHT)

- Labels **BOVEN** het veld, **BUITEN** de border
- Labels altijd **bold** (`fontWeight: '700'`)
- Geen uppercase labels
- Bordered interactive elements: `borderWidth: 1`, `borderColor: colors.border`, `borderRadius: borderRadius.md`
- `minHeight: touchTargets.comfortable` (72pt)

### Button Standaardisatie (VERPLICHT)

Alle knoppen: 60pt minimum, `borderRadius: 12pt`, `backgroundColor: rgba(255, 255, 255, 0.15)`, haptic feedback bij tap.

---

## FOLDERSTRUCTUUR

De mail module volgt de **bestaande CommEazy conventies** — NIET een aparte `src/modules/mail/` structuur.

```
src/
  screens/
    mail/
      MailInboxScreen.tsx          // Inbox + folder navigatie
      MailDetailScreen.tsx         // Mail detail weergave
      MailComposeScreen.tsx        // Bericht opstellen
      MailOnboardingStep1.tsx      // Provider kiezen
      MailOnboardingStep2.tsx      // Authenticatie
      MailOnboardingStep3.tsx      // Handmatige config
      MailOnboardingStep4.tsx      // Verbinding testen
      MailOnboardingStep5.tsx      // Bevestiging
  components/
    mail/
      RecipientInput.tsx           // Chip-gebaseerde ontvanger invoer
      ContactPickerModal.tsx       // Multi-select contacten (hergebruik ContactSelectionModal pattern)
      AlbumPickerModal.tsx         // Foto/video selectie
      AttachmentPreviewBar.tsx     // Bijlagen preview in compose
      DownloadProgressIndicator.tsx // Voortgang bij downloaden
      BulkSaveSheet.tsx            // Bulk opslaan in fotoalbum
      MailListItem.tsx             // Mail lijst item
  services/
    mail/
      mailService.ts               // Centrale mail coordinator
      imapBridge.ts                // React Native bridge naar native
      imapService.ts               // Sync strategie
      imapSearch.ts                // Lokaal + remote zoeken
      smtpBridge.ts                // SMTP bridge
      smtpService.ts               // Verzend service
      mailCache.ts                 // Lokale cache (encrypted)
      contactMailService.ts        // Wrapper contacten module
      mediaAttachmentService.ts    // Compressie en validatie
      saveToAlbumService.ts        // Wrapper fotoalbum module
      oauthGmail.ts                // Gmail OAuth2
      oauthOutlook.ts              // Microsoft OAuth2
      credentialManager.ts         // Keychain/Keystore opslag
      mailConstants.ts             // Bekende providers
  contexts/
    MailContext.tsx                 // Mail state provider
  hooks/
    useMail.ts                     // Mail hook(s)
  types/
    mail.ts                        // TypeScript interfaces
  models/
    MailAccount.ts                 // WatermelonDB model (optioneel)
    MailHeader.ts                  // WatermelonDB model (optioneel)

ios/                               // Native modules direct in ios/ root
  MailModule.swift                 // IMAP + SMTP via MailCore2
  MailModule.m                     // Bridge header

android/app/src/main/java/com/commeazy/mail/
  IMAPModule.kt
  SMTPModule.kt
  MailPackage.kt
```

### Xcode Project Locatie

Native Swift/ObjC bestanden worden toegevoegd aan het Xcode project onder `CommEazyTemp/CommEazyTemp/` — consistent met bestaande modules zoals `AppleMusicModule.swift`, `VoIPPushModule.swift`.

---

## MODULE REGISTRATIE (VERPLICHT voordat testen begint)

Voordat de mail module zichtbaar is in de app, MOETEN de volgende registraties worden uitgevoerd:

| # | Bestand | Actie |
|---|---------|-------|
| 1 | `src/components/WheelNavigationMenu.tsx` | `'mail'` toevoegen aan `NavigationDestination` type |
| 2 | `src/hooks/useModuleUsage.ts` | `'mail'` toevoegen aan `ALL_MODULES` array |
| 3 | `src/hooks/useModuleUsage.ts` | `'mail'` toevoegen aan `DEFAULT_MODULE_ORDER` array |
| 4 | `src/components/WheelNavigationMenu.tsx` | Entry in `STATIC_MODULE_DEFINITIONS` (icon + color) |
| 5 | `src/components/WheelNavigationMenu.tsx` | Entry in `MODULE_TINT_COLORS` |
| 6 | `src/types/liquidGlass.ts` | `'mail'` toevoegen aan `ModuleColorId` union type |
| 7 | `src/contexts/ModuleColorsContext.tsx` | `'mail'` toevoegen aan `CUSTOMIZABLE_MODULES` |
| 8 | `src/contexts/ModuleColorsContext.tsx` | `mail: 'modules.mail.title'` in `MODULE_LABELS` |
| 9 | `src/screens/settings/AppearanceSettingsScreen.tsx` | Preview card voor mail module kleur |
| 10 | `src/navigation/index.tsx` | Mail screens registreren in navigator |
| 11 | Alle 13 locale bestanden | `navigation.mail` key + alle module-specifieke i18n keys |

### Voorgestelde Module Kleur

| Module | Kleur | Hex |
|--------|-------|-----|
| Mail | Blauw | `#1565C0` (Material Blue 800) |

---

## FASE 1 & 2: Context, Analyse en Architectuur

### Eerste stap: volledig project inlezen voor er code wordt geschreven

**Context en uitgangspunten:**
Je werkt aan de CommEazy app — een React Native applicatie voor iOS/iPadOS en Android. Je hebt volledige toegang tot de bestaande projectstructuur.

Voordat je begint, doe het volgende:

1. Lees de volledige projectstructuur uit via het bestandssysteem.
2. Identificeer alle bestaande UI-componenten (zie `src/components/index.ts` voor de volledige export lijst).
3. Identificeer de bestaande navigatiestructuur in `src/navigation/index.tsx`.
4. Identificeer de bestaande state management aanpak (React Context in `src/contexts/`).
5. Identificeer de bestaande code conventies (TypeScript strict mode, naamgeving, file structuur, import stijl via `@/` alias).
6. Identificeer het bestaande instellingenmenu — `src/screens/settings/` structuur en hoe nieuwe secties worden toegevoegd.
7. Identificeer de CommEazy contacten-module volledig:
   - Locatie: `src/screens/contacts/`, `src/services/`, `src/models/Contact.ts`
   - **Contact model:** `firstName` + `lastName` (NIET een enkel `name` veld)
   - Service/repository laag, Contact interface definitie
   - Bestaande `ContactSelectionModal` component
8. Identificeer de CommEazy fotoalbum-module volledig:
   - Locatie: `src/screens/modules/PhotoAlbumScreen.tsx`, `src/screens/modules/CameraScreen.tsx`
   - Media/Photo interface definitie
   - Hoe media wordt opgeslagen
   - Bestaande `PhotoRecipientModal` component
   - Bestaand deelmenu
9. Identificeer bestaande bestandsoperatie library en download/voortgangspatronen.
10. Identificeer het theme systeem: `src/theme/colors.ts`, `src/theme/darkColors.ts`, `src/theme/index.ts`.
11. Identificeer het voice command framework: `src/types/voiceCommands.ts`, `src/hooks/useVoiceCommands.ts`, `src/contexts/VoiceFocusContext.tsx`.
12. Identificeer de mock mode setup: `src/services/mock/` — nodig voor development.
13. Identificeer de iPad Split View architectuur: `SplitViewLayout`, `PaneContext`, `PanelAwareModal`.

**REGEL:** Gebruik uitsluitend bestaande componenten, kleuren, spacing en patronen. Introduceer geen nieuwe design-systeem elementen tenzij er absoluut geen bestaande equivalent is. Vraag in dat geval eerst om bevestiging.

Rapporteer alle bevindingen in een gestructureerd overzicht.
Wacht op bevestiging voordat je verdergaat met de architectuur.

### Architectuur

Na bevestiging van de analyse: ontwerp de folder- en bestandsstructuur conform de bovenstaande "FOLDERSTRUCTUUR" sectie. Presenteer de architectuur en wacht op goedkeuring.

---

## FASE 3: Native iOS Implementatie (MailCore2)

Swift module voor IMAP en SMTP via MailCore2.

### 3.1 Podfile Dependency

Voeg toe aan `ios/Podfile`: `pod 'MailCore2-iOS'`
Voer `pod install` uit na toevoeging.
Minimale iOS deployment target: iOS 13.

### 3.2 MailModule.swift

**Locatie:** `ios/MailModule.swift` (direct in `ios/` root, consistent met `AppleMusicModule.swift`, `VoIPPushModule.swift`)

Implementeer de volgende `@objc` exposed methods:

- `connect(host, port, security, username, password, resolve, reject)`
  - MCOIMAPSession aanmaken en opslaan als class property
  - security: `'SSL' | 'TLS' | 'STARTTLS' | 'NONE'`

- `fetchHeaders(folderName, limit, resolve, reject)`
  - MCOIMAPFetchMessagesOperation met UIDNEXT
  - Retourneer: `[{uid, from, to, subject, date, hasAttachment, isRead, isFlagged}]`

- `fetchMessageBody(uid, folderName, resolve, reject)`
  - MCOIMAPFetchContentOperation + MCOMessageParser
  - Retourneer: `{html, plainText, attachments:[{name,size,mimeType}]}`

- `fetchAttachmentData(uid, folderName, attachmentIndex, resolve, reject)`
  - MCOIMAPFetchContentByUIDOperation met partID
  - Voortgang via RCTEventEmitter event: `'MailAttachmentProgress'`
  - Bestanden <= 10MB: retourneer base64
  - Bestanden > 10MB: schrijf naar tijdelijk bestand, retourneer filePath

- `searchMessages(folderName, query, resolve, reject)`
  - MCOIMAPSearchOperation met MCOIMAPSearchExpression
  - Zoek in subject, from, body (combineer met OR)
  - Retourneer array van UIDs

- `sendMessage(smtpConfig, from, to, cc, bcc, subject, body, attachments, resolve, reject)`
  - MCOSMTPSession + MCOMessageBuilder
  - Ondersteuning HTML body en bijlagen als base64 of filePath

- `markAsRead(uid, folderName, resolve, reject)`
- `deleteMessage(uid, folderName, resolve, reject)`
- `disconnect(resolve, reject)`

### 3.3 Bridge Header (MailModule.m)

Exporteer alle Swift methods via `RCT_EXTERN_MODULE` en `RCT_EXTERN_METHOD` macros.

### 3.4 Privacy Manifest Update (VERPLICHT)

Als de mail module `UserDefaults`, `FileTimestamp`, of netwerk APIs gebruikt die onder Required Reason APIs vallen, MOET `PrivacyInfo.xcprivacy` worden bijgewerkt met de juiste reason codes.

### 3.5 Foutcodes (consistent met Android)

`AUTH_FAILED`, `CONNECTION_FAILED`, `TIMEOUT`, `INVALID_CREDENTIALS`, `CERTIFICATE_ERROR`

Nooit technische stacktraces doorgeven aan de JavaScript laag.

### 3.6 Logging (VERPLICHT)

```swift
// GOED:
NSLog("[MailModule] Connection established to host")
NSLog("[MailModule] ERROR: Connection failed with code: \(error.code)")

// FOUT — NOOIT loggen:
NSLog("[MailModule] User: \(email)")           // PII
NSLog("[MailModule] Password: \(password)")     // Security
NSLog("[MailModule] Subject: \(subject)")       // Privacy
```

---

## FASE 4: Native Android Implementatie (Jakarta Mail)

Kotlin module voor IMAP en SMTP via Jakarta Mail.

### 4.1 Gradle Dependencies

```gradle
// android/app/build.gradle
implementation 'com.sun.mail:android-mail:1.6.7'
implementation 'com.sun.mail:android-activation:1.6.7'
```

### 4.2 AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### 4.3 IMAPModule.kt

Als `ReactContextBaseJavaModule`. Alle zware operaties op `Dispatchers.IO` (coroutines).

Implementeer exact dezelfde publieke API als iOS (Fase 3):
`connect` / `fetchHeaders` / `fetchMessageBody` / `fetchAttachmentData` / `searchMessages` / `sendMessage` / `markAsRead` / `deleteMessage` / `disconnect`

**fetchAttachmentData — geheugenbeheersing:**
- Bestanden > 10MB: schrijf via `BufferedOutputStream` naar cache dir (`context.getCacheDir()`) — nooit als byte array in geheugen laden
- Voortgang via ReactContext DeviceEventManagerModule event: `'MailAttachmentProgress'`

### 4.4 MailPackage.kt

Registreer IMAPModule als ReactPackage. Voeg toe aan `MainApplication.kt` `getPackages()` lijst.

### 4.5 Google Play Data Safety Section (VERPLICHT)

De mail module verwerkt e-mailadressen, contactgegevens en mail inhoud. Dit MOET worden gedeclareerd in de Google Play Data Safety Section:
- E-mailadressen: verzameld voor app functionaliteit
- Contactgegevens: gebruikt voor auto-complete
- Mail inhoud: alleen lokaal gecached, niet gedeeld met derden

### 4.6 Foutcodes — identiek aan iOS implementatie.

---

## FASE 5: TypeScript / JavaScript Bridge

Bridge, services, cache en gecombineerd zoeken.

### 5.1 types/mail.ts

Definieer de volgende interfaces:

```typescript
interface IMAPConfig {
  host: string; port: number;
  security: 'SSL' | 'TLS' | 'STARTTLS' | 'NONE';
  username: string; password?: string; accessToken?: string;
}

interface SMTPConfig {
  host: string; port: number;
  security: 'SSL' | 'TLS' | 'STARTTLS' | 'NONE';
  username: string; password?: string; accessToken?: string;
}

interface MailHeader {
  uid: number; from: EmailAddress[];
  to: EmailAddress[]; subject: string; date: string;
  hasAttachment: boolean; isRead: boolean; isFlagged: boolean;
}

interface MailBody {
  html?: string; plainText?: string;
  attachments: MailAttachmentMeta[];
}

interface MailAttachmentMeta {
  index: number; name: string;
  size: number; mimeType: string;
}

interface EmailAddress { name?: string; address: string; }

interface MailRecipient {
  id?: string; name?: string; email: string;
  avatarUri?: string; isFromContacts: boolean;
}

interface MailAttachment {
  id: string; sourceId?: string;
  localUri: string; thumbnailUri?: string; fileName: string;
  mimeType: string; fileSize: number; compressedSize?: number;
  isVideo: boolean; duration?: number;
  compressionStatus: 'none' | 'pending' | 'done' | 'failed';
}

interface AttachmentData {
  base64?: string; filePath?: string;
  mimeType: string; fileName: string; fileSize: number;
}
```

**Type MOET geexporteerd worden** in `src/types/mail.ts` EN herexporteerd via relevante index bestanden.

### 5.2 imapBridge.ts

Wrap `NativeModules.MailModule`. Promise-gebaseerde functies met volledige TypeScript typing. NativeEventEmitter subscriptions voor `'MailAttachmentProgress'`.

### 5.3 imapService.ts — Sync strategie

- `initialSync(config, limit=200)`: Verbind, haal laatste headers op, sla op in cache. Bewaar laagste UID als sync_boundary.
- `incrementalSync(config)`: Haal alleen berichten op met UID > hoogste bekende UID.
- `getMessages(limit, offset)`: Lees uit lokale cache.

### 5.4 imapSearch.ts — Gecombineerd zoeken

`search(query): Promise<SearchResult[]>`
1. FTS5 query op lokale cache
2. Parallel IMAP SEARCH naar server
3. Combineer, dedupliceer op UID
4. Server-only berichten: markeer als `'server_only'`, body on-demand

### 5.5 mailCache.ts — Database Beslissing

**ARCHITECTURALE KEUZE (moet worden bevestigd):**

CommEazy gebruikt WatermelonDB (met SQLCipher encryptie) voor alle lokale data. De mail cache kan op twee manieren worden geimplementeerd:

**Optie A: WatermelonDB (aanbevolen voor consistentie)**
- Nieuwe modellen: `MailAccount`, `MailHeader`, `MailBody`
- Schema migratie in `src/models/migrations.ts`
- Automatische encryptie via bestaande SQLCipher
- Model exports in `src/models/index.ts`

**Optie B: Aparte SQLite database**
- Via `react-native-quick-sqlite` of `op-sqlite`
- MOET encrypted zijn (SQLCipher) — encryptie at-rest is verplicht
- FTS5 virtual table voor full-text search

Tabel `mail_headers`:
```sql
uid INTEGER PRIMARY KEY, account_id TEXT, folder TEXT,
from_address TEXT, from_name TEXT, to_addresses TEXT,
subject TEXT, date_iso TEXT, has_attachment INTEGER,
is_read INTEGER, is_flagged INTEGER, is_local INTEGER DEFAULT 1
```

Tabel `mail_bodies`:
```sql
uid INTEGER PRIMARY KEY, account_id TEXT, html TEXT, plain_text TEXT
```

FTS5:
```sql
CREATE VIRTUAL TABLE mail_fts USING fts5(
  subject, from_address, plain_text, content='mail_headers')
```

---

## FASE 6: OAuth2 Authenticatie

Gmail en Outlook OAuth2 flows met automatische token refresh.

Gebruik `react-native-app-auth` voor de OAuth2 browser flow.

### 6.1 oauthGmail.ts

```typescript
const GMAIL_CONFIG = {
  issuer: 'https://accounts.google.com',
  clientId: process.env.GOOGLE_CLIENT_ID,  // uit .env
  redirectUrl: 'com.commeazy:/oauth2redirect',
  scopes: ['https://mail.google.com/', 'openid', 'email', 'profile'],
};
```

OAuth scopes MOETEN worden gedeclareerd in App Store review notes.

### 6.2 oauthOutlook.ts

```typescript
const OUTLOOK_CONFIG = {
  issuer: 'https://login.microsoftonline.com/common/v2.0',
  clientId: process.env.MICROSOFT_CLIENT_ID,  // uit .env
  redirectUrl: 'com.commeazy://auth',
  scopes: [
    'https://outlook.office.com/IMAP.AccessAsUser.All',
    'https://outlook.office.com/SMTP.Send',
    'offline_access', 'openid', 'email',
  ],
};
```

### 6.3 credentialManager.ts — Secure Opslag (KRITIEK)

Gebruik `react-native-keychain` voor credential opslag.

**SECURITY VEREISTEN:**
- IMAP/SMTP wachtwoorden MOETEN in iOS Keychain / Android Keystore
- **NOOIT** in AsyncStorage, SQLite, of logs
- iOS: `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` — credentials NIET in iCloud backup (zero-server-storage principe)
- OAuth refresh tokens OOK in Keychain, niet in SQLite cache
- PII (e-mailadressen, wachtwoorden) NOOIT loggen

```typescript
interface StoredCredentials {
  type: 'oauth2' | 'password';
  email: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  password?: string;
  imapConfig: IMAPConfig;
  smtpConfig: SMTPConfig;
}

// API:
saveCredentials(accountId: string, credentials: StoredCredentials): Promise<void>
getCredentials(accountId: string): Promise<StoredCredentials | null>
deleteCredentials(accountId: string): Promise<void>
```

### 6.4 Token Refresh Interceptor

In `imapBridge.ts`: Controleer bij elke IMAP-aanroep `expiresAt > Date.now() + 60000`. Zo niet: roep automatisch `refreshToken` aan voordat de operatie doorgaat.

---

## FASE 7: Bekende Mail Providers

Definieer `KNOWN_PROVIDERS` in `src/services/mail/mailConstants.ts`:

```typescript
export const KNOWN_PROVIDERS = [
  { id: 'gmail', name: 'Gmail', authType: 'oauth2',
    imap: { host: 'imap.gmail.com', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.gmail.com', port: 587, security: 'STARTTLS' } },
  { id: 'outlook', name: 'Microsoft Outlook / Hotmail', authType: 'oauth2',
    imap: { host: 'outlook.office365.com', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.office365.com', port: 587, security: 'STARTTLS' } },
  { id: 'yahoo', name: 'Yahoo Mail', authType: 'password',
    imap: { host: 'imap.mail.yahoo.com', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.mail.yahoo.com', port: 587, security: 'STARTTLS' } },
  { id: 'icloud', name: 'Apple iCloud Mail', authType: 'password',
    imap: { host: 'imap.mail.me.com', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.mail.me.com', port: 587, security: 'STARTTLS' } },
  { id: 'kpn', name: 'KPN Mail', authType: 'password',
    imap: { host: 'imap.kpnmail.nl', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.kpnmail.nl', port: 587, security: 'STARTTLS' } },
  { id: 'ziggo', name: 'Ziggo Mail', authType: 'password',
    imap: { host: 'imap.ziggo.nl', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.ziggo.nl', port: 587, security: 'STARTTLS' } },
  { id: 'xs4all', name: 'XS4ALL / KPN Zakelijk', authType: 'password',
    imap: { host: 'imap.xs4all.nl', port: 993, security: 'SSL' },
    smtp: { host: 'smtp.xs4all.nl', port: 465, security: 'SSL' } },
  { id: 'custom', name: 'Andere provider (handmatig)', authType: 'password',
    imap: { host: '', port: 993, security: 'SSL' },
    smtp: { host: '', port: 587, security: 'STARTTLS' } },
] as const;
```

---

## FASE 8: Onboarding Wizard

Vijfstaps wizard voor het instellen van een e-mailaccount.

**VERPLICHT:** Gebruik uitsluitend bestaande CommEazy UI-componenten. Voortgangsindicator bovenaan alle stappen (`ProgressIndicator`).

**Flow Diepte:** De wizard MOET zo compact mogelijk zijn — max 3-4 stappen voor de gebruiker. Bij OAuth2 providers (Gmail/Outlook) slaat stap 3 over, waardoor de flow effectief 3 stappen is (Provider → OAuth → Klaar).

### Welcome Modal (VERPLICHT)

Bij eerste keer openen van de mail module: toon welcome modal met genummerde stappen en "Begrepen" knop. AsyncStorage key: `mail_welcome_shown`.

### Stap 1 — MailOnboardingStep1.tsx (Provider kiezen)

- Titel: `t('modules.mail.onboarding.chooseProvider')`
- `KNOWN_PROVIDERS` als grote aanraakbare kaarten (>= 60pt touch targets)
- Haptic feedback bij selectie

### Stap 2 — MailOnboardingStep2.tsx (Authenticatie)

- **OAuth2 (`authType === 'oauth2'`):** Tekst + grote knop "Inloggen met [provider]". Start OAuth2 flow. Na succes: direct naar stap 4.
- **Password:** E-mailadres invoerveld (`keyboardType: 'email-address'`) + wachtwoord (`secureTextEntry: true`). Knop "Verder".
- **Form field styling:** Labels BOVEN veld, bold, bordered.

### Stap 3 — MailOnboardingStep3.tsx (Handmatige config)

Alleen bij `'custom'` of handmatige override.
- IMAP sectie: host, poort, beveiliging
- SMTP sectie: host, poort, beveiliging
- Toggle "Gebruik zelfde inloggegevens voor SMTP" (default: aan)
- Knop "Verbinding testen"

### Stap 4 — MailOnboardingStep4.tsx (Verbinding testen)

Stapsgewijze voortgang met `LoadingView` en `StatusIndicator`:
1. Verbinding met server
2. Authenticatie
3. Inbox ophalen (eerste 10 berichten)
4. Verzendfunctie controleren

Bij succes: groene bevestiging + knop "Afronden"
Bij fout: `ErrorView` met menselijke melding + "Instellingen aanpassen" knop

### Stap 5 — MailOnboardingStep5.tsx (Bevestiging)

Bevestiging: "[naam]@[domein] is succesvol gekoppeld."
Opties: "Nog een account toevoegen" / "Naar mijn inbox"

### OnboardingNavigator

Stack navigator voor de stappen. Voeg entry point toe via `src/navigation/index.tsx`.

---

## FASE 9: Integratie in het Instellingenmenu

Nieuwe "E-mail" sectie in het bestaande CommEazy instellingenmenu.

**BELANGRIJK:** Volg exact het visuele patroon van `src/screens/settings/`. Gebruik bestaande sectie-header, list-item, toggle en divider componenten.

### Sectie "Mijn e-mailaccounts"

- Lijst van gekoppelde accounts per account
  - Toont: e-mailadres, provider naam, verbindingsstatus (`StatusIndicator`)
- Swipe-to-delete met bevestigingsdialog
- Tik op account: opent ServerConfigForm
- Knop "+ Account toevoegen" -> start OnboardingNavigator

### Sectie "Synchronisatie-instellingen"

- Aantal berichten lokaal bewaren: 50 / 100 / 200 / 500
- Automatisch synchroniseren: toggle
- Bijlagen automatisch downloaden: toggle
- Synchroniseer nu: handmatige sync met `LoadingView`

### Sectie "Opslag"

- Lokale mailcache grootte (bijv. "12,4 MB")
- Cache wissen: bevestigingsdialog met uitleg ("Uw e-mails op de server blijven bewaard.")

### Sectie "Beveiliging"

- Meldingen voor nieuwe e-mail: toggle
- Biometrische beveiliging voor mail: toggle (indien beschikbaar)

---

## FASE 10: Inbox, Detail en Compose Schermen

### 10.1 MailInboxScreen.tsx

**VERPLICHT componenten:**
- `ModuleHeader` met `moduleId="mail"`, `icon="mail"`, `title={t('modules.mail.title')}`
- `SearchBar` voor zoekfunctionaliteit (NOOIT eigen zoekbalk)
- `LoadingView` voor laadstatus
- `ErrorView` voor foutmeldingen
- `AdMobBanner` in header (`showAdMob={true}`)

**Layout:**
```
ModuleHeader (mail icon + titel + MediaIndicator)
AdMob Banner
SearchBar (zoeken op mail)
Mail lijst (ScrollView + .map() — geen FlatList ivm Hermes bug)
```

- Pull-to-refresh triggert `incrementalSync`
- Ongelezen berichten visueel onderscheiden via bestaande tekststijlen
- Lege staat: `ErrorView` variant met friendly bericht
- **Voice integratie:** `VoiceFocusable` wrapper per mail item
- **HoldToNavigate:** `onLongPress={() => {}}` + `useHoldGestureGuard()` op lijst items
- **Haptic feedback** bij tap op mail item

### 10.2 MailListItem.tsx

Per bericht: afzender (`firstName lastName`), onderwerp, datum (relatief), paperclip bij bijlagen, ongelezen indicator.

- Gebruik CommEazy `Icon` component (MOET bestaan in `IconName` type)
- Touch target >= 60pt
- `accessibilityRole="button"`, `accessibilityLabel` met afzender + onderwerp

### 10.3 MailDetailScreen.tsx

- Header: van, aan, onderwerp, datum
- Body: WebView voor HTML mail, ScrollView voor plaintext
- Actiebalk onderaan: Beantwoorden, Doorsturen, Verwijderen (alle >= 60pt, haptic feedback)
- Markeer automatisch als gelezen bij openen
- **Accessibility:** `accessibilityLabel` op alle knoppen

**Bijlagen sectie — per bijlage:**

Als `canSaveToAlbum(mimeType) === true` (foto of video):
- Thumbnail preview 80x80px
- Bestandsnaam en grootte
- Twee knoppen: [Bekijken] [Opslaan in album]

Als `canSaveToAlbum(mimeType) === false` (document, PDF etc.):
- Bestandsicoontje + naam + grootte
- Knop: [Openen / Delen]

Bij 2+ media-bijlagen: extra knop bovenaan: "Alle foto's en video's opslaan (N)" -> opent BulkSaveSheet

### 10.4 MailComposeScreen.tsx

**Route params:**
```typescript
interface ComposeParams {
  mode: 'new' | 'reply' | 'forward';
  prefilledRecipients?: MailRecipient[];
  prefilledAttachments?: MailAttachment[];
  originalMessageUid?: number;
  originalFolderName?: string;
}
```

**Schermstructuur:**

1. **Header balk:** Annuleren | Titel | Verzenden (disabled bij geen geldig Aan-adres of compressie bezig)
2. **Ontvanger velden:** RecipientInput "Aan" (verplicht), CC/BCC uitklapbaar
3. **Onderwerp veld:** CommEazy `TextInput`, labels BOVEN veld, bold
4. **Bijlage preview bar:** `AttachmentPreviewBar`
5. **Berichttekst:** Groot `VoiceTextInput` (voice dictation support), min 200px hoogte
6. **Actie balk:** Bijlage (-> `AlbumPickerModal`), Contacten (-> `ContactPickerModal`)

**Verzenden:**
1. Valideer RecipientInput velden
2. Wacht op lopende compressions
3. `LoadingView` in verzenden knop
4. `smtpService.sendMessage()` met bijlagen als MIME
5. Succes: navigeer terug, Toast "Bericht verzonden"
6. Fout: `ErrorView` / Toast "Verzenden mislukt."

**Auto-save:** Elke 30 seconden in mailCache.
Bij annuleren met inhoud: ActionSheet "Bewaren / Verwijderen / Annuleren"

### iPad Split View (VERPLICHT)

De mail module profiteert van iPad Split View:
- Links paneel: inbox/folder lijst
- Rechts paneel: geselecteerde mail detail
- Compose: `PanelAwareModal` zodat het binnen het paneel blijft

---

## FASE 11 & 12: Tests, Kwaliteitschecks en Eindrapportage

### 11.1 TypeScript — strict mode, geen `any` types

### 11.2 Foutafhandeling
- Alle async functies try/catch
- Nooit technische stacktraces tonen — gebruik `ErrorView` met menselijke tekst
- Netwerkverlies: retry max 3 pogingen
- OAuth2 token expiry: automatisch via interceptor

### 11.3 Toegankelijkheid (VERPLICHT)
- `accessibilityLabel` op ALLE interactieve elementen
- `accessibilityRole`: `button`, `header`, `link` (voor URLs in mail)
- `accessibilityState`: `{ selected: true }` voor geselecteerde mail
- Announcement patterns: "Nieuwe mail van [naam], onderwerp: [onderwerp]"
- Focus management: na verwijderen, focus naar volgende mail
- Minimale raakzone **60x60pt** (NIET 48x48 — CommEazy standaard is 60pt)

### 11.4 Performance
- ScrollView + `.map()` (NIET FlatList vanwege Hermes bug)
- Body lazy laden bij openen bericht
- IMAP-operaties altijd op background thread

### 11.5 Beveiliging
- Credentials uitsluitend in Keychain/Keystore
- **NOOIT** in AsyncStorage, logs of foutmeldingen
- TLS certificaat validatie altijd ingeschakeld
- OAuth2 state parameter tegen CSRF
- `.env` voor client IDs — nooit hardcoded
- OAuth refresh tokens in Keychain, niet in SQLite
- PII (e-mailadressen, onderwerpregels, body) NOOIT loggen

### 11.6 Unit Tests (Jest)

- CredentialManager: opslaan, ophalen, verwijderen
- MailCache: insert, select, FTS search
- IMAPService: sync strategie (mock bridge)
- OAuthGmail / OAuthOutlook: token refresh logica
- RecipientInput: chip toevoegen, validatie, duplicaat
- MediaAttachmentService: compressie, videovalidatie, groottelimiet
- SaveToAlbumService: canSaveToAlbum, duplicaatcheck
- BulkSaveSheet: sequentiele verwerking, annuleren

### 11.7 Mock Mode (VERPLICHT)

Maak mock implementaties van mail services voor development:
- Mock IMAP responses met test-mails
- Mock SMTP (log naar console)
- Integreer met bestaand mock mode systeem (`src/services/mock/`)

### 11.8 i18n Completeness Check

Valideer dat ALLE nieuwe i18n keys aanwezig zijn in ALLE 13 locale bestanden. Namespace: `modules.mail.*`

### 12.1 Consistentie Check

- Alle schermen gebruiken uitsluitend bestaande CommEazy componenten
- Kleurgebruik via `useColors()` — geen hardcoded kleuren
- Module kleur via `useModuleColor('mail')` — geen hardcoded hex
- Navigatiepatroon identiek aan bestaande schermen
- Instellingenmenu visueel ononderscheidbaar van bestaande secties
- Geen breaking changes in bestaande modules
- Liquid Glass compliance (iOS 26+)
- Dark mode support via theme systeem

### 12.2 Eindrapportage Basis

- Overzicht nieuwe en gewijzigde bestanden
- Nieuwe dependencies met versienummer en reden
- Openstaande punten (Google Cloud Console, Azure AD setup)
- Testinstructies iOS en Android simulator
- Privacy Manifest wijzigingen
- Data Safety Section declaraties

---

## FASE 13: Contacten-integratie in Mail Compose

### 13.1 RecipientInput Component

**Locatie:** `src/components/mail/RecipientInput.tsx`

Props: `label`, `recipients: MailRecipient[]`, `onRecipientsChange`, `placeholder?`, `maxRecipients?`

**Chip-gebaseerde invoer:**
- Chips horizontaal scrollbaar, touch target >= 60pt per chip
- `accessibilityLabel` per chip: `'{naam} verwijderen'`
- Haptic feedback bij toevoegen/verwijderen

**Auto-complete (bij 2+ tekens):**
- Dropdown max 5 suggesties uit CommEazy contacten database
- Zoek op `firstName`, `lastName`, e-mailadres (case-insensitive)
- **Contact model:** `firstName` + `lastName` (NIET een enkel `name` veld)

**Handmatige invoer:**
- Enter of spatiebalk na geldig adres: toevoegen als chip
- Validatie: `/^[^@]+@[^@]+\.[^@]+$/`
- Ongeldig: inline fout via bestaande styling (geen pop-up)

**Voice integratie:** Wrap input met `VoiceTextInput` voor dictation support

### 13.2 ContactPickerModal

**Locatie:** `src/components/mail/ContactPickerModal.tsx`

Hergebruik het patroon van de bestaande `ContactSelectionModal` component. Gebruik `PanelAwareModal` als wrapper voor iPad Split View compatibiliteit.

- Zoekbalk: `SearchBar` component
- Contactenlijst met `VoiceFocusable` wrappers
- `HoldToNavigateWrapper` integratie

### 13.3 contactMailService.ts

**Locatie:** `src/services/mail/contactMailService.ts`

Dunne wrapper — dupliceer contacten-logica NIET. Gebruik uitsluitend bestaande service/repository laag.

```typescript
contactToMailRecipient(contact: Contact): MailRecipient {
  return {
    id: contact.userUuid,
    name: `${contact.firstName} ${contact.lastName}`.trim(),
    email: contact.email,
    isFromContacts: true,
  };
}
```

---

## FASE 14: Foto en Video Bijlagen

### 14.1 mediaAttachmentService.ts

**Locatie:** `src/services/mail/mediaAttachmentService.ts`

- Afbeeldingen > 2MB: comprimeer naar max 1920px, 80% JPEG kwaliteit
- Video > 25MB: `compressionStatus: 'failed'`, foutmelding via `t()`
- Ondersteunde MIME types: `image/jpeg`, `image/png`, `image/heic`, `image/gif`, `video/mp4`, `video/quicktime`

### 14.2 AlbumPickerModal

**Locatie:** `src/components/mail/AlbumPickerModal.tsx`

- Gebruik `PanelAwareModal` als wrapper
- Touch targets >= 60pt
- Haptic feedback bij selectie
- Waarschuwing > 20MB: inline banner
- Disabled > 25MB: banner + knop disabled

### 14.3 AttachmentPreviewBar

**Locatie:** `src/components/mail/AttachmentPreviewBar.tsx`

- Horizontaal scrollbaar, thumbnail 60x60px
- X-knop met >= 60pt raakzone (CommEazy standaard, niet 32px)
- Animatie: respecteer `useReducedMotion()`

---

## FASE 15: Delen via Mail vanuit de Fotoalbum Module

### Analyse Eerst

Voer eerst aanvullende analyse uit:
- Heeft de fotoalbum module al een actiebalk of deelmenu?
- Hoe is multi-selectie geimplementeerd?
- Is er een bestaand patroon voor deelacties?

Rapporteer en wacht op bevestiging.

### Actie "Verstuur via mail"

Toon als: minimaal 1 foto/video geselecteerd EN mailaccount geconfigureerd.
Niet beschikbaar zonder mailaccount: melding + knop "E-mail instellen".

**Module-onafhankelijkheid:** De fotoalbum module importeert GEEN mail-componenten direct. Communicatie uitsluitend via navigatieparameters.

---

## FASE 16: Integratie-tests en Consistentie Check

### Contacten Integratie — bevestig:
- RecipientInput gebruikt uitsluitend bestaande CommEazy contacten service
- Geen directe SQLite queries vanuit mail module naar contacten tabellen
- ContactPickerModal visueel consistent met bestaande modals
- Contact model: `firstName` + `lastName`

### Foto/Video Integratie — bevestig:
- AlbumPickerModal gebruikt thumbnails uit bestaande fotoalbum module
- Geen directe bestandssysteemtoegang buiten bestaande media service

### CommEazy Integratie — bevestig:
- ModuleHeader met `moduleId="mail"` op alle mail screens
- Module kleur via `useModuleColor('mail')`
- Liquid Glass compliance (iOS 26+)
- Voice commands geregistreerd voor mail acties
- HoldToNavigate op alle lijsten
- i18n: alle 13 locales compleet
- Dark mode: alle kleuren via `useColors()`
- iPad Split View: `PanelAwareModal` voor modals
- Accessibility: alle labels, roles, states
- Haptic feedback op alle interactieve elementen
- Welcome modal bij eerste gebruik
- Mock mode voor development
- Privacy Manifest bijgewerkt (iOS)
- Data Safety Section gedocumenteerd (Android)

---

## FASE 17: Bijlagen Opslaan in het CommEazy Fotoalbum

### 17.1 saveToAlbumService.ts

**Locatie:** `src/services/mail/saveToAlbumService.ts`

Dunne wrapper — dupliceer geen album-logica.

```typescript
interface SaveResult {
  success: boolean; mediaId?: string; error?: SaveError;
}

type SaveError =
  | 'STORAGE_FULL' | 'UNSUPPORTED_FORMAT' | 'DOWNLOAD_FAILED'
  | 'ALREADY_SAVED' | 'ALBUM_ERROR';

interface DownloadProgress {
  attachmentId: string; bytesDownloaded: number;
  totalBytes: number; percentage: number;
}
```

Stappen:
1. Duplicaatcheck via fotoalbum service
2. `imapBridge.fetchAttachmentData()` aanroepen
3. Schrijf tijdelijk bestand
4. Fotoalbum service aanroepen om op te slaan
5. Verwijder tijdelijk bestand (ook bij fout)
6. Retourneer `SaveResult`

### 17.2 DownloadProgressIndicator

**Locatie:** `src/components/mail/DownloadProgressIndicator.tsx`

Gebruik bestaande `ProgressIndicator` component van CommEazy als basis. Touch targets >= 60pt voor annuleerknop.

### 17.3 BulkSaveSheet

**Locatie:** `src/components/mail/BulkSaveSheet.tsx`

Gebruik `PanelAwareModal` als wrapper. Alle teksten via `t()` in alle 13 talen.

---

## VOICE COMMAND INTEGRATIE (DOORHEEN ALLE FASEN)

De mail module MOET voice commands ondersteunen. Registreer de volgende commands in `src/types/voiceCommands.ts`:

| Command | Actie | Categorie |
|---------|-------|-----------|
| "open" / "lees" | Open geselecteerde mail | `list` |
| "volgende" | Focus volgende mail | `list` |
| "vorige" | Focus vorige mail | `list` |
| "beantwoord" | Start reply | `action` |
| "doorsturen" | Start forward | `action` |
| "verwijder" | Verwijder met bevestiging | `action` |
| "schrijf nieuw" / "nieuw bericht" | Open compose | `action` |
| "verzend" | Verzend bericht | `action` |
| "bijlage" | Open bijlage picker | `media` |

Alle commands in alle 13 talen met synoniemen.

---

## UITVOERVOLGORDE

Wacht na elke fase op expliciete goedkeuring.

1. Fase 1-2: Analyseer project -> rapporteer -> architectuur -> wacht
2. Fase 3: iOS native module (MailCore2) + Privacy Manifest
3. Fase 4: Android native module (Jakarta Mail) + Data Safety
4. Fase 5: TypeScript bridge, services, cache (database keuze bevestigen)
5. Fase 6: OAuth2 implementatie + Keychain security
6. Fase 7: constants.ts met providers
7. Fase 8: Onboarding wizard + welcome modal
8. Fase 9: Instellingenmenu integratie
9. Fase 10: Inbox, detail en compose (met voice, iPad, Liquid Glass)
10. Fase 11-12: Tests, mock mode, i18n check, eindrapportage basis
11. Fase 13: Contacten-integratie (firstName/lastName model)
12. Fase 14: Foto en video bijlagen
13. Fase 15: Delen vanuit fotoalbum
14. Fase 16: Integratie-tests en consistentie check
15. Fase 17: Bijlagen opslaan in fotoalbum + module registratie check

### Na Fase 17: Totale Eindrapportage

- Overzicht van ALLE aangemaakte en gewijzigde bestanden
- ALLE toegevoegde dependencies met versie en reden
- Openstaande punten die handmatige actie vereisen
- Volledige testinstructies voor handmatige verificatie
- Privacy Manifest wijzigingen (iOS)
- Data Safety Section declaraties (Android)
- i18n completeness rapport (13/13 talen)
- Module registratie checklist (alle 11 punten)
- Liquid Glass compliance rapport
- Voice command registratie rapport
- Mock mode beschikbaarheid

---

## BEVINDINGEN TRACEABILITY

Dit document is het resultaat van een review met 23 bevindingen:

| # | Bevinding | Verwerkt in |
|---|-----------|-------------|
| 1 | "Commeazy" -> "CommEazy" naamgeving | Hele document |
| 2 | Folderstructuur naar bestaande conventie | FOLDERSTRUCTUUR sectie |
| 3 | Senior-inclusive design specificaties | VERPLICHTE VOORKENNIS + alle fasen |
| 4 | Verplichte standaard componenten | VERPLICHTE VOORKENNIS + Fase 10 |
| 5 | Voice command integratie | VOICE COMMAND INTEGRATIE sectie |
| 6 | i18n specificaties (13 talen, blokkeerder) | VERPLICHTE VOORKENNIS + Fase 11 |
| 7 | iPad Split View ondersteuning | Fase 10 + Fase 13 |
| 8 | Liquid Glass / iOS 26+ compliance | MODULE REGISTRATIE + Fase 16 |
| 9 | Module registratie (24+ checks) | MODULE REGISTRATIE sectie |
| 10 | Contact model firstName/lastName | Fase 13 + VERPLICHTE VOORKENNIS |
| 11 | HoldToNavigate integratie | Fase 10 |
| 12 | Theme/Dark mode ondersteuning | VERPLICHTE VOORKENNIS |
| 13 | Mock mode voor development | Fase 11 |
| 14 | Native module locatie/naamgeving | Fase 3 + FOLDERSTRUCTUUR |
| 15 | AdMob integratie | Fase 10 |
| 16 | MediaIndicator registratie | Fase 16 |
| 17 | Store Compliance & Privacy | Fase 3, 4, 6 |
| 18 | Accessibility specificaties | Fase 11 |
| 19 | Security specificaties (Keychain) | Fase 6 |
| 20 | Flow diepte validatie (max 3 stappen) | Fase 8 |
| 21 | Database model (WatermelonDB keuze) | Fase 5 |
| 22 | Form field styling | VERPLICHTE VOORKENNIS + Fase 8 |
| 23 | Welcome modal | Fase 8 |
