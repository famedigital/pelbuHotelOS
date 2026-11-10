"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Building2,
  UtensilsCrossed,
  Sparkles,
  ChefHat,
  Crown,
  Delete,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  User,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import {
  getDeskApiBaseUrl,
  normalizePropertySlugFromProp,
  writeV2Session,
} from "@/lib/v2/desk-api";
import {
  mapApiHomeRouteToV2,
  mapDeskRoleToV2Home,
} from "@/lib/v2/v2-home-route";

type StaffRow = {
  id: string;
  fullName: string;
  employeeCode: string;
  deskRole: string | null;
  canAccessDesk: boolean;
};

export type TouchStaffPinMode = "api" | "demo";

export interface TouchStaffPinGatewayProps {
  onBackToHub?: () => void;
  /** Default `api`: real staff list + PIN via apps/api. `demo` preserved for legacy marketing flows only. */
  mode?: TouchStaffPinMode;
  propertySlug?: string;
}

function deskRoleIcon(role: string | null | undefined): LucideIcon {
  const r = String(role || "").toLowerCase();
  if (r === "fnb" || r === "cashier") return UtensilsCrossed;
  if (r === "kitchen") return ChefHat;
  if (r === "hk" || r === "laundry") return Sparkles;
  if (r === "gm" || r === "owner") return Crown;
  if (r === "accountant") return Briefcase;
  if (r === "front_desk") return Building2;
  return User;
}

function roleBadgeClass(role: string | null | undefined): string {
  const r = String(role || "").toLowerCase();
  if (r === "fnb" || r === "cashier")
    return "from-indigo-500 to-violet-600";
  if (r === "kitchen") return "from-rose-500 to-red-600";
  if (r === "hk" || r === "laundry")
    return "from-amber-500 to-orange-600";
  if (r === "gm" || r === "owner")
    return "from-amber-400 to-yellow-500";
  if (r === "accountant") return "from-teal-500 to-emerald-600";
  return "from-emerald-500 to-teal-600";
}

