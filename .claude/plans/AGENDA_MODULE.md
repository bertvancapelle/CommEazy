# Agenda Module — Implementatieplan

> **Status:** Plan goedgekeurd, nog niet geïmplementeerd
> **Module ID:** `agenda`
> **Module naam:** Agenda
> **Prioriteit:** ⏳ TBD
> **Datum:** 2026-03-08

---

## 1. Overzicht

De Agenda module combineert afspraken, herinneringen, contactdatums (verjaardagen, trouwdagen, sterfdagen) en medicijnherinneringen in één chronologische tijdlijn. Geen traditionele kalenderweergave — de module is ontworpen als een eenvoudige, scrollbare tijdlijn met "Vandaag" altijd bovenaan.

### Kernprincipes

- **Tijdlijn, geen kalender-grid** — Chronologisch scrollen is intuïtiever voor senioren dan navigeren door maanden/weken
- **Eén universeel invoerformulier** — Categorie bepaalt welke velden zichtbaar zijn
- **Twee databronnen** — Automatisch uit contacten + handmatig aangemaakt
- **Delen = informeren** — Via chatbericht, geen synchronisatie
- **Niets verwijderen, alleen verbergen** — Verlopen items blijven in database

---

## 2. Module Identiteit

| Eigenschap | Waarde |
|------------|--------|
| **moduleId** | `agenda` |
| **Naam (NL)** | Agenda |
| **Icoon** | `calendar` (te valideren tegen IconName type) |
| **Kleur** | Nog te bepalen (moet uniek zijn t.o.v. bestaande module kleuren) |

---

## 3. Hoofdscherm: Tijdlijn

### 3.1 Layout

```
┌─────────────────────────────────────────────┐
│  📅 Agenda                    [MediaIndicator] │  ← ModuleHeader
├─────────────────────────────────────────────┤
│  [📋 Overzicht]  [🔍 Zoeken]                │  ← Tabs
├─────────────────────────────────────────────┤
│                                              │
│  ── VANDAAG (zo 8 maart) ─────────────────── │
│                                              │
│  💊 09:00  Bloedverdunner         [✓]        │  ← grijs, afgevinkt
│  🏥 11:00  Dokter Van den Berg              │  ← actief of voorbij
│  💊 21:00  Bloedverdunner         [ ]        │  ← actief, nog te doen
│                                              │
│  ── MORGEN (ma 9 maart) ────────────────── │
│                                              │
│  🎂 Verjaardag Oma Jeanine (78)             │
│  💇 14:00  Kapper                            │
│                                              │
│  ── DONDERDAG 10 MAART ──────────────────── │
│                                              │
│  👨‍👩‍👧 18:00  Etentje                          │
│          Peter, Linda, Oma Jeanine           │
│                                              │
│  ── VOLGENDE WEEK ──────────────────────── │
│                                              │
│  🔔 ma 14  Contributie tennisclub verlengen  │
│  🎂 wo 16  Trouwdag Papa & Mama (45 jaar)   │
│                                              │
│  ─────────────────────────────────────────── │
│                                              │
│        [ Afgelopen bekijken ]                │
│                                              │
│        [ + Nieuw item toevoegen ]            │
│                                              │
└─────────────────────────────────────────────┘
```

### 3.2 Gedrag

- **Vandaag altijd bovenaan** — Scroll start bij vandaag
- **Dagkoppen als scheiders** — "Vandaag", "Morgen", dag+datum, "Volgende week"
- **Verlopen items van vandaag** — Grijs + doorgestreept, verdwijnen na middernacht uit tijdlijn
- **Verlopen items van gisteren en eerder** — Verborgen uit tijdlijn, NIET verwijderd uit database
- **"Afgelopen bekijken"** — Discrete knop onderaan, opent omgekeerd chronologische lijst van verlopen items
- **"+ Nieuw item toevoegen"** — Opent categorie-keuze

### 3.3 Visueel onderscheid

