# iPad/iPhone Hybrid Menu — Implementatieplan

## Doel

Ontwerp een hybride navigatie-architectuur die:
- Op **iPhone** het bestaande WheelNavigationMenu (hold-to-navigate) behoudt
- Op **iPad** een sidebar-gebaseerde navigatie biedt met split-view support
- **Code sharing** maximaliseert tussen beide platforms
- **Senior-inclusive design** principes respecteert (≥60pt touch targets, WCAG AAA)

---

## Huidige Situatie

### WheelNavigationMenu (iPhone)
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

### Kenmerken
- Hold-gesture activatie (1000ms default)
- Pagination (4 modules per pagina)
- Usage-based ordering
- Two-finger gesture voor voice commands
- Full-screen overlay

---

## Architectuur Overzicht

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
│  │  (WheelMenu)        │         │  (Sidebar + Split)  │       │
│  └─────────────────────┘         └─────────────────────┘       │
└────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Device Detection & Abstractie

### 1.1 Device Type Hook

```typescript
// src/hooks/useDeviceType.ts

import { useWindowDimensions, Platform } from 'react-native';

export type DeviceType = 'phone' | 'tablet';

interface DeviceInfo {
  deviceType: DeviceType;
  isLandscape: boolean;
  screenWidth: number;
  screenHeight: number;
  isCompact: boolean;     // True voor iPhone + iPad in Slide Over
  isRegular: boolean;     // True voor iPad in full/split view
}

export function useDeviceType(): DeviceInfo {
  const { width, height } = useWindowDimensions();

  // iPad detection: width >= 768pt in portrait
  // OF check Platform.isPad (iOS only)
  const isTablet = Platform.OS === 'ios'
    ? Platform.isPad
    : Math.min(width, height) >= 600;

  const isLandscape = width > height;

  // Compact = iPhone OR iPad in Slide Over (width < 400)
  const isCompact = !isTablet || width < 400;
  const isRegular = isTablet && width >= 400;

  return {
    deviceType: isTablet ? 'tablet' : 'phone',
    isLandscape,
    screenWidth: width,
    screenHeight: height,
    isCompact,
    isRegular,
  };
}
```

### 1.2 Navigation Strategy Interface

```typescript
// src/navigation/types.ts

import type { NavigationDestination } from '@/types/navigation';

export interface NavigationStrategy {
  /** Render de navigatie UI (sidebar, wheel, etc.) */
  renderNavigation: () => React.ReactNode;

  /** Navigeer naar een module */
  navigateTo: (destination: NavigationDestination) => void;

  /** Check of de navigatie zichtbaar is */
  isVisible: boolean;

  /** Toon/verberg navigatie (voor wheel: open/close) */
  setVisible: (visible: boolean) => void;
}
```

---

## Fase 2: Gedeelde Module Configuratie

### 2.1 Unified Module Registry

```typescript
// src/config/moduleRegistry.ts (uitgebreid)

export interface ModuleDefinition {
  id: NavigationDestination;
  labelKey: string;              // i18n key
  icon: ModuleIconType;          // Icon type
  color: string;                 // Brand color
  customLogo?: React.ComponentType<{ size: number }>;

  // Platform-specifieke opties
  showInSidebar?: boolean;       // Default: true
  showInWheel?: boolean;         // Default: true
  sidebarGroup?: 'primary' | 'secondary' | 'footer';
}

// Gegroepeerde modules voor sidebar
export const MODULE_GROUPS = {
  primary: ['chats', 'contacts', 'groups', 'calls'],
  secondary: ['radio', 'podcast', 'books', 'weather'],
  footer: ['settings', 'help'],
} as const;
```

### 2.2 Shared Module Item Component

```typescript
// src/components/ModuleItem.tsx

interface ModuleItemProps {
  module: ModuleDefinition;
  isActive: boolean;
  onPress: () => void;

  // Layout variants
  variant: 'wheel' | 'sidebar' | 'compact';

  // Sizing
  size?: 'small' | 'medium' | 'large';
}

export function ModuleItem({
  module,
  isActive,
  onPress,
  variant,
  size = 'medium',
}: ModuleItemProps) {
  const { t } = useTranslation();
  const { triggerFeedback } = useFeedback();

  const handlePress = useCallback(() => {
    triggerFeedback('tap');
    onPress();
  }, [onPress, triggerFeedback]);

  const containerStyle = useMemo(() => {
    switch (variant) {
      case 'wheel':
        return [styles.wheelItem, isActive && styles.wheelItemActive];
      case 'sidebar':
        return [styles.sidebarItem, isActive && styles.sidebarItemActive];
      case 'compact':
        return [styles.compactItem, isActive && styles.compactItemActive];
    }
  }, [variant, isActive]);

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={t(module.labelKey)}
    >
      {module.customLogo ? (
        <module.customLogo size={size === 'large' ? 40 : 24} />
      ) : (
        <ModuleIcon name={module.icon} size={size === 'large' ? 40 : 24} />
      )}
      <Text style={styles.label}>{t(module.labelKey)}</Text>
    </TouchableOpacity>
  );
}
```

