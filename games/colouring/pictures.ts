/**
 * Colouring pictures for the kids colouring game: each picture is a few big
 * tappable regions built from simple shapes (no SVG). Coordinates are 0…1
 * fractions of a square canvas; later regions are drawn on top (and take
 * the taps where boxes overlap, so put triangles before what they touch). `decor`
 * parts (eyes, ropes) are drawn in the outline colour and are not tappable.
 */

export type KidsRegionKind = "ellipse" | "rect" | "triangle";

export interface KidsRegion {
  h: number;
  kind: KidsRegionKind;
  /** Corner radius as a fraction of the canvas (rect only). */
  r?: number;
  /** Clockwise rotation in degrees (triangles point up at 0). */
  rotate?: number;
  w: number;
  x: number;
  y: number;
}

export interface KidsPicture {
  decor: readonly KidsRegion[];
  /** What the picture is (shown to screen readers only). */
  emoji: string;
  id: string;
  regions: readonly KidsRegion[];
}

export const KIDS_PICTURES: readonly KidsPicture[] = [
  {
    decor: [],
    emoji: "🏠",
    id: "house",
    regions: [
      { h: 0.3, kind: "triangle", w: 0.76, x: 0.12, y: 0.12 },
      { h: 0.22, kind: "ellipse", w: 0.22, x: 0.74, y: 0.03 },
      { h: 0.48, kind: "rect", r: 0.02, w: 0.64, x: 0.18, y: 0.42 },
      { h: 0.2, kind: "rect", r: 0.02, w: 0.2, x: 0.24, y: 0.5 },
      { h: 0.3, kind: "rect", r: 0.02, w: 0.2, x: 0.52, y: 0.6 },
    ],
  },
  {
    decor: [{ h: 0.07, kind: "ellipse", w: 0.07, x: 0.73, y: 0.4 }],
    emoji: "🐟",
    id: "fish",
    regions: [
      { h: 0.22, kind: "ellipse", w: 0.24, x: 0.44, y: 0.12 },
      { h: 0.34, kind: "triangle", rotate: 90, w: 0.34, x: 0.04, y: 0.33 },
      { h: 0.5, kind: "ellipse", w: 0.62, x: 0.3, y: 0.25 },
    ],
  },
  {
    decor: [{ h: 0.08, kind: "ellipse", w: 0.06, x: 0.84, y: 0.47 }],
    emoji: "✈️",
    id: "plane",
    regions: [
      { h: 0.8, kind: "rect", r: 0.06, w: 0.2, x: 0.42, y: 0.1 },
      { h: 0.44, kind: "rect", r: 0.05, w: 0.16, x: 0.08, y: 0.29 },
      { h: 0.2, kind: "rect", r: 0.1, w: 0.86, x: 0.07, y: 0.41 },
    ],
  },
  {
    decor: [
      { h: 0.16, kind: "rect", w: 0.012, x: 0.405, y: 0.64 },
      { h: 0.16, kind: "rect", w: 0.012, x: 0.583, y: 0.64 },
    ],
    emoji: "🎈",
    id: "balloon",
    regions: [
      { h: 0.62, kind: "ellipse", w: 0.66, x: 0.17, y: 0.03 },
      { h: 0.62, kind: "ellipse", w: 0.2, x: 0.4, y: 0.03 },
      { h: 0.17, kind: "rect", r: 0.03, w: 0.26, x: 0.37, y: 0.8 },
    ],
  },
];
