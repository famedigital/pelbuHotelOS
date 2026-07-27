import { BookingForm } from "@/components/book/BookingForm";
import { ConversionShell } from "@/components/site/ConversionShell";

export const metadata = {
  title: "Book | Pelbu Suites",
  description:
    "Request a room stay at Pelbu Suites Olakha, Thimphu — direct guest booking.",
};

export default function BookPage() {
  return (
    <ConversionShell
      eyebrow="Book"
      title="Reserve your stay."
      body="Tell us your dates and we confirm availability. Agents use the partner desk for guide number, SDF, and credit terms."
      aside={
        <div className="space-y-4 text-sm text-muted">
          <p className="text-xs tracking-[0.2em] text-gold uppercase">How it works</p>
          <ol className="list-decimal space-y-3 pl-4 text-espresso/80">
            <li>Send dates, guests, and a phone we can reach.</li>
            <li>Desk confirms rate and room type.</li>
            <li>Pay on arrival or by bank transfer when confirmed.</li>
          </ol>
          <p className="pt-2 leading-relaxed">
            Guide and driver complimentary beds are arranged at check-in when
            traveling with a licensed Bhutanese guide.
          </p>
        </div>
      }
    >
      <BookingForm />
    </ConversionShell>
  );
}
