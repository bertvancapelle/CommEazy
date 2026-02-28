/**
 * IntentHandler — SiriKit Intents Extension for CommEazy
 *
 * Handles INStartCallIntent from Siri to initiate calls.
 * The extension validates the contact and hands off to the main app.
 *
 * Usage:
 * - "Hey Siri, bel Oma met CommEazy"
 * - "Hey Siri, start een videogesprek met Jan via CommEazy"
 *
 * @see Apple SiriKit VoIP Calling documentation
 */

import Intents

class IntentHandler: INExtension {
    
    override func handler(for intent: INIntent) -> Any {
        // Route intents to the appropriate handler
        if intent is INStartCallIntent {
            return StartCallIntentHandler()
        }
        
        // Fallback for legacy intents (iOS < 13)
        if intent is INStartAudioCallIntent || intent is INStartVideoCallIntent {
            return StartCallIntentHandler()
        }
        
        return self
    }
}

// MARK: - StartCallIntentHandler

/**
 * Handles INStartCallIntent for initiating audio and video calls via Siri.
 *
 * Flow:
 * 1. Siri captures "bel Oma met CommEazy"
 * 2. System creates INStartCallIntent with contact info
 * 3. This handler validates the contact exists in CommEazy
 * 4. Returns success response → Siri launches main app with NSUserActivity
 * 5. Main app receives activity and initiates the actual call
 */
class StartCallIntentHandler: NSObject, INStartCallIntentHandling {
    
    // MARK: - Resolve Parameters
    
    /// Resolve the contacts to call
    func resolveContacts(for intent: INStartCallIntent, with completion: @escaping ([INStartCallContactResolutionResult]) -> Void) {
        guard let contacts = intent.contacts, !contacts.isEmpty else {
            // No contacts specified — ask Siri to prompt the user
            completion([.needsValue()])
            return
        }
        
        var results: [INStartCallContactResolutionResult] = []
        
        for contact in contacts {
            // Try to match the contact with CommEazy contacts
            if let matchedPerson = resolveContactInCommEazy(contact) {
                results.append(.success(with: matchedPerson))
            } else if let spokenPhrase = contact.spokenPhrase {
                // Contact not found — create a person from the spoken phrase
                // The main app will handle the actual lookup
                let person = INPerson(
                    personHandle: INPersonHandle(value: spokenPhrase, type: .unknown),
                    nameComponents: nil,
                    displayName: spokenPhrase,
                    image: nil,
                    contactIdentifier: nil,
                    customIdentifier: "commeazy:\(spokenPhrase)"
                )
                results.append(.success(with: person))
            } else {
                // Cannot resolve — need more info
                results.append(.needsValue())
            }
        }
        
        completion(results)
    }
    
    /// Resolve the call type (audio or video)
    func resolveCallCapability(for intent: INStartCallIntent, with completion: @escaping (INStartCallCallCapabilityResolutionResult) -> Void) {
        // Default to audio if not specified
        let capability = intent.callCapability
        completion(.success(with: capability))
    }
    
    // MARK: - Confirm Intent
    
    /// Confirm that the call can be placed
    func confirm(intent: INStartCallIntent, completion: @escaping (INStartCallIntentResponse) -> Void) {
        // Check if we have at least one contact
        guard let contacts = intent.contacts, !contacts.isEmpty else {
            completion(INStartCallIntentResponse(code: .failureContactNotSupportedByApp, userActivity: nil))
            return
        }
        
        // Create user activity for handoff to main app
        let userActivity = NSUserActivity(activityType: "INStartCallIntent")
        userActivity.userInfo = [
            "contactName": contacts.first?.displayName ?? "Unknown",
            "callType": intent.callCapability == .videoCall ? "video" : "audio"
        ]
        
        // Confirm that we're ready
        completion(INStartCallIntentResponse(code: .ready, userActivity: userActivity))
    }
    
    // MARK: - Handle Intent
    
