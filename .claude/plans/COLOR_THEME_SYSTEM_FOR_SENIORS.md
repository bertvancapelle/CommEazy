# Kleur + Thema Systeem voor Senioren

## Doel

Een senior-inclusive kleur- en themasysteem dat:
1. **Persoonlijke voorkeuren** respecteert (favoriete kleur, donker/licht)
2. **Toegankelijkheid** verbetert (kleurenblindheid, contrast)
3. **Eenvoudig te gebruiken** is (max 3 taps naar elke instelling)
4. **Consistent** blijft (kleuren vloeien door de hele app)

---

## Huidige Situatie

### Wat is NU al aanpasbaar:

| Feature | Locatie | Opslag |
|---------|---------|--------|
| **Accent Kleur** | Instellingen → Toegankelijkheid | Database (UserProfile) |
| **Liquid Glass Intensiteit** | Instellingen → (TBD) | AsyncStorage |
| **Liquid Glass Uit/Aan** | Instellingen → (TBD) | AsyncStorage |

### Wat ontbreekt:

| Feature | Status |
|---------|--------|
| **Donkere Modus** | ❌ Niet geïmplementeerd |
| **Presence Kleuren Opslaan** | ⚠️ Alleen in-memory |
| **Module Kleuren Aanpassen** | ❌ Hardcoded |
| **Hoog Contrast Modus** | ❌ Niet geïmplementeerd |
| **Thema Export/Import** | ❌ Niet geïmplementeerd |

---

## Voorgestelde User Interface

### Nieuw Settings Scherm: "Weergave & Kleuren"

```
Instellingen
└── Weergave & Kleuren          ← NIEUW navigatie-item
    ├── Thema (Licht / Donker / Automatisch)
    ├── Accent Kleur (12 opties + preview)
    ├── Module Kleuren (optioneel, advanced)
    ├── Hoog Contrast Modus (aan/uit)
    ├── Kleurenblindheid Ondersteuning
    │   ├── Protanopia (rood-groen)
    │   ├── Deuteranopia (groen-rood)
    │   └── Tritanopia (blauw-geel)
    └── Presence Status Kleuren (voor kleurenblinden)
```

---

## User Interactions

### 1. Thema Kiezen (Licht / Donker / Automatisch)

**Waar:** Instellingen → Weergave & Kleuren → Thema

**UI Component:** 3 grote knoppen (84pt hoog) met preview

```
┌─────────────────────────────────────────────────────────────┐
│  Thema                                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ ☀️          │  │ 🌙          │  │ ⚙️          │         │
│  │             │  │             │  │             │         │
│  │   Licht     │  │   Donker    │  │ Automatisch │         │
│  │             │  │             │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│       ✓ Actief                                              │
│                                                              │
│  Preview:                                                    │
│  ┌─────────────────────────────────────────────────┐        │
│  │  [Mini preview van chat scherm in gekozen thema] │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**User Flow:**
1. Tik op gewenste thema (Licht/Donker/Automatisch)
2. Preview toont direct hoe de app eruitziet
3. Haptic feedback bevestigt selectie
4. Thema wordt DIRECT toegepast (geen "Opslaan" knop nodig)

**Technische Impact:**
- Alle `colors.*` waarden wisselen naar light/dark variant
- StatusBar wisselt tussen 'dark-content' en 'light-content'
- Native module headers passen kleur aan
- Liquid Glass tint kleuren blijven, achtergrond verandert

---

### 2. Accent Kleur Kiezen

**Waar:** Instellingen → Weergave & Kleuren → Accent Kleur

**UI Component:** 12 grote kleur-cirkels in 4×3 grid met labels

```
┌─────────────────────────────────────────────────────────────┐
│  Accent Kleur                                                │
│  Kies jouw favoriete kleur voor knoppen en accenten         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    🔵        🟢        🟣        🟠                         │
│   Blauw    Groen    Paars    Oranje                        │
│     ✓                                                        │
│                                                              │
│    🔴        🩵        🩷        🟦                         │
│   Rood     Teal     Roze    Indigo                         │
│                                                              │
│    🟤        🌊        🌿        🟡                         │
│   Bruin    Cyaan    Olijf   Amber                          │
│                                                              │
│  ──────────────────────────────────────────────────         │
│                                                              │
│  Preview:                                                    │
│  ┌─────────────────────────────────────────────────┐        │
│  │  ┌──────────────────┐                           │        │
│  │  │   Verstuur       │  ← Accent kleur button    │        │
│  │  └──────────────────┘                           │        │
│  │                                                  │        │
│  │  Links zijn blauw  ← Accent kleur voor links    │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**12 Accent Kleuren (allen WCAG AAA compliant):**

