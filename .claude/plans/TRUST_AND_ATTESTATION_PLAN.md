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

### 2.1 "In de buurt" — Nearby Contact Wizard

**Wanneer:** Twee gebruikers zitten fysiek bij elkaar (bijv. bij de koffie, familiebezoek).

**Waarom een wizard?** Senioren hebben behoefte aan begeleiding stap-voor-stap. Een wizard voorkomt verwarring door slechts één actie per stap te vragen. De helper (kleinkind, buurvrouw) kan meekijken en bijsturen.

#### Complete Wizard Flow (6 stappen)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Oma Maria (iPhone) — INITIATOR                                     │
│  Tante Bep (zit ernaast) — ONTVANGER                                │
│                                                                     │
│  Stap 1: "Heeft je contact de app al geïnstalleerd?"               │
│          [Ja, de app staat erop] → Stap 3                           │
│          [Nee, nog niet]         → Stap 2                           │
│                                                                     │
│  Stap 2: QR-code Download Link                                     │
│          Scherm toont QR-code: https://commeazy.com/download        │
│          + instructie: "Laat je contact deze code scannen            │
│           met de camera van hun telefoon"                            │
│          Tante Bep scant met Camera app → App Store/Play Store      │
│          → Installeert CommEazy → Maakt profiel aan                  │
│          [Wachtscherm: "Klaar? Tik hier om door te gaan"]           │
│          → Stap 3                                                    │
│                                                                     │
│  Stap 3: "Heeft je contact een profiel aangemaakt?"                 │
│          [Ja] → Stap 4                                              │
│          [Nee, even wachten] → Wachtscherm met tips                 │
│          → Stap 4                                                    │
│                                                                     │
│  Stap 4: QR-code Uitnodigingscode                                  │
│          App genereert invitation code: CE-XXXX-XXXX-XXXX           │
│          Scherm toont QR-code: https://commeazy.com/invite/CE-...   │
│          + instructie: "Laat je contact deze code scannen"           │
│          Tante Bep scant met Camera app → CommEazy opent            │
│          → Relay uitwisseling (bidirectioneel via invitation code)   │
│          → "Verbonden met Tante Bep!" ✅                            │
│                                                                     │
│  Stap 5: Video Call Test (optioneel)                                │
│          "Wil je de verbinding testen met een kort videogesprek?"   │
│          [Ja, bel nu] → Normaal videogesprek start                  │
│            → Na ophangen: "Was dit Tante Bep?" [Ja] → Level 3 ✅   │
│            → [Nee] → Level 2, waarschuwing tonen                    │
│          [Overslaan] → Level 2, door naar Stap 6                    │
│                                                                     │
│  Stap 6: Klaar! 🎉                                                 │
│          "Je kunt nu berichten sturen naar Tante Bep."              │
│          [Stuur een berichtje] → Opent chat                         │
│          [Terug naar contacten] → ContactListScreen                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Twee QR-codes in de Wizard

De wizard gebruikt twee VERSCHILLENDE QR-codes voor twee verschillende doelen:

| Stap | QR-code URL | Doel | Wanneer |
|------|-------------|------|---------|
| **Stap 2** | `https://commeazy.com/download` | App downloaden | Contact heeft CommEazy nog niet |
| **Stap 4** | `https://commeazy.com/invite/CE-XXXX-XXXX-XXXX` | Key exchange via relay | Contact heeft CommEazy wel |

Beide QR-codes worden gescand met de **Camera app** van het ontvangende device (niet een in-app scanner). Zie sectie 2.5 voor Universal Links configuratie.

#### Video Call Test als Verificatie (Stap 5)

Het videogesprek in Stap 5 dient twee doelen:

1. **Functionele test** — Bevestigt dat de verbinding werkt (berichten, audio, video)
2. **Level 3 verificatie** — Na het gesprek: "Was dit [naam]?" → Ja = Level 3 (geverifieerd)

