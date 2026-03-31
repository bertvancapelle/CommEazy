# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-31
- **Sessie:** Games Session 13 — Solitaire auto-move feature
- **Commit:** `eefe409` feat(solitaire): add auto-move setting — single tap places card at best position

## Voltooide Taken Deze Sessie

1. **Solitaire auto-move setting:**
   - **Engine:** `findBestMoveForCard()` in `src/engines/solitaire/engine.ts`
     - Priority: Foundation first (single cards only), then Tableau scored by: reveals face-down (+100), non-empty column (+10), column length (+length)
   - **SolitaireScreen:** Toggle in menu (default: ON), single-tap handler, flash animation (opacity blink) when no valid move
   - **AsyncStorage:** Persisted at `@commeazy/solitaire_autoMove`
   - **i18n:** `autoMove` key in all 13 locales

## Openstaande Taken

1. **DevModePanel draggable button (PNA conclusie, niet geïmplementeerd):**
   - Maak de DEV floating button versleepbaar met long-press
   - Persisteer positie in AsyncStorage
   - PNA conclusie bereikt, nog niet geïmplementeerd

2. **Trivia UI verbeteringen (plan beschikbaar):**
   - Plan: `delegated-petting-lecun.md`
   - 4 wijzigingen: gamepad rechts, feedback overlay, configureerbare timer, AsyncStorage persistentie
   - Nog NIET gestart

3. **Nederlandse vertaling trivia-nl.json (GEBRUIKER HANDELT DIT AF):**
   - 4.216 vragen moeten vertaald worden van Engels naar Nederlands
   - Script `translate_to_dutch.py` staat klaar maar vereist Anthropic API credits

4. **Eerder openstaand (ongewijzigd):**
   - Dead code categorie 2 — 8 componenten voor ongebouwde features
   - 3 transparent modals met LiquidGlassView te valideren
   - Uncommitted changes in `MediaIndicator.tsx` + `AppleMusicScreen.tsx`
   - Bluetooth media controls — niet geïmplementeerd
   - Glass Player flickering — open issue
   - SongCollectionModal uitbreiding — PNA ontwerp, niet geïmplementeerd
   - i18n cleanup — Mail welcome/emailRequired keys ongebruikt

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

1. **DevModePanel draggable button** — Maak DEV button versleepbaar, persisteer positie in AsyncStorage

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Auto-move default ON | Senioren profiteren van single-tap UX — minder complexe interactie |
| Foundation > Tableau prioriteit | Foundation is altijd de beste zet; Tableau scoring weegt face-down reveal het zwaarst |
| Flash animatie bij geen zet | Visuele feedback zonder error-tekst — subtiel en niet storend |
| Custom toggle i.p.v. Switch | Consistente stijl met module kleur op alle platforms |

## Context voor Volgende Sessie

- **Auto-move engine:** `findBestMoveForCard()` in `src/engines/solitaire/engine.ts` (rond regel 520)
- **Auto-move UI:** Toggle in menu fase van `SolitaireScreen.tsx`, state `autoMoveEnabled`
- **Flash animation:** `flashAnim` (Animated.Value), `flashLocation` state, `triggerFlash()` callback
- **Card image assets:** `src/assets/cards/*.png` (52 bestanden) + `src/assets/cards/index.ts` (lookup map)
- **CardView:** Simpel — `<Image source={getCardImage(suit, rank)}>` met hint/selectie border
- **Game screen ModuleHeader pattern:** `showGridButton={false}` + `rightAccessory={renderGamepadButton(onBack)}`
- **Alle 6 games actief:** Woordraad, Sudoku, Solitaire, Memory, Trivia, Woordy
- **Engines locatie:** `src/engines/{woordraad,sudoku,solitaire,memory,trivia,woordy}/`
- **Screens locatie:** `src/screens/modules/{Woordraad,Sudoku,Solitaire,Memory,Trivia,Woordy}Screen.tsx`
- **Download service:** `src/services/downloadService.ts` — gedeeld voor trivia + woordy + woordraad
- **GameLobbyScreen:** Alle 6 routes actief, iterates over ALL_GAME_TYPES
- **WatermelonDB schema:** Versie 30 (game_sessions + game_stats tabellen)
- **XMPP game protocol:** Types gedefinieerd, hooks gebouwd, sendGameStanza is stub
