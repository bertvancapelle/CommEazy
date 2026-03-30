# Woordy — Game Design Document

> **Status:** Ontwerp voltooid, implementatie nog niet gestart
> **Datum:** 2026-03-30
> **PNA Sessie:** Games Session 3 — Woordy design

## 1. Overzicht

**Woordy** is een Wordfeud/Scrabble-achtig woordspel op een 15×15 bord met verborgen trivia-velden. Spelers leggen woorden met lettertegels en verdienen punten op basis van letterwaarden en bonusvelden. Trivia-velden voegen een uniek CommEazy-element toe: goed beantwoorden levert +10 punten, fout kost -10 punten.

**Doelgroep:** Senioren (65+) — bekende spelmechaniek (Scrabble/Wordfeud), geen tijdsdruk, duidelijke visuele feedback.

## 2. Bord

| Eigenschap | Waarde |
|------------|--------|
| Grootte | 15×15 vakjes |
| Interactie | Pinch-to-zoom + pan (bord past niet volledig op scherm) |
| Middenveld | Startpositie (eerste woord MOET door midden gaan) |
| Bonusvelden | DL, TL, DW, TW — random geplaatst per nieuw spel |
| Trivia-velden | 1-2 per spel, verborgen (pas zichtbaar bij woord leggen) |

### 2.1 Bonusveld Types

| Afkorting | Naam | Effect |
|-----------|------|--------|
| DL | Double Letter | Letterwaarde ×2 |
| TL | Triple Letter | Letterwaarde ×3 |
| DW | Double Word | Woordwaarde ×2 |
| TW | Triple Word | Woordwaarde ×3 |

### 2.2 Trivia-velden

- **Plaatsing:** Random, 1-2 per spel, verborgen tot een woord eroverheen wordt gelegd
- **Trigger:** Wanneer een speler een woord legt dat een trivia-veld raakt
- **Vraagbron:** Gedeelde vragenbank met de standalone Trivia game
- **Categorie:** Willekeurig (geen keuze)
- **Bonus/malus:** +10 goed / -10 fout (wordt opgeteld bij/afgetrokken van de woordscore)

## 3. Tegels

### 3.1 Rek (Rack)

- **Grootte:** 7 tegels per speler
- **Aanvullen:** Na elke beurt worden tegels aangevuld uit de zak tot maximaal 7

### 3.2 Blanco Tegels

- **Aantal:** 2 stuks in de zak
- **Punten:** 0 punten
- **Gebruik:** Kan als elke letter worden ingezet
- **Visueel:** Duidelijk herkenbaar als blanco (geen letter, ander ontwerp)

### 3.3 Letterwaarden (Universeel — Alle 13 Talen)

Vereenvoudigd systeem met range 1-5 (Woordy scoring):

| Letter | Waarde | | Letter | Waarde | | Letter | Waarde |
|--------|--------|-|--------|--------|-|--------|--------|
| A | 1 | | J | 2 | | S | 2 |
| B | 2 | | K | 2 | | T | 2 |
| C | 3 | | L | 2 | | U | 1 |
| D | 2 | | M | 2 | | V | 2 |
| E | 1 | | N | 2 | | W | 2 |
| F | 3 | | O | 1 | | X | 3 |
| G | 2 | | P | 2 | | Y | 5 |
| H | 2 | | Q | 5 | | Z | 3 |
| I | 1 | | R | 2 | | Blanco | 0 |

**Rationale:** Universele waarden voor alle 13 talen. Eenvoudiger te onthouden voor senioren, consistent ongeacht taalinstelling.

### 3.4 Letterdistributie

- **Per taal** — gebaseerd op letterfrequentie in die taal
- **Generatie:** Wordt berekend bij build-time op basis van Hunspell dictionary frequentieanalyse
- **Totaal:** ~100 tegels per spel (standaard Scrabble-achtig)

## 4. Woordvalidatie

### 4.1 Woordenlijst

| Eigenschap | Waarde |
|------------|--------|
| Bron | Hunspell dictionaries (wooorm/dictionaries via npm) |
| Talen | Alle 13 CommEazy-talen |
| Opslag | SQLite database per taal |
| Download | On-demand bij eerste gebruik (~10-15 sec, ~3-12MB per taal) |

### 4.2 Taal Bepaling

