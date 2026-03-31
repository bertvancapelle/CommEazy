/**
 * CelebrationAnimation — Random particle animation for game wins
 *
 * Renders one of 5 celebration styles randomly:
 * 1. Confetti — colorful falling rectangles
 * 2. Fireworks — expanding star bursts
 * 3. Stars — twinkling stars floating up
 * 4. Hearts — floating hearts
 * 5. Balloons — rising balloons
 *
 * Respects AccessibilityInfo.isReduceMotionEnabled — renders nothing when active.
 *
 * @see GameOverModal.tsx
 */

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, StyleSheet, Animated, AccessibilityInfo, Dimensions } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

// ============================================================
// Types
// ============================================================

type CelebrationType = 'confetti' | 'fireworks' | 'stars' | 'hearts' | 'balloons';

interface Particle {
  id: number;
  x: number;        // Start X (0-1 fraction of width)
  y: number;        // Start Y (0-1 fraction of height)
  size: number;     // Particle size
  color: string;    // Particle color
  delay: number;    // Animation delay (ms)
  rotation: number; // Initial rotation (degrees)
}

interface CelebrationAnimationProps {
  /** Module accent color for tinting */
  moduleColor: string;
  /** Whether animation is active */
  active: boolean;
}

// ============================================================
// Constants
// ============================================================

const PARTICLE_COUNT = 24;
const ANIMATION_DURATION = 2500;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CELEBRATION_COLORS = [
  '#FFD700', // Gold
  '#FF6B6B', // Coral
  '#4ECDC4', // Teal
  '#45B7D1', // Sky
  '#96CEB4', // Sage
  '#FFEAA7', // Light gold
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#FF8A80', // Light red
  '#82B1FF', // Light blue
];

const CELEBRATION_TYPES: CelebrationType[] = [
  'confetti', 'fireworks', 'stars', 'hearts', 'balloons',
];

// ============================================================
// Particle Generators
// ============================================================

function generateParticles(type: CelebrationType, moduleColor: string): Particle[] {
  const colors = [...CELEBRATION_COLORS, moduleColor];

  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const baseParticle = {
      id: i,
      color: colors[i % colors.length],
      delay: Math.random() * 800,
      rotation: Math.random() * 360,
    };

    switch (type) {
      case 'confetti':
        return {
          ...baseParticle,
          x: Math.random(),
          y: -0.1 - Math.random() * 0.3, // Start above
          size: 8 + Math.random() * 8,
        };
      case 'fireworks':
        return {
          ...baseParticle,
          x: 0.3 + Math.random() * 0.4, // Center cluster
          y: 0.3 + Math.random() * 0.4,
          size: 4 + Math.random() * 6,
        };
      case 'stars':
        return {
          ...baseParticle,
          x: Math.random(),
          y: 0.8 + Math.random() * 0.3, // Start below
          size: 12 + Math.random() * 12,
        };
      case 'hearts':
        return {
          ...baseParticle,
          x: Math.random(),
          y: 0.8 + Math.random() * 0.3,
          size: 14 + Math.random() * 10,
        };
      case 'balloons':
        return {
          ...baseParticle,
          x: Math.random(),
          y: 1.0 + Math.random() * 0.2, // Start below screen
          size: 18 + Math.random() * 12,
        };
    }
  });
}

// ============================================================
// Animated Particle Component
// ============================================================

