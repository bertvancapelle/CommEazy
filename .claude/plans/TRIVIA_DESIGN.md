# Trivia — Game Design Document

> **Status:** Ontwerp voltooid, implementatie nog niet gestart
> **Datum:** 2026-03-30
> **PNA Sessie:** Games Session 3b — Trivia design

## 1. Overzicht

**Trivia** is een quiz-spel met multiple-choice vragen uit diverse categorieën. Spelers beantwoorden vragen en verdienen punten op basis van moeilijkheidsgraad. Beschikbaar als standalone game én als gedeelde vragenbank voor Woordy's trivia-velden.

**Doelgroep:** Senioren (65+) — herkenbaar quiz-formaat, geen tijdsdruk (standaard), grote knoppen, duidelijke feedback.

## 2. Vraagformat

| Eigenschap | Waarde |
|------------|--------|
| Type | Multiple-choice |
| Opties per vraag | 4 |
| Interactie | Tap-to-answer (één van de vier opties) |
| Feedback | Direct na antwoord: groen (goed) / rood (fout) + correct antwoord tonen |
| Haptic | Succes-haptic bij goed, warning-haptic bij fout |

## 3. Categorieën

### 3.1 Gegroepeerde Thema's

De ~24 OpenTDB categorieën worden gegroepeerd in 6-8 bredere thema's voor een overzichtelijk keuzescherm:

| Thema | OpenTDB Categorieën |
|-------|---------------------|
| Wetenschap & Natuur | Science & Nature, Science: Computers, Science: Mathematics, Science: Gadgets |
| Geschiedenis & Aardrijkskunde | History, Geography, Politics |
| Kunst & Cultuur | Art, Mythology, Celebrities |
| Entertainment | Entertainment: Film, Entertainment: Music, Entertainment: Television, Entertainment: Video Games, Entertainment: Board Games, Entertainment: Comics, Entertainment: Japanese Anime & Manga, Entertainment: Cartoon & Animations, Entertainment: Musicals & Theatres |
| Sport | Sports |
| Algemene Kennis | General Knowledge |
| Dieren & Voertuigen | Animals, Vehicles |

**Opmerking:** De exacte indeling wordt bij implementatie vastgesteld op basis van het daadwerkelijke aanbod aan vragen per categorie. Categorieën met te weinig vragen worden samengevoegd.

### 3.2 Categorie Selectie

- Gebruiker kiest categorie **vóór** elke ronde
- Eerste optie is altijd **"Alles / Mix"** (willekeurige vragen uit alle categorieën)
- Categorie-knoppen zijn groot (≥60pt touch targets) met duidelijk icoon per thema
- Bij multiplayer: initiator kiest de categorie

## 4. Moeilijkheidsgraden

| Moeilijkheid | Label (NL) | OpenTDB mapping | Punten per correct antwoord |
|-------------|------------|-----------------|----------------------------|
| Makkelijk | Makkelijk | `easy` | +10 |
| Gemiddeld | Gemiddeld | `medium` | +20 |
| Moeilijk | Moeilijk | `hard` | +30 |

- **Instelbaar** in Trivia instellingen (default: Gemiddeld)
- **Woordy erft** deze instelling — trivia-velden in Woordy gebruiken dezelfde moeilijkheidsgraad
- **Fout antwoord:** 0 punten (geen aftrek)

## 5. Ronde-structuur

### 5.1 Vragen per Ronde

Instelbaar: **5 / 10 / 15 / 20** vragen per ronde (default: 10)

### 5.2 Timer (Optioneel)

| Instelling | Waarde |
|------------|--------|
| Default | Uit (geen tijdslimiet) |
| Opties | Uit / 15 seconden / 30 seconden / 60 seconden |
| Bij time-out | Vraag telt als fout (0 punten) |
| Visueel | Aftellende voortgangsbalk bovenaan het scherm |

**Rationale:** Default uit = geen tijdsdruk voor senioren. Optionele timer voor gevorderde spelers die een uitdaging willen.

### 5.3 Vraag Flow (Solo)

1. Categorie kiezen
2. Vraag wordt getoond met 4 antwoordopties
3. Speler tikt op antwoord
4. Direct feedback: groen/rood + correct antwoord (2 seconden zichtbaar)
5. Automatisch door naar volgende vraag
6. Na laatste vraag: resultaatscherm

### 5.4 Vraag Flow (Multiplayer — Synchroon)

1. Initiator kiest categorie
2. Beide spelers zien dezelfde vraag tegelijk
3. Beide beantwoorden onafhankelijk
4. Na antwoord: wacht op tegenstander (of time-out)
5. Toon resultaat: wie goed/fout had + correct antwoord
6. Automatisch door naar volgende vraag
7. Na laatste vraag: vergelijkend resultaatscherm

## 6. Scoring

