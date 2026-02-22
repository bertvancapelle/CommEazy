# Liquid Glass True Transparency — Implementatieplan Optie B

## Doel

Implementeer **echte see-through blur** voor MiniPlayer en ModuleHeader zodat onderliggende content (stationslijst, episodes, etc.) zichtbaar door het glas effect heen beweegt.

---

## Probleemanalyse

### Huidige Situatie

```
┌─────────────────────────────────────────────────────────────┐
│  View (container)                                            │
│  ├── ModuleHeader (LiquidGlassView)    ← Geen content onder │
│  ├── ScrollView (stationslijst)        ← SIBLING van player │
│  └── MiniPlayer (LiquidGlassView)      ← Geen content onder │
└─────────────────────────────────────────────────────────────┘
```

**Probleem:** UIBlurEffect kan alleen content blurren die:
- Een **parent** is van de blur view, of
- Een **sibling** is in dezelfde view branch

MiniPlayer en ScrollView zijn siblings op hetzelfde niveau, maar de ScrollView content zit BOVEN de MiniPlayer in de DOM — niet ONDER. Daardoor is er niets om te blurren.

### Gewenste Situatie

```
┌─────────────────────────────────────────────────────────────┐
│  View (container)                                            │
│  ├── ScrollView (stationslijst)        ← UNDER the overlay  │
│  │   └── Content extends full height                         │
│  │                                                           │
│  └── View (absolute overlay layer)     ← OVER de content    │
│      ├── ModuleHeader (top)            ← Blurs content      │
│      └── MiniPlayer (bottom)           ← Blurs content      │
└─────────────────────────────────────────────────────────────┘
```

**Oplossing:** MiniPlayer en ModuleHeader worden absolute positioned overlays die OVER de content heen liggen. De content ScrollView extends full-height underneath.

---

## Betrokken Components

### Direct Aangepast

| Component | Huidige Locatie | Wijziging |
|-----------|-----------------|-----------|
| **MiniPlayer** | `src/components/MiniPlayer.tsx` | Props voor absolute positioning |
| **ModuleHeader** | `src/components/ModuleHeader.tsx` | Props voor absolute positioning |
| **RadioScreen** | `src/screens/modules/RadioScreen.tsx` | Layout refactor |
| **PodcastScreen** | `src/screens/modules/PodcastScreen.tsx` | Layout refactor |
| **BookPlayerScreen** | `src/screens/modules/BookPlayerScreen.tsx` | Layout refactor (already absolute) |

### Native Module Update

| Module | Wijziging |
|--------|-----------|
| **LiquidGlassModule.swift** | Gebruik UIBlurEffect in plaats van visuele lagen |

---

## Architectuur Keuze

### Twee Opties voor Overlay Container

**Optie A: Per-Screen Overlay**
Elke screen beheert zijn eigen overlay layer.

```typescript
// In RadioScreen.tsx
<View style={styles.container}>
  {/* Content layer — extends full height */}
  <ScrollView style={styles.fullHeightContent}>
    {stationItems}
  </ScrollView>

  {/* Overlay layer — absolute positioned */}
  <View style={styles.overlayLayer} pointerEvents="box-none">
    <ModuleHeader {...props} />
    {/* Spacer to push MiniPlayer to bottom */}
    <View style={{ flex: 1 }} pointerEvents="none" />
    {contextStation && <MiniPlayer {...props} />}
  </View>
</View>
```

**Voordeel:** Geen globale state nodig, screen-specifieke controle.
**Nadeel:** Duplicatie in elke screen.

**Optie B: Global Overlay Provider (AANBEVOLEN)**
Eén centrale overlay container die van buitenaf bestuurd wordt.

```typescript
// OverlayProvider.tsx
<View style={styles.appContainer}>
  {children}  {/* All screens render here */}

  <View style={styles.globalOverlay} pointerEvents="box-none">
    <OverlayHeaderSlot />  {/* ModuleHeader renders here */}
    <View style={{ flex: 1 }} pointerEvents="none" />
    <OverlayPlayerSlot />  {/* MiniPlayer renders here */}
  </View>
</View>

// Usage in screens
const { setHeaderContent, setPlayerContent } = useOverlay();
useEffect(() => {
  setHeaderContent(<ModuleHeader ... />);
  setPlayerContent(<MiniPlayer ... />);
  return () => {
    setHeaderContent(null);
    setPlayerContent(null);
  };
}, []);
```

**Voordeel:** Consistente z-ordering, geen duplicatie, makkelijker te onderhouden.
**Nadeel:** Meer complexiteit in state management.

### Aanbeveling: Optie A (Per-Screen)

Voor CommEazy kiezen we **Optie A** omdat:
1. Slechts 3 screens gebruiken MiniPlayer
2. ModuleHeader is al per-screen
3. Minder architecturele wijzigingen
4. Eenvoudiger te testen

