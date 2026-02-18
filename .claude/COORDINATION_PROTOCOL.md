# Coördinatie Protocol — CommEazy Skills

## Doel

Dit protocol zorgt ervoor dat **elke wijziging** wordt gevalideerd tegen de uitgangspunten van alle relevante skills **voordat** de wijziging wordt doorgevoerd.

## Verplichte Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                     GEBRUIKER VRAAGT IETS                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 1: CLASSIFICATIE                                          │
│  Bepaal het type wijziging (zie CHANGE_VALIDATION_MATRIX.md)    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 2: SKILL IDENTIFICATIE                                    │
│  Welke skills moeten deze wijziging valideren?                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 3: VALIDATIE                                              │
│  Controleer de wijziging tegen elke relevante skill:            │
│  - Lees de SKILL.md van elke betrokken skill                    │
│  - Check tegen alle regels en checklists                        │
│  - Documenteer eventuele conflicten                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 4: RAPPORTAGE                                             │
│  Toon validatie-resultaat aan gebruiker:                        │
│  ✅ skill-naam: "Voldoet aan regel X"                           │
│  ⚠️ skill-naam: "Let op: regel Y vereist aanpassing"            │
│  ❌ skill-naam: "Conflict met regel Z"                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 5: UITVOERING                                             │
│  Alleen uitvoeren als alle validaties slagen                    │
│  Bij conflicten: vraag gebruiker om beslissing                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 5b: TEST VALIDATIE (VERPLICHT bij nieuwe code!)           │
│  Na implementatie MOET testing-qa valideren:                    │
│  - Zijn unit tests geschreven?                                  │
│  - Zijn integration tests geschreven (indien van toepassing)?   │
│  - Is test coverage ≥80%?                                       │
│  - Is logging toegevoegd met correcte levels?                   │
│  Bij "Nee": ⚠️ Waarschuwing — documenteer technische schuld     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 6: SKILL STANDAARDISATIE CHECK (VERPLICHT!)               │
│  Na elke nieuwe functionaliteit MOET de Coordinator vragen:     │
│  "Moet deze functionaliteit worden toegevoegd aan skills        │
│   voor standaardisatie en herbruikbaarheid?"                    │
│  → Zo ja: update relevante SKILL.md bestanden                   │
│  → Zo ja: update CLAUDE.md indien nodig                         │
└─────────────────────────────────────────────────────────────────┘
```

## Validatie Checklist Template

Bij elke wijziging moet deze checklist worden doorlopen:

```markdown
## Validatie voor: [beschrijving wijziging]

### Betrokken Skills
- [ ] ui-designer
- [ ] accessibility-specialist
- [ ] security-expert
- [ ] (andere relevante skills)

### Validatie Resultaten

#### ui-designer
- [ ] Labels BOVEN en BUITEN de rand van invoervelden
- [ ] Labels vet (fontWeight: '700'), geen hoofdletters
- [ ] Touch targets ≥ 60pt
- [ ] Contrast ≥ 7:1 (AAA)
- [ ] Haptic feedback aanwezig
- [ ] Max 3 stappen per flow

#### accessibility-specialist
- [ ] VoiceOver labels aanwezig
- [ ] TalkBack content descriptions
- [ ] Dynamic Type ondersteund
- [ ] Kleur niet als enige indicator

#### security-expert
- [ ] Geen PII in logs
- [ ] Encryptie waar nodig
- [ ] Keys niet zichtbaar

#### react-native-expert
- [ ] Cross-platform compatibel
- [ ] Performance acceptabel
- [ ] Geen memory leaks

