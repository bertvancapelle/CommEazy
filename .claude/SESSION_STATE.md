# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-30
- **Sessie:** Games Session 3b — Trivia design document (PNA)
- **Commit:** (pending) — docs: add Trivia game design document

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

2. **Trivia Game Design Document** — Volledig PNA-ontwerp afgerond:
   - `.claude/plans/TRIVIA_DESIGN.md` — Compleet design document
   - Multiple-choice (4 opties), tap-to-answer
   - Moeilijkheidsgraden: makkelijk (+10) / gemiddeld (+20) / moeilijk (+30)
   - Vragen per ronde: instelbaar 5/10/15/20 (default 10)
   - Timer: optioneel uit/15s/30s/60s (default uit)
   - Categorieën: 6-8 brede thema's, gebruiker kiest per ronde
   - Bron: OpenTDB (~5.200 vragen, CC BY-SA 4.0)
   - On-demand download per taal (~1.5 MB/taal)
   - Gedeelde download service met Woordy dictionaries
   - Solo + multiplayer (synchroon per vraag via XMPP)
   - Woordy erft moeilijkheid uit Trivia instellingen

## Openstaande Taken

1. **Trivia implementatie** — Design voltooid, code nog niet gestart:
   - Engine: `src/engines/trivia/` (engine, questionBank, types)
   - Download service: `src/services/downloadService.ts` (gedeeld)
   - Screen: `src/screens/modules/TriviaScreen.tsx`
   - Components: TriviaQuestionCard, TriviaProgressBar, TriviaScoreboard, TriviaCategoryPicker
   - i18n: `games.trivia.*` + `navigation.trivia` + categorienamen in 13 talen
   - GameLobbyScreen: route uncomment + import
   - Zie `TRIVIA_DESIGN.md` voor volledige specificatie

2. **Woordy implementatie** — Design voltooid, code nog niet gestart:
   - Engine: `src/engines/woordy/` (bord, scoring, validatie, letterzak)
   - Screen: `src/screens/modules/WoordyScreen.tsx`
   - Components: WoordyBoard, WoordyTileRack, WoordyTile, WoordyScoreboard
   - Woordenlijst: Hunspell dictionary integratie (SQLite)
   - i18n: `games.woordy.*` + `navigation.woordy` in 13 talen
   - GameLobbyScreen: route toevoegen
   - Zie `WOORDY_DESIGN.md` voor volledige specificatie

3. **Final Polish** — Na implementatie van Trivia + Woordy:
   - Consistentie check over alle 6 games (woordraad, sudoku, solitaire, memory, trivia, woordy)
   - GameLobbyScreen: alle routes actief

4. **Eerder openstaand (ongewijzigd):**
   - Dead code categorie 2 — 8 componenten voor ongebouwde features
   - 3 transparent modals met LiquidGlassView te valideren
   - Uncommitted changes in `MediaIndicator.tsx` + `AppleMusicScreen.tsx`
   - Bluetooth media controls — niet geïmplementeerd
   - Glass Player flickering — open issue
   - SongCollectionModal uitbreiding — PNA ontwerp, niet geïmplementeerd
   - i18n cleanup — Mail welcome/emailRequired keys ongebruikt

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

Geen — Zowel Woordy als Trivia design zijn voltooid en gedocumenteerd.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Universele letterwaarden (1-5) | Eenvoudiger voor senioren, consistent ongeacht taal |
| Tap-to-place i.p.v. drag | Drag & drop is moeilijk voor senioren |
| Geen tijdslimiet (beide games) | Senioren mogen rustig nadenken |
| OpenTDB als trivia bron | Gratis, CC BY-SA 4.0, ~5.200 geverifieerde vragen |
| On-demand download per taal | Voorkomt grote app bundle (trivia ~1.5MB, dictionary ~3-12MB) |
| Gedeelde download service | Zelfde flow voor trivia vragen en woordy dictionaries |
| Woordy erft trivia moeilijkheid | Eén instelling, twee games — eenvoud |
| Simpele scoring (geen streaks) | Voorspelbaar, geen frustratie |
| Synchroon multiplayer trivia | "Samen quizzen" gevoel, direct vergelijken |
| 6-8 brede categorie thema's | 24 OpenTDB categorieën is te veel voor senioren |
| Timer optioneel (default uit) | Geen druk voor senioren, optie voor gevorderden |

## Context voor Volgende Sessie

- **Design documenten:** Lees `TRIVIA_DESIGN.md` en `WOORDY_DESIGN.md` EERST
- **Implementatie volgorde:** Trivia eerst (eenvoudiger), dan Woordy (complexer)
- **Gedeelde download service:** Moet eerst gebouwd worden (dependency voor beide games)
- **Trivia vragenbank:** Gedeeld tussen standalone Trivia en Woordy trivia-velden
- **Game screens pattern:** Alle screens gebruiken `backIcon="gamepad"` + `handleQuit` met bevestigingsdialoog
- **GameHeader actions:** Woordraad/Memory = `[]`, Sudoku = `[hint]`, Solitaire = `[autoComplete?, hint]`, Trivia = `[]`
- **GameLobbyScreen.tsx:** Heeft commented-out route voor trivia (lijn 79-80)
- **Engines locatie:** `src/engines/{woordraad,sudoku,solitaire,memory}/engine.ts`
- **Screens locatie:** `src/screens/modules/{Woordraad,Sudoku,Solitaire,Memory}Screen.tsx`
- **WatermelonDB schema:** Versie 30 (game_sessions + game_stats tabellen)
- **XMPP game protocol:** Types gedefinieerd, hooks gebouwd, sendGameStanza is stub
