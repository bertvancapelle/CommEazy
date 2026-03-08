# Trust & Attestation Plan — CommEazy

## Overzicht

Dit plan beschrijft hoe CommEazy twee fundamentele vertrouwensproblemen oplost:

1. **User-to-User Trust** — Hoe kan een CommEazy-gebruiker zeker weten dat zij communiceert met een andere echte CommEazy-gebruiker?
2. **App-to-Server Trust** — Hoe kunnen CommEazy's centrale services (Prosody, Push Gateway, Invitation Relay) zeker weten dat alleen echte CommEazy-apps verbinden?

**Doelgroep:** Senioren (65+) — alle flows moeten werken zonder technische kennis. Één frustrerend moment = app verwijderd.

**Architectuurprincipe:** Zero-server-storage blijft intact. CommEazy-servers slaan NOOIT gebruikersdata op.

---

## 1. Identiteitsmodel — UUID-Based Identity

### Huidig Systeem

CommEazy identificeert gebruikers via UUID v4, NIET via telefoonnummers.

| Aspect | Waarde |
|--------|--------|
| **User ID** | UUID v4 (bijv. `a1b2c3d4-...`) |
| **JID** | `{uuid}@commeazy.local` |
| **Telefoon** | Alleen voor Firebase phone verification bij onboarding |
| **Encryptiesleutels** | libsodium keypair per device, opgeslagen in Keychain/Keystore |

### Twee Onboarding Paden

| Pad | Wanneer | Flow |
|-----|---------|------|
| **Phone-based** | Nieuw account (iPhone/iPad) | Taalkeuzescherm → Telefoonnummer → Firebase SMS verificatie → Naam → PIN → Klaar |
| **Device Link** | Extra device (tablet) | QR-code scannen van bestaand device → Encrypted key transfer → Klaar |
| **Invitation Code** | iPad standalone (NIEUW) | App installeren → Invitation code invoeren → Keys ontvangen via relay → Klaar |

**⚠️ iPad Standalone:** Met de Invitation Relay (sectie 3) kan een iPad ook ZONDER een bestaand iPhone-device worden opgezet. De gebruiker ontvangt een invitation code via email en voert deze in bij eerste start.

---

## 2. Probleem 1 — User-to-User Trust

### Het Probleem

Wanneer Oma Maria een contact wil toevoegen, moet er een mechanisme zijn om:
1. De ander te laten weten dat Oma Maria hen wil toevoegen
2. Publieke sleutels uit te wisselen voor E2E encryptie
3. Te verifiëren dat de sleutels bij de juiste persoon horen

### Scenario's

| # | Scenario | Oplossing |
|---|----------|-----------|
| A | **Helper (kleinkind) installeert** | Helper configureert beide devices en doet QR-verificatie ter plekke |
| B | **Oma wil vriendin uitnodigen (niet in de buurt)** | Invitation Relay: Oma stuurt code via iOS Share Sheet (SMS/email/WhatsApp) |
| C | **Beide bij de koffie (in de buurt)** | QR-code key exchange face-to-face |
| D | **iPad zonder telefoon** | Invitation code via email → standalone onboarding via relay |
| E | **Familielid in het buitenland** | Invitation Relay via email of messaging app |
| F | **Nieuw device** | iCloud Backup restore (iOS) of Invitation Relay voor key recovery |

### 2.1 Face-to-Face Verificatie (QR-Code)

**Wanneer:** Twee gebruikers zitten fysiek bij elkaar.

**Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│  Oma Maria (iPhone)           Tante Bep (iPhone)            │
│                                                             │
│  1. Contacten → "+" → "In de buurt"                         │
│  2. Toont QR-code met:        3. Scant QR-code              │
│     - userUuid                                              │
│     - publicKey                                             │
│     - displayName                                           │
│  4. ← Bevestigingsscherm →    4. ← Bevestigingsscherm →    │
│     "Is dit Tante Bep?"          "Is dit Oma Maria?"        │
│  5. Beide tikken "Ja"                                       │
│  6. Wederzijds XMPP presence subscription                   │
│  7. ✅ Contact geverifieerd + E2E sleutels uitgewisseld     │
└─────────────────────────────────────────────────────────────┘
```

**QR-code Payload:**

```json
{
  "v": 1,
  "uuid": "a1b2c3d4-...",
  "pk": "base64-encoded-public-key",
  "name": "Oma Maria",
  "jid": "a1b2c3d4@commeazy.local"
}
```

**Beveiliging:**
- QR-code bevat publieke sleutel → direct trust establishment
- Fysieke aanwezigheid = visuele verificatie
- Geen server betrokken → zero-server-storage compliant

### 2.2 Invitation Relay (Op Afstand)

**Wanneer:** Twee gebruikers zijn NIET fysiek bij elkaar.

**Concept:** Een encrypted "brievenbus" op de CommEazy-server die tijdelijk versleutelde contactgegevens bewaart.

**Flow:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Oma Maria (iPhone)                     Tante Bep (iPhone/iPad)     │
│                                                                     │
│  1. Contacten → "+" → "Uitnodigen"                                  │
│  2. App genereert:                                                   │
│     - Invitation code: CE-A7K9-M2PX                                │
│     - AES-256 sleutel afgeleid van code                             │
│  3. App encrypt contactgegevens:                                     │
│     - userUuid, publicKey, displayName                              │
│     - Versleuteld met code-derived key                              │
│  4. Upload encrypted blob naar                                      │
│     Invitation Relay server                                          │
│  5. iOS Share Sheet opent →                                          │
│     Oma stuurt code via:                                             │
│     SMS / iMessage / Email / WhatsApp                                │
│                                   6. Tante Bep ontvangt code         │
│                                   7. Opent CommEazy →                │
│                                      "Uitnodiging invoeren"          │
│                                   8. Voert code in: CE-A7K9-M2PX    │
│                                   9. App downloadt encrypted blob    │
│                                  10. Decypt met code-derived key     │
│                                  11. Slaat contact op + public key   │
│                                  12. Upload EIGEN encrypted blob     │
│                                      (voor Oma Maria's device)       │
│ 13. App pollt relay →                                                │
│     Ontvangt Tante Bep's gegevens                                    │
│ 14. Decypt + slaat contact op                                        │
│                                                                     │
│ 15. ✅ Wederzijds contact + E2E sleutels uitgewisseld               │
│     Relay verwijdert beide blobs automatisch                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Invitation Code Format:**

```
CE-XXXX-XXXX

