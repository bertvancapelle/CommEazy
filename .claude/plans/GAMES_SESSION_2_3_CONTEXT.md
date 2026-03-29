# Games — Session 2 & 3 Build Context

> **Doel:** Dit document bevat ALLE context die nodig is om in toekomstige sessies de overige 3 spellen te bouwen (Solitaire, Memory, Trivia). Het is geschreven zodat een nieuwe Claude-instantie zonder context van sessie 1 direct kan starten.

---

## Sessie Planning

| Sessie | Games | Status |
|--------|-------|--------|
| **Sessie 1** | Woordraad + Sudoku | ✅ DONE |
| **Sessie 2** | Solitaire + Memory | ⏳ TODO |
| **Sessie 3** | Trivia + final wiring + polish | ⏳ TODO |

---

## Architectuur Overzicht

### Bestandsstructuur

```
src/
  engines/
    woordraad/engine.ts     ← ✅ Wordle-style engine (277 lines)
    sudoku/engine.ts        ← ✅ Sudoku generator + solver (450 lines)
    solitaire/engine.ts     ← ⏳ TODO
    memory/engine.ts        ← ⏳ TODO
    trivia/engine.ts        ← ⏳ TODO
  screens/modules/
    GameLobbyScreen.tsx     ← ✅ Lobby met SpelTegel tiles + game routing
    WoordraadScreen.tsx     ← ✅ Compleet (677 lines)
    SudokuScreen.tsx        ← ✅ Compleet (660 lines)
    SolitaireScreen.tsx     ← ⏳ TODO
    MemoryScreen.tsx        ← ⏳ TODO
    TriviaScreen.tsx        ← ⏳ TODO
    index.ts                ← ✅ Exporteert Woordraad + Sudoku (rest toevoegen)
  types/games.ts            ← ✅ Alle 5 games gedefinieerd
  contexts/GameContext.tsx   ← ✅ Session lifecycle + stats + XMPP stubs
  hooks/games/
    useGameSession.ts       ← ✅ Session timer + auto-save
    useGameStats.ts         ← ✅ Stats aggregatie hook
  components/games/
    SpelTegel.tsx           ← ✅ Lobby tile component
    GameHeader.tsx          ← ✅ In-game score + timer + actions bar
    GameOverModal.tsx       ← ✅ End-of-game results modal
    DifficultyPicker.tsx    ← ✅ Horizontal chip selector voor difficulty
    GameStatsView.tsx       ← ✅ Stats display per game
    GameInviteModal.tsx     ← ✅ Multiplayer invite UI
    GameWaitingModal.tsx    ← ✅ Waiting for players UI
    InGameChat.tsx          ← ✅ In-game chat component
    index.ts                ← ✅ Barrel exports
  models/
    GameSession.ts          ← ✅ WatermelonDB model (game_sessions table)
    GameStat.ts             ← ✅ WatermelonDB model (game_stats table)
```

### Game Type Definities (src/types/games.ts)

```typescript
type GameType = 'woordraad' | 'sudoku' | 'solitaire' | 'memory' | 'trivia';
type GameMode = 'solo' | 'multiplayer';
type GameSessionStatus = 'in_progress' | 'completed' | 'abandoned';
type GameDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

// Solo-only games (geen multiplayer support):
const SOLO_ONLY_GAMES: GameType[] = ['sudoku', 'solitaire'];

// Multiplayer-capable games (XMPP protocol):
const MULTIPLAYER_GAMES: GameType[] = ['woordraad', 'memory', 'trivia'];
```

### ModuleColorId Registratie

Alle 5 games zijn geregistreerd in `src/types/liquidGlass.ts` als `ModuleColorId` entries:
- `'woordraad'` — Blauw
- `'sudoku'` — Oranje
- `'solitaire'` — Groen
- `'memory'` — Roze
- `'trivia'` — Geel

