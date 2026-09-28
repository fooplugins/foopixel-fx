export type PixelEffect = "breakaway" | "uplink" | "dither" | "trace";
export type PixelScheme = "foopixel" | "synthwave" | "cyberpunk" | "toxic" | "sunset" | "aurora" | "ultraviolet";
export type PixelBurstStyle = "burst" | "confetti" | "shatter" | "shockwave" | "firework" | "starburst" | "rain" | "gather";

export interface PixelFXOptions {
  /** "zone" for drop areas and panels, "button" for CTAs. Default "zone". */
  preset?: "zone" | "button";
  /** "light" draws pale pixels, for filled buttons. */
  fill?: "light" | null;
  /** Multiplier on the global density for this element. Default 1. */
  density?: number;
  /** Multiplier on the global speed for this element. Default 1. */
  speed?: number;
  /** Uplink: selector (inside the element) for the icon pixels flow into. */
  target?: string;
  /** Uplink: selector (inside the element) for the text block pixels route around. */
  avoid?: string;
  /** Uplink: pulse the target's ring when pixels arrive. Default true. */
  pulse?: boolean;
  /** React to files dragged over the element. Default true for "zone", false for "button". */
  drag?: boolean;
  /** Colour scheme for this element only. Defaults to the global colours. */
  scheme?: PixelScheme;
  /** Custom gradient for this element only, e.g. ["#ff3c6f", "#ffb02e"]. Overrides scheme. */
  colors?: [string, string] | string;
}

export interface PixelFXInstance {
  readonly el: HTMLElement;
  readonly name: PixelEffect;
  readonly active: boolean;
  /** Keep running regardless of hover (e.g. while an upload is in progress). */
  setActive(on?: boolean): this;
  /** Re-measure after the element's size or content changes. */
  refresh(): this;
  /** Remove the canvas, listeners and inline styles. */
  destroy(): void;
}

export interface PixelBurstOptions {
  /** Which burst to fire. Default "burst". */
  style?: PixelBurstStyle;
  /** Multiplier on the number of pixels. Default 1. */
  amount?: number;
  /** Multiplier on pixel size. Default 1. */
  size?: number;
  /** Multiplier on the global speed for this burst. Default 1. */
  speed?: number;
  /** Multiplier on gravity. 0 lets pixels float. Default 1. */
  gravity?: number;
  /** Snap pixels to a coarse grid for a crisp, retro look. Default true. */
  snap?: boolean;
  /** Colour scheme for this burst only. Defaults to the global colours. */
  scheme?: PixelScheme;
  /** Custom gradient for this burst only, e.g. ["#ff3c6f", "#ffb02e"]. Overrides scheme. */
  colors?: [string, string] | string;
  /** Shatter: the viewport point the break spreads from. Defaults to the element's centre. */
  origin?: { x: number; y: number };
}

export interface PixelFXConfig {
  density?: number;
  speed?: number;
  respectReducedMotion?: boolean;
  maxDpr?: number;
  /** Switch every effect and burst to a named scheme. Applied before colors. */
  scheme?: PixelScheme;
  colors?: { brand?: [string, string]; light?: [string, string]; pulse?: string };
}

export interface PixelFXApi {
  readonly VERSION: string;
  readonly effects: PixelEffect[];
  attach(el: HTMLElement, name: PixelEffect, options?: PixelFXOptions): PixelFXInstance;
  scan(root?: ParentNode): PixelFXInstance[];
  get(el: Element): PixelFXInstance | null;
  destroy(el: Element): void;
  all(): PixelFXInstance[];
  configure(config?: PixelFXConfig): Required<PixelFXConfig>;
  readonly bursts: PixelBurstStyle[];
  readonly schemes: PixelScheme[];
  /** Fire a one-off burst from an element's centre, or from a viewport point. Returns false if nothing was drawn. */
  burst(target: Element | { x: number; y: number }, options?: PixelBurstOptions): boolean;
}

declare const PixelFX: PixelFXApi;
export default PixelFX;
export const VERSION: PixelFXApi["VERSION"];
export const effects: PixelFXApi["effects"];
export const attach: PixelFXApi["attach"];
export const scan: PixelFXApi["scan"];
export const get: PixelFXApi["get"];
export const destroy: PixelFXApi["destroy"];
export const all: PixelFXApi["all"];
export const configure: PixelFXApi["configure"];
export const burst: PixelFXApi["burst"];
export const bursts: PixelFXApi["bursts"];
export const schemes: PixelFXApi["schemes"];

declare global {
  interface Window { PixelFX: PixelFXApi }
}
