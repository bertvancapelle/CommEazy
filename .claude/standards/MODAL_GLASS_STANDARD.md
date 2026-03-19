# Modal & Liquid Glass Standard — CommEazy

> **Single Source of Truth** voor alle modal implementaties in CommEazy.
> Bij twijfel: dit document wint van verspreidde referenties in CLAUDE.md of SKILL.md bestanden.

---

## 1. Drie-Lagen Architectuur

Elke modal in CommEazy bestaat uit drie lagen. Elke laag heeft een specifiek doel en mag NIET worden overgeslagen (tenzij expliciet uitgezonderd in sectie 4).

```
┌─ Laag 1: PanelAwareModal ─────────────────────────────────────┐
│  DOEL: Platform-aware container                                │
│  - iPhone: native <Modal> (full-screen)                        │
│  - iPad Split View: absolute <View> (binnen panel)             │
│  WAAROM: Native Modal ontsnapt op iPad uit het panel.          │
│          PanelAwareModal detecteert split view en rendert       │
│          een geclipte overlay die binnen het panel blijft.      │
│                                                                 │
│  ┌─ Laag 2: LiquidGlassView ──────────────────────────────┐   │
│  │  DOEL: Visuele glass appearance                          │   │
│  │  - iOS 26+: native UIGlassEffect (6 lagen, zie sectie 5)│   │
│  │  - iOS <26 / Android: solid fallback kleur               │   │
│  │  WAAROM: Progressive enhancement. Dezelfde code werkt    │   │
│  │          op alle platforms, alleen het visuele verschilt. │   │
│  │                                                           │   │
│  │  ┌─ Laag 3: ModalLayout ──────────────────────────────┐  │   │
│  │  │  DOEL: Content orchestratie + toolbar reordering    │  │   │
│  │  │  - "top": Header → Content → Footer                │  │   │
│  │  │  - "bottom": Content → Footer → Header             │  │   │
│  │  │  WAAROM: Gebruiker kan in Instellingen kiezen of    │  │   │
│  │  │          de toolbar boven of onder staat. ModalLayout│  │   │
│  │  │          respecteert deze keuze automatisch.        │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Modal Classificatie

### Beslisboom

```
Nieuwe modal nodig?
│
├─ Toont het een developer tool? → Categorie 3 (geen glass, geen ModalLayout)
│
├─ Is het een audio/video player? → Categorie 4 (eigen architectuur)
│
├─ Is het een full-screen viewer (foto, artikel, slideshow)?
│  └─ Ja → Categorie 2 (glass, GEEN ModalLayout)
│
└─ Al het andere → Categorie 1 (glass + ModalLayout — STANDAARD)
```

### Overzicht

| Cat. | Type | PanelAwareModal | LiquidGlassView | ModalLayout | cornerRadius |
|------|------|-----------------|-----------------|-------------|--------------|
| **1** | Standaard dialoog | ✅ VERPLICHT | ✅ VERPLICHT | ✅ VERPLICHT | `0` (full-screen) of `borderRadius.lg` (rounded) |
| **2** | Full-screen viewer | ✅ VERPLICHT | ✅ VERPLICHT | ❌ UITGEZONDERD | eigen layout |
| **3** | Development tools | ✅ VERPLICHT | ❌ UITGEZONDERD | ❌ UITGEZONDERD | n.v.t. |
| **4** | Players | eigen architectuur | eigen architectuur | eigen architectuur | n.v.t. |

### Wanneer cornerRadius=0 vs borderRadius.lg

| cornerRadius | Wanneer gebruiken | Visueel effect |
|--------------|-------------------|----------------|
| `0` | Modal vult heel het scherm (discovery search, detail views) | Geen highlight, geen border, geen shadow. Top -20pt overflow om UIGlassEffect edge te verbergen. |
| `borderRadius.lg` (16pt) | Centered/bottom-sheet modale dialogen (pickers, welcome, confirmation) | Specular highlight, edge border, shadow zichtbaar. |

**Rationale cornerRadius=0:** Bij full-screen modals zijn er geen zichtbare randen. Highlight/border/shadow zouden een witte lijn bovenaan het scherm creëren — ongewenst.

---

## 3. Toolbar Position: Twee Niveaus van Reordering

### Niveau 1: Block-level (automatisch via ModalLayout)

ModalLayout verplaatst headerBlock, contentBlock en footerBlock op basis van de toolbar position instelling:

```
"top" (default):              "bottom":
┌─ headerBlock ─┐             ┌─ contentBlock ─┐
│ controls       │             │ scroll content  │
├─ contentBlock ─┤             ├─ footerBlock ──┤
│ scroll content │             │ buttons         │
├─ footerBlock ──┤             ├─ headerBlock ──┤
│ buttons        │             │ controls        │
└────────────────┘             └────────────────┘
```

### Niveau 2: Children-level (consumer verantwoordelijkheid)

Wanneer een headerBlock **meerdere verticale children** bevat, MOETEN deze children ook van volgorde wisselen bij "bottom". Anders staan controls die dicht bij de content horen (SearchBar) ver van de content.

**Voorbeeld — ZONDER children reordering:**
```
"top" (correct):              "bottom" (FOUT):
┌─ Safe area spacer ─┐       ├─ Content ──────┤
│ ChipSelector        │       │                 │
│ SearchBar           │       ├─────────────────┤
├─ Content ───────────┤       │ Safe area spacer│  ← Ver van content
│                     │       │ ChipSelector    │
                              │ SearchBar       │  ← Ver van content