---

## Implementatiefasen

### Fase 1: Native Module Update (iOS)

**Doel:** Echte UIBlurEffect implementeren die transparant is.

**Bestand:** `ios/LiquidGlassModule.swift`

**Wijzigingen:**

```swift
// VERVANG createBlurWithTintEffect() met:
private func createRealBlurEffect() {
    // iOS 26+: UIGlassEffect
    if #available(iOS 26, *) {
        createLiquidGlassEffect()
        return
    }

    // iOS 13-25: UIBlurEffect met tint overlay
    let blurStyle: UIBlurEffect.Style = .systemThinMaterial
    let blurEffect = UIBlurEffect(style: blurStyle)
    let blurView = UIVisualEffectView(effect: blurEffect)
    blurView.translatesAutoresizingMaskIntoConstraints = false
    blurView.layer.cornerRadius = cornerRadius
    blurView.clipsToBounds = cornerRadius > 0

    // Tint overlay INSIDE the blur view's contentView
    if let baseColor = UIColor(hexString: tintColorHex) {
        let tintOverlay = UIView()
        tintOverlay.translatesAutoresizingMaskIntoConstraints = false
        tintOverlay.backgroundColor = baseColor.withAlphaComponent(tintIntensity * 0.5)
        blurView.contentView.addSubview(tintOverlay)
        // ... constraints
    }

    // Set background clear so blur shows through
    backgroundColor = .clear

    insertSubview(blurView, at: 0)
    // ... constraints
    glassEffectView = blurView
}
```

**Test:** Build in Xcode, check of blur view transparant is.

---

### Fase 2: Screen Layout Refactor — RadioScreen

**Doel:** MiniPlayer als absolute overlay over ScrollView.

**Bestand:** `src/screens/modules/RadioScreen.tsx`

**Huidige Structuur:**
```typescript
<View style={styles.container}>
  <ModuleHeader ... />
  <View style={styles.tabBar}>...</View>
  {showFavorites ? <FavoritesList /> : <SearchContent />}
  <ScrollView style={styles.stationList}>
    {stations.map(...)}
  </ScrollView>
  {contextStation && <MiniPlayer ... />}  {/* SIBLING */}
</View>
```

**Nieuwe Structuur:**
```typescript
<View style={styles.container}>
  {/* Content Layer — extends under header and player */}
  <ScrollView
    style={styles.fullHeightContent}
    contentContainerStyle={{
      paddingTop: HEADER_HEIGHT + insets.top,  // Space for header
      paddingBottom: MINI_PLAYER_HEIGHT + insets.bottom,  // Space for player
    }}
  >
    <View style={styles.tabBar}>...</View>
    {showFavorites ? <FavoritesList /> : <SearchContent />}
    {stations.map(...)}
  </ScrollView>

  {/* Overlay Layer — absolute positioned */}
  <View style={styles.overlayLayer} pointerEvents="box-none">
    <ModuleHeader
      ...
      style={styles.absoluteHeader}  // position: absolute, top: 0
    />
    {contextStation && (
      <MiniPlayer
        ...
        style={styles.absolutePlayer}  // position: absolute, bottom: 0
      />
    )}
  </View>
</View>
```

**Nieuwe Styles:**
```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fullHeightContent: {
    flex: 1,
    // NO paddingTop here — content starts at 0
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    // pointerEvents="box-none" allows touches to pass through
  },
  absoluteHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  absolutePlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
```

---

### Fase 3: MiniPlayer Component Update

**Doel:** Accept optional `style` prop for absolute positioning.

**Bestand:** `src/components/MiniPlayer.tsx`

**Wijzigingen:**

```typescript
export interface MiniPlayerProps {
  // ... existing props

  /** Optional style override for positioning */
  style?: StyleProp<ViewStyle>;
}

export function MiniPlayer({
  // ... existing props
  style,
}: MiniPlayerProps) {
  // ...

  if (useLiquidGlass && moduleId) {
    return (
      <LiquidGlassView
        moduleId={moduleId}
        fallbackColor={accentColor}
        style={[styles.container, style]}  // Merge styles
        cornerRadius={0}
      >
        {/* ... */}
      </LiquidGlassView>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, styles.touchableContent, { backgroundColor: accentColor }, style]}
      // ...
    >
      {/* ... */}
    </TouchableOpacity>
  );
}
```

---

### Fase 4: ModuleHeader Component Update

**Doel:** Accept optional `style` prop for absolute positioning.

**Bestand:** `src/components/ModuleHeader.tsx`

**Wijzigingen:** Vergelijkbaar met MiniPlayer — add `style` prop en merge met container style.

---

