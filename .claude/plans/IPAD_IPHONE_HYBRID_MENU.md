# iPad/iPhone Hybrid Menu — Implementatieplan

## Doel

Ontwerp een hybride navigatie-architectuur die:
- Op **iPhone** het bestaande WheelNavigationMenu (hold-to-navigate) behoudt
- Op **iPad** een **Split View** biedt met twee onafhankelijke module panelen
- **Code sharing** maximaliseert tussen beide platforms
- **Senior-inclusive design** principes respecteert (≥60pt touch targets, WCAG AAA)

---

## Architectuur Overzicht

### iPhone: WheelNavigationMenu (ongewijzigd)
```
┌─────────────────────────────────────┐
│  Hold anywhere → Wheel appears      │
│                                     │
│    ┌─────────────────────────┐      │
│    │  [Active Module]        │      │
│    │  ────────────────       │      │
│    │  [Module 1] [Module 2]  │      │
│    │  [Module 3] [Module 4]  │      │
│    │                         │      │
│    │  [Terug]     [Meer]     │      │
│    └─────────────────────────┘      │
│                                     │
└─────────────────────────────────────┘
```

### iPad: Split View met Module Panelen
```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │    LINKER PANEEL        │  │        RECHTER PANEEL                │ │
│  │       (33%)             │  │           (67%)                      │ │
│  │                         │  │                                      │ │
│  │  ┌───────────────────┐  │  │  ┌────────────────────────────────┐  │ │
│  │  │ [Module Content]  │  │  │  │ [Module Content]               │  │ │
│  │  │                   │  │  │  │                                │  │ │
│  │  │ Long-press →      │  │  │  │ Long-press →                   │  │ │
│  │  │ Module Picker     │  │  │  │ Module Picker                  │  │ │
│  │  │                   │  │  │  │                                │  │ │
│  │  └───────────────────┘  │  │  └────────────────────────────────┘  │ │
│  │                         │  │                                      │ │
│  └─────────────────────────┘  └──────────────────────────────────────┘ │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## iPad Split View Specificatie

### Initiële Staat bij Opstart
| Paneel | Breedte | Module |
|--------|---------|--------|
| Links | 33% | **Menu** (module picker) |
| Rechts | 67% | **Contacten** |

### Module Selectie Gedrag
1. Gebruiker selecteert module uit Menu in linker paneel
2. Geselecteerde module **vervangt het Menu** in dat paneel
3. Menu is nu niet meer zichtbaar

### Menu Opnieuw Openen
- **Long-press** in een paneel → Module Picker opent voor DAT paneel
- Consistent met iPhone long-press voor WheelNavigationMenu
- Picker toont alle beschikbare modules

### Duplicatie Toegestaan
- Dezelfde module MAG in beide panelen tegelijk staan
- Bijv: Contacten links + Contacten rechts is valide

### Paneel Verhoudingen
- **Default:** 33% links / 67% rechts (gebalanceerd)
- **Instelbaar:** Gebruiker kan dit aanpassen in Instellingen
- Opgeslagen in AsyncStorage per gebruiker

### Voice Commands Scope (BELANGRIJK)
- **Two-finger long-press** activeert voice commands **alleen voor de module in dat paneel**
- Links paneel two-finger → voice voor linker module
- Rechts paneel two-finger → voice voor rechter module
- Dit voorkomt ambiguïteit over welke module de voice command ontvangt

---

## Visuele Flow

### Stap 1: Opstart
```
┌──────────────────────┬───────────────────────────────────────┐
│                      │                                       │
│   📋 MENU            │   👥 CONTACTEN                        │
│                      │                                       │
│   • Berichten        │   Oma Maria                           │
│   • Contacten        │   Papa                                │
│   • Groepen          │   Tante Maria                         │
│   • Bellen           │   Buurman Henk                        │
│   ─────────          │                                       │
│   • Radio            │                                       │
│   • Podcast          │                                       │
│   • Boeken           │                                       │
│   • Weer             │                                       │
│   ─────────          │                                       │
│   • Instellingen     │                                       │
│                      │                                       │
└──────────────────────┴───────────────────────────────────────┘
```

### Stap 2: Gebruiker selecteert "Radio" in Menu
```
┌──────────────────────┬───────────────────────────────────────┐
│                      │                                       │
│   📻 RADIO           │   👥 CONTACTEN                        │
│                      │                                       │
│   [Zoekbalk]         │   Oma Maria                           │
│                      │   Papa                                │
│   NPO Radio 1        │   Tante Maria                         │
│   NPO Radio 2        │   Buurman Henk                        │
│   3FM                │                                       │
│   Radio 538          │                                       │
│   Sky Radio          │                                       │
│                      │                                       │
│   ▶️ Nu: NPO Radio 1 │                                       │
│                      │                                       │
└──────────────────────┴───────────────────────────────────────┘
```

### Stap 3: Long-press in rechter paneel → Module Picker
```
┌──────────────────────┬───────────────────────────────────────┐
│                      │                                       │
│   📻 RADIO           │   ┌─────────────────────────────────┐ │
│                      │   │                                 │ │
│   [Zoekbalk]         │   │   Kies een module               │ │
│                      │   │                                 │ │
│   NPO Radio 1        │   │   [Berichten] [Contacten]       │ │
│   NPO Radio 2        │   │   [Groepen]   [Bellen]          │ │
│   3FM                │   │   [Radio]     [Podcast]         │ │
│   Radio 538          │   │   [Boeken]    [Weer]            │ │
│   Sky Radio          │   │   [Instellingen]                │ │
│                      │   │                                 │ │
│   ▶️ Nu: NPO Radio 1 │   │           [Annuleer]            │ │
│                      │   └─────────────────────────────────┘ │
└──────────────────────┴───────────────────────────────────────┘
```

### Stap 4: Gebruiker selecteert "Weer"
```
┌──────────────────────┬───────────────────────────────────────┐
│                      │                                       │
│   📻 RADIO           │   🌤️ WEER                             │
│                      │                                       │
│   [Zoekbalk]         │   📍 Amsterdam                        │
│                      │                                       │
│   NPO Radio 1        │   ☀️ 18°C                             │
│   NPO Radio 2        │   Zonnig met wolken                   │
│   3FM                │                                       │
│   Radio 538          │   Vandaag: 14° - 19°                  │
│   Sky Radio          │   Morgen:  12° - 17°                  │
│                      │   Overmorgen: 15° - 21°               │
│   ▶️ Nu: NPO Radio 1 │                                       │
│                      │                                       │
└──────────────────────┴───────────────────────────────────────┘
```

---

## Component Architectuur

```
┌────────────────────────────────────────────────────────────────┐
│                     NavigationProvider                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  useDeviceNavigation()                    │  │
│  │  - Detecteert device type (iPhone/iPad)                   │  │
│  │  - Selecteert navigatie strategie                         │  │
│  │  - Beheert module ordering & usage tracking               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│              ┌───────────────┴───────────────┐                  │
│              ▼                               ▼                  │
│  ┌─────────────────────┐         ┌─────────────────────┐       │
│  │   PhoneNavigation   │         │   TabletNavigation  │       │
│  │  (WheelMenu)        │         │  (SplitView)        │       │
│  └─────────────────────┘         └─────────────────────┘       │
│                                             │                   │
│                              ┌──────────────┴──────────────┐   │
│                              ▼                              ▼   │
│                  ┌─────────────────┐          ┌─────────────────┐
│                  │   LeftPanel     │          │   RightPanel    │
│                  │  (ModuleHost)   │          │   (ModuleHost)  │
│                  └─────────────────┘          └─────────────────┘
└────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Device Detection & Context

