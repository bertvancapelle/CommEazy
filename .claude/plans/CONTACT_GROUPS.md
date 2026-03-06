# Contact Groups — Implementatieplan

> **Status:** Plan geschreven, wacht op implementatie
> **Datum:** 2026-03-06
> **PNA sessies:** 6 design decisions + MAX_RECIPIENTS beslissing afgerond

## Samenvatting

Toevoegen van **Contact Groepen** aan de Contacten module: handmatige groepen + 5 slimme automatische secties, gepresenteerd als horizontale scrollable chip-bar (ChipSelector-patroon), met bulk acties per groep.

**Inclusief:** Verwijdering van de `MAX_RECIPIENTS = 8` UI-limiet uit de gehele codebase. De encryptie-laag schakelt automatisch en transparant om tussen `encrypt-to-all` (≤8 ontvangers) en `shared-key` (>8 ontvangers). De senior merkt hier niets van.

---

## Design Decisions (PNA Sessies)

| # | Beslissing | Keuze |
|---|-----------|-------|
| 1 | Type groepen | Handmatige groepen + slimme automatische secties (combinatie) |
| 2 | Groepsacties | Bulk acties: foto sturen, groepsbericht, groeps-mail, groepsgesprek |
| 3 | Groepsgrootte & ontvangerlimiet | **Onbeperkt.** Geen zichtbare limiet voor de gebruiker. Encryptie schakelt transparant om: ≤8 → encrypt-to-all, >8 → shared-key. Senior hoeft hier NOOIT over na te denken. |
| 4 | Slimme secties | Alle 5: ⚠️ ICE, 🎂 Verjaardagen (14d), 📞 Vaak gebeld (top 5), 🕐 Lang niet gesproken (>30d), 🆕 Recent toegevoegd (30d) |
| 5 | UI layout | Horizontale scrollable chip-bar (zoals Radio/Podcast ChipSelector) |
| 6 | Visuele onderscheiding | Gescheiden secties — visuele divider/spacing tussen slimme en handmatige chips, [➕] aan het einde |

---

## Fase 0: MAX_RECIPIENTS Limiet Verwijderen (Prerequisite)

> **Kernprincipe:** Senioren hoeven NOOIT na te denken over technische beperkingen.
> De encryptie-laag (`encryption.ts`) en database-laag (`Group.ts`) schakelen al automatisch
> om tussen encrypt-to-all en shared-key. Alleen de UI-laag blokkeert momenteel onnodig.

### Wat verandert

| Bestand | Huidige situatie | Wijziging |
|---------|-----------------|-----------|
| `src/components/PhotoRecipientModal.tsx` | `MAX_RECIPIENTS = 8` blokkeert selectie van 9e contact | Verwijder limiet: onbeperkte selectie |
| `src/components/PhotoRecipientModal.tsx` | Teller "5 van 8 geselecteerd" | Wijzig naar "5 geselecteerd" (zonder maximum) |
| `src/components/PhotoRecipientModal.tsx` | `isDisabled` state bij ≥8 geselecteerd | Verwijder disabled state volledig |
| `src/screens/modules/PhotoAlbumScreen.tsx` | Lokale duplicate `const MAX_RECIPIENTS = 8` | Verwijder constante (ongebruikt na modal fix) |
| `src/components/index.ts` | Export `PHOTO_MAX_RECIPIENTS` | Verwijder export |

### Wat NIET verandert (werkt al correct)

| Bestand | Waarom niet aanpassen |
|---------|----------------------|
| `src/services/encryption.ts` | `ENCRYPTION_THRESHOLD = 8` blijft — dit is de interne drempel voor encrypt mode selectie. Werkt automatisch en transparant. |
| `src/models/Group.ts` | `encryptionMode` berekening blijft — schakelt automatisch bij member count change. |
| `src/services/groupChat.ts` | Mode selectie blijft — correct gedrag, geen UI impact. |
| `src/config/index.ts` | `groupThreshold: 8` config blijft — interne referentie. |
| `src/components/mail/RecipientInput.tsx` | `maxRecipients = 50` voor e-mail — apart systeem, behoudt eigen limiet. |

