# Backup & Restore Plan — CommEazy

## Overzicht

CommEazy's zero-server-storage architectuur betekent dat ALLE gebruikersdata op het apparaat staat. Zonder een betrouwbaar backup & restore systeem verliest een gebruiker bij verlies/vervanging van device: berichten, encryptiesleutels, contacten, instellingen, favorieten, en podcast voortgang.

**Doelgroep:** Senioren (65+) — backup MOET 100% automatisch en onzichtbaar zijn. Geen technische keuzes, geen configuratie, geen handleiding.

**Gekozen Strategie:** A+B (Passieve Validatie + Actieve Cloud KV Store)

---

## 1. Strategie Uitleg

### Strategie A — Passieve Validatie

Controleer of het platform's eigen backup systeem correct is geconfigureerd:
- iCloud account aanwezig
- Device passcode ingesteld (vereist voor encrypted backups)
- Keychain items correct geconfigureerd voor backup inclusie

**Beperking:** Kan NIET verifiëren of backup daadwerkelijk plaatsvindt of slaagt.

### Strategie B — Actieve Cloud KV Store

Sla kritieke data zelf op in platform cloud storage:
- iOS/iPadOS: `NSUbiquitousKeyValueStore` (Apple iCloud KV)
- Android: `BackupAgentHelper` (Google Backup KV)

**Voordeel:** Kan verifiëren dat data daadwerkelijk de cloud bereikt (write + read test).

### Strategie A+B — Gecombineerd (GEKOZEN)

1. **Valideer** platform backup configuratie (Strategie A)
2. **Sla aanvullend** kritieke data op in eigen cloud KV store (Strategie B)
3. **Verifieer** dat cloud schrijf/lees test slaagt
4. **Toon** backup gezondheid aan gebruiker (groen/geel/rood banner)

---

## 2. Platform Specificaties

### 2.1 iOS/iPadOS — NSUbiquitousKeyValueStore

| Eigenschap | Waarde |
|------------|--------|
| **API** | `NSUbiquitousKeyValueStore.default` |
| **Max opslag** | 1 MB totaal |
| **Max keys** | 1.024 |
| **Max key lengte** | 64 bytes |
| **Sync snelheid** | Seconden tot minuten (near-realtime) |
| **Vereisten** | iCloud account + iCloud Drive ingeschakeld |
| **Entitlement** | `com.apple.developer.ubiquity-kvstore-identifier` |
| **Beschikbaarheid** | iOS 5+, iPadOS 13+ |

**Benodigde Xcode configuratie:**
```xml
<!-- CommEazyTemp.entitlements -->
<key>com.apple.developer.ubiquity-kvstore-identifier</key>
<string>$(TeamIdentifierPrefix)$(CFBundleIdentifier)</string>
```

**Swift API:**
```swift
let store = NSUbiquitousKeyValueStore.default

// Schrijven
store.set(data, forKey: "backup_encryption_keys")
store.synchronize()

// Lezen
let data = store.data(forKey: "backup_encryption_keys")

// Wijzigingen detecteren (andere devices)
NotificationCenter.default.addObserver(
    forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
    object: store,
    queue: .main
) { notification in
    // Handle external changes
}
```

### 2.2 Android — BackupAgentHelper

| Eigenschap | Waarde |
|------------|--------|
| **API** | `BackupAgentHelper` + `SharedPreferencesBackupHelper` |
| **Max opslag** | 5 MB (key-value backup) |
| **Sync snelheid** | Eén keer per 24 uur |
| **Vereisten** | Google account + backup ingeschakeld in Android settings |
| **Manifest** | `android:backupAgent` + `android:fullBackupContent` |
| **Beschikbaarheid** | Android 2.2+ (API 8+) |

**Android Manifest:**
```xml
<application
    android:backupAgent=".CommEazyBackupAgent"
    android:fullBackupContent="@xml/backup_rules"
    android:dataExtractionRules="@xml/data_extraction_rules">
```