### 6.1 Puntentelling

| Moeilijkheid | Correct | Fout | Time-out |
|-------------|---------|------|----------|
| Makkelijk | +10 | 0 | 0 |
| Gemiddeld | +20 | 0 | 0 |
| Moeilijk | +30 | 0 | 0 |

- Geen streaks of combo-bonussen
- Geen tijdsbonus (eenvoud voor senioren)

### 6.2 Eindscore

```
Totaalscore = Σ (punten per correct antwoord)
```

**Rationale:** Simpel en voorspelbaar. Senioren begrijpen direct hoe de score tot stand komt.

## 7. Multiplayer

| Eigenschap | Waarde |
|------------|--------|
| Type | 1-op-1 (twee spelers) |
| Matchmaking | Invite-based via XMPP (geen random matching) |
| Vereiste | Beide spelers CommEazy-gebruikers |
| Taal | Zelfde taal vereist (vragen zijn taal-afhankelijk) |
| Sync model | Synchroon per vraag — beide beantwoorden dezelfde vraag |
| Protocol | XMPP game stanzas (bestaande infrastructuur) |
| Disconnect | Bij disconnect: wacht 30s → automatisch time-out per vraag |

### 7.1 Multiplayer Sync Detail

- Initiator stuurt game invite met: categorie, moeilijkheid, aantal vragen, vragenset (IDs)
- Beide spelers krijgen exact dezelfde vragen in dezelfde volgorde
- Na elk antwoord: stuur antwoord + timing via XMPP
- Wacht op tegenstander's antwoord (max wachttijd = timer instelling, of 60s als timer uit)
- Toon vergelijking: "Jij: ✅ / Tegenstander: ❌"
- Na alle vragen: vergelijkend scoreboard

### 7.2 Anti-cheat

- Vragenset wordt bij start bepaald en gedeeld (niet per vraag opgehaald)
- Client-side only — geen server validatie (acceptabel voor casual senior game)

## 8. Vragenbank (Gedeeld met Woordy)

### 8.1 Bron

| Eigenschap | Waarde |
|------------|--------|
| Database | OpenTDB (Open Trivia Database) |
| Licentie | CC BY-SA 4.0 (vrij te gebruiken) |
| Omvang | ~5.200 geverifieerde vragen (Engels) |
| Categorieën | 24 origineel, gegroepeerd in 6-8 thema's |
| Moeilijkheidsgraden | 3 (easy, medium, hard — pre-geclassificeerd) |

### 8.2 Taalondersteuning

- **Brontaal:** Engels (OpenTDB)
- **Vertaling:** Naar alle 13 CommEazy-talen
- **Vertaalmethode:** Machine-vertaling (later handmatig te verfijnen)
- **Opslag per taal:** ~1.5 MB (JSON met alle ~5.200 vragen)

### 8.3 On-Demand Download

| Eigenschap | Waarde |
|------------|--------|
| Bundle grootte | 0 MB (geen vragen gebundeld in app) |
| Download per taal | ~1.5 MB |
| Opslag na download | Lokaal (volledig offline beschikbaar) |
| Taal bepaling | Volgt app-taalinstelling |

### 8.4 Download Flow (Gedeeld met Woordy Dictionaries)

Dezelfde download service wordt gebruikt voor Trivia vragen EN Woordy woordenlijsten:

1. **Check internetverbinding** — Geen connectie → foutmelding met "Probeer opnieuw"
2. **Vraag gebruiker om bevestiging** — "Trivia vragen downloaden voor Nederlands (~1.5 MB)?"
3. **Toon voortgangsbalk** — Percentage + geschatte grootte
4. **Download volledige dataset** — Alle vragen voor geselecteerde taal in één keer
5. **Succes bevestiging** — "Download voltooid! Je kunt nu offline spelen."

**Download Service (gedeeld):**

```
src/
  services/
    downloadService.ts    ← Gedeelde download service
      - checkConnectivity()
      - showConfirmDialog()
      - downloadWithProgress()
      - validateDownload()
```

### 8.5 Vraag Structuur (JSON)

```typescript
interface TriviaQuestion {
  id: string;                    // Uniek ID
  category: string;              // OpenTDB categorie naam
  theme: TriviaTheme;           // Gegroepeerd thema (6-8 opties)
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;              // Vraagtekst
  correctAnswer: string;         // Correct antwoord
  incorrectAnswers: string[];    // 3 foute antwoorden
}
```

### 8.6 Woordy Integratie

Wanneer een Woordy-speler een trivia-veld raakt:
1. Engine selecteert willekeurige vraag uit lokale database
2. Moeilijkheidsgraad = Trivia module instelling (gedeeld)
3. Categorie = willekeurig (geen keuze in Woordy)
4. Zelfde vraagformat als standalone Trivia
5. Resultaat: +10 (goed) of -10 (fout) op woordscore