```

**Voorbeeld — MET children reordering (column-reverse):**
```
"top" (correct):              "bottom" (correct):
┌─ Safe area spacer ─┐       ├─ Content ──────┤
│ ChipSelector        │       │                 │
│ SearchBar           │       ├─────────────────┤
├─ Content ───────────┤       │ SearchBar       │  ← Dicht bij content ✅
│                     │       │ ChipSelector    │
                              │ Safe area spacer│  ← Bovenaan, uit de weg ✅
```

### Wanneer useModalLayoutBottom() VERPLICHT is

| headerBlock bevat... | Hook nodig? | Reden |
|----------------------|-------------|-------|
| Eén horizontale rij (titel + knop) | ❌ NEE | Eén rij heeft geen volgorde |
| Eén enkel element (alleen titel) | ❌ NEE | Niets om te herschikken |
| Meerdere verticale children (spacer → chips → search) | ✅ JA | Volgorde moet omkeren |

### Implementatie

```typescript
import { ModalLayout, useModalLayoutBottom } from '@/components/ModalLayout';

// In component body:
const { isBottom, headerStyle } = useModalLayoutBottom();

// In JSX:
<ModalLayout
  headerBlock={
    <View style={[styles.searchSection, headerStyle]}>
      {/* Safe area spacer — hoogte afhankelijk van positie */}
      <View style={{ height: isBottom ? 4 : insets.top }} />
      <ChipSelector ... />
      <SearchBar ... />
    </View>
  }
  contentBlock={...}
/>
```

**Hoe headerStyle werkt:** Het voegt `flexDirection: 'column-reverse'` toe aan de container View. CSS column-reverse keert de visuele volgorde van children om zonder de DOM volgorde te wijzigen.

---

## 4. Implementatie Templates

### Template A: Full-Screen Discovery Search Modal (Categorie 1, cornerRadius=0)

Gebruik voor: Radio zoeken, Podcast zoeken, Mail zoeken, etc.

```typescript
import { PanelAwareModal, SearchBar, ChipSelector, IconButton } from '@/components';
import { LiquidGlassView } from '@/components/LiquidGlassView';
import { ModalLayout, useModalLayoutBottom } from '@/components/ModalLayout';
import { useModuleColor } from '@/contexts/ModuleColorsContext';