### 1.1 useDeviceType Hook (bestaand, uitbreiden)

```typescript
// src/hooks/useDeviceType.ts

export interface DeviceInfo {
  deviceType: 'phone' | 'tablet';
  isPhone: boolean;
  isTablet: boolean;
  isLandscape: boolean;
  screenWidth: number;
  screenHeight: number;
}

export function useDeviceType(): DeviceInfo {
  const { width, height } = useWindowDimensions();

  const isTablet = Platform.OS === 'ios'
    ? Platform.isPad
    : Math.min(width, height) >= 600;

  return {
    deviceType: isTablet ? 'tablet' : 'phone',
    isPhone: !isTablet,
    isTablet,
    isLandscape: width > height,
    screenWidth: width,
    screenHeight: height,
  };
}
```

### 1.2 SplitViewContext (nieuw)

```typescript
// src/contexts/SplitViewContext.tsx

interface PanelState {
  moduleId: NavigationDestination;
  // Panel-specific state (scroll position, etc.)
}

interface SplitViewContextValue {
  // Panel modules
  leftPanel: PanelState;
  rightPanel: PanelState;

  // Panel actions
  setLeftModule: (moduleId: NavigationDestination) => void;
  setRightModule: (moduleId: NavigationDestination) => void;

  // Panel ratio (stored in settings)
  panelRatio: number;  // 0.33 = 33% left, 67% right
  setPanelRatio: (ratio: number) => void;

  // Module picker
  activePickerPanel: 'left' | 'right' | null;
  openModulePicker: (panel: 'left' | 'right') => void;
  closeModulePicker: () => void;

  // Voice scope
  activeVoicePanel: 'left' | 'right' | null;
  setActiveVoicePanel: (panel: 'left' | 'right' | null) => void;
}

export function SplitViewProvider({ children }: { children: ReactNode }) {
  // Default: Menu links, Contacten rechts
  const [leftPanel, setLeftPanel] = useState<PanelState>({
    moduleId: 'menu'
  });
  const [rightPanel, setRightPanel] = useState<PanelState>({
    moduleId: 'contacts'
  });

  const [panelRatio, setPanelRatioState] = useState(0.33);
  const [activePickerPanel, setActivePickerPanel] = useState<'left' | 'right' | null>(null);
  const [activeVoicePanel, setActiveVoicePanel] = useState<'left' | 'right' | null>(null);

  // Load ratio from settings
  useEffect(() => {
    AsyncStorage.getItem('ipad_panel_ratio').then(saved => {
      if (saved) setPanelRatioState(parseFloat(saved));
    });
  }, []);

  const setPanelRatio = useCallback((ratio: number) => {
    setPanelRatioState(ratio);
    AsyncStorage.setItem('ipad_panel_ratio', ratio.toString());
  }, []);

  // ... rest of implementation
}
```

