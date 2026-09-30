
  /* ---------- Instance: canvas, input, lifecycle ---------- */
  const instances = new WeakMap();
  const live = new Set();

  const DEFAULTS = {
    preset: "zone",
    fill: null,
    density: 1,
    speed: 1,
    target: "[data-pixel-icon], .upload-symbol",
    avoid: "[data-pixel-text], .empty-upload",
    pulse: true,
    drag: undefined,
    scheme: null,
    colors: null,
  };

  class Instance {
    constructor(el, name, opts = {}) {
      if (!FX[name]) throw new Error(`PixelFX: unknown effect "${name}". Use one of: ${Object.keys(FX).join(", ")}`);
      const clean = Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined && v !== null && v !== ""));
      this.el = el;
      this.name = name;
      this.opts = { ...DEFAULTS, ...clean };
      this.preset = this.opts.preset === "button" ? "button" : "zone";
      this.isZone = this.preset === "zone";
      this.onFill = this.opts.fill === "light";
      this.pal = palette(this.opts.scheme, this.opts.colors);
      this.fx = FX[name]({ preset: this.preset });
      this.bleed = this.fx.bleed || 0;
      this.clip = !!this.fx.clip;

      this.hover = false; this.focus = false; this.drag = 0; this.forced = false;
      this.level = 0; this.t = 0; this.pointer = null; this.was = false; this.raf = 0; this.last = 0;
      this.p = []; this.data = {};
      this.frame = this.frame.bind(this);

      // Host: needs a positioning context and its own stacking context so the
      // canvas (z-index:-1) paints above the host background but below its content.
      const cs = getComputedStyle(el);
      this.saved = { position: el.style.position, isolation: el.style.isolation };
      if (cs.position === "static") el.style.position = "relative";
      if (cs.isolation !== "isolate") el.style.isolation = "isolate";

      const c = (this.canvas = document.createElement("canvas"));
      c.className = "pixelfx-canvas";
      c.setAttribute("aria-hidden", "true");
      c.style.cssText = "position:absolute;display:block;pointer-events:none;z-index:-1;margin:0;padding:0;border:0;";
      el.prepend(c);
      this.ctx = c.getContext("2d");

      this.ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => this.refresh()) : null;
      this.ro?.observe(el);
      this.refresh();
      this.bind();
    }

    bind() {
      const el = this.el;
      this.ac = new AbortController();
      const sig = { signal: this.ac.signal };
      const setPointer = (e) => {
        const r = el.getBoundingClientRect();
        this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      el.addEventListener("pointerenter", (e) => { this.hover = true; setPointer(e); this.update(); }, sig);
      el.addEventListener("pointermove", setPointer, sig);
      el.addEventListener("pointerleave", () => { this.hover = false; this.pointer = null; this.update(); }, sig);
      el.addEventListener("focus", () => { this.focus = el.matches(":focus-visible"); this.update(); }, sig);
      el.addEventListener("blur", () => { this.focus = false; this.update(); }, sig);

      // Drag is observed only: no preventDefault, no classes. Your upload code keeps control.
      if (this.opts.drag ?? this.isZone) {
        const reset = () => { if (this.drag) { this.drag = 0; this.pointer = null; this.update(); } };
        el.addEventListener("dragenter", () => { this.drag++; this.update(); }, sig);
        el.addEventListener("dragover", setPointer, sig);
        el.addEventListener("dragleave", () => { this.drag = Math.max(0, this.drag - 1); if (!this.drag) this.pointer = null; this.update(); }, sig);
        el.addEventListener("drop", reset, sig);
        window.addEventListener("drop", reset, sig);
        window.addEventListener("dragend", reset, sig);
      }
    }

    get active() { return this.forced || this.hover || this.focus || this.drag > 0; }
    get density() { return config.density * (+this.opts.density || 1); }
    get blocked() { return config.respectReducedMotion && reduce.matches; }

    tone(light, t) { return tone(light, t, this.pal); }

    pulseColor(a) {
      const [r, g, b] = hex(this.pal ? this.pal.pulse : config.colors.pulse);
      return `rgba(${r},${g},${b},${a.toFixed(3)})`;
    }

    /** Keep the effect running regardless of hover (e.g. while uploading). */
    setActive(on = true) { this.forced = !!on; this.update(); return this; }

    /** Re-measure the element (call after changing its content or layout). */
    refresh() {
      if (this.destroyed) return this;
      const el = this.el, cs = getComputedStyle(el), b = this.bleed;
      this.iw = el.offsetWidth; this.ih = el.offsetHeight;
      this.w = this.iw + b * 2; this.h = this.ih + b * 2;
      this.dpr = Math.min(window.devicePixelRatio || 1, config.maxDpr);
      this.canvas.width = Math.max(1, Math.round(this.w * this.dpr));
      this.canvas.height = Math.max(1, Math.round(this.h * this.dpr));
      // absolute children are placed from the padding edge, so offset by the border too
      Object.assign(this.canvas.style, {
        left: -(b + (parseFloat(cs.borderLeftWidth) || 0)) + "px",
        top: -(b + (parseFloat(cs.borderTopWidth) || 0)) + "px",
        width: this.w + "px",
        height: this.h + "px",
      });
      this.radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, this.ih / 2, this.iw / 2);
      this.fx.resize?.(this);
      return this;
    }

    update() {
      if (this.destroyed) return;
      if (this.blocked) { this.halt(); return; }
      const a = this.active;
      if (a && !this.was) this.fx.enter?.(this);
      this.was = a;
      if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); }
    }

    halt() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0; this.level = 0; this.p.length = 0; this.was = false;
      this.fx.destroy?.(this);
      this.fx.resize?.(this);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    frame(now) {
      if (this.destroyed) return;
      // the first frame's timestamp can be a little earlier than the event that started the loop
      const raw = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      const dt = raw * config.speed * (+this.opts.speed || 1);
      this.t += dt;
      const target = this.active ? 1 : 0;
      this.level += (target - this.level) * (1 - Math.exp(-raw * (target ? 6 : 3.5)));

      const ctx = this.ctx, b = this.bleed;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      if (this.clip) {
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(b, b, this.iw, this.ih, this.radius); else ctx.rect(b, b, this.iw, this.ih);
        ctx.clip();
      }
      const alive = this.fx.step(this, dt, ctx);
      if (this.clip) ctx.restore();
      ctx.globalAlpha = 1;

      if (!this.active && this.level < 0.01 && !alive) { // idle: stop the loop entirely
        this.level = 0; this.raf = 0; this.p.length = 0;
        ctx.clearRect(0, 0, this.w, this.h);
        return;
      }
      this.raf = requestAnimationFrame(this.frame);
    }

    /** Remove the canvas, listeners and any inline styles the effect added. */
    destroy() {
      if (this.destroyed) return;
      this.halt();
      this.destroyed = true;
      this.ac.abort();
      this.ro?.disconnect();
      this.canvas.remove();
      this.el.style.position = this.saved.position;
      this.el.style.isolation = this.saved.isolation;
      instances.delete(this.el);
      live.delete(this);
    }
  }

  function optionsFromData(el) {
    const d = el.dataset;
    const bool = (v) => (v == null ? undefined : v !== "false");
    return {
      preset: d.pixelPreset,
      fill: d.pixelFill,
      density: d.pixelDensity ? +d.pixelDensity : undefined,
      speed: d.pixelSpeed ? +d.pixelSpeed : undefined,
      target: d.pixelTarget,
      avoid: d.pixelAvoid,
      pulse: bool(d.pixelPulse),
      drag: bool(d.pixelDrag),
      scheme: d.pixelScheme,
      colors: d.pixelColors,
    };
  }

  /** Attach an effect to an element. Replaces any effect already on it. */
  function attach(el, name, opts = {}) {
    if (!el) throw new Error("PixelFX.attach: element is required");
    instances.get(el)?.destroy();
    const inst = new Instance(el, name, opts);
    instances.set(el, inst);
    live.add(inst);
    return inst;
  }

  /** Attach to every [data-pixel-fx] element under root (skips ones already attached).
   *  Also turns on click handling for [data-pixel-burst] anywhere on the page. */
  function scan(root = document) {
    listenForBursts();
    const els = [];
    if (root.matches?.("[data-pixel-fx]")) els.push(root);
    root.querySelectorAll?.("[data-pixel-fx]").forEach((el) => els.push(el));
    return els.map((el) => instances.get(el) || attach(el, el.dataset.pixelFx, optionsFromData(el)));
  }

  function get(el) { return instances.get(el) || null; }
  function destroy(el) { instances.get(el)?.destroy(); }
  function all() { return [...live]; }

  /** Change global settings. Returns the current config. */
  function configure(next = {}) {
    for (const k of ["density", "speed", "maxDpr"]) if (next[k] != null) config[k] = +next[k];
    if (next.respectReducedMotion != null) config.respectReducedMotion = !!next.respectReducedMotion;
    if (next.scheme) {
      if (!SCHEMES[next.scheme]) throw new Error(`PixelFX: unknown scheme "${next.scheme}". Use one of: ${Object.keys(SCHEMES).join(", ")}`);
      config.scheme = next.scheme;
      config.colors = copyScheme(SCHEMES[next.scheme]);
      setColors(config.colors.brand, config.colors.light);
    }
    if (next.colors) {
      if (next.colors.brand) config.colors.brand = [...next.colors.brand];
      if (next.colors.light) config.colors.light = [...next.colors.light];
      if (next.colors.pulse) config.colors.pulse = next.colors.pulse;
      setColors(config.colors.brand, config.colors.light);
    }
    live.forEach((i) => { i.refresh(); i.update(); });
    return JSON.parse(JSON.stringify(config));
  }

  reduce.addEventListener?.("change", () => live.forEach((i) => i.update()));

  return { VERSION, attach, scan, get, destroy, all, configure, burst, effects: Object.keys(FX), bursts: Object.keys(BURSTS), schemes: Object.keys(SCHEMES) };
})();
