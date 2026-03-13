# Coördinatie Protocol — CommEazy Skills

## Doel

Dit protocol zorgt ervoor dat wijzigingen worden gevalideerd tegen relevante skills **proportioneel aan de complexiteit van de wijziging**.

> **Single Source of Truth:** Zie `CONSTANTS.md` voor alle constanten (talen, touch targets, etc.)

---

## Getrapte Workflow (Tiered Approach)

### Tier 1: Triviale Wijzigingen (GEEN validatie vereist)

**Wat:** Bug fixes, typo's, formatting, logging fixes, kleine refactors binnen één bestand.

**Voorbeelden:**
- Typo in i18n key fixen
- Console.log verwijderen
- Code formatting aanpassen
- Simpele bug fix in bestaande logica

**Workflow:** Direct uitvoeren, geen rapportage vereist.

---

### Tier 2: Standaard Wijzigingen (Quick Check)

**Wat:** Nieuwe features binnen bestaand pattern, component wijzigingen, styling updates.

**Voorbeelden:**
- Nieuwe button toevoegen
- Bestaand component uitbreiden
- Styling aanpassen
- i18n keys toevoegen (check: alle 13 talen!)

**Workflow:**

```
1. Identificeer: Welke CHANGE_VALIDATION_MATRIX triggers?
2. Quick Check: Voldoet aan basisregels (touch targets, i18n, accessibility)?
3. Implementeer
4. Korte rapportage: "✅ [feature] toegevoegd, voldoet aan [skill] regels"
```

**Quick Check Basisregels:**

| Categorie | Check |
|-----------|-------|
| UI | Touch targets ≥60pt, contrast ≥7:1 |
| i18n | Alle 13 talen (zie CONSTANTS.md) |
| Accessibility | accessibilityLabel aanwezig |
| Security | Geen PII in logs |

---

### Tier 3: Complexe Wijzigingen (Volledige Validatie)

**Wat:** Nieuwe modules, architecturale wijzigingen, cross-cutting concerns, security-gerelateerd.

**Voorbeelden:**
- Nieuwe module toevoegen
- Database schema wijzigen
- Encryptie aanpassen
- Nieuwe standaard component introduceren
- Player feature parity wijzigingen

**Workflow:**

```
1. Classificatie: Type wijziging bepalen
2. Skill Identificatie: Welke skills moeten valideren? (zie matrix)
3. Validatie: Check tegen elke skill's regels
4. Rapportage: Gedetailleerd validatie-overzicht
5. Implementatie: Alleen na goedkeuring
6. Post-check: Tests, feature parity, recursieve updates
```

---

## Automatische Triggers → Tier Bepaling

| Wijziging bevat... | Tier | Validatie door |
|-------------------|------|----------------|
| Typo fix, formatting | 1 | - |
| Bug fix (1 bestand) | 1 | - |
| Nieuwe i18n keys | 2 | Check: 13 talen |
| UI component, styling | 2 | ui-designer quick check |
| Formuliervelden | 2 | ui-designer, accessibility |
| Native module wijziging | 3 | ios-specialist OF android-specialist |
| Encryptie, keys | 3 | security-expert |
| Database, storage | 3 | architecture-lead, security-expert |
| Nieuwe module | 3 | ALLE relevante skills |
| Player feature (RN + Native) | 3 | ios-specialist, react-native-expert |
| Standaard component intro | 3 | Recursieve update vereist |

---

## Conflict Resolutie Hiërarchie

Bij conflicten tussen skills, geldt deze prioriteit:

1. **Security wint altijd**
2. **Accessibility tweede** (WCAG AAA + EN 301 549)
3. **Senior-inclusive design derde**
4. **Performance vierde**
5. **Store compliance** (moet altijd voldoen)

---

## Tier 3: Gedetailleerde Workflow

### Stap 1-2: Classificatie & Skill Identificatie

Raadpleeg `CHANGE_VALIDATION_MATRIX.md` voor de volledige trigger-matrix.

### Stap 3: Validatie Template

```markdown
## Validatie voor: [beschrijving]

### Betrokken Skills
- [ ] skill-naam

### Resultaten

#### skill-naam ✅/⚠️/❌
- [x] Regel 1: voldaan
- [ ] Regel 2: niet voldaan — [uitleg]

### Conclusie
✅ / ⚠️ / ❌
```

### Stap 4-5: Rapportage & Implementatie

Bij ⚠️ of ❌: bespreek met gebruiker voordat je implementeert.

### Stap 6: Post-Implementation

- **Tests:** Coverage ≥80%?
- **Feature Parity:** Als RN + Native, beide bijgewerkt?
- **Recursieve Update:** Moet dit pattern overal worden toegepast?
- **Skill Standaardisatie:** Moet dit in SKILL.md worden vastgelegd?