---

## Fase 2: Split View Layout

### 2.1 SplitViewLayout Component

```typescript
// src/components/navigation/SplitViewLayout.tsx

interface SplitViewLayoutProps {
  children?: ReactNode;  // Not used - panels render modules
}

export function SplitViewLayout({}: SplitViewLayoutProps) {
  const {
    leftPanel,
    rightPanel,
    panelRatio,
    activePickerPanel,
    closeModulePicker,
  } = useSplitViewContext();

  const { width: screenWidth } = useWindowDimensions();

  const leftWidth = screenWidth * panelRatio;
  const rightWidth = screenWidth * (1 - panelRatio);

  return (
    <View style={styles.container}>
      {/* Left Panel */}
      <View style={[styles.panel, { width: leftWidth }]}>
        <ModulePanel
          panelId="left"
          moduleId={leftPanel.moduleId}
        />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Right Panel */}
      <View style={[styles.panel, { width: rightWidth }]}>
        <ModulePanel
          panelId="right"
          moduleId={rightPanel.moduleId}
        />
      </View>

      {/* Module Picker Modal */}
      {activePickerPanel && (
        <ModulePickerModal
          targetPanel={activePickerPanel}
          onClose={closeModulePicker}
        />
      )}
    </View>
  );
}
```

### 2.2 ModulePanel Component

