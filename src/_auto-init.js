
  if (typeof window !== "undefined") {
    window.PixelFX = PixelFX;
    const me = document.currentScript;
    if (!(me && me.hasAttribute("data-manual"))) {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => PixelFX.scan());
      else PixelFX.scan();
    }
  }
})();