De exacte hex waarden staan in `MODULE_TINT_COLORS` in `src/types/liquidGlass.ts`.

---

## Screen Pattern (VERPLICHT)

Alle game screens volgen exact hetzelfde pattern als Woordraad en Sudoku. Gebruik deze als referentie.

### Props Interface

```typescript
interface [Game]ScreenProps {
  onBack: () => void;  // Callback naar GameLobbyScreen
}
```

### 3-Fase State Machine

Elke game screen heeft 3 fasen:

```typescript
type GamePhase = 'menu' | 'playing' | 'gameover';
const [phase, setPhase] = useState<GamePhase>('menu');
```

| Fase | Wat wordt getoond |
|------|-------------------|
| `'menu'` | ModuleHeader + DifficultyPicker (indien van toepassing) + "Speel" knop + GameStatsView + Back knop |
| `'playing'` | ModuleHeader + GameHeader (score/timer/actions) + Game canvas |
| `'gameover'` | Playing view + GameOverModal overlay |

### ModuleScreenLayout Structuur

```typescript
<View style={[styles.container, { backgroundColor: themeColors.background }]}>
  <ModuleScreenLayout
    moduleId={MODULE_ID}
    moduleBlock={
      <ModuleHeader
        moduleId={MODULE_ID}
        icon={ICON_NAME}
        title={t('games.[game].title')}   // of t('navigation.[game]')
        showBackButton={true}
        onBackPress={handleBack}
        skipSafeArea
      />
    }
    controlsBlock={
      phase === 'playing' ? (
        <GameHeader
          moduleId={MODULE_ID}
          score={score}
          timer={durationSeconds}
          showTimer={true}
          actions={[/* game-specifieke acties */]}
        />
      ) : <></>
    }
    contentBlock={/* fase-afhankelijke content */}
  />
</View>
```

### useGameSession Hook Usage

```typescript
const {
  session,
  isActive,
  durationSeconds,
  startSession,
  completeGame,
  abandonGame,
  saveState,
} = useGameSession({ gameType: '[game]' });
```

### Game Start Flow

```typescript
const handleStartGame = useCallback(async () => {
  const engineState = createInitialState(/* optionele params */);
  setGameState(engineState);
  await startSession({
    mode: 'solo',
    difficulty: selectedDifficulty,  // indien van toepassing
    players: ['local'],
  });
  setPhase('playing');
}, [selectedDifficulty, startSession]);
```

### Game Over Flow

```typescript
// Wanneer game eindigt (detectie in engine):
if (engineState.isComplete || engineState.isGameOver) {
  const finalScore = calculateScore(engineState);
  await completeGame(finalScore, engineState.isWon);
  setPhase('gameover');
}
```

### GameOverModal Integration

```typescript
<GameOverModal
  visible={phase === 'gameover'}
  moduleId={MODULE_ID}
  title={gameState.isWon ? t('games.common.congratulations') : t('games.common.gameOver')}
  score={calculateScore(gameState)}
  stats={[
    { label: t('games.common.time'), value: formatTime(durationSeconds) },
    // game-specifieke stats...
  ]}
  onPlayAgain={handlePlayAgain}
  onBackToLobby={handleBackToLobby}
  onClose={() => setPhase('playing')}
/>
```

### Back Button Handling

```typescript
const handleBack = useCallback(() => {
  if (phase === 'playing') {
    // Abandon active game
    abandonGame();
    setPhase('menu');
  } else {
    onBack();  // Terug naar lobby
  }
}, [phase, abandonGame, onBack]);

const handleBackToLobby = useCallback(() => {
  setPhase('menu');
  setGameState(null);
}, []);

const handlePlayAgain = useCallback(async () => {
  // Reset en start nieuw spel
  const newState = createInitialState(/* params */);
  setGameState(newState);
  await startSession({ mode: 'solo', difficulty: selectedDifficulty, players: ['local'] });
  setPhase('playing');
}, [selectedDifficulty, startSession]);
```

