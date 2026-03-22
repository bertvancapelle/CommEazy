/**
 * Post-install script to patch third-party packages.
 *
 * react-native-render-html v6.x and its dependency
 * @native-html/transient-render-engine both set "react-native": "src/"
 * in their package.json which causes Metro to bundle raw TypeScript
 * source instead of the compiled CommonJS build. This breaks module
 * resolution for internal imports.
 *
 * This script disables the "react-native" field so Metro uses "main"
 * (lib/commonjs/index.js) which contains properly compiled JavaScript.
 */

const fs = require('fs');
const path = require('path');

const patches = [
  {
    package: 'react-native-camera-kit',
    file: 'ios/ReactNativeCameraKit/Types.swift',
    find: '    var avQualityPrioritization: AVCapturePhotoOutput.QualityPrioritization {',
    replace: '    @available(iOS 13.0, *)\n    var avQualityPrioritization: AVCapturePhotoOutput.QualityPrioritization {',
  },
  {
    package: 'react-native-render-html',
    file: 'package.json',
    find: '"react-native": "src/"',
    replace: '"_react-native-DISABLED": "src/"',
  },
  {
    package: '@native-html/transient-render-engine',
    file: 'package.json',
    find: '"react-native": "src/"',
    replace: '"_react-native-DISABLED": "src/"',
  },
  {
    package: '@native-html/css-processor',
    file: 'package.json',
    find: '"react-native": "src/"',
    replace: '"_react-native-DISABLED": "src/"',
  },
];