- **Icoon per categorie** — Universeel herkenbaar, geen kleurcodes nodig
- **Geen expliciet onderscheid solo/groep** — Contactnamen tonen maakt dit vanzelf duidelijk
- **Geen expliciet onderscheid afspraak/herinnering** — Tijdstip wel/niet tonen is voldoende
- **Medicijn bevestigingscheck** — Inline checkbox icoon ([ ] of [✓])

---

## 4. Databronnen

### 4.1 Twee bronnen, één view

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   Contact Model         │     │   AgendaItem Model      │
│   (WatermelonDB)        │     │   (WatermelonDB)        │
│                         │     │                         │
│   - birthday: Date      │     │   - category: string    │
│   - weddingDate: Date   │     │   - title: string       │
│   - deathDate: Date     │     │   - date: Date          │
│                         │     │   - time?: string       │
│                         │     │   - times?: string[]    │
│                         │     │   - repeat?: RepeatType │
│                         │     │   - endDate?: Date      │
│                         │     │   - reminderOffset: str  │
│                         │     │   - contacts?: [ref]    │
│                         │     │   - medicationLog?: {}  │
│                         │     │   - sharedVia?: string  │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            └───────────┬───────────────────┘
                        ▼
              ┌─────────────────────┐
              │   Agenda Tijdlijn   │
              │   (merged + sorted) │
              └─────────────────────┘
```

### 4.2 Automatisch uit contacten

Contactdatums worden ingevoerd bij het contactprofiel en verschijnen automatisch in de tijdlijn:

| Contactveld | Icoon | Herhaling | Voorbeeld in tijdlijn |
|-------------|-------|-----------|-----------------------|
| `birthday` | 🎂 | Jaarlijks | "🎂 Verjaardag Oma Jeanine (78)" |
| `weddingDate` | 💒 | Jaarlijks | "💒 Trouwdag Papa & Mama (45 jaar)" |
| `deathDate` | 🕯️ | Jaarlijks | "🕯️ Sterfdag Opa Jan" |

**Afhankelijkheid:** Contact model MOET uitgebreid worden met `birthday`, `weddingDate`, `deathDate` velden.

### 4.3 Handmatig aangemaakt

Via "+ Nieuw item toevoegen" → categorie kiezen → formulier invullen.

---

## 5. Categorieën

### 5.1 Categorie-keuze scherm

Bij "+ Nieuw" ziet de senior een voorgedefinieerde lijst met zoekfunctie:

```
┌─────────────────────────────────────────────┐
│  Wat wil je toevoegen?                       │
├─────────────────────────────────────────────┤
│  🔍 [__Zoek...__]                            │
├─────────────────────────────────────────────┤
│                                              │
│  AFSPRAKEN                                   │
│  ┌─────────────────────────────────────────┐ │
│  │ 🏥  Dokter                              │ │
│  │ 🦷  Tandarts                            │ │
│  │ 💇  Kapper                              │ │
│  │ 👁️  Oogarts                             │ │
│  │ 🏦  Bank                                │ │
│  │ 🏛️  Gemeente                            │ │
│  │ 📋  Overige afspraak                    │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  FAMILIE                                     │
│  ┌─────────────────────────────────────────┐ │
│  │ 👨‍👩‍👧  Familie-afspraak                    │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  HERINNERINGEN                               │
│  ┌─────────────────────────────────────────┐ │
│  │ 🔔  Herinnering                         │ │
│  │ 💊  Medicijn                            │ │
│  └─────────────────────────────────────────┘ │
│                                              │
└─────────────────────────────────────────────┘
```

### 5.2 Categorie definities

```typescript
type AgendaCategory =
  | 'doctor'        // 🏥
  | 'dentist'       // 🦷
  | 'hairdresser'   // 💇
  | 'optician'      // 👁️
  | 'bank'          // 🏦
  | 'municipality'  // 🏛️
  | 'other'         // 📋
  | 'family'        // 👨‍👩‍👧
  | 'reminder'      // 🔔
  | 'medication'    // 💊
  // Automatisch uit contacten (niet handmatig aanmaakbaar):
  | 'birthday'      // 🎂
  | 'wedding'       // 💒
  | 'memorial';     // 🕯️
