/**
 * Homepage hero color theme — edited in ERP Front Public (home page).
 * Hex + scrim direction + hero nav glass; opacities applied in public UI.
 *
 * Defaults: Himalayan Champagne Dusk — warm ivory/gold over ink-to-espresso scrim,
 * iOS-style clear frosted nav bar.
 */

import type { CSSProperties } from "react";

export type HeroScrimDirection =
  | "top-bottom"
  | "bottom-top"
  | "left-right"
  | "right-left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "radial-center"
  | "radial-top"
  | "radial-bottom"
  | "radial-top-left"
  | "radial-top-right"
  | "radial-bottom-left"
  | "radial-bottom-right";

export type HeroTheme = {
  scrimTop: string;
  scrimBottom: string;
  scrimDirection: HeroScrimDirection;
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
  button: string;
  /** Hero nav bar glass fill (homepage, over photo only) */
  navTint: string;
  /** How opaque that tint is (0 clear … 80 nearly solid) */
  navOpacity: number;
  /** Backdrop blur strength in px */
  navBlur: number;
  /** Brand name + menu labels on the hero bar */
  navText: string;
};

export type HeroThemeColorKey = Exclude<
  keyof HeroTheme,
  "scrimDirection" | "navOpacity" | "navBlur"
>;

export type HeroScrimDirectionOption = {
  id: HeroScrimDirection;
  label: string;
  short: string;
  group: "linear" | "radial";
};

export type HeroNavPreset = {
  id: string;
  label: string;
  hint: string;
  navTint: string;
  navOpacity: number;
  navBlur: number;
  navText: string;
};

export const HERO_NAV_PRESETS: readonly HeroNavPreset[] = [
  {
    id: "ios",
    label: "iOS clear",
    hint: "Light frost, photo shows through",
    navTint: "#ffffff",
    navOpacity: 10,
    navBlur: 24,
    navText: "#ffffff",
  },
  {
    id: "navy",
    label: "Navy glass",
    hint: "Earlier sky-ink slab",
    navTint: "#082f49",
    navOpacity: 55,
    navBlur: 20,
    navText: "#ffffff",
  },
  {
    id: "ink",
    label: "Soft ink",
    hint: "Champagne dusk scrim match",
    navTint: "#0a1628",
    navOpacity: 40,
    navBlur: 22,
    navText: "#faf6ef",
  },
  {
    id: "bare",
    label: "Barely there",
    hint: "Minimal tint, max photo",
    navTint: "#ffffff",
    navOpacity: 4,
    navBlur: 16,
    navText: "#ffffff",
  },
] as const;

export const HERO_SCRIM_DIRECTIONS: readonly HeroScrimDirectionOption[] = [
  { id: "top-bottom", label: "Top → bottom", short: "↓", group: "linear" },
  { id: "bottom-top", label: "Bottom → top", short: "↑", group: "linear" },
  { id: "left-right", label: "Left → right", short: "→", group: "linear" },
  { id: "right-left", label: "Right → left", short: "←", group: "linear" },
  { id: "top-left", label: "Top-left → bottom-right", short: "↘", group: "linear" },
  { id: "top-right", label: "Top-right → bottom-left", short: "↙", group: "linear" },
  { id: "bottom-left", label: "Bottom-left → top-right", short: "↗", group: "linear" },
  { id: "bottom-right", label: "Bottom-right → top-left", short: "↖", group: "linear" },
  { id: "radial-center", label: "From middle (vignette)", short: "◎", group: "radial" },
  { id: "radial-top", label: "From top center", short: "⊙↑", group: "radial" },
  { id: "radial-bottom", label: "From bottom center", short: "⊙↓", group: "radial" },
  { id: "radial-top-left", label: "From top-left corner", short: "⊙↖", group: "radial" },
  { id: "radial-top-right", label: "From top-right corner", short: "⊙↗", group: "radial" },
  { id: "radial-bottom-left", label: "From bottom-left corner", short: "⊙↙", group: "radial" },
  { id: "radial-bottom-right", label: "From bottom-right corner", short: "⊙↘", group: "radial" },
] as const;

const DIRECTION_IDS = new Set<string>(HERO_SCRIM_DIRECTIONS.map((d) => d.id));

export const DEFAULT_HERO_THEME: HeroTheme = {
  scrimTop: "#0a1628",
  scrimBottom: "#1a120e",
  scrimDirection: "top-bottom",
  eyebrow: "#e8c97a",
  title: "#faf6ef",
  body: "#e6dece",
  accent: "#c9a227",
  button: "#f0e4c8",
  navTint: "#ffffff",
  navOpacity: 10,
  navBlur: 24,
  navText: "#ffffff",
};

