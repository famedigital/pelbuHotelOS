import Link from "next/link";
import { loadPublicRooms } from "@/lib/public-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rooms",
  description: "Guest rooms — hotel public site with mega navigation.",
};

export const dynamic = "force-dynamic";

/** Hotel guest chrome mount point (mega nav). Full booking UI may live elsewhere. */
export default async function PublicRoomsPage() {
  const rooms = await loadPublicRooms();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Rooms</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Hotel guest navigation uses the Stay / Menu mega menus above. Choose a
        category or book direct.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.length === 0 ? (
          <li className="rounded-xl border border-border px-4 py-6 text-sm text-muted-foreground">
            No sellable room types published yet.
          </li>
        ) : (
          rooms.map((room) => (
            <li
              key={room.id}
              className="rounded-xl border border-border p-4"
            >
              <p className="font-medium">{room.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {room.blurb?.trim() || room.code}
              </p>
              <Link
                href={`/rooms/${room.slug}`}
                className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
              >
                Details →
              </Link>
            </li>
          ))
        )}
      </ul>
      <p className="mt-10">
        <Link
          href="/book"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Book a stay
        </Link>
      </p>
    </div>
  );
}
