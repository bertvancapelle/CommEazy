# Collapsible Panes — iPad Split View

## Status: ONTWERP KLAAR — Implementatie later (na communicatie features)

## Samenvatting

iPad gebruikers kunnen een pane volledig uit beeld slepen via de bestaande draggable divider. De handle wordt breder met een richtingspijl zodat senioren weten waar het verborgen pane is en hoe ze het kunnen terughalen.

## Ontwerp Specificaties

### States

```
STATE 1: Normaal (twee panes zichtbaar)
┌─────────────────┐⋮┌─────────────────┐
│                  │⋮│                  │
│   Links pane     │⋮│   Rechts pane    │
│                  │⋮│                  │
└─────────────────┘⋮└─────────────────┘
                   ↑
              Handle: ⋮ (~8pt breed)

STATE 2: Rechts pane collapsed
┌────────────────────────────────────┐⋮▶
│                                     │⋮▶
│         Links pane (100%)           │⋮▶
│                                     │⋮▶
└────────────────────────────────────┘⋮▶
                                      ↑
                            Handle: ⋮▶ (~20-24pt breed)

STATE 3: Links pane collapsed
◀⋮┌────────────────────────────────────┐
◀⋮│                                     │
◀⋮│         Rechts pane (100%)          │
◀⋮│                                     │
◀⋮└────────────────────────────────────┘
↑
Handle: ◀⋮ (~20-24pt breed)
```

### Handle Design

- **Normaal:** `⋮` (drie verticale punten, ~8pt breed)
- **Collapsed:** Pijl wordt NAAST het middelste punt geplaatst
  - Rechts pane verborgen: `⋮▶` (pijl rechts van middelste punt)
  - Links pane verborgen: `◀⋮` (pijl links van middelste punt)
- De pijl maakt de handle **breder** (~20-24pt), waardoor hij meer opvalt
- **Geen kleurwijziging** voorlopig — mogelijk later op basis van gebruikersfeedback

### Snap Gedrag

- **Snap-drempel:** Wanneer pane kleiner wordt dan `MIN_RATIO × screenWidth + 60px`
- Huidige `MIN_RATIO = 0.25` (25% van schermbreedte)

| iPad Model | Schermbreedte (landscape) | MIN_PANE_WIDTH (25%) | Snap-drempel (+60px) |
|------------|---------------------------|----------------------|----------------------|
| iPad Pro 13" | 1024pt | 256pt | 316pt |
| iPad Pro 11" | 834pt | 209pt | 269pt |
| iPad Air/10e gen | 820pt | 205pt | 265pt |
| iPad Mini | 744pt | 186pt | 246pt |

- Onder snap-drempel → pane klapt volledig dicht (ratio → 0.0 of 1.0)
- Terug openen → snap naar MIN_RATIO (25%) als minimale startpositie

### Beslissingen

| Aspect | Beslissing |
|--------|------------|
| **Persistentie** | NEE — bij herstart altijd terug naar opgeslagen ratio (niet collapsed) |
| **Cross-pane navigatie** | JA — collapsed pane opent automatisch met vorige ratio |
| **Glass Player bij collapse** | Stop Glass Player UI, audio blijft doorspelen |
| **MediaIndicator** | Toont waveform in zichtbare pane header → tap opent collapsed pane |
| **Beide panes collapsable** | JA — links OF rechts |
| **Handle kleur** | Standaard (geen kleurwijziging voorlopig) |

### Glass Player Interactie

1. Gebruiker collapsed pane waar audio module (bijv. Radio) in zit
2. Glass Player UI wordt gestopt (`hide()`)
3. Audio blijft doorspelen (RadioContext `isPlaying` blijft `true`)
4. MediaIndicator in de header van het zichtbare pane toont waveform animatie
5. Gebruiker tikt op MediaIndicator → collapsed pane schuift terug open
6. Glass Player wordt opnieuw getoond (`showFromMinimized()`)

### Technische Wijzigingen Nodig

| Bestand | Wijziging |
|---------|-----------|
| `DraggableDivider.tsx` | Toestaan ratio 0.0 en 1.0, snap logica, bredere handle met pijl |
| `PaneContext.tsx` | `Math.max(0.0, Math.min(1.0, ratio))`, collapsed state tracking |
| `SplitViewLayout.tsx` | Pane verbergen bij ratio 0.0/1.0 |
| `MediaIndicator.tsx` | Bij tap: ook collapsed pane openen via PaneContext |

### Geen Wijzigingen Nodig

- `useGlassPlayer.ts` — Bestaande `hide()` / `showFromMinimized()` voldoende
- `glassPlayer.ts` — Bestaande bridge methoden voldoende
- `MediaIndicator.tsx` — Bestaande `AUDIO_SOURCE_TO_MODULE` mapping herbruikbaar

---

*Ontwerp voltooid via PNA sessie op 2026-02-26. Implementatie gepland na communicatie features (berichten, bellen, videobellen).*
