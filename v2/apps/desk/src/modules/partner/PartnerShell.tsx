/**
 * Enterprise partner chrome — left sidebar (desk-like) + Innora hotel picker.
 */
import { useState } from "react";
import {
  BedDouble,
  BookOpen,
  Building2,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  Percent,
  Truck,
  Wallet,
} from "lucide-react";
import { Badge, Button, cn } from "@hos-v2/ui";
import type { InnoraHotelOption } from "../../lib/partner-hotels";

export type PartnerNavId =
  | "dashboard"
  | "book"
  | "calendar"
  | "inventory"
  | "bookings"
  | "rooming"
  | "changes"
  | "rates"
  | "money"
  | "fleet"
  | "menus";

type NavItem = {
  id: PartnerNavId;
  label: string;
  icon: typeof LayoutGrid;
  count?: number;
};

type NavSection = { id: string; label: string; items: NavItem[] };

type Props = {
  agencyName: string;
  agencyCode: string;
  hotels: InnoraHotelOption[];
  hotelId: string;
  onHotelChange: (propertyId: string) => void;
  activeNav: PartnerNavId;
  onNavChange: (id: PartnerNavId) => void;
  counts?: Partial<Record<PartnerNavId, number>>;
  onSignOut: () => void;
  children: React.ReactNode;
};

export function PartnerShell({
  agencyName,
  agencyCode,
  hotels,
  hotelId,
  onHotelChange,
  activeNav,
  onNavChange,
  counts = {},
  onSignOut,
  children,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const sections: NavSection[] = [
    {
      id: "operate",
      label: "Operate",
      items: [
        { id: "dashboard", label: "Home", icon: LayoutGrid, count: counts.dashboard },
        { id: "book", label: "Book", icon: BookOpen },
        { id: "calendar", label: "Calendar", icon: CalendarRange },
        { id: "inventory", label: "Inventory", icon: BedDouble },
      ],
    },
    {
      id: "stays",
      label: "Stays",
      items: [
        { id: "bookings", label: "My bookings", icon: ClipboardList, count: counts.bookings },
        { id: "rooming", label: "Rooming", icon: BedDouble, count: counts.rooming },
        { id: "changes", label: "Changes", icon: ClipboardList, count: counts.changes },
      ],
    },
    {
      id: "commercial",
      label: "Commercial",
      items: [
        { id: "rates", label: "Rates", icon: Percent },
        { id: "money", label: "Money", icon: Wallet, count: counts.money },
      ],
    },
    {
      id: "field",
      label: "Field",
      items: [
        { id: "fleet", label: "Guides & cars", icon: Truck },
        { id: "menus", label: "Menus", icon: BookOpen },
      ],
    },
  ];

  const dockItems = sections.flatMap((s) => s.items).slice(0, 5);

  return (
    <div
      className="flex min-h-dvh bg-[var(--hos-canvas)]"
      data-testid="partner-shell"
    >
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hos-surface-glass sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-[var(--hos-line)] md:flex",
          collapsed ? "w-[64px]" : "w-[220px]",
        )}
      >
        <div className="flex items-center gap-2 border-b border-[var(--hos-line)] px-3 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--hos-primary)] text-white">
            <Building2 className="size-4" />
          </span>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-extrabold text-[var(--hos-ink)]">
                {agencyName}
              </div>
              <div className="truncate text-[10px] font-bold uppercase tracking-wider text-[var(--hos-ink-3)]">
                {agencyCode} · Partner
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--hos-ink-3)] hover:bg-[color-mix(in_srgb,var(--hos-primary)_10%,transparent)]"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {sections.map((sec) => (
            <div key={sec.id} className="mb-3">
              {!collapsed ? (
                <div className="mb-1 px-2 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--hos-ink-3)]">
                  {sec.label}
                </div>
              ) : null}
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeNav === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        title={item.label}
                        onClick={() => onNavChange(item.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] font-semibold transition",
                          active
                            ? "bg-[color-mix(in_srgb,var(--hos-primary)_14%,transparent)] text-[var(--hos-primary)]"
                            : "text-[var(--hos-ink-2)] hover:bg-[color-mix(in_srgb,var(--hos-primary)_7%,transparent)]",
                        )}
                      >
                        <Icon className="size-4 shrink-0" strokeWidth={2} />
                        {!collapsed ? (
                          <>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.count != null && item.count > 0 ? (
                              <span className="rounded-full bg-[color-mix(in_srgb,var(--hos-primary)_16%,transparent)] px-1.5 py-0.5 text-[9px] font-bold tabular-nums">
                                {item.count}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--hos-line)] p-2">
          <Button
            size="sm"
            variant="ghost"
            className="w-full !justify-start !rounded-xl"
            onClick={onSignOut}
          >
            {!collapsed ? "Sign out" : "⎋"}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hos-surface-glass sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-[var(--hos-line)] px-3 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="min-w-0 flex-1 md:hidden">
            <div className="truncate text-[13px] font-bold text-[var(--hos-ink)]">
              {agencyName}
            </div>
            <div className="truncate text-[10px] text-[var(--hos-ink-3)]">
              {agencyCode} · Partner
            </div>
          </div>
          <Badge tone="teal" className="hidden sm:inline-flex">
            partner
          </Badge>
          <label className="grid min-w-[min(100%,240px)] flex-1 gap-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)] sm:flex-none">
            Innora hotel
            {hotels.length === 0 ? (
              <span className="hos-input !min-h-10 !rounded-xl !text-[12px] !text-[var(--hos-ruby)]">
                No Innora hotels linked — contact hotel
              </span>
            ) : (
              <select
                className="hos-input !min-h-10 !rounded-xl !text-[13px] font-semibold normal-case tracking-normal text-[var(--hos-ink)]"
                value={hotelId}
                onChange={(e) => onHotelChange(e.target.value)}
                data-testid="partner-hotel-select"
              >
                {hotels.map((h) => (
                  <option key={h.propertyId} value={h.propertyId}>
                    {h.propertyName}
                    {h.mouStatus !== "active" ? ` (${h.mouStatus})` : ""}
                  </option>
                ))}
              </select>
            )}
          </label>
          <Button
            size="sm"
            variant="ghost"
            className="!rounded-full md:hidden"
            onClick={onSignOut}
          >
            Sign out
          </Button>
        </header>

        <main className="min-h-0 flex-1 overflow-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-4">
          {children}
        </main>

        {/* Phone dock */}
        <nav
          className="hos-surface-glass fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--hos-line)] px-1 pb-[env(safe-area-inset-bottom)] pt-1 md:hidden"
          aria-label="Partner modules"
        >
          {dockItems.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavChange(item.id)}
                className={cn(
                  "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-bold",
                  active ? "text-[var(--hos-primary)]" : "text-[var(--hos-ink-3)]",
                )}
              >
                <Icon className="size-4" strokeWidth={2} />
                {item.label.split(" ")[0]}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
