import type { PixelScheme, PixelBurstStyle, PixelBurstOptions } from "./foopixel-fx";

export type PixelProgressStyle =
  | "segments" | "dither" | "chomper" | "blocks" | "snake" | "hearts" | "lcd"
  | "beam" | "ring" | "battery" | "mosaic" | "tank" | "scanner";

/** "idle", "active" (running: the value changed in the last 1.5 s, or setActive(true)), "done" or "fail". */
export type PixelProgressState = "idle" | "active" | "done" | "fail";

export interface PixelProgressOptions {
  /** Which bar to draw when passing options as the second argument. Default "segments". */
  style?: PixelProgressStyle;
  /** Starting value. Ignored when the element wraps a <progress>, which is read instead. Default 0 (scanner: indeterminate). */
  value?: number | null;
  /** The value that counts as complete. Default 100. */
  max?: number;
  /** Colour scheme for this bar only. Defaults to the global colours. */
  scheme?: PixelScheme;
  /** Custom gradient for this bar only, e.g. ["#ff3c6f", "#ffb02e"]. Overrides scheme. */
  colors?: [string, string] | string;
  /** Hex colour of the unlit pixels. Default "#13233b", for dark backgrounds. */
  track?: string;
  /** Accessible name, used when the element has no aria-label or aria-labelledby. */
  label?: string;
  /** Fire a burst from the bar when it finishes: a burst style, or full burst options. Default none. */
  burst?: PixelBurstStyle | PixelBurstOptions | false;
  /** Finish automatically when the value reaches max. Default true. */
  autoDone?: boolean;
  /** Hearts: how many hearts to draw. Default: as many as fit, up to 10. */
  count?: number;
  /** Mosaic: the image that sharpens as the bar fills (URL, img or canvas). Default: the bar's gradient. */
  image?: string | HTMLImageElement | HTMLCanvasElement;
  /** Multiplier on the global speed for this bar. Default 1. */
  speed?: number;
}

export interface PixelProgressBar {
  readonly el: HTMLElement;
  readonly style: PixelProgressStyle;
  /** Current value, or null while indeterminate. */
  readonly value: number | null;
  readonly max: number;
  readonly indeterminate: boolean;
  readonly state: PixelProgressState;
  /** Set the value (and optionally max). null means indeterminate. Reaching max calls done() unless autoDone is false. */
  set(value: number | null, max?: number): this;
  /** Fill the bar, flash it, and fire the done burst if one is set. */
  done(): this;
  /** Turn the bar red with a short glitch. It keeps its value. */
  fail(): this;
  /** Back to empty and idle. */
  reset(): this;
  /** Keep the running animation on regardless of value changes. */
  setActive(on?: boolean): this;
  /** Re-measure after the element's size changes. Called automatically on resize. */
  refresh(): this;
  /** Remove the canvas, observers and anything the bar added to the element. */
  destroy(): void;
}

export interface PixelProgressApi {
  (el: HTMLElement, style?: PixelProgressStyle | PixelProgressOptions, options?: PixelProgressOptions): PixelProgressBar;
  readonly VERSION: string;
  readonly styles: PixelProgressStyle[];
  /** Create a bar for every [data-pixel-progress] element under root. */
  scan(root?: ParentNode): PixelProgressBar[];
  /** Redraw every bar. */
  refresh(): void;
  get(el: Element): PixelProgressBar | null;
  destroy(el: Element): void;
  all(): PixelProgressBar[];
}

declare const progress: PixelProgressApi;
export default progress;
export { progress };
export const VERSION: PixelProgressApi["VERSION"];
export const styles: PixelProgressApi["styles"];
export const scan: PixelProgressApi["scan"];
export const refresh: PixelProgressApi["refresh"];
export const get: PixelProgressApi["get"];
export const destroy: PixelProgressApi["destroy"];
export const all: PixelProgressApi["all"];

declare module "./foopixel-fx" {
  interface PixelFXApi {
    /** Present once foopixel-fx-progress is loaded. */
    progress?: PixelProgressApi;
  }
}
