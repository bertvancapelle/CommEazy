# Contact Data Sharing — Architectuurplan

> **Status:** In uitvoering
> **Besloten in:** PNA sessie maart 2026
> **Doel:** Contacten kunnen persoonlijke gegevens met elkaar delen — kerndoel van de app (isolatie doorbreken)

---

## 1. Kernbeslissingen (PNA — 15 beslispunten)

### 1.1 Symmetrisch maar Onafhankelijk Consent

Wanneer Bert Piet uitnodigt, krijgen BEIDE partijen **onafhankelijk** de vraag of ze hun privégegevens willen delen. Geen van beide deelt automatisch.

**Vier mogelijke uitkomsten:**

| Bert deelt | Piet deelt | Resultaat |
|------------|------------|-----------|
| ✅ Ja | ✅ Ja | Volledig wederzijds — beide zien elkaars gegevens |
| ✅ Ja | ❌ Nee | Bert's gegevens bij Piet, Piet's niet bij Bert |
| ❌ Nee | ✅ Ja | Piet's gegevens bij Bert, Bert's niet bij Piet |
| ❌ Nee | ❌ Nee | Alleen basale gegevens (naam + JID + publicKey) |

### 1.2 All-or-Nothing

Eén toggle per contact: deel ALLE privégegevens of NIETS. Geen per-veld granulariteit.

**Waarom:** Senioren (65+) raken verward door 11 individuele toggles. Eén duidelijke keuze is beter.

### 1.3 Deelbare Velden (11 totaal)

| # | Veld | Type | Bron |
|---|------|------|------|
| 1 | `name` (displayName) | string | UserProfile |
| 2 | `email` | string? | UserProfile (nieuw) |
| 3 | `mobileNumber` | string? | UserProfile (nieuw) |
| 4 | `phoneNumber` (landline) | string? | UserProfile (nieuw, apart van verificatie-nummer) |
| 5 | `address.street` | string? | UserProfile (nieuw) |
| 6 | `address.postalCode` | string? | UserProfile (nieuw) |
| 7 | `address.city` | string? | UserProfile (nieuw) |
| 8 | `address.country` | string? | UserProfile (nieuw) |
| 9 | `birthDate` | string? | UserProfile (nieuw) |
| 10 | `weddingDate` | string? | UserProfile (nieuw) |
| 11 | `photoUrl` | string? | UserProfile.photoPath |

### 1.4 NIET Deelbaar

| Veld | Reden |
|------|-------|
| `deathDate` | Metadata van de ontvanger, niet van de zender |
| `jid` | Al uitgewisseld bij basis-uitnodiging |
| `userUuid` | Al uitgewisseld bij basis-uitnodiging |
| `publicKey` | Al uitgewisseld bij basis-uitnodiging |

### 1.5 Basis-uitnodiging (altijd, zonder consent)

Deze 4 velden worden ALTIJD uitgewisseld bij een uitnodiging (al geïmplementeerd):

```typescript
// invitationCrypto.ts — bestaande payload
{ uuid, publicKey, displayName, jid }
```

### 1.6 Consent Moment

| Wie | Wanneer | Waar in UI |
|-----|---------|------------|
| **Uitnodiger** | Bij aanmaken uitnodiging | InviteContactScreen — na code generatie |
| **Ontvanger** | Bij accepteren uitnodiging | AcceptInvitationScreen — na bevestiging |

### 1.7 Auto-Sync bij Wijzigingen

Wanneer een gebruiker een gedeeld veld wijzigt in Profiel → encrypted XMPP stanza naar alle contacten met `consentGiven: true`.

### 1.8 Intrekken (Revocatie)

- Stop sync — data blijft bij ontvanger maar wordt niet meer bijgewerkt
- Ontvanger krijgt notificatie: "Bert deelt geen gegevens meer met je"
- Ontvanger kan bestaande data behouden (niet verwijderd)

### 1.9 Geen Migratie Nodig

Pre-productie: alle nieuwe contacten krijgen `consentGiven: false` als default. Geen bestaande gebruikers om te migreren.

### 1.10 Notificatie Toon: Bemoedigend

Bij uitnodigingsresultaat focus op wat WEL kan:
- ✅ "Piet is toegevoegd! Piet heeft ook zijn gegevens gedeeld."
- ⚠️ "Piet is toegevoegd! Piet deelt zijn gegevens nog niet. Je kunt Piet een bericht sturen om te vragen."

### 1.11 Uitnodigingscode Verlooptijd

7 dagen, intrekbaar door uitnodiger.

---

## 2. Technische Architectuur