function MySearchModal({ visible, onClose, moduleId }: Props) {
  const { isBottom, headerStyle } = useModalLayoutBottom();
  const insets = useSafeAreaInsets();
  const moduleColor = useModuleColor(moduleId);

  return (
    <PanelAwareModal
      visible={visible}
      animationType={isReducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <LiquidGlassView
        moduleId={moduleId}
        style={{ flex: 1 }}
        cornerRadius={0}
      >
        <ModalLayout
          headerBlock={
            <View style={[styles.searchSection, headerStyle]}>
              <View style={{ height: isBottom ? 4 : insets.top }} />
              <ChipSelector
                mode={filterMode}
                options={options}
                selectedCode={selectedCode}
                onSelect={setSelectedCode}
                glassMode
                trailingElement={
                  <IconButton
                    icon="chevron-down"
                    variant="onPrimary"
                    onPress={onClose}
                    accessibilityLabel={t('common.close')}
                  />
                }
              />
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmit={handleSearch}
                placeholder={t('...')}
                glassMode
              />
            </View>
          }
          contentBlock={
            <View style={{ flex: 1 }}>
              {/* Separator */}
              <View style={{ height: 4, backgroundColor: moduleColor, opacity: 0.4 }} />

              {/* Content */}
              {isLoading ? (
                <LoadingView message={t('...')} fullscreen transparent />
              ) : error ? (
                <ErrorView title={t('...')} message={t('...')} onRetry={handleRetry} fullscreen transparent />
              ) : (
                <ScrollViewWithIndicator
                  keyboardShouldPersistTaps="handled"
                  onScrollBeginDrag={() => Keyboard.dismiss()}
                >
                  {results.map(item => (
                    <HapticTouchable key={item.id} onPress={() => { handleSelect(item); onClose(); }}>
                      {/* Item content */}
                    </HapticTouchable>
                  ))}
                </ScrollViewWithIndicator>
              )}
            </View>
          }
        />
      </LiquidGlassView>
    </PanelAwareModal>
  );
}

const styles = StyleSheet.create({
  searchSection: {
    paddingHorizontal: spacing.md,    // 16pt
    paddingTop: spacing.xs,           // 8pt
    gap: spacing.sm,                  // 4pt
    paddingBottom: spacing.md,        // 16pt
  },
});
```

### Template B: Rounded Dialoog Modal (Categorie 1, cornerRadius=borderRadius.lg)

Gebruik voor: Welcome modals, pickers, confirmation dialogen, etc.

```typescript
function MyDialogModal({ visible, onClose, moduleId }: Props) {
  return (
    <PanelAwareModal
      visible={visible}
      animationType={isReducedMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      {/* Dimmed backdrop — tap to close */}
      <Pressable
        style={styles.modalOverlay}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      >
        {/* Prevent taps on content from closing */}
        <Pressable onPress={(e) => e.stopPropagation()}>
          <LiquidGlassView
            moduleId={moduleId}
            style={styles.modalContent}
            cornerRadius={borderRadius.lg}
          >
            <ModalLayout
              headerBlock={
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                </View>
              }
              contentBlock={
                <View style={styles.body}>
                  {/* Content */}
                </View>
              }
              footerBlock={
                <View style={styles.footer}>
                  <Button title={t('common.understood')} onPress={onClose} />
                </View>
              }
            />
          </LiquidGlassView>
        </Pressable>
      </Pressable>
    </PanelAwareModal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '80%',
  },
  header: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  footer: {
    padding: spacing.lg,
    paddingTop: 0,
  },
});
```

### Template C: Full-Screen Viewer (Categorie 2)

Gebruik voor: Foto viewer, slideshow, artikel WebView, etc.

```typescript
function MyFullScreenViewer({ visible, onClose, moduleId }: Props) {
  return (
    <PanelAwareModal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <LiquidGlassView
        moduleId={moduleId}
        style={{ flex: 1 }}
        cornerRadius={0}
      >
        {/* Eigen layout — GEEN ModalLayout (viewer heeft geen header/content/footer patroon) */}
        <SafeAreaView style={{ flex: 1 }}>
          <IconButton
            icon="close"
            variant="onPrimary"
            onPress={onClose}
            style={styles.closeButton}
          />
          {/* Viewer content */}
        </SafeAreaView>
      </LiquidGlassView>
    </PanelAwareModal>
  );
}
```

---

## 5. Native Glass Layer Specificatie (iOS 26+)

### Layer Stack

LiquidGlassModule.swift bouwt de volgende lagen op, van onder naar boven:

```
┌─ Container (UIView) ────────────────────────────────────────────┐
│  cornerRadius, clipsToBounds, isUserInteractionEnabled = false  │
│                                                                  │
│  ┌─ Laag 1: Dark Base ─────────────────────────────────────┐   │
│  │  UIColor.black @ 35%                                     │   │
│  │  Doel: Zichtbare basis in ELKE context, inclusief        │   │
│  │  Modal UIWindows waar UIBlurEffect niets te blurren heeft│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Laag 2: UIGlassEffect ─────────────────────────────────┐   │
│  │  tintColor: moduleColor @ glassAlpha                      │   │
│  │  glassAlpha = 0.10 + (tintIntensity × 0.20)              │   │
│  │    → tintIntensity 0.0: 10%                               │   │
│  │    → tintIntensity 0.5: 20% (default)                     │   │
│  │    → tintIntensity 1.0: 30%                               │   │
│  │  isInteractive = false (touches passeren door)            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Laag 3: Tint Color Overlay ────────────────────────────┐   │
│  │  moduleColor @ tintAlpha                                  │   │
│  │  tintAlpha = 0.10 + (tintIntensity × 0.30)               │   │
│  │    → tintIntensity 0.0: 10%                               │   │
│  │    → tintIntensity 0.5: 25% (default)                     │   │
│  │    → tintIntensity 1.0: 40%                               │   │
│  │  Doel: Geeft glass de karakteristieke module kleur        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Laag 4: Specular Highlight (ALLEEN cornerRadius > 0) ──┐   │
│  │  CAGradientLayer:                                         │   │
│  │    [0.0]  white @ 30%    ← Bright top highlight           │   │
│  │    [0.12] white @ 10%    ← Gentle fade                    │   │
│  │    [0.5]  transparent    ← Midden                         │   │
│  │    [1.0]  white @ 5%     ← Subtle bottom glow             │   │
│  │  startPoint: (0.5, 0.0), endPoint: (0.5, 1.0)            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Laag 5: Edge Border (ALLEEN cornerRadius > 0) ─────────┐   │
│  │  white @ 15%, 0.5pt width                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [React Native children renderen hier bovenop]                   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Laag 6: Shadow op parent (self), NIET container                 │
│  (ALLEEN cornerRadius > 0)                                       │
│  black @ 25%, offset (0, 4), radius 8                            │
│  Reden: container heeft clipsToBounds=true → shadow wordt geclipt│
│  Parent (self) clipt NIET → shadow zichtbaar                     │
└──────────────────────────────────────────────────────────────────┘
```

### cornerRadius=0 Speciale Behandeling

Bij full-screen modals (cornerRadius=0):
- **Laag 4 OVERSLAAN** — Highlight creëert witte lijn bovenaan
- **Laag 5 OVERSLAAN** — Geen zichtbare randen
- **Laag 6 OVERSLAAN** — Geen afgeronde hoeken om shadow te tonen
- **Top -20pt overflow** — Container wordt 20pt boven de view bounds geplaatst om UIGlassEffect's inherente top-edge highlight off-screen te duwen. Dit is niet configureerbaar op UIGlassEffect; enige oplossing is Auto Layout offset.

### Fallback (iOS <26)

Eenvoudige `UIView` met `backgroundColor` uit `fallbackColorHex` prop. Geen lagen, geen effecten.

---

## 6. Touch Handling

### Probleem

LiquidGlassNativeView is een UIView die de glass lagen bevat. Zonder speciale handling consumeert deze view ALLE touches — ook op "lege" gebieden tussen React Native children — waardoor buttons, TextInputs en ScrollViews onbereikbaar worden.

### Oplossing: hitTest() Override

```swift
override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard isUserInteractionEnabled, !isHidden, alpha > 0.01 else { return nil }

    // Check React Native children (alle subviews behalve glass container)
    for subview in subviews.reversed() {
        if subview === glassEffectView { continue }  // Skip decoratief
        guard subview.isUserInteractionEnabled, !subview.isHidden else { continue }

        let convertedPoint = subview.convert(point, from: self)
        if let hitView = subview.hitTest(convertedPoint, with: event) {
            return hitView  // Touch raakte een child → doorsturen
        }
    }

    // Geen React child geraakt → nil (touch valt door naar achtergrond)
    return nil
}
```

### Waarom Dit Werkt

1. Glass container (`glassEffectView`) heeft `isUserInteractionEnabled = false`
2. UIGlassEffect heeft `isInteractive = false`
3. hitTest() skipt de glass container en checkt alleen React Native children
4. Touches op "lege" gebieden retourneren `nil` → vallen door naar modal backdrop

### React Subview Management

```swift
override func insertReactSubview(_ subview: UIView!, at atIndex: Int) {
    // Insert NA glass container (index 0)
    let offset = glassEffectView != nil ? 1 : 0
    insertSubview(subview, at: atIndex + offset)
}

