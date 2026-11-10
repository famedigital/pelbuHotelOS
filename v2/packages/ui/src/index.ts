/** Jewel tone for premium rail section titles (Ultra View). */
export type SidebarTone =
  | "sapphire"
  | "emerald"
  | "brass"
  | "ruby"
  | "teal"
  | "ink";

export const SIDEBAR_GROUPS = [
  {
    id: "front_office",
    label: "Front Office",
    tone: "sapphire" as const,
    items: [
      "desk",
      "reservations",
      "stayview",
      "groups",
      "guests",
      "telegram",
      "night-audit",
    ],
  },
  {
    id: "rooms",
    label: "Rooms",
    tone: "emerald" as const,
    items: ["housekeeping", "laundry", "floormap"],
  },
  {
    id: "fb",
    label: "F&B",
    tone: "brass" as const,
    items: ["pos", "kds"],
  },
  {
    id: "ecosystem",
    label: "Field companions",
    tone: "emerald" as const,
    items: ["guide", "driver"],
  },
  {
    id: "sales",
    label: "Sales",
    tone: "teal" as const,
    items: ["rates", "agents", "partner", "channel", "loyalty", "registry"],
  },
  {
    id: "finance",
    label: "Finance",
    tone: "ruby" as const,
    items: ["finance", "purchases", "stock", "bank-recon", "compliance"],
  },
  {
    id: "ops",
    label: "Ops plant",
    tone: "ink" as const,
    items: ["utilities", "amc"],
  },
  {
    id: "people",
    label: "People",
    tone: "sapphire" as const,
    items: ["hr", "staff-portal"],
  },
  {
    id: "insights",
    label: "Insights",
    tone: "brass" as const,
    items: ["reports", "owner"],
  },
  {
    id: "platform",
    label: "Platform",
    tone: "ink" as const,
    items: ["settings", "superadmin", "cms", "marketing", "innora-ai"],
  },
  {
    id: "experiences",
    label: "Experiences",
    tone: "teal" as const,
    items: ["services", "events", "website"],
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
