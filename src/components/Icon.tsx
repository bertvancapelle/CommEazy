/**
 * Icon — Monochrome SVG icons for consistent UI
 *
 * Uses react-native-svg for cross-platform vector icons.
 * All icons are single-color and can be tinted via the `color` prop.
 *
 * Replaces emoji icons for a cleaner, more professional look
 * that doesn't feel "busy" or overwhelming.
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { colors } from '@/theme';

export type IconName =
  | 'person'
  | 'accessibility'
  | 'notifications'
  | 'backup'
  | 'device'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-up'
  | 'chevron-down'
  | 'camera'
  | 'camera-reverse'
  | 'check'
  | 'check-all'
  | 'checkmark'
  | 'language'
  | 'settings'
  | 'group'
  | 'groups'
  | 'contacts'
  | 'chat'
  | 'call'
  | 'videocam'
  | 'chatbubble'
  | 'info'
  | 'mic'
  | 'plus'
  | 'heart'
  | 'heart-filled'
  | 'book'
  | 'book-filled'
  | 'book-open'
  | 'play'
  | 'pause'
  | 'stop'
  | 'volume-up'
  | 'search'
  | 'radio'
  | 'podcast'
  | 'time'
  | 'clock'
  | 'list'
  | 'x'
  | 'warning'
  | 'alert-circle'
  | 'news'
  | 'document-text'
  | 'folder'
  | 'trash'
  | 'external-link'
  | 'globe'
  | 'headphones'
  | 'headset'
  | 'star'
  | 'gauge'
  | 'weather-partly-cloudy'
  | 'weather-sunny'
  | 'weather-night'
  | 'weather-night-partly-cloudy'
  | 'weather-cloudy'
  | 'weather-fog'
  | 'weather-rainy'
  | 'weather-pouring'
  | 'weather-snowy'
  | 'weather-snowy-heavy'
  | 'weather-lightning-rainy'
  | 'water-percent'
  | 'weather-windy'
  | 'map-marker'
  | 'map-marker-check'
  | 'map-marker-off'
  | 'crosshairs-gps'
  | 'magnify'
  | 'alert'
  | 'trash-can-outline'
  | 'radar'
  | 'appleMusic'
  | 'shuffle'
  | 'repeat'
  | 'repeat-one'
  | 'heart-outline'
  | 'musical-notes'
  | 'grid'
  | 'disc'
  | 'shield-checkmark'
  | 'sun'
  | 'moon'
  | 'eye'
  | 'weather';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Monochrome icon component
 *
 * @param name - Icon name
 * @param size - Icon size in points (default: 24)
 * @param color - Icon color (default: textSecondary)
 * @param strokeWidth - Stroke width for better visibility (default: 2.5)
 */
