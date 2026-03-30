# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-30
- **Sessie:** Games Session 7 — Woordraad word list architecture + Trivia UI verbeteringen
- **Commit:** `a3e5dc9` feat: add downloadable word lists for Woordraad + Trivia UI improvements

## Voltooide Taken Deze Sessie

1. **Woordraad Word List Architecture (7 taken voltooid):**
   - `src/services/downloadService.ts` — `'woordraad'` GameDataType + validation (targetWords + validGuesses arrays)
   - `src/engines/woordraad/engine.ts` — refactored: functions accept external word lists as parameters (no more hardcoded words)
   - `src/engines/woordraad/wordBank.ts` — NEW: in-memory word list loader (mirrors questionBank.ts pattern)
   - `src/screens/modules/WoordraadScreen.tsx` — download flow: loading/download/downloading phases before menu
   - `src/locales/*.json` (13 bestanden) — `games.woordraad.download.*` keys in alle talen
   - `scripts/generate_woordraad.py` — NEW: Python script: Hunspell × OpenSubtitles → JSON word lists
   - `scripts/woordraad-nl.json` — Generated Dutch test data: 2,755 target words + 7,262 valid guesses (127 KB)

2. **Trivia UI Improvements (plan: delegated-petting-lecun.md):**
   - `src/engines/trivia/types.ts` — feedbackSeconds + FEEDBACK_TIMER_OPTIONS
   - `src/screens/modules/TriviaScreen.tsx` — overlay feedback popup, configurable timer, AsyncStorage persistence, gamepad button rechts
   - Game screens unified gamepad button pattern (Memory, Solitaire, Sudoku, Woordy)

## Openstaande Taken

1. **Woordraad-nl.json uploaden naar GitHub Releases:**
   - Bestand staat in `scripts/woordraad-nl.json` (127 KB)
   - Moet naar `CommEazy/game-data` repo als `v1.0/woordraad-nl.json`
   - `gh` CLI is niet geïnstalleerd — handmatig uploaden

2. **Nederlandse vertaling trivia-nl.json (GEBRUIKER HANDELT DIT AF):**
   - 4.216 vragen moeten vertaald worden van Engels naar Nederlands
   - Huidige trivia-nl.json bevat Engelse content als placeholder
   - Script `translate_to_dutch.py` staat klaar maar vereist Anthropic API credits

3. **Trivia/Woordraad meer talen:**
   - generate_woordraad.py ondersteunt `--all` voor alle 11 talen tegelijk
   - Trivia JSON bestanden voor de, fr, es, it, no, sv, da, pt, pt-BR, pl

4. **Eerder openstaand (ongewijzigd):**
   - Dead code categorie 2 — 8 componenten voor ongebouwde features
   - 3 transparent modals met LiquidGlassView te valideren
   - Uncommitted changes in `MediaIndicator.tsx` + `AppleMusicScreen.tsx`
   - Bluetooth media controls — niet geïmplementeerd
   - Glass Player flickering — open issue
   - SongCollectionModal uitbreiding — PNA ontwerp, niet geïmplementeerd
   - i18n cleanup — Mail welcome/emailRequired keys ongebruikt

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

Geen.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Two-list word architecture | targetWords (common, ~2755) vs validGuesses (all Hunspell, ~7262) — balans tussen variatie en speelbaarheid |
| ASCII-only filter | Game keyboard is A-Z, woorden met accenten/ligatures (é, ï, ĳ) zijn niet typbaar |
| Hunspell ∩ OpenSubtitles voor targets | Alleen woorden die zowel in woordenboek als in ondertitels voorkomen → herkenbare woorden |
| generate_woordraad.py met auto-download | Script downloadt Hunspell + frequentielijsten automatisch van GitHub |
| Trivia feedback overlay popup | Centered overlay i.p.v. inline banner — geen scrollen nodig om feedback te zien |
| Trivia feedback timer configureerbaar | 1s, 2s, 3s, 5s — standaard 2s, opgeslagen in AsyncStorage |

## Context voor Volgende Sessie

- **Alle 6 games actief:** Woordraad, Sudoku, Solitaire, Memory, Trivia, Woordy
- **Engines locatie:** `src/engines/{woordraad,sudoku,solitaire,memory,trivia,woordy}/`
- **Screens locatie:** `src/screens/modules/{Woordraad,Sudoku,Solitaire,Memory,Trivia,Woordy}Screen.tsx`
- **Download service:** `src/services/downloadService.ts` — gedeeld voor trivia + woordy + woordraad
- **Woordraad data flow:** WoordraadScreen init → checkDataStatus → loadWordLists (lokaal) OF download prompt → downloadGameData → loadWordLists → menu phase
- **Word bank:** In-memory cache (wordBank.ts), getTargetWords() + getValidGuesses() na loadWordLists()
- **Game data scripts:** `scripts/generate_woordraad.py` (word list gen) + `game-data/fetch_opentdb.py` (trivia fetcher) + `game-data/translate_to_dutch.py` (vertaler)
- **Generated data:** `scripts/woordraad-nl.json` — 2,755 targets + 7,262 guesses — nog te uploaden naar GitHub
- **Trivia settings:** AsyncStorage `@commeazy/trivia_settings` — difficulty, questionsPerRound, timerSeconds, feedbackSeconds
- **GameLobbyScreen:** Alle 6 routes actief, iterates over ALL_GAME_TYPES
- **WatermelonDB schema:** Versie 30 (game_sessions + game_stats tabellen)
- **XMPP game protocol:** Types gedefinieerd, hooks gebouwd, sendGameStanza is stub
