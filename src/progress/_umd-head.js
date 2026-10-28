/*!
 * FooPixel FX Progress v1.3.0
 * Pixel progress bars for FooPixel FX. Load it after foopixel-fx.
 * Styles: segments, dither, chomper, blocks, snake, hearts, lcd, beam, ring, battery, mosaic, tank, scanner.
 * (c) FooPlugins
 */
(function () {
  const PixelFX = typeof window !== "undefined" ? window.PixelFX : undefined;
  if (!PixelFX || !PixelFX.settings) {
    if (typeof console !== "undefined") console.error("PixelFX.progress: load foopixel-fx (v1.3.0 or later) before foopixel-fx-progress.");
    return;
  }
