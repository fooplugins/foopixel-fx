/*!
 * FooPixel FX Progress v1.3.0
 * Pixel progress bars for FooPixel FX.
 * Styles: segments, dither, chomper, blocks, snake, hearts, lcd, beam, ring, battery, mosaic, tank, scanner.
 * (c) FooPlugins
 */
import PixelFX from "./foopixel-fx.esm.js";

  "use strict";

  const VERSION = "1.3.0";
  const hasWindow = typeof window !== "undefined";
  const reduce = hasWindow && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  /* ---------- colour ---------- */
  const FAIL = ["#d0244a", "#ff8d9b"];
  const LEVELS = { low: "#ff6b7f", mid: "#ffc15e", high: "#50e3a4" }; // battery
  const HEARTS = { full: "#ff3d6e", shine: "#ffd1dc" };
  const WHITE = [255, 255, 255];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const rgb = (value) => {
    let h = String(value).trim().replace(/^#/, "");
    if (h.length === 3) h = h.replace(/./g, "$&$&");
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n)) throw new Error(`PixelFX.progress: colours must be hex, e.g. "#2e68ff" (got "${value}")`);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const pair = (colors) => {
    const [a, b] = typeof colors === "string" ? colors.split(/[\s,]+/).filter(Boolean) : colors;
    if (!a || !b) throw new Error('PixelFX.progress: colors needs two colours, e.g. ["#ff3c6f", "#ffb02e"]');
    return [a, b];
  };

  /* ---------- pixel art ---------- */
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const GLYPHS = {
    0: ["XXX", "X.X", "X.X", "X.X", "XXX"], 1: [".X.", "XX.", ".X.", ".X.", "XXX"], 2: ["XXX", "..X", "XXX", "X..", "XXX"],
    3: ["XXX", "..X", ".XX", "..X", "XXX"], 4: ["X.X", "X.X", "XXX", "..X", "..X"], 5: ["XXX", "X..", "XXX", "..X", "XXX"],
    6: ["XXX", "X..", "XXX", "X.X", "XXX"], 7: ["XXX", "..X", ".X.", ".X.", ".X."], 8: ["XXX", "X.X", "XXX", "X.X", "XXX"],
    9: ["XXX", "X.X", "XXX", "..X", "XXX"], "%": ["X.X", "..X", ".X.", "X..", "X.X"],
  };
  const HEART = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
  const BOLT = ["..XX", ".XX.", "XXXX", ".XX.", "XX.."];

  // A bar-shaped grid: pixel size from the element's height, capped so big bars stay chunky.
  function grid(w, h, rows, maxCell) {
    const c = Math.max(1, Math.min(maxCell, Math.floor(h / rows)));
    const r = c === 1 ? Math.max(1, Math.min(rows, Math.floor(h))) : rows;
    const cols = Math.max(1, Math.floor(w / c));
    return { c, rows: r, cols, w: cols * c, h: r * c };
  }

  /* ---------- styles ----------
     layout(w, h, opts) sizes the drawing; draw(d) paints one frame; live(d) says whether
     it still needs frames (default: while the bar is running). */
  const STYLES = {
    segments: {
      height: 12,
      layout: (w, h) => grid(w, h, 4, 6),
      draw(d) {
        const { g, ctx } = d;
        const n = Math.max(1, Math.floor((g.cols + 1) / 4));
        const lit = d.p * n;
        for (let i = 0; i < n; i++) {
          const f = clamp(lit - i), u = i / Math.max(1, n - 1);
          ctx.fillStyle = f >= 1 ? d.grad(u) : f > 0 && d.state !== "done" ? (d.blink(2.5) ? d.light(u, 0.35) : d.grad(u, 0.35)) : d.track;
          ctx.fillRect(i * 4 * g.c, 0, 3 * g.c, g.h);
          if (f >= 1 && g.c >= 3) { ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(i * 4 * g.c, 0, 3 * g.c, 1); }
        }
      },
    },
    dither: {
      height: 12,
      layout: (w, h) => grid(w, h, 6, 4),
      draw(d) {
        const { g } = d;
        const edge = d.p * 1.16 - 0.08;
        const shift = d.state === "run" && !d.still ? Math.floor(d.t * 10) % 4 : 0;
        for (let y = 0; y < g.rows; y++)
          for (let x = 0; x < g.cols; x++) {
            const u = (x + 0.5) / g.cols;
            const th = (BAYER[(y + shift) % 4][x % 4] + 0.5) / 16;
            d.cell(x, y, u < edge + (th - 0.5) * 0.16 ? d.grad(u) : d.faint);
          }
      },
    },
    chomper: {
      height: 18,
      layout(w, h) { const c = Math.max(1, Math.min(4, Math.floor(h / 9))); const cols = Math.max(12, Math.floor(w / c)); return { c, rows: 9, cols, w: cols * c, h: 9 * c }; },
      draw(d) {
        const { g } = d;
        const hx = Math.round(4 + d.p * (g.cols - 9));
        for (let x = 0; x < hx; x++) for (let y = 3; y <= 5; y++) d.cell(x, y, d.grad(x / g.cols, 0.9));
        for (let x = 2; x < g.cols; x += 5) if (x > hx + 4) d.cell(x, 4, d.faintDot, 0);
        const open = (d.state === "run" && !d.still ? Math.abs(Math.sin(d.t * 11)) : 0.35) * 0.85;
        const head = d.light(1, 0.15);
        for (let dy = -4; dy <= 4; dy++)
          for (let dx = -4; dx <= 4; dx++) {
            if (dx * dx + dy * dy > 18) continue;
            if (dx > 0 && Math.abs(Math.atan2(dy, dx)) < open) continue;
            d.cell(hx + dx, 4 + dy, dx === 0 && dy === -2 ? d.trackSolid : head);
          }
      },
    },
    blocks: {
      height: 12,
      layout(w, h) { const g = grid(w, h, 6, 6); if (g.rows % 2) { g.rows = Math.max(2, g.rows - 1); g.h = g.rows * g.c; } return g; },
      draw(d) {
        const { g, mem } = d;
        mem.times ||= {};
        const pc = Math.floor(g.cols / 2), pr = Math.max(1, Math.floor(g.rows / 2)), total = pc * pr;
        const n = Math.floor(d.p * total + 1e-9);
        for (let x = 0; x < pc * 2; x++) for (let y = 0; y < g.rows; y++) d.cell(x, y, d.faint);
        mem.falling = false;
        for (let i = 0; i < total; i++) {
          if (i >= n) { delete mem.times[i]; continue; }
          mem.times[i] ??= d.t;
          const col = Math.floor(i / pr), row = pr - 1 - (i % pr);
          const k = d.still ? 1 : clamp((d.t - mem.times[i]) / 0.22);
          if (k < 1) mem.falling = true;
          d.cell(col * 2, -2 + (row * 2 + 2) * k * k, (col + row) % 2 ? d.grad(col / pc) : d.light(col / pc, 0.22), 2, 2);
        }
      },
      live: (d) => d.state === "run" || d.mem.falling,
    },
    snake: {
      height: 12,
      layout: (w, h) => grid(w, h, 4, 6),
      draw(d) {
        const { g, ctx } = d;
        const at = (i) => { const x = Math.floor(i / g.rows); return [x, x % 2 ? g.rows - 1 - (i % g.rows) : i % g.rows]; };
        const total = g.cols * g.rows, n = Math.round(d.p * total), body = Math.max(4, g.rows * 3);
        if (g.c >= 4) for (let i = n; i < total; i++) { const [x, y] = at(i); ctx.fillStyle = d.faint; ctx.fillRect(x * g.c + 2, y * g.c + 2, g.c - 4, g.c - 4); }
        else for (let i = n; i < total; i++) { const [x, y] = at(i); d.cell(x, y, d.faint); }
        // the path it has covered stays lit but dim; the snake itself is the last few cells
        for (let i = 0; i < n; i++) { const [x, y] = at(i); d.cell(x, y, i === n - 1 ? d.light(1, 0.55) : d.grad(i / total, i >= n - body ? 1 : 0.32)); }
        if (n + 3 < total && d.state !== "fail" && d.state !== "done" && d.blink(1.5)) { const [x, y] = at(n + 3); d.cell(x, y, LEVELS.mid); }
      },
    },
    hearts: {
      height: 16,
      layout(w, h, o) {
        let c = Math.max(1, Math.min(4, Math.floor(h / 8)));
        const count = o.count > 0 ? Math.round(o.count) : clamp(Math.floor((Math.floor(w / c) + 1) / 8), 1, 10);
        c = Math.max(1, Math.min(c, Math.floor(w / (count * 8 - 1)) || 1));
        return { c, count, cols: count * 8 - 1, rows: 8, w: (count * 8 - 1) * c, h: 8 * c };
      },
      draw(d) {
        const { g } = d;
        const full = d.state === "fail" ? FAIL[0] : HEARTS.full;
        for (let i = 0; i < g.count; i++) {
          const f = clamp(d.p * g.count - i);
          const bob = f > 0 && f < 1 && d.state === "run" && d.blink(2) ? -1 : 0;
          HEART.forEach((line, y) => [...line].forEach((ch, x) => {
            if (ch !== "X") return;
            const on = (x + 0.5) / 7 <= f;
            d.cell(i * 8 + x, 1 + y + bob, on ? (x === 1 && y === 1 && d.state !== "fail" ? HEARTS.shine : full) : d.track, 0);
          }));
        }
      },
    },
    lcd: {
      height: 21,
      layout(w, h) { const c = Math.max(1, Math.min(12, Math.floor(w / 15), Math.floor(h / 7))); return { c, cols: 15, rows: 7, w: 15 * c, h: 7 * c }; },
      draw(d) {
        const { g } = d;
        const text = (d.indeterminate ? "" : String(Math.round(d.p * 100))).padStart(3, " ") + "%";
        [...text].forEach((ch, i) => {
          for (let y = 0; y < 5; y++)
            for (let x = 0; x < 3; x++) d.cell(i * 4 + x, y, ch !== " " && GLYPHS[ch][y][x] === "X" ? d.grad(i / 3) : d.faint);
        });
        for (let x = 0; x < g.cols; x++) d.cell(x, 6, (x + 0.5) / g.cols <= d.p ? d.grad(x / g.cols) : d.faint);
      },
      live: () => false,
    },
    beam: {
      height: 14,
      layout: (w, h) => grid(w, h, 7, 4),
      draw(d) {
        const { g, mem } = d;
        mem.parts ||= [];
        mem.edge ??= -9;
        const fill = d.p * g.cols;
        for (let x = 0; x < g.cols; x++)
          for (let y = 1; y < g.rows - 1; y++) {
            const f = clamp(fill - x);
            d.cell(x, y, f >= 1 ? d.grad(x / g.cols) : f > 0 ? d.grad(x / g.cols, 0.5 + 0.5 * f) : d.faint);
          }
        if (d.state === "run" && d.p < 1 && !d.still && Math.random() < d.dt * 40)
          mem.parts.push({ x: -1, y: Math.floor(Math.random() * g.rows), v: 28 + Math.random() * 36 });
        mem.parts = mem.parts.filter((pt) => {
          pt.x += pt.v * d.dt;
          if (pt.x >= fill) { mem.edge = d.t; return false; }
          for (let k = 3; k >= 0; k--) d.cell(Math.floor(pt.x) - k, pt.y, k ? `rgba(255,255,255,${0.12 * (4 - k)})` : "#ffffff");
          return true;
        });
        if (d.t - mem.edge < 0.08 && d.p < 1) for (let y = 0; y < g.rows; y++) d.cell(Math.floor(fill), y, d.light(d.p, 0.6));
        if (d.state !== "run") mem.parts.length = 0;
      },
      live: (d) => d.state === "run" || d.mem.parts?.length > 0,
    },
    ring: {
      height: 40,
      layout(w, h) {
        const s = Math.max(12, Math.floor(Math.min(w, h)));
        const n = s >= 100 ? 24 : s >= 44 ? 16 : 12;
        return { w: s, h: s, n, sq: Math.max(2, Math.round(s * 0.072)), digit: s >= 56 ? Math.max(1, Math.floor(s / 40)) : 0 };
      },
      draw(d) {
        const { g, ctx } = d;
        const mid = g.w / 2, r = mid - g.sq * 0.8, lit = d.p * g.n;
        for (let i = 0; i < g.n; i++) {
          const a = -Math.PI / 2 + (i / g.n) * Math.PI * 2, f = clamp(lit - i);
          ctx.fillStyle = f >= 1 ? d.grad(i / g.n) : f > 0 ? (d.blink(3) ? d.light(i / g.n, 0.4) : d.grad(i / g.n, 0.3)) : d.track;
          ctx.fillRect(Math.round(mid + Math.cos(a) * r - g.sq / 2), Math.round(mid + Math.sin(a) * r - g.sq / 2), g.sq, g.sq);
        }
        if (!g.digit || d.indeterminate) return;
        // the percentage in the middle, in pixel digits so no web font is needed
        const text = `${Math.round(d.p * 100)}%`, px = g.digit;
        const x0 = Math.round(mid - ((text.length * 4 - 1) * px) / 2), y0 = Math.round(mid - (5 * px) / 2);
        ctx.fillStyle = d.light(1, 0.25);
        [...text].forEach((ch, i) => GLYPHS[ch].forEach((line, y) => [...line].forEach((on, x) => {
          if (on === "X") ctx.fillRect(x0 + (i * 4 + x) * px, y0 + y * px, px, px);
        })));
      },
    },
    battery: {
      height: 22,
      layout(w, h) { const c = Math.max(1, Math.min(6, Math.floor(w / 46), Math.floor(h / 11))); return { c, cols: 46, rows: 11, w: 46 * c, h: 11 * c }; },
      draw(d) {
        const shell = "#5d7290";
        for (let x = 0; x < 43; x++) { d.cell(x, 0, shell, 0); d.cell(x, 10, shell, 0); }
        for (let y = 0; y <= 10; y++) { d.cell(0, y, shell, 0); d.cell(42, y, shell, 0); }
        for (let y = 3; y <= 7; y++) { d.cell(43, y, shell, 0); d.cell(44, y, shell, 0); }
        const level = d.p * 10;
        const color = d.state === "fail" ? FAIL[0] : d.p < 0.2 ? LEVELS.low : d.p < 0.5 ? LEVELS.mid : LEVELS.high;
        for (let i = 0; i < 10; i++) {
          const f = clamp(level - i);
          for (let x = 0; x < 3; x++)
            for (let y = 2; y <= 8; y++) d.cell(2 + i * 4 + x, y, f >= 1 || (f > 0 && d.blink(2)) ? color : d.faint, 0);
        }
        if (d.state === "run" && d.blink(1.2))
          BOLT.forEach((line, y) => [...line].forEach((ch, x) => { if (ch === "X") d.cell(19 + x, 3 + y, "#ffffff", 0); }));
      },
    },
    mosaic: {
      height: 64,
      layout(w, h, o, bar) {
        const img = bar.image();
        const ratio = img ? (img.naturalWidth || img.width) / (img.naturalHeight || img.height) || 1 : 1;
        const fw = Math.max(8, Math.floor(Math.min(w, h * ratio)));
        return { w: fw, h: Math.max(8, Math.floor(fw / ratio)) };
      },
      draw(d) {
        const { g, ctx, mem } = d;
        const img = d.bar.image();
        mem.off ||= document.createElement("canvas");
        const res = d.p >= 1 ? g.w : Math.max(2, Math.round(2 + Math.pow(d.p, 2.2) * (g.w / 2)));
        const off = mem.off, o = off.getContext("2d");
        off.width = res; off.height = Math.max(1, Math.round((res * g.h) / g.w));
        if (img) o.drawImage(img, 0, 0, off.width, off.height);
        else { // no image: reveal the bar's own gradient
          const lg = o.createLinearGradient(0, 0, off.width, off.height);
          lg.addColorStop(0, d.grad(0)); lg.addColorStop(1, d.grad(1));
          o.fillStyle = lg; o.fillRect(0, 0, off.width, off.height);
        }
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.25 + 0.75 * d.p;
        if (d.state === "fail") ctx.filter = "grayscale(1) brightness(0.7)";
        ctx.drawImage(off, 0, 0, g.w, g.h);
        ctx.filter = "none";
        ctx.globalAlpha = 1;
      },
      live: () => false,
    },
    tank: {
      height: 28,
      layout(w, h) { const c = Math.max(1, Math.min(5, Math.floor(h / 14))); const rows = c === 1 ? Math.max(4, Math.min(14, Math.floor(h))) : 14; const cols = Math.max(4, Math.floor(w / c)); return { c, rows, cols, w: cols * c, h: rows * c }; },
      draw(d) {
        const { g, mem } = d;
        mem.drops ||= [];
        const level = d.p * (g.rows - 1);
        const waves = d.state === "run" && d.p < 1 && !d.still;
        const surface = (x) => Math.round(level + (waves ? Math.sin(x * 0.7 + d.t * 5) * 0.6 : 0));
        for (let x = 0; x < g.cols; x++) {
          const h = clamp(surface(x), 0, g.rows - 1);
          for (let y = 0; y < g.rows - 1; y++) d.cell(x, y, y >= g.rows - 1 - h ? d.grad(1 - y / g.rows) : d.faint);
          d.cell(x, g.rows - 1, "#5d7290", 0);
        }
        if (waves && Math.random() < d.dt * 18) mem.drops.push({ x: Math.floor(Math.random() * g.cols), y: 0, v: 18 + Math.random() * 10 });
        mem.drops = mem.drops.filter((drop) => {
          drop.y += drop.v * d.dt;
          const top = g.rows - 1 - surface(drop.x);
          if (drop.y >= top) { d.cell(drop.x - 1, top - 1, d.light(1, 0.5)); d.cell(drop.x + 1, top - 1, d.light(1, 0.5)); return false; }
          d.cell(drop.x, Math.floor(drop.y), d.light(1, 0.4));
          d.cell(drop.x, Math.floor(drop.y) - 1, d.grad(1, 0.4));
          return true;
        });
        if (d.state !== "run") mem.drops.length = 0;
      },
      live: (d) => d.state === "run" || d.mem.drops?.length > 0,
    },
    scanner: {
      height: 12,
      indeterminate: true,
      layout: (w, h) => grid(w, h, 3, 6),
      draw(d) {
        const { g } = d;
        const fillAll = (color) => { for (let x = 0; x < g.cols; x++) for (let y = 0; y < g.rows; y++) d.cell(x, y, typeof color === "function" ? color(x) : color); };
        if (d.state === "done") return fillAll((x) => d.grad(x / g.cols));
        if (d.state === "fail") return fillAll(d.grad(0.3));
        fillAll(d.faint);
        const phase = d.still ? Math.PI / 2 : d.t * (d.state === "run" ? 2.4 : 0.8);
        const pos = (Math.sin(phase) * 0.5 + 0.5) * (g.cols - 1);
        const dir = Math.cos(phase) >= 0 ? 1 : -1;
        for (let k = 10; k >= 0; k--) {
          const x = Math.round(pos - dir * k);
          if (x < 0 || x >= g.cols) continue;
          for (let y = 0; y < g.rows; y++) d.cell(x, y, k === 0 ? d.light(pos / g.cols, 0.5) : d.grad(pos / g.cols, 1 - k / 11));
        }
      },
      // it sweeps for as long as the work goes on, even without new values
      live: (d) => d.state !== "done" && d.state !== "fail",
    },
  };

  /* ---------- one shared loop for every bar ---------- */
  const bars = new Map();
  let raf = 0, last = 0;
  const kick = () => { if (!raf && hasWindow) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  function tick(now) {
    raf = 0;
    const raw = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const s = PixelFX.settings();
    let again = false;
    for (const bar of bars.values()) {
      // off-screen bars paint once so they're never blank, then wait until they scroll into view
      const due = bar.visible ? bar.dirty || bar.animating : bar.dirty && !bar.painted;
      if (!due) continue;
      bar.dirty = false;
      bar.painted = true;
      bar.animating = bar.draw(now / 1000, raw * s.speed * (+bar.opts.speed || 1), s);
      again ||= bar.animating;
    }
    if (again) raf = requestAnimationFrame(tick);
  }
  // only draw bars that are on screen; catch up when they scroll back in
  const seen = hasWindow && typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver((entries) => entries.forEach((entry) => {
        const bar = bars.get(entry.target);
        if (bar) { bar.visible = entry.isIntersecting; if (bar.visible) bar.invalidate(); }
      }))
    : null;

  /* ---------- a bar ---------- */
  const DEFAULTS = {
    value: 0, max: 100, scheme: null, colors: null, track: "#13233b", label: null,
    burst: false, autoDone: true, count: 0, image: null, speed: 1,
  };
  const HIDDEN = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;";
  const RUN_FOR = 1.5; // seconds a bar keeps animating after its last value change

  class Bar {
    constructor(el, style, opts = {}) {
      if (!STYLES[style]) throw new Error(`PixelFX.progress: unknown style "${style}". Use one of: ${Object.keys(STYLES).join(", ")}`);
      const clean = Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined && v !== null && v !== ""));
      this.el = el;
      this.style = style;
      this.def = STYLES[style];
      this.opts = { ...DEFAULTS, ...clean };
      this.mem = {};
      this.mode = "idle"; // idle | done | fail
      this.forced = false;
      this.changedAt = -9; this.doneAt = -9; this.failAt = -9;
      this.visible = true; this.dirty = true; this.animating = false;
      this.added = [];

      // host: a positioning context and a height to draw into
      const cs = getComputedStyle(el);
      this.saved = { position: el.style.position, minHeight: el.style.minHeight };
      if (cs.position === "static") el.style.position = "relative";
      if (!el.offsetHeight && cs.display !== "none") el.style.minHeight = `${this.def.height}px`;

      const canvas = (this.canvas = document.createElement("canvas"));
      canvas.className = "pixelfx-progress-canvas";
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText = "position:absolute;display:block;pointer-events:none;margin:0;padding:0;border:0;";
      el.append(canvas);
      this.ctx = canvas.getContext("2d");

      // a <progress> inside stays the accessible source of truth; otherwise the host becomes a progressbar
      this.native = el.querySelector("progress");
      if (this.native) {
        this.nativeCss = this.native.style.cssText;
        this.native.style.cssText += HIDDEN;
        this.readNative();
      } else {
        this.max = +this.opts.max > 0 ? +this.opts.max : 100;
        this.value = this.def.indeterminate && opts.value == null ? null : clamp(+this.opts.value || 0, 0, this.max);
        this.startedEmpty = this.value == null;
        this.own("role", "progressbar");
        this.own("aria-valuemin", "0");
        if (this.opts.label) this.own("aria-label", this.opts.label, true);
      }
      this.shown = this.fraction;
      this.aria();
      if (this.opts.image) this.load(this.opts.image);

      this.ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => this.refresh()) : null;
      this.ro?.observe(el);
      this.mo = new MutationObserver(() => this.sync());
      this.mo.observe(el, { attributes: true, attributeFilter: ["data-pixel-value", "data-pixel-max", "data-pixel-state"] });
      if (this.native) this.mo.observe(this.native, { attributes: true, attributeFilter: ["value", "max"] });
      seen?.observe(el);
      this.refresh();
    }

    own(name, value, onlyIfMissing) {
      const el = this.el;
      if (onlyIfMissing && (el.hasAttribute(name) || el.hasAttribute("aria-labelledby"))) return;
      if (name === "role" && el.hasAttribute("role")) return;
      if (!el.hasAttribute(name)) this.added.push(name);
      el.setAttribute(name, value);
    }

    /** 0–1, or 0 while indeterminate. */
    get fraction() { return this.value == null ? 0 : this.value / this.max; }
    get indeterminate() { return this.value == null; }
    /** "idle", "active", "done" or "fail". */
    get state() { return this.mode !== "idle" ? this.mode : this.running(performance.now() / 1000) ? "active" : "idle"; }
    running(t) { return this.forced || t - this.changedAt < RUN_FOR; }

    readNative() {
      const p = this.native;
      this.max = +p.max > 0 ? +p.max : 1;
      this.value = p.hasAttribute("value") ? clamp(+p.value || 0, 0, this.max) : null;
    }

    /** Set the value (and optionally the max). null means indeterminate. Reaching max finishes the bar. */
    set(value, max) {
      if (max != null && +max > 0) this.max = +max;
      this.value = value == null || value === "" ? null : clamp(+value || 0, 0, this.max);
      if (this.native) {
        if (this.native.max !== this.max) this.native.max = this.max;
        if (this.value == null) this.native.removeAttribute("value");
        else if (+this.native.value !== this.value) this.native.value = this.value;
      }
      if (this.mode !== "idle" && (this.value == null || this.value < this.max)) this.mode = "idle";
      this.changedAt = performance.now() / 1000;
      if (this.value != null && this.value >= this.max && this.opts.autoDone) return this.done();
      this.aria();
      this.invalidate();
      return this;
    }

    /** Fill the bar, flash it, and fire the done burst if one is set. */
    done() {
      if (this.mode === "done") return this;
      this.mode = "done";
      this.value = this.max;
      if (this.native && +this.native.value !== this.max) this.native.value = this.max;
      this.doneAt = performance.now() / 1000;
      this.aria();
      this.invalidate();
      const b = this.opts.burst;
      if (b && PixelFX.burst) {
        const o = typeof b === "string" ? { style: b } : { ...b };
        if (this.opts.colors && !o.colors) o.colors = pair(this.opts.colors);
        else if (this.opts.scheme && !o.scheme) o.scheme = this.opts.scheme;
        PixelFX.burst(this.el, o);
      }
      return this;
    }

    /** Turn the bar red with a short glitch. It keeps its value. */
    fail() {
      this.mode = "fail";
      this.failAt = performance.now() / 1000;
      this.aria();
      this.invalidate();
      return this;
    }

    /** Back to empty and idle. */
    reset() {
      this.mode = "idle";
      this.mem = {};
      this.forced = false;
      this.changedAt = -9;
      // an indeterminate scanner goes back to sweeping; everything else back to empty
      this.set(this.def.indeterminate && (this.native ? !this.native.hasAttribute("value") : this.startedEmpty) ? null : 0);
      this.changedAt = -9;
      this.shown = this.fraction;
      return this;
    }

    /** Keep the running animation on regardless of value changes, e.g. while a request is in flight. */
    setActive(on = true) { this.forced = !!on; this.invalidate(); return this; }

    sync() {
      const d = this.el.dataset;
      if (this.native) {
        const before = [this.value, this.max];
        this.readNative();
        if (before[0] !== this.value || before[1] !== this.max) {
          if (this.mode !== "idle" && (this.value == null || this.value < this.max)) this.mode = "idle";
          this.changedAt = performance.now() / 1000;
          if (this.value != null && this.value >= this.max && this.opts.autoDone) this.done();
        }
      } else if (d.pixelValue !== undefined || d.pixelMax !== undefined) {
        const v = d.pixelValue === undefined ? this.value : d.pixelValue === "" ? null : +d.pixelValue;
        const m = d.pixelMax ? +d.pixelMax : null;
        if (v !== this.value || (m && m !== this.max)) this.set(v, m);
      }
      const want = d.pixelState;
      if (want === "done" && this.mode !== "done") this.done();
      else if (want === "fail" && this.mode !== "fail") this.fail();
      if (want !== undefined) this.forced = want === "active";
      this.aria();
      this.invalidate();
    }

    aria() {
      if (this.native) return;
      const el = this.el;
      el.setAttribute("aria-valuemax", String(this.max));
      if (this.value == null) el.removeAttribute("aria-valuenow");
      else el.setAttribute("aria-valuenow", String(Math.round(this.value * 100) / 100));
      if (this.mode === "fail") el.setAttribute("aria-valuetext", "Failed");
      else el.removeAttribute("aria-valuetext");
      if (!this.added.includes("aria-valuemax")) this.added.push("aria-valuemax", "aria-valuenow", "aria-valuetext");
    }

    load(src) {
      if (typeof src === "string") {
        const img = new Image();
        img.decoding = "async";
        img.addEventListener("load", () => this.refresh(), { once: true });
        img.src = src;
        this.img = img;
      } else {
        this.img = src;
        if (src instanceof HTMLImageElement && !src.complete) src.addEventListener("load", () => this.refresh(), { once: true });
      }
    }
    image() {
      const img = this.img;
      if (!img) return null;
      if (img instanceof HTMLImageElement) return img.complete && img.naturalWidth ? img : null;
      return img;
    }

    palette(s) {
      if (this.mode === "fail") return FAIL;
      if (this.opts.colors) return pair(this.opts.colors);
      return (this.opts.scheme ? PixelFX.colors(this.opts.scheme) : s.colors).brand;
    }

    /** Re-measure after the element's size changes (called automatically when it resizes). */
    refresh() {
      if (this.destroyed) return this;
      const el = this.el, cs = getComputedStyle(el);
      const pl = parseFloat(cs.paddingLeft) || 0, pt = parseFloat(cs.paddingTop) || 0;
      const w = el.clientWidth - pl - (parseFloat(cs.paddingRight) || 0);
      const h = el.clientHeight - pt - (parseFloat(cs.paddingBottom) || 0);
      const g = (this.g = this.def.layout(Math.max(1, w), Math.max(1, h), this.opts, this));
      this.dpr = Math.min(window.devicePixelRatio || 1, PixelFX.settings().maxDpr);
      this.canvas.width = Math.max(1, Math.round(g.w * this.dpr));
      this.canvas.height = Math.max(1, Math.round(g.h * this.dpr));
      Object.assign(this.canvas.style, {
        left: `${pl + Math.floor((w - g.w) / 2)}px`,
        top: `${pt + Math.floor((h - g.h) / 2)}px`,
        width: `${g.w}px`,
        height: `${g.h}px`,
      });
      this.painted = false; // resizing the canvas cleared it
      this.invalidate();
      return this;
    }

    invalidate() { if (this.destroyed) return; this.dirty = true; kick(); }

    /** Paint one frame. Returns true while it needs more frames. */
    draw(t, dt, s) {
      const still = s.respectReducedMotion && reduce.matches;
      const target = this.fraction;
      this.shown = still || Math.abs(target - this.shown) < 0.0005 ? target : this.shown + (target - this.shown) * (1 - Math.exp(-dt * 12));
      const state = this.mode !== "idle" ? this.mode : this.running(t) ? "run" : "idle";
      const [a, b] = this.palette(s).map(rgb);
      const track = rgb(this.opts.track);
      const g = this.g, c = g.c || 1, ctx = this.ctx;
      const d = {
        ctx, g, t, dt, state, still, bar: this, mem: this.mem, p: this.shown, indeterminate: this.value == null,
        track: rgba(track), faint: rgba(track, 0.6), trackSolid: rgba(mix(track, [0, 0, 0], 0.5)), faintDot: rgba(mix(track, WHITE, 0.45)),
        grad: (u, alpha = 1) => rgba(mix(a, b, clamp(u)), alpha),
        light: (u, amount) => rgba(mix(mix(a, b, clamp(u)), WHITE, amount)),
        blink: (hz) => still || state !== "run" || Math.floor(t * hz * 2) % 2 === 0,
        // one square pixel; the 1px seam drops away on pixels too small to keep it
        cell(x, y, color, gap = 1, size = 1) {
          if (c <= 2) gap = size > 1 && c === 2 ? 1 : 0;
          ctx.fillStyle = color;
          ctx.fillRect(Math.round(x * c), Math.round(y * c), size * c - gap, size * c - gap);
        },
      };
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);
      ctx.save();
      const glitch = state === "fail" && !still && t - this.failAt < 0.5;
      if (glitch) ctx.translate((Math.random() < 0.5 ? -1 : 1) * c * Math.ceil(Math.random() * 2), 0);
      this.def.draw(d);
      ctx.restore();
      const flash = state === "done" && !still && t - this.doneAt < 0.45;
      if (flash) { // light only the pixels already drawn
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - (t - this.doneAt) / 0.45)})`;
        ctx.fillRect(0, 0, g.w, g.h);
        ctx.globalCompositeOperation = "source-over";
      }
      if (still) return false;
      const live = this.def.live ? this.def.live(d) : state === "run";
      return live || glitch || flash || Math.abs(target - this.shown) >= 0.0005 || state === "run";
    }

    /** Remove the canvas, observers and anything the bar added to the element. */
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.ro?.disconnect();
      this.mo.disconnect();
      seen?.unobserve(this.el);
      this.canvas.remove();
      if (this.native) this.native.style.cssText = this.nativeCss;
      this.added.forEach((name) => this.el.removeAttribute(name));
      this.el.style.position = this.saved.position;
      this.el.style.minHeight = this.saved.minHeight;
      if (this.el.getAttribute("style") === "") this.el.removeAttribute("style");
      bars.delete(this.el);
    }
  }

  /* ---------- api ---------- */
  function optionsFromData(el) {
    const d = el.dataset;
    const bool = (v) => (v == null ? undefined : v !== "false");
    return {
      value: d.pixelValue === "" ? null : d.pixelValue,
      max: d.pixelMax,
      scheme: d.pixelScheme,
      colors: d.pixelColors,
      track: d.pixelTrack,
      label: d.pixelLabel,
      burst: d.pixelDoneBurst,
      autoDone: bool(d.pixelAutoDone),
      count: d.pixelCount ? +d.pixelCount : undefined,
      image: d.pixelImage,
      speed: d.pixelSpeed ? +d.pixelSpeed : undefined,
    };
  }

  /** Turn an element into a pixel progress bar. Replaces any bar already on it. */
  function progress(el, style = "segments", opts = {}) {
    if (style && typeof style === "object") { opts = style; style = opts.style || "segments"; }
    if (!el) throw new Error("PixelFX.progress: element is required");
    if (el.tagName === "PROGRESS") throw new Error("PixelFX.progress: attach to an element that wraps the <progress>, not to the <progress> itself");
    bars.get(el)?.destroy();
    const bar = new Bar(el, style, opts);
    bars.set(el, bar);
    const state = el.dataset.pixelState;
    if (state === "done") bar.done(); else if (state === "fail") bar.fail(); else if (state === "active") bar.setActive(true);
    return bar;
  }

  /** Create a bar for every [data-pixel-progress] element under root (skips ones already set up). */
  function scan(root = document) {
    const els = [];
    if (root.matches?.("[data-pixel-progress]")) els.push(root);
    root.querySelectorAll?.("[data-pixel-progress]").forEach((el) => els.push(el));
    return els.map((el) => bars.get(el) || progress(el, el.dataset.pixelProgress || "segments", optionsFromData(el)));
  }

  /** Redraw every bar, e.g. after changing colours with PixelFX.configure(). */
  function refresh() { bars.forEach((bar) => bar.refresh()); }

  Object.assign(progress, {
    VERSION,
    styles: Object.keys(STYLES),
    scan,
    refresh,
    get: (el) => bars.get(el) || null,
    destroy: (el) => bars.get(el)?.destroy(),
    all: () => [...bars.values()],
  });

  if (hasWindow) {
    reduce.addEventListener?.("change", () => bars.forEach((bar) => bar.invalidate()));
    window.addEventListener("pixelfx:configure", refresh);
  }

PixelFX.progress = progress;
const { styles, get, destroy, all } = progress;
export { progress, VERSION, styles, scan, refresh, get, destroy, all };
export default progress;
