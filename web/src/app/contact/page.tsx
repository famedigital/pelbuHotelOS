import { ContactForm } from "@/components/contact/ContactForm";
import { ConversionShell } from "@/components/site/ConversionShell";

export const metadata = {
  title: "Contact | Pelbu Suites",
  description:
    "Contact Pelbu Suites front desk in Olakha, Thimphu — rooms, dining, spa, meeting, and travel agent enquiries.",
};

export default function ContactPage() {
  return (
    <ConversionShell
      eyebrow="Contact"
      title="Talk to the Olakha desk."
      body="Rooms, cafe, spa, meeting hall, or a trade partnership — send a message and we reply by phone, WhatsApp, or email. The form is the fastest route in; agents get a dedicated partner application."
      aside={
        <div className="space-y-8 text-sm text-muted">
          <div className="space-y-3">
            <p className="text-xs tracking-[0.2em] text-gold uppercase">
              Skip the form
            </p>
            <ul className="space-y-2.5 text-espresso/80">
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-gold/70" />
                <span>
                  <a
                    href="/book"
                    className="text-gold underline-offset-4 hover:underline"
                  >
                    Book a stay
                  </a>{" "}
                  — pick dates and we confirm rate and room.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-gold/70" />
                <span>
                  <a
                    href="/order"
                    className="text-gold underline-offset-4 hover:underline"
                  >
                    Order cafe &amp; pastry
                  </a>{" "}
                  — pickup or taxi across Thimphu.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-gold/70" />
                <span>
                  <a
                    href="/agents"
                    className="text-gold underline-offset-4 hover:underline"
                  >
                    Apply as travel agent
                  </a>{" "}
                  — license review and rate tiers.
                </span>
              </li>
            </ul>
          </div>

          <p className="border-t border-espresso/10 pt-4 leading-relaxed">
            Pelbu Suites · Olakha, Thimphu, Bhutan. We respond during front-desk
            hours; for after-hours urgency, leave a note in your message and we
            triage first thing.
          </p>
        </div>
      }
    >
      <ContactForm />
    </ConversionShell>
  );
}
