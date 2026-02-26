# Universal Presence System

## Status: IMPLEMENTATIE GESTART

## Samenvatting

Universeel presence-systeem dat online status van contacten consistent toont across alle modules. ContactAvatar wordt uitgebreid met een presence-stip (groen/oranje/grijs ring). Presence data wordt losgekoppeld van chatService naar een dedicated PresenceContext.

## Ontwerp Specificaties

### Visuele States (3 states, niet 6)

XMPP definieert 6 statussen, maar senioren begrijpen het verschil niet tussen xa, dnd en away. Vereenvoudigd naar 3 visuele states:

| Visuele State | XMPP Mapping | Stip Stijl | Kleur | VoiceOver |
|---------------|-------------|------------|-------|-----------|
| **Online** | `available`, `chat` | Gevulde cirkel | #68C414 (groen) | "online" |
| **Even weg** | `away`, `xa`, `dnd` | Gevulde cirkel | #FF8F35 (oranje) | "even weg" |
| **Niet online** | `offline` | Open ring (outline) | #A4A4A4 (grijs) | "niet online" |

### Waarom GEEN rood voor offline

- Rood = alarm/gevaar/fout voor senioren → creëert onnodig angstgevoel
- Offline ≠ "stop" — je KAN nog steeds berichten sturen naar offline gebruikers
- Industriestandaard: WhatsApp, iMessage gebruiken geen rood voor offline
- Teams gebruikt rood alleen voor actieve DND, niet passieve offline
- Open ring (outline) = neutraal "niet actief" zonder negativiteit

### Component: ContactAvatar + Presence Stip

```
┌──────────┐
│          │
│  Avatar  │
│  (foto/  │
│  letter) │
│        ●─┤  ← Presence stip (bottom-right)
└──────────┘
```

**Stip specificaties:**
- Diameter: 30% van avatar diameter (bijv. 18px bij 60px avatar)
- Positie: bottom-right, overlap met avatar edge
- Witte border: 2-3pt (scheidt stip visueel van avatar)
- Online/away: gevulde cirkel
- Offline: open ring (outline only, geen fill)

### Architectuur

```
PresenceContext (NIEUW)
  ├── usePresence(jid) → PresenceShow
  ├── useVisualPresence(jid) → { color, isRing, a11yLabel }
  └── subscribeToPresence() → verbindt met chatService.onPresenceChange()

ChatService (BESTAAND — wordt proxy)
  ├── presenceMap → BLIJFT (bron van waarheid)
  ├── handlePresenceUpdate() → BLIJFT (XMPP updates)
  ├── onPresenceChange() → BLIJFT (raw events)
  └── getContactPresence() → BLIJFT (lookup)

ContactAvatar (UITGEBREID)
  └── presenceStatus?: PresenceShow → toont stip als meegegeven
```

### Schermen die Presence Tonen

| Scherm | Huidig | Nieuw |
|--------|--------|-------|
| ChatListScreen | PresenceIndicator (56px cirkel) | ContactAvatar + presence stip |
| CallsScreen | MOCK presence (hardcoded) | ContactAvatar + echt presence via usePresence |
| ContactListScreen | Geen presence | ContactAvatar + presence stip |
| ChatScreen header | Geen presence | Presence stip + status tekst |

### i18n Keys (NIEUW)

```json
{
  "presence": {
    "online": "Online",
    "away": "Even weg",
    "offline": "Niet online",
    "a11y": {
      "online": "{{name}}, online",
      "away": "{{name}}, even weg",
      "offline": "{{name}}, niet online"
    }
  }
}
```

### Technische Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/contexts/PresenceContext.tsx` | **NIEUW** — React Context die subscribe op chatService presence events |
| `src/contexts/index.ts` | Export PresenceProvider, usePresence, useVisualPresence |
| `src/components/ContactAvatar.tsx` | **WIJZIG** — Voeg `presenceStatus` prop toe met overlay stip |
| `src/screens/chat/ChatListScreen.tsx` | **WIJZIG** — Vervang PresenceIndicator door ContactAvatar met presence |
| `src/screens/modules/CallsScreen.tsx` | **WIJZIG** — Vervang mock presence door usePresence hook |
| `src/screens/contacts/ContactListScreen.tsx` | **WIJZIG** — Voeg presence toe aan ContactAvatar |
| `src/screens/chat/ChatScreen.tsx` | **WIJZIG** — Voeg presence toe in header |
| `src/locales/*.json` (13 bestanden) | **WIJZIG** — Voeg presence keys toe |
| `src/theme/index.ts` | **WIJZIG** — Vereenvoudig presence kleuren (xa/dnd → away mapping) |
| `src/theme/darkColors.ts` | **WIJZIG** — Idem |

### Cleanup (na migratie)

| Bestand | Actie |
|---------|-------|
| `src/components/PresenceIndicator.tsx` | **VERWIJDER** — vervangen door ContactAvatar presence stip |
| `src/components/index.ts` | Verwijder PresenceIndicator export |

### Beslissingen

| Aspect | Beslissing |
|--------|-----------|
| **chatService.presenceMap** | BLIJFT in chatService — het is de bron van XMPP data |
| **PresenceContext** | Wrapped/proxy op chatService, geen duplicatie van data |
| **6→3 mapping** | available/chat → online, away/xa/dnd → away, offline → offline |
| **Stip kleur rood** | NEE — grijs open ring voor offline (geen alarm gevoel) |
| **Stip grootte** | 30% van avatar diameter |
| **White border** | 2-3pt rond stip |
| **VoiceOver** | Leest "Maria, online" / "Maria, even weg" / "Maria, niet online" |

---

*Ontwerp voltooid via PNA sessie op 2026-02-26. Implementatie gestart.*
