/**
 * MailBackgroundFetchModule — Background mail checking for iOS
 *
 * Standalone native module that checks for new mail via IMAP during
 * iOS Background App Refresh. Designed to work WITHOUT the React Native
 * bridge active (background fetch may wake the app without JS engine).
 *
 * Flow:
 * 1. iOS wakes app via performFetchWithCompletionHandler
 * 2. This module reads mail accounts from AsyncStorage (@commeazy/mail_accounts)
 * 3. For each account, reads credentials from Keychain (com.commeazy.mail.{id})
 * 4. Connects to IMAP, checks INBOX message count vs last known count
 * 5. If new messages found → fires local notification
 * 6. Updates last known count in UserDefaults
 *
 * SECURITY:
 * - Credentials read from Keychain (WHEN_UNLOCKED_THIS_DEVICE_ONLY)
 * - PII (email, passwords, tokens) NEVER logged
 * - Zero-server-storage compliant (all data stays on device)
 *
 * @see ios/MailModule.swift — Main IMAP module (requires RN bridge)
 * @see src/services/mail/credentialManager.ts — JS credential storage
 */

import Foundation
import SwiftMail
import UserNotifications
import React

// ============================================================
// MARK: - MailBackgroundFetchModule
// ============================================================

@objc(MailBackgroundFetchModule)
class MailBackgroundFetchModule: NSObject {

    /// Singleton for AppDelegate access
    @objc static let shared = MailBackgroundFetchModule()

    // MARK: - Constants

    /// Keychain service prefix (must match credentialManager.ts)
    private let keychainServicePrefix = "com.commeazy.mail"

    /// AsyncStorage key for mail accounts (must match credentialManager.ts)
    private let accountsStorageKey = "@commeazy/mail_accounts"

    /// UserDefaults key prefix for last known message count per account
    private let lastCountPrefix = "com.commeazy.mail.lastCount."

    /// UserDefaults key for last background fetch timestamp
    private let lastFetchKey = "com.commeazy.mail.lastFetchTimestamp"

    /// UserDefaults keys for i18n notification strings (set via bridge from RN)
    private let i18nTitleKey = "com.commeazy.mail.notification.title"
    private let i18nBodySingularKey = "com.commeazy.mail.notification.bodySingular"
    private let i18nBodyPluralKey = "com.commeazy.mail.notification.bodyPlural"

    /// Notification category identifier
    private let notificationCategory = "MAIL_NEW_MESSAGE"

    // MARK: - Background Fetch Entry Point

