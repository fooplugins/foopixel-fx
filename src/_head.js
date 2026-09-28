/*!
 * FooPixel FX v1.0.0
 * Pixel hover effects for drop zones and buttons, drawn from the FooPixel logo.
 * Effects: breakaway, uplink, dither, trace.
 * (c) FooPlugins
 */
const PixelFX = (() => {
  "use strict";

  const VERSION = "1.0.0";
  const hasWindow = typeof window !== "undefined";
  const reduce = hasWindow && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  const DEFAULT_COLORS = {
    brand: ["#2e68ff", "#35ceff"], // logo blue -> cyan, lifted for dark backgrounds
    light: ["#c4deff", "#ffffff"], // used on filled buttons (data-pixel-fill="light")
    pulse: "#35c6f4",              // uplink icon ring
  };

  const config = {
    density: 1,
    speed: 1,
    respectReducedMotion: true,
    maxDpr: 2,
    colors: { brand: [...DEFAULT_COLORS.brand], light: [...DEFAULT_COLORS.light], pulse: DEFAULT_COLORS.pulse },
  };

