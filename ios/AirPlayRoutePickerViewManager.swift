/**
 * AirPlayRoutePickerViewManager — Native View Manager for AVRoutePickerView
 *
 * Bridges Apple's AVRoutePickerView to React Native as a native UI component.
 * This is the standard Apple-provided AirPlay speaker picker button.
 *
 * Props from React Native:
 * - tintColorHex: String — Color of the AirPlay icon (default: white)
 * - activeTintColorHex: String — Color when AirPlay is active (default: accent blue)
 * - buttonSize: CGFloat — Size of the picker button (default: 60pt)
 *
 * @see src/components/AirPlayButton.tsx for React Native wrapper
 * @see Apple HIG: "Use AVRoutePickerView for AirPlay routing"
 */

import AVKit
import React

// MARK: - Native View

class AirPlayRoutePickerNativeView: UIView {

    private var routePickerView: AVRoutePickerView?

    // Props from React Native
    @objc var tintColorHex: NSString = "#FFFFFF" {
        didSet { updateColors() }
    }

    @objc var activeTintColorHex: NSString = "#007AFF" {
        didSet { updateColors() }
    }

    @objc var buttonSize: CGFloat = 60 {
        didSet { setNeedsLayout() }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    private func setupView() {
        let picker = AVRoutePickerView()

        // Don't prioritize video devices — we're an audio app
        picker.prioritizesVideoDevices = false

        picker.translatesAutoresizingMaskIntoConstraints = false
        addSubview(picker)

        NSLayoutConstraint.activate([
            picker.centerXAnchor.constraint(equalTo: centerXAnchor),
            picker.centerYAnchor.constraint(equalTo: centerYAnchor),
            picker.widthAnchor.constraint(equalToConstant: 44),
            picker.heightAnchor.constraint(equalToConstant: 44),
        ])

        self.routePickerView = picker
        updateColors()

        NSLog("[AirPlayRoutePicker] View initialized")
    }

    private func updateColors() {
        guard let picker = routePickerView else { return }

        let tintColor = UIColor(hexString: tintColorHex as String) ?? .white
        let activeColor = UIColor(hexString: activeTintColorHex as String) ?? .systemBlue

        picker.tintColor = tintColor
        picker.activeTintColor = activeColor
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        // Ensure minimum touch target of 60pt
        let size = max(buttonSize, 60)
        frame.size = CGSize(width: size, height: size)
    }
}

// MARK: - View Manager

@objc(AirPlayRoutePickerViewManager)
class AirPlayRoutePickerViewManager: RCTViewManager {

    override func view() -> UIView! {
        return AirPlayRoutePickerNativeView()
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}