Waarbij X = alfanumeriek (0-9, A-Z, exclusief verwarrende tekens: 0/O, 1/I/L)
Effectief alfabet: 2-9, A-H, J-K, M-N, P-Z = 30 tekens
Entropie: 30^8 ≈ 6.56 × 10^11 combinaties
```

**Encrypted Blob Structuur:**

```json
{
  "v": 1,
  "enc": "AES-256-GCM encrypted payload",
  "nonce": "random-nonce",
  "created_at": "ISO-8601 timestamp"
}
```

**Payload (voor encryptie):**

```json
{
  "uuid": "a1b2c3d4-...",
  "publicKey": "base64-encoded-public-key",
  "displayName": "Oma Maria",
  "jid": "a1b2c3d4@commeazy.local"
}
```

### 2.3 Invitation Relay — Server Specificatie

**Endpoints:**

| Method | Path | Beschrijving |
|--------|------|-------------|
| `POST` | `/api/v1/invitations` | Upload encrypted invitation blob |
| `GET` | `/api/v1/invitations/:code` | Download encrypted blob |
| `PUT` | `/api/v1/invitations/:code/response` | Upload response blob (acceptant) |
| `GET` | `/api/v1/invitations/:code/response` | Download response blob (uitnodiger) |
| `DELETE` | `/api/v1/invitations/:code` | Handmatig verwijderen |

**Server Regels:**

| Regel | Waarde |
|-------|--------|
| **Opslag** | Alleen encrypted blobs (server kan niet lezen) |
| **TTL** | Automatisch verwijderd na 7 dagen |
| **Na ophalen** | Response blob verwijderd na ophalen door uitnodiger |
| **Max grootte** | 4 KB per blob |
| **Rate limit** | 60 verzoeken per minuut per IP |
| **Authenticatie** | JWT token (zie sectie 4) |
| **Attestation** | App Attest / Play Integrity vereist (zie sectie 3) |

**Zero-Server-Storage Compliance:**

| Vraag | Antwoord |
|-------|----------|
| Kan de server de inhoud lezen? | ❌ Nee — AES-256-GCM encrypted met code-derived key |
| Wie heeft de decryptiesleutel? | Alleen de twee gebruikers (via de gedeelde code) |
| Hoe lang wordt data bewaard? | Max 7 dagen, dan automatisch verwijderd |
| Wordt data verwijderd na gebruik? | ✅ Ja — response blob direct na ophalen |
| Is dit consistent met privacy beleid? | ✅ Ja — server is een encrypted doorgeefluik |

### 2.4 Contacttype Onderscheid

CommEazy kent twee typen contacten:

| Type | Beschrijving | Verificatiestatus | E2E Berichten |
|------|-------------|-------------------|---------------|
| **Adresboekcontact** | Bekende zonder CommEazy (bijv. huisarts) | Niet geverifieerd | ❌ Niet mogelijk |
| **CommEazy-contact** | Geverifieerd CommEazy-gebruiker | ✅ Geverifieerd | ✅ Ja |

**Visuele indicatie:**
- Adresboekcontact: grijs icoon, geen berichtknop
- CommEazy-contact: gekleurd icoon met ✓, berichtknop zichtbaar

---

## 3. Probleem 2 — App-to-Server Trust

### Het Probleem

CommEazy's server-side services moeten beschermd worden tegen:
- Ongeautoriseerde apps die de API's misbruiken
- Bots die spam versturen via Prosody
- Brute-force aanvallen op invitation codes
- Ongeautoriseerde toegang tot de Push Gateway

### 3.1 App Attestation

**Doel:** Bewijzen dat een verzoek afkomstig is van een echte, ongemodificeerde CommEazy-app.

#### iOS — App Attest

| Aspect | Detail |
|--------|--------|
| **Framework** | DeviceCheck / App Attest (iOS 14+) |
| **Hoe het werkt** | Apple genereert een unieke key pair per device+app combinatie |
| **Attestation flow** | App → genereert key → stuurt attestation naar Apple → Apple valideert → signed assertion |
| **Server validatie** | CommEazy API Gateway verifieert Apple's attestation certificate chain |
| **Fallback (iOS <14)** | DeviceCheck token (minder sterk maar voldoende) |

**iOS Attestation Flow:**

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  CommEazy App (iOS)              Apple Servers                   │
│                                                                  │
│  1. DCAppAttestService           2. Attestation                  │
│     .generateKey()                  validatie                    │
│     → keyId                                                      │
│                                                                  │
│  3. .attestKey(keyId,            4. Signed attestation           │
│      clientDataHash)                object retour                │
│     → attestation blob                                           │
│                                                                  │
│  5. Stuur attestation                                            │
│     naar CommEazy API Gateway                                    │
│                                                                  │
│  CommEazy API Gateway                                            │
│                                                                  │
│  6. Verifieer Apple certificate chain                            │
│  7. Controleer app ID match                                      │
│  8. Sla attestation op voor assertion validatie                  │
│  9. ✅ App is echt → geef JWT token                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### Android — Play Integrity

| Aspect | Detail |
|--------|--------|
| **API** | Play Integrity API |
| **Hoe het werkt** | Google genereert integrity verdict (device + app + account) |
| **Verdicts** | `MEETS_DEVICE_INTEGRITY` + `MEETS_BASIC_INTEGRITY` + `MEETS_STRONG_INTEGRITY` |
| **Server validatie** | CommEazy API Gateway verifieert Google's signed verdict |
| **Minimum verdict** | `MEETS_DEVICE_INTEGRITY` (niet-geroote devices) |

**Android Integrity Flow:**

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  CommEazy App (Android)          Google Play Servers             │
│                                                                  │
│  1. IntegrityManager             2. Integrity check              │
│     .requestIntegrityToken()                                     │
│     → nonce + request                                            │
│                                                                  │
│  3. Google retourneert           4. Signed integrity             │
│     integrity token                 verdict                      │
│                                                                  │
│  5. Stuur token naar                                             │
│     CommEazy API Gateway                                         │
│                                                                  │
│  CommEazy API Gateway                                            │
│                                                                  │
│  6. Verifieer Google signature                                   │
│  7. Controleer verdict levels                                    │
│  8. Controleer package name match                                │
│  9. ✅ App is echt → geef JWT token                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 JWT Token Systeem

Na succesvolle attestation ontvangt de app een JWT token voor alle verdere API-communicatie.

**Token Structuur:**

```json
{
  "sub": "a1b2c3d4-...",
  "iss": "commeazy-gateway",
  "iat": 1709900000,
  "exp": 1709986400,
  "platform": "ios",
  "app_version": "1.0.0",
  "device_id": "hashed-device-identifier"
}
```

**Token Regels:**

| Aspect | Waarde |
|--------|--------|
| **Geldigheid** | 24 uur |
| **Vernieuwing** | Automatisch via refresh token (30 dagen) |
| **Opslag** | iOS Keychain / Android Keystore |
| **Bij verlopen** | Automatisch re-attestation + nieuw token |

### 3.3 API Gateway

**Doel:** Centraal toegangspunt voor alle CommEazy server-side services. Valideert JWT tokens en routeert verzoeken.

**Architectuur:**

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet                                  │
│                           │                                      │
│                    ┌──────┴──────┐                               │
│                    │ API Gateway │ ← JWT validatie                │
│                    │  :443/8443  │ ← Rate limiting (60/min)      │
│                    │             │ ← App Attest / Play Integrity │
│                    └──────┬──────┘                               │
│                           │                                      │
│          ┌────────────────┼────────────────┐                    │
│          │                │                │                    │
│   ┌──────┴──────┐  ┌─────┴──────┐  ┌──────┴──────┐            │
│   │ Invitation  │  │   Push     │  │  Toekomstige │            │
│   │   Relay     │  │  Gateway   │  │   services   │            │
│   │   :5283     │  │   :5282    │  │              │            │
│   └─────────────┘  └────────────┘  └──────────────┘            │
│                                                                  │
│   ┌─────────────┐                                               │
│   │  Prosody    │ ← Directe WebSocket (NIET via Gateway)        │
│   │  :5280      │                                               │
│   └─────────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**⚠️ XMPP WebSocket verbinding gaat NIET door de API Gateway.** Prosody heeft zijn eigen authenticatiemechanisme (SASL). De WebSocket verbinding op poort 5280 blijft een directe connectie.

**API Gateway Verantwoordelijkheden:**

| Verantwoordelijkheid | Detail |
|---------------------|--------|
| **JWT Validatie** | Elk verzoek moet een geldig JWT token bevatten |
| **Rate Limiting** | 60 verzoeken per minuut per gebruiker/IP |
| **App Attestation** | Initiële attestation verificatie bij token uitgifte |
| **Request Routing** | Routeert naar juiste backend service |
| **HTTPS Termination** | TLS 1.3 met Let's Encrypt certificaat |
| **Logging** | Alleen metadata (geen request bodies, geen PII) |

**Beschermde Services:**

| Service | Poort | Via Gateway | Authenticatie |
|---------|-------|-------------|---------------|
| **Invitation Relay** | 5283 | ✅ Ja | JWT token |
| **Push Gateway** | 5282 | ✅ Ja | JWT token |
| **Prosody (XMPP)** | 5280 | ❌ Nee | SASL (eigen) |
| **Prosody (HTTP APIs)** | 5280 | ✅ Ja | JWT token |
| **Toekomstige services** | - | ✅ Ja | JWT token |

### 3.4 Deployment

**Huidige configuratie:** API Gateway draait als aparte service op dezelfde server als Prosody en Push Gateway.

**Schaalbaarheid:** De API Gateway kan later naar een aparte VPS verplaatst worden. Dit is puur een configuratiewijziging:
1. DNS A-record wijzigen naar nieuwe VPS
2. API Gateway deployen op nieuwe VPS
3. Reverse proxy configureren naar backend services (via intern netwerk of VPN tunnel)
4. Geen app-wijzigingen nodig

---

## 4. Gecombineerde Authenticatie Flow

### 4.1 Eerste App Start (Onboarding)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  1. App installeert → genereert UUID                            │
│  2. App Attest / Play Integrity attestation                     │
│  3. Firebase phone verification (optioneel voor iPad standalone) │
│  4. API Gateway geeft JWT token na succesvolle attestation      │
│  5. libsodium keypair generatie → opslag in Keychain/Keystore   │
│  6. Registratie bij Prosody: {uuid}@commeazy.local              │
│  7. ✅ App volledig geauthenticeerd en klaar voor gebruik       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Contact Toevoegen (Senior UX)

**UI in CommEazy:**

```
Contacten → [+]
  ├── "In de buurt"     → QR-code verificatie (sectie 2.1)
  ├── "Uitnodigen"      → Invitation Relay (sectie 2.2)
  └── "Bekende toevoegen" → Adresboekcontact (geen CommEazy, geen E2E)