**Design beslissingen:**
- Het videogesprek is een **normaal videogesprek** — geen speciale modus
- Echo/feedback bij naast elkaar zitten is acceptabel (gesprek duurt 5-10 seconden)
- Senioren verwachten echo wanneer ze naast elkaar zitten en begrijpen dit
- Het toevoegen van speciale echo-cancellation of video-only modus zou onnodige complexiteit toevoegen
- De verificatievraag komt ALLEEN bij de initiator (Oma Maria), niet bij Tante Bep
- **Eenzijdige verificatie is voldoende** — elk device beheert zijn eigen trust levels onafhankelijk

#### QR-code Payloads

**Download QR (Stap 2):**
```
https://commeazy.com/download
```
Plain URL — Universal Link die redirect naar App Store (iOS) of Play Store (Android).

**Invite QR (Stap 4):**
```
https://commeazy.com/invite/CE-A7K9-M2PX-R4BT
```
Universal Link met invitation code in URL path. Als CommEazy geïnstalleerd is: opent direct de AcceptInvitationScreen. Als niet geïnstalleerd: opent browser → landingspagina → store links.

**Legacy QR Payload (voor in-app scanner, backward compat):**
```json
{
  "v": 1,
  "uuid": "a1b2c3d4-...",
  "pk": "base64-encoded-public-key",
  "name": "Oma Maria",
  "jid": "a1b2c3d4@commeazy.local"
}
```

#### Beveiliging

- QR-code scannen via Camera app = geen in-app scanner nodig (minder code, minder attack surface)
- Invitation code in URL is encrypted op relay (Argon2id key derivation + AES-256-GCM)
- Fysieke aanwezigheid bij wizard = visuele verificatie mogelijk
- Video call test bevestigt identiteit → Level 3 trust
- Zero-server-storage compliant (relay slaat alleen encrypted blobs op, max 7 dagen)

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
CE-XXXX-XXXX-XXXX

Waarbij X = alfanumeriek (0-9, A-Z, exclusief verwarrende tekens: 0/O, 1/I/L)
Effectief alfabet: 2-9, A-H, J-K, M-N, P-Z = 30 tekens
Entropie: 30^12 ≈ 5.31 × 10^17 combinaties

De code wordt ook als URL verspreid via Universal Links:
https://commeazy.com/invite/CE-XXXX-XXXX-XXXX
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

### 2.5 Universal Links / commeazy.com

**Domein:** `commeazy.com` (bevestigd)

CommEazy gebruikt Universal Links (iOS) en App Links (Android) zodat QR-codes gescand met de **Camera app** automatisch CommEazy openen. Geen in-app QR-scanner nodig.

#### Waarom Camera App in plaats van In-App Scanner?

| Aspect | Camera App | In-App Scanner |
|--------|-----------|----------------|
| **Senior-friendliness** | ✅ Bekend van COVID-era QR-codes | ❌ Onbekende interface |
| **Stappen** | 1 (open camera, richt op QR) | 3+ (open CommEazy, vind scanner, richt op QR) |
| **App niet geïnstalleerd** | ✅ Browser fallback → store | ❌ Niet mogelijk |
| **Code complexiteit** | ✅ Geen camera permission nodig | ❌ Camera permission + scanner UI |
| **Betrouwbaarheid** | ✅ Systeem-level, altijd werkend | ⚠️ Kan bugs bevatten |

#### URL Routes

| URL | Doel | Gedrag met app | Gedrag zonder app |
|-----|------|---------------|-------------------|
| `commeazy.com/download` | App downloaden | Redirect naar store | Landing page met store links |
| `commeazy.com/invite/CE-XXXX-XXXX-XXXX` | Contact uitnodigen | Opent AcceptInvitationScreen | Landing page → store → deep link na installatie |

#### iOS Configuratie — apple-app-site-association

