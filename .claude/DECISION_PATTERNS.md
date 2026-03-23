# Decision Patterns — CommEazy

> **Doel:** Vastleggen van bewezen ontwerpbeslissingen zodat ze bij toekomstige wijzigingen
> direct hergebruikt kunnen worden. Voorkomt dat dezelfde afwegingen elke sessie opnieuw
> worden gemaakt.
>
> **Geïnspireerd door:** Ruflo's SONA/ReasoningBank — zelflerend patroongeheugen.

---

## Hoe te Gebruiken

1. **Vóór implementatie:** Doorzoek dit document op patronen die overeenkomen met de huidige wijziging
2. **Bij match:** Pas het patroon toe — tenzij de contra-indicatie van toepassing is
3. **Bij nieuw patroon:** Voeg het toe aan dit document na succesvolle implementatie
4. **Bij conflict:** CHANGE_VALIDATION_MATRIX.md en CLAUDE.md hebben altijd voorrang

---

## Patroon Format

```markdown
### Patroon: [Naam]
- **Context:** Wanneer dit patroon van toepassing is
- **Beslissing:** Wat we doen
- **Reden:** Waarom dit de beste keuze is
- **Senior-toets:** Eenvoud / Consistentie / Herkenbaarheid beoordeling
- **Sessies:** Waar dit patroon is toegepast of besproken
- **Contra-indicatie:** Wanneer dit patroon NIET van toepassing is
```

---

## UX Patronen

### Patroon: Modal vs Inline Search

- **Context:** Zoekfunctionaliteit toevoegen aan een module
- **Beslissing:** Discovery (externe API) → PanelAwareModal; Lokale filter (bestaande data) → inline op hoofdscherm
- **Reden:** Senioren verwachten directe feedback bij lokale data. Discovery is een gefocuste actie die het hoofdscherm rustig houdt.
- **Senior-toets:** ✅ Eenvoud (twee duidelijke modi), ✅ Consistentie (zelfde patroon in Radio/Podcast/Books), ✅ Herkenbaarheid (tabs zijn herkenbaar)
- **Sessies:** RadioScreen, PodcastScreen, BooksScreen, WeatherScreen, ContactListScreen
- **Contra-indicatie:** Lokale filter mag NOOIT in een modal (BLOKKEERDER — zie CLAUDE.md sectie 15.1)

### Patroon: Labels Boven en Buiten het Veld

- **Context:** Formuliervelden toevoegen of wijzigen
- **Beslissing:** Label BOVEN het veld, BUITEN de border. Nooit inline in het bordered element.
- **Reden:** Meer tap-ruimte op het interactieve element. Duidelijke visuele scheiding tussen label en waarde.
- **Senior-toets:** ✅ Eenvoud (label en veld zijn visueel gescheiden), ✅ Consistentie (alle formulieren in de app), ✅ Herkenbaarheid (standaard iOS/Android patroon)
- **Sessies:** ProfileSettingsScreen, ContactDetailScreen, ManualAddContactScreen, AgendaItemFormScreen
- **Contra-indicatie:** Geen — dit is een absolute regel voor alle formulieren.

### Patroon: Form Header Action Bar (Cancel/Save in Header)

- **Context:** Formulierscherm waar gebruiker data invoert en moet opslaan
- **Beslissing:** Cancel en Save knoppen in de ModuleHeader, NIET onderaan het scherm
- **Reden:** Save-knop onderaan een ScrollView scrolt off-screen — senioren vinden deze niet terug. Header is ALTIJD zichtbaar.
- **Senior-toets:** ✅ Eenvoud (twee knoppen, altijd zichtbaar), ✅ Consistentie (iOS platform conventie), ✅ Herkenbaarheid (zelfde als Contacten/Agenda/Notities apps)
- **Sessies:** AgendaItemFormScreen, ManualAddContactScreen, ProfileSettingsScreen
- **Contra-indicatie:** Settings schermen (auto-save per veld), Chat (live send)