### Concrete Code Wijzigingen

#### PhotoRecipientModal.tsx

```typescript
// VERWIJDEREN:
export const MAX_RECIPIENTS = 8;

// WIJZIGEN — selectie logica (regel ~97):
// OUD:
} else if (newSet.size < MAX_RECIPIENTS) {
  newSet.add(contact.jid);
}
// NIEUW:
} else {
  newSet.add(contact.jid);
}

// WIJZIGEN — disabled state (regel ~178):
// OUD:
const isDisabled = !isSelected && selectedContacts.size >= MAX_RECIPIENTS;
// NIEUW:
// Verwijder deze regel volledig — alle contacten zijn altijd selecteerbaar

// WIJZIGEN — teller display (regel ~145-148):
// OUD:
{t('modules.photoAlbum.recipientCount', '{{selected}} of {{max}} selected', {
  selected: selectedContacts.size,
  max: MAX_RECIPIENTS,
})}
// NIEUW:
{t('modules.photoAlbum.recipientCount', '{{count}} selected', {
  count: selectedContacts.size,
})}
```

#### PhotoAlbumScreen.tsx

```typescript
// VERWIJDEREN (regel 72-73):
// Maximum recipients for photo sharing (dual-path encryption limit)
const MAX_RECIPIENTS = 8;
```

#### components/index.ts

```typescript
// WIJZIGEN (regel 145):
// OUD:
export { PhotoRecipientModal, MAX_RECIPIENTS as PHOTO_MAX_RECIPIENTS } from './PhotoRecipientModal';
// NIEUW:
export { PhotoRecipientModal } from './PhotoRecipientModal';
```

### i18n Wijzigingen (Fase 0)

De `recipientCount` key moet worden aangepast in alle 13 locale bestanden:

| Taal | Oude waarde | Nieuwe waarde |
|------|------------|---------------|
| nl | "{{selected}} van {{max}} geselecteerd" | "{{count}} geselecteerd" |
| en | "{{selected}} of {{max}} selected" | "{{count}} selected" |
| en-GB | "{{selected}} of {{max}} selected" | "{{count}} selected" |
| de | "{{selected}} von {{max}} ausgewählt" | "{{count}} ausgewählt" |
| fr | "{{selected}} sur {{max}} sélectionné(s)" | "{{count}} sélectionné(s)" |
| es | "{{selected}} de {{max}} seleccionado(s)" | "{{count}} seleccionado(s)" |
| it | "{{selected}} di {{max}} selezionato/i" | "{{count}} selezionato/i" |
| no | "{{selected}} av {{max}} valgt" | "{{count}} valgt" |
| sv | "{{selected}} av {{max}} valda" | "{{count}} valda" |
| da | "{{selected}} af {{max}} valgt" | "{{count}} valgt" |
| pt | "{{selected}} de {{max}} selecionado(s)" | "{{count}} selecionado(s)" |
| pt-BR | "{{selected}} de {{max}} selecionado(s)" | "{{count}} selecionado(s)" |
| pl | "{{selected}} z {{max}} wybranych" | "{{count}} wybranych" |

### Tests Aanpassen

De encryption tests in `__tests__/services/encryption.test.ts` hoeven NIET te wijzigen — die valideren correct dat de threshold werkt. De UI tests (indien aanwezig) voor PhotoRecipientModal moeten worden aangepast om de verwijderde limiet te reflecteren.

---

## Architectuur

### Data Model

#### ContactGroup (AsyncStorage)

```typescript
interface ContactGroup {
  /** Uniek groep ID (UUID v4) */
  id: string;
  /** Gebruiker-gedefinieerde groepsnaam */
  name: string;
  /** Emoji icoon (optioneel, door gebruiker gekozen) */
  emoji?: string;
  /** JID's van contacten in deze groep */
  contactJids: string[];
  /** Timestamp wanneer groep is aangemaakt */
  createdAt: number;
  /** Timestamp wanneer groep laatst is gewijzigd */
  updatedAt: number;
}
```

**AsyncStorage key:** `@commeazy/contactGroups`

