# Backup & Restore Plan — CommEazy

## Overzicht

CommEazy's zero-server-storage architectuur betekent dat ALLE gebruikersdata op het apparaat staat. Bij verlies/vervanging van device moet alle data hersteld kunnen worden.

**Doelgroep:** Senioren (65+) — backup MOET 100% automatisch en onzichtbaar zijn. Geen technische keuzes, geen configuratie, geen handleiding.

**Gekozen Strategie:** Platform Backup (iCloud Backup voor iOS/iPadOS)

---

## 1. Strategie — Apple iCloud Backup (iOS/iPadOS)

### Kernconclussie

Apple's iCloud Backup is **afdoende** voor het backuppen van ALLE CommEazy gebruikersdata op iOS/iPadOS. Er is geen custom backup infrastructuur nodig.

**Wat iCloud Backup automatisch opslaat:**

| Data | Opslag locatie | Overleeft iCloud Backup | Bewijs |
|------|----------------|-------------------------|--------|
| **Berichten** (WatermelonDB/SQLCipher) | App sandbox `Library/` | ✅ Ja | SQLite db in app container |
| **Contacten, instellingen, favorieten** (AsyncStorage) | App sandbox `Library/` | ✅ Ja | SQLite-backed KV store |
| **Foto's, audio, media** | App sandbox `Documents/` | ✅ Ja | Bestanden in app container |
| **E2E publieke sleutel** (Keychain) | iOS Keychain | ✅ Ja | `AFTER_FIRST_UNLOCK` (default) — géén `THIS_DEVICE_ONLY` |
| **E2E privésleutel** (Keychain) | iOS Keychain | ✅ Ja | `BIOMETRY_ANY` access control, géén `THIS_DEVICE_ONLY` |
| **Podcast voortgang** (AsyncStorage) | App sandbox `Library/` | ✅ Ja | Onderdeel van AsyncStorage |
| **Module kleuren** (AsyncStorage) | App sandbox `Library/` | ✅ Ja | Onderdeel van AsyncStorage |
| **Radio/Podcast favorieten** (AsyncStorage) | App sandbox `Library/` | ✅ Ja | Onderdeel van AsyncStorage |
| **Apple Music favorieten/lijsten** (AsyncStorage) | App sandbox `Library/` | ✅ Ja | Onderdeel van AsyncStorage |
| **Voice command instellingen** (AsyncStorage) | App sandbox `Library/` | ✅ Ja | Onderdeel van AsyncStorage |

**Wat NIET overleeft (intentioneel):**

| Data | Reden | Herstel na restore |
|------|-------|-------------------|
| **Mail credentials** (Keychain) | `WHEN_UNLOCKED_THIS_DEVICE_ONLY` — bewust uitgesloten | Gebruiker logt opnieuw in bij mail provider |

### Waarom dit werkt

1. **iCloud Backup slaat de volledige app sandbox op** — databases, bestanden, AsyncStorage, alles
2. **Keychain items ZONDER `THIS_DEVICE_ONLY` overleven iCloud Backup** — onze E2E sleutels zijn correct geconfigureerd
3. **Apple versleutelt iCloud Backups** — met AES-256, optioneel end-to-end met Advanced Data Protection
4. **Zero-server-storage blijft intact** — iCloud is de cloud van de GEBRUIKER, niet van CommEazy
5. **Geen actie nodig van senioren** — iCloud Backup werkt automatisch (dagelijks, bij Wi-Fi + opladen)

### Waarom GEEN custom backup

De vorige versie van dit plan beschreef een uitgebreide Strategie A+B met:
- PIN-encrypted Cloud KV Store (NSUbiquitousKeyValueStore)
- Native BackupModule.swift/BackupModule.kt
- BackupContext, BackupHealthBanner, BackupSettingsScreen
- Keychain wijzigingen naar `THIS_DEVICE_ONLY`
- 6 implementatiefasen met 22 taken

**Dit is overbodig voor iOS/iPadOS** omdat Apple's iCloud Backup al precies doet wat we nodig hebben. Vrijwel alle apps vertrouwen op dit mechanisme — CommEazy hoeft geen uitzondering te zijn.

---

## 2. Keychain Configuratie — NIET WIJZIGEN

### Huidige Configuratie (CORRECT)

| Sleutel | Accessibility | THIS_DEVICE_ONLY | Overleeft iCloud Backup |
|---------|---------------|-------------------|-------------------------|
| **Publieke sleutel** | `AFTER_FIRST_UNLOCK` (default) | Nee | ✅ Ja |
| **Privésleutel** | `BIOMETRY_ANY` (access control) | Nee | ✅ Ja |
| **Mail credentials** | `WHEN_UNLOCKED_THIS_DEVICE_ONLY` | Ja | ❌ Nee (bewust) |

**Waarom de sleutels in iCloud Backup acceptabel zijn:**
- Apple versleutelt iCloud Backups met AES-256
- Met Advanced Data Protection (ADP) is de backup end-to-end encrypted
- De privésleutel is NOOIT in plaintext buiten de Keychain — Apple beheert de encryptie
- Dit is hetzelfde vertrouwensmodel als Signal, WhatsApp, en andere E2E apps

