/**
 * FullPlayerNativeView — Native iOS full player UI for Liquid Glass window
 *
 * Layout (full screen):
 * ┌────────────────────────────────────────────────────────────────┐
 * │  Safe Area                                                     │
 * │  [˅] Close button (chevron-down)                    84pt      │
 * ├────────────────────────────────────────────────────────────────┤
 * │                                                                │
 * │              ┌────────────────────┐                            │
 * │              │     Artwork        │  240×240pt                 │
 * │              └────────────────────┘                            │
 * │                                                                │
 * │              Title (24pt, bold)                                │
 * │              Subtitle (18pt)                                   │
 * │                                                                │
 * │         ════════ SeekSlider ════════  (optional)               │
 * │         00:00                  45:32                           │
 * │                                                                │
 * │              ⏪    ▶/⏸    ⏩         84pt buttons               │
 * │                                                                │
 * │         [1x] [Sleep] [❤️]            Secondary controls        │
 * │                                                                │
 * └────────────────────────────────────────────────────────────────┘
 *
 * Senior-inclusive design:
 * - Primary buttons 84pt
 * - Secondary buttons 60pt
 * - Typography ≥18pt body, ≥24pt headings
 *
 * @see .claude/plans/LIQUID_GLASS_PLAYER_WINDOW.md
 */

import UIKit

// MARK: - Delegate Protocol

protocol FullPlayerNativeViewDelegate: AnyObject {
    func fullPlayerDidTapClose()
    func fullPlayerDidTapPlayPause()
    func fullPlayerDidTapStop()
    func fullPlayerDidSeek(to position: Float)
    func fullPlayerDidTapSkipBackward()
    func fullPlayerDidTapSkipForward()
    func fullPlayerDidChangeSpeed(_ speed: Float)
    func fullPlayerDidSetSleepTimer(_ minutes: Int?)
    func fullPlayerDidTapFavorite()
}

// MARK: - FullPlayerNativeView

@available(iOS 26.0, *)
class FullPlayerNativeView: UIView {
    
    // MARK: - Properties
    
    weak var delegate: FullPlayerNativeViewDelegate?
    
    // Using a plain UIView instead of ScrollView - no scrolling needed
    private let contentView = UIView()
    
    private let closeButton = UIButton(type: .system)
    private let artworkImageView = UIImageView()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    
    // Seek controls
    private let seekSlider = UISlider()
    private let currentTimeLabel = UILabel()
    private let durationLabel = UILabel()
    private let seekContainer = UIView()
    
    // Playback controls
    private let skipBackwardButton = UIButton(type: .system)
    private let playPauseButton = UIButton(type: .system)
    private let skipForwardButton = UIButton(type: .system)
    private let stopButton = UIButton(type: .system)
    
    // Secondary controls
    private let speedButton = UIButton(type: .system)
    private let sleepButton = UIButton(type: .system)
    private let favoriteButton = UIButton(type: .system)
    
    // Loading indicator (overlay on play button)
    private let loadingIndicator = UIActivityIndicatorView(style: .medium)
    
    // State
    private var isPlaying: Bool = false
    private var isLoading: Bool = false
    private var isBuffering: Bool = false
    private var isFavorite: Bool = false
    private var currentSpeed: Float = 1.0
    private var sleepTimerMinutes: Int? = nil
    
    // Configuration
    private var showSeekSlider: Bool = false
    private var showSkipButtons: Bool = false
    private var showSpeedControl: Bool = false
    private var showSleepTimer: Bool = true
    private var showFavorite: Bool = true
    private var showStopButton: Bool = true
    
    // MARK: - Constants
    
    private enum Layout {
        static let padding: CGFloat = 20
        static let artworkSize: CGFloat = 200  // Smaller artwork for more compact player
        static let primaryButtonSize: CGFloat = 84
        static let secondaryButtonSize: CGFloat = 60
        static let closeButtonSize: CGFloat = 60
        static let titleFontSize: CGFloat = 24
        static let subtitleFontSize: CGFloat = 18
        static let timeFontSize: CGFloat = 14
        static let verticalSpacing: CGFloat = 16  // Reduced vertical spacing
    }
    
    // MARK: - Initialization
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        backgroundColor = .clear
        
        // Content view - no scrolling, all content fixed position
        contentView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(contentView)
        
