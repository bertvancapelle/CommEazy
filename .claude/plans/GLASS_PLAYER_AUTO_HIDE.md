# Glass Player Auto-Hide bij Module-Wissel

## Status: IMPLEMENTATIE GESTART

## Samenvatting

Op iPhone verdwijnt de Glass Player mini player automatisch bij module-wissel. De lijst in elke audio module toont het actief spelende item altijd bovenaan. Tap op dat item = mini player verschijnt weer (geen herstart). Tap op ander item = nieuwe stream start + mini player verschijnt.

## Ontwerp Specificaties

### Gedrag per Device

| Device | Bij module-wissel | Terugkeer naar bron-module | Minimize button | Swipe-down |
|--------|-------------------|----------------------------|-----------------|------------|
| **iPhone** | Auto-hide (`setTemporarilyHidden(true)`) | Mini player verborgen, actief item bovenaan lijst | Nee (geen ruimte) | Ja (consistentie) |
| **iPad** | Mini player blijft zichtbaar | Mini player zichtbaar | Ja (bestaand) | Ja (nieuw, consistentie met iPhone) |

### Flow: iPhone

```
1. Gebruiker speelt "NPO Radio 2" → mini player zichtbaar
2. Wissel naar Berichten → mini player auto-hide, audio speelt door
3. MediaIndicator waveform zichtbaar in Berichten header
4. Terug naar Radio → mini player NIET zichtbaar
5. Lijst toont "NPO Radio 2" bovenaan met "nu aan het spelen" indicatie
6a. Tap "NPO Radio 2" → mini player verschijnt (geen herstart)
6b. Tap "Radio 538" → stop huidige, start nieuwe, mini player verschijnt
```

### Flow: iPad

```
1. Gebruiker speelt "NPO Radio 2" → mini player zichtbaar
2. Wissel naar andere module → mini player BLIJFT zichtbaar (meer ruimte)
3. Gebruiker kan minimize button tappen OF swipen → mini player verdwijnt
4. Verdere flow identiek aan iPhone stappen 3-6
```

### Pin-to-Top per Module

| Module | Status | Implementatie |
|--------|--------|---------------|
| Radio | ✅ Al geïmplementeerd | Huidige station staat al bovenaan |
| Podcast | ✅ Al geïmplementeerd | `sortedShowEpisodes` in PodcastScreen.tsx |
| Books | ❌ Moet nog | `displayedBooks` in BooksScreen.tsx — pin `currentBook` |
| Apple Music | ❌ Moet nog | `filteredLibrarySongs` in AppleMusicScreen.tsx — pin `currentSong` |

### Visuele "Nu aan het spelen" Indicatie

In elk lijst-item dat actief speelt:
- Kleine equalizer-animatie (3 bars, ~16pt hoog) naast de titel
- Of: `♪ Nu aan het spelen` tekst label
- Accent color van de module
- Respecteert reduced motion (statisch icoon bij reduced motion)

### Technische Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `BooksScreen.tsx` | Pin `currentBook` bovenaan `displayedBooks` |
| `AppleMusicScreen.tsx` | Pin `currentSong` bovenaan `filteredLibrarySongs` |
| `PaneContext.tsx` of `SinglePaneLayout.tsx` | Detect module-wissel → `setTemporarilyHidden(true)` op iPhone |
| `RadioScreen.tsx` | Tap op actief station → `showFromMinimized()` i.p.v. restart |
| `PodcastScreen.tsx` | Tap op actief episode → `showFromMinimized()` i.p.v. restart |
| `BooksScreen.tsx` | Tap op actief boek → `showFromMinimized()` i.p.v. restart |
| `AppleMusicScreen.tsx` | Tap op actief nummer → `showFromMinimized()` i.p.v. restart |
| `MiniPlayerNativeView.swift` | Swipe-down gesture recognizer toevoegen |
| `GlassPlayerWindowModule.swift` | Swipe-down event emitten naar RN |

### Beslissingen

| Aspect | Beslissing |
|--------|------------|
| **iPhone auto-hide** | `setTemporarilyHidden(true)` bij pane module-wissel |
| **iPad auto-hide** | NEE — mini player blijft, gebruiker kiest zelf (button of swipe) |
| **Swipe-down** | Beide devices — consistentie |
| **Terugkeer bron-module** | Mini player verborgen, tap op actief item om terug te halen |
| **Now playing indicatie** | Equalizer animatie in lijst-item |
| **MediaIndicator** | Blijft ongewijzigd — toont waveform in andere module headers |

---

*Ontwerp voltooid via PNA sessie op 2026-02-26. Implementatie gestart.*
