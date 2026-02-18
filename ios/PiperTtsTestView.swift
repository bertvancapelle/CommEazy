/**
 * PiperTtsTestView — Test Screen for Piper TTS Proof of Concept
 *
 * Simple SwiftUI view to test the Piper TTS native module.
 * Allows entering text and hearing it spoken with the Dutch voice.
 */

import SwiftUI

struct PiperTtsTestView: View {
    @State private var testText = "Hallo, dit is een test van de Piper spraaksynthese. De stem klinkt veel natuurlijker dan de standaard Apple stem."
    @State private var isInitialized = false
    @State private var isPlaying = false
    @State private var statusMessage = "Niet geïnitialiseerd"
    @State private var speed: Double = 1.0
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Status indicator
                    HStack {
                        Circle()
                            .fill(isInitialized ? Color.green : Color.red)
                            .frame(width: 12, height: 12)
                        Text(statusMessage)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                    
                    // Initialize button
                    Button(action: initializeTts) {
                        HStack {
                            Image(systemName: "waveform.circle")
                            Text("Initialiseer Piper TTS")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(isInitialized ? Color.gray : Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .disabled(isInitialized)
                    
                    // Text input
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Test tekst:")
                            .font(.headline)
                        
                        TextEditor(text: $testText)
                            .frame(minHeight: 120)
                            .padding(8)
                            .background(Color(.systemGray6))
                            .cornerRadius(8)
                    }
                    
                    // Speed slider
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Snelheid: \(String(format: "%.1fx", speed))")
                            .font(.headline)
                        
                        Slider(value: $speed, in: 0.5...2.0, step: 0.1)
                    }
                    
                    // Playback controls
                    HStack(spacing: 16) {
                        // Play button
                        Button(action: speakText) {
                            HStack {
                                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                                Text(isPlaying ? "Pauze" : "Afspelen")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(isInitialized ? Color.green : Color.gray)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        .disabled(!isInitialized)
                        
                        // Stop button
                        Button(action: stopPlayback) {
                            HStack {
                                Image(systemName: "stop.fill")
                                Text("Stop")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(isInitialized ? Color.red : Color.gray)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        .disabled(!isInitialized)
                    }
                    
                    // Sample texts
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Voorbeeldteksten:")
                            .font(.headline)
                        
                        ForEach(sampleTexts, id: \.self) { sample in
                            Button(action: { testText = sample }) {
                                Text(sample)
                                    .font(.body)
                                    .foregroundColor(.primary)
                                    .multilineTextAlignment(.leading)
                                    .padding()
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color(.systemGray6))
                                    .cornerRadius(8)
                            }
                        }
                    }
                    
                    Spacer(minLength: 40)
                }
                .padding()
            }
            .navigationTitle("Piper TTS Test")
        }
    }
    
    private var sampleTexts: [String] {
        [
            "Goedemorgen! Hoe gaat het met je vandaag?",
            "Dit is hoofdstuk één van het boek. Er was eens een klein meisje dat in een groot bos woonde.",
            "De weersvoorspelling voor vandaag: zonnig met een maximale temperatuur van twintig graden.",
            "Vergeet niet om je medicijnen te nemen om acht uur vanavond."
        ]
    }
    
    private func initializeTts() {
        statusMessage = "Initialiseren..."
        
        // Call the React Native bridge module
        // Note: This requires the React Native bridge to be active
        // For pure Swift testing, we'd need a different approach
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            // Check if PiperTtsModule is available through the bridge
            if let module = RCTBridge.current()?.module(forName: "PiperTtsModule") {
                statusMessage = "Module gevonden, model laden..."
                // The actual initialization happens through React Native
                isInitialized = true
                statusMessage = "Klaar om te spreken"
            } else {
                statusMessage = "⚠️ React Native bridge niet actief. Start de app via Metro."
                isInitialized = false
            }
        }
    }
    
    private func speakText() {
        guard isInitialized else { return }
        
        if isPlaying {
            // Pause
            isPlaying = false
            statusMessage = "Gepauzeerd"
        } else {
            // Play
            isPlaying = true
            statusMessage = "Aan het spreken..."
            
            // The actual playback happens through React Native bridge
            // This is a UI placeholder
        }
    }
    
    private func stopPlayback() {
        isPlaying = false
        statusMessage = "Gestopt"
    }
}

#Preview {
    PiperTtsTestView()
}
