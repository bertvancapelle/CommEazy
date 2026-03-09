# Unified Player Implementation Plan

## Doel

Vervang 5 inconsistente player componenten door 2 nieuwe unified componenten, met 100% feature parity tussen React Native en Liquid Glass.

## Wat wordt vervangen

| Oud component | LOC | Vervangen door |
|---------------|-----|----------------|
| `MiniPlayer.tsx` | 376 | `UnifiedMiniPlayer.tsx` |
| `ExpandedAudioPlayer.tsx` | 996 | `UnifiedFullPlayer.tsx` |
| `HomeMiniPlayer.tsx` | 245 | `useActivePlayback()` + `UnifiedMiniPlayer` |
| `RadioPlayerOverlay.tsx` | 466 | `UnifiedFullPlayer.tsx` |
| `BooksPlayerOverlay.tsx` | 981 | `UnifiedFullPlayer.tsx` |
| **Totaal** | **3,064** | **~800-1000 (schatting)** |

## Ontwerpbeslissingen (vastgelegd in PNA)

1. **Geen context kennis** — Componenten ontvangen alles via props
2. **Niet-meegegeven controls = verborgen** — Geen greyed-out knoppen
3. **Swipe-to-dismiss** — Swipe down verbergt MiniPlayer, audio speelt door
4. **MediaIndicator tap = navigeer + scroll + show** — Altijd naar bronmodule, scroll naar actief item, toon player
5. **Geen AdMob in FullPlayer** — Immersive ervaring, geen reclame
6. **100% RN/Liquid Glass pariteit** — Identiek gedrag op beide platforms
7. **useActivePlayback() hook** — Aggregeert alle audio contexts voor HomeScreen
8. **Scroll naar actief item** — Bij terugkeer via MediaIndicator, scroll naar het NU spelende item

## Fasering

### Fase 1: Nieuwe componenten bouwen (naast oude)
- `src/components/UnifiedMiniPlayer.tsx`
- `src/components/UnifiedFullPlayer.tsx`
- `src/hooks/useActivePlayback.ts`
- Geen bestaande code wijzigen

### Fase 2: Module screens migreren
- RadioScreen → UnifiedMiniPlayer + UnifiedFullPlayer
- PodcastScreen → UnifiedMiniPlayer + UnifiedFullPlayer
- BooksScreen → UnifiedMiniPlayer + UnifiedFullPlayer
- AppleMusicScreen → UnifiedMiniPlayer + UnifiedFullPlayer
- HomeScreen → useActivePlayback() + UnifiedMiniPlayer

### Fase 3: MediaIndicator + scroll-naar-actief
- MediaIndicator updaten: navigate + scroll params
- Glass Player MediaIndicator: navigate ipv unhide-only
- Module screens: ontvang scrollToId param en scroll naar actief item

### Fase 4: Opruimen
- Verwijder MiniPlayer.tsx, ExpandedAudioPlayer.tsx, HomeMiniPlayer.tsx, RadioPlayerOverlay.tsx, BooksPlayerOverlay.tsx
- Update CLAUDE.md component registry
- Update exports in components/index.ts

## Props Interfaces

### UnifiedMiniPlayerProps

```typescript
interface UnifiedMiniPlayerProps {
  // Content
  moduleId: ModuleColorId;
  artwork: string | null;
  title: string;
  subtitle?: string;

  // Playback state
  isPlaying: boolean;
  isLoading: boolean;

  // Callbacks
  onPress: () => void;           // Expand to FullPlayer
  onPlayPause: () => void;
  onStop: () => void;

  // Progress variant
  progressType: 'bar' | 'duration';
  progress?: number;              // 0-1 (bar type)
  listenDuration?: number;        // seconds (duration type)

  // Swipe-to-dismiss
  onDismiss?: () => void;         // Called when swiped away

  // Styling
  style?: StyleProp<ViewStyle>;
}
```