    /// Handle the call intent — hand off to main app
    func handle(intent: INStartCallIntent, completion: @escaping (INStartCallIntentResponse) -> Void) {
        // Create the user activity that will be passed to the main app
        let userActivity = NSUserActivity(activityType: "INStartCallIntent")
        
        // Add intent data to user activity
        if let contacts = intent.contacts, let firstContact = contacts.first {
            userActivity.userInfo = [
                "contactName": firstContact.displayName ?? firstContact.spokenPhrase ?? "Unknown",
                "contactHandle": firstContact.personHandle?.value ?? "",
                "callType": intent.callCapability == .videoCall ? "video" : "audio",
                "customIdentifier": firstContact.customIdentifier ?? ""
            ]
        }
        
        // Tell Siri to launch the main app
        // The main app will receive this activity and start the call
        let response = INStartCallIntentResponse(code: .continueInApp, userActivity: userActivity)
        completion(response)
    }
    
    // MARK: - Private Helpers
    
    /// Try to resolve a contact in CommEazy's contact list
    /// Returns nil if contact not found (main app will handle the lookup)
    private func resolveContactInCommEazy(_ contact: INPerson) -> INPerson? {
        // In a full implementation, this would query the shared App Group
        // database to find matching CommEazy contacts.
        //
        // For now, we pass through the contact and let the main app
        // handle the actual contact resolution.
        //
        // TODO: Implement App Group shared database query
        // - Query WatermelonDB via shared SQLite file
        // - Match by name, phone number, or JID
        // - Return INPerson with customIdentifier set to JID
        
        return nil
    }
}

// MARK: - Legacy Intent Support (iOS < 13)

extension StartCallIntentHandler: INStartAudioCallIntentHandling, INStartVideoCallIntentHandling {
    
    // MARK: Audio Call (Legacy)
    
    func resolveContacts(for intent: INStartAudioCallIntent, with completion: @escaping ([INPersonResolutionResult]) -> Void) {
        guard let contacts = intent.contacts, !contacts.isEmpty else {
            completion([.needsValue()])
            return
        }
        
        let results = contacts.map { INPersonResolutionResult.success(with: $0) }
        completion(results)
    }
    
    func confirm(intent: INStartAudioCallIntent, completion: @escaping (INStartAudioCallIntentResponse) -> Void) {
        completion(INStartAudioCallIntentResponse(code: .ready, userActivity: nil))
    }
    
    func handle(intent: INStartAudioCallIntent, completion: @escaping (INStartAudioCallIntentResponse) -> Void) {
        let userActivity = NSUserActivity(activityType: "INStartAudioCallIntent")
        if let contact = intent.contacts?.first {
            userActivity.userInfo = [
                "contactName": contact.displayName ?? "Unknown",
                "callType": "audio"
            ]
        }
        completion(INStartAudioCallIntentResponse(code: .continueInApp, userActivity: userActivity))
    }
    
    // MARK: Video Call (Legacy)
    
    func resolveContacts(for intent: INStartVideoCallIntent, with completion: @escaping ([INPersonResolutionResult]) -> Void) {
        guard let contacts = intent.contacts, !contacts.isEmpty else {
            completion([.needsValue()])
            return
        }
        
        let results = contacts.map { INPersonResolutionResult.success(with: $0) }
        completion(results)
    }
    
    func confirm(intent: INStartVideoCallIntent, completion: @escaping (INStartVideoCallIntentResponse) -> Void) {
        completion(INStartVideoCallIntentResponse(code: .ready, userActivity: nil))
    }
    
    func handle(intent: INStartVideoCallIntent, completion: @escaping (INStartVideoCallIntentResponse) -> Void) {
        let userActivity = NSUserActivity(activityType: "INStartVideoCallIntent")
        if let contact = intent.contacts?.first {
            userActivity.userInfo = [
                "contactName": contact.displayName ?? "Unknown",
                "callType": "video"
            ]
        }
        completion(INStartVideoCallIntentResponse(code: .continueInApp, userActivity: userActivity))
    }
}