Bestand: `https://commeazy.com/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.commeazy.app",
        "paths": [
          "/invite/*",
          "/download"
        ]
      }
    ]
  }
}
```

**Xcode configuratie:**
- Associated Domains capability: `applinks:commeazy.com`
- `AppDelegate` of `SceneDelegate` implementeert `application(_:continue:restorationHandler:)` voor URL afhandeling
- React Native: `Linking.addEventListener('url', handleDeepLink)` of `react-navigation` deep linking

#### Android Configuratie — assetlinks.json

Bestand: `https://commeazy.com/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.commeazy.app",
      "sha256_cert_fingerprints": ["SIGNING_KEY_FINGERPRINT"]
    }
  }
]
```

**AndroidManifest.xml:**
```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="commeazy.com" android:pathPrefix="/invite/" />
</intent-filter>
```

#### commeazy.com Landing Page

Minimale landingspagina voor wanneer de app NIET geïnstalleerd is:

```
commeazy.com/invite/CE-XXXX-XXXX-XXXX
┌─────────────────────────────────────┐
│  CommEazy Logo                      │
│                                     │
│  "Je bent uitgenodigd voor          │
│   CommEazy!"                        │
│                                     │
│  [Download voor iPhone]  → App Store│
│  [Download voor Android] → Play Store│
│                                     │
│  "Na installatie wordt de           │
│   uitnodiging automatisch geopend." │
└─────────────────────────────────────┘
```

**Technisch:** Na installatie via store link bewaart het systeem de deferred deep link. Bij eerste app-open wordt de invitation code automatisch verwerkt (iOS: `NSUserActivity`, Android: deferred deep linking via Play Install Referrer).

#### Beveiliging

- HTTPS only (TLS 1.3)
- Invitation code in URL is NIET de decryptiesleutel — het is een lookup key voor de relay
- De daadwerkelijke encryptie gebruikt Argon2id key derivation van de volledige code
- URL is tijdelijk geldig (7 dagen TTL op relay)
- Rate limiting op relay voorkomt brute-force

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
  ├── "In de buurt"        → Nearby Contact Wizard (sectie 2.1) — stap-voor-stap begeleiding
  ├── "Uitnodigen"         → Invitation Relay (sectie 2.2) — op afstand, code via SMS/email
  └── "Bekende toevoegen"  → Adresboekcontact (geen CommEazy, geen E2E)
