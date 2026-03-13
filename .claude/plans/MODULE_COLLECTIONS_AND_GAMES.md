# Module Verzamelingen, Spelmodules & Kleurensysteem — Implementatieplan

> **Status:** PNA goedgekeurd — Klaar voor implementatie
> **Datum:** 2026-03-13
> **Scope:** Module Verzamelingen (iOS folder-style), 5 Spelmodules, Globale Kleurinstelling
> **Afhankelijkheid:** Geen externe afhankelijkheden. Bouwt voort op bestaande HomeScreen grid, Liquid Glass infra, en ModuleColorsContext.

---

## Inhoudsopgave

1. [Samenvatting Beslissingen](#1-samenvatting-beslissingen)
2. [Architectuur Overzicht](#2-architectuur-overzicht)
3. [Fase 1: Globale Standaard Modulekleur](#3-fase-1-globale-standaard-modulekleur)
4. [Fase 2: 5 Spelmodules Registreren](#4-fase-2-5-spelmodules-registreren)
5. [Fase 3: Module Verzamelingen Systeem](#5-fase-3-module-verzamelingen-systeem)
6. [Fase 4: CollectionOverlay met Liquid Glass](#6-fase-4-collectionoverlay-met-liquid-glass)
7. [Fase 5: Drag & Drop Integratie](#7-fase-5-drag--drop-integratie)
8. [Fase 6: iPad Split View Integratie](#8-fase-6-ipad-split-view-integratie)
9. [Fase 7: i18n (13 talen)](#9-fase-7-i18n-13-talen)
10. [Bestanden Overzicht](#10-bestanden-overzicht)
11. [Skill Validatie Matrix](#11-skill-validatie-matrix)
12. [Open Items voor Tijdens Ontwikkeling](#12-open-items-voor-tijdens-ontwikkeling)

---

## 1. Samenvatting Beslissingen

Alle beslissingen zijn goedgekeurd tijdens PNA-overleg op 2026-03-13.

### Module Verzamelingen

| Beslissing | Keuze |
|-----------|-------|
| Visueel concept | iOS folder-style: 2×2 mini-icon preview in gridcel |
| Aanmaken methode 1 | Wiggle mode: drag module op module → verzameling |
| Aanmaken methode 2 | "+" knop in wiggle mode (senior-vriendelijk alternatief) |
| Openen | Tap → CollectionOverlay (3-koloms grid, max 9 modules) |
| Verwijderen | ALLEEN als leeg (BLOKKEERDER: niet-lege verzameling kan NIET verwijderd worden) |
| Hernoemen | Long-press op verzameling-titel in overlay |
| Max modules per verzameling | 9 (3×3 grid, geen scroll) |
| Verzameling kleur | Erft globale standaardkleur; 2×2 preview toont module-kleuren |
| iPad gedrag | Identiek aan iPhone (UX Consistentie Principe) |

### Spelmodules

| Beslissing | Keuze |
|-----------|-------|
| Structuur | 5 aparte modules (niet 1 overkoepelende) |
| Default groepering | Pre-gegroepeerd in "Spellen" verzameling |
| Screens | Placeholder screens (geen game logic in dit plan) |
| Iconen | Bestaande + nieuwe SVG iconen waar nodig |

### Kleurensysteem

| Beslissing | Keuze |
|-----------|-------|
| Default kleur alle modules | Blauw (#0D47A1) — ongewijzigd |
| Nieuwe instelling | "Standaard modulekleur" — wijzigt alle modules in één keer |
| Per-module override | Blijft mogelijk (bestaande functionaliteit) |
| Kleurresolutie (prioriteit) | 1. Per-module override → 2. Globale override → 3. Default (#0D47A1) |
| Herkenbaarheid | Via icoon + label (primair), kleur is personalisatie/toegankelijkheid |

### Liquid Glass

| Beslissing | Keuze |
|-----------|-------|
| CollectionOverlay | `'regular'` glass style op iOS 26+ |
| Fallback iOS <26 / Android | Solid color `rgba(globalColor, 0.85)` met borderRadius 24 |
| Bestaande glass infra | Ongewijzigd (players, LiquidGlassView, native modules) |

---

## 2. Architectuur Overzicht

### Kleurresolutie Flow

```
useModuleColor(moduleId)
  │
  ├─ Heeft user per-module override? → Return override kleur
  │
  ├─ Heeft user globale standaard override? → Return globale kleur
  │
  └─ Geen overrides → Return MODULE_TINT_COLORS default (#0D47A1)
```

**AsyncStorage keys:**
- `@commeazy/globalDefaultColor` — Globale standaard kleur (hex string of null)
- `module_colors_custom` — Per-module overrides (bestaande key, ongewijzigd)
- `@commeazy/moduleCollections` — Verzamelingen data
- `@commeazy/moduleOrder` — Grid volgorde (bestaande key, uitgebreid met collection refs)

### Data Model

```typescript
// Bestaand — uitbreiden
type NavigationDestination = StaticNavigationDestination | DynamicNavigationDestination;

// NIEUW — collection referentie in grid order
type CollectionReference = `collection:${string}`;
type GridItem = NavigationDestination | CollectionReference;

// NIEUW — verzameling definitie
interface ModuleCollection {
  id: string;                          // UUID
  name: string;                        // User-gekozen naam of i18n key voor defaults
  moduleIds: NavigationDestination[];  // Modules in deze verzameling (max 9)
  isDefault: boolean;                  // true voor "Spellen" — kan niet verwijderd worden
  createdAt: number;
  updatedAt: number;
}
```

### HomeScreen Grid (na implementatie)

```
┌─────────┬─────────┬─────────┐
│ 💬      │ 👥      │ 📻      │  Rij 1: Normale modules
│ Berichten│Contacten│ Radio   │
├─────────┼─────────┼─────────┤
│ 📞      │ 👥👥    │ 📷      │  Rij 2: calls, groups, camera
│ Bellen  │ Groepen │ Camera  │
├─────────┼─────────┼─────────┤
│ ┌──┬──┐ │ 🌤️      │ 🎵      │  Rij 3: Spellen verzameling
│ │🎯│🔢│ │ Weer    │ Muziek  │         (2×2 mini-icons)
│ │🃏│🧠│ │         │         │
│ └──┴──┘ │         │         │
│ Spellen │         │         │
├─────────┼─────────┼─────────┤
│ ...     │ ...     │ ...     │  Rij 4+: overige modules
```

---

## 3. Fase 1: Globale Standaard Modulekleur

### Doel
Gebruikers kunnen in één actie alle modulekleuren wijzigen naar een kleur die voor hen goed leesbaar is.

### Wijzigingen

#### 3.1 ModuleColorsContext.tsx — Uitbreiden

**Bestand:** `src/contexts/ModuleColorsContext.tsx`

Toevoegen:
- `globalDefaultColor: string | null` state (null = geen override, gebruik hardcoded default)
- `setGlobalDefaultColor(hex: string | null): void` method
- `resetGlobalDefault(): void` method
- AsyncStorage key: `@commeazy/globalDefaultColor`

Wijzigen:
- `getModuleHex(moduleId)` — 3-laags resolutie implementeren:
  ```
  1. overrides[moduleId] → per-module override
  2. globalDefaultColor → globale override
  3. MODULE_TINT_COLORS[moduleId].tintColor → hardcoded default
  ```

#### 3.2 AppearanceSettingsScreen.tsx — Nieuw UI element

**Bestand:** `src/screens/settings/AppearanceSettingsScreen.tsx`

Toevoegen bovenaan het scherm (vóór per-module lijst):
- Sectie "Standaard modulekleur"
- Tappable kleur-cirkel die het 16-kleuren grid opent
- Bij selectie: `setGlobalDefaultColor(hex)` → alle modules zonder per-module override wijzigen direct
- "Herstel" knop: `resetGlobalDefault()` → terug naar blauw

Per-module lijst aanpassen:
- Modules zonder override tonen "standaard" label
- Modules met override tonen hun kleur + "↩️ herstel" knop

#### 3.3 i18n keys

```json
{
  "settings": {
    "appearance": {
      "globalDefaultColor": "Standaard modulekleur",
      "globalDefaultColorHint": "Wijzigt de kleur van alle modules",
      "usingDefault": "standaard",
      "resetToDefault": "Herstel standaard"
    }
  }
}
```

### Validatie
- [ ] Globale kleurwijziging werkt direct (geen app restart)
- [ ] Per-module override heeft voorrang op globale kleur
- [ ] Reset globale kleur herstelt naar blauw (#0D47A1)
- [ ] Glass Player tintColor respecteert nieuwe kleur
- [ ] ModuleHeader achtergrondkleur respecteert nieuwe kleur

---

## 4. Fase 2: 5 Spelmodules Registreren

### Doel
5 spelmodules registreren in het navigatiesysteem met placeholder screens.

### 4.1 Spelmodule Definities

| moduleId | Label (NL) | Icon | Nieuw icoon nodig? |
|----------|-----------|------|---------------------|
| `woordraad` | Woordraad | `chatbubble` | Nee — woord/letter associatie past |
| `sudoku` | Sudoku | `grid` | Nee — maar `grid` is ook `menu` icon. Overweeg nieuw `sudoku` icoon |
| `solitaire` | Solitaire | `folder` | Ja — `folder` past niet. Nieuw `cards` icoon nodig |
| `memory` | Memory | `eye` | Nee — "onthouden/zien" past bij memory |
| `trivia` | Trivia | `star` | Nee — quiz/kennis associatie |

**Iconen actie:** Bij implementatie valideren of bestaande iconen visueel passend zijn. Zo niet: nieuwe SVG iconen toevoegen aan `Icon.tsx`. Dit is een Tier 1 wijziging per icoon.

### 4.2 Registratie Checklist (per module, 5×)

Conform CLAUDE.md "Nieuwe Module Validatie Checklist":

| # | Bestand | Wijziging |
|---|---------|-----------|
| 1 | `src/types/navigation.ts` | `StaticNavigationDestination`: 5 nieuwe waarden toevoegen |
| 2 | `src/types/navigation.ts` | `STATIC_MODULE_DEFINITIONS`: 5 entries (labelKey + icon) |
| 3 | `src/types/navigation.ts` | `ModuleIconType`: 5 nieuwe icon types (indien nodig) |
| 4 | `src/types/navigation.ts` | `mapModuleIconToIconName()`: 5 mappings |
| 5 | `src/hooks/useModuleUsage.ts` | `ALL_MODULES`: 5 toevoegen (16 → 21) |
| 6 | `src/hooks/useModuleUsage.ts` | `DEFAULT_MODULE_ORDER`: 5 toevoegen |
| 7 | `src/hooks/useModuleOrder.ts` | `DEFAULT_MODULE_ORDER`: 5 toevoegen |
| 8 | `src/types/liquidGlass.ts` | `ModuleColorId`: 5 toevoegen aan union type |
| 9 | `src/types/liquidGlass.ts` | `MODULE_TINT_COLORS`: 5 entries (allemaal #0D47A1) |
| 10 | `src/contexts/ModuleColorsContext.tsx` | `CUSTOMIZABLE_MODULES`: 5 toevoegen |
| 11 | `src/contexts/ModuleColorsContext.tsx` | `MODULE_LABELS`: 5 i18n key mappings |
| 12 | `src/components/navigation/PanelNavigator.tsx` | 5 case statements → PlaceholderScreen |
| 13 | `src/locales/*.json` | 13 talen × `navigation.[moduleId]` key |

### 4.3 Placeholder Screen

```typescript
// src/screens/modules/GamePlaceholderScreen.tsx
// Herbruikbaar voor alle 5 spellen — toont:
// - Module icoon (groot, 96pt)
// - Module naam
// - "Binnenkort beschikbaar" tekst
// - Terug knop (indien via navigatie bereikt)
```

### 4.4 Spelmodules in DEFAULT_MODULE_ORDER

De 5 spelmodules worden NIET aan de standaard grid volgorde toegevoegd als losse items. Ze worden automatisch opgenomen via de default "Spellen" verzameling (Fase 3). Dit voorkomt dat het grid van 16 naar 21 items groeit.

**Uitzondering:** `ALL_MODULES` moet ze WEL bevatten (voor module-order merge logic en validatie).

---

## 5. Fase 3: Module Verzamelingen Systeem

### Doel
Gebruikers kunnen modules groeperen in verzamelingen (iOS folder-style).

### 5.1 useModuleCollections Hook

**Nieuw bestand:** `src/hooks/useModuleCollections.ts`

```typescript
interface UseModuleCollectionsReturn {
  collections: ModuleCollection[];
  isLoaded: boolean;

  // CRUD
  createCollection(name: string): ModuleCollection;
  deleteCollection(id: string): boolean; // false als niet leeg
  renameCollection(id: string, name: string): void;

  // Module management
  addModuleToCollection(collectionId: string, moduleId: NavigationDestination): boolean; // false als max 9
  removeModuleFromCollection(collectionId: string, moduleId: NavigationDestination): void;
  moveModuleBetweenCollections(moduleId: NavigationDestination, fromId: string, toId: string): void;

  // Queries
  getCollectionForModule(moduleId: NavigationDestination): ModuleCollection | null;
  isModuleInCollection(moduleId: NavigationDestination): boolean;

  // Utilities
  resetToDefaults(): void;
}
```

**Veiligheidsregels (BLOKKEERDER — hardcoded, niet te omzeilen):**
1. `deleteCollection()` retourneert `false` als `collection.moduleIds.length > 0`
2. `addModuleToCollection()` retourneert `false` als `collection.moduleIds.length >= 9`
3. Default verzamelingen (`isDefault: true`) kunnen niet verwijderd worden

**Persistentie:** AsyncStorage key `@commeazy/moduleCollections`

### 5.2 Default "Spellen" Verzameling

```typescript
const DEFAULT_COLLECTIONS: ModuleCollection[] = [
  {
    id: 'default_games',
    name: 'collections.games',  // i18n key
    moduleIds: ['woordraad', 'sudoku', 'solitaire', 'memory', 'trivia'],
    isDefault: true,
    createdAt: 0, // sentinel: default
    updatedAt: 0,
  },
];
```

**Gedrag bij eerste launch:**
1. `useModuleCollections` laadt uit AsyncStorage
2. Als leeg → initialiseer met `DEFAULT_COLLECTIONS`
3. Als geladen → merge: voeg ontbrekende default collections toe (forward-compatible)

### 5.3 Grid Order Integratie

**Bestand:** `src/hooks/useModuleOrder.ts`

Wijzigen:
- `orderedModules` type wordt `GridItem[]` (was `NavigationDestination[]`)
- Modules die in een verzameling zitten worden NIET als losse items getoond
- In plaats daarvan verschijnt `collection:default_games` op de positie in het grid
- Default positie voor "Spellen": na de laatste bestaande module (einde van het grid)

**Load & merge logic:**
```
1. Laad saved order (GridItem[])
2. Laad collections
3. Filter: verwijder moduleIds die in een collection zitten uit de flat order
4. Voeg collection refs toe op hun opgeslagen positie
5. Voeg nieuwe (onbekende) modules toe aan het einde
```

---

## 6. Fase 4: CollectionOverlay met Liquid Glass

### Doel
Wanneer een senior op een verzameling tikt, opent een overlay die de inhoud toont.

### 6.1 CollectionOverlay Component

**Nieuw bestand:** `src/components/CollectionOverlay.tsx`

```typescript
interface CollectionOverlayProps {
  visible: boolean;
  collection: ModuleCollection;
  onClose: () => void;
  onModulePress: (moduleId: NavigationDestination) => void;
  onRemoveModule?: (moduleId: NavigationDestination) => void; // wiggle mode
  onRenameCollection?: (newName: string) => void;
  isEditMode?: boolean; // wiggle mode actief
}
```

**Layout:**
```
┌──────────────────────────────────────┐
│         ┌────────────────────┐       │  ← Dim achtergrond
│         │ LiquidGlassView    │       │    (tap om te sluiten)
│         │                    │       │
│         │   🎮 Spellen       │       │  ← Titel (long-press = hernoemen)
│         │                    │       │
│         │  ┌────┐ ┌────┐ ┌────┐│    │  ← 3-koloms grid
│         │  │🗨️  │ │🔢  │ │🃏  ││    │    (zelfde HomeGridItem style)
│         │  │Woord│ │Sudo│ │Soli││    │
│         │  └────┘ └────┘ └────┘│    │
│         │  ┌────┐ ┌────┐      │     │
│         │  │👁️  │ │⭐  │      │     │
│         │  │Memo │ │Triv│      │     │
│         │  └────┘ └────┘      │     │
│         │                    │       │
│         └────────────────────┘       │
│                                      │
└──────────────────────────────────────┘
```

**Specificaties:**
- **Achtergrond overlay:** `rgba(0, 0, 0, 0.4)` — dim effect
- **Glass container:**
  - iOS 26+: `LiquidGlassView` met `glassStyle="regular"`, `cornerRadius={24}`
  - iOS <26 / Android: Solid `View` met `rgba(globalColor, 0.85)`, `borderRadius: 24`
- **Breedte:** `screenWidth - 48pt` (24pt marge links + rechts)
- **Maximale hoogte:** 3 rijen × 128pt + titel = ~440pt (past op iPhone SE)
- **Titel:** 24pt bold, wit, gecentreerd
- **Module items:** Hergebruik `HomeGridItem` met verkleinde schaal (72pt → 56pt cirkel)
- **Sluiten:** Tap buiten de glass container OF swipe down

**Animatie:**
- Open: scale 0.8 → 1.0, opacity 0 → 1 (0.25s spring)
- Sluit: scale 1.0 → 0.8, opacity 1 → 0 (0.2s)
- Respecteert `reduceMotion`: geen scale, alleen opacity

### 6.2 CollectionOverlay Edit Mode

In wiggle mode (wanneer HomeScreen in wiggle mode is):
- Module items in overlay tonen "−" badge (links-boven)
- Tap op "−" → verwijder module uit verzameling (terug naar grid)
- Titel tonen "✏️" indicator → tap om te hernoemen
- Onderaan: "Verwijder verzameling" knop (alleen als leeg, anders disabled met uitleg)

### 6.3 Hernoemen Flow

1. Long-press op titel → `Alert.prompt()` met huidige naam als default
2. Gebruiker typt nieuwe naam → `renameCollection(id, newName)`
3. Naam update direct zichtbaar in overlay en grid

**Validatie:**
- Lege naam niet toegestaan
- Maximum 20 karakters (voorkomt overflow in grid label)

---

## 7. Fase 5: Drag & Drop Integratie

### Doel
Verzamelingen integreren in het bestaande drag & drop systeem.

### 7.1 HomeScreen.tsx Wijzigingen

**Bestand:** `src/screens/HomeScreen.tsx`

**Grid rendering:**
- `orderedModules` (nu `GridItem[]`) bevat mix van `NavigationDestination` en `CollectionReference`
- Bij render: check of item een `collection:` prefix heeft
  - Ja → render `CollectionGridItem`
  - Nee → render `HomeGridItem` (bestaand)

**Drag & drop uitbreidingen:**
- Module op module slepen → creëer nieuwe verzameling (naam prompt)
- Module op verzameling slepen → voeg toe aan verzameling (max 9 check)
- Verzameling op verzameling slepen → merge (optioneel, V2)
- Verzameling in grid verslepen → herpositioneren (zelfde als module)

**"+" knop in wiggle mode:**
- Als laatste item in het grid wanneer `isWiggleMode === true`
- 72pt cirkel met `+` icoon en "Nieuw" label
- Tap → naam prompt → lege verzameling aangemaakt
- Verschijnt NIET in normale modus

### 7.2 HomeGridItem.tsx — Collection Variant

**Bestand:** `src/components/HomeGridItem.tsx`

Nieuwe variant wanneer `isCollection={true}`:

```typescript
interface HomeGridItemProps {
  // Bestaande props...

  // NIEUW — collection variant
  isCollection?: boolean;
  collectionModules?: Array<{
    icon: IconName;
    color: string;
  }>; // Max 4 voor 2×2 preview
  collectionName?: string;
}
```

**2×2 Preview Rendering:**
```
┌───────────────────┐
│  ┌─────┬─────┐    │  ← 72pt container (zelfde als module cirkel)
│  │ 🗨️  │ 🔢  │    │     Achtergrond: rgba(moduleColor, 0.15)
│  │     │     │    │     Elke mini-cirkel: 28pt
│  ├─────┼─────┤    │     Mini-icoon: 16pt
│  │ 🃏  │ 👁️  │    │
│  │     │     │    │
│  └─────┴─────┘    │
│                   │
│    Spellen        │  ← 14pt label (zelfde als module)
└───────────────────┘
```

**Logica:**
- 0 modules: lege cirkel met "+" icoon
- 1 module: 1 icoon gecentreerd
- 2 modules: 2 iconen horizontaal
- 3 modules: 2 boven + 1 links-onder
- 4+ modules: 2×2 grid (eerste 4)
- Badge: totaal aantal modules als badge (alleen als >4)

**Touch targets:** Hele cel is tappable (96pt minimum), identiek aan normale modules.

---

## 8. Fase 6: iPad Split View Integratie

### Doel
Verzamelingen werken identiek op iPad (UX Consistentie Principe).

### Wijzigingen

**Bestand:** `src/screens/HomeScreen.tsx`

De `'pane'` variant van HomeScreen rendert al hetzelfde grid. Verzamelingen worden automatisch ondersteund omdat:
1. `orderedModules` is dezelfde data (via `useModuleOrder`)
2. `HomeGridItem` collection variant schaalt mee
3. `CollectionOverlay` opent als overlay over het actieve paneel

**CollectionOverlay op iPad:**
- Breedte: paneel-breedte - 48pt (niet scherm-breedte)
- Overlay is gecentreerd binnen het paneel, niet fullscreen
- Dim achtergrond bedekt alleen het paneel

---

## 9. Fase 7: i18n (13 talen)

### Nieuwe i18n Keys

Alle keys worden toegevoegd aan alle 13 locale bestanden.

#### Verzamelingen Keys

| Key | NL | EN |
|-----|----|----|
| `collections.games` | Spellen | Games |
| `collections.create` | Nieuwe verzameling | New collection |
| `collections.rename` | Hernoem verzameling | Rename collection |
| `collections.renamePrompt` | Geef een naam | Enter a name |
| `collections.delete` | Verwijder verzameling | Delete collection |
| `collections.deleteConfirm` | Weet je het zeker? | Are you sure? |
| `collections.cannotDelete` | Verwijder eerst alle modules | Remove all modules first |
| `collections.maxModules` | Maximaal 9 modules per verzameling | Maximum 9 modules per collection |
| `collections.dragHint` | Sleep een module op een andere om een verzameling te maken | Drag a module onto another to create a collection |

#### Spelmodule Keys

| Key | NL | EN |
|-----|----|----|
| `navigation.woordraad` | Woordraad | Word Guess |
| `navigation.sudoku` | Sudoku | Sudoku |
| `navigation.solitaire` | Solitaire | Solitaire |
| `navigation.memory` | Memory | Memory |
| `navigation.trivia` | Trivia | Trivia |
| `modules.game.comingSoon` | Binnenkort beschikbaar | Coming soon |

#### Globale Kleur Keys

| Key | NL | EN |
|-----|----|----|
| `settings.appearance.globalDefaultColor` | Standaard modulekleur | Default module colour |
| `settings.appearance.globalDefaultColorHint` | Wijzigt de kleur van alle modules | Changes the colour of all modules |
| `settings.appearance.usingDefault` | standaard | default |
| `settings.appearance.resetToDefault` | Herstel standaard | Reset to default |

**Alle 13 talen:** NL, EN, EN-GB, DE, FR, ES, IT, NO, SV, DA, PT, PT-BR, PL

---

## 10. Bestanden Overzicht

### Nieuwe Bestanden

| Bestand | Doel |
|---------|------|
| `src/hooks/useModuleCollections.ts` | CRUD + validatie voor verzamelingen |
| `src/components/CollectionOverlay.tsx` | Glass overlay voor verzameling inhoud |
| `src/screens/modules/GamePlaceholderScreen.tsx` | Placeholder voor 5 spelmodules |

### Gewijzigde Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/types/navigation.ts` | 5 spelmodule types + CollectionReference type |
| `src/types/liquidGlass.ts` | 5 spelmodule ModuleColorId + MODULE_TINT_COLORS entries |
| `src/hooks/useModuleOrder.ts` | GridItem type, collection-aware ordering |
| `src/hooks/useModuleUsage.ts` | 5 spelmodules in ALL_MODULES + DEFAULT_MODULE_ORDER |
| `src/contexts/ModuleColorsContext.tsx` | globalDefaultColor state + 3-laags resolutie + 5 spelmodules in CUSTOMIZABLE_MODULES/MODULE_LABELS |
| `src/screens/HomeScreen.tsx` | CollectionGridItem rendering, drag-on-drag, "+" knop in wiggle mode |
| `src/components/HomeGridItem.tsx` | Collection variant (2×2 preview) |
| `src/components/navigation/PanelNavigator.tsx` | 5 case statements → GamePlaceholderScreen |
| `src/screens/settings/AppearanceSettingsScreen.tsx` | Globale kleurinstelling UI |
| `src/components/Icon.tsx` | Eventueel nieuwe iconen (cards, etc.) |
| `src/locales/nl.json` | Nieuwe keys |
| `src/locales/en.json` | Nieuwe keys |
| `src/locales/en-GB.json` | Nieuwe keys |
| `src/locales/de.json` | Nieuwe keys |
| `src/locales/fr.json` | Nieuwe keys |
| `src/locales/es.json` | Nieuwe keys |
| `src/locales/it.json` | Nieuwe keys |
| `src/locales/no.json` | Nieuwe keys |
| `src/locales/sv.json` | Nieuwe keys |
| `src/locales/da.json` | Nieuwe keys |
| `src/locales/pt.json` | Nieuwe keys |
| `src/locales/pt-BR.json` | Nieuwe keys |
| `src/locales/pl.json` | Nieuwe keys |

**Totaal:** 3 nieuwe + 22 gewijzigde bestanden

---

## 11. Skill Validatie Matrix

### Classificatie: Tier 3 (Cross-cutting, meerdere modules)

| Skill | Validatie | Status |
|-------|-----------|--------|
| **architecture-lead** | Data model, type systeem, state management, AsyncStorage schema | ✅ Gevalideerd in PNA |
| **ui-designer** | Grid layout, touch targets (≥60pt), 2×2 preview, overlay design, form fields | ✅ Gevalideerd in PNA |
| **accessibility-specialist** | VoiceOver labels voor verzamelingen, reduceMotion respect, touch targets | ⏳ Valideren bij implementatie |
| **react-native-expert** | ScrollView + PanResponder integratie, overlay animaties, AsyncStorage | ⏳ Valideren bij implementatie |
| **ios-specialist** | Liquid Glass in CollectionOverlay, iPad Split View | ⏳ Valideren bij implementatie |
| **security-expert** | Geen encryptie/auth impact | ✅ N.v.t. |
| **testing-qa** | Unit tests voor useModuleCollections, drag & drop integration tests | ⏳ Na implementatie |

### Automatische Triggers (uit CLAUDE.md)

| Trigger | Geldt? | Actie |
|---------|--------|-------|
| UI componenten, styling | ✅ | ui-designer, accessibility-specialist |
| Navigatie | ✅ | architecture-lead, ui-designer |
| i18n, vertalingen | ✅ | ui-designer, documentation-writer |
| Nieuwe module (×5) | ✅ | Volledige module checklist (20+ checks per module) |
| Liquid Glass | ✅ | Feature Parity (CollectionOverlay alleen RN, geen native equivalent nodig) |

---

## 12. Open Items voor Tijdens Ontwikkeling

Items die tijdens implementatie gevalideerd/besloten worden:

| # | Item | Wanneer | Beslissing door |
|---|------|---------|-----------------|
| 1 | Exacte spelmodule iconen | Fase 2 — visueel testen | Gebruiker bevestigt na preview |
| 2 | Nieuwe SVG iconen nodig? (`cards` voor Solitaire) | Fase 2 — Icon.tsx check | Implementatie toont of bestaande voldoen |
| 3 | CollectionOverlay animatie timing | Fase 4 — op device testen | Finetunen op fysiek device |
| 4 | Drag-on-drag gevoeligheid | Fase 5 — op device testen | Senior-test op fysiek device |
| 5 | iPad paneel overlay positie | Fase 6 — iPad simulator | Visueel valideren |
| 6 | Accessibility labels voor verzamelingen | Fase 4 — VoiceOver test | accessibility-specialist |

---

## Implementatie Volgorde

```
Fase 1 (Globale kleur)
  └─→ Fase 2 (Spelmodules registratie)
       └─→ Fase 3 (Verzamelingen systeem)
            └─→ Fase 4 (CollectionOverlay)
                 └─→ Fase 5 (Drag & Drop)
                      └─→ Fase 6 (iPad)
                           └─→ Fase 7 (i18n — doorlopend in alle fasen)
```

Elke fase is afzonderlijk commitbaar en testbaar. Na elke fase: build validatie (⌘B) en visuele controle (⌘R).

---

## Referenties

- PNA overleg: 2026-03-13 (dit document)
- Liquid Glass infra: `.claude/plans/LIQUID_GLASS_IMPLEMENTATION.md`
- Glass Player Window: `.claude/plans/LIQUID_GLASS_PLAYER_WINDOW.md`
- HomeScreen Grid: `.claude/plans/HOMESCREEN_GRID_NAVIGATION.md`
- Module Color System: CLAUDE.md §14 "Module Color Single Source of Truth"
- Nieuwe Module Checklist: CLAUDE.md §"Nieuwe Module Validatie Checklist"