### Patroon: Unified Player Components

- **Context:** Audio playback toevoegen aan een module
- **Beslissing:** Gebruik UnifiedMiniPlayer + UnifiedFullPlayer met configureerbare props. Niet-gebruikte controls volledig verborgen (niet greyed-out).
- **Reden:** Eén component met varianten is eenvoudiger te onderhouden en garandeert visuele consistentie. Verborgen controls zijn minder verwarrend dan disabled controls.
- **Senior-toets:** ✅ Eenvoud (minder visuele ruis), ✅ Consistentie (alle modules zien er hetzelfde uit), ✅ Herkenbaarheid (play/pause altijd op zelfde plek)
- **Sessies:** RadioScreen, PodcastScreen, BooksScreen, AppleMusicScreen
- **Contra-indicatie:** Geen — alle audio modules MOETEN deze componenten gebruiken.

### Patroon: Welcome Modal bij Eerste Gebruik

- **Context:** Nieuwe module die voor het eerst geopend wordt
- **Beslissing:** Toon een welcome modal met genummerde stappen (1, 2, 3...) en één "Begrepen" knop. Bewaar in AsyncStorage.
- **Reden:** Senioren hebben vaak begeleiding nodig bij nieuwe functionaliteit. Genummerde stappen zijn duidelijker dan doorlopende tekst.
- **Senior-toets:** ✅ Eenvoud (korte stappen), ✅ Consistentie (elke module heeft hetzelfde patroon), ✅ Herkenbaarheid (modal verdwijnt na eerste keer)
- **Sessies:** RadioScreen, PodcastScreen, MailScreen
- **Contra-indicatie:** Modules die al een onboarding flow hebben als onderdeel van de app-setup.

---

## Architectuur Patronen

### Patroon: Schema + Migratie als Onscheidbaar Paar

- **Context:** Database schema wijziging (kolom toevoegen/wijzigen)
- **Beslissing:** `schema.ts` en `migrations.ts` MOETEN ALTIJD SAMEN worden gewijzigd in dezelfde commit. Versienummers moeten matchen.
- **Reden:** WatermelonDB kan niet upgraden als migratie ontbreekt → database corrupt → data verlies.
- **Senior-toets:** N.v.t. (technisch patroon, niet zichtbaar voor gebruiker)
- **Sessies:** Contact email veld (v22), mobile number veld (v23), profile version (v26) — 3x fout gegaan zonder migratie
- **Contra-indicatie:** Geen — dit is een absolute BLOKKEERDER.

### Patroon: 100% Feature Parity (RN ↔ Native)

- **Context:** Player feature wijzigen of toevoegen
- **Beslissing:** React Native player en native Liquid Glass player MOETEN identieke functionaliteit hebben. Wijzigingen in DEZELFDE commit.
- **Reden:** Gebruiker mag geen verschil merken tussen iOS <26 en iOS 26+.
- **Senior-toets:** ✅ Consistentie (zelfde ervaring ongeacht iOS versie)
- **Sessies:** Glass Player implementatie, sleep timer, buffering indicator, listen duration
- **Contra-indicatie:** Puur visuele aanpassingen die iOS 26 Liquid Glass-specifiek zijn (bijv. UIGlassEffect tint).

### Patroon: Module Color Single Source of Truth

- **Context:** Module kleur gebruiken in UI elementen
- **Beslissing:** ALTIJD via `useModuleColor(moduleId)` hook, NOOIT hardcoded hex waarden.
- **Reden:** Gebruikers kunnen module kleuren aanpassen in Instellingen. Hardcoded kleuren negeren deze instelling.
- **Senior-toets:** ✅ Consistentie (kleur is overal hetzelfde), ✅ Herkenbaarheid (gebruiker herkent "hun" kleuren)
- **Sessies:** RadioScreen, PodcastScreen, alle module headers, Glass Player tintColorHex
- **Contra-indicatie:** Theme-level kleuren (textPrimary, background, etc.) komen uit ThemeContext, niet ModuleColorsContext.