### Conclusie
- [ ] ✅ Alle validaties geslaagd — mag worden uitgevoerd
- [ ] ⚠️ Waarschuwingen — bespreken met gebruiker
- [ ] ❌ Blokkerende conflicten — niet uitvoeren
```

## Automatische Triggers

De volgende wijzigingen triggeren **altijd** specifieke skill validaties:

| Wijziging bevat... | Verplichte validatie door |
|-------------------|---------------------------|
| UI componenten, styling | ui-designer, accessibility-specialist |
| Formuliervelden, inputs | ui-designer, accessibility-specialist |
| Lijsten met >3 items | ui-designer, accessibility-specialist, react-native-expert |
| Voice control, spraak | accessibility-specialist, react-native-expert |
| Encryptie, keys, tokens | security-expert |
| Database, storage | architecture-lead, security-expert |
| XMPP, messaging | xmpp-specialist, security-expert |
| Navigatie | architecture-lead, ui-designer |
| i18n, vertalingen | ui-designer, documentation-writer |
| Native modules | ios-specialist OF android-specialist |
| Tests | testing-qa |
| CI/CD, deployment | devops-specialist |
| Onboarding flow | onboarding-recovery-specialist, ui-designer |
| Performance | performance-optimizer |
| **Nieuwe module/feature** | **testing-qa, architecture-lead** |
| **API integratie** | **testing-qa (mock tests), performance-optimizer** |
| **Logging toevoegingen** | **security-expert (PII check)** |

## Conflict Resolutie

Als skills conflicterende eisen hebben:

1. **Security wint altijd** — Veiligheid gaat voor usability
2. **Accessibility tweede** — Toegankelijkheid is niet onderhandelbaar
3. **Senior-inclusive design derde** — Core doelgroep
4. **Performance vierde** — Belangrijk maar niet ten koste van bovenstaande
5. **Store compliance** — Moet altijd voldoen (Apple/Google)

## Voorbeeld Validatie

**Vraag:** "Voeg een nieuw invoerveld toe voor geboortedatum"

**Validatie:**

```
## Validatie voor: Geboortedatum invoerveld toevoegen

### Betrokken Skills
- [x] ui-designer
- [x] accessibility-specialist
- [x] security-expert (PII data)

### Validatie Resultaten

#### ui-designer ✅
- [x] Label "Geboortedatum" BOVEN het veld, BUITEN de rand
- [x] Label vet, geen hoofdletters
- [x] Touch target ≥ 60pt (date picker)
- [x] Placeholder tekst via i18n

#### accessibility-specialist ✅
- [x] accessibilityLabel aanwezig
- [x] accessibilityHint voor uitleg
- [x] Date picker ondersteunt VoiceOver

#### security-expert ⚠️
- [x] Geboortedatum is PII — niet loggen
- [ ] WAARSCHUWING: Overweeg of geboortedatum echt nodig is
- [x] Wordt lokaal opgeslagen, niet naar server

