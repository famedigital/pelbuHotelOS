/**
 * Optional FO ops after a guide is attached to a hotel group — not the marketplace.
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState } from "@hos-v2/ui";
import { useEcosystemStore } from "../../lib/ecosystem-store";
import {
  groupMembers,
  useFrontOfficeStore,
  ymd,
} from "../../lib/front-office-store";

export function GuideAssignmentOps() {
  const [, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const groupMeta = useFrontOfficeStore((s) => s.groupMeta);
  const stays = useFrontOfficeStore((s) => s.stays);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const guideGroupId = useEcosystemStore((s) => s.guideGroupId);
  const setGuideGroupId = useEcosystemStore((s) => s.setGuideGroupId);
  const boxBreakfastQty = useEcosystemStore((s) => s.boxBreakfastQty);
  const setBoxBreakfastQty = useEcosystemStore((s) => s.setBoxBreakfastQty);
  const syncBreakfastQtyFromRoster = useEcosystemStore(
    (s) => s.syncBreakfastQtyFromRoster,
  );
  const dietBadge = useEcosystemStore((s) => s.dietBadge);
  const orderBoxBreakfast = useEcosystemStore((s) => s.orderBoxBreakfast);
  const checkInArrival = useEcosystemStore((s) => s.checkInArrival);
  const healGuideRoster = useEcosystemStore((s) => s.healGuideRoster);
  const driverForGroup = useEcosystemStore((s) => s.driverForGroup);

  const today = businessDate || ymd(new Date());
  const meta = groupMeta[guideGroupId];
  const driver = driverForGroup(guideGroupId);

  useEffect(() => {
    healGuideRoster();
    syncBreakfastQtyFromRoster();
  }, [guideGroupId, healGuideRoster, syncBreakfastQtyFromRoster]);

  const roster = useMemo(
    () => groupMembers(stays, guideGroupId),
    [stays, guideGroupId],
  );

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-dashed border-[var(--hos-line)] p-3">
      <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
        Assignment ops — only after you are linked to a hotel group. Marketplace
        matching is above.
      </p>
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {Object.values(groupMeta).map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGuideGroupId(g.id)}
            className={[
              "min-h-11 shrink-0 rounded-xl px-3 text-[12px] font-bold",
              guideGroupId === g.id
                ? "bg-[#111] text-white"
                : "border border-[var(--hos-line)]",
            ].join(" ")}
          >
            {g.code}
          </button>
        ))}
      </div>
      <p className="m-0 text-[12px] text-[var(--hos-ink-2)]">
        {meta?.guideName} · Driver {driver.name} · {today}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setBoxBreakfastQty(boxBreakfastQty - 1)}
        >
          −
        </Button>
        <span className="font-mono font-bold">{boxBreakfastQty}</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setBoxBreakfastQty(boxBreakfastQty + 1)}
        >
          +
        </Button>
        <Button
          size="sm"
          disabled={busyId === "bf"}
          onClick={() => {
            setBusyId("bf");
            start(() => {
              void orderBoxBreakfast().then((res) => {
                setBusyId(null);
                if (!res.ok) toast.error(res.error);
                else toast.success(`KDS · ${res.qty} boxes`);
              });
            });
          }}
        >
          Breakfast → KDS
        </Button>
      </div>
      {roster.length === 0 ? (
        <EmptyState
          title="No roster"
          description="Accept a marketplace job and attach to a group first."
        />
      ) : (
        <ul className="m-0 list-none space-y-1.5 p-0">
          {roster.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--hos-line)] px-2.5 py-2 text-[12px]"
            >
              <span>
                {s.guestName}{" "}
                {dietBadge(s) ? <Badge tone="vip">{dietBadge(s)}</Badge> : null}
              </span>
              {["confirmed", "held"].includes(s.status) && s.roomId ? (
                <Button
                  size="sm"
                  onClick={() => {
                    void checkInArrival(s.id).then((res) => {
                      if (!res.ok) toast.error(res.error);
                      else toast.success("Checked in");
                    });
                  }}
                >
                  CI
                </Button>
              ) : (
                <Badge tone="muted">{s.status}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
