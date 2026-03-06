# Fotoalbum Module — Optimalisatie & Uitbreidingsplan

> **Status:** ⏳ Wacht op uitvoering (na mail module testen)
> **Prioriteit:** Eerste taak na mail module validatie
> **Datum:** 2026-03-06
> **PNA Analyse:** Voltooid — 13 issues, 6 ontbrekende features, 4 integraties

---

## Overzicht

Dit plan adresseert **13 geïdentificeerde issues**, **6 ontbrekende features**, en **module integratie verbeteringen**. Georganiseerd in 5 fasen, van technische schuld opheffing naar feature uitbreiding.

---

## Fase 1: Technische Schuld Opheffing

*Doel: Codebase opschonen zonder functionele wijzigingen*

### 1.1 Vervang inline fullscreen viewer door `FullscreenImageViewer`

**Probleem:** PhotoAlbumScreen heeft een eigen 130-regels inline viewer (regels 646-774), terwijl `FullscreenImageViewer` al bestaat met betere functionaliteit (haptic, save-to-album, prev/next, counter).

**Actie:**
- Verwijder inline viewer uit PhotoAlbumScreen.tsx (regels 646-774)
- Integreer `FullscreenImageViewer` met `ViewerImage[]` mapping
- Bonus: save-to-album functionaliteit komt gratis mee
- *Let op: PhotoMessageBubble heeft ook een eigen inline viewer — deze apart aanpakken (Fase 1.2)*

### 1.2 Consolideer PhotoMessageBubble viewer

**Probleem:** PhotoMessageBubble (chat) heeft óók een eigen fullscreen viewer — dat zijn 3 viewers in totaal.

**Actie:**
- Refactor PhotoMessageBubble om `FullscreenImageViewer` te gebruiken
- Map de `uri` prop naar `ViewerImage` interface
- Behoud download progress en error state buiten de viewer

### 1.3 Vervang `Vibration.vibrate()` door `HapticTouchable` / `useFeedback()`

**Probleem:** 3 bestanden gebruiken `Vibration.vibrate(50)` i.p.v. het gestandaardiseerde haptic systeem.

**Actie in 3 bestanden:**
- `PhotoAlbumScreen.tsx` — Vervang alle `TouchableOpacity` + `Vibration` door `HapticTouchable`
- `CameraScreen.tsx` — Idem
- `PhotoRecipientModal.tsx` — Idem
- Verwijder `import { Vibration }` overal

### 1.4 Vervang hardcoded colors door `useColors()`

**Probleem:** PhotoAlbumScreen importeert `colors` direct uit `@/theme` — geen dark mode support.

**Actie:**
- Voeg `const themeColors = useColors();` toe
- Vervang alle `colors.textPrimary`, `colors.surface`, etc. door `themeColors.*`
- Verwijder directe `colors` import (behalve voor statische constanten zoals `colors.error`)

### 1.5 Vervang statische `SCREEN_WIDTH` door `useWindowDimensions()`

**Probleem:** `const SCREEN_WIDTH = Dimensions.get('window').width` (regel 69) is statisch — breekt bij iPad rotation en Split View.

**Actie:**
- Vervang door `const { width: screenWidth } = useWindowDimensions();`
- Bereken `itemSize` reactief: `(screenWidth - spacing) / NUM_COLUMNS`
- Grid past zich nu automatisch aan bij oriëntatie en pane-grootte

### 1.6 Verwijder `setTimeout` race conditions

**Probleem:** `setTimeout(handleSendPhotos, 100)` (regels 742-743, 759-760) — fragiele timing.

**Actie:**
- Vervang door `requestAnimationFrame` of directe callback chain
- Modal close → await state update → dan send uitvoeren
- Gebruik `InteractionManager.runAfterInteractions()` als alternatief

### 1.7 Verwijder PII uit logging

**Probleem:** `console.info(LOG_PREFIX, 'Photo saved:', { id, size, dimensions })` — potentieel PII in error context.

**Actie:**
- Audit alle `console.*` calls in media bestanden
- Verwijder bestandsnamen, URIs en user-gerelateerde data
- Behoud alleen: `{ count, size, operation, duration }`

---

## Fase 2: UX Verbeteringen (Senior-Focused)

*Doel: Bestaande functionaliteit senior-friendlier maken*

### 2.1 Datum-groepering in foto grid

**Probleem:** Foto's worden als platte grid getoond zonder tijdscontext — senioren weten niet wanneer foto's gemaakt zijn.

**Actie:**
- Implementeer datum-groepering pattern (zoals `AskAIHistoryModal.tsx`):
  - "Vandaag" / "Gisteren" / "Afgelopen week" / datum