### 2.1 Nieuw WatermelonDB Model: SharedDataConsent

```typescript
// src/models/SharedDataConsent.ts
export class SharedDataConsentModel extends Model {
  static table = 'shared_data_consent';

  @field('my_jid') myJid!: string;                    // Mijn JID
  @field('contact_jid') contactJid!: string;           // Contact's JID
  @field('i_share_with_them') iShareWithThem!: boolean; // Ik deel met dit contact
  @field('they_share_with_me') theyShareWithMe!: boolean; // Dit contact deelt met mij
  @field('i_share_since') iShareSince?: number;        // Timestamp sinds ik deel
  @field('they_share_since') theyShareSince?: number;  // Timestamp sinds zij delen
  @field('i_revoked_at') iRevokedAt?: number;          // Timestamp als ik heb ingetrokken
  @field('they_revoked_at') theyRevokedAt?: number;    // Timestamp als zij hebben ingetrokken
  @field('last_sync_sent') lastSyncSent?: number;      // Laatste sync naar contact
  @field('last_sync_received') lastSyncReceived?: number; // Laatste sync van contact
}
```

### 2.2 Schema Wijziging (v24)

**UserProfile tabel — nieuwe kolommen:**

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `email` | string, optional | E-mailadres |
| `mobile_number` | string, optional | Mobiel nummer (apart van verificatie-nummer) |
| `landline_number` | string, optional | Vast telefoonnummer |
| `address_street` | string, optional | Straat + huisnummer |
| `address_postal_code` | string, optional | Postcode |
| `address_city` | string, optional | Stad |
| `address_country` | string, optional | Land |
| `birth_date` | string, optional | Geboortedatum (ISO: YYYY-MM-DD) |
| `wedding_date` | string, optional | Trouwdatum (ISO: YYYY-MM-DD) |

**Nieuwe tabel: `shared_data_consent`:**

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `my_jid` | string, indexed | Mijn JID |
| `contact_jid` | string, indexed | Contact's JID |
| `i_share_with_them` | boolean | Ik deel met dit contact |
| `they_share_with_me` | boolean | Dit contact deelt met mij |
| `i_share_since` | number, optional | Timestamp |
| `they_share_since` | number, optional | Timestamp |
| `i_revoked_at` | number, optional | Timestamp |
| `they_revoked_at` | number, optional | Timestamp |
| `last_sync_sent` | number, optional | Timestamp |
| `last_sync_received` | number, optional | Timestamp |

### 2.3 UserProfile Interface Extensie

```typescript
// Toevoegen aan interfaces.ts — UserProfile
email?: string;
mobileNumber?: string;        // Mobiel nummer (apart van phoneNumber verificatie)
landlineNumber?: string;      // Vast telefoonnummer
address?: ContactAddress;     // Hergebruik bestaande ContactAddress interface
birthDate?: string;           // ISO: YYYY-MM-DD
weddingDate?: string;         // ISO: YYYY-MM-DD
```

### 2.4 Async Consent Flow

```
T0: Bert maakt uitnodiging aan
    → InviteContactScreen toont: "Wil je je gegevens delen met dit contact?"
    → Bert kiest Ja/Nee
    → Code + basisgegevens (uuid, publicKey, displayName, jid) geüpload
    → Bert's consent keuze opgeslagen lokaal

T1: Piet accepteert (kan uren/dagen later zijn)
    → AcceptInvitationScreen toont: "Wil je je gegevens delen met Bert?"
    → Piet kiest Ja/Nee
    → Response geüpload met basis + consent status

T2: Bert ontvangt response (via relay poll)
    → Contact aangemaakt met trust level 2
    → SharedDataConsent record aangemaakt
    → Als Bert "Ja" had gekozen EN Piet is nu verbonden:
      → Bert stuurt encrypted personal data stanza via XMPP
    → Als Piet "Ja" had gekozen:
      → Piet's personal data ontvangen en opgeslagen in Contact

T3: Async personal data exchange
    → Als Piet later alsnog "Ja" kiest: stuurt stanza
    → Als Bert veld wijzigt: stuurt update stanza naar alle consentors
```

### 2.5 XMPP Stanza voor Personal Data Sync

```xml
<!-- Encrypted met E2E — alleen leesbaar door ontvanger -->
<message to="piet@commeazy.local" type="headline">
  <personal-data-update xmlns="commeazy:sharing:1">
    <fields>
      <name>Bert van Capelle</name>
      <email>bert@example.com</email>
      <mobile>+31612345678</mobile>
      <landline>+31201234567</landline>
      <street>Kerkstraat 42</street>
      <postalCode>1012 AB</postalCode>
      <city>Amsterdam</city>
      <country>Nederland</country>
      <birthDate>1958-03-15</birthDate>
      <weddingDate>1982-06-20</weddingDate>
      <photoUrl>base64-encoded-photo</photoUrl>
    </fields>
    <timestamp>1710590400000</timestamp>
  </personal-data-update>
</message>
```

