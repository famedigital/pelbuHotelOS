import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  FieldInput,
  FieldSelect,
  GlassPanel,
  InsetList,
  KpiCard,
  ModuleFrame,
  StatusLegend,
  MorphTabs,
} from "@hos-v2/ui";
import {
  useSettingsStore,
  type Dzongkhag,
} from "../lib/settings-store";
import {
  hotelInitialFromName,
  peekNextFolioNo,
  peekNextInvoiceNo,
  peekNextPsbnNo,
  resolveHotelInitial,
} from "../lib/doc-numbers";
import { loadDeptSop, saveDeptSop, type DeptSop } from "../lib/dept-sop";

type Tab = "property" | "rooms" | "fiscal" | "payments" | "sop";

const DZONGKHAGS: Dzongkhag[] = [
  "Paro",
  "Thimphu",
  "Punakha",
  "Bumthang",
  "Wangdue",
  "Haa",
  "Trashigang",
];

export function SettingsPage() {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<Tab>("property");
  const s = useSettingsStore();
  const [floorLabel, setFloorLabel] = useState("4th Floor");
  const [catCode, setCatCode] = useState("SUP-K");
  const [catName, setCatName] = useState("Superior King");
  const [roomNo, setRoomNo] = useState("401");
  const [floorId, setFloorId] = useState(s.floors[0]?.id ?? "");
  const [catId, setCatId] = useState(s.categories[0]?.id ?? "");
  const [sop, setSop] = useState<DeptSop>(() => loadDeptSop());

  const tabs: { id: Tab; label: string }[] = [
    { id: "property", label: "Property" },
    { id: "rooms", label: "Rooms & Floors" },
    { id: "fiscal", label: "DRC Fiscal" },
    { id: "payments", label: "Payments & RMA" },
    { id: "sop", label: "Dept SOP" },
  ];

  return (
    <ModuleFrame
      title="Settings"
      description="Licensing · building architecture · DRC tax laws · RMA / till limits"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusLegend
            dense
            className="hidden md:flex"
            items={[
              { id: "prop", label: "Property", swatch: "var(--hos-primary)" },
              { id: "fiscal", label: "Fiscal", swatch: "var(--hos-brass)" },
              { id: "pay", label: "Payments", swatch: "var(--hos-emerald)" },
            ]}
          />
          <Badge tone="default" className="border border-[var(--hos-primary)]">
            Property Blueprint
          </Badge>
        </div>
      }
    >
    <div className="flex flex-col gap-4">

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Property" value={s.hotelName.split(" ")[0] ?? "—"} delta={s.dzongkhag} />
        <KpiCard label="Rooms" value={s.rooms.length} delta={`${s.floors.length} floors`} />
        <KpiCard label="SC / BST" value={`${s.scEnabled ? s.scRate * 100 : 0}% / ${s.bstEnabled ? s.bstRate * 100 : 0}%`} />
        <KpiCard label="DOT stars" value={s.dotStars} delta="Category" />
      </div>

      <MorphTabs
        glowId="activeTabGlow"
        value={tab}
        onChange={setTab}
        items={tabs}
        size="md"
        className="w-fit"
      />

      {tab === "property" ? (
        <GlassPanel className="grid max-w-3xl gap-3 p-4 sm:grid-cols-2">
          <FieldInput
            className="sm:col-span-2"
            label="Hotel name"
            value={s.hotelName}
            onChange={(e) => s.updateProfile({ hotelName: e.target.value })}
          />
          <div className="sm:col-span-2">
            <button
              type="button"
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5"
              onClick={() => s.openHotelOnboarding()}
            >
              Open setup wizard (new property only)
            </button>
            <p className="mt-1 text-xs text-slate-500">
              Does not auto-open for existing hotels. Use only when commissioning a brand-new property.
            </p>
          </div>
          <FieldSelect
            label="Dzongkhag"
            value={s.dzongkhag}
            onChange={(e) => s.updateProfile({ dzongkhag: e.target.value as Dzongkhag })}
          >
            {DZONGKHAGS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </FieldSelect>
          <FieldInput
            label="DOT star category"
            type="number"
            min={1}
            max={5}
            value={s.dotStars}
            onChange={(e) => s.updateProfile({ dotStars: Number(e.target.value) || 1 })}
          />
          <FieldInput
            label="Tax Payer Number (TPN)"
            value={s.tpn}
            onChange={(e) => s.updateProfile({ tpn: e.target.value })}
            inputClassName="font-mono"
          />
          <FieldInput
            label="Trade license #"
            value={s.tradeLicense}
            onChange={(e) => s.updateProfile({ tradeLicense: e.target.value })}
            inputClassName="font-mono"
          />
          <FieldInput
            label="Check-in time"
            type="time"
            value={s.checkInTime}
            onChange={(e) => s.updateProfile({ checkInTime: e.target.value })}
          />
          <FieldInput
            label="Check-out time"
            type="time"
            value={s.checkOutTime}
            onChange={(e) => s.updateProfile({ checkOutTime: e.target.value })}
          />
          <motion.div className="sm:col-span-2" whileTap={reduce ? undefined : { scale: 0.97 }}>
            <Button onClick={() => toast.success("Property profile saved")}>Save property profile</Button>
          </motion.div>
        </GlassPanel>
      ) : null}

      {tab === "rooms" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassPanel className="flex flex-col gap-3 p-4">
            <strong className="text-sm">Floor builder</strong>
            <InsetList>
              {s.floors.map((f) => (
                <div key={f.id} className="hos-cell-row text-xs font-semibold">
                  {f.label}
                </div>
              ))}
            </InsetList>
            <div className="flex gap-2">
              <input value={floorLabel} onChange={(e) => setFloorLabel(e.target.value)} className="flex-1 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs" />
              <Button size="sm" onClick={() => { s.addFloor(floorLabel); toast.success(`Floor ${floorLabel} added`); }}>Add</Button>
            </div>
            <strong className="mt-2 text-sm">Categories</strong>
            <div className="hos-table-shell hos-scrollbar-slim">
              <table className="hos-data text-xs">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Max occ</th>
                  </tr>
                </thead>
                <tbody>
                  {s.categories.map((c) => (
                    <tr key={c.id}>
                      <td className="font-mono text-[var(--hos-primary)]">{c.code}</td>
                      <td className="font-semibold">{c.name}</td>
                      <td className="tabular-nums">{c.maxOcc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input value={catCode} onChange={(e) => setCatCode(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs" placeholder="Code" />
              <input value={catName} onChange={(e) => setCatName(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs" placeholder="Name" />
              <Button size="sm" onClick={() => { s.addCategory(catCode, catName, 2); toast.success("Category added"); }}>Add cat</Button>
            </div>
          </GlassPanel>

          <GlassPanel className="flex flex-col gap-3 p-4">
            <strong className="text-sm">Room numbering table</strong>
            <div className="hos-table-shell hos-scrollbar-slim">
              <table className="hos-data text-xs">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Floor</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hos-line)]">
                  {s.rooms.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2 font-mono font-bold">{r.number}</td>
                      <td className="px-2 py-2">{s.floors.find((f) => f.id === r.floorId)?.label}</td>
                      <td className="px-2 py-2">{s.categories.find((c) => c.id === r.categoryId)?.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={roomNo} onChange={(e) => setRoomNo(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs" placeholder="Room #" />
              <select value={floorId} onChange={(e) => setFloorId(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs">
                {s.floors.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <select value={catId} onChange={(e) => setCatId(e.target.value)} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs">
                {s.categories.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
              <Button size="sm" onClick={() => {
                if (!floorId || !catId) return;
                s.addRoom(roomNo, floorId, catId);
                toast.success(`Room ${roomNo} added`);
              }}>Add room</Button>
            </div>
          </GlassPanel>
        </div>
      ) : null}

      {tab === "fiscal" ? (
        <GlassPanel className="grid max-w-2xl gap-3 p-4">
          <label className="flex items-center justify-between text-xs font-medium">
            10% Service Charge enabled
            <input type="checkbox" checked={s.scEnabled} onChange={(e) => s.updateFiscal({ scEnabled: e.target.checked })} />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            SC rate
            <input type="number" step="0.01" value={s.scRate} onChange={(e) => s.updateFiscal({ scRate: Number(e.target.value) || 0 })} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Staff tip pool share of SC (%)
            <input type="number" value={s.tipPoolSharePct} onChange={(e) => s.updateFiscal({ tipPoolSharePct: Number(e.target.value) || 0 })} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm" />
          </label>
          <label className="flex items-center justify-between text-xs font-medium">
            Bhutan Sales Tax (BST) enabled
            <input type="checkbox" checked={s.bstEnabled} onChange={(e) => s.updateFiscal({ bstEnabled: e.target.checked })} />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            BST rate (5% or 10%)
            <select
              value={s.bstRate}
              onChange={(e) => s.updateFiscal({ bstRate: Number(e.target.value) })}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm"
            >
              <option value={0.05}>5%</option>
              <option value={0.1}>10%</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Hotel initial (2–4 letters)
            <input
              value={s.hotelInitial}
              maxLength={4}
              onChange={(e) => {
                const hotelInitial = e.target.value
                  .replace(/[^A-Za-z]/g, "")
                  .toUpperCase()
                  .slice(0, 4);
                const initial =
                  hotelInitial.length >= 2
                    ? hotelInitial
                    : hotelInitialFromName(s.hotelName);
                s.updateFiscal({
                  hotelInitial,
                  psbnPrefix: `${initial}PSBN`,
                  invPrefix: `${initial}INV`,
                });
              }}
              placeholder={hotelInitialFromName(s.hotelName)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 font-mono text-sm uppercase tracking-widest"
            />
            <span className="font-normal text-[var(--hos-ink-3)]">
              Empty or short → derive from hotel name ({hotelInitialFromName(s.hotelName)}).
              Numbers: {resolveHotelInitial()}FN##### · {resolveHotelInitial()}INV##### ·{" "}
              {resolveHotelInitial()}PSBN#####
            </span>
          </label>
          <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5 font-mono text-[11px] text-[var(--hos-ink-2)]">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--hos-ink-3)]">
              Next gapless numbers
            </p>
            <p className="m-0 mt-1">{peekNextFolioNo()}</p>
            <p className="m-0">{peekNextInvoiceNo()}</p>
            <p className="m-0">{peekNextPsbnNo()}</p>
          </div>
          <Button
            onClick={() =>
              toast.success("DRC fiscal laws saved", {
                description: `SC ${s.scRate * 100}% · BST ${s.bstRate * 100}% · ${resolveHotelInitial()}`,
              })
            }
          >
            Save fiscal config
          </Button>
        </GlassPanel>
      ) : null}

      {tab === "payments" ? (
        <GlassPanel className="grid max-w-2xl gap-3 p-4">
          <label className="grid gap-1 text-xs font-medium">
            mBoB / RMA merchant ID
            <input value={s.mbobMerchantId} onChange={(e) => s.updatePayments({ mbobMerchantId: e.target.value })} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 font-mono text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            QR upload status / note
            <input value={s.mbobQrNote} onChange={(e) => s.updatePayments({ mbobQrNote: e.target.value })} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm" />
          </label>
          <div className="hos-cell flex aspect-[1.4] max-w-xs items-center justify-center rounded-2xl border border-dashed border-[var(--hos-line)] text-xs text-[var(--hos-ink-3)]">
            RMA QR preview slot · {s.mbobMerchantId}
          </div>
          <Button size="sm" variant="secondary" onClick={() => toast.success("QR image staged", { description: "Merchant QR linked for desk settle modal" })}>
            Upload mBoB QR
          </Button>
          <label className="grid gap-1 text-xs font-medium">
            BNB account name
            <input value={s.bnbAccountName} onChange={(e) => s.updatePayments({ bnbAccountName: e.target.value })} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            BNB account number
            <input value={s.bnbAccountNo} onChange={(e) => s.updatePayments({ bnbAccountNo: e.target.value })} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 font-mono text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Till opening float limit (Nu.)
            <input type="number" value={s.tillFloatLimit} onChange={(e) => s.updatePayments({ tillFloatLimit: Number(e.target.value) || 0 })} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Till max cash before bank drop (Nu.)
            <input type="number" value={s.tillMaxCash} onChange={(e) => s.updatePayments({ tillMaxCash: Number(e.target.value) || 0 })} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm" />
          </label>
          <Button onClick={() => toast.success("Payment methods saved")}>Save payments</Button>
        </GlassPanel>
      ) : null}

      {tab === "sop" ? (
        <GlassPanel className="grid max-w-3xl gap-4 p-4">
          <p className="m-0 text-[12px] text-[var(--hos-ink-2)]">
            Flexible department clocks seeded from Pelbu guidelines — edit times per property;
            handover checklists drive End of shift print/file.
          </p>
          <FieldInput
            label="Handover buffer (minutes)"
            type="number"
            min={0}
            max={180}
            value={sop.bufferMinutes}
            onChange={(e) =>
              setSop((prev) => ({
                ...prev,
                bufferMinutes: Number(e.target.value) || 0,
              }))
            }
          />
          <strong className="text-sm text-[var(--hos-ink)]">FO shifts</strong>
          {sop.foShifts.map((shift, idx) => (
            <div key={shift.id} className="grid gap-2 sm:grid-cols-3">
              <FieldInput
                label={`${shift.label} start`}
                type="time"
                value={shift.start}
                onChange={(e) => {
                  const foShifts = sop.foShifts.map((s, i) =>
                    i === idx ? { ...s, start: e.target.value } : s,
                  );
                  setSop((prev) => ({ ...prev, foShifts }));
                }}
              />
              <FieldInput
                label={`${shift.label} end`}
                type="time"
                value={shift.end}
                onChange={(e) => {
                  const foShifts = sop.foShifts.map((s, i) =>
                    i === idx ? { ...s, end: e.target.value } : s,
                  );
                  setSop((prev) => ({ ...prev, foShifts }));
                }}
              />
              <div className="flex items-end text-[11px] text-[var(--hos-ink-3)]">
                {shift.id}
              </div>
            </div>
          ))}
          <strong className="text-sm text-[var(--hos-ink)]">Reservations hours</strong>
          <div className="grid gap-2 sm:grid-cols-2">
            <FieldInput
              label="Open"
              type="time"
              value={sop.reservationsHours.start}
              onChange={(e) =>
                setSop((prev) => ({
                  ...prev,
                  reservationsHours: {
                    ...prev.reservationsHours,
                    start: e.target.value,
                  },
                }))
              }
            />
            <FieldInput
              label="Close"
              type="time"
              value={sop.reservationsHours.end}
              onChange={(e) =>
                setSop((prev) => ({
                  ...prev,
                  reservationsHours: {
                    ...prev.reservationsHours,
                    end: e.target.value,
                  },
                }))
              }
            />
          </div>
          <strong className="text-sm text-[var(--hos-ink)]">Kitchen windows</strong>
          {sop.kitchenWindows.map((w, idx) => (
            <div key={w.id} className="grid gap-2 sm:grid-cols-2">
              <FieldInput
                label={`${w.label} start`}
                type="time"
                value={w.start}
                onChange={(e) => {
                  const kitchenWindows = sop.kitchenWindows.map((row, i) =>
                    i === idx ? { ...row, start: e.target.value } : row,
                  );
                  setSop((prev) => ({ ...prev, kitchenWindows }));
                }}
              />
              <FieldInput
                label={`${w.label} end`}
                type="time"
                value={w.end}
                onChange={(e) => {
                  const kitchenWindows = sop.kitchenWindows.map((row, i) =>
                    i === idx ? { ...row, end: e.target.value } : row,
                  );
                  setSop((prev) => ({ ...prev, kitchenWindows }));
                }}
              />
            </div>
          ))}
          <Button
            onClick={() => {
              try {
                const next = saveDeptSop(sop);
                setSop(next);
                toast.success("Department SOP saved", {
                  description: `Buffer ${next.bufferMinutes}m · ${next.foShifts.length} FO shifts`,
                });
              } catch (err) {
                console.error("[settings] sop save", err);
                toast.error(
                  err instanceof Error ? err.message : "Invalid SOP times",
                );
              }
            }}
          >
            Save department SOP
          </Button>
        </GlassPanel>
      ) : null}
    </div>
    </ModuleFrame>
  );
}
