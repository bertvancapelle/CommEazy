# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-30
- **Sessie:** Games Session 8 — Woordraad UX bugfixes
- **Commit:** `59766d9` fix: Woordraad ENTER button right-aligned + game over overlay touch fix

## Voltooide Taken Deze Sessie

1. **Woordraad ENTER knop positie en kleur:**
   - `KEYBOARD_ROWS[2]`: ENTER verplaatst van links naar rechts, DEL naar links
   - ENTER key: `backgroundColor: moduleColor` (groen), witte ✓ tekst, `hapticType: 'success'`
   - Consistent met standaard iOS toetsenbord-conventies (bevestigknop rechtsonder)

2. **Game Over overlay bevroren (LiquidGlassModule.swift):**
   - Root cause: `layoutSubviews` riep `updateGlassEffect()` aan bij elke bounds-wijziging
   - Tijdens Modal slide-animatie werd het glass container view herhaaldelijk verwijderd en opnieuw gemaakt
   - Dit verstoorde de subview-volgorde van React Native children → `hitTest` kon ze niet meer bereiken
   - Fix: Glass effect alleen aanmaken bij EERSTE layout (`glassEffectView == nil`), niet bij elke bounds change
   - Auto Layout constraints zorgen al voor correcte sizing bij volgende layouts

## Openstaande Taken

1. **Nederlandse vertaling trivia-nl.json (GEBRUIKER HANDELT DIT AF):**
   - 4.216 vragen moeten vertaald worden van Engels naar Nederlands
   - Huidige trivia-nl.json bevat Engelse content als placeholder
   - Script `translate_to_dutch.py` staat klaar maar vereist Anthropic API credits

2. **Eerder openstaand (ongewijzigd):**
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
| ENTER rechtsonder | Consistent met iOS keyboard conventies — bevestigknop altijd rechtsonder |
| ENTER moduleColor achtergrond | Visueel onderscheidbaar als actie-knop, senior-herkenbaar (groen = bevestigen) |
| Glass effect alleen bij eerste layout | Auto Layout constraints zorgen voor correcte sizing — recreatie is overbodig en veroorzaakt race condition |
| `lastBounds` property verwijderd | Dead code na fix — niet meer nodig |

## Context voor Volgende Sessie

- **LiquidGlassModule.swift:** `layoutSubviews` maakt glass effect nu alleen bij `glassEffectView == nil`. Prop changes (tintColorHex didSet etc.) triggeren `updateGlassEffect()` nog steeds normaal.
- **Alle 6 games actief:** Woordraad, Sudoku, Solitaire, Memory, Trivia, Woordy
- **Engines locatie:** `src/engines/{woordraad,sudoku,solitaire,memory,trivia,woordy}/`
- **Screens locatie:** `src/screens/modules/{Woordraad,Sudoku,Solitaire,Memory,Trivia,Woordy}Screen.tsx`
- **Download service:** `src/services/downloadService.ts` — gedeeld voor trivia + woordy + woordraad
- **Woordraad data flow:** WoordraadScreen init → checkDataStatus → loadWordLists (lokaal) OF download prompt → downloadGameData → loadWordLists → menu phase
- **Word bank:** In-memory cache (wordBank.ts), getTargetWords() + getValidGuesses() na loadWordLists()
- **Alle 11 woordraad woordenlijsten geüpload naar GitHub Release v1.0** (nl, en, de, fr, es, it, no, sv, da, pt, pl)
- **Game data scripts:** `scripts/generate_woordraad.py` (word list gen) + `game-data/fetch_opentdb.py` (trivia fetcher) + `game-data/translate_to_dutch.py` (vertaler)
- **Trivia settings:** AsyncStorage `@commeazy/trivia_settings` — difficulty, questionsPerRound, timerSeconds, feedbackSeconds
- **GameLobbyScreen:** Alle 6 routes actief, iterates over ALL_GAME_TYPES
- **WatermelonDB schema:** Versie 30 (game_sessions + game_stats tabellen)
- **XMPP game protocol:** Types gedefinieerd, hooks gebouwd, sendGameStanza is stub
