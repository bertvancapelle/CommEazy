# CommEazy — Agent Teams Master Context

## ⚠️ Claude Draait Binnen Xcode

**BELANGRIJK:** Claude wordt aangeroepen vanuit Xcode's ingebouwde AI assistant, NIET via terminal/CLI.

**Implicaties:**
- Gebruik Xcode commando's (`⌘R`, `⌘⇧K`, `⌘B`) in plaats van terminal commando's (`npm run ios`, etc.)
- Xcode MCP tools (XcodeRead, XcodeWrite, XcodeGrep, etc.) zijn beschikbaar en worden geprefereerd
- Build errors zijn direct beschikbaar via `GetBuildLog` en `XcodeListNavigatorIssues`
- Previews kunnen worden gerenderd met `RenderPreview`

## ⚠️ PNA Commando — Pas Niets Aan (KRITIEK PROTOCOL)

### ‼️ KERNREGEL: PNA BLIJFT ALTIJD ACTIEF TOTDAT EXPLICIET BEËINDIGD

**Wanneer de gebruiker "PNA" intikt, activeert dit een STRIKTE modus die ACTIEF BLIJFT bij ELKE volgende interactie totdat de gebruiker EXPLICIET bevestigt dat PNA beëindigd mag worden.**

### PNA Regels (VERPLICHT — GEEN UITZONDERINGEN)

1. **Pas NIETS aan** — Geen code wijzigingen, geen bestanden aanraken, NOOIT
2. **Overleg modus** — Gebruiker wil discussiëren, nadenken, afwegen — NIET implementeren
3. **PNA BLIJFT ACTIEF** — Bij ELKE vraag/antwoord cyclus blijft PNA actief
4. **ELKE response begint met PNA-status** — Begin ALTIJD met "**🔒 PNA ACTIEF**" zolang PNA niet beëindigd is
5. **Skills als analytisch kader** — Raadpleeg de relevante SKILL.md bestanden daadwerkelijk. Citeer specifieke regels en pas ze toe op het vraagstuk. Niet alleen opsommen met bullets, maar de inhoud van elke skill toepassen op de concrete situatie.
6. **Devil's advocate doordenken** — Wantrouw de eerste oplossing. Bedenk actief waarom het voorstel NIET de beste keuze is. Overweeg minimaal één alternatief. Benoem zwakke punten in het eigen voorstel. Pas stoppen met doordenken wanneer de oplossing zowel functioneel als technisch de beste is — of wanneer eerlijk is vastgesteld dat er trade-offs zijn die de gebruiker moet afwegen.
7. **Stel vragen ÉÉN VOOR ÉÉN** — Eén vraag, wacht op antwoord, dan volgende vraag
8. **NA antwoord op vraag:** Evalueer antwoord, stel eventueel volgende vraag, MAAR IMPLEMENTEER NIET
9. **NOOIT naar implementatie zonder EXIT-bevestiging** — Gebruiker MOET expliciet zeggen "exit PNA", "PNA uit", "ga door met implementatie", of vergelijkbaar
10. **Valideer duidelijkheid** — Controleer of de vraagstelling eenduidig is. Als er meerdere interpretaties mogelijk zijn, benoem deze en vraag verduidelijking vóór analyse. Voorkom dat de verkeerde vraag wordt beantwoord.
11. **Conclusie met goedkeuring** — Sluit altijd af met een gestructureerde conclusie: wat is het voorstel, waarom, welke trade-offs. Deze conclusie MOET expliciet goedgekeurd worden voordat naar PNA-stop wordt gegaan.
12. **Senior-perspectief toets** — Bij ELKE analyse, toets het voorstel vanuit het perspectief van een senior gebruiker (65+). Drie criteria zijn leidend: **eenvoud** (begrijpt een senior dit zonder uitleg?), **consistentie** (werkt dit hetzelfde als vergelijkbare functies in de app?), **herkenbaarheid** (herkent een senior de patronen uit eerdere interacties?). Als een voorstel op één van deze drie criteria faalt, benoem dit als bezwaar.

### PNA Modus Beëindigen — STRIKTE REGELS

**Claude MAG PNA ALLEEN beëindigen wanneer:**
1. Alle vragen beantwoord zijn EN conclusie gegeven is
2. Claude EXPLICIET vraagt: "**Wil je PNA modus beëindigen zodat ik aanpassingen kan maken?**"
3. Gebruiker EXPLICIET bevestigt met woorden zoals:
   - "ja", "ok", "doe maar", "ga door", "implementeer", "exit PNA", "PNA uit"

**Claude MAG PNA NIET beëindigen wanneer:**
- Gebruiker alleen een vraag beantwoordt → PNA BLIJFT ACTIEF, stel volgende vraag of geef conclusie
- Gebruiker zegt "begrepen" of "goed" → Dit is GEEN exit-bevestiging
- Gebruiker geen expliciete exit geeft → PNA BLIJFT ACTIEF

### PNA-stop Transitie Protocol (VERPLICHT)

Wanneer PNA wordt beëindigd ("pna stop", "ga door", etc.) activeert Claude automatisch een twee-fasen protocol dat de overgang van overleg naar implementatie bewaakt.

**Fase 1: Pre-development (VERPLICHT vóór eerste regel code)**

Voer de Verplichte Skill Validatie uit (zie "Stappen (VERPLICHT)" in dit document):
1. **Classificeer** de wijziging (Tier 1/2/3)
2. **Identificeer** welke skills moeten valideren (via `CHANGE_VALIDATION_MATRIX.md`)
3. **Valideer** tegen elke skill's checklist en regels
4. **Rapporteer** resultaten aan gebruiker (✅ / ⚠️ / ❌)

> Dit is geen duplicatie van de bestaande stappen — het is de expliciete koppeling aan het PNA-stop moment, zodat deze stappen NOOIT worden overgeslagen na een overleg.

**Fase 2: Post-development (VERPLICHT na voltooiing, vóór commit)**

Na implementatie, reflecteer op wat er is ontwikkeld:
1. **Nieuw patroon?** — Is er een herbruikbaar patroon ontstaan dat gestandaardiseerd moet worden in een SKILL.md?
2. **Nieuw component?** — Hoort er een nieuw standaard component in de Component Registry (CLAUDE.md sectie 14)?
3. **Skill aanscherping?** — Moeten bestaande skills worden uitgebreid of aangescherpt n.a.v. wat er geleerd is?
4. **Rapporteer** bevindingen aan gebruiker vóór commit:

```
🔄 **Post-development Reflectie**

- Nieuw patroon: [ja/nee — beschrijving]
- Nieuw component: [ja/nee — beschrijving]
- Skill aanscherping: [ja/nee — welke skill, welke regel]

[Bij "ja": Wil je dat ik dit nu toevoeg aan de skills?]
```

### Vragen Stellen in PNA Modus

- ❌ FOUT: "Vraag 1: ... Vraag 2: ... Vraag 3: ..."
- ✅ GOED: "Eerste vraag: ..." → wacht op antwoord → "Volgende vraag: ..."

### Na Ontvangen van Antwoord op Vraag (KRITIEK)

Wanneer gebruiker antwoord geeft op een PNA-vraag:

1. **Begin met:** "**🔒 PNA ACTIEF**"
2. **Evalueer het antwoord** — Verwerk de informatie
3. **Kies één van:**
   - **Meer vragen nodig?** → Stel de volgende vraag ÉÉN VOOR ÉÉN
   - **Alle info verzameld?** → Geef conclusie/samenvatting + vraag om PNA exit
4. **NOOIT:** Direct naar implementatie gaan

### Voorbeeld Workflow (VERPLICHT FORMAT)

```
Gebruiker: "PNA ik denk eraan om de login flow te wijzigen"

Claude:
"**🔒 PNA ACTIEF** — Ik pas niets aan, we overleggen.

**Skill analyse:**
- 🔒 security-expert (SKILL.md §Auth flow): [specifieke regel + toepassing]
- ♿ accessibility-specialist (SKILL.md §Onboarding): [specifieke regel + toepassing]
- 👴 Senior-toets: Eenvoud — begrijpt een senior dit zonder uitleg?
  Consistentie — werkt dit hetzelfde als andere flows in de app?
  Herkenbaarheid — herkent een senior de patronen?
- 🏗️ architecture-lead (SKILL.md §Navigation): [specifieke regel + toepassing]

**Eerste vraag:**
Wat is het doel van de wijziging?"
```

```
Gebruiker: "om de flow korter te maken"

Claude:
"**🔒 PNA ACTIEF**

Begrepen — het doel is om de login flow korter te maken.

**Devil's advocate:** Korter is niet altijd beter voor senioren. Minder stappen
betekent meer informatie per stap, wat overweldigend kan zijn. [concrete afweging]

**Volgende vraag:**
Moet de bestaande login methode behouden blijven als alternatief?"
```

```
Gebruiker: "nee, de oude mag weg"

Claude:
"**🔒 PNA ACTIEF**

Duidelijk — de oude methode mag verwijderd worden.

**Conclusie:**
- Voorstel: [concrete aanpak]
- Waarom dit de beste keuze is: [argumenten]
- Overwogen alternatief: [alternatief + waarom afgewezen]
- Senior-toets: ✅ eenvoud / ✅ consistentie / ⚠️ herkenbaarheid — [toelichting]
- Trade-offs: [eerlijke afweging]

**Wil je PNA modus beëindigen zodat ik aanpassingen kan maken?**"
```

```
Gebruiker: "ja, ga door"

Claude:
"**✅ PNA BEËINDIGD**

**Pre-development validatie** (PNA-stop Transitie Protocol Fase 1):
- Classificatie: Tier 2 — Auth flow wijziging
- Skills: security-expert ✅, onboarding-recovery-specialist ✅, ui-designer ✅
- Geen blokkeerders gevonden.

Ik ga nu de wijzigingen doorvoeren.
[implementatie start]"
```

### Anti-Pattern: WAT CLAUDE NOOIT MAG DOEN

```
❌ FOUT — Implementeren na antwoord zonder exit-bevestiging:

Gebruiker: "PNA maak het icoon klikbaar"
Claude: "**🔒 PNA ACTIEF** — Eerste vraag: Alleen icoon of ook tekst?"
Gebruiker: "alleen icoon"
Claude: "Begrepen, ik ga nu het icoon klikbaar maken..." ← FOUT!

✅ GOED — PNA blijft actief:

Gebruiker: "PNA maak het icoon klikbaar"
Claude: "**🔒 PNA ACTIEF** — Eerste vraag: Alleen icoon of ook tekst?"
Gebruiker: "alleen icoon"
Claude: "**🔒 PNA ACTIEF** — Duidelijk. Volgende vraag: Hoe moet de visuele indicator eruitzien?"
[of als alle info compleet:]
Claude: "**🔒 PNA ACTIEF** — **Conclusie:** [...] **Wil je PNA beëindigen?**"
```

---

## ⚠️ Werkprincipe voor Gebruikersgerichte Features (VERPLICHT)

**Dit principe geldt voor ALLE gebruikersgerichte features** (niet voor technische fixes zoals bug fixes, refactoring, of infrastructuur).

### Kernregels

1. **Wees kritisch, maak geen aannames**
   - Neem nooit aan dat je de intentie van de gebruiker begrijpt
   - Valideer elke aanname expliciet voordat je handelt
   - Bij twijfel: vraag, implementeer niet

2. **Stel vragen één voor één**
   - Nooit meerdere vragen tegelijk stellen
   - Wacht op antwoord voordat je de volgende vraag stelt
   - Dit voorkomt verwarring en zorgt voor duidelijke besluitvorming

3. **Deel je interpretatie VOORDAT je uitvoert**
   - Geef een samenvatting van wat je denkt dat de gebruiker vraagt
   - Beschrijf wat je van plan bent te doen
   - Wacht op bevestiging voordat je begint

4. **Denk vanuit het senior-perspectief**
   - Onze primaire gebruikers zijn senioren (65+)
   - Veel van hen hebben weinig ervaring met smartphones/tablets
   - Vraag jezelf af: "Zou mijn oma/opa dit begrijpen en kunnen gebruiken?"
   - Vermijd technisch jargon in UX beslissingen

5. **Vraag ALTIJD bevestiging bij conclusies en aanbevelingen**
   - Wanneer je een conclusie trekt of een aanbeveling doet, neem NOOIT aan dat de gebruiker het eens is
   - Presenteer je conclusie/aanbeveling en vraag EXPLICIET: "Ben je het eens met deze conclusie?"
   - Ga pas door met de volgende stap NA bevestiging van de gebruiker
   - Dit geldt voor: UX keuzes, design beslissingen, verwijder-suggesties, en elke andere inhoudelijke conclusie
   - Reden: De gebruiker kent de doelgroep (senioren) beter dan Claude en kan nuances zien die Claude mist

### Wanneer WEL toepassen

- Nieuwe features of functionaliteit
- UI/UX wijzigingen
- Navigatie aanpassingen
- Interactie patronen
- Teksten en labels
- Flow wijzigingen

### Wanneer NIET toepassen

- Bug fixes (technische correcties)
- Performance optimalisaties
- Code refactoring
- Build/deployment issues
- Dependency updates

### Voorbeeld Workflow

```
Gebruiker: "Ik wil een knop toevoegen"

Claude (GOED):
"Voordat ik begin, wil ik zeker weten dat ik je vraag goed begrijp.

Je wilt een knop toevoegen. Mijn eerste vraag:
Waar moet deze knop komen — op een bestaand scherm of een nieuw scherm?"

[Wacht op antwoord]

"Duidelijk, op het contactenlijst scherm. Volgende vraag:
Wat moet er gebeuren als een senior op deze knop tikt?"

[Wacht op antwoord]

"Begrepen. Mijn interpretatie:
- Knop op contactenlijst scherm
- Bij tap: opent nieuw contact formulier
- Moet duidelijk zichtbaar zijn voor senioren (groot, helder contrast)

Klopt dit? Dan ga ik nu implementeren."

Claude (FOUT — geen bevestiging gevraagd):
"Ik voeg een knop toe met een plus-icoon rechtsboven die een modal opent
voor nieuwe contacten. Hier is de code..."

Claude (FOUT — conclusie zonder bevestiging):
"De auto-close modal heeft geen sluitknop nodig, die kan weg."
→ FOUT: Claude trekt een conclusie en gaat ervan uit dat de gebruiker het eens is.

Claude (GOED — conclusie MET bevestiging):
"Mijn analyse: de modal sluit automatisch na selectie, dus de sluitknop
lijkt overbodig. Maar voor senioren kan consistentie juist belangrijk zijn.
Ben je het eens met mijn conclusie, of wil je de knop behouden?"
```

## What is CommEazy?
Privacy-first family communication app. End-to-end encrypted messaging, photos, and video calls for families — designed specifically for seniors (65+) while being enjoyable for all ages.

## Architecture Overview
- **Frontend:** React Native 0.84.1 (iOS, iPadOS, Android) — New Architecture + Hermes V1
- **Protocol:** XMPP (xmpp.js) via Prosody server — routing only, zero message storage
- **Database:** WatermelonDB (local, encrypted with SQLCipher)
- **Encryption:** libsodium, dual-path (encrypt-to-all ≤8 members, shared-key >8)
- **Auth:** Firebase Auth (phone verification only)
- **Push:** Firebase Cloud Messaging
- **Calls:** WebRTC (P2P via Coturn STUN/TURN)
- **Languages:** 13 talen (react-i18next) — zie `CONSTANTS.md` voor volledige lijst

## Non-Negotiable Requirements
1. **Zero server storage** — Prosody routes only, never stores message content
2. **Senior-inclusive UX** — Body ≥18pt, touch ≥60pt, WCAG AAA, max 3 steps per flow
3. **13-language support** — All UI strings via t(), zero hardcoded text — zie `CONSTANTS.md`
4. **Store compliance** — Apple Privacy Manifest + Google Data Safety Section
5. **Encryption export** — US BIS Self-Classification Report filed
6. **Apple Platform Compliance (Liquid Glass)** — iOS/iPadOS 26+ must use Liquid Glass effects with module tint colors; graceful fallback to solid colors on iOS <26 and Android. See section 16.

## Project Structure
```
src/
  services/         ← Core business logic (interfaces + implementations)
    interfaces.ts   ← Technology-agnostic contracts (READ THIS FIRST)
    container.ts    ← Dependency injection singleton
    encryption.ts   ← libsodium dual-path implementation
    xmpp.ts         ← xmpp.js XMPP client
  screens/          ← Screen components
  components/       ← Reusable UI components
  navigation/       ← React Navigation setup (max 2 levels)
  hooks/            ← Custom React hooks
  locales/          ← i18n translation files (13 talen, zie CONSTANTS.md)
  theme/            ← Colours, typography, spacing (senior-inclusive)
  config/           ← App configuration
  models/           ← WatermelonDB models
  utils/            ← Shared utilities
```

## Agent Team Skills
All 13 skill definitions are in `.claude/skills/[name]/SKILL.md`. Each skill has:
- Core Responsibilities
- Store Compliance Gate
- Senior Inclusive Design Principles
- i18n Requirements
- Interface Contracts (provides/expects)
- Error Scenarios with recovery
- Code Examples
- Quality Checklist

## ⚠️ VERPLICHTE SKILL VALIDATIE (COORDINATION PROTOCOL)

**VOORDAT** enige wijziging wordt uitgevoerd, MOET het coördinatie-protocol worden gevolgd. Zie `.claude/COORDINATION_PROTOCOL.md` voor volledige details.

### Korte Samenvatting

```
GEBRUIKER VRAAGT → CLASSIFICATIE → SKILL IDENTIFICATIE → VALIDATIE → RAPPORTAGE → UITVOERING
```

### Stappen (VERPLICHT)

1. **Classificeer** de wijziging (UI, security, database, etc.)
2. **Identificeer** welke skills moeten valideren (zie `CHANGE_VALIDATION_MATRIX.md`)
3. **Valideer** tegen elke relevante skill's checklist en regels
4. **Rapporteer** resultaten aan gebruiker:
   - ✅ Voldoet aan alle regels
   - ⚠️ Waarschuwingen — bespreken
   - ❌ Blokkeerders — NIET uitvoeren
5. **Voer uit** alleen als alle validaties slagen
5b. **Test Validatie** — Zijn tests geschreven? Is coverage ≥80%?
6. **Skill Standaardisatie Check** — Na nieuwe functionaliteit ALTIJD vragen:
   - "Moet dit worden toegevoegd aan skills voor standaardisatie?"
   - "Is dit pattern herbruikbaar in andere modules?"
   - Zo ja: update SKILL.md en/of CLAUDE.md
7. **Mini-Retrospectief** — Na elke ontwikkelstap analyseren:
   - Wat ging goed? Wat kan beter?
   - Aanbevelingen voor skills?
8. **Recursieve Implementatie** — Bij skill wijzigingen:
   - Pas nieuwe regels toe op ALLE bestaande code
   - Zie `COORDINATION_PROTOCOL.md` voor volledige workflow
9. **Git Commit & Push Check** — Na elke logische milestone ALTIJD voorstellen:
   - "Dit is een goed moment om te committen en pushen"
   - Zie sectie "Git Workflow (VERPLICHT)" hieronder

### Automatische Triggers

