
  /* ---------- Bursts: one-off pixel celebrations fired from an event ---------- */
  // All bursts share one fixed, pointer-transparent canvas over the page. It is
  // added on the first burst and removed again as soon as the last pixel is gone.
  const GRAVITY = 900; // px/s²
  const MAX_PIXELS = 4000;
  const BURST_DEFAULTS = { style: "burst", amount: 1, size: 1, speed: 1, gravity: 1, snap: true, scheme: null, colors: null, origin: null };
  const layer = { cv: null, ctx: null, w: 0, h: 0, dpr: 1, parts: [], raf: 0, last: 0 };

  function mountLayer() {
    if (!layer.cv) {
      const c = (layer.cv = document.createElement("canvas"));
      c.className = "pixelfx-burst";
      c.setAttribute("aria-hidden", "true");
      c.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000;margin:0;padding:0;border:0;";
      layer.ctx = c.getContext("2d");
    }
    if (!layer.cv.isConnected) document.body.append(layer.cv);
    const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, config.maxDpr);
    if (w !== layer.w || h !== layer.h || dpr !== layer.dpr) {
      Object.assign(layer, { w, h, dpr });
      layer.cv.width = Math.round(w * dpr);
      layer.cv.height = Math.round(h * dpr);
    }
  }

  // Per-burst helpers: counts, sizes and colours all scale from the options.
  function burstContext(o) {
    const pal = palette(o.scheme, o.colors); // null: follow the global colours
    const b = {
      speed: +o.speed || 1,
      gravity: o.gravity == null ? 1 : +o.gravity,
      grid: o.snap ? Math.max(2, Math.round(2.5 * (+o.size || 1))) : 0,
      n: (base) => Math.max(1, Math.round(base * (o.amount == null ? 1 : +o.amount))),
      px: (s) => Math.max(1, Math.round(s * (+o.size || 1))),
      pick(k = Math.random()) { // gradient colour, with the odd pale spark like the logo
        const r = Math.random();
        if (r < 0.1) return tone(true, r < 0.04 ? 1 : 0, pal);
        return tone(false, k, pal);
      },
      white: () => tone(true, 1, pal),
      add(p) {
        if (layer.parts.length >= MAX_PIXELS) return;
        layer.parts.push(Object.assign({
          b, x: 0, y: 0, vx: 0, vy: 0, g: 1, drag: 0,
          t: 0, delay: 0, life: 1, s: 4, c: LIGHT[31],
          alpha: 1, fade: 0.6, fadeIn: 0, shrink: false, twinkle: 0, flip: 0, sway: 0, swayF: 0,
          ph: Math.random() * Math.PI * 2, hold: false, hidden: false, acc: 0,
        }, p));
        if (!layer.raf) { mountLayer(); layer.last = performance.now(); layer.raf = requestAnimationFrame(burstFrame); }
      },
      // a hidden pixel that just waits, so timed steps follow the speed setting
      timer: (sec, fn) => b.add({ life: sec, hidden: true, g: 0, onEnd: fn }),
      flash(x, y, size = 7) { // a 3×3 block that blinks at the origin
        const s = b.px(size);
        for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++)
          b.add({ x: x + gx * s, y: y + gy * s, g: 0, life: 0.14, s, c: gx || gy ? b.pick(0.9) : b.white(), fade: 0.3 });
      },
    };
    return b;
  }

  function burstFrame(now) {
    const raw = Math.min(0.05, (now - layer.last) / 1000);
    layer.last = now;
    if (window.innerWidth !== layer.w || window.innerHeight !== layer.h) mountLayer();
    const ctx = layer.ctx, P = layer.parts;
    ctx.setTransform(layer.dpr, 0, 0, layer.dpr, 0, 0);
    ctx.clearRect(0, 0, layer.w, layer.h);

    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i], b = p.b, dt = raw * config.speed * b.speed;
      p.t += dt;
      const lt = p.t - p.delay;
      if (lt < 0) { if (p.hold) drawPixel(ctx, p, 0, 0); continue; }
      const done = lt >= p.life;
      if (done || p.y > layer.h + 60) {
        P[i] = P[P.length - 1]; P.pop(); // order doesn't matter, so swap-remove
        if (done) p.onEnd?.(p);
        continue;
      }
      const k = lt / p.life;
      if (p.path) {
        [p.x, p.y] = p.path(k);
      } else {
        p.vy += GRAVITY * b.gravity * p.g * dt;
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy *= d;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (p.emit) { p.acc += dt; while (p.acc > p.every) { p.acc -= p.every; p.emit(p); } }
      if (!p.hidden) drawPixel(ctx, p, lt, k);
    }
    ctx.globalAlpha = 1;
    if (P.length) layer.raf = requestAnimationFrame(burstFrame);
    else { layer.raf = 0; layer.cv.remove(); }
  }

  function drawPixel(ctx, p, lt, k) {
    let a = p.alpha * (k < p.fade ? 1 : 1 - (k - p.fade) / (1 - p.fade));
    if (p.fadeIn) a *= Math.min(1, lt / p.fadeIn);
    if (p.twinkle && ((lt * p.twinkle + p.ph) % 1) < 0.35) a *= 0.2;
    if (a <= 0.01) return;
    let s = p.s;
    if (p.shrink && k > 0.6) s = Math.max(1, Math.round(s / 2));
    // confetti tumble: the pixel narrows and widens as if it were spinning
    const w = p.flip ? Math.max(1, Math.round(s * Math.abs(Math.cos(lt * p.flip + p.ph)))) : s;
    let x = p.x + (p.sway ? Math.sin(lt * p.swayF + p.ph) * p.sway : 0) - w / 2, y = p.y - s / 2;
    const g = p.b.grid;
    if (g) { x = Math.round(x / g) * g; y = Math.round(y / g) * g; }
    ctx.globalAlpha = a;
    ctx.fillStyle = p.c;
    ctx.fillRect(x, y, w, s);
  }

  const TAU = Math.PI * 2;
  const BURSTS = {
    // Classic radial pop with gravity; pixels halve in size as they die.
    burst(b, o) {
      for (let i = 0, N = b.n(90); i < N; i++) {
        const a = rand(0, TAU), sp = 140 + Math.pow(Math.random(), 0.6) * 440;
        b.add({ x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 110, g: 0.75, drag: 2.3,
                life: rand(0.8, 1.5), s: b.px(Math.random() < 0.3 ? 7 : 4), c: b.pick(), shrink: true });
      }
    },

    // A cannon of tumbling pixel confetti, fired upward from the element's top edge.
    confetti(b, o) {
      const y = o.el ? o.el.getBoundingClientRect().top : o.y;
      for (let i = 0, N = b.n(110); i < N; i++) {
        const a = -Math.PI / 2 + rand(-0.55, 0.55), sp = rand(480, 1050);
        b.add({ x: o.x + rand(-10, 10), y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1.15, drag: 1.5,
                life: rand(1.6, 2.6), s: b.px(Math.random() < 0.5 ? 6 : 9), c: b.pick(), fade: 0.75,
                flip: rand(5, 14), sway: rand(4, 12), swayF: rand(3, 6) });
      }
    },

    // The element breaks into its own pixels from the impact point, then snaps back.
    shatter(b, o) {
      const el = o.el;
      if (!el || el.dataset.pixelShattering) return BURSTS.burst(b, o);
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const rad = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, r.height / 2, r.width / 2);
      // see-through backgrounds (ghost buttons) shatter in the burst colours instead
      const bg = cs.backgroundColor;
      const bgA = bg.startsWith("rgba") ? parseFloat(bg.split(",")[3]) : bg === "transparent" ? 0 : 1;
      const cell = b.px(6), ix = o.origin ? o.origin.x : o.x, iy = o.origin ? o.origin.y : o.y;
      const inside = (x, y) => {
        const dx = Math.max(r.left + rad - x, 0, x - (r.right - rad)), dy = Math.max(r.top + rad - y, 0, y - (r.bottom - rad));
        return dx * dx + dy * dy <= rad * rad;
      };
      let longest = 0;
      for (let y = r.top + cell / 2; y < r.bottom; y += cell) for (let x = r.left + cell / 2; x < r.right; x += cell) {
        if (!inside(x, y)) continue;
        const dx = x - ix, dy = y - iy, dist = Math.hypot(dx, dy) || 1, delay = dist * 0.0009, life = rand(0.8, 1.4);
        longest = Math.max(longest, delay + life);
        b.add({ x, y, vx: (dx / dist) * rand(120, 320) + rand(-40, 40), vy: (dy / dist) * rand(80, 240) - rand(140, 320),
                g: 1.2, drag: 0.9, delay, hold: true, life, s: cell, shrink: true, fade: 0.5,
                c: bgA < 0.5 || Math.random() < 0.28 ? b.pick((x - r.left) / r.width) : bg });
      }
      const was = el.style.visibility;
      el.dataset.pixelShattering = "";
      el.style.visibility = "hidden";
      b.timer(Math.min(longest, 1.1), () => {
        el.style.visibility = was;
        delete el.dataset.pixelShattering;
        el.animate?.([{ opacity: 0, transform: "scale(0.8)" }, { opacity: 1, transform: "none" }],
                     { duration: 320, easing: "cubic-bezier(.2,1.5,.4,1)" });
      });
    },

    // Pixelated rings rolling outward, like a sonar ping.
    shockwave(b, o) {
      b.flash(o.x, o.y);
      const density = clamp(b.n(100) / 100, 0.6, 1.6);
      for (let ring = 0; ring < 3; ring++) {
        const N = Math.round((34 + ring * 8) * density), sp = 300 - ring * 70;
        for (let i = 0; i < N; i++) {
          const a = (i / N) * TAU + ring * 0.2;
          b.add({ x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 1.7,
                  delay: ring * 0.11, life: 0.75, fade: 0.35, s: b.px(ring === 0 ? 6 : 4), c: b.pick(i / N) });
        }
      }
    },

    // A pixel rocket climbs, then explodes into twinkling, crackling sparks.
    firework(b, o) {
      const tx = o.x + rand(-30, 30), ty = Math.max(50, o.y - rand(200, 260));
      const trail = (p) => b.add({ x: p.x + rand(-2, 2), y: p.y, vy: rand(20, 60), g: 0.15, life: rand(0.3, 0.55),
                                   s: b.px(Math.random() < 0.3 ? 5 : 4), c: b.pick(rand(0.5, 1)), fade: 0.2 });
      b.add({ life: 0.5, s: b.px(7), c: b.white(), emit: trail, every: 0.012,
              path: (k) => { const e = 1 - Math.pow(1 - k, 3); return [o.x + (tx - o.x) * e, o.y + (ty - o.y) * e]; },
              onEnd: () => explode(b, tx, ty) });
    },

    // 8-bit sparkle: pixel rays step out along 8 directions, then a second, shorter pale wave.
    starburst(b, o) {
      const step = b.px(11), len = clamp(Math.round(b.n(700) / 100), 3, 13);
      const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      b.flash(o.x, o.y, 8);
      for (const [wave, wDelay, wLen] of [[0, 0, len], [1, 0.16, Math.ceil(len * 0.55)]]) {
        for (const [dx, dy] of dirs) {
          const diag = dx && dy, steps = diag ? Math.ceil(wLen * 0.7) : wLen, reach = diag ? 0.8 : 1;
          for (let i = 1; i <= steps; i++) {
            b.add({ x: o.x + dx * step * i * reach, y: o.y + dy * step * i * reach, g: 0,
                    delay: wDelay + i * 0.03, life: 0.3, fade: 0.25,
                    s: b.px(i < 2 ? 7 : i < 4 ? 5 : 3), c: wave ? b.white() : b.pick(i / steps) });
          }
        }
      }
      for (let i = 0, N = b.n(14); i < N; i++) { // loose twinkles around the star
        const a = rand(0, TAU), r = rand(30, step * len);
        b.add({ x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r, g: 0, delay: rand(0.05, 0.4), life: rand(0.4, 0.7),
                s: b.px(Math.random() < 0.4 ? 5 : 3), c: b.pick(), twinkle: rand(8, 14), fadeIn: 0.08 });
      }
    },

    // Full-page pixel rain for the big moments, with a small pop at the trigger.
    rain(b, o) {
      for (let i = 0, N = b.n(24); i < N; i++) {
        const a = rand(0, TAU), sp = rand(100, 300);
        b.add({ x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, g: 0.6, drag: 2.5,
                life: rand(0.5, 0.9), s: b.px(4), c: b.pick() });
      }
      mountLayer();
      for (let i = 0, N = b.n(170); i < N; i++) {
        b.add({ x: rand(0, layer.w), y: -rand(20, layer.h * 0.7), vy: rand(160, 380), g: 0.1, life: 5, fade: 0.9,
                s: b.px(Math.random() < 0.35 ? 8 : 5), c: b.pick(), delay: rand(0, 0.3),
                flip: Math.random() < 0.6 ? rand(4, 10) : 0, sway: rand(8, 26), swayF: rand(1.5, 3.5) });
      }
    },

    // Pixels get pulled in to the point, hold for a beat, then pop outward.
    gather(b, o) {
      const T = 0.42;
      for (let i = 0, N = b.n(52); i < N; i++) {
        const a = rand(0, TAU), r = rand(80, 170), sx = o.x + Math.cos(a) * r, sy = o.y + Math.sin(a) * r, d = rand(0, 0.08);
        b.add({ x: sx, y: sy, delay: d, life: T - d, s: b.px(Math.random() < 0.3 ? 6 : 4), c: b.pick(), fade: 1, fadeIn: 0.12,
                path: (k) => { const e = k * k * k; return [sx + (o.x - sx) * e, sy + (o.y - sy) * e]; } });
      }
      b.timer(T + 0.06, () => {
        b.flash(o.x, o.y, 8);
        for (let i = 0, N = b.n(110); i < N; i++) {
          const a = rand(0, TAU), sp = 180 + Math.pow(Math.random(), 0.5) * 520;
          b.add({ x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.45, drag: 2.6, life: rand(0.7, 1.3),
                  s: b.px(Math.random() < 0.35 ? 7 : 4), c: b.pick(), shrink: true });
        }
      });
    },
  };

  // Firework second stage: twinkling sparks with faint trails; a few crackle as they die.
  function explode(b, x, y) {
    b.flash(x, y, 6);
    const spark = (p) => b.add({ x: p.x, y: p.y, g: 0.2, life: 0.25, s: b.px(2), c: p.c, alpha: 0.5, fade: 0 });
    const crackle = (p) => {
      for (let j = 0; j < 4; j++) b.add({ x: p.x, y: p.y, vx: rand(-90, 90), vy: rand(-90, 60), g: 0.4, drag: 2, life: 0.35, s: b.px(2), c: b.white() });
    };
    for (let i = 0, N = b.n(85); i < N; i++) {
      const a = rand(0, TAU), sp = 290 * (0.45 + 0.55 * Math.random());
      b.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.35, drag: 1.5, life: rand(1.1, 1.8),
              s: b.px(Math.random() < 0.3 ? 5 : 3), c: b.pick(), twinkle: Math.random() < 0.5 ? rand(7, 13) : 0,
              emit: spark, every: 0.05, onEnd: Math.random() < 0.15 ? crackle : null });
    }
  }

  /**
   * Fire a one-off burst from an element's centre or from a viewport point ({x, y}).
   * Returns false when nothing was drawn (reduced motion, or no DOM).
   */
  function burst(target, opts = {}) {
    if (!hasWindow || !document.body) return false;
    if (config.respectReducedMotion && reduce.matches) return false;
    const clean = Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined && v !== null && v !== ""));
    const o = { ...BURST_DEFAULTS, ...clean };
    const fn = BURSTS[o.style];
    if (!fn) throw new Error(`PixelFX.burst: unknown style "${o.style}". Use one of: ${Object.keys(BURSTS).join(", ")}`);
    if (target instanceof Element) {
      const r = target.getBoundingClientRect();
      Object.assign(o, { x: r.left + r.width / 2, y: r.top + r.height / 2, el: target });
    } else {
      mountLayer();
      Object.assign(o, { x: target?.x ?? layer.w / 2, y: target?.y ?? layer.h / 2, el: null });
    }
    fn(burstContext(o), o);
    return true;
  }

  // data-pixel-burst: one delegated click listener, turned on by scan()
  let burstClicks = false;
  function listenForBursts() {
    if (burstClicks || !hasWindow) return;
    burstClicks = true;
    document.addEventListener("click", (e) => {
      const el = e.target.closest?.("[data-pixel-burst]");
      if (!el) return;
      const d = el.dataset;
      burst(el, {
        style: d.pixelBurst || "burst",
        amount: d.pixelBurstAmount ? +d.pixelBurstAmount : undefined,
        size: d.pixelBurstSize ? +d.pixelBurstSize : undefined,
        speed: d.pixelBurstSpeed ? +d.pixelBurstSpeed : undefined,
        scheme: d.pixelBurstScheme,
        colors: d.pixelBurstColors,
        origin: e.detail ? { x: e.clientX, y: e.clientY } : null, // keyboard clicks have no pointer position
      });
    });
  }
