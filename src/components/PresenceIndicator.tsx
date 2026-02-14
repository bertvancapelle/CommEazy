/**
 * PresenceIndicator — Configureerbare status indicator
 *
 * Senior-vriendelijk ontwerp:
 * - Grote, duidelijke cirkels (56x56 standaard)
 * - Configureerbare kleuren voor kleurenblindheid
 * - DND heeft witte balk (stopbord-stijl)
 * - Hoog contrast standaardkleuren
 *
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { PresenceShow } from '@/services/interfaces';
import { getDefaultPresenceColor } from '@/hooks/usePresenceColors';

interface PresenceIndicatorProps {
  /** De XMPP presence status */
  show: PresenceShow;
  /** Grootte van de indicator (standaard 56) */
  size?: number;
  /** Accessibility label */
  accessibilityLabel?: string;
}

/**
 * Toont een gekleurde cirkel die de online status van een contact aangeeft.
 * De kleuren zijn configureerbaar via user settings voor kleurenblindheid.
 *
 * Statussen:
 * - available: Groen cirkel (online)
 * - chat: Groen cirkel (vrij om te chatten = online)
 * - away: Oranje cirkel (even weg)
 * - xa: Rood cirkel (langere tijd weg / not available)
 * - dnd: Rood cirkel met witte balk (niet storen / stopbord)
 * - offline: Grijs cirkel
 */
export function PresenceIndicator({
  show,
  size = 56,
  accessibilityLabel,
}: PresenceIndicatorProps) {
  // Use default colors for now. When AsyncStorage is installed,
  // this can be upgraded to use the usePresenceColors() hook
  // for user-configurable colors (colorblindness support).
  const color = getDefaultPresenceColor(show);
  const borderRadius = size / 2;

  // DND krijgt een speciale "stopbord" stijl met witte balk
  const isDnd = show === 'dnd';

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: color,
        },
      ]}
      accessibilityLabel={accessibilityLabel ?? `Status: ${show}`}
      accessibilityRole="image"
    >
      {/* Witte horizontale balk voor DND (stopbord stijl) */}
      {isDnd && (
        <View
          style={[
            styles.dndBar,
            {
              width: size * 0.6,
              height: size * 0.15,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  dndBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
});
