"use client";

import React, { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Cpu, Info, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NeoGlassCard, TactileButton } from "@/components/ui/neo-spatial";
import {
  encodeSimpleReceipt,
  printSilentReceipt,
  requestThermalPort,
} from "@hotel-os/hardware";
import { deskFetchJson, DeskApiError } from "@/lib/v2/desk-api-client";
import { readV2DeskToken } from "@/lib/v2/desk-api";

const V2FlagshipScene = dynamic(
  () =>
    import("@/components/v2/V2FlagshipScene").then((m) => m.V2FlagshipScene),
  { ssr: false, loading: () => null },
);

type KeycardResponse = {
  ok: true;
  encoderId: string;
  mode: string;
  encodedCard: boolean;
  message?: string;
};

export default function V2HardwarePage() {
  const signedIn = Boolean(readV2DeskToken());
  const [pending, start] = useTransition();
  const [rfidBody, setRfidBody] = useState({
    roomNumber: "101",
    checkInIso: new Date().toISOString(),
    checkOutIso: new Date(Date.now() + 86400000).toISOString(),
    guestName: "Desk Test",
  });
  const [rfidRes, setRfidRes] = useState<KeycardResponse | null>(null);

  const printEscPosHardware = () => {
    start(async () => {
      try {
        const port = await requestThermalPort();
        const bytes = encodeSimpleReceipt([
          "Hotel OS — hardware lab",
          "ESC/POS via @hotel-os/hardware",
          `Room ${rfidBody.roomNumber}`,
          new Date().toISOString(),
        ]);
        await printSilentReceipt(port, bytes);
        toast.success("Bytes sent via WebSerial");
      } catch (err) {
        console.error("[v2/hardware] escpos", err);
        toast.error(
          err instanceof Error
            ? err.message
            : "WebSerial unavailable or denied — use Chrome/Edge over HTTPS.",
        );
      }
    });
  };

  const encodeRfid = () => {
    if (!signedIn) {
      toast.error("Sign in on /v2 first");
      return;
    }
    start(async () => {
      try {
        const res = await deskFetchJson<KeycardResponse>("/v1/hardware/keycard", {
          method: "POST",
          body: JSON.stringify(rfidBody),
        });
        setRfidRes(res);
        if (!res.encodedCard) {
          toast.message(res.message ?? "RFID: no physical encode", {
            description: `Mode: ${res.mode} · encoder: ${res.encoderId}`,
          });
        } else {
          toast.success("Keycard encoded");
        }
      } catch (err) {
        console.error("[v2/hardware] keycard", err);
        setRfidRes(null);
        toast.error(err instanceof DeskApiError ? err.message : String(err));
      }
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#030712] text-slate-100 overflow-y-auto">
      <div className="p-4 space-y-4 max-w-4xl mx-auto w-full">
        <NeoGlassCard className="p-4 flex gap-3 border-white/10 glass-card [transform:translateZ(0)]">
          <Cpu className="w-5 h-5 text-indigo-400 shrink-0" />
          <div className="text-xs text-slate-400 space-y-1">
            <p className="text-white font-semibold">Hardware lab</p>
            <p>
              ESC/POS uses <code className="text-indigo-300">@hotel-os/hardware</code>{" "}
              WebSerial. RFID posts{" "}
              <code className="text-indigo-300">POST /v1/hardware/keycard</code> — success means
              request accepted, not that a lock was programmed.
            </p>
          </div>
        </NeoGlassCard>

        <NeoGlassCard className="p-4 space-y-4 border-white/10 glass-card">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Printer className="w-4 h-4" /> Thermal ESC/POS
          </h2>
          <p className="text-[11px] text-slate-500">
            Live path when the browser exposes <code className="text-slate-400">navigator.serial</code>{" "}
            (Chrome / Edge, HTTPS or localhost).
          </p>
          <TactileButton
            variant="primary"
            size="md"
            disabled={pending}
            onClick={() => printEscPosHardware()}
            icon={
              pending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )
            }
          >
            Print test receipt
          </TactileButton>
        </NeoGlassCard>

        <NeoGlassCard className="p-4 space-y-3 border-white/10 glass-card">
          <h2 className="text-sm font-bold text-white">RFID / keycard encode</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <label className="flex flex-col gap-1">
              <span className="text-slate-500">Room</span>
              <input
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                value={rfidBody.roomNumber}
                onChange={(e) =>
                  setRfidBody((p) => ({ ...p, roomNumber: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-500">Guest</span>
              <input
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                value={rfidBody.guestName}
                onChange={(e) =>
                  setRfidBody((p) => ({ ...p, guestName: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-500">Check-in ISO</span>
              <input
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[11px]"
                value={rfidBody.checkInIso}
                onChange={(e) =>
                  setRfidBody((p) => ({ ...p, checkInIso: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-500">Check-out ISO</span>
              <input
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[11px]"
                value={rfidBody.checkOutIso}
                onChange={(e) =>
                  setRfidBody((p) => ({ ...p, checkOutIso: e.target.value }))
                }
              />
            </label>
          </div>
          <TactileButton
            variant="secondary"
            size="md"
            disabled={!signedIn || pending}
            onClick={() => encodeRfid()}
          >
            POST keycard intent
          </TactileButton>
          {rfidRes ? (
            <NeoGlassCard className="p-3 text-[11px] border-amber-500/30 bg-amber-950/20 space-y-1">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <p className="text-amber-100 font-semibold">
                    {rfidRes.encodedCard ? "Hardware encoded" : "Not encoded on card"}
                  </p>
                  <p className="text-slate-400">
                    mode={rfidRes.mode} · encoder={rfidRes.encoderId}
                  </p>
                  {rfidRes.message ? (
                    <p className="text-amber-200/90 mt-1">{rfidRes.message}</p>
                  ) : null}
                </div>
              </div>
            </NeoGlassCard>
          ) : null}
        </NeoGlassCard>

        <NeoGlassCard className="p-4 space-y-3 border-white/10 glass-card">
          <h2 className="text-sm font-bold text-white">Flagship 3D (sandbox)</h2>
          <p className="text-[11px] text-slate-500">
            R3F <code className="text-indigo-300">frameloop=&quot;demand&quot;</code>, respects{" "}
            <code className="text-indigo-300">prefers-reduced-motion</code>. Does not replace production marketing routes.
          </p>
          <div className="h-64 rounded-xl overflow-hidden border border-white/10 bg-slate-950">
            <V2FlagshipScene />
          </div>
        </NeoGlassCard>
      </div>
    </div>
  );
}
