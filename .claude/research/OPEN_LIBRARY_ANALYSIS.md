# Open Library + Internet Archive: Analyse voor CommEazy

**Datum:** 2026-02-18
**Status:** Onderzoek afgerond, uitgesteld voor latere implementatie

## Samenvatting

Open Library biedt een veel grotere catalogus (20M+ boeken) dan Gutenberg (70K), maar de integratie is complex vanwege DRM-beperkingen en het ontbreken van plain text toegang.

---

## Wat Open Library biedt

| Aspect | Details |
|--------|---------|
| **Catalogus** | 20+ miljoen boeken |
| **Talen** | 13+ talen (inclusief NL, DE, FR, ES) |
| **Gratis boeken** | "Full access" - direct leesbaar, geen account |
| **Leenbare boeken** | Moderne boeken, max 14 dagen, account vereist |
| **Formaten** | BookReader (web), EPUB, PDF |
| **Plain text** | ❌ **NIET beschikbaar** via API |
| **Rate limits** | 3 req/sec met User-Agent, anders 1 req/sec |

## Het Kernprobleem: Geen Plain Text

**Open Library geeft GEEN toegang tot plain text.** De API levert:
- Metadata (titel, auteur, cover)
- Links naar scans op Archive.org (afbeeldingen)
- Links naar EPUB/PDF downloads (met DRM voor leenbare boeken)

Voor TTS-voorlezen hebben we plain text nodig. Open Library biedt dit niet.

## Wat nodig is voor integratie

### Gebruiker moet:
1. Internet Archive account aanmaken (gratis)
2. Inloggen in CommEazy met IA-credentials
3. Boek "lenen" (max 10 tegelijk, 14 dagen)
4. Boek "teruggeven" na lezen
5. Wachtlijst accepteren bij populaire boeken

### Technisch nodig:
1. EPUB parser implementeren (zip + XML parsing)
2. OAuth/session management voor IA accounts
3. DRM handling (Adobe DRM voor leenbare boeken?)
4. Loan state management (active loans, expiry dates)
5. Wachtlijst notificaties
6. Complexere UX (lenen/teruggeven/verlengen)

## Tijdsinschatting

| Component | Complexiteit | Geschatte effort |
|-----------|--------------|------------------|
| Open Library Search API | Laag | 1-2 dagen |
| EPUB parser (epub.js of eigen) | Middel | 2-3 dagen |
| IA Account integratie | Hoog | 3-5 dagen |
| Loan management | Middel | 2-3 dagen |
| DRM handling (indien vereist) | **Zeer hoog** | 5-10 dagen of onmogelijk |
| UX voor lending flow | Middel | 2-3 dagen |
| Testing & edge cases | Middel | 2-3 dagen |
| **Totaal** | | **17-29 dagen** |

## DRM: De Showstopper

Leenbare boeken van Open Library gebruiken **Adobe DRM** of een vergelijkbare bescherming. Dit betekent:
- Je kunt de tekst niet zomaar extracten voor TTS
- DRM-ontsleuteling is illegaal in veel landen
- Adobe Digital Editions SDK is niet beschikbaar voor React Native

## Aanbeveling

**Alleen "Full Access" boeken** zijn realistisch integreerbaar:
- Geen account vereist
- Geen DRM
- Direct beschikbaar

Dit zijn echter grotendeels **dezelfde publiek domein boeken als Gutenberg**, maar met betere metadata en covers.

## Mogelijke Toekomstige Aanpak

### Optie 1: Hybrid Model
- Gutenberg voor TTS (plain text)
- Open Library voor zoeken + metadata + covers
- Link naar Open Library website voor moderne boeken ("Lees dit boek op openlibrary.org")

### Optie 2: Alleen Zoeken Verbeteren
- Open Library Search API voor discovery
- Filter op `ebook_access: "public"`
- Download plain text van Gutenberg/Archive.org waar beschikbaar

## API Referenties

- [Open Library APIs](https://openlibrary.org/developers/api)
- [Open Library Read API](https://openlibrary.org/dev/docs/api/read)
- [Open Library Books API](https://openlibrary.org/dev/docs/api/books)
- [Open Library Search API](https://openlibrary.org/dev/docs/api/search)
- [Open Library Borrowing FAQ](https://openlibrary.org/help/faq/borrow)

## Besluit

**Voorlopig blijven we bij Gutenberg** vanwege:
1. TTS-compatibiliteit (plain text beschikbaar)
2. Geen accounts nodig (senior-friendly)
3. Geen wachtlijsten
4. Eenvoudigere UX
5. Privacy (geen tracking)

Open Library integratie wordt heroverwogen wanneer:
- EPUB parsing stabiel is geïmplementeerd
- Er vraag is van gebruikers naar moderne boeken
- DRM-vrije toegang tot tekst beschikbaar komt
