// Design Tokens — Spotify Inspired (dark-only)
import { Easing } from 'react-native-reanimated';

export const Colors = {
  // Brand
  primary:        '#1ed760',  // Spotify Green
  primaryMuted:   'rgba(30, 215, 96, 0.15)', // chips, fills, selected states
  accent:         '#1ed760',  // Alias for primary (backwards compat)

  // Backgrounds
  bg:             '#121212',  // Near Black
  bgCard:         '#181818',  // Dark Surface
  bgElevated:     '#1f1f1f',  // Mid Dark / interactive surfaces
  bgInput:        '#1f1f1f',
  bgCardMid:      '#272727',
  overlay:        'rgba(0, 0, 0, 0.5)',

  // Text
  textPrimary:    '#ffffff',  // White
  textSecondary:  '#b3b3b3',  // Silver
  textMuted:      '#7c7c7c',  // Muted
  textOnPrimary:  '#121212',  // Dark text on green surfaces

  // Semantic
  danger:         '#f3727f',  // Negative Red
  dangerMuted:    'rgba(243, 114, 127, 0.15)',
  warning:        '#ffa42b',  // Warning Orange
  announcement:   '#539df5',  // Announcement Blue

  // Macros
  protein:        '#f3727f',  // Reddish
  carbs:          '#ffa42b',  // Orangey
  fat:            '#539df5',  // Blueish
  calories:       '#1ed760',  // Green
  water:          '#539df5',

  // Utility
  border:         '#2a2a2a',  // hairline on cards
  borderStrong:   '#4d4d4d',  // inputs, dividers on elevated surfaces
  borderLight:    '#7c7c7c',
  white:          '#ffffff',
  black:          '#000000',
  transparent:    'transparent',
};

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
  xxxl: 64,
};

export const Radius = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  pill: 999,
};

export type TextVariant = 'hero' | 'title' | 'heading' | 'subheading' | 'body' | 'label' | 'caption';

export const Typography = {
  fontFamily: {
    regular:    'System',
    title:      'System',
  },
  size: {
    xs:    10,
    sm:    12,
    md:    14,
    lg:    16,
    xl:    18,
    xxl:   24,
    xxxl:  28,
    hero:  32,
  },
  // Precomputed line heights: ~1.2 for headings, ~1.45 for body sizes
  lineHeight: {
    xs:    14,
    sm:    17,
    md:    20,
    lg:    23,
    xl:    24,
    xxl:   29,
    xxxl:  34,
    hero:  38,
  },
  weight: {
    regular:    '400' as const,
    medium:     '500' as const,
    semibold:   '600' as const,
    bold:       '700' as const,
    heavy:      '800' as const,
  },
  letterSpacing: {
    button: 1.5,
    normal: 0,
  },
};

export const Shadows = {
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  heavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
};

// Motion tokens — consumed by every animation in the app.
// Curves per animate-expo: never ease-in on UI; springs when a finger was involved.
export const Motion = {
  duration: {
    press: 120,   // press feedback
    fast:  150,   // toggles, chips, small state changes
    base:  250,   // entrances, reveals
    slow:  400,   // progress fills, rings
  },
  easing: {
    out:    Easing.bezier(0.23, 1, 0.32, 1),     // entering/exiting
    inOut:  Easing.bezier(0.77, 0, 0.175, 1),    // on-screen movement
    sheet:  Easing.bezier(0.32, 0.72, 0, 1),     // iOS sheet curve
  },
  spring: {
    settle: { duration: 400, dampingRatio: 1 },     // no overshoot
    snappy: { duration: 400, dampingRatio: 0.8 },   // reposition/snap
    sheet:  { duration: 300, dampingRatio: 0.8 },
  },
};