```typescript
// src/components/navigation/ModulePanel.tsx

interface ModulePanelProps {
  panelId: 'left' | 'right';
  moduleId: NavigationDestination;
}

export function ModulePanel({ panelId, moduleId }: ModulePanelProps) {
  const { openModulePicker, setActiveVoicePanel } = useSplitViewContext();

  // Long-press handler for module picker
  const handleLongPress = useCallback(() => {
    openModulePicker(panelId);
  }, [panelId, openModulePicker]);

  // Two-finger long-press handler for voice
  const handleTwoFingerLongPress = useCallback(() => {
    setActiveVoicePanel(panelId);
    // Trigger voice commands for THIS panel's module
  }, [panelId, setActiveVoicePanel]);

  // Render the module content
  const ModuleComponent = getModuleComponent(moduleId);

  return (
    <View
      style={styles.panelContainer}
      onLongPress={handleLongPress}
    >
      {/* Two-finger gesture detector */}
      <TwoFingerGestureDetector onLongPress={handleTwoFingerLongPress}>
        <ModuleComponent panelId={panelId} />
      </TwoFingerGestureDetector>
    </View>
  );
}

// Map module IDs to components
function getModuleComponent(moduleId: NavigationDestination) {
  const componentMap: Record<NavigationDestination, React.ComponentType<any>> = {
    menu: MenuModule,
    chats: ChatsModule,
    contacts: ContactsModule,
    groups: GroupsModule,
    calls: CallsModule,
    radio: RadioModule,
    podcast: PodcastModule,
    books: BooksModule,
    weather: WeatherModule,
    settings: SettingsModule,
    help: HelpModule,
  };
  return componentMap[moduleId] || MenuModule;
}
```

### 2.3 ModulePickerModal Component

```typescript
// src/components/navigation/ModulePickerModal.tsx

interface ModulePickerModalProps {
  targetPanel: 'left' | 'right';
  onClose: () => void;
}

export function ModulePickerModal({ targetPanel, onClose }: ModulePickerModalProps) {
  const { t } = useTranslation();
  const { modules } = useNavigationContext();
  const { setLeftModule, setRightModule } = useSplitViewContext();

  const handleModuleSelect = useCallback((moduleId: NavigationDestination) => {
    if (targetPanel === 'left') {
      setLeftModule(moduleId);
    } else {
      setRightModule(moduleId);
    }
    onClose();
  }, [targetPanel, setLeftModule, setRightModule, onClose]);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>{t('nav.chooseModule')}</Text>

          <View style={styles.moduleGrid}>
            {modules.map(module => (
              <TouchableOpacity
                key={module.id}
                style={styles.moduleButton}
                onPress={() => handleModuleSelect(module.id)}
                accessibilityRole="button"
                accessibilityLabel={t(module.labelKey)}
              >
                <ModuleIcon name={module.icon} size={32} color={module.color} />
                <Text style={styles.moduleLabel}>{t(module.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

---

## Fase 3: Menu Module

### 3.1 MenuModule Component (nieuw)

```typescript
// src/components/modules/MenuModule.tsx

interface MenuModuleProps {
  panelId: 'left' | 'right';
}

