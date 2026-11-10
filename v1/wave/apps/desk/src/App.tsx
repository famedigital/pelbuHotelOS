import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  DeskSyncClient,
  getExpectedCashTillBtn,
  useRamEngine,
} from "@hotel-os/engine";
import { CommandPalette, SovereignShell } from "@hotel-os/ui";
import { api, getToken, setToken } from "./api";
import { PinGatewayPage } from "./pages/PinGatewayPage";
import { DeskPage } from "./pages/DeskPage";
import { PosPage } from "./pages/PosPage";
import { PurchasesPage } from "./pages/PurchasesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AgentsPage } from "./pages/AgentsPage";
import { NightAuditPage } from "./pages/NightAuditPage";
import { RegistryPage } from "./pages/RegistryPage";
import { HousekeepingPage } from "./pages/HousekeepingPage";
import { KdsPage } from "./pages/KdsPage";
import { OwnerPage } from "./pages/OwnerPage";
import { SuperAdminPage } from "./pages/SuperAdminPage";
import { StayViewPage } from "./pages/StayViewPage";
import { ReservationsPage } from "./pages/ReservationsPage";
import { GuestsPage } from "./pages/GuestsPage";
import { GroupsPage } from "./pages/GroupsPage";
import { FinancePage } from "./pages/FinancePage";
import { HrPage } from "./pages/HrPage";
import { ChannelPage } from "./pages/ChannelPage";
import { RatesPage } from "./pages/RatesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LaundryPage } from "./pages/LaundryPage";
import { LoyaltyPage } from "./pages/LoyaltyPage";
import { CompliancePage } from "./pages/CompliancePage";
import { StaffPortalPage } from "./pages/StaffPortalPage";

function AuthedShell({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const engine = useRamEngine();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [copilotMsg, setCopilotMsg] = useState<string | null>(null);
  const till = useMemo(
    () => getExpectedCashTillBtn(engine.cashTill),
    [engine.cashTill],
  );

  useEffect(() => {
    if (!getToken() || !engine.propertyId) return;
    const client = new DeskSyncClient({
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "",
      getToken,
      onSnapshot: (snap) => {
        void engine.hydrateEngine(snap);
      },
      onAck: (opId) => {
        void engine.applyAckedOp(opId);
      },
    });
    client.connectWs(engine.propertyId);
    client.startFlushLoop(2500);
    return () => client.stop();
  }, [engine.propertyId]);

  useEffect(() => {
    const open = () => setCmdOpen(true);
    window.addEventListener("hos-command", open);
    return () => window.removeEventListener("hos-command", open);
  }, []);

  return (
    <SovereignShell
      propertyName={engine.propertyName || "Hotel OS"}
      staffName={engine.staffName || "Staff"}
      tillBtn={till}
      onSwitchPin={() => {
        setToken(null);
        nav("/");
      }}
      onOpenCommand={() => setCmdOpen(true)}
    >
      {children}
      {copilotMsg ? (
        <div
          className="hos-glass"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            maxWidth: 360,
            padding: 12,
            borderRadius: 12,
            zIndex: 50,
            fontSize: 12,
          }}
        >
          <strong>Copilot</strong>
          <p style={{ margin: "6px 0 0" }}>{copilotMsg}</p>
          <button
            type="button"
            onClick={() => setCopilotMsg(null)}
            style={{ marginTop: 8, color: "#94a3b8" }}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNavigate={(path) => nav(path)}
        onFastBook={() => nav("/reservations?fast=1")}
        onOpenStay={(code) =>
          nav(`/reservations?q=${encodeURIComponent(code)}`)
        }
        onCopilot={(prompt) => {
          void api<{ reply: string }>("/v1/ai/desk", {
            method: "POST",
            body: JSON.stringify({
              prompt,
              context: { route: window.location.pathname },
            }),
          })
            .then((r) => setCopilotMsg(r.reply))
            .catch((e) =>
              setCopilotMsg(e instanceof Error ? e.message : String(e)),
            );
        }}
      />
    </SovereignShell>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/" replace />;
  return <AuthedShell>{children}</AuthedShell>;
}

function authed(page: React.ReactNode) {
  return <RequireAuth>{page}</RequireAuth>;
}

export function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new Event("hos-command"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Routes>
      <Route path="/" element={<PinGatewayPage />} />
      <Route path="/desk" element={authed(<DeskPage />)} />
      <Route path="/reservations" element={authed(<ReservationsPage />)} />
      <Route path="/stayview" element={authed(<StayViewPage />)} />
      <Route path="/guests" element={authed(<GuestsPage />)} />
      <Route path="/groups" element={authed(<GroupsPage />)} />
      <Route path="/pos" element={authed(<PosPage />)} />
      <Route path="/kds" element={authed(<KdsPage />)} />
      <Route path="/purchases" element={authed(<PurchasesPage />)} />
      <Route path="/finance" element={authed(<FinancePage />)} />
      <Route path="/hr" element={authed(<HrPage />)} />
      <Route path="/reports" element={authed(<ReportsPage />)} />
      <Route path="/agents" element={authed(<AgentsPage />)} />
      <Route path="/channel" element={authed(<ChannelPage />)} />
      <Route path="/rates" element={authed(<RatesPage />)} />
      <Route path="/night-audit" element={authed(<NightAuditPage />)} />
      <Route path="/registry" element={authed(<RegistryPage />)} />
      <Route path="/housekeeping" element={authed(<HousekeepingPage />)} />
      <Route path="/laundry" element={authed(<LaundryPage />)} />
      <Route path="/loyalty" element={authed(<LoyaltyPage />)} />
      <Route path="/compliance" element={authed(<CompliancePage />)} />
      <Route path="/settings" element={authed(<SettingsPage />)} />
      <Route path="/staff-portal" element={authed(<StaffPortalPage />)} />
      <Route path="/owner" element={authed(<OwnerPage />)} />
      <Route path="/superadmin" element={authed(<SuperAdminPage />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