```

---

## 6. Universeel Invoerformulier

### 6.1 Principe

Eén `AgendaItemForm` component. De gekozen categorie bepaalt:
- Welke velden zichtbaar zijn
- Welke labels ze krijgen
- Welke defaults ze hebben

### 6.2 Velden-matrix per categorie

| Veld | 🏥 Dokter | 💇 Kapper | 👨‍👩‍👧 Familie | 🔔 Herinnering | 💊 Medicijn |
|------|-----------|-----------|-------------|----------------|-------------|
| Beschrijving/naam | ✅ | ✅ | ✅ | ✅ | ✅ |
| Datum | ✅ | ✅ | ✅ | ✅ | ✅ (startdatum) |
| Tijdstip | ✅ (enkel) | ✅ (enkel) | ✅ (enkel) | Optioneel | ✅ (meerdere) |
| Contacten koppelen | Optioneel | ❌ | ✅ | ❌ | ❌ |
| Herhaling | ✅ | ✅ | ✅ | ✅ | ✅ |
| Einddatum | Bij herhaling | Bij herhaling | Bij herhaling | Bij herhaling | Bij herhaling |
| Herinnering | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bevestigingscheck | ❌ | ❌ | ❌ | ❌ | ✅ |

### 6.3 Voorbeeld: Medicijn invoer

```
┌─────────────────────────────────────────────┐
│  💊 Nieuw medicijn                           │
├─────────────────────────────────────────────┤
│                                              │
│  Naam                                        │
│  ┌─────────────────────────────────────────┐ │
│  │ Bloedverdunner                          │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  Tijdstip(pen)                               │
│  ┌─────────────────────────────────────────┐ │
│  │ 09:00                          [+ Tijd] │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  Herhaling                                   │
│  ┌─────────────────────────────────────────┐ │
│  │ Elke dag                             ›  │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  Einddatum                                   │
│  ┌─────────────────────────────────────────┐ │
│  │ 21 maart 2026                        ›  │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  Herinner mij                                │
│  ┌─────────────────────────────────────────┐ │
│  │ Op het moment zelf                   ›  │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│         [ Opslaan ]                          │
│                                              │
└─────────────────────────────────────────────┘
```

### 6.4 Herhalingsopties (universeel)

```
┌─────────────────────────────────────────────┐
│  Herhaling                                   │
├─────────────────────────────────────────────┤
│  ○  Geen herhaling                           │
│  ○  Elke dag                                 │
│  ○  Elke week                                │
│  ○  Elke 2 weken                             │
│  ○  Elke maand                               │
│  ○  Elk jaar                                 │
└─────────────────────────────────────────────┘
```

Bij selectie van herhaling verschijnt automatisch het einddatum-veld met optie "Geen einddatum".

### 6.5 Herinneringsopties (per item configureerbaar)

```
┌─────────────────────────────────────────────┐
│  Herinner mij                                │
├─────────────────────────────────────────────┤
│  ○  Op het moment zelf                       │
│  ○  15 minuten van tevoren                   │
│  ○  30 minuten van tevoren                   │
│  ○  1 uur van tevoren                        │
│  ○  1 dag van tevoren                        │
└─────────────────────────────────────────────┘
```

### 6.6 Slimme defaults per categorie

| Categorie | Default herhaling | Default herinnering |
|-----------|-------------------|---------------------|
| 🏥 Dokter | Geen herhaling | 1 uur van tevoren |
| 🦷 Tandarts | Geen herhaling | 1 uur van tevoren |
| 💇 Kapper | Geen herhaling | 1 uur van tevoren |
| 👁️ Oogarts | Geen herhaling | 1 uur van tevoren |
| 🏦 Bank | Geen herhaling | 1 uur van tevoren |
| 🏛️ Gemeente | Geen herhaling | 1 uur van tevoren |
| 📋 Overig | Geen herhaling | 30 min van tevoren |
| 👨‍👩‍👧 Familie-afspraak | Geen herhaling | 1 uur van tevoren |
| 🔔 Herinnering | Geen herhaling | Op het moment zelf |
| 💊 Medicijn | Elke dag | Op het moment zelf |

---

## 7. Detail-scherm (tik op item)

Het detailscherm toont alle informatie over een item en biedt context-afhankelijke acties.

### 7.1 Standaard detail-scherm (alle categorieën)

```
┌──────────────────────────────────┐
│ 🏥 Dokter Van den Berg           │
│                                   │
│ 📅 15 maart 2026                  │
│ 🕐 11:00                          │
│ 🔁 Geen herhaling                 │
│ 🔔 1 uur van tevoren              │
│                                   │
│  [ ✏️ Bewerken ]                   │
│  [ 📤 Delen ]                     │
│  [ 🗑️ Verwijderen ]               │
└──────────────────────────────────┘
```

### 7.2 Medicijn detail-scherm (extra acties)

```
┌──────────────────────────────────┐
│ 💊 Bloedverdunner                 │
│                                   │
│ 📅 Elke dag, 09:00                │
│ ⏳ Tot 21 maart 2026              │
│ 🔔 Op het moment zelf             │
│                                   │
│  [ ✓ Ingenomen ]                  │
│  [ ⏭ Overgeslagen ]               │
│  [ 🔔 Later herinneren ]          │
│                                   │
│  [ ✏️ Bewerken ]                   │
│  [ 📤 Delen ]                     │
│  [ 🗑️ Verwijderen ]               │
└──────────────────────────────────┘
```

### 7.3 Bewerken/verwijderen van herhalende items

Bij bewerken of verwijderen van een herhalend item:

```
┌─────────────────────────────────────┐
│  Wat wil je aanpassen?               │
│                                      │
│  [ Alleen vandaag ]                  │
│  [ Vandaag en alle volgende ]        │
│  [ Annuleren ]                       │
└─────────────────────────────────────┘
```

---

## 8. Zoekfunctionaliteit

### 8.1 Tabs op hoofdscherm

```
[📋 Overzicht]  [🔍 Zoeken]
```

- **Overzicht** — De tijdlijn (default tab)
- **Zoeken** — Zoek in alle agenda-items (toekomst + verleden)

### 8.2 Zoekgedrag

- **Type:** Lokale filter (live filtering bij elke keystroke)
- **Zoekt in:** titel, beschrijving, contactnamen, categorie
- **Component:** `SearchBar` (standaard CommEazy component)
- **Resultaten:** Gesplitst in "Binnenkort" en "Afgelopen"

### 8.3 Zoek-layout

```
🔍 [__dokter__] [🔍]