---

## Imports Template

Elke game screen importeert minimaal:

```typescript
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, borderRadius, touchTargets, typography, colors as themeConst } from '@/theme';
import {
  ModuleHeader,
  ModuleScreenLayout,
  ScrollViewWithIndicator,
  HapticTouchable,
  Icon,
} from '@/components';
import { GameHeader, GameOverModal, GameStatsView, DifficultyPicker } from '@/components/games';
import type { DifficultyOption } from '@/components/games';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import { useGameSession } from '@/hooks/games';
import type { GameDifficulty } from '@/types/games';
import type { ModuleColorId } from '@/types/liquidGlass';

// Game-specifieke engine imports:
import { createInitialState, /* engine functions */ } from '@/engines/[game]/engine';
```

---

## Game-Specifieke Ontwerpen

### 🃏 Solitaire (Sessie 2)

**Type:** Solo-only (SOLO_ONLY_GAMES)
**Moeilijkheidsgraden:** Ja — easy/medium/hard/expert (gebruik DifficultyPicker)

**Engine Ontwerp (`src/engines/solitaire/engine.ts`):**

```typescript
// Standaard Klondike Solitaire regels:
// - 7 tableau kolommen (1-7 kaarten, bovenste open)
// - Stock pile (resterende kaarten, trekken per 1 of 3)
// - 4 foundation piles (Aas → Koning per kleur)
// - Tableau: aflopend, wisselende kleuren (rood/zwart)

interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: number;  // 1 (Aas) - 13 (Koning)
  faceUp: boolean;
}

interface SolitaireState {
  stock: Card[];           // Trekstapel
  waste: Card[];           // Aflegstapel (getrokken kaarten)
  foundations: Card[][];   // 4 foundation piles
  tableau: Card[][];       // 7 tableau kolommen
  selectedCards: { pile: PileType; pileIndex: number; cardIndex: number } | null;
  moveCount: number;
  isComplete: boolean;
  isWon: boolean;
  difficulty: GameDifficulty;
}

// Difficulty bepaalt:
// - easy: Trek 1 kaart, onbeperkte passes door stock
// - medium: Trek 1 kaart, max 3 passes
// - hard: Trek 3 kaarten, onbeperkte passes
// - expert: Trek 3 kaarten, max 1 pass

// Engine functies:
export function createInitialState(difficulty: GameDifficulty): SolitaireState;
export function drawFromStock(state: SolitaireState): SolitaireState;
export function moveCards(state: SolitaireState, from: PileLocation, to: PileLocation): SolitaireState | null;
export function autoComplete(state: SolitaireState): SolitaireState;  // Als alle kaarten open
export function calculateScore(state: SolitaireState): number;
export function getStarRating(state: SolitaireState): 1 | 2 | 3 | undefined;
export function serializeState(state: SolitaireState): Record<string, unknown>;
export function deserializeState(snapshot: Record<string, unknown>): SolitaireState;
```

**UI Ontwerp:**
- Kaarten worden gerenderd als gekleurde View elementen met Text (geen afbeeldingen nodig)
- Drag-and-drop is te complex voor senioren → **tap-to-select, tap-to-place** pattern
- Tap op kaart → highlight + mogelijke doelen tonen
- Tap op doel → kaart verplaatst met animatie
- Undo knop in GameHeader actions
- Auto-complete knop verschijnt wanneer alle kaarten face-up zijn

**Senior-Inclusive:**
- Kaarten minimaal 50×70pt (leesbaar op iPhone SE)
- Kleuren + symbool (♠♣♥♦) — niet alleen kleur als indicator
- Horizontale scroll voor tableau als nodig
- Tip/hint knop die de beste zet highlight

**i18n Keys Nodig (games.solitaire.*):**
```
title, howToPlay, draw, undo, autoComplete, hint,
stock, waste, foundation, tableau, movesCount,
drawOne, drawThree
```

---

