# Plan: Homescreen Grid Navigation

## Probleem

Het huidige WheelNavigationMenu (long-press activated, 4 modules per pagina, usage-based sorting) schaalt niet goed met 16+ modules en is niet intuïtief voor senioren. Het vereist een verborgen gesture (long-press) om te activeren.

## Oplossing: iPhone-style Homescreen Grid

Een scrollbaar icon grid met 3 iconen per rij, vergelijkbaar met het iPhone homescreen. Het grid IS het startscherm — de app opent ermee.

---

## Design Beslissingen (uit PNA)

| Onderwerp | Beslissing |
|-----------|-----------|
| **Navigatiemodel** | Scrollbaar icon grid, 3 per rij |
| **Rol** | Grid IS het homescreen (Model A) |
| **iPad Split View** | Grid verschijnt tijdelijk IN het pane (vervangt module-inhoud) |
| **Volgorde** | Drag & drop met wiggle mode (long-press op grid), default: DEFAULT_MODULE_ORDER |
| **Verwijderen** | NIET mogelijk — alle modules blijven altijd zichtbaar |
| **Audio indicatie** | Mini-player bar op homescreen + pulserend icoon op actieve audio-module |
| **Mini-player tap** | Navigeert terug naar de module die audio afspeelt |
| **Notification badges** | Rode badges op communicatie-modules (Berichten, Bellen, Mail) |
| **Instellingen** | In het grid, versleepbaar, geen speciale positie |
| **Scrollgedrag** | Alle modules zichtbaar via scrollen, geen paginering |
| **Wiggle exit** | Grote "Klaar" knop (senior-friendly) |

---

## Architectuur Overzicht

### Huidige Flow (WheelNavigationMenu)

```
App Start → Laatste module (of chats) → Long-press → WheelMenu → Kies module
```

### Nieuwe Flow (Homescreen Grid)

```
App Start → HomeScreen Grid → Tik module → Module opent → "Home" knop → Terug naar grid
```

### iPad Flow

```
Pane toont module → Tik module-icoon in header → Grid verschijnt IN pane → Kies module → Grid verdwijnt
```

---

## Fases

### Fase 1: Data Layer — Module Order Persistence

**Nieuw bestand:** `src/services/moduleOrderService.ts`

```typescript
const STORAGE_KEY = '@commeazy/moduleOrder';

interface ModuleOrderData {
  order: string[];     // moduleId array in user-defined order
  updatedAt: number;
}

// Public API
export async function getModuleOrder(): Promise<string[] | null>;
export async function saveModuleOrder(order: string[]): Promise<void>;
export async function resetModuleOrder(): Promise<void>;
```

**Nieuw bestand:** `src/hooks/useModuleOrder.ts`

```typescript
interface UseModuleOrderReturn {
  /** Ordered list of moduleIds (user order or DEFAULT_MODULE_ORDER) */
  orderedModules: string[];
  /** Whether custom order is loaded */
  isLoaded: boolean;
  /** Update module order (after drag & drop) */
  updateOrder: (newOrder: string[]) => Promise<void>;
  /** Reset to default order */
  resetOrder: () => Promise<void>;
}
```

**Wijzig:** `src/hooks/index.ts` — export toevoegen
**Wijzig:** `src/services/music/index.ts` — export toevoegen (indien nodig)

**Relatie met useModuleUsage:** `useModuleUsage` blijft bestaan voor usage tracking (play stats, etc.), maar bepaalt NIET meer de module volgorde op het grid. De volgorde komt nu uit `useModuleOrder`.

---

### Fase 2: HomeScreen Component — Basis Grid

**Nieuw bestand:** `src/screens/HomeScreen.tsx`

