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

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const snap = (v, g) => (g ? Math.round(v / g) * g : v);
  const ramp = (a, b) => Array.from({ length: 32 }, (_, i) => {
    const t = i / 31;
    return `rgb(${lerp(a[0], b[0], t) | 0},${lerp(a[1], b[1], t) | 0},${lerp(a[2], b[2], t) | 0})`;
  });
  let BRAND, LIGHT;
  const hex = (h) => {
    h = String(h).replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  function setColors(brand, light) {
    BRAND = ramp(hex(brand[0]), hex(brand[1]));
    LIGHT = ramp(hex(light[0]), hex(light[1]));
  }
  setColors(DEFAULT_COLORS.brand, DEFAULT_COLORS.light);
  const tone = (light, t) => (light ? LIGHT : BRAND)[Math.round(clamp(t) * 31)];

  // A logo pixel: square, very slightly rounded
  function square(ctx, x, y, s, col, a) {
    if (a <= 0.004 || s < 0.5) return;
    const h = s / 2, r = Math.min(s * 0.16, 1.6);
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = col;
    ctx.beginPath();
    if (ctx.roundRect && r > 0.5) ctx.roundRect(x - h, y - h, s, s, r);
    else ctx.rect(x - h, y - h, s, s);
    ctx.fill();
  }

  function envelope(age, life, fin = 0.15, fout = 0.5) {
    const k = age / life;
    if (k < fin) return k / fin;
    if (k > 1 - fout) return clamp((1 - k) / fout);
    return 1;
  }

  // Emission accumulator; rate is per second, scaled by density and fade level
  function spawnCount(s, key, rate, dt) {
    const d = s.data;
    d[key] = (d[key] || 0) + rate * s.density * dt * (s.active ? s.level : 0);
    const n = Math.floor(d[key]);
    d[key] -= n;
    return n;
  }

  // Rounded-rect perimeter walking (used by Trace)
  function rrLength(q) { return 2 * (q.w - 2 * q.r) + 2 * (q.h - 2 * q.r) + 2 * Math.PI * q.r; }
  function rrPoint(q, d) {
    const r = q.r, sw = q.w - 2 * r, sh = q.h - 2 * r, arc = (Math.PI * r) / 2, L = rrLength(q);
    d = ((d % L) + L) % L;
    const onArc = (cx, cy, a0) => { const a = a0 + d / r; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }; };
    if (d < sw) return { x: q.x + r + d, y: q.y, nx: 0, ny: -1 }; d -= sw;
    if (d < arc) return onArc(q.x + q.w - r, q.y + r, -Math.PI / 2); d -= arc;
    if (d < sh) return { x: q.x + q.w, y: q.y + r + d, nx: 1, ny: 0 }; d -= sh;
    if (d < arc) return onArc(q.x + q.w - r, q.y + q.h - r, 0); d -= arc;
    if (d < sw) return { x: q.x + q.w - r - d, y: q.y + q.h, nx: 0, ny: 1 }; d -= sw;
    if (d < arc) return onArc(q.x + r, q.y + q.h - r, Math.PI / 2); d -= arc;
    if (d < sh) return { x: q.x, y: q.y + q.h - r - d, nx: -1, ny: 0 }; d -= sh;
    return onArc(q.x + r, q.y + r, Math.PI);
  }

  const FX = {};

  /* ---------- A. Breakaway: pixels step off every edge, like the logo ---------- */
  FX.breakaway = (o) => {
    const zone = o.preset !== "button";
    const u = zone ? 4 : 2.5, reach = zone ? 16 : 12;
    // Emission scales with the element's perimeter so big and small elements feel equally busy
    const perSec = zone ? 1.6 : 1.9, perBurst = zone ? 1.8 : 1.7; // per 100px of edge

    const edge = (s) => ({ x: s.bleed + 0.5, y: s.bleed + 0.5, w: s.iw - 1, h: s.ih - 1, r: Math.max(0, s.radius - 0.5) });

    function spawn(s, head = 0) {
      const rr = edge(s), p = rrPoint(rr, rand(0, rrLength(rr)));
      const back = rand(0, 3); // start just inside the edge so pixels emerge from it
      const x = p.x - p.nx * back, y = p.y - p.ny * back;
      // mostly outward, with some sideways drift along the edge
      const side = rand(-0.45, 0.45), dx = p.nx - p.ny * side, dy = p.ny + p.nx * side;
      const len = Math.hypot(dx, dy) || 1, dist = reach * rand(0.45, 1.15);
      const r = Math.random();
      s.p.push({
        x0: x, y0: y, dx: (dx / len) * dist, dy: (dy / len) * dist,
        age: head, life: rand(0.9, 1.8),
        size: r < 0.38 ? u * 2 : r < 0.55 ? u * 1.5 : u, // the logo mixes two sizes
        // zone: blue on the left shading to cyan on the right, like the logo; buttons: match the fill
        col: tone(false, zone ? clamp((x - s.bleed) / s.iw + rand(-0.1, 0.1)) : rand(0.08, 0.3)),
        a: rand(0.55, 0.95),
      });
    }

    return {
      bleed: zone ? 18 : 16,
      enter(s) {
        const n = (rrLength(edge(s)) / 100) * perBurst * s.density;
        for (let i = 0; i < n; i++) spawn(s, rand(0, 0.25));
      },
      step(s, dt, ctx) {
        const n = spawnCount(s, "a", (rrLength(edge(s)) / 100) * perSec, dt);
        for (let i = 0; i < n; i++) spawn(s);
        for (let i = s.p.length - 1; i >= 0; i--) {
          const q = s.p[i];
          q.age += dt;
          if (q.age >= q.life) { s.p.splice(i, 1); continue; }
          const e = 1 - Math.pow(1 - q.age / q.life, 2.2);
          const g = zone ? 2 : 1; // snap to a grid so the motion steps like pixels
          square(ctx, snap(q.x0 + q.dx * e, g), snap(q.y0 + q.dy * e, g), q.size, q.col, envelope(q.age, q.life, 0.12, 0.55) * q.a);
        }
        return s.p.length > 0;
      },
    };
  };

  /* ---------- B. Uplink: side streams feed the icon, one pixel leaves upward ---------- */
  FX.uplink = (o) => (o.preset === "button" ? riseFill() : uplinkZone());

  function restoreIcon(d) {
    if (d.icon) d.icon.style.boxShadow = d.iconShadow || "";
    d.pulse = 0;
  }

  function uplinkZone() {
    const u = 3.5, pitch = 7, speed = 95, inset = 10;

    function measure(s) {
      const r = s.el.getBoundingClientRect(), d = s.data;
      const q = (sel) => { try { return sel ? s.el.querySelector(sel) : null; } catch { return null; } };
      const icon = q(s.opts.target), text = q(s.opts.avoid);
      if (d.icon && d.icon !== icon) restoreIcon(d);
      if (icon && d.icon !== icon) d.iconShadow = icon.style.boxShadow;
      d.icon = s.opts.pulse ? icon : null;
      if (icon) { const ir = icon.getBoundingClientRect(); d.tx = ir.left - r.left + ir.width / 2; d.ty = ir.top - r.top + ir.height / 2; d.ring = ir.width / 2 + 4; }
      else { d.tx = s.iw / 2; d.ty = s.ih * 0.35; d.ring = 24; }
      if (text) { const tr = text.getBoundingClientRect(); d.tl = tr.left - r.left - 14; d.tr = tr.right - r.left + 14; d.tt = tr.top - r.top; d.tb = tr.bottom - r.top; }
      else { d.tl = d.tr = s.iw / 2; d.tt = d.tb = 0; }
    }

    function spawnIn(s) {
      const d = s.data;
      const leftW = d.tl - inset, rightW = s.iw - inset - d.tr;
      let x0, dim = false;
      if (leftW > 14 || rightW > 14) {
        const useLeft = rightW <= 14 || (leftW > 14 && Math.random() < 0.5);
        x0 = useLeft ? rand(inset, d.tl) : rand(d.tr, s.iw - inset);
      } else { x0 = rand(inset, s.iw - inset); dim = true; } // narrow screens: pass behind text, dimmed
      x0 = snap(x0, pitch);
      const y0 = s.ih - 6, vert = y0 - d.ty, horiz = Math.max(0, Math.abs(x0 - d.tx) - d.ring);
      s.p.push({ kind: "in", x0, y0, dir: Math.sign(d.tx - x0) || 1, vert, L: vert + horiz, d: 0, v: speed * rand(0.8, 1.2), dim, big: Math.random() < 0.3 });
    }

    function pointAt(s, q, dist) {
      if (q.kind === "out") return { x: s.data.tx, y: q.y0 - dist };
      if (dist < q.vert) return { x: q.x0, y: q.y0 - dist };
      return { x: q.x0 + q.dir * (dist - q.vert), y: s.data.ty };
    }

    return {
      bleed: 0,
      resize: measure,
      destroy: (s) => restoreIcon(s.data),
      enter(s) { measure(s); for (let i = 0; i < 3 * s.density; i++) { spawnIn(s); s.p[s.p.length - 1].d = rand(0, 60); } },
      step(s, dt, ctx) {
        const d = s.data;
        if (!s.active && s.level < 0.01) s.p.length = 0; // faded out: drop in-flight pixels
        const n = spawnCount(s, "in", 5.5, dt);
        for (let i = 0; i < n; i++) spawnIn(s);

        for (let i = s.p.length - 1; i >= 0; i--) {
          const q = s.p[i];
          q.d += q.v * dt;
          if (q.d >= q.L) {
            s.p.splice(i, 1);
            if (q.kind === "in") {
              d.pulse = Math.min(1, (d.pulse || 0) + 0.4 * s.level);
              if (Math.random() < 0.55) s.p.push({ kind: "out", y0: d.ty - d.ring, L: d.ty - d.ring - 8, d: 0, v: speed * 1.25, big: true });
            }
            continue;
          }
          const fin = clamp(q.d / 22), fout = clamp((q.L - q.d) / 14);
          for (let k = 0; k < 3; k++) { // head + two trailing pixels
            const dist = q.d - k * pitch;
            if (dist < 0) break;
            const p = pointAt(s, q, dist);
            let a = fin * fout * [0.85, 0.42, 0.18][k] * s.level; // in-flight pixels fade out on leave
            if (q.dim && p.y > d.tt && p.y < d.tb) a *= 0.3;
            const size = (q.big && k === 0 ? u * 1.7 : u) * (1 - k * 0.18);
            const t = q.kind === "out" ? 1 : 0.15 + 0.7 * (q.d / q.L); // blue at the edge, cyan by the icon
            square(ctx, snap(p.x, 1), snap(p.y, 1), size, tone(false, t), a);
          }
        }

        // icon ring answers each arrival
        if (d.icon) {
          d.pulse = (d.pulse || 0) * Math.exp(-dt * 4);
          if (d.pulse > 0.01) d.icon.style.boxShadow = `0 0 0 ${(d.pulse * 5).toFixed(2)}px ${s.pulseColor(d.pulse * 0.16)}`;
          else restoreIcon(d);
        }
        return (s.p.length > 0 && s.level > 0.01) || (d.pulse || 0) > 0.01;
      },
    };
  }

  function riseFill() {
    function spawn(s, age = 0) {
      const inset = s.ih * 0.3;
      s.p.push({ x: snap(rand(inset, s.iw - inset), 3), age, life: rand(0.55, 1), size: Math.random() < 0.3 ? 3.5 : 2, t: Math.random() });
    }
    return {
      bleed: 0, clip: true,
      enter(s) { for (let i = 0; i < 5 * s.density; i++) spawn(s, rand(0, 0.4)); },
      step(s, dt, ctx) {
        const n = spawnCount(s, "r", 16, dt);
        for (let i = 0; i < n; i++) spawn(s);
        for (let i = s.p.length - 1; i >= 0; i--) {
          const q = s.p[i];
          q.age += dt;
          if (q.age >= q.life) { s.p.splice(i, 1); continue; }
          const k = q.age / q.life, y = lerp(s.ih + 3, -3, k * (0.6 + 0.4 * k));
          const a = envelope(q.age, q.life, 0.15, 0.55) * (s.onFill ? 0.45 : 0.75);
          square(ctx, q.x, snap(y, 1), q.size, tone(s.onFill, q.t), a);
          square(ctx, q.x, snap(y + q.size + 2, 1), q.size * 0.7, tone(s.onFill, q.t), a * 0.4);
        }
        return s.p.length > 0;
      },
    };
  }

  /* ---------- C. Dither: grid lights up under the pointer, decays behind it ---------- */
  FX.dither = (o) => {
    const zone = o.preset !== "button";
    const pitch = zone ? 9 : 5, cell = zone ? 3.5 : 2.2, R = zone ? 74 : 24, inset = zone ? 8 : 0;
    return {
      bleed: 0, clip: !zone,
      resize(s) {
        const d = s.data;
        d.cols = Math.max(1, Math.floor((s.iw - inset * 2) / pitch) + 1);
        d.rows = Math.max(1, Math.floor((s.ih - inset * 2) / pitch) + 1);
        d.ox = (s.iw - (d.cols - 1) * pitch) / 2;
        d.oy = (s.ih - (d.rows - 1) * pitch) / 2;
        d.e = new Float32Array(d.cols * d.rows);
        d.big = Uint8Array.from({ length: d.cols * d.rows }, () => (Math.random() < 0.12 ? 1 : 0));
      },
      enter(s) { if (!zone) s.data.sweep = 0; },
      step(s, dt, ctx) {
        const d = s.data, E = d.e, cols = d.cols, rows = d.rows;
        if (!E) return false;
        const decay = Math.exp(-dt * (zone ? 2.6 : 3.4));

        // pointer, or a slow wander when active by focus / drag / "keep running"
        let px = null, py = null;
        if (s.pointer) { px = s.pointer.x; py = s.pointer.y; }
        else if (s.active) { px = s.iw / 2 + Math.cos(s.t * 0.9) * s.iw * 0.28; py = s.ih / 2 + Math.sin(s.t * 1.3) * s.ih * 0.22; }

        if (px !== null && s.active) {
          const rate = (zone ? 9 : 14) * s.density * s.level;
          const c0 = Math.max(0, Math.floor((px - R - d.ox) / pitch)), c1 = Math.min(cols - 1, Math.ceil((px + R - d.ox) / pitch));
          const r0 = Math.max(0, Math.floor((py - R - d.oy) / pitch)), r1 = Math.min(rows - 1, Math.ceil((py + R - d.oy) / pitch));
          for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
            const dist = Math.hypot(d.ox + c * pitch - px, d.oy + r * pitch - py);
            if (dist > R) continue;
            const f = 1 - dist / R, i = r * cols + c;
            if (Math.random() < f * f * rate * dt) E[i] = Math.max(E[i], rand(0.55, 1) * (0.4 + 0.6 * f));
          }
        }

        if (zone) { // faint ambient sparkle while active
          const n = spawnCount(s, "amb", 10, dt);
          for (let k = 0; k < n; k++) { const i = (Math.random() * E.length) | 0; E[i] = Math.max(E[i], rand(0.2, 0.45)); }
        }

        if (!zone && d.sweep != null) { // one pixelated sweep on entry
          d.sweep += dt / 0.6;
          const band = Math.max(14, s.iw * 0.18), pos = lerp(-band * 2, s.iw + band * 2, d.sweep);
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const x = d.ox + c * pitch + (d.oy + r * pitch - s.ih / 2) * 0.6;
            const dist = Math.abs(x - pos);
            if (dist < band && Math.random() < (1 - dist / band) * 0.5) { const i = r * cols + c; E[i] = Math.max(E[i], rand(0.65, 1)); }
          }
          if (d.sweep >= 1) d.sweep = null;
        }

        let alive = d.sweep != null;
        const amax = zone ? 0.75 : s.onFill ? 0.55 : 0.85;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const i = r * cols + c, e = E[i];
          if (e < 0.015) { E[i] = 0; continue; }
          E[i] = e * decay;
          alive = true;
          const x = d.ox + c * pitch, y = d.oy + r * pitch;
          square(ctx, x, y, d.big[i] ? cell * 1.9 : cell, tone(s.onFill, x / s.iw), e * amax);
        }
        return alive;
      },
    };
  };

  /* ---------- D. Trace: two pixel trails run the border and shed pixels ---------- */
  FX.trace = (o) => {
    const zone = o.preset !== "button";
    const u = zone ? 3 : 2, head = zone ? 6 : 3.6, gap = zone ? 6 : 3.6, n = zone ? 9 : 7, speed = zone ? 120 : 80;
    const jitter = [0, 1].map(() => Array.from({ length: n }, (_, i) => (i > 2 && Math.random() < 0.45 ? (Math.random() < 0.65 ? 1 : -1) * u * rand(0.7, 1.3) : 0)));
    // Head motion: the head weaves across the border line and the tail follows its path,
    // the head pulses in size, and a companion pixel hops around it in grid steps.
    const amp = zone ? 3.5 : 1.6, wave = Math.PI * 2 * 1.4, hop = 0.11;
    const HOPS = [[1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [-1, -1]];
    const weave = (t) => amp * (Math.sin(wave * t) * 0.75 + Math.sin(wave * 2.3 * t + 1.1) * 0.25);
    return {
      bleed: zone ? 12 : 8,
      enter(s) { if (s.data.d == null) s.data.d = rand(0, 400); },
      step(s, dt, ctx) {
        const b = s.bleed, D = s.data, vis = s.level;
        const rr = { x: b + 0.5, y: b + 0.5, w: s.iw - 1, h: s.ih - 1, r: Math.max(0, s.radius - 0.5) };
        const L = rrLength(rr);
        D.d = ((D.d || 0) + speed * dt) % L;

        if (vis > 0.01) for (let k = 0; k < 2; k++) {
          const base = D.d + (k * L) / 2, tk = s.t + k * 0.37;
          let hx = 0, hy = 0, hn = null;
          for (let i = n - 1; i >= 0; i--) {
            const p = rrPoint(rr, base - i * gap);
            // each tail pixel takes the offset the head had when it passed this spot
            const off = weave(tk - (i * gap) / speed) * (1 - (i / n) * 0.5) + jitter[k][i];
            const x = snap(p.x + p.nx * off, 1), y = snap(p.y + p.ny * off, 1);
            const pulse = 1 + 0.22 * Math.sin(wave * 1.7 * tk);
            const size = i === 0 ? head * pulse : (i < 3 ? u * 1.25 : u) * (1 - (i / n) * 0.3);
            square(ctx, x, y, size, tone(s.onFill, (p.x - b) / s.iw), vis * (1 - i / n) * 0.95);
            if (i === 0) { hx = x; hy = y; hn = p; }
          }
          // companion pixel beside the head, jumping between neighbouring cells
          const step = Math.floor(tk / hop), h = HOPS[(step * 7 + k * 3) % HOPS.length];
          const cd = head * 0.95, tx = -hn.ny, ty = hn.nx; // tangent
          square(ctx, snap(hx + (tx * h[0] + hn.nx * h[1]) * cd, 1), snap(hy + (ty * h[0] + hn.ny * h[1]) * cd, 1), u, tone(s.onFill, (hx - b) / s.iw), vis * 0.7);
          if (s.active && Math.random() < (zone ? 2.4 : 1.6) * s.density * dt) {
            const p = rrPoint(rr, base - gap * rand(1, 4));
            s.p.push({ x: p.x, y: p.y, nx: p.nx, ny: p.ny, age: 0, life: rand(0.6, 1.1), size: u * (Math.random() < 0.35 ? 1.6 : 1), dist: rand(6, zone ? 12 : 7), t: (p.x - b) / s.iw });
          }
        }

        for (let i = s.p.length - 1; i >= 0; i--) {
          const q = s.p[i];
          q.age += dt;
          if (q.age >= q.life) { s.p.splice(i, 1); continue; }
          const e = 1 - Math.pow(1 - q.age / q.life, 2);
          square(ctx, snap(q.x + q.nx * q.dist * e, 1), snap(q.y + q.ny * q.dist * e, 1), q.size, tone(s.onFill, q.t), envelope(q.age, q.life, 0.1, 0.6) * 0.8);
        }
        return vis > 0.01 || s.p.length > 0;
      },
    };
  };


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

    pulseColor(a) {
      const [r, g, b] = hex(config.colors.pulse);
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
      const raw = Math.min(0.05, (now - this.last) / 1000);
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

  /** Attach to every [data-pixel-fx] element under root (skips ones already attached). */
  function scan(root = document) {
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

  return { VERSION, attach, scan, get, destroy, all, configure, effects: Object.keys(FX) };
})();

export const { VERSION, attach, scan, get, destroy, all, configure, effects } = PixelFX;
export default PixelFX;
