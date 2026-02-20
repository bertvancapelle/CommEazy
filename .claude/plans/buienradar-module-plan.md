# Buienradar Module Implementation Plan

## Samenvatting

Uitbreiding van de bestaande Weather module met een Radar tab die real-time neerslagradar toont via RainViewer API, met interactieve kaart en tijdslider.

---

## Beslissingen

| Onderwerp | Beslissing |
|-----------|------------|
| **Favorieten delen** | `FavoriteLocationsContext` — gedeeld tussen Weather en Radar |
| **Huidige locatie** | Vaste optie bovenaan (📍), niet verwijderbaar, GPS on-demand |
| **Radar API** | RainViewer (gratis, Europees) |
| **Neerslag tekst** | Open-Meteo hourly precipitation (hergebruik) |
| **Kaartbibliotheek** | `react-native-maps` (Apple Maps iOS, Google Maps Android) |
| **Locatiemarker** | Dot in `accentColor.primary`, schaalt mee bij zoom |
| **Module integratie** | Tabs in Weather: "Weer" / "Radar" |
| **Tijdnavigatie** | Slider (-2u tot +30min) met tijdlabel |
| **Caching** | On-device, 10 minuten interval |
| **Proxy server** | Alleen API key hiding (geen rate limiting) |

---

## Fase 1: FavoriteLocationsContext (Fundament)

### Doel
Refactor locatiebeheer naar gedeelde Context zodat Weather en Radar dezelfde favorieten gebruiken.

### Bestanden

**NIEUW: `src/contexts/FavoriteLocationsContext.tsx`**
```typescript
interface FavoriteLocation {
  id: string;                    // "latitude,longitude" of "current"
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  isCurrentLocation: boolean;    // true = GPS, coördinaten dynamisch
}

interface FavoriteLocationsContextValue {
  // Locaties
  locations: FavoriteLocation[];
  selectedLocationId: string | null;
  currentLocation: FavoriteLocation | null;  // GPS locatie (altijd id="current")

  // Acties
  selectLocation: (id: string) => void;
  addLocation: (location: Omit<FavoriteLocation, 'id' | 'isCurrentLocation'>) => Promise<void>;
  removeLocation: (id: string) => void;

  // GPS
  requestCurrentLocation: () => Promise<void>;
  isLoadingGps: boolean;
  gpsError: string | null;

  // Zoeken
  searchLocations: (query: string) => Promise<GeocodingResult[]>;
  isSearching: boolean;
}
```

**WIJZIGEN: `src/hooks/useWeather.ts`**
- Verwijder locatie state management
- Import `useFavoriteLocations()` voor locatie data
- Behoud weather fetching en caching logic

**WIJZIGEN: `src/screens/modules/WeatherScreen.tsx`**
- Vervang lokale locatie state door `useFavoriteLocations()`
- LocationPickerModal gebruikt context data

### Taken

- [ ] **1.1** Maak `FavoriteLocationsContext.tsx`
- [ ] **1.2** Voeg GPS locatie als vaste "Huidige locatie" optie toe
- [ ] **1.3** Migreer bestaande `weather_saved_locations` data bij eerste load
- [ ] **1.4** Wrap App met `FavoriteLocationsProvider`
- [ ] **1.5** Refactor `useWeather.ts` — verwijder locatie management
- [ ] **1.6** Refactor `WeatherScreen.tsx` — gebruik context
- [ ] **1.7** Test: Weather werkt nog steeds correct

---

## Fase 2: Weather Module Tabs

### Doel
Voeg tab navigatie toe aan WeatherScreen: "Weer" en "Radar".

### Bestanden

**WIJZIGEN: `src/screens/modules/WeatherScreen.tsx`**
- Voeg tab state toe: `activeTab: 'weather' | 'radar'`
- Render `WeatherTab` of `RadarTab` component
- Tab buttons onder ModuleHeader

**NIEUW: `src/screens/modules/components/WeatherTab.tsx`**
- Extract huidige weather content naar apart component
- Props: `location`, `weatherData`, `isLoading`, etc.

**NIEUW: `src/screens/modules/components/RadarTab.tsx`**
- Placeholder voor radar kaart
- Props: `location`

### UI Layout