const AnimatedParticle = React.memo(function AnimatedParticle({
  particle,
  type,
  progress,
}: {
  particle: Particle;
  type: CelebrationType;
  progress: Animated.Value;
}) {
  const particleProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.timing(particleProgress, {
        toValue: 1,
        duration: ANIMATION_DURATION - particle.delay,
        useNativeDriver: true,
      }).start();
    }, particle.delay);

    return () => clearTimeout(timeout);
  }, [particleProgress, particle.delay]);

  const startX = particle.x * SCREEN_WIDTH;
  const startY = particle.y * SCREEN_HEIGHT;

  // Animation transforms based on type
  const getTransforms = () => {
    switch (type) {
      case 'confetti': {
        const endY = SCREEN_HEIGHT * 1.2;
        const drift = (Math.random() - 0.5) * 100;
        return {
          translateX: Animated.add(
            startX,
            Animated.multiply(particleProgress, drift),
          ),
          translateY: Animated.add(
            startY * SCREEN_HEIGHT,
            Animated.multiply(particleProgress, endY),
          ),
          rotate: particleProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [`${particle.rotation}deg`, `${particle.rotation + 720}deg`],
          }),
          opacity: particleProgress.interpolate({
            inputRange: [0, 0.1, 0.8, 1],
            outputRange: [0, 1, 1, 0],
          }),
        };
      }
      case 'fireworks': {
        const angle = (particle.id / PARTICLE_COUNT) * Math.PI * 2;
        const radius = 80 + Math.random() * 60;
        return {
          translateX: Animated.add(
            startX,
            Animated.multiply(particleProgress, Math.cos(angle) * radius),
          ),
          translateY: Animated.add(
            startY,
            Animated.multiply(particleProgress, Math.sin(angle) * radius),
          ),
          rotate: `${particle.rotation}deg`,
          opacity: particleProgress.interpolate({
            inputRange: [0, 0.2, 0.6, 1],
            outputRange: [0, 1, 1, 0],
          }),
          scale: particleProgress.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [0.2, 1.2, 0.5],
          }),
        };
      }
      case 'stars':
      case 'hearts': {
        const drift = (Math.random() - 0.5) * 120;
        return {
          translateX: Animated.add(
            startX,
            Animated.multiply(particleProgress, drift),
          ),
          translateY: Animated.add(
            startY,
            Animated.multiply(particleProgress, -SCREEN_HEIGHT * 0.8),
          ),
          rotate: particleProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [`0deg`, `${(Math.random() - 0.5) * 60}deg`],
          }),
          opacity: particleProgress.interpolate({
            inputRange: [0, 0.1, 0.7, 1],
            outputRange: [0, 1, 0.8, 0],
          }),
          scale: particleProgress.interpolate({
            inputRange: [0, 0.3, 0.7, 1],
            outputRange: [0.3, 1, 1, 0.6],
          }),
        };
      }
      case 'balloons': {
        const drift = (Math.random() - 0.5) * 80;
        return {
          translateX: Animated.add(
            startX,
            Animated.multiply(particleProgress, drift),
          ),
          translateY: Animated.add(
            startY,
            Animated.multiply(particleProgress, -SCREEN_HEIGHT * 1.3),
          ),
          rotate: particleProgress.interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1],
            outputRange: ['-10deg', '10deg', '-10deg', '10deg', '-10deg'],
          }),
          opacity: particleProgress.interpolate({
            inputRange: [0, 0.1, 0.8, 1],
            outputRange: [0, 1, 1, 0],
          }),
        };
      }
    }
  };

  const transforms = getTransforms();
  const scale = 'scale' in transforms ? transforms.scale : 1;

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          opacity: transforms.opacity,
          transform: [
            { translateX: transforms.translateX as any },
            { translateY: transforms.translateY as any },
            { rotate: transforms.rotate as any },
            { scale: scale as any },
          ],
        },
      ]}
    >
      <ParticleShape type={type} size={particle.size} color={particle.color} />
    </Animated.View>
  );
});

// ============================================================
// Particle Shape SVGs
// ============================================================

function ParticleShape({ type, size, color }: { type: CelebrationType; size: number; color: string }) {
  switch (type) {
    case 'confetti':
      return (
        <Svg width={size} height={size * 1.5} viewBox="0 0 10 15">
          <Rect x="0" y="0" width="10" height="15" rx="2" fill={color} />
        </Svg>
      );
    case 'fireworks':
      return (
        <Svg width={size} height={size} viewBox="0 0 10 10">
          <Circle cx="5" cy="5" r="5" fill={color} />
        </Svg>
      );
    case 'stars':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 2L14.9 8.6L22 9.3L16.8 14L18.2 21L12 17.3L5.8 21L7.2 14L2 9.3L9.1 8.6L12 2Z"
            fill={color}
          />
        </Svg>
      );
    case 'hearts':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 12.27 18.6 15.36 13.45 20.03L12 21.35Z"
            fill={color}
          />
        </Svg>
      );
    case 'balloons':
      return (
        <Svg width={size} height={size * 1.4} viewBox="0 0 20 28">
          <Path
            d="M10 0C4.5 0 0 4.5 0 10C0 15.5 4.5 20 10 20C15.5 20 20 15.5 20 10C20 4.5 15.5 0 10 0Z"
            fill={color}
          />
          <Path d="M10 20L8 24L10 22L12 24L10 20Z" fill={color} opacity={0.7} />
          <Path d="M10 24L10 28" stroke={color} strokeWidth="0.5" opacity={0.5} />
        </Svg>
      );
  }
}

// ============================================================
// Main Component
// ============================================================

export function CelebrationAnimation({ moduleColor, active }: CelebrationAnimationProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  // Pick random celebration type once when active becomes true
  const celebrationType = useMemo(() => {
    if (!active) return 'confetti';
    return CELEBRATION_TYPES[Math.floor(Math.random() * CELEBRATION_TYPES.length)];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const particles = useMemo(
    () => generateParticles(celebrationType, moduleColor),
    [celebrationType, moduleColor],
  );

  // Check reduced motion
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  // Start animation when active
  useEffect(() => {
    if (active && !reduceMotion) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }).start();
    }
  }, [active, reduceMotion, progress]);

  if (!active || reduceMotion) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map(particle => (
        <AnimatedParticle
          key={particle.id}
          particle={particle}
          type={celebrationType}
          progress={progress}
        />
      ))}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
  },
});