export function MenuModule({ panelId }: MenuModuleProps) {
  const { t } = useTranslation();
  const { modules, getModulesByGroup } = useNavigationContext();
  const { setLeftModule, setRightModule } = useSplitViewContext();

  const groupedModules = getModulesByGroup();

  const handleModuleSelect = useCallback((moduleId: NavigationDestination) => {
    // Replace this panel's content with the selected module
    if (panelId === 'left') {
      setLeftModule(moduleId);
    } else {
      setRightModule(moduleId);
    }
  }, [panelId, setLeftModule, setRightModule]);

  return (
    <ScrollView style={styles.container}>
      {/* Primary modules */}
      <View style={styles.group}>
        {groupedModules.primary.map(module => (
          <ModuleListItem
            key={module.id}
            module={module}
            onPress={() => handleModuleSelect(module.id)}
          />
        ))}
      </View>

      <View style={styles.divider}>
        <Text style={styles.dividerText}>{t('nav.media')}</Text>
      </View>

      {/* Secondary modules (Media) */}
      <View style={styles.group}>
        {groupedModules.secondary.map(module => (
          <ModuleListItem
            key={module.id}
            module={module}
            onPress={() => handleModuleSelect(module.id)}
          />
        ))}
      </View>

      <View style={styles.divider} />

      {/* Footer modules */}
      <View style={styles.group}>
        {groupedModules.footer.map(module => (
          <ModuleListItem
            key={module.id}
            module={module}
            onPress={() => handleModuleSelect(module.id)}
          />
        ))}
      </View>
    </ScrollView>
  );
}
```

---

## Fase 4: Adaptive Navigation Wrapper Update

### 4.1 Updated AdaptiveNavigationWrapper

```typescript
// src/components/navigation/AdaptiveNavigationWrapper.tsx

export function AdaptiveNavigationWrapper({ children }: { children: ReactNode }) {
  const device = useDeviceType();

  if (device.isTablet) {
    // iPad: Split View with module panels
    return (
      <SplitViewProvider>
        <SplitViewLayout />
      </SplitViewProvider>
    );
  }

  // iPhone: bestaande HoldToNavigateWrapper + WheelNavigationMenu
  return (
    <HoldToNavigateWrapper>
      {children}
    </HoldToNavigateWrapper>
  );
}
```

---

## Fase 5: Voice Commands per Panel

### 5.1 Panel-Scoped Voice Commands

```typescript
// src/hooks/useVoiceCommands.ts (uitbreiden)

export function useVoiceCommands(panelId?: 'left' | 'right') {
  const { activeVoicePanel } = useSplitViewContext();
  const device = useDeviceType();

  // On iPad, only process commands if this panel is active
  const isActive = useMemo(() => {
    if (device.isPhone) return true;  // iPhone: always active
    if (!panelId) return true;  // No panel specified
    return activeVoicePanel === panelId;
  }, [device.isPhone, panelId, activeVoicePanel]);

  // ... existing voice command logic, but filter by isActive
}
```

### 5.2 TwoFingerGestureDetector Component

```typescript
// src/components/TwoFingerGestureDetector.tsx

interface TwoFingerGestureDetectorProps {
  children: ReactNode;
  onLongPress: () => void;
  delayMs?: number;
}

export function TwoFingerGestureDetector({
  children,
  onLongPress,
  delayMs = 1000,
}: TwoFingerGestureDetectorProps) {
  const touchCount = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    touchCount.current = event.nativeEvent.touches.length;

    if (touchCount.current === 2) {
      // Start timer for long-press
      timerRef.current = setTimeout(() => {
        onLongPress();
      }, delayMs);
    }
  }, [onLongPress, delayMs]);

  const handleTouchEnd = useCallback(() => {
    touchCount.current = 0;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return (
    <View
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ flex: 1 }}
    >
      {children}
    </View>
  );
}
```

---

## Fase 6: Settings voor Panel Ratio

### 6.1 iPad Layout Settings

```typescript
// In SettingsScreen.tsx