**⚠️ NIET WIJZIGEN:** Voeg GEEN `THIS_DEVICE_ONLY` toe aan de E2E sleutels. Dit zou ze uitsluiten van iCloud Backup en de automatische restore breken.

### Bestand Referenties

- `src/services/encryption.ts` (regels 126-135) — publieke sleutel opslag
- `src/services/encryption.ts` — privésleutel opslag met `BIOMETRY_ANY`
- `src/services/mail/credentialManager.ts` (regels 59-66) — mail credentials met `THIS_DEVICE_ONLY`

---

## 3. Wat CommEazy WEL Moet Doen (Minimale Implementatie)

### 3.1 iCloud Account Detectie

Detecteer of de gebruiker een iCloud account heeft ingesteld. Als dat niet zo is, toon een waarschuwingsbanner.

**iOS API:**
```swift
// FileManager.ubiquityIdentityToken
// ≠ nil → iCloud account aanwezig ✅
// == nil → geen iCloud account ⚠️
let hasICloud = FileManager.default.ubiquityIdentityToken != nil
```

**Beperking:** Apple biedt GEEN API om te controleren of de iCloud Backup toggle AAN staat. We kunnen alleen detecteren of er een iCloud account is.

### 3.2 Waarschuwingsbanner (Alleen bij ontbrekend iCloud account)

In het Instellingen scherm, toon een banner als geen iCloud account gedetecteerd is:

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠️ Je gegevens worden niet automatisch beveiligd            │
│     Schakel iCloud in via Instellingen op je iPhone           │
│                                              [Meer info]     │
└──────────────────────────────────────────────────────────────┘
```

**Senior-friendly tekst:**
- GEEN technisch jargon ("backup", "sync", "cloud storage")
- WEL: "beveiligd", "opgeslagen", "veilig"
- Geen paniek creëren — informatief, niet alarmerend

### 3.3 Mail Re-login na Restore

Na een iCloud Backup restore zijn mail credentials verloren (intentioneel `THIS_DEVICE_ONLY`). De app moet:

1. Detecteren dat mail was geconfigureerd maar credentials ontbreken
2. Gebruiker vriendelijk vragen om opnieuw in te loggen
3. Geen foutmelding — gewoon een "Log opnieuw in" scherm tonen

**Detectie:**
```typescript
// Als mailAccountConfig bestaat in AsyncStorage
// MAAR Keychain credentials voor mail ontbreken
// → Toon mail re-login scherm
```

### 3.4 Biometrische Her-registratie na Restore

Na iCloud Backup restore op een nieuw device moeten biometrische gegevens opnieuw worden geregistreerd. De Keychain item met `BIOMETRY_ANY` overleeft de restore, maar de biometrische referentie is gekoppeld aan het nieuwe device.

**Gedrag:** iOS handelt dit automatisch af — bij eerste toegang tot de privésleutel wordt de gebruiker gevraagd om Face ID/Touch ID te bevestigen op het nieuwe device.

---

## 4. Implementatie (iOS/iPadOS)

### 4.1 Bestanden

```
src/
  services/
    backup/
      iCloudCheck.ts            ← iCloud account detectie (native bridge)
      index.ts                  ← Exports
  components/
    BackupWarningBanner.tsx     ← Waarschuwingsbanner (alleen bij geen iCloud)

ios/CommEazyTemp/
  ICloudCheckModule.swift       ← Native module voor ubiquityIdentityToken check
  ICloudCheckModule.m           ← ObjC bridge
```

### 4.2 Native Module (iOS)

```swift
// ICloudCheckModule.swift
import Foundation

@objc(ICloudCheckModule)
class ICloudCheckModule: NSObject {