── BINNENKORT ──────────────────────────
  🏥 15 mrt  Dokter Van den Berg, 11:00
  🏥 12 jun  Dokter Van den Berg, 09:30

── AFGELOPEN ───────────────────────────
  🏥 8 jan   Dokter Van den Berg, 14:00
  🏥 3 nov   Dokter Pietersen, 10:00
```

---

## 9. Delen van agenda-items

### 9.1 Principe

Delen = informeren via XMPP chatbericht. Geen synchronisatie.

### 9.2 Flow

1. Senior tikt op item → detail-scherm
2. Tikt op "Delen"
3. Kiest contact(en) om mee te delen
4. Bevestigingsscherm: "Wil je dit delen met Peter?"
5. E2E encrypted structured message via XMPP

### 9.3 Bij ontvanger

- Chatbericht met structured agenda-item card
- Knop "Toevoegen aan mijn agenda" → lokale kopie
- Geen link tussen origineel en kopie

### 9.4 XMPP Message Format

```json
{
  "type": "agenda_item",
  "category": "doctor",
  "icon": "🏥",
  "title": "Dokter Van den Berg",
  "date": "2026-03-15",
  "time": "11:00",
  "repeat": null,
  "reminderOffset": "1_hour_before"
}
```

### 9.5 Privacy regels

- Medicijn-items mogen NOOIT automatisch gedeeld worden
- Senior MOET altijd expliciet kiezen wat gedeeld wordt
- Bevestigingsscherm is VERPLICHT bij delen

---

## 10. Verlopen Items

### 10.1 Drie lagen

| Laag | Zichtbaarheid | Database |
|------|---------------|----------|
| **Actief** | In tijdlijn | Aanwezig |
| **Verborgen** | Niet in tijdlijn, wel via "Afgelopen bekijken" | Aanwezig |
| **Verwijderd** | Nergens | Verwijderd (alleen door expliciete actie senior) |

### 10.2 Overgangsregels

- Items van vandaag die voorbij zijn → grijs + doorgestreept in tijdlijn
- Na middernacht → automatisch verborgen (verplaatst naar "Afgelopen")
- "Afgelopen bekijken" → omgekeerd chronologische lijst
- Medicijn-bevestigingen (ingenomen/overgeslagen) → permanent bewaard in database

---

## 11. Notificaties

### 11.1 Type

Lokale push notificaties (iOS `UNUserNotificationCenter`, geen server nodig).

### 11.2 Configureerbaar per item

Elke item heeft een `reminderOffset`:
- `at_time` — Op het moment zelf
- `15_min_before` — 15 minuten van tevoren
- `30_min_before` — 30 minuten van tevoren
- `1_hour_before` — 1 uur van tevoren
- `1_day_before` — 1 dag van tevoren

### 11.3 Herhalende items

- Notificaties worden gescheduled voor de komende 30 dagen (iOS limiet: 64 pending notifications)
- Bij app open: reschedule komende 30 dagen
- Background task voor periodieke reschedule

### 11.4 Notificatie content

```
📅 Agenda
🏥 Dokter Van den Berg
Over 1 uur — 11:00

