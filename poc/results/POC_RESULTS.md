# CommEazy PoC Results — Technology Comparison

**Datum:** 2026-02-07
**Door:** Claude (AI-assisted architecture analysis)

---

## 1. XMPP Library: xmpp.js vs Strophe.js

### Score: xmpp.js 6 — Strophe.js 0

| Criterium | xmpp.js (@xmpp/client) | Strophe.js | Winnaar |
|-----------|------------------------|------------|---------|
| **API ergonomie** | async/await, typed events | Callback-based, magic numbers | xmpp.js |
| **TypeScript** | Native (geschreven in TS) | @types/strophe.js (community) | xmpp.js |
| **Reconnection** | Built-in + Stream Management | Handmatig (~20 regels) | xmpp.js |
| **MUC support** | Consistent API, geen plugins | Aparte plugin, andere API | xmpp.js |
| **Bundle size** | 720KB (package) | 1.16MB (package) | xmpp.js |
| **Onderhoud** | Actief, 2-3 maintainers | v4.0 RC al >1 jaar, 1-2 maint. | xmpp.js |

### Risico's xmpp.js
- 0.x versioning → API kan breken (mitigatie: pin version + abstractielaag)
- Kleinere community dan Strophe (mitigatie: goede documentatie)
- React Native polyfills nodig (mitigatie: vroeg testen op device)

### Aanbeveling
**→ Gebruik xmpp.js met XMPPService abstractielaag**

---

## 2. Database: WatermelonDB vs Realm

### Score: WatermelonDB 5 — Realm 2

| Criterium | WatermelonDB | Realm | Winnaar |
|-----------|-------------|-------|---------|
| **Vendor lock-in** | Geen (SQLite, MIT) | MongoDB-eigendom | WatermelonDB |
| **Onderhoud** | Actief, stabiel | SDK deprecated → Atlas SDK | WatermelonDB |
| **Reactive/Observable** | RxJS observables | Realm listeners | Gelijk |
| **Read performance** | Lazy loading (goed) | Zero-copy (marginaal sneller) | Realm |
| **Encrypted storage** | SQLCipher (standaard) | Eigen formaat | WatermelonDB |
| **Bundle size** | ~1.5MB | ~4MB | WatermelonDB |
| **Data export** | SQLite → universeel | Binair, niet exporteerbaar | WatermelonDB |

### Aanbeveling
**→ Gebruik WatermelonDB met DatabaseService abstractielaag**

---

## 3. Encryption: Dual-Path Benchmark (libsodium)

### Benchmark resultaten (server, ~5x sneller dan iPhone SE)

```
=== ENCRYPT-TO-ALL vs SHARED-KEY ===

Members | E2A Text | SK Text | E2A 1MB Photo | SK 1MB Photo | E2A Payload | SK Payload
--------|----------|---------|---------------|--------------|-------------|----------
   1    |  0.39ms  | 0.62ms  |     5.12ms    |    4.01ms    |    1.0MB    |   1.0MB
   5    |  1.61ms  | 2.24ms  |    20.39ms    |    6.42ms    |    5.0MB    |   1.0MB
   8    |  2.84ms  | 2.77ms  |    34.20ms    |    5.75ms    |    8.0MB    |   1.0MB
  15    |  4.45ms  | 4.33ms  |    58.17ms    |    9.31ms    |   15.0MB    |   1.0MB
  30    |  8.22ms  | 9.38ms  |   113.20ms    |   11.69ms    |   30.0MB    |   1.0MB
```

### iPhone SE geschatte performance (5x multiplier)

| Scenario | Encrypt-to-All | Shared-Key |
|----------|---------------|------------|
| 8 leden, tekst | ~14ms | ~14ms |
| 8 leden, 1MB foto | ~171ms | ~29ms |
| 30 leden, tekst | ~41ms | ~47ms |
| 30 leden, 1MB foto | **~566ms** ⚠️ | ~58ms ✓ |
| 30 leden, foto payload | **30.0MB** ⛔ | **1.0MB** ✓ |

### Conclusie
**Threshold 8 is correct:**
- Tekst: encrypt-to-all performant tot ~20 leden (eenvoudigere code)
- Media: shared-key essentieel boven 3 leden (30MB → 1MB payload bij 30 leden)
- De code-complexiteit van dual-path is gerechtvaardigd door de bandwidth-besparing

---

## 4. Samenvattende aanbeveling

| Component | Keuze | Reden |
|-----------|-------|-------|
| XMPP Client | **xmpp.js** | Native TS, async/await, built-in reconnect |
| Database | **WatermelonDB** | Geen vendor lock-in, SQLite standaard |
| Encryption | **libsodium, dual-path (threshold 8)** | Bewezen door benchmark |
| Abstractielaag | **VERPLICHT** | XMPPService + DatabaseService interfaces |

### Volgende stap
De project-scaffold bevat beide abstractielagen, de xmpp.js implementatie als default, en een WatermelonDB schema. Als je later wilt switchen, verander je alleen de implementatie-klasse — de rest van de codebase blijft onaangeroerd.
