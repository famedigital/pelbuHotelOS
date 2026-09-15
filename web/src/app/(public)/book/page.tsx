import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book",
  description: "Book a stay — hotel public site.",
};

export default function PublicBookStubPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Book a stay</h1>
      <p className="mt-3 text-muted-foreground">
        Booking flow mounts on the hotel public chrome (mega menu above). Full
        availability widget ships with the website booking API.
      </p>
      <Link
        href="/rooms"
        className="mt-8 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        ← Browse rooms
      </Link>
    </div>
  );
}
