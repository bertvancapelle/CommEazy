/**
 * MailModule — Native iOS IMAP/SMTP Integration for React Native
 *
 * Provides email functionality for CommEazy using SwiftMail (Cocoanetics).
 * Supports IMAP for reading mail and SMTP for sending mail.
 *
 * ARCHITECTURE:
 * - SwiftMail IMAPServer actor for IMAP operations
 * - SwiftMail SMTPServer actor for SMTP operations
 * - XOAUTH2 support for Gmail and Microsoft 365
 * - RCTEventEmitter for attachment download progress events
 *
 * SECURITY:
 * - Credentials NEVER logged (PII protection)
 * - TLS enforced by default
 * - Error codes only (no stacktraces to JS)
 *
 * @see .claude/plans/MAIL_MODULE_PROMPT.md - Fase 3
 * @see .claude/plans/MAIL_DEV_LOG.md - Development log
 */

import Foundation
import React
import SwiftMail

// ============================================================
// MARK: - MailModule (RCT Bridge Module)
// ============================================================

@objc(MailModule)
class MailModule: RCTEventEmitter {

    // MARK: - Properties

    /// Active IMAP server connection
    private var imapServer: IMAPServer?

    /// Track if we have JS listeners registered
    private var hasListeners = false

    // MARK: - Error Codes (consistent with Android)

    private enum MailError: String {
        case authFailed = "AUTH_FAILED"
        case connectionFailed = "CONNECTION_FAILED"
        case timeout = "TIMEOUT"
        case invalidCredentials = "INVALID_CREDENTIALS"
        case certificateError = "CERTIFICATE_ERROR"
        case mailboxNotFound = "MAILBOX_NOT_FOUND"
        case messageNotFound = "MESSAGE_NOT_FOUND"
        case sendFailed = "SEND_FAILED"
        case notConnected = "NOT_CONNECTED"
        case unknownError = "UNKNOWN_ERROR"
    }

    // MARK: - RCTEventEmitter Overrides

    override static func moduleName() -> String! {
        return "MailModule"
    }

    override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override func supportedEvents() -> [String]! {
        return ["MailAttachmentProgress"]
    }

    override func startObserving() {
        hasListeners = true
    }

    override func stopObserving() {
        hasListeners = false
    }

    // MARK: - Helper: Reject with Error Code

    private func reject(
        _ reject: @escaping RCTPromiseRejectBlock,
        code: MailError,
        message: String
    ) {
        reject(code.rawValue, message, nil)
    }

    // MARK: - Helper: Map Error to Code

    private func mapError(_ error: Error) -> (MailError, String) {
        let message = error.localizedDescription
        let lowered = message.lowercased()

        // Always log the actual error for debugging
        NSLog("[MailModule] mapError: %@", message)

        if lowered.contains("auth") || lowered.contains("login") {
            return (.authFailed, "Authentication failed")
        } else if lowered.contains("certificate") || lowered.contains("ssl") || lowered.contains("tls") {
            return (.certificateError, "Certificate validation failed")
        } else if lowered.contains("timeout") {
            return (.timeout, "Connection timed out")
        } else if lowered.contains("connect") || lowered.contains("refused") {
            return (.connectionFailed, "Could not connect to server")
        } else {
            return (.unknownError, "An unexpected error occurred: \(message)")
        }
    }

    // MARK: - IMAP: Connect

