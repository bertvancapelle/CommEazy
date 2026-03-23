# Skill Domains — CommEazy (Model C: Gelaagde Routing)

> **Doel:** Escalatielaag voor wijzigingen die de CHANGE_VALIDATION_MATRIX niet volledig
> kan classificeren. Domeinen bepalen NIET zelf — ze stellen de gebruiker een gerichte
> vraag zodat de juiste sub-skills geactiveerd worden.
>
> **Geïnspireerd door:** Ruflo's hiërarchische skill-coördinatie, aangepast naar
> CommEazy's Model C (Matrix primary → Domein escalatie → Gebruiker beslist).

---

## Routing Flow

```
Wijziging binnenkomst
        │
        ▼
┌─────────────────────────────┐
│  CHANGE_VALIDATION_MATRIX   │  ← PRIMAIRE ROUTER (ongewijzigd)
│  Beschrijving-gebaseerd     │
│  + File-Pattern Hooks       │
└──────────┬──────────────────┘
           │
     Match gevonden?
           │
    ┌──────┴──────┐
    │ JA          │ NEE / ONVOLLEDIG
    ▼             ▼
 Direct        ┌──────────────────────┐
 valideren     │  SKILL DOMAINS       │  ← ESCALATIE LAAG
 (bestaand     │  Domein-lead kiest   │
  gedrag)      │  verduidelijkingsvraag│
               └──────────┬───────────┘
                          │
                          ▼
               ┌──────────────────────┐
               │  GEBRUIKER           │  ← SAFETY VALVE
               │  Beantwoordt vraag   │
               │  → Sub-skills worden │
               │    geactiveerd       │
               └──────────────────────┘
```

---

## Wanneer wordt een Domein Geactiveerd?

**ALLEEN** wanneer de CHANGE_VALIDATION_MATRIX **geen volledige match** heeft:

| Situatie | Voorbeeld | Matrix resultaat | Domein actie |
|----------|-----------|-----------------|--------------|
| Bekende wijziging | Nieuw formulierveld | ✅ Volledige match | Geen domein nodig |
| Gemengde wijziging | Feature raakt UI + protocol | ⚠️ Gedeeltelijke match | UX Domein + Protocol Domein vragen stellen |
| Onbekende wijziging | Nieuw type integratie | ❌ Geen match | Meest relevant domein stelt vraag |

**Kritiek:** Domeinen vervangen de matrix NIET. Ze zijn een vangnet voor edge cases.

---

## De 5 Domeinen

### 1. UX Domein

| Eigenschap | Waarde |
|------------|--------|
| **Lead** | ui-designer |
| **Sub-skills** | accessibility-specialist, onboarding-recovery-specialist |
| **Scope** | Visuele presentatie, interactiepatronen, formulieren, navigatie |

**Escalatie-trigger:**
Wijziging raakt UI maar matrix specificeert niet WELKE UI-aspecten (bijv. een nieuwe interactie die geen bestaand patroon volgt).

**Vraag aan gebruiker:**
> "Deze wijziging raakt de UI maar valt niet exact in een bestaande categorie. Raakt dit ook **toegankelijkheid** (schermlezer, contrast, touch targets) of de **onboarding flow** (eerste gebruik, nieuwe gebruikers)?"

**Na antwoord gebruiker:**
- "Ja, toegankelijkheid" → activeer accessibility-specialist
- "Ja, onboarding" → activeer onboarding-recovery-specialist
- "Nee, alleen visueel" → alleen ui-designer valideert

**DECISION_PATTERNS.md check:** Doorzoek UX Patronen voor eerder gemaakte beslissingen in vergelijkbare context.

---

### 2. Platform Domein

| Eigenschap | Waarde |
|------------|--------|
| **Lead** | architecture-lead |
| **Sub-skills** | ios-specialist, android-specialist, react-native-expert, performance-optimizer |
| **Scope** | Platform-specifieke implementatie, native modules, cross-platform compatibiliteit |

