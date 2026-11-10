export const DESK_THEMES = ["dzong", "brass", "dusk", "cedar"] as const;

export type DeskTheme = (typeof DESK_THEMES)[number];

export function parseDeskTheme(value: unknown): DeskTheme {
  return value === "brass" || value === "dusk" || value === "cedar"
    ? value
    : "dzong";
}

export const DESK_THEME_CHOICES: {
  id: DeskTheme;
  name: string;
  note: string;
  canvas: string;
  metal: string;
  signal: string;
}[] = [
  {
    id: "dzong",
    name: "Dzong",
    note: "Daylight, dzong red, brass",
    canvas: "#F6F4F1",
    metal: "#8E2F2B",
    signal: "#C5A059",
  },
  {
    id: "brass",
    name: "Brass desk",
    note: "Ivory paper, quiet brass",
    canvas: "#F7F3EC",
    metal: "#8C6D3B",
    signal: "#B8892C",
  },
  {
    id: "dusk",
    name: "Himalayan Dusk",
    note: "Night desk",
    canvas: "#141820",
    metal: "#C5A059",
    signal: "#7BA3C9",
  },
  {
    id: "cedar",
    name: "Cedar",
    note: "Lodge green and saffron",
    canvas: "#F3F1EA",
    metal: "#1F4D3A",
    signal: "#C47B2B",
  },
];
