# CommEazy PoC: WatermelonDB vs Realm

## Wat dit benchmarkt

Deze PoC vergelijkt WatermelonDB en Realm op de metrics die voor CommEazy het meest tellen.
De benchmark scripts zijn ontworpen om op een echt React Native device te draaien (iPhone SE + budget Android).

## Meetpunten

| # | Metric | Waarom relevant | Doel |
|---|--------|-----------------|------|
| 1 | **Cold start** | App launch tijd | < 3s inclusief DB init |
| 2 | **Write latency** | Bericht opslaan | < 50ms per bericht |
| 3 | **Batch write** | Offline sync (100+ berichten) | < 500ms batch |
| 4 | **Query latency** | Chat openen (50 berichten laden) | < 100ms |
| 5 | **Observable/reactive** | Realtime chat UI updates | < 16ms (60fps) |
| 6 | **Encrypted storage** | Privacy vereiste | Ja, transparant |
| 7 | **Bundle size impact** | Store compliance | < 2MB overhead |
| 8 | **Memory footprint** | iPhone SE (3GB RAM) | < 50MB DB-gerelateerd |

## Hoe te draaien

```bash
# Na React Native project setup:
npx react-native run-ios --scheme CommEazy-PoC
# Open PoC scherm via dev menu → "Database Benchmark"
```

## Beoordeling

### WatermelonDB — Aanbevolen ✓

**Voordelen:**
- SQLite-based → geen vendor lock-in, data altijd exporteerbaar
- Lazy loading → alleen laden wat je nodig hebt (snel bij grote datasets)
- Observables via RxJS → native reactief, past bij chat UI patroon
- Community maintained, MIT licentie
- Encrypted storage via SQLCipher (react-native-quick-sqlite)
- Offline-first by design

**Nadelen:**
- Schema migraties vereisen handmatige code
- Minder "out of the box" sync dan Realm (maar wij syncen niet naar cloud)
- Iets meer boilerplate dan Realm voor model definities

### Realm — Niet aanbevolen

**Voordelen:**
- Zero-copy reads → snelste reads van alle opties
- Simpele API, minder boilerplate
- Automatische schema migraties (simpele cases)

**Nadelen:**
- **MongoDB eigendom** → vendor lock-in risico
- **Realm SDK deprecated** → Atlas Device SDK is opvolger, onduidelijke roadmap
- Realm files zijn binair, niet exporteerbaar naar ander formaat
- React Native Realm hermes-engine problemen gerapporteerd
- Encrypted storage via eigen formaat (niet SQLCipher standaard)
- Groter bundle size (~4MB vs ~1.5MB WatermelonDB)

### Conclusie

WatermelonDB wint op **strategische gronden** (geen vendor lock-in, open standaard SQLite, actief onderhouden) en op **architecturele gronden** (lazy loading past bij chat-patroon, observables passen bij reactieve UI). Realm is marginaal sneller op reads, maar dat verschil is verwaarloosbaar voor CommEazy's use case (max ~1000 berichten per chat in view).

**KRITISCH:** Ongeacht keuze, bouw altijd de `DatabaseService` abstractielaag (zie `src/services/interfaces/database.ts`).