### 🧠 Memory (Sessie 2)

**Type:** Multiplayer-capable (MULTIPLAYER_GAMES) — maar solo-modus eerst
**Moeilijkheidsgraden:** Ja — easy (4×3=12), medium (4×4=16), hard (5×4=20), expert (6×5=30)

**Engine Ontwerp (`src/engines/memory/engine.ts`):**

```typescript
interface MemoryCard {
  id: number;
  emoji: string;      // Emoji als afbeelding (bijv. 🐶, 🌺, 🚗)
  isFlipped: boolean;  // Face up
  isMatched: boolean;  // Gevonden paar
}

interface MemoryState {
  cards: MemoryCard[];
  gridCols: number;
  gridRows: number;
  flippedIndices: number[];   // Max 2 tegelijk
  matchedPairs: number;
  totalPairs: number;
  moveCount: number;          // Elke twee flips = 1 move
  isComplete: boolean;
  isWon: boolean;
  difficulty: GameDifficulty;
  // Multiplayer:
  currentPlayerIndex: number;
  playerScores: number[];     // Gevonden paren per speler
}

// Difficulty bepaalt grid grootte:
// easy: 4×3 = 12 kaarten (6 paren)
// medium: 4×4 = 16 kaarten (8 paren)
// hard: 5×4 = 20 kaarten (10 paren)
// expert: 6×5 = 30 kaarten (15 paren)

// Emoji categorieën (senior-friendly, herkenbaar):
const EMOJI_SETS = {
  animals: ['🐶', '🐱', '🐰', '🐻', '🦊', '🐸', '🐥', '🦋', '🐠', '🐢', '🦉', '🐝', '🐞', '🦀', '🐬'],
  food: ['🍎', '🍊', '🍋', '🍓', '🍇', '🍉', '🍌', '🥕', '🌽', '🍕', '🧁', '🍩', '🍪', '🍫', '☕'],
  nature: ['🌺', '🌻', '🌹', '🌷', '🌸', '🍀', '🌳', '⭐', '🌈', '☀️', '🌙', '❄️', '🔥', '💧', '🌊'],
};

// Engine functies:
export function createInitialState(difficulty: GameDifficulty): MemoryState;
export function flipCard(state: MemoryState, index: number): MemoryState;
export function checkMatch(state: MemoryState): { state: MemoryState; isMatch: boolean };
export function calculateScore(state: MemoryState, durationSeconds: number): number;
export function getStarRating(state: MemoryState): 1 | 2 | 3 | undefined;
export function serializeState(state: MemoryState): Record<string, unknown>;
export function deserializeState(snapshot: Record<string, unknown>): MemoryState;
```

**UI Ontwerp:**
- Grid van kaarten (View + emoji tekst)
- Achterkant: gekleurde View met `?` of module-kleur
- Tap → flip animatie (LayoutAnimation of eenvoudige opacity)
- 2 kaarten open → 1s delay → match check → of terugdraaien of matched markeren
- Matched kaarten: lichtere opacity, niet meer tappable

**Senior-Inclusive:**
- Emoji's als afbeeldingen (universeel herkenbaar, geen tekst nodig)
- Minimaal 60×60pt per kaart
- Duidelijke flip-animatie (niet te snel)
- Paar gevonden → visueel + haptic feedback
- Geen tijdsdruk (timer is informatief, niet afstraffend)

**Multiplayer (stub voor nu):**
- Turn-based: speler 1 flipped, als match → nog een beurt
- XMPP stanza: `game_move` met `{ index: number }` payload
- GameInviteModal + GameWaitingModal zijn al beschikbaar

**i18n Keys Nodig (games.memory.*):**
```
title, howToPlay, pairs, pairsFound, moves, yourTurn,
matchFound, noMatch, perfectGame
```

---

### 🧩 Trivia (Sessie 3)

