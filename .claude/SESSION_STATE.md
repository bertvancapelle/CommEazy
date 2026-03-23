# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-23
- **Sessie:** Green Ring + Skill Coordination Upgrade (Ruflo-geïnspireerd)
- **Commit:** `03c6c4f`

## Voltooide Taken Deze Sessie

1. **Green ring voor CommEazy contacten (trustLevel ≥ 2)**
   - `ContactAvatar.tsx`: 3pt groene ring (`colors.presenceAvailable`) bij trustLevel ≥ 2
   - `trustLevel` prop doorgegeven in 5 consumer screens (ContactList, ContactDetail, Calls, CreateGroup, EditGroup)

2. **DevModePanel test contacten**
   - 4 test contacten met variërende trust levels (0, 1, 2, 3)
   - `database.ts`: `saveContact` slaat nu `mobileNumber` en `addressProvince` op

3. **Skill Coordination Upgrade — Model C (Ruflo-geïnspireerd)**
   - **DECISION_PATTERNS.md** (NIEUW): Bewezen ontwerppatronen met context, beslissing, rationale, senior-toets, sessies, contra-indicatie. 11 patronen vastgelegd.
   - **SKILL_DOMAINS.md** (NIEUW): 5 domeinen (UX, Platform, Security, Content, Protocol) als escalatielaag. Model C: Matrix primary → Domein escalatie → Gebruiker beslist.
   - **CHANGE_VALIDATION_MATRIX.md**: File-Pattern Hooks sectie toegevoegd (8 categorieën, 16 patterns incl. 3 BLOKKEERDER combinaties)
   - **COORDINATION_PROTOCOL.md**: Tier 2 en Tier 3 workflows bijgewerkt met DECISION_PATTERNS.md check en domein-escalatie stap. Referenties uitgebreid.

## Openstaande Taken

1. **Uncommitted changes:** `MediaIndicator.tsx` (1 regel) + `AppleMusicScreen.tsx` (grote refactor) — niet gerelateerd, apart committen.
2. **Bluetooth media controls** — Hardware play/pause/next/prev knoppen. Nooit geïmplementeerd.
3. **Glass Player flickering** — Bottom + right side flicker. Separate issue.
4. **SongCollectionModal uitbreiding** — Bulk album toevoegen was in PNA ontwerp maar nog niet geïmplementeerd.
5. **ChatListScreen green ring** — Zou DB query nodig hebben voor trustLevel, uitgesteld.

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

Geen — alle beslissingen zijn geïmplementeerd.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Model C voor skill coördinatie | Matrix primary → Domeinen escaleren unknowns → Gebruiker beslist. Geen kennisrisco. |
| DECISION_PATTERNS.md als leergeheugen | Voorkomt dat bewezen beslissingen elke sessie opnieuw worden gemaakt |
| 5 Skill Domeinen (niet lossy hiërarchie) | Domeinen vervangen matrix NIET, ze zijn alleen een vangnet voor edge cases |
| File-Pattern Hooks naast beschrijving-triggers | Automatische skill-activatie op basis van bestandspad, complement op bestaande matrix |
| Consensus algoritmes NIET geadopteerd | Bestaande Conflict Resolutie Hiërarchie is voldoende |
| Impact Score Matrix uitgesteld | Geen directe meerwaarde, te complex voor huidige schaal |
| Green ring bij trustLevel ≥ 2 | Visuele differentiatie CommEazy contacten vs externe contacten |

## Context voor Volgende Sessie

- **Skill coördinatie documenten:** `DECISION_PATTERNS.md`, `SKILL_DOMAINS.md`, `CHANGE_VALIDATION_MATRIX.md` (File-Pattern Hooks), `COORDINATION_PROTOCOL.md` (bijgewerkte workflows)
- **Model C routing:** CHANGE_VALIDATION_MATRIX → (onvolledig?) → SKILL_DOMAINS → (vraag) → gebruiker beslist
- **Uncommitted werk:** `MediaIndicator.tsx` + `AppleMusicScreen.tsx` — apart committen
- **Audio Orchestrator:** `src/contexts/AudioOrchestratorContext.tsx` — centraal punt
- **Glass Player flicker:** `GlassPlayerWindow/MiniPlayerNativeView.swift` + `FullPlayerNativeView.swift`
- **TRUST_AND_ATTESTATION_PLAN.md:** Compleet referentiedocument voor contact/trust/invitation functionaliteit
