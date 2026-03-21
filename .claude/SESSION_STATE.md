# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-21
- **Sessie:** Fix AudioOrchestrator re-registration race condition + MediaIndicator always visible
- **Commit:** `4e63885`

## Voltooide Taken Deze Sessie

1. **AudioOrchestrator re-registration race condition opgelost** (`4e63885`)
   - **Root cause:** `audioOrchestrator` context value object in useEffect dependency arrays van alle 7 audio sources
   - Wanneer `requestPlayback()` `activeSource` wijzigde → context value veranderde → effects re-runden → cleanup riep `unregisterSource()` aan → die cleared `activeSource` terug naar null
   - **Fix:** `audioOrchestratorRef` pattern in alle 7 files — decouples registration/push effects van context value changes
   - Bestanden gefixt:

   | Source | File | Fix |
   |--------|------|-----|
   | RadioContext | `src/contexts/RadioContext.tsx` | audioOrchestratorRef in register + push |
   | PodcastContext | `src/contexts/PodcastContext.tsx` | audioOrchestratorRef in register + push |
   | BooksContext | `src/contexts/BooksContext.tsx` | audioOrchestratorRef in register + push |
   | AppleMusicContext | `src/contexts/AppleMusicContext.tsx` | audioOrchestratorRef in register + push |
   | useArticleTTS | `src/hooks/useArticleTTS.ts` | Bestaande ref, fixed deps |
   | useMailTTS | `src/hooks/useMailTTS.ts` | Bestaande ref, fixed deps |
   | useWeather | `src/hooks/useWeather.ts` | Bestaande ref, fixed deps |

2. **MediaIndicator altijd zichtbaar** (`4e63885`)
   - Gebruiker expliciet gevraagd: "voor een senior logischer als de media indicator ook zichtbaar is in de module header als hij in de module zit"
   - `shouldHide` logica verwijderd uit MediaIndicator.tsx
   - Dead code opgeruimd: `isGlassMinimized` state + Glass Player event listeners (alleen voor shouldHide)
   - `currentSource` prop behouden — nog gebruikt in tap handler om onnodige navigatie te voorkomen

## Openstaande Taken

1. **AirPlay routing failure** — 5-6s connection attempt → fallback → geen geluid. AirPlay fix (`6967837`) met `longFormAudio` policy nog niet werkend. Moet onderzocht worden.
2. **Glass Player flickering** — Bottom + right side flicker. Separate issue.
3. **Fundamentele UIWindow beperking** — React Native Modal creëert nieuw UIWindow, UIBlurEffect heeft niets om te blurren.
4. **SongCollectionModal uitbreiding** — Bulk album toevoegen was in PNA ontwerp maar nog niet geïmplementeerd.

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

Geen.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| `audioOrchestratorRef` pattern | Voorkomt re-registration cycles door context value changes; refs triggeren geen re-renders |
| MediaIndicator altijd zichtbaar | Senior UX: consistent gedrag, geen verschil tussen modules. Gebruiker expliciet gevraagd. |
| `shouldHide` + `isGlassMinimized` verwijderd | Dead code na design beslissing; Glass Player minimized state niet meer nodig voor visibility |
| `currentSource` prop behouden | Nog nodig in tap handler voor pane navigation logica |

## Context voor Volgende Sessie

- `src/contexts/AudioOrchestratorContext.tsx`: Centraal punt — `activeSource`, `activeState`, `updateState()`, `getActiveState()`
- `src/components/MediaIndicator.tsx`: Leest alleen van orchestrator, altijd zichtbaar wanneer activeSource != null
- Pattern per context: `audioOrchestratorRef` + `buildXxxState()` callback + refs + push effect + `registerSource()` met `getState`
- AirPlay issue: `src/services/glassPlayer.ts` + `AirPlayModule.swift` — longFormAudio policy werkt niet
- Glass Player flicker: `GlassPlayerWindow/MiniPlayerNativeView.swift` + `FullPlayerNativeView.swift`