/** Espresso type over the light 3D house — not the photo-hero ivory-on-ink. */
export const FACADE_HERO_THEME: HeroTheme = {
  scrimTop: "#f7f1e8",
  scrimBottom: "#1a120e",
  scrimDirection: "bottom-top",
  eyebrow: "#7c6a46",
  title: "#1c1917",
  body: "#44403c",
  accent: "#c9a227",
  button: "#1c1917",
  navTint: "#ffffff",
  navOpacity: 48,
  navBlur: 20,
  navText: "#1c1917",
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string | null | undefined): boolean {
  return Boolean(value && HEX.test(value.trim()));
}

export function normalizeHex(value: string, fallback: string): string {
  const raw = value.trim();
  if (!HEX.test(raw)) return fallback;
  if (raw.length === 4) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return raw.toLowerCase();
}

export function parseHeroScrimDirection(value: unknown): HeroScrimDirection {
  if (typeof value === "string" && DIRECTION_IDS.has(value)) {
    return value as HeroScrimDirection;
  }
  return DEFAULT_HERO_THEME.scrimDirection;
}

export function clampHeroNavOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_HERO_THEME.navOpacity;
  return Math.min(80, Math.max(0, Math.round(value)));
}

export function clampHeroNavBlur(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_HERO_THEME.navBlur;
  return Math.min(40, Math.max(0, Math.round(value)));
}

function parseIntField(
  value: unknown,
  clamp: (n: number) => number,
  fallback: number,
): number {
  if (typeof value === "number") return clamp(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n)) return clamp(n);
  }
  return fallback;
}

export function parseHeroTheme(value: unknown): HeroTheme {
  const row =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const pick = (key: HeroThemeColorKey) =>
    normalizeHex(
      typeof row[key] === "string" ? (row[key] as string) : "",
      DEFAULT_HERO_THEME[key],
    );
  return {
    scrimTop: pick("scrimTop"),
    scrimBottom: pick("scrimBottom"),
    scrimDirection: parseHeroScrimDirection(row.scrimDirection),
    eyebrow: pick("eyebrow"),
    title: pick("title"),
    body: pick("body"),
    accent: pick("accent"),
    button: pick("button"),
    navTint: pick("navTint"),
    navOpacity: parseIntField(
      row.navOpacity,
      clampHeroNavOpacity,
      DEFAULT_HERO_THEME.navOpacity,
    ),
    navBlur: parseIntField(
      row.navBlur,
      clampHeroNavBlur,
      DEFAULT_HERO_THEME.navBlur,
    ),
    navText: pick("navText"),
  };
}

