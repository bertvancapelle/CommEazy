# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-23
- **Sessie:** Trust & Attestation Plan — Nearby Contact Wizard + Universal Links + PNA beslissingen
- **Commit:** (wordt bijgewerkt na push)

## Voltooide Taken Deze Sessie

1. **TRUST_AND_ATTESTATION_PLAN.md volledig bijgewerkt met PNA beslissingen**
   - **Sectie 2.1:** Volledig herschreven — "In de buurt" is nu een 6-stappen Nearby Contact Wizard
   - **Sectie 2.2:** Invitation code format geüpdated naar CE-XXXX-XXXX-XXXX (12 chars, 30^12 entropie)
   - **Sectie 2.5:** NIEUW — Universal Links / commeazy.com configuratie (iOS + Android)
   - **Sectie 4.2:** Contact Toevoegen UI bijgewerkt met wizard referenties en trust level resultaten
   - **Sectie 5.2:** Trust Levels herschreven — Level 2 volledig functioneel (incl video calls), Level 3 via video call verificatie
   - **Sectie 6.1:** Bestandsstructuur uitgebreid met NearbyContactWizard, deepLinking service, web/ folder
   - **Sectie 6.4:** Code generator geüpdated naar 12-char format + URL helpers (generateInvitationUrl, extractCodeFromUrl)
   - **Sectie 7:** i18n keys volledig herschreven — 30+ wizard-specifieke keys toegevoegd
   - **Sectie 8:** Implementatiefasen uitgebreid van 5 naar 6 fasen (nieuwe Fase 3: Universal Links)
   - **Sectie 9:** Pre-Productie Checklist gereorganiseerd in 4 categorieën (Server/commeazy.com/App/Quality)
   - **Sectie 10:** NIEUW — PNA Beslissingen Log (11 beslissingen met datums en rationale)
   - **Sectie 11:** Referenties uitgebreid met Universal Links, App Links, Argon2id docs

## Openstaande Taken

1. **Uncommitted changes:** `MediaIndicator.tsx` (1 regel) + `AppleMusicScreen.tsx` (grote refactor) — niet gerelateerd, apart committen.
2. **Bluetooth media controls** — Hardware play/pause/next/prev knoppen. Nooit geïmplementeerd.
3. **Glass Player flickering** — Bottom + right side flicker. Separate issue.
4. **SongCollectionModal uitbreiding** — Bulk album toevoegen was in PNA ontwerp maar nog niet geïmplementeerd.

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

Geen — alle PNA beslissingen zijn vastgelegd in TRUST_AND_ATTESTATION_PLAN.md sectie 10.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Camera app scant QR (geen in-app scanner) | Senioren kennen Camera QR van COVID-era, minder code, minder permissions |
| commeazy.com domein bevestigd | Universal Links (iOS) + App Links (Android) voor QR-code scanning |
| Twee QR-codes in wizard (download + invite) | Elk doel apart: app installatie vs key exchange |
| Echo bij video call test is OK | 5-10 sec test, senioren verwachten echo naast elkaar |
| Eenzijdige verificatie voldoende | Elk device beheert eigen trust levels onafhankelijk |
| Level 2 = volledig functioneel | Berichten, foto's, video calls — geen blokkade bij relay-verbonden contacten |
| Level 3 via video call (niet alleen QR) | Praktischer voor senioren — video call is al een bewezen interactie |
| Invitation code CE-XXXX-XXXX-XXXX (12 chars) | 30^12 entropie, voldoende veilig met rate limiting |

## Context voor Volgende Sessie

- **TRUST_AND_ATTESTATION_PLAN.md** is nu het complete referentiedocument voor alle contact/trust/invitation functionaliteit
- **Volgende implementatiestap:** Fase 1 (API Gateway + Attestation) of Fase 2 (Invitation Relay + Crypto) — afhankelijk van gebruikersprioriteit
- **commeazy.com domein:** Moet nog geconfigureerd worden (DNS, HTTPS, well-known files)
- **Uncommitted werk:** `MediaIndicator.tsx` + `AppleMusicScreen.tsx` — apart committen
- **Audio Orchestrator:** `src/contexts/AudioOrchestratorContext.tsx` — centraal punt
- **Glass Player flicker:** `GlassPlayerWindow/MiniPlayerNativeView.swift` + `FullPlayerNativeView.swift`