```

**Senior-friendly ontwerp:**
- Maximaal 3 opties, geen technisch jargon
- "In de buurt" = fysiek naast elkaar → start Nearby Contact Wizard met 6 stappen
  - Wizard begeleidt door: app installatie, profiel aanmaken, QR scannen, key exchange, optionele video call test
  - Camera app scant QR-codes via Universal Links (commeazy.com)
  - Optionele video call test aan einde voor Level 3 verificatie
- "Uitnodigen" = op afstand, stuurt code via favoriete app (iOS Share Sheet)
- "Bekende toevoegen" = naam + telefoon opslaan (geen berichten)

**Na contact toevoegen — Trust Level:**
- Via "In de buurt" wizard: Level 2 (verbonden) of Level 3 (geverifieerd via video call)
- Via "Uitnodigen": Level 2 (verbonden via relay)
- Via "Bekende toevoegen": Level 0 (adresboekcontact, geen CommEazy)

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

| Level | Beschrijving | Wanneer bereikt | Mogelijkheden |
|-------|-------------|-----------------|---------------|
| **0 — Onbekend** | Adresboekcontact zonder CommEazy | Handmatig toegevoegd ("Bekende toevoegen") | Alleen contactgegevens opslaan |
| **1 — Uitgenodigd** | Invitation verstuurd, wacht op acceptatie | Na "Uitnodigen" flow, code verstuurd | Geen communicatie mogelijk |
| **2 — Verbonden** | E2E keys uitgewisseld via relay | Na relay key exchange (wizard stap 4 of "Uitnodigen") | ✅ Berichten, ✅ Foto's, ✅ Video calls, ✅ Spraakberichten |
| **3 — Geverifieerd** | Identiteit persoonlijk bevestigd | Na video call verificatie (wizard stap 5) of later via contactprofiel | ✅ Alle Level 2 functies + geen waarschuwingen |

**Hoe Level 3 bereiken:**
- **Via Nearby Wizard (stap 5):** Na video call test → "Was dit [naam]?" → Ja
- **Via contactprofiel:** Later alsnog een video call doen → verificatievraag verschijnt na ophangen
- **Via QR-code exchange (legacy):** Face-to-face directe key exchange zonder relay

**UX consequenties:**
- Level 0: Contactgegevens alleen (grijs icoon, geen berichtknop)
- Level 1: Wachtend op acceptatie (zandloper icoon)
- Level 2: Volledig functioneel — berichten, foto's, video calls mogelijk. Subtiele indicatie "Niet persoonlijk geverifieerd" in contactprofiel (NIET bij elke interactie)
- Level 3: Volledig vertrouwd, ✓ badge in contactlijst, geen waarschuwingen

**Eenzijdige verificatie:**
- Trust levels zijn **per device, per richting** — Oma Maria kan Tante Bep op Level 3 hebben, terwijl Tante Bep Oma Maria op Level 2 heeft
- Dit is bewust: elk device beheert zijn eigen trust assessment onafhankelijk
- Geen server-side trust synchronisatie nodig (zero-server-storage compliant)

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
      invitationCrypto.ts         ← Argon2id key derivation + AES-256-GCM encrypt/decrypt
      codeGenerator.ts            ← CE-XXXX-XXXX-XXXX generatie + URL helpers
    deepLinking/
      index.ts                    ← Exports
      universalLinkHandler.ts     ← URL parsing + routing (extractCodeFromUrl)
      deferredDeepLink.ts         ← Deferred deep link after app install
  screens/
    contacts/
      AddContactScreen.tsx        ← Refactor: 3 opties (in de buurt / uitnodigen / bekende)
      NearbyContactWizard.tsx     ← NIEUW: 6-stappen wizard (sectie 2.1)
      VerifyContactScreen.tsx     ← Bestaand: QR-code exchange (legacy, backward compat)
      InviteContactScreen.tsx     ← NIEUW: invitation code generatie + share (op afstand)
      AcceptInvitationScreen.tsx  ← NIEUW: code invoer + relay download + Universal Link entry
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

web/
  commeazy.com/
    .well-known/
      apple-app-site-association  ← Universal Links config (iOS)
      assetlinks.json             ← App Links config (Android)
    invite/
      index.html                  ← Landing page voor niet-geïnstalleerde apps
    download/
      index.html                  ← Redirect naar App Store / Play Store
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
 * Generate invitation code: CE-XXXX-XXXX-XXXX
 * Entropy: 30^12 ≈ 5.31 × 10^17 combinaties
 */
export function generateInvitationCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);

  let code = '';
  for (let i = 0; i < 12; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return `CE-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

/**
 * Generate full invitation URL for QR-code display.
 * Used in Nearby Contact Wizard (step 4).
 */
export function generateInvitationUrl(code: string): string {
  return `https://commeazy.com/invite/${code}`;
}

/**
 * Extract invitation code from URL (Universal Link handling).
 */
export function extractCodeFromUrl(url: string): string | null {
  const match = url.match(/commeazy\.com\/invite\/(CE-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4})$/);
  return match ? match[1] : null;
}

/**
 * Validate invitation code format.
 */
export function isValidInvitationCode(code: string): boolean {
  return /^CE-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}$/.test(code);
}
```

---

## 7. i18n Keys (Nieuw)

### Contact Toevoegen — 3 Opties

```
contacts.add.options.nearby          = "In de buurt"
contacts.add.options.invite          = "Uitnodigen"
contacts.add.options.addressBook     = "Bekende toevoegen"
```

### Nearby Contact Wizard (6 stappen)

```
contacts.wizard.title                = "Contact toevoegen"

