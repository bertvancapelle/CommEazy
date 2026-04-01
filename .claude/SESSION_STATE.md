# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-04-01
- **Sessie:** Woordy Improvements + GameHeader Compact Mode
- **Commit:** `f844c5b` feat(games): add Woordy fullscreen board, tile swap, compact timer + hide trivia fields

## Voltooide Taken Deze Sessie

1. **GameHeader compact mode (GameHeader.tsx):**
   - Wanneer alleen timer getoond wordt (geen score, geen actions), rendeert als slanke single-line bar (~26pt i.p.v. ~56pt)
   - Compact mode: clock icon + geformatteerde tijd, gecentreerd
   - Automatisch actief in Woordy en Sudoku (games die alleen timer tonen)

2. **Woordy fullscreen board (WoordyScreen.tsx):**
   - Expand button rechtsonder op het inline board (semi-transparant, moduleColor)
   - Modal met fullscreen board: `FULL_CELL_SIZE` berekend op basis van schermbreedte
   - Contract button om terug te gaan naar inline weergave
   - `renderCell()` gerefactored: accepteert dynamisch `cellSize` parameter, inline styles i.p.v. StyleSheet

3. **Woordy tile swap feature (WoordyScreen.tsx):**
   - "Ruilen" knop in action bar (alleen zichtbaar als bag nog tegels heeft en geen pending tiles op board)
   - Swap mode: tik op rack-tegels om ze te selecteren (rood gemarkeerd)
   - Bevestig swap → geselecteerde tegels terug naar bag, nieuwe tegels getrokken
   - Annuleer om swap mode te verlaten
   - Gebruikt bestaande `swapTiles()` engine functie (engine.ts:439-490)

4. **Woordy trivia fields verborgen (WoordyScreen.tsx):**
   - Trivia velden (`fieldType === 'trivia'`) worden nu als 'normal' gerenderd totdat `triviaRevealed === true`
   - Geen gele vakken meer zichtbaar vóór activatie
   - Na activatie (woord geplaatst op trivia veld): amber kleur + '?' label verschijnt

5. **i18n keys toegevoegd (13 talen):**
   - `games.woordy.swap` — "Ruilen" / "Swap" / "Tauschen" / etc.
   - `games.woordy.swapHint` — "Tik op tegels om te ruilen" / etc.
   - `games.woordy.swapConfirm` — "Ruil" / "Swap" / etc.
   - `games.woordy.fullscreen` — "Beeldvullend" / "Fullscreen" / etc.

6. **Code hygiene:**
   - Verwijderd: `cell`, `cellLetter`, `cellValue`, `fieldLabel` styles (vervangen door inline styles met dynamische sizing)

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
| GameHeader compact mode als early-return | Eenvoudiger dan conditionele styling, duidelijk gescheiden code path |
| renderCell met dynamisch cellSize parameter | Hergebruik voor inline (38pt) en fullscreen (berekend) zonder code duplicatie |
| Trivia fields verborgen als 'normal' | Mapping in render laag, engine data ongewijzigd — cleanste scheiding |
| Swap alleen beschikbaar zonder pending tiles | Voorkomt verwarrende UX: tiles op board + tiles ruilen tegelijk |
| `shuffle` icon voor swap | Geen dedicated swap-icon beschikbaar, shuffle communiceert "wisselen" goed genoeg |

## Context voor Volgende Sessie

- **GameHeader.tsx:** Compact mode (line 74-86), `isCompact` conditie, `compactContainer`/`compactTimer` styles
- **WoordyScreen.tsx:** Fullscreen modal (`renderFullscreenBoard`, line ~455), swap handlers (line ~235-267), swap mode in renderRack (line ~508), swap button in renderActions (line ~635)
- **Engine swapTiles:** `engine.ts:439-490` — accepteert state + array of tileIds
- **Alle 6 games actief:** Woordraad, Sudoku, Solitaire, Memory, Trivia, Woordy
- **WatermelonDB schema:** Versie 30 (game_sessions + game_stats tabellen)
- **XMPP game protocol:** Types gedefinieerd, hooks gebouwd, sendGameStanza is stub
