/**
 * Hotel / agent panel — find free guides & cars, post Innora-wide requests.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, GlassPanel, KpiCard } from "@hos-v2/ui";
import {
  presenceLabel,
  useMarketplaceStore,
  type FleetRequestKind,
} from "../../lib/marketplace-store";

type Props = {
  postedBy: "hotel" | "agent";
  posterLabel: string;
};

export function MarketplaceDeskPanel({ postedBy, posterLabel }: Props) {
  const properties = useMarketplaceStore((s) => s.properties);
  const freeGuides = useMarketplaceStore((s) => s.freeGuides);
  const freeVehicles = useMarketplaceStore((s) => s.freeVehicles);
  const postRequest = useMarketplaceStore((s) => s.postRequest);
  const requests = useMarketplaceStore((s) => s.requests);
  const cancelRequest = useMarketplaceStore((s) => s.cancelRequest);
  const settings = useMarketplaceStore((s) => s.settings);
  const setPropertyCommissionPct = useMarketplaceStore(
    (s) => s.setPropertyCommissionPct,
  );
  const effectiveCommissionPct = useMarketplaceStore(
    (s) => s.effectiveCommissionPct,
  );

  const guides = freeGuides();
  const vehicles = freeVehicles();
  const open = requests.filter((r) => r.status === "open");

  const [kind, setKind] = useState<FleetRequestKind>("guide");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [pax, setPax] = useState(6);
  const [languages, setLanguages] = useState("English");
  const [notes, setNotes] = useState("");
  const [commPct, setCommPct] = useState(
    () => effectiveCommissionPct(properties[0]?.id ?? ""),
  );

  const propName = useMemo(
    () => properties.find((p) => p.id === propertyId)?.name,
    [properties, propertyId],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Free guides" value={guides.length} delta="Innora-wide" />
        <KpiCard label="Free vehicles" value={vehicles.length} delta="Seats ready" />
        <KpiCard label="Open requests" value={open.length} delta="Board" />
        <KpiCard
          label="Affiliate %"
          value={`${effectiveCommissionPct(propertyId)}%`}
          delta={`${settings.guideSharePct}/${settings.innoraSharePct} split`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel className="p-3.5">
          <strong className="text-sm">Available now (no guest data)</strong>
          <div className="mt-3 space-y-2">
            <p className="m-0 text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
              Guides
            </p>
            {guides.length === 0 ? (
              <EmptyState title="No free guides" description="Check later or post a request." />
            ) : (
              guides.map((g) => {
                const at = g.presence.atPropertyId
                  ? properties.find((p) => p.id === g.presence.atPropertyId)?.name
                  : null;
                return (
                  <div
                    key={g.guideId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--hos-line)] px-3 py-2 text-xs"
                  >
                    <div>
                      <strong>{g.name}</strong>
                      <div className="text-[10px] text-[var(--hos-ink-3)]">
                        {g.languages}
                      </div>
                    </div>
                    <Badge
                      tone={g.presence.status === "free" ? "success" : "vip"}
                    >
                      {presenceLabel(g.presence.status, at)}
                    </Badge>
                  </div>
                );
              })
            )}
            <p className="m-0 pt-2 text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
              Vehicles
            </p>
            {vehicles.length === 0 ? (
              <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">None free</p>
            ) : (
              vehicles.map((v) => (
                <div
                  key={v.vehicleId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--hos-line)] px-3 py-2 text-xs"
                >
                  <div>
                    <strong className="font-mono">{v.plate}</strong>
                    <div className="text-[10px] text-[var(--hos-ink-3)]">
                      {v.driver} · {v.seats} seats
                    </div>
                  </div>
                  <Badge tone="success">
                    {presenceLabel(v.presence.status)}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </GlassPanel>

        <GlassPanel className="grid gap-2 p-3.5">
          <strong className="text-sm">Post need (Innora-wide)</strong>
          <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
            Guest names stay hidden until a guide/driver accepts.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={kind === "guide" ? undefined : "secondary"}
              onClick={() => setKind("guide")}
            >
              Need guide
            </Button>
            <Button
              size="sm"
              variant={kind === "vehicle" ? undefined : "secondary"}
              onClick={() => setKind("vehicle")}
            >
              Need car
            </Button>
          </div>
          <select
            value={propertyId}
            onChange={(e) => {
              setPropertyId(e.target.value);
              setCommPct(effectiveCommissionPct(e.target.value));
            }}
            className="hos-input !rounded-xl !text-[13px]"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="hos-input !rounded-xl"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="hos-input !rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={pax}
              onChange={(e) => setPax(Number(e.target.value) || 1)}
              className="hos-input !rounded-xl"
              placeholder="Pax"
            />
            <input
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              className="hos-input !rounded-xl"
              placeholder="Languages"
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="hos-input !rounded-xl !text-[13px]"
            placeholder="Public notes (no guest names)"
          />
          <Button
            className="hos-btn-ink !rounded-xl"
            onClick={() => {
              const res = postRequest({
                kind,
                postedBy,
                posterLabel,
                propertyId,
                windowFrom: from,
                windowTo: to,
                pax,
                languages,
                area: properties.find((p) => p.id === propertyId)?.area ?? "",
                notesPublic: notes,
              });
              if (!res.ok) toast.error(res.error);
              else toast.success(`Request posted · ${propName}`);
            }}
          >
            Post to marketplace
          </Button>

          {postedBy === "hotel" ? (
            <div className="mt-2 border-t border-[var(--hos-line)] pt-3">
              <strong className="text-[12px]">
                Guide room-sale commission (opaque)
              </strong>
              <p className="m-0 mt-1 text-[10px] text-[var(--hos-ink-3)]">
                Guest pays tariff only. Platform allows {settings.platformMinPct}–
                {settings.platformMaxPct}%. Split {settings.guideSharePct}% guide /{" "}
                {settings.innoraSharePct}% Innora.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  value={commPct}
                  onChange={(e) => setCommPct(Number(e.target.value) || 0)}
                  className="hos-input w-24 !rounded-xl"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const res = setPropertyCommissionPct(propertyId, commPct);
                    if (!res.ok) toast.error(res.error);
                    else toast.success(`Commission ${commPct}% for ${propName}`);
                  }}
                >
                  Save %
                </Button>
              </div>
            </div>
          ) : null}
        </GlassPanel>
      </div>

      <GlassPanel className="p-3.5">
        <strong className="text-sm">Request board</strong>
        {requests.length === 0 ? (
          <EmptyState title="No requests" description="Post a need above." />
        ) : (
          <ul className="m-0 mt-2 list-none space-y-2 p-0">
            {requests.slice(0, 12).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--hos-line)] px-3 py-2 text-xs"
              >
                <div>
                  <Badge tone="teal">{r.kind}</Badge>{" "}
                  <Badge tone="muted">{r.status}</Badge> {r.propertyName} ·{" "}
                  {r.windowFrom}→{r.windowTo} · {r.pax} pax
                  <div className="text-[10px] text-[var(--hos-ink-3)]">
                    {r.posterLabel} · {r.notesPublic || "—"}
                  </div>
                </div>
                {r.status === "open" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const res = cancelRequest(r.id);
                      if (!res.ok) toast.error(res.error);
                      else toast.message("Cancelled");
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