```
┌─────────────────────────────────────────────────────┐
│  ModuleHeader (🌤️ Weer | 🔊 MediaIndicator)        │
├─────────────────────────────────────────────────────┤
│  [☀️ Weer]  [🗺️ Radar]  ← Tab buttons              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  {activeTab === 'weather' ? <WeatherTab /> : <RadarTab />}
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Taken

- [ ] **2.1** Maak `WeatherTab.tsx` — extract weather UI
- [ ] **2.2** Maak `RadarTab.tsx` — placeholder
- [ ] **2.3** Voeg tab state en tab buttons toe aan `WeatherScreen.tsx`
- [ ] **2.4** Voeg i18n keys toe voor tabs
- [ ] **2.5** Test: Tab switching werkt

---

## Fase 3: react-native-maps Installatie

### Doel
Installeer en configureer `react-native-maps` voor iOS en Android.

### Bestanden

**WIJZIGEN: `package.json`**
```json
"dependencies": {
  "react-native-maps": "^1.10.0"
}
```

**WIJZIGEN: `ios/Podfile`**
- Maps dependency (indien nodig)

**WIJZIGEN: `ios/CommEazyTemp/Info.plist`**
- `NSLocationWhenInUseUsageDescription` (al aanwezig?)
- `NSLocationAlwaysUsageDescription` (optioneel)

**WIJZIGEN: `android/app/src/main/AndroidManifest.xml`**
- Google Maps API key meta-data (voor Android)

### Taken

- [ ] **3.1** `npm install react-native-maps`
- [ ] **3.2** `cd ios && pod install`
- [ ] **3.3** Voeg location permission strings toe (indien niet aanwezig)
- [ ] **3.4** Test: Basis MapView rendert in RadarTab

---

## Fase 4: RainViewer Service

### Doel
Maak service voor RainViewer API om radar tile URLs op te halen.

### Bestanden

**NIEUW: `src/services/rainViewerService.ts`**
```typescript
interface RainViewerFrame {
  time: number;      // Unix timestamp
  path: string;      // Tile path
}

interface RainViewerData {
  generated: number;
  host: string;
  radar: {
    past: RainViewerFrame[];      // ~12 frames, 2 uur history
    nowcast: RainViewerFrame[];   // ~6 frames, 30 min forecast
  };
}

// Functies
export async function fetchRadarFrames(): Promise<RainViewerData>;
export function getRadarTileUrl(host: string, path: string, size: number, color: number, options: number, smooth: number, snow: number): string;
```

### API Details

**Weather Maps JSON:**
```
https://api.rainviewer.com/public/weather-maps.json
```

**Tile URL Format:**
```
{host}{path}/{size}/{z}/{x}/{y}/{color}/{smooth}_{snow}.png
```

Parameters:
- `size`: 256 of 512
- `color`: 1 (original), 2 (universal blue), 6 (NEXRAD)
- `smooth`: 0 of 1
- `snow`: 0 of 1

### Taken

- [ ] **4.1** Maak `rainViewerService.ts`
- [ ] **4.2** Implementeer `fetchRadarFrames()` met 10-min caching
- [ ] **4.3** Implementeer `getRadarTileUrl()` helper
- [ ] **4.4** Voeg types toe aan `src/types/weather.ts`
- [ ] **4.5** Test: API call succesvol, tiles laden

---

## Fase 5: RadarMap Component

### Doel
Interactieve kaart met radar overlay en locatiemarker.

### Bestanden

**NIEUW: `src/screens/modules/components/RadarMap.tsx`**
```typescript
interface RadarMapProps {
  latitude: number;
  longitude: number;
  radarTileUrl: string;
  accentColor: string;
}
```

### Features

1. **Basiskaart** — Apple Maps (iOS) / Google Maps (Android)
2. **Radar Overlay** — UrlTile met RainViewer tiles
3. **Locatie Marker** — Dot in `accentColor.primary`
4. **Zoom Controls** — Pinch-to-zoom, default zoom level
5. **Region** — Gecentreerd op locatie

### Implementatie

```typescript
<MapView
  style={styles.map}
  initialRegion={{
    latitude,
    longitude,
    latitudeDelta: 2.0,    // ~200km zichtbaar
    longitudeDelta: 2.0,
  }}
  showsUserLocation={false}  // We tonen eigen marker