---

## 3. UI Implementatie

### 3.1 Consent Toggle in Invitation Screens

**InviteContactScreen** — Na code generatie, vóór "Deel deze code":

```
┌─────────────────────────────────────┐
│  Uitnodigingscode aangemaakt!       │
│                                     │
│  CE-A1B2-C3D4                       │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 👤  Mijn gegevens delen?      │  │
│  │                               │  │
│  │ Deel je e-mail, telefoon,     │  │
│  │ adres, verjaardag en          │  │
│  │ trouwdatum met dit contact.   │  │
│  │                               │  │
│  │ [═══════════════ ● ] Aan      │  │
│  └───────────────────────────────┘  │
│                                     │
│  [📤 Deel deze code]                │
└─────────────────────────────────────┘
```

**AcceptInvitationScreen** — Na bevestiging van uitnodiger's naam:

```
┌─────────────────────────────────────┐
│  Uitnodiging van Bert               │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 👤  Mijn gegevens delen?      │  │
│  │                               │  │
│  │ Deel je e-mail, telefoon,     │  │
│  │ adres, verjaardag en          │  │
│  │ trouwdatum met Bert.          │  │
│  │                               │  │
│  │ [═══════════════ ● ] Aan      │  │
│  └───────────────────────────────┘  │
│                                     │
│  [✅ Accepteren]                    │
└─────────────────────────────────────┘
```

### 3.2 Profile Screen — Nieuwe Velden

Toevoegen aan ProfileSettingsScreen in een nieuwe sectie "Persoonlijke gegevens":

```
┌─────────────────────────────────────┐
│  Persoonlijke gegevens              │
│  (Alleen zichtbaar voor contacten   │
│   waarmee je deelt)                 │
│                                     │
│  E-mailadres                        │
│  ┌───────────────────────────┐      │
│  │ bert@voorbeeld.nl          │      │
│  └───────────────────────────┘      │
│                                     │
│  Mobiel nummer                      │
│  ┌───────────────────────────┐      │
│  │ +31 6 12345678             │      │
│  └───────────────────────────┘      │
│                                     │
│  Vast telefoonnummer                │
│  ┌───────────────────────────┐      │
│  │ +31 20 1234567             │      │
│  └───────────────────────────┘      │
│                                     │
│  Adres                              │
│  ┌───────────────────────────┐      │
│  │ Kerkstraat 42              │      │
│  │ 1012 AB Amsterdam          │      │
│  │ Nederland                  │      │
│  └───────────────────────────┘      │
│                                     │
│  Geboortedatum                      │
│  ┌───────────────────────────┐      │
│  │ 15 maart 1958              │      │
│  └───────────────────────────┘      │
│                                     │
│  Trouwdatum                         │
│  ┌───────────────────────────┐      │
│  │ 20 juni 1982               │      │
│  └───────────────────────────┘      │
│                                     │
│  Gedeeld met                        │
│  ┌───────────────────────────┐      │
│  │ 👤 Piet — deelt ook ✅     │      │
│  │ 👤 Maria — deelt niet ⚠️   │      │
│  │ 👤 Jan — ingetrokken ❌    │      │
│  └───────────────────────────┘      │
└─────────────────────────────────────┘
```

### 3.3 ContactListScreen — Avatar in Header

Profielfoto rechts in ModuleHeader, vóór MediaIndicator. Alleen op contacten-scherm.

```
┌──────────────────────────────────────────────────┐
│  👥 Contacten                    [📷]  [🔊]      │
│                                  avatar  media    │
└──────────────────────────────────────────────────┘
```

---

## 4. Gewijzigde/Nieuwe Bestanden

### Fase 1: UserProfile Extensie + Profiel UI

| Bestand | Wijziging |
|---------|-----------|
| `src/services/interfaces.ts` | UserProfile + 9 nieuwe velden |
| `src/models/UserProfile.ts` | @field decorators + updatePersonalData writer |
| `src/models/schema.ts` | v24: user_profile nieuwe kolommen |
| `src/models/migrations.ts` | v23→v24 migratie |
| `src/screens/settings/ProfileSettingsScreen.tsx` | Nieuwe "Persoonlijke gegevens" sectie |
| `src/locales/*.json` (13 bestanden) | profile.personal.* keys |