---

## Fase 3: iPad Sidebar Navigatie

### 3.1 Layout

```
iPad Landscape (Split View):
┌─────────────────────────────────────────────────────────────────────┐
│  ┌────────────────┐  ┌────────────────────────────────────────────┐ │
│  │   SIDEBAR      │  │              CONTENT AREA                  │ │
│  │   (320pt)      │  │              (remaining width)             │ │
│  │                │  │                                            │ │
│  │  ┌──────────┐  │  │                                            │ │
│  │  │ Berichten│◀─┼──┼─ Active indicator                          │ │
│  │  │ Contacten│  │  │                                            │ │
│  │  │ Groepen  │  │  │                                            │ │
│  │  │ Bellen   │  │  │                                            │ │
│  │  └──────────┘  │  │                                            │ │
│  │                │  │                                            │ │
│  │  ── Media ──   │  │                                            │ │
│  │  │ Radio    │  │  │                                            │ │
│  │  │ Podcast  │  │  │                                            │ │
│  │  │ Boeken   │  │  │                                            │ │
│  │  │ Weer     │  │  │                                            │ │
│  │  └──────────┘  │  │                                            │ │
│  │                │  │                                            │ │
│  │  ┌──────────┐  │  │                                            │ │
│  │  │ Instellin│  │  │                                            │ │
│  │  │ Help     │  │  │                                            │ │
│  │  └──────────┘  │  │                                            │ │
│  └────────────────┘  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

iPad Portrait (Collapsible Sidebar):
┌────────────────────────────────────────────────┐
│  [≡]  Content Title                    [···]   │
├────────────────────────────────────────────────┤
│  ┌────┐                                        │
│  │    │  CONTENT AREA                          │
│  │ S  │  (full width when sidebar collapsed)  │
│  │ I  │                                        │
│  │ D  │  Sidebar slides in from left           │
│  │ E  │  on hamburger tap                      │
│  │ B  │                                        │
│  │ A  │                                        │
│  │ R  │                                        │
│  └────┘                                        │
└────────────────────────────────────────────────┘
```

### 3.2 Sidebar Component

```typescript
// src/components/navigation/Sidebar.tsx

interface SidebarProps {
  modules: ModuleDefinition[];
  activeModule: NavigationDestination;
  onModuleSelect: (module: NavigationDestination) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  modules,
  activeModule,
  onModuleSelect,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { t } = useTranslation();
  const { accentColor } = useAccentColor();

  const groupedModules = useMemo(() => ({
    primary: modules.filter(m => MODULE_GROUPS.primary.includes(m.id)),
    secondary: modules.filter(m => MODULE_GROUPS.secondary.includes(m.id)),
    footer: modules.filter(m => MODULE_GROUPS.footer.includes(m.id)),
  }), [modules]);

  return (
    <View style={[styles.sidebar, isCollapsed && styles.sidebarCollapsed]}>
      {/* Header with collapse button */}
      <View style={styles.sidebarHeader}>
        <TouchableOpacity
          style={styles.collapseButton}
          onPress={onToggleCollapse}
          accessibilityLabel={t(isCollapsed ? 'nav.expand' : 'nav.collapse')}
        >
          <Icon name={isCollapsed ? 'menu' : 'chevron-left'} size={24} />
        </TouchableOpacity>
        {!isCollapsed && (
          <Text style={styles.sidebarTitle}>CommEazy</Text>
        )}
      </View>

      <ScrollView style={styles.sidebarContent}>
        {/* Primary modules */}
        <View style={styles.moduleGroup}>
          {groupedModules.primary.map(module => (
            <ModuleItem
              key={module.id}
              module={module}
              isActive={activeModule === module.id}
              onPress={() => onModuleSelect(module.id)}
              variant={isCollapsed ? 'compact' : 'sidebar'}
            />
          ))}
        </View>

        {/* Divider */}
        {!isCollapsed && (
          <View style={styles.divider}>
            <Text style={styles.dividerText}>{t('nav.media')}</Text>
          </View>
        )}

        {/* Secondary modules (Media) */}
        <View style={styles.moduleGroup}>
          {groupedModules.secondary.map(module => (
            <ModuleItem
              key={module.id}
              module={module}
              isActive={activeModule === module.id}
              onPress={() => onModuleSelect(module.id)}
              variant={isCollapsed ? 'compact' : 'sidebar'}
            />
          ))}
        </View>
      </ScrollView>

      {/* Footer modules (Settings, Help) */}
      <View style={styles.sidebarFooter}>
        {groupedModules.footer.map(module => (
          <ModuleItem
            key={module.id}
            module={module}
            isActive={activeModule === module.id}
            onPress={() => onModuleSelect(module.id)}
            variant={isCollapsed ? 'compact' : 'sidebar'}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 320,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  sidebarCollapsed: {
    width: 72,  // Icon-only mode
  },
  // ... more styles
});
```