>
  {/* Radar tiles */}
  <UrlTile
    urlTemplate={radarTileUrl}
    maximumZ={12}
    tileSize={256}
    zIndex={1}
    opacity={0.7}
  />

  {/* Locatie marker */}
  <Marker coordinate={{ latitude, longitude }}>
    <View style={[styles.locationDot, { backgroundColor: accentColor }]} />
  </Marker>
</MapView>
```

### Taken

- [ ] **5.1** Maak `RadarMap.tsx` component
- [ ] **5.2** Implementeer MapView met initiële region
- [ ] **5.3** Voeg UrlTile overlay toe voor radar
- [ ] **5.4** Voeg locatie marker toe met accent color
- [ ] **5.5** Style location dot (12px cirkel met border)
- [ ] **5.6** Test: Kaart toont, radar zichtbaar, marker op locatie

---

## Fase 6: TimeSlider Component

### Doel
Slider waarmee gebruiker door radar tijdframes kan scrollen (-2u tot +30min).

### Bestanden

**NIEUW: `src/screens/modules/components/TimeSlider.tsx`**
```typescript
interface TimeSliderProps {
  frames: RainViewerFrame[];     // Alle beschikbare frames
  currentIndex: number;
  onIndexChange: (index: number) => void;
}
```

### UI Design

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│  -2u ────────────●──────────────────── +30min       │
│                                                      │
│              "Nu - 14:35"                           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Features

1. **Slider** — React Native Slider component
2. **Labels** — "-2u" links, "+30min" rechts
3. **Tijdstip** — Huidige frame tijd onder slider
4. **Relatieve tijd** — "Nu", "10 min geleden", "Over 15 min"
5. **Touch target** — 60pt hoogte

### Implementatie

```typescript
const formatRelativeTime = (frameTime: number, now: number): string => {
  const diffMinutes = Math.round((frameTime - now) / 60);
  if (Math.abs(diffMinutes) < 5) return t('modules.radar.now');
  if (diffMinutes < 0) return t('modules.radar.minutesAgo', { minutes: -diffMinutes });
  return t('modules.radar.inMinutes', { minutes: diffMinutes });
};
```

### Taken

- [ ] **6.1** Maak `TimeSlider.tsx` component
- [ ] **6.2** Implementeer Slider met min/max labels
- [ ] **6.3** Voeg relatieve tijd formatting toe
- [ ] **6.4** Voeg absolute tijd display toe (HH:mm)
- [ ] **6.5** Voeg i18n keys toe voor tijdsaanduidingen
- [ ] **6.6** Test: Slider werkt, tijd update correct

---

## Fase 7: RadarTab Integratie

### Doel
Combineer RadarMap en TimeSlider in RadarTab component.

### Bestanden

**WIJZIGEN: `src/screens/modules/components/RadarTab.tsx`**
```typescript
interface RadarTabProps {
  location: FavoriteLocation;
}
```

### State Management

```typescript
// In RadarTab
const [radarData, setRadarData] = useState<RainViewerData | null>(null);
const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Alle frames = past + nowcast
const allFrames = useMemo(() => {
  if (!radarData) return [];
  return [...radarData.radar.past, ...radarData.radar.nowcast];
}, [radarData]);

// Huidige tile URL
const currentTileUrl = useMemo(() => {
  if (!radarData || allFrames.length === 0) return null;
  const frame = allFrames[currentFrameIndex];
  return getRadarTileUrl(radarData.host, frame.path, 256, 2, 0, 1, 1);
}, [radarData, allFrames, currentFrameIndex]);
```

### Layout

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │              RadarMap                        │  │
│  │              (flex: 1)                       │  │
│  │                                               │  │
│  │                    •                          │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  -2u ─────────●────────────── +30min         │  │
│  │            "Nu - 14:35"                       │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  📍 Amsterdam                                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Taken

- [ ] **7.1** Implementeer RadarTab met state management
- [ ] **7.2** Fetch radar data bij mount en location change
- [ ] **7.3** Auto-refresh elke 10 minuten
- [ ] **7.4** Connect RadarMap met huidige frame URL
- [ ] **7.5** Connect TimeSlider met frame index
- [ ] **7.6** Voeg loading state toe
- [ ] **7.7** Voeg error handling toe
- [ ] **7.8** Voeg locatie naam display toe
- [ ] **7.9** Test: Volledige radar flow werkt

---

## Fase 8: GPS Locatie

### Doel
Implementeer "Huidige locatie" optie met GPS lookup.

### Bestanden

**WIJZIGEN: `src/contexts/FavoriteLocationsContext.tsx`**
- Voeg GPS functionaliteit toe via `expo-location` of `react-native-geolocation-service`

### GPS Flow

1. User selecteert "Huidige locatie" (id: "current")
2. Context roept `requestCurrentLocation()` aan
3. GPS permission gevraagd indien nodig
4. Coördinaten opgehaald
5. `currentLocation` state ge-update
6. Weather/Radar data gefetched voor nieuwe coördinaten

### Permission Strings (Info.plist)

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>CommEazy gebruikt uw locatie om het weer en de buienradar voor uw huidige positie te tonen.</string>
```

