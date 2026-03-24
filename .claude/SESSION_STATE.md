# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-24
- **Sessie:** ContactAvatar Indicator Uniformization (presence + trustLevel across ALL screens)
- **Commit:** `b20bd83`

## Voltooide Taken Deze Sessie

1. **Phone number field cleanup** (commit `b8c01e8`)
   - Removed dead `phoneNumber` from UserProfile interface
   - Renamed Contact's `phoneNumber` → `landlineNumber`
   - Schema v28→v29 with migration

2. **Replace green ring with CommEazy badge dot** (commit `94c27bb`)
   - Top-left filled green circle (30% of avatar diameter) replaces ring overlay
   - Shows for trustLevel ≥ 2

3. **Uniformize ContactAvatar indicators across ALL 11 screens** (commit `b20bd83`)
   - **Zero exceptions** — every ContactAvatar now shows both presence dots AND CommEazy badge
   - Pattern: wrapper components per screen that call `useVisualPresence(jid)` + pass trustLevel
   - Files modified:
     - `ChatListScreen.tsx`: Added trustLevel to ChatListItem, ChatContactAvatar wrapper
     - `ContactDetailScreen.tsx`: Added presence via useVisualPresence hook
     - `CreateGroupModal.tsx`: Added GroupContactAvatar wrapper
     - `EditGroupModal.tsx`: Added GroupContactAvatar wrapper
     - `PhotoRecipientModal.tsx`: Added RecipientContactAvatar wrapper + fixed photoUrl prop
     - `ContactSelectionModal.tsx`: Added SelectionContactAvatar wrapper + fixed photoUrl prop
     - `AgendaItemDetailScreen.tsx`: Added ShareContactAvatar wrapper
     - `IncomingCallScreen.tsx`: Added CallContactAvatar wrapper + DB lookup for trustLevel
     - `ActiveCallScreen.tsx`: Added CallContactAvatar wrapper + DB lookup for trustLevel
     - `SettingsMainScreen.tsx`: Added own presence + trustLevel=3 (always CommEazy user)
     - `ProfileSettingsScreen.tsx`: Added ConsentContactAvatar wrapper + DB lookup for trustLevel
   - Also fixed incorrect prop names: `photoUri={contact.avatarUrl}` → `photoUrl={contact.photoUrl}` in PhotoRecipientModal and ContactSelectionModal

## Openstaande Taken

1. **Uncommitted changes:** `MediaIndicator.tsx` (1 regel) + `AppleMusicScreen.tsx` (grote refactor) — niet gerelateerd, apart committen.
2. **Bluetooth media controls** — Hardware play/pause/next/prev knoppen. Nooit geïmplementeerd.
3. **Glass Player flickering** — Bottom + right side flicker. Separate issue.
4. **SongCollectionModal uitbreiding** — Bulk album toevoegen was in PNA ontwerp maar nog niet geïmplementeerd.

## Lopende PNA-Conclusies (Nog Niet Geïmplementeerd)

Geen — alle beslissingen zijn geïmplementeerd.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Zero exceptions for ContactAvatar indicators | User explicit: "nergens uitsluitingen, ook niet voor eigen profiel of inkomende calls" |
| Wrapper component pattern for presence | Hooks can't be called in .map() callbacks — each list item needs its own component |
| DB lookup for trustLevel in call screens | CallParticipant interface lacks trustLevel — requires ServiceContainer.database.getContact() |
| User's own trustLevel hardcoded to 3 | User is always a CommEazy user, effectively trustLevel 3 |
| photoUrl prop fix in modals | photoUri/avatarUrl were incorrect prop names — fixed to match ContactAvatar's actual photoUrl prop |

## Context voor Volgende Sessie

- **ContactAvatar is now uniform** — presence + badge on ALL 11 consumer screens
- **Wrapper component naming convention:** ChatContactAvatar, GroupContactAvatar, RecipientContactAvatar, SelectionContactAvatar, ShareContactAvatar, CallContactAvatar, ConsentContactAvatar
- **Uncommitted werk:** `MediaIndicator.tsx` + `AppleMusicScreen.tsx` — apart committen
- **Audio Orchestrator:** `src/contexts/AudioOrchestratorContext.tsx` — centraal punt
- **Glass Player flicker:** `GlassPlayerWindow/MiniPlayerNativeView.swift` + `FullPlayerNativeView.swift`
- **TRUST_AND_ATTESTATION_PLAN.md:** Compleet referentiedocument voor contact/trust/invitation functionaliteit