1. Volgt de app-taalinstelling (OS → Instellingen → automatisch)
2. Speler kan taal niet handmatig wijzigen per spel
3. Bij multiplayer: beide spelers MOETEN dezelfde taal hebben, anders foutmelding

### 4.3 Validatie Flow

1. Speler legt woord → tik "Bevestig"
2. Engine valideert woord tegen Hunspell dictionary
3. Geldig → score berekenen + tegels aanvullen
4. Ongeldig → foutmelding, tegels terug naar rek

## 5. Scoring

### 5.1 Basisscore

```
Woordscore = Σ (letterwaarde × lettermultiplier) × woordmultiplier
```

- **Lettermultiplier:** ×1 (normaal), ×2 (DL), ×3 (TL)
- **Woordmultiplier:** ×1 (normaal), ×2 (DW), ×3 (TW)
- Meerdere woordmultipliers op één woord worden vermenigvuldigd (DW + DW = ×4)

### 5.2 Bonussen

| Bonus | Voorwaarde | Punten |
|-------|-----------|--------|
| Eerste woord | Eerste woord van het spel (moet door middenveld) | +10 |
| Alle-7-tegels | Alle 7 tegels uit rek in één beurt gebruikt | +10 |
| Trivia goed | Trivia-vraag correct beantwoord | +10 |
| Trivia fout | Trivia-vraag fout beantwoord | -10 |

### 5.3 Einde Spel — Score Verrekening

Bij einde spel worden overgebleven tegels verrekend:
- Speler met tegels over: **aftrek** van totaal (som van resterende letterwaarden)
- Speler zonder tegels: **optelling** van tegenstander's resterende letterwaarden

## 6. Beurt-structuur

| Eigenschap | Waarde |
|------------|--------|
| Tijdslimiet | Geen (senioren mogen rustig nadenken) |
| Passen | Toegestaan (beurt overslaan) |
| Tegels ruilen | Toegestaan (selecteer tegels → ruil met zak, beurt voorbij) |
| Opgeven | Toegestaan (met bevestigingsdialoog) |

### 6.1 Beurt Opties

Per beurt kan een speler:
1. **Woord leggen** — Plaats tegels, bevestig → score + aanvullen
2. **Passen** — Sla beurt over (geen tegels gelegd of geruild)
3. **Tegels ruilen** — Selecteer 1-7 tegels → terug in zak → nieuwe tegels trekken (beurt voorbij)
4. **Opgeven** — Bevestigingsdialoog → spel eindigt (opgever verliest)

## 7. Einde Spel

Het spel eindigt wanneer:
1. **Tegels op** — De zak is leeg EN één speler heeft alle tegels gelegd
2. **Beide passen** — Beide spelers passen achtereenvolgens (2× passen op rij)
3. **Opgeven** — Een speler geeft op (bevestigingsdialoog)

Bij scenario 1 en 2: resterende tegels worden verrekend (zie 5.3).
Bij scenario 3: opgever verliest, geen verrekening.

## 8. Multiplayer

| Eigenschap | Waarde |
|------------|--------|
| Type | 1-op-1 (twee spelers) |
| Matchmaking | Invite-based via XMPP (geen random matching) |
| Vereiste | Beide spelers CommEazy-gebruikers |
| Taal | Zelfde taal vereist, foutmelding bij mismatch |
| Protocol | XMPP game stanzas (bestaande infrastructuur) |
| Offline | Asynchrone beurten — push notification bij beurt tegenstander |

## 9. Technische Implementatie

### 9.1 Bestanden (Te Maken)

```
src/
  engines/
    woordy/
      engine.ts           ← Game engine (bord, scoring, validatie)
      boardGenerator.ts   ← Random bord generatie (bonus + trivia velden)
      letterBag.ts        ← Tegel zak management per taal
      wordValidator.ts    ← Hunspell dictionary lookup (SQLite)
      scoring.ts          ← Score berekening met bonussen
      types.ts            ← TypeScript types voor Woordy
  screens/
    modules/
      WoordyScreen.tsx    ← Hoofd screen (menu + game)
  components/
    games/
      WoordyBoard.tsx     ← 15×15 bord met pinch-to-zoom
      WoordyTileRack.tsx  ← Speler's rek (7 tegels)
      WoordyTile.tsx      ← Individuele tegel component
      WoordyScoreboard.tsx ← Scorebord voor beide spelers
```

### 9.2 Bestaande Infrastructuur