### Fase 2: SharedDataConsent Model + Avatar

| Bestand | Wijziging |
|---------|-----------|
| `src/models/SharedDataConsent.ts` | **NIEUW** — WatermelonDB model |
| `src/models/schema.ts` | v25: shared_data_consent tabel |
| `src/models/migrations.ts` | v24→v25 migratie |
| `src/models/index.ts` | Export + modelClasses |
| `src/components/ModuleHeader.tsx` | rightAccessory prop voor avatar |
| `src/screens/contacts/ContactListScreen.tsx` | Avatar in header |
| `src/services/mock/mockContacts.ts` | Rename 'Ik' → 'Ik (iPhone fysiek)' |

### Fase 3: Consent UI in Uitnodiging (toekomstig)

| Bestand | Wijziging |
|---------|-----------|
| `src/screens/contacts/InviteContactScreen.tsx` | Consent toggle |
| `src/screens/contacts/AcceptInvitationScreen.tsx` | Consent toggle |
| `src/screens/onboarding/InvitationCodeScreen.tsx` | Consent toggle |
| `src/locales/*.json` (13 bestanden) | sharing.consent.* keys |

### Fase 4: Auto-Sync + Gedeeld Met (toekomstig)

| Bestand | Wijziging |
|---------|-----------|
| `src/services/xmpp.ts` | Personal data stanza handler |
| `src/screens/settings/ProfileSettingsScreen.tsx` | "Gedeeld met" overzicht |
| `src/locales/*.json` (13 bestanden) | sharing.status.* keys |

---

## 5. i18n Keys

### profile.personal

| Key | NL | EN |
|-----|----|----|
| `sectionTitle` | Persoonlijke gegevens | Personal information |
| `sectionSubtitle` | Alleen zichtbaar voor contacten waarmee je deelt | Only visible to contacts you share with |
| `emailLabel` | E-mailadres | Email address |
| `emailPlaceholder` | jan@voorbeeld.nl | john@example.com |
| `mobileLabel` | Mobiel nummer | Mobile number |
| `mobilePlaceholder` | 06 12345678 | 612345678 |
| `landlineLabel` | Vast telefoonnummer | Landline number |
| `landlinePlaceholder` | 020 1234567 | 201234567 |
| `streetLabel` | Straat en huisnummer | Street and number |
| `streetPlaceholder` | Kerkstraat 42 | Main Street 42 |
| `postalCodeLabel` | Postcode | Postal code |
| `postalCodePlaceholder` | 1012 AB | 10001 |
| `cityLabel` | Stad | City |
| `cityPlaceholder` | Amsterdam | New York |
| `countryLabel` | Land | Country |
| `countryPlaceholder` | Nederland | Netherlands |
| `birthDateLabel` | Geboortedatum | Date of birth |
| `weddingDateLabel` | Trouwdatum | Wedding date |
| `sharedWith` | Gedeeld met | Shared with |

### sharing.consent

| Key | NL | EN |
|-----|----|----|
| `title` | Mijn gegevens delen? | Share my information? |
| `description` | Deel je e-mail, telefoon, adres, verjaardag en trouwdatum met dit contact. | Share your email, phone, address, birthday and wedding date with this contact. |
| `descriptionNamed` | Deel je e-mail, telefoon, adres, verjaardag en trouwdatum met {{name}}. | Share your email, phone, address, birthday and wedding date with {{name}}. |
| `toggleOn` | Aan | On |
| `toggleOff` | Uit | Off |

### sharing.status

| Key | NL | EN |
|-----|----|----|
| `bothSharing` | deelt ook | also shares |
| `theyDontShare` | deelt niet | doesn't share |
| `revoked` | ingetrokken | revoked |
| `contactCount` | {{count}} contacten | {{count}} contacts |

Alle 13 talen worden bijgewerkt.

---

## 6. Senior-Perspectief Toets

| Criterium | Oordeel | Toelichting |
|-----------|---------|-------------|
| **Eenvoud** | ✅ | Eén toggle: Ja of Nee. Geen 11 checkboxes |
| **Consistentie** | ✅ | Zelfde toggle bij uitnodigen EN accepteren |
| **Herkenbaarheid** | ✅ | Toggle is iOS standaard patroon |
| **Begrijpelijk** | ✅ | "Deel je gegevens" — niet "consent management" |
| **Omkeerbaar** | ✅ | Kan altijd later aan/uit zetten |
| **Bemoedigend** | ✅ | Focus op wat WEL kan, niet op wat NIET kan |
