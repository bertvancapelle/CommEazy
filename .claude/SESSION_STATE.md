# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-30
- **Sessie:** Games Session 10 — LiquidGlassModule debounce fix (Sudoku GameOverModal bug)
- **Commit:** `a30c38e` fix: debounce LiquidGlassModule prop updates to prevent GameOverModal touch bug

## Voltooide Taken Deze Sessie

1. **LiquidGlassModule.swift debounce fix:**
   - **Bug:** Sudoku game-over toonde wit transparant onresponsief overlay, navigeerde na paar seconden automatisch naar HomeScreen
   - **Root cause:** 5 prop `didSet` handlers riepen elk `updateGlassEffect()` aan — elke call verwijdert glass container (`removeFromSuperview`) en maakt nieuwe aan (`insertSubview at: 0`), wat React Native children's subview ordering verstoort → touches bereiken modal content niet
   - **Fix:** 50ms debounce timer (`scheduleDebouncedUpdate()`) batcht rapid prop changes in één `updateGlassEffect()` call
   - **Wijzigingen in `ios/LiquidGlassModule.swift`:**
     - `propUpdateTimer: Timer?` property toegevoegd
     - Alle 5 `didSet` handlers: `updateGlassEffect()` → `scheduleDebouncedUpdate()`
     - `cornerRadius` behoudt immediate visuele updates (layer.cornerRadius, clipsToBounds) naast debounced full update
     - `deinit` invalideert timer
     - `scheduleDebouncedUpdate()` methode met 50ms Timer

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
| 50ms debounce i.p.v. direct `updateGlassEffect()` | React Native set props one-by-one; 5 calls = 5 remove+recreate cycles = subview ordering bug |
| Timer-based i.p.v. `DispatchQueue.main.async` | Timer met 50ms interval batcht betrouwbaarder dan single runloop cycle — meerdere props kunnen over meerdere frames komen |
| `cornerRadius` behoudt immediate visual updates | Layer cornerRadius en clipsToBounds veroorzaken geen subview churn, alleen de full `updateGlassEffect()` doet dat |

## Context voor Volgende Sessie

- **LiquidGlassModule.swift:** Debounce pattern via `propUpdateTimer` (50ms) — alle prop `didSet` handlers gebruiken `scheduleDebouncedUpdate()`
- **Eerdere fix (sessie 7, commit `59766d9`):** `layoutSubviews` guard (`glassEffectView == nil`) voorkomt recreatie tijdens layout — maar `didSet` handlers omzeilden deze guard → opgelost met debounce
- **Game screen ModuleHeader pattern:** `showGridButton={false}` + `rightAccessory={renderGamepadButton(onBack)}`
- **Alle 6 games actief:** Woordraad, Sudoku, Solitaire, Memory, Trivia, Woordy
- **Engines locatie:** `src/engines/{woordraad,sudoku,solitaire,memory,trivia,woordy}/`
- **Screens locatie:** `src/screens/modules/{Woordraad,Sudoku,Solitaire,Memory,Trivia,Woordy}Screen.tsx`
- **Download service:** `src/services/downloadService.ts` — gedeeld voor trivia + woordy + woordraad
- **GameLobbyScreen:** Alle 6 routes actief, iterates over ALL_GAME_TYPES
- **WatermelonDB schema:** Versie 30 (game_sessions + game_stats tabellen)
- **XMPP game protocol:** Types gedefinieerd, hooks gebouwd, sendGameStanza is stub