| Component | Status | Locatie |
|-----------|--------|---------|
| Game session tracking | ✅ Bestaand | `useGameSession` hook |
| Game stats | ✅ Bestaand | `useGameStats` hook |
| WatermelonDB schema | ✅ v30 | `game_sessions` + `game_stats` tabellen |
| XMPP game protocol | ✅ Types | `sendGameStanza` is stub |
| GameLobbyScreen | ✅ Bestaand | Route toevoegen voor Woordy |
| GameOverModal | ✅ Bestaand | Herbruikbaar voor Woordy |
| GameHeader | ✅ Bestaand | Timer + actions |
| DifficultyPicker | ❌ Niet van toepassing | Woordy heeft geen moeilijkheidsgraad |

### 9.3 Dependencies (Te Installeren)

| Package | Doel | Grootte |
|---------|------|---------|
| `dictionary-nl` | Nederlands Hunspell dictionary | ~3MB |
| `dictionary-en` | Engels Hunspell dictionary | ~5MB |
| (per taal) | Alle 13 talen | ~3-12MB per stuk |

**Opmerking:** Dictionaries worden on-demand gedownload, niet gebundeld in de app.

### 9.4 Registratie Checklist

Bij implementatie MOETEN de volgende registraties worden uitgevoerd:

- [ ] `GameType` union type uitbreiden met `'woordy'`
- [ ] `ALL_GAME_TYPES` array uitbreiden
- [ ] GameLobbyScreen: route voor Woordy toevoegen
- [ ] i18n: `games.woordy.*` keys in alle 13 talen
- [ ] `navigation.woordy` key in alle 13 talen

## 10. UX Design Richtlijnen

### 10.1 Senior-Inclusive

| Aspect | Vereiste |
|--------|---------|
| Tegels | Groot genoeg om te lezen (min 44pt met letter + waarde) |
| Drag & drop | NIET gebruiken — senioren hebben moeite met drag. Gebruik tap-to-select + tap-to-place |
| Zoom | Pinch-to-zoom voor bord navigatie |
| Feedback | Haptic bij elke tegel plaatsing |
| Undo | Undo knop om laatst geplaatste tegel terug te nemen |
| Score | Realtime score preview bij woord leggen (vóór bevestiging) |

### 10.2 Interactie Flow

1. **Tegel selecteren:** Tap op tegel in rek → tegel licht op
2. **Tegel plaatsen:** Tap op bordvakje → tegel verplaatst
3. **Tegel terugnemen:** Tap op geplaatste tegel → terug naar rek
4. **Bevestigen:** Tap "Bevestig" knop → validatie + score
5. **Passen/Ruilen:** Via menu onder het bord

### 10.3 Visueel

- Bonusvelden: Duidelijke kleurcodering (DL=lichtblauw, TL=donkerblauw, DW=roze, TW=rood)
- Trivia-velden: Gouden accent (pas zichtbaar na ontdekking)
- Geplaatste tegels: Duidelijk onderscheid tussen eigen/tegenstander's tegels
- Lege vakjes: Subtiel raster, niet overweldigend

## 11. Beslissingen Samenvatting

| Onderwerp | Beslissing | Rationale |
|-----------|-----------|-----------|
| Bordgrootte 15×15 | Standaard Scrabble formaat | Herkenbaar voor senioren |
| Pinch-to-zoom | Bord past niet op scherm | 15×15 is te groot voor directe weergave |
| Tap i.p.v. drag | Senior-inclusive | Drag & drop is moeilijk voor senioren |
| Geen tijdslimiet | Senior-inclusive | Geen druk, rustig nadenken |
| Universele letterwaarden | Eenvoud | Zelfde waarden ongeacht taal |
| Vereenvoudigd (1-5) | Senior-inclusive | Makkelijker te onthouden dan Scrabble (1-10) |
| On-demand dictionaries | Bundle size | ~60-90MB aan dictionaries niet in app bundel |
| Trivia integratie | Uniek CommEazy element | Onderscheidt Woordy van andere woordspellen |
| +10 eerste woord | Motivatie | Beloont de openingsspeler |
| +10 alle-7-tegels | Motivatie | Beloont efficiënt gebruik van alle tegels |
| Geen power-ups | Eenvoud | Houdt het spel puur en herkenbaar |
| Geen thema-borden | Eenvoud | Één consistent bord ontwerp |
