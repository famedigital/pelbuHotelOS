import { BookingDetailPanel } from "@/components/erp/BookingDetailPanel";
import { GuestPackPanel, type GuestPackData } from "@/components/erp/GuestPackPanel";
import { DeskListShell, StatusPill } from "@/components/erp/DeskListShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadBookingDetail } from "@/lib/booking-detail";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/erp-lists";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Booking | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function BookingDetailPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const data = await loadBookingDetail(admin, propertyId, id);

  if (!data) notFound();

  const status = data.status;

  const [property, policyRow, damageRows] = await Promise.all([
    loadProperty(admin, propertyId),
    admin
      .from("property_policies")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle(),
    admin
      .from("property_damage_items")
      .select("label, amount_btn")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const guestPackData: GuestPackData = {
    propertyName: property?.name ?? "Pelbu Suites",
    propertyPhone: property?.phone ?? null,
    propertyEmail: property?.email ?? null,
    guestName: data.contact_name ?? "Guest",
    guestEmail: data.contact_email,
    checkIn: data.check_in,
    checkOut: data.check_out,
    roomLabels: data.room_labels,
    mealPlanCode: data.meal_plan_code,
    policySummary: policyRow.data?.guest_summary as string | null,
    houseRules: policyRow.data?.house_rules as string | null,
    dos: policyRow.data?.dos as string | null,
    donts: policyRow.data?.donts as string | null,
    wifiName: policyRow.data?.wifi_name as string | null,
    wifiPassword: policyRow.data?.wifi_password as string | null,
    checkInTime: policyRow.data?.check_in_time as string | null,
    checkOutTime: policyRow.data?.check_out_time as string | null,
    damageItems: (damageRows.data ?? []).map((d) => ({
      label: d.label as string,
      amountBtn: d.amount_btn == null ? null : Number(d.amount_btn),
    })),
  };

  return (
    <DeskListShell
      eyebrow="Booking"
      heading={data.contact_name ?? "Guest"}
      blurb={`${data.check_in} → ${data.check_out} · ${data.rooms} room(s) · ${data.adults} pax`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill value={status} />
        {data.is_mou_agent ? (
          <span className="inline-flex items-center rounded-full border border-citrus/40 bg-citrus-tint/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-citrus">
            MoU — free cancel
          </span>
        ) : null}
        <span className="font-mono text-xs text-muted-foreground">{data.id}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="ghost">
          <Link href="/erp/reservations">Back to reservations</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/erp/calendar">Room rack</Link>
        </Button>
      </div>

      <BookingDetailPanel data={data} showDossierLink={false} />

      {["checked_in", "checked_out"].includes(status) ? (
        <Card>
          <CardHeader>
            <CardTitle>Guest check-in pack</CardTitle>
            <CardDescription>
              Rules, do&apos;s/don&apos;ts, and damage prices from Settings →
              Policies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GuestPackPanel bookingId={data.id} data={guestPackData} />
          </CardContent>
        </Card>
      ) : null}
    </DeskListShell>
  );
}
