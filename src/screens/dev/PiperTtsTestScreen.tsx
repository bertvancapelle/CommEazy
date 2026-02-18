/**
 * PiperTtsTestScreen — Test Screen for Piper TTS Proof of Concept
 *
 * Simple test screen to verify the Piper TTS native module works.
 * Allows entering text and hearing it spoken with the Dutch voice.
 *
 * PRIVACY: All TTS processing happens 100% on-device.
 * No data is sent to any server.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { piperTtsService } from '@/services/piperTtsService';

const SAMPLE_TEXTS = [
  'Goedemorgen! Hoe gaat het met je vandaag?',
  'Dit is hoofdstuk één van het boek. Er was eens een klein meisje dat in een groot bos woonde.',
  'De weersvoorspelling voor vandaag: zonnig met een maximale temperatuur van twintig graden.',
  'Vergeet niet om je medicijnen te nemen om acht uur vanavond.',
];

export function PiperTtsTestScreen() {
  const [testText, setTestText] = useState(
    'Hallo, dit is een test van de Piper spraaksynthese. De stem klinkt veel natuurlijker dan de standaard Apple stem.'
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Niet geïnitialiseerd');
  const [speed, setSpeed] = useState(1.0);

  useEffect(() => {
    // Set up event listeners
    const unsubStart = piperTtsService.addEventListener('piperStart', () => {
      setIsPlaying(true);
      setStatusMessage('Aan het spreken...');
    });

    const unsubComplete = piperTtsService.addEventListener('piperComplete', () => {
      setIsPlaying(false);
      setStatusMessage('Klaar');
    });

    const unsubError = piperTtsService.addEventListener('piperError', (event) => {
      setIsPlaying(false);
      setStatusMessage(`Fout: ${event.error}`);
      Alert.alert('TTS Fout', event.error || 'Onbekende fout');
    });

    return () => {
      unsubStart();
      unsubComplete();
      unsubError();
      piperTtsService.cleanup();
    };
  }, []);

  const handleInitialize = async () => {
    setIsLoading(true);
    setStatusMessage('Initialiseren...');

    try {
      const success = await piperTtsService.initialize();
      setIsInitialized(success);
      setStatusMessage(success ? 'Klaar om te spreken' : 'Initialisatie mislukt');

      if (!success) {
        Alert.alert(
          'Initialisatie Mislukt',
          'Kon Piper TTS niet initialiseren. Controleer of het model correct is gebundeld.'
        );
      }
    } catch (error) {
      setStatusMessage(`Fout: ${error}`);
      Alert.alert('Fout', String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = async () => {
    if (!isInitialized) return;

    if (isPlaying) {
      await piperTtsService.pause();
      setIsPlaying(false);
      setStatusMessage('Gepauzeerd');
    } else {
      setStatusMessage('Audio genereren...');
      const success = await piperTtsService.speak(testText, speed);
      if (!success) {
        setStatusMessage('Kon niet afspelen');
      }
    }
  };

  const handleStop = async () => {
    await piperTtsService.stop();
    setIsPlaying(false);
    setStatusMessage('Gestopt');
  };

  const handleSpeedChange = (delta: number) => {
    const newSpeed = Math.max(0.5, Math.min(2.0, speed + delta));
    setSpeed(Math.round(newSpeed * 10) / 10);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>🔊 Piper TTS Test</Text>
        <Text style={styles.subtitle}>100% Offline Spraaksynthese</Text>

        {/* Status indicator */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isInitialized ? '#4CAF50' : '#F44336' },
            ]}
          />
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>

        {/* Initialize button */}
        <TouchableOpacity
          style={[
            styles.button,
            styles.initButton,
            isInitialized && styles.buttonDisabled,
          ]}
          onPress={handleInitialize}
          disabled={isInitialized || isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Laden...' : 'Initialiseer Piper TTS'}
          </Text>
        </TouchableOpacity>

        {/* Text input */}
        <Text style={styles.label}>Test tekst:</Text>
        <TextInput
          style={styles.textInput}
          value={testText}
          onChangeText={setTestText}
          multiline
          numberOfLines={4}
          placeholder="Voer tekst in om voor te lezen..."
        />

        {/* Speed control */}
        <Text style={styles.label}>Snelheid: {speed.toFixed(1)}x</Text>
        <View style={styles.speedControls}>
          <TouchableOpacity
            style={styles.speedButton}
            onPress={() => handleSpeedChange(-0.1)}
          >
            <Text style={styles.speedButtonText}>−</Text>
          </TouchableOpacity>
          <View style={styles.speedBar}>
            <View
              style={[
                styles.speedFill,
                { width: `${((speed - 0.5) / 1.5) * 100}%` },
              ]}
            />
          </View>
          <TouchableOpacity
            style={styles.speedButton}
            onPress={() => handleSpeedChange(0.1)}
          >
            <Text style={styles.speedButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Playback controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.playButton,
              !isInitialized && styles.buttonDisabled,
            ]}
            onPress={handleSpeak}
            disabled={!isInitialized}
          >
            <Text style={styles.buttonText}>
              {isPlaying ? '⏸ Pauze' : '▶ Afspelen'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.stopButton,
              !isInitialized && styles.buttonDisabled,
            ]}
            onPress={handleStop}
            disabled={!isInitialized}
          >
            <Text style={styles.buttonText}>⏹ Stop</Text>
          </TouchableOpacity>
        </View>

        {/* Sample texts */}
        <Text style={styles.label}>Voorbeeldteksten:</Text>
        {SAMPLE_TEXTS.map((sample, index) => (
          <TouchableOpacity
            key={index}
            style={styles.sampleButton}
            onPress={() => setTestText(sample)}
          >
            <Text style={styles.sampleText}>{sample}</Text>
          </TouchableOpacity>
        ))}

        {/* Privacy notice */}
        <View style={styles.privacyNotice}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>
            Alle spraaksynthese gebeurt 100% offline op je device.
            Er wordt geen data verzonden naar externe servers.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  speedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  speedButton: {
    width: 48,
    height: 48,
    backgroundColor: '#FFF',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  speedButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  speedBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#DDD',
    borderRadius: 4,
  },
  speedFill: {
    height: 8,
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initButton: {
    backgroundColor: '#2196F3',
  },
  playButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  sampleButton: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  sampleText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    gap: 12,
  },
  privacyIcon: {
    fontSize: 24,
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    color: '#2E7D32',
    lineHeight: 20,
  },
});

export default PiperTtsTestScreen;