**Escalatie-trigger:**
Wijziging raakt meerdere platforms maar matrix specificeert niet welke, of het is onduidelijk of een native module nodig is.

**Vraag aan gebruiker:**
> "Deze wijziging kan platform-specifieke implicaties hebben. Is dit **iOS-specifiek** (native module, Keychain, App Store), **Android-specifiek** (native module, Keystore, Play Store), of **cross-platform** (React Native, gedeelde logica)?"

**Na antwoord gebruiker:**
- "iOS-specifiek" → activeer ios-specialist + react-native-expert (voor bridge)
- "Android-specifiek" → activeer android-specialist + react-native-expert (voor bridge)
- "Cross-platform" → activeer react-native-expert, optioneel performance-optimizer
- "Beide platforms" → activeer ios-specialist + android-specialist + react-native-expert

**DECISION_PATTERNS.md check:** Doorzoek Architectuur Patronen voor eerder gemaakte beslissingen over platform-keuzes.

---

### 3. Security Domein

| Eigenschap | Waarde |
|------------|--------|
| **Lead** | security-expert |
| **Sub-skills** | (geen — security-expert handelt alle security aspecten) |
| **Scope** | Encryptie, authenticatie, PII, key management, privacy |

**Escalatie-trigger:**
Wijziging bevat mogelijk gevoelige data of security-implicaties maar is niet expliciet in de matrix gedefinieerd.

**Vraag aan gebruiker:**
> "Deze wijziging bevat mogelijk security-gevoelige aspecten. Verwerkt dit **gebruikersgegevens** (namen, nummers, adressen), **cryptografische sleutels** (encryptie, tokens), of **authenticatie** (login, verificatie, trust levels)?"

**Na antwoord gebruiker:**
- "Ja, gebruikersgegevens" → security-expert valideert PII handling + opslag
- "Ja, sleutels" → security-expert valideert key management + encryptie
- "Ja, authenticatie" → security-expert valideert auth flow + token handling
- "Nee, geen van allen" → geen security validatie nodig

