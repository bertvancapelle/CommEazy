# Liquid Glass Player Window — Implementatieplan

## Doel

Implementeer MiniPlayer en FullPlayer in een **aparte native UIWindow** zodat UIGlassEffect daadwerkelijk de onderliggende content kan blurren.

## Architectuur

```
┌─────────────────────────────────────────────────────────────┐
│  UIWindow 1 (Main App Window)                                │
│  windowLevel: .normal                                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  RCTRootView (React Native)                              │ │
│  │  └── Radio/Podcast/Books module content                  │ │
│  │      └── Scrollable station/episode list                 │ │
│  │      └── (MiniPlayer VERWIJDERD uit RN hierarchy)       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  UIWindow 2 (Glass Player Window)                            │
│  windowLevel: .normal + 1                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  UIView met UIGlassEffect                                │ │
│  │  └── RCTRootView voor player content                    │ │
│  │      OF volledig native player UI                        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  States:                                                     │
│  - Mini: frame = bottom 80pt, full width                    │
│  - Full: frame = full screen                                │
│  - Hidden: window.isHidden = true                           │
└─────────────────────────────────────────────────────────────┘
```

## Kern Beslissing: Native UI vs RCTRootView

### Optie A: Volledig Native Player UI (Aanbevolen)
- Player controls zijn native UIKit views
- Eenvoudiger, betere performance
- Geen tweede RCTRootView nodig
- State sync via NativeEventEmitter

### Optie B: RCTRootView in Tweede Window
- Player UI blijft React Native
- Complexer: tweede RN context
- Meer flexibiliteit voor UI changes
- Hogere memory footprint

**Keuze: Optie A** — Native UI is schoner en heeft betere glass effect rendering.

---

## Fasen

### Fase 1: Native Module Infrastructure

**Doel:** Creëer GlassPlayerWindow module die window lifecycle beheert.

**Bestanden:**

```
ios/
  CommEazyTemp/
    GlassPlayerWindow/
      GlassPlayerWindowModule.swift      ← React Native bridge
      GlassPlayerWindowModule.m          ← ObjC bridge header
      GlassPlayerWindow.swift            ← UIWindow subclass
      GlassPlayerView.swift              ← Glass effect container
      MiniPlayerView.swift               ← Native mini player UI
      FullPlayerView.swift               ← Native full player UI
```

**GlassPlayerWindowModule.swift:**
```swift
import Foundation
import UIKit

@objc(GlassPlayerWindowModule)
class GlassPlayerWindowModule: RCTEventEmitter {

    private var playerWindow: GlassPlayerWindow?

    // ============================================================
    // MARK: React Native Bridge Methods
    // ============================================================

    /// Show mini player with content
    @objc func showMiniPlayer(
        _ config: NSDictionary,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            self.ensureWindowExists()
            self.playerWindow?.showMini(with: config)
            resolver(true)
        }
    }

    /// Expand to full player
    @objc func expandToFullPlayer(
        _ resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            self.playerWindow?.expandToFull()
            resolver(true)
        }
    }

    /// Collapse to mini player
    @objc func collapseToMini(
        _ resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            self.playerWindow?.collapseToMini()
            resolver(true)
        }
    }

    /// Hide player completely
    @objc func hidePlayer(
        _ resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            self.playerWindow?.hide()
            resolver(true)
        }
    }

    /// Update player content (artwork, title, progress, etc.)
    @objc func updateContent(_ config: NSDictionary) {
        DispatchQueue.main.async {
            self.playerWindow?.updateContent(config)
        }
    }

    /// Update playback state (isPlaying, isLoading)
    @objc func updatePlaybackState(_ state: NSDictionary) {
        DispatchQueue.main.async {
            self.playerWindow?.updatePlaybackState(state)
        }
    }

    // ============================================================
    // MARK: Window Management
    // ============================================================

    private func ensureWindowExists() {
        guard playerWindow == nil else { return }

        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene else {
            NSLog("[GlassPlayer] ERROR: No window scene available")
            return
        }

        playerWindow = GlassPlayerWindow(windowScene: scene)
        playerWindow?.delegate = self
    }

    // ============================================================
    // MARK: RCTEventEmitter
    // ============================================================

    override func supportedEvents() -> [String]! {
        return [
            "onPlayPause",
            "onStop",
            "onExpand",
            "onCollapse",
            "onSeek",
            "onSkipForward",
            "onSkipBackward",
            "onClose"
        ]
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}
```