for (const patch of patches) {
  const filePath = path.join(
    __dirname,
    '..',
    'node_modules',
    patch.package,
    patch.file,
  );

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(patch.find)) {
      content = content.replace(patch.find, patch.replace);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[patch-packages] Patched ${patch.package}/${patch.file}`);
    }
  } catch {
    // Package not installed yet — skip silently
  }
}

// ============================================================
// react-native-screens 4.24.0 codegen compatibility fix
// ============================================================
// react-native-screens 4.24.0 uses `import type { CodegenTypes as CT } from 'react-native'`
// and `CT.WithDefault<...>`, `CT.Float`, `CT.Int32` in its fabric codegen specs.
// RN 0.78's codegen parser is a static analyzer that doesn't resolve TypeScript
// namespace aliases — it only recognizes direct imports from
// 'react-native/Libraries/Types/CodegenTypes'.
// This patch rewrites all affected fabric spec files to use direct imports.
function patchRNScreensCodegen() {
  const fabricDir = path.join(
    __dirname, '..', 'node_modules', 'react-native-screens', 'src', 'fabric'
  );

  if (!fs.existsSync(fabricDir)) return;

  function processDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        processDir(fullPath);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        patchCodegenFile(fullPath);
      }
    }
  }

  function patchCodegenFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Skip files that don't use the CT alias pattern
    if (!content.includes('CodegenTypes as CT')) return;

    // Collect which CT.xxx types are used in this file
    const usedTypes = new Set();
    const ctUsageRegex = /CT\.(\w+)/g;
    let match;
    while ((match = ctUsageRegex.exec(content)) !== null) {
      usedTypes.add(match[1]);
    }

    if (usedTypes.size === 0) return;

    // Build the direct import statement
    const typesList = Array.from(usedTypes).sort().join(', ');

    // Remove CodegenTypes from the react-native import
    // Pattern 1: import type { CodegenTypes as CT, ViewProps } from 'react-native';
    content = content.replace(
      /import\s+type\s*\{([^}]*?)CodegenTypes\s+as\s+CT\s*,?\s*([^}]*?)\}\s*from\s*'react-native'\s*;/,
      (_, before, after) => {
        // Clean up remaining imports
        const remaining = [before, after]
          .join(',')
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        let result = '';
        if (remaining.length > 0) {
          result += `import type { ${remaining.join(', ')} } from 'react-native';\n`;
        }
        result += `import type { ${typesList} } from 'react-native/Libraries/Types/CodegenTypes';`;
        return result;
      }
    );

    // Replace all CT.Xxx references with direct Xxx
    content = content.replace(/CT\.(\w+)/g, '$1');

    fs.writeFileSync(filePath, content, 'utf8');
    const relPath = path.relative(
      path.join(__dirname, '..', 'node_modules'),
      filePath
    );
    console.log(`[patch-packages] Patched react-native-screens codegen: ${relPath}`);
  }

  processDir(fabricDir);
}

patchRNScreensCodegen();

// NOTE: AirPlay session deactivation patch was removed — removing deactivateSession()
// from configureAudioSession() caused audio to stop completely on both AirPlay AND
// iPhone. The correct fix is to avoid TrackPlayer.reset() during station switches
// in RadioContext.tsx (use removeUpcomingTracks + skipToNext instead).

// ============================================================
// SwiftAudioEx: AirPlay route change recovery (v11)
// ============================================================
// v1-v4: Custom route change handling — INTERFERED with iOS AirPlay handshake.
// v6-v7: Diagnostics revealed AVPlayer pauses during AirPlay transition.
// v8: Rate recovery after route change — works but route already fell back to Speaker.
// v9: allowsExternalPlayback=true — NOT the root cause (both true/false fail).
// v10: INTERRUPTION BEGAN recovery — isAirPlay already false when handler fires, INEFFECTIVE.
// v11: ROOT CAUSE FOUND via Apple Developer Forums #742034 + Apple TechNote QA1803:
//   iOS changes category from .playback to .playAndRecord during AirPlay route switch.
//   .playAndRecord only supports mirrored AirPlay, breaking non-mirrored audio routing.
//   Fix: When routeChangeNotification fires with reason=categoryChange, re-apply
//   setCategory(.playback, .longFormAudio) to restore the correct configuration.
function patchSwiftAudioExAirPlayDiagnostics() {
  const filePath = path.join(
    __dirname, '..', 'ios', 'Pods', 'SwiftAudioEx', 'Sources',
    'SwiftAudioEx', 'AVPlayerWrapper', 'AVPlayerWrapper.swift'
  );

  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Already patched? (v10 adds AirPlay interruption recovery)
  if (content.includes('wasPlayingOnAirPlayBeforeInterruption')) return;

  // 1. Add diagnostic logging to didChangeTimeControlStatus entry
  const timeControlFunc = `    func player(didChangeTimeControlStatus status: AVPlayer.TimeControlStatus) {
        switch status {`;

  if (content.includes(timeControlFunc)) {
    content = content.replace(
      timeControlFunc,
      `    func player(didChangeTimeControlStatus status: AVPlayer.TimeControlStatus) {
        let outputType = AVAudioSession.sharedInstance().currentRoute.outputs.first?.portType.rawValue ?? "none"
        NSLog("[AVPlayerWrapper] timeControlStatus=%ld playWhenReady=%d rate=%.1f output=%@ state=%@",
              status.rawValue, self.playWhenReady, self.avPlayer.rate, outputType, "\\(self._state)")
        switch status {`
    );
  }

  // 2. Add logging to waitingToPlay case
  const waitingCase = `        case .waitingToPlayAtSpecifiedRate:
            if self.asset != nil {
                self.state = .buffering
            }`;

  if (content.includes(waitingCase)) {
    content = content.replace(
      waitingCase,
      `        case .waitingToPlayAtSpecifiedRate:
            if self.asset != nil {
                NSLog("[AVPlayerWrapper] .waitingToPlay reason=%@", self.avPlayer.reasonForWaitingToPlay?.rawValue ?? "nil")
                self.state = .buffering
            }`
    );
  }

  // 3. Add route change + interruption observers to init() with v10 AirPlay recovery
  const initEnd = `        setupAVPlayer();
    }`;

  // Find the init() method's setupAVPlayer call (must be the one inside public init)
  if (content.includes(initEnd) && !content.includes('routeChangeNotification')) {
    content = content.replace(
      initEnd,
      `        setupAVPlayer();

        // Observe route changes for diagnostics + v8 AirPlay recovery.
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(routeChangeNotification(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance()
        )
        // v10: Observe interruptions for AirPlay recovery
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(interruptionNotification(_:)),
            name: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance()
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /// v10: Track whether we're in an AirPlay interruption recovery
    private var airPlayInterruptionRecoveryPending = false
    /// v10: Remember if we were playing when interrupted on AirPlay
    private var wasPlayingOnAirPlayBeforeInterruption = false

    @objc private func interruptionNotification(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
        let session = AVAudioSession.sharedInstance()
        let output = session.currentRoute.outputs.first
        let outputType = output?.portType.rawValue ?? "none"
        let isAirPlay = output?.portType == .airPlay

        if type == .began {
            let wasPlaying = self.playWhenReady && self.avPlayer.rate > 0
            NSLog("[AVPlayerWrapper] INTERRUPTION BEGAN output=%@ rate=%.1f playWhenReady=%d isAirPlay=%d wasPlaying=%d",
                  outputType, self.avPlayer.rate, self.playWhenReady ? 1 : 0, isAirPlay ? 1 : 0, wasPlaying ? 1 : 0)

            if isAirPlay && wasPlaying && self.asset != nil {
                self.wasPlayingOnAirPlayBeforeInterruption = true
                self.airPlayInterruptionRecoveryPending = true
                NSLog("[AVPlayerWrapper] v10: AirPlay interruption detected — starting aggressive recovery")

                for (index, delay) in [0.05, 0.2, 0.5, 1.0].enumerated() {
                    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                        guard let self = self else { return }
                        guard self.wasPlayingOnAirPlayBeforeInterruption && self.playWhenReady && self.asset != nil else {
                            return
                        }

                        let currentOutput = AVAudioSession.sharedInstance().currentRoute.outputs.first
                        let currentOutputType = currentOutput?.portType.rawValue ?? "none"
                        NSLog("[AVPlayerWrapper] v10: Recovery attempt %d (%.0fms) output=%@ rate=%.1f",
                              index + 1, delay * 1000, currentOutputType, self.avPlayer.rate)

                        do {
                            try AVAudioSession.sharedInstance().setActive(true, options: [])
                        } catch {
                            NSLog("[AVPlayerWrapper] v10: setActive failed at attempt %d: %@", index + 1, error.localizedDescription)
                        }

                        if self.avPlayer.rate == 0 {
                            NSLog("[AVPlayerWrapper] v10: Forcing resume at attempt %d", index + 1)
                            self.avPlayer.rate = self._rate
                        }

                        if self.avPlayer.rate > 0 {
                            let finalOutput = AVAudioSession.sharedInstance().currentRoute.outputs.first?.portType.rawValue ?? "none"
                            NSLog("[AVPlayerWrapper] v10: Recovery succeeded at attempt %d. Playing on %@", index + 1, finalOutput)
                            self.wasPlayingOnAirPlayBeforeInterruption = false
                            self.airPlayInterruptionRecoveryPending = false
                        }
                    }
                }
            }
        } else {
            let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let shouldResume = AVAudioSession.InterruptionOptions(rawValue: optionsValue).contains(.shouldResume)
            NSLog("[AVPlayerWrapper] INTERRUPTION ENDED shouldResume=%d output=%@ rate=%.1f", shouldResume ? 1 : 0, outputType, self.avPlayer.rate)

            if shouldResume && self.playWhenReady && self.avPlayer.rate == 0 && self.asset != nil {
                NSLog("[AVPlayerWrapper] v10: Resuming after interruption ended (shouldResume=true)")
                do {
                    try AVAudioSession.sharedInstance().setActive(true, options: [])
                } catch {
                    NSLog("[AVPlayerWrapper] v10: Failed to re-activate session on ENDED: %@", error.localizedDescription)
                }
                self.avPlayer.rate = self._rate
            }

            self.wasPlayingOnAirPlayBeforeInterruption = false
            self.airPlayInterruptionRecoveryPending = false
        }
    }

    @objc private func routeChangeNotification(_ notification: Notification) {
        let session = AVAudioSession.sharedInstance()
        let output = session.currentRoute.outputs.first
        let outputType = output?.portType.rawValue ?? "none"
        let outputName = output?.portName ?? "none"

        let reasonRaw = (notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt) ?? 99
        let reasonEnum = AVAudioSession.RouteChangeReason(rawValue: reasonRaw)
        let reason: String
        switch reasonEnum {
        case .newDeviceAvailable:      reason = "newDeviceAvailable"
        case .oldDeviceUnavailable:    reason = "oldDeviceUnavailable"
        case .categoryChange:          reason = "categoryChange"
        case .override:                reason = "override"
        case .wakeFromSleep:           reason = "wakeFromSleep"
        case .noSuitableRouteForCategory: reason = "noSuitableRouteForCategory"
        case .routeConfigurationChange: reason = "routeConfigurationChange"
        default:                       reason = "unknown(\\(reasonRaw))"
        }

        let prevOutput = (notification.userInfo?[AVAudioSessionRouteChangePreviousRouteKey] as? AVAudioSessionRouteDescription)?
            .outputs.first?.portType.rawValue ?? "none"

        NSLog("[AVPlayerWrapper] ROUTE CHANGE reason=%@ prev=%@ now=%@ (%@) cat=%@ policy=%ld opts=%lu rate=%.1f extPlayback=%d extActive=%d",
              reason, prevOutput, outputType, outputName,
              session.category.rawValue,
              session.routeSharingPolicy.rawValue,
              session.categoryOptions.rawValue,
              self.avPlayer.rate,
              self.avPlayer.allowsExternalPlayback ? 1 : 0,
              self.avPlayer.isExternalPlaybackActive ? 1 : 0)

        // v11 fix: When iOS reports a categoryChange during AirPlay route transition,
        // it may have changed our category from .playback to .playAndRecord (or similar).
        // .playAndRecord only supports mirrored AirPlay, breaking non-mirrored audio routing.
        // Apple Developer Forums #742034 confirms this is a known iOS behavior.
        // Fix: Re-apply our desired .playback + .longFormAudio configuration immediately,
        // then re-activate the session and resume playback after a short delay.
        if reasonEnum == .categoryChange && self.playWhenReady && self.asset != nil {
            let currentCategory = session.category
            let currentPolicy = session.routeSharingPolicy
            let needsRestore = currentCategory != .playback || currentPolicy != .longFormAudio

            NSLog("[AVPlayerWrapper] v11: categoryChange detected. cat=%@ policy=%ld needsRestore=%d",
                  currentCategory.rawValue, currentPolicy.rawValue, needsRestore ? 1 : 0)

            if needsRestore {
                NSLog("[AVPlayerWrapper] v11: Re-applying .playback + .longFormAudio (was cat=%@ policy=%ld)",
                      currentCategory.rawValue, currentPolicy.rawValue)
                do {
                    try session.setCategory(
                        .playback,
                        mode: .default,
                        policy: .longFormAudio,
                        options: []
                    )
                    NSLog("[AVPlayerWrapper] v11: setCategory succeeded")
                } catch {
                    NSLog("[AVPlayerWrapper] v11: setCategory FAILED: %@", error.localizedDescription)
                }

                do {
                    try session.setActive(true, options: [])
                    NSLog("[AVPlayerWrapper] v11: setActive succeeded")
                } catch {
                    NSLog("[AVPlayerWrapper] v11: setActive FAILED: %@", error.localizedDescription)
                }
            }

            // Resume playback after a short delay to let iOS complete the route transition.
            // Even if category was already correct, the route change may have paused playback.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                guard let self = self else { return }
                if self.playWhenReady && self.avPlayer.rate == 0 && self.asset != nil {
                    let postOutput = AVAudioSession.sharedInstance().currentRoute.outputs.first?.portType.rawValue ?? "none"
                    NSLog("[AVPlayerWrapper] v11: Resuming after categoryChange. output=%@", postOutput)
                    self.avPlayer.rate = self._rate
                }
            }
        }

        // v8 fix: When route changes (any reason) and playWhenReady is true but AVPlayer has
        // stopped (rate=0), nudge it to resume.
        if reasonEnum != .categoryChange && self.playWhenReady && self.asset != nil {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                guard let self = self else { return }
                if self.playWhenReady && self.avPlayer.rate == 0 && self.asset != nil {
                    let currentOutput = AVAudioSession.sharedInstance().currentRoute.outputs.first?.portType.rawValue ?? "none"
                    NSLog("[AVPlayerWrapper] ROUTE CHANGE RECOVERY: rate was 0 with playWhenReady=true, resuming. output=%@", currentOutput)
                    self.avPlayer.rate = self._rate
                }
            }
        }
    }`
    );
  }

  // 4. Explicitly enable allowsExternalPlayback (v9 fix).
  // Previous versions (v7b-v8) set this to false, thinking it was only for video mirroring.
  // However, setting allowsExternalPlayback=false causes iOS to reject AirPlay audio routing
  // entirely — the route momentarily switches to AirPlay then immediately falls back to Speaker.
  // The default is true, and Apple Music (which works perfectly with AirPlay) keeps it true.
  // We explicitly set it to true to ensure any previous false value is overwritten.
  const setupFunc = `    private func setupAVPlayer() {\n`;
  if (content.includes(setupFunc) && !content.includes('allowsExternalPlayback = true')) {
    // Remove any existing allowsExternalPlayback = false line first
    content = content.replace(/\s*avPlayer\.allowsExternalPlayback = false\n?/g, '\n');
    // Add allowsExternalPlayback = true
    content = content.replace(
      setupFunc,
      `    private func setupAVPlayer() {\n        avPlayer.allowsExternalPlayback = true\n`
    );
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[patch-packages] Patched SwiftAudioEx AVPlayerWrapper.swift: AirPlay v11 — categoryChange setCategory re-apply + route change recovery + diagnostics');
}

patchSwiftAudioExAirPlayDiagnostics();

// ============================================================
// Firebase 11.x + RNFB 21.x: FIRAuth Swift header compatibility
// ============================================================
// Firebase 11.x rewrote FIRAuth in Swift. The ObjC interface is only available
// via the auto-generated FirebaseAuth-Swift.h header, which is a build artifact
// (~39,500 lines) created during FirebaseAuth's Swift compilation.
//
// Problem: In a single CocoaPods project, RNFBMessaging may compile before
// FirebaseAuth, so FirebaseAuth-Swift.h doesn't exist yet.
//
// Solution: Patch RNFBMessaging+AppDelegate.m to use ObjC runtime dispatch
// for FIRAuth calls instead of compile-time class references. This avoids
// needing the Swift-generated header at compile time.
function patchRNFBMessagingForFirebaseAuth() {
  const filePath = path.join(
    __dirname, '..', 'node_modules',
    '@react-native-firebase', 'messaging', 'ios',
    'RNFBMessaging', 'RNFBMessaging+AppDelegate.m'
  );

  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Already patched?
  if (content.includes('NSClassFromString(@"FIRAuth")')) return;

  // Replace the compile-time FIRAuth usage with runtime dynamic dispatch.
  // Original code (lines 120-149):
  //   #if __has_include(<FirebaseAuth/FirebaseAuth.h>)
  //     for (id appId in [FIRApp allApps]) {
  //       FIRApp *app = [[FIRApp allApps] objectForKey:appId];
  //       if ([[FIRAuth authWithApp:app] canHandleNotification:userInfo]) { ... }
  //     }
  //     ... probe notification check ...
  //   #endif
  //
  // Replacement: Use NSClassFromString + performSelector to avoid compile-time
  // dependency on FIRAuth class interface (which requires FirebaseAuth-Swift.h).

  const oldBlock = `#if __has_include(<FirebaseAuth/FirebaseAuth.h>)

  for (id appId in [FIRApp allApps]) {
    FIRApp *app = [[FIRApp allApps] objectForKey:appId];
    if ([[FIRAuth authWithApp:app] canHandleNotification:userInfo]) {
      DLog(@"didReceiveRemoteNotification Firebase Auth handled the notification with instance: %@",
           app.name);
      completionHandler(UIBackgroundFetchResultNoData);
      return;
    }
  }

  // If the notification is a probe notification, always call the completion
  // handler with UIBackgroundFetchResultNoData.
  //
  // This fixes a race condition between \`FIRAuth/didReceiveRemoteNotification\` and this
  // module causing detox to hang when \`FIRAuth/didReceiveRemoteNotification\` is called first.
  // see
  // https://stackoverflow.com/questions/72044950/detox-tests-hang-with-pending-items-on-dispatch-queue/72989494
  NSDictionary *data = userInfo[@"com.google.firebase.auth"];
  if ([data isKindOfClass:[NSString class]]) {
    // Deserialize in case the data is a JSON string.
    NSData *JSONData = [((NSString *)data) dataUsingEncoding:NSUTF8StringEncoding];
    data = [NSJSONSerialization JSONObjectWithData:JSONData options:0 error:NULL];
  }
  if ([data isKindOfClass:[NSDictionary class]] && data[@"warning"]) {
    completionHandler(UIBackgroundFetchResultNoData);
    return;
  }
#endif`;

  const newBlock = `// [patch-packages] Firebase 11.x: Use runtime dispatch for FIRAuth to avoid
  // compile-time dependency on FirebaseAuth-Swift.h (build artifact).
  {
    Class firAuthClass = NSClassFromString(@"FIRAuth");
    if (firAuthClass) {
      SEL authWithAppSel = NSSelectorFromString(@"authWithApp:");
      SEL canHandleSel = NSSelectorFromString(@"canHandleNotification:");
      for (id appId in [FIRApp allApps]) {
        FIRApp *app = [[FIRApp allApps] objectForKey:appId];
        if ([firAuthClass respondsToSelector:authWithAppSel]) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
          id auth = [firAuthClass performSelector:authWithAppSel withObject:app];
#pragma clang diagnostic pop
          if (auth && [auth respondsToSelector:canHandleSel]) {
            NSMethodSignature *sig = [auth methodSignatureForSelector:canHandleSel];
            NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:sig];
            [invocation setSelector:canHandleSel];
            [invocation setTarget:auth];
            NSDictionary *info = userInfo;
            [invocation setArgument:&info atIndex:2];
            [invocation invoke];
            BOOL handled = NO;
            [invocation getReturnValue:&handled];
            if (handled) {
              DLog(@"didReceiveRemoteNotification Firebase Auth handled the notification with instance: %@",
                   app.name);
              completionHandler(UIBackgroundFetchResultNoData);
              return;
            }
          }
        }
      }
    }

    // Probe notification check (same as original)
    NSDictionary *data = userInfo[@"com.google.firebase.auth"];
    if ([data isKindOfClass:[NSString class]]) {
      NSData *JSONData = [((NSString *)data) dataUsingEncoding:NSUTF8StringEncoding];
      data = [NSJSONSerialization JSONObjectWithData:JSONData options:0 error:NULL];
    }
    if ([data isKindOfClass:[NSDictionary class]] && data[@"warning"]) {
      completionHandler(UIBackgroundFetchResultNoData);
      return;
    }
  }`;

  if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[patch-packages] Patched RNFBMessaging+AppDelegate.m: FIRAuth → runtime dispatch');
  } else {
    console.log('[patch-packages] WARNING: Could not find expected FIRAuth block in RNFBMessaging+AppDelegate.m');
  }
}

patchRNFBMessagingForFirebaseAuth();

// ============================================================
// RNTrackPlayer: Guard configureAudioSession setCategory calls
// ============================================================
// RNTrackPlayer calls configureAudioSession() on every playWhenReady change.
// The original unconditionally calls setCategory() AND setActive(true) which
// during an active AirPlay 2 route transition disrupts the iOS handshake and
// causes the route to fall back to the local speaker. This patch:
// (a) guards activateSession() to only run when session is NOT already active
// (b) adds a needsUpdate check so setCategory() is only called when needed
// (c) adds diagnostic logging to see when session (de)activation happens
function patchRNTrackPlayerConfigureAudioSession() {
  const filePath = path.join(
    __dirname, '..', 'node_modules',
    'react-native-track-player', 'ios',
    'RNTrackPlayer', 'RNTrackPlayer.swift'
  );

  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Already patched? Check for the activateSession guard (v7)
  if (content.includes('!audioSessionController.audioSessionIsActive')) return;

  // Original code from react-native-track-player 4.1.2
  const oldCode = `        if (player.playWhenReady) {
            try? audioSessionController.activateSession()
            if #available(iOS 11.0, *) {
                try? AVAudioSession.sharedInstance().setCategory(sessionCategory, mode: sessionCategoryMode, policy: sessionCategoryPolicy, options: sessionCategoryOptions)
            } else {
                try? AVAudioSession.sharedInstance().setCategory(sessionCategory, mode: sessionCategoryMode, options: sessionCategoryOptions)
            }
        }`;

  const newCode = `        if (player.playWhenReady) {
            NSLog("[RNTrackPlayer] configureAudioSession: ACTIVATE output=%@ isActive=%d", outputType, audioSessionController.audioSessionIsActive)
            // [patch-packages] Only activate if not already active. Calling setActive(true)
            // during an active AirPlay 2 route transition disrupts the iOS handshake
            // and causes the route to fall back to the local speaker.
            if !audioSessionController.audioSessionIsActive {
                try? audioSessionController.activateSession()
            }
            // [patch-packages] Only call setCategory if the session doesn't already
            // have the correct configuration. Calling setCategory during active
            // AirPlay 2 playback triggers a route renegotiation that can cause a
            // 5-6s timeout and fallback to the local speaker.
            if #available(iOS 11.0, *) {
                let session = AVAudioSession.sharedInstance()
                let needsUpdate = session.category != sessionCategory
                    || session.mode != sessionCategoryMode
                    || session.routeSharingPolicy != sessionCategoryPolicy
                    || session.categoryOptions != sessionCategoryOptions
                if needsUpdate {
                    NSLog("[RNTrackPlayer] configureAudioSession: setCategory NEEDED cat=%@ policy=%ld output=%@",
                          sessionCategory.rawValue, sessionCategoryPolicy.rawValue, outputType)
                    try? session.setCategory(sessionCategory, mode: sessionCategoryMode, policy: sessionCategoryPolicy, options: sessionCategoryOptions)
                }
            } else {
                try? AVAudioSession.sharedInstance().setCategory(sessionCategory, mode: sessionCategoryMode, options: sessionCategoryOptions)
            }
        } else {
            NSLog("[RNTrackPlayer] configureAudioSession: SKIP (playWhenReady=false) output=%@", outputType)
        }`;

  // Also need to add outputType variable at top of configureAudioSession
  const funcHeader = `    private func configureAudioSession() {

        // deactivate the session when there is no current item to be played`;

  const funcHeaderNew = `    private func configureAudioSession() {
        let outputType = AVAudioSession.sharedInstance().currentRoute.outputs.first?.portType.rawValue ?? "none"

        // deactivate the session when there is no current item to be played`;

  // Also add logging to deactivation
  const deactivateCode = `        if (player.currentItem == nil) {
            try? audioSessionController.deactivateSession()
            return
        }`;

  const deactivateCodeNew = `        if (player.currentItem == nil) {
            NSLog("[RNTrackPlayer] configureAudioSession: DEACTIVATE (no item) output=%@", outputType)
            try? audioSessionController.deactivateSession()
            return
        }`;

  if (content.includes(oldCode)) {
    content = content.replace(funcHeader, funcHeaderNew);
    content = content.replace(deactivateCode, deactivateCodeNew);
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[patch-packages] Patched RNTrackPlayer.swift: configureAudioSession activateSession guard + setCategory guard + diagnostic logging (v7)');
  } else {
    console.log('[patch-packages] WARNING: Could not find original configureAudioSession in RNTrackPlayer.swift (may already be patched or version mismatch)');
  }
}

patchRNTrackPlayerConfigureAudioSession();