override func reactSubviews() -> [UIView]! {
    // Return ALLEEN React Native children (niet glass)
    return subviews.filter { $0 !== glassEffectView }
}
```

---

## 7. Safe Area Handling in Modals

| Situatie | Safe area boven | Safe area onder |
|----------|-----------------|-----------------|
| cornerRadius=0, toolbar top | `insets.top` (notch/Dynamic Island) | `insets.bottom` of keyboard |
| cornerRadius=0, toolbar bottom | `4pt` (minimale padding) | `insets.bottom` |
| cornerRadius>0 (centered) | padding in styles | `insets.bottom + spacing.lg` |

**Patroon voor adaptive safe area spacer:**
```typescript
const { isBottom } = useModalLayoutBottom();
const insets = useSafeAreaInsets();

<View style={{ height: isBottom ? 4 : insets.top }} />
```

---

## 8. Keyboard Handling in Modals

### Verplicht voor modals met TextInput

```typescript
<ScrollViewWithIndicator
  keyboardShouldPersistTaps="handled"   // Taps op knoppen werken terwijl keyboard open is
  onScrollBeginDrag={() => {
    Keyboard.dismiss();                  // Keyboard sluit bij scrollen
    searchInputRef.current?.blur();      // Focus verwijderen
  }}
>
```

### SearchBar Specifiek

- SearchBar heeft ingebouwde submit via Enter toets
- `onSubmit` prop triggert de API call
- `showButton={false}` verbergt de zoekknop indien gewenst

---

## 9. iPad Split View

### Hoe PanelAwareModal Werkt

```typescript
// Intern in PanelAwareModal:
const panelId = usePanelId();  // null = iPhone, 'left'|'right' = iPad Split View

