# FooPixel FX

Pixel hover effects for drop zones and buttons, based on the pixels breaking off the FooPixel logo. There are four effects: `breakaway`, `uplink`, `dither` and `trace`. Each one draws on a canvas it adds to the element and runs only while the element is hovered, focused, dragged over or held active. The library has no dependencies and is about 6 KB gzipped.

<p align="center">
  <a href="docs/foopixel-fx-showcase.mp4"><img src="docs/showcase-poster.png" width="480" alt="Watch the FooPixel FX showcase video"></a>
  <br>
  <a href="docs/foopixel-fx-showcase.mp4"><strong>▶ Watch the 18-second showcase</strong></a>
</p>

## Effects

These are stills of each effect running on a drop zone and two buttons. To see them move, watch the [showcase video](docs/foopixel-fx-showcase.mp4) or open `demo/index.html`.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/breakaway.png" alt="Breakaway effect: pixels detach from the edges of the drop zone and buttons"></td>
    <td width="50%"><img src="docs/screenshots/uplink.png" alt="Uplink effect: pixels climb the sides of the drop zone towards the upload icon"></td>
  </tr>
  <tr>
    <td><strong><code>breakaway</code></strong>: pixels detach from every edge and step outward, shading blue to cyan.</td>
    <td><strong><code>uplink</code></strong>: pixels climb the sides and turn in to the upload icon. Buttons fizz with rising pixels.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/dither.png" alt="Dither effect: a pixel grid lights up under the cursor and fades behind it"></td>
    <td width="50%"><img src="docs/screenshots/trace.png" alt="Trace effect: two pixel trails run along the border of the drop zone and buttons"></td>
  </tr>
  <tr>
    <td><strong><code>dither</code></strong>: a hidden pixel grid lights up under the cursor and fades behind it.</td>
    <td><strong><code>trace</code></strong>: two pixel trails run along the border. Also works as a loading state.</td>
  </tr>
</table>

## Install

Plain script tag. This sets `window.PixelFX` and attaches to every `[data-pixel-fx]` element on the page once the DOM is ready:

```html
<script src="/assets/foopixel-fx.min.js" defer></script>
```

Add `data-manual` to the script tag if you'd rather call `PixelFX.scan()` yourself.

ES module. Nothing attaches automatically:

```js
import PixelFX from "/assets/foopixel-fx.esm.min.js";
PixelFX.scan();
```

## Use it with data attributes

```html
<div class="upload-zone" data-pixel-fx="breakaway" data-pixel-preset="zone">…</div>

<a class="button button-primary" data-pixel-fx="trace" data-pixel-preset="button" data-pixel-fill="light">Upload an image ↗</a>
<a class="button button-quiet"   data-pixel-fx="trace" data-pixel-preset="button">Read the docs</a>
```

| Attribute | Values | Default |
|---|---|---|
| `data-pixel-fx` | `breakaway`, `uplink`, `dither`, `trace` | required |
| `data-pixel-preset` | `zone` for drop areas and panels, `button` for CTAs | `zone` |
| `data-pixel-fill` | `light` for pale pixels on filled buttons | none |
| `data-pixel-density` | multiplier for this element, e.g. `0.6` | `1` |
| `data-pixel-speed` | multiplier for this element | `1` |
| `data-pixel-drag` | `false` to ignore files dragged over it | `true` on zones |
| `data-pixel-target` | Uplink: selector for the icon pixels flow into | `[data-pixel-icon], .upload-symbol` |
| `data-pixel-avoid` | Uplink: selector for the text pixels route around | `[data-pixel-text], .empty-upload` |
| `data-pixel-pulse` | Uplink: `false` to stop the icon ring pulse | `true` |

With Uplink you can also mark the elements directly instead of passing selectors: put `data-pixel-icon` on the icon and `data-pixel-text` on the text block.

## JavaScript API

```js
const fx = PixelFX.attach(el, "trace", { preset: "zone", density: 0.8 });

fx.setActive(true);   // keep running regardless of hover
fx.setActive(false);  // back to hover / focus / drag
fx.refresh();         // re-measure after the element's size or content changes
fx.destroy();         // remove canvas, listeners and inline styles

PixelFX.scan(root);   // attach to [data-pixel-fx] under root; skips ones already attached
PixelFX.get(el);      // instance or null
PixelFX.destroy(el);
PixelFX.all();        // every live instance

PixelFX.configure({
  density: 1,
  speed: 1,
  respectReducedMotion: true,
  maxDpr: 2,
  colors: {
    brand: ["#2e68ff", "#35ceff"],  // blue to cyan
    light: ["#c4deff", "#ffffff"],  // used with data-pixel-fill="light"
    pulse: "#35c6f4",               // Uplink icon ring
  },
});
```

TypeScript types are in `dist/foopixel-fx.d.ts`.

### Upload in progress

Trace works as a loading state. Hold it on while the upload runs:

```js
const zoneFx = PixelFX.get(document.querySelector("[data-upload-zone]"));
zoneFx.setActive(true);
await upload(file);
zoneFx.setActive(false);
```

## How it fits into your layout

The library changes two things on the element it's attached to, and puts both back on `destroy()`:

- If the element is `position: static`, it gets `position: relative`.
- It gets `isolation: isolate`. This lets the canvas sit at `z-index: -1`, above the element's own background but below its content, so the content needs no z-index changes.

Breakaway and Trace draw a little outside the element. If an ancestor has `overflow: hidden`, it needs this much room around the element or it will cut the pixels off:

| Effect | Zone | Button |
|---|---|---|
| Breakaway | 18px | 16px |
| Trace | 12px | 8px |
| Uplink, Dither | 0 | 0 |

The FooPixel uploader already has room for this: the zone sits inside the panel with a 20px margin.

Drag events are only observed. The library never calls `preventDefault()` and never adds classes, so your upload code stays in charge of drops.

## Accessibility and performance

- The canvas is `aria-hidden` and ignores pointer events.
- Keyboard focus (`:focus-visible`) starts the effect, the same as hover.
- By default, nothing animates when the user has reduced motion turned on. To override that, pass `respectReducedMotion: false`.
- Each element runs its own `requestAnimationFrame` loop, only while it's active or fading out, then stops completely. Nothing runs when the page is idle.
- Canvas resolution is capped at 2× device pixel ratio (`maxDpr`).

## Build

`src/` holds the source. `./build.sh` rebuilds `dist/` and needs Node for `npx terser`. Open `demo/index.html` to compare the effects, using the sliders and the "keep running" toggle.

```
dist/foopixel-fx.js          script tag, readable
dist/foopixel-fx.min.js      script tag, minified
dist/foopixel-fx.esm.js      ES module, readable
dist/foopixel-fx.esm.min.js  ES module, minified
dist/foopixel-fx.d.ts        types
```

## License

MIT. See [LICENSE](LICENSE).