[Bekijken]
```

```
📅 Agenda
💊 Bloedverdunner
Tijd om in te nemen — 09:00

[Ingenomen] [Later herinneren]
```

### 11.5 "Later herinneren"

Bij medicijnen kan de senior "Later herinneren" kiezen:
- Herinnering wordt opnieuw gescheduled voor +15 minuten
- Maximaal 3 keer "Later herinneren" per medicijnmoment

---

## 12. Data Model

### 12.1 AgendaItem (WatermelonDB)

```typescript
interface AgendaItem {
  id: string;                    // WatermelonDB auto-generated
  category: AgendaCategory;      // 'doctor' | 'medication' | etc.
  title: string;                 // "Dokter Van den Berg"
  date: number;                  // Timestamp (startdatum)
  time?: string;                 // "11:00" (null voor hele-dag items)
  times?: string[];              // ["09:00", "21:00"] (medicijn meerdere keren)

  // Herhaling
  repeatType?: RepeatType;       // 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  endDate?: number;              // Timestamp einddatum (null = geen einde)

  // Herinnering
  reminderOffset: ReminderOffset; // 'at_time' | '15_min_before' | etc.

  // Contacten
  contactIds?: string[];         // Referenties naar Contact model

  // Medicatie specifiek
  medicationLog?: MedicationLogEntry[];

  // Delen
  sharedWith?: string[];         // JIDs van ontvangers
  sharedFrom?: string;           // JID van verzender (als ontvangen item)

  // Meta
  createdAt: number;
  updatedAt: number;
}

interface MedicationLogEntry {
  date: string;                  // "2026-03-08"
  time: string;                  // "09:00"
  status: 'taken' | 'skipped' | 'pending';
  confirmedAt?: number;          // Timestamp van bevestiging
}

type RepeatType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