- Section headers in het grid met grote, leesbare datum tekst
- Sticky headers bij scrollen (senior-friendly)

**i18n keys nodig:**
```
photoAlbum.dateToday: "Vandaag"
photoAlbum.dateYesterday: "Gisteren"
photoAlbum.dateLastWeek: "Afgelopen week"
```
*(In alle 13 talen)*

### 2.2 Verbeterde lege staat

**Probleem:** Huidige lege staat toont alleen icoon + tekst. Geen duidelijke call-to-action.

**Actie:**
- Voeg grote "Maak een foto" button toe (navigeert naar Camera module)
- Voeg "Importeer uit galerij" button toe (opent device camera roll)
- Gebruik `HapticTouchable` met 72pt touch targets
- Duidelijke illustratie of icoon boven de knoppen

### 2.3 Video ondersteuning in grid

**Probleem:** Grid filtert alleen `.jpg/.jpeg/.png` — video's (`.mp4/.mov`) worden niet getoond, terwijl `mediaStorageService` ze wel opslaat.

**Actie:**
- Voeg video extensies toe aan filter
- Toon video thumbnail met play-icoon overlay en duur
- Bij tap: open video in `react-native-video` viewer of systeem player
- Video badge: "0:45" linksboven de thumbnail

### 2.4 Pinch-to-zoom in fullscreen viewer

**Probleem:** `FullscreenImageViewer` gebruikt alleen `Image` met `resizeMode="contain"` — geen zoom mogelijk.

**Actie:**
- Wrap `Image` in `react-native-gesture-handler` PinchGestureHandler + `Animated.View`
- Of gebruik `react-native-image-zoom-viewer` als dependency
- Double-tap to zoom in/out als alternatief voor senioren (makkelijker dan pinch)
- Respecteer `Reduce Motion` instelling

---

## Fase 3: Nieuwe Features — Albums & Organisatie

*Doel: Foto-organisatie toevoegen*

### 3.1 Album systeem

**Probleem:** Alle foto's staan in één vlakke lijst. Geen mogelijkheid om te groeperen.

**Ontwerp:**
```
┌─────────────────────────────────────────────┐
│  📸 Fotoalbum                               │
├─────────────────────────────────────────────┤
│  [📁 Albums]  [📷 Alle foto's]              │  ← Tabs
├─────────────────────────────────────────────┤
│                                             │
│  [Albums tab:]                              │
│  ┌──────┐  ┌──────┐  ┌──────┐              │
│  │ 🏖️   │  │ 🎄   │  │ 👨‍👩‍👧  │              │
│  │Vakantie│  │Kerst │  │Familie│              │
│  │12 foto│  │8 foto│  │24 foto│              │
│  └──────┘  └──────┘  └──────┘              │
│  ┌──────┐                                   │
│  │  ➕  │                                   │
│  │Nieuw │                                   │
│  │album │                                   │
│  └──────┘                                   │
│                                             │
│  [Alle foto's tab:]                         │
│  Huidige grid met datum-groepering          │
└─────────────────────────────────────────────┘
```

**Data model:**
```typescript
interface PhotoAlbum {
  id: string;
  name: string;
  coverPhotoId?: string;   // Eerste foto als cover
  photoIds: string[];      // Geordende lijst
  createdAt: number;
  updatedAt: number;
}
```

