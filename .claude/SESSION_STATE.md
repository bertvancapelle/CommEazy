# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-30
- **Sessie:** Games Session 6 — Trivia vragenbank opschalen naar ~4.216 vragen
- **Commit:** Geen code commits deze sessie (alleen data bestanden + scripts)

## Voltooide Taken Deze Sessie

1. **Trivia Vragenbank Opschalen (120 → 4.216 vragen):**
   - Nieuw: `game-data/fetch_opentdb.py` — Python script dat alle verified questions van OpenTDB API haalt
     - Twee-pass strategie met session tokens, per-categorie fetching, deduplicatie
     - 24 OpenTDB categorieën → 7 CommEazy thema's (general, arts, entertainment, science, sports, history, animals)
     - Sequentiële ID toewijzing (en-0001 t/m en-4216)
   - Nieuw: `game-data/translate_to_dutch.py` — Python script voor EN→NL vertaling via Anthropic API
     - Batches van 25 vragen, checkpoint-based resume, retry met exponential backoff
     - Model: claude-3-5-sonnet-20241022, stdlib urllib (geen dependencies)
     - **NIET succesvol uitgevoerd** — API credits te laag (Max abonnement ≠ API credits)
   - Updated: `game-data/trivia-en.json` — Opgeschaald van 120 naar 4.216 Engelse vragen (1.5 MB)
     - Verdeling: entertainment: 2206, history: 689, science: 438, general: 379, arts: 215, sports: 160, animals: 129
   - Updated: `game-data/trivia-nl.json` — **Bevat nog ENGELSE content** (placeholder, zelfde als trivia-en.json)
     - Gebruiker handelt vertaling zelf af buiten Claude

2. **Beide JSON bestanden geüpload naar GitHub:**
   - Gebruiker heeft trivia-en.json en trivia-nl.json handmatig naar GitHub geüpload
   - Download flow in de app kan nu getest worden (content is Engels in beide bestanden)

## Openstaande Taken

1. **Nederlandse vertaling trivia-nl.json (GEBRUIKER HANDELT DIT AF):**
   - 4.216 vragen moeten vertaald worden van Engels naar Nederlands
   - Huidige trivia-nl.json bevat Engelse content als placeholder
   - Na vertaling: opnieuw uploaden naar GitHub Release
   - Script `translate_to_dutch.py` staat klaar maar vereist Anthropic API credits (~$3-5) of alternatief (DeepL)

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
| OpenTDB als bron voor trivia vragen | CC BY-SA 4.0 licentie, 4.216 verified multiple-choice vragen, gratis API |
| 4.216 vragen per taal (was 120) | Veel meer variatie, minder herhaling bij langdurig gebruik |
| Vertaling uitgesteld | Anthropic API credits te laag, Max abonnement ≠ API credits. Gebruiker handelt af |
| Engelse placeholder in trivia-nl.json | Download flow kan getest worden ongeacht content taal |
| translate_to_dutch.py als apart script | Herbruikbaar voor andere talen, checkpoint-based resume |

## Context voor Volgende Sessie

- **Alle 6 games actief:** Woordraad, Sudoku, Solitaire, Memory, Trivia, Woordy
- **Engines locatie:** `src/engines/{woordraad,sudoku,solitaire,memory,trivia,woordy}/`
- **Screens locatie:** `src/screens/modules/{Woordraad,Sudoku,Solitaire,Memory,Trivia,Woordy}Screen.tsx`
- **Download service:** `src/services/downloadService.ts` — gedeeld voor trivia + woordy
- **Trivia data flow:** TriviaScreen init → checkDataStatus → loadQuestions (lokaal) OF download prompt → downloadGameData → loadQuestions → menu phase
- **Question bank:** In-memory cache, geladen via readLocalGameData uit DocumentDirectory
- **Game data bestanden:** `game-data/trivia-{lang}.json` — geüpload naar GitHub, nl.json bevat nog Engelse content
- **Game data scripts:** `game-data/fetch_opentdb.py` (fetcher) + `game-data/translate_to_dutch.py` (vertaler, vereist API credits)
- **GameLobbyScreen:** Alle 6 routes actief, iterates over ALL_GAME_TYPES
- **Woordy engine:** Pure functions, 15×15 board, tap-to-place, universal letter values
- **WatermelonDB schema:** Versie 30 (game_sessions + game_stats tabellen)
- **XMPP game protocol:** Types gedefinieerd, hooks gebouwd, sendGameStanza is stub
- **Trivia verdeling (4.216 vragen):** entertainment: 2206, history: 689, science: 438, general: 379, arts: 215, sports: 160, animals: 129