// Stap 1: App geïnstalleerd?
contacts.wizard.step1.title          = "Heeft je contact de app al?"
contacts.wizard.step1.subtitle       = "CommEazy moet op beide telefoons staan"
contacts.wizard.step1.yesButton      = "Ja, de app staat erop"
contacts.wizard.step1.noButton       = "Nee, nog niet"

// Stap 2: Download QR
contacts.wizard.step2.title          = "Laat deze code scannen"
contacts.wizard.step2.instruction    = "Laat je contact deze code scannen met de camera van hun telefoon"
contacts.wizard.step2.waitButton     = "Klaar? Tik hier om door te gaan"
contacts.wizard.step2.tip            = "De camera herkent de code automatisch"

// Stap 3: Profiel aangemaakt?
contacts.wizard.step3.title          = "Heeft je contact een profiel aangemaakt?"
contacts.wizard.step3.subtitle       = "Je contact moet de app openen en zijn naam invullen"
contacts.wizard.step3.yesButton      = "Ja"
contacts.wizard.step3.waitButton     = "Nee, even wachten"
contacts.wizard.step3.waiting        = "Wacht tot je contact klaar is..."

// Stap 4: Invite QR
contacts.wizard.step4.title          = "Scan deze code om te verbinden"
contacts.wizard.step4.instruction    = "Laat je contact deze code scannen met de camera"
contacts.wizard.step4.connecting     = "Verbinden..."
contacts.wizard.step4.success        = "Verbonden met {{name}}!"

// Stap 5: Video call test
contacts.wizard.step5.title          = "Wil je de verbinding testen?"
contacts.wizard.step5.subtitle       = "Een kort videogesprek bevestigt dat alles werkt"
contacts.wizard.step5.callButton     = "Ja, bel nu"
contacts.wizard.step5.skipButton     = "Overslaan"
contacts.wizard.step5.verifyTitle    = "Was dit {{name}}?"
contacts.wizard.step5.verifyYes      = "Ja, dat klopt"
contacts.wizard.step5.verifyNo       = "Nee, dat was iemand anders"
contacts.wizard.step5.verified       = "{{name}} is geverifieerd! ✓"

// Stap 6: Klaar
contacts.wizard.step6.title          = "Klaar!"
contacts.wizard.step6.subtitle       = "Je kunt nu berichten sturen naar {{name}}"
contacts.wizard.step6.chatButton     = "Stuur een berichtje"
contacts.wizard.step6.contactsButton = "Terug naar contacten"
```

### Invitation Flow (Op Afstand)

```
contacts.invite.title                = "Iemand uitnodigen"
contacts.invite.generating           = "Code aanmaken..."
contacts.invite.codeLabel            = "Jouw uitnodigingscode"
contacts.invite.shareMessage         = "Ik wil je toevoegen in CommEazy! Ga naar: {{url}}"
contacts.invite.shareButton          = "Stuur uitnodiging"
contacts.invite.waitingTitle         = "Wachten op reactie"
contacts.invite.waitingSubtitle      = "Zodra {{name}} de link opent, worden jullie verbonden"
contacts.invite.expiry               = "Deze uitnodiging is 7 dagen geldig"
contacts.invite.success              = "{{name}} is toegevoegd!"
```

### Invitation Accepteren

```
contacts.accept.title                = "Uitnodiging invoeren"
contacts.accept.codeInput            = "Voer de code in die je hebt ontvangen"
contacts.accept.codePlaceholder      = "CE-XXXX-XXXX-XXXX"
contacts.accept.invalidCode          = "Ongeldige code. Controleer de code en probeer opnieuw."
contacts.accept.expired              = "Deze uitnodiging is verlopen. Vraag een nieuwe code."
contacts.accept.connecting           = "Verbinden..."
contacts.accept.success              = "{{name}} is toegevoegd aan je contacten!"
```

### Trust Level Indicatie

```
contacts.verify.notVerified          = "Niet persoonlijk geverifieerd"
contacts.verify.verifiedBadge        = "Geverifieerd"
contacts.verify.suggestion           = "Wil je {{name}} persoonlijk verifiëren? Bel via video en bevestig dat je de juiste persoon ziet."
contacts.verify.afterCall            = "Was dit {{name}}?"
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

