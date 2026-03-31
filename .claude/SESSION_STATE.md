# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-31
- **Sessie:** Apple Music Playback Fix + Game Timer Fix
- **Commit:** `806a574` fix(appleMusic): add catalog→library fallback for album/playlist playback

## Voltooide Taken Deze Sessie

1. **Apple Music album/playlist playback fix (3 wijzigingen):**
   - **Native Swift `playAlbum()`:** Catalog-only → catalog-first-then-library-fallback (dual-path pattern uit `getAlbumDetails`)
   - **Native Swift `playPlaylist()`:** Zelfde dual-path pattern toegevoegd
   - **React Native `AppleMusicDetailModal.tsx`:** Playback error banner met dismiss knop, i18n key `modules.appleMusic.playbackError` in alle 13 locales
   - **Root cause:** `getAlbumDetails()` had catalog→library fallback en retourneerde library IDs, maar `playAlbum()` probeerde die library IDs met catalog-only `MusicCatalogResourceRequest` → altijd `MusicDataRequest.Error error 1`

2. **Game timer freeze fix (vorige sub-sessie, commit `76dc6c4`):**
   - `useGameSession.ts`: ref-based duration calculation i.p.v. stale state
   - `WoordyScreen.tsx`: correcte arg volgorde + completeGame in useEffect

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
| Dual-path catalog→library voor playAlbum/playPlaylist | Consistent met bestaand `getAlbumDetails()` pattern; lost `MusicDataRequest.Error error 1` op voor alle gebruikers |
| Error banner i.p.v. Alert.alert | Conform CLAUDE.md regel: `Alert.alert()` alleen voor bevestigingsdialogen (2+ knoppen) |
| Library fallback: songs via albumTitle filter | `MusicLibraryRequest<Song>` gefilterd op `albumTitle` + gesorteerd op `trackNumber` — betrouwbaarder dan album.tracks voor library items |

## Context voor Volgende Sessie

- **AppleMusicModule.swift:** `playAlbum()` (line ~785) en `playPlaylist()` (line ~850) hebben nu dual-path
- **AppleMusicDetailModal.tsx:** `src/components/appleMusic/AppleMusicDetailModal.tsx` — playbackError state + error banner
- **Dual-path pattern referentie:** `getAlbumDetails()` in AppleMusicModule.swift (line ~1502)
- **Alle 6 games actief:** Woordraad, Sudoku, Solitaire, Memory, Trivia, Woordy
- **WatermelonDB schema:** Versie 30 (game_sessions + game_stats tabellen)
- **XMPP game protocol:** Types gedefinieerd, hooks gebouwd, sendGameStanza is stub
