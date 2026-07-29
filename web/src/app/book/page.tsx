import { BookingWizard } from "@/components/book/BookingWizard";
import { ConversionShell } from "@/components/site/ConversionShell";

export const metadata = {
  title: "Book | Pelbu Suites",
  description:
    "Reserve a room stay at Pelbu Suites Olakha, Thimphu — live rates, pick your room, hold instantly.",
};

export default function BookPage() {
  return (
    <ConversionShell
      eyebrow="Book"
      title="Reserve your stay."
      body="See live rates, pick your room type, and we hold the rooms instantly. A token confirms the booking once your bank transfer arrives."
      aside={
        <div className="space-y-5 text-sm text-muted-foreground">
          <p className="text-sm font-medium text-ink">How it works</p>
          <ol className="list-decimal space-y-3 pl-4 text-ink/80">
            <li>Pick dates and party — see live public rates per room type.</li>
            <li>Choose a room type and enter your contact.</li>
            <li>
              We hold the rooms and email you a pay link. Desk confirms once the
              token money arrives.
            </li>
          </ol>
          <p className="border-t border-border pt-5 leading-relaxed">
            Guide and driver complimentary beds are arranged at check-in when
            traveling with a licensed Bhutanese guide.
          </p>
        </div>
      }
    >
      <BookingWizard />
    </ConversionShell>
  );
}
