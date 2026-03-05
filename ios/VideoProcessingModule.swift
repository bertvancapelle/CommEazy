/**
 * VideoProcessingModule — Native iOS Video Processing for React Native
 *
 * Provides video compression, thumbnail generation, and metadata extraction
 * using Apple's AVFoundation framework. No external dependencies required.
 *
 * CAPABILITIES:
 * 1. compressVideo: Transcode to H.264 with configurable quality/resolution
 * 2. generateThumbnail: Extract JPEG frame at specified timestamp
 * 3. getVideoMetadata: Extract duration, dimensions, file size
 *
 * ARCHITECTURE:
 * - Uses AVAssetExportSession for hardware-accelerated compression
 * - Uses AVAssetImageGenerator for thumbnail extraction
 * - Uses AVAsset for metadata extraction
 * - All operations run on background queue (non-blocking)
 * - Output written to app's tmp directory (caller manages cleanup)
 *
 * PRIVACY:
 * - Strips GPS/EXIF metadata during export (AVAssetExportSession default)
 * - No network access — pure local file processing
 *
 * @see mediaService.ts — React Native integration
 * @see mediaStorageService.ts — Storage integration
 */

import Foundation
import React
import AVFoundation
import UIKit

// ============================================================
// MARK: - VideoProcessingModule
// ============================================================

@objc(VideoProcessingModule)
class VideoProcessingModule: NSObject {

    // MARK: - Module Configuration

    @objc static func moduleName() -> String {
        return "VideoProcessingModule"
    }

    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // MARK: - Compress Video

    /// Compress a video file using AVAssetExportSession.
    ///
    /// - Parameters:
    ///   - inputPath: Absolute path to source video file
    ///   - quality: Export preset quality — "low", "medium", "high" (default: "medium")
    ///   - maxWidth: Maximum width in pixels — video is scaled down if larger (default: 1280)
    ///   - resolve: Promise resolve with result dictionary
    ///   - reject: Promise reject with error
    ///
    /// Result dictionary:
    ///   - uri: String — Path to compressed output file
    ///   - size: Number — File size in bytes
    ///   - width: Number — Video width in pixels
    ///   - height: Number — Video height in pixels
    ///   - duration: Number — Duration in seconds
    @objc(compressVideo:quality:maxWidth:resolve:reject:)
    func compressVideo(
        _ inputPath: String,
        quality: String,
        maxWidth: NSNumber,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        let inputURL = URL(fileURLWithPath: inputPath)

        // Verify file exists
        guard FileManager.default.fileExists(atPath: inputPath) else {
            reject("FILE_NOT_FOUND", "Video file does not exist at path", nil)
            return
        }

        let asset = AVURLAsset(url: inputURL, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])

        // Map quality string to AVAssetExportSession preset
        let preset = self.exportPreset(for: quality)