### Fase 5: PodcastScreen Layout Refactor

**Doel:** Zelfde pattern als RadioScreen.

**Bestand:** `src/screens/modules/PodcastScreen.tsx`

**Wijzigingen:** Identiek aan RadioScreen refactor.

---

### Fase 6: BookPlayerScreen Validatie

**Doel:** Valideer dat huidige absolute positioning werkt.

**Bestand:** `src/screens/modules/BookPlayerScreen.tsx`

**Status:** BookPlayerScreen gebruikt REEDS `position: 'absolute'` voor MiniPlayer. Valideer dat blur effect werkt na native module update.

---

## Layout Constanten

```typescript
// src/constants/layout.ts

export const HEADER_HEIGHT = 120;  // ModuleHeader + AdMob
export const MINI_PLAYER_HEIGHT = 84;  // touchTargets.comfortable

// Dynamic heights (with safe area insets)
export const getHeaderHeight = (insets: EdgeInsets) =>
  HEADER_HEIGHT + insets.top;

export const getMiniPlayerHeight = (insets: EdgeInsets) =>
  MINI_PLAYER_HEIGHT + insets.bottom;

export const getContentPadding = (insets: EdgeInsets, hasMiniPlayer: boolean) => ({
  paddingTop: getHeaderHeight(insets),
  paddingBottom: hasMiniPlayer ? getMiniPlayerHeight(insets) : insets.bottom,
});
```

---

## Testplan

### Unit Tests

| Test | Verwacht |
|------|----------|
| MiniPlayer met style prop | Style wordt gemerged |
| ModuleHeader met style prop | Style wordt gemerged |

### Visuele Tests

| Test | Device | Verwacht |
|------|--------|----------|
| Scroll under MiniPlayer | iOS 26+ Sim | Content zichtbaar door blur |
| Scroll under MiniPlayer | iOS 18 Sim | Tinted blur fallback |
| Scroll under ModuleHeader | iOS 26+ Sim | Content zichtbaar door blur |
| Touch on MiniPlayer | Any | Play/pause werkt |
| Touch on station under player | Any | Touch passes through to station |

### Accessibility Tests

| Test | Verwacht |
|------|----------|
| VoiceOver station lijst | Stations focusable, volgorde correct |
| VoiceOver MiniPlayer | Player controls announced |
| Touch targets | ≥60pt op alle knoppen |

---

## Risico's en Mitigatie

| Risico | Impact | Mitigatie |
|--------|--------|-----------|
| **Z-index issues** | Touch niet doorgestuurd | `pointerEvents="box-none"` op overlay |
| **ScrollView clipping** | Content afgekapt | Remove `overflow: hidden` |
| **Performance** | Jank bij scroll | Test op iPhone SE, optimize blur radius |
| **Safe area insets** | Content onder notch | Dynamic padding berekening |
| **Existing tests breaking** | CI failures | Update snapshot tests |

---

## Migratiestrategie

### Stapsgewijs per Screen

1. **Week 1:** Native module update + RadioScreen
2. **Week 2:** PodcastScreen + BookPlayerScreen validatie
3. **Week 3:** Edge cases, accessibility audit, polish

### Rollback Plan

Als blur effect performance issues veroorzaakt:
1. Disable blur met feature flag: `Settings > Liquid Glass > Transparency = Off`
2. Fallback naar huidige visuele effect (gradient lagen)

---

## Samenvatting Wijzigingen

| Bestand | Actie |
|---------|-------|
| `ios/LiquidGlassModule.swift` | Replace visual layers with real UIBlurEffect |
| `src/components/MiniPlayer.tsx` | Add `style` prop |
| `src/components/ModuleHeader.tsx` | Add `style` prop |
| `src/screens/modules/RadioScreen.tsx` | Full layout refactor |
| `src/screens/modules/PodcastScreen.tsx` | Full layout refactor |
| `src/screens/modules/BookPlayerScreen.tsx` | Validate existing absolute positioning |
| `src/constants/layout.ts` | NEW: Layout constants |

---

## Goedkeuring

Dit plan MOET gevalideerd worden door:
- **architecture-lead** — Structurele wijzigingen
- **ui-designer** — Visual impact
- **ios-specialist** — Native module wijzigingen
- **accessibility-specialist** — Touch target en VoiceOver impact

---

## Volgende Stappen

Na goedkeuring van dit plan:

1. **Fase 1 starten:** Native module update in `LiquidGlassModule.swift`
2. Test blur effect werkt met echte transparency
3. **Fase 2 starten:** RadioScreen layout refactor
4. Iteratief testen en valideren

**Geschatte doorlooptijd:** 1-2 weken

---

*Plan gemaakt: 2026-02-22*
*Gebaseerd op: CommEazy Liquid Glass implementation*