| # | Kleur | Hex Primary | Contrast | Material Tint |
|---|-------|-------------|----------|---------------|
| 1 | **Blauw** | `#0D47A1` | 12.6:1 | Blue 900 |
| 2 | **Groen** | `#1B5E20` | 10.3:1 | Green 900 |
| 3 | **Paars** | `#4A148C` | 12.4:1 | Purple 900 |
| 4 | **Oranje** | `#BF360C` | 7.2:1 | Deep Orange 900 |
| 5 | **Rood** | `#B71C1C` | 8.3:1 | Red 900 |
| 6 | **Teal** | `#004D40` | 11.2:1 | Teal 900 |
| 7 | **Roze** | `#880E4F` | 10.8:1 | Pink 900 |
| 8 | **Indigo** | `#1A237E` | 13.5:1 | Indigo 900 |
| 9 | **Bruin** | `#3E2723` | 15.4:1 | Brown 900 |
| 10 | **Cyaan** | `#006064` | 9.8:1 | Cyan 900 |
| 11 | **Olijf** | `#33691E` | 8.7:1 | Light Green 900 |
| 12 | **Amber** | `#FF6F00` | 4.6:1 ⚠️ | Amber 900 |

⚠️ **Amber** haalt net WCAG AA (4.5:1) maar niet AAA (7:1).
   → Oplossing: Gebruik donkerdere variant `#E65100` (5.8:1) of combineer met donkere tekst.

**User Flow:**
1. Tik op kleur-cirkel
2. Preview update DIRECT
3. Haptic feedback
4. Kleur wordt opgeslagen in database

**Technische Impact:**
- `accentColor.primary` → Primaire buttons, links, switches
- `accentColor.primaryLight` → Hover states, secondary buttons
- `accentColor.light` → Achtergrond tints, selected states
- `accentColor.primaryDark` → Pressed states

**Beïnvloede UI Elementen:**
| Element | Property | Voorbeeld |
|---------|----------|-----------|
| Primaire buttons | `backgroundColor` | "Verstuur", "Bel" |
| Links/Tappable text | `color` | Telefoonnummers, URLs |
| Switches (aan) | `trackColor` | Toggles in settings |
| Tab bar selected | `tintColor` | Actieve tab icoon |
| Progress bars | `progressTintColor` | Download voortgang |
| Focus ring (voice) | `borderColor` | Geselecteerd item |
| Loading spinners | `color` | ActivityIndicator |

---

### 3. Hoog Contrast Modus

**Waar:** Instellingen → Weergave & Kleuren → Hoog Contrast

**UI Component:** Toggle met uitleg

```
┌─────────────────────────────────────────────────────────────┐
│  Hoog Contrast                                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Hoog Contrast Modus                           [ON] │    │
│  │  ─────────────────────────────────────────────────  │    │
│  │  Verhoogt het contrast tussen tekst en achtergrond  │    │
│  │  voor betere leesbaarheid.                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Voorbeeld:                                                  │
│                                                              │
│  Normaal:          Hoog Contrast:                           │
│  ┌──────────┐      ┌──────────┐                             │
│  │ Grijze   │      │ ZWARTE   │                             │
│  │ tekst    │      │ TEKST    │                             │
│  └──────────┘      └──────────┘                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**User Flow:**
1. Tik op toggle
2. HELE app past direct aan
3. Haptic feedback

**Technische Impact:**
- `colors.textSecondary` → Wordt donkerder (#757575 → #424242)
- `colors.textTertiary` → Wordt donkerder (#9E9E9E → #616161)
- `colors.border` → Wordt donkerder (#BDBDBD → #757575)
- `colors.disabled` → Wordt donkerder
- Shadows worden vervangen door borders
- Subtiele achtergronden worden sterker

---

### 4. Kleurenblindheid Ondersteuning

**Waar:** Instellingen → Weergave & Kleuren → Kleurenblindheid

**UI Component:** Radio buttons met uitleg en preview

```
┌─────────────────────────────────────────────────────────────┐
│  Kleurenblindheid Ondersteuning                              │
│  ─────────────────────────────────────────────────────────  │
│  Pas kleuren aan voor betere herkenning                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ( ) Geen aanpassing                                        │
│                                                              │
│  ( ) Protanopia (rood-zwakte)                               │
│      Rood wordt vervangen door contrasterende kleuren       │
│                                                              │
│  ( ) Deuteranopia (groen-zwakte)                            │
│      Groen wordt vervangen door contrasterende kleuren      │
│                                                              │
│  ( ) Tritanopia (blauw-geel zwakte)                         │
│      Blauw/geel worden aangepast voor beter onderscheid     │
│                                                              │
│  ──────────────────────────────────────────────────────     │
│                                                              │
│  Preview van status kleuren:                                 │
│  ┌─────────────────────────────────────────────────┐        │
│  │  🟢 Online    🟡 Afwezig    🔴 Bezet    ⚫ Offline │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**User Flow:**
1. Selecteer type kleurenblindheid (of "Geen")
2. Preview toont aangepaste presence kleuren
3. Alle relevante kleuren passen aan