## 9. Instellingen

### 9.1 Trivia Instellingen Scherm

Bereikbaar via menu in TriviaScreen (tandwiel icoon):

| Instelling | Opties | Default |
|-----------|--------|---------|
| Moeilijkheid | Makkelijk / Gemiddeld / Moeilijk | Gemiddeld |
| Vragen per ronde | 5 / 10 / 15 / 20 | 10 |
| Timer | Uit / 15s / 30s / 60s | Uit |

**AsyncStorage keys:**
- `@commeazy/trivia_difficulty` — `'easy' | 'medium' | 'hard'`
- `@commeazy/trivia_questions_per_round` — `5 | 10 | 15 | 20`
- `@commeazy/trivia_timer` — `0 | 15 | 30 | 60` (0 = uit)

### 9.2 Woordy Koppeling

Woordy leest `@commeazy/trivia_difficulty` voor trivia-veld moeilijkheidsgraad. Geen eigen instelling — één plek om moeilijkheid te beheren.

## 10. Technische Implementatie

### 10.1 Bestanden (Te Maken)

```
src/
  engines/
    trivia/
      engine.ts              ← Game engine (vraag selectie, scoring, ronde management)
      questionBank.ts        ← Lokale database queries (gefilterd op taal/categorie/moeilijkheid)
      types.ts               ← TypeScript types voor Trivia
  services/
    downloadService.ts       ← Gedeelde download service (trivia + woordy dictionaries)
  screens/
    modules/
      TriviaScreen.tsx       ← Hoofd screen (menu + instellingen + game)
  components/
    games/
      TriviaQuestionCard.tsx  ← Vraag + 4 antwoordknoppen
      TriviaProgressBar.tsx   ← Voortgang (vraag X van Y) + optionele timer
      TriviaScoreboard.tsx    ← Eindscore + statistieken
      TriviaCategoryPicker.tsx ← Categorie keuzescherm met iconen
```

### 10.2 Bestaande Infrastructuur

| Component | Status | Locatie |
|-----------|--------|---------|
| Game session tracking | ✅ Bestaand | `useGameSession` hook |
| Game stats | ✅ Bestaand | `useGameStats` hook |
| WatermelonDB schema | ✅ v30 | `game_sessions` + `game_stats` tabellen |
| XMPP game protocol | ✅ Types | `sendGameStanza` is stub |
| GameLobbyScreen | ✅ Bestaand | Route toevoegen voor Trivia |
| GameOverModal | ✅ Bestaand | Herbruikbaar voor Trivia |
| GameHeader | ✅ Bestaand | Timer + actions |
| DifficultyPicker | ✅ Bestaand | Herbruikbaar voor moeilijkheidsgraad selectie |

### 10.3 Registratie Checklist

Bij implementatie MOETEN de volgende registraties worden uitgevoerd:

- [ ] `GameType` union type uitbreiden met `'trivia'`
- [ ] `ALL_GAME_TYPES` array uitbreiden
- [ ] GameLobbyScreen: route voor Trivia toevoegen (uncomment + import)
- [ ] i18n: `games.trivia.*` keys in alle 13 talen
- [ ] `navigation.trivia` key in alle 13 talen
- [ ] Trivia categorie namen in alle 13 talen

## 11. UX Design Richtlijnen

### 11.1 Senior-Inclusive

| Aspect | Vereiste |
|--------|---------|
| Antwoordknoppen | Groot (≥72pt hoogte), duidelijk gescheiden, volledige breedte |
| Vraagtekst | Body tekst (≥18pt), voldoende regelafstand |
| Feedback | Groen/rood + icoon (✅/❌) — kleur nooit als enige indicator |
| Timer | Grote visuele voortgangsbalk (niet alleen cijfers) |
| Navigatie | Geen swipe-gestures — alleen tap |
| Categorie keuze | Max 8 grote knoppen met icoon + tekst |

### 11.2 Scherm Layout — Vraag

```
┌──────────────────────────────────────┐
│  🎯 Trivia               [gamepad]   │  ← ModuleHeader
├──────────────────────────────────────┤
│  [Vraag 3 van 10]  [═══░░░] [⏱ 24s] │  ← TriviaProgressBar
├──────────────────────────────────────┤
│                                      │
│  Welk land heeft de meeste           │
│  inwoners ter wereld?                │  ← Vraagtekst (groot, centraal)
│                                      │
│  ┌──────────────────────────────┐    │
│  │  A. India                    │    │  ← Antwoord A (≥72pt)
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │  B. China                    │    │  ← Antwoord B
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │  C. Verenigde Staten         │    │  ← Antwoord C
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │  D. Indonesië                │    │  ← Antwoord D
│  └──────────────────────────────┘    │
│                                      │
│  Score: 40                           │  ← Lopende score
└──────────────────────────────────────┘
```

