/**
 * FullPlayerNativeView — Native iOS full player UI for Liquid Glass window
 *
 * Layout (full screen):
 * ┌────────────────────────────────────────────────────────────────┐
 * │  Safe Area                                                     │
 * │  [˅] Close                                    [AirPlay]  60pt  │
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
 * │              ⏪    ▶/⏸    ⏩         60pt buttons               │
 * │                                                                │
 * │         [1x] [Sleep] [❤️]            Secondary controls        │
 * │                                                                │
 * └────────────────────────────────────────────────────────────────┘
 *
 * Senior-inclusive design:
 * - ALL buttons uniform 60pt (touchTargets.minimum)
 * - cornerRadius 12pt (rounded square, NOT circular)
 * - Typography ≥18pt body, ≥24pt headings
 *
 * @see .claude/plans/LIQUID_GLASS_PLAYER_WINDOW.md
 */

import UIKit
import AVKit

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
    func fullPlayerDidTapShuffle()
    func fullPlayerDidTapRepeat()
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
    private let artworkPlaceholderIcon = UIImageView()
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
    private let secondaryControlsStack = UIStackView()
    private let shuffleButton = UIButton(type: .system)
    private let speedButton = UIButton(type: .system)
    private let sleepButton = UIButton(type: .system)
    private let favoriteButton = UIButton(type: .system)
    private let repeatButton = UIButton(type: .system)
    
    // AirPlay route picker (top-right, aligned with close button)
    private let airPlayContainer = UIView()
    private let airPlayRoutePicker = AVRoutePickerView()
    
    // AirPlay route detection (disabled state when no external devices)
    private let airPlayRouteDetector = AVRouteDetector()
    private var airPlayRouteObservation: NSKeyValueObservation?
    private var isAirPlayActive: Bool = false
    
    // Loading indicator (overlay on play button)
    private let loadingIndicator = UIActivityIndicatorView(style: .medium)
    
    // State
    private var isPlaying: Bool = false
    private var isLoading: Bool = false
    private var isBuffering: Bool = false
    private var isFavorite: Bool = false
    private var currentSpeed: Float = 1.0
    private var sleepTimerMinutes: Int? = nil
    private var shuffleMode: String = "off"  // "off" | "songs"
    private var repeatMode: String = "off"   // "off" | "one" | "all"
    private var currentDuration: Double = 0  // Duration in seconds for seek calculations
    private var isSeeking: Bool = false      // Prevents slider updates while user is dragging
    
    // Configuration
    private var showSeekSlider: Bool = false
    private var showSkipButtons: Bool = false
    private var showSpeedControl: Bool = false
    private var showSleepTimer: Bool = true
    private var showFavorite: Bool = true
    private var showStopButton: Bool = true
    private var showShuffle: Bool = false
    private var showRepeat: Bool = false
    
    // Button border styling (user configurable)
    private var buttonBorderEnabled: Bool = false
    private var buttonBorderColor: UIColor = .white
    
    // MARK: - Constants
    
    private enum Layout {
        static let padding: CGFloat = 20
        static let artworkSize: CGFloat = 200  // Smaller artwork for more compact player
        static let buttonSize: CGFloat = 60    // ALL buttons uniform 60pt (senior-inclusive minimum)
        static let secondaryButtonSize: CGFloat = 48  // Secondary controls: smaller to fit 5 buttons
        static let buttonCornerRadius: CGFloat = 12  // Rounded square (NOT circular!)
        static let secondaryCornerRadius: CGFloat = 10  // Slightly smaller for secondary buttons
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
    
    deinit {
        airPlayRouteObservation?.invalidate()
        airPlayRouteDetector.isRouteDetectionEnabled = false
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        backgroundColor = .clear
        
        // Content view - no scrolling, all content fixed position
        contentView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(contentView)
        
        setupCloseButton()
        setupAirPlayButton()
        setupArtwork()
        setupLabels()
        setupSeekControls()
        setupPlaybackControls()
        setupSecondaryControls()
        setupLoadingIndicator()
        setupConstraints()
    }
    
    private func setupCloseButton() {
        // Standard button styling: 60pt, rgba background, 12pt cornerRadius
        let config = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
        closeButton.setImage(UIImage(systemName: "chevron.down", withConfiguration: config), for: .normal)
        closeButton.tintColor = .white
        closeButton.backgroundColor = UIColor.white.withAlphaComponent(0.15)
        closeButton.layer.cornerRadius = Layout.buttonCornerRadius
        closeButton.clipsToBounds = true
        closeButton.addTarget(self, action: #selector(handleClose), for: .touchUpInside)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.accessibilityLabel = "Sluiten"
        contentView.addSubview(closeButton)
    }
    
    private func setupAirPlayButton() {
        // Container with standard button styling: 60pt, rgba background, 12pt cornerRadius
        airPlayContainer.backgroundColor = UIColor.white.withAlphaComponent(0.15)
        airPlayContainer.layer.cornerRadius = Layout.buttonCornerRadius
        airPlayContainer.clipsToBounds = true
        airPlayContainer.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(airPlayContainer)
        
        // AVRoutePickerView inside the container
        airPlayRoutePicker.tintColor = .white
        airPlayRoutePicker.activeTintColor = .systemBlue
        airPlayRoutePicker.prioritizesVideoDevices = false
        airPlayRoutePicker.translatesAutoresizingMaskIntoConstraints = false
        airPlayContainer.addSubview(airPlayRoutePicker)
        
        airPlayContainer.accessibilityLabel = "AirPlay"
        
        // Delegate for haptic feedback + temporary key window (iOS 26.3 workaround)
        airPlayRoutePicker.delegate = self
        
        // Route detection: disable button when no external AirPlay devices available
        airPlayRouteDetector.isRouteDetectionEnabled = true
        airPlayRouteObservation = airPlayRouteDetector.observe(
            \.multipleRoutesDetected,
            options: [.new, .initial]
        ) { [weak self] detector, _ in
            DispatchQueue.main.async {
                self?.updateAirPlayAvailability(detector.multipleRoutesDetected)
            }
        }
        
        // Listen for audio route changes to detect AirPlay active state
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAudioRouteChange),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
        // Check initial AirPlay state
        updateAirPlayActiveState()
    }
    
    /// Update AirPlay button appearance based on route availability
    private func updateAirPlayAvailability(_ routesAvailable: Bool) {
        if routesAvailable {
            // External AirPlay devices available — enable button
            airPlayContainer.alpha = 1.0
            airPlayContainer.isUserInteractionEnabled = true
            airPlayContainer.accessibilityLabel = "AirPlay"
            airPlayContainer.accessibilityTraits.remove(.notEnabled)
        } else {
            // No external devices — disable (greyed out, not tappable)
            airPlayContainer.alpha = 0.35
            airPlayContainer.isUserInteractionEnabled = false
            airPlayContainer.accessibilityLabel = "AirPlay niet beschikbaar"
            airPlayContainer.accessibilityTraits.insert(.notEnabled)
        }
    }
    
    // MARK: - AirPlay Active State Detection
    
    @objc private func handleAudioRouteChange(_ notification: Notification) {
        updateAirPlayActiveState()
    }
    
    private func updateAirPlayActiveState() {
        let session = AVAudioSession.sharedInstance()
        let airPlayActive = session.currentRoute.outputs.contains { output in
            output.portType == .airPlay
        }
        
        guard airPlayActive != isAirPlayActive else { return }
        isAirPlayActive = airPlayActive
        
        if airPlayActive {
            startAirPlayPulseAnimation()
            airPlayContainer.accessibilityLabel = "AirPlay actief"
        } else {
            stopAirPlayPulseAnimation()
            airPlayContainer.accessibilityLabel = "AirPlay"
        }
    }
    
    private func startAirPlayPulseAnimation() {
        // Combo C+D: deep opacity fade + scale pulse for clear AirPlay active indicator
        let opacityPulse = CABasicAnimation(keyPath: "opacity")
        opacityPulse.fromValue = 1.0
        opacityPulse.toValue = 0.2
        opacityPulse.duration = 0.8
        opacityPulse.autoreverses = true
        opacityPulse.repeatCount = .infinity
        opacityPulse.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        
        let scalePulse = CABasicAnimation(keyPath: "transform.scale")
        scalePulse.fromValue = 1.0
        scalePulse.toValue = 1.08
        scalePulse.duration = 0.8
        scalePulse.autoreverses = true
        scalePulse.repeatCount = .infinity
        scalePulse.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        
        let group = CAAnimationGroup()
        group.animations = [opacityPulse, scalePulse]
        group.duration = 0.8
        group.autoreverses = true
        group.repeatCount = .infinity
        
        airPlayContainer.layer.add(group, forKey: "airPlayPulse")
    }
    
    private func stopAirPlayPulseAnimation() {
        airPlayContainer.layer.removeAnimation(forKey: "airPlayPulse")
        airPlayContainer.layer.opacity = 1.0
        airPlayContainer.layer.transform = CATransform3DIdentity
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

        // Artwork placeholder icon (SF Symbol, shown when no artwork available)
        let placeholderConfig = UIImage.SymbolConfiguration(pointSize: 64, weight: .medium)
        artworkPlaceholderIcon.image = UIImage(systemName: "radio", withConfiguration: placeholderConfig)
        artworkPlaceholderIcon.tintColor = UIColor.white.withAlphaComponent(0.8)
        artworkPlaceholderIcon.contentMode = .center
        artworkPlaceholderIcon.translatesAutoresizingMaskIntoConstraints = false
        artworkPlaceholderIcon.isHidden = false  // Visible by default until artwork loads
        artworkImageView.addSubview(artworkPlaceholderIcon)

        NSLayoutConstraint.activate([
            artworkPlaceholderIcon.centerXAnchor.constraint(equalTo: artworkImageView.centerXAnchor),
            artworkPlaceholderIcon.centerYAnchor.constraint(equalTo: artworkImageView.centerYAnchor),
        ])
    }
    
    private func setupLabels() {
        // Title label - ensure it has proper height
        titleLabel.font = .systemFont(ofSize: Layout.titleFontSize, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 2  // Allow 2 lines for long titles
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.adjustsFontSizeToFitWidth = false
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.setContentHuggingPriority(.required, for: .vertical)
        titleLabel.setContentCompressionResistancePriority(.required, for: .vertical)
        // Add subtle shadow for better visibility on glass
        titleLabel.layer.shadowColor = UIColor.black.cgColor
        titleLabel.layer.shadowOffset = CGSize(width: 0, height: 1)
        titleLabel.layer.shadowRadius = 2
        titleLabel.layer.shadowOpacity = 0.5
        contentView.addSubview(titleLabel)

        // Subtitle label
        subtitleLabel.font = .systemFont(ofSize: Layout.subtitleFontSize, weight: .regular)
        subtitleLabel.textColor = UIColor.white.withAlphaComponent(0.9)  // Slightly brighter
        subtitleLabel.textAlignment = .center
        subtitleLabel.numberOfLines = 1
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.setContentHuggingPriority(.required, for: .vertical)
        subtitleLabel.setContentCompressionResistancePriority(.required, for: .vertical)
        // Add subtle shadow for better visibility on glass
        subtitleLabel.layer.shadowColor = UIColor.black.cgColor
        subtitleLabel.layer.shadowOffset = CGSize(width: 0, height: 1)
        subtitleLabel.layer.shadowRadius = 2
        subtitleLabel.layer.shadowOpacity = 0.3
        contentView.addSubview(subtitleLabel)
    }
    
    private func setupSeekControls() {
        seekContainer.translatesAutoresizingMaskIntoConstraints = false
        seekContainer.isHidden = true
        contentView.addSubview(seekContainer)
        
        seekSlider.minimumTrackTintColor = .white
        seekSlider.maximumTrackTintColor = UIColor.white.withAlphaComponent(0.3)
        seekSlider.minimumValue = 0
        seekSlider.maximumValue = 1
        seekSlider.isContinuous = true  // Update while dragging
        seekSlider.addTarget(self, action: #selector(handleSeekChange), for: .valueChanged)
        seekSlider.addTarget(self, action: #selector(handleSeekTouchDown), for: .touchDown)
        seekSlider.addTarget(self, action: #selector(handleSeekTouchUp), for: [.touchUpInside, .touchUpOutside])
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
        skipBackwardButton.backgroundColor = UIColor.white.withAlphaComponent(0.15)
        skipBackwardButton.layer.cornerRadius = Layout.buttonCornerRadius
        skipBackwardButton.clipsToBounds = true
        skipBackwardButton.addTarget(self, action: #selector(handleSkipBackward), for: .touchUpInside)
        skipBackwardButton.translatesAutoresizingMaskIntoConstraints = false
        skipBackwardButton.accessibilityLabel = "10 seconden terug"
        skipBackwardButton.isHidden = true
        contentView.addSubview(skipBackwardButton)
        
        // Play/Pause - subtle white background, consistent with other controls (no accent color)
        playPauseButton.setImage(UIImage(systemName: "play.fill", withConfiguration: primaryConfig), for: .normal)
        playPauseButton.tintColor = .white
        playPauseButton.backgroundColor = UIColor.white.withAlphaComponent(0.15)  // Subtle, consistent with other buttons
        playPauseButton.layer.cornerRadius = Layout.buttonCornerRadius
        playPauseButton.clipsToBounds = true
        playPauseButton.addTarget(self, action: #selector(handlePlayPause), for: .touchUpInside)
        playPauseButton.translatesAutoresizingMaskIntoConstraints = false
        playPauseButton.accessibilityLabel = "Afspelen"
        contentView.addSubview(playPauseButton)
        
        // Skip forward
        skipForwardButton.setImage(UIImage(systemName: "goforward.30", withConfiguration: secondaryConfig), for: .normal)
        skipForwardButton.tintColor = .white
        skipForwardButton.backgroundColor = UIColor.white.withAlphaComponent(0.15)
        skipForwardButton.layer.cornerRadius = Layout.buttonCornerRadius
        skipForwardButton.clipsToBounds = true
        skipForwardButton.addTarget(self, action: #selector(handleSkipForward), for: .touchUpInside)
        skipForwardButton.translatesAutoresizingMaskIntoConstraints = false
        skipForwardButton.accessibilityLabel = "30 seconden vooruit"
        skipForwardButton.isHidden = true
        contentView.addSubview(skipForwardButton)
        
        // Stop button — uses 20pt icon consistent with all secondary-row buttons
        let stopIconConfig = UIImage.SymbolConfiguration(pointSize: 20, weight: .medium)
        stopButton.setImage(UIImage(systemName: "stop.fill", withConfiguration: stopIconConfig), for: .normal)
        stopButton.tintColor = .white
        stopButton.backgroundColor = UIColor.white.withAlphaComponent(0.15)
        stopButton.layer.cornerRadius = Layout.buttonCornerRadius
        stopButton.clipsToBounds = true
        stopButton.addTarget(self, action: #selector(handleStop), for: .touchUpInside)
        stopButton.translatesAutoresizingMaskIntoConstraints = false
        stopButton.accessibilityLabel = "Stoppen"
        contentView.addSubview(stopButton)
    }
    
    private func setupSecondaryControls() {
        let iconConfig = UIImage.SymbolConfiguration(pointSize: 20, weight: .medium)
        let btnSize = Layout.secondaryButtonSize
        let btnRadius = Layout.secondaryCornerRadius

        // UIStackView for automatic equal spacing — prevents overlapping on narrow screens
        secondaryControlsStack.axis = .horizontal
        secondaryControlsStack.distribution = .equalSpacing
        secondaryControlsStack.alignment = .center
        secondaryControlsStack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(secondaryControlsStack)

        // Helper to configure secondary buttons consistently
        func configureSecondary(_ button: UIButton, icon: String? = nil, title: String? = nil, label: String, hidden: Bool = false) {
            if let icon = icon {
                button.setImage(UIImage(systemName: icon, withConfiguration: iconConfig), for: .normal)
            }
            if let title = title {
                button.setTitle(title, for: .normal)
                button.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
                button.setTitleColor(.white, for: .normal)
            }
            button.tintColor = .white
            button.backgroundColor = UIColor.white.withAlphaComponent(0.15)
            button.layer.cornerRadius = btnRadius
            button.clipsToBounds = true
            button.translatesAutoresizingMaskIntoConstraints = false
            button.accessibilityLabel = label
            button.isHidden = hidden
            // Fixed size constraints for secondary buttons
            button.widthAnchor.constraint(equalToConstant: btnSize).isActive = true
            button.heightAnchor.constraint(equalToConstant: btnSize).isActive = true
        }

        // Shuffle button
        configureSecondary(shuffleButton, icon: "shuffle", label: "Willekeurig uit", hidden: true)
        shuffleButton.addTarget(self, action: #selector(handleShuffleTap), for: .touchUpInside)
        secondaryControlsStack.addArrangedSubview(shuffleButton)

        // Speed control
        configureSecondary(speedButton, title: "1×", label: "Afspeelsnelheid", hidden: true)
        speedButton.addTarget(self, action: #selector(handleSpeedTap), for: .touchUpInside)
        secondaryControlsStack.addArrangedSubview(speedButton)

        // Sleep timer
        configureSecondary(sleepButton, icon: "moon", label: "Slaaptimer uit")
        sleepButton.addTarget(self, action: #selector(handleSleepTap), for: .touchUpInside)
        secondaryControlsStack.addArrangedSubview(sleepButton)

        // Stop button — moved into secondary stack for proper spacing
        // Re-add stop button to stack (remove from contentView first)
        stopButton.removeFromSuperview()
        stopButton.widthAnchor.constraint(equalToConstant: btnSize).isActive = true
        stopButton.heightAnchor.constraint(equalToConstant: btnSize).isActive = true
        stopButton.layer.cornerRadius = btnRadius
        secondaryControlsStack.addArrangedSubview(stopButton)

        // Favorite
        configureSecondary(favoriteButton, icon: "heart", label: "Favoriet")
        favoriteButton.addTarget(self, action: #selector(handleFavoriteTap), for: .touchUpInside)
        secondaryControlsStack.addArrangedSubview(favoriteButton)

        // Repeat button
        configureSecondary(repeatButton, icon: "repeat", label: "Herhalen uit", hidden: true)
        repeatButton.addTarget(self, action: #selector(handleRepeatTap), for: .touchUpInside)
        secondaryControlsStack.addArrangedSubview(repeatButton)
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
            closeButton.widthAnchor.constraint(equalToConstant: Layout.buttonSize),
            closeButton.heightAnchor.constraint(equalToConstant: Layout.buttonSize),
            
            // AirPlay button - top-right, aligned with close button
            airPlayContainer.topAnchor.constraint(equalTo: closeButton.topAnchor),
            airPlayContainer.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -Layout.padding),
            airPlayContainer.widthAnchor.constraint(equalToConstant: Layout.buttonSize),
            airPlayContainer.heightAnchor.constraint(equalToConstant: Layout.buttonSize),
            
            // AVRoutePickerView fills its container
            airPlayRoutePicker.centerXAnchor.constraint(equalTo: airPlayContainer.centerXAnchor),
            airPlayRoutePicker.centerYAnchor.constraint(equalTo: airPlayContainer.centerYAnchor),
            airPlayRoutePicker.widthAnchor.constraint(equalToConstant: 44),
            airPlayRoutePicker.heightAnchor.constraint(equalToConstant: 44),
            
            // Artwork - 32pt below close/AirPlay buttons (extra margin for AirPlay pulse scale animation)
            artworkImageView.topAnchor.constraint(equalTo: closeButton.bottomAnchor, constant: 32),
            artworkImageView.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            artworkImageView.widthAnchor.constraint(equalToConstant: Layout.artworkSize),
            artworkImageView.heightAnchor.constraint(equalToConstant: Layout.artworkSize),
            
            // Title - with breathing room above and below, explicit height
            titleLabel.topAnchor.constraint(equalTo: artworkImageView.bottomAnchor, constant: Layout.verticalSpacing + 8),
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: Layout.padding),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -Layout.padding),
            titleLabel.heightAnchor.constraint(greaterThanOrEqualToConstant: 30),  // Ensure minimum height

            // Subtitle - more spacing between title and subtitle, explicit height
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            subtitleLabel.heightAnchor.constraint(greaterThanOrEqualToConstant: 24),  // Ensure minimum height
            subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),

            // Seek container - good spacing below subtitle
            seekContainer.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: Layout.verticalSpacing + 8),
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
            playPauseButton.widthAnchor.constraint(equalToConstant: Layout.buttonSize),
            playPauseButton.heightAnchor.constraint(equalToConstant: Layout.buttonSize),
            
            skipBackwardButton.centerYAnchor.constraint(equalTo: playPauseButton.centerYAnchor),
            skipBackwardButton.trailingAnchor.constraint(equalTo: playPauseButton.leadingAnchor, constant: -32),
            skipBackwardButton.widthAnchor.constraint(equalToConstant: Layout.buttonSize),
            skipBackwardButton.heightAnchor.constraint(equalToConstant: Layout.buttonSize),
            
            skipForwardButton.centerYAnchor.constraint(equalTo: playPauseButton.centerYAnchor),
            skipForwardButton.leadingAnchor.constraint(equalTo: playPauseButton.trailingAnchor, constant: 32),
            skipForwardButton.widthAnchor.constraint(equalToConstant: Layout.buttonSize),
            skipForwardButton.heightAnchor.constraint(equalToConstant: Layout.buttonSize),
            
            // Secondary controls stack — UIStackView with .equalSpacing distribution
            // Automatically distributes visible buttons evenly across the available width
            secondaryControlsStack.topAnchor.constraint(equalTo: playPauseButton.bottomAnchor, constant: Layout.verticalSpacing + 8),
            secondaryControlsStack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: Layout.padding),
            secondaryControlsStack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -Layout.padding),
            secondaryControlsStack.heightAnchor.constraint(equalToConstant: Layout.secondaryButtonSize),
            
            // Loading indicator - centered on play button
            loadingIndicator.centerXAnchor.constraint(equalTo: playPauseButton.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: playPauseButton.centerYAnchor),
        ])
        
        // Bottom constraint for secondary controls stack - ensures proper spacing from bottom
        // Use lessThanOrEqualTo to prevent clipping on smaller screens
        secondaryControlsStack.bottomAnchor.constraint(lessThanOrEqualTo: contentView.bottomAnchor, constant: -Layout.padding).isActive = true
    }
    
    // MARK: - Actions
    
    @objc private func handleClose() {
        triggerHaptic()
        delegate?.fullPlayerDidTapClose()
    }
    
    @objc private func handlePlayPause() {
        triggerHaptic()

        // NO optimistic UI update - React Native is the single source of truth
        // The UI will update when RN calls updatePlaybackState with the new state

        delegate?.fullPlayerDidTapPlayPause()
    }
    
    @objc private func handleStop() {
        triggerHaptic()
        delegate?.fullPlayerDidTapStop()
    }
    
    @objc private func handleSeekTouchDown() {
        // Haptic feedback when starting to drag
        triggerHaptic(.light)
        isSeeking = true  // Block updates from updatePlaybackState while dragging
    }

    @objc private func handleSeekTouchUp() {
        // Haptic feedback when releasing slider
        triggerHaptic(.light)
        
        // Calculate final position and send seek event ONLY on release
        let positionInSeconds = Double(seekSlider.value) * currentDuration
        
        // Send seek event to React Native (only on release, not during drag)
        delegate?.fullPlayerDidSeek(to: Float(positionInSeconds))
        
        // Allow updates again AFTER sending seek
        isSeeking = false
    }

    @objc private func handleSeekChange() {
        // Only update local time label during drag - don't send seek events
        // The actual seek happens in handleSeekTouchUp
        let positionInSeconds = Double(seekSlider.value) * currentDuration
        
        // Update time label immediately for responsive feel (local only)
        currentTimeLabel.text = formatTime(Float(positionInSeconds))
        
        // DON'T send seek event here - it causes the "spring back" effect
        // because React Native immediately sends back the old position
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
        
        let options: [(title: String, minutes: Int?)] = [
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

    @objc private func handleShuffleTap() {
        triggerHaptic(.light)
        delegate?.fullPlayerDidTapShuffle()
    }

    @objc private func handleRepeatTap() {
        triggerHaptic(.light)
        delegate?.fullPlayerDidTapRepeat()
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
        showShuffle = controls["shuffle"] as? Bool ?? false
        showRepeat = controls["repeat"] as? Bool ?? false

        // Update visibility
        seekContainer.isHidden = !showSeekSlider
        skipBackwardButton.isHidden = !showSkipButtons
        skipForwardButton.isHidden = !showSkipButtons
        speedButton.isHidden = !showSpeedControl
        sleepButton.isHidden = !showSleepTimer
        favoriteButton.isHidden = !showFavorite
        stopButton.isHidden = !showStopButton
        shuffleButton.isHidden = !showShuffle
        repeatButton.isHidden = !showRepeat
    }
    
    func updateContent(title: String, subtitle: String?, artworkURL: String?) {
        // Ensure title is set and visible
        titleLabel.text = title
        titleLabel.isHidden = false
        titleLabel.alpha = 1.0
        
        // Set subtitle - always show it (even if nil, we still need the space)
        subtitleLabel.text = subtitle ?? ""
        subtitleLabel.isHidden = false
        subtitleLabel.alpha = subtitle != nil ? 1.0 : 0.0
        
        NSLog("[GlassPlayer] FullPlayer updateContent - artworkURL: \(artworkURL ?? "nil")")
        
        // Force layout update to ensure labels are properly positioned
        setNeedsLayout()
        layoutIfNeeded()
        
        if let urlString = artworkURL, !urlString.isEmpty, let url = URL(string: urlString) {
            NSLog("[GlassPlayer] FullPlayer updateContent - Loading artwork from: \(urlString)")
            loadImage(from: url)
        } else {
            NSLog("[GlassPlayer] FullPlayer updateContent - No artwork URL, showing placeholder")
            artworkImageView.image = nil
            artworkPlaceholderIcon.isHidden = false
        }
    }
    
    func updatePlaybackState(isPlaying: Bool, isLoading: Bool, isBuffering: Bool, position: Float?, duration: Float?, isFavorite: Bool) {
        let loadingStateChanged = self.isLoading != isLoading

        self.isPlaying = isPlaying
        self.isLoading = isLoading
        self.isBuffering = isBuffering
        self.isFavorite = isFavorite

        // Update loading indicator
        if loadingStateChanged {
            if isLoading {
                loadingIndicator.startAnimating()
                playPauseButton.alpha = 0.5
            } else {
                loadingIndicator.stopAnimating()
                playPauseButton.alpha = 1.0
            }
        }

        // ALWAYS update play/pause icon based on React Native state
        // React Native is the single source of truth
        let config = UIImage.SymbolConfiguration(pointSize: 32, weight: .medium)
        let iconName = isPlaying ? "pause.fill" : "play.fill"
        playPauseButton.setImage(UIImage(systemName: iconName, withConfiguration: config), for: .normal)
        playPauseButton.accessibilityLabel = isPlaying ? "Pauzeren" : "Afspelen"
        
        // Update buffering state on artwork
        updateBufferingState()
        
        // Update seek slider (but NOT while user is dragging)
        if let position = position, let duration = duration, duration > 0 {
            // Store duration for seek calculations
            currentDuration = Double(duration)

            // Only update slider if user is NOT currently dragging it
            if !isSeeking {
                let progress = position / duration
                seekSlider.value = Float(progress)
                currentTimeLabel.text = formatTime(position)
            }
            // Always update duration label
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
            // NOTE: Play button keeps subtle white background for consistency
            // Accent color is only used for progress/seek sliders and active states (favorite, shuffle, repeat)
        }
    }
    
    /// Configure button border styling (user setting)
    func configureButtonStyle(borderEnabled: Bool, borderColorHex: String) {
        buttonBorderEnabled = borderEnabled
        buttonBorderColor = UIColor.fromHex(borderColorHex) ?? .white
        
        let borderWidth: CGFloat = borderEnabled ? 2 : 0
        
        // Close button
        closeButton.layer.borderWidth = borderWidth
        closeButton.layer.borderColor = buttonBorderColor.cgColor
        
        // AirPlay button
        airPlayContainer.layer.borderWidth = borderWidth
        airPlayContainer.layer.borderColor = buttonBorderColor.cgColor
        
        // Play/Pause button
        playPauseButton.layer.borderWidth = borderWidth
        playPauseButton.layer.borderColor = buttonBorderColor.cgColor
        
        // Skip buttons
        skipBackwardButton.layer.borderWidth = borderWidth
        skipBackwardButton.layer.borderColor = buttonBorderColor.cgColor
        skipForwardButton.layer.borderWidth = borderWidth
        skipForwardButton.layer.borderColor = buttonBorderColor.cgColor
        
        // Stop button
        stopButton.layer.borderWidth = borderWidth
        stopButton.layer.borderColor = buttonBorderColor.cgColor
        
        // Secondary controls
        shuffleButton.layer.borderWidth = borderWidth
        shuffleButton.layer.borderColor = buttonBorderColor.cgColor
        speedButton.layer.borderWidth = borderWidth
        speedButton.layer.borderColor = buttonBorderColor.cgColor
        sleepButton.layer.borderWidth = borderWidth
        sleepButton.layer.borderColor = buttonBorderColor.cgColor
        favoriteButton.layer.borderWidth = borderWidth
        favoriteButton.layer.borderColor = buttonBorderColor.cgColor
        repeatButton.layer.borderWidth = borderWidth
        repeatButton.layer.borderColor = buttonBorderColor.cgColor
    }
    
    /// Reset sleep timer state (called when player is hidden or new content starts)
    func resetSleepTimer() {
        sleepTimerMinutes = nil
        updateSleepButton()
    }

    /// Update shuffle/repeat state from React Native
    func updateShuffleRepeatState(shuffleMode: String, repeatMode: String, tintColor: UIColor?) {
        self.shuffleMode = shuffleMode
        self.repeatMode = repeatMode
        updateShuffleButton(tintColor: tintColor)
        updateRepeatButton(tintColor: tintColor)
    }

    // MARK: - Helper Methods

    private func updateShuffleButton(tintColor: UIColor?) {
        let config = UIImage.SymbolConfiguration(pointSize: 22, weight: .medium)
        let isActive = shuffleMode == "songs"
        shuffleButton.setImage(UIImage(systemName: "shuffle", withConfiguration: config), for: .normal)
        shuffleButton.tintColor = isActive ? (tintColor ?? .systemBlue) : .white
        shuffleButton.accessibilityLabel = isActive ? "Willekeurig aan" : "Willekeurig uit"
    }

    private func updateRepeatButton(tintColor: UIColor?) {
        let config = UIImage.SymbolConfiguration(pointSize: 22, weight: .medium)
        let iconName: String
        let accessibilityLabel: String
        let isActive: Bool

        switch repeatMode {
        case "one":
            iconName = "repeat.1"
            accessibilityLabel = "Herhaal dit nummer"
            isActive = true
        case "all":
            iconName = "repeat"
            accessibilityLabel = "Herhaal alles"
            isActive = true
        default: // "off"
            iconName = "repeat"
            accessibilityLabel = "Herhalen uit"
            isActive = false
        }

        repeatButton.setImage(UIImage(systemName: iconName, withConfiguration: config), for: .normal)
        repeatButton.tintColor = isActive ? (tintColor ?? .systemBlue) : .white
        repeatButton.accessibilityLabel = accessibilityLabel
    }
    
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
        NSLog("[GlassPlayer] FullPlayer loadImage - URL: \(url.absoluteString)")

        var request = URLRequest(url: url)
        request.timeoutInterval = 10

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let error = error {
                NSLog("[GlassPlayer] FullPlayer loadImage - ERROR: \(error.localizedDescription)")
                DispatchQueue.main.async { self?.artworkPlaceholderIcon.isHidden = false }
                return
            }

            // Check HTTP response
            if let httpResponse = response as? HTTPURLResponse {
                NSLog("[GlassPlayer] FullPlayer loadImage - HTTP status: \(httpResponse.statusCode)")
                if httpResponse.statusCode != 200 {
                    DispatchQueue.main.async { self?.artworkPlaceholderIcon.isHidden = false }
                    return
                }
            }

            guard let data = data, !data.isEmpty else {
                NSLog("[GlassPlayer] FullPlayer loadImage - No data received")
                DispatchQueue.main.async { self?.artworkPlaceholderIcon.isHidden = false }
                return
            }

            guard let image = UIImage(data: data) else {
                NSLog("[GlassPlayer] FullPlayer loadImage - Failed to create image from data (size: \(data.count) bytes)")
                DispatchQueue.main.async { self?.artworkPlaceholderIcon.isHidden = false }
                return
            }

            NSLog("[GlassPlayer] FullPlayer loadImage - SUCCESS, image size: \(image.size)")

            DispatchQueue.main.async {
                self?.artworkImageView.image = image
                self?.artworkPlaceholderIcon.isHidden = true
            }
        }.resume()
    }
}

// MARK: - AVRoutePickerViewDelegate (AirPlay haptic + iOS 26.3 key window workaround)

@available(iOS 26.0, *)
extension FullPlayerNativeView: AVRoutePickerViewDelegate {
    
    func routePickerViewWillBeginPresentingRoutes(_ routePickerView: AVRoutePickerView) {
        NSLog("[GlassPlayer] AirPlay picker will begin presenting routes")
        triggerHaptic()
        
        // iOS 26.3 workaround: AVRoutePickerView cannot present its system sheet
        // from a non-key UIWindow. Temporarily make our window the key window so
        // the route picker sheet can present correctly.
        if let glassWindow = self.window {
            NSLog("[GlassPlayer] AirPlay: temporarily making GlassPlayerWindow key window")
            glassWindow.makeKey()
        }
    }
    
    func routePickerViewDidEndPresentingRoutes(_ routePickerView: AVRoutePickerView) {
        NSLog("[GlassPlayer] AirPlay picker did end presenting routes")
        
        // Restore React Native's key window status after the AirPlay picker closes.
        // Find the first non-GlassPlayer window and make it key again.
        if let scene = self.window?.windowScene {
            for window in scene.windows where window !== self.window {
                if !window.isHidden && window.alpha > 0.01 {
                    NSLog("[GlassPlayer] AirPlay: restoring key window to React Native")
                    window.makeKey()
                    break
                }
            }
        }
    }
}
