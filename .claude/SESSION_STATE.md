# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-20
- **Sessie:** AirPlay routing fix — longFormAudio policy + TTS route sharing preservation
- **Commit:** `6967837`

## Voltooide Taken Deze Sessie

1. **AirPlay routing fix** (`6967837`)
   - Root cause: TrackPlayer gebruikte `.default` route sharing policy i.p.v. `.longFormAudio`
   - Root cause 2: TtsModule.m en PiperTtsModule.mm gebruikten 4-parameter `setCategory` die de route sharing policy reset naar `.default`, waardoor AirPlay route werd verbroken
   - Fix 1: `iosCategoryPolicy: 'longFormAudio'` toegevoegd aan `TrackPlayer.setupPlayer()` in RadioContext.tsx en PodcastContext.tsx
   - Fix 2: TtsModule.m en PiperTtsModule.mm nu 5-parameter `setCategory` met `routeSharingPolicy:currentPolicy` om bestaande AirPlay route te preserven

## Openstaande Taken

1. **Fundamentele UIWindow beperking** — React Native Modal creëert nieuw UIWindow, UIBlurEffect heeft niets om te blurren. Glass toont material texture + tint, maar geen echte blur-through-to-content.
2. **SongCollectionModal uitbreiding** — Bulk album toevoegen (`songs: Song[]` + `albumTitle?: string` props) was in PNA ontwerp maar nog niet geïmplementeerd. Optionele toekomstige taak.

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

Geen.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| `longFormAudio` policy i.p.v. `.default` | Apple's aanbeveling voor music/podcast apps; routeert audio naar dezelfde output als ingebouwde Music/Podcast apps en enabled enhanced AirPlay 2 buffering |
| 5-parameter `setCategory` in TTS modules | 4-parameter versie (zonder `routeSharingPolicy`) reset policy impliciet naar `.default`, wat AirPlay routing verbreekt na TTS initialisatie |
| `allowsExternalPlayback` niet gepatcht | Is voor VIDEO external playback, niet audio-only AirPlay; SwiftAudioEx zet het op `false` maar dat is irrelevant voor audio streams |
| Geen `AVAudioSessionCategoryOptionAllowAirPlay` toegevoegd | `.playback` category ondersteunt AirPlay impliciet; optie is alleen nodig voor `.playAndRecord` |

## Context voor Volgende Sessie

- `src/contexts/RadioContext.tsx` (~lijn 118): TrackPlayer.setupPlayer met `iosCategoryPolicy: 'longFormAudio'`
- `src/contexts/PodcastContext.tsx` (~lijn 157): Idem
- `ios/CommEazyTemp/TtsModule.m` (~lijn 64-77): 5-parameter setCategory met route policy preservation
- `ios/CommEazyTemp/PiperTtsModule.mm` (~lijn 65-78): Idem
- AirPlay fix moet getest worden op fysiek device met AirPlay speaker
