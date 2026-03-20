# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-20
- **Sessie:** Recently Played Stations + 3 PNA bug fixes
- **Commit:** `273ccfa`

## Voltooide Taken Deze Sessie

1. **Recently Played Stations** (`62213e6` — vorige sessie/context)
   - RecentTabButton component, useRecentStations hook, RadioScreen integratie
   - Drie-tab layout: Recent | Favorieten | Zoeken

2. **Bug 1: Glass Player mini player visibility restore** (`273ccfa`)
   - `GlassPlayerWindow.swift` `showMini()` guard blokkeerde visibility restore wanneer window `setTemporarilyHidden(true)` had
   - Fix: detecteer alpha == 0 of isHidden, restore frame + animate alpha to 1
   - Haptic feedback + MediaIndicator werkten al, nu ook mini player zichtbaar

3. **Bug 2: Tab button dynamic text scaling** (`273ccfa`)
   - `RecentTabButton.tsx`, `FavoriteButton.tsx` (FavoriteTabButton), `SearchButton.tsx` (SearchTabButton)
   - Toegevoegd: `numberOfLines={1}` + `adjustsFontSizeToFit` + `minimumFontScale={0.75}`
   - Voorkomt woordafbreking in tab labels bij langere vertalingen

4. **Bug 3: ChipSelector defaults from profile** (`273ccfa`)
   - `RadioScreen.tsx`: country default = `userCountryCode ?? detectCountryFromLocale(i18n.language)`
   - `RadioScreen.tsx`: language default = `detectLanguageFromLocale(i18n.language)`
   - `PodcastScreen.tsx`: country default = `userCountryCode ?? detectCountryFromLocale(i18n.language)`
   - `BooksScreen.tsx`: al correct (gebruikt `detectLanguageFromLocale`)
   - Priority chain: savedBrowsing > profile country/app language > fallback

## Openstaande Taken

1. **Fundamentele UIWindow beperking** — React Native Modal creëert nieuw UIWindow, UIBlurEffect heeft niets om te blurren. Glass toont material texture + tint, maar geen echte blur-through-to-content.

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

Geen.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Mini player visibility restore via alpha + frame check | `setTemporarilyHidden()` zet alleen alpha=0 zonder state change, dus `showMini()` guard op `.hidden` miste dit |
| `minimumFontScale={0.75}` voor tab buttons | Max 25% verkleining (18pt → ~13.5pt) — voldoende voor langere vertalingen, nog leesbaar voor senioren |
| Profile country + app language als chip defaults | Gebruiker verwacht dat chips matchen met profiel/taal instellingen, niet hardcoded NL/nl |
| Geen live-update bij taalwissel in open module | Gebruiker gaat altijd via Instellingen, module re-renders bij terugkeer — initial mount defaults zijn voldoende |

## Context voor Volgende Sessie

- `ios/GlassPlayerWindow/GlassPlayerWindow.swift:444` — showMini() visibility restore guard
- `src/components/RecentTabButton.tsx`, `FavoriteButton.tsx`, `SearchButton.tsx` — alle tab buttons hebben nu dynamic text scaling
- `src/screens/modules/RadioScreen.tsx` — ChipSelector defaults via useModuleConfig + i18n
- `src/screens/modules/PodcastScreen.tsx` — idem voor country default
- `.claude/standards/MODAL_GLASS_STANDARD.md` — Single source of truth voor alle modal implementaties
