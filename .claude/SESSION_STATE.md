# Session State — CommEazy

> **Dit bestand wordt bijgewerkt bij elke commit+push.**
> Nieuwe Claude-sessies MOETEN dit bestand EERST lezen om context van de vorige sessie op te pikken.

## Laatste Update

- **Datum:** 2026-03-25
- **Sessie:** Form Field Styling documentatie update + hook-based label/field styling
- **Commit:** `f07469d`

## Voltooide Taken Deze Sessie

1. **useLabelStyle + useFieldTextStyle op 6 formulier-schermen** (commit `bb9e9f9`)
   - ProfileSettingsScreen, ContactDetailScreen, ManualAddContactScreen, AgendaItemFormScreen, MailComposeScreen, ProfileStep1Screen
   - Labels volgen nu `FieldTextStyleContext` (kleur, fontWeight, fontStyle)
   - Veldteksten volgen nu `FieldTextStyleContext`

2. **Borders op view-mode velden + labelStyle/fieldTextStyle op ContactDetailScreen** (commit `d3316ed`)
   - ProfileSettingsScreen: readOnlyValue style met borders in view mode
   - ContactDetailScreen: useLabelStyle + useFieldTextStyle + borders
   - Issue 2 (field styling/borders in view mode) OPGELOST

3. **CLAUDE.md Form Field Styling sectie bijgewerkt** (commit `f07469d`)
   - Regel 3: "Labels always bold" → "Labels volgen instellingen" (useLabelStyle())
   - Regel 5: "Bordered interactive elements" → "Bordered elements (edit EN view mode)"
   - NIEUW Regel 7: veldteksten volgen instellingen (useFieldTextStyle())
   - NIEUW Regel 8: hooks VERPLICHT op alle formulier-schermen
   - Alle code voorbeelden bijgewerkt met volledige hook patterns + JSX usage
   - Nieuw read-only/view-mode voorbeeld met borders
   - BLOKKEERDER rij toegevoegd in Automatische Triggers tabel

4. **Vorige sessies (behouden context):**
   - PanelAwareModal panelId 'main' fix (commit `815b605`)
   - PanelAwareModal effectiveTransparent fix (commit `46dec4c`)
   - DateTimePickerModal compact bottom-sheet (commit `46dec4c`)
   - Shared ColorPickerModal component (commit `9377ec6`)
   - Required field validation op ProfileSettingsScreen (commit `ffb2789`)
   - Date picker timezone off-by-one fix
   - ProfileSettings cursor jumping fix (getIsDirty useCallback)
   - View/Edit mode op ProfileSettingsScreen
   - ContactAvatar uniform — presence + badge on ALL 12 consumer screens

## Openstaande Taken

1. **Uncommitted changes:** `MediaIndicator.tsx` (1 regel) + `AppleMusicScreen.tsx` (grote refactor) — niet gerelateerd, apart committen.
2. **Bluetooth media controls** — Hardware play/pause/next/prev knoppen. Nooit geimplementeerd.
3. **Glass Player flickering** — Bottom + right side flicker. Separate issue.
4. **SongCollectionModal uitbreiding** — Bulk album toevoegen was in PNA ontwerp maar nog niet geimplementeerd.

## Lopende PNA-Conclusies (Nog Niet Geimplementeerd)

Geen — alle beslissingen zijn geimplementeerd.

## Relevante Beslissingen Deze Sessie

| Beslissing | Rationale |
|------------|-----------|
| Regel 3 vervangen (niet augmenteren) | Hardcoded `fontWeight: '700'` in documentatie contradiceerde het hook-based systeem. StyleSheet behoudt fallback, inline style van hook overschrijft. |
| Regel 5 uitbreiden naar view mode | Borders in view mode geven visuele consistentie en structuur voor senioren, ongeacht edit/view status. |
| Volledige hook voorbeelden in CLAUDE.md | Compacte referenties zouden niet duidelijk genoeg zijn — volledige JSX usage voorkomt fouten bij nieuwe sessies. |
| BLOKKEERDER in Automatische Triggers | Zonder blokkeerder worden hooks vergeten op nieuwe formulier-schermen, waardoor gebruikersinstellingen genegeerd worden. |

## Context voor Volgende Sessie

- **Form Field Styling:** 8 regels in CLAUDE.md (was 6). Hooks `useLabelStyle()` + `useFieldTextStyle()` uit `FieldTextStyleContext` zijn VERPLICHT op alle formulier-schermen.
- **Geadopteerde schermen:** ProfileSettingsScreen, ContactDetailScreen, ManualAddContactScreen, AgendaItemFormScreen, MailComposeScreen, ProfileStep1Screen — allemaal met hooks + borders
- **PanelAwareModal:** Twee fixes actief: (1) `panelId !== 'main'` check op regel 62, (2) `effectiveTransparent` logica op regel 71
- **UnifiedFullPlayer:** `isInPanel` check op regel 193 — `panelId !== null && panelId !== 'main'`
- **DateTimePickerModal:** `src/components/DateTimePickerModal.tsx` — compact bottom-sheet, module color overlay, solid surface. 13 consumers ongewijzigd.
- **ColorPickerModal:** `src/components/ColorPickerModal.tsx` — pageSheet + LiquidGlassView. 7 consumers.
- **ContactAvatar is uniform** — presence + badge on ALL 12 consumer screens
- **Uncommitted werk:** `MediaIndicator.tsx` + `AppleMusicScreen.tsx` — apart committen
- **Glass Player flicker:** `GlassPlayerWindow/MiniPlayerNativeView.swift` + `FullPlayerNativeView.swift`
