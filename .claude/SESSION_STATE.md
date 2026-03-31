# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-31
- **Sessie:** Apple Music Full Player UI Freeze Fix
- **Commit:** `f828f2b` fix(appleMusic): prevent Full Player UI freeze by eliminating playbackState re-render cascade

## Voltooide Taken Deze Sessie

1. **Apple Music Full Player UI freeze fix (3 bestanden):**
   - **Root cause:** `playbackState` (met snel wijzigende `currentTime`) in context `useMemo` dep array veroorzaakte dat ALLE consumers elke ~0.5s re-renderen. 3 useEffects in AppleMusicScreen maakten native bridge calls op elke tick. Bij seek-to-end + track transition → MusicKit event burst → exponentiële cascade → permanente JS thread deadlock.
   - **AppleMusicContext.tsx:** `playbackPositionRef`/`playbackDurationRef` refs (updated elke tick, geen re-renders). Event listener nu alleen `setPlaybackState` bij significante wijzigingen (status/shuffle/repeat change, positie sprong >2s). Stable getter callbacks `getPlaybackPosition()`/`getPlaybackDuration()` via context.
   - **appleMusicContextTypes.ts:** Getter type definities toegevoegd aan `AppleMusicContextValue` interface.
   - **AppleMusicScreen.tsx:** Glass Player Effect 2 → 2a (status push, geen playbackState dep) + 2b (1s interval polling refs). Effect 3 dependencies ontdaan van `playbackState?.currentTime/duration`. Skip handlers (`onSkipForward`/`onSkipBackward`) lezen nu positie van refs.
   - **Design decision:** MiniPlayer/FullPlayer (iOS <26 fallback) behouden `playbackState` referenties — safe omdat Glass Player effects niet bestaan op iOS <26, en `playbackState` nu alleen update bij significante wijzigingen.

2. **Eerdere commits (vorige sub-sessie):**
   - `806a574` fix(appleMusic): add catalog→library fallback for album/playlist playback
   - `76dc6c4` fix(games): freeze timer on game completion

## Openstaande Taken

1. **Trivia UI verbeteringen (plan beschikbaar):**
   - Plan: `delegated-petting-lecun.md`
   - 4 wijzigingen: gamepad rechts, feedback overlay, configureerbare timer, AsyncStorage persistentie
   - Nog NIET gestart

2. **Nederlandse vertaling trivia-nl.json (GEBRUIKER HANDELT DIT AF):**
   - 4.216 vragen moeten vertaald worden van Engels naar Nederlands
   - Script `translate_to_dutch.py` staat klaar maar vereist Anthropic API credits

3. **Eerder openstaand (ongewijzigd):**
   - Dead code categorie 2 — 8 componenten voor ongebouwde features
   - 3 transparent modals met LiquidGlassView te valideren
   - Bluetooth media controls — niet geïmplementeerd
   - Glass Player flickering — open issue
   - SongCollectionModal uitbreiding — PNA ontwerp, niet geïmplementeerd
   - i18n cleanup — Mail welcome/emailRequired keys ongebruikt

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Ref-based position tracking i.p.v. React state | Refs updaten elke tick zonder re-renders; stable getters voor consumers die real-time positie nodig hebben |
| >2s threshold voor React state update | Filtert normale playback ticks (0.5s interval) maar vangt seeks en track transitions (>2s sprong) |
| Glass Player effect split (2a + 2b) | 2a: instant status push (play/pause/shuffle). 2b: 1s polling interval voor positie — voorkomt native bridge flooding |
| MiniPlayer/FullPlayer behouden playbackState | Alleen gerenderd op iOS <26 waar geen Glass Player cascade bestaat — geen fix nodig |
| isSeeking guard SKIPPED | >2s threshold in debounce logica vangt seek-scenario's al op |

## Context voor Volgende Sessie

- **AppleMusicContext.tsx:** `playbackPositionRef`/`playbackDurationRef` (line ~273), getters (line ~926), debounce logica (line ~276-325)
- **AppleMusicScreen.tsx:** Effect 2a (line ~498), Effect 2b (line ~517), Effect 3 (line ~540)
- **AppleMusicModule.swift:** `playAlbum()` (line ~785) en `playPlaylist()` (line ~850) hebben dual-path catalog→library
- **Alle 6 games actief:** Woordraad, Sudoku, Solitaire, Memory, Trivia, Woordy
- **WatermelonDB schema:** Versie 30 (game_sessions + game_stats tabellen)
- **XMPP game protocol:** Types gedefinieerd, hooks gebouwd, sendGameStanza is stub