**Patroon:** Identiek aan `albumService.ts` — JSON array met `readGroups()` / `writeGroups()` helpers.

#### Contact Model Uitbreiding (WatermelonDB)

```typescript
// Nieuw veld in Contact.ts:
@field('is_emergency_contact') isEmergencyContact!: boolean;
```

Dit veld wordt gebruikt voor de ⚠️ ICE (In Case of Emergency) smart sectie.

**Migratie:** WatermelonDB schema migratie nodig (`addColumns` met `is_emergency_contact` boolean, default `false`).

### Slimme Secties Logica

| Sectie | Chip Label | Emoji | Filter Logica | Data Bron |
|--------|-----------|-------|---------------|-----------|
| **ICE** | Noodcontact | ⚠️ | `contact.isEmergencyContact === true` | WatermelonDB veld |
| **Verjaardagen** | Verjaardagen | 🎂 | `birthDate` binnen komende 14 dagen | Contact.birthDate (ISO) |
| **Vaak gebeld** | Vaak gebeld | 📞 | Top 5 meest gebelde contacten | CallLog (AsyncStorage teller) |
| **Lang niet gesproken** | Lang niet gesproken | 🕐 | `lastSeen` > 30 dagen geleden | Contact.lastSeen |
| **Recent toegevoegd** | Recent | 🆕 | `createdAt` binnen laatste 30 dagen | Contact.createdAt |

**"Vaak gebeld" data:** Nieuw AsyncStorage key `@commeazy/callFrequency` — een `Record<string, number>` (JID → call count). Wordt geïncrementeerd bij elke uitgaande oproep.

### Service Laag

```
src/
  services/
    contacts/
      contactGroupService.ts    ← CRUD voor contact groepen (AsyncStorage)
      smartSections.ts          ← Logica voor 5 slimme secties
  hooks/
    useContactGroups.ts         ← React hook voor groepen state
```

#### contactGroupService.ts

Volgt exact het `albumService.ts` patroon:

```typescript
// Core CRUD
export async function getGroups(): Promise<ContactGroup[]>;
export async function getGroupById(id: string): Promise<ContactGroup | undefined>;
export async function createGroup(name: string, emoji?: string, jids?: string[]): Promise<ContactGroup>;
export async function renameGroup(id: string, name: string): Promise<boolean>;
export async function deleteGroup(id: string): Promise<boolean>;
export async function updateGroupEmoji(id: string, emoji: string): Promise<boolean>;

// Contact management
export async function addContactsToGroup(groupId: string, jids: string[]): Promise<boolean>;
export async function removeContactsFromGroup(groupId: string, jids: string[]): Promise<boolean>;
export async function removeContactFromAllGroups(jid: string): Promise<void>;
```

#### smartSections.ts

```typescript
export type SmartSectionId = 'ice' | 'birthdays' | 'frequentCalls' | 'longNoContact' | 'recentlyAdded';

export interface SmartSection {
  id: SmartSectionId;
  emoji: string;
  labelKey: string;  // i18n key
  contacts: Contact[];
}

export function getSmartSections(contacts: Contact[], callFrequency: Record<string, number>): SmartSection[];
export function getIceContacts(contacts: Contact[]): Contact[];
export function getUpcomingBirthdays(contacts: Contact[], daysAhead?: number): Contact[];
export function getFrequentCalls(contacts: Contact[], callFrequency: Record<string, number>, limit?: number): Contact[];
export function getLongNoContact(contacts: Contact[], daysThreshold?: number): Contact[];
export function getRecentlyAdded(contacts: Contact[], daysThreshold?: number): Contact[];
```

#### useContactGroups.ts

```typescript
interface UseContactGroupsReturn {
  groups: ContactGroup[];
  isLoading: boolean;
  reload: () => Promise<void>;
  create: (name: string, emoji?: string, jids?: string[]) => Promise<ContactGroup | undefined>;
  rename: (groupId: string, name: string) => Promise<boolean>;
  remove: (groupId: string) => Promise<boolean>;
  updateEmoji: (groupId: string, emoji: string) => Promise<boolean>;
  addContacts: (groupId: string, jids: string[]) => Promise<boolean>;
  removeContacts: (groupId: string, jids: string[]) => Promise<boolean>;
}
```