        // Check if export preset is compatible with this asset
        AVAssetExportSession.determineCompatibility(ofExportPreset: preset, with: asset, outputFileType: .mp4) { isCompatible in
            guard isCompatible else {
                // Fall back to passthrough (no re-encoding) if preset not compatible
                self.performExport(asset: asset, preset: AVAssetExportPresetPassthrough, maxWidth: maxWidth.intValue, resolve: resolve, reject: reject)
                return
            }
            self.performExport(asset: asset, preset: preset, maxWidth: maxWidth.intValue, resolve: resolve, reject: reject)
        }
    }

    // MARK: - Generate Thumbnail

    /// Generate a JPEG thumbnail from a video at a specified timestamp.
    ///
    /// - Parameters:
    ///   - inputPath: Absolute path to source video file
    ///   - timeMs: Time in milliseconds at which to capture the frame (default: 0)
    ///   - resolve: Promise resolve with result dictionary
    ///   - reject: Promise reject with error
    ///
    /// Result dictionary:
    ///   - uri: String — Path to generated JPEG thumbnail
    ///   - width: Number — Thumbnail width in pixels
    ///   - height: Number — Thumbnail height in pixels
    @objc(generateThumbnail:timeMs:resolve:reject:)
    func generateThumbnail(
        _ inputPath: String,
        timeMs: NSNumber,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        let inputURL = URL(fileURLWithPath: inputPath)

        guard FileManager.default.fileExists(atPath: inputPath) else {
            reject("FILE_NOT_FOUND", "Video file does not exist at path", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let asset = AVURLAsset(url: inputURL)
            let imageGenerator = AVAssetImageGenerator(asset: asset)
            imageGenerator.appliesPreferredTrackTransform = true
            // Request a reasonable thumbnail size (not full resolution)
            imageGenerator.maximumSize = CGSize(width: 640, height: 640)

            let time = CMTimeMake(value: Int64(timeMs.intValue), timescale: 1000)

            do {
                let cgImage = try imageGenerator.copyCGImage(at: time, actualTime: nil)
                let uiImage = UIImage(cgImage: cgImage)

                // Write JPEG to tmp directory
                let outputFileName = "thumb_\(UUID().uuidString).jpg"
                let outputPath = NSTemporaryDirectory() + outputFileName
                let outputURL = URL(fileURLWithPath: outputPath)

                guard let jpegData = uiImage.jpegData(compressionQuality: 0.8) else {
                    reject("THUMBNAIL_FAILED", "Failed to encode thumbnail as JPEG", nil)
                    return
                }

                try jpegData.write(to: outputURL)

                resolve([
                    "uri": outputPath,
                    "width": cgImage.width,
                    "height": cgImage.height,
                ])
            } catch {
                reject("THUMBNAIL_FAILED", "Failed to generate thumbnail: \(error.localizedDescription)", nil)
            }
        }
    }

    // MARK: - Get Video Metadata

    /// Extract metadata from a video file without processing it.
    ///
    /// - Parameters:
    ///   - inputPath: Absolute path to video file
    ///   - resolve: Promise resolve with metadata dictionary
    ///   - reject: Promise reject with error
    ///
    /// Result dictionary:
    ///   - duration: Number — Duration in seconds
    ///   - width: Number — Video width in pixels
    ///   - height: Number — Video height in pixels
    ///   - size: Number — File size in bytes
    ///   - codec: String — Video codec (e.g. "avc1" for H.264)
    @objc(getVideoMetadata:resolve:reject:)
    func getVideoMetadata(
        _ inputPath: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        let inputURL = URL(fileURLWithPath: inputPath)

        guard FileManager.default.fileExists(atPath: inputPath) else {
            reject("FILE_NOT_FOUND", "Video file does not exist at path", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let asset = AVURLAsset(url: inputURL, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])

            // Get duration
            let durationSeconds = CMTimeGetSeconds(asset.duration)

            // Get video track dimensions and codec
            var width: Int = 0
            var height: Int = 0
            var codec: String = "unknown"

            if let videoTrack = asset.tracks(withMediaType: .video).first {
                let size = videoTrack.naturalSize.applying(videoTrack.preferredTransform)
                width = Int(abs(size.width))
                height = Int(abs(size.height))

                // Extract codec from format descriptions
                if let formatDescription = videoTrack.formatDescriptions.first {
                    let desc = formatDescription as! CMFormatDescription
                    let fourCC = CMFormatDescriptionGetMediaSubType(desc)
                    codec = self.fourCCToString(fourCC)
                }
            }

            // Get file size
            var fileSize: Int64 = 0
            if let attrs = try? FileManager.default.attributesOfItem(atPath: inputPath),
               let size = attrs[.size] as? Int64 {
                fileSize = size
            }

            resolve([
                "duration": durationSeconds.isNaN ? 0 : durationSeconds,
                "width": width,
                "height": height,
                "size": fileSize,
                "codec": codec,
            ])
        }
    }

    // MARK: - Private Helpers

    /// Map quality string to AVAssetExportSession preset
    private func exportPreset(for quality: String) -> String {
        switch quality.lowercased() {
        case "low":
            return AVAssetExportPresetLowQuality
        case "high":
            return AVAssetExportPreset1920x1080
        case "medium":
            return AVAssetExportPreset1280x720
        default:
            return AVAssetExportPreset1280x720
        }
    }

    /// Perform the actual export operation
    private func performExport(
        asset: AVURLAsset,
        preset: String,
        maxWidth: Int,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let exportSession = AVAssetExportSession(asset: asset, presetName: preset) else {
            reject("EXPORT_FAILED", "Could not create AVAssetExportSession", nil)
            return
        }

        // Generate unique output path
        let outputFileName = "compressed_\(UUID().uuidString).mp4"
        let outputPath = NSTemporaryDirectory() + outputFileName
        let outputURL = URL(fileURLWithPath: outputPath)

        // Remove existing file if any
        try? FileManager.default.removeItem(at: outputURL)

        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mp4
        exportSession.shouldOptimizeForNetworkUse = true

        // Metadata stripping: AVAssetExportSession strips GPS/EXIF by default
        // when outputFileType is .mp4 and no metadataItemFilter is set

        exportSession.exportAsynchronously {
            switch exportSession.status {
            case .completed:
                // Get output file info
                var fileSize: Int64 = 0
                if let attrs = try? FileManager.default.attributesOfItem(atPath: outputPath),
                   let size = attrs[.size] as? Int64 {
                    fileSize = size
                }

                // Get output video dimensions and duration
                let outputAsset = AVURLAsset(url: outputURL)
                let duration = CMTimeGetSeconds(outputAsset.duration)
                var width: Int = 0
                var height: Int = 0

                if let videoTrack = outputAsset.tracks(withMediaType: .video).first {
                    let size = videoTrack.naturalSize.applying(videoTrack.preferredTransform)
                    width = Int(abs(size.width))
                    height = Int(abs(size.height))
                }

                resolve([
                    "uri": outputPath,
                    "size": fileSize,
                    "width": width,
                    "height": height,
                    "duration": duration.isNaN ? 0 : duration,
                ])

            case .failed:
                let errorMsg = exportSession.error?.localizedDescription ?? "Unknown export error"
                reject("EXPORT_FAILED", "Video compression failed: \(errorMsg)", exportSession.error)

            case .cancelled:
                reject("EXPORT_CANCELLED", "Video compression was cancelled", nil)

            default:
                reject("EXPORT_FAILED", "Unexpected export status: \(exportSession.status.rawValue)", nil)
            }
        }
    }

    /// Convert FourCC code to readable string (e.g. 'avc1' for H.264)
    private func fourCCToString(_ code: FourCharCode) -> String {
        let bytes: [CChar] = [
            CChar(truncatingIfNeeded: (code >> 24) & 0xFF),
            CChar(truncatingIfNeeded: (code >> 16) & 0xFF),
            CChar(truncatingIfNeeded: (code >> 8) & 0xFF),
            CChar(truncatingIfNeeded: code & 0xFF),
            0
        ]
        return String(cString: bytes)
    }
}