export const TouchStaffPinGateway: React.FC<TouchStaffPinGatewayProps> = ({
  onBackToHub,
  mode = "api",
  propertySlug: propertySlugProp,
}) => {
  const router = useRouter();
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(mode === "api");

  const [selectedStaff, setSelectedStaff] = useState<StaffRow | null>(null);
  const [pinDigits, setPinDigits] = useState<string>("");
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [authPending, setAuthPending] = useState(false);

  const slug = useMemo(
    () => normalizePropertySlugFromProp(propertySlugProp),
    [propertySlugProp],
  );

  const loadStaff = useCallback(async () => {
    if (mode !== "api") return;
    setListLoading(true);
    setListError(null);
    try {
      const base = getDeskApiBaseUrl();
      const url = `${base}/v1/auth/staff?propertySlug=${encodeURIComponent(slug)}`;
      const ac = new AbortController();
      const t = window.setTimeout(() => ac.abort(), 20000);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "GET",
          credentials: "omit",
          signal: ac.signal,
        });
      } finally {
        window.clearTimeout(t);
      }
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text.slice(0, 400) || `Staff list failed (${res.status})`);
      }
      const data = JSON.parse(text) as { staff?: StaffRow[] };
      const rows = (data.staff ?? []).filter((s) => s.canAccessDesk !== false);
      setStaffList(rows);
      if (rows.length === 0) {
        setListError(
          "No staff with desk access for this property. Enable “access desk” in Staff settings.",
        );
      }
    } catch (err) {
      console.error("[TouchStaffPinGateway] staff list", { err });
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? `Staff list timed out — is the desk API up at ${getDeskApiBaseUrl()}?`
          : err instanceof Error
            ? err.message
            : "Could not load staff list.";
      setListError(msg);
    } finally {
      setListLoading(false);
    }
  }, [mode, slug]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const verifyWithApi = async (staff: StaffRow, pin: string) => {
    setAuthPending(true);
    try {
      const base = getDeskApiBaseUrl();
      const res = await fetch(`${base}/v1/auth/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertySlug: slug,
          staffId: staff.id,
          pin,
        }),
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!res.ok) {
        const errMsg =
          typeof data.error === "string"
            ? data.error
            : text.slice(0, 200) || "PIN verification failed";
        throw new Error(errMsg);
      }
      const token = data.token as string | undefined;
      if (!token) {
        throw new Error("Invalid auth response: missing token");
      }
      const homeApi = String(data.homeRoute ?? "/desk");
      const target = mapApiHomeRouteToV2(homeApi);
      const staffPayload = data.staff as
        | {
            id?: string;
            fullName?: string;
            deskRole?: string | null;
            employeeCode?: string;
          }
        | undefined;

      writeV2Session(token, {
        id: staffPayload?.id ?? staff.id,
        fullName: staffPayload?.fullName ?? staff.fullName,
        deskRole: staffPayload?.deskRole ?? staff.deskRole ?? null,
        employeeCode: staffPayload?.employeeCode ?? staff.employeeCode,
      });

      setIsSuccess(true);
      toast.success("Signed in", { description: staff.fullName });
      setTimeout(() => router.push(target), 350);
    } catch (err) {
      console.error("[TouchStaffPinGateway] pin", { err });
      const msg =
        err instanceof Error ? err.message : "Incorrect PIN or server error.";
      setErrorStatus(msg);
      toast.error(msg);
      setPinDigits("");
    } finally {
      setAuthPending(false);
    }
  };

  const handleKeyClick = (digit: string) => {
    if (authPending || isSuccess) return;
    if (mode === "api" && (!selectedStaff || listLoading)) return;
    if (pinDigits.length >= 8) return;
    const nextPin = pinDigits + digit;
    setPinDigits(nextPin);
    setErrorStatus(null);

    // Standard 4-digit PIN: auto-verify. Longer PINs (5–8): use Unlock.
    if (nextPin.length === 4 && selectedStaff) {
      void verifyWithApi(selectedStaff, nextPin);
    }
  };

  const handleUnlock = () => {
    if (authPending || isSuccess || !selectedStaff) return;
    if (pinDigits.length < 4 || pinDigits.length > 8) {
      setErrorStatus("Enter 4–8 digits.");
      return;
    }
    void verifyWithApi(selectedStaff, pinDigits);
  };

  const handleBackspace = () => {
    if (authPending || isSuccess) return;
    setPinDigits((prev) => prev.slice(0, -1));
    setErrorStatus(null);
  };

  const handleClear = () => {
    if (authPending || isSuccess) return;
    setPinDigits("");
    setErrorStatus(null);
  };

  if (mode === "demo") {
    return (
      <div className="w-full max-w-xl mx-auto py-6 px-4 rounded-2xl border border-white/10 bg-slate-900/40 text-center">
        <p className="text-sm text-slate-300 mb-2">Demo PIN gateway disabled</p>
        <p className="text-xs text-slate-500">
          Use the API-backed staff PIN on <code className="text-indigo-400">/v2</code> or{" "}
          <code className="text-indigo-400">/erp/login</code> with{" "}
          <code className="text-indigo-400">apps/api</code> running.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Staff PIN · {slug}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Who is on duty?
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Select your name, enter your PIN. Session signs in to the Pelbu desk API — no preset codes.
          </p>
        </div>

        {onBackToHub && (
          <TactileButton
            variant="secondary"
            size="sm"
            onClick={onBackToHub}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            All workspaces
          </TactileButton>
        )}
      </div>

      {listError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{listError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {listLoading && (
            <div className="col-span-full text-sm text-slate-400 py-8 text-center border border-white/10 rounded-2xl">
              Loading staff…
            </div>
          )}
          {!listLoading && staffList.length === 0 && !listError && (
            <div className="col-span-full text-sm text-slate-400 py-8 text-center border border-white/10 rounded-2xl">
              No eligible staff found.
            </div>
          )}
          {!listLoading &&
            staffList.map((staff) => {
              const Icon = deskRoleIcon(staff.deskRole);
              const isSelected = selectedStaff?.id === staff.id;
              const homePreview = mapDeskRoleToV2Home(staff.deskRole);
              const gradient = roleBadgeClass(staff.deskRole);

              return (
                <motion.button
                  key={staff.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedStaff(staff);
                    setPinDigits("");
                    setErrorStatus(null);
                  }}
                  className={`relative text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600/20 border-indigo-500 shadow-[0_0_24px_-4px_rgba(99,102,241,0.4)]"
                      : "bg-slate-900/60 border-white/10 hover:border-white/20 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-white truncate">
                        {staff.fullName}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">
                        {staff.deskRole || "desk"} · {staff.employeeCode}
                      </p>
                      <span className="inline-block mt-1 text-[11px] text-slate-500">
                        Opens {homePreview}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute top-3 right-3 text-indigo-400">
                      <CheckCircle2 className="w-5 h-5 fill-indigo-400/20" />
                    </div>
                  )}
                </motion.button>
              );
            })}
        </div>

        <div className="lg:col-span-5">
          <NeoGlassCard className="p-6" variant="elevated">
            <div className="text-center mb-6">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                {selectedStaff
                  ? `PIN: ${selectedStaff.fullName}`
                  : "Select a staff member"}
              </span>

              <div className="flex items-center justify-center gap-4 my-4">
                {Array.from({ length: 8 }).map((_, idx) => {
                  const filled = pinDigits.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-3 h-3 rounded-full border transition-all duration-200 ${
                        isSuccess
                          ? "bg-emerald-500 border-emerald-400 scale-125"
                          : errorStatus
                          ? "bg-rose-500 border-rose-400 animate-shake"
                          : filled
                          ? "bg-indigo-500 border-indigo-400 scale-110 shadow-[0_0_12px_rgba(99,102,241,0.6)]"
                          : "border-white/20 bg-slate-800/50"
                      }`}
                    />
                  );
                })}
              </div>

              {errorStatus && (
                <p className="text-xs text-rose-400 flex items-center justify-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errorStatus}</span>
                </p>
              )}

              {isSuccess && (
                <p className="text-xs text-emerald-400 flex items-center justify-center gap-1 mt-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Access granted</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
                <TactileButton
                  key={key}
                  variant="secondary"
                  size="lg"
                  disabled={
                    !selectedStaff || isSuccess || authPending || listLoading
                  }
                  onClick={() => handleKeyClick(key)}
                  className="text-xl font-bold py-3.5"
                >
                  {key}
                </TactileButton>
              ))}
              <TactileButton
                variant="ghost"
                size="lg"
                disabled={
                  !selectedStaff ||
                  pinDigits.length === 0 ||
                  isSuccess ||
                  authPending
                }
                onClick={handleClear}
                className="text-xs text-slate-400 uppercase font-semibold"
              >
                Clear
              </TactileButton>
              <TactileButton
                variant="secondary"
                size="lg"
                disabled={
                  !selectedStaff || isSuccess || authPending || listLoading
                }
                onClick={() => handleKeyClick("0")}
                className="text-xl font-bold py-3.5"
              >
                0
              </TactileButton>
              <TactileButton
                variant="ghost"
                size="lg"
                disabled={
                  !selectedStaff ||
                  pinDigits.length === 0 ||
                  isSuccess ||
                  authPending
                }
                onClick={handleBackspace}
                className="text-slate-400 hover:text-white"
              >
                <Delete className="w-5 h-5" />
              </TactileButton>
            </div>
            {selectedStaff && pinDigits.length > 4 ? (
              <TactileButton
                variant="primary"
                size="lg"
                className="w-full mt-3"
                disabled={authPending || isSuccess || pinDigits.length < 5}
                onClick={handleUnlock}
              >
                Unlock ({pinDigits.length} digits)
              </TactileButton>
            ) : null}
          </NeoGlassCard>
        </div>
      </div>
    </div>
  );
};