### 3.3 Split View Layout

```typescript
// src/components/navigation/SplitViewLayout.tsx

interface SplitViewLayoutProps {
  children: React.ReactNode;
}

export function SplitViewLayout({ children }: SplitViewLayoutProps) {
  const { isLandscape, screenWidth } = useDeviceType();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!isLandscape);
  const { activeModule, navigateTo, modules } = useNavigationContext();

  // Auto-collapse in portrait, expand in landscape
  useEffect(() => {
    setSidebarCollapsed(!isLandscape);
  }, [isLandscape]);

  return (
    <View style={styles.container}>
      <Sidebar
        modules={modules}
        activeModule={activeModule}
        onModuleSelect={navigateTo}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
      />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}
```

---

## Fase 4: Unified Navigation Provider

### 4.1 Navigation Context

```typescript
// src/contexts/NavigationContext.tsx

interface NavigationContextValue {
  // Current state
  activeModule: NavigationDestination;
  modules: ModuleDefinition[];

  // Actions
  navigateTo: (destination: NavigationDestination) => void;

  // Device-specific
  deviceType: DeviceType;

  // For wheel menu (iPhone)
  isWheelOpen: boolean;
  openWheel: () => void;
  closeWheel: () => void;

  // For sidebar (iPad)
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { deviceType, isLandscape } = useDeviceType();
  const navigation = useNavigation();

  const [activeModule, setActiveModule] = useState<NavigationDestination>('chats');
  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Get modules from registry + enabled dynamic modules
  const { enabledModules } = useModuleConfig();
  const modules = useMemo(() => {
    const staticModules = Object.values(STATIC_MODULE_DEFINITIONS);
    const dynamicModules = enabledModules.map(getModuleDefinition);
    return [...staticModules, ...dynamicModules];
  }, [enabledModules]);

  // Navigate to module
  const navigateTo = useCallback((destination: NavigationDestination) => {
    setActiveModule(destination);
    recordModuleUsage(destination);

    // Close wheel on iPhone
    if (deviceType === 'phone') {
      setIsWheelOpen(false);
    }

    // Navigate to screen
    const tabName = getTabNameForDestination(destination);
    navigation.navigate(tabName);
  }, [deviceType, navigation]);

  const value = useMemo(() => ({
    activeModule,
    modules,
    navigateTo,
    deviceType,
    isWheelOpen,
    openWheel: () => setIsWheelOpen(true),
    closeWheel: () => setIsWheelOpen(false),
    isSidebarCollapsed,
    toggleSidebar: () => setSidebarCollapsed(prev => !prev),
  }), [activeModule, modules, navigateTo, deviceType, isWheelOpen, isSidebarCollapsed]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}
```

### 4.2 Adaptive Navigation Wrapper

```typescript
// src/components/navigation/AdaptiveNavigation.tsx

export function AdaptiveNavigation({ children }: { children: React.ReactNode }) {
  const { deviceType } = useDeviceType();

  if (deviceType === 'tablet') {
    return (
      <SplitViewLayout>
        {children}
      </SplitViewLayout>
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

## Fase 5: Voice Commands Integratie

### 5.1 Platform-Onafhankelijke Voice Commands

Voice commands werken identiek op beide platforms:

| Commando | Actie |
|----------|-------|
| "berichten" | Navigeer naar Chats |
| "contacten" | Navigeer naar Contacts |
| "radio" | Navigeer naar Radio |
| etc. | etc. |

### 5.2 Two-Finger Gesture op iPad

Op iPad blijft de two-finger long-press beschikbaar voor voice commands, ook met sidebar zichtbaar.

---

## Fase 6: iPad-Specifieke Features

### 6.1 Keyboard Shortcuts

```typescript
// src/hooks/useKeyboardShortcuts.ts

