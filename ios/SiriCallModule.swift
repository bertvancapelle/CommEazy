/**
 * SiriCallModule — Native module to handle Siri call intents in React Native
 *
 * This module:
 * 1. Receives NSUserActivity from Siri Intents Extension
 * 2. Parses the call parameters (contact name, call type)
 * 3. Emits events to React Native to initiate the call
 *
 * @see IntentHandler.swift for the Intents Extension that creates the activity
 */

import Foundation
import Intents
import React

@objc(SiriCallModule)
class SiriCallModule: RCTEventEmitter {
    
    // MARK: - Singleton
    
    static let shared = SiriCallModule()
    
    private var hasListeners = false
    private var pendingCallIntent: [String: Any]?
    
    // MARK: - RCTEventEmitter
    
    override static func moduleName() -> String! {
        return "SiriCallModule"
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return ["onSiriCallIntent"]
    }
    
    override func startObserving() {
        hasListeners = true
        
        // If we have a pending intent, emit it now
        if let pending = pendingCallIntent {
            sendEvent(withName: "onSiriCallIntent", body: pending)
            pendingCallIntent = nil
        }
    }
    
    override func stopObserving() {
        hasListeners = false
    }
    
    // MARK: - Intent Handling
    
    /// Called from AppDelegate when the app receives an NSUserActivity from Siri
    @objc func handleUserActivity(_ userActivity: NSUserActivity) -> Bool {
        let activityType = userActivity.activityType
        
        // Check if this is a call intent
        guard activityType == "INStartCallIntent" ||
              activityType == "INStartAudioCallIntent" ||
              activityType == "INStartVideoCallIntent" else {
            return false
        }
        
        NSLog("[SiriCallModule] Received call intent: \(activityType)")
        
        // Extract call parameters
        var callData: [String: Any] = [
            "activityType": activityType
        ]
        
        // Get data from userInfo (set by IntentHandler)
        if let userInfo = userActivity.userInfo {
            callData["contactName"] = userInfo["contactName"] as? String ?? "Unknown"
            callData["contactHandle"] = userInfo["contactHandle"] as? String ?? ""
            callData["callType"] = userInfo["callType"] as? String ?? "audio"
            callData["customIdentifier"] = userInfo["customIdentifier"] as? String ?? ""
        }
        
        // Also try to get data from the interaction object
        if let interaction = userActivity.interaction,
           let intent = interaction.intent as? INStartCallIntent {
            
            // Extract contact info from the intent
            if let contacts = intent.contacts, let firstContact = contacts.first {
                callData["contactName"] = firstContact.displayName ?? firstContact.spokenPhrase ?? "Unknown"
                callData["contactHandle"] = firstContact.personHandle?.value ?? ""
                callData["customIdentifier"] = firstContact.customIdentifier ?? ""
            }
            
            // Get call type
            callData["callType"] = intent.callCapability == .videoCall ? "video" : "audio"
        }
        
        NSLog("[SiriCallModule] Call data: \(callData)")
        
        // Emit to React Native or queue if no listeners
        if hasListeners {
            sendEvent(withName: "onSiriCallIntent", body: callData)
        } else {
            // Queue the intent for when React Native is ready
            pendingCallIntent = callData
        }
        
        return true
    }
    
    // MARK: - React Native Methods
    
    /// Request Siri authorization (must be called before using Siri features)
    @objc func requestSiriAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                                        reject: @escaping RCTPromiseRejectBlock) {
        INPreferences.requestSiriAuthorization { status in
            switch status {
            case .authorized:
                resolve(["status": "authorized"])
            case .denied:
                resolve(["status": "denied"])
            case .restricted:
                resolve(["status": "restricted"])
            case .notDetermined:
                resolve(["status": "notDetermined"])
            @unknown default:
                resolve(["status": "unknown"])
            }
        }
    }
    
    /// Check current Siri authorization status
    @objc func getSiriAuthorizationStatus(_ resolve: @escaping RCTPromiseResolveBlock,
                                          reject: @escaping RCTPromiseRejectBlock) {
        let status = INPreferences.siriAuthorizationStatus()
        switch status {
        case .authorized:
            resolve("authorized")
        case .denied:
            resolve("denied")
        case .restricted:
            resolve("restricted")
        case .notDetermined:
            resolve("notDetermined")
        @unknown default:
            resolve("unknown")
        }
    }
    
    /// Donate a call shortcut to Siri for suggestions
    @objc func donateCallShortcut(_ contactName: String,
                                  contactId: String,
                                  callType: String,
                                  resolve: @escaping RCTPromiseResolveBlock,
                                  reject: @escaping RCTPromiseRejectBlock) {
        
        // Create a person handle for the contact
        let personHandle = INPersonHandle(value: contactId, type: .unknown)
        
        // Create the person
        let person = INPerson(
            personHandle: personHandle,
            nameComponents: nil,
            displayName: contactName,
            image: nil,
            contactIdentifier: nil,
            customIdentifier: "commeazy:\(contactId)"
        )
        
        // Create the intent
        let intent = INStartCallIntent(
            callRecordFilter: nil,
            callRecordToCallBack: nil,
            audioRoute: .unknown,
            destinationType: .normal,
            contacts: [person],
            callCapability: callType == "video" ? .videoCall : .audioCall
        )
        
        // Set suggested invocation phrase
        let phrase = callType == "video"
            ? "Videobel \(contactName) met CommEazy"
            : "Bel \(contactName) met CommEazy"
        intent.suggestedInvocationPhrase = phrase
        
        // Create and donate the interaction
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.donate { error in
            if let error = error {
                NSLog("[SiriCallModule] Failed to donate shortcut: \(error.localizedDescription)")
                reject("DONATE_FAILED", "Failed to donate shortcut", error)
            } else {
                NSLog("[SiriCallModule] Successfully donated shortcut for \(contactName)")
                resolve(["success": true])
            }
        }
    }
}
