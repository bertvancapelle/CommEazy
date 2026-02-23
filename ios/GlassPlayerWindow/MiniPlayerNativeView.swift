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
    
    // Dynamic constraints for title and progress bar trailing edge
    private var titleTrailingToStopConstraint: NSLayoutConstraint?
    private var titleTrailingToPlayPauseConstraint: NSLayoutConstraint?
    private var progressTrailingToStopConstraint: NSLayoutConstraint?
    private var progressTrailingToPlayPauseConstraint: NSLayoutConstraint?
    
    // MARK: - Constants
    
    private enum Layout {
        static let height: CGFloat = 88  // Larger for better visibility
        static let padding: CGFloat = 14
        static let artworkSize: CGFloat = 64  // Larger artwork for visibility
        static let buttonSize: CGFloat = 60   // Senior-inclusive touch targets
        static let titleFontSize: CGFloat = 18  // Senior-inclusive typography
        static let subtitleFontSize: CGFloat = 14
        static let progressHeight: CGFloat = 6  // Thicker for better visibility
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
        
        // Progress bar - styled for visibility within glass effect
        progressView.progressTintColor = .white
        progressView.trackTintColor = UIColor.white.withAlphaComponent(0.3)
        progressView.translatesAutoresizingMaskIntoConstraints = false
        progressView.isHidden = true
        progressView.layer.cornerRadius = Layout.progressHeight / 2
        progressView.clipsToBounds = true
        // Make track slightly visible for context
        progressView.trackTintColor = UIColor.black.withAlphaComponent(0.2)
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
        
        // Play/Pause button - configured for reliable single-tap response
        let playConfig = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
        playPauseButton.setImage(UIImage(systemName: "play.fill", withConfiguration: playConfig), for: .normal)
        playPauseButton.tintColor = .white
        playPauseButton.addTarget(self, action: #selector(handlePlayPause), for: .touchUpInside)
        playPauseButton.translatesAutoresizingMaskIntoConstraints = false
        playPauseButton.accessibilityLabel = "Afspelen"
        playPauseButton.isExclusiveTouch = true
        playPauseButton.isUserInteractionEnabled = true
        playPauseButton.adjustsImageWhenHighlighted = true
        // Visual feedback: background + highlight state
        playPauseButton.backgroundColor = UIColor.white.withAlphaComponent(0.15)
        playPauseButton.layer.cornerRadius = Layout.buttonSize / 2
        // Ensure button is in front and receives touches
        playPauseButton.layer.zPosition = 100
        addSubview(playPauseButton)
        
        // Stop button - configured for reliable single-tap response
        let stopConfig = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
        stopButton.setImage(UIImage(systemName: "stop.fill", withConfiguration: stopConfig), for: .normal)
        stopButton.tintColor = .white
        stopButton.addTarget(self, action: #selector(handleStop), for: .touchUpInside)
        stopButton.translatesAutoresizingMaskIntoConstraints = false
        stopButton.accessibilityLabel = "Stoppen"
        stopButton.isExclusiveTouch = true
        stopButton.isUserInteractionEnabled = true
        stopButton.adjustsImageWhenHighlighted = true
        // Visual feedback: background + highlight state
        stopButton.backgroundColor = UIColor.white.withAlphaComponent(0.15)
        stopButton.layer.cornerRadius = Layout.buttonSize / 2
        // Ensure button is in front and receives touches
        stopButton.layer.zPosition = 100
        addSubview(stopButton)
        
        setupConstraints()
    }
    
    private func setupConstraints() {
        NSLayoutConstraint.activate([
            // Artwork - left side
            artworkImageView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: Layout.padding),
            artworkImageView.centerYAnchor.constraint(equalTo: centerYAnchor),
            artworkImageView.widthAnchor.constraint(equalToConstant: Layout.artworkSize),
            artworkImageView.heightAnchor.constraint(equalToConstant: Layout.artworkSize),
            
            // Play/Pause button - FAR RIGHT
            playPauseButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -Layout.padding),
            playPauseButton.centerYAnchor.constraint(equalTo: centerYAnchor),
            playPauseButton.widthAnchor.constraint(equalToConstant: Layout.buttonSize),
            playPauseButton.heightAnchor.constraint(equalToConstant: Layout.buttonSize),
            
            // Stop button - left of play/pause when visible
            stopButton.trailingAnchor.constraint(equalTo: playPauseButton.leadingAnchor),
            stopButton.centerYAnchor.constraint(equalTo: centerYAnchor),
            stopButton.widthAnchor.constraint(equalToConstant: Layout.buttonSize),
            stopButton.heightAnchor.constraint(equalToConstant: Layout.buttonSize),
            
            // Title - between artwork and buttons
            titleLabel.leadingAnchor.constraint(equalTo: artworkImageView.trailingAnchor, constant: Layout.padding),
            titleLabel.topAnchor.constraint(equalTo: artworkImageView.topAnchor, constant: 2),
            
            // Subtitle
            subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 2),
            
            // Listen duration label (below subtitle)
            listenDurationLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            listenDurationLabel.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 4),
            
            // Loading indicator (centered on play button)
            loadingIndicator.centerXAnchor.constraint(equalTo: playPauseButton.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: playPauseButton.centerYAnchor),
            
            // Progress bar - leading edge same as title
            progressView.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            progressView.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 6),
            progressView.heightAnchor.constraint(equalToConstant: Layout.progressHeight),
        ])
        
        // Dynamic title trailing constraints - only one active at a time
        // These determine how much space the title/subtitle get
        titleTrailingToStopConstraint = titleLabel.trailingAnchor.constraint(equalTo: stopButton.leadingAnchor, constant: -8)
        titleTrailingToPlayPauseConstraint = titleLabel.trailingAnchor.constraint(equalTo: playPauseButton.leadingAnchor, constant: -8)
        
        // Dynamic progress bar trailing constraints
        progressTrailingToStopConstraint = progressView.trailingAnchor.constraint(equalTo: stopButton.leadingAnchor, constant: -12)
        progressTrailingToPlayPauseConstraint = progressView.trailingAnchor.constraint(equalTo: playPauseButton.leadingAnchor, constant: -12)
        
        // Start with stop button visible (default)
        titleTrailingToStopConstraint?.isActive = true
        titleTrailingToPlayPauseConstraint?.isActive = false
        progressTrailingToStopConstraint?.isActive = true
        progressTrailingToPlayPauseConstraint?.isActive = false
    }
    
    private func setupGestures() {
        // SIMPLIFIED: No gesture recognizer needed!
        // hitTest() handles routing: buttons get touches, everything else triggers expand via touchesEnded
        isUserInteractionEnabled = true
    }
    
    // MARK: - Actions
    
    @objc private func handlePlayPause() {
        // Haptic feedback
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()

        // Notify delegate immediately - React Native will update playback state
        delegate?.miniPlayerDidTapPlayPause()
    }
    
    @objc private func handleStop() {
        // Haptic feedback
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
        
        delegate?.miniPlayerDidTapStop()
    }
    
    // MARK: - Public Methods
    
    func updateContent(title: String, subtitle: String?, artworkURL: String?, showStopButton: Bool) {
        titleLabel.text = title
        subtitleLabel.text = subtitle
        subtitleLabel.isHidden = subtitle == nil
        
        // Load artwork
        if let urlString = artworkURL, !urlString.isEmpty, let url = URL(string: urlString) {
            loadImage(from: url)
        } else {
            artworkImageView.image = nil
        }
        
        // Update stop button visibility (single source of truth via content)
        updateStopButtonVisibility(showStopButton)
    }
    
    /// Updates stop button visibility and adjusts layout constraints accordingly
    private func updateStopButtonVisibility(_ show: Bool) {
        let visibilityChanged = stopButton.isHidden == show
        self.showStopButton = show
        stopButton.isHidden = !show
        
        // Update dynamic constraints when stop button visibility changes
        if visibilityChanged {
            if show {
                // Stop button visible: title and progress end at stop button
                titleTrailingToPlayPauseConstraint?.isActive = false
                titleTrailingToStopConstraint?.isActive = true
                progressTrailingToPlayPauseConstraint?.isActive = false
                progressTrailingToStopConstraint?.isActive = true
            } else {
                // Stop button hidden: title and progress end at play/pause button (more space!)
                titleTrailingToStopConstraint?.isActive = false
                titleTrailingToPlayPauseConstraint?.isActive = true
                progressTrailingToStopConstraint?.isActive = false
                progressTrailingToPlayPauseConstraint?.isActive = true
            }
            // Animate the constraint change
            UIView.animate(withDuration: 0.2) {
                self.layoutIfNeeded()
            }
        }
    }
    
    func updatePlaybackState(isPlaying: Bool, isLoading: Bool, isBuffering: Bool, progress: Float?, listenDuration: TimeInterval?) {
        let loadingStateChanged = self.isLoading != isLoading

        self.isPlaying = isPlaying
        self.isLoading = isLoading
        self.isBuffering = isBuffering
        // showStopButton is now controlled via updateContent() — single source of truth

        // Update loading indicator
        if loadingStateChanged {
            if isLoading {
                loadingIndicator.startAnimating()
                playPauseButton.isHidden = true
            } else {
                loadingIndicator.stopAnimating()
                playPauseButton.isHidden = false
            }
        }

        // ALWAYS update play/pause icon based on React Native state
        // React Native is the single source of truth
        let config = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
        let iconName = isPlaying ? "pause.fill" : "play.fill"
        playPauseButton.setImage(UIImage(systemName: iconName, withConfiguration: config), for: .normal)
        playPauseButton.accessibilityLabel = isPlaying ? "Pauzeren" : "Afspelen"
        
        // Stop button visibility is now controlled via updateContent() — no longer handled here
        
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
        var request = URLRequest(url: url)
        request.timeoutInterval = 10
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if error != nil { return }
            
            // Check HTTP response
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
                return
            }
            
            guard let data = data, !data.isEmpty, let image = UIImage(data: data) else {
                return
            }
            
            DispatchQueue.main.async {
                self?.artworkImageView.image = image
            }
        }.resume()
    }
}

// MARK: - Touch Handling

@available(iOS 26.0, *)
extension MiniPlayerNativeView {
    
    /// Override hitTest to route touches correctly:
    /// - Button touches → go to button (for .touchUpInside)
    /// - Other touches → go to self (for touchesEnded → expand)
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        // First check if we should even handle this touch
        guard self.point(inside: point, with: event) else {
            return nil
        }
        
        // Check if point is within play/pause button (with padding for easier touch)
        let playPauseRect = playPauseButton.frame.insetBy(dx: -5, dy: -5)
        if playPauseRect.contains(point) && !playPauseButton.isHidden {
            return playPauseButton
        }
        
        // Check if point is within stop button
        let stopRect = stopButton.frame.insetBy(dx: -5, dy: -5)
        if stopRect.contains(point) && !stopButton.isHidden {
            return stopButton
        }
        
        // For all other touches, return SELF so we get touchesEnded
        return self
    }
    
    /// Handle touches that don't hit buttons - expand to full player
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesEnded(touches, with: event)
        delegate?.miniPlayerDidTapExpand()
    }
}
