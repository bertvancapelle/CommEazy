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
    private let playPauseButton = UIButton(type: .system)
    private let stopButton = UIButton(type: .system)
    
    private var isPlaying: Bool = false
    private var showStopButton: Bool = true
    private var showProgressBar: Bool = false
    
    // MARK: - Constants
    
    private enum Layout {
        static let height: CGFloat = 80
        static let padding: CGFloat = 12
        static let artworkSize: CGFloat = 56
        static let buttonSize: CGFloat = 60
        static let titleFontSize: CGFloat = 18
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
        titleLabel.text = title
        subtitleLabel.text = subtitle
        subtitleLabel.isHidden = subtitle == nil
        
        // Load artwork
        if let urlString = artworkURL, let url = URL(string: urlString) {
            loadImage(from: url)
        } else {
            artworkImageView.image = nil
        }
    }
    
    func updatePlaybackState(isPlaying: Bool, progress: Float?, showStopButton: Bool) {
        self.isPlaying = isPlaying
        self.showStopButton = showStopButton
        
        // Update play/pause icon
        let config = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
        let iconName = isPlaying ? "pause.fill" : "play.fill"
        playPauseButton.setImage(UIImage(systemName: iconName, withConfiguration: config), for: .normal)
        playPauseButton.accessibilityLabel = isPlaying ? "Pauzeren" : "Afspelen"
        
        // Update stop button visibility
        stopButton.isHidden = !showStopButton
        
        // Update progress
        if let progress = progress {
            progressView.isHidden = false
            progressView.progress = progress
        } else {
            progressView.isHidden = true
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
