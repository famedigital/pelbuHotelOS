"use client";

import { sendGuestPackEmail } from "@/app/actions/guest-pack";
import { Button } from "@/components/ui/button";
import { formatBtn } from "@/lib/pricing";
import { useActionState, useRef } from "react";
import { useActionToast } from "@/hooks/use-action-toast";

export type GuestPackData = {
  propertyName: string;
  propertyPhone: string | null;
  propertyEmail: string | null;
  guestName: string;
  guestEmail: string | null;
  checkIn: string;
  checkOut: string;
  roomLabels: string[];
  mealPlanCode: string | null;
  policySummary: string | null;
  houseRules: string | null;
  dos: string | null;
  donts: string | null;
  wifiName: string | null;
  wifiPassword: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  damageItems: { label: string; amountBtn: number | null }[];
};

type EmailState = { ok: boolean; error?: string; message?: string };

const emailInitial: EmailState = { ok: false };

export function GuestPackPanel({
  bookingId,
  data,
}: {
  bookingId: string;
  data: GuestPackData;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [emailState, emailAction, emailPending] = useActionState(
    sendGuestPackEmail,
    emailInitial,
  );
  useActionToast(emailState, { successMessage: "Guest pack emailed" });

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
    if (!win) return;
    const safeName = data.guestName.replace(/[<>&"]/g, "");
    win.document.write(`
      <!DOCTYPE html><html><head><title>Guest pack — ${safeName}</title>
      <style>
        @page { size: A4; margin: 16mm 14mm; }
        * { box-sizing: border-box; }
        body {
          font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
          padding: 0; color: #1c1917; max-width: 720px; margin: 0 auto;
          line-height: 1.45;
        }
        .brand-bar {
          border-bottom: 3px solid #0ea5e9;
          padding-bottom: 12px; margin-bottom: 20px;
        }
        h1 { font-size: 1.5rem; margin: 0 0 4px; letter-spacing: -0.02em; color: #0c4a6e; }
        .eyebrow { font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase;
          color: #0ea5e9; font-weight: 700; margin: 0 0 6px; }
        h2 { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.14em;
          color: #57534e; margin: 22px 0 8px; border-bottom: 1px solid #e7e5e4; padding-bottom: 4px; }
        .muted { color: #57534e; font-size: 0.92rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
        td { padding: 6px 8px; border-bottom: 1px solid #f5f5f4; }
        td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
        .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e7e5e4;
          font-size: 0.75rem; color: #78716c; }
      </style></head><body>
        <div class="brand-bar">
          <p class="eyebrow">Welcome pack</p>
          ${content.innerHTML}
          <p class="footer">${data.propertyName} · present this pack at reception if needed</p>
        </div>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={handlePrint}>
          Print guest pack
        </Button>
        {data.guestEmail ? (
          <form action={emailAction}>
            <input type="hidden" name="booking_id" value={bookingId} />
            <Button type="submit" disabled={emailPending}>
              {emailPending ? "Sending…" : "Email guest pack"}
            </Button>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground self-center">
            Add guest email on booking to enable email.
          </p>
        )}
      </div>

      <div
        ref={printRef}
        className="rounded-lg border bg-card p-5 text-sm print:border-0 print:p-0"
      >
        <h1 className="text-lg font-semibold text-foreground">{data.propertyName}</h1>
        <p className="muted text-muted-foreground">Welcome, {data.guestName}</p>
        {(data.propertyPhone || data.propertyEmail) && (
          <p className="mt-2 text-muted-foreground">
            Desk{" "}
            {[data.propertyPhone, data.propertyEmail].filter(Boolean).join(" · ")}
          </p>
        )}

        <h2 className="mt-6 text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Your stay
        </h2>
        <p>
          {data.checkIn} → {data.checkOut}
          {data.roomLabels.length ? ` · ${data.roomLabels.join(", ")}` : ""}
          {data.mealPlanCode ? ` · Meal ${data.mealPlanCode}` : ""}
        </p>
        {(data.checkInTime || data.checkOutTime) && (
          <p className="text-muted-foreground">
            Check-in {data.checkInTime ?? "—"} · Check-out {data.checkOutTime ?? "—"}
          </p>
        )}
        {(data.wifiName || data.wifiPassword) && (
          <p className="mt-2">
            Wi‑Fi: {data.wifiName ?? "—"}
            {data.wifiPassword ? ` · Password: ${data.wifiPassword}` : ""}
          </p>
        )}

        {data.policySummary ? (
          <>
            <h2 className="mt-6 text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              Booking policy
            </h2>
            <p className="text-muted-foreground">{data.policySummary}</p>
          </>
        ) : null}

        {data.houseRules ? (
          <>
            <h2 className="mt-6 text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              House rules
            </h2>
            <p className="whitespace-pre-wrap text-muted-foreground">{data.houseRules}</p>
          </>
        ) : null}

        {data.dos ? (
          <>
            <h2 className="mt-6 text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              Please do
            </h2>
            <p className="whitespace-pre-wrap text-muted-foreground">{data.dos}</p>
          </>
        ) : null}

        {data.donts ? (
          <>
            <h2 className="mt-6 text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              Please don&apos;t
            </h2>
            <p className="whitespace-pre-wrap text-muted-foreground">{data.donts}</p>
          </>
        ) : null}

        {data.damageItems.length > 0 ? (
          <>
            <h2 className="mt-6 text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              Damage charges (indicative)
            </h2>
            <table className="mt-2 w-full">
              <tbody>
                {data.damageItems.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="text-right tabular-nums">
                      {row.amountBtn != null ? formatBtn(row.amountBtn) : "On assessment"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </div>
    </div>
  );
}
