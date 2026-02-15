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
  | 'camera'
  | 'check'
  | 'language'
  | 'settings'
  | 'group'
  | 'chat'
  | 'call'
  | 'info';

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

    default:
      // Fallback: empty circle
      return (
        <Svg {...iconProps}>
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={sw} />
        </Svg>
      );
  }
}