export function Icon({ name, size = 24, color = colors.textSecondary, strokeWidth = 2.5 }: IconProps) {
  const iconProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
  };

  const sw = strokeWidth; // shorthand for all paths

  switch (name) {
    case 'person':
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={sw} />
          <Path
            d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'accessibility':
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="4" r="2" fill={color} />
          <Path
            d="M4 8H20M12 8V14M12 14L8 22M12 14L16 22"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'notifications':
      return (
        <Svg {...iconProps}>
          <Path
            d="M12 3C8.68629 3 6 5.68629 6 9V14L4 17H20L18 14V9C18 5.68629 15.3137 3 12 3Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M9 17V18C9 19.6569 10.3431 21 12 21C13.6569 21 15 19.6569 15 18V17"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'backup':
      return (
        <Svg {...iconProps}>
          <Path
            d="M7 16L7 8C7 5.79086 8.79086 4 11 4L13 4C15.2091 4 17 5.79086 17 8L17 16"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Path
            d="M4 14L12 20L20 14"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'device':
      return (
        <Svg {...iconProps}>
          <Rect
            x="5"
            y="2"
            width="14"
            height="20"
            rx="2"
            stroke={color}
            strokeWidth={sw}
          />
          <Path
            d="M10 18H14"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'chevron-right':
      return (
        <Svg {...iconProps}>
          <Path
            d="M9 6L15 12L9 18"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'chevron-left':
      return (
        <Svg {...iconProps}>
          <Path
            d="M15 6L9 12L15 18"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'chevron-up':
      return (
        <Svg {...iconProps}>
          <Path
            d="M6 15L12 9L18 15"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'chevron-down':
      return (
        <Svg {...iconProps}>
          <Path
            d="M6 9L12 15L18 9"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'plus':
      return (
        <Svg {...iconProps}>
          <Path
            d="M12 5V19M5 12H19"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'camera':
      return (
        <Svg {...iconProps}>
          <Path
            d="M3 9C3 7.89543 3.89543 7 5 7H6.5L8 5H16L17.5 7H19C20.1046 7 21 7.89543 21 9V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V9Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="12" cy="13" r="3" stroke={color} strokeWidth={sw} />
        </Svg>
      );

    case 'check':
      return (
        <Svg {...iconProps}>
          <Path
            d="M5 13L9 17L19 7"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'check-all':
      // Double checkmark for "delivered" status (WhatsApp style)
      return (
        <Svg {...iconProps}>
          <Path
            d="M2 13L6 17L16 7"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M8 13L12 17L22 7"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'language':
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={sw} />
          <Path
            d="M3 12H21M12 3C14.5 5.5 15.5 8.5 15.5 12C15.5 15.5 14.5 18.5 12 21M12 3C9.5 5.5 8.5 8.5 8.5 12C8.5 15.5 9.5 18.5 12 21"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'settings':
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={sw} />
          <Path
            d="M12 2V4M12 20V22M2 12H4M20 12H22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'group':
      return (
        <Svg {...iconProps}>
          <Circle cx="9" cy="7" r="3" stroke={color} strokeWidth={sw} />
          <Circle cx="17" cy="7" r="2" stroke={color} strokeWidth={sw} />
          <Path
            d="M2 19C2 16.2386 4.68629 14 9 14C10.5 14 11.8 14.2 12.9 14.6"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Path
            d="M14 17C14 14.7909 15.3431 13 17 13C18.6569 13 20 14.7909 20 17"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'groups':
      // Multiple people icon for group chats
      return (
        <Svg {...iconProps}>
          <Circle cx="9" cy="7" r="3" stroke={color} strokeWidth={sw} />
          <Circle cx="17" cy="7" r="2" stroke={color} strokeWidth={sw} />
          <Path
            d="M2 19C2 16.2386 4.68629 14 9 14C10.5 14 11.8 14.2 12.9 14.6"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Path
            d="M14 17C14 14.7909 15.3431 13 17 13C18.6569 13 20 14.7909 20 17"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'contacts':
      // Address book / contacts icon
      return (
        <Svg {...iconProps}>
          <Rect x="4" y="3" width="16" height="18" rx="2" stroke={color} strokeWidth={sw} />
          <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth={sw} />
          <Path
            d="M8 17C8 15.3431 9.79086 14 12 14C14.2091 14 16 15.3431 16 17"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Path d="M2 7H4M2 12H4M2 17H4" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );

    case 'chat':
      return (
        <Svg {...iconProps}>
          <Path
            d="M21 12C21 16.4183 16.9706 20 12 20C10.5 20 9.1 19.7 7.8 19.2L3 21L4.5 17C3.5 15.6 3 14 3 12C3 7.58172 7.02944 4 12 4C16.9706 4 21 7.58172 21 12Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'call':
      return (
        <Svg {...iconProps}>
          <Path
            d="M5.5 4C4.11929 4 3 5.11929 3 6.5C3 14.5081 9.49187 21 17.5 21C18.8807 21 20 19.8807 20 18.5V16.5C20 15.6716 19.3284 15 18.5 15H15.5C14.6716 15 14 15.6716 14 16.5C14 16.5 12.5 16.5 10.5 14.5C8.5 12.5 8.5 11 8.5 11C9.32843 11 10 10.3284 10 9.5V6.5C10 5.67157 9.32843 5 8.5 5H5.5Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'videocam':
      // Video camera icon for video calls
      return (
        <Svg {...iconProps}>
          <Rect
            x="2"
            y="6"
            width="13"
            height="12"
            rx="2"
            stroke={color}
            strokeWidth={sw}
          />
          <Path
            d="M15 10L21 6V18L15 14"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'chatbubble':
      // Chat bubble / message icon
      return (
        <Svg {...iconProps}>
          <Path
            d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'info':
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={sw} />
          <Path
            d="M12 8V8.01M12 11V16"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'mic':
      return (
        <Svg {...iconProps}>
          <Rect
            x="9"
            y="2"
            width="6"
            height="11"
            rx="3"
            stroke={color}
            strokeWidth={sw}
          />
          <Path
            d="M5 10V11C5 14.866 8.13401 18 12 18C15.866 18 19 14.866 19 11V10"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Path
            d="M12 18V22M8 22H16"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'heart':
      return (
        <Svg {...iconProps}>
          <Path
            d="M12 21C12 21 4 14.5 4 9C4 6.5 6 4 8.5 4C10.5 4 12 5.5 12 5.5C12 5.5 13.5 4 15.5 4C18 4 20 6.5 20 9C20 14.5 12 21 12 21Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'heart-filled':
      return (
        <Svg {...iconProps}>
          <Path
            d="M12 21C12 21 4 14.5 4 9C4 6.5 6 4 8.5 4C10.5 4 12 5.5 12 5.5C12 5.5 13.5 4 15.5 4C18 4 20 6.5 20 9C20 14.5 12 21 12 21Z"
            fill={color}
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'book':
      // Open book icon (outline)
      return (
        <Svg {...iconProps}>
          <Path
            d="M4 19V5C4 4.44772 4.44772 4 5 4H9C10.6569 4 12 5.34315 12 7V20C12 18.8954 11.1046 18 10 18H5C4.44772 18 4 18.4477 4 19Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M20 19V5C20 4.44772 19.5523 4 19 4H15C13.3431 4 12 5.34315 12 7V20C12 18.8954 12.8954 18 14 18H19C19.5523 18 20 18.4477 20 19Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'book-filled':
      // Open book icon (filled)
      return (
        <Svg {...iconProps}>
          <Path
            d="M4 19V5C4 4.44772 4.44772 4 5 4H9C10.6569 4 12 5.34315 12 7V20C12 18.8954 11.1046 18 10 18H5C4.44772 18 4 18.4477 4 19Z"
            fill={color}
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M20 19V5C20 4.44772 19.5523 4 19 4H15C13.3431 4 12 5.34315 12 7V20C12 18.8954 12.8954 18 14 18H19C19.5523 18 20 18.4477 20 19Z"
            fill={color}
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'play':
      return (
        <Svg {...iconProps}>
          <Path
            d="M6 4L20 12L6 20V4Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'pause':
      return (
        <Svg {...iconProps}>
          <Rect x="6" y="4" width="4" height="16" rx="1" stroke={color} strokeWidth={sw} />
          <Rect x="14" y="4" width="4" height="16" rx="1" stroke={color} strokeWidth={sw} />
        </Svg>
      );

    case 'stop':
      return (
        <Svg {...iconProps}>
          <Rect x="5" y="5" width="14" height="14" rx="2" stroke={color} strokeWidth={sw} />
        </Svg>
      );

    case 'volume-up':
      // Speaker with sound waves
      return (
        <Svg {...iconProps}>
          <Path
            d="M11 5L6 9H2V15H6L11 19V5Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M15.54 8.46C16.48 9.4 17 10.67 17 12C17 13.33 16.48 14.6 15.54 15.54"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Path
            d="M19.07 4.93C20.94 6.8 22 9.34 22 12C22 14.66 20.94 17.2 19.07 19.07"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'search':
      return (
        <Svg {...iconProps}>
          <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={sw} />
          <Path
            d="M16 16L21 21"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'radio':
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="14" r="3" stroke={color} strokeWidth={sw} />
          <Path
            d="M7 10C7 7.79086 8.79086 6 11 6H13C15.2091 6 17 7.79086 17 10V18C17 19.1046 16.1046 20 15 20H9C7.89543 20 7 19.1046 7 18V10Z"
            stroke={color}
            strokeWidth={sw}
          />
          <Path
            d="M10 6L16 3"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'podcast':
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={sw} />
          <Path
            d="M8.5 8.5C9.5 7.5 10.6 7 12 7C13.4 7 14.5 7.5 15.5 8.5"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Path
            d="M6 6C7.5 4.5 9.5 3.5 12 3.5C14.5 3.5 16.5 4.5 18 6"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Path
            d="M12 15V20"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Path
            d="M9 20H15"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'time':
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={sw} />
          <Path
            d="M12 6V12L16 14"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'list':
      return (
        <Svg {...iconProps}>
          <Path
            d="M8 6H21M8 12H21M8 18H21"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Circle cx="4" cy="6" r="1" fill={color} />
          <Circle cx="4" cy="12" r="1" fill={color} />
          <Circle cx="4" cy="18" r="1" fill={color} />
        </Svg>
      );

    case 'x':
      return (
        <Svg {...iconProps}>
          <Path
            d="M6 6L18 18M6 18L18 6"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'warning':
      return (
        <Svg {...iconProps}>
          <Path
            d="M12 3L22 21H2L12 3Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M12 10V14M12 17V17.01"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'news':
      // Newspaper icon
      return (
        <Svg {...iconProps}>
          <Path
            d="M4 6H20M4 10H16M4 14H12M4 18H8"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="2"
            stroke={color}
            strokeWidth={sw}
          />
          <Rect
            x="14"
            y="12"
            width="5"
            height="5"
            stroke={color}
            strokeWidth={sw}
          />
        </Svg>
      );

    case 'weather-partly-cloudy':
      // Weather icon: sun partially behind cloud
      return (
        <Svg {...iconProps}>
          {/* Sun */}
          <Circle cx="16" cy="8" r="3" stroke={color} strokeWidth={sw} />
          {/* Sun rays */}
          <Path
            d="M16 3V4M21 8H20M19.5 4.5L18.8 5.2M12.5 4.5L13.2 5.2"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          {/* Cloud body */}
          <Path
            d="M6 17C4.34 17 3 15.66 3 14C3 12.34 4.34 11 6 11C6.09 11 6.18 11.01 6.27 11.02C6.65 9.25 8.16 8 10 8C11.06 8 12.02 8.44 12.71 9.15C13.17 9.06 13.64 9 14 9C16.76 9 19 11.24 19 14C19 16.76 16.76 19 14 19H6C4.34 19 3 17.66 3 16"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'weather-sunny':
      // Clear sky / sunny
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={sw} />
          <Path
            d="M12 2V4M12 20V22M4 12H2M6.3 6.3L4.9 4.9M17.7 6.3L19.1 4.9M6.3 17.7L4.9 19.1M17.7 17.7L19.1 19.1M22 12H20"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'weather-night':
      // Clear night / moon
      return (
        <Svg {...iconProps}>
          <Path
            d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'weather-night-partly-cloudy':
      // Night with clouds
      return (
        <Svg {...iconProps}>
          {/* Moon */}
          <Path
            d="M17 6.5A4 4 0 1013.5 3 3 3 0 0017 6.5z"
            stroke={color}
            strokeWidth={sw}
          />
          {/* Cloud */}
          <Path
            d="M6 17C4.34 17 3 15.66 3 14C3 12.34 4.34 11 6 11C6.09 11 6.18 11.01 6.27 11.02C6.65 9.25 8.16 8 10 8C11.06 8 12.02 8.44 12.71 9.15C13.17 9.06 13.64 9 14 9C16.76 9 19 11.24 19 14C19 16.76 16.76 19 14 19H6"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'weather-cloudy':
      // Overcast / cloudy
      return (
        <Svg {...iconProps}>
          <Path
            d="M6 19C3.79 19 2 17.21 2 15C2 12.79 3.79 11 6 11C6.09 11 6.18 11.01 6.27 11.02C6.82 8.67 8.91 7 11.5 7C14.35 7 16.7 9.12 17 11.88C19.21 12.18 21 14.01 21 16.25C21 18.66 19.09 20 17 19H6"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'weather-fog':
      // Fog / mist
      return (
        <Svg {...iconProps}>
          <Path
            d="M4 12H20M4 8H20M4 16H16M4 20H12"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'weather-rainy':
      // Light rain / drizzle
      return (
        <Svg {...iconProps}>
          {/* Cloud */}
          <Path
            d="M6 14C4.34 14 3 12.66 3 11C3 9.34 4.34 8 6 8C6.09 8 6.18 8.01 6.27 8.02C6.65 6.25 8.16 5 10 5C11.06 5 12.02 5.44 12.71 6.15C13.17 6.06 13.64 6 14 6C16.76 6 19 8.24 19 11C19 13.76 16.76 16 14 16H6"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Rain drops */}
          <Path
            d="M8 17V19M12 17V21M16 17V19"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'weather-pouring':
      // Heavy rain
      return (
        <Svg {...iconProps}>
          {/* Cloud */}
          <Path
            d="M6 13C4.34 13 3 11.66 3 10C3 8.34 4.34 7 6 7C6.09 7 6.18 7.01 6.27 7.02C6.65 5.25 8.16 4 10 4C11.06 4 12.02 4.44 12.71 5.15C13.17 5.06 13.64 5 14 5C16.76 5 19 7.24 19 10C19 12.76 16.76 15 14 15H6"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Heavy rain drops */}
          <Path
            d="M7 16V20M10 17V22M13 16V21M16 17V20"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'weather-snowy':
      // Light snow
      return (
        <Svg {...iconProps}>
          {/* Cloud */}
          <Path
            d="M6 14C4.34 14 3 12.66 3 11C3 9.34 4.34 8 6 8C6.09 8 6.18 8.01 6.27 8.02C6.65 6.25 8.16 5 10 5C11.06 5 12.02 5.44 12.71 6.15C13.17 6.06 13.64 6 14 6C16.76 6 19 8.24 19 11C19 13.76 16.76 16 14 16H6"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Snowflakes */}
          <Circle cx="8" cy="18" r="1" fill={color} />
          <Circle cx="12" cy="20" r="1" fill={color} />
          <Circle cx="16" cy="18" r="1" fill={color} />
        </Svg>
      );

    case 'weather-snowy-heavy':
      // Heavy snow / blizzard
      return (
        <Svg {...iconProps}>
          {/* Cloud */}
          <Path
            d="M6 12C4.34 12 3 10.66 3 9C3 7.34 4.34 6 6 6C6.09 6 6.18 6.01 6.27 6.02C6.65 4.25 8.16 3 10 3C11.06 3 12.02 3.44 12.71 4.15C13.17 4.06 13.64 4 14 4C16.76 4 19 6.24 19 9C19 11.76 16.76 14 14 14H6"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Many snowflakes */}
          <Circle cx="6" cy="16" r="1" fill={color} />
          <Circle cx="10" cy="17" r="1" fill={color} />
          <Circle cx="14" cy="16" r="1" fill={color} />
          <Circle cx="18" cy="17" r="1" fill={color} />
          <Circle cx="8" cy="20" r="1" fill={color} />
          <Circle cx="12" cy="21" r="1" fill={color} />
          <Circle cx="16" cy="20" r="1" fill={color} />
        </Svg>
      );

    case 'weather-lightning-rainy':
      // Thunderstorm
      return (
        <Svg {...iconProps}>
          {/* Cloud */}
          <Path
            d="M6 13C4.34 13 3 11.66 3 10C3 8.34 4.34 7 6 7C6.09 7 6.18 7.01 6.27 7.02C6.65 5.25 8.16 4 10 4C11.06 4 12.02 4.44 12.71 5.15C13.17 5.06 13.64 5 14 5C16.76 5 19 7.24 19 10C19 12.76 16.76 15 14 15H6"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Lightning bolt */}
          <Path
            d="M13 15L10 19H14L11 23"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'water-percent':
      // Humidity icon
      return (
        <Svg {...iconProps}>
          <Path
            d="M12 2C12 2 5 9 5 14C5 17.87 8.13 21 12 21C15.87 21 19 17.87 19 14C19 9 12 2 12 2Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M9 14L15 17M9 17L15 14"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'weather-windy':
      // Wind icon
      return (
        <Svg {...iconProps}>
          <Path
            d="M9.59 4.59A2 2 0 1111 8H2M12.59 19.41A2 2 0 1014 16H2M17.73 7.73A2.5 2.5 0 1119.5 12H2"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'map-marker':
      // Location marker
      return (
        <Svg {...iconProps}>
          <Path
            d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="12" cy="9" r="2.5" stroke={color} strokeWidth={sw} />
        </Svg>
      );

    case 'map-marker-check':
      // Location marker with checkmark
      return (
        <Svg {...iconProps}>
          <Path
            d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M9 9L11 11L15 7"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'map-marker-off':
      // Location marker crossed out (no locations)
      return (
        <Svg {...iconProps}>
          <Path
            d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M19 9C19 5.13 15.87 2 12 2"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M3 3L21 21"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'trash-can-outline':
      // Trash can / delete
      return (
        <Svg {...iconProps}>
          <Path
            d="M9 3V4H4V6H5V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V6H20V4H15V3H9Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M10 9V17M14 9V17"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'crosshairs-gps':
      // GPS / current location
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={sw} />
          <Path
            d="M12 2V6M12 18V22M2 12H6M18 12H22"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'magnify':
      // Search / magnifying glass
      return (
        <Svg {...iconProps}>
          <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={sw} />
          <Path
            d="M21 21L16.65 16.65"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'alert':
      // Warning / alert triangle
      return (
        <Svg {...iconProps}>
          <Path
            d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.3 1.56 18.65 1.59 18.99C1.62 19.34 1.76 19.67 1.99 19.94C2.22 20.2 2.52 20.4 2.86 20.5C3.2 20.6 3.56 20.6 3.91 20.5H20.09C20.44 20.6 20.8 20.6 21.14 20.5C21.48 20.4 21.78 20.2 22.01 19.94C22.24 19.67 22.38 19.34 22.41 18.99C22.44 18.65 22.36 18.3 22.18 18L13.71 3.86C13.53 3.56 13.27 3.32 12.96 3.15C12.65 2.99 12.32 2.9 11.99 2.9C11.66 2.9 11.34 2.99 11.03 3.15C10.72 3.32 10.47 3.56 10.29 3.86Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'radar':
      // Radar / rain radar - concentric arcs
      return (
        <Svg {...iconProps}>
          {/* Center dot */}
          <Circle cx="12" cy="20" r="2" fill={color} />
          {/* Inner arc */}
          <Path
            d="M8 16C9.1 14.9 10.5 14.2 12 14.2C13.5 14.2 14.9 14.9 16 16"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          {/* Middle arc */}
          <Path
            d="M5 13C6.8 11.2 9.3 10 12 10C14.7 10 17.2 11.2 19 13"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          {/* Outer arc */}
          <Path
            d="M2 10C4.5 7.5 8 5.8 12 5.8C16 5.8 19.5 7.5 22 10"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'camera-reverse':
      // Camera flip / switch camera
      return (
        <Svg {...iconProps}>
          <Path
            d="M3 9C3 7.89543 3.89543 7 5 7H6.5L8 5H16L17.5 7H19C20.1046 7 21 7.89543 21 9V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V9Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M9 13L12 10L15 13M15 14L12 17L9 14"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'checkmark':
      // Alias for check
      return (
        <Svg {...iconProps}>
          <Path
            d="M5 13L9 17L19 7"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'book-open':
      // Open book icon
      return (
        <Svg {...iconProps}>
          <Path
            d="M2 4V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V4"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M12 4V20"
            stroke={color}
            strokeWidth={sw}
          />
          <Path
            d="M2 4C4 6 7 7 12 7C17 7 20 6 22 4"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'clock':
      // Alias for time
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={sw} />
          <Path
            d="M12 6V12L16 14"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'alert-circle':
      // Alert with circle
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={sw} />
          <Path
            d="M12 8V12M12 16V16.01"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'document-text':
      // Document with text lines
      return (
        <Svg {...iconProps}>
          <Path
            d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M14 2V8H20M8 13H16M8 17H16M8 9H10"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'folder':
      // Folder icon
      return (
        <Svg {...iconProps}>
          <Path
            d="M22 19C22 20.1046 21.1046 21 20 21H4C2.89543 21 2 20.1046 2 19V5C2 3.89543 2.89543 3 4 3H9L11 6H20C21.1046 6 22 6.89543 22 8V19Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'trash':
      // Trash can
      return (
        <Svg {...iconProps}>
          <Path
            d="M3 6H5H21M19 6V20C19 21.1 18.1 22 17 22H7C5.9 22 5 21.1 5 20V6M8 6V4C8 2.9 8.9 2 10 2H14C15.1 2 16 2.9 16 4V6"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M10 11V17M14 11V17"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'external-link':
      // External link / open in new window
      return (
        <Svg {...iconProps}>
          <Path
            d="M18 13V19C18 20.1 17.1 21 16 21H5C3.9 21 3 20.1 3 19V8C3 6.9 3.9 6 5 6H11"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M15 3H21V9M10 14L21 3"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'globe':
      // Globe / world
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={sw} />
          <Path
            d="M3 12H21M12 3C14.5 5.5 15.5 8.5 15.5 12C15.5 15.5 14.5 18.5 12 21M12 3C9.5 5.5 8.5 8.5 8.5 12C8.5 15.5 9.5 18.5 12 21"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'headphones':
      // Headphones
      return (
        <Svg {...iconProps}>
          <Path
            d="M3 18V12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12V18"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Path
            d="M21 18C21 19.6569 19.6569 21 18 21H17C15.3431 21 14 19.6569 14 18V15C14 13.3431 15.3431 12 17 12H21V18Z"
            stroke={color}
            strokeWidth={sw}
          />
          <Path
            d="M3 18C3 19.6569 4.34315 21 6 21H7C8.65685 21 10 19.6569 10 18V15C10 13.3431 8.65685 12 7 12H3V18Z"
            stroke={color}
            strokeWidth={sw}
          />
        </Svg>
      );

    case 'headset':
      // Headset with microphone
      return (
        <Svg {...iconProps}>
          <Path
            d="M3 18V12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12V18"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Path
            d="M21 18C21 19.6569 19.6569 21 18 21H17C15.3431 21 14 19.6569 14 18V15C14 13.3431 15.3431 12 17 12H21V18Z"
            stroke={color}
            strokeWidth={sw}
          />
          <Path
            d="M3 18C3 19.6569 4.34315 21 6 21H7C8.65685 21 10 19.6569 10 18V15C10 13.3431 8.65685 12 7 12H3V18Z"
            stroke={color}
            strokeWidth={sw}
          />
          <Path
            d="M18 21V22C18 22.5304 17.7893 23.0391 17.4142 23.4142C17.0391 23.7893 16.5304 24 16 24H12"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'star':
      // Star
      return (
        <Svg {...iconProps}>
          <Path
            d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'gauge':
      // Speed / gauge / speedometer
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={sw} />
          <Path
            d="M12 7V12L15 15"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M5 12H6M18 12H19M12 5V6M7.05 7.05L7.76 7.76M16.95 7.05L16.24 7.76"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'appleMusic':
      // Apple Music logo - musical note with rounded corners
      return (
        <Svg {...iconProps}>
          {/* Musical note shape similar to Apple Music icon */}
          <Path
            d="M19 3V15.5C19 17.433 17.433 19 15.5 19C13.567 19 12 17.433 12 15.5C12 13.567 13.567 12 15.5 12C16.1 12 16.67 12.14 17.17 12.38V6.25L9 8.35V17.5C9 19.433 7.433 21 5.5 21C3.567 21 2 19.433 2 17.5C2 15.567 3.567 14 5.5 14C6.1 14 6.67 14.14 7.17 14.38V5.5L19 3Z"
            fill={color}
          />
        </Svg>
      );

    case 'shuffle':
      // Shuffle / random arrows
      return (
        <Svg {...iconProps}>
          <Path
            d="M14.83 13.41L13.42 14.82L16.59 17.99L13.41 21.17L14.83 22.58L19.42 18L14.83 13.41Z"
            fill={color}
          />
          <Path
            d="M14.83 1.41L19.42 5.99L14.83 10.58L13.41 9.17L15.59 7H11.17C10.5 7 9.92 7.28 9.5 7.72L4.09 15.28C3.66 15.72 3.09 16 2.41 16H2V18H2.41C3.09 18 3.66 17.72 4.09 17.28L9.5 9.72C9.92 9.28 10.5 9 11.17 9H15.59L13.42 11.17L14.83 12.58L19.42 8L14.83 3.41L14.83 1.41Z"
            fill={color}
          />
        </Svg>
      );

    case 'repeat':
      // Repeat / loop arrows
      return (
        <Svg {...iconProps}>
          <Path
            d="M17 17H7V14L3 18L7 22V19H19V13H17V17Z"
            fill={color}
          />
          <Path
            d="M7 7H17V10L21 6L17 2V5H5V11H7V7Z"
            fill={color}
          />
        </Svg>
      );

    case 'repeat-one':
      // Repeat one / loop single
      return (
        <Svg {...iconProps}>
          <Path
            d="M17 17H7V14L3 18L7 22V19H19V13H17V17Z"
            fill={color}
          />
          <Path
            d="M7 7H17V10L21 6L17 2V5H5V11H7V7Z"
            fill={color}
          />
          <Path
            d="M13 15V9H12L10 10V11H11.5V15H13Z"
            fill={color}
          />
        </Svg>
      );

    case 'heart-outline':
      // Heart outline (unfilled)
      return (
        <Svg {...iconProps}>
          <Path
            d="M12.1 18.55L12 18.65L11.89 18.55C7.14 14.24 4 11.39 4 8.5C4 6.5 5.5 5 7.5 5C9.04 5 10.54 6 11.07 7.36H12.93C13.46 6 14.96 5 16.5 5C18.5 5 20 6.5 20 8.5C20 11.39 16.86 14.24 12.1 18.55ZM16.5 3C14.76 3 13.09 3.81 12 5.08C10.91 3.81 9.24 3 7.5 3C4.42 3 2 5.41 2 8.5C2 12.27 5.4 15.36 10.55 20.03L12 21.35L13.45 20.03C18.6 15.36 22 12.27 22 8.5C22 5.41 19.58 3 16.5 3Z"
            fill={color}
          />
        </Svg>
      );

    case 'musical-notes':
      // Musical notes / beamed notes
      return (
        <Svg {...iconProps}>
          <Path
            d="M9 3V15.5C9 17.433 7.433 19 5.5 19C3.567 19 2 17.433 2 15.5C2 13.567 3.567 12 5.5 12C6.1 12 6.67 12.14 7.17 12.38V3H9Z"
            fill={color}
          />
          <Path
            d="M22 3V15.5C22 17.433 20.433 19 18.5 19C16.567 19 15 17.433 15 15.5C15 13.567 16.567 12 18.5 12C19.1 12 19.67 12.14 20.17 12.38V3H22Z"
            fill={color}
          />
          <Path
            d="M7 3H22V5H7V3Z"
            fill={color}
          />
        </Svg>
      );

    case 'grid':
      // 2x2 grid for "all" view
      return (
        <Svg {...iconProps}>
          <Rect x="3" y="3" width="8" height="8" rx="2" stroke={color} strokeWidth={sw} />
          <Rect x="13" y="3" width="8" height="8" rx="2" stroke={color} strokeWidth={sw} />
          <Rect x="3" y="13" width="8" height="8" rx="2" stroke={color} strokeWidth={sw} />
          <Rect x="13" y="13" width="8" height="8" rx="2" stroke={color} strokeWidth={sw} />
        </Svg>
      );

    case 'disc':
      // Vinyl disc / album
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="1" fill={color} />
        </Svg>
      );

    case 'shield-checkmark':
      // Shield with checkmark - compliance / security
      return (
        <Svg {...iconProps}>
          <Path
            d="M12 2L4 6V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V6L12 2Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M9 12L11 14L15 10"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'sun':
      // Sun - light theme
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth={sw} />
          <Path
            d="M12 2V4M12 20V22M2 12H4M20 12H22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'moon':
      // Moon - dark theme
      return (
        <Svg {...iconProps}>
          <Path
            d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'eye':
      // Eye - appearance / visibility
      return (
        <Svg {...iconProps}>
          <Path
            d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={sw} />
        </Svg>
      );

    case 'weather':
      // Weather - generic weather icon (cloud with sun)
      return (
        <Svg {...iconProps}>
          <Path
            d="M17.5 19H9C6.24 19 4 16.76 4 14C4 11.24 6.24 9 9 9C9.28 9 9.55 9.02 9.82 9.07C10.94 7.2 12.96 6 15.25 6C18.7 6 21.5 8.8 21.5 12.25C21.5 12.79 21.44 13.31 21.31 13.81"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="5" cy="5" r="2" stroke={color} strokeWidth={sw} />
          <Path
            d="M5 1V2M5 8V9M1 5H2M8 5H9M2.17 2.17L2.88 2.88M7.12 7.12L7.83 7.83M2.17 7.83L2.88 7.12M7.12 2.88L7.83 2.17"
            stroke={color}
            strokeWidth={sw * 0.8}
            strokeLinecap="round"
          />
        </Svg>
      );

    default:
      // Fallback: empty circle
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={sw} />
        </Svg>
      );
  }
}
