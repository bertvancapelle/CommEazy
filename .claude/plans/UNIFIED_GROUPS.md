# Unified Groups — Architectuurplan

> **Status:** Fase 1 voltooid (UI indicators + email reminder + v23: 4-icoon + mobileNumber)
> **Besloten in:** PNA sessie maart 2026
> **Doel:** Eén groepsconcept dat organisatie EN communicatie combineert

---

## 1. Kernbeslissingen

### 1.1 Unified Group Concept

Een "groep" in CommEazy is **zowel** een organisatorische eenheid (categorie) **als** een communicatiegroep. Er is geen verschil tussen "contactgroep" en "chatgroep".

**Consequentie:** De huidige `CreateGroupModal` (contacts) en `GroupListScreen` (group chat) moeten samensmelten tot één unified group flow.

### 1.2 Twee Communicatiekanalen

| Kanaal | Protocol | Versleuteling | Wanneer |
|--------|----------|---------------|---------|
| **Chat** | XMPP (MUC) | E2E (libsodium) | Contact heeft CommEazy |
| **Mail** | IMAP/SMTP | TLS (transport) | Contact heeft e-mailadres |

**Afgevallen:** SMS — iPad heeft geen SMS, WiFi-only devices ook niet. Geen betrouwbaar cross-platform kanaal.

### 1.3 Contact Status Bepaling

| Veld | Hoe bepaald | Betekenis |
|------|-------------|-----------|
| `trustLevel >= 2` | Via key exchange / verification | Heeft CommEazy app |
| `email` niet leeg | Handmatig ingevuld of via contact sync | Heeft e-mailadres |
| `phoneNumber` niet leeg | Handmatig ingevuld | Heeft vast telefoonnummer |
| `mobileNumber` niet leeg | Handmatig ingevuld (v23) | Heeft mobiel nummer |

**Geen `isAppUser` veld nodig** — `trustLevel` vervult deze rol.

**v23 wijziging:** `mobileNumber` is een apart veld naast `phoneNumber` (landline). Beide zijn optioneel, maar minimaal één is verplicht bij toevoegen.

---

## 2. UI Implementatie

### 2.1 ContactReachabilityIcons (Fase 1 — VOLTOOID, v23: 4 iconen)

Vier vaste icoonposities onder elke contactnaam:

```
Positie 1: 💬 (chatbubble) of ✗ — CommEazy app (trustLevel >= 2)
Positie 2: ✉️ (mail) of ✗ — E-mailadres
Positie 3: 📞 (phone-landline) of ✗ — Vast telefoonnummer
Positie 4: 📱 (cellphone) of ✗ — Mobiel nummer
```

**v23 wijziging:** Uitgebreid van 3 naar 4 iconen. Telefoon is opgesplitst in vast (landline) en mobiel. Dit geeft senioren beter inzicht in hoe ze een contact kunnen bereiken.

**Regels:**
- Vaste posities — iconen verschuiven NOOIT
- Groen = beschikbaar, rood (✗) = ontbreekt
- Kleur + vorm (nooit kleur-only) — WCAG AAA
- 16pt iconen, `spacing.sm` (8pt) gap

**Component:** `src/components/ContactReachabilityIcons.tsx`

**Gebruikt in:**
- `ContactListScreen` — ContactListItem
- `CreateGroupModal` — contact picker
- (Toekomst) Zoekresultaten, groepsdetails

### 2.2 Email Reminder Modal (Fase 1 — VOLTOOID)

Bij opslaan van een contact ZONDER e-mailadres verschijnt een `PanelAwareModal`:

```
┌─────────────────────────────────┐
│         ✉️ (40pt icon)          │
│                                 │
│   E-mailadres aanvullen?        │
│                                 │
│   Zonder e-mailadres kan dit    │
│   contact geen groepsberichten  │
│   via e-mail ontvangen.         │
│                                 │
│   E-mailadres                   │
│   ┌───────────────────────┐     │
│   │ jan@voorbeeld.nl      │     │
│   └───────────────────────┘     │
│                                 │
│   [Overslaan]    [Opslaan]      │
└─────────────────────────────────┘
```

**Gedrag:**
- Verschijnt ALLEEN als e-mail leeg is bij opslaan
- "Overslaan" → slaat op zonder e-mail
- "Opslaan" → slaat op MET ingevuld e-mailadres
- Telefoon is al verplicht (validatie) — geen reminder nodig

---

## 3. Toekomstige Fasen

### Fase 2: Send Confirmation Overlay

