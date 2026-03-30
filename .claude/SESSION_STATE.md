# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-30
- **Sessie:** Games Session 11 — Solitaire card visual redesign
- **Commit:** `d4e174e` feat: redesign Solitaire cards — traditional playing card visuals

## Voltooide Taken Deze Sessie

1. **Solitaire kaart visuele redesign (`src/screens/modules/SolitaireScreen.tsx`):**
   - **Card sizing gemaximaliseerd:** CARD_GAP 4→2pt, TABLEAU_PADDING 8→4pt → ~54×75pt op iPhone 14 (was 47×65pt)
   - **Dual-corner design:** Rank+suit in top-left EN bottom-right (180° geroteerd), zoals echte speelkaarten
   - **SVG face card artwork:** Jack (hoed+tuniek), Queen (kroon+jurk+ketting), King (kroon+mantel+baard) via inline react-native-svg
   - **Ace:** Groot gecentreerd suit symbool
   - **Number cards (2-10):** Standaard pip layout met gepositioneerde suit symbolen (PIP_LAYOUTS lookup table)
   - **Card back redesign:** SVG diamant patroon met center ornament, vervangt emoji 🂠
   - **Nieuwe styles:** cornerTL, cornerBR, cornerRank, cornerSuit, cardCenter, aceSuit, pipContainer, pip, cardBackInner
   - **Verwijderde styles:** cardRank, cardSuit, cardBackText (vervangen door corner-based layout)

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
| CARD_GAP 4→2, TABLEAU_PADDING 8→4 | Maximaliseert kaartgrootte zonder scrolling; 7 kolommen moeten op scherm passen |
| Inline SVG i.p.v. PNG/externe assets | Consistent met Icon.tsx pattern, zero nieuwe bestanden, geen bundle pipeline changes |
| Dual-corner rank+suit (TL + BR rotated) | Standaard playing card design — herkenbaar voor senioren |
| PipLayout met percentage-based positioning | Schaalt automatisch mee met kaartgrootte op verschillende devices |
| Geen horizontaal scrollen | Gebruiker keuze — alle 7 kolommen moeten zichtbaar zijn zonder scroll |

## Context voor Volgende Sessie

- **Solitaire card components:** CardView (dual-corner), CardBackView (SVG diamonds), PipLayout (2-10), FaceCardArt (J/Q/K SVG), SuitEmblem (suit shapes)
- **Card sizing constants:** CARD_GAP=2, TABLEAU_PADDING=4, CARD_WIDTH berekend, CARD_HEIGHT=1.4×width
- **Corner text sizing:** CORNER_RANK_SIZE=28% card width, CORNER_SUIT_SIZE=22%, CENTER_PIP_SIZE=28%
- **LiquidGlassModule.swift:** Debounce pattern via `propUpdateTimer` (50ms) — alle prop `didSet` handlers gebruiken `scheduleDebouncedUpdate()`
- **Game screen ModuleHeader pattern:** `showGridButton={false}` + `rightAccessory={renderGamepadButton(onBack)}`
- **Alle 6 games actief:** Woordraad, Sudoku, Solitaire, Memory, Trivia, Woordy
- **Engines locatie:** `src/engines/{woordraad,sudoku,solitaire,memory,trivia,woordy}/`
- **Screens locatie:** `src/screens/modules/{Woordraad,Sudoku,Solitaire,Memory,Trivia,Woordy}Screen.tsx`
- **Download service:** `src/services/downloadService.ts` — gedeeld voor trivia + woordy + woordraad
- **GameLobbyScreen:** Alle 6 routes actief, iterates over ALL_GAME_TYPES
- **WatermelonDB schema:** Versie 30 (game_sessions + game_stats tabellen)
- **XMPP game protocol:** Types gedefinieerd, hooks gebouwd, sendGameStanza is stub
