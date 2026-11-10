import { Drawer } from "vaul";
import { motion, useReducedMotion } from "motion/react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BedDouble,
  CalendarRange,
  ConciergeBell,
  Menu,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { SIDEBAR_GROUPS, springButter, springPress } from "@hos-v2/ui";
import { ModuleIcon } from "./module-icons";

const TITLE: Record<string, string> = {
  desk: "Desk",
  reservations: "Reservations",
  stayview: "StayView",
  groups: "Groups",
  guests: "Guests",
  telegram: "Hermes",
  "night-audit": "Night Audit",
  housekeeping: "Housekeeping",
  laundry: "Laundry",
  floormap: "Floor Map",
  pos: "POS",
  kds: "KDS",
  rates: "Rates",
  agents: "Agents",
  partner: "Partner",
  guide: "Guide Companion",
  driver: "Driver Companion",
  channel: "Channel",
  loyalty: "Loyalty",
  registry: "Registry",
  finance: "Finance",
  purchases: "Purchases",
  stock: "Stock",
  "bank-recon": "Bank recon",
  utilities: "Utilities",
  amc: "AMC",
  compliance: "Compliance",
  hr: "HR",
  "staff-portal": "Staff Portal",
  reports: "Reports",
  owner: "Owner",
  settings: "Settings",
  superadmin: "Super-admin",
  cms: "CMS",
  marketing: "Marketing",
  "innora-ai": "Innora AI",
  services: "Services",
  events: "Events",
  website: "Website",
};

const DOCK = [
  { id: "desk", path: "/desk", label: "Desk", Icon: ConciergeBell },
  { id: "stayview", path: "/stayview", label: "StayView", Icon: CalendarRange },
  { id: "housekeeping", path: "/housekeeping", label: "Rooms", Icon: BedDouble },
  { id: "pos", path: "/pos", label: "POS", Icon: UtensilsCrossed },
] as const;

type MobileNavProps = {
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
};

export function MobileNav({ moreOpen, onMoreOpenChange }: MobileNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  return (
    <>
      <nav
        aria-label="Mobile primary"
        className="glass-dock-mobile ios-tab-bar flex md:hidden"
      >
        {DOCK.map(({ id, path, label, Icon }) => {
          const active = location.pathname === path;
          return (
            <NavLink
              key={id}
              to={path}
              className={[
                "hos-dock-tab relative z-10 flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium tracking-normal",
                active
                  ? "text-[var(--hos-ink)]"
                  : "text-[var(--hos-ink-3)]",
              ].join(" ")}
            >
              {active && !reduce ? (
                <motion.span
                  layoutId="mobileDockPill"
                  className="hos-dock-pill"
                  transition={springButter}
                />
              ) : null}
              <motion.span
                className="relative z-10 flex flex-col items-center gap-0.5"
                whileTap={reduce ? undefined : { scale: 0.88, transition: springPress }}
              >
                <Icon
                  className="size-[22px]"
                  strokeWidth={active ? 2.25 : 1.75}
                  fill={active ? "currentColor" : "none"}
                  fillOpacity={active ? 0.14 : 0}
                />
                {label}
              </motion.span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={() => onMoreOpenChange(true)}
          className={[
            "hos-dock-tab relative z-10 flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium tracking-normal",
            moreOpen ? "text-[var(--hos-ink)]" : "text-[var(--hos-ink-3)]",
          ].join(" ")}
        >
          {moreOpen && !reduce ? (
            <motion.span
              layoutId="mobileDockPill"
              className="hos-dock-pill"
              transition={springButter}
            />
          ) : null}
          <motion.span
            className="relative z-10 flex flex-col items-center gap-0.5"
            whileTap={reduce ? undefined : { scale: 0.88, transition: springPress }}
          >
            <Menu className="size-[22px]" strokeWidth={1.75} />
            More
          </motion.span>
        </button>
      </nav>

      <Drawer.Root open={moreOpen} onOpenChange={onMoreOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40 md:hidden" />
          <Drawer.Content className="hos-surface-glass fixed inset-x-0 bottom-0 z-[70] flex h-[92dvh] flex-col rounded-t-[22px] border border-[var(--hos-glass-border)] shadow-[var(--hos-elevated-shadow)] outline-none md:hidden">
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[rgba(17,17,17,0.18)]" />
            <div className="flex items-center justify-between px-4 py-3.5">
              <Drawer.Title className="m-0 text-[20px] font-bold tracking-tight text-[var(--hos-ink)]">
                Modules
              </Drawer.Title>
              <button
                type="button"
                aria-label="Close"
                onClick={() => onMoreOpenChange(false)}
                className="min-h-11 min-w-11 rounded-lg p-2 text-[var(--hos-ink-3)] hover:bg-[var(--hos-line)]"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pb-[max(2rem,env(safe-area-inset-bottom))]">
              <p className="ios-section-label">Session</p>
              <div className="ios-inset-group mb-4">
                <button
                  type="button"
                  onClick={() => {
                    navigate("/");
                    onMoreOpenChange(false);
                  }}
                  className="ios-inset-row w-full text-left text-[17px] font-normal"
                >
                  <ModuleIcon id="pin" />
                  <span className="flex-1">PIN Gateway</span>
                  <span className="text-[var(--hos-ink-3)]">›</span>
                </button>
              </div>
              {SIDEBAR_GROUPS.map((g) => (
                <div key={g.id} className="mb-4">
                  <h3 className="hos-rail-section mx-4 mb-2" data-tone={g.tone}>
                    {g.label}
                  </h3>
                  <div className="ios-inset-group">
                    {g.items.map((id) => {
                      const path =
                        id === "guide"
                          ? "/ecosystem/guide"
                          : id === "driver"
                            ? "/ecosystem/driver"
                            : `/${id}`;
                      const active =
                        location.pathname === path ||
                        location.pathname === `/${id}`;
                      return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          navigate(path);
                          onMoreOpenChange(false);
                        }}
                        className={[
                          "ios-inset-row w-full text-left text-[17px]",
                          active
                            ? "font-semibold text-[var(--hos-ink)]"
                            : "font-normal text-[var(--hos-ink)]",
                        ].join(" ")}
                      >
                        <ModuleIcon id={id} />
                        <span className="flex-1 truncate">{TITLE[id] ?? id}</span>
                        <span className="text-[var(--hos-ink-3)]">›</span>
                      </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