### 11.3 Scherm Layout — Categorie Keuze

```
┌──────────────────────────────────────┐
│  🎯 Trivia               [gamepad]   │  ← ModuleHeader
├──────────────────────────────────────┤
│                                      │
│  Kies een categorie:                 │
│                                      │
│  ┌──────────┐  ┌──────────┐         │
│  │  🎲      │  │  🔬      │         │
│  │  Alles   │  │ Weten-   │         │
│  │          │  │  schap   │         │
│  └──────────┘  └──────────┘         │
│  ┌──────────┐  ┌──────────┐         │
│  │  📜      │  │  🎨      │         │
│  │ Geschie- │  │  Kunst   │         │
│  │  denis   │  │ & Cultuur│         │
│  └──────────┘  └──────────┘         │
│  ┌──────────┐  ┌──────────┐         │
│  │  🎬      │  │  ⚽      │         │
│  │ Enter-   │  │  Sport   │         │
│  │ tainment │  │          │         │
│  └──────────┘  └──────────┘         │
│  ┌──────────┐  ┌──────────┐         │
│  │  📚      │  │  🐾      │         │
│  │ Algemeen │  │ Dieren   │         │
│  └──────────┘  └──────────┘         │
│                                      │
│  [⚙️ Instellingen]                   │
└──────────────────────────────────────┘
```

### 11.4 Feedback na Antwoord

- **Correct:** Gekozen knop wordt groen + ✅ icoon + succes-haptic
- **Fout:** Gekozen knop wordt rood + ❌ icoon + warning-haptic, correcte knop wordt groen gemarkeerd
- **Time-out:** Alle knoppen grijs, correcte knop wordt groen gemarkeerd
- **Wachttijd na feedback:** 2 seconden, dan automatisch volgende vraag

### 11.5 Resultaatscherm (Solo)

```
┌──────────────────────────────────────┐
│                                      │
│           🏆 Resultaat               │
│                                      │
│           Score: 140                 │
│                                      │
│     Correct:   7 / 10  (70%)        │
│     Makkelijk: 0    ← (niet gespeeld)│
│     Gemiddeld: 7/10                  │
│     Moeilijk:  0    ← (niet gespeeld)│
│                                      │
│     ⏱ Tijd: 2:34                     │
│                                      │
│  ┌──────────────────────────────┐    │
│  │     🔄 Opnieuw spelen       │    │
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │     🏠 Terug naar menu      │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘
```

### 11.6 Resultaatscherm (Multiplayer)

```
┌──────────────────────────────────────┐
│                                      │
│           🏆 Resultaat               │
│                                      │
│  Jij:         140 punten  ← WINNAAR │
│  Tegenstander: 120 punten            │
│                                      │
│  Per vraag:                          │
│  1. ✅ vs ✅  │  6. ✅ vs ❌         │
│  2. ❌ vs ✅  │  7. ✅ vs ✅         │
│  3. ✅ vs ✅  │  8. ❌ vs ❌         │
│  4. ✅ vs ❌  │  9. ✅ vs ✅         │
│  5. ✅ vs ✅  │ 10. ✅ vs ❌         │
│                                      │
│  ┌──────────────────────────────┐    │
│  │     🔄 Opnieuw spelen       │    │
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │     🏠 Terug naar menu      │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘
```

## 12. Beslissingen Samenvatting

| Onderwerp | Beslissing | Rationale |
|-----------|-----------|-----------|
| Multiple-choice (4 opties) | Herkenbaar quiz-formaat | Eenvoudig voor senioren, geen typen nodig |
| Geen streaks/combo's | Simpele scoring | Voorspelbaar, geen frustratie bij fout antwoord |
| Timer default uit | Senior-inclusive | Geen tijdsdruk als standaard |
| Timer optioneel | Gevorderde spelers | Uitdaging voor wie dat wil |
| Categorie keuze per ronde | Betrokkenheid | Speler heeft controle over onderwerp |
| 6-8 brede thema's | Overzichtelijkheid | 24 categorieën is te veel voor senioren |
| Synchroon multiplayer | Sociaal element | "Samen quizzen" gevoel, direct vergelijken |
| OpenTDB als bron | Gratis, CC BY-SA 4.0 | ~5.200 geverifieerde vragen, 3 moeilijkheidsgraden |
| On-demand per taal | Bundle size | 0 MB in app, ~1.5 MB per taal download |
| Gedeelde download service | Code hergebruik | Zelfde flow als Woordy dictionaries |
| Woordy erft moeilijkheid | Eenvoud | Eén instelling voor alle trivia |
| Fout = 0 punten | Geen bestraffing | Senioren raken niet ontmoedigd |
| Instelbaar 5/10/15/20 | Flexibiliteit | Korte of lange sessies naar wens |
