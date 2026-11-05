import { loadPublicRooms } from "@/lib/public-content";
import { PublicBookingStudio } from "@/components/book/PublicBookingStudio";
import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Direct Room Reservation · Hotel Public Site",
  description: "Book your stay directly in Bhutanese Ngultrum (BTN). Select meal plans (EP, CP, MAP, AP) and settle via Bhutan RMA QR or at the front desk.",
};

export const dynamic = "force-dynamic";

export default async function PublicBookPage({
  searchParams,
}: {
  searchParams?: Promise<{ room?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const rooms = await loadPublicRooms();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
      <div className="mb-8">
        <Link
          href="/rooms"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>Browse All Rooms</span>
        </Link>
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-[11px] font-semibold text-primary">
              <Sparkles className="size-3" />
              <span>Direct Booking Advantage</span>
            </span>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Reserve Your Stay
            </h1>
          </div>
          <p className="max-w-md text-xs sm:text-sm text-muted-foreground">
            No booking fees. Guaranteed early check-in subject to availability. Direct RMA Bhutan QR or pay on arrival.
          </p>
        </div>
      </div>

      <PublicBookingStudio rooms={rooms} initialRoomCode={params.room} />
    </div>
  );
}
