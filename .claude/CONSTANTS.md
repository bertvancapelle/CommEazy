# CommEazy Constants — Single Source of Truth

> **BELANGRIJK:** Dit bestand is de ENIGE bron voor constanten die in meerdere documenten worden gebruikt.
> ALLE andere documenten MOETEN naar dit bestand verwijzen, NIET eigen waarden definiëren.

## Ondersteunde Talen (i18n)

**Aantal:** 13 talen

| Code | Taal | Bestand | Native naam |
|------|------|---------|-------------|
| `nl` | Nederlands | `nl.json` | Nederlands |
| `en` | Engels | `en.json` | English |
| `en-GB` | Engels (UK) | `en-GB.json` | English (UK) |
| `de` | Duits | `de.json` | Deutsch |
| `fr` | Frans | `fr.json` | Français |
| `es` | Spaans | `es.json` | Español |
| `it` | Italiaans | `it.json` | Italiano |
| `no` | Noors | `no.json` | Norsk |
| `sv` | Zweeds | `sv.json` | Svenska |
| `da` | Deens | `da.json` | Dansk |
| `pt` | Portugees | `pt.json` | Português |
| `pt-BR` | Portugees (BR) | `pt-BR.json` | Português (Brasil) |
| `pl` | Pools | `pl.json` | Polski |

**Referentie bestand:** `nl.json` (master voor structuur)

## Text Expansion per Taal

| Taal | Expansie vs Engels | Voorbeeld |
|------|-------------------|-----------|
| Duits | +30% | "Settings" → "Einstellungen" |
| Frans | +20% | "Send" → "Envoyer" |
| Portugees | +20% | "Settings" → "Configurações" |
| Spaans | +15% | "Contact" → "Contacto" |
| Italiaans | +15% | "Send" → "Invia" |
| Nederlands | +10% | "Message" → "Bericht" |
| Noors | +10% | "Send" → "Send" |
| Zweeds | +10% | "Send" → "Skicka" |
| Deens | +10% | "Send" → "Send" |
| Pools | +15% | "Settings" → "Ustawienia" |

## Senior-Inclusive Design Standaarden

### Typography

| Element | Minimum | Aanbevolen | Maximum |
|---------|---------|------------|---------|
| Body text | 18pt | 18pt | - |
| Headings (h3+) | 24pt | 24pt | - |
| Labels | 16pt | 16pt | - |
| Line height | 1.5× | 1.5× | - |

### Touch Targets

| Type | Minimum | Comfortable | Large |
|------|---------|-------------|-------|
| Alle interactieve elementen | 60×60pt | 72pt | 84pt |
| Spacing tussen targets | 12pt | 16pt | - |

### Contrast

| Element | Ratio | Standaard |
|---------|-------|-----------|
| Body text | 7:1 (AAA) | `#1A1A1A` |
| Large text (24pt+) | 4.5:1 (AA) | - |

## Platform Versies

| Platform | Minimum | Target |
|----------|---------|--------|
| iOS | 15.0 | 26+ (Liquid Glass) |
| iPadOS | 15.0 | 26+ (Liquid Glass) |
| Android | 8.0 (API 26) | 14+ |

## Encryption Thresholds

| Scenario | Methode | Threshold |
|----------|---------|-----------|
| Groep ≤8 leden | encrypt-to-all | 8 |
| Groep >8 leden | shared-key | - |
| Outbox TTL | 7 dagen | 168 uur |

## Module Kleuren

| Module | Hex | Gebruik |
|--------|-----|---------|
| Radio | `#00897B` | Teal |
| Podcast | `#7B1FA2` | Paars |
| Luisterboek | `#FF8F00` | Amber |
| E-book | `#303F9F` | Indigo |
| Apple Music | `#FC3C44` | Rood |
| Weer | `#1976D2` | Blauw |
| Nieuws | `#FF6600` | Oranje |

## Performance Budgets

| Metric | Target | Maximum |
|--------|--------|---------|
| Cold start | <3s | 5s |
| FPS scroll | 60fps | - |
| Memory usage | <200MB | 300MB |
| Message list (1000 items) | <1s render | 2s |

## Flow Limieten

| Limiet | Waarde | Reden |
|--------|--------|-------|
| Max stappen per flow | 3 | Senior-inclusive |
| Max navigatie diepte | 2 | Eenvoud |
| Undo window | 5s | Foutherstel |
| Feedback latency | <100ms | Responsiviteit |

## Test Coverage

| Type | Minimum |
|------|---------|
| Unit tests | 80% |
| Service (API calls) | 90% |
| Context (state) | 80% |
| Screen | 70% |
| UI Component | 80% |
| Hook | 85% |

## Skip Button Durations

| Richting | Duur | Reden |
|----------|------|-------|
| Backward | 10s | Kort terug om iets opnieuw te horen |
| Forward | 30s | Langer vooruit om content over te slaan |

## Cache Durations

| Type | TTL | Reden |
|------|-----|-------|
| RSS feeds | 5 min | Balans versheid/belasting |
| Artwork | 24 uur | Stabiel, groot |
| Search results | Session | Niet persistent |

---

## Hoe te Gebruiken

### In SKILL.md bestanden

```markdown
## Typography
Zie `CONSTANTS.md` sectie "Senior-Inclusive Design Standaarden > Typography"
```

### In CLAUDE.md

```markdown
## Ondersteunde Talen
Zie `CONSTANTS.md` sectie "Ondersteunde Talen (i18n)" voor de volledige lijst van 13 talen.
```

### In code documentatie

```typescript
// Touch targets: zie CONSTANTS.md > Senior-Inclusive Design > Touch Targets
const TOUCH_TARGET_MINIMUM = 60; // pt
```

---

## Wijzigingsproces

1. **Wijzig ALLEEN dit bestand** voor constanten
2. Update verwijzingen in andere bestanden indien nodig
3. Commit met prefix `chore(constants):` of `docs(constants):`
4. Valideer dat geen document nog eigen waarden definieert

## Changelog

| Datum | Wijziging |
|-------|-----------|
| 2026-02-23 | Initiële versie - geconsolideerd uit CLAUDE.md en SKILL.md bestanden |
