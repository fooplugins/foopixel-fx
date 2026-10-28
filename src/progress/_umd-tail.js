
  PixelFX.progress = progress;
  const me = document.currentScript;
  if (!(me && me.hasAttribute("data-manual"))) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => progress.scan());
    else progress.scan();
  }
})();