Layout:
```
┌──────────────────────────────────────────┐
│  Safe Area                                │
├──────────────────────────────────────────┤
│  CommEazy [logo/tekst]                    │  ← Subtiele branding
├──────────────────────────────────────────┤
│                                          │
│  ┌────┐  ┌────┐  ┌────┐                │
│  │ 💬 │  │ 👤 │  │ 👥 │                │
│  │Chat │  │Cont│  │Groep│               │
│  └────┘  └────┘  └────┘                │
│                                          │
│  ┌────┐  ┌────┐  ┌────┐                │
│  │ 📞 │  │ 📻 │  │ 🎙️ │                │
│  │Bell │  │Radio│  │Podc│               │
│  └────┘  └────┘  └────┘                │
│                                          │
│  ┌────┐  ┌────┐  ┌────┐                │
│  │ 📚 │  │ 🌤️ │  │ 🎵 │                │
│  │Boek │  │Weer │  │Muzi│               │
│  └────┘  └────┘  └────┘                │
│                                          │
│  ┌────┐  ┌────┐  ┌────┐                │
│  │ 📷 │  │ 🖼️ │  │ 🤖 │                │
│  │Cam  │  │Foto│  │AI  │               │
│  └────┘  └────┘  └────┘                │
│                                          │
│  ┌────┐  ┌────┐  ┌────┐                │
│  │ 📧 │  │ 📅 │  │ ⚙️ │                │
│  │Mail │  │Agen│  │Inst│               │
│  └────┘  └────┘  └────┘                │
│                                          │
│  ┌────┐                                 │
│  │ ❓ │                                 │
│  │Help │                                │
│  └────┘                                 │
│                                          │
├──────────────────────────────────────────┤
│  [Mini-player bar — alleen als audio]    │
└──────────────────────────────────────────┘
```

**Grid Item specificaties:**
- 3 kolommen
- Breedte per cel: `(screenWidth - 2 * padding - 2 * gap) / 3`
- Icoon: 48pt in cirkel van 72pt met module tint color achtergrond
- Label: 14pt, max 2 regels, `numberOfLines={2}`, center-aligned
- Touch target: volledige cel (≥ 96×96pt)
- Gap tussen cellen: 12pt
- Padding links/rechts: 16pt

**Badge specificaties:**
- Rode cirkel (min 22pt), rechtsboven het icoon
- Witte tekst, bold
- Alleen voor: chats (unread), calls (missed), mail (unread)

**Audio indicator:**
- Pulserende ring animatie rondom het icoon van de actieve audio-module
- Respecteert reduced motion (statische ring in dat geval)
- Kleur: module tint color

**Component structuur:**
```typescript
// HomeScreen.tsx
function HomeScreen({ onModulePress, onMiniPlayerPress }) {
  const { orderedModules, isLoaded } = useModuleOrder();
  const moduleColor = useModuleColor;
  // ... badge counts from contexts
  // ... active audio from MediaIndicator logic

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={styles.grid}>
          {orderedModules.map(moduleId => (
            <HomeGridItem
              key={moduleId}
              moduleId={moduleId}
              icon={STATIC_MODULE_DEFINITIONS[moduleId].icon}
              label={t(`navigation.${moduleId}`)}
              color={moduleColor(moduleId)}
              badgeCount={getBadgeCount(moduleId)}
              isAudioActive={activeAudioModule === moduleId}
              onPress={() => onModulePress(moduleId)}
            />
          ))}
        </View>
      </ScrollView>
      {activeAudio && (
        <HomeMiniPlayer
          onPress={onMiniPlayerPress}
          // ... audio metadata
        />
      )}
    </SafeAreaView>
  );
}
```

**Nieuw bestand:** `src/components/HomeGridItem.tsx`

```typescript
interface HomeGridItemProps {
  moduleId: string;
  icon: IconName;
  label: string;
  color: string;
  badgeCount?: number;
  isAudioActive?: boolean;
  isWiggling?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}
```

---

### Fase 3: Navigation Integration — Grid als Startscherm

**Wijzig:** `src/components/navigation/AdaptiveNavigationWrapper.tsx`

Huidige flow:
```
AdaptiveNavigationWrapper → HoldToNavigateWrapper → SinglePaneLayout
```