### Conclusie
⚠️ Waarschuwing van security-expert: bevestig noodzaak geboortedatum
```

## Rebuild Indicatie (VERPLICHT)

Na elke wijziging moet de agent aangeven of een rebuild nodig is:

### Geen rebuild nodig (Hot Reload werkt)
- TypeScript/JavaScript bestanden (`.ts`, `.tsx`, `.js`, `.jsx`)
- JSON bestanden (locale files, config)
- Styling wijzigingen in JS

**Mededeling:** "Geen rebuild nodig — Hot Reload pikt wijzigingen automatisch op."

### Rebuild nodig (Cmd+R / `npx react-native run-ios`)
- Native code (`.m`, `.mm`, `.swift`, `.h`, `.java`, `.kt`)
- Podfile of package.json dependencies
- Info.plist / AndroidManifest.xml
- Native module toevoegingen/wijzigingen
- Xcode project settings

**Mededeling:** "⚠️ Rebuild nodig — Druk Cmd+R in de simulator of run `npx react-native run-ios`"

### Metro herstart nodig
- Nieuwe npm packages geïnstalleerd
- Metro cache problemen (rode error schermen die niet verdwijnen)
- Wijzigingen in metro.config.js of babel.config.js

**Mededeling:** "⚠️ Metro herstart nodig — Stop Metro (Ctrl+C) en run `npm start -- --reset-cache`"

## Skill Standaardisatie Check (VERPLICHT!)

**De Coordinator MOET dit ALTIJD valideren na elke nieuwe functionaliteit!**

### Wanneer triggert deze check?
- Nieuwe UI patterns of componenten
- Nieuwe gedragslogica (zoals multi-match voice navigatie)
- Nieuwe accessibility features
- Nieuwe cross-cutting concerns
- Alles wat potentieel herbruikbaar is in andere delen van de app

### Vragen die de Coordinator MOET stellen:
1. "Is dit pattern herbruikbaar in andere schermen/modules?"
2. "Moet dit gedocumenteerd worden in een SKILL.md?"
3. "Moet dit als design principle in CLAUDE.md?"
4. "Kan dit generiek gemaakt worden voor standaardisatie?"

### Actie bij "Ja":
- Update relevante SKILL.md met nieuwe regels/patterns
- Update CLAUDE.md sectie "UI Architectural Principles" indien van toepassing
- Documenteer met code voorbeelden
- Voeg toe aan Automatische Triggers tabel indien nodig

### Voorbeeld:
```
Nieuwe functionaliteit: Multi-match voice navigatie
→ Coordinator vraagt: "Moet dit worden gestandaardiseerd?"
→ Antwoord: Ja, dit is generiek voor alle lijsten met voice control
→ Actie: Toegevoegd aan CLAUDE.md sectie 11.6
```

## Continue Verbetering & Retrospectief (VERPLICHT!)

### Bij Afronden van Elke Ontwikkelstap

Na het afronden van een significante ontwikkelstap (component, feature, module) MOET de Coordinator een **mini-retrospectief** uitvoeren:

```
┌─────────────────────────────────────────────────────────────────┐
│  RETROSPECTIEF VRAGEN (na elke ontwikkelstap)                   │
│                                                                 │
│  1. Wat ging goed? Welke patterns waren effectief?              │
│  2. Wat ging minder? Waar liepen we tegen problemen aan?        │
│  3. Welke tools/patterns ontbraken die het proces hadden        │
│     kunnen versnellen?                                          │
│  4. Zijn er aanbevelingen voor de skills die het verdere        │
│     ontwikkelproces optimaliseren?                              │
│  5. Moeten bestaande skills worden aangevuld/verbeterd?         │
└─────────────────────────────────────────────────────────────────┘
```

### Bij Afronden van een Module

Bij het afronden van een complete module (Radio, Podcast, E-book, etc.) is een **uitgebreide analyse** verplicht:

```markdown
## Module Retrospectief: [Module Naam]

### Wat ging goed
- [Lijst van effectieve patterns/aanpakken]

### Wat kan beter
- [Lijst van verbeterpunten]

### Aanbevelingen voor Skills
| Skill | Aanbeveling | Prioriteit |
|-------|-------------|------------|
| testing-qa | Parallelle test requirements toevoegen | Hoog |
| react-native-expert | Type consistency regel toevoegen | Medium |

### Ontbrekende Tools/Patterns
- [Lijst van tools/patterns die hadden moeten bestaan]

### Technische Schuld
- [Lijst van items die nog moeten worden opgepakt]
```

### Doel van Continue Verbetering

Het doel is dat de skills **levende documenten** zijn die continu verbeteren op basis van praktijkervaring. Na elke module:
- Worden de skills effectiever
- Worden veelvoorkomende problemen voorkomen
- Wordt het ontwikkelproces sneller en betrouwbaarder

## Recursieve Implementatie van Skill Wijzigingen (VERPLICHT!)

### Principe

Wanneer een skill wordt bijgewerkt met een nieuw pattern of regel, MOET dit pattern **recursief worden toegepast op alle bestaande modules** die onder die skill vallen.

### Workflow bij Skill Wijziging

```
┌─────────────────────────────────────────────────────────────────┐
│  STAP 1: Skill Update                                           │
│  Voeg nieuwe regel/pattern toe aan SKILL.md                     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 2: Impact Analyse                                         │
│  Identificeer ALLE bestaande code die onder deze skill valt     │
│  → Welke schermen/componenten moeten worden aangepast?          │
│  → Welke modules voldoen nog niet aan de nieuwe regel?          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 3: Implementatie Plan                                     │
│  Maak een todo-lijst van alle benodigde aanpassingen            │
│  Prioriteer op basis van:                                       │
│  - Impact op gebruikers (senior-inclusive eerst!)               │
│  - Complexiteit van de wijziging                                │
│  - Afhankelijkheden tussen modules                              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 4: Recursieve Implementatie                               │
│  Pas de wijziging toe op ALLE geïdentificeerde locaties         │
│  → Niet alleen nieuwe code, ook bestaande code!                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 5: Validatie                                              │
│  Controleer dat ALLE modules voldoen aan de nieuwe regel        │
│  → Build test                                                   │
│  → Visuele inspectie waar nodig                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Voorbeeld: Module Header Styling Update