    /// Called by AppDelegate when iOS triggers a background fetch.
    /// Checks all configured mail accounts for new messages.
    ///
    /// - Parameter completion: Must be called with the fetch result
    @objc func performBackgroundFetch(completion: @escaping (UIBackgroundFetchResult) -> Void) {
        NSLog("[MailBGFetch] Background fetch started")

        Task {
            let accounts = loadAccountsFromStorage()

            guard !accounts.isEmpty else {
                NSLog("[MailBGFetch] No mail accounts configured")
                completion(.noData)
                return
            }

            var totalNewMessages = 0

            for account in accounts {
                let newCount = await checkAccountForNewMail(account)
                totalNewMessages += newCount
            }

            // Update last fetch timestamp
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: lastFetchKey)

            if totalNewMessages > 0 {
                NSLog("[MailBGFetch] Found \(totalNewMessages) new message(s)")
                await scheduleLocalNotification(count: totalNewMessages)
                // Post notification for RN to update badge
                NotificationCenter.default.post(
                    name: NSNotification.Name("MailUnreadCountChanged"),
                    object: nil,
                    userInfo: ["count": totalNewMessages]
                )
                completion(.newData)
            } else {
                NSLog("[MailBGFetch] No new messages")
                completion(.noData)
            }
        }
    }

    // MARK: - Account Loading (from RN AsyncStorage)

    /// Load mail accounts from React Native AsyncStorage.
    /// AsyncStorage on iOS uses RNCAsyncStorage which stores in a SQLite DB.
    private func loadAccountsFromStorage() -> [[String: Any]] {
        // RN AsyncStorage on iOS stores data in:
        // Documents/RCTAsyncLocalStorage_V1/{manifest.json}
        // or in a SQLite database depending on the version.
        //
        // We use RCTAsyncLocalStorage directly if available,
        // or fall back to reading the SQLite DB.
        guard let storageDir = getAsyncStoragePath() else {
            NSLog("[MailBGFetch] Could not locate AsyncStorage path")
            return []
        }

        let manifestPath = storageDir.appendingPathComponent("RCTAsyncLocalStorage_V1").appendingPathComponent("manifest.json").path

        // Try manifest.json first (simple key-value file)
        if FileManager.default.fileExists(atPath: manifestPath) {
            if let data = FileManager.default.contents(atPath: manifestPath),
               let manifest = try? JSONSerialization.jsonObject(with: data) as? [String: String],
               let accountsJSON = manifest[accountsStorageKey],
               let accountsData = accountsJSON.data(using: .utf8),
               let accounts = try? JSONSerialization.jsonObject(with: accountsData) as? [[String: Any]] {
                return accounts
            }
        }

        // Fallback: read from SQLite database
        return loadAccountsFromSQLite(directory: storageDir)
    }

    /// Get the AsyncStorage directory path
    private func getAsyncStoragePath() -> URL? {
        guard let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            return nil
        }
        return documentsDir
    }

    /// Load accounts from AsyncStorage SQLite database
    private func loadAccountsFromSQLite(directory: URL) -> [[String: Any]] {
        // AsyncStorage V2 uses a different path
        let possiblePaths = [
            directory.appendingPathComponent("RCTAsyncLocalStorage_V1").path,
            directory.appendingPathComponent("NativeStorage").path,
        ]

        for path in possiblePaths {
            // Check for the manifest file in the directory
            let manifestInDir = (path as NSString).appendingPathComponent("manifest.json")
            if FileManager.default.fileExists(atPath: manifestInDir) {
                if let data = FileManager.default.contents(atPath: manifestInDir),
                   let manifest = try? JSONSerialization.jsonObject(with: data) as? [String: String],
                   let accountsJSON = manifest[accountsStorageKey],
                   let accountsData = accountsJSON.data(using: .utf8),
                   let accounts = try? JSONSerialization.jsonObject(with: accountsData) as? [[String: Any]] {
                    return accounts
                }
            }
        }

        NSLog("[MailBGFetch] Could not read accounts from AsyncStorage")
        return []
    }

    // MARK: - Keychain Access

    /// Read credentials from Keychain for a specific account.
    /// Must match the format used by react-native-keychain in credentialManager.ts.
    private func getCredentials(accountId: String) -> [String: Any]? {
        let service = "\(keychainServicePrefix).\(accountId)"

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        return json
    }

    // MARK: - IMAP Check

    /// Check a single account for new mail.
    /// Returns the number of new messages found.
    private func checkAccountForNewMail(_ account: [String: Any]) async -> Int {
        guard let accountId = account["id"] as? String else { return 0 }

        // Get credentials from Keychain
        guard let credentials = getCredentials(accountId: accountId) else {
            NSLog("[MailBGFetch] No credentials found for account")
            return 0
        }

        // Extract IMAP config
        guard let imapConfig = credentials["imapConfig"] as? [String: Any],
              let host = imapConfig["host"] as? String,
              let port = imapConfig["port"] as? Int else {
            NSLog("[MailBGFetch] Invalid IMAP config")
            return 0
        }

        let email = credentials["email"] as? String ?? ""
        let authType = credentials["type"] as? String ?? "password"
        let password = credentials["password"] as? String
        let accessToken = credentials["accessToken"] as? String

        do {
            // Connect to IMAP
            let server = IMAPServer(host: host, port: port)
            try await server.connect()

            // Authenticate
            if authType == "oauth2", let token = accessToken, !token.isEmpty {
                // Note: Token refresh is not possible during background fetch
                // without the RN bridge. If token is expired, we skip this account.
                // The token will be refreshed on next foreground usage.
                try await server.authenticateXOAUTH2(email: email, accessToken: token)
            } else if let pass = password, !pass.isEmpty {
                try await server.login(username: email, password: pass)
            } else {
                NSLog("[MailBGFetch] No valid auth method")
                return 0
            }

            // Select INBOX and get message count
            let selection = try await server.selectMailbox("INBOX")
            let currentCount = selection.messageCount

            // Clean up
            try? await server.logout()
            try? await server.disconnect()

            // Compare with last known count
            let lastCountKey = "\(lastCountPrefix)\(accountId)"
            let lastCount = UserDefaults.standard.integer(forKey: lastCountKey)

            // Store current count
            UserDefaults.standard.set(currentCount, forKey: lastCountKey)

            // First run (lastCount == 0) — don't trigger notification
            if lastCount == 0 {
                NSLog("[MailBGFetch] First run, storing baseline count")
                return 0
            }

            // Calculate new messages
            let newMessages = max(0, currentCount - lastCount)
            return newMessages

        } catch {
            NSLog("[MailBGFetch] IMAP check failed (non-sensitive error code: \(type(of: error)))")
            return 0
        }
    }

    // MARK: - Local Notification

    /// Schedule a local notification for new mail.
    private func scheduleLocalNotification(count: Int) async {
        let content = UNMutableNotificationContent()

        // Determine localized notification text
        // We use the system language since we can't access RN i18n in background
        let language = Locale.preferredLanguages.first ?? "en"
        let langPrefix = String(language.prefix(2))

        if count == 1 {
            content.title = localizedTitle(for: langPrefix, count: 1)
            content.body = localizedBody(for: langPrefix, count: 1)
        } else {
            content.title = localizedTitle(for: langPrefix, count: count)
            content.body = localizedBody(for: langPrefix, count: count)
        }

        content.sound = .default
        content.badge = NSNumber(value: count)
        content.categoryIdentifier = notificationCategory
        content.userInfo = [
            "type": "mail_new",
            "count": count,
        ]

        let request = UNNotificationRequest(
            identifier: "mail_new_\(Int(Date().timeIntervalSince1970))",
            content: content,
            trigger: nil // Deliver immediately
        )

        do {
            try await UNUserNotificationCenter.current().add(request)
            NSLog("[MailBGFetch] Local notification scheduled")
        } catch {
            NSLog("[MailBGFetch] Failed to schedule notification")
        }
    }

    // MARK: - Localization Helpers

    /// Localized notification title.
    /// Reads from UserDefaults first (set via RN bridge configureNotificationStrings),
    /// falls back to hardcoded strings based on system language.
    private func localizedTitle(for lang: String, count: Int) -> String {
        // Try RN-provided i18n string first (single source of truth)
        if let title = UserDefaults.standard.string(forKey: i18nTitleKey), !title.isEmpty {
            return title
        }

        // Fallback: hardcoded strings (used when RN bridge hasn't run yet)
        switch lang {
        case "nl": return "Nieuwe e-mail"
        case "de": return "Neue E-Mail"
        case "fr": return "Nouvel e-mail"
        case "es": return "Nuevo correo"
        case "it": return "Nuova e-mail"
        case "no": return "Ny e-post"
        case "sv": return "Ny e-post"
        case "da": return "Ny e-mail"
        case "pt": return "Novo e-mail"
        case "pl": return "Nowy e-mail"
        default:   return "New email"  // en, en-GB
        }
    }

    /// Localized notification body.
    /// Reads from UserDefaults first (set via RN bridge configureNotificationStrings),
    /// falls back to hardcoded strings based on system language.
    private func localizedBody(for lang: String, count: Int) -> String {
        // Try RN-provided i18n strings first (single source of truth)
        let singularTemplate = UserDefaults.standard.string(forKey: i18nBodySingularKey)
        let pluralTemplate = UserDefaults.standard.string(forKey: i18nBodyPluralKey)

        if count == 1, let template = singularTemplate, !template.isEmpty {
            return template.replacingOccurrences(of: "{{count}}", with: "\(count)")
        } else if count != 1, let template = pluralTemplate, !template.isEmpty {
            return template.replacingOccurrences(of: "{{count}}", with: "\(count)")
        }

        // Fallback: hardcoded strings (used when RN bridge hasn't run yet)
        switch lang {
        case "nl": return count == 1
            ? "Je hebt 1 nieuw bericht"
            : "Je hebt \(count) nieuwe berichten"
        case "de": return count == 1
            ? "Du hast 1 neue Nachricht"
            : "Du hast \(count) neue Nachrichten"
        case "fr": return count == 1
            ? "Vous avez 1 nouveau message"
            : "Vous avez \(count) nouveaux messages"
        case "es": return count == 1
            ? "Tienes 1 mensaje nuevo"
            : "Tienes \(count) mensajes nuevos"
        case "it": return count == 1
            ? "Hai 1 nuovo messaggio"
            : "Hai \(count) nuovi messaggi"
        case "no": return count == 1
            ? "Du har 1 ny melding"
            : "Du har \(count) nye meldinger"
        case "sv": return count == 1
            ? "Du har 1 nytt meddelande"
            : "Du har \(count) nya meddelanden"
        case "da": return count == 1
            ? "Du har 1 ny besked"
            : "Du har \(count) nye beskeder"
        case "pt": return count == 1
            ? "Você tem 1 nova mensagem"
            : "Você tem \(count) novas mensagens"
        case "pl": return count == 1
            ? "Masz 1 nową wiadomość"
            : "Masz \(count) nowe wiadomości"
        default:   return count == 1
            ? "You have 1 new message"
            : "You have \(count) new messages"
        }
    }

    // MARK: - React Native Bridge Methods

    /// Get the current unread count (for badge display in RN).
    /// Called by JS side to check unread state.
    @objc func getUnreadCount(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        // Return the badge count from UserDefaults
        let badgeCount = UserDefaults.standard.integer(forKey: "com.commeazy.mail.unreadBadge")
        resolve(badgeCount)
    }

    /// Update the unread badge count (called from RN when user views mail).
    @objc func clearUnreadBadge(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        UserDefaults.standard.set(0, forKey: "com.commeazy.mail.unreadBadge")

        // Clear app badge
        DispatchQueue.main.async {
            UIApplication.shared.applicationIconBadgeNumber = 0
        }

        resolve(true)
    }

    /// Manually trigger a mail check (for pull-to-refresh or "check now" button).
    /// This is a foreground check that updates the unread count.
    @objc func checkMailNow(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        Task {
            let accounts = loadAccountsFromStorage()
            var totalNewMessages = 0

            for account in accounts {
                let newCount = await checkAccountForNewMail(account)
                totalNewMessages += newCount
            }

            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: lastFetchKey)

            if totalNewMessages > 0 {
                let currentBadge = UserDefaults.standard.integer(forKey: "com.commeazy.mail.unreadBadge")
                UserDefaults.standard.set(currentBadge + totalNewMessages, forKey: "com.commeazy.mail.unreadBadge")

                NotificationCenter.default.post(
                    name: NSNotification.Name("MailUnreadCountChanged"),
                    object: nil,
                    userInfo: ["count": currentBadge + totalNewMessages]
                )
            }

            resolve(totalNewMessages)
        }
    }

    /// Configure localized notification strings from React Native i18n system.
    /// Called at app start to sync RN translations with native background fetch notifications.
    /// Strings are stored in UserDefaults so they survive background wake without RN bridge.
    ///
    /// - Parameters:
    ///   - title: Notification title (e.g. "Nieuwe e-mail")
    ///   - bodySingular: Body for 1 message, with {{count}} placeholder (e.g. "Je hebt {{count}} nieuw bericht")
    ///   - bodyPlural: Body for >1 messages, with {{count}} placeholder (e.g. "Je hebt {{count}} nieuwe berichten")
    @objc func configureNotificationStrings(_ title: String, bodySingular: String, bodyPlural: String,
                                             resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        UserDefaults.standard.set(title, forKey: i18nTitleKey)
        UserDefaults.standard.set(bodySingular, forKey: i18nBodySingularKey)
        UserDefaults.standard.set(bodyPlural, forKey: i18nBodyPluralKey)
        resolve(true)
    }

    /// Initialize baseline message counts for all accounts.
    /// Should be called after onboarding completes to prevent false "new mail" notifications.
    @objc func initializeBaseline(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        Task {
            let accounts = loadAccountsFromStorage()

            for account in accounts {
                // checkAccountForNewMail handles first-run detection
                // (returns 0 and stores baseline on first call)
                let _ = await checkAccountForNewMail(account)
            }

            resolve(true)
        }
    }
}