**Belangrijk:** Bij twijfel ALTIJD security-expert activeren. Security wint altijd (Conflict Resolutie Hiërarchie #1).

---

### 4. Content Domein

| Eigenschap | Waarde |
|------------|--------|
| **Lead** | documentation-writer |
| **Sub-skills** | testing-qa, devops-specialist |
| **Scope** | Documentatie, tests, CI/CD, i18n vertalingen |

**Escalatie-trigger:**
Wijziging vereist mogelijk documentatie-updates, test-wijzigingen, of deployment aanpassingen die niet expliciet in de matrix staan.

**Vraag aan gebruiker:**
> "Deze wijziging kan gevolgen hebben voor documentatie of tests. Moeten er **tests** bij (unit/integration/E2E), **documentatie** (API docs, gebruikershandleiding), of **deployment aanpassingen** (CI/CD, store listing)?"

**Na antwoord gebruiker:**
- "Ja, tests" → activeer testing-qa
- "Ja, documentatie" → activeer documentation-writer
- "Ja, deployment" → activeer devops-specialist
- "Nee, geen van allen" → geen content validatie nodig
- Meerdere: activeer alle genoemde sub-skills

**i18n uitzondering:** Nieuwe i18n keys worden ALTIJD gedetecteerd door de matrix (BLOKKEERDER). Dit domein vangt alleen onverwachte documentatie-behoeften op.

---

### 5. Protocol Domein

| Eigenschap | Waarde |
|------------|--------|
| **Lead** | xmpp-specialist |
| **Sub-skills** | (geen — xmpp-specialist handelt alle protocol aspecten) |
| **Scope** | XMPP communicatie, Prosody config, presence, message routing, offline sync |

**Escalatie-trigger:**
Wijziging raakt mogelijk server-communicatie of device-to-device interactie die niet expliciet in de matrix staat.

**Vraag aan gebruiker:**
> "Deze wijziging kan server-communicatie beïnvloeden. Communiceert dit met de **XMPP server** (berichten, presence, roster), **andere devices** (sync, push), of de **relay server** (invitations, key exchange)?"

**Na antwoord gebruiker:**
- "XMPP server" → xmpp-specialist valideert protocol compliance
- "Andere devices" → xmpp-specialist + architecture-lead (sync architectuur)
- "Relay server" → xmpp-specialist + security-expert (key exchange security)
- "Nee, lokaal alleen" → geen protocol validatie nodig

---

## Claude's Gedrag bij Domein-Escalatie

### Stap-voor-stap Protocol

1. **Matrix check** — Controleer CHANGE_VALIDATION_MATRIX op match
2. **Geen volledige match?** — Identificeer het meest relevante domein
3. **DECISION_PATTERNS.md check** — Is er een eerder vastgelegd patroon dat van toepassing is?
   - **Ja:** Pas patroon toe (tenzij contra-indicatie geldt) — geen vraag aan gebruiker nodig
   - **Nee:** Ga door naar stap 4
4. **Stel ONE vraag** — Gebruik de domein-specifieke vraag (ÉÉN vraag per keer)
5. **Verwerk antwoord** — Activeer de juiste sub-skills
6. **Valideer** — Voer de skill-validatie uit
7. **Leereffect** — Overweeg of dit een nieuw patroon is voor DECISION_PATTERNS.md

### Rapportage Format

```
📋 **Domein-Escalatie Rapport**

Matrix match: ⚠️ Gedeeltelijk — [wat wel/niet matched]
Domein: [naam] (lead: [skill])
Vraag gesteld: "[de vraag]"
Gebruiker antwoord: "[het antwoord]"
Geactiveerde skills: [lijst]

→ Validatie resultaten:
  [skill-1] ✅ / ⚠️ / ❌
  [skill-2] ✅ / ⚠️ / ❌
```

### Voorbeeld

```
Gebruiker: "Voeg een knop toe die de locatie van een contact op een kaart toont"

Claude:
"Matrix check: Gedeeltelijke match — 'Nieuw scherm/component' (UI) matched,
maar er zijn mogelijk platform-specifieke en privacy-implicaties.

📋 **Domein-Escalatie nodig**

De matrix identificeert dit als een UI-wijziging, maar kaartintegratie
kan ook platform-specifieke en privacy-implicaties hebben.

**Eerste vraag (Security Domein):**
Deze feature toont locatiegegevens van een contact. Wordt dit adres
al opgeslagen in de database, of moet het nog opgehaald worden?"
```

---

## Domein Overzicht

| # | Domein | Lead | Sub-skills | Trigger |
|---|--------|------|------------|---------|
| 1 | **UX** | ui-designer | accessibility-specialist, onboarding-recovery-specialist | UI-impact onduidelijk |
| 2 | **Platform** | architecture-lead | ios-specialist, android-specialist, react-native-expert, performance-optimizer | Platform-keuze onduidelijk |
| 3 | **Security** | security-expert | — | Mogelijk gevoelige data |
| 4 | **Content** | documentation-writer | testing-qa, devops-specialist | Docs/tests/deploy nodig? |
| 5 | **Protocol** | xmpp-specialist | — | Server-communicatie? |

---

## Relatie tot Andere Documenten

| Document | Relatie |
|----------|---------|
| `CHANGE_VALIDATION_MATRIX.md` | **Primaire router** — domein wordt alleen geactiveerd bij onvolledige match |
| `COORDINATION_PROTOCOL.md` | **Workflow definitie** — domein-escalatie is een stap in het protocol |
| `DECISION_PATTERNS.md` | **Leergeheugen** — domeinen checken patronen vóór ze vragen stellen |
| `CLAUDE.md` | **Master document** — heeft altijd voorrang bij conflicten |
| `skills/*/SKILL.md` | **Skill definities** — sub-skills die door domeinen worden geactiveerd |