### Taken

- [ ] **8.1** Installeer `@react-native-community/geolocation` of `expo-location`
- [ ] **8.2** Implementeer `requestCurrentLocation()` in context
- [ ] **8.3** Voeg GPS error handling toe (permission denied, timeout)
- [ ] **8.4** Voeg loading indicator toe tijdens GPS lookup
- [ ] **8.5** Update Info.plist permission string (indien nodig)
- [ ] **8.6** Test: GPS locatie werkt op fysiek device

---

## Fase 9: i18n Uitbreiding

### Doel
Voeg vertalingen toe voor radar functionaliteit in alle 5 talen.

### Bestanden

**WIJZIGEN: `src/locales/nl.json`, `en.json`, `de.json`, `fr.json`, `es.json`**

### Nieuwe Keys

```json
{
  "modules": {
    "weather": {
      "tabs": {
        "weather": "Weer",
        "radar": "Radar"
      },
      "currentLocation": "Huidige locatie",
      "currentLocationHint": "Gebruik uw GPS locatie"
    },
    "radar": {
      "title": "Buienradar",
      "now": "Nu",
      "minutesAgo": "{{minutes}} min geleden",
      "inMinutes": "Over {{minutes}} min",
      "hoursAgo": "{{hours}} uur geleden",
      "loading": "Radar laden...",
      "error": "Kan radar niet laden",
      "noData": "Geen radardata beschikbaar",
      "gpsError": "Kan locatie niet bepalen",
      "gpsPermissionDenied": "Locatietoegang geweigerd"
    }
  }
}
```

### Taken

- [ ] **9.1** Voeg Nederlandse vertalingen toe
- [ ] **9.2** Voeg Engelse vertalingen toe
- [ ] **9.3** Voeg Duitse vertalingen toe
- [ ] **9.4** Voeg Franse vertalingen toe
- [ ] **9.5** Voeg Spaanse vertalingen toe
- [ ] **9.6** Test: Alle talen tonen correcte strings

---

## Fase 10: Accessibility & Polish

### Doel
Zorg dat radar functionaliteit volledig toegankelijk is.

### Accessibility Features

1. **VoiceOver labels** — Kaart, slider, knoppen
2. **Dynamic Type** — Tijdlabels schalen met systeem font
3. **Reduced Motion** — Geen animaties indien uitgeschakeld
4. **Haptic Feedback** — Bij slider interactie
5. **Color Contrast** — Marker zichtbaar op alle kaart stijlen

### Taken

- [ ] **10.1** Voeg accessibilityLabel toe aan RadarMap
- [ ] **10.2** Voeg accessibilityLabel/Hint toe aan TimeSlider
- [ ] **10.3** Voeg haptic feedback toe bij slider changes
- [ ] **10.4** Test met VoiceOver
- [ ] **10.5** Test met Dynamic Type (200%)
- [ ] **10.6** Test met Reduced Motion

---

## Fase 11: Performance & Caching

### Doel
Optimaliseer radar performance en implementeer caching.

### Caching Strategie

1. **RainViewer JSON** — 10 minuten cache in memory
2. **Tile Images** — Native Image caching (automatisch)
3. **Frame Preloading** — Laad volgende/vorige frame alvast

### Performance Optimalisaties

1. **Tile Size** — 256px (niet 512px) voor sneller laden
2. **Max Zoom** — Limiteer tot level 12
3. **Debounce** — Slider onChange met 100ms debounce
4. **Memoization** — useMemo voor tile URL berekening

### Taken

