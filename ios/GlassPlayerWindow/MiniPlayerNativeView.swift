/**
 * MiniPlayerNativeView — Native iOS mini player UI for Liquid Glass window
 *
 * Layout (80pt height):
 * ┌────────────────────────────────────────────────────────────────┐
 * │  [🎵]  Title                          [⏸️]  [⏹️]              │
 * │  60pt  Subtitle (truncated)           60pt  60pt              │
 * │        Progress bar (optional)                                 │
 * └────────────────────────────────────────────────────────────────┘
 *
 * Senior-inclusive design:
 * - Touch targets ≥60pt
 * - Typography ≥18pt
 * - High contrast on glass background
 *
 * @see .claude/plans/LIQUID_GLASS_PLAYER_WINDOW.md
 */

import UIKit

// MARK: - Delegate Protocol

@available(iOS 26.0, *)
protocol MiniPlayerNativeViewDelegate: AnyObject {
    func miniPlayerDidTapPlayPause()
    func miniPlayerDidTapStop()
    func miniPlayerDidTapExpand()
}

// MARK: - MiniPlayerNativeView

@available(iOS 26.0, *)
class MiniPlayerNativeView: UIView {
    
    // MARK: - Properties
    
    weak var delegate: MiniPlayerNativeViewDelegate?
    
    private let artworkImageView = UIImageView()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let progressView = UIProgressView()
    private let listenDurationLabel = UILabel()
    private let loadingIndicator = UIActivityIndicatorView(style: .medium)
    private let playPauseButton = UIButton(type: .system)
    private let stopButton = UIButton(type: .system)
    
    private var isPlaying: Bool = false
    private var isLoading: Bool = false
    private var isBuffering: Bool = false
    private var showStopButton: Bool = true
    private var showProgressBar: Bool = false
    private var showListenDuration: Bool = false
    private var listenDuration: TimeInterval = 0
    
    // MARK: - Constants
    
    private enum Layout {
        static let height: CGFloat = 88  // Larger for better visibility
        static let padding: CGFloat = 14
        static let artworkSize: CGFloat = 64  // Larger artwork for visibility
        static let buttonSize: CGFloat = 60   // Senior-inclusive touch targets
        static let titleFontSize: CGFloat = 18  // Senior-inclusive typography
        static let subtitleFontSize: CGFloat = 14
        static let progressHeight: CGFloat = 3
    }
    
    // MARK: - Initialization
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
        setupGestures()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
        setupGestures()
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        // Clear background — GlassPlayerView provides the glass effect behind us
        backgroundColor = .clear
        
        // Artwork
        artworkImageView.contentMode = .scaleAspectFill
        artworkImageView.clipsToBounds = true
        artworkImageView.layer.cornerRadius = 8
        artworkImageView.backgroundColor = UIColor.white.withAlphaComponent(0.2)
        artworkImageView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(artworkImageView)
        
        // Title
        titleLabel.font = .systemFont(ofSize: Layout.titleFontSize, weight: .semibold)
        titleLabel.textColor = .white
        titleLabel.numberOfLines = 1
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(titleLabel)
        
        // Subtitle
        subtitleLabel.font = .systemFont(ofSize: Layout.subtitleFontSize, weight: .regular)
        subtitleLabel.textColor = UIColor.white.withAlphaComponent(0.8)
        subtitleLabel.numberOfLines = 1
        subtitleLabel.lineBreakMode = .byTruncatingTail
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(subtitleLabel)
        
        // Progress bar
        progressView.progressTintColor = .white
        progressView.trackTintColor = UIColor.white.withAlphaComponent(0.3)
        progressView.translatesAutoresizingMaskIntoConstraints = false
        progressView.isHidden = true
        addSubview(progressView)
        
        // Listen duration label (for radio: "🎧 45:32")
        listenDurationLabel.font = .monospacedDigitSystemFont(ofSize: 12, weight: .medium)
        listenDurationLabel.textColor = UIColor.white.withAlphaComponent(0.8)
        listenDurationLabel.text = "🎧 0:00"
        listenDurationLabel.translatesAutoresizingMaskIntoConstraints = false
        listenDurationLabel.isHidden = true
        addSubview(listenDurationLabel)
        
        // Loading indicator
        loadingIndicator.color = .white
        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        loadingIndicator.hidesWhenStopped = true
        addSubview(loadingIndicator)
        
