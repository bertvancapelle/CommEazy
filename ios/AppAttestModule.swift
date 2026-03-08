/**
 * AppAttestModule — iOS App Attest for React Native
 *
 * Provides DCAppAttestService (iOS 14+) functionality to React Native
 * for app integrity verification with Apple's App Attest service.
 *
 * Flow:
 *   1. isSupported() — check if device supports App Attest
 *   2. generateKey() — generate a new attestation key pair
 *   3. attestKey(keyId, clientDataHash) — attest the key with Apple
 *   4. generateAssertion(keyId, clientDataHash) — generate signed assertion
 *
 * The attestation object is sent to CommEazy's API Gateway which verifies
 * the Apple certificate chain and issues a JWT token.
 *
 * @see TRUST_AND_ATTESTATION_PLAN.md section 3.1
 */

import Foundation
import DeviceCheck
import CryptoKit

@objc(AppAttestModule)
class AppAttestModule: NSObject {

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    /// Check if App Attest is supported on this device.
    /// Returns true on iOS 14+ devices that support DCAppAttestService.
    @objc
    func isSupported(_ resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 14.0, *) {
            let supported = DCAppAttestService.shared.isSupported
            resolve(supported)
        } else {
            resolve(false)
        }
    }

    /// Generate a new attestation key pair.
    /// Returns the keyId string that identifies this key.
    @objc
    func generateKey(_ resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 14.0, *) else {
            reject("UNSUPPORTED", "App Attest requires iOS 14+", nil)
            return
        }

        let service = DCAppAttestService.shared
        guard service.isSupported else {
            reject("UNSUPPORTED", "App Attest not supported on this device", nil)
            return
        }

        service.generateKey { keyId, error in
            if let error = error {
                reject("GENERATE_FAILED", "Key generation failed: \(error.localizedDescription)", error)
            } else if let keyId = keyId {
                resolve(keyId)
            } else {
                reject("GENERATE_FAILED", "Key generation returned nil", nil)
            }
        }
    }

    /// Attest a key with Apple's servers.
    ///
    /// - Parameters:
    ///   - keyId: The key ID from generateKey()
    ///   - clientDataHash: Base64-encoded SHA256 hash of the client data
    ///
    /// Returns base64-encoded attestation object to send to API Gateway.
    @objc
    func attestKey(_ keyId: String,
                   clientDataHash: String,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 14.0, *) else {
            reject("UNSUPPORTED", "App Attest requires iOS 14+", nil)
            return
        }

        guard let hashData = Data(base64Encoded: clientDataHash) else {
            reject("INVALID_HASH", "clientDataHash must be valid base64", nil)
            return
        }

        DCAppAttestService.shared.attestKey(keyId, clientDataHash: hashData) { attestation, error in
            if let error = error {
                reject("ATTEST_FAILED", "Attestation failed: \(error.localizedDescription)", error)
            } else if let attestation = attestation {
                resolve(attestation.base64EncodedString())
            } else {
                reject("ATTEST_FAILED", "Attestation returned nil", nil)
            }
        }
    }

    /// Generate a signed assertion for an already-attested key.
    ///
    /// Used for subsequent API requests to prove the same device+app.
    ///
    /// - Parameters:
    ///   - keyId: The attested key ID
    ///   - clientDataHash: Base64-encoded SHA256 hash of the request data
    ///
    /// Returns base64-encoded assertion object.
    @objc
    func generateAssertion(_ keyId: String,
                           clientDataHash: String,
                           resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 14.0, *) else {
            reject("UNSUPPORTED", "App Attest requires iOS 14+", nil)
            return
        }

        guard let hashData = Data(base64Encoded: clientDataHash) else {
            reject("INVALID_HASH", "clientDataHash must be valid base64", nil)
            return
        }

        DCAppAttestService.shared.generateAssertion(keyId, clientDataHash: hashData) { assertion, error in
            if let error = error {
                reject("ASSERTION_FAILED", "Assertion generation failed: \(error.localizedDescription)", error)
            } else if let assertion = assertion {
                resolve(assertion.base64EncodedString())
            } else {
                reject("ASSERTION_FAILED", "Assertion returned nil", nil)
            }
        }
    }

    /// Generate a SHA-256 hash of a string, returned as base64.
    /// Convenience method so RN doesn't need a separate crypto module for this.
    @objc
    func sha256Hash(_ input: String,
                    resolve: @escaping RCTPromiseResolveBlock,
                    reject: @escaping RCTPromiseRejectBlock) {
        guard let data = input.data(using: .utf8) else {
            reject("INVALID_INPUT", "Input string could not be encoded", nil)
            return
        }

        if #available(iOS 13.0, *) {
            let hash = SHA256.hash(data: data)
            let hashData = Data(hash)
            resolve(hashData.base64EncodedString())
        } else {
            // Fallback for iOS <13 (unlikely given our iOS 14+ requirement)
            reject("UNSUPPORTED", "SHA256 requires iOS 13+", nil)
        }
    }
}