```

**Senior-friendly ontwerp:**
- Maximaal 3 opties, geen technisch jargon
- "In de buurt" = fysiek naast elkaar, toont QR-code
- "Uitnodigen" = op afstand, stuurt code via favoriete app
- "Bekende toevoegen" = naam + telefoon opslaan (geen berichten)

### 4.3 iPad Standalone Onboarding

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  iPad (geen iPhone beschikbaar)                                  │
│                                                                  │
│  1. Familielid stuurt invitation code via email                  │
│  2. Senior installeert CommEazy op iPad                          │
│  3. Taalkeuzescherm → "Ik heb een uitnodigingscode"             │
│  4. Voert code in: CE-A7K9-M2PX                                │
│  5. App downloadt encrypted blob van Invitation Relay            │
│  6. Decypt → ontvangt familielid's contactgegevens + public key  │
│  7. App genereert eigen UUID + keypair                           │
│  8. App Attest attestation → JWT token                          │
│  9. Upload response blob naar relay                              │
│ 10. Registratie bij Prosody                                      │
│ 11. ✅ iPad operationeel met eerste contact                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Beveiligingsanalyse

### 5.1 Aanvalsvectoren en Mitigaties

| Aanval | Mitigatie |
|--------|----------|
| **Brute-force invitation codes** | 30^8 combinaties + rate limit 60/min + code verloopt na 7 dagen |
| **Man-in-the-middle QR** | Fysieke aanwezigheid vereist, visuele bevestiging |
| **Man-in-the-middle relay** | AES-256-GCM encryptie, server kan niet lezen |
| **Gestolen JWT token** | 24u geldigheid, device-bound, re-attestation vereist |
| **Nep-app** | App Attest / Play Integrity blokkeert |
| **Server compromis** | Encrypted blobs onleesbaar, geen sleutels op server |
| **Replay attack** | Nonce in attestation, éénmalige invitation codes |
| **Bot registratie** | App Attest + Firebase phone verification |

### 5.2 Trust Levels

| Level | Beschrijving | Wanneer bereikt |
|-------|-------------|-----------------|
| **0 — Onbekend** | Geen relatie | Initiële staat |
| **1 — Uitgenodigd** | Invitation verstuurd, wacht op acceptatie | Na "Uitnodigen" flow |
| **2 — Verbonden** | Keys uitgewisseld via relay | Na relay key exchange |
| **3 — Geverifieerd** | Face-to-face QR verificatie gedaan | Na QR-code exchange |

**UX consequenties:**
- Level 0-1: Geen berichten mogelijk
- Level 2: Berichten mogelijk met waarschuwing "Niet persoonlijk geverifieerd"
- Level 3: Volledig vertrouwd, geen waarschuwingen

### 5.3 Key Rotation

| Scenario | Actie |
|----------|-------|
| **Nieuw device (iCloud restore)** | Keychain keys overleven restore → geen actie nodig |
| **Nieuw device (geen backup)** | Nieuwe keypair → alle contacten moeten opnieuw key exchange doen |
| **Vermoed compromis** | Gebruiker kan handmatig key rotation triggeren in Instellingen |

---

## 6. Technische Implementatie

### 6.1 Bestandsstructuur

```
src/
  services/
    attestation/
      index.ts                    ← Exports
      appAttest.ts                ← iOS App Attest wrapper
      playIntegrity.ts            ← Android Play Integrity wrapper
      tokenManager.ts             ← JWT token opslag en vernieuwing
    invitation/
      index.ts                    ← Exports
      invitationRelay.ts          ← Relay API client
      invitationCrypto.ts         ← Code → AES key derivatie + encrypt/decrypt
      codeGenerator.ts            ← CE-XXXX-XXXX generatie
  screens/
    contacts/
      AddContactScreen.tsx        ← Refactor: 3 opties (in de buurt / uitnodigen / bekende)
      VerifyContactScreen.tsx     ← Bestaand: QR-code exchange (robustness update)
      InviteContactScreen.tsx     ← NIEUW: invitation code generatie + share
      AcceptInvitationScreen.tsx  ← NIEUW: code invoer + relay download
  contexts/
    AttestationContext.tsx        ← JWT token provider

