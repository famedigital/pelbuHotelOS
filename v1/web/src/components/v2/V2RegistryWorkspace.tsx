"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Info, Loader2, Plus, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import {
  deskFetchJson,
  newIdempotencyKey,
  DeskApiError,
} from "@/lib/v2/desk-api-client";
import { readV2DeskToken } from "@/lib/v2/desk-api";

type AgentRow = {
  id: string;
  company_name: string | null;
  status: string | null;
  credit_limit: number | null;
  credit_used: number | null;
  contact_name: string | null;
  agent_property_links?: {
    property_id: string;
    rate_tier: string | null;
  }[];
};

type GuideRow = {
  id: string;
  full_name: string | null;
  guide_number: string;
  phone: string | null;
  discount_pct: number | null;
  visit_count: number | null;
  last_seen_at: string | null;
};

type FleetRow = {
  id: string;
  plate_number: string;
  vehicle_type: string;
  driver_name: string | null;
  driver_mobile: string | null;
  dorm_room_label: string | null;
};

type StaffRow = {
  id: string;
  full_name: string | null;
  employee_code: string;
  status: string | null;
  desk_role: string | null;
  department: string | null;
  can_login: boolean | null;
  pin_set_at: string | null;
};

const ROLE_LABELS = [
  "front_desk",
  "reservation",
  "fnb",
  "kitchen",
  "housekeeping",
  "spa",
  "security",
  "maintenance",
  "manager",
  "other",
] as const;

const DESK_ROLES = [
  "",
  "front_desk",
  "cashier",
  "gm",
  "hk",
  "owner",
  "fnb",
  "kitchen",
  "laundry",
  "accountant",
] as const;