---

### Fase 2: GlassPlayerWindow Implementation

**GlassPlayerWindow.swift:**
```swift
import UIKit

class GlassPlayerWindow: UIWindow {

    enum PlayerState {
        case hidden
        case mini
        case full
    }

    weak var delegate: GlassPlayerWindowDelegate?

    private var currentState: PlayerState = .hidden
    private let glassView: GlassPlayerView
    private let miniPlayerView: MiniPlayerView
    private let fullPlayerView: FullPlayerView

    // ============================================================
    // MARK: Layout Constants
    // ============================================================

    private let miniPlayerHeight: CGFloat = 80
    private var safeAreaBottom: CGFloat {
        safeAreaInsets.bottom
    }

    // ============================================================
    // MARK: Initialization
    // ============================================================

    override init(windowScene: UIWindowScene) {
        glassView = GlassPlayerView()
        miniPlayerView = MiniPlayerView()
        fullPlayerView = FullPlayerView()

        super.init(windowScene: windowScene)

        setupWindow()
        setupViews()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupWindow() {
        // Place above main app window
        windowLevel = .normal + 1

        // Start hidden
        isHidden = true

        // Clear background — glass effect provides visuals
        backgroundColor = .clear

        // Root view controller (required)
        rootViewController = UIViewController()
        rootViewController?.view.backgroundColor = .clear
    }

    private func setupViews() {
        guard let rootView = rootViewController?.view else { return }

        // Glass container
        rootView.addSubview(glassView)
        glassView.translatesAutoresizingMaskIntoConstraints = false

        // Mini player content
        glassView.addSubview(miniPlayerView)
        miniPlayerView.translatesAutoresizingMaskIntoConstraints = false
        miniPlayerView.delegate = self

        // Full player content (hidden initially)
        glassView.addSubview(fullPlayerView)
        fullPlayerView.translatesAutoresizingMaskIntoConstraints = false
        fullPlayerView.delegate = self
        fullPlayerView.isHidden = true
    }

    // ============================================================
    // MARK: State Transitions
    // ============================================================

    func showMini(with config: NSDictionary) {
        updateContent(config)

        guard currentState == .hidden else { return }

        // Position at bottom of screen
        let screenBounds = UIScreen.main.bounds
        frame = CGRect(
            x: 0,
            y: screenBounds.height - miniPlayerHeight - safeAreaBottom,
            width: screenBounds.width,
            height: miniPlayerHeight + safeAreaBottom
        )

        // Layout glass view
        glassView.frame = bounds
        miniPlayerView.frame = CGRect(x: 0, y: 0, width: bounds.width, height: miniPlayerHeight)

        // Show with animation
        alpha = 0
        isHidden = false

        UIView.animate(withDuration: 0.3, delay: 0, options: .curveEaseOut) {
            self.alpha = 1
        }

        currentState = .mini
    }

    func expandToFull() {
        guard currentState == .mini else { return }

        let screenBounds = UIScreen.main.bounds

        // Prepare full player
        fullPlayerView.frame = screenBounds
        fullPlayerView.alpha = 0
        fullPlayerView.isHidden = false

        // Animate expansion
        UIView.animate(
            withDuration: 0.4,
            delay: 0,
            usingSpringWithDamping: 0.85,
            initialSpringVelocity: 0.5,
            options: .curveEaseInOut
        ) {
            // Expand window to full screen
            self.frame = screenBounds
            self.glassView.frame = screenBounds

            // Fade transition
            self.miniPlayerView.alpha = 0
            self.fullPlayerView.alpha = 1
        } completion: { _ in
            self.miniPlayerView.isHidden = true
            self.currentState = .full
        }

        delegate?.playerDidExpand()
    }

    func collapseToMini() {
        guard currentState == .full else { return }

        let screenBounds = UIScreen.main.bounds
        let miniFrame = CGRect(
            x: 0,
            y: screenBounds.height - miniPlayerHeight - safeAreaBottom,
            width: screenBounds.width,
            height: miniPlayerHeight + safeAreaBottom
        )

        // Prepare mini player
        miniPlayerView.isHidden = false
        miniPlayerView.alpha = 0

        // Animate collapse
        UIView.animate(
            withDuration: 0.35,
            delay: 0,
            usingSpringWithDamping: 0.9,
            initialSpringVelocity: 0.3,
            options: .curveEaseInOut
        ) {
            // Collapse window
            self.frame = miniFrame
            self.glassView.frame = CGRect(origin: .zero, size: miniFrame.size)
            self.miniPlayerView.frame = CGRect(x: 0, y: 0, width: miniFrame.width, height: self.miniPlayerHeight)

            // Fade transition
            self.fullPlayerView.alpha = 0
            self.miniPlayerView.alpha = 1
        } completion: { _ in
            self.fullPlayerView.isHidden = true
            self.currentState = .mini
        }

        delegate?.playerDidCollapse()
    }

    func hide() {
        UIView.animate(withDuration: 0.25) {
            self.alpha = 0
        } completion: { _ in
            self.isHidden = true
            self.currentState = .hidden
        }
    }

    // ============================================================
    // MARK: Content Updates
    // ============================================================

    func updateContent(_ config: NSDictionary) {
        let content = PlayerContent(from: config)
        miniPlayerView.update(with: content)
        fullPlayerView.update(with: content)
        glassView.updateTintColor(content.tintColorHex)
    }

    func updatePlaybackState(_ state: NSDictionary) {
        let playbackState = PlaybackState(from: state)
        miniPlayerView.updatePlaybackState(playbackState)
        fullPlayerView.updatePlaybackState(playbackState)
    }
}
```

