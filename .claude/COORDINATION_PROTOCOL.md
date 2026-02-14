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

## Handhaving

Dit protocol is **VERPLICHT**. Bij elke wijziging:

1. Toon de validatie-resultaten aan de gebruiker
2. Bij ❌ blokkeerders: NIET uitvoeren zonder expliciete goedkeuring
3. Bij ⚠️ waarschuwingen: vermelden en bespreken
4. Update relevante skill-documenten als nieuwe regels nodig zijn
