import {
  DeskListShell,
  DeskTable,
} from "@/components/erp/DeskListShell";
import {
  RateApproveForm,
  RateRejectForm,
} from "@/components/erp/RateApprovalActions";
import { Button } from "@/components/ui/button";
import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Rate approvals | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

export default async function RateApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const role = await getDeskRole();
  if (role !== "owner" && role !== "gm") {
    redirect("/erp");
  }

  const sp = await searchParams;
  const raw = (sp.status ?? "pending").toLowerCase();
  const statusFilter: StatusFilter =
    raw === "approved" || raw === "rejected" || raw === "all"
      ? raw
      : "pending";

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  let lineQuery = admin
    .from("booking_rooms")
    .select(
      `id, qty, meal_plan_code, occupancy, adults, children,
       sheet_nightly_rate_btn, agreed_nightly_rate_btn,
       rate_request_status, rate_request_reason,
       room_types(name, code),
       bookings!inner(
         id, property_id, contact_name, check_in, check_out, status,
         confirmation_code
       )`,
    )
    .eq("bookings.property_id", propertyId)
    .not("rate_request_status", "eq", "none")
    .order("id", { ascending: false })
    .limit(200);

  if (statusFilter !== "all") {
    lineQuery = lineQuery.eq("rate_request_status", statusFilter);
  }

  const { data: rows } = await lineQuery;

  const tabs: { id: StatusFilter; label: string }[] = [
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "all", label: "All" },
  ];

  return (
    <DeskListShell
      eyebrow="Front desk"
      heading="Rate approvals"
      blurb="Custom category rates from New booking — approve to confirm the hold."
      headerAside={
        <Button asChild variant="outline" className="h-8 text-xs">
          <Link href="/erp/reservations">Reservations</Link>
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <Button
            key={t.id}
            asChild
            size="sm"
            variant={statusFilter === t.id ? "secondary" : "ghost"}
            className="h-7 text-xs"
          >
            <Link
              href={
                t.id === "pending"
                  ? "/erp/rate-approvals"
                  : `/erp/rate-approvals?status=${t.id}`
              }
            >
              {t.label}
            </Link>
          </Button>
        ))}
      </div>

      <DeskTable
        caption="Rate approval queue"
        headers={[
          "Guest / stay",
          "Category",
          "Sheet",
          "Requested",
          "Reason",
          "Status",
          "Actions",
        ]}
      >
          {(rows ?? []).length === 0 ? (
            <tr>
              <td colSpan={7} className="text-muted-foreground">
                No rate requests in this filter.
              </td>
            </tr>
          ) : (
            (rows ?? []).map((row) => {
              const bookingRaw = row.bookings as
                | {
                    id?: string;
                    contact_name?: string | null;
                    check_in?: string;
                    check_out?: string;
                    status?: string;
                    confirmation_code?: string | null;
                  }
                | {
                    id?: string;
                    contact_name?: string | null;
                    check_in?: string;
                    check_out?: string;
                    status?: string;
                    confirmation_code?: string | null;
                  }[]
                | null;
              const booking = Array.isArray(bookingRaw)
                ? bookingRaw[0]
                : bookingRaw;
              const rtRaw = row.room_types as
                | { name?: string; code?: string }
                | { name?: string; code?: string }[]
                | null;
              const rt = Array.isArray(rtRaw) ? rtRaw[0] : rtRaw;
              const sheet =
                row.sheet_nightly_rate_btn != null
                  ? Number(row.sheet_nightly_rate_btn)
                  : null;
              const agreed =
                row.agreed_nightly_rate_btn != null
                  ? Number(row.agreed_nightly_rate_btn)
                  : null;
              const st = (row.rate_request_status as string) ?? "—";
              const bookingId = booking?.id ?? "";
              return (
                <tr key={row.id as string}>
                  <td>
                    <div className="font-medium">
                      {booking?.contact_name ?? "Guest"}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {(booking?.check_in ?? "").slice(0, 10)} →{" "}
                      {(booking?.check_out ?? "").slice(0, 10)}
                      {booking?.confirmation_code
                        ? ` · ${booking.confirmation_code}`
                        : ""}
                      {booking?.status ? ` · ${booking.status}` : ""}
                    </div>
                  </td>
                  <td>
                    {rt?.name ?? "Room"}
                    <span className="text-muted-foreground">
                      {" "}
                      · ×{Number(row.qty ?? 1)}
                    </span>
                  </td>
                  <td className="tabular-nums">
                    {sheet != null ? formatBtn(sheet) : "—"}
                  </td>
                  <td className="tabular-nums font-medium">
                    {agreed != null ? formatBtn(agreed) : "—"}
                  </td>
                  <td className="max-w-[12rem] truncate text-xs text-muted-foreground">
                    {(row.rate_request_reason as string | null) ?? "—"}
                  </td>
                  <td className="capitalize text-xs">{st}</td>
                  <td>
                    {st === "pending" && bookingId ? (
                      <div className="flex min-w-[14rem] flex-col gap-1.5">
                        <RateApproveForm
                          bookingId={bookingId}
                          bookingRoomId={row.id as string}
                        />
                        <RateRejectForm
                          bookingId={bookingId}
                          bookingRoomId={row.id as string}
                        />
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })
          )}
      </DeskTable>
    </DeskListShell>
  );
}
