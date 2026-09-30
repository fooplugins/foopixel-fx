/*!
 * FooPixel FX v1.1.1
 * Pixel hover effects and bursts for drop zones and buttons, drawn from the FooPixel logo.
 * Effects: breakaway, uplink, dither, trace.
 * Bursts: burst, confetti, shatter, shockwave, firework, starburst, rain, gather.
 * (c) FooPlugins
 */
const PixelFX = (() => {
  "use strict";

  const VERSION = "1.1.1";
  const hasWindow = typeof window !== "undefined";
  const reduce = hasWindow && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  // Colour schemes. brand: the main gradient; light: pale pixels for filled buttons
  // and burst sparks; pulse: the Uplink icon ring. The neon ones suit dark backgrounds.
  const SCHEMES = {
    foopixel:    { brand: ["#2e68ff", "#35ceff"], light: ["#c4deff", "#ffffff"], pulse: "#35c6f4" }, // logo blue -> cyan
    synthwave:   { brand: ["#ff2bd6", "#8f5bff"], light: ["#ffc6f3", "#ffffff"], pulse: "#ff5ce1" }, // hot pink -> violet
    cyberpunk:   { brand: ["#fcee0a", "#ff2a6d"], light: ["#fff9b8", "#ffffff"], pulse: "#fcee0a" }, // yellow -> hot pink
    toxic:       { brand: ["#2bff88", "#d4ff1f"], light: ["#cbffe0", "#ffffff"], pulse: "#39ff14" }, // green -> lime
    sunset:      { brand: ["#ff3c6f", "#ffb02e"], light: ["#ffd3c6", "#ffffff"], pulse: "#ff7a45" }, // pink -> amber
    aurora:      { brand: ["#00ffa3", "#00d0ff"], light: ["#c2ffe8", "#ffffff"], pulse: "#00ffc8" }, // mint -> aqua
    ultraviolet: { brand: ["#6a2cff", "#e040ff"], light: ["#e3d0ff", "#ffffff"], pulse: "#b44dff" }, // indigo -> orchid
  };
  const copyScheme = (c) => ({ brand: [...c.brand], light: [...c.light], pulse: c.pulse });
  const DEFAULT_COLORS = SCHEMES.foopixel;

  const config = {
    density: 1,
    speed: 1,
    respectReducedMotion: true,
    maxDpr: 2,
    scheme: "foopixel",
    colors: copyScheme(DEFAULT_COLORS),
  };