        // Play/Pause button
        let playConfig = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
        playPauseButton.setImage(UIImage(systemName: "play.fill", withConfiguration: playConfig), for: .normal)
        playPauseButton.tintColor = .white
        playPauseButton.addTarget(self, action: #selector(handlePlayPause), for: .touchUpInside)
        playPauseButton.translatesAutoresizingMaskIntoConstraints = false
        playPauseButton.accessibilityLabel = "Afspelen"
        addSubview(playPauseButton)
        
        // Stop button
        let stopConfig = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
        stopButton.setImage(UIImage(systemName: "stop.fill", withConfiguration: stopConfig), for: .normal)
        stopButton.tintColor = .white
        stopButton.addTarget(self, action: #selector(handleStop), for: .touchUpInside)
        stopButton.translatesAutoresizingMaskIntoConstraints = false
        stopButton.accessibilityLabel = "Stoppen"
        addSubview(stopButton)
        
        setupConstraints()
    }
    
    private func setupConstraints() {
        NSLayoutConstraint.activate([
            // Artwork
            artworkImageView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: Layout.padding),
            artworkImageView.centerYAnchor.constraint(equalTo: centerYAnchor),
            artworkImageView.widthAnchor.constraint(equalToConstant: Layout.artworkSize),
            artworkImageView.heightAnchor.constraint(equalToConstant: Layout.artworkSize),
            
            // Stop button (rightmost)
            stopButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -Layout.padding),
            stopButton.centerYAnchor.constraint(equalTo: centerYAnchor),
            stopButton.widthAnchor.constraint(equalToConstant: Layout.buttonSize),
            stopButton.heightAnchor.constraint(equalToConstant: Layout.buttonSize),
            
            // Play/Pause button
            playPauseButton.trailingAnchor.constraint(equalTo: stopButton.leadingAnchor),
            playPauseButton.centerYAnchor.constraint(equalTo: centerYAnchor),
            playPauseButton.widthAnchor.constraint(equalToConstant: Layout.buttonSize),
            playPauseButton.heightAnchor.constraint(equalToConstant: Layout.buttonSize),
            
            // Title
            titleLabel.leadingAnchor.constraint(equalTo: artworkImageView.trailingAnchor, constant: Layout.padding),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: playPauseButton.leadingAnchor, constant: -8),
            titleLabel.topAnchor.constraint(equalTo: artworkImageView.topAnchor, constant: 4),
            
            // Subtitle
            subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            
            // Listen duration label (below subtitle)
            listenDurationLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            listenDurationLabel.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 4),
            
            // Loading indicator (centered on play button)
            loadingIndicator.centerXAnchor.constraint(equalTo: playPauseButton.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: playPauseButton.centerYAnchor),
            