export const V2RegistryWorkspace: React.FC = () => {
  const signedIn = Boolean(readV2DeskToken());
  const [tab, setTab] = useState<"agents" | "guides" | "fleet" | "staff">(
    "agents",
  );
  const [pending, start] = useTransition();

  const [agents, setAgents] = useState<AgentRow[] | null>(null);
  const [guides, setGuides] = useState<GuideRow[] | null>(null);
  const [fleet, setFleet] = useState<FleetRow[] | null>(null);
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [agentForm, setAgentForm] = useState({
    companyName: "",
    market: "bhutan" as "bhutan" | "jaigaon" | "india",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    notes: "",
    linkStatus: "approved" as "invited" | "approved" | "suspended",
    rateTier: "agents" as
      | "public"
      | "friends"
      | "family"
      | "mutual_friends"
      | "agents"
      | "mou_agents",
    creditLimit: "",
    creditUsed: "",
    openRoomCap: "",
  });

  const [guideForm, setGuideForm] = useState({
    guideNumber: "",
    fullName: "",
    phone: "",
    notes: "",
    discountPct: "",
  });

  const [fleetForm, setFleetForm] = useState({
    plateNumber: "",
    vehicleType: "hiace",
    driverName: "",
    driverMobile: "",
    dormRoomLabel: "",
  });

  const [staffForm, setStaffForm] = useState({
    employeeCode: "",
    fullName: "",
    roleLabel: "front_desk" as (typeof ROLE_LABELS)[number],
    department: "",
    deskRole: "" as string,
    status: "active" as string,
    phone: "",
    email: "",
  });

  const loadAll = useCallback(() => {
    if (!signedIn) return;
    start(async () => {
      setListError(null);
      try {
        const [a, g, f, s] = await Promise.all([
          deskFetchJson<{ agents: AgentRow[] }>("/v1/registry/agents"),
          deskFetchJson<{ guides: GuideRow[] }>("/v1/registry/guides"),
          deskFetchJson<{ vehicles: FleetRow[] }>("/v1/registry/fleet"),
          deskFetchJson<{ staff: StaffRow[] }>("/v1/registry/staff"),
        ]);
        setAgents(a.agents ?? []);
        setGuides(g.guides ?? []);
        setFleet(f.vehicles ?? []);
        setStaff(s.staff ?? []);
      } catch (err) {
        console.error("[v2/registry] load", err);
        setListError(err instanceof Error ? err.message : String(err));
        toast.error("Registry load failed");
      }
    });
  }, [signedIn]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const submitAgent = () => {
    start(async () => {
      try {
        await deskFetchJson("/v1/registry/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: agentForm.companyName.trim(),
            market: agentForm.market,
            contactName: agentForm.contactName.trim() || undefined,
            contactPhone: agentForm.contactPhone.trim() || undefined,
            contactEmail: agentForm.contactEmail.trim() || undefined,
            notes: agentForm.notes.trim() || undefined,
            linkStatus: agentForm.linkStatus,
            rateTier: agentForm.rateTier,
            creditLimit: agentForm.creditLimit
              ? Number(agentForm.creditLimit)
              : 0,
            creditUsed: agentForm.creditUsed
              ? Number(agentForm.creditUsed)
              : 0,
            openRoomCap: agentForm.openRoomCap
              ? Number(agentForm.openRoomCap)
              : null,
            idempotencyKey: newIdempotencyKey(),
          }),
        });
        toast.success("Agent registered");
        setAgentForm((p) => ({
          ...p,
          companyName: "",
          contactName: "",
          contactPhone: "",
          contactEmail: "",
          notes: "",
        }));
        loadAll();
      } catch (err) {
        console.error("[v2/registry] agent create", err);
        toast.error(
          err instanceof DeskApiError ? err.message : String(err),
        );
      }
    });
  };

  const submitGuide = () => {
    start(async () => {
      try {
        await deskFetchJson("/v1/registry/guides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guideNumber: guideForm.guideNumber.trim(),
            fullName: guideForm.fullName.trim() || undefined,
            phone: guideForm.phone.trim() || undefined,
            notes: guideForm.notes.trim() || undefined,
            discountPct: guideForm.discountPct
              ? Number(guideForm.discountPct)
              : undefined,
            idempotencyKey: newIdempotencyKey(),
          }),
        });
        toast.success("Guide saved");
        setGuideForm({
          guideNumber: "",
          fullName: "",
          phone: "",
          notes: "",
          discountPct: "",
        });
        loadAll();
      } catch (err) {
        console.error("[v2/registry] guide", err);
        toast.error(
          err instanceof DeskApiError ? err.message : String(err),
        );
      }
    });
  };

  const submitFleet = () => {
    start(async () => {
      try {
        await deskFetchJson("/v1/registry/fleet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plateNumber: fleetForm.plateNumber.trim(),
            vehicleType: fleetForm.vehicleType.trim() || "hiace",
            driverName: fleetForm.driverName.trim() || undefined,
            driverMobile: fleetForm.driverMobile.trim() || undefined,
            dormRoomLabel: fleetForm.dormRoomLabel.trim() || undefined,
          }),
        });
        toast.success("Fleet vehicle upserted");
        setFleetForm((p) => ({
          ...p,
          plateNumber: "",
          driverName: "",
          driverMobile: "",
          dormRoomLabel: "",
        }));
        loadAll();
      } catch (err) {
        console.error("[v2/registry] fleet", err);
        toast.error(
          err instanceof DeskApiError ? err.message : String(err),
        );
      }
    });
  };

  const submitStaff = () => {
    start(async () => {
      try {
        await deskFetchJson("/v1/registry/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeCode: staffForm.employeeCode.trim(),
            fullName: staffForm.fullName.trim(),
            roleLabel: staffForm.roleLabel,
            department: staffForm.department.trim() || undefined,
            deskRole: staffForm.deskRole.trim() || undefined,
            status: staffForm.status,
            phone: staffForm.phone.trim() || undefined,
            email: staffForm.email.trim() || undefined,
            idempotencyKey: newIdempotencyKey(),
          }),
        });
        toast.success("Staff row inserted");
        setStaffForm({
          employeeCode: "",
          fullName: "",
          roleLabel: "front_desk",
          department: "",
          deskRole: "",
          status: "active",
          phone: "",
          email: "",
        });
        loadAll();
      } catch (err) {
        console.error("[v2/registry] staff", err);
        toast.error(
          err instanceof DeskApiError ? err.message : String(err),
        );
      }
    });
  };

  const agentColumns = useMemo(
    () => [
      "company_name",
      "status",
      "credit_limit",
      "credit_used",
      "contact_name",
      "rate_tier",
    ],
    [],
  );

  const guideColumns = useMemo(
    () => [
      "guide_number",
      "full_name",
      "phone",
      "discount_pct",
      "visit_count",
      "last_seen_at",
    ],
    [],
  );

  const fleetCols = useMemo(
    () => [
      "plate_number",
      "vehicle_type",
      "driver_name",
      "driver_mobile",
      "dorm_room_label",
    ],
    [],
  );

  const staffCols = useMemo(
    () => [
      "employee_code",
      "full_name",
      "status",
      "desk_role",
      "department",
      "can_login",
      "pin_set_at",
    ],
    [],
  );

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#030712] text-slate-100 overflow-hidden">
      <header className="border-b border-white/[0.08] px-4 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0 glass-card [transform:translateZ(0)]">
        <div>
          <h1 className="text-lg font-bold text-white">Master registry</h1>
          <p className="text-[11px] text-slate-400">
            Writes use POST/PATCH <code className="text-indigo-300">/v1/registry/*</code>{" "}
            (Postgres RPCs + idempotency)
          </p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {(
            [
              ["agents", "Agents"],
              ["guides", "Guides"],
              ["fleet", "Fleet"],
              ["staff", "Staff"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                tab === k
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-slate-900/70 border-white/10 text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
          <TactileButton
            variant="secondary"
            size="sm"
            onClick={() => loadAll()}
            disabled={!signedIn || pending}
            icon={
              pending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )
            }
          >
            Reload
          </TactileButton>
        </div>
      </header>

      {!signedIn ? (
        <NeoGlassCard className="m-4 p-4 text-sm text-amber-200 border-amber-500/30">
          Sign in on /v2 with PIN first.
        </NeoGlassCard>
      ) : null}

      {listError ? (
        <p className="px-4 text-xs text-rose-400">{listError}</p>
      ) : null}

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <div className="lg:w-[400px] shrink-0 p-4 border-b lg:border-b-0 lg:border-r border-white/[0.08] overflow-y-auto space-y-4">
          <NeoGlassCard className="p-3 flex gap-2 text-[11px] text-slate-400 border-white/10 glass-card [transform:translateZ(0)]">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              Columns mirror migrations only. Agent credit lives on{" "}
              <code className="text-indigo-300">agent_property_links</code>; update existing agents in Innora until PATCH ships in your API build.
            </span>
          </NeoGlassCard>

          {tab === "agents" ? (
            <NeoGlassCard className="p-4 space-y-3 border-white/10 glass-card">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4" /> New agent + link
              </h3>
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Company name *"
                value={agentForm.companyName}
                onChange={(e) =>
                  setAgentForm((p) => ({ ...p, companyName: e.target.value }))
                }
              />
              <select
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                value={agentForm.market}
                onChange={(e) =>
                  setAgentForm((p) => ({
                    ...p,
                    market: e.target.value as typeof p.market,
                  }))
                }
              >
                <option value="bhutan">Bhutan</option>
                <option value="jaigaon">Jaigaon</option>
                <option value="india">India</option>
              </select>
              <select
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                value={agentForm.rateTier}
                onChange={(e) =>
                  setAgentForm((p) => ({
                    ...p,
                    rateTier: e.target.value as typeof p.rateTier,
                  }))
                }
              >
                <option value="agents">agents</option>
                <option value="mou_agents">mou_agents</option>
                <option value="public">public</option>
                <option value="friends">friends</option>
                <option value="family">family</option>
                <option value="mutual_friends">mutual_friends</option>
              </select>
              <select
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                value={agentForm.linkStatus}
                onChange={(e) =>
                  setAgentForm((p) => ({
                    ...p,
                    linkStatus: e.target.value as typeof p.linkStatus,
                  }))
                }
              >
                <option value="approved">approved</option>
                <option value="invited">invited</option>
                <option value="suspended">suspended</option>
              </select>
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Contact name"
                value={agentForm.contactName}
                onChange={(e) =>
                  setAgentForm((p) => ({ ...p, contactName: e.target.value }))
                }
              />
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Phone"
                value={agentForm.contactPhone}
                onChange={(e) =>
                  setAgentForm((p) => ({ ...p, contactPhone: e.target.value }))
                }
              />
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Email"
                value={agentForm.contactEmail}
                onChange={(e) =>
                  setAgentForm((p) => ({ ...p, contactEmail: e.target.value }))
                }
              />
              <textarea
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm min-h-[72px]"
                placeholder="Notes"
                value={agentForm.notes}
                onChange={(e) =>
                  setAgentForm((p) => ({ ...p, notes: e.target.value }))
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                  placeholder="Credit limit BTN"
                  value={agentForm.creditLimit}
                  onChange={(e) =>
                    setAgentForm((p) => ({ ...p, creditLimit: e.target.value }))
                  }
                />
                <input
                  className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                  placeholder="Credit used BTN"
                  value={agentForm.creditUsed}
                  onChange={(e) =>
                    setAgentForm((p) => ({ ...p, creditUsed: e.target.value }))
                  }
                />
              </div>
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Open room cap (optional)"
                value={agentForm.openRoomCap}
                onChange={(e) =>
                  setAgentForm((p) => ({ ...p, openRoomCap: e.target.value }))
                }
              />
              <TactileButton
                variant="primary"
                size="md"
                disabled={pending || !agentForm.companyName.trim()}
                onClick={() => submitAgent()}
                icon={<Save className="w-4 h-4" />}
              >
                Save agent
              </TactileButton>
            </NeoGlassCard>
          ) : null}

          {tab === "guides" ? (
            <NeoGlassCard className="p-4 space-y-3 border-white/10 glass-card">
              <h3 className="text-sm font-bold text-white">Upsert guide</h3>
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Guide number * (unique per property)"
                value={guideForm.guideNumber}
                onChange={(e) =>
                  setGuideForm((p) => ({ ...p, guideNumber: e.target.value }))
                }
              />
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Full name"
                value={guideForm.fullName}
                onChange={(e) =>
                  setGuideForm((p) => ({ ...p, fullName: e.target.value }))
                }
              />
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Phone"
                value={guideForm.phone}
                onChange={(e) =>
                  setGuideForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Discount % (0–100)"
                value={guideForm.discountPct}
                onChange={(e) =>
                  setGuideForm((p) => ({ ...p, discountPct: e.target.value }))
                }
              />
              <textarea
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm min-h-[64px]"
                placeholder="Notes"
                value={guideForm.notes}
                onChange={(e) =>
                  setGuideForm((p) => ({ ...p, notes: e.target.value }))
                }
              />
              <TactileButton
                variant="primary"
                size="md"
                disabled={pending || !guideForm.guideNumber.trim()}
                onClick={() => submitGuide()}
                icon={<Save className="w-4 h-4" />}
              >
                Save guide
              </TactileButton>
            </NeoGlassCard>
          ) : null}

          {tab === "fleet" ? (
            <NeoGlassCard className="p-4 space-y-3 border-white/10 glass-card">
              <h3 className="text-sm font-bold text-white">
                Upsert vehicle (plate unique)
              </h3>
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Plate number *"
                value={fleetForm.plateNumber}
                onChange={(e) =>
                  setFleetForm((p) => ({ ...p, plateNumber: e.target.value }))
                }
              />
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Vehicle type (default hiace)"
                value={fleetForm.vehicleType}
                onChange={(e) =>
                  setFleetForm((p) => ({ ...p, vehicleType: e.target.value }))
                }
              />
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Driver name"
                value={fleetForm.driverName}
                onChange={(e) =>
                  setFleetForm((p) => ({ ...p, driverName: e.target.value }))
                }
              />
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Driver mobile"
                value={fleetForm.driverMobile}
                onChange={(e) =>
                  setFleetForm((p) => ({ ...p, driverMobile: e.target.value }))
                }
              />
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Dorm room label"
                value={fleetForm.dormRoomLabel}
                onChange={(e) =>
                  setFleetForm((p) => ({ ...p, dormRoomLabel: e.target.value }))
                }
              />
              <TactileButton
                variant="primary"
                size="md"
                disabled={pending || fleetForm.plateNumber.trim().length < 3}
                onClick={() => submitFleet()}
                icon={<Save className="w-4 h-4" />}
              >
                Save vehicle
              </TactileButton>
            </NeoGlassCard>
          ) : null}

          {tab === "staff" ? (
            <NeoGlassCard className="p-4 space-y-3 border-white/10 glass-card">
              <h3 className="text-sm font-bold text-white">Add staff row</h3>
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Employee code *"
                value={staffForm.employeeCode}
                onChange={(e) =>
                  setStaffForm((p) => ({ ...p, employeeCode: e.target.value }))
                }
              />
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Full name *"
                value={staffForm.fullName}
                onChange={(e) =>
                  setStaffForm((p) => ({ ...p, fullName: e.target.value }))
                }
              />
              <select
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                value={staffForm.roleLabel}
                onChange={(e) =>
                  setStaffForm((p) => ({
                    ...p,
                    roleLabel: e.target.value as (typeof ROLE_LABELS)[number],
                  }))
                }
              >
                {ROLE_LABELS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                value={staffForm.deskRole}
                onChange={(e) =>
                  setStaffForm((p) => ({ ...p, deskRole: e.target.value }))
                }
              >
                {DESK_ROLES.map((r) => (
                  <option key={r || "null"} value={r}>
                    {r || "(desk_role null)"}
                  </option>
                ))}
              </select>
              <select
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                value={staffForm.status}
                onChange={(e) =>
                  setStaffForm((p) => ({ ...p, status: e.target.value }))
                }
              >
                <option value="provisional">provisional</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="on_leave">on_leave</option>
                <option value="suspended">suspended</option>
                <option value="terminated">terminated</option>
              </select>
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Department"
                value={staffForm.department}
                onChange={(e) =>
                  setStaffForm((p) => ({ ...p, department: e.target.value }))
                }
              />
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Phone"
                value={staffForm.phone}
                onChange={(e) =>
                  setStaffForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
              <input
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                placeholder="Email"
                value={staffForm.email}
                onChange={(e) =>
                  setStaffForm((p) => ({ ...p, email: e.target.value }))
                }
              />
              <TactileButton
                variant="primary"
                size="md"
                disabled={
                  pending ||
                  !staffForm.employeeCode.trim() ||
                  !staffForm.fullName.trim()
                }
                onClick={() => submitStaff()}
                icon={<Save className="w-4 h-4" />}
              >
                Insert staff
              </TactileButton>
            </NeoGlassCard>
          ) : null}
        </div>

        <div className="flex-1 p-4 overflow-auto min-h-0 bg-slate-950/90">
          <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-slate-900/40">
            {tab === "agents" ? (
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-900 text-slate-400 uppercase">
                  <tr>
                    {agentColumns.map((c) => (
                      <th key={c} className="p-2 border-b border-white/10">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(agents ?? []).map((row) => {
                    const link = Array.isArray(row.agent_property_links)
                      ? row.agent_property_links[0]
                      : undefined;
                    return (
                      <tr key={row.id} className="border-b border-white/5">
                        <td className="p-2 text-white font-medium">
                          {row.company_name}
                        </td>
                        <td className="p-2">{row.status}</td>
                        <td className="p-2 font-mono">{row.credit_limit}</td>
                        <td className="p-2 font-mono">{row.credit_used}</td>
                        <td className="p-2">{row.contact_name}</td>
                        <td className="p-2">{link?.rate_tier}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null}

            {tab === "guides" ? (
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-900 text-slate-400 uppercase">
                  <tr>
                    {guideColumns.map((c) => (
                      <th key={c} className="p-2 border-b border-white/10">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(guides ?? []).map((row) => (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="p-2 font-mono text-indigo-300">
                        {row.guide_number}
                      </td>
                      <td className="p-2 text-white">{row.full_name}</td>
                      <td className="p-2">{row.phone}</td>
                      <td className="p-2 font-mono">{row.discount_pct}</td>
                      <td className="p-2 font-mono">{row.visit_count}</td>
                      <td className="p-2">{row.last_seen_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {tab === "fleet" ? (
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-900 text-slate-400 uppercase">
                  <tr>
                    {fleetCols.map((c) => (
                      <th key={c} className="p-2 border-b border-white/10">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(fleet ?? []).map((row) => (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="p-2 font-mono text-white">
                        {row.plate_number}
                      </td>
                      <td className="p-2">{row.vehicle_type}</td>
                      <td className="p-2">{row.driver_name}</td>
                      <td className="p-2">{row.driver_mobile}</td>
                      <td className="p-2">{row.dorm_room_label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {tab === "staff" ? (
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-900 text-slate-400 uppercase">
                  <tr>
                    {staffCols.map((c) => (
                      <th key={c} className="p-2 border-b border-white/10">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(staff ?? []).map((row) => (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="p-2 font-mono text-indigo-300">
                        {row.employee_code}
                      </td>
                      <td className="p-2 text-white">{row.full_name}</td>
                      <td className="p-2">{row.status ?? "—"}</td>
                      <td className="p-2">{row.desk_role}</td>
                      <td className="p-2">{row.department}</td>
                      <td className="p-2">{row.can_login ? "yes" : "no"}</td>
                      <td className="p-2">{row.pin_set_at ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