**BackupAgent:**
```java
public class CommEazyBackupAgent extends BackupAgentHelper {
    @Override
    public void onCreate() {
        SharedPreferencesBackupHelper helper =
            new SharedPreferencesBackupHelper(this, "commeazy_backup_prefs");
        addHelper("prefs", helper);
    }
}
```

**Beslissing:** Android's 24-uurs sync cyclus is geaccepteerd als platform standaard. Dit is voldoende voor CommEazy's use case — data verandert niet zo vaak dat realtime sync nodig is.

---

## 3. Data die Opgeslagen Wordt

### 3.1 Data Inventaris

| Data | Grootte (geschat) | Kritiek? | Backup methode |
|------|--------------------|----------|----------------|
| **Encryptie publieke sleutel** | ~44 bytes (base64) | KRITIEK | Cloud KV Store (B) |
| **Encryptie privésleutel** (encrypted met PIN) | ~88 bytes (base64) | KRITIEK | Cloud KV Store (B) — ALLEEN encrypted opslaan |
| **Contact lijst** (JIDs + namen) | ~2-5 KB | KRITIEK | Cloud KV Store (B) |
| **App instellingen** | ~1-2 KB | BELANGRIJK | Cloud KV Store (B) |
| **Module favorieten** (radio stations, podcasts) | ~5-10 KB | BELANGRIJK | Cloud KV Store (B) |
| **Podcast voortgang** (per episode) | ~2-5 KB | BELANGRIJK | Cloud KV Store (B) |
| **Module kleuren** (user customization) | ~0.5 KB | NUTTIG | Cloud KV Store (B) |
| **Voice command customizations** | ~1-2 KB | NUTTIG | Cloud KV Store (B) |
| **Backup metadata** (timestamp, device info) | ~0.5 KB | INTERN | Cloud KV Store (B) |
| **Berichtgeschiedenis** | ~50-500 KB | BELANGRIJK | Platform backup (A) — WatermelonDB |
| **Media bestanden** (foto's, audio) | Variabel | NUTTIG | Platform backup (A) — niet in KV store |

**Totaal Cloud KV Store:** ~15-30 KB (ruim binnen 1 MB iOS / 5 MB Android limiet)

### 3.2 Wat NIET in Cloud KV Store

| Data | Reden |
|------|-------|
| **Onversleutelde privésleutel** | Security — NOOIT plaintext in cloud |
| **Berichten (plaintext)** | Privacy — zero-server-storage principe |
| **Media bestanden** | Te groot voor KV store |
| **WatermelonDB database** | Te groot, backup via platform |
| **Auth tokens** | Korte levensduur, opnieuw te verkrijgen |

### 3.3 Encryptiesleutel Backup Strategie

**KRITIEK:** De privésleutel is het belangrijkste om te backuppen. Zonder deze sleutel kan de gebruiker bestaande berichten niet meer lezen na device wissel.

**Aanpak:**
1. Privésleutel wordt versleuteld met de gebruiker's PIN (die ze al hebben)
2. Versleutelde sleutel + salt + nonce worden opgeslagen in Cloud KV Store
3. Bij restore: gebruiker voert PIN in → privésleutel wordt ontsleuteld
4. Publieke sleutel wordt plaintext opgeslagen (is per definitie publiek)

```typescript
// Conceptuele flow
interface BackupKeyBundle {
  publicKey: string;           // Base64, plaintext OK
  encryptedPrivateKey: string; // Base64, encrypted met PIN
  salt: string;                // Base64, voor key derivation
  nonce: string;               // Base64, voor decryptie
  algorithm: 'xchacha20poly1305'; // Gebruikt algoritme
  createdAt: string;           // ISO timestamp
  deviceId: string;            // Bron device identificatie
}
```

---

## 4. Architectuur

### 4.1 Componenten Overzicht

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Native Layer                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  BackupContext (React Context)                           │    │
│  │  - backupHealth: 'healthy' | 'warning' | 'critical'    │    │
│  │  - lastBackupDate: Date | null                          │    │
│  │  - isRestoring: boolean                                 │    │
│  │  - performBackup(): Promise<void>                       │    │
│  │  - restoreFromBackup(pin: string): Promise<void>        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────┐  ┌──────────────────────────────┐     │
│  │  backupService.ts    │  │  BackupHealthBanner.tsx      │     │
│  │  - serialize data   │  │  - Groen/Geel/Rood status   │     │
│  │  - encrypt keys     │  │  - Senior-friendly tekst    │     │
│  │  - schedule backup  │  │  - Geen technisch jargon    │     │
│  └─────────────────────┘  └──────────────────────────────┘     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  backupBridge.ts (unified cross-platform interface)      │    │
│  │  - writeToCloudKV(key, data): Promise<boolean>          │    │
│  │  - readFromCloudKV(key): Promise<data | null>           │    │
│  │  - checkCloudAvailability(): Promise<CloudStatus>       │    │
│  │  - getLastSyncTimestamp(): Promise<Date | null>          │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                      Native Layer                                │
│                                                                  │
│  ┌──────────────────────────┐  ┌─────────────────────────────┐ │
│  │  iOS: BackupModule.swift  │  │  Android: BackupModule.kt   │ │
│  │                           │  │                              │ │
│  │  NSUbiquitousKeyValue-   │  │  BackupAgentHelper          │ │
│  │  Store                    │  │  SharedPreferencesBackup-   │ │
│  │                           │  │  Helper                     │ │
│  │  Validatie:               │  │                              │ │
│  │  - iCloud account check  │  │  Validatie:                  │ │
│  │  - Passcode check        │  │  - Google account check     │ │
│  │  - KV write/read test    │  │  - Backup enabled check     │ │
│  └──────────────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Bestandsstructuur

```
src/
  services/
    backup/
      backupService.ts        ← Kern backup logica
      backupBridge.ts          ← Cross-platform native bridge
      backupSerializer.ts      ← Data serialization/deserialization
      backupCrypto.ts          ← PIN-based key encryption voor backup
      index.ts                 ← Exports
  contexts/
    BackupContext.tsx           ← App-wide backup state
  components/
    BackupHealthBanner.tsx      ← Status banner component
  screens/
    settings/
      BackupSettingsScreen.tsx  ← Backup instellingen scherm
  types/
    backup.ts                  ← Type definities

ios/CommEazyTemp/
  BackupModule.swift           ← iOS native module
  BackupModule.m               ← ObjC bridge

android/app/src/main/java/.../
  BackupModule.kt              ← Android native module
  CommEazyBackupAgent.kt       ← BackupAgentHelper implementatie
```

### 4.3 Type Definities

```typescript
// types/backup.ts

export type BackupHealth = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface CloudStatus {
  available: boolean;           // Cloud account beschikbaar
  accountName?: string;         // "iCloud" of "Google"
  passcodeSet: boolean;         // Device heeft passcode/PIN
  kvWriteTestPassed: boolean;   // Schrijf/lees test geslaagd
  lastSyncTimestamp: string | null; // ISO timestamp laatste sync
}

export interface BackupData {
  version: number;              // Schema versie (voor migratie)
  createdAt: string;            // ISO timestamp
  deviceId: string;             // Unieke device identifier
  deviceName: string;           // "iPhone van Oma"

  // Kritieke data
  keyBundle: BackupKeyBundle;   // Encrypted encryptiesleutels

  // Belangrijke data
  contacts: BackupContact[];    // JID + naam + avatar hash
  settings: BackupSettings;     // App instellingen
  favorites: BackupFavorites;   // Module favorieten
  podcastProgress: BackupPodcastProgress[];
  moduleColors: Record<string, string>; // User color customizations

  // Metadata
  checksum: string;             // Integriteits hash
}

export interface BackupKeyBundle {
  publicKey: string;
  encryptedPrivateKey: string;
  salt: string;
  nonce: string;
  algorithm: string;
  createdAt: string;
  deviceId: string;
}

export interface BackupContact {
  jid: string;
  displayName: string;
  avatarHash?: string;
}

export interface BackupSettings {
  language: string;
  fontSize: number;
  buttonBorderEnabled: boolean;
  buttonBorderColor?: string;
  reducedMotion: boolean;
  voiceCommandsEnabled: boolean;
  voiceCustomPatterns: Record<string, string[]>;
}

export interface BackupFavorites {
  radioStations: Array<{ id: string; name: string; streamUrl: string }>;
  podcastShows: Array<{ id: string; title: string; feedUrl: string }>;
}

export interface BackupPodcastProgress {
  episodeId: string;
  showId: string;
  position: number;    // Seconden
  duration: number;    // Seconden
  completed: boolean;
}
```

---

## 5. Validatie Checks (Strategie A)

### 5.1 iOS Validatie Matrix

| # | Check | API | Resultaat |
|---|-------|-----|-----------|
| 1 | **iCloud account aanwezig** | `FileManager.default.ubiquityIdentityToken` | ≠ nil → ✅ |
| 2 | **Device passcode ingesteld** | `LAContext().canEvaluatePolicy(.deviceOwnerAuthentication)` | true → ✅ |
| 3 | **KV Store schrijf/lees test** | `NSUbiquitousKeyValueStore` write → read → compare | match → ✅ |
| 4 | **Keychain items correct** | Verify `kSecAttrAccessible` en `kSecAttrSynchronizable` | correct → ✅ |

**NIET mogelijk via Apple API's:**
- ❌ Controleren of iCloud Backup toggle AAN staat
- ❌ Laatste backup datum ophalen
- ❌ Backup grootte controleren
- ❌ Backup completeness verifiëren

### 5.2 Android Validatie Matrix

| # | Check | API | Resultaat |
|---|-------|-----|-----------|
| 1 | **Google account aanwezig** | `AccountManager.getAccountsByType("com.google")` | length > 0 → ✅ |
| 2 | **Backup ingeschakeld** | `BackupManager(context).isBackupEnabled` | true → ✅ |
| 3 | **KV Store schrijf/lees test** | SharedPreferences write → read → compare | match → ✅ |

### 5.3 Gezondheids Status Mapping

| Status | Kleur | Conditie | Gebruiker ziet |
|--------|-------|----------|----------------|
| **healthy** | 🟢 Groen | Alle checks ✅ + KV sync <7 dagen | "Je gegevens zijn veilig opgeslagen" |
| **warning** | 🟡 Geel | Cloud account mist OF sync >7 dagen | "Controleer je [iCloud/Google] instellingen" |
| **critical** | 🔴 Rood | Geen cloud + geen passcode | "Je gegevens zijn niet beveiligd" |
| **unknown** | ⚪ Grijs | Check nog niet voltooid | (geen banner) |

---

## 6. Backup Flow

### 6.1 Automatische Backup (dagelijks)

```
App Start / App Foreground
    │
    ├── Check: >24u sinds laatste backup?
    │   ├── Nee → Skip
    │   └── Ja ↓
    │
    ├── Verzamel data
    │   ├── Contacten uit WatermelonDB
    │   ├── Instellingen uit AsyncStorage
    │   ├── Favorieten uit AsyncStorage
    │   ├── Podcast voortgang uit AsyncStorage
    │   ├── Module kleuren uit AsyncStorage
    │   └── Encryptiesleutels uit Keychain (encrypt met opgeslagen PIN hash)
    │
    ├── Serialiseer naar JSON
    │
    ├── Bereken checksum (SHA-256)
    │
    ├── Schrijf naar Cloud KV Store
    │   ├── Key: "backup_data" → gecomprimeerde JSON
    │   ├── Key: "backup_timestamp" → ISO timestamp
    │   ├── Key: "backup_version" → schema versie nummer
    │   └── Key: "backup_checksum" → SHA-256 hash
    │
    ├── Verifieer: lees terug en vergelijk checksum
    │   ├── Match → ✅ Backup geslaagd
    │   └── Mismatch → ⚠️ Retry (max 3x)
    │
    └── Update BackupContext.lastBackupDate
```

### 6.2 Restore Flow (nieuw device / herinstallatie)

```
App Eerste Start (geen lokale data)
    │
    ├── Detecteer: is dit een fresh install?
    │   ├── Check AsyncStorage voor bestaande data
    │   └── Check Keychain voor bestaande sleutels
    │
    ├── Check Cloud KV Store voor backup
    │   ├── Geen backup gevonden → Normale onboarding
    │   └── Backup gevonden ↓
    │
    ├── Toon Restore Scherm
    │   ├── "We hebben je gegevens gevonden!"
    │   ├── Backup datum tonen
    │   ├── Device naam tonen (bron)
    │   └── "Voer je PIN in om te herstellen"
    │
    ├── Gebruiker voert PIN in
    │   ├── Decrypt privésleutel met PIN
    │   ├── Verifieer: public key matcht?
    │   │   ├── Ja → ✅ Sleutels hersteld
    │   │   └── Nee → ❌ "PIN klopt niet, probeer opnieuw"
    │   └── Max 5 pogingen
    │
    ├── Herstel alle data
    │   ├── Sleutels → Keychain
    │   ├── Contacten → WatermelonDB
    │   ├── Instellingen → AsyncStorage
    │   ├── Favorieten → AsyncStorage
    │   ├── Podcast voortgang → AsyncStorage
    │   └── Module kleuren → AsyncStorage
    │
    ├── Toon Succes Scherm
    │   ├── "Je gegevens zijn hersteld!"
    │   ├── Samenvatting: X contacten, Y favorieten
    │   └── "Berichten worden geladen wanneer je online bent"
    │
    └── Ga door naar app (skip onboarding stappen die al hersteld zijn)
```

---

## 7. Keychain Configuratie Wijzigingen (VEREIST)

### 7.1 Huidige Situatie (PROBLEMEN)

Gebaseerd op analyse van `src/services/encryption.ts` en `node_modules/react-native-keychain/ios/RNKeychainManager.m`:

| Sleutel | Huidige config | Probleem |
|---------|----------------|----------|
| **Publieke sleutel** | `kSecAttrAccessibleAfterFirstUnlock` (default) | `kSecAttrSynchronizable` NIET expliciet op `NO` → kan naar iCloud Keychain syncen |
| **Privésleutel** | `ACCESS_CONTROL.BIOMETRY_ANY` | Overleeft ALLEEN encrypted backups (iTunes/Finder); geen iCloud Backup |

### 7.2 Benodigde Wijzigingen

```typescript
// src/services/encryption.ts — HUIDIGE code (problematisch)
await Keychain.setGenericPassword(
  KEY_ACCOUNT_PUBLIC,
  to_base64(kp.publicKey, base64_variants.ORIGINAL),
  { service: `${KEY_SERVICE}.public` },  // ← Geen accessible option
);

// NIEUWE code (na implementatie)
await Keychain.setGenericPassword(
  KEY_ACCOUNT_PUBLIC,
  to_base64(kp.publicKey, base64_variants.ORIGINAL),
  {
    service: `${KEY_SERVICE}.public`,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    // ↑ THIS_DEVICE_ONLY voorkomt iCloud Keychain sync
    // Backup gaat via eigen Cloud KV Store (Strategie B)
  },
);

// Privésleutel — geen wijziging nodig
// BIOMETRY_ANY + ACCESS_CONTROL is al correct
// Backup gaat via encrypted Cloud KV Store (Strategie B)
```

**Waarom `THIS_DEVICE_ONLY`?**
- Zero-server-storage principe: sleutels horen niet in Apple's iCloud Keychain
- We backuppen sleutels zelf via Cloud KV Store (encrypted met PIN)
- `THIS_DEVICE_ONLY` items worden NIET opgenomen in iCloud Keychain sync

---

## 8. UX Design voor Senioren

### 8.1 BackupHealthBanner

Altijd zichtbaar bovenaan het Instellingen scherm:

```
┌──────────────────────────────────────────────────────────────┐
│  🟢 Je gegevens zijn veilig opgeslagen                       │
│     Laatste opslag: vandaag om 14:32                         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  🟡 Controleer je iCloud instellingen                        │
│     Je gegevens worden niet automatisch opgeslagen           │
│                                                 [Meer info]  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  🔴 Je gegevens zijn niet beveiligd!                         │
│     Bij verlies van je telefoon raak je alles kwijt           │
│                                          [Wat moet ik doen?]  │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Restore Scherm (Nieuw Device)

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│              🎉                                               │
│                                                               │
│     We hebben je gegevens gevonden!                          │
│                                                               │
│     Opgeslagen op: 28 februari 2026                          │
│     Vanaf: iPhone van Oma                                    │
│                                                               │
│     ┌────────────────────────────────┐                       │
│     │  Voer je PIN in: ● ● ● ●      │                       │
│     └────────────────────────────────┘                       │
│                                                               │
│     ┌────────────────────────────────┐                       │
│     │        Gegevens herstellen     │                       │
│     └────────────────────────────────┘                       │
│                                                               │
│     Of: Begin opnieuw (alle gegevens verloren)               │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 8.3 Taalregels

- GEEN technisch jargon: "backup", "restore", "sync", "cloud" vermijden in UI
- WEL gebruiken: "opslaan", "herstellen", "beveiligd", "veilig"
- Alle teksten via `t()` in 13 talen

### 8.4 i18n Keys (nieuw)

```
backup.health.healthy.title       = "Je gegevens zijn veilig opgeslagen"
backup.health.healthy.subtitle    = "Laatste opslag: {{date}}"
backup.health.warning.title       = "Controleer je {{provider}} instellingen"
backup.health.warning.subtitle    = "Je gegevens worden niet automatisch opgeslagen"
backup.health.warning.action      = "Meer info"
backup.health.critical.title      = "Je gegevens zijn niet beveiligd!"
backup.health.critical.subtitle   = "Bij verlies van je telefoon raak je alles kwijt"
backup.health.critical.action     = "Wat moet ik doen?"

backup.restore.found.title        = "We hebben je gegevens gevonden!"
backup.restore.found.date         = "Opgeslagen op: {{date}}"
backup.restore.found.device       = "Vanaf: {{device}}"
backup.restore.enterPin           = "Voer je PIN in"
backup.restore.button             = "Gegevens herstellen"
backup.restore.startFresh         = "Begin opnieuw (alle gegevens verloren)"
backup.restore.wrongPin           = "PIN klopt niet, probeer opnieuw"
backup.restore.success.title      = "Je gegevens zijn hersteld!"
backup.restore.success.summary    = "{{contacts}} contacten, {{favorites}} favorieten hersteld"
backup.restore.success.messages   = "Berichten worden geladen wanneer je online bent"

backup.settings.title             = "Gegevens opslaan"
backup.settings.status            = "Status"
backup.settings.lastBackup        = "Laatste opslag"
backup.settings.manualBackup      = "Nu opslaan"
backup.settings.backupInProgress  = "Bezig met opslaan..."
```

---

## 9. Privacy & Security

### 9.1 Privacy Manifest Update (iOS)

```xml
<!-- PrivacyInfo.xcprivacy — TOEVOEGEN -->
<dict>
    <key>NSPrivacyAccessedAPIType</key>
    <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
    <key>NSPrivacyAccessedAPITypeReasons</key>
    <array>
        <string>CA92.1</string>  <!-- Al aanwezig: app preferences -->
    </array>
</dict>

<!-- NSUbiquitousKeyValueStore gebruikt UserDefaults-achtige API
     maar valt NIET onder NSPrivacyAccessedAPICategoryUserDefaults.
     Geen extra reason code nodig. -->
```

### 9.2 Data Safety Section (Android)

```
Data types collected:
- Device identifiers (device name for backup)

Data types shared: None

Data encrypted in transit: Yes (TLS)
Data encrypted at rest: Yes (PIN-encrypted keys)

Data deletion: Users can delete backup via Settings
```

### 9.3 Security Overwegingen

| Risico | Mitigatie |
|--------|----------|
| **Privésleutel in cloud** | ALTIJD encrypted met PIN vóór cloud opslag |
| **PIN brute-force** | Argon2id key derivation (hoog geheugen/CPU cost) |
| **Man-in-the-middle** | Platform TLS (iCloud/Google) |
| **Ongeautoriseerde restore** | PIN vereist + max 5 pogingen |
| **Device diefstal + PIN bekend** | Biometrische check vóór restore op nieuw device |
| **Cloud provider data access** | Encrypted data — Apple/Google zien alleen ciphertext |
| **Backup data grootte leak** | Vaste structuur, geen variabele padding nodig voor KV |

### 9.4 Keychain Best Practices (NA implementatie)

```swift
// Alle Keychain items MOETEN:
// 1. kSecAttrSynchronizable = false (geen iCloud Keychain sync)
// 2. kSecAttrAccessible = ...ThisDeviceOnly (niet in backup)
// 3. Backup gaat ALLEEN via eigen Cloud KV Store

// De reden: zero-server-storage principe
// Apple/Google mogen GEEN onversleutelde sleutels bevatten
```

---

## 10. Implementatie Volgorde

### Fase 1: Native Modules + Bridge

1. **iOS BackupModule.swift** — NSUbiquitousKeyValueStore wrapper
2. **iOS BackupModule.m** — ObjC bridge
3. **backupBridge.ts** — Cross-platform TypeScript interface
4. **Xcode entitlements** — iCloud KV store entitlement toevoegen
5. **Types** — backup.ts type definities

### Fase 2: Backup Service

6. **backupSerializer.ts** — Data verzamelen en serialiseren
7. **backupCrypto.ts** — PIN-based encryption voor sleutels
8. **backupService.ts** — Backup orchestratie (dagelijkse automatische backup)

### Fase 3: Context + UI

9. **BackupContext.tsx** — React context voor backup state
10. **BackupHealthBanner.tsx** — Status banner component
11. **BackupSettingsScreen.tsx** — Instellingen scherm
12. **Onboarding integratie** — Restore detectie bij eerste start

### Fase 4: Keychain Fix

13. **encryption.ts** — Accessible option wijzigen naar `THIS_DEVICE_ONLY`
14. **Migratie** — Bestaande Keychain items updaten bij app update

### Fase 5: Android (Later)

15. **CommEazyBackupAgent.kt** — Android BackupAgentHelper
16. **BackupModule.kt** — Android native module
17. **Android manifest** — backup agent configuratie
18. **backup_rules.xml** — Backup inclusion/exclusion regels

### Fase 6: i18n + Testing

19. **13 locale bestanden** — Alle backup.* keys in alle talen
20. **Unit tests** — Serialization, encryption, restore flow
21. **Integration tests** — Full backup/restore cycle
22. **Senior user testing** — Restore flow met test personen

---

## 11. Edge Cases & Error Scenarios

| Scenario | Gedrag |
|----------|--------|
| **Geen iCloud/Google account** | Gele banner + instructie om account toe te voegen |
| **iCloud opslag vol** | KV Store is apart (1MB) — niet afhankelijk van iCloud Storage |
| **Meerdere devices, zelfde account** | Laatste backup wint; device naam wordt getoond |
| **PIN vergeten bij restore** | "Begin opnieuw" optie — verliest encryptiesleutels |
| **Schema versie mismatch** | Migratie code per versie; backward compatible |
| **Netwerk niet beschikbaar** | Backup wordt uitgesteld; retry bij volgende foreground |
| **Backup corrupt (checksum fail)** | Vorige backup behouden; retry met verse data |
| **Device wisselt platform** (iOS → Android) | NIET ondersteund — KV stores zijn platform-specifiek |

### Cross-Platform Device Wissel

**iOS → Android of Android → iOS wordt NIET ondersteund** via automatische backup.

Reden: NSUbiquitousKeyValueStore en BackupAgentHelper zijn volledig gescheiden ecosystemen.

**Oplossing voor cross-platform:** Handmatige export/import via QR-code of bestandsoverdracht. Dit is een toekomstige feature (niet in scope van dit plan).

---

## 12. Monitoring & Logging

```typescript
// Logging richtlijnen (conform CLAUDE.md sectie "Logging Richtlijnen")

// ✅ WEL loggen:
console.info('[BackupService] Backup completed', {
  dataSize: 28400,  // bytes
  itemCount: { contacts: 12, favorites: 8 },
  duration: 1200,   // ms
});

console.warn('[BackupService] Cloud KV not available - retrying');

console.error('[BackupService] Backup verification failed', {
  reason: 'checksum_mismatch'
});

// ❌ NIET loggen:
console.log('[BackupService] Contact:', contact.name);     // PII
console.log('[BackupService] Key:', publicKey);             // Security
console.log('[BackupService] Data:', JSON.stringify(data)); // Privacy
```

---

## 13. Afhankelijkheden

| Dependency | Doel | Status |
|------------|------|--------|
| **react-native-keychain** | Keychain toegang | ✅ Al geïnstalleerd (v8.2.0) |
| **libsodium** | Encryptie (PIN-based) | ✅ Al geïnstalleerd |
| **@react-native-async-storage** | AsyncStorage backup bron | ✅ Al geïnstalleerd |
| **WatermelonDB** | Database backup bron | ✅ Al geïnstalleerd |
| **iCloud KV entitlement** | iOS cloud opslag | ❌ Toe te voegen |
| **Android Backup manifest** | Android backup | ❌ Toe te voegen |

Geen nieuwe npm dependencies vereist.

---

## 14. Productie Validatie Gate

**Dit item is een BLOKKEERDER voor productie release.**

Zie CLAUDE.md Feature Backlog voor de productie gate entry.

### Pre-Productie Checklist

- [ ] iOS BackupModule.swift werkend
- [ ] Android BackupModule.kt werkend
- [ ] Automatische dagelijkse backup actief
- [ ] Restore flow getest op nieuw device
- [ ] PIN-encrypted key backup/restore cyclus getest
- [ ] BackupHealthBanner zichtbaar in Instellingen
- [ ] i18n keys in alle 13 talen
- [ ] Privacy Manifest bijgewerkt
- [ ] Data Safety Section bijgewerkt
- [ ] Keychain `THIS_DEVICE_ONLY` migratie getest
- [ ] Edge cases getest (geen cloud, vol, corrupt)
- [ ] Senior user test uitgevoerd

---

## Referenties

- [Apple: NSUbiquitousKeyValueStore](https://developer.apple.com/documentation/foundation/nsubiquitouskeyvaluestore)
- [Apple: Designing iCloud Key-Value Storage](https://developer.apple.com/library/archive/documentation/General/Conceptual/iCloudDesignGuide/Chapters/DesigningForKey-ValueDataIniCloud.html)
- [Android: Key/Value Backup](https://developer.android.com/identity/data/keyvaluebackup)
- [Android: BackupAgentHelper](https://developer.android.com/reference/android/app/backup/BackupAgentHelper)
- CommEazy Security Expert SKILL.md
- CommEazy Architecture Lead SKILL.md
