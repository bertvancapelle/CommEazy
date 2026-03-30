# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-30
- **Sessie:** Games Session 3a — Woordy design document (PNA)
- **Commit:** `446954b` — docs: add Woordy game design document

## Voltooide Taken Deze Sessie

1. **Woordy Game Design Document** — Volledig PNA-ontwerp afgerond:
   - `.claude/plans/WOORDY_DESIGN.md` — Compleet design document
   - 15×15 bord met pinch-to-zoom, tap-to-place (geen drag)
   - 7 tegels per speler, 2 blanco tegels (0 punten)
   - Bonusvelden: DL, TL, DW, TW (random per spel)
   - Trivia-velden: 1-2 per spel, verborgen, +10/-10
   - Universele letterwaarden (range 1-5, alle 13 talen)
   - Hunspell dictionaries (on-demand download per taal)
   - Multiplayer via XMPP (invite-based, zelfde taal vereist)
   - Geen tijdslimiet, passen/ruilen/opgeven toegestaan
   - Eerste woord bonus: +10, alle-7-tegels bonus: +10

## Openstaande Taken

1. **Woordy implementatie** — Design voltooid, code nog niet gestart:
   - Engine: `src/engines/woordy/` (bord, scoring, validatie, letterzak)
   - Screen: `src/screens/modules/WoordyScreen.tsx`
   - Components: WoordyBoard, WoordyTileRack, WoordyTile, WoordyScoreboard
   - Woordenlijst: Hunspell dictionary integratie (SQLite)
   - i18n: `games.woordy.*` + `navigation.woordy` in 13 talen
   - GameLobbyScreen: route toevoegen
   - Zie `WOORDY_DESIGN.md` voor volledige specificatie

2. **Session 3: Trivia + Final Polish** — Zie `GAMES_SESSION_2_3_CONTEXT.md`
   - Trivia: Vragenbank engine + screen + i18n (13 locales)
   - Final wiring: Trivia uncommented in GameLobbyScreen
   - Polish: Consistentie check over alle 5 games

3. **Eerder openstaand (ongewijzigd):**
   - Dead code categorie 2 — 8 componenten voor ongebouwde features
   - 3 transparent modals met LiquidGlassView te valideren
   - Uncommitted changes in `MediaIndicator.tsx` + `AppleMusicScreen.tsx`
   - Bluetooth media controls — niet geïmplementeerd
   - Glass Player flickering — open issue
   - SongCollectionModal uitbreiding — PNA ontwerp, niet geïmplementeerd
   - i18n cleanup — Mail welcome/emailRequired keys ongebruikt

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

Geen — Woordy design is voltooid en gedocumenteerd in `WOORDY_DESIGN.md`.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Universele letterwaarden (1-5) | Eenvoudiger voor senioren, consistent ongeacht taal |
| Tap-to-place i.p.v. drag | Drag & drop is moeilijk voor senioren |
| Geen tijdslimiet | Senioren mogen rustig nadenken |
| Eerste woord +10, alle-7-tegels +10 | Gelijke bonussen zijn voorspelbaarder voor senioren |
| Trivia +10/-10 | Voldoende impact zonder overweldigend te zijn |
| On-demand dictionary download | Voorkomt ~60-90MB in app bundle |
| Geen power-ups/thema-borden | Houdt spel puur en herkenbaar |

## Context voor Volgende Sessie

- **Woordy design:** Lees `WOORDY_DESIGN.md` EERST
- **Game screens pattern:** Alle screens gebruiken `backIcon="gamepad"` + `handleQuit` met bevestigingsdialoog
- **GameHeader actions:** Woordraad/Memory = `[]`, Sudoku = `[hint]`, Solitaire = `[autoComplete?, hint]`
- **GameLobbyScreen.tsx:** Heeft commented-out routes voor trivia + woordy toe te voegen
- **Engines locatie:** `src/engines/{woordraad,sudoku,solitaire,memory}/engine.ts`
- **Screens locatie:** `src/screens/modules/{Woordraad,Sudoku,Solitaire,Memory}Screen.tsx`
- **WatermelonDB schema:** Versie 30 (game_sessions + game_stats tabellen)
- **XMPP game protocol:** Types gedefinieerd, hooks gebouwd, sendGameStanza is stub
- **Trivia vragenbank:** Gedeeld tussen standalone Trivia game en Woordy trivia-velden