### UnifiedFullPlayerProps

```typescript
interface UnifiedFullPlayerProps {
  // Visibility
  visible: boolean;

  // Content
  moduleId: ModuleColorId;
  artwork: string | null;
  title: string;
  subtitle?: string;
  placeholderIcon?: IconName;

  // Playback state
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering: boolean;

  // Core callbacks
  onPlayPause: () => void;
  onStop: () => void;
  onClose: () => void;

  // Seek (podcast, books, apple music)
  position?: number;
  duration?: number;
  onSeek?: (position: number) => void;

  // Skip (podcast/books: seconds, apple music: prev/next)
  onSkipBackward?: () => void;
  onSkipForward?: () => void;
  skipBackwardLabel?: string;     // "10" or prev-track icon
  skipForwardLabel?: string;      // "30" or next-track icon

  // Speed (podcast, books)
  playbackRate?: number;
  onSpeedPress?: () => void;

  // Shuffle/Repeat (apple music)
  shuffleMode?: 'off' | 'songs';
  onShufflePress?: () => void;
  repeatMode?: 'off' | 'one' | 'all';
  onRepeatPress?: () => void;

  // Favorite
  isFavorite?: boolean;
  onFavoritePress?: () => void;

  // Sleep timer
  sleepTimerMinutes?: number;
  onSleepTimerPress?: () => void;

  // Listen duration (radio)
  listenDuration?: number;

  // Apple Music specific
  isInLibrary?: boolean;
  isAddingToLibrary?: boolean;
  onAddToLibraryPress?: () => void;
  queueCount?: number;
  onQueuePress?: () => void;

  // AirPlay (iOS)
  showAirPlay?: boolean;
}
```

### useActivePlayback return type

```typescript
interface ActivePlaybackInfo {
  // For UnifiedMiniPlayer
  moduleId: ModuleColorId;
  artwork: string | null;
  title: string;
  subtitle?: string;
  isPlaying: boolean;
  isLoading: boolean;
  progressType: 'bar' | 'duration';
  progress?: number;
  listenDuration?: number;

  // Callbacks
  onPlayPause: () => void;
  onStop: () => void;

  // Navigation target
  scrollToId?: string;
  collectionId?: string;
}
```

## Bestanden

### Nieuw te maken
- `src/components/UnifiedMiniPlayer.tsx`
- `src/components/UnifiedFullPlayer.tsx`
- `src/hooks/useActivePlayback.ts`

### Te wijzigen
- `src/screens/modules/RadioScreen.tsx`
- `src/screens/modules/PodcastScreen.tsx`
- `src/screens/modules/BooksScreen.tsx`
- `src/screens/modules/AppleMusicScreen.tsx`
- `src/screens/HomeScreen.tsx`
- `src/components/MediaIndicator.tsx`
- `src/components/index.ts`
- `src/hooks/index.ts`

### Te verwijderen (na migratie)
- `src/components/MiniPlayer.tsx`
- `src/components/ExpandedAudioPlayer.tsx`
- `src/components/HomeMiniPlayer.tsx`
- `src/components/RadioPlayerOverlay.tsx`
- `src/components/BooksPlayerOverlay.tsx`

## Sizing (senior-inclusive)

| Element | Maat |
|---------|------|
| MiniPlayer hoogte | 72pt |
| MiniPlayer artwork | 48×48pt |
| Sluiten/Sleep knoppen | 60×60pt |
| FullPlayer artwork | scherm breedte - 64pt padding |
| FullPlayer titel | 22pt bold |
| FullPlayer subtitel | 18pt regular |
| Transport knoppen (play) | 72×72pt |
| Transport knoppen (skip/stop) | 60×60pt |
| Seek slider touch area | 60pt hoogte |
| Snelheid knoppen | 60×44pt |
| Alle cornerRadius | 12pt |
| Alle button achtergrond | rgba(255, 255, 255, 0.15) |