| Wijziging bevat... | Verplichte validatie door |
|-------------------|---------------------------|
| UI componenten, styling | ui-designer, accessibility-specialist |
| Formuliervelden, inputs | ui-designer, accessibility-specialist |
| Lijsten met >3 items | ui-designer, accessibility-specialist, react-native-expert |
| Voice control, spraak | accessibility-specialist, react-native-expert |
| Encryptie, keys, tokens | security-expert |
| Database, storage | architecture-lead, security-expert |
| **Schema kolom toevoegen/wijzigen** | **BLOKKEERDER** — schema.ts EN migrations.ts MOETEN ALTIJD SAMEN worden gewijzigd, zie "Database Schema Wijziging Protocol" |
| XMPP, messaging | xmpp-specialist, security-expert |
| Navigatie | architecture-lead, ui-designer |
| i18n, vertalingen | ui-designer, documentation-writer |
| **Nieuwe i18n keys toevoegen** | **BLOKKEERDER** — ALLE 13 locale bestanden MOETEN worden bijgewerkt, zie sectie "i18n Completeness Validatie" |
| Native modules | ios-specialist OF android-specialist |
| Tests | testing-qa |
| CI/CD, deployment | devops-specialist |
| Onboarding flow | onboarding-recovery-specialist, ui-designer |
| Performance | performance-optimizer |
| **Media modules (Radio/Podcast/Audiobook)** | **ui-designer, accessibility-specialist, react-native-expert, ios-specialist** |
| **ChipSelector (Land/Taal filter)** | **architecture-lead, react-native-expert** — API land/taal ondersteuning MOET eerst gevalideerd worden |
| **TTS (Text-to-Speech)** | **accessibility-specialist, react-native-expert, ios-specialist** — Nederlands MOET Piper TTS (nl_NL-rdh-high) gebruiken |
| **Zoekfunctionaliteit in module** | **ui-designer, react-native-expert** — Module Search Pattern (sectie 15) MOET worden gevolgd |
| **Modal met zoekfunctie** | **BLOKKEERDER** — Zoeken mag NOOIT in een modal, zie sectie 15.1 |
| **Icon component gebruik** | **ui-designer** — Icoon MOET bestaan in IconName type, zie SKILL.md sectie 10b |
| **AccentColor properties** | **ui-designer** — Alleen bestaande properties gebruiken (primary/primaryLight/primaryDark/light/label), zie SKILL.md sectie 10c |
| **Chat/message styling** | **ui-designer** — WhatsApp-style message direction pattern, zie SKILL.md sectie 10d |
| **Device-specifieke navigation** | **architecture-lead, ui-designer** — UX Consistentie Principe (sectie 10c) MOET worden gevolgd |
| **Long-press gesture implementatie** | **architecture-lead, ui-designer** — Wheel menu op ALLE devices, zie sectie 10c |
| **UI met achtergrondkleur (iOS)** | **ui-designer, ios-specialist** — Liquid Glass compliance voor iOS/iPadOS 26+, zie SKILL.md sectie 14 |
| **MiniPlayer/ModuleHeader/Cards** | **ui-designer** — `moduleId` prop VERPLICHT voor Liquid Glass |
| **Nieuwe module** | **BLOKKEERDER** — Volledige checklist hieronder MOET worden doorlopen |
| **Audio module toevoegen/wijzigen** | **Zie Module Dependency Matrix hieronder** — MediaIndicator, GlassPlayer, contexts |
| **Playback feature wijzigen** | **Zie Module Dependency Matrix hieronder** — 100% Feature Parity vereist |
| **Shared component props wijzigen** | **VERPLICHT** — ALLE gebruikers van component MOETEN worden bijgewerkt, zie "Component Props Uniformiteit" |
| **Nieuw screen toevoegen** | **BLOKKEERDER** — Screen MOET route hebben in `navigation/index.tsx`, zie "Navigation Route Completeness" |
| **Nieuwe theme kleur toevoegen** | **BLOKKEERDER** — Kleur MOET bestaan in BEIDE `colors.ts` EN `darkColors.ts`, zie "Theme Color Consistency" |
| **Type export toevoegen** | **VERPLICHT** — Type MOET geëxporteerd worden in relevante `index.ts` bestanden, zie "Type Export Consistency" |
| **Nieuwe button/knop toevoegen** | **ui-designer, ios-specialist** — Button Standaardisatie (ui-designer SKILL.md sectie 15) MOET worden gevolgd: 60pt, 12pt cornerRadius, rgba background, border support |
| **Native iOS button wijzigen** | **ios-specialist** — Zie "Native Button Standaardisatie" in ios-specialist SKILL.md |
| **Haptic/audio feedback instelling** | **accessibility-specialist** — MOET `useFeedback()` hook gebruiken (leest uit gedeelde `FeedbackContext`). NOOIT lokale state voor feedback instellingen. |
| **Required Reason API gebruiken** | **ios-specialist** — Privacy Manifest (PrivacyInfo.xcprivacy) MOET worden bijgewerkt met juiste reason code |
| **Keychain accessible/sync wijziging** | **security-expert, ios-specialist** — E2E sleutels GEEN `THIS_DEVICE_ONLY` (moet iCloud Backup overleven), mail credentials WEL `THIS_DEVICE_ONLY`. Zie `BACKUP_RESTORE_PLAN.md` |
| **Backup/restore functionaliteit** | **security-expert, architecture-lead** — iOS/iPadOS: iCloud Backup is afdoende, geen custom backup nodig. Android: uitgesteld. Zie `BACKUP_RESTORE_PLAN.md` |
| **App Attestation / JWT tokens** | **security-expert, ios-specialist, android-specialist** — App Attest (iOS) / Play Integrity (Android), JWT token systeem. Zie `TRUST_AND_ATTESTATION_PLAN.md` |
| **Invitation Relay / Contact exchange** | **security-expert, architecture-lead, onboarding-recovery-specialist** — Encrypted invitation codes, relay server, key exchange. Zie `TRUST_AND_ATTESTATION_PLAN.md` |
| **Contact verificatie flow** | **security-expert, ui-designer, onboarding-recovery-specialist** — QR-code exchange, trust levels, invitation flow. Zie `TRUST_AND_ATTESTATION_PLAN.md` |
| **`Alert.alert()` voor fout/succes/info** | **BLOKKEERDER** — ui-designer, accessibility-specialist — MOET `ErrorView` gebruiken. `Alert.alert()` ALLEEN voor bevestigingsdialogen (2+ knoppen). Zie ui-designer SKILL.md sectie 16 |

### Consistency Safeguards (VERPLICHT)

Deze safeguards voorkomen inconsistenties in de codebase. Claude MOET deze raadplegen bij relevante wijzigingen.

#### Component Props Uniformiteit

**Trigger:** Shared component krijgt nieuwe/gewijzigde props.

**Regel:** ALLE gebruikers van de component MOETEN worden bijgewerkt.

| Wanneer je WIJZIGT... | MOET je ook AANPASSEN... |
|----------------------|-------------------------|
| `ModuleHeader` props | ALLE screens die ModuleHeader gebruiken |
| `UnifiedMiniPlayer` props | Radio, Podcast, Books, AppleMusic, HomeScreen |
| `UnifiedFullPlayer` props | Radio, Podcast, Books, AppleMusic screens |
| `SearchBar` props | Radio, Podcast, Books, Contacts screens |
| `ChipSelector` props | Radio, Podcast, Books screens |
| `Icon` props | ALLE componenten die Icon gebruiken |

**Validatie Commando:**
```bash
# Vind alle gebruikers van een component
COMPONENT="ModuleHeader" && \
grep -r "import.*$COMPONENT\|<$COMPONENT" src/ --include="*.tsx" | cut -d: -f1 | sort -u
```

#### Navigation Route Completeness

**Trigger:** Nieuw screen component aangemaakt.

**Regel (BLOKKEERDER):** Screen MOET een route hebben in `navigation/index.tsx`.

| Bestand aangemaakt | MOET aanwezig zijn in |
|-------------------|----------------------|
| `src/screens/modules/FooScreen.tsx` | `navigation/index.tsx` als Tab.Screen of Stack.Screen |
| `src/screens/settings/FooSettingsScreen.tsx` | `navigation/index.tsx` in SettingsStack |
| `src/screens/call/FooCallScreen.tsx` | `navigation/index.tsx` in CallStack |

**Validatie Commando:**
```bash
# Vind screens zonder route
for screen in src/screens/**/*Screen.tsx; do
  name=$(basename "$screen" .tsx)
  if ! grep -q "$name" src/navigation/index.tsx; then
    echo "MISSING ROUTE: $name"
  fi
done
```

#### Theme Color Consistency

**Trigger:** Nieuwe kleur toegevoegd aan theme.

**Regel (BLOKKEERDER):** Kleur MOET bestaan in BEIDE `colors.ts` EN `darkColors.ts`.

| Kleur toegevoegd aan | MOET ook bestaan in |
|---------------------|---------------------|
| `src/theme/colors.ts` | `src/theme/darkColors.ts` |
| `src/theme/darkColors.ts` | `src/theme/colors.ts` |

**Validatie Commando:**
```bash
# Vergelijk color keys
node -e "
const light = require('./src/theme/colors.ts');
const dark = require('./src/theme/darkColors.ts');
const lightKeys = Object.keys(light.colors || light);
const darkKeys = Object.keys(dark.darkColors || dark);
const missingInDark = lightKeys.filter(k => !darkKeys.includes(k));
const missingInLight = darkKeys.filter(k => !lightKeys.includes(k));
if (missingInDark.length) console.log('Missing in darkColors:', missingInDark);
if (missingInLight.length) console.log('Missing in colors:', missingInLight);
"
```

#### Module Color Single Source of Truth

**Trigger:** Module kleur wijziging of nieuwe module.

**Regel (BLOKKEERDER):** Module kleuren MOETEN ALLEEN uit `ModuleColorsContext` komen via `useModuleColor()` hook.

**Waarom dit belangrijk is:**
- CommEazy heeft een unified 16-color palette voor alle modules
- Gebruikers kunnen module kleuren customizen in Instellingen > Weergave
- Hardcoded kleuren elders veroorzaken inconsistenties

**Verboden patterns:**
```typescript
// ❌ FOUT — hardcoded kleur
<View style={{ backgroundColor: '#2E7D32' }}>

// ❌ FOUT — kleur uit oude definitie
<View style={{ backgroundColor: module.color }}>

// ❌ FOUT — kleur uit STATIC_MODULE_DEFINITIONS
<View style={{ backgroundColor: STATIC_MODULE_DEFINITIONS[id].color }}>
```

**Correcte patterns:**
```typescript
// ✅ GOED — via hook
import { useModuleColor } from '@/contexts/ModuleColorsContext';

function MyComponent({ moduleId }: Props) {
  const moduleColor = useModuleColor(moduleId);
  return <View style={{ backgroundColor: moduleColor }}>...
}
```

**Single Source of Truth:**

| Wat | Waar | Gebruikt door |
|-----|------|---------------|
| Default kleuren | `MODULE_TINT_COLORS` in `liquidGlass.ts` | `useModuleColor()` fallback |
| User overrides | AsyncStorage via `ModuleColorsContext` | `useModuleColor()` return value |
| Legacy `color` prop | `STATIC_MODULE_DEFINITIONS` | **NIET GEBRUIKEN** — alleen type compat |

**Validatie Commando:**
```bash
# Vind hardcoded module kleuren (false positives mogelijk)
grep -rn "backgroundColor.*#[0-9A-Fa-f]\{6\}" src/components/ src/screens/ | \
  grep -v "textOnPrimary\|border\|surface\|background"
```

#### Type Export Consistency

**Trigger:** Nieuwe type/interface aangemaakt.

**Regel:** Types MOETEN geëxporteerd worden in relevante `index.ts` bestanden.

| Type aangemaakt in | MOET geëxporteerd worden in |
|-------------------|----------------------------|
| `src/services/foo/types.ts` | `src/services/foo/index.ts` EN `src/services/index.ts` |
| `src/contexts/FooContext.tsx` | `src/contexts/index.ts` |
| `src/components/Foo.tsx` | `src/components/index.ts` |
| `src/hooks/useFoo.ts` | `src/hooks/index.ts` |

**Validatie Commando:**
```bash
# Check of exports compleet zijn voor een type
TYPE="CallState" && \
echo "Defined in:" && grep -r "type $TYPE\|interface $TYPE" src/ --include="*.ts" --include="*.tsx" | head -3 && \
echo "Exported from:" && grep -r "export.*$TYPE" src/*/index.ts
```

### Module Dependency Matrix (VERPLICHT)

**⚠️ KRITIEK:** Deze matrix voorkomt dat afhankelijke modules worden vergeten bij wijzigingen. Claude MOET deze matrix raadplegen bij ELKE wijziging aan de genoemde categorieën.

**Zie ook:** `COORDINATION_PROTOCOL.md` sectie "Module Dependency Validation" voor de verplichte workflow.

#### 🎵 Audio Module Wijzigingen

| Wanneer je TOEVOEGT/WIJZIGT... | MOET je ook AANPASSEN... |
|-------------------------------|-------------------------|
| **Nieuwe audio module** (radio/podcast/books/appleMusic/etc.) | `MediaIndicator.tsx`: MEDIA_TABS mapping, getActiveMedia(), context import |
| | `contexts/index.ts`: export nieuwe context hook |
| | `WheelNavigationMenu.tsx`: STATIC_MODULE_DEFINITIONS, MODULE_TINT_COLORS |
| | 13 locale bestanden: navigation.moduleId key |
| | `navigation/index.tsx`: Tab.Screen registratie |
| **Playback state wijziging** | `MiniPlayerNativeView.swift` (iOS 26+ Glass Player) |
| | `FullPlayerNativeView.swift` (iOS 26+ Glass Player) |
| | `glassPlayer.ts` bridge types |
| | React Native MiniPlayer/ExpandedAudioPlayer (feature parity) |
| **Sleep timer toevoegen aan module** | `MediaIndicator.tsx`: showSleepTimerIndicator check uitbreiden |
| | Module context: sleepTimerActive state toevoegen |
| **Now playing metadata** | `GlassPlayerWindow.swift`: PlaybackState struct |
| | `AppleMusicModule.swift` of module-specifieke native code |

#### 📱 Navigatie Wijzigingen

| Wanneer je TOEVOEGT/WIJZIGT... | MOET je ook AANPASSEN... |
|-------------------------------|-------------------------|
| **Nieuwe module** | Zie "Nieuwe Module Validatie Checklist" hieronder |
| **Tab naam wijziging** | `MediaIndicator.tsx`: MEDIA_TABS mapping |
| | `HoldToNavigateWrapper.tsx`: destination mappings |
| **Module verwijderen** | `useModuleUsage.ts`: ALL_MODULES, DEFAULT_MODULE_ORDER |
| | `WheelNavigationMenu.tsx`: STATIC_MODULE_DEFINITIONS |
| | `MediaIndicator.tsx`: MEDIA_TABS, getActiveMedia() |

#### 🎨 Liquid Glass (iOS 26+)

| Wanneer je TOEVOEGT/WIJZIGT... | MOET je ook AANPASSEN... |
|-------------------------------|-------------------------|
| **Player feature in RN** | Native equivalent in Swift (100% Feature Parity) |
| **Nieuwe control button** | `MiniPlayerNativeView.swift` EN `FullPlayerNativeView.swift` |
| **Bridge parameter** | `glassPlayer.ts` types EN `GlassPlayerWindowModule.swift` |
| **Module tint color** | `WheelNavigationMenu.tsx`: MODULE_TINT_COLORS |

#### 📧 Mail Module Wijzigingen

| Wanneer je TOEVOEGT/WIJZIGT... | MOET je ook AANPASSEN... |
|-------------------------------|-------------------------|
| **Mail account configuratie** | `MailModule.swift`: IMAP/SMTP settings |
| | `MailBackgroundFetchModule.swift`: background fetch interval |
| **Mail bijlage handling** | `DocumentPreviewModule.swift`: QLPreview support |
| | `VideoProcessingModule.swift`: als video bijlage |
| **Mail compose flow** | `MailComposeScreen.tsx`: recipient chips, CC/BCC |
| | `contactLookupHelpers.ts`: contact suggesties |

#### 🔊 Context State Wijzigingen

| Wanneer je TOEVOEGT/WIJZIGT... | MOET je ook AANPASSEN... |
|-------------------------------|-------------------------|
| **isPlaying state** | `MediaIndicator.tsx`: getActiveMedia() check |
| **sleepTimerActive state** | `MediaIndicator.tsx`: showSleepTimerIndicator |
| **nowPlaying/currentItem** | `MediaIndicator.tsx`: null check in getActiveMedia() |
| **Nieuwe context export** | `contexts/index.ts`: re-export |
| **Safe context hook** | Component imports: gebruik `useFooContextSafe()` buiten provider |

#### Validatie Commando

```bash
# Check alle afhankelijkheden voor een audio module
MODULE="appleMusic" && \
echo "=== Checking $MODULE dependencies ===" && \
echo "MediaIndicator:" && grep -c "$MODULE" src/components/MediaIndicator.tsx && \
echo "MEDIA_TABS:" && grep "appleMusic.*Tab" src/components/MediaIndicator.tsx && \
echo "WheelNavigation:" && grep -c "$MODULE" src/components/WheelNavigationMenu.tsx && \
echo "Navigation:" && grep -c "${MODULE^}Tab" src/navigation/index.tsx
```

### Nieuwe Module Validatie Checklist (VERPLICHT)

**⚠️ KRITIEK:** Voordat een nieuwe module getest wordt, MOET Claude ALLE onderstaande punten valideren. Dit voorkomt situaties waar een module is geïmplementeerd maar niet zichtbaar is in het menu, iconen mist, of vertalingen ontbreken.

**Wanneer:** Direct NA implementatie van een nieuwe module, VOOR het testen.

| # | Check | Bestand | Wat valideren |
|---|-------|---------|---------------|
| 1 | **NavigationDestination type** | `src/components/WheelNavigationMenu.tsx` | `'moduleId'` toegevoegd aan `NavigationDestination` type |
| 2 | **ALL_MODULES array** | `src/hooks/useModuleUsage.ts` | `'moduleId'` toegevoegd aan `ALL_MODULES` array |
| 3 | **DEFAULT_MODULE_ORDER array** | `src/hooks/useModuleUsage.ts` | `'moduleId'` toegevoegd aan `DEFAULT_MODULE_ORDER` array |
| 4 | **Icon & Color definitie** | `src/components/WheelNavigationMenu.tsx` | Entry in `STATIC_MODULE_DEFINITIONS` met `icon` en `color` |
| 5 | **Module tint color** | `src/components/WheelNavigationMenu.tsx` | Entry in `MODULE_TINT_COLORS` voor Liquid Glass |
| 6 | **i18n key NL** | `src/locales/nl.json` | `navigation.moduleId` key aanwezig |
| 7 | **i18n key EN** | `src/locales/en.json` | `navigation.moduleId` key aanwezig |
| 8 | **i18n key EN-GB** | `src/locales/en-GB.json` | `navigation.moduleId` key aanwezig |
| 9 | **i18n key DE** | `src/locales/de.json` | `navigation.moduleId` key aanwezig |
| 10 | **i18n key FR** | `src/locales/fr.json` | `navigation.moduleId` key aanwezig |
| 11 | **i18n key ES** | `src/locales/es.json` | `navigation.moduleId` key aanwezig |
| 12 | **i18n key IT** | `src/locales/it.json` | `navigation.moduleId` key aanwezig |
| 13 | **i18n key NO** | `src/locales/no.json` | `navigation.moduleId` key aanwezig |
| 14 | **i18n key SV** | `src/locales/sv.json` | `navigation.moduleId` key aanwezig |
| 15 | **i18n key DA** | `src/locales/da.json` | `navigation.moduleId` key aanwezig |
| 16 | **i18n key PT** | `src/locales/pt.json` | `navigation.moduleId` key aanwezig |
| 17 | **i18n key PT-BR** | `src/locales/pt-BR.json` | `navigation.moduleId` key aanwezig |
| 18 | **i18n key PL** | `src/locales/pl.json` | `navigation.moduleId` key aanwezig |
| 19 | **Navigation route** | `src/navigation/index.tsx` | Screen geregistreerd in navigator |
| 20 | **Screen component** | `src/screens/modules/[Module]Screen.tsx` | Screen bestand bestaat |

#### Module Kleuren Registratie (VERPLICHT voor alle modules)

Elke module MOET geregistreerd worden in het kleuren-systeem zodat gebruikers de kleur kunnen aanpassen in Instellingen → Weergave & Kleuren.

| # | Check | Bestand | Wat aanpassen |
|---|-------|---------|---------------|
| 21 | **ModuleColorId type** | `src/types/liquidGlass.ts` | `'moduleId'` toevoegen aan `ModuleColorId` union type |
| 22 | **CUSTOMIZABLE_MODULES** | `src/contexts/ModuleColorsContext.tsx` | `'moduleId'` toevoegen aan `CUSTOMIZABLE_MODULES` array |
| 23 | **MODULE_LABELS** | `src/contexts/ModuleColorsContext.tsx` | `moduleId: 'modules.moduleId.title'` toevoegen aan `MODULE_LABELS` object |
| 24 | **Preview card** | `src/screens/settings/AppearanceSettingsScreen.tsx` | Preview card toevoegen met `useModuleColor('moduleId')` |

#### Audio Module Extra Checks (VERPLICHT voor modules met audio playback)

Modules met audio playback (radio, podcast, books, appleMusic, etc.) hebben extra vereisten voor Liquid Glass integratie.

| # | Check | Bestand | Wat valideren |
|---|-------|---------|---------------|
| 25 | **useModuleColor hook** | Screen component | `const moduleColor = useModuleColor('moduleId')` — GEEN hardcoded kleur constanten |
| 26 | **Glass Player tintColorHex** | Screen component | `tintColorHex: moduleColor` in `showGlassMiniPlayer()` call |
| 27 | **updateGlassContent tintColorHex** | Screen component | `tintColorHex: moduleColor` in ELKE `updateGlassContent()` call — anders fallback naar default kleur! |
| 28 | **UI elementen dynamisch** | Screen component | Alle UI elementen met module kleur gebruiken `moduleColor` variabele, niet hardcoded hex |

**⚠️ FOUT patroon (NIET DOEN):**
```typescript
// ❌ FOUT: Hardcoded kleur
const RADIO_MODULE_COLOR = '#00897B';

showGlassMiniPlayer({
  tintColorHex: RADIO_MODULE_COLOR,  // ← Negeert user preferences!
});
```

**✅ CORRECT patroon:**
```typescript
// ✅ GOED: User-customizable kleur
import { useModuleColor } from '@/contexts/ModuleColorsContext';

const radioModuleColor = useModuleColor('radio');

// Bij showGlassMiniPlayer
showGlassMiniPlayer({
  tintColorHex: radioModuleColor,  // ← Respecteert user preferences
});

// ⚠️ KRITIEK: Ook bij updateGlassContent MOET tintColorHex worden meegegeven!
// Anders valt native code terug op default kleur #00897B
updateGlassContent({
  tintColorHex: radioModuleColor,  // ← VERPLICHT bij elke content update
  artwork: ...,
  title: ...,
});
```