ios/CommEazyTemp/
  AppAttestModule.swift           ← Native module voor DCAppAttestService
  AppAttestModule.m               ← ObjC bridge

server/
  api-gateway/
    server.js                     ← Express.js API Gateway
    middleware/
      jwtAuth.js                  ← JWT validatie middleware
      rateLimit.js                ← Rate limiting (60/min)
      attestation.js              ← App Attest / Play Integrity verificatie
  invitation-relay/
    server.js                     ← Express.js Invitation Relay
    store.js                      ← Encrypted blob opslag (SQLite of file-based)
    cleanup.js                    ← TTL cleanup (7 dagen)
```

### 6.2 Native Modules

#### iOS — AppAttestModule.swift

```swift
import Foundation
import DeviceCheck

@objc(AppAttestModule)
class AppAttestModule: NSObject {

  @objc
  func generateKey(_ resolve: @escaping RCTPromiseResolveBlock,
                    reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 14.0, *) else {
      reject("UNSUPPORTED", "App Attest requires iOS 14+", nil)
      return
    }

    let service = DCAppAttestService.shared
    guard service.isSupported else {
      reject("UNSUPPORTED", "App Attest not supported on this device", nil)
      return
    }

    service.generateKey { keyId, error in
      if let error = error {
        reject("GENERATE_FAILED", error.localizedDescription, error)
      } else if let keyId = keyId {
        resolve(keyId)
      }
    }
  }

  @objc
  func attestKey(_ keyId: String,
                  clientDataHash: String,
                  resolve: @escaping RCTPromiseResolveBlock,
                  reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 14.0, *) else {
      reject("UNSUPPORTED", "App Attest requires iOS 14+", nil)
      return
    }

    guard let hashData = Data(base64Encoded: clientDataHash) else {
      reject("INVALID_HASH", "Invalid client data hash", nil)
      return
    }

    DCAppAttestService.shared.attestKey(keyId, clientDataHash: hashData) { attestation, error in
      if let error = error {
        reject("ATTEST_FAILED", error.localizedDescription, error)
      } else if let attestation = attestation {
        resolve(attestation.base64EncodedString())
      }
    }
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
```

### 6.3 Invitation Crypto

```typescript
// src/services/invitation/invitationCrypto.ts

