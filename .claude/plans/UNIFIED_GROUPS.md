# Unified Groups — Architectuurplan

> **Status:** Fase 1 voltooid (UI indicators + email reminder)
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
| `phoneNumber` niet leeg | Verplicht veld bij toevoegen | Heeft telefoonnummer |

**Geen `isAppUser` veld nodig** — `trustLevel` vervult deze rol.

---

## 2. UI Implementatie

### 2.1 ContactReachabilityIcons (Fase 1 — VOLTOOID)

Drie vaste icoonposities onder elke contactnaam:

```
Positie 1: 💬 (chatbubble) of ✗ — CommEazy app
Positie 2: ✉️ (mail) of ✗ — E-mailadres
Positie 3: 📞 (phone) of ✗ — Telefoonnummer
```

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

## 4. Gewijzigde Bestanden (Fase 1)

| Bestand | Wijziging |
|---------|-----------|
| `src/components/ContactReachabilityIcons.tsx` | **NIEUW** — Reusable status icons component |
| `src/components/index.ts` | Export toegevoegd |
| `src/screens/contacts/ContactListScreen.tsx` | ContactListItem: reachability icons onder naam |
| `src/screens/contacts/CreateGroupModal.tsx` | Contact picker: reachability icons |
| `src/screens/contacts/ManualAddContactScreen.tsx` | Email reminder modal bij opslaan |
| `src/locales/*.json` (13 bestanden) | `contacts.reachability.*` + `contacts.emailReminder.*` keys |

---

## 5. i18n Keys

### contacts.reachability

| Key | NL | EN |
|-----|----|----|
| `a11ySummary` | App: {{app}}, E-mail: {{email}}, Telefoon: {{phone}} | App: {{app}}, Email: {{email}}, Phone: {{phone}} |
| `available` | beschikbaar | available |
| `unavailable` | niet beschikbaar | not available |

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
| **Eenvoud** | ✅ | Drie vaste iconen — geen uitleg nodig na eerste keer |
| **Consistentie** | ✅ | Zelfde iconen overal (lijst, groepen, zoeken) |
| **Herkenbaarheid** | ✅ | Groen = goed, rood kruis = ontbreekt — universeel patroon |
| **Reminder** | ✅ | Eenvoudige modal met één actie — toevoegen of overslaan |