Bij versturen van een groepsbericht verschijnt een overlay die toont:
- Hoeveel leden via Chat ontvangen
- Hoeveel leden via Mail ontvangen
- Hoeveel leden NIET bereikbaar zijn

```
Bericht verzenden naar "Familie"

  💬 Chat: 4 leden
  ✉️ E-mail: 2 leden
  ⚠️ Niet bereikbaar: 1 lid (Jan — geen app, geen e-mail)

  [Annuleren]    [Verzenden]
```

### Fase 3: Unified Group CRUD

- Samenvoegen van `CreateGroupModal` en group chat creation
- Groep aanmaken vanuit contacten OF vanuit berichten
- Groepsleden bewerken met reachability icons
- Groepsinstellingen: naam, emoji, leden

### Fase 4: Group Message Routing

- Berichten automatisch routeren naar juiste kanaal per lid
- Chat-berichten via XMPP MUC
- Mail-berichten via IMAP/SMTP (bestaande MailModule)
- Ontvangen antwoorden op mail weer tonen in groepschat

### Fase 5: Contact Search met Status Icons

- Zoekresultaten tonen ContactReachabilityIcons
- Filteren op bereikbaarheid (toon alleen chat-bereikbaar, etc.)

---

## 4. Gewijzigde Bestanden (Fase 1 + v23)

| Bestand | Wijziging |
|---------|-----------|
| `src/components/ContactReachabilityIcons.tsx` | **NIEUW** — Reusable status icons, v23: 4 iconen (app/email/landline/mobile) |
| `src/components/Icon.tsx` | v23: `phone-landline` + `cellphone` icons toegevoegd |
| `src/components/index.ts` | Export toegevoegd |
| `src/services/interfaces.ts` | v23: `mobileNumber?: string` toegevoegd aan Contact interface |
| `src/models/Contact.ts` | v23: `@field('mobile_number') mobileNumber` |
| `src/models/schema.ts` | v23: schema version 23, `mobile_number` kolom |
| `src/models/migrations.ts` | v23: migratie v22→v23 |
| `src/screens/contacts/ContactListScreen.tsx` | ContactListItem: 4-icoon reachability, accent chevron |
| `src/screens/contacts/CreateGroupModal.tsx` | Contact picker: 4-icoon reachability |
| `src/screens/contacts/ManualAddContactScreen.tsx` | Email reminder modal + apart mobiel nummer veld |
| `src/screens/contacts/AddContactScreen.tsx` | Chevron fix (chevron-right, accent kleur) |
| `src/services/mock/mockContacts.ts` | v23: trustLevel + mobileNumber mock data |
| `src/locales/*.json` (13 bestanden) | `contacts.reachability.*` + `contacts.emailReminder.*` + `landlineLabel/mobileLabel` keys |

---

## 5. i18n Keys

### contacts.reachability

| Key | NL | EN |
|-----|----|----|
| `a11ySummary` | App: {{app}}, E-mail: {{email}}, Vast: {{landline}}, Mobiel: {{mobile}} | App: {{app}}, Email: {{email}}, Landline: {{landline}}, Mobile: {{mobile}} |
| `available` | beschikbaar | available |
| `unavailable` | niet beschikbaar | not available |

### contacts (v23 — nieuwe velden)

| Key | NL | EN |
|-----|----|----|
| `landlineLabel` | Vast telefoonnummer | Landline number |
| `landlinePlaceholder` | 201234567 | 201234567 |
| `mobileLabel` | Mobiel nummer | Mobile number |
| `mobilePlaceholder` | 612345678 | 612345678 |

### contacts.emailReminder

| Key | NL | EN |
|-----|----|----|
| `title` | E-mailadres aanvullen? | Add email address? |
| `subtitle` | Zonder e-mailadres kan dit contact geen groepsberichten via e-mail ontvangen. | Without an email address, this contact cannot receive group messages via email. |
| `skip` | Overslaan | Skip |
| `save` | Opslaan | Save |

Alle 13 talen zijn bijgewerkt.

---

## 6. Senior-Perspectief Toets

| Criterium | Oordeel | Toelichting |
|-----------|---------|-------------|
| **Eenvoud** | ✅ | Vier vaste iconen — na eerste keer duidelijk (app/mail/vast/mobiel) |
| **Consistentie** | ✅ | Zelfde 4 iconen overal (lijst, groepen, zoeken) |
| **Herkenbaarheid** | ✅ | Groen = goed, rood kruis = ontbreekt — universeel patroon. Telefoon (vast) en mobiel hebben herkenbare, onderscheidbare iconen |
| **Reminder** | ✅ | Eenvoudige modal met één actie — toevoegen of overslaan |
