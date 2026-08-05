/**
 * Homepage hero color theme — edited in ERP Front Public (home page).
 * Hex only; opacity applied in the public hero overlay.
 */

export type HeroTheme = {
  /** Top of photo scrim (nav contrast) */
  scrimTop: string;
  /** Bottom of photo scrim (type contrast) */
  scrimBottom: string;
  /** Eyebrow / secondary accent text */
  eyebrow: string;
  title: string;
  body: string;
  /** Active carousel marks, citrus highlights */
  accent: string;
  /** Secondary outline CTA border + text */
  button: string;
};

export const DEFAULT_HERO_THEME: HeroTheme = {
  scrimTop: "#0b1020",
  scrimBottom: "#0b1f33",
  eyebrow: "#fcd34d",
  title: "#ffffff",
  body: "#ffffff",
  accent: "#f59e0b",
  button: "#ffffff",
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string | null | undefined): boolean {
  return Boolean(value && HEX.test(value.trim()));
}

export function normalizeHex(value: string, fallback: string): string {
  const raw = value.trim();
  if (!HEX.test(raw)) return fallback;
  if (raw.length === 4) {
    // #rgb → #rrggbb
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return raw.toLowerCase();
}

export function parseHeroTheme(value: unknown): HeroTheme {
  const row =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const pick = (key: keyof HeroTheme) =>
    normalizeHex(
      typeof row[key] === "string" ? (row[key] as string) : "",
      DEFAULT_HERO_THEME[key],
    );
  return {
    scrimTop: pick("scrimTop"),
    scrimBottom: pick("scrimBottom"),
    eyebrow: pick("eyebrow"),
    title: pick("title"),
    body: pick("body"),
    accent: pick("accent"),
    button: pick("button"),
  };
}

/** Parse form fields `hero_theme_*` from Front Public editor. */
export function parseHeroThemeFromForm(formData: FormData): HeroTheme {
  return parseHeroTheme({
    scrimTop: formData.get("hero_theme_scrim_top"),
    scrimBottom: formData.get("hero_theme_scrim_bottom"),
    eyebrow: formData.get("hero_theme_eyebrow"),
    title: formData.get("hero_theme_title"),
    body: formData.get("hero_theme_body"),
    accent: formData.get("hero_theme_accent"),
    button: formData.get("hero_theme_button"),
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
  if (!rgb) return `rgba(11, 16, 32, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function heroScrimGradient(theme: HeroTheme): string {
  return `linear-gradient(to bottom, ${hexAlpha(theme.scrimTop, 0.72)} 0%, transparent 45%, ${hexAlpha(theme.scrimBottom, 0.9)} 100%)`;
}
