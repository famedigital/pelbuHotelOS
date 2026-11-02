import { cn } from "@/lib/utils";
import { formatBtn } from "@/lib/pricing";

export function AgentStaysCreditCapsule({
  staysCount,
  roomNights,
  guestPax,
  quotedBtn,
  paidBtn,
  dueBtn,
  creditLimit,
  creditUsed,
  className,
}: {
  staysCount: number;
  roomNights: number;
  guestPax: number;
  quotedBtn: number;
  paidBtn: number;
  dueBtn: number;
  creditLimit: number;
  creditUsed: number;
  className?: string;
}) {
  const limit = Math.max(0, creditLimit);
  const used = Math.max(0, creditUsed);
  const pct =
    limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : used > 0 ? 100 : 0;
  const stressed = limit > 0 ? used / limit >= 0.85 : dueBtn > 0.5;

  return (
    <div
      className={cn(
        "neo-card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Booked stays
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
          {staysCount}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {roomNights} room-nights · {guestPax} pax
        </p>
      </div>
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Quoted vs settled
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
          {formatBtn(quotedBtn)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Paid {formatBtn(paidBtn)} · Due{" "}
          <span className={dueBtn > 0.5 ? "font-semibold text-amber-700" : ""}>
            {formatBtn(dueBtn)}
          </span>
        </p>
      </div>
      <div className="sm:col-span-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Credit facility
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatBtn(used)}
            <span className="font-normal text-muted-foreground">
              {" "}
              / {limit > 0 ? formatBtn(limit) : "—"}
            </span>
          </p>
        </div>
        <div className="neo-well mt-2 h-2.5" aria-hidden>
          <div
            className={cn(
              "h-full rounded-full",
              stressed ? "track-gradient-coral" : "track-gradient-mint",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {limit > 0
            ? `${pct}% of MoU credit used at this hotel`
            : "No credit limit set on this MoU link"}
        </p>
      </div>
    </div>
  );
}