type ReminderOffset = 'at_time' | '15_min_before' | '30_min_before' | '1_hour_before' | '1_day_before';
```

### 12.2 Contact Model uitbreiding

```typescript
// Bestaand Contact model + nieuwe velden:
interface ContactDateFields {
  birthday?: number;        // Timestamp
  weddingDate?: number;     // Timestamp
  deathDate?: number;       // Timestamp
}
```

---

## 13. Componenten Architectuur

### 13.1 Bestanden

```
src/
  screens/
    modules/
      AgendaScreen.tsx              ← Hoofdscherm (tijdlijn + zoeken tabs)
      AgendaItemDetailScreen.tsx    ← Detail/bevestiging scherm
      AgendaItemFormScreen.tsx      ← Aanmaken/bewerken formulier
      AgendaCategoryPickerScreen.tsx ← Categorie keuze bij "+ Nieuw"

  contexts/
    AgendaContext.tsx               ← State management, merged data source

  hooks/
    useAgendaItems.ts              ← WatermelonDB query + contact datums mergen
    useAgendaNotifications.ts      ← Lokale notificatie scheduling
    useAgendaSearch.ts             ← Lokale zoekfunctie

  models/
    AgendaItem.ts                  ← WatermelonDB model

  constants/
    agendaCategories.ts            ← Categorie definities met iconen en defaults
