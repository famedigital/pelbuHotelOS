/** Jewel tone for premium rail section titles (Ultra View). */
export type SidebarTone =
  | "sapphire"
  | "emerald"
  | "brass"
  | "ruby"
  | "teal"
  | "ink";

/** Bhutan department homes — Simple rail filters further by role. */
export const SIDEBAR_GROUPS = [
  {
    id: "reservations",
    label: "Reservations",
    tone: "teal" as const,
    items: ["reservations", "groups", "rates", "agents", "partner", "channel"],
  },
  {
    id: "front_office",
    label: "Front Office",
    tone: "sapphire" as const,
    items: ["desk", "stayview", "guests", "telegram", "night-audit", "print"],
  },
  {
    id: "housekeeping",
    label: "Housekeeping",
    tone: "emerald" as const,
    items: ["housekeeping", "laundry", "floormap"],
  },
  {
    id: "fb",
    label: "F&B",
    tone: "brass" as const,
    items: ["pos", "kds", "purchases", "stock"],
  },
  {
    id: "owner_books",
    label: "Owner & books",
    tone: "ruby" as const,
    items: [
      "owner",
      "finance",
      "bank-recon",
      "reports",
      "compliance",
      "hr",
      "staff-portal",
    ],
  },
  {
    id: "more",
    label: "More",
    tone: "ink" as const,
    items: [
      "registry",
      "loyalty",
      "guide",
      "driver",
      "utilities",
      "amc",
      "services",
      "events",
      "website",
      "cms",
      "marketing",
      "innora-ai",
      "settings",
      "superadmin",
    ],
  },
] as const;

export type SidebarGroup = (typeof SIDEBAR_GROUPS)[number];

export { cn } from "./lib/cn.js";
export {
  springSoft,
  springSnappy,
  springLayout,
  springButter,
  springPress,
  easeVolary,
  easeVolaryFast,
  volaroEase,
  fadeSlide,
  fadeUp,
  scaleIn,
  routeEnter,
  staggerChildren,
  staggerFast,
  staggerButter,
  listItem,
  butterCard,
  prefersReducedMotion,
} from "./motion/presets.js";
export { ButterCard } from "./components/ButterCard.js";
export { useMagnetic } from "./hooks/useMagnetic.js";
export {
  StillWaterSurface,
  type StillWaterSurfaceProps,
} from "./components/StillWaterSurface.js";
export { GlassShell, GlassPanel, GlassElevated } from "./components/Glass.js";
export { Button, type ButtonProps } from "./components/Button.js";
export { Badge, type BadgeProps } from "./components/Badge.js";
export {
  CurrencyCell,
  type CurrencyCellProps,
} from "./components/CurrencyCell.js";
export {
  LedBeacon,
  type LedBeaconProps,
  type LedTone,
} from "./components/LedBeacon.js";
export {
  KeycapBadge,
  type KeycapBadgeProps,
} from "./components/KeycapBadge.js";
export {
  InnoraLogo,
  InnorahotelLogo,
  type InnoraLogoProps,
  type LogoSize,
} from "./components/InnoraLogo.js";
export { EmptyState } from "./components/EmptyState.js";
export { KpiCard } from "./components/KpiCard.js";
export { SpotlightCard } from "./components/SpotlightCard.js";
export { GlassTiltCard } from "./components/GlassTiltCard.js";
export { PageTransition } from "./components/PageTransition.js";
export { StaggerReveal, StaggerItem } from "./components/StaggerReveal.js";
export { Odometer } from "./components/Odometer.js";
export { MorphTabs, type MorphTabItem } from "./components/MorphTabs.js";
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  MorphTabsRoot,
} from "./components/Tabs.js";
export { ConfirmCard } from "./components/ConfirmCard.js";
export { DataTable } from "./components/DataTable.js";
export { CommandPalette, type CommandItem } from "./components/CommandPalette.js";
export {
  StaySheet,
  STAY_SHEET_MODAL_ROOT_ID,
} from "./components/StaySheet.js";
export { ModuleFrame } from "./components/ModuleFrame.js";
export {
  StatusLegend,
  AttentionChip,
  type StatusLegendItem,
  type AttentionChipProps,
} from "./components/StatusLegend.js";
export { InspectorCard } from "./components/InspectorCard.js";
export { ResponsiveDataList } from "./components/ResponsiveDataList.js";
export {
  Field,
  FieldInput,
  FieldSelect,
  FieldTextarea,
} from "./components/Field.js";
export { CellRow, CellButton, InsetList } from "./components/CellRow.js";
export { useMediaQuery, useIsPhone, useIsTablet } from "./hooks/useMediaQuery.js";
