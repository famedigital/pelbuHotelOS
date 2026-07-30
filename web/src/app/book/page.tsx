import { BookingWizard } from "@/components/book/BookingWizard";
import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Book | Pelbu Suites",
  description:
    "Reserve a room stay at Pelbu Suites Olakha, Thimphu — live rates, pick your room, hold instantly.",
  alternates: { canonical: "/book" },
};

export default function BookPage() {
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
      <BookingWizard />
    </EngineShell>
  );
}