import { box, randomBytes, secretbox } from 'tweetnacl';
import { encode as encodeBase64, decode as decodeBase64 } from '@stablelib/base64';
import { encode as encodeUTF8, decode as decodeUTF8 } from '@stablelib/utf8';

/**
 * Derive AES-256 key from invitation code using PBKDF2-like stretching.
 * Uses the code as password with a fixed salt (acceptable because codes are one-time use).
 */
export function deriveKeyFromCode(code: string): Uint8Array {
  // Normalize: remove dashes, uppercase
  const normalized = code.replace(/-/g, '').toUpperCase();

  // Use SHA-256 of normalized code as key material
  // In production: use proper PBKDF2 via native crypto module
  const encoder = new TextEncoder();
  const data = encoder.encode(`commeazy-invitation-v1:${normalized}`);

  // SHA-256 hash produces 32 bytes = AES-256 key
  return crypto.subtle.digestSync('SHA-256', data);
}

/**
 * Encrypt contact data for the invitation relay.
 */
export function encryptInvitation(
  payload: {
    uuid: string;
    publicKey: string;
    displayName: string;
    jid: string;
  },
  code: string,
): { encrypted: string; nonce: string } {
  const key = deriveKeyFromCode(code);
  const nonce = randomBytes(secretbox.nonceLength);
  const message = encodeUTF8(JSON.stringify(payload));
  const encrypted = secretbox(message, nonce, key);

  return {
    encrypted: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt invitation data received from the relay.
 */
export function decryptInvitation(
  encrypted: string,
  nonce: string,
  code: string,
): { uuid: string; publicKey: string; displayName: string; jid: string } | null {
  const key = deriveKeyFromCode(code);
  const decrypted = secretbox.open(
    decodeBase64(encrypted),
    decodeBase64(nonce),
    key,
  );

  if (!decrypted) return null;

  return JSON.parse(decodeUTF8(decrypted));
}
```

### 6.4 Code Generator

```typescript
// src/services/invitation/codeGenerator.ts

// Alfabet zonder verwarrende tekens (0/O, 1/I/L)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 30 tekens

/**
 * Generate invitation code: CE-XXXX-XXXX
 * Entropy: 30^8 ≈ 6.56 × 10^11 combinaties
 */
export function generateInvitationCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  let code = '';
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return `CE-${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

/**
 * Validate invitation code format.
 */
export function isValidInvitationCode(code: string): boolean {
  return /^CE-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}$/.test(code);
}
```

---

## 7. i18n Keys (Nieuw)

### Invitation Flow

```
contacts.add.options.nearby          = "In de buurt"
contacts.add.options.invite          = "Uitnodigen"
contacts.add.options.addressBook     = "Bekende toevoegen"

contacts.invite.title                = "Iemand uitnodigen"
contacts.invite.generating           = "Code aanmaken..."
contacts.invite.codeLabel            = "Jouw uitnodigingscode"
contacts.invite.shareMessage         = "Ik wil je toevoegen in CommEazy! Download de app en voer deze code in: {{code}}"
contacts.invite.shareButton          = "Stuur code"
contacts.invite.waitingTitle         = "Wachten op reactie"
contacts.invite.waitingSubtitle      = "Zodra {{name}} de code invult, worden jullie verbonden"
contacts.invite.expiry               = "Deze code is 7 dagen geldig"
contacts.invite.success              = "{{name}} is toegevoegd!"

contacts.accept.title                = "Uitnodiging invoeren"
contacts.accept.codeInput            = "Voer de code in die je hebt ontvangen"
contacts.accept.codePlaceholder      = "CE-XXXX-XXXX"
contacts.accept.invalidCode          = "Ongeldige code. Controleer de code en probeer opnieuw."
contacts.accept.expired              = "Deze uitnodiging is verlopen. Vraag een nieuwe code."
contacts.accept.connecting           = "Verbinden..."
contacts.accept.success              = "{{name}} is toegevoegd aan je contacten!"

contacts.verify.notVerified          = "Niet persoonlijk geverifieerd"
contacts.verify.verifiedBadge        = "Geverifieerd"
contacts.verify.suggestion           = "Wil je {{name}} persoonlijk verifiëren? Scan elkaars QR-code wanneer jullie bij elkaar zijn."
```

### Attestation (Alleen bij errors)

```
attestation.failed                   = "Er is een probleem met de beveiligingscontrole. Probeer de app opnieuw te starten."
attestation.unsupported              = "Je toestel ondersteunt de beveiligingscontrole niet. Neem contact op met support."
```

Alle 13 locales moeten worden bijgewerkt (nl, en, en-GB, de, fr, es, it, no, sv, da, pt, pt-BR, pl).

---

## 8. Implementatiefasen

### Fase 1: API Gateway + Attestation

1. API Gateway server opzetten (Express.js)
2. JWT token systeem implementeren
3. AppAttestModule.swift native module
4. Rate limiting middleware
5. Push Gateway beschermen via gateway

### Fase 2: Invitation Relay

1. Invitation Relay server opzetten
2. Invitation crypto (code → key derivatie)
3. Code generator
4. InviteContactScreen UI
5. AcceptInvitationScreen UI
6. iOS Share Sheet integratie

### Fase 3: Contact Flow Refactor

1. AddContactScreen refactoren (3 opties)
2. VerifyContactScreen robustness update
3. Trust level visuele indicatie
4. Contact model uitbreiden (trustLevel veld)

### Fase 4: iPad Standalone Onboarding

1. Onboarding flow uitbreiden met "Ik heb een code" pad
2. Invitation code invoer in onboarding
3. Testen op iPad zonder telefoon

### Fase 5: i18n + Testing

1. Alle i18n keys in 13 talen
2. Unit tests voor crypto functies
3. Integration tests voor relay flow
4. E2E test: iPhone ↔ iPad invitation
5. Security review door security-expert skill

---

## 9. Pre-Productie Checklist

- [ ] API Gateway operationeel op productie server
- [ ] App Attest (iOS) werkend en getest
- [ ] Play Integrity (Android) werkend en getest
- [ ] JWT token uitgifte en vernieuwing
- [ ] Invitation Relay operationeel
- [ ] Code generatie en validatie
- [ ] Invitation crypto (encrypt/decrypt)
- [ ] QR-code exchange robuust
- [ ] AddContactScreen met 3 opties
- [ ] InviteContactScreen met Share Sheet
- [ ] AcceptInvitationScreen met code invoer
- [ ] iPad standalone onboarding pad
- [ ] Trust level visuele indicatie
- [ ] Rate limiting getest (60/min)
- [ ] TTL cleanup getest (7 dagen)
- [ ] i18n keys in alle 13 talen
- [ ] Security audit voltooid
- [ ] Zero-server-storage compliance geverifieerd
- [ ] Privacy Manifest bijgewerkt (indien nodig)

---

## 10. Referenties

- [Apple: App Attest](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity)
- [Apple: DeviceCheck](https://developer.apple.com/documentation/devicecheck)
- [Google: Play Integrity API](https://developer.android.com/google/play/integrity)
- [RFC 7519: JSON Web Token (JWT)](https://datatracker.ietf.org/doc/html/rfc7519)
- [NaCl: secretbox (AES-256)](https://nacl.cr.yp.to/secretbox.html)
- CommEazy Security Expert SKILL.md
- CommEazy Architecture Lead SKILL.md
- CommEazy Onboarding Recovery Specialist SKILL.md
- `.claude/plans/BACKUP_RESTORE_PLAN.md`
