export type PixelEffect = "breakaway" | "uplink" | "dither" | "trace";

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

export interface PixelFXConfig {
  density?: number;
  speed?: number;
  respectReducedMotion?: boolean;
  maxDpr?: number;
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

declare global {
  interface Window { PixelFX: PixelFXApi }
}