---

## Feature Parity Protocol (Player Wijzigingen)

Bij wijzigingen aan audio player features MOETEN beide implementaties worden bijgewerkt:

| React Native | Native iOS |
|-------------|------------|
| `MiniPlayer.tsx` | `MiniPlayerNativeView.swift` |
| `ExpandedAudioPlayer.tsx` | `FullPlayerNativeView.swift` |
| `glassPlayer.ts` | `GlassPlayerWindowModule.swift` |

**Workflow:**
1. Implementeer in React Native
2. Update bridge layer (`glassPlayer.ts`)
3. Implementeer in Native Swift
4. Test op iOS <26 (RN) EN iOS 26+ (Native)

---

## Nieuwe Standaard Component (Recursieve Update)

Bij introductie van nieuwe standaard component:

1. **Maak component** en exporteer via `components/index.ts`
2. **Impact scan:** `grep` voor vergelijkbare custom implementaties
3. **Todo lijst:** Alle screens die moeten migreren
4. **Recursieve migratie:** Pas ALLE screens aan
5. **Update Component Registry** in CLAUDE.md sectie 14
6. **Update SKILL.md bestanden** — Voeg BLOKKEERDER regel toe aan relevante skills
7. **Update CHANGE_VALIDATION_MATRIX.md** — Voeg trigger regel toe

---

## Component Adoptie Metriek (VERPLICHT)

Na introductie van een standaard component MOET de adoptiegraad worden bijgehouden. Dit voorkomt dat migraties halverwege worden verlaten.

### Huidige Adoptie Status (maart 2026)

| Standaard Component | Vervangt | Files adopted | Violations remaining | Adoptie % |
|---------------------|----------|---------------|----------------------|-----------|
| `HapticTouchable` | `TouchableOpacity` | 113 | 0 | ✅ 100% |
| `PanelAwareModal` | Raw `Modal` | 12 | 0 | ✅ 100% |
| `ScrollViewWithIndicator` | Raw `ScrollView` | ✅ 100% | 0 | ✅ 100% |
| `ModuleHeader` | Custom header styling | 15 | 2 | ~88% |
| `SearchBar` | Custom search TextInput | 11 | 0 | ✅ 100% |
| `LoadingView` | Bare `ActivityIndicator` (large) | 33 | ~10 | ~77% |
| `ErrorView` | `Alert.alert()` (fout/succes/info) | 9 | ~56 | ~14% |
| `useModuleColor()` | Hardcoded hex | ~15 | ~17 | ~47% |

**Laatste update:** 13 maart 2026 — na LoadingView migratie (10 bestanden: AlbumPickerModal, InvitationCodeScreen, InviteContactScreen, AcceptInvitationScreen, AppleMusicDetailModal, PhotoAlbumScreen, ArticleWebViewer, AgendaItemDetailScreen, WeatherScreen, FullscreenImageViewer)

**Notities bij deferred items:**
- `LoadingView`: ~10 resterende `ActivityIndicator` — meeste zijn intentionele `size="small"` inline spinners (button states, lijst indicators) die NIET gemigreerd hoeven worden. Alleen `size="large"` fullscreen/modal loading states zijn relevant.
- `ErrorView`: Scope uitgebreid — nu ALLE `Alert.alert()` voor fout/succes/info meldingen (niet alleen errors). ~56 instances te migreren. `Alert.alert()` is ALLEEN nog toegestaan voor bevestigingsdialogen (2+ knoppen). Zie ui-designer SKILL.md sectie 16.
- Beide zijn technische schuld, geen blokkeerders voor nieuwe code

### Meetcommando's

```bash
# HapticTouchable adoptie
echo "HapticTouchable:" && grep -rl "HapticTouchable" src/screens/ --include="*.tsx" | wc -l
echo "TouchableOpacity (nog te migreren):" && grep -rl "TouchableOpacity" src/screens/ --include="*.tsx" | grep -v node_modules | wc -l

# ErrorView adoptie (scope: fout + succes + info meldingen)
echo "ErrorView:" && grep -rl "ErrorView" src/screens/ --include="*.tsx" | wc -l
echo "Alert.alert (ALLE niet-bevestiging, te migreren):" && grep -rn "Alert.alert" src/screens/ src/components/ --include="*.tsx" | grep -v "style: 'destructive'" | grep -v "style: 'cancel'" | wc -l

# LoadingView adoptie
echo "LoadingView:" && grep -rl "LoadingView" src/screens/ --include="*.tsx" | wc -l
echo "ActivityIndicator (bare):" && grep -rl "ActivityIndicator" src/screens/ --include="*.tsx" | wc -l
```