export function parseHeroThemeFromForm(formData: FormData): HeroTheme {
  return parseHeroTheme({
    scrimTop: formData.get("hero_theme_scrim_top"),
    scrimBottom: formData.get("hero_theme_scrim_bottom"),
    scrimDirection: formData.get("hero_theme_scrim_direction"),
    eyebrow: formData.get("hero_theme_eyebrow"),
    title: formData.get("hero_theme_title"),
    body: formData.get("hero_theme_body"),
    accent: formData.get("hero_theme_accent"),
    button: formData.get("hero_theme_button"),
    navTint: formData.get("hero_theme_nav_tint"),
    navOpacity: formData.get("hero_theme_nav_opacity"),
    navBlur: formData.get("hero_theme_nav_blur"),
    navText: formData.get("hero_theme_nav_text"),
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex, "");
  if (!n || n.length !== 7) return null;
  const r = Number.parseInt(n.slice(1, 3), 16);
  const g = Number.parseInt(n.slice(3, 5), 16);
  const b = Number.parseInt(n.slice(5, 7), 16);
  if (![r, g, b].every((c) => Number.isFinite(c))) return null;
  return { r, g, b };
}

export function hexAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(10, 22, 40, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function heroNavBarStyle(theme: HeroTheme): CSSProperties {
  const opacity = clampHeroNavOpacity(theme.navOpacity) / 100;
  const blur = clampHeroNavBlur(theme.navBlur);
  const filter = `blur(${blur}px) saturate(1.65)`;
  return {
    backgroundColor: hexAlpha(theme.navTint, opacity),
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: hexAlpha(theme.navText, 0.22),
    boxShadow: `inset 0 1px 0 0 ${hexAlpha("#ffffff", 0.5)}, inset 0 -0.5px 0 0 ${hexAlpha("#ffffff", 0.06)}`,
  };
}

export function heroNavPanelStyle(theme: HeroTheme): CSSProperties {
  const opacity = Math.min(
    0.85,
    clampHeroNavOpacity(theme.navOpacity) / 100 + 0.08,
  );
  const blur = clampHeroNavBlur(theme.navBlur) + 8;
  const filter = `blur(${blur}px) saturate(1.65)`;
  return {
    backgroundColor: hexAlpha(theme.navTint, opacity),
    color: theme.navText,
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
    borderColor: hexAlpha(theme.navText, 0.2),
    boxShadow: `inset 0 1px 0 0 ${hexAlpha("#ffffff", 0.3)}, 0 24px 60px -30px ${hexAlpha("#000000", 0.55)}`,
  };
}

function linearCssDirection(direction: HeroScrimDirection): string | null {
  switch (direction) {
    case "top-bottom":
      return "to bottom";
    case "bottom-top":
      return "to top";
    case "left-right":
      return "to right";
    case "right-left":
      return "to left";
    case "top-left":
      return "to bottom right";
    case "top-right":
      return "to bottom left";
    case "bottom-left":
      return "to top right";
    case "bottom-right":
      return "to top left";
    default:
      return null;
  }
}

function radialPosition(direction: HeroScrimDirection): string | null {
  switch (direction) {
    case "radial-center":
      return "center";
    case "radial-top":
      return "top center";
    case "radial-bottom":
      return "bottom center";
    case "radial-top-left":
      return "top left";
    case "radial-top-right":
      return "top right";
    case "radial-bottom-left":
      return "bottom left";
    case "radial-bottom-right":
      return "bottom right";
    default:
      return null;
  }
}

function luxuryLinearStops(theme: HeroTheme): string {
  return [
    `${hexAlpha(theme.scrimTop, 0.78)} 0%`,
    `${hexAlpha(theme.scrimTop, 0.45)} 18%`,
    `transparent 42%`,
    `transparent 52%`,
    `${hexAlpha(theme.scrimBottom, 0.55)} 72%`,
    `${hexAlpha(theme.scrimBottom, 0.92)} 92%`,
    `${hexAlpha(theme.accent, 0.08)} 100%`,
  ].join(", ");
}

function luxuryRadialStops(theme: HeroTheme, fromCenter: boolean): string {
  if (fromCenter) {
    return [
      `transparent 0%`,
      `transparent 28%`,
      `${hexAlpha(theme.scrimTop, 0.22)} 48%`,
      `${hexAlpha(theme.scrimBottom, 0.72)} 78%`,
      `${hexAlpha(theme.scrimBottom, 0.92)} 96%`,
      `${hexAlpha(theme.accent, 0.08)} 100%`,
    ].join(", ");
  }
  return [
    `${hexAlpha(theme.scrimTop, 0.82)} 0%`,
    `${hexAlpha(theme.scrimTop, 0.4)} 22%`,
    `transparent 48%`,
    `${hexAlpha(theme.scrimBottom, 0.45)} 72%`,
    `${hexAlpha(theme.scrimBottom, 0.9)} 100%`,
  ].join(", ");
}

export function heroScrimGradient(theme: HeroTheme): string {
  const direction = parseHeroScrimDirection(theme.scrimDirection);
  const linear = linearCssDirection(direction);
  if (linear) {
    return `linear-gradient(${linear}, ${luxuryLinearStops(theme)})`;
  }
  const at = radialPosition(direction);
  if (at) {
    const stops = luxuryRadialStops(theme, direction === "radial-center");
    return `radial-gradient(ellipse 130% 110% at ${at}, ${stops})`;
  }
  return `linear-gradient(to bottom, ${luxuryLinearStops(theme)})`;
}

export function heroDirectionPreviewGradient(
  direction: HeroScrimDirection,
  a: string,
  b: string,
): string {
  const linear = linearCssDirection(direction);
  if (linear) {
    return `linear-gradient(${linear}, ${a}, ${b})`;
  }
  const at = radialPosition(direction) ?? "center";
  if (direction === "radial-center") {
    return `radial-gradient(ellipse at ${at}, transparent 15%, ${a} 55%, ${b} 100%)`;
  }
  return `radial-gradient(ellipse at ${at}, ${a} 0%, transparent 45%, ${b} 100%)`;
}