**Claude's Verantwoordelijkheid:**

Na het implementeren van een nieuwe module MOET Claude:
1. Bovenstaande checklist doorlopen
2. Elke check markeren als ✅ of ❌
3. Bij ❌: EERST fixen voordat testen wordt voorgesteld
4. Aan gebruiker rapporteren:

```
📋 **Nieuwe Module Validatie: [moduleId]**

✅ NavigationDestination type
✅ ALL_MODULES array
✅ DEFAULT_MODULE_ORDER array
✅ Icon & Color definitie
✅ Module tint color
✅ i18n (13/13 talen)
✅ Navigation route
✅ Screen component

✅ **Module klaar voor testen.** Druk op ⌘R om te builden.
```

Of bij problemen:

```
📋 **Nieuwe Module Validatie: [moduleId]**

✅ NavigationDestination type
❌ ALL_MODULES array — ONTBREEKT
❌ i18n — 11/13 talen ontbreken

⚠️ **Module NIET klaar voor testen.** Bezig met fixen...
```

**Validatie Commando (optioneel):**

```bash
# Controleer of module in alle vereiste locaties aanwezig is
MODULE="appleMusic" && \
echo "=== Checking $MODULE ===" && \
grep -l "$MODULE" src/hooks/useModuleUsage.ts && \
grep -l "$MODULE" src/components/WheelNavigationMenu.tsx && \
for f in src/locales/*.json; do grep -l "\"$MODULE\"" "$f" || echo "MISSING: $f"; done
```

### Database Schema Wijziging Protocol (BLOKKEERDER)

**⚠️ KRITIEK — 3x GEFAALD:** Dit protocol bestaat omdat Claude herhaaldelijk schema wijzigingen heeft gemaakt ZONDER de bijbehorende migratie toe te voegen, wat resulteerde in data verlies (contacten verdwijnen).

**Kernregel:** `schema.ts` en `migrations.ts` zijn een ONSCHEIDBAAR PAAR. Een wijziging aan het één ZONDER het ander is een **BLOKKEERDER** en mag NOOIT worden gecommit.

**Bij ELKE schema wijziging MOET Claude:**

| Stap | Bestand | Actie | VERPLICHT |
|------|---------|-------|-----------|
| 1 | `src/models/schema.ts` | Versienummer verhogen + kolom toevoegen | ✅ |
| 2 | `src/models/migrations.ts` | Migratiestap toevoegen met `addColumns` | ✅ |
| 3 | `src/models/[Model].ts` | `@field` decorator toevoegen | ✅ |
| 4 | Verify | Controleer dat migrations.ts eindigt op DEZELFDE versie als schema.ts | ✅ |

**Stap 4 — Versie Verificatie (VERPLICHT vóór commit):**

```bash
# MOET gelijk zijn — anders is er een ontbrekende migratie!
echo "Schema version:" && grep "SCHEMA_VERSION" src/models/schema.ts
echo "Highest migration:" && grep "toVersion:" src/models/migrations.ts | tail -1
```

**Voorbeeld — CORRECT:**
```typescript
// schema.ts
export const SCHEMA_VERSION = 22;

// migrations.ts — MOET eindigen op v22
{
  toVersion: 22,
  steps: [
    addColumns({
      table: 'contacts',
      columns: [
        { name: 'email', type: 'string', isOptional: true },
      ],
    }),
  ],
},
```

**Anti-pattern (3x GEBEURD — VERBODEN):**
```
❌ schema.ts: version 22 (met email kolom)
❌ migrations.ts: eindigt op version 21 (GEEN v22 migratie)
❌ Resultaat: Database inconsistent, contacten verdwijnen
```

**Waarom dit catastrofaal is:**
- WatermelonDB ziet schema v22 maar kan niet upgraden van v21 → v22
- Bestaande database raakt corrupt
- Contacten, agenda items en andere data verdwijnen
- Gebruiker verliest data — onacceptabel voor senioren

### Conflict Resolutie Hiërarchie

1. **Security wint altijd** — Veiligheid gaat voor usability
2. **Accessibility tweede** — Toegankelijkheid is niet onderhandelbaar
3. **Senior-inclusive design derde** — Core doelgroep
4. **Performance vierde** — Belangrijk maar niet ten koste van bovenstaande
5. **Store compliance** — Moet altijd voldoen (Apple/Google)

### Coördinator

De **architecture-lead** skill is verantwoordelijk voor:
- Orchestratie van multi-skill validaties
- Conflict resolutie tussen skills
- Handhaving van het protocol

### Wijziging Classificatie (Tier Systeem)

| Tier | Type | Voorbeeld | PNA-gedrag |
|------|------|-----------|------------|
| **Tier 1** | Eenvoudig, 1 skill | Typo fix, kleur aanpassing | Geen extra overleg nodig |
| **Tier 2** | Meerdere skills, 1 module | Nieuwe knop met i18n + haptic | Standaard skill validatie |
| **Tier 3** | Cross-cutting, meerdere modules | Navigatie wijziging, nieuw component systeem, architectuur refactor | **Automatische PNA-trigger** (zie hieronder) |

### Automatische PNA-trigger voor Tier 3 (VERPLICHT)

Bij Tier 3 wijzigingen MOET Claude automatisch een PNA-achtig overlegmoment inlassen, OOK als de gebruiker niet expliciet "PNA" heeft getypt.

**Gedrag:**
1. **Classificeer** de wijziging en toon de impactanalyse
2. **Benoem** alle getroffen skills, bestanden en modules
3. **Vraag expliciet** om bevestiging vóór implementatie
4. **Stel vragen één voor één** over onduidelijke aspecten

**Verschil met echte PNA-modus:**
- Claude activeert dit **automatisch** (gebruiker hoeft niet "PNA" te typen)
- De formele PNA-regels (🔒 header, exit-bevestiging) gelden **niet**
- Claude MAG implementeren na één expliciete bevestiging van de gebruiker

**Voorbeeld:**
```
Gebruiker: "Refactor alle modals naar PanelAwareModal"

Claude:
"⚠️ **Tier 3 wijziging gedetecteerd** — Cross-cutting refactor

**Impact:**
- 12 screens geraakt
- Skills: ui-designer, accessibility-specialist, architecture-lead, react-native-expert
- Risico: Bestaande modal gedrag kan breken op iPad Split View

**Plan:**
1. Inventariseer alle Modal → PanelAwareModal migraties
2. Test elke migratie op iPhone + iPad layout
3. Valideer accessibility labels behouden blijven

Wil je dat ik hiermee doorga?"
```

### Skill Validatie in Commit Flow (VERPLICHT)

Bij ELKE commit van Tier 2 of Tier 3 wijzigingen MOET Claude een uitgebreide skill-validatie rapportage opnemen.

**Format (VERPLICHT — uitgebreid per skill):**

```
📋 **Skill Validatie Rapport**

[ui-designer] ✅
  - Touch targets: alle ≥60pt gevalideerd
  - Typography: body ≥18pt bevestigd
  - Form fields: labels boven veld, buiten border

[accessibility-specialist] ✅
  - Haptic feedback: HapticTouchable gebruikt
  - VoiceOver labels: aanwezig op alle interactieve elementen
  - Reduced motion: gerespecteerd

[security-expert] ⚠️
  - Input sanitisatie: toegevoegd (filename lastPathComponent)
  - PII logging: geen PII in console output
  - Waarschuwing: email regex niet RFC-compliant (bewuste keuze voor UX)

[react-native-expert] ✅
  - Platform compatibility: iOS + Android getest
  - Memory: geen leaks gedetecteerd
```

**Regels:**
- Elke relevante skill krijgt een eigen sectie
- Per skill: WAT specifiek is gevalideerd (niet alleen ✅/❌)
- ⚠️ waarschuwingen benoemen met rationale
- ❌ blokkeerders MOETEN opgelost worden vóór commit

### Component Registry Validatie (VERPLICHT)

CommEazy heeft een validatie-script dat component-adoptie en touch target compliance controleert.

**Script:** `scripts/validate-components.sh`

**Wat het controleert:**
1. **ModuleHeader** adoptie op module screens
2. **PanelAwareModal** adoptie (geen raw Modal)
3. **LoadingView** adoptie (geen bare ActivityIndicator)
4. **HapticTouchable** adoptie (geen raw TouchableOpacity)
5. **ErrorView** adoptie (geen Alert.alert voor errors/success/info — alleen bevestigingsdialogen)
6. **Touch target linting** (geen sub-60pt waarden)

**Gebruik:**
```bash
./scripts/validate-components.sh          # Volledig rapport
./scripts/validate-components.sh --strict # Exit 1 bij violations
```

**Claude's Verantwoordelijkheid:**
- Na het toevoegen van nieuwe screens: run het script en rapporteer resultaten
- Bij refactoring: controleer of warnings afnemen
- Bij nieuwe standaard componenten: voeg checks toe aan het script

## Quality Gates (ALL code must pass)
1. **Store Compliance** — Privacy Manifest (iOS), Data Safety (Android)
2. **Senior Inclusive** — Typography, touch targets, contrast, VoiceOver/TalkBack
3. **i18n** — All 10 languages, text expansion tested, no hardcoded strings
4. **Security** — E2E encryption verified, keys never logged, zero storage audit
5. **Performance** — Cold start <3s, 60fps scroll, memory <200MB
6. **Code Quality** — TypeScript strict, 80% coverage, zero warnings

## Ondersteunde Talen

> **Zie `CONSTANTS.md` voor de volledige lijst van 13 ondersteunde talen en text expansion percentages.**

ALLE i18n keys moeten in ALLE 13 talen aanwezig zijn.

### i18n Validatie Commando

```bash
# Check welke keys ontbreken in een taal t.o.v. nl.json
node -e "
const nl = require('./src/locales/nl.json');
const target = require('./src/locales/[TAAL].json');
const getKeys = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
  typeof v === 'object' ? getKeys(v, prefix + k + '.') : [prefix + k]
);
const nlKeys = new Set(getKeys(nl));
const targetKeys = new Set(getKeys(target));
const missing = [...nlKeys].filter(k => !targetKeys.has(k));
console.log('Missing keys:', missing.length);
missing.forEach(k => console.log('  -', k));
"
```

### i18n Completeness Validatie (BLOKKEERDER)

**⚠️ KRITIEK:** Wanneer NIEUWE i18n keys worden toegevoegd, MOETEN ALLE 13 locale bestanden worden bijgewerkt in DEZELFDE commit.

**Waarom?**
- i18next valt terug naar de default taal (nl) wanneer een key ontbreekt
- Dit maskeert het probleem tijdens development/testing
- Gebruikers zien plots Nederlandse tekst in hun taal-instellingen

**Verplichte Locales:** Zie `CONSTANTS.md` sectie "Ondersteunde Talen (i18n)" voor de volledige lijst van 13 talen.

**Claude's Workflow bij Nieuwe i18n Keys:**

1. **Identificeer** alle nieuwe keys die worden toegevoegd
2. **Valideer** dat elke key in ALLE 13 locale bestanden wordt toegevoegd
3. **Vertaal** naar elke taal (machine-vertaling is acceptabel, later te verfijnen)
4. **Rapporteer** aan gebruiker:

```
📋 **i18n Completeness Check**

Nieuwe keys toegevoegd:
- settings.newFeature.title
- settings.newFeature.description

✅ Alle 13 locale bestanden bijgewerkt:
   nl.json, en.json, en-GB.json, de.json, fr.json, es.json,
   it.json, no.json, sv.json, da.json, pt.json, pt-BR.json, pl.json
```

**Validatie Script (na wijzigingen):**

```bash
# Vergelijk alle locale bestanden met nl.json (referentie)
for lang in en en-GB de fr es it no sv da pt pt-BR pl; do
  echo "=== Checking $lang.json ==="
  node -e "
    const nl = require('./src/locales/nl.json');
    const target = require('./src/locales/${lang}.json');
    const getKeys = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
      typeof v === 'object' ? getKeys(v, prefix + k + '.') : [prefix + k]
    );
    const nlKeys = new Set(getKeys(nl));
    const targetKeys = new Set(getKeys(target));
    const missing = [...nlKeys].filter(k => !targetKeys.has(k));
    if (missing.length > 0) {
      console.log('❌ Missing', missing.length, 'keys:');
      missing.slice(0, 5).forEach(k => console.log('   -', k));
      if (missing.length > 5) console.log('   ... and', missing.length - 5, 'more');
    } else {
      console.log('✅ Complete');
    }
  "
done
```

**Wanneer NIET te blokkeren:**
- Typo fixes in bestaande vertalingen
- Aanpassen van bestaande tekst (key blijft hetzelfde)

### Configuratie Bestanden Uniformiteit (VERPLICHT)

**⚠️ KRITIEK:** Alle configuratie bestanden van hetzelfde type MOETEN identieke structuur hebben.

**Waarom?**
- Inconsistente structuur maakt diff-vergelijkingen moeilijk
- Merge conflicts zijn lastiger op te lossen
- Validatie scripts werken niet betrouwbaar
- Technische schuld accumuleert over tijd

**Geldt voor:**
- `src/locales/*.json` — Alle i18n bestanden
- Andere configuratie bestanden (indien aanwezig)

**Uniformiteitsregels:**

1. **Identieke key volgorde** — Alle bestanden MOETEN dezelfde key volgorde hebben
2. **Identieke nesting** — Secties moeten op dezelfde diepte staan
3. **Master bestand** — `nl.json` is de referentie voor structuur
4. **Nieuwe keys** — Toevoegen op EXACT dezelfde locatie in ALLE bestanden

**Validatie Script:**

```bash
# Vergelijk key volgorde tussen nl.json en andere locale
node -e "
const nl = require('./src/locales/nl.json');
const target = require('./src/locales/[TAAL].json');
const getKeys = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
  typeof v === 'object' && v !== null ? [prefix + k, ...getKeys(v, prefix + k + '.')] : [prefix + k]
);
const nlKeys = getKeys(nl);
const targetKeys = getKeys(target);
const orderDiff = nlKeys.filter((k, i) => targetKeys[i] !== k);
if (orderDiff.length > 0) {
  console.log('❌ Key volgorde verschilt op:', orderDiff.slice(0, 5));
} else {
  console.log('✅ Identieke structuur');
}
"
```

**Normalisatie Procedure (eenmalig):**

Wanneer structuurverschillen worden ontdekt:
1. Gebruik `nl.json` als master
2. Genereer genormaliseerde versies van alle andere locales
3. Behoud de vertalingen, herstel de key volgorde
4. Commit als "chore(i18n): Normalize locale file structure"

**Claude's Verantwoordelijkheid:**

Bij ELKE wijziging aan configuratie bestanden:
1. Controleer of de wijziging de structuur consistent houdt
2. Voeg nieuwe keys toe op EXACT dezelfde locatie in ALLE bestanden
3. Bij ontdekking van structuurverschillen: meld dit en bied normalisatie aan

## Code Formatting (VERPLICHT)

### JSON Bestanden

**ALLE JSON bestanden** MOETEN consistent geformatteerd zijn met:
- **2-space indentation** (geen tabs)
- **Multiline format** (één property per regel)
- **Trailing newline** (bestand eindigt met `\n`)

**❌ FOUT — Compact/single-line format:**
```json
{"app":{"name":"CommEazy"},"tabs":{"chats":"Berichten","contacts":"Contacten"}}
```

**✅ GOED — Multiline format:**
```json
{
  "app": {
    "name": "CommEazy"
  },
  "tabs": {
    "chats": "Berichten",
    "contacts": "Contacten"
  }
}
```

### Prettier Configuratie

Project gebruikt Prettier voor automatische formatting. Configuratie in `.prettierrc`:

```json
{
  "tabWidth": 2,
  "useTabs": false,
  "endOfLine": "lf"
}
```

**NPM Scripts:**
- `npm run format:locales` — Format alleen locale JSON bestanden
- `npm run format` — Format alle TypeScript en JSON bestanden

### Wanneer te Formatteren

- **Na handmatige JSON edits** — Run `npm run format:locales`
- **Bij merge conflicts in JSON** — Format na conflict resolution
- **Bij nieuwe locale bestanden** — Zorg dat ze multiline format gebruiken

## ⚠️ Documentatie Onderhoud bij Service Configuratie Wijzigingen (VERPLICHT)

### Kernregel

**Bij ELKE wijziging aan de configuratie van services (Prosody, Push Gateway, Coturn, Metro, etc.) MOETEN de bijbehorende documentatie bestanden worden bijgewerkt in DEZELFDE commit.**

Dit garandeert dat we ALTIJD een correcte referentie hebben om een productie omgeving in te richten.

### Welke Documentatie bij Welke Service

| Service wijziging | MOET bijgewerkt worden |
|-------------------|------------------------|
| **Prosody configuratie** (prosody.cfg.lua) | `LOCAL_SERVICES.md` (sectie Prosody) + `.claude/plans/PROSODY_HA_PRODUCTION.md` (Appendix A + relevante secties) |
| **Prosody modules** (mod_push_http, mod_push_call_always, etc.) | `LOCAL_SERVICES.md` (Custom Modules) + `PROSODY_HA_PRODUCTION.md` (sectie 2 + Appendix A) |
| **Push Gateway** (server.js, .env, package.json) | `LOCAL_SERVICES.md` (sectie Push Gateway) + `PROSODY_HA_PRODUCTION.md` (sectie 12 + Appendix B) |
| **Push Gateway poort/routing** | `PROSODY_HA_PRODUCTION.md` (netwerktabel, architectuurdiagram, env vars, health URLs, troubleshooting) |
| **Coturn configuratie** | `LOCAL_SERVICES.md` + `PROSODY_HA_PRODUCTION.md` (STUN/TURN secties) |
| **Metro Bundler setup** | `LOCAL_SERVICES.md` (sectie Metro Bundler) |

### Claude's Verantwoordelijkheid

Na het voltooien van een service configuratie wijziging MOET Claude:

1. **Identificeer** welke documentatie bestanden beïnvloed worden (zie tabel)
2. **Werk bij** alle relevante secties zodat documentatie exact overeenkomt met de werkelijke implementatie
3. **Rapporteer** aan gebruiker:

```
🔄 **Documentatie Onderhoud:**
Bijgewerkt n.a.v. [wijziging]:
- LOCAL_SERVICES.md: [wat gewijzigd]
- PROSODY_HA_PRODUCTION.md: [welke secties]
```

4. **Bij twijfel:** Controleer of de documentatie overeenkomt met de werkelijke bestanden/configuratie

### Wat te Controleren

Bij elke documentatie-update, valideer dat deze elementen kloppen:
- **Poortnummers** — Komen overeen met werkelijke configuratie
- **Module namen** — Alle actieve modules correct vermeld
- **Environment variabelen** — Namen en default waarden kloppen
- **Code voorbeelden** — Reflecteren de werkelijke implementatie
- **Architectuur diagrammen** — Routing paden en componenten correct
- **Health check URLs** — Juiste poort en pad
- **Troubleshooting commando's** — Gebruiken correcte poortnummers en module namen

### Referentie Documenten

| Document | Pad | Doel |
|----------|-----|------|
| **LOCAL_SERVICES.md** | `/Users/bertvancapelle/Projects/CommEazy/LOCAL_SERVICES.md` | Development omgeving referentie |
| **PROSODY_HA_PRODUCTION.md** | `.claude/plans/PROSODY_HA_PRODUCTION.md` | Productie deployment handleiding |

---

## Git Workflow (VERPLICHT)

### ⚠️ CRUCIAAL: Claude MOET proactief commits voorstellen

Dit is **niet optioneel**. Na elke logische milestone MOET Claude voorstellen om te committen en pushen.

### Wanneer Committen — ALTIJD voorstellen bij:

| Moment | Voorbeeld |
|--------|-----------|
| **Feature voltooid** | Component af en werkend |
| **Bug gefixt** | Fix voor specifiek probleem |
| **Refactor voltooid** | Code herstructurering klaar |
| **Voordat je experimenteert** | "Dit werkt, nu ga ik iets nieuws proberen" |
| **Einde werksessie** | ALTIJD committen voor je stopt |
| **Skills/docs update** | CLAUDE.md of SKILL.md gewijzigd |

### Wanneer NIET committen:

- Mid-implementatie (code compileert niet)
- Met bekende bugs die nog gefixed moeten worden
- Met debug code (`console.log` overal)

### ⚠️ Plan Continuïteit bij Onderbreking (VERPLICHT)

**KRITIEK:** Wanneer een implementatieplan (bijv. `PHOTO_ALBUM_OPTIMIZATION.md`) meerdere fasen heeft, MOET Claude:

1. **Altijd terugkeren** naar openstaande fasen na een onderbreking (bug fix, PNA discussie, context switch)
2. **Expliciet afsluiten** — Een plan is pas "klaar" wanneer ALLE fasen zijn voltooid OF expliciet uitgesteld
3. **Status rapporteren** — Bij hervatting altijd de huidige status van het plan tonen
4. **Niet vergeten** — Onderbrekingen (bugs, vragen, PNA) zijn GEEN reden om een plan te abandonneren

