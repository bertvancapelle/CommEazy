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
// SwiftAudioEx: AirPlay route change guard (v3 — 7s timer + smart .playing detection)
// ============================================================
// When switching to/from AirPlay (or connecting Bluetooth), iOS momentarily
// pauses AVPlayer during route negotiation. SwiftAudioEx's pause handler
// interprets this as an external disconnect and sets playWhenReady=false →
// rate=0, which kills the AirPlay connection.
//
// Fix v3 improvements over v2:
// - Timer increased from 1.5s to 7s (AirPlay 2 enhanced buffering negotiation
//   takes 5-6 seconds; 1.5s was too short, causing applyAVPlayerRate() to fire
//   during active negotiation which disrupted the AirPlay 2 handshake)
// - Smart .playing detection: when .playing TimeControlStatus fires (route has
//   actually settled), clear the guard immediately instead of waiting for timeout
// - Only re-apply rate if not already playing (prevents double-apply)
function patchSwiftAudioExAirPlayGuard() {
  const filePath = path.join(
    __dirname, '..', 'ios', 'Pods', 'SwiftAudioEx', 'Sources',
    'SwiftAudioEx', 'AVPlayerWrapper', 'AVPlayerWrapper.swift'
  );

  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Already patched?
  if (content.includes('isRouteChanging')) return;

  // 1. Add route change guard properties after stateQueue declaration
  const stateQueueDecl = `fileprivate let stateQueue = DispatchQueue(
        label: "AVPlayerWrapper.stateQueue",
        attributes: .concurrent
    )`;

  if (!content.includes(stateQueueDecl)) {
    console.log('[patch-packages] WARNING: Could not find stateQueue declaration in AVPlayerWrapper.swift');
    return;
  }

  content = content.replace(
    stateQueueDecl,
    `${stateQueueDecl}

    // MARK: - AirPlay Route Change Guard (v3)
    // When switching to/from AirPlay (or connecting Bluetooth), iOS momentarily
    // pauses AVPlayer during route negotiation. Without this guard, the .paused
    // status handler sets playWhenReady=false → rate=0 → kills the connection.
    //
    // Strategy: Suppress pause detection for NEW device connections. Clear the
    // guard when .playing fires (route settled) or after 7s safety timeout
    // (covers AirPlay 2 enhanced buffering negotiation which takes 5-6s).
    private var isRouteChanging: Bool = false
    private var routeChangeTimer: Timer?`
  );

  // 2. Add route change observer in init() and deinit + handler
  const setupAVPlayerCall = `        setupAVPlayer();
    }`;

  content = content.replace(
    setupAVPlayerCall,
    `        setupAVPlayer();

        // Observe audio route changes for AirPlay/Bluetooth handling
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self, name: AVAudioSession.routeChangeNotification, object: nil)
        routeChangeTimer?.invalidate()
    }

    @objc private func handleRouteChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue)
        else { return }

        switch reason {
        case .newDeviceAvailable:
            // New device connected (AirPlay selected, BT headphone connected).
            // iOS will momentarily pause AVPlayer during route negotiation.
            // AirPlay 2 enhanced buffering negotiation takes 5-6 seconds.
            // Suppress pause detection until the route has fully settled.
            //
            // Strategy: set isRouteChanging=true immediately, then clear it
            // when we observe .playing TimeControlStatus (route settled) or
            // after a 7s safety timeout (longer than AirPlay 2 handshake).
            // Do NOT re-apply avPlayer.rate during negotiation — let iOS
            // complete the AirPlay 2 handshake first.
            isRouteChanging = true
            routeChangeTimer?.invalidate()
            routeChangeTimer = Timer.scheduledTimer(withTimeInterval: 7.0, repeats: false) { [weak self] _ in
                guard let self = self else { return }
                if self.isRouteChanging {
                    self.isRouteChanging = false
                    // Only re-apply rate if still wanting to play and not already playing.
                    // The .playing case in didChangeTimeControlStatus may have already
                    // cleared isRouteChanging and resumed playback.
                    if self.playWhenReady && self.avPlayer.timeControlStatus != .playing {
                        self.applyAVPlayerRate()
                    }
                }
            }

        case .oldDeviceUnavailable:
            // Device disconnected (BT headphone turned off, AirPlay deselected).
            // Do NOT suppress pause detection — let the normal handler set
            // playWhenReady=false so the app correctly reflects the paused state.
            // User can manually press play to resume on iPhone speaker.
            break

        default:
            // .routeConfigurationChange, .categoryChange, .override, etc.
            // These don't typically cause false pause detection, ignore them.
            break
        }
    }`
  );

  // 3. Add isRouteChanging check in the pause handler
  const pauseHandler = `                if (self.playWhenReady) {
                    // Only if we are not on the boundaries of the track, otherwise itemDidPlayToEndTime will handle it instead.
                    if (self.currentTime > 0 && self.currentTime < self.duration) {
                        self.playWhenReady = false;
                    }`;

  if (!content.includes(pauseHandler)) {
    console.log('[patch-packages] WARNING: Could not find pause handler in AVPlayerWrapper.swift');
    return;
  }

  content = content.replace(
    pauseHandler,
    `                if (self.playWhenReady) {
                    // Skip pause detection during new-device route changes (AirPlay
                    // select, BT connect). isRouteChanging is only set for
                    // .newDeviceAvailable, NOT for .oldDeviceUnavailable (disconnect).
                    // Rate is re-applied after route settles (7s timeout or .playing).
                    if (self.isRouteChanging) {
                        break
                    }
                    // Only if we are not on the boundaries of the track, otherwise itemDidPlayToEndTime will handle it instead.
                    if (self.currentTime > 0 && self.currentTime < self.duration) {
                        self.playWhenReady = false;
                    }`
  );

  // 4. Add smart .playing detection — clear route change guard when playback starts
  const playingCase = `        case .playing:
            self.state = .playing`;

  if (!content.includes(playingCase)) {
    console.log('[patch-packages] WARNING: Could not find .playing case in AVPlayerWrapper.swift');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[patch-packages] Patched SwiftAudioEx AVPlayerWrapper.swift: AirPlay route change guard (v3 — partial, missing .playing detection)');
    return;
  }

  content = content.replace(
    playingCase,
    `        case .playing:
            // If we were waiting for an AirPlay/BT route transition to settle,
            // the route has now settled — clear the guard and cancel the timeout.
            if self.isRouteChanging {
                self.isRouteChanging = false
                self.routeChangeTimer?.invalidate()
            }
            self.state = .playing`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[patch-packages] Patched SwiftAudioEx AVPlayerWrapper.swift: AirPlay route change guard (v3 — 7s timer + .playing detection)');
}

patchSwiftAudioExAirPlayGuard();

// ============================================================
// SwiftAudioEx: Enable AirPlay 2 external playback
// ============================================================
// AVPlayerWrapper.swift sets `avPlayer.allowsExternalPlayback = false`
// with the comment "disabled since we're not making use of video playback".
// This is a misunderstanding — allowsExternalPlayback controls ALL external
// playback routing including audio-only AirPlay 2. With this set to false,
// AVPlayer cannot route audio to AirPlay speakers at all.
function patchSwiftAudioExAllowsExternalPlayback() {
  const filePath = path.join(
    __dirname, '..', 'ios', 'Pods', 'SwiftAudioEx', 'Sources',
    'SwiftAudioEx', 'AVPlayerWrapper', 'AVPlayerWrapper.swift'
  );

  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  const oldLine = 'avPlayer.allowsExternalPlayback = false;';
  const newLine = '// Enable external playback for AirPlay 2 audio routing\n        avPlayer.allowsExternalPlayback = true;';

  if (content.includes(oldLine)) {
    content = content.replace(oldLine, newLine);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[patch-packages] Patched SwiftAudioEx AVPlayerWrapper.swift: allowsExternalPlayback = true');
  }
}

patchSwiftAudioExAllowsExternalPlayback();

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
// The original unconditionally calls setCategory() which during active AirPlay 2
// playback triggers a route renegotiation — causing a 5-6s timeout and fallback
// to the local speaker. This patch adds a needsUpdate check so setCategory() is
// only called when the session configuration actually needs to change.
function patchRNTrackPlayerConfigureAudioSession() {
  const filePath = path.join(
    __dirname, '..', 'node_modules',
    'react-native-track-player', 'ios',
    'RNTrackPlayer', 'RNTrackPlayer.swift'
  );

  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Already patched?
  if (content.includes('needsUpdate')) return;

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
            try? audioSessionController.activateSession()
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
                    try? session.setCategory(sessionCategory, mode: sessionCategoryMode, policy: sessionCategoryPolicy, options: sessionCategoryOptions)
                }
            } else {
                try? AVAudioSession.sharedInstance().setCategory(sessionCategory, mode: sessionCategoryMode, options: sessionCategoryOptions)
            }
        }`;

  if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[patch-packages] Patched RNTrackPlayer.swift: configureAudioSession setCategory guard');
  } else {
    console.log('[patch-packages] WARNING: Could not find original configureAudioSession in RNTrackPlayer.swift (may already be patched or version mismatch)');
  }
}

patchRNTrackPlayerConfigureAudioSession();
