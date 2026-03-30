# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-30
- **Sessie:** Games Session 5 — Trivia download service implementatie
- **Commit:** 1908c1c — feat: add on-demand trivia question download per language

## Voltooide Taken Deze Sessie

1. **Trivia Download Service — On-demand vragen per taal:**
   - Nieuw: `src/services/downloadService.ts` — Gedeelde download service voor Trivia + Woordy
     - GitHub Releases URL: `https://github.com/CommEazy/game-data/releases/download/v1.0/{type}-{lang}.json`
     - RNFS.downloadFile() met progress tracking, retry (3x exponential backoff), timeout 60s
     - AsyncStorage metadata (versie + taal tracking)
     - File validation (JSON structuur check)
     - Exports: checkDataStatus, downloadGameData, readLocalGameData, clearGameData, getStorageUsage
   - Refactored: `src/engines/trivia/questionBank.ts` — Verwijderd: ~40 hardcoded Engelse vragen (BUNDLED_QUESTIONS). Nieuw: in-memory cache met loadQuestions(language) die uit lokale JSON bestanden leest via readLocalGameData
   - Updated: `src/screens/modules/TriviaScreen.tsx` — 3 nieuwe game phases (loading → download → downloading), download prompt UI met progress bar, error handling met retry
   - i18n: `games.trivia.download.*` keys (9 keys) in alle 13 talen
   - Data: `game-data/trivia-nl.json` + `game-data/trivia-en.json` (120 vragen per taal, 7 thema's, 3 moeilijkheidsniveaus)

## Openstaande Taken

1. **GitHub Repo Setup (VEREIST voor werkende download):**
   - Public repo `CommEazy/game-data` aanmaken op GitHub
   - Release v1.0 aanmaken met trivia-nl.json en trivia-en.json als assets
   - Bestanden staan klaar in `game-data/` folder van het project

2. **Trivia verbeteringen (toekomstig):**
   - Meer talen: trivia JSON bestanden voor de, fr, es, it, no, sv, da, pt, pt-BR, pl
   - Multiplayer via XMPP (synchroon per vraag)
   - Woordy trivia-velden integratie (vragen delen met standalone Trivia)

3. **Woordy verbeteringen (toekomstig):**
   - Woordenlijst validatie (Hunspell dictionary integratie, nu placeholder)
   - Multiplayer via XMPP (turn-based)
   - Download service voor dictionaries per taal (downloadService.ts al voorbereid met 'woordy' type)
   - Taal selectie in menu (nu hardcoded 'nl')

4. **Final Polish:**
   - Consistentie check over alle 6 games
   - Visuele fine-tuning van board rendering (Woordy)

5. **Eerder openstaand (ongewijzigd):**
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
| On-demand download i.p.v. gebundelde vragen | 0 MB bundle, ~1.5 MB download per taal, voldoet aan TRIVIA_DESIGN.md §8.3-8.4 |
| GitHub Releases als hosting | Publiek, geen credentials nodig, gratis, CDN via GitHub |
| Gedeelde downloadService voor Trivia + Woordy | Voorkomt duplicatie, Woordy kan dezelfde service gebruiken voor dictionaries |
| 120 vragen per taal | Voldoende voor gevarieerde gameplay, later uitbreidbaar |
| 7 phases in TriviaScreen | loading → download → downloading → menu → category → playing → gameover |
| Geen NetInfo dependency | RNFS error handling volstaat, geen extra dependency nodig |

## Context voor Volgende Sessie

- **Alle 6 games actief:** Woordraad, Sudoku, Solitaire, Memory, Trivia, Woordy
- **Engines locatie:** `src/engines/{woordraad,sudoku,solitaire,memory,trivia,woordy}/`
- **Screens locatie:** `src/screens/modules/{Woordraad,Sudoku,Solitaire,Memory,Trivia,Woordy}Screen.tsx`
- **Download service:** `src/services/downloadService.ts` — gedeeld voor trivia + woordy
- **Trivia data flow:** TriviaScreen init → checkDataStatus → loadQuestions (lokaal) OF download prompt → downloadGameData → loadQuestions → menu phase
- **Question bank:** In-memory cache, geladen via readLocalGameData uit DocumentDirectory
- **Game data bestanden:** `game-data/trivia-{lang}.json` (klaar voor GitHub Releases upload)
- **GameLobbyScreen:** Alle 6 routes actief, iterates over ALL_GAME_TYPES
- **Woordy engine:** Pure functions, 15×15 board, tap-to-place, universal letter values
- **WatermelonDB schema:** Versie 30 (game_sessions + game_stats tabellen)
- **XMPP game protocol:** Types gedefinieerd, hooks gebouwd, sendGameStanza is stub
