(function () {
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
  // pal: a per-element palette from palette(), or null to follow the global colours
  const tone = (light, t, pal) => (pal ? (light ? pal.light : pal.brand) : light ? LIGHT : BRAND)[Math.round(clamp(t) * 31)];

  const tint = (c, k) => "#" + hex(c).map((v) => Math.round(v + (255 - v) * k).toString(16).padStart(2, "0")).join("");
  const palettes = new Map();
  /** A named scheme, or a custom [from, to] pair (array or "a,b" string), as colour ramps. */
  function palette(scheme, colors) {
    let c;
    if (colors) {
      const [a, b] = typeof colors === "string" ? colors.split(/[\s,]+/).filter(Boolean) : colors;
      if (!a || !b) throw new Error(`PixelFX: colors needs two colours, e.g. ["#ff3c6f", "#ffb02e"]`);
      c = { brand: [a, b], light: [tint(a, 0.75), "#ffffff"], pulse: b };
    } else if (scheme) {
      c = SCHEMES[scheme];
      if (!c) throw new Error(`PixelFX: unknown scheme "${scheme}". Use one of: ${Object.keys(SCHEMES).join(", ")}`);
    } else return null;
    const key = [...c.brand, ...c.light, c.pulse].join();
    if (!palettes.has(key)) palettes.set(key, { brand: ramp(hex(c.brand[0]), hex(c.brand[1])), light: ramp(hex(c.light[0]), hex(c.light[1])), pulse: c.pulse });
    return palettes.get(key);
  }

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
        col: s.tone(false, zone ? clamp((x - s.bleed) / s.iw + rand(-0.1, 0.1)) : rand(0.08, 0.3)),
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
            square(ctx, snap(p.x, 1), snap(p.y, 1), size, s.tone(false, t), a);
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
          square(ctx, q.x, snap(y, 1), q.size, s.tone(s.onFill, q.t), a);
          square(ctx, q.x, snap(y + q.size + 2, 1), q.size * 0.7, s.tone(s.onFill, q.t), a * 0.4);
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
          square(ctx, x, y, d.big[i] ? cell * 1.9 : cell, s.tone(s.onFill, x / s.iw), e * amax);
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
            square(ctx, x, y, size, s.tone(s.onFill, (p.x - b) / s.iw), vis * (1 - i / n) * 0.95);
            if (i === 0) { hx = x; hy = y; hn = p; }
          }
          // companion pixel beside the head, jumping between neighbouring cells
          const step = Math.floor(tk / hop), N = HOPS.length, h = HOPS[(((step * 7 + k * 3) % N) + N) % N];
          const cd = head * 0.95, tx = -hn.ny, ty = hn.nx; // tangent
          square(ctx, snap(hx + (tx * h[0] + hn.nx * h[1]) * cd, 1), snap(hy + (ty * h[0] + hn.ny * h[1]) * cd, 1), u, s.tone(s.onFill, (hx - b) / s.iw), vis * 0.7);
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
          square(ctx, snap(q.x + q.nx * q.dist * e, 1), snap(q.y + q.ny * q.dist * e, 1), q.size, s.tone(s.onFill, q.t), envelope(q.age, q.life, 0.1, 0.6) * 0.8);
        }
        return vis > 0.01 || s.p.length > 0;
      },
    };
  };


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
    const raw = Math.min(0.05, Math.max(0, (now - layer.last) / 1000));
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

  if (typeof window !== "undefined") {
    window.PixelFX = PixelFX;
    const me = document.currentScript;
    if (!(me && me.hasAttribute("data-manual"))) {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => PixelFX.scan());
      else PixelFX.scan();
    }
  }
})();