        setupCloseButton()
        setupArtwork()
        setupLabels()
        setupSeekControls()
        setupPlaybackControls()
        setupSecondaryControls()
        setupLoadingIndicator()
        setupConstraints()
    }
    
    private func setupCloseButton() {
        let config = UIImage.SymbolConfiguration(pointSize: 28, weight: .medium)
        closeButton.setImage(UIImage(systemName: "chevron.down", withConfiguration: config), for: .normal)
        closeButton.tintColor = .white
        closeButton.addTarget(self, action: #selector(handleClose), for: .touchUpInside)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.accessibilityLabel = "Sluiten"
        contentView.addSubview(closeButton)
    }
    
    private func setupArtwork() {
        artworkImageView.contentMode = .scaleAspectFill
        artworkImageView.clipsToBounds = true
        artworkImageView.layer.cornerRadius = 16
        artworkImageView.backgroundColor = UIColor.white.withAlphaComponent(0.2)
        artworkImageView.translatesAutoresizingMaskIntoConstraints = false
        
        // Add shadow
        artworkImageView.layer.shadowColor = UIColor.black.cgColor
        artworkImageView.layer.shadowOffset = CGSize(width: 0, height: 8)
        artworkImageView.layer.shadowRadius = 16
        artworkImageView.layer.shadowOpacity = 0.3
        
        contentView.addSubview(artworkImageView)
    }
    
    private func setupLabels() {
        titleLabel.font = .systemFont(ofSize: Layout.titleFontSize, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 2
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(titleLabel)
        
        subtitleLabel.font = .systemFont(ofSize: Layout.subtitleFontSize, weight: .regular)
        subtitleLabel.textColor = UIColor.white.withAlphaComponent(0.8)
        subtitleLabel.textAlignment = .center
        subtitleLabel.numberOfLines = 1
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(subtitleLabel)
    }
    
    private func setupSeekControls() {
        seekContainer.translatesAutoresizingMaskIntoConstraints = false
        seekContainer.isHidden = true
        contentView.addSubview(seekContainer)
        
        seekSlider.minimumTrackTintColor = .white
        seekSlider.maximumTrackTintColor = UIColor.white.withAlphaComponent(0.3)
        seekSlider.addTarget(self, action: #selector(handleSeekChange), for: .valueChanged)
        seekSlider.translatesAutoresizingMaskIntoConstraints = false
        seekContainer.addSubview(seekSlider)
        
        currentTimeLabel.font = .monospacedDigitSystemFont(ofSize: Layout.timeFontSize, weight: .medium)
        currentTimeLabel.textColor = UIColor.white.withAlphaComponent(0.8)
        currentTimeLabel.text = "0:00"
        currentTimeLabel.translatesAutoresizingMaskIntoConstraints = false
        seekContainer.addSubview(currentTimeLabel)
        
        durationLabel.font = .monospacedDigitSystemFont(ofSize: Layout.timeFontSize, weight: .medium)
        durationLabel.textColor = UIColor.white.withAlphaComponent(0.8)
        durationLabel.text = "0:00"
        durationLabel.textAlignment = .right
        durationLabel.translatesAutoresizingMaskIntoConstraints = false
        seekContainer.addSubview(durationLabel)
    }
    
    private func setupPlaybackControls() {
        let primaryConfig = UIImage.SymbolConfiguration(pointSize: 32, weight: .medium)
        let secondaryConfig = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
        
        // Skip backward
        skipBackwardButton.setImage(UIImage(systemName: "gobackward.10", withConfiguration: secondaryConfig), for: .normal)
        skipBackwardButton.tintColor = .white
        skipBackwardButton.addTarget(self, action: #selector(handleSkipBackward), for: .touchUpInside)
        skipBackwardButton.translatesAutoresizingMaskIntoConstraints = false
        skipBackwardButton.accessibilityLabel = "10 seconden terug"
        skipBackwardButton.isHidden = true
        contentView.addSubview(skipBackwardButton)
        
        // Play/Pause
        playPauseButton.setImage(UIImage(systemName: "play.fill", withConfiguration: primaryConfig), for: .normal)
        playPauseButton.tintColor = .white
        playPauseButton.backgroundColor = UIColor.white.withAlphaComponent(0.2)
        playPauseButton.layer.cornerRadius = Layout.primaryButtonSize / 2
        playPauseButton.addTarget(self, action: #selector(handlePlayPause), for: .touchUpInside)
        playPauseButton.translatesAutoresizingMaskIntoConstraints = false
        playPauseButton.accessibilityLabel = "Afspelen"
        contentView.addSubview(playPauseButton)
        
        // Skip forward
        skipForwardButton.setImage(UIImage(systemName: "goforward.30", withConfiguration: secondaryConfig), for: .normal)
        skipForwardButton.tintColor = .white
        skipForwardButton.addTarget(self, action: #selector(handleSkipForward), for: .touchUpInside)
        skipForwardButton.translatesAutoresizingMaskIntoConstraints = false
        skipForwardButton.accessibilityLabel = "30 seconden vooruit"
        skipForwardButton.isHidden = true
        contentView.addSubview(skipForwardButton)
        
        // Stop button
        stopButton.setImage(UIImage(systemName: "stop.fill", withConfiguration: secondaryConfig), for: .normal)
        stopButton.tintColor = .white
        stopButton.addTarget(self, action: #selector(handleStop), for: .touchUpInside)
        stopButton.translatesAutoresizingMaskIntoConstraints = false
        stopButton.accessibilityLabel = "Stoppen"
        contentView.addSubview(stopButton)
    }
    
    private func setupSecondaryControls() {
        // Speed control
        speedButton.setTitle("1×", for: .normal)
        speedButton.titleLabel?.font = .systemFont(ofSize: 18, weight: .semibold)
        speedButton.setTitleColor(.white, for: .normal)
        speedButton.addTarget(self, action: #selector(handleSpeedTap), for: .touchUpInside)
        speedButton.translatesAutoresizingMaskIntoConstraints = false
        speedButton.accessibilityLabel = "Afspeelsnelheid"
        speedButton.isHidden = true
        contentView.addSubview(speedButton)
        
        // Sleep timer - starts with outline moon (white), filled moon (yellow) when active
        let sleepConfig = UIImage.SymbolConfiguration(pointSize: 22, weight: .medium)
        sleepButton.setImage(UIImage(systemName: "moon", withConfiguration: sleepConfig), for: .normal)
        sleepButton.tintColor = .white
        sleepButton.addTarget(self, action: #selector(handleSleepTap), for: .touchUpInside)
        sleepButton.translatesAutoresizingMaskIntoConstraints = false
        sleepButton.accessibilityLabel = "Slaaptimer uit"
        contentView.addSubview(sleepButton)
        
        // Favorite
        let favoriteConfig = UIImage.SymbolConfiguration(pointSize: 22, weight: .medium)
        favoriteButton.setImage(UIImage(systemName: "heart", withConfiguration: favoriteConfig), for: .normal)
        favoriteButton.tintColor = .white
        favoriteButton.addTarget(self, action: #selector(handleFavoriteTap), for: .touchUpInside)
        favoriteButton.translatesAutoresizingMaskIntoConstraints = false
        favoriteButton.accessibilityLabel = "Favoriet"
        contentView.addSubview(favoriteButton)
    }
    
    private func setupLoadingIndicator() {
        loadingIndicator.color = .white
        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        loadingIndicator.hidesWhenStopped = true
        contentView.addSubview(loadingIndicator)
    }
    
    private func setupConstraints() {
        NSLayoutConstraint.activate([
            // Content view fills the entire view - no scrolling
            contentView.topAnchor.constraint(equalTo: topAnchor),
            contentView.leadingAnchor.constraint(equalTo: leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: bottomAnchor),
            
            // Close button - directly at top of content (window already handles safe area positioning)
            closeButton.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            closeButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: Layout.padding),
            closeButton.widthAnchor.constraint(equalToConstant: Layout.closeButtonSize),
            closeButton.heightAnchor.constraint(equalToConstant: Layout.closeButtonSize),
            
            // Artwork - closer to close button for compact layout
            artworkImageView.topAnchor.constraint(equalTo: closeButton.bottomAnchor, constant: Layout.verticalSpacing),
            artworkImageView.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            artworkImageView.widthAnchor.constraint(equalToConstant: Layout.artworkSize),
            artworkImageView.heightAnchor.constraint(equalToConstant: Layout.artworkSize),
            
            // Title - closer to artwork
            titleLabel.topAnchor.constraint(equalTo: artworkImageView.bottomAnchor, constant: Layout.verticalSpacing),
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: Layout.padding),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -Layout.padding),
            
            // Subtitle
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            
            // Seek container - reduced spacing
            seekContainer.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: Layout.verticalSpacing),
            seekContainer.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: Layout.padding),
            seekContainer.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -Layout.padding),
            seekContainer.heightAnchor.constraint(equalToConstant: 40),
            
            // Seek slider
            seekSlider.topAnchor.constraint(equalTo: seekContainer.topAnchor),
            seekSlider.leadingAnchor.constraint(equalTo: seekContainer.leadingAnchor),
            seekSlider.trailingAnchor.constraint(equalTo: seekContainer.trailingAnchor),
            
            // Time labels
            currentTimeLabel.topAnchor.constraint(equalTo: seekSlider.bottomAnchor, constant: 4),
            currentTimeLabel.leadingAnchor.constraint(equalTo: seekContainer.leadingAnchor),
            
            durationLabel.topAnchor.constraint(equalTo: currentTimeLabel.topAnchor),
            durationLabel.trailingAnchor.constraint(equalTo: seekContainer.trailingAnchor),
            
            // Playback controls - reduced spacing
            playPauseButton.topAnchor.constraint(equalTo: seekContainer.bottomAnchor, constant: Layout.verticalSpacing),
            playPauseButton.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            playPauseButton.widthAnchor.constraint(equalToConstant: Layout.primaryButtonSize),
            playPauseButton.heightAnchor.constraint(equalToConstant: Layout.primaryButtonSize),
            
            skipBackwardButton.centerYAnchor.constraint(equalTo: playPauseButton.centerYAnchor),
            skipBackwardButton.trailingAnchor.constraint(equalTo: playPauseButton.leadingAnchor, constant: -32),
            skipBackwardButton.widthAnchor.constraint(equalToConstant: Layout.secondaryButtonSize),
            skipBackwardButton.heightAnchor.constraint(equalToConstant: Layout.secondaryButtonSize),
            
            skipForwardButton.centerYAnchor.constraint(equalTo: playPauseButton.centerYAnchor),
            skipForwardButton.leadingAnchor.constraint(equalTo: playPauseButton.trailingAnchor, constant: 32),
            skipForwardButton.widthAnchor.constraint(equalToConstant: Layout.secondaryButtonSize),
            skipForwardButton.heightAnchor.constraint(equalToConstant: Layout.secondaryButtonSize),
            
            // Secondary controls row - spread horizontally
            // Layout: [Moon] ... [Stop] ... [Heart]
            // Stop button in CENTER of secondary row (not next to play button)
            stopButton.topAnchor.constraint(equalTo: playPauseButton.bottomAnchor, constant: Layout.verticalSpacing + 8),
            stopButton.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            stopButton.widthAnchor.constraint(equalToConstant: Layout.secondaryButtonSize),
            stopButton.heightAnchor.constraint(equalToConstant: Layout.secondaryButtonSize),
            
            // Sleep button (moon) on the left
            sleepButton.centerYAnchor.constraint(equalTo: stopButton.centerYAnchor),
            sleepButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: Layout.padding + 20),
            sleepButton.widthAnchor.constraint(equalToConstant: Layout.secondaryButtonSize),
            sleepButton.heightAnchor.constraint(equalToConstant: Layout.secondaryButtonSize),
            
            // Speed button hidden for radio (positioned but hidden)
            speedButton.centerYAnchor.constraint(equalTo: stopButton.centerYAnchor),
            speedButton.trailingAnchor.constraint(equalTo: stopButton.leadingAnchor, constant: -16),
            speedButton.widthAnchor.constraint(equalToConstant: Layout.secondaryButtonSize),
            speedButton.heightAnchor.constraint(equalToConstant: Layout.secondaryButtonSize),
            
            // Favorite button (heart) on the right
            favoriteButton.centerYAnchor.constraint(equalTo: stopButton.centerYAnchor),
            favoriteButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -(Layout.padding + 20)),
            favoriteButton.widthAnchor.constraint(equalToConstant: Layout.secondaryButtonSize),
            favoriteButton.heightAnchor.constraint(equalToConstant: Layout.secondaryButtonSize),
            
            // Loading indicator - centered on play button
            loadingIndicator.centerXAnchor.constraint(equalTo: playPauseButton.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: playPauseButton.centerYAnchor),
            
            // No bottom anchor needed - content is fixed, not scrolling
        ])
    }
    
    // MARK: - Actions
    
    @objc private func handleClose() {
        triggerHaptic()
        delegate?.fullPlayerDidTapClose()
    }
    
    @objc private func handlePlayPause() {
        triggerHaptic()
        delegate?.fullPlayerDidTapPlayPause()
    }
    
    @objc private func handleStop() {
        triggerHaptic()
        delegate?.fullPlayerDidTapStop()
    }
    
    @objc private func handleSeekChange() {
        delegate?.fullPlayerDidSeek(to: seekSlider.value)
    }
    
    @objc private func handleSkipBackward() {
        triggerHaptic(.light)
        delegate?.fullPlayerDidTapSkipBackward()
    }
    
    @objc private func handleSkipForward() {
        triggerHaptic(.light)
        delegate?.fullPlayerDidTapSkipForward()
    }
    
    @objc private func handleSpeedTap() {
        triggerHaptic(.light)
        // Cycle through speeds: 0.5, 0.75, 1.0, 1.25, 1.5, 2.0
        let speeds: [Float] = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
        if let currentIndex = speeds.firstIndex(of: currentSpeed) {
            let nextIndex = (currentIndex + 1) % speeds.count
            currentSpeed = speeds[nextIndex]
        } else {
            currentSpeed = 1.0
        }
        updateSpeedButton()
        delegate?.fullPlayerDidChangeSpeed(currentSpeed)
    }
    
    @objc private func handleSleepTap() {
        triggerHaptic(.light)
        showSleepTimerPicker()
    }
    
    private func showSleepTimerPicker() {
        // Create alert controller for sleep timer options
        let alertController = UIAlertController(
            title: "Slaaptimer",
            message: "Kies hoe lang de muziek moet spelen",
            preferredStyle: .actionSheet
        )
        
        // Add options - including 30 seconds for testing (TODO: remove before production)
        let options: [(title: String, minutes: Int?)] = [
            ("30 seconden (TEST)", 0),  // 0 = 30 seconds for testing
            ("15 minuten", 15),
            ("30 minuten", 30),
            ("45 minuten", 45),
            ("60 minuten", 60),
            ("Uit", nil)
        ]
        
        for option in options {
            let action = UIAlertAction(title: option.title, style: .default) { [weak self] _ in
                self?.sleepTimerMinutes = option.minutes
                self?.updateSleepButton()
                self?.delegate?.fullPlayerDidSetSleepTimer(option.minutes)
            }
            
            // Checkmark for current selection
            if option.minutes == sleepTimerMinutes {
                action.setValue(true, forKey: "checked")
            }
            
            alertController.addAction(action)
        }
        
        // Cancel action
        let cancelAction = UIAlertAction(title: "Annuleren", style: .cancel)
        alertController.addAction(cancelAction)
        
        // Present from the window's root view controller
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            // For iPad, configure popover
            if let popover = alertController.popoverPresentationController {
                popover.sourceView = sleepButton
                popover.sourceRect = sleepButton.bounds
            }
            rootVC.present(alertController, animated: true)
        }
    }
    
    @objc private func handleFavoriteTap() {
        triggerHaptic()
        delegate?.fullPlayerDidTapFavorite()
    }
    
    private func triggerHaptic(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        let impact = UIImpactFeedbackGenerator(style: style)
        impact.impactOccurred()
    }
    
    // MARK: - Public Methods
    
    func configure(controls: NSDictionary) {
        showSeekSlider = controls["seekSlider"] as? Bool ?? false
        showSkipButtons = controls["skipButtons"] as? Bool ?? false
        showSpeedControl = controls["speedControl"] as? Bool ?? false
        showSleepTimer = controls["sleepTimer"] as? Bool ?? true
        showFavorite = controls["favorite"] as? Bool ?? true
        showStopButton = controls["stopButton"] as? Bool ?? true
        
        // Update visibility
        seekContainer.isHidden = !showSeekSlider
        skipBackwardButton.isHidden = !showSkipButtons
        skipForwardButton.isHidden = !showSkipButtons
        speedButton.isHidden = !showSpeedControl
        sleepButton.isHidden = !showSleepTimer
        favoriteButton.isHidden = !showFavorite
        stopButton.isHidden = !showStopButton
    }
    
    func updateContent(title: String, subtitle: String?, artworkURL: String?) {
        titleLabel.text = title
        subtitleLabel.text = subtitle
        subtitleLabel.isHidden = subtitle == nil
        
        if let urlString = artworkURL, let url = URL(string: urlString) {
            loadImage(from: url)
        } else {
            artworkImageView.image = nil
        }
    }
    
    func updatePlaybackState(isPlaying: Bool, isLoading: Bool, isBuffering: Bool, position: Float?, duration: Float?, isFavorite: Bool) {
        self.isPlaying = isPlaying
        self.isLoading = isLoading
        self.isBuffering = isBuffering
        self.isFavorite = isFavorite
        
        // Update loading indicator
        if isLoading {
            loadingIndicator.startAnimating()
            playPauseButton.alpha = 0.5
        } else {
            loadingIndicator.stopAnimating()
            playPauseButton.alpha = 1.0
        }
        
        // Update play/pause icon
        let config = UIImage.SymbolConfiguration(pointSize: 32, weight: .medium)
        let iconName = isPlaying ? "pause.fill" : "play.fill"
        playPauseButton.setImage(UIImage(systemName: iconName, withConfiguration: config), for: .normal)
        playPauseButton.accessibilityLabel = isPlaying ? "Pauzeren" : "Afspelen"
        
        // Update buffering state on artwork
        updateBufferingState()
        
        // Update seek slider
        if let position = position, let duration = duration, duration > 0 {
            seekSlider.value = position / duration
            currentTimeLabel.text = formatTime(position)
            durationLabel.text = formatTime(duration)
        }
        
        // Update favorite
        let favConfig = UIImage.SymbolConfiguration(pointSize: 22, weight: .medium)
        let favIcon = isFavorite ? "heart.fill" : "heart"
        favoriteButton.setImage(UIImage(systemName: favIcon, withConfiguration: favConfig), for: .normal)
        favoriteButton.tintColor = isFavorite ? .systemPink : .white
    }
    
    func updateTintColor(_ hexColor: String) {
        if let color = UIColor.fromHex(hexColor) {
            seekSlider.minimumTrackTintColor = color
            playPauseButton.backgroundColor = color.withAlphaComponent(0.3)
        }
    }
    
    /// Reset sleep timer state (called when player is hidden or new content starts)
    func resetSleepTimer() {
        sleepTimerMinutes = nil
        updateSleepButton()
    }
    
    // MARK: - Helper Methods
    
    private func updateSpeedButton() {
        if currentSpeed == 1.0 {
            speedButton.setTitle("1×", for: .normal)
        } else if currentSpeed == floor(currentSpeed) {
            speedButton.setTitle("\(Int(currentSpeed))×", for: .normal)
        } else {
            speedButton.setTitle(String(format: "%.2g×", currentSpeed), for: .normal)
        }
    }
    
    private func updateSleepButton() {
        let config = UIImage.SymbolConfiguration(pointSize: 22, weight: .medium)
        if let minutes = sleepTimerMinutes {
            sleepButton.setImage(UIImage(systemName: "moon.fill", withConfiguration: config), for: .normal)
            sleepButton.tintColor = .systemYellow
            sleepButton.accessibilityLabel = "Slaaptimer: \(minutes) minuten"
        } else {
            sleepButton.setImage(UIImage(systemName: "moon", withConfiguration: config), for: .normal)
            sleepButton.tintColor = .white
            sleepButton.accessibilityLabel = "Slaaptimer uit"
        }
    }
    
    private func formatTime(_ seconds: Float) -> String {
        let totalSeconds = Int(seconds)
        let minutes = totalSeconds / 60
        let secs = totalSeconds % 60
        return String(format: "%d:%02d", minutes, secs)
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
    
    private func loadImage(from url: URL) {
        URLSession.shared.dataTask(with: url) { [weak self] data, _, error in
            guard let data = data, error == nil,
                  let image = UIImage(data: data) else {
                return
            }
            
            DispatchQueue.main.async {
                self?.artworkImageView.image = image
            }
        }.resume()
    }
}
