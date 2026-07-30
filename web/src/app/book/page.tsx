import { BookingWizard } from "@/components/book/BookingWizard";
import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";
import { parseStaySearch } from "@/lib/stay-dates";

export const metadata = {
  title: "Book | Pelbu Suites",
  description:
    "Reserve a room stay at Pelbu Suites Olakha, Thimphu — live rates, pick your room, hold instantly.",
  alternates: { canonical: "/book" },
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
  const params = await searchParams;
  const initialStay = parseStaySearch({
    checkIn: first(params.checkIn),
    checkOut: first(params.checkOut),
    adults: first(params.adults),
    rooms: first(params.rooms),
  });

  return (
    <EngineShell
      eyebrow="Direct booking"
      title="Choose your stay."
      description="Set dates or nights, compare live room rates, and choose an available meal plan. Your rooms are held while the desk confirms payment."
      actions={
        <Button asChild variant="outline">
          <a href="/rooms">Compare rooms</a>
        </Button>
      }
    >
      <BookingWizard initialStay={initialStay} />
    </EngineShell>
  );
}
