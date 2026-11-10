/**
 * Shared Innora-wide marketplace home for guide / driver field portals.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, GlassPanel } from "@hos-v2/ui";
import { formatNu } from "../../lib/front-office-store";
import {
  presenceLabel,
  useMarketplaceStore,
  type PresenceStatus,
} from "../../lib/marketplace-store";
import { useExtrasStore } from "../../lib/extras-store";

type Role = "guide" | "driver";

type Props = {
  role: Role;
  /** Bound registry id — first verified guide / first vehicle for demo session */
  actorId: string;
  actorName: string;
};

export function MarketplaceFieldHome({ role, actorId, actorName }: Props) {
  const properties = useMarketplaceStore((s) => s.properties);
  const guidePresence = useMarketplaceStore((s) => s.guidePresence);
  const vehiclePresence = useMarketplaceStore((s) => s.vehiclePresence);
  const setGuidePresence = useMarketplaceStore((s) => s.setGuidePresence);
  const setVehiclePresence = useMarketplaceStore((s) => s.setVehiclePresence);
  const openRequests = useMarketplaceStore((s) => s.openRequests);
  const acceptRequest = useMarketplaceStore((s) => s.acceptRequest);
  const declineRequest = useMarketplaceStore((s) => s.declineRequest);
  const createRoomReferral = useMarketplaceStore((s) => s.createRoomReferral);
  const accrueReferral = useMarketplaceStore((s) => s.accrueReferral);
  const referrals = useMarketplaceStore((s) => s.referrals);
  const effectiveCommissionPct = useMarketplaceStore((s) => s.effectiveCommissionPct);
  const settings = useMarketplaceStore((s) => s.settings);

  const presence =
    role === "guide" ? guidePresence[actorId] : vehiclePresence[actorId];
  const jobs = openRequests(role === "guide" ? "guide" : "vehicle");
  const myEarnings = referrals.filter((r) => r.referrerId === actorId);

  const [atProp, setAtProp] = useState(properties[0]?.id ?? "");
  const [sellProp, setSellProp] = useState(properties[0]?.id ?? "");
  const [guestName, setGuestName] = useState("");
  const [nights, setNights] = useState(2);
  const [roomNet, setRoomNet] = useState(7600);

  const atName = useMemo(() => {
    const id = presence?.atPropertyId;
    return id ? properties.find((p) => p.id === id)?.name : null;
  }, [presence, properties]);

  const setStatus = (status: PresenceStatus) => {
    if (role === "guide") {
      setGuidePresence(actorId, status, status === "at_property" ? atProp : null);
    } else {
      setVehiclePresence(
        actorId,
        status,
        status === "at_property" ? atProp : null,
      );
    }
    toast.success(`Status → ${presenceLabel(status)}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-3 pb-8 pt-3">
      <div>
        <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-[var(--hos-ink-3)]">
          Innora marketplace
        </p>
        <h1 className="m-0 text-[1.5rem] font-extrabold text-[var(--hos-ink)]">
          {actorName}
        </h1>
        <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">
          Hotels & agents find you · sell rooms · guest never sees commission
        </p>
      </div>

      <GlassPanel className="p-3">
        <strong className="text-[13px]">My availability</strong>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["free", "busy", "at_property"] as const).map((st) => (
            <Button
              key={st}
              size="sm"
              className={`!min-h-11 !rounded-full ${
                presence?.status === st ? "hos-btn-ink" : ""
              }`}
              variant={presence?.status === st ? undefined : "secondary"}
              onClick={() => setStatus(st)}
            >
              {st === "at_property" ? "At hotel" : st}
            </Button>
          ))}
        </div>
        {presence?.status === "at_property" || true ? (
          <label className="mt-2 grid gap-1 text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
            Hotel (when at property)
            <select
              value={atProp}
              onChange={(e) => setAtProp(e.target.value)}
              className="hos-input !min-h-11 !rounded-xl !text-[13px]"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <p className="m-0 mt-2 text-[11px] text-[var(--hos-ink-3)]">
          Live:{" "}
          <Badge tone={presence?.status === "free" ? "success" : "vip"}>
            {presenceLabel(presence?.status ?? "busy", atName)}
          </Badge>
        </p>
      </GlassPanel>

      <GlassPanel className="p-3">
        <strong className="text-[13px]">Open jobs (no guest names)</strong>
        {jobs.length === 0 ? (
          <EmptyState
            title="No open requests"
            description="Hotels and agents post needs Innora-wide."
          />
        ) : (
          <ul className="m-0 mt-2 list-none space-y-2 p-0">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="teal">{j.kind}</Badge>
                  <strong className="text-[13px]">{j.propertyName}</strong>
                </div>
                <p className="m-0 mt-1 text-[11px] text-[var(--hos-ink-3)]">
                  {j.windowFrom} → {j.windowTo} · {j.pax} pax · {j.languages} ·{" "}
                  {j.area}
                </p>
                <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-2)]">
                  {j.notesPublic || "—"}
                </p>
                <p className="m-0 mt-1 text-[10px] text-[var(--hos-ink-3)]">
                  Posted by {j.posterLabel} · guest details hidden until accept
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="!min-h-11 flex-1 !rounded-xl"
                    onClick={() => {
                      const res = acceptRequest(
                        j.id,
                        role === "guide"
                          ? { guideId: actorId }
                          : { vehicleId: actorId },
                      );
                      if (!res.ok) toast.error(res.error);
                      else toast.success("Job accepted");
                    }}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="!min-h-11 !rounded-xl"
                    onClick={() => {
                      const res = declineRequest(j.id);
                      if (!res.ok) toast.error(res.error);
                      else toast.message("Declined");
                    }}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>

      <GlassPanel className="p-3">
        <strong className="text-[13px]">Sell a room (opaque commission)</strong>
        <p className="m-0 mt-1 text-[11px] text-[var(--hos-ink-3)]">
          Guest pays hotel tariff only. Commission{" "}
          {effectiveCommissionPct(sellProp)}% split {settings.guideSharePct}/
          {settings.innoraSharePct} (guide/Innora) — never on guest bill.
        </p>
        <label className="mt-2 grid gap-1 text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
          Hotel
          <select
            value={sellProp}
            onChange={(e) => setSellProp(e.target.value)}
            className="hos-input !min-h-11 !rounded-xl !text-[13px]"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Guest name (internal only)"
          className="hos-input mt-2 !min-h-11 !rounded-xl"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
            Nights
            <input
              type="number"
              value={nights}
              onChange={(e) => setNights(Number(e.target.value) || 1)}
              className="hos-input !min-h-11 !rounded-xl"
            />
          </label>
          <label className="grid gap-1 text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
            Tariff net / night
            <input
              type="number"
              value={roomNet}
              onChange={(e) => setRoomNet(Number(e.target.value) || 0)}
              className="hos-input !min-h-11 !rounded-xl"
            />
          </label>
        </div>
        <Button
          className="hos-btn-ink mt-3 !min-h-12 w-full !rounded-xl font-bold"
          onClick={() => {
            const key = crypto.randomUUID();
            const res = createRoomReferral({
              referrerKind: role === "guide" ? "guide" : "driver",
              referrerId: actorId,
              referrerName: actorName,
              propertyId: sellProp,
              guestDisplay: guestName || "Guest",
              nights,
              roomNetBtn: roomNet,
              idempotencyKey: key,
            });
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            const acc = accrueReferral(res.referral.id);
            if (!acc.ok) toast.error(acc.error);
            else
              toast.success("Referral logged · guest tariff path", {
                description: `Your share ${formatNu(res.referral.guideAmountBtn)} (not on guest bill)`,
              });
          }}
        >
          Log sold stay (demo settle)
        </Button>
      </GlassPanel>

      <GlassPanel className="p-3">
        <strong className="text-[13px]">My commission (hidden from guest)</strong>
        {myEarnings.length === 0 ? (
          <p className="m-0 mt-2 text-[11px] text-[var(--hos-ink-3)]">
            No referrals yet.
          </p>
        ) : (
          <ul className="m-0 mt-2 list-none space-y-1.5 p-0 text-[12px]">
            {myEarnings.map((r) => (
              <li
                key={r.id}
                className="flex justify-between gap-2 rounded-lg border border-[var(--hos-line)] px-2.5 py-2"
              >
                <span>
                  {r.propertyName} · {r.nights}N · {r.status}
                </span>
                <span className="font-mono font-bold text-[var(--hos-emerald)]">
                  {formatNu(r.guideAmountBtn)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}

/** Demo session binding: first verified guide / first vehicle. */
export function defaultMarketplaceActor(role: Role): { id: string; name: string } {
  const extras = useExtrasStore.getState();
  if (role === "guide") {
    const g = extras.guides.find((x) => x.verified) ?? extras.guides[0];
    return { id: g?.id ?? "g1", name: g?.name ?? "Guide" };
  }
  const v = extras.vehicles[0];
  return { id: v?.id ?? "v1", name: v?.driver ?? "Driver" };
}