    /// Connect to an IMAP server and authenticate
    /// - Parameters:
    ///   - host: IMAP server hostname
    ///   - port: IMAP server port (993 for SSL, 143 for STARTTLS)
    ///   - username: Email address or username
    ///   - password: Password (for password auth)
    ///   - accessToken: OAuth2 access token (for XOAUTH2 auth)
    ///   - resolve: Promise resolve
    ///   - reject: Promise reject
    @objc(connectIMAP:port:username:password:accessToken:resolve:reject:)
    func connectIMAP(
        _ host: String,
        port: Int,
        username: String,
        password: String?,
        accessToken: String?,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            do {
                NSLog("[MailModule] Connecting to IMAP server")

                let server = IMAPServer(host: host, port: port)
                try await server.connect()

                // Authenticate
                if let token = accessToken, !token.isEmpty {
                    try await server.authenticateXOAUTH2(
                        email: username,
                        accessToken: token
                    )
                } else if let pass = password, !pass.isEmpty {
                    try await server.login(
                        username: username,
                        password: pass
                    )
                } else {
                    self.reject(reject, code: .invalidCredentials, message: "No password or access token provided")
                    return
                }

                self.imapServer = server
                NSLog("[MailModule] IMAP connection established")
                resolve(true)
            } catch {
                NSLog("[MailModule] ERROR: IMAP connection failed with code: \(error.localizedDescription)")
                let (code, message) = self.mapError(error)
                self.reject(reject, code: code, message: message)
            }
        }
    }

    // MARK: - IMAP: List Mailboxes

    /// List available mailboxes (folders) on the IMAP server
    @objc(listMailboxes:reject:)
    func listMailboxes(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let imap = imapServer else {
            self.reject(reject, code: .notConnected, message: "Not connected to IMAP server")
            return
        }

        Task {
            do {
                let mailboxes = try await imap.listMailboxes()
                let result: [[String: Any]] = mailboxes.map { mailbox in
                    return [
                        "name": mailbox.name,
                        "delimiter": mailbox.hierarchyDelimiter ?? "/",
                    ]
                }
                resolve(result)
            } catch {
                NSLog("[MailModule] ERROR: listMailboxes failed")
                let (code, message) = self.mapError(error)
                self.reject(reject, code: code, message: message)
            }
        }
    }

    // MARK: - IMAP: Fetch Headers

    /// Fetch message headers from a mailbox
    /// - Parameters:
    ///   - folderName: Mailbox name (e.g. "INBOX")
    ///   - limit: Maximum number of messages to fetch
    @objc(fetchHeaders:limit:resolve:reject:)
    func fetchHeaders(
        _ folderName: String,
        limit: Int,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let imap = imapServer else {
            self.reject(reject, code: .notConnected, message: "Not connected to IMAP server")
            return
        }

        Task {
            do {
                let selection = try await imap.selectMailbox(folderName)
                let messageCount = selection.messageCount

                NSLog("[MailModule] selectMailbox '\(folderName)': messageCount=\(messageCount)")

                guard messageCount > 0 else {
                    resolve([])
                    return
                }

                // Fetch the most recent messages
                let start = max(1, messageCount - limit + 1)
                let identifierSet = MessageIdentifierSet<SequenceNumber>(SequenceNumber(start)...SequenceNumber(messageCount))

                NSLog("[MailModule] Fetching sequence numbers \(start)...\(messageCount)")

                let messages = try await imap.fetchMessageInfosBulk(using: identifierSet)

                NSLog("[MailModule] Got \(messages.count) messages, newest date: \(messages.last?.date?.ISO8601Format() ?? "nil")")

                let result: [[String: Any]] = messages.map { msg in
                    var dict: [String: Any] = [
                        "uid": msg.uid.map { Int($0.value) } ?? 0,
                        "sequenceNumber": Int(msg.sequenceNumber.value),
                        "subject": msg.subject ?? "",
                        "date": msg.date?.ISO8601Format() ?? "",
                        "isRead": msg.flags.contains(.seen),
                        "isFlagged": msg.flags.contains(.flagged),
                    ]

                    // From address (SwiftMail returns as plain string)
                    dict["from"] = msg.from ?? ""

                    // To addresses (SwiftMail returns as [String])
                    dict["to"] = msg.to

                    // Check for attachments via parts
                    dict["hasAttachment"] = msg.parts.contains { part in
                        part.disposition?.lowercased() == "attachment" ||
                        (part.filename != nil && !part.contentType.lowercased().hasPrefix("text/"))
                    }

                    return dict
                }

                resolve(result)
            } catch {
                NSLog("[MailModule] ERROR: fetchHeaders failed")
                let (code, message) = self.mapError(error)
                self.reject(reject, code: code, message: message)
            }
        }
    }

    // MARK: - IMAP: Fetch Message Body

    /// Fetch the full body of a message by UID
    /// - Parameters:
    ///   - uid: Message UID
    ///   - folderName: Mailbox name
    @objc(fetchMessageBody:folderName:resolve:reject:)
    func fetchMessageBody(
        _ uid: Int,
        folderName: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let imap = imapServer else {
            self.reject(reject, code: .notConnected, message: "Not connected to IMAP server")
            return
        }

        Task {
            do {
                // Select the mailbox
                let _ = try await imap.selectMailbox(folderName)

                let uidValue = UID(uid)

                // Fetch MIME structure
                let parts = try await imap.fetchStructure(uidValue)

                var htmlBody: String?
                var plainTextBody: String?
                var attachments: [[String: Any]] = []

                for (index, part) in parts.enumerated() {
                    let mimeType = part.contentType.lowercased()

                    if mimeType.hasPrefix("text/html") && htmlBody == nil {
                        let rawData = try await imap.fetchPart(section: part.section, of: uidValue)
                        let decodedData = rawData.decoded(for: part)
                        let charset = Self.extractCharset(from: mimeType)
                        htmlBody = String(data: decodedData, encoding: charset) ?? String(data: decodedData, encoding: .utf8)
                    } else if mimeType.hasPrefix("text/plain") && plainTextBody == nil {
                        let rawData = try await imap.fetchPart(section: part.section, of: uidValue)
                        let decodedData = rawData.decoded(for: part)
                        let charset = Self.extractCharset(from: mimeType)
                        plainTextBody = String(data: decodedData, encoding: charset) ?? String(data: decodedData, encoding: .utf8)
                    } else if part.disposition?.lowercased() == "attachment" ||
                              (part.filename != nil && !mimeType.hasPrefix("text/html") && !mimeType.hasPrefix("text/plain")) ||
                              (part.contentId != nil && mimeType.hasPrefix("image/")) {
                        var attachmentDict: [String: Any] = [
                            "index": index,
                            "name": part.filename ?? "attachment_\(index)",
                            "size": part.data?.count ?? 0,
                            "mimeType": mimeType,
                        ]
                        if let cid = part.contentId {
                            // Strip angle brackets if present (e.g., "<image001@01D...>" → "image001@01D...")
                            let cleanCid = cid.trimmingCharacters(in: CharacterSet(charactersIn: "<>"))
                            attachmentDict["contentId"] = cleanCid
                        }
                        attachments.append(attachmentDict)
                    }
                }

                let result: [String: Any] = [
                    "html": htmlBody ?? NSNull(),
                    "plainText": plainTextBody ?? NSNull(),
                    "attachments": attachments,
                ]

                resolve(result)
            } catch {
                NSLog("[MailModule] ERROR: fetchMessageBody failed")
                let (code, message) = self.mapError(error)
                self.reject(reject, code: code, message: message)
            }
        }
    }

    // MARK: - IMAP: Fetch Attachment Data

    /// Download attachment data by UID and part index
    /// - Parameters:
    ///   - uid: Message UID
    ///   - folderName: Mailbox name
    ///   - partIndex: Index of the attachment in the MIME structure
    @objc(fetchAttachmentData:folderName:partIndex:resolve:reject:)
    func fetchAttachmentData(
        _ uid: Int,
        folderName: String,
        partIndex: Int,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let imap = imapServer else {
            self.reject(reject, code: .notConnected, message: "Not connected to IMAP server")
            return
        }

        Task {
            do {
                let _ = try await imap.selectMailbox(folderName)
                let uidValue = UID(uid)

                // Get MIME structure to find the part
                let parts = try await imap.fetchStructure(uidValue)

                guard partIndex < parts.count else {
                    self.reject(reject, code: .messageNotFound, message: "Attachment part not found")
                    return
                }

                let part = parts[partIndex]

                // Emit initial progress
                if self.hasListeners {
                    self.sendEvent(withName: "MailAttachmentProgress", body: [
                        "uid": uid,
                        "partIndex": partIndex,
                        "progress": 0.0,
                        "status": "downloading",
                    ])
                }

                let rawData = try await imap.fetchPart(section: part.section, of: uidValue)

                // Decode content-transfer-encoding (e.g. base64 → binary)
                // Without this, base64-encoded attachments (like JPEGs) would be
                // double-encoded when we call .base64EncodedString() below.
                let data = rawData.decoded(for: part)

                // Emit completion progress
                if self.hasListeners {
                    self.sendEvent(withName: "MailAttachmentProgress", body: [
                        "uid": uid,
                        "partIndex": partIndex,
                        "progress": 1.0,
                        "status": "complete",
                    ])
                }

                let tenMB = 10 * 1024 * 1024

                if data.count <= tenMB {
                    // Return as base64 for small files
                    resolve([
                        "base64": data.base64EncodedString(),
                        "fileName": part.filename ?? "attachment_\(partIndex)",
                        "mimeType": part.contentType,
                        "fileSize": data.count,
                    ])
                } else {
                    // Write to temp file for large attachments
                    let tempDir = FileManager.default.temporaryDirectory
                    let rawFileName = part.filename ?? "attachment_\(uid)_\(partIndex)"
                    // Sanitize filename to prevent path traversal
                    let fileName = (rawFileName as NSString).lastPathComponent
                    let fileURL = tempDir.appendingPathComponent(fileName)

                    try data.write(to: fileURL)

                    resolve([
                        "filePath": fileURL.path,
                        "fileName": part.filename ?? "attachment_\(partIndex)",
                        "mimeType": part.contentType,
                        "fileSize": data.count,
                    ])
                }
            } catch {
                NSLog("[MailModule] ERROR: fetchAttachmentData failed")
                let (code, message) = self.mapError(error)
                self.reject(reject, code: code, message: message)
            }
        }
    }

    // MARK: - IMAP: Search Messages

    /// Search messages in a mailbox
    /// - Parameters:
    ///   - folderName: Mailbox name
    ///   - query: Search query string
    @objc(searchMessages:query:resolve:reject:)
    func searchMessages(
        _ folderName: String,
        query: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let imap = imapServer else {
            self.reject(reject, code: .notConnected, message: "Not connected to IMAP server")
            return
        }

        Task {
            do {
                let _ = try await imap.selectMailbox(folderName)

                // Search using OR on subject, from, to (no body — causes PayloadTooLargeError on large mailboxes)
                // Body search is handled by local SQLite cache with substring matching
                let criteria: [SearchCriteria] = [
                    .or(.subject(query), .or(.from(query), .to(query)))
                ]

                let results: MessageIdentifierSet<UID> = try await imap.search(criteria: criteria)

                // Convert UIDs to array of integers
                let uids: [Int] = results.toArray().map { Int($0.value) }

                resolve(uids)
            } catch {
                NSLog("[MailModule] ERROR: searchMessages failed")
                let (code, message) = self.mapError(error)
                self.reject(reject, code: code, message: message)
            }
        }
    }

    // MARK: - IMAP: Fetch Headers by UIDs

    /// Fetch message headers for specific UIDs (used after search)
    /// - Parameters:
    ///   - folderName: Mailbox name
    ///   - uids: Array of message UIDs to fetch
    @objc(fetchHeadersByUIDs:uids:resolve:reject:)
    func fetchHeadersByUIDs(
        _ folderName: String,
        uids: NSArray,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let imap = imapServer else {
            self.reject(reject, code: .notConnected, message: "Not connected to IMAP server")
            return
        }

        guard let uidInts = uids as? [Int], !uidInts.isEmpty else {
            resolve([])
            return
        }

        Task {
            do {
                let _ = try await imap.selectMailbox(folderName)

                // Build UID set from array
                let uidValues = uidInts.map { UID($0) }
                var identifierSet = MessageIdentifierSet<UID>()
                for uid in uidValues {
                    identifierSet.insert(uid)
                }

                NSLog("[MailModule] fetchHeadersByUIDs: fetching \(uidInts.count) UIDs from '\(folderName)'")

                let messages = try await imap.fetchMessageInfosBulk(using: identifierSet)

                NSLog("[MailModule] fetchHeadersByUIDs: got \(messages.count) messages")

                let result: [[String: Any]] = messages.map { msg in
                    var dict: [String: Any] = [
                        "uid": msg.uid.map { Int($0.value) } ?? 0,
                        "sequenceNumber": Int(msg.sequenceNumber.value),
                        "subject": msg.subject ?? "",
                        "date": msg.date?.ISO8601Format() ?? "",
                        "isRead": msg.flags.contains(.seen),
                        "isFlagged": msg.flags.contains(.flagged),
                    ]

                    dict["from"] = msg.from ?? ""
                    dict["to"] = msg.to
                    dict["hasAttachment"] = msg.parts.contains { part in
                        part.disposition?.lowercased() == "attachment" ||
                        (part.filename != nil && !part.contentType.lowercased().hasPrefix("text/"))
                    }

                    return dict
                }

                resolve(result)
            } catch {
                NSLog("[MailModule] ERROR: fetchHeadersByUIDs failed")
                let (code, message) = self.mapError(error)
                self.reject(reject, code: code, message: message)
            }
        }
    }

    // MARK: - IMAP: Mark as Read/Unread

    /// Set or clear the \Seen flag on a message
    @objc(markAsRead:folderName:read:resolve:reject:)
    func markAsRead(
        _ uid: Int,
        folderName: String,
        read: Bool,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let imap = imapServer else {
            self.reject(reject, code: .notConnected, message: "Not connected to IMAP server")
            return
        }

        Task {
            do {
                let _ = try await imap.selectMailbox(folderName)
                let uidValue = UID(uid)
                let identifierSet = MessageIdentifierSet<UID>(uidValue)

                try await imap.store(
                    flags: [.seen],
                    on: identifierSet,
                    operation: read ? .add : .remove
                )

                resolve(true)
            } catch {
                NSLog("[MailModule] ERROR: markAsRead failed")
                let (code, message) = self.mapError(error)
                self.reject(reject, code: code, message: message)
            }
        }
    }

    // MARK: - IMAP: Mark as Flagged

    /// Toggle flagged status on a message
    @objc(markAsFlagged:folderName:flagged:resolve:reject:)
    func markAsFlagged(
        _ uid: Int,
        folderName: String,
        flagged: Bool,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let imap = imapServer else {
            self.reject(reject, code: .notConnected, message: "Not connected to IMAP server")
            return
        }

        Task {
            do {
                let _ = try await imap.selectMailbox(folderName)
                let uidValue = UID(uid)
                let identifierSet = MessageIdentifierSet<UID>(uidValue)

                try await imap.store(
                    flags: [.flagged],
                    on: identifierSet,
                    operation: flagged ? .add : .remove
                )

                resolve(true)
            } catch {
                NSLog("[MailModule] ERROR: markAsFlagged failed")
                let (code, message) = self.mapError(error)
                self.reject(reject, code: code, message: message)
            }
        }
    }

    // MARK: - IMAP: Delete Message

    /// Delete a message by UID (mark as deleted + expunge)
    @objc(deleteMessage:folderName:resolve:reject:)
    func deleteMessage(
        _ uid: Int,
        folderName: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let imap = imapServer else {
            self.reject(reject, code: .notConnected, message: "Not connected to IMAP server")
            return
        }

        Task {
            do {
                let _ = try await imap.selectMailbox(folderName)
                let uidValue = UID(uid)
                let identifierSet = MessageIdentifierSet<UID>(uidValue)

                try await imap.store(
                    flags: [.deleted],
                    on: identifierSet,
                    operation: .add
                )
                try await imap.expunge()

                NSLog("[MailModule] Message deleted successfully")
                resolve(true)
            } catch {
                NSLog("[MailModule] ERROR: deleteMessage failed")
                let (code, message) = self.mapError(error)
                self.reject(reject, code: code, message: message)
            }
        }
    }

    // MARK: - IMAP: Move Message

    /// Move a message to another mailbox
    @objc(moveMessage:fromFolder:toFolder:resolve:reject:)
    func moveMessage(
        _ uid: Int,
        fromFolder: String,
        toFolder: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let imap = imapServer else {
            self.reject(reject, code: .notConnected, message: "Not connected to IMAP server")
            return
        }

        Task {
            do {
                let _ = try await imap.selectMailbox(fromFolder)
                let uidValue = UID(uid)
                let identifierSet = MessageIdentifierSet<UID>(uidValue)

                try await imap.move(messages: identifierSet, to: toFolder)

                resolve(true)
            } catch {
                NSLog("[MailModule] ERROR: moveMessage failed")
                let (code, message) = self.mapError(error)
                self.reject(reject, code: code, message: message)
            }
        }
    }

    // MARK: - SMTP: Send Message

    /// Send an email via SMTP
    /// - Parameters:
    ///   - smtpHost: SMTP server hostname
    ///   - smtpPort: SMTP server port (587 for STARTTLS, 465 for SSL)
    ///   - username: SMTP username
    ///   - password: SMTP password (for password auth)
    ///   - accessToken: OAuth2 access token (for XOAUTH2 auth)
    ///   - from: Sender email address and name
    ///   - to: Array of recipient objects
    ///   - cc: Array of CC recipient objects
    ///   - bcc: Array of BCC recipient objects
    ///   - subject: Email subject
    ///   - body: Email body (plain text)
    ///   - htmlBody: Email body (HTML, optional)
    ///   - attachments: Array of attachment objects
    @objc(sendMessage:smtpPort:username:password:accessToken:from:to:cc:bcc:subject:body:htmlBody:attachments:resolve:reject:)
    func sendMessage(
        _ smtpHost: String,
        smtpPort: Int,
        username: String,
        password: String?,
        accessToken: String?,
        from: NSDictionary,
        to: NSArray,
        cc: NSArray?,
        bcc: NSArray?,
        subject: String,
        body: String,
        htmlBody: String?,
        attachments: NSArray?,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            do {
                NSLog("[MailModule] Sending message via SMTP")

                // Create SMTP server
                let smtp = SMTPServer(host: smtpHost, port: smtpPort)
                try await smtp.connect()

                // Authenticate
                if let token = accessToken, !token.isEmpty {
                    try await smtp.authenticateXOAUTH2(
                        email: username,
                        accessToken: token
                    )
                } else if let pass = password, !pass.isEmpty {
                    try await smtp.login(
                        username: username,
                        password: pass
                    )
                } else {
                    self.reject(reject, code: .invalidCredentials, message: "No password or access token provided")
                    return
                }

                // Build sender
                let senderAddress = EmailAddress(
                    name: from["name"] as? String,
                    address: from["address"] as? String ?? ""
                )

                // Build recipients
                let toRecipients = self.parseEmailAddresses(to)
                let ccRecipients = self.parseEmailAddresses(cc)
                let bccRecipients = self.parseEmailAddresses(bcc)

                // Build attachments
                var emailAttachments: [Attachment] = []
                if let attachmentArray = attachments as? [[String: Any]] {
                    for att in attachmentArray {
                        if let base64 = att["base64"] as? String,
                           let data = Data(base64Encoded: base64) {
                            let attachment = Attachment(
                                filename: att["fileName"] as? String ?? "attachment",
                                mimeType: att["mimeType"] as? String ?? "application/octet-stream",
                                data: data
                            )
                            emailAttachments.append(attachment)
                        } else if let filePath = att["filePath"] as? String {
                            let fileURL = URL(fileURLWithPath: filePath)
                            if let attachment = try? Attachment(fileURL: fileURL) {
                                emailAttachments.append(attachment)
                            }
                        }
                    }
                }

                // Build email
                let email = Email(
                    sender: senderAddress,
                    recipients: toRecipients,
                    ccRecipients: ccRecipients,
                    bccRecipients: bccRecipients,
                    subject: subject,
                    textBody: body,
                    htmlBody: htmlBody,
                    attachments: emailAttachments.isEmpty ? nil : emailAttachments
                )

                // Send
                try await smtp.sendEmail(email)
                try await smtp.disconnect()

                NSLog("[MailModule] Message sent successfully")
                resolve(true)
            } catch {
                NSLog("[MailModule] ERROR: sendMessage failed")
                let (code, message) = self.mapError(error)
                self.reject(reject, code: code, message: message)
            }
        }
    }

    // MARK: - IMAP: Disconnect

    /// Disconnect from the IMAP server
    @objc(disconnect:reject:)
    func disconnect(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let imap = imapServer else {
            resolve(true)
            return
        }

        Task {
            do {
                try await imap.logout()
                try await imap.disconnect()
                self.imapServer = nil
                NSLog("[MailModule] Disconnected from IMAP server")
                resolve(true)
            } catch {
                // Even on error, clear the reference
                self.imapServer = nil
                NSLog("[MailModule] ERROR: disconnect failed, cleared reference")
                resolve(true)
            }
        }
    }

    // MARK: - IMAP: Test Connection

    /// Test IMAP + SMTP connectivity (used during onboarding)
    /// Connects, authenticates, fetches inbox count, then disconnects
    @objc(testConnection:imapPort:smtpHost:smtpPort:username:password:accessToken:resolve:reject:)
    func testConnection(
        _ imapHost: String,
        imapPort: Int,
        smtpHost: String,
        smtpPort: Int,
        username: String,
        password: String?,
        accessToken: String?,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            do {
                NSLog("[MailModule] Testing connection")

                // Test IMAP
                let imap = IMAPServer(host: imapHost, port: imapPort)
                try await imap.connect()

                if let token = accessToken, !token.isEmpty {
                    try await imap.authenticateXOAUTH2(email: username, accessToken: token)
                } else if let pass = password, !pass.isEmpty {
                    try await imap.login(username: username, password: pass)
                }

                let selection = try await imap.selectMailbox("INBOX")
                let messageCount = selection.messageCount

                try await imap.logout()
                try await imap.disconnect()

                // Test SMTP
                let smtp = SMTPServer(host: smtpHost, port: smtpPort)
                try await smtp.connect()

                if let token = accessToken, !token.isEmpty {
                    try await smtp.authenticateXOAUTH2(email: username, accessToken: token)
                } else if let pass = password, !pass.isEmpty {
                    try await smtp.login(username: username, password: pass)
                }

                try await smtp.disconnect()

                NSLog("[MailModule] Connection test passed")
                resolve([
                    "imapSuccess": true,
                    "smtpSuccess": true,
                    "inboxCount": messageCount,
                ])
            } catch {
                NSLog("[MailModule] ERROR: Connection test failed")
                let (code, message) = self.mapError(error)
                self.reject(reject, code: code, message: message)
            }
        }
    }

    // MARK: - Private Helpers

    /// Extract charset from Content-Type string (e.g. "text/html; charset=utf-8")
    /// Returns the appropriate String.Encoding, defaulting to .utf8
    private static func extractCharset(from contentType: String) -> String.Encoding {
        // Look for charset= parameter (case insensitive)
        let lowered = contentType.lowercased()
        guard let range = lowered.range(of: "charset=") else {
            return .utf8
        }
        var charset = String(lowered[range.upperBound...])
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\"", with: "")
            .replacingOccurrences(of: "'", with: "")

        // Strip anything after a semicolon or whitespace
        if let endIdx = charset.firstIndex(where: { $0 == ";" || $0 == " " || $0 == "\t" }) {
            charset = String(charset[..<endIdx])
        }

        switch charset {
        case "utf-8", "utf8":
            return .utf8
        case "iso-8859-1", "latin1", "iso_8859-1":
            return .isoLatin1
        case "iso-8859-2", "latin2", "iso_8859-2":
            return .isoLatin2
        case "iso-8859-15", "latin9", "iso_8859-15":
            return String.Encoding(rawValue: CFStringConvertEncodingToNSStringEncoding(CFStringEncoding(CFStringEncodings.isoLatin9.rawValue)))
        case "windows-1252", "cp1252":
            return .windowsCP1252
        case "windows-1250", "cp1250":
            return .windowsCP1250
        case "windows-1251", "cp1251":
            return .windowsCP1251
        case "ascii", "us-ascii":
            return .ascii
        case "utf-16", "utf16":
            return .utf16
        default:
            // Try CFStringConvertIANACharSetNameToEncoding for other charsets
            let cfEncoding = CFStringConvertIANACharSetNameToEncoding(charset as CFString)
            if cfEncoding != kCFStringEncodingInvalidId {
                return String.Encoding(rawValue: CFStringConvertEncodingToNSStringEncoding(cfEncoding))
            }
            return .utf8
        }
    }

    /// Parse an NSArray of dictionaries into EmailAddress array
    private func parseEmailAddresses(_ array: NSArray?) -> [EmailAddress] {
        guard let addresses = array as? [[String: Any]] else {
            return []
        }

        return addresses.compactMap { dict in
            guard let address = dict["address"] as? String else { return nil }
            return EmailAddress(
                name: dict["name"] as? String,
                address: address
            )
        }
    }
}