**Opslag:** AsyncStorage (albums zijn metadata, foto's blijven in DocumentDirectory)

**UX flow:**
1. "Nieuw album" → naam invoeren (groot TextInput, 60pt)
2. Foto's selecteren (bestaand multi-select pattern)
3. Album opent als grid met terug-knop
4. Foto's toevoegen/verwijderen uit album
5. Album hernoemen of verwijderen

**i18n keys nodig (13 talen):**
```
photoAlbum.albums: "Albums"
photoAlbum.allPhotos: "Alle foto's"
photoAlbum.newAlbum: "Nieuw album"
photoAlbum.albumName: "Album naam"
photoAlbum.addToAlbum: "Voeg toe aan album"
photoAlbum.removeFromAlbum: "Verwijder uit album"
photoAlbum.renameAlbum: "Hernoem album"
photoAlbum.deleteAlbum: "Verwijder album"
photoAlbum.deleteAlbumConfirm: "Album verwijderen? Foto's blijven bewaard."
photoAlbum.photoCount: "{{count}} foto's"
```

### 3.2 Device Camera Roll importeren

**Probleem:** Gebruiker kan alleen foto's maken via Camera module. Bestaande foto's op het toestel zijn niet toegankelijk.

**Actie:**
- Gebruik `@react-native-camera-roll/camera-roll` (v7.10.2, al geïnstalleerd!)
- "Importeer" button → opent native image picker
- Multi-select van device foto's
- Geïmporteerde foto's worden door mediaStorageService pipeline verwerkt (EXIF strip, compress, thumbnail)
- Na import: foto verschijnt in grid

**UX flow:**
1. Tap "Importeer foto's" (in lege staat of via actie-menu)
2. Native image picker opent (systeem UI — vertrouwd voor senioren)
3. Selecteer 1 of meer foto's
4. Import progress indicator
5. Foto's verschijnen in grid

### 3.3 Ontvangen foto's sectie

**Probleem:** Via chat ontvangen foto's zijn niet vindbaar in het Fotoalbum.

**Actie:**
- Voeg "Ontvangen" tab of filter toe
- Query `mediaStorageService` op `source === 'received'`
- Toon afzender naam + datum bij elke foto
- "Opslaan in album" actie vanuit ontvangen foto's

---

## Fase 4: Nieuwe Features — Fotolijst/Diashow

*Doel: Passieve foto-weergave voor senioren*

### 4.1 Fotolijst (Slideshow) modus

**Waarom kritiek voor senioren:** Veel senioren willen foto's van kleinkinderen als "digitale fotolijst" op hun iPad. Dit is een killer-feature voor de doelgroep.

**Ontwerp:**
```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│         [Foto op volledig scherm]            │
│                                             │
│                                             │
│                  Ken & Lisa                  │
│                14 juli 2024                  │
│                                             │
├─────────────────────────────────────────────┤
│  ▶ Pauze    ⏱️ 5 sec    ✕ Stop              │  ← Overlay (auto-hide na 3s)
└─────────────────────────────────────────────┘
```

**Features:**
- Start vanaf huidig album of alle foto's
- Interval instelbaar: 3s / 5s / 10s / 30s
- Shuffle of chronologisch
- Auto-hide controls (tik om terug te tonen)
- Prevent sleep (`KeepAwake`) tijdens slideshow
- Datum + caption overlay onderaan
- Overgang: crossfade (of direct bij Reduce Motion)

**UX flow:**
1. In album of alle foto's → "▶ Fotolijst" button
2. Slideshow start direct
3. Tik op scherm → overlay met controls
4. Stop → terug naar grid

**i18n keys (13 talen):**
```
photoAlbum.slideshow: "Fotolijst"
photoAlbum.slideshowStart: "Start fotolijst"
photoAlbum.slideshowStop: "Stop"
photoAlbum.slideshowPause: "Pauze"
photoAlbum.slideshowResume: "Verder"
photoAlbum.slideshowInterval: "Wisseltijd"
photoAlbum.slideshowShuffle: "Willekeurige volgorde"
photoAlbum.slideshowSeconds: "{{count}} seconden"
```

**Native dependency:** `react-native-keep-awake` (of `expo-keep-awake`)

---

## Fase 5: Module Integratie

*Doel: Fotoalbum verbinden met andere modules*

### 5.1 Chat → Album integratie

**Probleem:** Vanuit een chatgesprek kan je geen foto opslaan naar het Fotoalbum.

**Actie:**
- Voeg "Opslaan" button toe in PhotoMessageBubble
- Gebruik `FullscreenImageViewer` met `onSave` callback
- Save flow: kopieer naar `media/` directory + registreer als `source: 'received'`
- Toon "✓ Opgeslagen" feedback (zoals MailDetailScreen doet)

### 5.2 Mail → Album integratie

**Probleem:** Mail bijlagen (foto's) kunnen niet opgeslagen worden naar het Fotoalbum.

**Actie:**
- MailDetailScreen gebruikt al `FullscreenImageViewer` met `saveAttachmentToAlbum()`
- Valideer dat opgeslagen foto's vindbaar zijn in PhotoAlbumScreen
- Voeg `source: 'received'` metadata toe bij mail-saves

### 5.3 Deel-functionaliteit (Share Sheet)

**Probleem:** Geen share sheet in de hele app — foto's kunnen niet gedeeld worden buiten CommEazy.

**Actie:**
- Implementeer native share sheet via `react-native-share`
- Beschikbaar vanuit fullscreen viewer: "Deel" button
- Ondersteunt: AirDrop, Messages, WhatsApp, Mail, etc.
- Respecteer privacy: alleen lokale URI's delen, geen metadata

### 5.4 Fotoalbum in ModuleHeader

**Huidige staat:** PhotoAlbumScreen heeft een eigen header. Moet `ModuleHeader` gebruiken per Component Registry.

**Actie:**
- Vervang custom header door `<ModuleHeader moduleId="photoAlbum" icon="image" title={t('modules.photoAlbum.title')} />`
- Voeg `useModuleColor('photoAlbum')` toe voor accent kleur

---

## Fase Prioritering

| Fase | Omvang | Impact | Risico | Aanbeveling |
|------|--------|--------|--------|-------------|
| **Fase 1** | ~8-12 bestanden | Hoog (code kwaliteit) | Laag | **Start hier** — opschonen vóór uitbreiden |
| **Fase 2** | ~3-5 bestanden | Hoog (senior UX) | Laag-Middel | Direct na Fase 1 |
| **Fase 3** | ~5-8 nieuwe bestanden | Zeer hoog (kernfeature) | Middel | Grootste user-facing impact |
| **Fase 4** | ~2-3 nieuwe bestanden | Hoog (killer feature) | Laag | Relatief geïsoleerd |
| **Fase 5** | ~4-6 bestanden | Middel (integratie) | Middel | Cross-module, meer testing |

---

## Architectuur Beslissingen (Open Vragen)

1. **Album opslag:** AsyncStorage (simpel, geen migratie) vs. WatermelonDB tabel (schaalbaar, queryable)?
   - *Aanbeveling:* AsyncStorage voor v1 — albums zijn klein (metadata only). Migreer naar DB als >100 albums nodig zijn.

2. **Video viewer:** Eigen component of `react-native-video` fullscreen?
   - *Aanbeveling:* `react-native-video` — al mature, handles hardware decoding, controls ingebouwd.

3. **Pinch-to-zoom:** Eigen gesture handler of library?
   - *Aanbeveling:* `react-native-image-zoom-viewer` of minimale eigen implementatie met `react-native-gesture-handler` (al dependency).

4. **Share sheet:** `react-native-share` (populair) of `expo-sharing` (lichter)?
   - *Aanbeveling:* `react-native-share` — meer opties, betere native integratie.

5. **Slideshow keep awake:** `react-native-keep-awake` of eigen native module?
   - *Aanbeveling:* `react-native-keep-awake` — simpel, maintained.

---

## Skill Validatie Matrix

| Fase | Skills | Validatie Focus |
|------|--------|-----------------|
| 1 | ui-designer, react-native-expert | Dark mode, responsive grid, component standaardisatie |
| 2 | ui-designer, accessibility-specialist | Datum UX, video badge, zoom a11y |
| 3 | architecture-lead, ui-designer, security-expert | Album data model, EXIF stripping bij import, multi-select UX |
| 4 | ui-designer, accessibility-specialist, performance-optimizer | Slideshow animatie, memory bij grote collecties, Reduce Motion |
| 5 | architecture-lead, security-expert | Cross-module data flow, privacy bij share |

---

## Totaal Impact

| Categorie | Aantal Items |
|-----------|-------------|
| Technische schuld opgeheven | 7 issues |
| UX verbeteringen | 4 items |
| Nieuwe features | 5 features |
| Module integraties | 4 integraties |
| Nieuwe i18n keys | ~25-30 keys × 13 talen |
| Geschatte bestanden geraakt | 15-20 bestaand + 5-8 nieuw |

---

## Bestaande Bestanden (Referentie)

### Geraakt door dit plan:
- `src/screens/modules/PhotoAlbumScreen.tsx` — Hoofdscherm (Fase 1-4)
- `src/screens/modules/CameraScreen.tsx` — Haptic fix (Fase 1.3)
- `src/components/PhotoMessageBubble.tsx` — Viewer consolidatie (Fase 1.2)
- `src/components/PhotoRecipientModal.tsx` — Haptic fix (Fase 1.3)
- `src/components/FullscreenImageViewer.tsx` — Pinch-to-zoom (Fase 2.4)
- `src/services/media/mediaStorageService.ts` — Video support, PII logging (Fase 1.7, 2.3)
- `src/types/media.ts` — Album types (Fase 3.1)
- 13× `src/locales/*.json` — Nieuwe i18n keys (alle fasen)

### Nieuwe bestanden (geschat):
- `src/services/media/albumService.ts` — Album CRUD operaties
- `src/components/SlideshowViewer.tsx` — Fotolijst component
- `src/components/VideoThumbnail.tsx` — Video grid item
- `src/hooks/usePhotoAlbums.ts` — Album state management hook

### Bestaande patterns om te hergebruiken:
- `FullscreenImageViewer` — Save-to-album flow (uit MailDetailScreen)
- `AskAIHistoryModal.tsx` — Datum-groepering pattern
- `HapticTouchable` — Universele touch wrapper
- `useColors()` — Dark mode support
- `useModuleColor()` — Module accent kleur
- `ModuleHeader` — Gestandaardiseerde header