---

### Fase 3: Glass Effect View

**GlassPlayerView.swift:**
```swift
import UIKit

@available(iOS 26.0, *)
class GlassPlayerView: UIView {

    private var glassEffectView: UIVisualEffectView?
    private var tintOverlay: UIView?

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupGlassEffect()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupGlassEffect() {
        backgroundColor = .clear

        // UIGlassEffect — echte Liquid Glass!
        var glassEffect = UIGlassEffect()
        glassEffect.isInteractive = true

        let effectView = UIVisualEffectView(effect: glassEffect)
        effectView.translatesAutoresizingMaskIntoConstraints = false
        insertSubview(effectView, at: 0)

        NSLayoutConstraint.activate([
            effectView.leadingAnchor.constraint(equalTo: leadingAnchor),
            effectView.trailingAnchor.constraint(equalTo: trailingAnchor),
            effectView.topAnchor.constraint(equalTo: topAnchor),
            effectView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        glassEffectView = effectView

        // Tint overlay
        let tint = UIView()
        tint.translatesAutoresizingMaskIntoConstraints = false
        tint.backgroundColor = UIColor.systemTeal.withAlphaComponent(0.25)
        insertSubview(tint, at: 1)

        NSLayoutConstraint.activate([
            tint.leadingAnchor.constraint(equalTo: leadingAnchor),
            tint.trailingAnchor.constraint(equalTo: trailingAnchor),
            tint.topAnchor.constraint(equalTo: topAnchor),
            tint.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        tintOverlay = tint
    }

    func updateTintColor(_ hexColor: String) {
        guard let color = UIColor(hexString: hexColor) else { return }

        UIView.animate(withDuration: 0.2) {
            self.tintOverlay?.backgroundColor = color.withAlphaComponent(0.25)
        }

        // Update glass effect tint
        if var effect = glassEffectView?.effect as? UIGlassEffect {
            effect.tintColor = color.withAlphaComponent(0.3)
            glassEffectView?.effect = effect
        }
    }
}
```

---

### Fase 4: React Native Integration

