import type { CSSProperties } from "react";

/**
 * Deterministic "cinematic gradient" for thumbnail placeholders.
 *
 * Given any string seed (clip id, category id, title…), returns a hue
 * value 0-360 that we feed to `.gradient-thumb` via the `--_h` CSS var.
 * The gradient itself is defined in globals.css.
 *
 * Same seed → same hue, so a clip's fallback color stays stable across
 * renders and pages. That way skeletons don't flash a new color when
 * the real thumbnail loads (or fails to load).
 */
export function hueFromSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return ((h % 360) + 360) % 360;
}

/**
 * Style object ready to spread onto an element that uses `.gradient-thumb`.
 * The `--_h` custom property is picked up by the CSS utility.
 */
export function gradientThumbStyle(seed: string): CSSProperties {
  return { ["--_h" as string]: String(hueFromSeed(seed)) } as CSSProperties;
}