**Claude's gedrag bij onderbreking:**
```
[Onderbreking opgelost]

"De onderbreking is afgehandeld. Terug naar het plan:

📋 **PHOTO_ALBUM_OPTIMIZATION.md**
✅ Fase 1: Technische schuld — VOLTOOID
✅ Fase 2: UX verbeteringen — VOLTOOID
⏳ Fase 3: Albums & Organisatie — AAN DE BEURT
⏳ Fase 4: Slideshow — Wacht
⏳ Fase 5: Module integratie — Wacht

Ik ga nu door met Fase 3."
```

**Anti-pattern (VERBODEN):**
```
❌ Fase 1-2 voltooid → bug fix → PNA discussie → vergeet dat Fase 3-5 nog open staan
❌ "Het plan is klaar" terwijl er nog fasen open staan
❌ Wachten tot de gebruiker vraagt "waarom is Fase 3 niet uitgevoerd?"
```

### ⚠️ Documentation-Code Parity (VERPLICHT)

**KRITIEK:** Wanneer Claude documentatie schrijft (SKILL.md, CLAUDE.md, COORDINATION_PROTOCOL.md) die een API, component, of gedrag beschrijft dat **nog niet in code bestaat**, MOET Claude dit ALTIJD als openstaande taak markeren met een expliciete vraag aan de gebruiker.

**Waarom dit essentieel is:**
- Documentatie die code beschrijft die niet bestaat, creëert een **Documentation-Code Gap**
- Bij sessiewissel (context loss) leest een nieuwe Claude-instantie de documentatie en neemt aan dat de code al bestaat
- Dit leidt tot **Technical Function Depth** — code die verwijst naar niet-bestaande functies of props
- De gebruiker merkt dit pas wanneer de build faalt of features ontbreken

**Claude's Gedrag (VERPLICHT — GEEN UITZONDERINGEN):**

Na het vastleggen van documentatie die nieuwe code vereist, MOET Claude:

1. **Inventariseer** — Maak een expliciete lijst van alles wat in documentatie staat maar nog niet in code bestaat
2. **Rapporteer** — Toon deze lijst aan de gebruiker met ⚠️ markering
3. **Vraag** — Stel ALTIJD de vraag: **"Wil je dit nu of later oplossen?"**
4. **Bij "nu"** — Direct implementeren in dezelfde sessie
5. **Bij "later"** — Markeer als TODO in de documentatie zelf (zodat het niet verloren gaat bij sessiewissel)

**Verplicht Format:**

```
⚠️ **Openstaande Documentation-Code Gaps:**

De volgende items zijn vastgelegd in documentatie maar bestaan nog NIET in code:

1. `ErrorView.tsx` — `type="success"` (gedocumenteerd in SKILL.md sectie 16.3)
2. `ErrorView.tsx` — `autoDismiss` prop (gedocumenteerd in SKILL.md sectie 16.3)
3. `ErrorView.tsx` — `onDismiss` prop (gedocumenteerd in SKILL.md sectie 16.3)

**Wil je deze nu implementeren of later als aparte taak?**
```

**Anti-patterns (VERBODEN):**

```
❌ FOUT — Documentatie schrijven en NIET melden dat code ontbreekt:
"Ik heb de SKILL.md bijgewerkt met het nieuwe ErrorView API."
→ Gebruiker neemt aan dat code ook is aangepast

❌ FOUT — Alleen terloops benoemen zonder vraag:
"De daadwerkelijke migratie staat nog open als implementatietaak."
→ Geen expliciete vraag, geen actie-item, vergeten bij sessiewissel

✅ GOED — Expliciet melden met vraag:
"⚠️ De SKILL.md beschrijft nu `autoDismiss` en `onDismiss` props, maar ErrorView.tsx
ondersteunt deze nog niet. Wil je dat ik dit nu implementeer of later?"
```

**Scope:**

Dit geldt voor ALLE documentatie-code relaties:
- SKILL.md beschrijft API → component moet API ondersteunen
- CLAUDE.md beschrijft pattern → code moet pattern volgen
- CHANGE_VALIDATION_MATRIX.md beschrijft validatie → validatie moet werken
- Interface definities → implementatie moet bestaan

### ⚠️ Code Hygiene Check (VERPLICHT vóór commit)

**Dit is onderdeel van de commit flow.** Claude MOET deze checks uitvoeren voordat een commit wordt voorgesteld.

#### Checklist (VERPLICHT):

| Check | Wat opruimen | Hoe detecteren |
|-------|--------------|----------------|
| **Ongebruikte variabelen** | `const x = ...` die nergens gebruikt wordt | TypeScript compiler warnings |
| **Ongebruikte properties** | `private var lastTapTime` die nergens gelezen wordt | Zoek naar assignments zonder reads |
| **Ongebruikte helper functions** | `function helper()` die nergens aangeroepen wordt | Zoek naar function definitie zonder calls |
| **Ongebruikte imports** | `import { X }` waar X niet gebruikt wordt | ESLint / TypeScript warnings |
| **Commented-out code** | `// const oldCode = ...` blokken | Git bewaart historie, verwijder |

#### Claude's Gedrag:

Na refactoring of feature-wijziging MOET Claude:

1. **Controleer gewijzigde bestanden** op dead code
2. **Verwijder** gevonden dead code
3. **Rapporteer** in commit voorstel:

```
✅ [Feature] is voltooid.

🧹 **Code Hygiene:**
- Verwijderd: `lastPlayPauseTapTime` property (niet meer gebruikt)
- Verwijderd: `updateProgressAndDuration` helper (niet meer aangeroepen)

📦 **Dit is een goed moment om te committen en pushen.**
```

#### Uitzonderingen:

- **Feature flags** — Mogen blijven staan (bedoeld voor toekomstig gebruik)
- **Interface methods** — Niet-geïmplementeerde interface methods zijn OK
- **Intentional stubs** — Functies met `// TODO:` comment mogen blijven

### ⚠️ TestFlight Hygiene (VERPLICHT vóór TestFlight/Production)

**Dit is een strengere check die ALLEEN vóór TestFlight/App Store release gedaan wordt.**

#### Logging Cleanup:

| Code Type | Development | TestFlight/Production |
|-----------|-------------|----------------------|
| **NSLog debug** | ✅ Toegestaan | ❌ Verwijderen of `#if DEBUG` |
| **console.log** | ✅ Toegestaan | ❌ Verwijderen |
| **console.debug** | ✅ Toegestaan | ❌ Verwijderen |
| **console.info** | ✅ Toegestaan | ⚠️ Beoordeel per geval |
| **console.warn** | ✅ Toegestaan | ✅ Behouden |
| **console.error** | ✅ Toegestaan | ✅ Behouden |

#### Swift/Objective-C Logging Pattern:

```swift
// ❌ VERWIJDEREN vóór TestFlight:
NSLog("[GlassPlayer] Debug state: \(isPlaying)")

// ✅ BEHOUDEN (alleen in debug builds):
#if DEBUG
NSLog("[GlassPlayer] Debug state: \(isPlaying)")
#endif

// ✅ BEHOUDEN (error logging):
NSLog("[GlassPlayer] ERROR: Failed to load artwork")
```

#### React Native Logging Pattern:

```typescript
// ❌ VERWIJDEREN vóór TestFlight:
console.log('[RadioScreen] Station selected:', station.name);
console.debug('[Context] State update:', newState);

// ✅ BEHOUDEN:
console.warn('[RadioScreen] Using cached data - network unavailable');
console.error('[RadioScreen] Failed to load stations:', error.message);
```

#### TestFlight Checklist:

Wanneer gebruiker vraagt om "TestFlight klaar te maken" of "productie build":

- [ ] **Alle `NSLog` statements** → Verwijder of wrap in `#if DEBUG`
- [ ] **Alle `console.log/debug`** → Verwijder
- [ ] **PII logging check** → Geen namen, nummers, of content gelogd
- [ ] **Mock mode uit** → Zie `MOCK_MODE_CHANGES.md`
- [ ] **Privacy Manifest** → Gevalideerd
- [ ] **Bundle identifier** → Productie waarde

### ⚠️ Git LFS voor Grote Bestanden (VERPLICHT)

**GitHub blokkeert bestanden >100MB.** CommEazy gebruikt Git LFS voor grote binaire bestanden.

**Geconfigureerd in `.gitattributes`:**
```
*.onnx filter=lfs diff=lfs merge=lfs -text    # Piper TTS modellen (~60-73MB)
*.a filter=lfs diff=lfs merge=lfs -text       # sherpa-onnx static libraries (~77-157MB)
```

**Bij nieuwe grote bestanden (>50MB):**
1. Voeg bestandstype toe aan `.gitattributes`
2. Run `git lfs track "*.extensie"`
3. Commit `.gitattributes` eerst
4. Dan commit het grote bestand

**Git LFS installatie (eenmalig per machine):**
```bash
brew install git-lfs
git lfs install
```

**Bij "Large files detected" error:**
```bash
# Migreer bestaande grote bestanden naar LFS
git stash
git lfs migrate import --include="*.onnx,*.a" --everything
git stash pop
git push --force-with-lease
```

**Huidige LFS-tracked bestandstypes:**
- `*.onnx` — Piper TTS spraakmodellen (Nederlands, etc.)
- `*.a` — Native static libraries (sherpa-onnx)

### ⚠️ Commit + Push ALTIJD Samen

**Dit is een gebruikersvoorkeur.** Wanneer Claude vraagt of een commit gemaakt kan worden, voer ALTIJD zowel de commit ALS de push uit. De gebruiker doet ze toch altijd samen.

```bash
# ALTIJD beide commando's uitvoeren:
git add . && git commit -m "..." && git push
```

**Claude's gedrag:**
- ❌ NIET: "Zal ik committen?" → wacht → "Zal ik pushen?"
- ✅ WEL: "Zal ik committen en pushen?" → voer beide uit

### Na Push: Wanneer Clean Build Nodig Is

**Clean build is NIET na elke push nodig.** Incrementele builds zijn veel sneller en meestal voldoende.

#### ✅ Clean Build ALLEEN bij:

| Situatie | Waarom |
|----------|--------|
| **i18n wijzigingen** | Vertalingen worden gecached door Metro |
| **Native module wijzigingen** | .mm/.m/.swift bestanden vereisen clean build |
| **CocoaPods/dependency updates** | Nieuwe libraries moeten volledig gelinkt worden |
| **"Phantom" build errors** | Errors die niet kloppen met de code |
| **Branch wissel met grote verschillen** | Voorkomt stale object files |

#### ❌ Geen Clean Build nodig bij:

- Normale TypeScript/JavaScript wijzigingen
- Styling aanpassingen
- Component refactoring
- Nieuwe screens toevoegen

#### Clean Build Procedure (wanneer nodig):

```bash
# 1. Metro cache reset
rm -rf /Users/bertvancapelle/Projects/CommEazy/node_modules/.cache
rm -rf $TMPDIR/metro-* $TMPDIR/haste-map-*

# 2. Xcode DerivedData (alleen CommEazy)
rm -rf ~/Library/Developer/Xcode/DerivedData/CommEazyTemp-*
```

Dan in Xcode: **⌘⇧K** (Clean Build) gevolgd door **⌘R** (Build & Run).

#### Maandelijks Onderhoud (optioneel):

```bash
# Volledige Xcode cache cleanup (~2-8 GB)
rm -rf ~/Library/Developer/Xcode/DerivedData

# Ongebruikte simulators verwijderen
xcrun simctl delete unavailable
```

**Claude's post-push output (standaard):**
```
✅ Push voltooid naar origin/main

📱 **Volgende stap:** Druk op ⌘R in Xcode om te builden.
```

**Claude's post-push output (bij i18n/native wijzigingen):**
```
✅ Push voltooid naar origin/main

⚠️ **Clean build aanbevolen** — i18n/native wijzigingen gedetecteerd.
Voer uit: ⌘⇧K (Clean Build) → ⌘R (Build & Run)
```

### ⚠️ Na ELKE Push: ZIP Backup van .claude/ Configuratie

**Dit is een gebruikersvoorkeur.** Na elke succesvolle push MOET Claude automatisch een ZIP backup maken van de `.claude/` configuratie folder.

```bash
# ALTIJD uitvoeren na git push:
cd /Users/bertvancapelle/Projects/CommEazy && \
zip -r ~/Projects/CommEazy-claude-config-$(date +%Y%m%d).zip .claude/
```

**Output na backup:**
```
📦 Config backup: ~/Projects/CommEazy-claude-config-YYYYMMDD.zip
```

**Reden:** De `.claude/` folder bevat ~200KB aan waardevolle project instructies, skill definities en workflows die buiten git ook bewaard moeten blijven.

**⚠️ NOOIT VERWIJDEREN:** Config backup ZIP bestanden (`~/Projects/CommEazy-claude-config-*.zip`) mogen NOOIT worden verwijderd door opruimscripts, maandelijks onderhoud, of welke cleanup dan ook. Deze backups zijn permanent en worden handmatig beheerd door de gebruiker.

### ⚠️ Na ELKE Push: Valideer Metro, Prosody en Push Gateway Status

**Dit is een gebruikersvoorkeur.** Na elke succesvolle push MOET Claude de status van Metro, Prosody en Push Gateway valideren.

**Stappen (VERPLICHT na push):**

1. **Valideer Prosody status:**
   ```bash
   prosodyctl status
   ```
   - Als Prosody NIET draait: Meld dit aan gebruiker met `prosodyctl start` commando

2. **Valideer Metro status:**
   ```bash
   lsof -i :8081 | head -3
   ```
   - Als Metro NIET draait: Meld dit aan gebruiker met het volledige Metro start commando

3. **Valideer Prosody WebSocket:**
   ```bash
   lsof -i :5280 | head -3
   ```
   - Als poort 5280 niet luistert: Prosody draait maar WebSocket module is niet actief

4. **Valideer Push Gateway status:**
   ```bash
   lsof -i :5282 | head -3
   ```
   - Als Push Gateway NIET draait: **Claude start deze automatisch:**
     ```bash
     export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && \
     cd /Users/bertvancapelle/Projects/CommEazy/server/push-gateway && \
     nohup node server.js > /tmp/push-gateway.log 2>&1 &
     ```
   - Valideer na start met: `sleep 1 && lsof -i :5282 | head -3`
   - Check logs: `cat /tmp/push-gateway.log`

**Push Gateway Log Locatie:** `/tmp/push-gateway.log`

**Claude's post-push output met validatie:**
```
✅ Push voltooid naar origin/main
📦 Config backup: ~/Projects/CommEazy-claude-config-YYYYMMDD.zip

🔍 **Service Status:**
✅ Prosody: draait (pid XXXX)
✅ Metro: draait op :8081
✅ WebSocket: luistert op :5280
✅ Push Gateway: draait op :5282 (APNs: ready)

📱 **Volgende stap:** Druk op ⌘R in Xcode om te builden.
```

**Of bij problemen:**
```
✅ Push voltooid naar origin/main
📦 Config backup: ~/Projects/CommEazy-claude-config-YYYYMMDD.zip

🔍 **Service Status:**
❌ Prosody: NIET actief — run `prosodyctl start`
❌ Metro: NIET actief — run:
   cd /Users/bertvancapelle/Projects/CommEazy && npx react-native start --reset-cache --host 0.0.0.0
⚠️ Push Gateway: NIET actief — wordt automatisch gestart...
✅ Push Gateway: herstart succesvol op :5282
```

### Claude's Verantwoordelijkheid

Na het voltooien van een taak MOET Claude zeggen:

```
✅ [Taak] is voltooid.

📦 **Dit is een goed moment om te committen en pushen.**
Wijzigingen:
- [bestand 1]: [korte beschrijving]
- [bestand 2]: [korte beschrijving]

Zal ik de commit uitvoeren?
```

### Commit Message Format

```
[Type]: Korte beschrijving (max 50 chars)

- Detail 1
- Detail 2

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`

## Key Design Decisions
- **Abstraction layers** — XMPPService and DatabaseService interfaces allow swapping implementations without touching business logic
- **Dual-path encryption** — Threshold 8 validated by benchmark (see poc/results/)
- **7-day outbox** — Messages stored on-device, synced member-to-member
- **No hamburger menu** — Bottom tabs only, max 2 navigation levels
- **Respectful language** — Never "elderly mode" or "simple mode"

## UI Architectural Principles

### Senior-Inclusive Design (MANDATORY)

Deze principes zijn NIET "ouderen-aanpassingen" — het zijn universele design standaarden die de app beter maken voor IEDEREEN.

### 1. Typography
- **Body text:** 18pt minimum (zie `typography.body`)
- **Headings:** 24pt minimum (zie `typography.h3`)
- **Labels:** 16pt minimum (zie `typography.label`)
- **Line height:** 1.5× font size voor leesbaarheid
- **Dynamic Type:** Respecteer systeem font scaling (iOS/Android)
- Test op 200% font scale — layout mag niet breken

### 2. Touch Targets
- **Alle interactieve elementen:** 60×60pt minimum (zie `touchTargets.minimum`)
- **Spacing tussen targets:** 12pt minimum (voorkom mis-taps)
- **Primaire acties:** 72-84pt (zie `touchTargets.comfortable`, `touchTargets.large`)

