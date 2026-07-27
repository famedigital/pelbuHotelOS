import { ServiceRequestForm } from "@/components/services/ServiceRequestForm";
import { ConversionShell } from "@/components/site/ConversionShell";

export const metadata = {
  title: "Meeting Hall | Pelbu Suites",
  description:
    "A focused meeting hall for up to 25 people at Pelbu Suites, Olakha Thimphu — board briefings, training, and small events with catering via the café on request.",
};

export default function MeetingPage() {
  return (
    <ConversionShell
      eyebrow="Meeting"
      title="Up to 25 guests. Focused, on time, well set."
      body="A single premium hall with board and briefing layouts — comfortable chairs, proper tables, and the café next door for tea breaks and catering. Send your preferred date and we confirm within business hours."
      aside={
        <div className="space-y-6 text-sm text-muted">
          <div className="space-y-3">
            <p className="text-xs tracking-[0.2em] text-gold uppercase">
              The hall
            </p>
            <ul className="space-y-2 text-espresso/80">
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-gold/70" />
                Capacity up to 25 guests
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-gold/70" />
                Board, classroom, or briefing layout
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-gold/70" />
                Catering and tea breaks via the in-house café
              </li>
            </ul>
          </div>

          <div className="border-t border-espresso/10 pt-5">
            <p className="text-xs tracking-[0.2em] text-gold uppercase">
              What to send
            </p>
            <p className="mt-2 leading-relaxed text-espresso/80">
              Date, start time, and guest count — plus any AV, seating, or
              catering notes. We reply with a confirmed quote and layout.
            </p>
          </div>

          <p className="leading-relaxed pt-1">
            Need rooms for delegates?{" "}
            <a
              href="/book"
              className="text-gold underline-offset-4 hover:underline"
            >
              Reserve stays
            </a>{" "}
            or ask your{" "}
            <a
              href="/agents"
              className="text-gold underline-offset-4 hover:underline"
            >
              agent partner
            </a>
            .
          </p>
        </div>
      }
    >
      <ServiceRequestForm kind="meeting" />
    </ConversionShell>
  );
}