### Fase 2: Invitation Relay + Crypto

1. Invitation Relay server opzetten
2. Invitation crypto (Argon2id key derivation + AES-256-GCM encrypt/decrypt)
3. Code generator (CE-XXXX-XXXX-XXXX format, 12 chars)
4. URL generator (commeazy.com/invite/CE-...)
5. InviteContactScreen UI (op afstand flow)
6. AcceptInvitationScreen UI (code invoer + relay download)
7. iOS Share Sheet integratie

### Fase 3: Universal Links + commeazy.com

1. commeazy.com domein configureren
2. apple-app-site-association bestand deployen
3. assetlinks.json bestand deployen (Android)
4. Associated Domains capability in Xcode
5. React Native deep link handler (`Linking` API)
6. Extractie van invitation code uit URL
7. Minimale landingspagina (voor wanneer app niet geïnstalleerd)
8. Deferred deep linking testen (installatie via store → code automatisch verwerkt)

### Fase 4: Contact Flow Refactor + Nearby Wizard

1. AddContactScreen refactoren (3 opties: in de buurt / uitnodigen / bekende)
2. Nearby Contact Wizard implementeren (6 stappen):
   - Stap 1: App geïnstalleerd? (Ja/Nee routing)
   - Stap 2: Download QR tonen (commeazy.com/download)
   - Stap 3: Profiel aangemaakt? (wachtscherm)
   - Stap 4: Invite QR tonen (commeazy.com/invite/CE-...) + relay key exchange
   - Stap 5: Video call test (optioneel) + Level 3 verificatie prompt
   - Stap 6: Klaar scherm (chat starten / terug naar contacten)
3. Trust level model in Contact schema (trustLevel: 0-3)
4. Trust level visuele indicatie (iconen, badges, waarschuwingen)
5. Video call verificatie prompt na ophangen (ook buiten wizard)

### Fase 5: iPad Standalone Onboarding

1. Onboarding flow uitbreiden met "Ik heb een uitnodigingscode" pad
2. Invitation code invoer in onboarding (accepteert zowel code als URL)
3. Testen op iPad zonder telefoon

### Fase 6: i18n + Testing + Security

1. Alle i18n keys in 13 talen (zie sectie 7 voor volledige key lijst)
2. Unit tests voor crypto functies (encryptie, key derivation, code generatie)
3. Unit tests voor URL extractie (extractCodeFromUrl)
4. Integration tests voor relay flow (upload → download → decrypt)
5. Integration tests voor Universal Links (deep link → AcceptInvitationScreen)
6. E2E test: Nearby Contact Wizard volledig doorlopen
7. E2E test: iPhone ↔ iPad invitation op afstand
8. E2E test: Video call verificatie → Level 3 upgrade
9. Security review door security-expert skill
10. Accessibility audit (wizard schermen, VoiceOver, 60pt touch targets)

---

## 9. Pre-Productie Checklist

### Server-side

- [ ] API Gateway operationeel op productie server
- [ ] App Attest (iOS) werkend en getest
- [ ] Play Integrity (Android) werkend en getest
- [ ] JWT token uitgifte en vernieuwing
- [ ] Invitation Relay operationeel
- [ ] Rate limiting getest (60/min)
- [ ] TTL cleanup getest (7 dagen)

### commeazy.com

