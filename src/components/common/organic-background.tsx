import { Image } from 'expo-image';
import { StyleSheet, View, type DimensionValue, type ImageStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { assets } from '@/constants/theme';
import { useDrift } from './motion';

const AnimatedImage = Animated.createAnimatedComponent(Image);

type Variant = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
type AssetKey = keyof typeof assets;

type Layer = {
  asset: AssetKey;
  width: DimensionValue;
  height: DimensionValue;
  top?: DimensionValue;
  bottom?: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  opacity: number;
  /** Resting angle; the drift oscillates around it. */
  baseRotate?: number;
  drift: { x: number; y: number; rotate: number; scale: number; duration: number; delay?: number };
};

// These mirror the onboarding scenery, which is the reference the auth screens
// are meant to match. Two rules carry that look:
//
//   1. Depth comes from PALE shapes stacked, not from one saturated mass.
//      shape3 has a near-black forest lobe, so it only ever appears as a
//      small accent, never as the dominant corner. Opacities sit high enough
//      (0.45-0.85) that the green reads as green — too low and the cream
//      background desaturates them until they look like cream on cream.
//   2. Corners anchor past the edge and clip, so they read as the canvas
//      continuing rather than as blobs sitting on top of it.
const CORNER_TOP_LEFT: Layer = {
  asset: 'shape1', width: 262, height: 244, left: -78, top: -26, opacity: 0.66, baseRotate: 22,
  drift: { x: 30, y: 22, rotate: 5, scale: 0.05, duration: 7200 },
};
const CORNER_TOP_RIGHT: Layer = {
  asset: 'shape2', width: 248, height: 248, right: -72, top: -18, opacity: 0.62, baseRotate: -28,
  drift: { x: -26, y: 32, rotate: -5, scale: 0.045, duration: 8800, delay: 400 },
};
const MID_LEFT_LEAF: Layer = {
  asset: 'shape3', width: 235, height: 235, left: -112, bottom: '30%', opacity: 0.42, baseRotate: -32,
  drift: { x: 34, y: -28, rotate: 6, scale: 0.05, duration: 6500, delay: 900 },
};
const MID_RIGHT_LEAF: Layer = {
  asset: 'shape1', width: 205, height: 195, right: -96, bottom: '24%', opacity: 0.4, baseRotate: 154,
  drift: { x: -28, y: 26, rotate: -5.5, scale: 0.045, duration: 7900, delay: 1200 },
};
const BOTTOM_LANDSCAPE: Layer = {
  asset: 'shape5', width: '155%', height: 288, left: '-27%', bottom: -74, opacity: 0.85, baseRotate: -4,
  drift: { x: 16, y: -10, rotate: 1.4, scale: 0.02, duration: 12400 },
};
const BOTTOM_LANDSCAPE_FRONT: Layer = {
  asset: 'shape4', width: '138%', height: 238, left: '-19%', bottom: -84, opacity: 0.66, baseRotate: 6,
  drift: { x: -18, y: 12, rotate: -1.8, scale: 0.025, duration: 10600, delay: 800 },
};
const BOTTOM_ACCENT: Layer = {
  asset: 'shape3', width: 158, height: 158, right: -48, bottom: -22, opacity: 0.45, baseRotate: -38,
  drift: { x: 12, y: -14, rotate: 3, scale: 0.04, duration: 8300, delay: 500 },
};

// Screens share the vocabulary but not the exact arrangement, so they feel
// related without looking copy-pasted.
const COMPOSITIONS: Record<Variant, Layer[]> = {
  // 1 — Sign In (roomy): the full composition.
  1: [CORNER_TOP_LEFT, CORNER_TOP_RIGHT, MID_LEFT_LEAF, BOTTOM_LANDSCAPE, BOTTOM_LANDSCAPE_FRONT, BOTTOM_ACCENT],

  // 2 — Create New Password: mirrored weight, leaf on the right.
  2: [
    { ...CORNER_TOP_LEFT, width: 212, height: 200, left: -64, opacity: 0.54 },
    { ...CORNER_TOP_RIGHT, width: 272, height: 268, opacity: 0.68 },
    MID_RIGHT_LEAF,
    BOTTOM_LANDSCAPE,
    BOTTOM_LANDSCAPE_FRONT,
  ],

  // 3 — Forgot Password: a single field, so the middle can carry a little more.
  3: [CORNER_TOP_LEFT, CORNER_TOP_RIGHT, MID_RIGHT_LEAF, BOTTOM_LANDSCAPE, BOTTOM_LANDSCAPE_FRONT, BOTTOM_ACCENT],

  // 4 — dashboard and the app screens that share its language. Scenery is
  // distributed down both edges rather than massed in one corner, so the page
  // feels decorated the whole way down like the auth screens do. Opacities run
  // lower than variant 1 because real data sits on top of this one: the shapes
  // read through the gaps between cards, never behind a number.
  4: [
    // Large soft form behind the header.
    {
      asset: 'shape3', width: 330, height: 306, right: -126, top: -82, opacity: 0.44, baseRotate: -28,
      drift: { x: -16, y: 18, rotate: -2.4, scale: 0.025, duration: 11800 },
    },
    // Second top-right pass for depth.
    {
      asset: 'shape2', width: 258, height: 246, right: -74, top: -58, opacity: 0.3, baseRotate: -28,
      drift: { x: 14, y: -14, rotate: 2, scale: 0.02, duration: 13600, delay: 700 },
    },
    // Top-left counterweight so the header isn't lopsided.
    {
      asset: 'shape6', width: 196, height: 184, left: -76, top: -46, opacity: 0.3, baseRotate: 16,
      drift: { x: 20, y: 16, rotate: 3.4, scale: 0.035, duration: 9400, delay: 1100 },
    },
    // Clipped leaf beside the summary card.
    {
      asset: 'shape1', width: 224, height: 214, left: -114, top: '27%', opacity: 0.26, baseRotate: -34,
      drift: { x: 26, y: -20, rotate: 4.2, scale: 0.04, duration: 8600, delay: 300 },
    },
    // Small orb level with the metric row.
    {
      asset: 'shape5', width: 132, height: 126, right: -46, top: '45%', opacity: 0.24, baseRotate: -18,
      drift: { x: -22, y: 22, rotate: -4, scale: 0.045, duration: 7800, delay: 1600 },
    },
    // Low accent behind the category grid.
    {
      asset: 'shape6', width: 168, height: 158, left: -58, bottom: '19%', opacity: 0.22, baseRotate: 140,
      drift: { x: 18, y: 18, rotate: -3, scale: 0.035, duration: 10200, delay: 900 },
    },
    // Ground around and behind the floating navbar.
    { ...BOTTOM_LANDSCAPE, height: 268, bottom: -92, opacity: 0.58 },
    { ...BOTTOM_LANDSCAPE_FRONT, bottom: -104, opacity: 0.38 },
    { ...BOTTOM_ACCENT, asset: 'shape6', right: -54, bottom: -26, opacity: 0.34 },
  ],

  // 5 — Create Account: alternating edge accents follow the intro, email,
  // password and footer zones while keeping the form's centre readable.
  5: [
    {
      asset: 'shape6', width: 194, height: 176, left: -74, top: -48, opacity: 0.42, baseRotate: 18,
      drift: { x: 24, y: 22, rotate: 4.5, scale: 0.045, duration: 7600 },
    },
    {
      asset: 'shape2', width: 232, height: 226, right: -78, top: -24, opacity: 0.58, baseRotate: -24,
      drift: { x: -28, y: 30, rotate: -5, scale: 0.05, duration: 8900, delay: 450 },
    },
    {
      asset: 'shape1', width: 150, height: 140, right: -34, top: '25%', opacity: 0.4, baseRotate: 198,
      drift: { x: -30, y: 24, rotate: 5.5, scale: 0.05, duration: 6700, delay: 900 },
    },
    {
      asset: 'shape3', width: 158, height: 150, left: -62, top: '43%', opacity: 0.34, baseRotate: -24,
      drift: { x: 34, y: -26, rotate: 6, scale: 0.045, duration: 8100, delay: 1300 },
    },
    {
      asset: 'shape5', width: 152, height: 142, right: -30, top: '56%', opacity: 0.48, baseRotate: -20,
      drift: { x: -28, y: 28, rotate: -5, scale: 0.05, duration: 7200, delay: 650 },
    },
    {
      asset: 'shape4', width: 300, height: 208, left: -86, bottom: -72, opacity: 0.68, baseRotate: -8,
      drift: { x: 26, y: -18, rotate: 2.8, scale: 0.03, duration: 10400, delay: 300 },
    },
  ],

  6: [
    { ...CORNER_TOP_LEFT, asset: 'shape6', opacity: 0.58 },
    { ...CORNER_TOP_RIGHT, asset: 'shape5', opacity: 0.56 },
    MID_LEFT_LEAF,
    BOTTOM_LANDSCAPE,
    BOTTOM_ACCENT,
  ],

  // 7 — Transactions. Strong layered top-right mass like the reference,
  // with independent accents down both edges and around the fixed navbar.
  7: [
    {
      asset: 'shape3', width: 338, height: 326, right: -132, top: -92, opacity: 0.62, baseRotate: -26,
      drift: { x: 14, y: 18, rotate: 3, scale: 0.045, duration: 6100 },
    },
    {
      asset: 'shape2', width: 282, height: 270, right: -74, top: -62, opacity: 0.46, baseRotate: -22,
      drift: { x: -18, y: 15, rotate: -3.5, scale: 0.04, duration: 4900, delay: 360 },
    },
    {
      asset: 'shape6', width: 130, height: 122, right: 96, top: 38, opacity: 0.52, baseRotate: 34,
      drift: { x: 16, y: -18, rotate: 7, scale: 0.07, duration: 3200, delay: 820 },
    },
    {
      asset: 'shape1', width: 228, height: 218, left: -130, top: '19%', opacity: 0.42, baseRotate: -22,
      drift: { x: 20, y: -16, rotate: 4, scale: 0.045, duration: 5400, delay: 600 },
    },
    {
      asset: 'shape5', width: 142, height: 136, right: -54, top: '46%', opacity: 0.34, baseRotate: 150,
      drift: { x: -22, y: 18, rotate: -6, scale: 0.06, duration: 3700, delay: 1200 },
    },
    {
      asset: 'shape6', width: 178, height: 168, left: -82, bottom: '18%', opacity: 0.38, baseRotate: 126,
      drift: { x: 18, y: 20, rotate: 5, scale: 0.055, duration: 4500, delay: 260 },
    },
    { ...BOTTOM_LANDSCAPE, bottom: -98, opacity: 0.7, drift: { x: 12, y: -16, rotate: 2, scale: 0.03, duration: 6800 } },
    { ...BOTTOM_LANDSCAPE_FRONT, bottom: -108, opacity: 0.5, drift: { x: -16, y: 14, rotate: -2.5, scale: 0.035, duration: 5700, delay: 720 } },
    { ...BOTTOM_ACCENT, left: undefined, right: -52, bottom: -16, opacity: 0.48, drift: { x: 14, y: -20, rotate: 6, scale: 0.06, duration: 3500, delay: 1100 } },
  ],

  // 8 — Transaction details. Similar palette, different rhythm and placement
  // so navigation feels continuous without looking like a frozen backdrop.
  8: [
    {
      asset: 'shape3', width: 344, height: 332, right: -136, top: -104, opacity: 0.64, baseRotate: -30,
      drift: { x: 13, y: 19, rotate: 3, scale: 0.045, duration: 6400 },
    },
    {
      asset: 'shape2', width: 274, height: 266, right: -66, top: -54, opacity: 0.42, baseRotate: -26,
      drift: { x: -17, y: -15, rotate: -3.5, scale: 0.04, duration: 5100, delay: 480 },
    },
    {
      asset: 'shape6', width: 126, height: 118, right: 92, top: 64, opacity: 0.5, baseRotate: 42,
      drift: { x: 17, y: -20, rotate: 7, scale: 0.07, duration: 3000, delay: 900 },
    },
    {
      asset: 'shape1', width: 252, height: 242, left: -142, top: '34%', opacity: 0.46, baseRotate: -30,
      drift: { x: 19, y: 18, rotate: 4.5, scale: 0.05, duration: 5200, delay: 540 },
    },
    {
      asset: 'shape5', width: 138, height: 132, right: -44, top: '58%', opacity: 0.34, baseRotate: 156,
      drift: { x: -21, y: 18, rotate: -6, scale: 0.06, duration: 3600, delay: 1250 },
    },
    { ...BOTTOM_LANDSCAPE, bottom: -104, opacity: 0.66, drift: { x: 14, y: -16, rotate: 2, scale: 0.03, duration: 6700 } },
    { ...BOTTOM_LANDSCAPE_FRONT, bottom: -112, opacity: 0.48, drift: { x: -16, y: 14, rotate: -2.5, scale: 0.035, duration: 5500, delay: 680 } },
    {
      asset: 'shape6', width: 150, height: 142, left: -48, bottom: -22, opacity: 0.48, baseRotate: 24,
      drift: { x: 15, y: -18, rotate: 6, scale: 0.06, duration: 3400, delay: 1020 },
    },
  ],
  // 9 — Budget: strong reference-style top-right flow, balanced edge accents.
  9: [
    { asset: 'shape3', width: 350, height: 338, right: -142, top: -102, opacity: 0.64, baseRotate: -27, drift: { x: 14, y: 19, rotate: 3, scale: 0.045, duration: 6300 } },
    { asset: 'shape2', width: 282, height: 270, right: -72, top: -58, opacity: 0.44, baseRotate: -23, drift: { x: -18, y: 16, rotate: -3.5, scale: 0.04, duration: 5000, delay: 420 } },
    { asset: 'shape6', width: 128, height: 120, right: 102, top: 46, opacity: 0.5, baseRotate: 36, drift: { x: 17, y: -19, rotate: 7, scale: 0.07, duration: 3100, delay: 860 } },
    { asset: 'shape1', width: 240, height: 230, left: -132, top: '22%', opacity: 0.43, baseRotate: -27, drift: { x: 21, y: -18, rotate: 4.5, scale: 0.05, duration: 5300, delay: 580 } },
    { asset: 'shape5', width: 144, height: 138, right: -50, top: '53%', opacity: 0.35, baseRotate: 152, drift: { x: -22, y: 19, rotate: -6, scale: 0.06, duration: 3650, delay: 1180 } },
    { asset: 'shape6', width: 174, height: 164, left: -76, bottom: '16%', opacity: 0.4, baseRotate: 128, drift: { x: 18, y: 20, rotate: 5, scale: 0.055, duration: 4400, delay: 300 } },
    { ...BOTTOM_LANDSCAPE, bottom: -98, opacity: 0.7, drift: { x: 13, y: -16, rotate: 2, scale: 0.03, duration: 6800 } },
    { ...BOTTOM_LANDSCAPE_FRONT, bottom: -108, opacity: 0.5, drift: { x: -16, y: 15, rotate: -2.5, scale: 0.035, duration: 5600, delay: 700 } },
  ],
  // 10 — Categories: more small leaves distributed down the long list.
  10: [
    { asset: 'shape3', width: 346, height: 334, right: -140, top: -106, opacity: 0.63, baseRotate: -29, drift: { x: 14, y: 19, rotate: 3, scale: 0.045, duration: 6200 } },
    { asset: 'shape2', width: 278, height: 268, right: -70, top: -56, opacity: 0.43, baseRotate: -25, drift: { x: -18, y: 16, rotate: -3.5, scale: 0.04, duration: 4950, delay: 440 } },
    { asset: 'shape6', width: 120, height: 114, left: -24, top: 34, opacity: 0.5, baseRotate: 30, drift: { x: 16, y: -20, rotate: 7, scale: 0.07, duration: 3000, delay: 760 } },
    { asset: 'shape1', width: 154, height: 146, right: -54, top: '25%', opacity: 0.38, baseRotate: 148, drift: { x: -22, y: 18, rotate: -6, scale: 0.06, duration: 3600, delay: 1160 } },
    { asset: 'shape6', width: 142, height: 134, left: -54, top: '48%', opacity: 0.38, baseRotate: -30, drift: { x: 21, y: -18, rotate: 6, scale: 0.06, duration: 3900, delay: 520 } },
    { asset: 'shape5', width: 142, height: 136, right: -44, top: '68%', opacity: 0.36, baseRotate: 156, drift: { x: -20, y: 19, rotate: -6, scale: 0.06, duration: 3450, delay: 1280 } },
    { ...BOTTOM_LANDSCAPE, bottom: -96, opacity: 0.72, drift: { x: 13, y: -17, rotate: 2, scale: 0.03, duration: 6800 } },
    { ...BOTTOM_LANDSCAPE_FRONT, bottom: -108, opacity: 0.5, drift: { x: -16, y: 15, rotate: -2.5, scale: 0.035, duration: 5550, delay: 720 } },
  ],
  // 11 — Analytics: broad corner anchors with quick, independent leaves in
  // the open gaps around the chart. Nothing sits directly behind chart data.
  11: [
    { asset: 'shape3', width: 352, height: 338, right: -144, top: -108, opacity: 0.64, baseRotate: -28, drift: { x: 18, y: 22, rotate: 4, scale: 0.05, duration: 4300 } },
    { asset: 'shape2', width: 278, height: 266, right: -68, top: -54, opacity: 0.44, baseRotate: -24, drift: { x: -22, y: 18, rotate: -4, scale: 0.045, duration: 3500, delay: 380 } },
    { asset: 'shape6', width: 126, height: 118, left: -28, top: '14%', opacity: 0.5, baseRotate: 28, drift: { x: 22, y: -23, rotate: 8, scale: 0.075, duration: 2600, delay: 640 } },
    { asset: 'shape1', width: 176, height: 166, right: -72, top: '43%', opacity: 0.38, baseRotate: 150, drift: { x: -26, y: 22, rotate: -7, scale: 0.065, duration: 3100, delay: 980 } },
    { asset: 'shape5', width: 152, height: 144, left: -62, top: '65%', opacity: 0.38, baseRotate: -28, drift: { x: 24, y: -20, rotate: 7, scale: 0.065, duration: 2900, delay: 320 } },
    { ...BOTTOM_LANDSCAPE, bottom: -96, opacity: 0.7, drift: { x: 15, y: -19, rotate: 2.5, scale: 0.035, duration: 4800 } },
    { ...BOTTOM_LANDSCAPE_FRONT, bottom: -108, opacity: 0.5, drift: { x: -18, y: 17, rotate: -3, scale: 0.04, duration: 3900, delay: 620 } },
  ],
  // 12 — Insights: its own alternating edge rhythm and a clear top-right
  // pocket for the mascot, with faster accents that make the page feel alive.
  12: [
    { asset: 'shape3', width: 334, height: 322, right: -150, top: -126, opacity: 0.62, baseRotate: -34, drift: { x: 19, y: 23, rotate: 4.5, scale: 0.05, duration: 4200 } },
    { asset: 'shape2', width: 260, height: 250, right: -80, top: -60, opacity: 0.42, baseRotate: -28, drift: { x: -22, y: 17, rotate: -4, scale: 0.045, duration: 3400, delay: 420 } },
    { asset: 'shape1', width: 214, height: 204, left: -118, top: '18%', opacity: 0.44, baseRotate: -25, drift: { x: 25, y: -21, rotate: 6, scale: 0.06, duration: 3000, delay: 720 } },
    { asset: 'shape6', width: 138, height: 130, right: -46, top: '42%', opacity: 0.4, baseRotate: 142, drift: { x: -24, y: 23, rotate: -8, scale: 0.07, duration: 2700, delay: 1100 } },
    { asset: 'shape5', width: 150, height: 142, left: -56, top: '64%', opacity: 0.4, baseRotate: -34, drift: { x: 24, y: -22, rotate: 7, scale: 0.065, duration: 2850, delay: 280 } },
    { asset: 'shape6', width: 132, height: 124, right: -34, bottom: '15%', opacity: 0.38, baseRotate: 46, drift: { x: -21, y: -22, rotate: 8, scale: 0.07, duration: 2550, delay: 840 } },
    { ...BOTTOM_LANDSCAPE, bottom: -98, opacity: 0.7, drift: { x: 15, y: -19, rotate: 2.5, scale: 0.035, duration: 4700 } },
    { ...BOTTOM_LANDSCAPE_FRONT, bottom: -110, opacity: 0.5, drift: { x: -18, y: 17, rotate: -3, scale: 0.04, duration: 3800, delay: 600 } },
  ],

  // 13 — Profile & Settings. The reference leads with a heavy top-right flow
  // and leaf accents beside the title, then keeps scenery running down both
  // edges so the long settings list never sits on an empty canvas. Accents move
  // on short, independent cycles so the page reads as alive rather than drifting.
  13: [
    // Top-right mass behind the title, as in the reference.
    { asset: 'shape3', width: 348, height: 334, right: -132, top: -118, opacity: 0.6, baseRotate: -30, drift: { x: 20, y: 24, rotate: 4.5, scale: 0.05, duration: 4100 } },
    { asset: 'shape2', width: 266, height: 256, right: -64, top: -48, opacity: 0.42, baseRotate: -22, drift: { x: -23, y: 18, rotate: -4.5, scale: 0.045, duration: 3300, delay: 360 } },
    // Leaf accents flanking the heading.
    { asset: 'shape6', width: 124, height: 116, right: 22, top: '7%', opacity: 0.52, baseRotate: 34, drift: { x: -18, y: 21, rotate: 9, scale: 0.08, duration: 2500, delay: 560 } },
    { asset: 'shape6', width: 96, height: 90, left: -22, top: '12%', opacity: 0.44, baseRotate: -18, drift: { x: 20, y: -19, rotate: -8, scale: 0.075, duration: 2750, delay: 900 } },
    // Side accents running past the settings rows.
    { asset: 'shape1', width: 196, height: 186, left: -110, top: '34%', opacity: 0.36, baseRotate: -28, drift: { x: 24, y: -22, rotate: 6.5, scale: 0.06, duration: 3050, delay: 240 } },
    { asset: 'shape5', width: 146, height: 138, right: -58, top: '52%', opacity: 0.36, baseRotate: -24, drift: { x: -25, y: 22, rotate: -7, scale: 0.065, duration: 2900, delay: 1180 } },
    { asset: 'shape6', width: 118, height: 110, left: -34, top: '72%', opacity: 0.38, baseRotate: 128, drift: { x: 21, y: 20, rotate: 8, scale: 0.07, duration: 2650, delay: 700 } },
    // Ground behind the logout action and the floating navbar.
    { ...BOTTOM_LANDSCAPE, bottom: -96, opacity: 0.68, drift: { x: 16, y: -18, rotate: 2.5, scale: 0.035, duration: 4600 } },
    { ...BOTTOM_LANDSCAPE_FRONT, bottom: -108, opacity: 0.48, drift: { x: -18, y: 17, rotate: -3, scale: 0.04, duration: 3700, delay: 580 } },
  ],

  // 14 — Swipeable app shell. This stays mounted while the user moves between
  // Home, Transactions, Analytics and Budget, so its independently timed
  // layers keep moving through a carousel transition instead of restarting.
  // The accents are spread down the full canvas and use the quicker rhythm the
  // user approved on Analytics/Insights.
  14: [
    { asset: 'shape3', width: 352, height: 338, right: -144, top: -110, opacity: 0.62, baseRotate: -29, drift: { x: 22, y: 25, rotate: 5, scale: 0.055, duration: 3900 } },
    { asset: 'shape2', width: 278, height: 266, right: -68, top: -54, opacity: 0.44, baseRotate: -23, drift: { x: -25, y: 20, rotate: -5, scale: 0.05, duration: 3150, delay: 340 } },
    { asset: 'shape6', width: 118, height: 110, left: -22, top: '12%', opacity: 0.5, baseRotate: 28, drift: { x: 24, y: -24, rotate: 9, scale: 0.08, duration: 2350, delay: 680 } },
    { asset: 'shape1', width: 210, height: 200, left: -120, top: '31%', opacity: 0.4, baseRotate: -27, drift: { x: 27, y: -23, rotate: 7, scale: 0.065, duration: 2850, delay: 220 } },
    { asset: 'shape5', width: 148, height: 140, right: -54, top: '48%', opacity: 0.38, baseRotate: 152, drift: { x: -27, y: 24, rotate: -8, scale: 0.07, duration: 2550, delay: 980 } },
    { asset: 'shape6', width: 132, height: 124, left: -42, top: '66%', opacity: 0.4, baseRotate: 126, drift: { x: 23, y: 22, rotate: 8, scale: 0.075, duration: 2450, delay: 520 } },
    { asset: 'shape1', width: 142, height: 134, right: -48, bottom: '14%', opacity: 0.36, baseRotate: 164, drift: { x: -24, y: -22, rotate: -8, scale: 0.07, duration: 2700, delay: 1240 } },
    { ...BOTTOM_LANDSCAPE, bottom: -96, opacity: 0.7, drift: { x: 17, y: -20, rotate: 2.8, scale: 0.04, duration: 4400 } },
    { ...BOTTOM_LANDSCAPE_FRONT, bottom: -108, opacity: 0.5, drift: { x: -20, y: 18, rotate: -3.2, scale: 0.045, duration: 3500, delay: 560 } },
  ],
};

function OrganicLayer({ layer }: { layer: Layer }) {
  // Resting angle goes through the hook: a separate static transform would be
  // overridden by the animated one.
  const drift = useDrift({ ...layer.drift, baseRotate: layer.baseRotate ?? 0 });

  const placement: ImageStyle = {
    position: 'absolute',
    width: layer.width,
    height: layer.height,
    opacity: layer.opacity,
  };
  if (layer.top !== undefined) placement.top = layer.top;
  if (layer.bottom !== undefined) placement.bottom = layer.bottom;
  if (layer.left !== undefined) placement.left = layer.left;
  if (layer.right !== undefined) placement.right = layer.right;

  return (
    <AnimatedImage
      source={assets[layer.asset]}
      contentFit="contain"
      style={[placement, drift]}
      pointerEvents="none"
    />
  );
}

export function OrganicBackground({ variant = 1 }: { variant?: Variant }) {
  // Inert and clipped: decoration can never intercept a touch, shift layout,
  // or bleed past the mobile canvas.
  return (
    <View pointerEvents="none" style={styles.layer}>
      {COMPOSITIONS[variant].map((layer, i) => (
        <OrganicLayer key={`${layer.asset}-${i}`} layer={layer} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
});