Nieuwe flow:
```
AdaptiveNavigationWrapper → HomeScreenNavigator
  ├── HomeScreen (initial route)
  └── ModuleScreen (opens when grid item tapped)
      └── HoldToNavigateWrapper → SinglePaneLayout (module content)
```

**Key changes:**
- App start toont HomeScreen (niet laatste module)
- Tik op grid item → navigate naar module
- "Home" knop in ModuleHeader → navigate terug naar grid

**Wijzig:** `src/components/ModuleHeader.tsx`

Nieuwe prop: `showHomeButton?: boolean` (default: true op iPhone)

```
┌──────────────────────────────────────────┐
│  [🏠] [📻 Radio]          [MediaIndicator]│
└──────────────────────────────────────────┘
```

Home button (links, voor het module-icoon):
- 60×60pt touch target
- Icoon: `grid` of `home` (uit bestaande IconName set)
- Tap: navigeert naar HomeScreen
- NIET zichtbaar als `showBackButton={true}` (sub-screens)

**Wijzig:** `src/components/HoldToNavigateWrapper.tsx`

Long-press op module scherm opent NIET meer WheelMenu, maar navigeert terug naar HomeScreen grid. Of: long-press wordt puur voor voice commands (twee vingers). Single-finger long-press kan worden verwijderd of optioneel gemaakt.

**Impact analyse:**
- WheelNavigationMenu wordt NIET verwijderd in deze fase (iPad pane switching gebruikt het nog)
- HoldToNavigateWrapper behoudt two-finger gesture voor voice commands
- Single-finger long-press → deprecate of redirect naar home

---

### Fase 4: iPad Pane Grid — Grid als Module Switcher

**Wijzig:** `src/components/navigation/ModulePanel.tsx` (of nieuw component)

Op iPad, wanneer gebruiker op module-icoon tikt in een pane header:
1. Grid verschijnt IN het pane (vervangt module content tijdelijk)
2. Gebruiker tikt op module in grid → die module laadt in dat pane
3. Grid verdwijnt

**Implementatie:**
```typescript
// In ModulePanel of PanelNavigator
const [showPaneGrid, setShowPaneGrid] = useState(false);

// ModuleHeader onModuleIconPress:
onModuleIconPress={() => setShowPaneGrid(true)}

// Render:
{showPaneGrid ? (
  <HomeScreen
    onModulePress={(moduleId) => {
      setPaneModule(panelId, moduleId);
      setShowPaneGrid(false);
    }}
    variant="pane" // Compactere layout voor pane
  />
) : (
  <ModuleContent ... />
)}
```

**HomeScreen variant prop:**
- `"fullscreen"` (iPhone) — Full SafeAreaView, branding header, mini-player
- `"pane"` (iPad pane) — Geen SafeAreaView (pane beheert dit), geen branding, geen mini-player (al zichtbaar via GlassPlayer)

---

### Fase 5: Drag & Drop — Wiggle Mode

**Wijzig:** `src/screens/HomeScreen.tsx`

Wiggle mode activatie:
1. Long-press (800ms) op een grid item → haptic feedback
2. Alle items beginnen te wiggelen (rotate animation ±2°, 200ms cycle)
3. "Klaar" knop verschijnt bovenaan (60pt, prominent)
4. Drag & drop: user versleept item naar nieuwe positie
5. Tap "Klaar" → wiggle stopt, nieuwe volgorde opgeslagen

**React Native implementatie:**

```typescript
// Gebruik react-native-draggable-grid of custom PanResponder
// Wiggle animation:
const wiggleAnim = useRef(new Animated.Value(0)).current;

useEffect(() => {
  if (isWiggling) {
    Animated.loop(
      Animated.sequence([
        Animated.timing(wiggleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(wiggleAnim, { toValue: -1, duration: 200, useNativeDriver: true }),
        Animated.timing(wiggleAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ])
    ).start();
  } else {
    wiggleAnim.setValue(0);
  }
}, [isWiggling]);

const wiggleRotation = wiggleAnim.interpolate({
  inputRange: [-1, 1],
  outputRange: ['-2deg', '2deg'],
});
```