if (panelId) {
  // iPad Split View: absolute overlay binnen panel
  return <View style={StyleSheet.absoluteFill}>{children}</View>;
} else {
  // iPhone: native Modal
  return <Modal visible={visible} ...>{children}</Modal>;
}
```

### Waarom native Modal niet werkt op iPad Split View

React Native's `<Modal>` creëert een nieuw UIWindow dat full-screen rendert — ongeacht welk panel het aanroept. PanelAwareModal's absolute-positioned View wordt automatisch geclipt door de parent panel's `overflow: 'hidden'`.

---

## 10. Styling Referentie

### searchSection (discovery search modals)

```typescript
searchSection: {
  paddingHorizontal: spacing.md,    // 16pt
  paddingTop: spacing.xs,           // 8pt
  gap: spacing.sm,                  // 4pt tussen ChipSelector en SearchBar
  paddingBottom: spacing.md,        // 16pt
}
```

### modalOverlay (rounded dialoog modals)

```typescript
modalOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',   // 60% zwart dim
  justifyContent: 'center',
  alignItems: 'center',
}
```

### Glasstijl props op componenten

Sommige componenten (SearchBar, ChipSelector) hebben een `glassMode` prop die hun styling optimaliseert voor glass achtergronden (lichtere borders, aangepaste text kleuren):

```typescript
<SearchBar glassMode ... />
<ChipSelector glassMode ... />
```

---

## 11. Volledige Modal Inventaris

### Categorie 1 — Standaard Dialogen (PanelAwareModal → LiquidGlassView → ModalLayout)

| # | Component | cornerRadius | moduleId | Multi-row header | useModalLayoutBottom | Status |
|---|-----------|-------------|----------|-----------------|---------------------|--------|
| 1 | RadioScreen search modal | `0` | `radio` | ✅ spacer+chips+search | ✅ | Conform |
| 2 | PodcastScreen search modal | `0` | `podcast` | ✅ spacer+search+chips+title | ✅ | Conform |
| 3 | DateTimePickerModal | `borderRadius.lg` | prop (required) | ❌ title only | n.v.t. | Conform |
| 4 | PickerModal | `0` | prop (default: settings) | ❌ title+close row | n.v.t. | Conform |
| 5 | CreateGroupModal | n.s. | implicit contacts | ❌ close+title+create row | n.v.t. | Conform |
| 6 | EditGroupModal | n.s. | implicit contacts | ❌ close+title+save row | n.v.t. | Conform |
| 7 | SongCollectionModal | `borderRadius.lg` | `appleMusic` | ❌ close+title row | n.v.t. | Conform |
| 8 | CreateMusicCollectionModal | `borderRadius.lg` | `appleMusic` | ❌ single row | n.v.t. | Conform |
| 9 | EditMusicCollectionModal | n.s. | implicit appleMusic | ❌ close+title+save row | n.v.t. | Conform |
| 10 | CollectionOverlay | `borderRadius.lg` | `appleMusic` | ❌ title+close row | n.v.t. | Conform |
| 11 | PlaylistBrowserModal | n.s. | implicit appleMusic | ❌ title+close row | n.v.t. | Conform |
| 12 | ArticlePreviewModal | `0` | `nunl` | ❌ close+title row | n.v.t. | Conform |
| 13 | BulkSaveSheet | n.s. | implicit mail | ❌ title+close row | n.v.t. | Conform |
| 14 | AlbumPickerModal | n.s. | implicit mail | ❌ single row | n.v.t. | Conform |
| 15 | MailWelcomeModal | `borderRadius.lg` | implicit mail | ✅ icon+title+subtitle | ✅ | Conform |
| 16 | ContactPickerModal | `0` | `mail` | ✅ title row + SearchBar | ✅ | Conform |
| 17 | ContactSelectionModal | `borderRadius.lg` | `contacts` | ✅ title+subtitle+voice hint | ✅ | Conform |
| 18 | PhotoRecipientModal | `0` | `photoAlbum` | ❌ close+title+spacer row | n.v.t. | Conform |
| 19 | QueueView | n.s. | via accentColor | ❌ title+close row | n.v.t. | Conform |
| 20 | ModulePickerModal | `borderRadius.lg` | `settings` | ✅ title+subtitle | ✅ | Conform |
| 21 | AskAIHistoryModal | n.s. | implicit askAI | ❌ single row | n.v.t. | Conform |

**n.s. = niet gespecificeerd (gebruikt LiquidGlassView default)**

### Categorie 2 — Full-Screen Viewers (PanelAwareModal → LiquidGlassView → eigen layout)

| # | Component | ModalLayout | Status |
|---|-----------|-------------|--------|
| 22 | FullscreenImageViewer | ❌ (correct) | Conform |
| 23 | SlideshowViewer | ❌ (correct) | Conform |
| 24 | ArticleViewer | ❌ (correct) | Conform |
| 25 | ArticleWebViewer | ✅ (uitzondering) | Conform |

### Categorie 3 — Development Tools

| # | Component | LiquidGlassView | Status |
|---|-----------|-----------------|--------|
| 26 | DevModePanel | ❌ (correct) | Conform |

### Samenvatting

| Metric | Telling |
|--------|---------|
| **Totaal modals** | 26 |
| **Volledig conform** | 26 |
| **Actie vereist (useModalLayoutBottom)** | 0 |
| **PanelAwareModal adoptie** | 26/26 (100%) |
| **LiquidGlassView adoptie** | 25/26 (96% — DevModePanel uitgezonderd) |
| **ModalLayout adoptie** | 22/26 (85% — Cat. 2 + DevModePanel uitgezonderd) |

---

## 12. Pre-Implementatie Checklist

### Nieuwe Categorie 1 Modal

- [ ] `PanelAwareModal` als buitenste wrapper
- [ ] `LiquidGlassView` met `moduleId` prop en correcte `cornerRadius`
- [ ] `ModalLayout` met `headerBlock`, `contentBlock`, optioneel `footerBlock`
- [ ] `moduleId` prop doorgeven (niet hardcoden — tenzij modal altijd bij één module hoort)
- [ ] headerBlock geanalyseerd: multi-row? → `useModalLayoutBottom()` hook toevoegen
- [ ] Safe area spacer: `isBottom ? 4 : insets.top` (bij cornerRadius=0)
- [ ] Close button: `IconButton` met `variant="onPrimary"` op glass achtergrond
- [ ] Keyboard: `keyboardShouldPersistTaps="handled"` op ScrollView (indien TextInput)
- [ ] Accessibility: `accessibilityRole="dialog"` + `accessibilityLabel` op content wrapper
- [ ] Animation: `animationType={isReducedMotion ? 'none' : 'slide'}` (full-screen) of `'fade'` (rounded)
- [ ] Testen bij BEIDE toolbar posities (top + bottom) in Instellingen

### Bestaande Modal Migreren

- [ ] Gebruikt `PanelAwareModal`? (niet raw `Modal`)
- [ ] Gebruikt `LiquidGlassView`? (niet opaque `backgroundColor`)
- [ ] Gebruikt `ModalLayout`? (tenzij Cat. 2/3/4)
- [ ] Heeft `moduleId` prop?
- [ ] Multi-row headerBlock? → `useModalLayoutBottom()` hook aanwezig?
- [ ] Close button heeft `variant="onPrimary"`?
- [ ] Geen `backgroundColor` override op `LiquidGlassView` (VERBODEN — blokkeert glass)

---

## 13. Troubleshooting

### Modal ziet er volledig zwart/opaque uit

**Oorzaak:** `backgroundColor` override op LiquidGlassView of een parent View.
**Oplossing:** Verwijder alle `backgroundColor` props van LiquidGlassView en directe parent Views. Glass lagen voorzien in de achtergrondkleur.

### Touches werken niet in de modal

**Oorzaak 1:** `isUserInteractionEnabled` staat niet op `false` voor glass container.
**Oplossing:** Dit wordt automatisch afgehandeld door LiquidGlassModule.swift. Check of je de juiste versie gebruikt.

**Oorzaak 2:** De modal heeft een `Pressable` overlay die touches consumeert.
**Oplossing:** Voeg `onPress={(e) => e.stopPropagation()}` toe op de inner Pressable die de content bevat, zodat taps op de content niet de overlay's `onPress` (close) triggeren.

### Witte lijn bovenaan full-screen modal

**Oorzaak:** `cornerRadius > 0` bij een full-screen modal, of de -20pt top overflow ontbreekt.
**Oplossing:** Gebruik `cornerRadius={0}` voor full-screen modals. De top overflow wordt automatisch toegepast door LiquidGlassModule.swift.

### Controls staan in verkeerde volgorde bij toolbar "bottom"

**Oorzaak:** headerBlock heeft meerdere verticale children maar gebruikt geen `useModalLayoutBottom()`.
**Oplossing:** Voeg de hook toe en pas `headerStyle` toe op de container View:
```typescript
const { isBottom, headerStyle } = useModalLayoutBottom();
<View style={[styles.searchSection, headerStyle]}>
```

### Modal ontsnapt uit iPad Split View panel

**Oorzaak:** Raw `<Modal>` gebruikt in plaats van `PanelAwareModal`.
**Oplossing:** Vervang `<Modal>` door `<PanelAwareModal>`.

### Glass effect niet zichtbaar (iOS 26+)

**Oorzaak 1:** `tintColorHex` niet gezet (wacht op props via didSet).
**Oplossing:** LiquidGlassView moet `moduleId` prop hebben zodat de kleur wordt doorgegeven.

**Oorzaak 2:** Bounds zijn nog (0,0,0,0) bij eerste render.
**Oplossing:** LiquidGlassModule.swift recreëert het effect in `layoutSubviews()` zodra bounds beschikbaar zijn. Dit is automatisch.

---

## 14. Verwijzingen

Dit document is de single source of truth. De volgende bestanden verwijzen hiernaar:

| Bestand | Sectie | Verwijzing |
|---------|--------|------------|
| `.claude/CLAUDE.md` | §14 Modal Liquid Glass Standaard | `@see .claude/standards/MODAL_GLASS_STANDARD.md` |
| `.claude/skills/ui-designer/SKILL.md` | §11b Modal Design | `@see .claude/standards/MODAL_GLASS_STANDARD.md` |
| `.claude/skills/ios-specialist/SKILL.md` | Glass sectie | `@see .claude/standards/MODAL_GLASS_STANDARD.md` |

---

*Laatste update: 2026-03-19 — Initiële versie na Radio/Podcast search modal iteraties*
