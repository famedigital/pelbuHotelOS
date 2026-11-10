import Link from "next/link";
import { loadPublicRooms } from "@/lib/public-content";
import type { Metadata } from "next";
import { ArrowRight, Bed, Sparkles, Wifi, Flame, Mountain } from "lucide-react";

export const metadata: Metadata = {
  title: "Accommodations & Suites · Hotel Public Site",
  description: "Browse luxury rooms and heritage suites with mountain views. Book direct in BTN.",
};

export const dynamic = "force-dynamic";

export default async function PublicRoomsPage() {
  const rooms = await loadPublicRooms();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-border/80 pb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3" />
            <span>Kingdom of Bhutan Boutique Stay</span>
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Rooms & Suites
          </h1>
        </div>
        <p className="max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Traditional Bhutanese timber architecture blended with modern hospitality comfort.
          Direct reservations receive complimentary high-speed WiFi and welcome butter tea (Suja).
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <Bed className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-semibold text-foreground">No sellable rooms configured yet</p>
            <p className="mt-1 text-xs">Configure your room categories in the Front Desk ERP inventory.</p>
          </div>
        ) : (
          rooms.map((room) => {
            const imgSrc = room.imageSrc || "/marketing/places/room.png";

            return (
              <div
                key={room.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card/70 shadow-lg backdrop-blur-xl transition-all duration-200 hover:border-primary/40 hover:-translate-y-1"
              >
                {/* Room Image Banner */}
                <div className="relative h-48 w-full overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc}
                    alt={room.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2.5 py-1 text-[11px] font-mono font-semibold text-white backdrop-blur-md">
                    {room.code}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="font-display text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                      {room.name}
                    </h2>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {room.blurb?.trim() || "Spacious bedroom featuring traditional pine woodwork, plush bedding, and private en-suite bathroom."}
                    </p>

                    {/* Amenity Badges */}
                    <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                        <Mountain className="size-3 text-emerald-500" />
                        Valley View
                      </span>
                      <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                        <Flame className="size-3 text-amber-500" />
                        Bukhari Heater
                      </span>
                      <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                        <Wifi className="size-3 text-sky-500" />
                        High-Speed WiFi
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 border-t border-border/60 pt-4 flex items-center justify-between">
                    <Link
                      href={`/rooms/${room.slug}`}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View Details →
                    </Link>

                    <Link
                      href={`/book?room=${encodeURIComponent(room.code)}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
                    >
                      <span>Book Direct</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-14 rounded-2xl border border-border/80 bg-secondary/50 p-6 sm:p-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">
            Traveling with a Tour Group or Planning an Event?
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Contact our reservations team directly for bilateral MoU travel agent rates, driver accommodations, and banquet packages.
          </p>
        </div>
        <Link
          href="/book"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition hover:bg-primary/90"
        >
          <span>Reserve A Stay</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
