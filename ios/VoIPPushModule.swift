// VoIPPushModule.swift
// CommEazy — PushKit VoIP Push Registration
//
// Registers for VoIP pushes via PushKit and exposes the device token
// to React Native. The actual push handling (CallKit integration)
// is done in AppDelegate.mm where RNCallKeep is available.

import Foundation
import PushKit
import React

@objc(VoIPPushModule)
class VoIPPushModule: RCTEventEmitter {

  /// Singleton to access from AppDelegate
  @objc static var shared: VoIPPushModule?

  private var voipToken: String?
  private var hasListeners = false

  override init() {
    super.init()
    VoIPPushModule.shared = self
  }

  // MARK: - React Native Event Emitter

  override static func moduleName() -> String! {
    return "VoIPPushModule"
  }

  @objc override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return ["onVoIPToken", "onVoIPPush"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  // MARK: - Public API (called from React Native)

  /// Start PushKit registration. Token will arrive via delegate callback.
  @objc func registerForVoIPPush() {
    NSLog("[VoIPPush] Registering for VoIP push notifications")
    DispatchQueue.main.async {
      let registry = PKPushRegistry(queue: .main)
      // Store registry on AppDelegate so it doesn't get deallocated
      VoIPPushRegistry.shared.registry = registry
      // AppDelegate implements PKPushRegistryDelegate
      // We set the delegate there so CallKit reporting can happen in ObjC
      if let delegate = UIApplication.shared.delegate as? PKPushRegistryDelegate {
        registry.delegate = delegate
        registry.desiredPushTypes = [.voIP]
      } else {
        NSLog("[VoIPPush] ERROR: AppDelegate does not implement PKPushRegistryDelegate")
      }
    }
  }

  /// Returns the current VoIP device token (or empty string)
  @objc func getVoIPToken(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(voipToken ?? "")
  }

  // MARK: - Called from AppDelegate

  /// Called by AppDelegate when PushKit provides a token
  @objc func didReceiveVoIPToken(_ token: String) {
    self.voipToken = token
    if hasListeners {
      sendEvent(withName: "onVoIPToken", body: ["token": token])
    }
  }

  /// Called by AppDelegate when a VoIP push arrives
  @objc func didReceiveVoIPPush(_ payload: [AnyHashable: Any]) {
    if hasListeners {
      sendEvent(withName: "onVoIPPush", body: payload)
    }
  }
}

/// Helper to prevent PKPushRegistry from being deallocated
@objc class VoIPPushRegistry: NSObject {
  @objc static let shared = VoIPPushRegistry()
  @objc var registry: PKPushRegistry?
}