// Add to settings options (iPad only):
{device.isTablet && (
  <SettingsSection title={t('settings.ipadLayout.title')}>
    <SettingsSlider
      label={t('settings.ipadLayout.panelRatio')}
      value={panelRatio}
      onChange={setPanelRatio}
      minimumValue={0.25}
      maximumValue={0.5}
      step={0.05}
      formatValue={(v) => `${Math.round(v * 100)}% / ${Math.round((1 - v) * 100)}%`}
    />
  </SettingsSection>
)}
```

---

## Implementatie Volgorde

### Sprint 1: Foundation
1. [x] `useDeviceType` hook (bestaand)
2. [ ] `SplitViewContext` maken
3. [ ] `SplitViewProvider` implementeren

### Sprint 2: Layout Components
4. [ ] `SplitViewLayout` component
5. [ ] `ModulePanel` component
6. [ ] `ModulePickerModal` component

### Sprint 3: Menu Module
7. [ ] `MenuModule` component
8. [ ] `ModuleListItem` component
9. [ ] Module grouping logic

### Sprint 4: Integration
10. [ ] Update `AdaptiveNavigationWrapper`
11. [ ] Integrate `SplitViewProvider` in App
12. [ ] Test op iPad simulator

### Sprint 5: Voice & Gestures
13. [ ] `TwoFingerGestureDetector` component
14. [ ] Panel-scoped voice commands
15. [ ] Long-press gesture for module picker

### Sprint 6: Settings & Polish
16. [ ] Panel ratio settings
17. [ ] Persist panel state (which modules are open)
18. [ ] Accessibility audit

---

## Bestanden Structuur

```
src/
  contexts/
    SplitViewContext.tsx          ← NEW: iPad split view state

  components/
    navigation/
      SplitViewLayout.tsx         ← NEW: iPad split view container
      ModulePanel.tsx             ← NEW: Panel wrapper with gestures
      ModulePickerModal.tsx       ← NEW: Module selection modal
      AdaptiveNavigationWrapper.tsx  ← MODIFY: Add iPad path

    modules/
      MenuModule.tsx              ← NEW: Module list for initial state
      ModuleListItem.tsx          ← NEW: Module button in list

    TwoFingerGestureDetector.tsx  ← NEW: Two-finger gesture handling

  hooks/
    useDeviceType.ts              ← EXISTS: No changes needed
    useVoiceCommands.ts           ← MODIFY: Add panel scope
```

---

## i18n Keys (nieuw)

```json
{
  "nav": {
    "chooseModule": "Kies een module",
    "media": "Media",
    "leftPanel": "Linker paneel",
    "rightPanel": "Rechter paneel"
  },
  "settings": {
    "ipadLayout": {
      "title": "iPad Layout",
      "panelRatio": "Paneel verhouding"
    }
  }
}
```

---

## Senior-Inclusive Design Checklist

- [ ] Touch targets ≥60pt in module picker
- [ ] Text ≥18pt in module labels
- [ ] WCAG AAA contrast
- [ ] Haptic feedback op module selectie
- [ ] VoiceOver support voor split view
- [ ] Clear visual indication welk paneel actief is
- [ ] Long-press duur consistent met iPhone (1000ms)

---

## Test Scenario's

| Test | Verwacht Resultaat |
|------|-------------------|
| iPad opstart | Links: Menu, Rechts: Contacten |
| Tap module in Menu | Module vervangt Menu in linker paneel |
| Long-press rechter paneel | Module picker opent voor rechter paneel |
| Selecteer module in picker | Module laadt in dat paneel |
| Two-finger long-press links | Voice commands actief voor linker module |
| Two-finger long-press rechts | Voice commands actief voor rechter module |
| Zelfde module in beide panelen | Werkt (duplicatie toegestaan) |
| Panel ratio wijzigen in settings | Panelen resizen correct |
| App herstarten | Panel ratio blijft behouden |

---

## Risico's & Mitigaties

| Risico | Mitigatie |
|--------|-----------|
| Performance met twee module renders | Lazy loading per module |
| Memory bij zware modules (Radio) | Cleanup bij panel switch |
| Gesture conflicten | Clear gesture priority |
| State sync tussen panelen | Shared contexts |

---

## Volgende Stappen

1. Review dit plan
2. Goedkeuring voor start implementatie
3. Begin met Sprint 1 (Foundation)

---

*Plan bijgewerkt: 2026-02-21*
*Status: Klaar voor review*
*Vorige versie: Sidebar architectuur (vervangen door Split View)*
