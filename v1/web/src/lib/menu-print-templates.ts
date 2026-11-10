/**
 * Print menu templates for desktop F&B menus.
 * Design language follows marketing/print/*.html (Pelbu dark/gold, ivory editorial, A5 brochure).
 */

export const MENU_PRINT_TEMPLATES = [
  {
    id: "classic",
    name: "Classic columns",
    paper: "A4",
    blurb: "Clean two-column list — quick guest table insert, black on white.",
    source: "Built for desk print; prices live from catalog.",
  },
  {
    id: "magazine",
    name: "Magazine booklet",
    paper: "A4",
    blurb: "Dark cream + gold · Cormorant / Outfit — matches marketing magazine feel.",
    source: "Inspired by marketing/print/menu-booklet-a4.html",
  },
  {
    id: "editorial",
    name: "Editorial ivory",
    paper: "A4",
    blurb: "Ivory paper, serif titles — editorial booklet style.",
    source: "Inspired by marketing/print/menu-booklet-editorial-a4.html",
  },
  {
    id: "mosaic",
    name: "Category mosaic",
    paper: "A4",
    blurb: "One category block per sheet area · denser sections with hairlines.",
    source: "Inspired by marketing/print/menu-category-mosaic-a4.html",
  },
  {
    id: "brochure",
    name: "Café brochure",
    paper: "A5",
    blurb: "Compact A5 handout for café / walk-in counter.",
    source: "Inspired by marketing/print/brochure-fnb-a5.html",
  },
] as const;

export type MenuPrintTemplateId = (typeof MENU_PRINT_TEMPLATES)[number]["id"];

export function isMenuPrintTemplateId(raw: string): raw is MenuPrintTemplateId {
  return MENU_PRINT_TEMPLATES.some((t) => t.id === raw);
}

export function getMenuPrintTemplate(id: string) {
  return MENU_PRINT_TEMPLATES.find((t) => t.id === id) ?? MENU_PRINT_TEMPLATES[0];
}

export type PrintMenuItem = {
  id: string;
  outlet: string;
  category: string;
  name: string;
  name_dz?: string | null;
  description: string | null;
  price_btn: number;
  gst_applicable: boolean;
  is_popular?: boolean;
  image_src?: string | null;
};

export type PrintMenuSection = {
  category: string;
  items: PrintMenuItem[];
};

export function groupPrintMenu(
  items: PrintMenuItem[],
  outlet?: string | "all",
): PrintMenuSection[] {
  const filtered = items.filter((i) => {
    if (outlet && outlet !== "all" && i.outlet !== outlet) return false;
    return true;
  });
  const multiOutlet =
    !outlet || outlet === "all"
      ? new Set(filtered.map((i) => i.outlet)).size > 1
      : false;
  const map = new Map<string, PrintMenuItem[]>();
  for (const item of filtered) {
    const base = item.category?.trim() || "Other";
    const cat = multiOutlet
      ? `${item.outlet} · ${base}`
      : base;
    const list = map.get(cat) ?? [];
    list.push(item);
    map.set(cat, list);
  }
  return [...map.entries()]
    .map(([category, rows]) => ({
      category,
      items: rows.sort(
        (a, b) =>
          a.name.localeCompare(b.name) || a.price_btn - b.price_btn,
      ),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function formatPrintPrice(priceBtn: number): string {
  const n = Math.round(Number(priceBtn) || 0);
  return `Nu ${n.toLocaleString("en-BT")}`;
}