**src/services/glassPlayer.ts:**
```typescript
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type { ModuleColorId } from '@/types/liquidGlass';

const { GlassPlayerWindowModule } = NativeModules;

// Only available on iOS 26+
const isAvailable = Platform.OS === 'ios' && GlassPlayerWindowModule != null;

export interface PlayerContent {
  moduleId: ModuleColorId;
  tintColorHex: string;
  artwork: string | null;
  title: string;
  subtitle?: string;
  progressType: 'bar' | 'duration';
  progress?: number;
  listenDuration?: number;
  showStopButton?: boolean;
}

export interface PlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering?: boolean;
}

class GlassPlayerService {
  private eventEmitter: NativeEventEmitter | null = null;
  private listeners: Map<string, (...args: any[]) => void> = new Map();

  constructor() {
    if (isAvailable) {
      this.eventEmitter = new NativeEventEmitter(GlassPlayerWindowModule);
    }
  }

  get isAvailable(): boolean {
    return isAvailable;
  }

  async showMiniPlayer(content: PlayerContent): Promise<void> {
    if (!isAvailable) return;
    await GlassPlayerWindowModule.showMiniPlayer(content);
  }

  async expandToFullPlayer(): Promise<void> {
    if (!isAvailable) return;
    await GlassPlayerWindowModule.expandToFullPlayer();
  }

  async collapseToMini(): Promise<void> {
    if (!isAvailable) return;
    await GlassPlayerWindowModule.collapseToMini();
  }

  async hidePlayer(): Promise<void> {
    if (!isAvailable) return;
    await GlassPlayerWindowModule.hidePlayer();
  }

  updateContent(content: Partial<PlayerContent>): void {
    if (!isAvailable) return;
    GlassPlayerWindowModule.updateContent(content);
  }

  updatePlaybackState(state: PlaybackState): void {
    if (!isAvailable) return;
    GlassPlayerWindowModule.updatePlaybackState(state);
  }

  // Event listeners
  onPlayPause(handler: () => void): () => void {
    return this.addListener('onPlayPause', handler);
  }

  onStop(handler: () => void): () => void {
    return this.addListener('onStop', handler);
  }

  onExpand(handler: () => void): () => void {
    return this.addListener('onExpand', handler);
  }

  onCollapse(handler: () => void): () => void {
    return this.addListener('onCollapse', handler);
  }

  onSeek(handler: (position: number) => void): () => void {
    return this.addListener('onSeek', handler);
  }

  private addListener(event: string, handler: (...args: any[]) => void): () => void {
    if (!this.eventEmitter) return () => {};

    const subscription = this.eventEmitter.addListener(event, handler);
    return () => subscription.remove();
  }
}

export const glassPlayerService = new GlassPlayerService();
```

---

### Fase 5: Hook voor Module Integratie

**src/hooks/useGlassPlayer.ts:**
```typescript
import { useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { glassPlayerService, type PlayerContent, type PlaybackState } from '@/services/glassPlayer';
import { useLiquidGlassContextSafe } from '@/contexts/LiquidGlassContext';
import { MODULE_TINT_COLORS } from '@/types/liquidGlass';
import type { ModuleColorId } from '@/types/liquidGlass';

interface UseGlassPlayerOptions {
  moduleId: ModuleColorId;
  onPlayPause: () => void;
  onStop?: () => void;
  onSeek?: (position: number) => void;
  onSkipForward?: () => void;
  onSkipBackward?: () => void;
}

export function useGlassPlayer(options: UseGlassPlayerOptions) {
  const liquidGlassContext = useLiquidGlassContextSafe();
  const isGlassEnabled = liquidGlassContext?.isEnabled && glassPlayerService.isAvailable;

  const contentRef = useRef<PlayerContent | null>(null);

  // Setup event listeners
  useEffect(() => {
    if (!isGlassEnabled) return;

    const unsubscribers = [
      glassPlayerService.onPlayPause(options.onPlayPause),
      options.onStop ? glassPlayerService.onStop(options.onStop) : null,
      options.onSeek ? glassPlayerService.onSeek(options.onSeek) : null,
    ].filter(Boolean) as (() => void)[];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [isGlassEnabled, options]);

  // Show mini player
  const showMiniPlayer = useCallback(async (content: Omit<PlayerContent, 'moduleId' | 'tintColorHex'>) => {
    if (!isGlassEnabled) return;

    const moduleColors = MODULE_TINT_COLORS[options.moduleId];
    const fullContent: PlayerContent = {
      ...content,
      moduleId: options.moduleId,
      tintColorHex: moduleColors?.tintColor || '#007AFF',
    };

    contentRef.current = fullContent;
    await glassPlayerService.showMiniPlayer(fullContent);
  }, [isGlassEnabled, options.moduleId]);

  // Expand to full
  const expandToFull = useCallback(async () => {
    if (!isGlassEnabled) return;
    await glassPlayerService.expandToFullPlayer();
  }, [isGlassEnabled]);

  // Collapse to mini
  const collapseToMini = useCallback(async () => {
    if (!isGlassEnabled) return;
    await glassPlayerService.collapseToMini();
  }, [isGlassEnabled]);

  // Hide player
  const hidePlayer = useCallback(async () => {
    if (!isGlassEnabled) return;
    await glassPlayerService.hidePlayer();
    contentRef.current = null;
  }, [isGlassEnabled]);

  // Update content
  const updateContent = useCallback((content: Partial<PlayerContent>) => {
    if (!isGlassEnabled) return;
    glassPlayerService.updateContent(content);
  }, [isGlassEnabled]);

  // Update playback state
  const updatePlaybackState = useCallback((state: PlaybackState) => {
    if (!isGlassEnabled) return;
    glassPlayerService.updatePlaybackState(state);
  }, [isGlassEnabled]);

  return {
    isGlassEnabled,
    showMiniPlayer,
    expandToFull,
    collapseToMini,
    hidePlayer,
    updateContent,
    updatePlaybackState,
  };
}
```

