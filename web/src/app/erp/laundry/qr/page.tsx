import type { Metadata } from "next";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { LaundryQrPrintButton } from "@/components/laundry/LaundryQrPrintButton";
import { Button } from "@/components/ui/button";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { absoluteUrl } from "@/lib/site";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Laundry QR cards | Hotel OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LaundryQrPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const { data: rooms } = await admin
    .from("room_units")
    .select("id, label, floor_label, sort_order")
    .eq("property_id", propertyId)
    .order("sort_order")
    .order("label");
  const sharedUrl = absoluteUrl("/laundry");
  const sharedQr = await QRCode.toDataURL(sharedUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 520,
  });
  const roomCards = await Promise.all(
    (rooms ?? []).map(async (room) => {
      const url = absoluteUrl(
        `/laundry?room=${encodeURIComponent(room.label as string)}`,
      );
      return {
        id: room.id as string,
        label: room.label as string,
        floor: (room.floor_label as string | null) ?? null,
        url,
        qr: await QRCode.toDataURL(url, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 520,
        }),
      };
    }),
  );
  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Guest laundry
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Printable QR cards</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the shared card at reception or print prefilled cards for rooms.
            Guests must still verify their full name.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/erp/laundry">Back to laundry</Link>
          </Button>
          <LaundryQrPrintButton />
        </div>
      </div>

      <section className="grid gap-5 sm:grid-cols-2 print:grid-cols-2">
        <QrCard
          title="Reception"
          subtitle="Shared guest laundry access"
          qr={sharedQr}
          url={sharedUrl}
        />
        {roomCards.map((card) => (
          <QrCard
            key={card.id}
            title={`Room ${card.label}`}
            subtitle={card.floor ? `${card.floor} · Guest laundry` : "Guest laundry"}
            qr={card.qr}
            url={card.url}
          />
        ))}
      </section>
    </div>
  );
}

function QrCard({
  title,
  subtitle,
  qr,
  url,
}: {
  title: string;
  subtitle: string;
  qr: string;
  url: string;
}) {
  return (
    <article className="break-inside-avoid rounded-3xl border bg-white p-6 text-center text-neutral-950 shadow-sm print:shadow-none">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">
        Pelbu Suites
      </p>
      <h2 className="mt-2 text-2xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qr}
        alt={`QR code for ${title} laundry`}
        className="mx-auto mt-4 size-64 max-w-full"
      />
      <p className="mt-3 text-sm font-semibold">Scan to request collection</p>
      <p className="mt-1 text-xs text-neutral-600">
        Verify with your check-in name and room. No guest list is shown.
      </p>
      <p className="mt-3 break-all font-mono text-[9px] text-neutral-500">
        {url}
      </p>
    </article>
  );
}