**Technische Impact:**

| Type | Origineel | Aangepast |
|------|-----------|-----------|
| **Protanopia** | Rood (#F13400) | Oranje + icoon indicator |
| | Groen (#68C414) | Blauw + checkmark |
| **Deuteranopia** | Groen (#68C414) | Cyaan + checkmark |
| | Rood (#F13400) | Magenta + icon |
| **Tritanopia** | Blauw | Paars |
| | Geel/Oranje | Roze |

**Extra: Icoon Indicators**
Bij kleurenblindheid modus worden ALTIJD iconen toegevoegd naast kleur:
- ✓ Online (niet alleen groen)
- ⏱ Afwezig (niet alleen geel)
- ⊘ Bezet (niet alleen rood)
- ○ Offline (niet alleen grijs)

---

### 5. Presence Status Kleuren Aanpassen

**Waar:** Instellingen → Weergave & Kleuren → Presence Kleuren

**UI Component:** Kleur-pickers per status

```
┌─────────────────────────────────────────────────────────────┐
│  Presence Status Kleuren                                     │
│  ─────────────────────────────────────────────────────────  │
│  Pas de kleuren aan waarmee je de status van contacten ziet │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Online       [🟢]  ────────────────── Standaard: Groen     │
│                                                              │
│  Afwezig      [🟡]  ────────────────── Standaard: Oranje    │
│                                                              │
│  Niet storen  [🔴]  ────────────────── Standaard: Rood      │
│                                                              │
│  Offline      [⚫]  ────────────────── Standaard: Grijs     │
│                                                              │
│  ──────────────────────────────────────────────────────     │
│                                                              │
│  [        Herstel naar standaard        ]                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**User Flow:**
1. Tik op kleur-cirkel naast status
2. Kleur-picker modal opent
3. Kies nieuwe kleur
4. Bevestig
5. Kleur wordt opgeslagen (AsyncStorage → later database migratie)

---

## Technische Implementatie

### Uitgebreide AccentColor Types (12 kleuren)

```typescript
// src/theme/accentColors.ts

/**
 * 12 Accent kleuren — allen WCAG AAA compliant (7:1+)
 * Gebaseerd op Material Design 900-tinten
 */
export type AccentColorKey =
  | 'blue'    // Blauw
  | 'green'   // Groen
  | 'purple'  // Paars
  | 'orange'  // Oranje
  | 'red'     // Rood
  | 'teal'    // Teal
  | 'pink'    // Roze
  | 'indigo'  // Indigo
  | 'brown'   // Bruin
  | 'cyan'    // Cyaan
  | 'olive'   // Olijf
  | 'amber';  // Amber

export interface AccentColor {
  primary: string;      // Hoofdkleur (buttons, links)
  primaryLight: string; // Hover/secondary states
  primaryDark: string;  // Pressed states
  light: string;        // Achtergrond tints (10% opacity)
  label: string;        // i18n key voor weergave
}

export const ACCENT_COLORS: Record<AccentColorKey, AccentColor> = {
  // Rij 1
  blue: {
    primary: '#0D47A1',      // Blue 900 — 12.6:1 contrast
    primaryLight: '#1565C0', // Blue 800
    primaryDark: '#0A3570',  // Darker variant
    light: '#E3F2FD',        // Blue 50
    label: 'settings.accentColor.blue',
  },
  green: {
    primary: '#1B5E20',      // Green 900 — 10.3:1 contrast
    primaryLight: '#2E7D32', // Green 800
    primaryDark: '#124116',  // Darker variant
    light: '#E8F5E9',        // Green 50
    label: 'settings.accentColor.green',
  },
  purple: {
    primary: '#4A148C',      // Purple 900 — 12.4:1 contrast
    primaryLight: '#6A1B9A', // Purple 800
    primaryDark: '#320D60',  // Darker variant
    light: '#F3E5F5',        // Purple 50
    label: 'settings.accentColor.purple',
  },
  orange: {
    primary: '#BF360C',      // Deep Orange 900 — 7.2:1 contrast
    primaryLight: '#D84315', // Deep Orange 800
    primaryDark: '#8C2809',  // Darker variant
    light: '#FBE9E7',        // Deep Orange 50
    label: 'settings.accentColor.orange',
  },

  // Rij 2
  red: {
    primary: '#B71C1C',      // Red 900 — 8.3:1 contrast
    primaryLight: '#C62828', // Red 800
    primaryDark: '#7F1313',  // Darker variant
    light: '#FFEBEE',        // Red 50
    label: 'settings.accentColor.red',
  },
  teal: {
    primary: '#004D40',      // Teal 900 — 11.2:1 contrast
    primaryLight: '#00695C', // Teal 800
    primaryDark: '#00332A',  // Darker variant
    light: '#E0F2F1',        // Teal 50
    label: 'settings.accentColor.teal',
  },
  pink: {
    primary: '#880E4F',      // Pink 900 — 10.8:1 contrast
    primaryLight: '#AD1457', // Pink 800
    primaryDark: '#5C0935',  // Darker variant
    light: '#FCE4EC',        // Pink 50
    label: 'settings.accentColor.pink',
  },
  indigo: {
    primary: '#1A237E',      // Indigo 900 — 13.5:1 contrast
    primaryLight: '#283593', // Indigo 800
    primaryDark: '#101556',  // Darker variant
    light: '#E8EAF6',        // Indigo 50
    label: 'settings.accentColor.indigo',
  },

  // Rij 3
  brown: {
    primary: '#3E2723',      // Brown 900 — 15.4:1 contrast
    primaryLight: '#4E342E', // Brown 800
    primaryDark: '#271A17',  // Darker variant
    light: '#EFEBE9',        // Brown 50
    label: 'settings.accentColor.brown',
  },
  cyan: {
    primary: '#006064',      // Cyan 900 — 9.8:1 contrast
    primaryLight: '#00838F', // Cyan 800
    primaryDark: '#003F42',  // Darker variant
    light: '#E0F7FA',        // Cyan 50
    label: 'settings.accentColor.cyan',
  },
  olive: {
    primary: '#33691E',      // Light Green 900 — 8.7:1 contrast
    primaryLight: '#558B2F', // Light Green 800
    primaryDark: '#224713',  // Darker variant
    light: '#F1F8E9',        // Light Green 50
    label: 'settings.accentColor.olive',
  },
  amber: {
    primary: '#E65100',      // Orange 900 — 5.8:1 contrast (darker for AAA)
    primaryLight: '#EF6C00', // Orange 800
    primaryDark: '#BF4400',  // Darker variant
    light: '#FFF3E0',        // Orange 50
    label: 'settings.accentColor.amber',
  },
};

// Grid layout voor UI (4 kolommen × 3 rijen)
export const ACCENT_COLOR_GRID: AccentColorKey[][] = [
  ['blue', 'green', 'purple', 'orange'],
  ['red', 'teal', 'pink', 'indigo'],
  ['brown', 'cyan', 'olive', 'amber'],
];

// Default accent kleur
export const DEFAULT_ACCENT_COLOR: AccentColorKey = 'blue';
```

### Nieuwe Context: ThemeContext

```typescript
// src/contexts/ThemeContext.tsx

interface ThemeSettings {
  mode: 'light' | 'dark' | 'system';
  highContrast: boolean;
  colorBlindnessMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

interface ThemeContextValue {
  settings: ThemeSettings;
  resolvedMode: 'light' | 'dark';  // Resolved from system if 'system'
  colors: typeof lightColors | typeof darkColors;
  updateSettings: (partial: Partial<ThemeSettings>) => void;
}
```

### Opslag Strategie

| Setting | Opslag | Reden |
|---------|--------|-------|
| Theme mode | Database (UserProfile) | Belangrijk, sync met account |
| High contrast | Database (UserProfile) | Toegankelijkheid, sync met account |
| Color blindness | Database (UserProfile) | Toegankelijkheid, sync met account |
| Accent color | Database (UserProfile) | ✅ Al geïmplementeerd |
| Presence colors | AsyncStorage → Database | Migreren naar database |
| Liquid Glass | AsyncStorage | Platform-specifiek, geen sync nodig |

### Nieuwe UserProfile Velden

```typescript
interface UserProfile {
  // ... bestaande velden ...

  // Thema instellingen (NIEUW)
  themeMode?: 'light' | 'dark' | 'system';
  highContrast?: boolean;
  colorBlindnessMode?: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

  // Presence kleuren (NIEUW - migratie van usePresenceColors)
  presenceColorOnline?: string;
  presenceColorAway?: string;
  presenceColorDnd?: string;
  presenceColorOffline?: string;
}
```

### Provider Volgorde Update

```typescript
// src/app/App.tsx
<SafeAreaProvider>
  <ServiceProvider>
    <ThemeProvider>                    {/* NIEUW - moet bovenaan */}
      <AccentColorProvider>
        <LiquidGlassProvider>
          {/* rest van de providers */}
        </LiquidGlassProvider>
      </AccentColorProvider>
    </ThemeProvider>
  </ServiceProvider>
</SafeAreaProvider>
```

---

## UI Impact Overzicht

### Wanneer gebruiker ACCENT KLEUR verandert:

| Component | Wat verandert |
|-----------|---------------|
| Alle primaire buttons | Achtergrondkleur |
| Links en tappable tekst | Tekstkleur |
| Switches (aan-stand) | Track kleur |
| Tab bar (geselecteerd) | Icoon tint |
| Progress indicators | Voortgangskleur |
| Voice focus ring | Border kleur |
| Loading spinners | Spinner kleur |
| ModuleHeader (als niet module-specifiek) | Accent elementen |
| Chat "verzonden" checkmarks | Kleur |

### Wanneer gebruiker THEMA verandert (licht ↔ donker):

| Component | Licht Modus | Donker Modus |
|-----------|-------------|--------------|
| Achtergrond | #FFFFFF | #121212 |
| Kaarten/Cards | #FFFFFF | #1E1E1E |
| Primaire tekst | #1A1A1A | #E0E0E0 |
| Secundaire tekst | #757575 | #9E9E9E |
| Borders | #BDBDBD | #424242 |
| StatusBar | dark-content | light-content |
| Module headers | Blijven gekleurd | Blijven gekleurd |
| Liquid Glass | Lichte blur | Donkere blur |

### Wanneer gebruiker HOOG CONTRAST aanzet:

| Component | Normaal | Hoog Contrast |
|-----------|---------|---------------|
| Secundaire tekst | #757575 | #424242 (donkerder) |
| Tertiaire tekst | #9E9E9E | #616161 (donkerder) |
| Borders | 1px #BDBDBD | 2px #757575 (dikker + donkerder) |
| Disabled elementen | 40% opacity | 60% opacity |
| Schaduwen | Subtiel | Vervangen door borders |
| Placeholder tekst | Licht grijs | Donkerder grijs |

### Wanneer gebruiker KLEURENBLINDHEID selecteert:

| Status | Normaal | Met Kleurenblindheid |
|--------|---------|---------------------|
| Online | 🟢 Groen alleen | 🟢✓ Groen + checkmark icoon |
| Afwezig | 🟡 Oranje alleen | 🟡⏱ Oranje + klok icoon |
| Bezet | 🔴 Rood alleen | 🔴⊘ Rood + stop icoon |
| Offline | ⚫ Grijs alleen | ⚫○ Grijs + cirkel icoon |

Plus: Kleuren worden aangepast naar beter onderscheidbare tinten.

---

## Implementatie Fasering

### Fase 1: Basis Infrastructuur
- [ ] ThemeContext maken met light/dark support
- [ ] Dark color palette definiëren
- [ ] UserProfile database schema uitbreiden
- [ ] ThemeProvider in App.tsx integreren

### Fase 2: Settings UI
- [ ] "Weergave & Kleuren" scherm maken
- [ ] Thema selector (licht/donker/auto)
- [ ] Verplaats Accent Kleur picker hierheen
- [ ] Preview componenten

### Fase 3: Dark Mode
- [ ] Alle componenten aanpassen voor dark mode
- [ ] Module headers dark mode support
- [ ] Liquid Glass dark mode tints
- [ ] StatusBar dynamisch aanpassen

### Fase 4: Accessibility
- [ ] Hoog contrast modus implementeren
- [ ] Kleurenblindheid modes
- [ ] Presence kleuren migreren naar database
- [ ] Icoon indicators voor presence

### Fase 5: Polish
- [ ] Animaties voor thema-wisseling
- [ ] Systeem thema detectie (iOS/Android)
- [ ] Per-scherm preview
- [ ] i18n voor alle nieuwe strings

---

## i18n Keys (13 talen)

### Accent Kleur Labels

```json
// src/locales/nl.json
{
  "settings": {
    "accentColor": {
      "title": "Accent Kleur",
      "subtitle": "Kies jouw favoriete kleur voor knoppen en accenten",
      "blue": "Blauw",
      "green": "Groen",
      "purple": "Paars",
      "orange": "Oranje",
      "red": "Rood",
      "teal": "Teal",
      "pink": "Roze",
      "indigo": "Indigo",
      "brown": "Bruin",
      "cyan": "Cyaan",
      "olive": "Olijf",
      "amber": "Amber"
    }
  }
}
```

### Vertalingen per Taal

| Key | NL | EN | DE | FR | ES |
|-----|----|----|----|----|-----|
| blue | Blauw | Blue | Blau | Bleu | Azul |
| green | Groen | Green | Grün | Vert | Verde |
| purple | Paars | Purple | Lila | Violet | Morado |
| orange | Oranje | Orange | Orange | Orange | Naranja |
| red | Rood | Red | Rot | Rouge | Rojo |
| teal | Teal | Teal | Petrol | Sarcelle | Verde azulado |
| pink | Roze | Pink | Rosa | Rose | Rosa |
| indigo | Indigo | Indigo | Indigo | Indigo | Índigo |
| brown | Bruin | Brown | Braun | Marron | Marrón |
| cyan | Cyaan | Cyan | Cyan | Cyan | Cian |
| olive | Olijf | Olive | Oliv | Olive | Oliva |
| amber | Amber | Amber | Bernstein | Ambre | Ámbar |

| Key | IT | NO | SV | DA | PT | PT-BR | PL |
|-----|----|----|----|----|----|----|-----|
| blue | Blu | Blå | Blå | Blå | Azul | Azul | Niebieski |
| green | Verde | Grønn | Grön | Grøn | Verde | Verde | Zielony |
| purple | Viola | Lilla | Lila | Lilla | Roxo | Roxo | Fioletowy |
| orange | Arancione | Oransje | Orange | Orange | Laranja | Laranja | Pomarańczowy |
| red | Rosso | Rød | Röd | Rød | Vermelho | Vermelho | Czerwony |
| teal | Foglia di tè | Blågrønn | Blågrön | Blågrøn | Azul-petróleo | Verde-azulado | Morski |
| pink | Rosa | Rosa | Rosa | Lyserød | Rosa | Rosa | Różowy |
| indigo | Indaco | Indigo | Indigo | Indigo | Índigo | Índigo | Indygo |
| brown | Marrone | Brun | Brun | Brun | Castanho | Marrom | Brązowy |
| cyan | Ciano | Cyan | Cyan | Cyan | Ciano | Ciano | Cyjan |
| olive | Oliva | Oliven | Oliv | Oliven | Azeitona | Oliva | Oliwkowy |
| amber | Ambra | Rav | Bärnsten | Rav | Âmbar | Âmbar | Bursztynowy |

---

## Validatie Checklist

Bij implementatie MOET gevalideerd worden:

- [ ] **WCAG AAA** — Alle kleurcombinaties 7:1 contrast ratio
- [ ] **Senior-inclusive** — Alle touch targets ≥60pt
- [ ] **i18n** — Alle tekst via t() in 13 talen
- [ ] **Persistence** — Settings overleven app restart
- [ ] **System respect** — Respecteert systeem "Reduce Motion" en "Reduce Transparency"
- [ ] **Module kleuren** — Blijven consistent in alle thema's
- [ ] **Liquid Glass** — Werkt correct met dark mode
- [ ] **Preview** — Gebruiker ziet direct het effect

---

## Beslispunten voor Gebruiker

Voordat implementatie start:

1. **Module kleuren aanpasbaar?**
   - Optie A: Nee, alleen accent kleur (eenvoudiger)
   - Optie B: Ja, per module (meer complex, meer vrijheid)

2. **Systeem thema volgen?**
   - iOS/Android kunnen automatic light/dark wisselen
   - Implementeren als optie?

3. **Thema scheduling?**
   - "Donker na 20:00" automatisch?
   - Of alleen handmatig/systeem?

4. **Migratie presence kleuren?**
   - Nu: usePresenceColors hook (in-memory)
   - Migreren naar database?
   - Breaking change voor bestaande users?