### 3. Contrast & Kleur
- **Body text:** WCAG AAA (7:1 ratio) — zie `colors.textPrimary` (#1A1A1A)
- **Large text (24pt+):** WCAG AA (4.5:1) minimum
- **NOOIT kleur als enige indicator** — altijd icoon/tekst toevoegen

```typescript
// FOUT: Alleen kleur
<View style={{ backgroundColor: colors.success }} />

// GOED: Kleur + icoon + tekst
<View style={{ backgroundColor: colors.success }}>
  <Text>✓ {t('status.sent')}</Text>
</View>
```

### 4. Haptic Feedback (VERPLICHT)
Alle interactieve elementen moeten haptic feedback geven:

```typescript
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';  // of react-native-haptic-feedback

const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(
      type === 'light' ? Haptics.ImpactFeedbackStyle.Light :
      type === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy :
      Haptics.ImpactFeedbackStyle.Medium
    );
  }
};

// Gebruik in button
<TouchableOpacity onPress={() => {
  triggerHaptic('medium');
  onPress();
}}>
```

### 5. Unified Notification Pattern (Error/Success/Info)
ALLE gebruikersgerichte meldingen MOETEN via het `ErrorView` component worden getoond.
`Alert.alert()` is ALLEEN voor bevestigingsdialogen (2+ knoppen met verschillende acties).

Drie meldingstypen met **verplichte iconen** (kleur mag NOOIT enige indicator zijn):
- **error** (⚠️ rood) — blijft zichtbaar tot dismiss/retry
- **success** (✅ groen) — auto-dismiss na 3 seconden
- **info** (ℹ️ accent) — auto-dismiss na 3 seconden

```typescript
// FOUT: Alert.alert voor foutmelding
Alert.alert(t('errors.title'), t('errors.networkFailed'));

// FOUT: Technische error in Text
<Text>Error: ETIMEDOUT port 5281</Text>

// GOED: ErrorView met type, i18n tekst en herstelactie
<ErrorView
  type="error"
  title={t('errors.network.title')}
  message={t('errors.network.help')}
  onRetry={handleRetry}
/>

// GOED: Succesmelding met auto-dismiss
<ErrorView
  type="success"
  title={t('common.saved')}
  message={t('settings.savedSuccessfully')}
  autoDismiss={3000}
  onDismiss={() => setShowSuccess(false)}
/>
```

Zie ui-designer SKILL.md sectie 16 voor volledige documentatie.

### 6. Loading States
Altijd spinner + tekst combineren:

```typescript
// FOUT: Alleen spinner
<ActivityIndicator />

// GOED: Spinner + tekst
<View style={styles.loadingContainer}>
  <ActivityIndicator size="large" />
  <Text style={styles.loadingText}>{t('common.loading')}</Text>
</View>
```

### 7. Text Expansion (i18n)
Gebruik flexibele containers voor tekst die langer kan worden:

```typescript
// Text expansion vs English: DE +30%, FR +20%, ES +15%, NL +10%

// FOUT: Vaste breedte
<View style={{ width: 200 }}>
  <Text>{t('button.create_group')}</Text>
</View>

// GOED: Flexibele container
<View style={{ flexShrink: 1, maxWidth: '80%' }}>
  <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
    {t('button.create_group')}
  </Text>
</View>
```

### 8. Reduced Motion
Respecteer systeem reduced motion instellingen:

```typescript
import { AccessibilityInfo } from 'react-native';

const [reduceMotion, setReduceMotion] = useState(false);

useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  const subscription = AccessibilityInfo.addEventListener(
    'reduceMotionChanged',
    setReduceMotion
  );
  return () => subscription.remove();
}, []);

// Gebruik
const animationDuration = reduceMotion ? 0 : animation.normal;
```

### 9. Accessibility Labels (VERPLICHT)
Alle interactieve elementen moeten accessibility labels hebben:

```typescript
<TouchableOpacity
  accessibilityRole="button"
  accessibilityLabel={t('chat.send_message')}
  accessibilityHint={t('chat.send_message_hint')}
  accessibilityState={{ disabled: isDisabled }}
>
```

### 10. Flow Simplicity
- **Max 3 stappen** per user flow (bericht sturen, bellen, groep maken)
- **Max 2 niveaus** navigatie diepte
- Elk scherm heeft één duidelijke primaire actie
- Terug-knop altijd zichtbaar en groot
- Geen verborgen gestures — elk gesture heeft een button alternatief

### 10b. Hold Gesture Exclusivity (VERPLICHT)

**UI PRINCIPE: Bij een long-press gesture wordt ALLEEN de hold-actie uitgevoerd, NIET beide.**

Wanneer een gebruiker een long-press gesture uitvoert (voor navigatie wheel of voice commands),
mag het onderliggende tappable element NIET ook zijn `onPress` handler uitvoeren.

**Probleem:**
```typescript
// FOUT: Beide acties worden uitgevoerd
// 1. Gebruiker houdt vinger op picker field
// 2. Na 800ms: hold gesture voltooid → menu opent
// 3. Vinger loslaten → picker onPress viert ook → field wordt geactiveerd
```

**Oplossing:**
CommEazy gebruikt `HoldGestureContext` om dit te voorkomen:

```typescript
// HoldToNavigateWrapper roept aan wanneer gesture voltooid is:
holdGesture.consumeGesture();

// Componenten die dit gedrag moeten respecteren gebruiken:
import { useHoldGestureGuard } from '@/contexts/HoldGestureContext';

function MyComponent({ onPress }: Props) {
  // Wrap onPress om te skippen wanneer hold gesture net is voltooid
  const guardedOnPress = useHoldGestureGuard(onPress);

  return (
    <TouchableOpacity onPress={guardedOnPress}>
      ...
    </TouchableOpacity>
  );
}
```

**Wanneer `useHoldGestureGuard` te gebruiken:**
- Picker fields (land, taal, etc.)
- Modale triggers
- Elke tappable die ook lang ingedrukt kan worden

**Implementatie details:**
- `consumeGesture()` markeert timestamp wanneer hold voltooid is
- `isGestureConsumed()` checkt of <300ms geleden een gesture was voltooid
- Guard wrapper skipt onPress automatisch wanneer gesture consumed is

**⚠️ KRITIEK: TouchableOpacity onLongPress Pattern (VERPLICHT)**

React Native's `TouchableOpacity` heeft een belangrijk gedrag:
- **Zonder `onLongPress`:** `onPress` fired bij ELKE touch release, ongeacht duur
- **Met `onLongPress`:** `onPress` fired NIET als touch langer dan `delayLongPress` was

Dit is de PRIMAIRE verdediging tegen double-action:

```typescript
// ❌ FOUT — veroorzaakt double-action
<TouchableOpacity onPress={() => handleAction()}>

// ✅ GOED — voorkomt double-action
<TouchableOpacity
  onPress={() => handleAction()}
  onLongPress={() => {}}  // Lege handler blokkeert onPress na long-press
  delayLongPress={300}    // Match HoldGestureContext timing
>
```

**Waar dit toepassen:**
- Alle lijst items (contacten, berichten, stations, episodes)
- Cards en klikbare rijen
- Alle `TouchableOpacity` binnen HoldToNavigateWrapper scope

**Twee-laagse bescherming:**
1. **`onLongPress={() => {}}`** — Primaire blokkade (React Native niveau)
2. **`useHoldGestureGuard()`** — Backup voor edge cases (HoldGestureContext niveau)

**⚠️ AANBEVOLEN: Gebruik `HapticTouchable` in plaats van raw `TouchableOpacity`**

`HapticTouchable` (uit `@/components`) bundelt ALLE drie beschermingen automatisch:
- ✅ Haptic feedback (via `useFeedback`)
- ✅ Empty `onLongPress` handler (blokkeert onPress na long-press)
- ✅ Hold gesture guard (via `useHoldGestureGuard`)

```typescript
// ❌ OUD — handmatig alles toevoegen
<TouchableOpacity
  onPress={() => handleAction()}
  onLongPress={() => {}}
  delayLongPress={300}
>

// ✅ NIEUW — alles ingebouwd
import { HapticTouchable } from '@/components';

<HapticTouchable onPress={handleAction}>
  <Text>Tap me</Text>
</HapticTouchable>

// Opt-out props beschikbaar:
// hapticDisabled — geen haptic (bijv. decoratief element)
// longPressGuardDisabled — geen guard (bijv. buiten HoldToNavigateWrapper)
// hapticType — override feedback type ('tap' | 'success' | 'warning' | 'error' | 'navigation')
```

### 10c. UX Consistentie Principe (VERPLICHT)

**UI PRINCIPE: Dezelfde gesture MOET hetzelfde gedrag opleveren, ongeacht device of scherm.**

Long-press navigatie MOET consistent zijn over:
- **iPhone (single-pane):** Long-press → WheelNavigationMenu (circulair)
- **iPad Split View (dual-pane):** Long-press → WheelNavigationMenu (circulair)

Dit voorkomt verwarring bij senioren die wisselen tussen iPhone en iPad, of bij gebruik van dezelfde iPad in verschillende oriëntaties.

**❌ FOUT — Inconsistente UX:**
```typescript
// iPhone: WheelNavigationMenu (circulair)
// iPad: ModulePickerModal (lijst)
// → Senioren raken in de war bij device-wissel
```

**✅ GOED — Consistente UX:**
```typescript
// ModulePanel (iPad Split View)
<WheelNavigationMenu
  visible={isWheelMenuOpen}
  onNavigate={handleWheelNavigate}  // → setPanelModule(panelId, destination)
  onClose={handleWheelClose}
  activeScreen={moduleId}
/>

// HoldToNavigateWrapper (iPhone)
<WheelNavigationMenu
  visible={isWheelMenuOpen}
  onNavigate={onNavigate}
  onClose={handleClose}
  activeScreen={activeScreen}
/>
```

**Wanneer dit principe te controleren:**
- Nieuwe navigatie componenten
- Device-specifieke layouts (iPhone vs iPad)
- Gesture handlers

**Implementatie locaties:**
- `src/components/navigation/ModulePanel.tsx` — iPad Split View panels
- `src/components/HoldToNavigateWrapper.tsx` — iPhone/universal

### 10d. Unified Button Styling (VERPLICHT)

**UI PRINCIPE: Alle knoppen in ModuleHeader, MiniPlayer en FullPlayer MOETEN dezelfde visuele stijl hebben.**

Dit geldt voor zowel React Native componenten als Native Swift (Liquid Glass) players.

#### Standaard Knop Stijl

| Eigenschap | Waarde | Opmerking |
|------------|--------|-----------|
| **Vorm** | Afgerond vierkant | NOOIT circulair |
| **Grootte** | 60×60pt minimum | `touchTargets.minimum` |
| **cornerRadius** | 12pt | `borderRadius.md` |
| **backgroundColor** | `rgba(255, 255, 255, 0.15)` | Subtiele witte vulling |
| **Border** | Optioneel (user setting) | Default: uit |

#### React Native Implementatie

```typescript
// Standaard knop stijl (ModuleHeader, ExpandedAudioPlayer, etc.)
buttonStyle: {
  width: touchTargets.minimum,          // 60pt
  height: touchTargets.minimum,         // 60pt
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  borderRadius: borderRadius.md,        // 12pt
  justifyContent: 'center',
  alignItems: 'center',
  // Optionele border via ButtonStyleContext
  borderWidth: buttonBorderEnabled ? 2 : 0,
  borderColor: buttonBorderColor,
}
```

#### Native Swift Implementatie (iOS 26+ Glass Player)

```swift
// MiniPlayerNativeView.swift & FullPlayerNativeView.swift
private enum Layout {
    static let buttonSize: CGFloat = 60       // 60pt (niet 44pt!)
    static let buttonCornerRadius: CGFloat = 12  // Afgerond vierkant (niet size/2!)
}

// Toepassen op alle knoppen:
button.layer.cornerRadius = Layout.buttonCornerRadius  // 12pt
button.backgroundColor = UIColor.white.withAlphaComponent(0.15)
```

#### Gebruikers Instelling: Knoprand

**Locatie:** Instellingen → Weergave & Kleuren

**Settings:**
- `buttonBorderEnabled`: boolean (default: `false`)
- `buttonBorderColor`: hex string uit palette (16 accent kleuren + wit + zwart)

**AsyncStorage keys:**
- `@commeazy/buttonBorderEnabled`
- `@commeazy/buttonBorderColor`

**Bridge naar Native (realtime):**
```typescript
// glassPlayer.ts
configureButtonStyle(config: {
  borderEnabled: boolean;
  borderColor: string;  // hex
}): void;
```

#### Verboden Patterns

```typescript
// ❌ FOUT — Circulaire knoppen
button.layer.cornerRadius = buttonSize / 2

// ❌ FOUT — Geen achtergrond op interactieve elementen
button.backgroundColor = .clear

// ❌ FOUT — Knoppen kleiner dan 60pt
button.widthAnchor.constraint(equalToConstant: 44)

// ❌ FOUT — Inconsistente cornerRadius
playButton.layer.cornerRadius = 12
stopButton.layer.cornerRadius = 22  // Inconsistent!
```

#### Checklist bij Nieuwe Knoppen

- [ ] Grootte ≥60×60pt
- [ ] cornerRadius = 12pt (afgerond vierkant)
- [ ] Achtergrond `rgba(255, 255, 255, 0.15)`
- [ ] Border respecteert `ButtonStyleContext` setting
- [ ] Accessibility label aanwezig
- [ ] Haptic feedback bij tap

### 11. Voice Interaction Architecture (VERPLICHT)

CommEazy heeft **spraakbesturing als kernfunctie**, niet als optionele toegankelijkheidsfunctie. ALLE modules MOETEN voice interactions ondersteunen volgens deze architectuur.

#### 11.1 Voice Command Framework

Alle voice commands zijn **configureerbaar per gebruiker** en worden centraal beheerd:

```
src/
  types/
    voiceCommands.ts      ← Type definities (VERPLICHT)
  services/
    voiceSettings.ts      ← AsyncStorage persistence
  contexts/
    VoiceSettingsContext.tsx  ← App-wide settings provider
    VoiceFocusContext.tsx     ← Focus management voor lijsten
  hooks/
    useVoiceCommands.ts       ← Speech recognition + command parsing
    useVoiceSettings.ts       ← Settings hook
```

#### 11.2 Command Categorieën

Elke module MOET de relevante command categorieën implementeren:

| Categorie | Commands | Gebruik |
|-----------|----------|---------|
| **navigation** | "contacten", "berichten", "instellingen" | Navigatie tussen schermen |
| **list** | "volgende", "vorige", "open" | Navigatie binnen lijsten |
| **form** | "pas aan", "wis", "dicteer", "bevestig" | Formulier interacties |
| **action** | "bel", "stuur bericht", "verwijder" | Directe acties op items |
| **media** | "stuur", "foto", "speel", "pauze" | Media gerelateerde acties |
| **session** | "stop", "help" | Voice session control |
| **confirmation** | "ja", "nee", "annuleer" | Bevestigingsdialogen |

#### 11.3 Standaard Commando's per Taal

Alle commando's hebben synoniemen en zijn beschikbaar in 10 talen:

```typescript
// types/voiceCommands.ts
interface VoiceCommand {
  id: string;                     // 'next', 'previous', 'open', etc.
  category: VoiceCommandCategory;
  action: string;                 // Technische actie naam
  defaultPatterns: Record<Language, string[]>;  // Per taal
  customPatterns: string[];       // Door gebruiker toegevoegd
  isEnabled: boolean;
}

// Voorbeeld: 'next' commando
const nextCommand: VoiceCommand = {
  id: 'next',
  category: 'list',
  action: 'focusNext',
  defaultPatterns: {
    nl: ['volgende', 'verder', 'door'],
    en: ['next', 'forward'],
    de: ['nächste', 'weiter'],
    fr: ['suivant', 'prochain'],
    es: ['siguiente', 'adelante'],
  },
  customPatterns: [],
  isEnabled: true,
};
```

#### 11.4 Voice Session Mode

Na activatie van voice control blijft de sessie actief:

**Activatie:**
- Twee-vinger tap ergens op scherm
- Of: tik op FloatingMicIndicator

**Tijdens sessie:**
- FloatingMicIndicator zichtbaar (zwevende microfoon)
- Pulserende animatie tijdens luisteren
- Automatische herstart na elk commando
- 30s timeout → sessie stopt automatisch

**Implementatie in ELKE module:**
```typescript
// Check of voice session actief is
const { isVoiceSessionActive } = useVoiceFocusContext();

// Registreer acties die via voice bereikbaar moeten zijn
useVoiceAction('call', handleCall, { label: contactName });
useVoiceAction('message', handleSendMessage, { label: t('chat.send') });
```

#### 11.4a Audio Conflict Handling (⚠️ TODO - NIET VERGETEN)

**KRITIEK:** Voice commands MOETEN correct omgaan met actieve audio streams. Dit is nog NIET geïmplementeerd.

**Scenario's en vereist gedrag:**

| Situatie | Bij twee-vinger tap | Voice commands beschikbaar |
|----------|---------------------|---------------------------|
| **Geen audio** | Start voice session normaal | Alle commands |
| **Media speelt** (Radio/Podcast/Music) | Duck audio naar 15% → luister → restore 100% | Alle commands + "pauze", "stop" |
| **Actief telefoongesprek** | Geen ducking (gesprek prioriteit) | Alleen call-commands: "ophangen", "mute", "luidspreker" |
| **Actief videogesprek** | Geen ducking (gesprek prioriteit) | Alleen call-commands: "ophangen", "mute", "camera uit" |

**Prioriteit Hiërarchie:**
```
1. Call actief?     → ALLEEN call-specifieke voice commands
2. Audio speelt?    → Duck audio → luister → restore volume
3. Geen audio?      → Normale voice command flow
```

**Implementatie vereisten:**

```typescript
// src/contexts/VoiceSessionContext.tsx
interface VoiceSessionState {
  isActive: boolean;
  activeAudioSource: 'none' | 'media' | 'call' | 'video-call';
  originalVolume: number;  // Voor restore na ducking
}

// Bij voice session start:
const startVoiceSession = async () => {
  const callState = useCallContext();
  const mediaState = useMediaPlaybackContext();

  if (callState.isInCall) {
    // Alleen call-commands registreren
    setAvailableCommands(CALL_ONLY_COMMANDS);
    // GEEN audio ducking — gesprek heeft prioriteit
  } else if (mediaState.isPlaying) {
    // Duck audio
    setOriginalVolume(await getSystemVolume());
    await setSystemVolume(0.15);  // 15%
    setAvailableCommands(ALL_COMMANDS);
  } else {
    setAvailableCommands(ALL_COMMANDS);
  }
};

// Bij voice session stop:
const stopVoiceSession = async () => {
  if (originalVolume !== null) {
    await setSystemVolume(originalVolume);  // Restore
  }
};
```

**Native module vereist:**
- `AudioDuckingModule` voor iOS (AVAudioSession ducking)
- Volume control via system API

**Bestanden te maken:**
```
src/
  services/
    audioDucking.ts           ← Cross-platform interface
  native/
    ios/
      AudioDuckingModule.swift  ← AVAudioSession implementation
      AudioDuckingModule.m      ← Bridge
```

**Status:** ⏳ TODO — Moet geïmplementeerd worden voor v1.0

#### 11.5 Voice Focusable Lijsten (VERPLICHT voor lijsten >3 items)

```typescript
import { VoiceFocusable, useVoiceFocusList } from '@/contexts/VoiceFocusContext';

function ContactListScreen() {
  // Registreer lijst — alleen als scherm gefocust is
  const isFocused = useIsFocused();

  const voiceFocusItems = useMemo(() => {
    if (!isFocused) return []; // Voorkom registratie op andere tabs
    return contacts.map((contact, index) => ({
      id: contact.jid,
      label: contact.name,  // Menselijke naam voor voice matching
      index,
      onSelect: () => handleContactPress(contact),
    }));
  }, [contacts, isFocused]);

  const { scrollRef } = useVoiceFocusList('contact-list', voiceFocusItems);

  return (
    <ScrollView ref={scrollRef}>
      {contacts.map((contact, index) => (
        <VoiceFocusable
          key={contact.jid}
          id={contact.jid}
          label={contact.name}
          index={index}
          onSelect={() => handleContactPress(contact)}
        >
          <ContactListItem contact={contact} />
        </VoiceFocusable>
      ))}
    </ScrollView>
  );
}
```

#### 11.6 Multi-Match Voice Navigation

Bij meerdere matches op een naam (bijv. "maria" → "Oma Maria" + "Tante Maria"):

**Gedrag:**
1. Eerste/beste match krijgt focus
2. Systeem kondigt aan: "Oma Maria, 2 resultaten. Zeg 'volgende' voor meer."
3. "Volgende"/"Vorige" navigeert binnen matches (niet hele lijst)
4. "Tante Maria, 2 van 2" → context bij elke navigatie

**Filter reset bij:**
- Nieuwe naam-zoekopdracht (ander woord)
- Session stop
- Geen matches gevonden

**Implementatie (automatisch via VoiceFocusContext):**
```typescript
// focusByName() slaat matches automatisch op
const matches = voiceFocus.focusByName('maria');
// matches.length > 1 → activeNameFilter wordt gezet

// focusNext()/focusPrevious() respecteren activeNameFilter
// → navigeert binnen matches, niet hele lijst

// Toegang tot huidige filter state:
const { activeNameFilter, clearNameFilter } = useVoiceFocusContext();
// activeNameFilter: { query: 'maria', matches: [...], currentIndex: 0 }
```

**Accessibility announcements (alle 10 talen):**
- `voiceCommands.multipleMatches`: "{{name}}, {{count}} resultaten gevonden. Zeg 'volgende' voor meer."
- `voiceCommands.focusedOnMatch`: "{{name}}, {{current}} van {{total}}"
- `voiceCommands.endOfMatches`: "Terug naar eerste resultaat"

#### 11.7 Voice Focus Styling

- Gefocust item: 4px border in `accentColor.primary`
- Subtiele achtergrond tint (accent color op 10% opacity)
- Pulserende border animatie (accent ↔ wit, 600ms)
- Scale 1.02x (respecteert reduced motion)

#### 11.8 Formulier Voice Interactions

ELKE formulier veld MOET voice dicteren ondersteunen:

```typescript
function VoiceTextField({
  label,
  value,
  onChangeText,
  voiceFieldId,  // Uniek ID voor voice targeting
}: Props) {
  const { isVoiceSessionActive, registerFormField } = useVoiceFormContext();

  // Registreer veld voor voice targeting
  useEffect(() => {
    registerFormField(voiceFieldId, {
      label,
      onEdit: () => inputRef.current?.focus(),
      onClear: () => onChangeText(''),
      onDictate: (text) => onChangeText(text),
    });
  }, [voiceFieldId, label]);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        accessibilityHint={
          isVoiceSessionActive
            ? t('a11y.voiceFieldHint', 'Zeg "pas aan" om te bewerken')
            : undefined
        }
      />
    </View>
  );
}
```

#### 11.8 Bevestigingsdialogen

Destructieve acties MOETEN voice-confirmeerbaar zijn:

```typescript
// Bij verwijderen, uitloggen, etc.
showVoiceConfirmation({
  title: t('confirm.delete.title'),
  message: t('confirm.delete.message', { name: contactName }),
  confirmLabel: t('common.delete'),     // "ja" of "verwijder" activeert
  cancelLabel: t('common.cancel'),      // "nee" of "annuleer" activeert
  onConfirm: handleDelete,
  onCancel: closeDialog,
});
```

#### 11.9 Voice Settings in Instellingen

Gebruikers kunnen alle commando's bekijken en aanpassen:

```
Instellingen
└── Spraakbesturing
    ├── Spraakbesturing aan/uit
    ├── Commando's aanpassen
    │   ├── Navigatie (volgende, vorige, ...)
    │   ├── Lijsten (open, selecteer, ...)
    │   ├── Formulieren (pas aan, wis, ...)
    │   └── Sessie (stop, help, ...)
    ├── Standaard herstellen
    └── Exporteren / Importeren
```

#### 11.10 Module Implementatie Checklist

Bij het bouwen van ELKE nieuwe module, valideer:

- [ ] **Lijsten >3 items:** VoiceFocusable wrappers aanwezig
- [ ] **Formulieren:** Alle velden voice-dicteerbaar
- [ ] **Acties:** Primaire acties voice-triggerable
- [ ] **Bevestigingen:** Destructieve acties via voice bevestigbaar
- [ ] **Labels:** Alle voice labels zijn menselijke namen (niet technische IDs)
- [ ] **i18n:** Voice commands in alle 10 talen gedefinieerd
- [ ] **Settings:** Nieuwe commands toegevoegd aan settings schema

---

### 12. Media Module Design Principles (Radio/Podcast/Audiobook)

Bij het bouwen van media modules (Radio, Podcast, Luisterboek) MOETEN de volgende patterns worden toegepast:

#### 12.1 Mini-Player + Expandable Modal Pattern

**Probleem:** Full-screen players blokkeren navigatie — senioren kunnen niet wisselen tussen tabs terwijl muziek speelt.

**Oplossing:**
- Content lijst ALTIJD zichtbaar (niet geblokkeerd door player)
- Mini-player bar aan onderkant (compact, niet blokkerend)
- Tap op mini-player → expand naar full-screen modal
- Modal kan altijd gesloten worden met IconButton (chevron-down)

```typescript
// Mini-player bar
{isPlaying && (
  <TouchableOpacity style={styles.miniPlayer} onPress={() => setIsExpanded(true)}>
    <Image source={{ uri: artwork }} style={styles.miniArtwork} />
    <Text style={styles.miniTitle}>{station.name}</Text>
    <IconButton icon={isPlaying ? 'pause' : 'play'} onPress={handlePlayPause} />
  </TouchableOpacity>
)}

// Expanded modal
<Modal visible={isExpanded} animationType="slide">
  <SafeAreaView style={styles.expandedPlayer}>
    <IconButton icon="chevron-down" onPress={() => setIsExpanded(false)} />
    {/* Full player controls */}
  </SafeAreaView>
</Modal>
```

#### 12.2 ModuleHeader Component (VERPLICHT)

Elke module MOET de gestandaardiseerde `ModuleHeader` component gebruiken:

```typescript
import { ModuleHeader } from '@/components';

// In module screen:
<ModuleHeader
  moduleId="radio"
  icon="radio"
  title={t('modules.radio.title')}
  currentSource="radio"
  showAdMob={true}
/>
```

**ModuleHeader Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  Safe Area (notch/Dynamic Island)                             │
├──────────────────────────────────────────────────────────────┤
│  📻 Radio                              🔊 [MediaIndicator]    │
│  ↑ Links (spacing.md)                  ↑ Rechts (spacing.md)  │
├──────────────────────────────────────────────────────────────┤
│  [═══════════ AdMob Banner ═══════════════════]              │
├──────────────────────────────────────────────────────────────┤
│  ─ ─ ─ ─ ─ ─ ─  Separator line (1pt) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
└──────────────────────────────────────────────────────────────┘
```

**Specificaties:**
- Icon + Title: LINKS uitgelijnd met `spacing.md` (16pt) padding
- MediaIndicator: RECHTS uitgelijnd met `spacing.md` (16pt) padding en ≥60pt touch target
- AdMob: BINNEN de gekleurde header zone, onder de title row
- Separator: Dunne lijn (1pt) `rgba(255, 255, 255, 0.2)` als visuele scheiding

**Props:**
- `moduleId`: string — voor kleur lookup
- `icon`: IconName — module icoon
- `title`: string — module naam (via t())
- `currentSource`: 'radio' | 'podcast' | 'books' — voorkomt dubbele MediaIndicator
- `showAdMob`: boolean — default true, false voor premium users

#### 12.3 Welcome Modal voor First-Time Users

**VERPLICHT:** Elke nieuwe module MOET een welcome modal tonen bij eerste gebruik:

```typescript
// AsyncStorage key: {module}_welcome_shown
useEffect(() => {
  AsyncStorage.getItem('radio_welcome_shown').then((value) => {
    if (!value) setShowWelcome(true);
  });
}, []);
```

Modal bevat genummerde stappen (1, 2, 3...) met duidelijke instructies en één "Begrepen" button.

#### 12.4 Error Banners met TEXT Dismiss Button

Playback errors MOETEN dismissable zijn met een TEKST button (niet icon-only):

```typescript
{playbackError && (
  <View style={styles.errorBanner}>
    <Icon name="warning" color={colors.error} />
    <Text>{t('modules.radio.playbackErrorTitle')}</Text>
    {/* TEKST button, niet alleen X icoon */}
    <TouchableOpacity onPress={() => setPlaybackError(null)}>
      <Text style={styles.errorDismissText}>{t('common.dismiss')}</Text>
    </TouchableOpacity>
  </View>
)}
```

#### 12.5 Module-Specific Color Coding

Elke module heeft een unieke kleur consistent met WheelNavigationMenu:

| Module | Kleur | Hex |
|--------|-------|-----|
| Radio | Teal | `#00897B` |
| Podcast | Paars | `#7B1FA2` |
| Luisterboek | Amber | `#FF8F00` |
| E-book | Indigo | `#303F9F` |

#### 12.6 Media Module Implementatie Checklist

Bij ELKE nieuwe media module:

- [ ] **ModuleHeader component** met `moduleId`, `icon`, `title`, `currentSource`
- [ ] **AdMob in ModuleHeader** — `showAdMob={true}` (default)
- [ ] `UnifiedMiniPlayer` + `UnifiedFullPlayer` pattern (gestandaardiseerde componenten)
- [ ] `moduleId` prop correct op beide componenten
- [ ] Welcome modal voor first-time users (AsyncStorage)
- [ ] Error banner met TEKST dismiss button
- [ ] Module-specific color consistent met WheelNavigationMenu
- [ ] Artwork validation via artworkService (geen broken images)
- [ ] Buffering indicator met reduced motion support
- [ ] Dynamic bottom padding voor mini-player floating element
- [ ] VoiceFocusable wrappers voor content lijsten
- [ ] Accessibility announcements voor playback state changes
- [ ] iOS `audio` background mode in Info.plist

---

### 13. Gestandaardiseerde AudioPlayer Architectuur (VERPLICHT)

Alle audio modules (Radio, Podcast, Books/TTS) MOETEN dezelfde gedeelde AudioPlayer componenten gebruiken met configureerbare controls.

#### 13.1 Architectuur Principe

**Eén component, meerdere varianten:** In plaats van aparte players per module, gebruiken we gedeelde componenten met props die bepalen welke controls zichtbaar zijn.

**Niet-gebruikte controls:** Volledig verborgen (niet greyed-out) — dit is eenvoudiger en minder verwarrend voor senioren.

#### 13.2 UnifiedMiniPlayer Component

```typescript
interface UnifiedMiniPlayerProps {
  moduleId: ModuleColorId;    // Module identifier for Liquid Glass tint
  artwork: string | null;
  title: string;
  subtitle?: string;
  placeholderIcon?: IconName; // Shown when no artwork

  isPlaying: boolean;
  isLoading: boolean;

  onPress: () => void;        // Expand naar full-screen
  onPlayPause: () => void;
  onStop: () => void;         // Stop + clear (altijd aanwezig)

  progressType: 'bar' | 'duration';
  progress?: number;          // 0-1, alleen voor "bar" type
  listenDuration?: number;    // Seconden, alleen voor "duration" type

  onDismiss?: () => void;     // Swipe-to-dismiss (audio speelt door)
  style?: StyleProp<ViewStyle>;
}
```

**Per Module:**
| Module | progressType | placeholderIcon | Wat wordt getoond |
|--------|--------------|-----------------|-------------------|
| Radio | `duration` | `"radio"` | "🎧 45:32" + Stop button |
| Podcast | `bar` | `"podcast"` | Progress bar + Stop button |
| Books | `bar` | `"book"` | Progress bar + Stop button |
| Apple Music | `bar` | — | Progress bar + Stop button |
| HomeScreen | varies | — | Via `useActivePlayback()` hook |

#### 13.3 UnifiedFullPlayer Component

```typescript
interface UnifiedFullPlayerProps {
  visible: boolean;
  moduleId: ModuleColorId;
  artwork: string | null;
  title: string;
  subtitle?: string;
  placeholderIcon?: IconName;

  isPlaying: boolean;
  isLoading: boolean;
  isBuffering: boolean;

  onPlayPause: () => void;
  onStop: () => void;
  onClose: () => void;

  // Seek (podcast, books, apple music — omit for radio)
  position?: number;
  duration?: number;
  onSeek?: (position: number) => void;

  // Skip (omit for radio)
  onSkipBackward?: () => void;
  onSkipForward?: () => void;
  skipBackwardLabel?: string;   // "10" (seconds)
  skipForwardLabel?: string;    // "30" (seconds)

  // Speed (podcast, books — omit for radio/apple music)
  playbackRate?: number;
  onSpeedPress?: () => void;

  // Shuffle/Repeat (apple music only)
  shuffleMode?: ShuffleMode;    // 'off' | 'songs'
  onShufflePress?: () => void;
  repeatMode?: RepeatMode;      // 'off' | 'one' | 'all'
  onRepeatPress?: () => void;

  // Favorite
  isFavorite?: boolean;
  onFavoritePress?: () => void;

  // Sleep timer
  sleepTimerMinutes?: number;
  onSleepTimerPress?: () => void;

  // Listen duration (radio only)
  listenDuration?: number;

  // Apple Music specific
  isInLibrary?: boolean;
  isAddingToLibrary?: boolean;
  onAddToLibraryPress?: () => void;
  queueCount?: number;
  onQueuePress?: () => void;
  showAirPlay?: boolean;
}
```

**Design beslissingen:**
- Geen AdMob in FullPlayer (design decision — geen ads in immersive view)
- Geen `controls` object — controls zijn conditioneel: niet opgegeven = verborgen
- `moduleId` vervangt `accentColor` — kleur komt via `useModuleColor()` hook
- Liquid Glass op play/pause button (iOS 26+)
- Senior-inclusive: 72pt play button, 60pt control buttons

#### 13.4 Per Module Configuratie

| Control | Radio | Podcast | Books (TTS) | Apple Music |
|---------|-------|---------|-------------|-------------|
| **showAdMob** | ✅ | ✅ | ✅ | ❌ |
| **seekSlider** | ❌ | ✅ | ✅ | ✅ |
| **skipButtons** | ❌ | ✅ (10s/30s) | ✅ (10s/30s) | ✅ |
| **stop** | ✅ | ✅ | ✅ | ✅ |
| **speedControl** | ❌ | ✅ | ✅ | ❌ |
| **sleepTimer** | ✅ | ✅ | ✅ | ✅ |
| **favorite** | ✅ | ✅ | ❌ | ✅ |
| **listenDuration** | ✅ | ❌ | ❌ | ❌ |
| **shuffle** | ❌ | ❌ | ❌ | ✅ |
| **repeat** | ❌ | ❌ | ❌ | ✅ |

**Skip Button Durations (standaard):**
- **Backward:** 10 seconden
- **Forward:** 30 seconden

Dit verschil is bedoeld: terug-skippen is vaak om iets opnieuw te horen (korte sprong), vooruit-skippen is om content over te slaan (langere sprong).

#### 13.5 Implementatie Voorbeeld

```typescript
// Radio: Live stream player (geen seek, geen skip)
<UnifiedFullPlayer
  visible={isPlayerExpanded}
  moduleId="radio"
  artwork={metadata?.artwork || station.favicon || null}
  title={metadata?.title || station.name}
  subtitle={metadata?.artist || station.name}
  placeholderIcon="radio"
  isPlaying={isPlaying}
  isLoading={isLoading}
  isBuffering={isBuffering}
  onPlayPause={handlePlayPause}
  onStop={() => { stop(); setIsPlayerExpanded(false); }}
  onClose={() => setIsPlayerExpanded(false)}
  listenDuration={position}
  isFavorite={isFavorite(station)}
  onFavoritePress={() => toggleFavorite(station)}
  sleepTimerMinutes={sleepTimerMinutes}
  onSleepTimerPress={handleSleepTimerToggle}
/>

// Podcast: On-demand player (seek + skip + speed)
<UnifiedFullPlayer
  visible={isPlayerExpanded}
  moduleId="podcast"
  artwork={episode.artwork || show.artwork || null}
  title={episode.title}
  subtitle={show.title}
  placeholderIcon="podcast"
  isPlaying={isPlaying}
  isLoading={isLoading}
  isBuffering={isBuffering}
  onPlayPause={handlePlayPause}
  onStop={() => { stop(); setIsPlayerExpanded(false); }}
  onClose={() => setIsPlayerExpanded(false)}
  position={progress.position}
  duration={progress.duration}
  onSeek={seekTo}
  onSkipBackward={() => skipBackward()}
  onSkipForward={() => skipForward()}
  skipBackwardLabel="10"
  skipForwardLabel="30"
  playbackRate={playbackRate}
  onSpeedPress={handleSpeedPress}
  isFavorite={isSubscribed(show.id)}
  onFavoritePress={() => toggleSubscribe(show)}
  sleepTimerMinutes={sleepTimerMinutes}
  onSleepTimerPress={handleSleepTimerToggle}
/>
```

#### 13.6 AudioPlayer Implementatie Checklist

Bij het gebruik van Unified AudioPlayer componenten:

- [ ] Gebruik `UnifiedMiniPlayer` voor compacte weergave onderaan scherm
- [ ] Gebruik `UnifiedFullPlayer` voor full-screen modal
- [ ] `moduleId` prop correct ingesteld (voor Liquid Glass tint)
- [ ] Radio: `progressType="duration"` met `listenDuration`
- [ ] Podcast/Books: `progressType="bar"` met `progress`
- [ ] Optionele controls: alleen meegeven als prop aanwezig (niet verborgen = niet gerenderd)
- [ ] `onStop` sluit ook de expanded player (`setIsPlayerExpanded(false)`)
- [ ] Accessibility labels automatisch via i18n in de componenten
- [ ] HomeScreen: gebruik `useActivePlayback()` hook voor UnifiedMiniPlayer data

---

### Form Field Styling (MANDATORY)
All interactive form elements must follow these rules:

1. **Labels ABOVE the field** — Labels are positioned ABOVE the interactive element, NEVER inline inside the border
2. **Labels OUTSIDE the border** — The label text must be outside/above the bordered area, giving seniors more room to tap the field
3. **Labels always bold** — Every field label uses `fontWeight: '700'`
4. **No uppercase labels** — Labels use normal capitalization ("Land", "Taal"), NOT uppercase ("LAND", "TAAL")
5. **Bordered interactive elements** — All fields, dropdowns, and interactive inputs have a thin border (`borderWidth: 1, borderColor: colors.border`)
6. **Consistent picker rows** — Use `borderRadius: borderRadius.md` for rounded corners

**CORRECT layout — label ABOVE, OUTSIDE border:**
```
Land                          ← Label (bold, above, outside border)
┌─────────────────────────┐
│ 🇳🇱 Nederland         › │   ← Bordered interactive area
└─────────────────────────┘
```

**WRONG layout — label INSIDE border:**
```
┌─────────────────────────┐
│ Land | 🇳🇱 Nederland  › │   ← WRONG: label inside border
└─────────────────────────┘
```

**Standard picker field style:**
```typescript
// Container wraps label + bordered picker
fieldContainer: {
  marginBottom: spacing.md,
},
// Label: ABOVE and OUTSIDE the bordered element
fieldLabel: {
  ...typography.body,
  color: colors.textPrimary,
  fontWeight: '700',
  marginBottom: spacing.xs,
},
// Bordered interactive area (NO label inside)
pickerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: colors.surface,
  borderRadius: borderRadius.md,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.md,
  minHeight: touchTargets.comfortable,
},
pickerValue: {
  ...typography.body,
  color: colors.textPrimary,
  flex: 1,
},
```

**Standard text input style:**
```typescript
// Container wraps label + bordered input
inputContainer: {
  marginBottom: spacing.md,
},
// Label: ABOVE and OUTSIDE the bordered element
inputLabel: {
  ...typography.body,
  fontWeight: '700',
  color: colors.textPrimary,
  marginBottom: spacing.xs,
},
// Bordered input area
textInput: {
  ...typography.body,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: borderRadius.md,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  color: colors.textPrimary,
  backgroundColor: colors.surface,
  minHeight: touchTargets.comfortable,
},
```

**Section title style (for grouping fields):**
```typescript
sectionTitle: {
  ...typography.label,
  color: colors.textSecondary,
  fontWeight: '700',           // Bold
  marginBottom: spacing.sm,
  // NO textTransform: 'uppercase' — use normal capitalization
},
```

### Form Header Action Bar (VERPLICHT voor formulier-schermen)

**UI PRINCIPE: Bij formulierschermen vervangt de ModuleHeader zijn normale inhoud (icoon + titel) door [Annuleer] en [Opslaan] knoppen.**

Dit is het standaard iOS edit-mode pattern (vergelijkbaar met Contacten, Agenda, Notities apps).

**Waarom?**
- Save button onderaan een ScrollView scrolt off-screen — senioren vinden deze niet terug
- Header-positie is ALTIJD zichtbaar (0pt extra schermruimte gebruikt)
- Consistent met iOS platform conventies

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  Safe Area (notch/Dynamic Island)                             │
├──────────────────────────────────────────────────────────────┤
│  [Annuleer]                              [✅ Opslaan]        │
│  ↑ Links, tekst-knop                    ↑ Rechts, accent kleur│
├──────────────────────────────────────────────────────────────┤
│  ─ ─ ─ ─ ─ ─ ─  Separator line (1pt) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
└──────────────────────────────────────────────────────────────┘
```

**Regels:**

1. **Altijd zichtbaar** — Beide knoppen verschijnen direct bij openen formulier
2. **Altijd "Annuleer" + "Opslaan" tekst** — Labels wijzigen niet
3. **Annuleer bij dirty form** → bevestigingsdialoog ("Wijzigingen weggooien?")
4. **Annuleer bij leeg/ongewijzigd formulier** → direct sluiten (geen dialoog)
5. **Opslaan** → validatie → opslaan → sluiten
6. **Van toepassing op:** Agenda form, Contact form, Mail compose, Group creation
7. **NIET van toepassing op:** Settings (auto-save per veld), Chat (live send)

**ModuleHeader formMode API:**

```typescript
<ModuleHeader
  moduleId="agenda"
  icon="calendar"
  title={t('modules.agenda.title')}
  // Form mode props — wanneer formMode=true, worden icon/title vervangen door action buttons
  formMode={true}
  onCancel={handleCancel}
  onSave={handleSave}
  saveDisabled={!isValid}  // Optioneel: disable save knop
/>
```

**Cancel gedrag implementatie:**

```typescript
const handleCancel = useCallback(() => {
  if (isDirty) {
    Alert.alert(
      t('common.formActions.discardTitle'),
      t('common.formActions.discardMessage'),
      [
        { text: t('common.formActions.keepEditing'), style: 'cancel' },
        { text: t('common.formActions.discard'), style: 'destructive', onPress: onBack },
      ],
    );
  } else {
    onBack();
  }
}, [isDirty, onBack, t]);
```

**Dirty state tracking:**

```typescript
// Vergelijk huidige waarden met initial waarden
const isDirty = useMemo(() => {
  return title.trim() !== (initialData?.title ?? '')
    || selectedDate.getTime() !== (initialData?.date ?? defaultDate)
    // ... andere velden
    ;
}, [title, selectedDate, /* ... */]);
```

---

## 14. Component Registry (VERPLICHT)

Deze registry documenteert welke **standaard componenten** verplicht zijn voor specifieke screen types. Bij het maken van nieuwe screens of refactoring van bestaande screens, MOET deze registry worden geraadpleegd.

### Module Screens

**Verplichte component:** `ModuleHeader`

| Screen | ModuleHeader | showBackButton | currentSource |
|--------|--------------|----------------|---------------|
| RadioScreen | ✅ | `false` | `"radio"` |
| PodcastScreen | ✅ | `false` | `"podcast"` |
| BooksScreen | ✅ | `false` | `"books"` |
| BookPlayerScreen | ✅ | `true` | `"books"` |
| CallsScreen | ✅ | `false` | - |
| VideoCallScreen | ✅ | `false` | - |
| AudioBookScreen | ✅ | `false` | - |
| EBookScreen | ✅ | `false` | - |
| BookReaderScreen | ⏭️ Uitgezonderd | - | - |
| **ChatListScreen** | ✅ | `false` | - |
| **ContactListScreen** | ✅ | `false` | - |
| **GroupListScreen** | ✅ | `false` | - |
| **SettingsMainScreen** | ✅ | `false` | - |

**Uitgezonderd:** `BookReaderScreen` heeft een eigen thema-systeem (light/sepia/dark) en daarom een aangepaste header.

### Audio Player Screens

**Verplichte componenten:** `UnifiedMiniPlayer`, `UnifiedFullPlayer`

| Screen | UnifiedMiniPlayer | UnifiedFullPlayer | progressType |
|--------|-------------------|-------------------|--------------|
| RadioScreen | ✅ | ✅ | `"duration"` |
| PodcastScreen | ✅ | ✅ | `"bar"` |
| BookPlayerScreen | ✅ | ✅ | `"bar"` |
| AppleMusicScreen | ✅ | ✅ | `"bar"` |
| HomeScreen | ✅ (via useActivePlayback) | ❌ | varies |

**Verwijderde componenten (niet meer gebruiken):**
- ~~`MiniPlayer`~~ → vervangen door `UnifiedMiniPlayer`
- ~~`ExpandedAudioPlayer`~~ → vervangen door `UnifiedFullPlayer`
- ~~`HomeMiniPlayer`~~ → vervangen door `UnifiedMiniPlayer` + `useActivePlayback()`
- ~~`RadioPlayerOverlay`~~ → verwijderd
- ~~`BooksPlayerOverlay`~~ → verwijderd

### Favorite/Search Tab Buttons

**Verplichte componenten:** `FavoriteTabButton`, `SearchTabButton`

Voor modules met favorieten + zoek functionaliteit, gebruik de gestandaardiseerde tab buttons:

| Screen | FavoriteTabButton | SearchTabButton | Gebruik |
|--------|-------------------|-----------------|---------|
| RadioScreen | ✅ | ✅ | Tab bar met favorieten/zoeken toggle |
| PodcastScreen | ✅ | ✅ | Tab bar met favorieten/zoeken toggle |
| BooksScreen | ❌ | ✅ | Alleen zoeken (geen favorieten) |

**Implementatie:**
```typescript
import { FavoriteTabButton, SearchTabButton } from '@/components';

// Tab bar row
<View style={styles.tabRow}>
  <FavoriteTabButton
    isActive={showFavorites}
    onPress={() => setShowFavorites(true)}
    count={favorites.length}
  />
  <SearchTabButton
    isActive={!showFavorites}
    onPress={() => setShowFavorites(false)}
  />
</View>
```

**Voor lijst items (icon-only variant):**
```typescript
import { FavoriteButton } from '@/components';

<FavoriteButton
  isFavorite={isFavorite(item)}
  onToggle={() => toggleFavorite(item)}
  accessibilityLabel={t('common.toggleFavorite', { name: item.name })}
/>
```

### SearchBar Component (VERPLICHT voor alle zoekfunctionaliteit)

**Verplichte component:** `SearchBar`

ALLE schermen en modules met zoekfunctionaliteit MOETEN de gestandaardiseerde `SearchBar` component gebruiken. Geen custom TextInput implementaties voor zoeken.

| Screen | SearchBar | Gebruik |
|--------|-----------|---------|
| RadioScreen | ✅ | API zoeken (expliciete submit) |
| PodcastScreen | ✅ | API zoeken (expliciete submit) |
| BooksScreen | ✅ | API zoeken (expliciete submit) |
| ContactListScreen | ✅ | Lokale filter (live filtering) |

**Kenmerken:**
- **Hoogte:** Exact 60pt (gelijk aan zoekknop)
- **Geen tekst shift:** `includeFontPadding: false` + geen `lineHeight`
- **Zoekknop:** Altijd naast input, met `accentColor.primary`
- **Submit:** Enter toets OF tap op vergrootglas

**Implementatie — API zoeken (expliciete submit):**
```typescript
import { SearchBar, type SearchBarRef } from '@/components';

const searchInputRef = useRef<SearchBarRef>(null);

<SearchBar
  ref={searchInputRef}
  value={searchQuery}
  onChangeText={setSearchQuery}
  onSubmit={handleSearch}  // API call
  placeholder={t('modules.podcast.searchPlaceholder')}
  searchButtonLabel={t('modules.podcast.searchButton')}
  maxLength={SEARCH_MAX_LENGTH}
/>
```

**Implementatie — Lokale filter (live filtering):**
```typescript
import { SearchBar } from '@/components';

<SearchBar
  value={searchQuery}
  onChangeText={setSearchQuery}  // Filtert bij elke keystroke
  onSubmit={() => {}}  // Geen expliciete submit nodig
  placeholder={t('contacts.searchPlaceholder')}
  searchButtonLabel={t('contacts.searchButton')}
/>
```

**i18n vereisten:**
- `[module].searchPlaceholder` — Placeholder tekst
- `[module].searchButton` — Accessibility label voor zoekknop

### ChipSelector Component (VERPLICHT voor land/taal filters)

**Verplichte component:** `ChipSelector`

ALLE schermen met land- of taalselectie MOETEN de gestandaardiseerde `ChipSelector` component gebruiken. Geen custom horizontale ScrollView + TouchableOpacity implementaties.

| Screen | ChipSelector | defaultMode | allowModeToggle | Gebruik |
|--------|--------------|-------------|-----------------|---------|
| RadioScreen | ✅ | `country` | ✅ | Land of taal voor station zoeken |
| PodcastScreen | ✅ | `language` | ✅ | Taal of land voor podcast zoeken |
| BooksScreen | ✅ | `language` | ❌ | Alleen taal (Gutenberg API is taal-gebaseerd) |

**Kenmerken:**
- **Touch targets:** 60pt minimum (senior-inclusive)
- **Typography:** 18pt (senior-inclusive)
- **Layout:** Horizontale ScrollView met pill-shaped chips
- **Label:** Automatisch via `t()` gebaseerd op `mode` prop
- **Hold-gesture protection:** Ingebouwd
- **Toggle functionaliteit:** Gebruiker kan wisselen tussen land/taal via tap op label

**Props:**
```typescript
import type { FilterMode, ChipOption } from '@/components';

interface ChipSelectorProps {
  /** Mode bepaalt label via t() — 'country' toont "Land", 'language' toont "Taal" */
  mode: FilterMode;  // 'country' | 'language'
  /** Lijst van opties — gebruik COUNTRIES of LANGUAGES uit @/constants/demographics */
  options: ChipOption[];
  /** Geselecteerde code */
  selectedCode: string;
  /** Callback bij selectie */
  onSelect: (code: string) => void;
  /** Sta wisselen tussen land/taal toe (optional, default: false) */
  allowModeToggle?: boolean;
  /** Callback wanneer mode wisselt (vereist als allowModeToggle=true) */
  onModeChange?: (mode: FilterMode) => void;
}
```

**ChipOption interface:**
```typescript
interface ChipOption {
  code: string;      // ISO code (uppercase voor land, lowercase voor taal)
  flag?: string;     // Emoji vlag (voor landen)
  icon?: string;     // Emoji icoon (voor talen: 🗣️)
  nativeName: string; // Naam in eigen taal
}
```

**Implementatie — Land/Taal toggle (Radio/Podcast):**
```typescript
import { ChipSelector, type FilterMode } from '@/components';
import { COUNTRIES, LANGUAGES } from '@/constants/demographics';

const [filterMode, setFilterMode] = useState<FilterMode>('country');
const [selectedCountry, setSelectedCountry] = useState('NL');
const [selectedLanguage, setSelectedLanguage] = useState('nl');

const handleFilterModeChange = (mode: FilterMode) => {
  setFilterMode(mode);
  // Optioneel: herlaad data met nieuwe filter
};

<ChipSelector
  mode={filterMode}
  options={filterMode === 'country' ? COUNTRIES : LANGUAGES}
  selectedCode={filterMode === 'country' ? selectedCountry : selectedLanguage}
  onSelect={filterMode === 'country' ? setSelectedCountry : setSelectedLanguage}
  allowModeToggle={true}
  onModeChange={handleFilterModeChange}
/>
```

**Implementatie — Alleen taal (Books):**
```typescript
import { ChipSelector } from '@/components';
import { LANGUAGES } from '@/constants/demographics';

<ChipSelector
  mode="language"
  options={LANGUAGES}
  selectedCode={selectedLanguage}
  onSelect={handleLanguageChange}
  // Geen toggle — Gutenberg API ondersteunt alleen taal
/>
```

**i18n keys (automatisch via mode):**
- `components.chipSelector.country` — "Land" / "Country" / etc.
- `components.chipSelector.language` — "Taal" / "Language" / etc.
- `components.chipSelector.searchBy` — "Zoeken op basis van:" (toggle modal)
- `components.chipSelector.tapToChange` — "{{current}} - tik om te wijzigen"

### Hoe deze Registry te Gebruiken

**Bij nieuwe module screen:**
1. Check: Moet deze screen een `ModuleHeader` hebben? → Ja, tenzij uitgezonderd
2. Check: Heeft deze screen audio playback? → Gebruik `MiniPlayer` + `ExpandedAudioPlayer`
3. Check: Heeft deze screen zoekfunctionaliteit? → Gebruik `SearchBar` (VERPLICHT)
4. Check: Heeft deze screen land/taal selectie? → Gebruik `ChipSelector` (VERPLICHT)
5. Configureer de juiste props volgens de tabel

**Bij nieuwe standaard component:**
1. Voeg de component toe aan deze registry
2. Documenteer welke screens de component MOETEN gebruiken
3. Zie `COORDINATION_PROTOCOL.md` sectie "Nieuwe Standaard Component Checklist"

### Compliance Check Command

Om te controleren of alle screens de juiste componenten gebruiken:

```bash
# Check welke module screens ModuleHeader nog NIET gebruiken
grep -rL "ModuleHeader" src/screens/modules/*.tsx

# Check welke main screens ModuleHeader nog NIET gebruiken
grep -rL "ModuleHeader" src/screens/chat/ChatListScreen.tsx src/screens/contacts/ContactListScreen.tsx src/screens/settings/SettingsMainScreen.tsx

# Check welke screens nog custom moduleHeader styles hebben
grep -r "moduleHeader:" src/screens/modules/*.tsx src/screens/chat/*.tsx src/screens/contacts/*.tsx src/screens/settings/*.tsx

# Check welke screens met zoekfunctionaliteit nog GEEN SearchBar gebruiken
grep -rL "SearchBar" src/screens/modules/PodcastScreen.tsx src/screens/modules/BooksScreen.tsx src/screens/contacts/ContactListScreen.tsx

# Check welke screens nog custom searchInput styles hebben (moet SearchBar gebruiken)
grep -r "searchInput:" src/screens/

# Check welke screens zoekfunctionaliteit in een Modal hebben (VERBODEN)
grep -r "Modal.*search\|search.*Modal" src/screens/modules/*.tsx
```

---

## 15. Module Search Pattern (VERPLICHT)

**ALLE modules met zoek/discovery functionaliteit** MOETEN dit pattern volgen. Dit garandeert consistente UX across alle modules.

### 15.1 Zoeklocatie: ALTIJD op Hoofdscherm

Zoekfunctionaliteit MOET direct zichtbaar zijn op het hoofdscherm, **NOOIT verborgen in een modal**.

**Waarom?**
- Senioren verwachten dat zoeken direct beschikbaar is
- Extra taps naar modals = extra verwarring
- Consistentie met andere modules (Radio, Podcast, Books)

**✅ CORRECT — Zoeken op hoofdscherm:**
```
┌─────────────────────────────────────┐
│        📻 Radio                     │
├─────────────────────────────────────┤
│  [❤️ Favorieten] [🔍 Zoeken]        │  ← Tabs direct zichtbaar
├─────────────────────────────────────┤
│  🔍 [__Zoek een zender...__] [🔍]   │  ← SearchBar op hoofdscherm
├─────────────────────────────────────┤
│  Zoekresultaten / Content...        │
└─────────────────────────────────────┘
```

**❌ FOUT — Zoeken in modal:**
```
┌─────────────────────────────────────┐
│        🌤️ Weer                      │
├─────────────────────────────────────┤
│  📍 Amsterdam                    ▼  │  ← Tik om modal te openen
├─────────────────────────────────────┤
│  Weerdata...                        │
│                                     │
│     ┌─────────────────────┐         │
│     │ [Modal met zoek]    │         │  ← VERBODEN: verborgen in modal
│     └─────────────────────┘         │
└─────────────────────────────────────┘
```

### 15.2 Tabs: Favorieten vs Zoeken

Modules met zowel favorieten/opgeslagen items ALS zoekfunctionaliteit MOETEN tabs gebruiken:

| Tab | Component | Inhoud |
|-----|-----------|--------|
| **Favorieten** | `FavoriteTabButton` | Opgeslagen/favoriete items |
| **Zoeken** | `SearchTabButton` | Discovery/search interface |

**Implementatie:**
```typescript
import { FavoriteTabButton, SearchTabButton } from '@/components';

const [showFavorites, setShowFavorites] = useState(true);

// Tab bar
<View style={styles.tabBar}>
  <FavoriteTabButton
    isActive={showFavorites}
    onPress={() => setShowFavorites(true)}
    count={savedLocations.length}
    label={t('modules.weather.myLocations')}
  />
  <SearchTabButton
    isActive={!showFavorites}
    onPress={() => setShowFavorites(false)}
  />
</View>

// Content based on active tab
{showFavorites ? (
  <FavoritesContent />
) : (
  <SearchContent />
)}
```

### 15.3 Zoekgedrag: API vs Lokaal

| Type | Gedrag | Trigger | Wanneer gebruiken |
|------|--------|---------|-------------------|
| **API zoeken** | Expliciete submit | Enter toets OF zoekknop | External APIs (Podcast, Radio, Books, Weather) |
| **Lokale filter** | Live filtering | Bij elke keystroke | Lokale data (Contacten lijst) |

**API zoeken (expliciete submit):**
```typescript
const handleSearch = useCallback(async () => {
  if (!searchQuery.trim()) return;
  setIsLoading(true);
  const results = await searchLocations(searchQuery);
  setSearchResults(results);
  setIsLoading(false);
}, [searchQuery]);

<SearchBar
  value={searchQuery}
  onChangeText={setSearchQuery}
  onSubmit={handleSearch}  // ← Expliciete submit
  placeholder={t('modules.weather.searchPlaceholder')}
/>
```

**Lokale filter (live filtering):**
```typescript
// Alleen voor lokale data zoals contactenlijst
<SearchBar
  value={searchQuery}
  onChangeText={(text) => {
    setSearchQuery(text);
    filterLocalData(text);  // ← Live filtering
  }}
  onSubmit={() => {}}  // Geen expliciete submit nodig
  placeholder={t('contacts.searchPlaceholder')}
/>
```

### 15.4 Weather Module Specifiek

Weather zoekt via **externe API** (Open-Meteo geocoding), dus MOET:
- ✅ Tabs gebruiken: "Mijn Locaties" | "Zoeken"
- ✅ SearchBar op hoofdscherm (niet in modal)
- ✅ Expliciete submit (niet live filtering)
- ✅ Weerdata tonen wanneer locatie geselecteerd is

**Weather Screen Layout:**
```
┌─────────────────────────────────────┐
│  🌤️ Weer                            │  ← ModuleHeader
├─────────────────────────────────────┤
│  [📍 Mijn Locaties] [🔍 Zoeken]     │  ← Tabs
├─────────────────────────────────────┤
│                                     │
│  [Mijn Locaties tab:]               │
│  - Amsterdam (geselecteerd) ❤️      │
│  - Rotterdam ❤️                     │
│  - Utrecht ❤️                       │
│                                     │
│  [Zoeken tab:]                      │
│  🔍 [__Zoek locatie...__] [🔍]      │
│  Zoekresultaten...                  │
│                                     │
├─────────────────────────────────────┤
│  [Weerdata voor geselecteerde       │
│   locatie - altijd zichtbaar]       │
└─────────────────────────────────────┘
```

### 15.5 Module Search Pattern Checklist

Bij ELKE module met zoekfunctionaliteit:

- [ ] **SearchBar op HOOFDSCHERM** — NOOIT in een modal
- [ ] **Tabs gebruiken** — FavoriteTabButton + SearchTabButton (indien favorieten)
- [ ] **API zoeken = expliciete submit** — onSubmit roept zoekfunctie aan
- [ ] **Lokale filter = live filtering** — alleen voor lokale data
- [ ] **Geen lege onSubmit** — `onSubmit={() => {}}` is VERBODEN voor API zoeken
- [ ] **ChipSelector** — voor land/taal filtering (indien van toepassing)

### 15.6 Automatische Trigger

| Wijziging bevat... | Verplichte validatie door |
|-------------------|---------------------------|
| **Zoekfunctionaliteit in module** | **ui-designer, react-native-expert** — Module Search Pattern MOET worden gevolgd |
| **Modal met zoekfunctie** | **BLOKKEERDER** — Zoeken mag NOOIT in een modal |

---

## Logging Richtlijnen

### Log Levels

| Level | Wanneer gebruiken | Production |
|-------|-------------------|------------|
| `console.debug()` | Development details, state changes | Gefilterd |
| `console.info()` | Belangrijke events, user actions | Zichtbaar |
| `console.warn()` | Recoverable issues, fallbacks | Zichtbaar |
| `console.error()` | Failures, onverwachte errors | Zichtbaar |

### NOOIT Loggen (PII/Security)

```typescript
// ❌ NOOIT loggen:
console.log('User:', user.name, user.phone);        // PII
console.log('Search:', searchQuery);                 // Kan namen bevatten
console.log('Key:', encryptionKey);                  // Security
console.log('Token:', authToken);                    // Security
console.log('Message:', message.content);            // Privacy
console.error('Full error:', error);                 // Kan PII bevatten

// ✅ WEL loggen:
console.info('User logged in');                      // Event zonder PII
console.info('Search completed', { count: 5 });      // Resultaat, geen query
console.debug('Encryption completed', { ms: 45 });   // Performance metric
console.error('Stream failed', { code: error.code }); // Alleen error code
```

### Performance Logging

```typescript
// Voor API calls en kritieke operaties
const start = performance.now();
await fetchData();
console.debug('[Module] Operation completed', {
  operation: 'fetchData',
  duration: Math.round(performance.now() - start),
  resultCount: data.length,
});
```

### Module Prefix Convention

```typescript
// Consistent prefix format: [ModuleName]
console.info('[RadioContext] Station started playing');
console.warn('[RadioScreen] Using cached stations');
console.error('[artworkService] Fetch failed', { code: 'TIMEOUT' });
```

### Logging in useEffect

```typescript
// Log bij mount/unmount voor debugging
useEffect(() => {
  console.debug('[Component] Mounted');
  return () => console.debug('[Component] Unmounted');
}, []);
```

## Build Order
1. Onboarding flow (language → phone → name → PIN → done)
2. Encryption service (key generation, backup, restore)
3. 1-on-1 chat (XMPP connect, send, receive, receipts)
4. Group chat (MUC, dual-path encryption)
5. Photos (compression, encryption, send)
6. Video calls (WebRTC P2P)
7. Settings & accessibility
8. Store submission

## Commands
```bash
npm start          # Metro bundler
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run lint       # ESLint (zero warnings)
npm run typecheck  # TypeScript strict
npm test           # Jest with coverage
```

## Known Issues & Workarounds

> **BELANGRIJK:** Lees `.claude/MOCK_MODE_CHANGES.md` voor volledige details

### FlatList Workaround — ✅ OPGELOST in RN 0.84 (Hermes V1)

**Status:** Bug is opgelost. FlatList crasht niet meer met `getItem undefined` op Hermes V1.

**Huidige situatie:** 68 bestanden gebruiken nog de ScrollView + `.map()` workaround. Deze kunnen veilig terug worden gemigreerd naar FlatList. Zie `.claude/plans/FLATLIST_REHABILITATION.md` voor het projectplan.

**Risico bij FlatList rehabilitatie:** Laag — getest op fysiek device (iPhone 14, iOS 26.4 beta) zonder crashes.

### Native Module Race Conditions — Te valideren

Top-level imports van native-afhankelijke modules faalden op RN 0.73. **Huidige workaround:** Dynamische imports (`await import()`) + 50-100ms delay bij startup.

**Status RN 0.84:** New Architecture + TurboModules interop layer zou dit moeten oplossen. De 100ms delay in `App.tsx` kan mogelijk verwijderd worden, maar vereist grondige test van alle 19 native modules bij cold start.

### uuid/libsodium — ✅ OPGELOST

Beide vervangen door native modules die correct werken met Hermes:
- `uuid` → `react-native-uuid` (native RNG)
- `libsodium-wrappers` → `react-native-libsodium` (native module)

### Mock Mode
App draait momenteel in mock mode voor development. Zie `MOCK_MODE_CHANGES.md` voor:
- Lijst van alle gewijzigde bestanden
- Exacte code om terug te draaien voor productie
- Checklist voor productie test versie

## Development Environment

### ⚠️ Ontwikkelaar Workflow Voorkeuren (VERPLICHT)

**Claude wordt gebruikt BINNEN Xcode** — NIET via terminal/CLI.

Bij het geven van test- of build-instructies, gebruik ALTIJD Xcode-specifieke commando's:

| Actie | Xcode Commando | NIET gebruiken |
|-------|----------------|----------------|
| **Build & Run** | `⌘R` (Cmd+R) | `npm run ios`, `npx react-native run-ios` |
| **Clean Build** | `⌘⇧K` (Cmd+Shift+K) | `rm -rf build/`, `xcodebuild clean` |
| **Reload JS** | "Reload op iPhone" (shake device of `⌘R` in simulator) | `r` in Metro terminal |
| **Stop running** | `⌘.` (Cmd+Period) | `Ctrl+C` in terminal |
| **Build alleen** | `⌘B` (Cmd+B) | `xcodebuild` |

**Instructie Formaat:**

```markdown
✅ GOED:
"Druk op ⌘R om de app te builden en te runnen."
"Clean build nodig: ⌘⇧K, daarna ⌘R."
"Reload de app op je iPhone om de wijzigingen te zien."

❌ FOUT:
"Run `npm run ios` in de terminal."
"Type `r` in Metro om te reloaden."
"Execute `npx react-native run-ios`."
```

**Wanneer Terminal WEL nodig is:**
- Metro bundler starten (als niet al draait): `npx react-native start`
- Pod install: `cd ios && pod install`
- Git operaties
- Prosody server beheer

### Prosody XMPP Server
**BELANGRIJK:** Prosody is NIET geïnstalleerd via Homebrew!

Prosody locatie en commando's:
```bash
# Start Prosody (handmatige installatie)
sudo prosodyctl start

# Stop Prosody
sudo prosodyctl stop

# Check status
sudo prosodyctl status

# Configuratie
/etc/prosody/prosody.cfg.lua
```

### Test Devices

| Device | Account | Type | iOS Versie |
|--------|---------|------|------------|
| iPhone 17 Pro | ik@commeazy.local | Simulator | iOS 26 (Xcode sim) |
| iPhone 16e | oma@commeazy.local | Simulator | iOS 26 (Xcode sim) |
| iPad (any) | ipad@commeazy.local | Simulator | iOS 26 (Xcode sim) |
| iPhone 14 (Bert) | test@commeazy.local | Fysiek | **iOS 26.4 BETA** |
| iPhone (Jeanine) | jeanine@commeazy.local | Fysiek | **iOS 26.3 (officieel)** |

**⚠️ BELANGRIJK:** Beide fysieke test devices draaien iOS 26+! UIGlassEffect en Liquid Glass zijn beschikbaar.

### Metro Bundler Configuratie

**Één Metro instance ondersteunt ALLE devices** (simulators + fysiek) met `--host 0.0.0.0`:

```bash
cd /Users/bertvancapelle/Projects/CommEazy && npx react-native start --reset-cache --host 0.0.0.0
```

| Interface | Adres | Wie gebruikt het |
|-----------|-------|------------------|
| Loopback | `127.0.0.1:8081` | Simulators (iPhone + iPad) |
| LAN | `10.10.15.75:8081` | Fysieke devices |

**Wanneer gebruiker zegt "herstart Metro" of "start Metro":**

Claude MOET de volgende stappen uitvoeren:

1. **Valideer dat Prosody draait** (VERPLICHT):
   ```bash
   prosodyctl status
   ```
   - Als Prosody NIET draait: Start eerst Prosody:
     ```bash
     prosodyctl start
     ```
   - Wacht 2 seconden en valideer opnieuw:
     ```bash
     sleep 2 && prosodyctl status
     ```

2. **Valideer dat Prosody WebSocket luistert** (VERPLICHT):
   ```bash
   lsof -i :5280 | head -5
   ```
   - Verwachte output: `lua` of `prosody` proces dat luistert
   - Als geen output: Prosody config fout, check `/opt/homebrew/etc/prosody/prosody.cfg.lua`

3. **Kill bestaande Metro processen**:
   ```bash
   lsof -ti:8081 | xargs kill -9 2>/dev/null
   ```

4. **Geef gebruiker het Metro commando met gedeelde logging**:
   ```bash
   cd /Users/bertvancapelle/Projects/CommEazy && npx react-native start --reset-cache --host 0.0.0.0 2>&1 | tee /tmp/metro.log
   ```

**Let op:** Claude kan Metro NIET zelf starten via Bash (npx niet in PATH). Geef altijd het commando aan de gebruiker.

### Metro Log Meelezen (Gedeelde Debugging)

**Doel:** Gebruiker en Claude kunnen beiden de Metro logs realtime volgen.

**Workflow:**
1. **Gebruiker start Metro** met `tee` naar `/tmp/metro.log`:
   ```bash
   cd /Users/bertvancapelle/Projects/CommEazy && npx react-native start --reset-cache --host 0.0.0.0 2>&1 | tee /tmp/metro.log
   ```

2. **Claude leest mee** via:
   ```bash
   tail -100 /tmp/metro.log   # Laatste 100 regels
   cat /tmp/metro.log         # Volledige log
   ```

3. **Gebruiker ziet live output** in het Terminal venster waar Metro draait

**Wanneer Claude de logs moet checken:**
- Bij bundel fouten of warnings
- Bij "red screen" errors in de app
- Bij onverwacht gedrag na JS wijzigingen
- Wanneer gebruiker vraagt om logs te bekijken

**Log file locatie:** `/tmp/metro.log` (wordt overschreven bij elke Metro start)

### Prosody XMPP Server

**Locatie:** `/opt/homebrew/etc/prosody/prosody.cfg.lua`

**Commando's:**
```bash
prosodyctl start      # Start Prosody
prosodyctl stop       # Stop Prosody
prosodyctl status     # Check status
prosodyctl restart    # Herstart Prosody
```

**Kritieke config voor development:**
```lua
-- In /opt/homebrew/etc/prosody/prosody.cfg.lua
http_ports = { 5280 }
http_interfaces = { "*" }           -- Luistert op ALLE interfaces
https_ports = { 5281 }
https_interfaces = { "*" }
consider_websocket_secure = true    -- WebSocket als secure behandelen
cross_domain_websocket = true       -- Cross-domain connecties toestaan
authentication = "internal_plain"   -- Vereist voor React Native
```

**Test accounts aanmaken:**
```bash
prosodyctl adduser ik@commeazy.local       # Password: test123
prosodyctl adduser oma@commeazy.local      # Password: test123
prosodyctl adduser test@commeazy.local     # Password: test123
prosodyctl adduser jeanine@commeazy.local  # Password: test123
prosodyctl adduser ipad@commeazy.local     # Password: test123
```

---

## 16. Apple Liquid Glass Compliance (iOS/iPadOS 26+)

### Principe

CommEazy MOET Apple's Liquid Glass design systeem ondersteunen op devices die iOS/iPadOS 26+ draaien. Dit is een **Non-Negotiable Requirement** (zie punt 6).

### Kernregels

1. **Progressive Enhancement** — Liquid Glass op iOS 26+, solid color fallback op iOS <26 en Android
2. **Module Tint Colors** — Bestaande module kleuren worden Liquid Glass tints met instelbare intensiteit
3. **User Control** — Gebruiker kan tint intensiteit aanpassen (0-100%) in Instellingen
4. **Accessibility First** — Respecteer "Reduce Transparency" systeem instelling
5. **Backward Compatibility** — App MOET functioneel blijven op iOS 15+ en Android 8+

### Technische Architectuur

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native Layer                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  LiquidGlassContext (settings, platform detection)  │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  LiquidGlassView (wrapper component)                │    │
│  │  - iOS 26+: renders native UIGlassEffect           │    │
│  │  - iOS <26 / Android: renders solid color View     │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                    Native iOS Layer                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  LiquidGlassModule.swift (@available iOS 26)        │    │
│  │  - UIGlassEffect with custom tint                  │    │
│  │  - Intensity control via effect configuration      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Validatie Triggers

| Wijziging bevat... | Verplichte validatie |
|-------------------|----------------------|
| UI component met achtergrondkleur | Liquid Glass compliance check |
| ModuleHeader, MiniPlayer, Cards | MOET LiquidGlassView gebruiken |
| Nieuwe module | MOET module kleur in LIQUID_GLASS_COLORS registreren |
| **Player feature wijziging** | **MOET in BEIDE players (RN + Native)** |
| **Nieuwe playback state** | **MOET door bridge layer naar beide players** |

### 100% Feature Parity Regel (VERPLICHT)

**KRITIEK:** De React Native player en native Liquid Glass player MOETEN 100% functioneel identiek zijn.

#### Waarom?
- Gebruiker mag geen verschil merken tussen iOS <26 en iOS 26+
- Consistente UX ongeacht platform versie
- Geen "missing feature" klachten van iOS 26+ gebruikers

#### Feature Parity Checklist

Bij ELKE wijziging aan player functionaliteit:

| Feature | React Native Player | Native Glass Player | Status |
|---------|--------------------|--------------------|--------|
| Play/Pause toggle | ✅ | ✅ | Parity |
| Stop button | ✅ | ✅ | Parity |
| Loading indicator | ✅ Spinner | ✅ UIActivityIndicatorView | Parity |
| Buffering animation | ✅ Opacity pulse | ✅ CABasicAnimation pulse | Parity |
| Listen duration | ✅ "🎧 45:32" | ✅ headphones.circle + label | Parity |
| Progress bar | ✅ | ✅ UISlider | Parity |
| Seek slider | ✅ | ✅ | Parity |
| Skip buttons | ✅ | ✅ | Parity |
| Speed control | ✅ | ✅ | Parity |
| Sleep timer | ✅ | ✅ | Parity |
| Favorite toggle | ✅ | ✅ | Parity |
| Artwork display | ✅ | ✅ | Parity |

#### Implementatie Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  STAP 1: Feature in React Native Player                         │
│  Implementeer de feature in MiniPlayer.tsx / ExpandedAudioPlayer│
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 2: Bridge Layer Update                                     │
│  Update glassPlayer.ts types en updatePlaybackState() call       │
│  Voeg nieuwe parameters toe aan GlassPlayerPlaybackState         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 3: Native Swift Implementation                             │
│  Update PlaybackState struct in GlassPlayerWindow.swift          │
│  Update MiniPlayerNativeView.swift                               │
│  Update FullPlayerNativeView.swift                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAP 4: Validatie                                               │
│  Test op iOS <26 (React Native player)                           │
│  Test op iOS 26+ (Native Glass player)                           │
│  Vergelijk visueel en functioneel                                │
└─────────────────────────────────────────────────────────────────┘
```

### Gefaseerde Implementatie

Zie `.claude/plans/LIQUID_GLASS_IMPLEMENTATION.md` voor het volledige implementatieplan.

**BELANGRIJK:** Implementatie gebeurt stap-voor-stap met expliciete goedkeuring per fase.

---

## Feature Backlog (Per Platform)

Alle features en taken voor CommEazy, georganiseerd per platform. Dit geeft overzicht welke keuzes er zijn voor iOS/iPadOS, Android, en Pre-Production/Cross-Platform ontwikkeling.

### Legenda
- ✅ DONE — Voltooid
- 🔶 PARTIAL — Gedeeltelijk klaar
- ⏳ TODO — Nog te doen
- 🎯 MVP — Vereist voor eerste release
- ⏳ TBD — Prioriteit nog te bepalen

---

### 🍎 iOS/iPadOS Specifiek

Features en taken die alleen voor Apple platforms gelden.

| # | Item | Status | Prioriteit | Beschrijving |
|---|------|--------|------------|--------------|
| 1 | **CallKit Basis** | ✅ DONE | 🎯 MVP | Native iOS call UI (lockscreen, mute sync, call history) |
| 2 | **VoIP Push (APNs)** | ✅ DONE | 🎯 MVP | PushKit module ✅, APNs credentials ✅ geconfigureerd |
| 3 | **Privacy Manifest** | ✅ DONE | 🎯 MVP | PrivacyInfo.xcprivacy met UserDefaults (CA92.1) + FileTimestamp (C617.1) |
| 4 | **CallKit Audio Routing** | ✅ DONE | 🎯 MVP | react-native-incall-manager geïnstalleerd, speaker/earpiece routing werkt |
| 5 | **Siri Call Initiation** | ✅ DONE | ⏳ TBD | SiriKit + Intents Extension + useSiriCall hook |
| 6 | **iPad Split View** | ✅ DONE | 🎯 MVP | SplitViewLayout + DraggableDivider + PaneContext compleet |
| 7 | **Liquid Glass Implementation** | ✅ DONE | 🎯 MVP | iOS 26 UIGlassEffect integratie |
| 8 | **Liquid Glass Player Window** | ✅ DONE | 🎯 MVP | Native Glass Player met MiniPlayer + FullPlayer |
| 9 | **Liquid Glass True Transparency** | ✅ DONE | 🎯 MVP | Echte transparantie voor achtergrond doorschijnen |
| 10 | **iPad/iPhone Hybrid Menu** | ✅ DONE | 🎯 MVP | WheelNavigationMenu + iPad Split View panelen |
| 11 | **Apple Music** | 🔶 PARTIAL | ⏳ TBD | Auth/Search/Playback/Queue ✅, Lyrics ❌ |
| 12 | **Glass Player Auto-Hide** | ✅ DONE | ⏳ TBD | setTemporarilyHidden() + WheelMenu + module switch integratie |
| 13 | **Collapsible Panes iPad** | ✅ DONE | 🎯 MVP | Snap logica, pijl handle, MediaIndicator integratie |
| 14 | **Piper TTS Nederlands** | ✅ DONE | 🎯 MVP | sherpa-onnx met 4 Nederlandse stemmen, chunked playback |
| 15 | **Mail Module (IMAP/SMTP)** | ✅ DONE | ⏳ TBD | MailModule + MailBackgroundFetchModule + SwiftMail XOAUTH2 + DocumentPreviewModule |

**📊 iOS/iPadOS Samenvatting:** 15 items | ✅ 14 DONE | 🔶 1 PARTIAL | ⏳ 0 TODO

---

### 🤖 Android Specifiek

Features en taken die alleen voor Android gelden.

| # | Item | Status | Prioriteit | Beschrijving |
|---|------|--------|------------|--------------|
| 15 | **VoIP Push (FCM)** | ⏳ TODO | 🎯 MVP | FCM service account credentials configureren |
| 16 | **Data Safety Section** | ⏳ TODO | 🎯 MVP | Google Play Store vereist dit |
| 17 | **Android Auto** | ⏳ TODO | ⏳ TBD | Handsfree bellen via Android Auto |
| 18 | **Widget (Android)** | ⏳ TODO | ⏳ TBD | Android App Widget recent contacts |

**📊 Android Samenvatting:** 4 items | ✅ 0 DONE | 🔶 0 PARTIAL | ⏳ 4 TODO

---

### 🔧 Pre-Production / Cross-Platform

Features en taken die voor beide platforms gelden of backend/infrastructuur betreffen.

| # | Item | Status | Prioriteit | Beschrijving |
|---|------|--------|------------|--------------|
| 19 | **Mock Mode Uitschakelen** | ⏳ TODO | 🎯 MVP | Zie `MOCK_MODE_CHANGES.md` voor alle wijzigingen |
| 20 | **App Icons & Splash Screen** | ⏳ TODO | 🎯 MVP | Finale assets voor iOS + Android resoluties |
| 21 | **TURN Server Credentials** | ⏳ TODO | 🎯 MVP | Productie TURN server voor WebRTC |
| 22 | **Firebase Productie Config** | ⏳ TODO | 🎯 MVP | Aparte Firebase project voor productie |
| 23 | **Prosody Productie Server** | ⏳ TODO | 🎯 MVP | Hosted XMPP server (niet lokaal) |
| 24 | **TTS Stem Download Service** | ⏳ TODO | ⏳ TBD | CDN + dynamisch downloaden Piper stemmen per taal |
| 25 | **Call Error Handling** | 🔶 PARTIAL | 🎯 MVP | ICE restart ✅ (3 attempts, exponential backoff), reconnectAttempts ✅, clearReconnectTimer ✅. TODO: UI reconnecting banner, handmatige retry bij failed state |
| 26 | **Voice Command Audio Ducking** | ⏳ TODO | ⏳ TBD | Duck audio naar 15% bij voice session (native AudioDuckingModule ontbreekt) |
| 27 | **Color Theme System** | 🔶 PARTIAL | ⏳ TBD | Module kleuren ✅, Dark mode ❌, High contrast ❌ |
| 28 | **Universal Presence** | 🔶 PARTIAL | ⏳ TBD | Online/offline indicator (XMPP + React Native) |
| 29 | **Unified Notifications** | ⏳ TODO | ⏳ TBD | Background message handling, group notifications |
| 30 | **Accessibility Compliance** | ⏳ TODO | ⏳ TBD | WCAG AAA + EN 301 549 volledige audit |
| 31 | **Weather Module** | ⏳ TODO | ⏳ TBD | Open-Meteo API + RainViewer radar |
| 32 | **Buienradar Module** | 🔶 PARTIAL | ⏳ TBD | FavoriteLocationsContext ✅, UI nog te doen |
| 33 | **Country-Specific Modules** | ⏳ TODO | ⏳ TBD | Framework voor land-specifieke modules (nu.nl, etc.) |
| 34 | **Groepsvideobellen (4+)** | ⏳ TODO | ⏳ TBD | SFU server nodig |
| 35 | **Spraakberichten** | ⏳ TODO | ⏳ TBD | Opnemen en verzenden |
| 36 | **Locatie delen** | ⏳ TODO | ⏳ TBD | Real-time locatie |
| 37 | **Agenda Module** | ⏳ TODO | ⏳ TBD | Tijdlijn met afspraken, herinneringen, medicijnen, contactdatums (verjaardagen/trouwdagen/sterfdagen). Delen via XMPP. Zie `AGENDA_MODULE.md` |
| 38 | **Prosody HA Production** | ⏳ TODO | ⏳ TBD | High-availability Prosody deployment handleiding |
| 39 | **Widget (iOS)** | ⏳ TODO | ⏳ TBD | WidgetKit recent contacts widget |
| 40 | **Backup & Restore** | ⏳ TODO | 🎯 MVP | iOS/iPadOS: iCloud Backup is afdoende — minimale implementatie: iCloud detectie + waarschuwingsbanner + mail re-login na restore. Android: uitgesteld (Keystore device-bound, 25MB limiet). Zie `BACKUP_RESTORE_PLAN.md` |
| 41 | **React Native Upgrade** | ✅ DONE | 🎯 MVP | Geüpgraded van RN 0.73.6 → 0.84.1 via 3-stop strategie (0.76→0.78→0.84). New Architecture actief, Hermes V1, React 19.2.3, React Navigation 7. FlatList bug opgelost. Zie branch `upgrade/rn-0.84`. |
| 43 | **FlatList Rehabilitatie** | ⏳ TODO | ⏳ TBD | 68 bestanden migreren van ScrollView + .map() terug naar FlatList (bug opgelost in RN 0.84). Zie `.claude/plans/FLATLIST_REHABILITATION.md`. |
| 42 | **Trust & Attestation** | ⏳ TODO | 🎯 MVP | User-to-User Trust (QR-code + Invitation Relay) + App-to-Server Trust (App Attest/Play Integrity + API Gateway + JWT). Contact flow refactor (3 opties: in de buurt/uitnodigen/bekende). iPad standalone onboarding via invitation code. Zie `TRUST_AND_ATTESTATION_PLAN.md` |

**📊 Cross-Platform Samenvatting:** 24 items | ✅ 0 DONE | 🔶 4 PARTIAL | ⏳ 20 TODO

---

### 📊 Totaal Overzicht

| Platform | Totaal | ✅ DONE | 🔶 PARTIAL | ⏳ TODO |
|----------|--------|---------|------------|---------|
| **iOS/iPadOS** | 15 | 14 | 1 | 0 |
| **Android** | 4 | 0 | 0 | 4 |
| **Cross-Platform** | 24 | 0 | 4 | 20 |
| **TOTAAL** | 43 | 14 | 5 | 24 |

---

### VoIP Push Notifications — Details

| Subitem | Platform | Status |
|---------|----------|--------|
| PushKit native module (VoIPPushModule.swift) | iOS | ✅ |
| Push Gateway server (server/push-gateway/) | Backend | ✅ |
| Prosody mod_push_http module | Backend | ✅ |
| XEP-0357 VoIP token registratie | Cross | ✅ |
| React Native bridge + XMPP reconnect | Cross | ✅ |
| APNs VoIP Certificate (.p8 key) | iOS | ✅ |
| APNs config in .env | iOS | ✅ |
| FCM credentials (service account JSON) | Android | ❌ |

---

### Plan Bestanden Referentie

| Plan | Platform | Bestand |
|------|----------|---------|
| Liquid Glass Implementation | iOS | `.claude/plans/LIQUID_GLASS_IMPLEMENTATION.md` |
| Liquid Glass Player Window | iOS | `.claude/plans/LIQUID_GLASS_PLAYER_WINDOW.md` |
| Liquid Glass True Transparency | iOS | `.claude/plans/LIQUID_GLASS_TRUE_TRANSPARENCY.md` |
| iPad/iPhone Hybrid Menu | iOS | `.claude/plans/IPAD_IPHONE_HYBRID_MENU.md` |
| Collapsible Panes iPad | iOS | `.claude/plans/COLLAPSIBLE_PANES_IPAD.md` |
| Apple Music | iOS | `.claude/plans/APPLE_MUSIC_IMPLEMENTATION.md` |
| Glass Player Auto-Hide | iOS | `.claude/plans/GLASS_PLAYER_AUTO_HIDE.md` |
| Color Theme System | Cross | `.claude/plans/COLOR_THEME_SYSTEM_FOR_SENIORS.md` |
| Universal Presence | Cross | `.claude/plans/UNIVERSAL_PRESENCE.md` |
| Unified Notifications | Cross | `.claude/plans/UNIFIED_NOTIFICATION_ARCHITECTURE.md` |
| Accessibility Compliance | Cross | `.claude/plans/ACCESSIBILITY_COMPLIANCE.md` |
| Weather Module | Cross | `.claude/plans/WEATHER_MODULE.md` |
| Buienradar Module | Cross | `.claude/plans/buienradar-module-plan.md` |
| Country-Specific Modules | Cross | `.claude/plans/COUNTRY_SPECIFIC_MODULES.md` |
| Prosody HA Production | Backend | `.claude/plans/PROSODY_HA_PRODUCTION.md` |
| Backup & Restore | Cross | `.claude/plans/BACKUP_RESTORE_PLAN.md` |
| Trust & Attestation | Cross | `.claude/plans/TRUST_AND_ATTESTATION_PLAN.md` |
| Agenda Module | Cross | `.claude/plans/AGENDA_MODULE.md` |

---

**Claude's Validatie:** Wanneer de gebruiker vraagt om productie/release, MOET Claude:
1. Deze backlog per platform tonen
2. Alle 🎯 MVP items met ⏳ TODO status benoemen per platform
3. Waarschuwen dat release NIET mogelijk is tot alle MVP items ✅ zijn