---

## Security Patronen

### Patroon: Eenzijdige Trust Verificatie

- **Context:** Contact verificatie en trust level management
- **Beslissing:** Elk device beheert eigen trust levels onafhankelijk. Eenzijdige verificatie is voldoende — beide partijen hoeven niet tegelijk te verifiëren.
- **Reden:** Praktischer voor senioren. Vermijdt gesynchroniseerde multi-device handshakes.
- **Senior-toets:** ✅ Eenvoud (één persoon hoeft maar één actie te doen)
- **Sessies:** Trust & Attestation Plan discussie
- **Contra-indicatie:** Key exchange bij eerste contact (WEL wederzijds via invitation relay).

### Patroon: Camera App voor QR Scanning

- **Context:** QR-code scanning voor contact verificatie of app download
- **Beslissing:** Gebruik de systeem Camera app voor QR scanning, NIET een in-app scanner.
- **Reden:** Senioren kennen Camera QR van de COVID-era. Minder code, minder camera permissions.
- **Senior-toets:** ✅ Herkenbaarheid (al geleerd tijdens COVID), ✅ Eenvoud (geen nieuwe interface)
- **Sessies:** Trust & Attestation Plan discussie
- **Contra-indicatie:** Scenario's waar realtime QR-data verwerking nodig is binnen de app.

---

## Coördinatie Patronen

### Patroon: PNA voor Tier 3 Wijzigingen

- **Context:** Cross-cutting wijziging die meerdere modules, skills of architectuurkeuzes raakt
- **Beslissing:** Automatisch PNA-achtig overlegmoment inlassen, OOK als gebruiker niet "PNA" heeft getypt.
- **Reden:** Tier 3 wijzigingen hebben te veel impact om zonder overleg door te voeren.
- **Senior-toets:** N.v.t. (proces-patroon, niet UX)
- **Sessies:** Modal refactoring, Liquid Glass implementatie, Unified Player architectuur
- **Contra-indicatie:** Tier 1 (triviale fix) en Tier 2 (standaard feature) wijzigingen.

### Patroon: Gelaagde Routing (Model C)

- **Context:** Nieuwe wijziging classificeren en bepalen welke skills moeten valideren
- **Beslissing:** CHANGE_VALIDATION_MATRIX is primaire router → bij onvolledige match: escaleer naar Skill Domein → domein stelt gebruiker verduidelijkende vraag.
- **Reden:** Matrix behoudt alle bestaande kennis. Domeinen vangen alleen onbekende situaties op. Gebruiker is safety valve.
- **Senior-toets:** N.v.t. (intern coördinatie-patroon)
- **Sessies:** Ruflo-patronen PNA discussie (2026-03-23)
- **Contra-indicatie:** Wanneer de matrix een volledige match heeft — dan direct uitvoeren, geen domein-escalatie nodig.

---

## Hoe een Nieuw Patroon Toevoegen

1. **Na succesvolle implementatie** — patroon is bewezen in de praktijk
2. **Na PNA-conclusie** — beslissing is expliciet goedgekeurd door gebruiker
3. **Na herhaalde toepassing** — patroon is minstens 2x gebruikt in verschillende contexten

**Template:**
```markdown
### Patroon: [Beschrijvende Naam]
- **Context:** [Wanneer dit van toepassing is]
- **Beslissing:** [Wat we doen]
- **Reden:** [Waarom]
- **Senior-toets:** [Eenvoud / Consistentie / Herkenbaarheid]
- **Sessies:** [Waar toegepast]
- **Contra-indicatie:** [Wanneer NIET toepassen]
```

**Regels:**
- Elk patroon MOET een contra-indicatie hebben (geen patroon is universeel)
- Senior-toets is verplicht voor UX-patronen, optioneel voor technische patronen
- Patronen die conflicteren met CLAUDE.md of CHANGE_VALIDATION_MATRIX.md worden NIET opgenomen
