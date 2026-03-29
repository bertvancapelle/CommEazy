# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-29
- **Sessie:** Game Prompts schrijven (7 bestanden) — volledig afgerond
- **Commit:** Geen (prompts staan buiten git repo, in `/Users/bertvancapelle/Projects/CommEazy Prompts/CommEazy Games/`)

## Voltooide Taken Deze Sessie

1. **Alle 7 Game Implementation Prompts geschreven** — Complete herschrijving van 6 externe game design documenten naar CommEazy's architectuur, plus 1 shared architecture overview:

   | # | Bestand | Inhoud |
   |---|---------|--------|
   | 0 | `Prompt_0_Games_Architecture.md` | Gedeelde technische basis: XMPP game protocol, WatermelonDB schema, shared components, GameContext, Liquid Glass |
   | 1 | `Prompt_1_Games_Foundation.md` | Navigation, GameLobbyScreen, matchmaking, GameSessionManager, online/offline checks |
   | 2 | `Prompt_2_Game_Woordraad.md` | 15×15 woordspel, Nederlandse letterwaarden, triviacellen, XMPP beurt-systeem |
   | 3 | `Prompt_3_Game_Sudoku.md` | Solo puzzel, client-side generatie, sfc32 seeded PRNG, 4 moeilijkheidsgraden, dagelijkse uitdaging |
   | 4 | `Prompt_4_Game_Solitaire.md` | Klondike + Spider, landscape support via OrientationModule, drag & drop, card component |
   | 5 | `Prompt_5_Game_Memory.md` | Emoji memory, 5 thema's, 3 bordgroottes, host-based anti-cheat, multiplayer via XMPP |
   | 6 | `Prompt_6_Game_Trivia.md` | Lokaal gebundelde vragenbank (97.500 vragen), 3 speelmodi, VraagKaart shared component, Woordraad integratie |

   **Drie architecturale PNA-beslissingen toegepast:**
   - Multiplayer sync: **Hybrid** (lokaal WatermelonDB + XMPP)
   - Prompt format: **6 game prompts + 1 architecture overview** (7 bestanden)
   - Detail level: **Architecture + design spec** (geen code examples — Claude genereert code uit codebase context)

   **Locatie:** `/Users/bertvancapelle/Projects/CommEazy Prompts/CommEazy Games/`

## Openstaande Taken

1. **Game prompts bouwen** — De 7 prompts zijn geschreven en klaar om in een nieuwe sessie daadwerkelijk te implementeren. Volgorde: Prompt_0 → Prompt_1 → Prompt_2 t/m Prompt_6
2. **Dead code categorie 2 — Geplande features (beslissing nodig):**
   - 8 componenten voor ongebouwde features (AdMobBanner, EBookReader, AudioBookPlayer, GamePlaceholder, etc.)
   - 3 iPad Split View componenten (DraggableDivider, SplitViewLayout, ModulePanel)
   - ~9.767 ongebruikte StyleSheet entries across 165 bestanden
3. **Andere transparent modals met LiquidGlassView:** 3 modals te valideren:
   - `ContactSelectionModal`, `ModulePickerModal`, `VoiceCommandOverlay`
4. **Uncommitted changes:** `MediaIndicator.tsx` (1 regel) + `AppleMusicScreen.tsx` (grote refactor)
5. **Bluetooth media controls** — Hardware play/pause/next/prev knoppen. Nooit geimplementeerd.
6. **Glass Player flickering** — Bottom + right side flicker. Separate issue.
7. **SongCollectionModal uitbreiding** — Bulk album toevoegen (PNA ontwerp, niet geimplementeerd).
8. **i18n cleanup** — Mail welcome/emailRequired locale keys zijn nu ongebruikt (in alle 13 talen).

## Lopende PNA-Conclusies (Nog Niet Geimplementeerd)

Geen — alle beslissingen zijn geimplementeerd.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Hybrid sync (WatermelonDB + XMPP) | Bestaand patroon in CommEazy, zero server storage, offline-first |
| 7 prompt bestanden | 1 shared architecture + 6 game-specifiek — logische scheiding |
| Geen code in prompts | Claude genereert betere code vanuit codebase context dan voorgeschreven snippets |
| Trivia: lokale vragenbank | Elimineert server dependency, pre-generated met Claude Haiku API |
| Memory: host-based anti-cheat | card_layout alleen bij host, kaarten één voor één onthuld via XMPP |
| VraagKaart gedeeld component | Gebruikt door zowel Trivia als Woordraad triviacellen |

## Context voor Volgende Sessie

- **Game prompts klaar voor bouwen** — Start met Prompt_0 (shared architecture), dan Prompt_1 (foundation/lobby), dan individuele games
- **Bestaande game registratie:** `StaticNavigationDestination` bevat al 5 game IDs, `MODULE_TINT_COLORS` geregistreerd (default blue), `GamePlaceholderScreen` moet vervangen worden door `GameLobbyScreen`
- **WatermelonDB schema:** Huidige versie 29, games voegen `game_sessions` en `game_stats` tabellen toe
- **XMPP game namespace:** `urn:commeazy:game:1` (nieuw, volgt patroon van `urn:commeazy:call:1`)
- **OrientationModule:** Native module bestaat al (`OrientationModule.h`/`.m`) — nodig voor Solitaire landscape
- **Dead code categorie 2** nog open
- **Uncommitted werk:** `MediaIndicator.tsx` + `AppleMusicScreen.tsx`
- **Glass Player flicker:** nog open
