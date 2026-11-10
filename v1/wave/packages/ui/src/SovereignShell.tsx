import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  Building2,
  UtensilsCrossed,
  ShoppingCart,
  FileText,
  Users,
  Moon,
  Settings,
  Search,
  KeyRound,
} from "lucide-react";
import { OdometerTicker } from "./OdometerTicker";
import { clsx } from "clsx";

export interface SovereignNavItem {
  to: string;
  label: string;
  icon: "desk" | "pos" | "purchases" | "reports" | "agents" | "audit" | "admin";
}

const ICONS = {
  desk: Building2,
  pos: UtensilsCrossed,
  purchases: ShoppingCart,
  reports: FileText,
  agents: Users,
  audit: Moon,
  admin: Settings,
};

const DEFAULT_NAV: SovereignNavItem[] = [
  { to: "/desk", label: "Day board", icon: "desk" },
  { to: "/reservations", label: "Reservations", icon: "desk" },
  { to: "/stayview", label: "StayView", icon: "desk" },
  { to: "/pos", label: "POS", icon: "pos" },
  { to: "/agents", label: "Agents", icon: "agents" },
  { to: "/finance", label: "Finance", icon: "purchases" },
  { to: "/night-audit", label: "Night Audit", icon: "audit" },
  { to: "/reports", label: "Reports", icon: "reports" },
  { to: "/settings", label: "Settings", icon: "admin" },
];

export function SovereignShell({
  propertyName,
  staffName,
  tillBtn,
  onOpenCommand,
  onSwitchPin,
  nav = DEFAULT_NAV,
  drawer,
  children,
}: {
  propertyName: string;
  staffName: string;
  tillBtn: number;
  onOpenCommand?: () => void;
  onSwitchPin?: () => void;
  nav?: SovereignNavItem[];
  drawer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="hos-shell">
      <header className="hos-header hos-glass">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg,#f59e0b,#d97706)",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 11,
              color: "#fff",
            }}
          >
            OS
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
              Hotel OS
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{propertyName}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCommand}
          className="hos-glass"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 12px",
            borderRadius: 12,
            color: "#64748b",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <Search size={14} />
          Jump / Fast Book
          <kbd
            style={{
              marginLeft: 6,
              padding: "2px 6px",
              borderRadius: 6,
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
              fontSize: 10,
            }}
          >
            Ctrl+K
          </kbd>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 10,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Till
            </div>
            <div style={{ color: "#059669", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
              <OdometerTicker value={tillBtn} prefix="Nu " />
            </div>
          </div>
          <button
            type="button"
            onClick={onSwitchPin}
            className="hos-glass"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 12,
              fontSize: 12,
              cursor: "pointer",
              color: "#0f172a",
            }}
          >
            <KeyRound size={14} color="#d97706" />
            <span>
              <strong>{staffName || "Sign in"}</strong>
              <div style={{ fontSize: 10, color: "#64748b" }}>Switch PIN</div>
            </span>
          </button>
        </div>
      </header>

      <div className="hos-body">
        <nav className="hos-rail hos-glass" data-locked="false">
          {nav.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold",
                    isActive && "active",
                  )
                }
                style={{ textDecoration: "none" }}
              >
                <Icon size={16} />
                <span className="hos-rail-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <main className="hos-viewport">{children}</main>
        {drawer ? <aside className="hos-drawer hos-glass">{drawer}</aside> : null}
      </div>
    </div>
  );
}