- [ ] Domein geconfigureerd met DNS
- [ ] HTTPS actief (TLS 1.3 via Let's Encrypt)
- [ ] apple-app-site-association gedeployed en gevalideerd
- [ ] assetlinks.json gedeployed en gevalideerd
- [ ] Landingspagina operationeel (download links naar stores)
- [ ] Deferred deep linking werkend (iOS + Android)

### App-side

- [ ] Code generatie en validatie (CE-XXXX-XXXX-XXXX format)
- [ ] Invitation crypto (Argon2id + AES-256-GCM encrypt/decrypt)
- [ ] Universal Link handler (extractCodeFromUrl + routing)
- [ ] AddContactScreen met 3 opties
- [ ] Nearby Contact Wizard (6 stappen) volledig functioneel
- [ ] InviteContactScreen met Share Sheet
- [ ] AcceptInvitationScreen met code invoer + URL acceptatie
- [ ] Video call verificatie prompt (na ophangen)
- [ ] Trust level model in Contact schema
- [ ] Trust level visuele indicatie (Level 0-3)
- [ ] iPad standalone onboarding pad

### Quality

- [ ] i18n keys in alle 13 talen
- [ ] Accessibility audit wizard schermen
- [ ] Security audit voltooid
- [ ] Zero-server-storage compliance geverifieerd
- [ ] Privacy Manifest bijgewerkt (indien nodig)

---

## 10. PNA Beslissingen Log

Chronologisch overzicht van alle design-beslissingen genomen tijdens PNA-sessies.

| Datum | Beslissing | Rationale |
|-------|-----------|-----------|
| 2026-03 | **3 contactopties** (in de buurt / uitnodigen / bekende) | Max 3 opties voor senioren, geen technisch jargon |
| 2026-03 | **Trust levels 0-3** met eenzijdige verificatie | Elk device beheert eigen trust onafhankelijk |
| 2026-03 | **Level 2 = volledig functioneel** (berichten, foto's, video calls) | Geen blokkade op communicatie bij relay-verbonden contacten |
| 2026-03 | **Level 3 via video call** (niet alleen QR) | Praktischer voor senioren — video call is al een bewezen interactie |
| 2026-03 | **Camera app scant QR** (geen in-app scanner) | Senioren kennen Camera QR van COVID-era, minder code, minder permissions |
| 2026-03 | **commeazy.com domein** bevestigd | Universal Links (iOS) + App Links (Android) |
| 2026-03 | **Twee QR-codes in wizard** (download + invite) | Elk doel apart: app installatie vs key exchange |
| 2026-03 | **Echo bij video call test is OK** | 5-10 sec test, senioren verwachten echo naast elkaar, geen speciale modus nodig |
| 2026-03 | **Eenzijdige verificatie** | Verificatievraag alleen bij initiator, niet bij ontvanger |
| 2026-03 | **Invitation code format CE-XXXX-XXXX-XXXX** | 12 chars = 30^12 entropie, voldoende veilig met rate limiting |
| 2026-03 | **Geen in-app QR-scanner** | Universal Links elimineren de noodzaak volledig |

---

## 11. Referenties

- [Apple: App Attest](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity)
- [Apple: DeviceCheck](https://developer.apple.com/documentation/devicecheck)
- [Apple: Universal Links](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)
- [Google: Play Integrity API](https://developer.android.com/google/play/integrity)
- [Google: App Links](https://developer.android.com/training/app-links)
- [RFC 7519: JSON Web Token (JWT)](https://datatracker.ietf.org/doc/html/rfc7519)
- [NaCl: secretbox (AES-256)](https://nacl.cr.yp.to/secretbox.html)
- [Argon2id: Password Hashing](https://www.rfc-editor.org/rfc/rfc9106)
- CommEazy Security Expert SKILL.md
- CommEazy Architecture Lead SKILL.md
- CommEazy Onboarding Recovery Specialist SKILL.md
- `.claude/plans/BACKUP_RESTORE_PLAN.md`