**Type:** Multiplayer-capable (MULTIPLAYER_GAMES)
**Moeilijkheidsgraden:** Ja — easy/medium/hard/expert (bepaalt vraag-selectie)

**Engine Ontwerp (`src/engines/trivia/engine.ts`):**

```typescript
interface TriviaQuestion {
  id: string;
  question: string;        // Vertaalde vraagtekst
  answers: string[];        // 4 antwoordopties (shuffled)
  correctIndex: number;     // Index van correct antwoord
  category: TriviaCategory;
  difficulty: GameDifficulty;
}

type TriviaCategory =
  | 'general'
  | 'history'
  | 'geography'
  | 'nature'
  | 'culture'
  | 'food'
  | 'sports';

interface TriviaState {
  questions: TriviaQuestion[];
  currentQuestionIndex: number;
  answers: (number | null)[];     // Gegeven antwoorden (index of null)
  correctCount: number;
  totalQuestions: number;          // 10 per ronde
  isComplete: boolean;
  isWon: boolean;                  // ≥60% correct = won
  timePerQuestion: number;         // Seconden per vraag (bijv. 30)
  currentQuestionTimeLeft: number;
  difficulty: GameDifficulty;
  // Multiplayer:
  playerAnswers: Record<string, (number | null)[]>;
  playerScores: Record<string, number>;
}

// Difficulty bepaalt:
// easy: Eenvoudige vragen, 45s per vraag
// medium: Gemiddelde vragen, 30s per vraag
// hard: Moeilijke vragen, 20s per vraag
// expert: Alle vragen, 15s per vraag

// Vragenbank: ~200 vragen in NL (andere talen via i18n of API)
// Format: Statische array in engine (zoals DUTCH_WORDS in Woordraad)
// Categorieën: Variëren per ronde (random selectie)

// Engine functies:
export function createInitialState(difficulty: GameDifficulty): TriviaState;
export function answerQuestion(state: TriviaState, answerIndex: number): TriviaState;
export function skipQuestion(state: TriviaState): TriviaState;  // Timeout
export function calculateScore(state: TriviaState): number;
export function getStarRating(state: TriviaState): 1 | 2 | 3 | undefined;
export function serializeState(state: TriviaState): Record<string, unknown>;
export function deserializeState(snapshot: Record<string, unknown>): TriviaState;
```

**UI Ontwerp:**
- Vraag bovenaan (grote tekst, 24pt+)
- 4 antwoordknoppen eronder (grid 2×2 of verticale lijst)
- Timer bar bovenaan (kleur verandert: groen → geel → rood)
- Na antwoord: correct = groen flash, fout = rood flash + correct antwoord tonen
- 2s delay → volgende vraag
- Resultaten na ronde: correct/totaal + score + uitleg per vraag (optioneel)

**Senior-Inclusive:**
- Grote, leesbare vraagtekst
- 4 duidelijke antwoordknoppen (minimaal 60pt hoog, vol breedte)
- Timer visueel (balk) + tekst (seconden) — niet alleen kleur
- Na antwoord duidelijke visuele feedback (niet alleen kleur)
- Vragen over herkenbare onderwerpen (natuur, eten, cultuur — niet technologie)

**Vragenbank Aanpak:**
- Statische vragenlijst in het engine bestand (zoals DUTCH_WORDS in Woordraad)
- ~200 vragen in het Nederlands, gecategoriseerd
- i18n: Vertalingen in locale bestanden OF separate vragenbanken per taal
- Aanbeveling: Start met NL-only statische vragen, later uitbreiden

**Multiplayer:**
- Iedereen ziet dezelfde vraag tegelijk
- Timer per vraag (niet per speler)
- Punten voor snelheid: sneller antwoorden = meer punten
- XMPP stanza: `game_move` met `{ questionIndex, answerIndex, timeRemaining }` payload

**i18n Keys Nodig (games.trivia.*):**
```
title, howToPlay, question, timeLeft, correct, incorrect,
score, round, category, skip, nextQuestion, results,
correctAnswer, yourAnswer, finalScore, questionsCorrect
```