```

### 13.2 Bestaande componenten hergebruik

| Component | Gebruik in Agenda |
|-----------|-------------------|
| `ModuleHeader` | Header met moduleId="agenda" |
| `SearchBar` | Zoek-tab |
| `HapticTouchable` | Alle interactieve items |
| `Icon` | Categorie iconen |

---

## 14. Module Registratie Checklist

Conform CLAUDE.md "Nieuwe Module Validatie Checklist":

| # | Check | Status |
|---|-------|--------|
| 1 | NavigationDestination type — `'agenda'` | ⏳ |
| 2 | ALL_MODULES array | ⏳ |
| 3 | DEFAULT_MODULE_ORDER array | ⏳ |
| 4 | STATIC_MODULE_DEFINITIONS (icon + color) | ⏳ |
| 5 | MODULE_TINT_COLORS | ⏳ |
| 6-18 | i18n keys (13 talen) | ⏳ |
| 19 | Navigation route | ⏳ |
| 20 | Screen component | ⏳ |
| 21 | ModuleColorId type | ⏳ |
| 22 | CUSTOMIZABLE_MODULES array | ⏳ |
| 23 | MODULE_LABELS object | ⏳ |
| 24 | Appearance preview card | ⏳ |

---

## 15. Implementatiefasen

### Fase 1: Data fundament
- WatermelonDB AgendaItem model
- Contact model uitbreiden (birthday, weddingDate, deathDate)
- AgendaContext met merged data source
- Categorie definities

### Fase 2: Hoofdscherm (Tijdlijn)
- AgendaScreen met tijdlijn view
- Dagkoppen, chronologische sortering
- Verlopen items styling (grijs, doorgestreept)
- "Afgelopen bekijken" functie
- ModuleHeader integratie

### Fase 3: Invoer
- Categorie-keuze scherm
- Universeel invoerformulier met conditionale velden
- Herhalingsopties + einddatum
- Herinneringsmoment per item
- Contacten koppelen (familie-afspraken)

### Fase 4: Detail & Acties
- Detail-scherm per item
- Bewerken (met "Alleen vandaag" / "Alle volgende" voor herhalende items)
- Verwijderen (met bevestiging)
- Medicijn bevestiging (Ingenomen / Overgeslagen / Later herinneren)

### Fase 5: Zoekfunctionaliteit
- Tabs (Overzicht / Zoeken)
- SearchBar integratie
- Lokale filter op titel, beschrijving, contactnamen, categorie
- Resultaten gesplitst in "Binnenkort" / "Afgelopen"

### Fase 6: Notificaties
- Lokale push notificatie scheduling
- Herhalende items: rolling 30-dagen scheduling
- "Later herinneren" (medicijn, max 3x)
- Actionable notifications (Ingenomen / Later)

### Fase 7: Delen
- "Delen" actie op detail-scherm
- Contact selectie
- XMPP structured message type
- Ontvanger: chat card met "Toevoegen aan mijn agenda"

### Fase 8: Module registratie & i18n
- Alle 24 registratie-checks (zie sectie 14)
- 13 talen vertalingen
- Module kleur bepalen en registreren
- Welcome modal voor first-time users

---

## 16. Privacy & Security Overwegingen

| Onderwerp | Maatregel |
|-----------|-----------|
| **Medicijndata = gevoelige PII** | Encrypted in WatermelonDB (SQLCipher) |
| **Delen van medicijnen** | NOOIT automatisch, altijd expliciete keuze |
| **Notificatie content** | Geen PII in notificatie body (alleen titel + tijd) |
| **GDPR bijzondere categorie** | Medische data = extra bescherming vereist |
| **Logging** | NOOIT titel/beschrijving loggen, alleen categorie + count |

---

## 17. Accessibility

| Aspect | Implementatie |
|--------|---------------|
| **Touch targets** | Alle items ≥60pt hoogte |
| **Typography** | Body ≥18pt, labels ≥16pt |
| **VoiceOver** | Elk item: categorie + titel + datum + tijd + status |
| **Haptic feedback** | Bij bevestigingsacties (ingenomen, verwijderd, gedeeld) |
| **Reduced motion** | Geen animaties die niet uitgeschakeld kunnen worden |
| **Voice commands** | Lijst navigatie, "volgende", "vorige", "open" |

---

## 18. Afhankelijkheden (extern)

| Afhankelijkheid | Status | Impact |
|-----------------|--------|--------|
| Contact model uitbreiden | Nieuw | birthday, weddingDate, deathDate velden |
| XMPP structured message type | Nieuw | agenda_item type voor delen |
| Lokale notificatie API | Bestaand | react-native-push-notification of Notifee |
| WatermelonDB migration | Nieuw | AgendaItem tabel + Contact tabel uitbreiding |
| WheelNavigationMenu registratie | Bestaand | Nieuwe module toevoegen |

---

## 19. Beslissingen Log

| Vraag | Beslissing | Rationale |
|-------|------------|-----------|
| Kalender-grid of tijdlijn? | **Tijdlijn** | Senioren: scrollbare lijst > grid navigatie |
| Visueel onderscheid types? | **Alleen iconen** | Geen kleurcodes (kleurenblinden), geen labels (rommelig) |
| Solo vs groep markering? | **Nee, contactnamen voldoende** | Impliciet duidelijk door namen |
| Afspraak vs herinnering markering? | **Nee, tijdstip aan/uit voldoende** | Minder visuele codes = minder leercurve |
| Categorie kiezen of auto-detect? | **Voorgedefinieerde lijst** | Auto-detect kan falen, frustreert senioren |
| Medicijn apart formulier? | **Nee, universeel formulier** | Categorie bepaalt zichtbare velden, één component |
| Medicijn bevestiging inline of apart? | **Apart detail-scherm** | Voorkomt per ongeluk tikken, biedt meer opties |
| Herinnering vast of configureerbaar? | **Per item, met slimme defaults** | Dokter ≠ medicijn ≠ verjaardag |
| Delen met synchronisatie? | **Nee, alleen informeren** | Sync is te complex, past niet bij zero-server-storage |
| Verlopen items verwijderen? | **Nee, verbergen** | Senioren willen terugkijken, medicijnhistorie bewaren |
| Herhalend item bewerken? | **"Alleen vandaag" of "Alle volgende"** | Twee opties, begrijpelijk |
| Module naam? | **Agenda** | Universeel begrepen, alle leeftijden, alle talen |
| Zoekfunctie? | **Ja, tab op hoofdscherm** | Lokale filter, zoekt in toekomst + verleden |
