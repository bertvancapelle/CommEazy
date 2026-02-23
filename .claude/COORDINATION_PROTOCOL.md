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
