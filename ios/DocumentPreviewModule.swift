/**
 * DocumentPreviewModule — Native iOS Quick Look + Safari browser for React Native
 *
 * Provides two key capabilities:
 * 1. QLPreviewController: In-app preview for PDF, Word, Excel, PowerPoint, iWork, images, text, CSV
 * 2. SFSafariViewController: In-app browser with phishing protection, "Done" button, "Open in Safari"
 *
 * Both keep the user inside CommEazy — critical for senior UX.
 *
 * ARCHITECTURE:
 * - React Native calls previewFile(filePath) → QLPreviewController presented modally
 * - React Native calls openURL(url) → SFSafariViewController presented modally
 * - Both use main thread for UIKit presentation
 *
 * SUPPORTED FILE TYPES (QLPreviewController):
 * - iWork: Pages, Numbers, Keynote
 * - Microsoft Office: Word, Excel, PowerPoint
 * - PDF, RTF, CSV, plain text
 * - Images (JPEG, PNG, HEIC, GIF, TIFF, BMP)
 * - Video (MP4, MOV)
 *
 * @see MailDetailScreen.tsx — ContentRouter integration
 */

import Foundation
import React
import QuickLook
import SafariServices

// ============================================================
// MARK: - DocumentPreviewModule
// ============================================================

@objc(DocumentPreviewModule)
class DocumentPreviewModule: NSObject {

    // MARK: - Properties

    /// File URL for QLPreviewController data source
    private var previewFileURL: URL?

    // MARK: - Module Configuration

    @objc static func moduleName() -> String {
        return "DocumentPreviewModule"
    }

    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // MARK: - Preview File (QLPreviewController)

    /// Preview a local file using iOS Quick Look.
    /// Supports PDF, Word, Excel, PowerPoint, iWork, images, text, CSV, RTF.
    ///
    /// - Parameters:
    ///   - filePath: Absolute path to the local file
    ///   - resolve: Promise resolve (returns true when presented)
    ///   - reject: Promise reject (returns error if file not found or unsupported)
    @objc(previewFile:resolve:reject:)
    func previewFile(
        _ filePath: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        let fileURL = URL(fileURLWithPath: filePath)

        // Verify file exists
        guard FileManager.default.fileExists(atPath: filePath) else {
            reject("FILE_NOT_FOUND", "File does not exist at path", nil)
            return
        }

        // Store URL for data source
        self.previewFileURL = fileURL

        // Present on main thread (UIKit requirement)
        DispatchQueue.main.async {
            guard let rootVC = self.topViewController() else {
                reject("NO_VIEW_CONTROLLER", "Could not find root view controller", nil)
                return
            }

            let previewController = QLPreviewController()
            previewController.dataSource = self
            previewController.modalPresentationStyle = .fullScreen

            rootVC.present(previewController, animated: true) {
                resolve(true)
            }
        }
    }

    // MARK: - Open URL (SFSafariViewController)

    /// Open a URL in an in-app Safari browser.
    /// Features: address bar, phishing protection, "Done" button, "Open in Safari" button.
    ///
    /// - Parameters:
    ///   - urlString: The URL to open (must be http or https)
    ///   - tintColorHex: Optional hex color for the toolbar tint (e.g. "#1565C0")
    ///   - resolve: Promise resolve (returns true when presented)
    ///   - reject: Promise reject (returns error if URL is invalid)
    @objc(openURL:tintColorHex:resolve:reject:)
    func openURL(
        _ urlString: String,
        tintColorHex: String?,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let url = URL(string: urlString),
              let scheme = url.scheme?.lowercased(),
              (scheme == "http" || scheme == "https") else {
            reject("INVALID_URL", "URL must use http or https scheme", nil)
            return
        }

        DispatchQueue.main.async {
            guard let rootVC = self.topViewController() else {
                reject("NO_VIEW_CONTROLLER", "Could not find root view controller", nil)
                return
            }

            let config = SFSafariViewController.Configuration()
            config.entersReaderIfAvailable = false
            config.barCollapsingEnabled = true

            let safariVC = SFSafariViewController(url: url, configuration: config)
            safariVC.dismissButtonStyle = .done
            safariVC.modalPresentationStyle = .fullScreen

            // Apply CommEazy tint color if provided
            if let hexColor = tintColorHex {
                let color = UIColor(hexString: hexColor) ?? UIColor.systemBlue
                safariVC.preferredBarTintColor = UIColor.systemBackground
                safariVC.preferredControlTintColor = color
            }

            rootVC.present(safariVC, animated: true) {
                resolve(true)
            }
        }
    }

    // MARK: - Can Preview File

    /// Check if a file can be previewed by Quick Look.
    ///
    /// - Parameters:
    ///   - filePath: Path to check
    ///   - resolve: Returns true if previewable, false otherwise
    @objc(canPreviewFile:resolve:reject:)
    func canPreviewFile(
        _ filePath: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        let fileURL = URL(fileURLWithPath: filePath) as NSURL
        resolve(QLPreviewController.canPreview(fileURL))
    }

    // MARK: - Helper: Find Top View Controller

    private func topViewController() -> UIViewController? {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first(where: { $0.isKeyWindow }),
              var topVC = window.rootViewController else {
            return nil
        }

        while let presented = topVC.presentedViewController {
            topVC = presented
        }

        return topVC
    }
}

// ============================================================
// MARK: - QLPreviewControllerDataSource
// ============================================================

extension DocumentPreviewModule: QLPreviewControllerDataSource {

    func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        return previewFileURL != nil ? 1 : 0
    }

    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> any QLPreviewItem {
        return (previewFileURL ?? URL(fileURLWithPath: "")) as NSURL
    }
}
