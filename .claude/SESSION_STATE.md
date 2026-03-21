# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-21
- **Sessie:** AudioOrchestrator Push+Pull — Single Source of Truth voor alle audio state
- **Commit:** `cf4e743`

## Voltooide Taken Deze Sessie

1. **AudioOrchestrator Push+Pull migratie voltooid** (`cf4e743`)
   - 6-fasen migratieplan volledig uitgevoerd
   - Alle 7 audio sources gemigreerd naar Push+Pull pattern:

   | Source | Key | Status |
   |--------|-----|--------|
   | RadioContext | `'radio'` | ✅ Push+Pull |
   | PodcastContext | `'podcast'` | ✅ Push+Pull |
   | AppleMusicContext | `'appleMusic'` | ✅ Push+Pull |
   | BooksContext | `'books'` | ✅ Push+Pull |
   | useArticleTTS | `'tts:article'` | ✅ Push+Pull |
   | useMailTTS | `'tts:mail'` | ✅ Push+Pull |
   | useWeather | `'tts:weather'` | ✅ Push+Pull |

   - Consumers opgeschoond:
     - `MediaIndicator.tsx`: leest nu alleen `activeState` van orchestrator (geen context imports meer)
     - `useActivePlayback.ts`: leest `activeState` van orchestrator, individuele contexts alleen voor callbacks
   - Legacy `'tts'` (generiek) verwijderd uit `AudioSource` type
   - Unused imports opgeruimd (colors, context hooks)
   - 11 bestanden gewijzigd, 733 insertions, 296 deletions

2. **MediaIndicator bug gefixt**
   - `showSleepTimerIndicator` refereerde verwijderde variabelen (`radioSleepTimerFallback`, `appleMusicSleepTimerFallback`)
   - Vereenvoudigd naar `activeState?.sleepTimerActive ?? false`

3. **useWeather.ts gemist in Phase 5d — alsnog gemigreerd**
   - Gebruikte nog generiek `'tts'` key (6 occurrences)
   - Volledig gemigreerd naar `'tts:weather'` met `buildWeatherTtsState()`, refs, push effect

## Openstaande Taken

1. **Fundamentele UIWindow beperking** — React Native Modal creëert nieuw UIWindow, UIBlurEffect heeft niets om te blurren. Glass toont material texture + tint, maar geen echte blur-through-to-content.
2. **SongCollectionModal uitbreiding** — Bulk album toevoegen (`songs: Song[]` + `albumTitle?: string` props) was in PNA ontwerp maar nog niet geïmplementeerd. Optionele toekomstige taak.
3. **Testen op fysiek device** — Verifieer dat MediaIndicator, Glass MiniPlayer, en AirPlay routing correct werken na de refactor.

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

Geen.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Push+Pull hybrid (Aanpak 2) | Gebruiker koos expliciet: "dit moet altijd en stabiel werken!" — Push is primair (reactief), Pull is safety net fallback |
| `activeState` als Single Source of Truth | MediaIndicator en useActivePlayback lezen ALLEEN van orchestrator, niet van individuele contexts |
| TTS keys specifiek per module (`tts:article`, `tts:mail`, `tts:weather`) | Voorkomt conflicten tussen TTS sources; `sourceToModuleName()` mapt naar `'tts'` voor display |
| `buildXxxState()` + refs pattern | Callbacks lezen via refs om re-registration in useEffect te voorkomen; stabiele referenties |
| Legacy `'tts'` verwijderd uit AudioSource type | Alle consumers gemigreerd, geen backwards compatibility nodig |

## Context voor Volgende Sessie

- `src/contexts/AudioOrchestratorContext.tsx`: Centraal punt — `activeSource`, `activeState`, `updateState()`, `getActiveState()`
- `src/components/MediaIndicator.tsx`: Leest alleen van orchestrator (geen context imports)
- `src/hooks/useActivePlayback.ts`: Leest `activeState` van orchestrator, callbacks van individual contexts
- Pattern per context: `buildXxxState()` callback + refs + push effect + `registerSource()` met `getState`
- Vorige sessie: AirPlay fix (`6967837`) met `longFormAudio` policy — moet nog getest worden op fysiek device
