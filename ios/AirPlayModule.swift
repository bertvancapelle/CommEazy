/**
 * AirPlayModule — Native module for AirPlay route detection
 *
 * Provides AVRouteDetector integration for detecting available AirPlay speakers
 * and AVAudioSession route observation for tracking active output routes.
 *
 * Events emitted to React Native:
 * - "airPlayRoutesDetected": { available: Bool } — when AirPlay routes become available/unavailable
 * - "airPlayRouteChanged": { outputName: String, portType: String, isAirPlay: Bool } — when output route changes
 *
 * @see src/contexts/AirPlayContext.tsx for React Native consumer
 * @see .claude/CLAUDE.md Section 13 (AudioPlayer Architecture)
 */

import AVKit
import AVFoundation
import React

@objc(AirPlayModule)
class AirPlayModule: RCTEventEmitter {

    private var routeDetector: AVRouteDetector?
    private var routeDetectorObservation: NSKeyValueObservation?
    private var hasListeners = false

    // MARK: - RCTEventEmitter Setup

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    override func supportedEvents() -> [String]! {
        return ["airPlayRoutesDetected", "airPlayRouteChanged"]
    }

    override func startObserving() {
        hasListeners = true
    }

    override func stopObserving() {
        hasListeners = false
    }

    // MARK: - Route Detection

    @objc
    func startDetection(_ resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            // Create route detector if needed
            if self.routeDetector == nil {
                self.routeDetector = AVRouteDetector()
            }

            guard let detector = self.routeDetector else {
                reject("E_DETECTOR", "Failed to create AVRouteDetector", nil)
                return
            }

            // Enable route detection
            detector.isRouteDetectionEnabled = true

            // Observe multipleRoutesDetected changes via KVO
            self.routeDetectorObservation = detector.observe(
                \.multipleRoutesDetected,
                options: [.new, .initial]
            ) { [weak self] detector, change in
                guard let self = self, self.hasListeners else { return }
                self.sendEvent(withName: "airPlayRoutesDetected", body: [
                    "available": detector.multipleRoutesDetected
                ])
            }

            // Observe audio route changes
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(self.handleRouteChange(_:)),
                name: AVAudioSession.routeChangeNotification,
                object: AVAudioSession.sharedInstance()
            )

            NSLog("[AirPlayModule] Detection started, multipleRoutesDetected=%d",
                  detector.multipleRoutesDetected)

            resolve([
                "available": detector.multipleRoutesDetected
            ])
        }
    }

    @objc
    func stopDetection(_ resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.routeDetectorObservation?.invalidate()
            self.routeDetectorObservation = nil
            self.routeDetector?.isRouteDetectionEnabled = false

            NotificationCenter.default.removeObserver(
                self,
                name: AVAudioSession.routeChangeNotification,
                object: AVAudioSession.sharedInstance()
            )

            NSLog("[AirPlayModule] Detection stopped")
            resolve(nil)
        }
    }

    // MARK: - Current Route Info

    @objc
    func getCurrentRoute(_ resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        let session = AVAudioSession.sharedInstance()
        let currentRoute = session.currentRoute

        var outputs: [[String: Any]] = []
        for output in currentRoute.outputs {
            outputs.append([
                "portName": output.portName,
                "portType": output.portType.rawValue,
                "uid": output.uid,
                "isAirPlay": output.portType == .airPlay
            ])
        }

        let isAirPlayActive = currentRoute.outputs.contains { $0.portType == .airPlay }

        let result: [String: Any] = [
            "outputs": outputs,
            "isAirPlayActive": isAirPlayActive,
            "routesAvailable": routeDetector?.multipleRoutesDetected ?? false
        ]

        resolve(result)
    }

    // MARK: - Route Change Handler

    @objc
    private func handleRouteChange(_ notification: Notification) {
        guard hasListeners else { return }

        let session = AVAudioSession.sharedInstance()
        let currentRoute = session.currentRoute

        // Get primary output info
        if let output = currentRoute.outputs.first {
            sendEvent(withName: "airPlayRouteChanged", body: [
                "outputName": output.portName,
                "portType": output.portType.rawValue,
                "isAirPlay": output.portType == .airPlay
            ])
        } else {
            sendEvent(withName: "airPlayRouteChanged", body: [
                "outputName": "Speaker",
                "portType": AVAudioSession.Port.builtInSpeaker.rawValue,
                "isAirPlay": false
            ])
        }

        // Log route change reason for debugging
        if let reasonValue = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
           let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) {
            NSLog("[AirPlayModule] Route changed, reason: %d", reason.rawValue)
        }
    }

    // MARK: - Cleanup

    deinit {
        routeDetectorObservation?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }
}