**Reduced motion:** Geen wiggle animatie, items krijgen subtiele border highlight.

**Accessibility:** VoiceOver "move item" rotor action voor blinde gebruikers.

**Geen verwijder-optie:** Geen "X" badge, geen verwijder gesture. Items kunnen alleen verplaatst worden.

---

### Fase 6: Notification Badges

**Nieuw bestand:** `src/hooks/useModuleBadges.ts`

```typescript
interface UseModuleBadgesReturn {
  getBadgeCount: (moduleId: string) => number | undefined;
}

// Aggregeert badge counts uit bestaande contexts:
// chats → unread message count (uit ChatContext of XMPP)
// calls → missed call count (uit CallContext)
// mail → unread mail count (uit MailContext, al beschikbaar via useMailUnreadCount)
```

**Badge weergave:**
- Alleen voor `chats`, `calls`, `mail`
- Rode cirkel (min-width 22pt, height 22pt)
- Witte tekst, bold, 12pt
- Max "99+" voor grote aantallen
- Gepositioneerd top-right van het icoon cirkel

---

### Fase 7: HomeMiniPlayer — Audio op Homescreen

**Nieuw bestand:** `src/components/HomeMiniPlayer.tsx`

Compact mini-player bar onderaan het HomeScreen:

```
┌──────────────────────────────────────────┐
│  [🎵] Artiest - Nummer          [▶/⏸]  │
│       Radio Veronica              [⏹]   │
└──────────────────────────────────────────┘
```

**Specificaties:**
- Hoogte: 72pt
- Achtergrond: module tint color (met opacity)
- Artwork: 48pt afgerond vierkant
- Titel + subtitel
- Play/pause + stop knoppen (60pt touch targets)
- Tap op de bar (niet knoppen) → navigeert naar audio module

**Data flow:**
- Hergebruikt bestaande MediaIndicator logica voor active audio detection
- Leest metadata uit RadioContext / PodcastContext / AppleMusicContext / BooksContext
- `onPress` → `onMiniPlayerPress` → navigate naar de module die audio afspeelt

**Relatie met native GlassPlayer:**
- Op iOS 26+: GlassPlayer overlay is BOVENOP het homescreen
- HomeMiniPlayer is de React Native fallback voor iOS <26 en Android
- Beide tonen dezelfde informatie maar met verschillende rendering

---

### Fase 8: WheelMenu Cleanup & Migration

**Na succesvolle grid implementatie:**

1. **WheelNavigationMenu** → Verwijderen of deprecaten
   - iPad pane switching gaat via grid-in-pane (Fase 4)
   - iPhone navigatie gaat via HomeScreen (Fase 3)
   - WheelMenuContext kan worden opgeruimd

2. **HoldToNavigateWrapper** → Vereenvoudigen
   - Single-finger long-press: niet meer nodig (was voor WheelMenu)
   - Two-finger long-press: BEHOUDEN voor voice commands
   - Of: single-finger long-press op HomeScreen → wiggle mode

3. **useModuleUsage** → Vereenvoudigen
   - `getTopModules()` / `getRemainingModules()` → niet meer nodig
   - `recordModuleUsage()` → optioneel behouden voor analytics
   - `DEFAULT_MODULE_ORDER` → verhuist naar `useModuleOrder`

4. **ModuleHeader** → Aanpassen
   - iPhone: Home button i.p.v. module-icoon-als-WheelMenu-trigger
   - iPad: Module-icoon opent grid-in-pane (i.p.v. WheelMenu)

---

### Fase 9: i18n — Nieuwe Keys

Nieuwe keys in alle 13 locales:

```json
{
  "homeScreen": {
    "title": "CommEazy",
    "editMode": "Wijzig volgorde",
    "editModeDone": "Klaar",
    "miniPlayer": {
      "nowPlaying": "Nu aan het spelen",
      "tapToOpen": "Tik om te openen"
    }
  },
  "navigation": {
    "home": "Home",
    "backToHome": "Terug naar startscherm"
  }
}
```

Bestaande `navigation.*` keys (module namen) worden hergebruikt.

---

## Bestanden Overzicht

| Bestand | Actie | Fase |
|---------|-------|------|
| `src/services/moduleOrderService.ts` | NIEUW | 1 |
| `src/hooks/useModuleOrder.ts` | NIEUW | 1 |
| `src/hooks/index.ts` | WIJZIG (export) | 1 |
| `src/screens/HomeScreen.tsx` | NIEUW | 2 |
| `src/components/HomeGridItem.tsx` | NIEUW | 2 |
| `src/components/navigation/AdaptiveNavigationWrapper.tsx` | WIJZIG | 3 |
| `src/components/ModuleHeader.tsx` | WIJZIG (home button) | 3 |
| `src/components/HoldToNavigateWrapper.tsx` | WIJZIG (single-finger deprecate) | 3 |
| `src/components/navigation/PanelNavigator.tsx` | WIJZIG (iPad grid) | 4 |
| `src/screens/HomeScreen.tsx` | WIJZIG (wiggle mode) | 5 |
| `src/hooks/useModuleBadges.ts` | NIEUW | 6 |
| `src/components/HomeMiniPlayer.tsx` | NIEUW | 7 |
| `src/components/WheelNavigationMenu.tsx` | VERWIJDEREN/DEPRECATE | 8 |
| 13× `src/locales/*.json` | WIJZIG | 9 |

## Wat NIET verandert

- **Module screens** — RadioScreen, PodcastScreen, etc. blijven ongewijzigd
- **Audio playback** — Contexts en services ongewijzigd
- **Voice commands** — Two-finger gesture blijft werken
- **GlassPlayer (iOS 26+)** — Ongewijzigd, werkt bovenop elk scherm
- **iPad Split View basis** — DraggableDivider, PaneContext blijven
- **Onboarding flow** — Ongewijzigd

## Risico's & Mitigatie

| Risico | Impact | Mitigatie |
|--------|--------|-----------|
| Drag & drop in React Native ScrollView | Hoog | Gebruik `react-native-draggable-flatlist` of custom PanResponder. Test op oudere devices. |
| Label truncatie in 13 talen | Medium | `numberOfLines={2}` + `adjustsFontSizeToFit` met `minimumFontScale={0.85}`. Test DE (+30%) en FR (+20%). |
| Wiggle animation performance | Medium | `useNativeDriver: true`. Respecteer reduced motion. Max 20 items tegelijk. |
| Navigatie-overgang homescreen ↔ module | Medium | Gebruik `react-navigation` stack met slide animation. Geen custom gestures. |
| iPad pane grid vs fullscreen grid inconsistentie | Laag | `variant` prop op HomeScreen ("fullscreen" vs "pane"). Zelfde grid component, andere wrapper. |

## Verificatie

1. **iPhone:** App opent met grid → tik Radio → Radio opent → Home knop → terug naar grid
2. **iPad:** Pane toont module → tik module-icoon → grid in pane → kies andere module → grid verdwijnt
3. **Audio:** Start radio → ga naar grid → pulserend icoon + mini-player zichtbaar → tik mini-player → terug naar radio
4. **Drag & drop:** Long-press op grid → wiggle mode → versleep icoon → tik "Klaar" → volgorde opgeslagen → app herstart → volgorde behouden
5. **Badges:** Ongelezen bericht → rode badge op Berichten icoon
6. **Reduced motion:** Geen wiggle animatie, geen pulserende ring, statische indicatoren
7. **13 talen:** Labels passen in cel (test DE, FR, PT-BR voor langste namen)
8. **VoiceOver:** Alle grid items bereikbaar, drag & drop via rotor