export function useKeyboardShortcuts() {
  const { navigateTo } = useNavigationContext();

  useEffect(() => {
    // ⌘1 = Berichten, ⌘2 = Contacten, etc.
    const shortcuts = {
      '1': 'chats',
      '2': 'contacts',
      '3': 'groups',
      '4': 'calls',
      '5': 'radio',
      '6': 'podcast',
      '7': 'books',
      '8': 'weather',
      '9': 'settings',
      '0': 'help',
    };

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.metaKey && shortcuts[event.key]) {
        event.preventDefault();
        navigateTo(shortcuts[event.key]);
      }
    };

    // Add keyboard listener (iOS specific)
    // ...
  }, [navigateTo]);
}
```

### 6.2 Drag & Drop Support

Voor toekomstige versies: drag & drop van content tussen sidebar modules.

### 6.3 Pointer/Trackpad Support

```typescript
// iPad met Magic Keyboard/Trackpad
const styles = StyleSheet.create({
  sidebarItem: {
    // Hover states voor pointer
    ':hover': {
      backgroundColor: colors.surfaceHover,
    },
  },
});
```

---

## Implementatie Volgorde

### Sprint 1: Foundation
1. [ ] `useDeviceType` hook implementeren
2. [ ] `ModuleItem` component maken (shared)
3. [ ] `NavigationContext` uitbreiden met device-aware state

### Sprint 2: Sidebar
4. [ ] `Sidebar` component maken
5. [ ] `SplitViewLayout` component maken
6. [ ] Sidebar styling (collapsed/expanded states)

### Sprint 3: Integration
7. [ ] `AdaptiveNavigation` wrapper maken
8. [ ] Integreren in App root
9. [ ] Testen op iPad simulator + device

### Sprint 4: Polish
10. [ ] Keyboard shortcuts implementeren
11. [ ] Landscape/portrait transitions
12. [ ] Accessibility audit (VoiceOver op iPad)

---

## Bestanden Structuur

```
src/
  hooks/
    useDeviceType.ts              ← NEW: Device detection
    useKeyboardShortcuts.ts       ← NEW: iPad keyboard shortcuts

  components/
    navigation/
      index.ts                    ← NEW: Navigation component exports
      AdaptiveNavigation.tsx      ← NEW: Device-aware wrapper
      Sidebar.tsx                 ← NEW: iPad sidebar
      SplitViewLayout.tsx         ← NEW: iPad split view
      ModuleItem.tsx              ← NEW: Shared module button
    WheelNavigationMenu.tsx       ← MODIFY: Extract shared logic
    HoldToNavigateWrapper.tsx     ← MODIFY: Only for phone

  contexts/
    NavigationContext.tsx         ← NEW: Unified navigation state

  config/
    moduleRegistry.ts             ← MODIFY: Add sidebar groups
```

---

## Backward Compatibility

| Aspect | Aanpak |
|--------|--------|
| Bestaande iPhone UX | 100% behouden — geen wijzigingen |
| WheelNavigationMenu | Blijft werken, alleen op iPhone |
| Voice commands | Werken op beide platforms |
| Module ordering | Shared logic, platform-onafhankelijk |
| Usage tracking | Unified across devices |

---

## Senior-Inclusive Design Checklist

- [ ] Sidebar touch targets ≥60pt
- [ ] Text ≥18pt in sidebar labels
- [ ] WCAG AAA contrast in sidebar
- [ ] Haptic feedback op module selectie
- [ ] VoiceOver support voor sidebar
- [ ] Keyboard shortcuts communiceren via Help
- [ ] Consistent iconografie met wheel menu

---

## Test Scenario's

| Test | Platform | Verwacht |
|------|----------|----------|
| Portrait sidebar | iPad | Collapsed, hamburger to open |
| Landscape sidebar | iPad | Expanded, 320pt width |
| Hold gesture | iPhone | Wheel menu opens |
| Hold gesture | iPad | Nothing (sidebar is primary) |
| Two-finger hold | Both | Voice commands active |
| ⌘1 shortcut | iPad | Navigates to Chats |
| Module tap | Both | Navigates + records usage |

---

## Risico's & Mitigaties

| Risico | Mitigatie |
|--------|-----------|
| Sidebar te breed op kleine iPads | Min-width 320pt, collapsible |
| Wheel gesture conflicten op iPad | Disable wheel, use sidebar only |
| Performance met split view | Lazy load module screens |
| i18n text expansion | Flexible sidebar width |

---

## Volgende Stappen

1. Review dit plan
2. Goedkeuring voor start implementatie
3. Begin met Sprint 1 (Foundation)

---

*Plan gemaakt: 2026-02-21*
*Status: Klaar voor review*