### Doel

- **Nieuwe code (BLOKKEERDER):** 100% — standaard component is verplicht
- **Bestaande code (technische schuld):** Geleidelijke migratie per sprint
- **Target:** Alle componenten op 100% adoptie vóór v1.0 release

### Claude's Verantwoordelijkheid

Na ELKE refactoring of component migratie taak:
1. **Meet** de huidige adoptie percentages
2. **Update** deze tabel met actuele cijfers
3. **Rapporteer** aan gebruiker:

```
📊 **Component Adoptie Update**

| Component | Was | Nu | Delta |
|-----------|-----|-----|-------|
| HapticTouchable | 28% | 35% | +7% |
| ErrorView | 17% | 22% | +5% |

Volgende migratie prioriteit: HapticTouchable (hoogste impact)
```

---

## Documentation-Code Parity (VERPLICHT)

**KRITIEK:** Wanneer documentatie (SKILL.md, CLAUDE.md, etc.) een API of gedrag beschrijft dat nog niet in code bestaat, is dit een **Documentation-Code Gap** die ALTIJD expliciet moet worden gemeld.

**Workflow:**

```
1. Claude schrijft/wijzigt documentatie
2. Claude inventariseert: beschrijft dit iets dat nog niet in code bestaat?
3. Zo ja: EXPLICIET melden aan gebruiker met ⚠️ markering
4. Vraag: "Wil je dit nu of later implementeren?"
5. Bij "nu": direct implementeren
6. Bij "later": TODO markering in documentatie toevoegen
```

**Waarom:**
- Bij sessiewissel leest nieuwe Claude de documentatie en neemt aan dat code bestaat
- Dit veroorzaakt Technical Function Depth (verwijzingen naar niet-bestaande code)
- Preventie is beter dan debugging achteraf

**Zie:** CLAUDE.md sectie "Documentation-Code Parity" voor volledige regels en voorbeelden.

---

## Plan Adherence

Als een feature een plan heeft in `.claude/plans/`:

1. **Lees het plan EERST** voordat je begint
2. **Vergelijk** je aanpak met het plan
3. **Bij afwijking:** vraag gebruiker expliciet
4. **Implementeer** volgens bevestigde aanpak

---

## Rebuild Indicatie

| Wijziging | Rebuild? | Actie |
|-----------|----------|-------|
| TS/JS/JSON | Nee | Hot Reload |
| Native code (.swift, .m) | Ja | ⌘R in Xcode |
| Podfile/package.json | Ja | ⌘R in Xcode |
| Metro config | Metro herstart | `npm start -- --reset-cache` |

---

## Herbruikbare Code Patterns

Deze patterns zijn gestandaardiseerd in de codebase en MOETEN worden gevolgd bij nieuwe implementaties:

| Pattern | Beschrijving | Referentie |
|---------|-------------|------------|
| **Unified Retry** | Exponential backoff met MAX_RETRY_ATTEMPTS (30), ~7h totaal | `chat.ts` scheduleNextRetry() |
| **DB One-Shot Read** | `getContactsOnce()` i.p.v. subscribe/push/unsubscribe | `interfaces.ts` DatabaseService |
| **Connection Recovery** | Auto-reconnect met status listeners | `xmpp.ts` reconnect flow |
| **Download Cancel** | AbortController met cleanup op unmount | `podcastService.ts` downloads |
| **Native Module Bridge** | Triple File: Swift + ObjC .m + TypeScript bridge | `ios-specialist/SKILL.md` sectie "Native Module Bridge Pattern" |

---

## Communicatie met Gebruiker

1. **Eén vraag tegelijk** — tenzij onderling afhankelijk
2. **Deel interpretatie VOOR uitvoering**
3. **Senior-perspectief:** "Zou mijn oma dit begrijpen?"

---

## Compliance Checks

Automatische validatie bij build (`npm run compliance:check`):

| Check | Tool |
|-------|------|
| Contrast ≥7:1 (AAA) | Script |
| Touch targets ≥60pt | ESLint |
| Typography (body ≥18pt) | ESLint |
| i18n completeness | Script |
| Accessibility props | ESLint |

Bij failures: build geblokkeerd tot gefixed.

---

## Referenties

- `CONSTANTS.md` — Single Source of Truth voor constanten
- `CHANGE_VALIDATION_MATRIX.md` — Volledige trigger-matrix
- `.claude/skills/[skill]/SKILL.md` — Skill-specifieke regels
- `CLAUDE.md` sectie 14 — Component Registry
- `CLAUDE.md` sectie 16 — Liquid Glass Feature Parity
