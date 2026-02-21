# CommEazy — TODO Aandachtspunten

Dit bestand bevat aandachtspunten en overwegingen voor toekomstige ontwikkeling die dieper doordacht moeten worden.

---

## 1. Voice Command TTS Ondersteuning (App-breed)

**Status:** Te onderzoeken
**Datum toegevoegd:** 2026-02-21

### Context

Momenteel heeft de Weather module TTS-voorleesfunctionaliteit via UI-knoppen (speaker icons), maar er zijn geen voice commands om deze TTS te triggeren. Dit zou moeten gelden voor de gehele app.

### Huidige Situatie

- **Weather module:** Heeft 3 TTS-secties (current, forecast, rain) met speaker icon buttons
- **Voice commands:** Bestaan alleen voor navigatie en lijst-interacties
- **Geen "voorlezen" commando:** Gebruikers kunnen niet via spraak vragen om content voorgelezen te krijgen

### Te Overwegen

1. **Nieuwe command categorie: `tts`**
   - Commands: "voorlezen", "lees voor", "lees het weer voor", "stop voorlezen"
   - Per taal: nl, en, de, fr, es, it, no, sv, da, pt, pt-BR, en-GB

2. **Context-aware TTS**
   - Weather screen: "voorlezen" → leest huidige weer voor
   - Podcast screen: "voorlezen" → leest episode beschrijving voor
   - Chat screen: "voorlezen" → leest laatste berichten voor
   - Contact screen: "voorlezen" → leest contact info voor

3. **Sectie-specifieke commands**
   - "lees de voorspelling voor" → alleen forecast
   - "lees de regenradar voor" → alleen rain prediction
   - "lees alles voor" → alle secties

4. **Architectuur overwegingen**
   - Hoe registreren modules hun voorleesbare content?
   - Interface voor `VoiceReadable` content?
   - Priority/ordering bij meerdere voorleesbare elementen?

5. **UX vragen**
   - Moet "voorlezen" automatisch stoppen bij navigatie?
   - Moet er een "pauze" command zijn naast "stop"?
   - Hoe om te gaan met lange teksten (chunking)?

### Relevante bestanden

- `src/hooks/useVoiceCommands.ts` — Voice command parsing
- `src/contexts/VoiceFocusContext.tsx` — Focus management
- `src/types/voiceCommands.ts` — Command type definities
- `src/hooks/useWeather.ts` — Huidige Weather TTS implementatie

### Volgende stappen

1. [ ] Architectuur uitwerken voor app-brede TTS voice commands
2. [ ] Command patronen definiëren per taal (12 talen)
3. [ ] `VoiceReadable` interface ontwerpen
4. [ ] Prototype in Weather module
5. [ ] Uitrollen naar andere modules

---

## 2. iPad/iPhone Hybrid Menu

**Status:** Te plannen
**Datum toegevoegd:** 2026-02-21

### Context

Er moet een plan komen voor een hybrid navigatie menu dat werkt op zowel iPhone als iPad, met optimale UX voor beide platforms.

### Te overwegen

- WheelNavigationMenu aanpassing voor grotere schermen
- Split view support op iPad
- Touch target sizing blijft ≥60pt
- Consistente navigatie ervaring

---

## Notities

- Dit bestand is bedoeld voor items die **diepere reflectie** vereisen voordat implementatie begint
- Kleine bugs/fixes horen hier NIET thuis — die gaan direct naar implementatie
- Elk item krijgt een volgnummer en datum