---

## UI Design

### ContactListScreen Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ModuleHeader: 👥 Contacten                                   │
├──────────────────────────────────────────────────────────────┤
│  Chip Bar (horizontaal scrollable):                           │
│                                                               │
│  [👥 Alle] [⚠️ ICE] [🎂 Verjaardagen] [📞 Vaak] │ [🏠 Familie] [➕] │
│  ↑ Slimme secties (automatisch)      ↑ Divider  ↑ Handmatig  │
├──────────────────────────────────────────────────────────────┤
│  🔍 [__Zoek contacten...__]                                  │
├──────────────────────────────────────────────────────────────┤
│  Alfabetische contactlijst (gefilterd op geselecteerde chip)  │
│                                                               │
│  A                                                            │
│  [Avatar] Anja de Vries                                    >  │
│  [Avatar] Anton Bakker                                     >  │
│                                                               │
│  B                                                            │
│  [Avatar] Bert van Capelle                                 >  │
│  ...                                                          │
├──────────────────────────────────────────────────────────────┤
│  [Groepsacties bar — alleen zichtbaar bij groep/smart sectie] │
│  [📸 Foto] [💬 Bericht] [📧 Mail] [📞 Bellen]                │
└──────────────────────────────────────────────────────────────┘
```

### Chip Bar Details

**Structuur (links → rechts):**

1. **"Alle"** chip — Standaard geselecteerd, toont alle contacten (geen filter)
2. **Slimme secties** — Alleen zichtbaar als ze contacten bevatten (lege secties verborgen)
3. **Visuele divider** — Dunne verticale lijn (`|`) of extra spacing (12pt)
4. **Handmatige groepen** — Door gebruiker aangemaakte groepen
5. **[➕] knop** — Aan het einde, opent "Nieuwe groep" flow

**Chip Styling:**
- Geselecteerde chip: `backgroundColor: accentColor.primary`, witte tekst
- Niet-geselecteerde chip: `backgroundColor: colors.surface`, `borderColor: colors.border`
- Touch target: 60pt minimum hoogte
- Typography: 18pt (senior-inclusive)
- Emoji prefix op elke chip

**Gedrag:**
- Chip selectie filtert de contactlijst eronder
- "Alle" = geen filter (standaard)
- Slimme sectie chip = toont alleen contacten die aan criteria voldoen
- Groep chip = toont alleen contacten in die groep

### Groepsacties Bar

Zichtbaar wanneer een groep of slimme sectie is geselecteerd (NIET bij "Alle").

| Actie | Icoon | Gedrag | Limiet |
|-------|-------|--------|--------|
| **Foto** | `image` | Open PhotoRecipientModal met groepsleden voorgeselecteerd | **Onbeperkt** — encryptie schakelt transparant om |
| **Bericht** | `chat` | Open ChatScreen met groepsleden | **Onbeperkt** — encryptie schakelt transparant om |
| **Mail** | `mail` | Open MailComposeScreen met groepsleden als ontvangers | Onbeperkt (eigen mail limiet: 50) |
| **Bellen** | `phone` | Open CallScreen (1-op-1 selectie uit groep) | 1 tegelijk |

**Geen limiet feedback nodig:** De senior selecteert gewoon wie de foto's of berichten moeten ontvangen. De app regelt de rest. Geen tellers, geen waarschuwingen, geen "maximaal X personen" teksten.

**Bij Bellen:** Toon contactlijst van groep om 1 persoon te kiezen (CommEazy ondersteunt alleen 1-op-1 gesprekken).

### Contact Detail Screen Wijzigingen

**Nieuw:** "Toevoegen aan groep" actie
- Toon lijst van bestaande groepen met checkmarks
- Optie om nieuwe groep te maken
- Vergelijkbaar met "Add to album" flow in PhotoAlbumScreen

**Nieuw:** ICE toggle
- Toggle switch bij contactgegevens: "Noodcontact (ICE)"
- Wanneer actief: contact verschijnt in ⚠️ ICE slimme sectie

**Verplaatst:** "Verwijder contact" knop
- Verplaats naar onderaan het scherm (verder van veelgebruikte acties)
- Rode kleur, met bevestigingsdialoog (al aanwezig)

### Groep Maken Flow

1. Tap op [➕] chip aan einde van chip-bar
2. **Stap 1:** Groepsnaam invoeren (TextInput modal, zoals album creation)
3. **Stap 2:** Optioneel emoji kiezen (grid van veelgebruikte emoji's)
4. **Stap 3:** Contacten selecteren (multi-select lijst met checkmarks)
5. Groep wordt aangemaakt en geselecteerd in chip-bar

**Alternatief:** Via long-press op groep chip → opties: Hernoemen, Emoji wijzigen, Leden beheren, Verwijderen

---

## Gefaseerde Implementatie

### Fase 0: MAX_RECIPIENTS UI-limiet Verwijderen (Prerequisite)

> **Dit is de eerste stap.** Zonder deze wijziging kunnen de groepsacties in latere fases niet
> correct werken met groepen >8 leden.

**Bestanden:**
- `src/components/PhotoRecipientModal.tsx` — Verwijder `MAX_RECIPIENTS`, wijzig selectie logica
- `src/screens/modules/PhotoAlbumScreen.tsx` — Verwijder lokale `MAX_RECIPIENTS` constante
- `src/components/index.ts` — Verwijder `PHOTO_MAX_RECIPIENTS` export
- 13× `src/locales/*.json` — Wijzig `recipientCount` key (verwijder `{{max}}`)

**Taken:**
1. Verwijder `export const MAX_RECIPIENTS = 8` uit `PhotoRecipientModal.tsx`
2. Wijzig selectie logica: verwijder `newSet.size < MAX_RECIPIENTS` guard
3. Verwijder `isDisabled` state voor contacten bij ≥8
4. Wijzig teller: "X geselecteerd" i.p.v. "X van 8 geselecteerd"
5. Verwijder lokale `const MAX_RECIPIENTS = 8` uit `PhotoAlbumScreen.tsx`
6. Verwijder `PHOTO_MAX_RECIPIENTS` export uit `components/index.ts`
7. Update `recipientCount` i18n key in alle 13 locale bestanden

### Fase 1: Data Laag

**Bestanden:**
- `src/services/contacts/contactGroupService.ts` — CRUD service (nieuw)
- `src/services/contacts/smartSections.ts` — Smart section filters (nieuw)
- `src/services/contacts/index.ts` — Export module (nieuw)
- `src/hooks/useContactGroups.ts` — React hook (nieuw)
- `src/hooks/index.ts` — Export bijwerken
- `src/models/Contact.ts` — `isEmergencyContact` veld toevoegen
- `src/models/schema.ts` — WatermelonDB schema migratie

**Taken:**
1. WatermelonDB migratie: `isEmergencyContact` boolean veld
2. `contactGroupService.ts`: Complete CRUD (volg albumService pattern)
3. `smartSections.ts`: 5 filter functies
4. `useContactGroups.ts`: Hook met reload pattern
5. Call frequency tracker: AsyncStorage `@commeazy/callFrequency`
6. Export updates in `hooks/index.ts` en nieuw `services/contacts/index.ts`

### Fase 2: Chip Bar UI

**Bestanden:**
- `src/components/ContactGroupChipBar.tsx` — Nieuwe component (nieuw)
- `src/screens/contacts/ContactListScreen.tsx` — Integratie chip bar

**Taken:**
1. `ContactGroupChipBar` component:
   - Horizontaal scrollable (ScrollView)
   - "Alle" chip (standaard geselecteerd)
   - Slimme sectie chips (verborgen als leeg)
   - Visuele divider
   - Handmatige groep chips
   - [➕] create knop aan einde
   - 60pt touch targets, 18pt typography
   - Haptic feedback bij selectie
2. Integratie in ContactListScreen:
   - State: `selectedChipId: string | null` (null = "Alle")
   - Filter logica: contacts gefilterd op geselecteerde chip
   - Chip bar tussen ModuleHeader en SearchBar

### Fase 3: Groepsacties Bar

**Bestanden:**
- `src/components/ContactGroupActionsBar.tsx` — Nieuwe component (nieuw)
- `src/screens/contacts/ContactListScreen.tsx` — Integratie actie bar

**Taken:**
1. `ContactGroupActionsBar` component:
   - 4 actie knoppen: Foto, Bericht, Mail, Bellen
   - Sticky onderaan scherm (boven tab bar)
   - Alleen zichtbaar bij groep/smart sectie selectie
   - **Geen limiet feedback** — alle groepsleden worden voorgeselecteerd, ongeacht groepsgrootte
2. Actie handlers:
   - Foto: PhotoRecipientModal met groepsleden voorgeselecteerd (onbeperkt)
   - Bericht: Navigatie naar ChatScreen (onbeperkt, encryptie auto-switch)
   - Mail: Navigatie naar MailComposeScreen (eigen limiet: 50)
   - Bellen: Contact selectie modal → CallScreen (1-op-1)

### Fase 4: Groep CRUD UI

**Bestanden:**
- `src/screens/contacts/ContactListScreen.tsx` — Create/edit modals
- `src/screens/contacts/ContactDetailScreen.tsx` — "Toevoegen aan groep" + ICE toggle

**Taken:**
1. **Groep aanmaken modal:**
   - Naam invoer (TextInput)
   - Emoji selectie (grid)
   - Contact selectie (multi-select checkmarks)
2. **Groep beheren (long-press op chip):**
   - Hernoemen
   - Emoji wijzigen
   - Leden toevoegen/verwijderen
   - Groep verwijderen (met bevestiging)
3. **ContactDetailScreen:**
   - ICE toggle (isEmergencyContact)
   - "Toevoegen aan groep" knop
   - Verplaats "Verwijder" naar onderaan
4. **Referentiële integriteit:**
   - Bij contact verwijderen → `removeContactFromAllGroups(jid)`

### Fase 5: i18n & Accessibility

**Bestanden:**
- 13 locale bestanden (`src/locales/*.json`)

**Nieuwe i18n keys:**

```json
{
  "contacts": {
    "groups": {
      "all": "Alle",
      "createGroup": "Nieuwe groep",
      "groupName": "Groepsnaam",
      "groupNamePlaceholder": "bijv. Familie, Vrienden...",
      "chooseEmoji": "Kies een icoon",
      "selectContacts": "Selecteer contacten",
      "renameGroup": "Hernoemen",
      "deleteGroup": "Groep verwijderen",
      "deleteGroupConfirm": "Weet je zeker dat je de groep '{{name}}' wilt verwijderen? De contacten blijven behouden.",
      "manageMembers": "Leden beheren",
      "changeEmoji": "Icoon wijzigen",
      "addToGroup": "Toevoegen aan groep",
      "removeFromGroup": "Verwijderen uit groep",
      "memberCount": "{{count}} leden",
      "noGroupsYet": "Nog geen groepen",
      "noGroupsHint": "Maak een groep om contacten te organiseren",
      "groupActions": {
        "sendPhoto": "Foto sturen",
        "sendMessage": "Groepsbericht",
        "sendMail": "Groepsmail",
        "callMember": "Bel iemand"
      }
    },
    "smartSections": {
      "ice": "Noodcontact",
      "iceToggle": "Noodcontact (ICE)",
      "iceToggleHint": "Markeer als noodcontact voor snelle toegang",
      "birthdays": "Verjaardagen",
      "birthdayIn": "Verjaardag over {{days}} dagen",
      "birthdayToday": "Jarig vandaag! 🎉",
      "birthdayTomorrow": "Morgen jarig",
      "frequentCalls": "Vaak gebeld",
      "longNoContact": "Lang niet gesproken",
      "longNoContactDays": "{{days}} dagen geleden",
      "recentlyAdded": "Recent toegevoegd",
      "recentlyAddedDays": "{{days}} dagen geleden toegevoegd"
    }
  }
}
```

**Gewijzigde i18n key (Fase 0):**

```json
{
  "modules": {
    "photoAlbum": {
      "recipientCount": "{{count}} geselecteerd"
    }
  }
}
```

> **Let op:** De oude key `"{{selected}} van {{max}} geselecteerd"` wordt vervangen.
> De parameter naam verandert van `selected` naar `count` voor consistentie met andere tellers in de app.

**Accessibility:**
- Alle chips: `accessibilityRole="button"`, `accessibilityState={{ selected }}`
- Groepsacties: `accessibilityLabel` met groepsnaam context
- ICE toggle: `accessibilityRole="switch"`, `accessibilityState={{ checked }}`
- VoiceFocusable op groep chips (>3 groepen)

---

## Bestaande Bestanden Impact

| Bestand | Wijziging |
|---------|-----------|
| `src/components/PhotoRecipientModal.tsx` | Verwijder `MAX_RECIPIENTS`, wijzig selectie logica + teller |
| `src/components/index.ts` | Verwijder `PHOTO_MAX_RECIPIENTS` export |
| `src/screens/modules/PhotoAlbumScreen.tsx` | Verwijder lokale `MAX_RECIPIENTS` constante |
| `src/models/Contact.ts` | + `isEmergencyContact` veld |
| `src/models/schema.ts` | + Schema migratie voor nieuw veld |
| `src/screens/contacts/ContactListScreen.tsx` | + Chip bar, filter logica, groepsacties bar |
| `src/screens/contacts/ContactDetailScreen.tsx` | + ICE toggle, "Toevoegen aan groep", verplaats delete |
| `src/hooks/index.ts` | + `useContactGroups` export |
| `src/services/interfaces.ts` | + `isEmergencyContact` op Contact type |
| 13× `src/locales/*.json` | + `contacts.groups.*`, `contacts.smartSections.*` keys; wijzig `recipientCount` key |

## Nieuwe Bestanden

| Bestand | Doel |
|---------|------|
| `src/services/contacts/contactGroupService.ts` | AsyncStorage CRUD voor groepen |
| `src/services/contacts/smartSections.ts` | Filter logica voor 5 slimme secties |
| `src/services/contacts/index.ts` | Service exports |
| `src/hooks/useContactGroups.ts` | React hook voor groepen state |
| `src/components/ContactGroupChipBar.tsx` | Horizontale chip-bar component |
| `src/components/ContactGroupActionsBar.tsx` | Bulk actie knoppen bar |

---

## Skill Validatie Vereisten

| Skill | Validatie |
|-------|-----------|
| **ui-designer** | Touch targets ≥60pt, typography ≥18pt, chip styling, actie bar layout |
| **accessibility-specialist** | VoiceFocusable chips, ICE toggle a11y, groepsacties labels |
| **architecture-lead** | AsyncStorage patroon, WatermelonDB migratie, referentiële integriteit |
| **security-expert** | Valideer dat transparante encryptie auto-switch correct werkt bij >8 ontvangers |
| **react-native-expert** | ScrollView performance, state management, mock mode compatibility |
| **ios-specialist** | WatermelonDB migratie op bestaande databases |

---

## Risico's & Aandachtspunten

1. **WatermelonDB migratie** — Bestaande databases moeten migreren zonder dataverlies. Test op fysiek device met bestaande data.
2. **"Vaak gebeld" data** — CallLog tracker moet worden geïntegreerd in bestaande call flow. Geen data bij eerste gebruik (cold start).
3. **Performance bij grote groepen** — `encryptSharedKey()` met bijv. 30 ontvangers doet 30 key-wrapping operaties. Benchmark op iPhone SE (worst case device). Verwachte performance: ~1-2 seconden voor 30 ontvangers met 1MB foto — acceptabel.
4. **Performance** — Smart section berekeningen moeten gecached worden (niet bij elke render). `useMemo` met contacten als dependency.
5. **Mock mode** — Alle features moeten werken in mock mode. Smart sections tonen mock data.
6. **Encryptie auto-switch transparantie** — Verify dat gebruiker GEEN verschil merkt tussen encrypt-to-all en shared-key modus. Geen UI indicatoren, geen snelheidsverschil merkbaar voor senior.
