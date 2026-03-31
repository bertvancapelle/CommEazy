# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-31
- **Sessie:** Games Session 12 — Solitaire PNG card images
- **Commit:** `887dba2` feat: replace inline SVG cards with PNG images (notpeter/Vector-Playing-Cards)

## Voltooide Taken Deze Sessie

1. **Solitaire kaarten vervangen door PNG afbeeldingen:**
   - **Bron:** notpeter/Vector-Playing-Cards (Public Domain / WTFPL licentie)
   - **52 PNG bestanden** in `src/assets/cards/` (225×315px, @3x resolutie)
   - **Lookup map:** `src/assets/cards/index.ts` — `getCardImage(suit, rank)` met static `require()` calls
   - **CardView vereenvoudigd:** Gebruikt nu `<Image>` component i.p.v. inline SVG rendering
   - **Verwijderd:** `FaceCardArt`, `PipLayout`, `SuitEmblem`, `PIP_LAYOUTS`, `isRedSuit`
   - **Verwijderd:** `CORNER_RANK_SIZE`, `CORNER_SUIT_SIZE`, `CENTER_PIP_SIZE` constanten
   - **Verwijderd:** 8 ongebruikte styles (cornerTL/BR, cornerRank/Suit, cardCenter, aceSuit, pipContainer, pip)
   - **Behouden:** CardBackView (SVG diamantpatroon), hint border, selectie border
   - **Bundle impact:** ~1.5MB extra (face cards ~70-84KB, number cards ~8-24KB)

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
| notpeter/Vector-Playing-Cards als bron | Public Domain/WTFPL — geen licentie-verplichtingen, hoge kwaliteit traditioneel kaartontwerp |
| Volledige kaart-PNG i.p.v. alleen center art | Kaarten bevatten professionele indices + artwork — beter leesbaar dan custom text corners bij ~54pt breedte |
| SVG → PNG conversie (225×315px) | Runtime SVG rendering van 400-622KB face cards is te zwaar; PNG's renderen instant |
| CardBackView SVG behouden | Diamantpatroon is simpel genoeg voor runtime SVG, hoeft niet als PNG |

## Context voor Volgende Sessie

- **Card image assets:** `src/assets/cards/*.png` (52 bestanden) + `src/assets/cards/index.ts` (lookup map)
- **CardView:** Simpel — `<Image source={getCardImage(suit, rank)}>` met hint/selectie border
- **CardBackView:** Ongewijzigd — SVG diamantpatroon met module kleur
- **Card sizing constants:** CARD_GAP=2, TABLEAU_PADDING=4, CARD_WIDTH berekend, CARD_HEIGHT=1.4×width
- **LiquidGlassModule.swift:** Debounce pattern via `propUpdateTimer` (50ms)
- **Game screen ModuleHeader pattern:** `showGridButton={false}` + `rightAccessory={renderGamepadButton(onBack)}`
- **Alle 6 games actief:** Woordraad, Sudoku, Solitaire, Memory, Trivia, Woordy
- **Engines locatie:** `src/engines/{woordraad,sudoku,solitaire,memory,trivia,woordy}/`
- **Screens locatie:** `src/screens/modules/{Woordraad,Sudoku,Solitaire,Memory,Trivia,Woordy}Screen.tsx`
- **Download service:** `src/services/downloadService.ts` — gedeeld voor trivia + woordy + woordraad
- **GameLobbyScreen:** Alle 6 routes actief, iterates over ALL_GAME_TYPES
- **WatermelonDB schema:** Versie 30 (game_sessions + game_stats tabellen)
- **XMPP game protocol:** Types gedefinieerd, hooks gebouwd, sendGameStanza is stub
