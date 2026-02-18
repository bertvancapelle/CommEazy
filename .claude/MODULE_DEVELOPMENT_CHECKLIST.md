# Module Ontwikkeling Checklist — CommEazy

Dit document bevat de verplichte checklist voor het ontwikkelen van nieuwe modules/features in CommEazy.

## Wanneer Gebruiken

- Bij het bouwen van een nieuwe module (Radio, Podcast, E-book, etc.)
- Bij het toevoegen van een significant nieuwe feature aan een bestaande module
- Bij het refactoren van een groot deel van de codebase

## Fase 1: Planning (VOOR de eerste regel code)

### Architecture
- [ ] **ADR geschreven** — Architecture Decision Record in `.claude/adrs/`
  - Waarom deze architectuur?
  - Welke alternatieven overwogen?
  - Welke trade-offs gemaakt?
- [ ] **Interface contract bepaald** — Hoe communiceert de module met andere delen?
- [ ] **Data flow diagram** — Hoe stroomt data door de module?

### Types
- [ ] **Types gedefinieerd in `src/types/`** — Geen inline interface definities
- [ ] **API response types apart** — Gescheiden van app types
- [ ] **Mapper functies met tests** — Conversie tussen API en app types

### Testing Strategie
- [ ] **Test bestanden aangemaakt** (leeg met skeletons)
  - `__tests__/[Module]Context.test.tsx`
  - `__tests__/[Module]Screen.test.tsx`
  - `__tests__/[module]Service.test.ts`
- [ ] **Coverage targets bepaald** (zie testing-qa SKILL.md)
- [ ] **E2E flow geïdentificeerd** voor happy path

### Logging Strategie
- [ ] **Log statements geïdentificeerd** — Wat moet gelogd worden?
- [ ] **PII check** — Wat mag NIET gelogd worden?
- [ ] **Performance metrics** — Welke timings zijn belangrijk?

## Fase 2: Implementatie (TIJDENS ontwikkeling)

### Per Service/Hook
- [ ] Interface gedefinieerd
- [ ] Unit tests geschreven (TDD)
- [ ] Implementatie
- [ ] Tests groen
- [ ] Error handling met AppError
- [ ] Logging met correcte levels
- [ ] JSDoc comments

### Per Context
- [ ] State interface gedefinieerd
- [ ] Integration tests geschreven
- [ ] Provider component
- [ ] Custom hooks voor consumers
- [ ] Tests groen
- [ ] useEffect cleanup returns aanwezig
- [ ] Geen memory leaks (event listeners cleanup)

### Per Screen
- [ ] Component tests geschreven
- [ ] UI implementatie volgens ui-designer specs
- [ ] Accessibility labels (alle interactieve elementen)
- [ ] VoiceFocusable wrappers (lijsten >3 items)
- [ ] i18n keys (geen hardcoded strings)
- [ ] Haptic feedback op interacties
- [ ] Tests groen

### Per Component
- [ ] Props interface met JSDoc
- [ ] Unit tests
- [ ] Accessibility compliant
- [ ] Reduced motion respected
- [ ] Tests groen

## Fase 3: Validatie (NA elke component)

### Build Check
- [ ] `npm run typecheck` — Geen TypeScript errors
- [ ] `npm run lint` — Geen ESLint warnings
- [ ] Xcode build succesvol (iOS)

### Manual Testing
- [ ] VoiceOver flow werkt (iOS)
- [ ] TalkBack flow werkt (Android)
- [ ] Dynamic Type op 200% — layout breekt niet
- [ ] Reduced motion ingeschakeld — geen forced animaties

### Code Review (Self)
- [ ] Geen `any` types
- [ ] Geen hardcoded strings
- [ ] Alle useEffect hebben cleanup
- [ ] State groei is begrensd
- [ ] Error handling op alle async operaties

## Fase 4: Oplevering (VOOR module oplevering)

### Test Coverage
- [ ] Unit test coverage ≥80%
- [ ] Integration tests geschreven
- [ ] E2E happy path test geschreven
- [ ] Alle tests groen

### i18n
- [ ] Alle keys in `nl.json`
- [ ] Alle keys in `en.json`
- [ ] Alle keys in `de.json`
- [ ] Alle keys in `fr.json`
- [ ] Alle keys in `es.json`
- [ ] Text expansion getest (Duitse tekst +30%)

### Accessibility
- [ ] VoiceOver complete flow
- [ ] TalkBack complete flow
- [ ] WCAG AAA contrast (7:1)
- [ ] Touch targets ≥60pt
- [ ] Voice commands werken

### Performance
- [ ] Cold start niet significant trager
- [ ] Scroll 60fps
- [ ] Memory gebruik stabiel
- [ ] Geen memory leaks

### Documentation
- [ ] ADR bijgewerkt met finale beslissingen
- [ ] README sectie toegevoegd (indien nodig)
- [ ] Skill Standaardisatie Check uitgevoerd

## Skill Standaardisatie Check

Na oplevering moet de Coordinator deze vragen stellen:

1. **Herbruikbaar pattern?**
   - Is dit pattern bruikbaar in andere modules?
   - → Zo ja: documenteer in relevante SKILL.md

2. **Nieuwe accessibility feature?**
   - Is er een nieuw accessibility pattern geïntroduceerd?
   - → Zo ja: update accessibility-specialist SKILL.md

3. **Nieuwe voice command?**
   - Is er een nieuwe voice command categorie?
   - → Zo ja: update CLAUDE.md sectie 11.2

4. **Nieuwe UI component?**
   - Is er een herbruikbare UI component gemaakt?
   - → Zo ja: documenteer in ui-designer SKILL.md

5. **Nieuwe error handling?**
   - Is er een nieuw error pattern geïntroduceerd?
   - → Zo ja: update error codes documentatie

## Technische Schuld Tracking

Als een item niet afgerond kan worden, documenteer het:

```markdown
## Technische Schuld: [Module Naam]

| Item | Reden | Prioriteit | Issue # |
|------|-------|------------|---------|
| Unit tests RadioContext | Tijd | Hoog | #123 |
| E2E test radio flow | Detox setup issues | Medium | #124 |
```

## Voorbeeld: Radio Module

```
✅ Fase 1: Planning
   - ADR: .claude/adrs/003-radio-architecture.md
   - Types: src/types/radio.ts
   - Tests: src/contexts/__tests__/RadioContext.test.tsx (skeleton)

✅ Fase 2: Implementatie
   - artworkService met tests
   - RadioContext met tests
   - RadioScreen met tests
   - RadioPlayerOverlay met tests

⚠️ Fase 3: Validatie
   - Build: ✅
   - VoiceOver: ✅
   - Tests: ❌ (geen tests geschreven)

❌ Fase 4: Oplevering
   - Coverage: 0% (target: 80%)
   - i18n: ✅ alle 5 talen
   - Accessibility: ✅
   - Documentation: ⚠️ ADR niet geschreven

Technische Schuld:
- Unit tests voor artworkService
- Integration tests voor RadioContext
- Component tests voor RadioScreen
- E2E test voor radio flow
```

---

**Dit document is VERPLICHT te volgen bij nieuwe module ontwikkeling.**
