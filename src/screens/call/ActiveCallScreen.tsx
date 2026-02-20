/**
 * ActiveCallScreen — Active call UI with video/controls
 *
 * Displays during an active call:
 * - Remote video (full screen) or avatar
 * - Local video (PiP, 120x160pt, draggable)
 * - Participant name(s) + call duration
 * - Control buttons: Mute, Speaker, Video, Hangup
 *
 * For 3-way calls:
 * - Grid layout with 2 large + 1 smaller video
 * - Add participant button (if <3 participants)
 *
 * Senior-inclusive design:
 * - 60pt+ touch targets for controls
 * - 84pt hangup button
 * - Clear status indicators
 * - Haptic feedback
 *
 * @see CLAUDE.md UI Specifications
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RTCView } from 'react-native-webrtc';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { ContactAvatar, Icon, IconButton } from '@/components';
import { useFeedback } from '@/hooks/useFeedback';
import { useCall } from '@/contexts/CallContext';
import type { CallStackParams } from './types';

// ============================================================
// Types
// ============================================================

type Props = NativeStackScreenProps<CallStackParams, 'ActiveCall'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// PiP dimensions
const PIP_WIDTH = 120;
const PIP_HEIGHT = 160;
const PIP_MARGIN = 16;

// ============================================================
// Component
// ============================================================

export function ActiveCallScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { triggerFeedback } = useFeedback();
  const {
    activeCall,
    localStream,
    remoteStreams,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    switchCamera,
    canAddParticipant,
    getContactName,
  } = useCall();

  // Format call duration
  const formatDuration = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Get participant names
  const participantNames = useMemo(() => {
    if (!activeCall) return '';
    return activeCall.participants.map((p) => p.name).join(' • ');
  }, [activeCall]);

  // Get first remote stream for 1-on-1
  const firstRemoteStream = useMemo(() => {
    const entries = Array.from(remoteStreams.entries());
    return entries.length > 0 ? entries[0][1] : null;
  }, [remoteStreams]);

  // Handle hangup
  const handleHangup = async () => {
    void triggerFeedback('tap');
    try {
      await endCall();
      navigation.goBack();
    } catch (error) {
      console.error('[ActiveCall] Failed to end call:', error);
      navigation.goBack();
    }
  };

  // Handle mute toggle
  const handleToggleMute = () => {
    void triggerFeedback('tap');
    toggleMute();
  };

  // Handle speaker toggle
  const handleToggleSpeaker = () => {
    void triggerFeedback('tap');
    toggleSpeaker();
  };

  // Handle video toggle
  const handleToggleVideo = () => {
    void triggerFeedback('tap');
    toggleVideo();
  };

  // Handle camera switch
  const handleSwitchCamera = () => {
    void triggerFeedback('tap');
    switchCamera();
  };

  // If call ended, go back
  useEffect(() => {
    if (!activeCall || activeCall.state === 'ended') {
      navigation.goBack();
    }
  }, [activeCall, navigation]);

  // Render video or avatar
  const renderRemoteView = () => {
    const isVideoCall = activeCall?.type === 'video';
    const hasRemoteStream = firstRemoteStream !== null;
    const remoteVideoEnabled = activeCall?.participants[0]?.isVideoEnabled ?? false;

    if (isVideoCall && hasRemoteStream && remoteVideoEnabled) {
      return (
        <RTCView
          streamURL={firstRemoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
          mirror={false}
        />
      );
    }

    // Show avatar for voice calls or when video is off
    const participant = activeCall?.participants[0];
    return (
      <View style={styles.avatarView}>
        <ContactAvatar
          name={participant?.name || t('call.unknownCaller')}
          size={200}
        />
      </View>
    );
  };

  // Render local video PiP
  const renderLocalVideo = () => {
    const isVideoCall = activeCall?.type === 'video';
    const isVideoEnabled = activeCall?.isVideoEnabled ?? false;

    if (!isVideoCall || !localStream || !isVideoEnabled) {
      return null;
    }

    return (
      <View style={styles.localVideoContainer}>
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localVideo}
          objectFit="cover"
          mirror={activeCall?.isFrontCamera ?? true}
        />
        {/* Camera switch button */}
        <TouchableOpacity
          style={styles.cameraSwitchButton}
          onPress={handleSwitchCamera}
          onLongPress={() => {}}
          delayLongPress={300}
          accessibilityRole="button"
          accessibilityLabel={t('call.switchCamera')}
        >
          <Icon name="camera-reverse" size={20} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>
    );
  };

  // Render call status
  const renderStatus = () => {
    let statusText = '';
    switch (activeCall?.state) {
      case 'ringing':
        statusText = t('call.ringing');
        break;
      case 'connecting':
        statusText = t('call.connecting');
        break;
      case 'reconnecting':
        statusText = t('call.reconnecting');
        break;
      case 'connected':
        statusText = formatDuration(activeCall.duration);
        break;
      default:
        statusText = '';
    }

    return (
      <View style={styles.statusContainer}>
        <Text style={styles.participantNames} numberOfLines={1}>
          {participantNames}
        </Text>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>
    );
  };

  const isVideoCall = activeCall?.type === 'video';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Remote view (full screen) */}
      <View style={styles.remoteContainer}>
        {renderRemoteView()}
      </View>

      {/* Local video PiP */}
      {renderLocalVideo()}

      {/* Status bar */}
      {renderStatus()}

      {/* Control buttons */}
      <View style={styles.controlsContainer}>
        {/* Mute button */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            activeCall?.isMuted && styles.controlButtonActive,
          ]}
          onPress={handleToggleMute}
          onLongPress={() => {}}
          delayLongPress={300}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={activeCall?.isMuted ? t('call.unmute') : t('call.mute')}
          accessibilityState={{ selected: activeCall?.isMuted }}
        >
          <Icon
            name={activeCall?.isMuted ? 'mic-off' : 'mic'}
            size={24}
            color={activeCall?.isMuted ? colors.textPrimary : colors.textOnPrimary}
          />
          <Text style={[
            styles.controlLabel,
            activeCall?.isMuted && styles.controlLabelActive,
          ]}>
            {t('call.mute')}
          </Text>
        </TouchableOpacity>

        {/* Speaker button */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            activeCall?.isSpeakerOn && styles.controlButtonActive,
          ]}
          onPress={handleToggleSpeaker}
          onLongPress={() => {}}
          delayLongPress={300}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={activeCall?.isSpeakerOn ? t('call.speakerOff') : t('call.speakerOn')}
          accessibilityState={{ selected: activeCall?.isSpeakerOn }}
        >
          <Icon
            name={activeCall?.isSpeakerOn ? 'volume-high' : 'volume-low'}
            size={24}
            color={activeCall?.isSpeakerOn ? colors.textPrimary : colors.textOnPrimary}
          />
          <Text style={[
            styles.controlLabel,
            activeCall?.isSpeakerOn && styles.controlLabelActive,
          ]}>
            {t('call.speaker')}
          </Text>
        </TouchableOpacity>

        {/* Video button (only for video calls) */}
        {isVideoCall && (
          <TouchableOpacity
            style={[
              styles.controlButton,
              !activeCall?.isVideoEnabled && styles.controlButtonActive,
            ]}
            onPress={handleToggleVideo}
            onLongPress={() => {}}
            delayLongPress={300}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={activeCall?.isVideoEnabled ? t('call.videoOff') : t('call.videoOn')}
            accessibilityState={{ selected: !activeCall?.isVideoEnabled }}
          >
            <Icon
              name={activeCall?.isVideoEnabled ? 'videocam' : 'videocam-off'}
              size={24}
              color={activeCall?.isVideoEnabled ? colors.textOnPrimary : colors.textPrimary}
            />
            <Text style={[
              styles.controlLabel,
              !activeCall?.isVideoEnabled && styles.controlLabelActive,
            ]}>
              {t('call.video')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Hangup button */}
        <TouchableOpacity
          style={[styles.controlButton, styles.hangupButton]}
          onPress={handleHangup}
          onLongPress={() => {}}
          delayLongPress={300}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('call.hangup')}
        >
          <Icon name="call" size={28} color={colors.textOnPrimary} />
          <Text style={[styles.controlLabel, styles.hangupLabel]}>
            {t('call.hangup')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteContainer: {
    flex: 1,
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  avatarView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
  },
  localVideoContainer: {
    position: 'absolute',
    top: PIP_MARGIN + 50, // Below status bar
    right: PIP_MARGIN,
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.textOnPrimary,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  localVideo: {
    flex: 1,
    backgroundColor: '#333',
  },
  cameraSwitchButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusContainer: {
    position: 'absolute',
    bottom: 200,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  participantNames: {
    ...typography.h3,
    color: colors.textOnPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
    // Text shadow for readability
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  statusText: {
    ...typography.body,
    color: colors.textOnPrimary,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  controlButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum + 20, // Extra for label
    borderRadius: touchTargets.minimum / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  controlButtonActive: {
    backgroundColor: colors.textOnPrimary,
  },
  controlLabel: {
    ...typography.small,
    fontSize: 12,
    color: colors.textOnPrimary,
    marginTop: 2,
  },
  controlLabelActive: {
    color: colors.textPrimary,
  },
  hangupButton: {
    width: touchTargets.large,
    height: touchTargets.large + 20,
    borderRadius: touchTargets.large / 2,
    backgroundColor: colors.error,
  },
  hangupLabel: {
    color: colors.textOnPrimary,
  },
});