---

## Checklist per Game (VERPLICHT)

Bij het bouwen van elke game, doorloop ALLE stappen:

### 1. Engine (`src/engines/[game]/engine.ts`)

- [ ] Types gedefinieerd (State, subtypes)
- [ ] `createInitialState()` — Maakt initieel spel
- [ ] Kern game-logica functies
- [ ] `calculateScore()` — Scoring systeem
- [ ] `getStarRating()` — 1/2/3 sterren
- [ ] `serializeState()` — Voor database opslag
- [ ] `deserializeState()` — Voor resume
- [ ] Geen imports van React of UI libraries (pure logic)

### 2. Screen (`src/screens/modules/[Game]Screen.tsx`)

- [ ] Props: `{ onBack: () => void }`
- [ ] 3-fase state machine (menu/playing/gameover)
- [ ] ModuleScreenLayout met ModuleHeader (showBackButton, skipSafeArea)
- [ ] GameHeader in controlsBlock (score, timer, actions)
- [ ] DifficultyPicker (indien van toepassing)
- [ ] GameStatsView in menu fase
- [ ] GameOverModal in gameover fase
- [ ] useGameSession hook voor session lifecycle
- [ ] useModuleColor hook voor kleuren
- [ ] Back button handling (abandon bij playing, onBack bij menu)
- [ ] Touch targets ≥60pt
- [ ] Senior-inclusive design (geen kleur-only indicators)

### 3. Exports & Navigation

- [ ] Export in `src/screens/modules/index.ts`
- [ ] Import + routing in `GameLobbyScreen.tsx` (conditional render)
- [ ] Uncomment de relevante rule in GameLobbyScreen

### 4. i18n (ALLE 13 locales)

- [ ] Expand `games.[game]` sectie in nl.json (master)
- [ ] Vertaal naar alle 12 andere locales
- [ ] Locales: nl, en, en-GB, de, fr, es, it, no, sv, da, pt, pt-BR, pl

### 5. Build & Validatie

- [ ] TypeScript compileert zonder errors
- [ ] Xcode build slaagt (⌘B)
- [ ] Handmatige test op simulator/device

---

## GameLobbyScreen Routing

Het huidige routing patroon in `GameLobbyScreen.tsx`:

```typescript
const [activeGame, setActiveGame] = useState<GameType | null>(null);

// Render individual game screen when selected
if (activeGame === 'woordraad') {
  return <WoordraadScreen onBack={handleBackToLobby} />;
}
if (activeGame === 'sudoku') {
  return <SudokuScreen onBack={handleBackToLobby} />;
}
// Future sessions: solitaire, memory, trivia
// if (activeGame === 'solitaire') return <SolitaireScreen onBack={handleBackToLobby} />;
// if (activeGame === 'memory') return <MemoryScreen onBack={handleBackToLobby} />;
// if (activeGame === 'trivia') return <TriviaScreen onBack={handleBackToLobby} />;
```

**Bij het toevoegen van een nieuw game:**
1. Import de Screen component bovenaan het bestand
2. Uncomment (of voeg toe) de conditional return
3. Export in `screens/modules/index.ts`

---

## Bestaande i18n Keys (games sectie in nl.json)

### Lobby & Common (al compleet)

```
games.lobby.title, games.lobby.difficulty, games.lobby.easy, games.lobby.medium,
games.lobby.hard, games.lobby.expert, games.lobby.play, games.lobby.resume,
games.lobby.solo, games.lobby.multiplayer, games.lobby.invite

games.common.score, games.common.time, games.common.moves, games.common.lives,
games.common.level, games.common.congratulations, games.common.gameOver,
games.common.win, games.common.loss, games.common.draw, games.common.completed,
games.common.newBestScore, games.common.playAgain, games.common.backToLobby,
games.common.gamesPlayed, games.common.bestScore, games.common.winRate,
games.common.currentStreak, games.common.bestStreak, games.common.quit,
games.common.quitConfirm

games.stats.title, games.stats.noStats, games.stats.totalTimePlayed
```