---

### Fase 6: RadioScreen Integratie

**Wijzigingen in RadioScreen.tsx:**

```typescript
// Voeg hook import toe
import { useGlassPlayer } from '@/hooks/useGlassPlayer';

// In component:
const {
  isGlassEnabled,
  showMiniPlayer,
  expandToFull,
  collapseToMini,
  hidePlayer,
  updatePlaybackState,
} = useGlassPlayer({
  moduleId: 'radio',
  onPlayPause: handlePlayPause,
  onStop: handleStop,
});

// Bij station starten:
useEffect(() => {
  if (isGlassEnabled && currentStation && isPlaying) {
    showMiniPlayer({
      artwork: currentStation.artwork || null,
      title: currentStation.name,
      subtitle: streamMetadata?.title,
      progressType: 'duration',
      listenDuration: listenDuration,
      showStopButton: true,
    });
  } else if (isGlassEnabled && !isPlaying) {
    hidePlayer();
  }
}, [isGlassEnabled, currentStation, isPlaying]);

// Update playback state
useEffect(() => {
  if (isGlassEnabled) {
    updatePlaybackState({ isPlaying, isLoading, isBuffering });
  }
}, [isGlassEnabled, isPlaying, isLoading, isBuffering]);

// In render — alleen tonen als NIET glass enabled
{!isGlassEnabled && shouldShowPlayer && (
  <MiniPlayer
    moduleId="radio"
    // ... existing props
  />
)}
```

---

## Fallback Strategie

| Platform | Gedrag |
|----------|--------|
| iOS 26+ met Liquid Glass enabled | Native GlassPlayerWindow |
| iOS 26+ met Liquid Glass disabled | Bestaande React Native MiniPlayer |
| iOS <26 | Bestaande React Native MiniPlayer |
| Android | Bestaande React Native MiniPlayer |

De `useGlassPlayer` hook detecteert automatisch of de native window beschikbaar is.

---

## Verificatie Checklist

### Fase 1-2: Native Module
- [ ] GlassPlayerWindowModule compileert
- [ ] Window verschijnt boven app
- [ ] Glass effect blurt achterliggende content

### Fase 3-4: Animaties
- [ ] Mini → Full animatie vloeiend
- [ ] Full → Mini animatie vloeiend
- [ ] Hide animatie vloeiend

### Fase 5-6: Integration
- [ ] Radio gebruikt native player wanneer beschikbaar
- [ ] Events (play/pause/stop) werken correct
- [ ] Fallback naar RN player op iOS <26

### UX
- [ ] MiniPlayer altijd onderaan (niet versleepbaar)
- [ ] FullPlayer neemt hele scherm
- [ ] Touch events correct gerouteerd
- [ ] Accessibility labels aanwezig

---

## Risico's en Mitigaties

| Risico | Mitigatie |
|--------|-----------|
| Complexe state sync | Events via NativeEventEmitter, single source of truth in RN |
| Memory overhead | Window cleanup in hidePlayer(), lazy initialization |
| iOS version checks | Uitgebreide `@available` guards, fallback altijd beschikbaar |
| Touch handling bugs | Uitgebreid testen op fysiek device |

---

## Geschatte Scope

| Fase | Bestanden | Complexiteit |
|------|-----------|--------------|
| 1 | 2 Swift, 1 ObjC | Medium |
| 2 | 1 Swift | High |
| 3 | 1 Swift | Medium |
| 4 | 1 TypeScript | Low |
| 5 | 1 TypeScript | Low |
| 6 | 3 screens (Radio/Podcast/Books) | Medium |

**Totaal:** ~6-8 nieuwe bestanden, ~3 gewijzigde screens