            // Progress bar
            progressView.leadingAnchor.constraint(equalTo: leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: trailingAnchor),
            progressView.bottomAnchor.constraint(equalTo: bottomAnchor),
            progressView.heightAnchor.constraint(equalToConstant: Layout.progressHeight),
        ])
    }
    
    private func setupGestures() {
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap))
        addGestureRecognizer(tapGesture)
        isUserInteractionEnabled = true
    }
    
    // MARK: - Actions
    
    @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
        let location = gesture.location(in: self)
        
        // Don't expand if tapping on buttons
        if playPauseButton.frame.contains(location) || stopButton.frame.contains(location) {
            return
        }
        
        delegate?.miniPlayerDidTapExpand()
    }
    
    @objc private func handlePlayPause() {
        // Haptic feedback
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()

        // OPTIMISTIC UI UPDATE: Immediately toggle the icon before delegate callback
        // This prevents the "double-tap" feel where native waits for RN round-trip
        let newIsPlaying = !isPlaying
        isPlaying = newIsPlaying

        let config = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
        let iconName = newIsPlaying ? "pause.fill" : "play.fill"
        playPauseButton.setImage(UIImage(systemName: iconName, withConfiguration: config), for: .normal)
        playPauseButton.accessibilityLabel = newIsPlaying ? "Pauzeren" : "Afspelen"

        NSLog("[GlassPlayer Mini] handlePlayPause - optimistic update to isPlaying: \(newIsPlaying)")

        delegate?.miniPlayerDidTapPlayPause()
    }
    
    @objc private func handleStop() {
        // Haptic feedback
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
        
        delegate?.miniPlayerDidTapStop()
    }
    
    // MARK: - Public Methods
    
    func updateContent(title: String, subtitle: String?, artworkURL: String?) {
        NSLog("[GlassPlayer Mini] updateContent - title: \(title), subtitle: \(subtitle ?? "nil"), artworkURL: \(artworkURL ?? "nil")")
        titleLabel.text = title
        subtitleLabel.text = subtitle
        subtitleLabel.isHidden = subtitle == nil
        
        // Load artwork
        if let urlString = artworkURL, !urlString.isEmpty, let url = URL(string: urlString) {
            loadImage(from: url)
        } else {
            NSLog("[GlassPlayer Mini] No artwork URL or empty string")
            artworkImageView.image = nil
        }
    }
    
    func updatePlaybackState(isPlaying: Bool, isLoading: Bool, isBuffering: Bool, progress: Float?, listenDuration: TimeInterval?, showStopButton: Bool) {
        // Track if playback state actually changed to avoid UI flicker
        // The optimistic UI update in handlePlayPause already sets the correct state,
        // so this will only trigger if state differs (e.g., external state change)
        let playStateChanged = self.isPlaying != isPlaying
        let loadingStateChanged = self.isLoading != isLoading

        NSLog("[GlassPlayer Mini] updatePlaybackState - isPlaying: \(isPlaying), current: \(self.isPlaying), changed: \(playStateChanged)")

        self.isPlaying = isPlaying
        self.isLoading = isLoading
        self.isBuffering = isBuffering
        self.showStopButton = showStopButton

        // Update loading indicator (only if changed)
        if loadingStateChanged {
            if isLoading {
                loadingIndicator.startAnimating()
                playPauseButton.isHidden = true
            } else {
                loadingIndicator.stopAnimating()
                playPauseButton.isHidden = false
            }
        }

        // Update play/pause icon (only if state changed to prevent flicker)
        if playStateChanged {
            let config = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
            let iconName = isPlaying ? "pause.fill" : "play.fill"
            playPauseButton.setImage(UIImage(systemName: iconName, withConfiguration: config), for: .normal)
            playPauseButton.accessibilityLabel = isPlaying ? "Pauzeren" : "Afspelen"
        }
        
        // Update stop button visibility
        stopButton.isHidden = !showStopButton
        
        // Update progress bar (for podcast/books)
        if let progress = progress {
            progressView.isHidden = false
            progressView.progress = progress
            listenDurationLabel.isHidden = true
        } else {
            progressView.isHidden = true
        }
        
        // Update listen duration (for radio)
        if let duration = listenDuration {
            self.listenDuration = duration
            listenDurationLabel.isHidden = false
            listenDurationLabel.text = "🎧 \(formatDuration(duration))"
            progressView.isHidden = true
        } else if progress == nil {
            listenDurationLabel.isHidden = true
        }
        
        // Update buffering state
        updateBufferingState()
    }
    
    private func updateBufferingState() {
        if isBuffering {
            startBufferingAnimation()
        } else {
            stopBufferingAnimation()
        }
    }
    
    private func startBufferingAnimation() {
        // Check if animation is already running
        if artworkImageView.layer.animation(forKey: "bufferingPulse") != nil {
            return
        }
        
        // Pulse animation on artwork opacity
        let pulseAnimation = CABasicAnimation(keyPath: "opacity")
        pulseAnimation.fromValue = 1.0
        pulseAnimation.toValue = 0.5
        pulseAnimation.duration = 0.8
        pulseAnimation.autoreverses = true
        pulseAnimation.repeatCount = .infinity
        pulseAnimation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        artworkImageView.layer.add(pulseAnimation, forKey: "bufferingPulse")
    }
    
    private func stopBufferingAnimation() {
        artworkImageView.layer.removeAnimation(forKey: "bufferingPulse")
        artworkImageView.layer.opacity = 1.0
    }
    
    private func formatDuration(_ seconds: TimeInterval) -> String {
        let totalSeconds = Int(seconds)
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let secs = totalSeconds % 60
        
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        } else {
            return String(format: "%d:%02d", minutes, secs)
        }
    }
    
    func updateTintColor(_ hexColor: String) {
        // Apply tint to progress bar
        if let color = UIColor.fromHex(hexColor) {
            progressView.progressTintColor = color
        }
    }
    
    // MARK: - Image Loading
    
    private func loadImage(from url: URL) {
        NSLog("[GlassPlayer Mini] Loading image from URL: \(url.absoluteString)")
        
        var request = URLRequest(url: url)
        request.timeoutInterval = 10
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let error = error {
                NSLog("[GlassPlayer Mini] Image load error: \(error.localizedDescription)")
                return
            }
            
            // Check HTTP response
            if let httpResponse = response as? HTTPURLResponse {
                NSLog("[GlassPlayer Mini] HTTP response status: \(httpResponse.statusCode)")
                if httpResponse.statusCode != 200 {
                    NSLog("[GlassPlayer Mini] HTTP error: \(httpResponse.statusCode)")
                    return
                }
            }
            
            guard let data = data, !data.isEmpty else {
                NSLog("[GlassPlayer Mini] Image load failed - no data or empty data")
                return
            }
            
            NSLog("[GlassPlayer Mini] Received \(data.count) bytes of image data")
            
            guard let image = UIImage(data: data) else {
                NSLog("[GlassPlayer Mini] Failed to create UIImage from data")
                return
            }
            
            NSLog("[GlassPlayer Mini] Image loaded successfully, size: \(image.size)")
            DispatchQueue.main.async {
                self?.artworkImageView.image = image
            }
        }.resume()
    }
}