  @objc
  func checkICloudAvailability(_ resolve: @escaping RCTPromiseResolveBlock,
                                reject: @escaping RCTPromiseRejectBlock) {
    let hasICloud = FileManager.default.ubiquityIdentityToken != nil
    resolve(["available": hasICloud])
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
```

### 4.3 React Native Bridge

```typescript
// src/services/backup/iCloudCheck.ts
import { NativeModules, Platform } from 'react-native';

export async function isICloudAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;

  try {
    const { ICloudCheckModule } = NativeModules;
    const result = await ICloudCheckModule.checkICloudAvailability();
    return result.available === true;
  } catch {
    console.warn('[iCloudCheck] Failed to check iCloud availability');
    return false; // Bij fout, niet waarschuwen (false positive vermijden)
  }
}
```

### 4.4 i18n Keys (nieuw — minimaal)

```
backup.warning.title          = "Je gegevens worden niet automatisch beveiligd"
backup.warning.subtitle       = "Schakel iCloud in via Instellingen op je iPhone"
backup.warning.action         = "Meer info"
backup.warning.infoTitle      = "Waarom iCloud?"
backup.warning.infoBody       = "iCloud slaat al je gegevens veilig op zodat je niets kwijtraakt bij een nieuw toestel"

backup.mail.reloginTitle      = "Log opnieuw in bij je e-mail"
backup.mail.reloginSubtitle   = "Na het herstellen van je toestel moet je opnieuw inloggen"
```

Alle 13 locales moeten worden bijgewerkt (nl, en, en-GB, de, fr, es, it, no, sv, da, pt, pt-BR, pl).

---

## 5. Android — Uitgesteld (Aparte Strategie Nodig)

### Waarom Android Anders Is

| Aspect | iOS/iPadOS | Android |
|--------|-----------|---------|
| **Keystore/Keychain** | Items overleven iCloud Backup | Items overleven NOOIT (altijd device-bound) |
| **Auto Backup grootte** | Onbeperkt (iCloud storage plan) | 25 MB limiet per app |
| **Backup frequentie** | Dagelijks (Wi-Fi + opladen) | Eén keer per 24 uur |
| **Gebruiker controle** | Automatisch | Moet expliciet inschakelen |

### Android Vereist Custom Oplossing

Voor Android zal een aangepaste backup strategie nodig zijn, waarschijnlijk:
- PIN-encrypted key backup naar Google Cloud KV Store (BackupAgentHelper)
- Of: peer-to-peer key overdracht bij device wissel
- Of: QR-code export van encryptiesleutels

**Status:** ⏳ Uitgesteld — wordt opgepakt wanneer Android development start.

---

## 6. Edge Cases (iOS/iPadOS)

| Scenario | Gedrag |
|----------|--------|
| **Geen iCloud account** | Waarschuwingsbanner in Instellingen |
| **iCloud Backup toggle UIT** | Niet detecteerbaar via API — banner alleen bij geen account |
| **iCloud opslag vol** | Apple waarschuwt gebruiker zelf; CommEazy app data is klein |
| **Nieuw device, zelfde Apple ID** | iCloud Backup restore → alle data intact |
| **Nieuw device, ANDER Apple ID** | Data verloren — niet te voorkomen (Apple beperking) |
| **Mail credentials na restore** | Gebruiker logt opnieuw in (verwacht gedrag) |
| **Face ID/Touch ID na restore** | iOS vraagt automatisch om her-registratie |
| **iOS → Android wissel** | NIET ondersteund — platform-specifieke backup |
| **Advanced Data Protection (ADP)** | Extra beveiliging — E2E encrypted backup. CommEazy profiteert automatisch |

---

## 7. Privacy & Security

### Zero-Server-Storage Compliance

| Vraag | Antwoord |
|-------|----------|
| Slaat CommEazy data op een CommEazy server? | ❌ Nee |
| Heeft CommEazy toegang tot iCloud Backup data? | ❌ Nee |
| Wie beheert de backup encryptie? | Apple (AES-256, optioneel E2E met ADP) |
| Wie heeft de decryptiesleutel? | Alleen de gebruiker (via Apple ID) |
| Is dit consistent met privacy beleid? | ✅ Ja — "wij slaan niets op" blijft waar |

### Keychain Security Model

| Sleutel | Wie kan lezen | Backup inclusie | Acceptabel? |
|---------|---------------|-----------------|-------------|
| E2E publieke sleutel | App (na device unlock) | iCloud Backup (encrypted door Apple) | ✅ Ja — publiek per definitie |
| E2E privésleutel | App (na biometrie) | iCloud Backup (encrypted door Apple) | ✅ Ja — Apple beheert encryptie |
| Mail credentials | App (na device unlock) | ❌ Uitgesloten | ✅ Ja — gebruiker logt opnieuw in |

### Privacy Manifest (iOS)

Geen wijzigingen nodig — iCloud Backup is een systeemfunctie die geen extra Privacy Manifest entries vereist. De bestaande `PrivacyInfo.xcprivacy` is correct.

---

## 8. Pre-Productie Checklist (iOS/iPadOS)

- [ ] ICloudCheckModule.swift native module werkend
- [ ] iCloud account detectie getest
- [ ] BackupWarningBanner zichtbaar wanneer geen iCloud account
- [ ] Mail re-login flow na restore getest
- [ ] Biometrische her-registratie na restore geverifieerd
- [ ] i18n keys in alle 13 talen
- [ ] Volledige iCloud Backup restore getest op fysiek device
  - [ ] Berichten intact
  - [ ] Contacten intact
  - [ ] Encryptiesleutels intact (kan berichten decrypten)
  - [ ] Instellingen intact
  - [ ] Favorieten intact (radio, podcast, muziek)
  - [ ] Mail credentials: re-login flow geactiveerd
- [ ] Getest met Advanced Data Protection (ADP) aan en uit

---

## 9. Referenties

- [Apple: About iCloud Backup](https://support.apple.com/en-us/108770)
- [Apple: Advanced Data Protection](https://support.apple.com/en-us/102651)
- [Apple: Keychain Data Protection](https://developer.apple.com/documentation/security/keychain_services/keychain_items/restricting_keychain_item_accessibility)
- [Apple: FileManager.ubiquityIdentityToken](https://developer.apple.com/documentation/foundation/filemanager/1408036-ubiquityidentitytoken)
- CommEazy Security Expert SKILL.md
- CommEazy Architecture Lead SKILL.md