```
Skill wijziging (ui-designer):
  "Module headers MOETEN een gekleurde achtergrond hebben met
   een icoon dat overeenkomt met de WheelNavigationMenu kleuren"

Impact analyse:
  - RadioScreen: Header aanwezig, kleur matcht ✅
  - ContactListScreen: Geen module header ❌
  - ChatListScreen: Geen module header ❌
  - SettingsMainScreen: Header zonder kleur ❌
  - (alle andere module schermen...)

Implementatie plan:
  1. [Hoog] ContactListScreen - module header toevoegen
  2. [Hoog] ChatListScreen - module header toevoegen
  3. [Medium] SettingsMainScreen - kleur toevoegen
  4. ...

Recursieve implementatie:
  → Alle schermen worden aangepast
  → Consistentie door hele app gegarandeerd
```

### Wanneer is Recursieve Implementatie Verplicht?

| Type Skill Wijziging | Recursief? | Voorbeeld |
|---------------------|------------|-----------|
| Nieuwe UI styling regel | **JA** | Module headers met gekleurde achtergrond |
| Nieuwe accessibility vereiste | **JA** | Haptic feedback op alle buttons |
| Nieuwe voice control pattern | **JA** | VoiceFocusable op alle lijsten >3 items |
| Bug fix in bestaand pattern | **JA** | Race condition fix in useEffect |
| Nieuwe optionele feature | Nee | Optionele animatie toevoegen |
| Performance optimalisatie | Situatieafhankelijk | FlatList tuning |

### Documentatie van Recursieve Updates

Bij elke recursieve update MOET worden gedocumenteerd:

```markdown
## Recursieve Update: [Skill Wijziging Naam]

**Datum:** YYYY-MM-DD
**Skill:** [skill naam]
**Wijziging:** [beschrijving van de nieuwe regel]

### Aangepaste Bestanden
| Bestand | Wijziging | Status |
|---------|-----------|--------|
| RadioScreen.tsx | Header styling | ✅ |
| ContactListScreen.tsx | Module header toegevoegd | ✅ |
| ChatListScreen.tsx | Module header toegevoegd | ✅ |

### Niet Aangepast (met reden)
| Bestand | Reden |
|---------|-------|
| OnboardingScreen.tsx | Geen module scherm |
```

## Handhaving

Dit protocol is **VERPLICHT**. Bij elke wijziging:

1. Toon de validatie-resultaten aan de gebruiker
2. Bij ❌ blokkeerders: NIET uitvoeren zonder expliciete goedkeuring
3. Bij ⚠️ waarschuwingen: vermelden en bespreken
4. Update relevante skill-documenten als nieuwe regels nodig zijn
5. **Geef ALTIJD aan of rebuild/herstart nodig is**
6. **ALTIJD Skill Standaardisatie Check uitvoeren na nieuwe functionaliteit!**
7. **ALTIJD Mini-Retrospectief uitvoeren na afronden van ontwikkelstap!**
8. **ALTIJD Uitgebreide Analyse uitvoeren na afronden van module!**
9. **Bij skill wijzigingen: ALTIJD recursieve implementatie op bestaande code!**

### Prioriteit van Recursieve Updates

Wanneer een skill wordt aangepast:

1. **Kritiek (onmiddellijk):** Security fixes, accessibility blokkeerders
2. **Hoog (binnen 1 dag):** UI consistentie, voice control patterns
3. **Medium (binnen 1 week):** Performance optimalisaties, code style
4. **Laag (bij volgende touch):** Documentatie, comments