### Per Game (huidige staat)

| Game | Keys beschikbaar |
|------|-----------------|
| woordraad | title, howToPlay, enterWord, errorTooShort, errorNotInList, legend, correct, present, absent, guessesUsed (✅ COMPLEET) |
| sudoku | title, howToPlay, remaining, errors, notes, notesMode, erase, hint, cell (✅ COMPLEET) |
| solitaire | description (alleen placeholder — MOET worden uitgebreid) |
| memory | description (alleen placeholder — MOET worden uitgebreid) |
| trivia | description (alleen placeholder — MOET worden uitgebreid) |

---

## Shared Components API Reference

### GameHeader

```typescript
interface GameHeaderProps {
  moduleId: ModuleColorId;
  score?: number;
  timer?: number;
  showTimer?: boolean;
  actions?: GameHeaderAction[];  // { icon, label, onPress, disabled? }
}
```

### GameOverModal

```typescript
interface GameOverModalProps {
  visible: boolean;
  moduleId: ModuleColorId;
  title: string;
  score: number;
  stats?: GameOverStat[];  // { label, value, isHighlight? }
  onPlayAgain: () => void;
  onBackToLobby: () => void;
  onClose: () => void;
}
```

### DifficultyPicker

```typescript
interface DifficultyPickerProps {
  selected: GameDifficulty;
  onSelect: (difficulty: GameDifficulty) => void;
  options: DifficultyOption[];  // { value, label, description? }
  moduleId: ModuleColorId;
}
```

### GameStatsView

```typescript
interface GameStatsViewProps {
  gameType: GameType;
  moduleId: ModuleColorId;
}
```

### DifficultyOption (gebruikte i18n keys)

```typescript
const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { value: 'easy', label: t('games.lobby.easy') },
  { value: 'medium', label: t('games.lobby.medium') },
  { value: 'hard', label: t('games.lobby.hard') },
  { value: 'expert', label: t('games.lobby.expert') },
];
```

---

## Theme Referentie

De volgende theme tokens worden gebruikt in game screens:

```typescript
import { spacing, borderRadius, touchTargets, typography, colors as themeConst } from '@/theme';

// spacing: xs=4, sm=8, md=16, lg=24, xl=32, xxl=48
// borderRadius: sm=4, md=12, lg=16, xl=24
// touchTargets: minimum=60, comfortable=72, large=84
// typography: body (18pt), label (16pt), h3 (24pt)
// themeConst: textOnPrimary='#FFFFFF'
```

---

## Multiplayer Stubs (voor later)

De multiplayer infrastructure is al gebouwd maar nog niet verbonden:

- `GameContext.sendGameStanza()` — Stuurt XMPP stanza (nu console.debug)
- `GameContext.registerGameHandler()` — Registreert handler voor inkomende stanzas
- `GameInviteModal` — UI voor spelers uitnodigen
- `GameWaitingModal` — UI voor wachten op acceptatie
- `InGameChat` — In-game chat component

**Voor sessie 2+3:** Bouw alleen solo-modus. Multiplayer wiring is een aparte taak.

---

## Sessie 3 Extra Taken

Naast Trivia, moet sessie 3 ook:

1. **Final polish** — Alle 5 games testen op consistentie
2. **Navigation.games i18n key** — Controleer dat `navigation.woordraad`, `navigation.sudoku`, `navigation.solitaire`, `navigation.memory`, `navigation.trivia` in alle 13 locales bestaan
3. **GameLobbyScreen** — Alle 5 conditional renders zijn uncommented en werkend
4. **PanelNavigator** — Bevestig dat alle 5 game moduleIds correct routen
5. **Build validatie** — Schone build op Xcode