- [ ] **11.1** Implementeer memory cache voor radar JSON
- [ ] **11.2** Voeg cache invalidatie toe na 10 minuten
- [ ] **11.3** Debounce slider onChange
- [ ] **11.4** Test: Geen lag bij slider interactie
- [ ] **11.5** Test: Radar laadt binnen 3 seconden

---

## Fase 12: Testing & Validatie

### Doel
Volledige test coverage en skill validatie.

### Test Scenarios

| Test | Verwacht |
|------|----------|
| Weather tab | Bestaande functionaliteit werkt |
| Radar tab | Kaart toont met radar overlay |
| Slider | Tijd wijzigt, radar update |
| GPS | Locatie wordt opgehaald |
| Offline | Graceful degradation |
| Slow network | Loading states zichtbaar |
| 5 talen | Alle strings vertaald |
| VoiceOver | Alles bereikbaar |
| Dynamic Type | Layout breekt niet |

### Skill Validaties

Per CLAUDE.md Coordination Protocol:

- [ ] **ui-designer** — Senior-inclusive design check
- [ ] **accessibility-specialist** — WCAG AAA, VoiceOver, TalkBack
- [ ] **react-native-expert** — Component architecture
- [ ] **ios-specialist** — MapKit integratie, permissions
- [ ] **testing-qa** — Test coverage

### Taken

- [ ] **12.1** Handmatige test van alle scenarios
- [ ] **12.2** Accessibility audit
- [ ] **12.3** Performance profiling
- [ ] **12.4** Skill validation checklist doorlopen

---

## Bestandsoverzicht

### Nieuwe Bestanden

| Bestand | Beschrijving |
|---------|--------------|
| `src/contexts/FavoriteLocationsContext.tsx` | Gedeeld locatiebeheer |
| `src/services/rainViewerService.ts` | RainViewer API integratie |
| `src/screens/modules/components/WeatherTab.tsx` | Weather content (refactor) |
| `src/screens/modules/components/RadarTab.tsx` | Radar kaart + slider |
| `src/screens/modules/components/RadarMap.tsx` | MapView met radar overlay |
| `src/screens/modules/components/TimeSlider.tsx` | Tijd navigatie slider |

### Gewijzigde Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/screens/modules/WeatherScreen.tsx` | Tab navigatie, context integratie |
| `src/hooks/useWeather.ts` | Verwijder locatie management |
| `src/types/weather.ts` | RainViewer types toevoegen |
| `src/locales/*.json` | Radar vertalingen |
| `package.json` | react-native-maps dependency |
| `ios/Podfile` | Maps pod |
| `ios/CommEazyTemp/Info.plist` | GPS permission string |

---

## Tijdsinschatting

| Fase | Geschatte Complexiteit |
|------|------------------------|
| Fase 1: FavoriteLocationsContext | Hoog (refactoring) |
| Fase 2: Weather Module Tabs | Laag |
| Fase 3: react-native-maps | Medium (native setup) |
| Fase 4: RainViewer Service | Laag |
| Fase 5: RadarMap Component | Medium |
| Fase 6: TimeSlider Component | Laag |
| Fase 7: RadarTab Integratie | Medium |
| Fase 8: GPS Locatie | Medium |
| Fase 9: i18n Uitbreiding | Laag |
| Fase 10: Accessibility | Medium |
| Fase 11: Performance | Laag |
| Fase 12: Testing | Medium |

---

## Risico's & Mitigatie

| Risico | Impact | Mitigatie |
|--------|--------|-----------|
| react-native-maps native issues | Hoog | Test vroeg op fysiek device |
| RainViewer API changes | Medium | Cache agressief, fallback naar error state |
| GPS permission denied | Medium | Duidelijke uitleg, fallback naar zoeken |
| Map tile loading slow | Medium | Show loading indicator, preload tiles |
| Large bundle size (+maps) | Low | Tree shaking, lazy loading |

---

## Definition of Done

- [ ] Weather tab werkt exact zoals voorheen
- [ ] Radar tab toont kaart met radar overlay
- [ ] Slider navigeert door tijdframes
- [ ] "Huidige locatie" werkt met GPS
- [ ] Alle 5 talen volledig vertaald
- [ ] VoiceOver volledig functioneel
- [ ] Performance: <3s load time
- [ ] Geen TypeScript errors
- [ ] Skill validaties doorlopen
- [ ] Commit en push naar main
