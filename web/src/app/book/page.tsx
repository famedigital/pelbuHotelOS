import { BookingCheckoutShell } from "@/components/book/BookingCheckoutShell";
import { BookingWizard } from "@/components/book/BookingWizard";
import { resolveLogoSrc } from "@/lib/logo-src";
import { loadPublicPropertyProfile } from "@/lib/public-property";
import { parseStaySearch } from "@/lib/stay-dates";

export const metadata = {
  title: "Book | Pelbu Suites",
  description:
    "Reserve a room stay at Pelbu Suites Olakha, Thimphu — live rates, pick your room, hold instantly.",
  alternates: { canonical: "/book" },
  robots: { index: false, follow: true },
};

type BookSearchParams = {
  checkIn?: string | string[];
  checkOut?: string | string[];
  adults?: string | string[];
  rooms?: string | string[];
};

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<BookSearchParams>;
}) {
  const [params, property] = await Promise.all([
    searchParams,
    loadPublicPropertyProfile(),
  ]);

  const initialStay = parseStaySearch({
    checkIn: first(params.checkIn),
    checkOut: first(params.checkOut),
    adults: first(params.adults),
    rooms: first(params.rooms),
  });

  return (
    <BookingCheckoutShell
      phone={property?.phone}
      logoSrc={resolveLogoSrc(property?.logoPublicId)}
    >
      <BookingWizard initialStay={initialStay} />
    </BookingCheckoutShell>
  );
}
