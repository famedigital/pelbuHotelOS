import { ServiceRequestForm } from "@/components/services/ServiceRequestForm";
import { ConversionShell } from "@/components/site/ConversionShell";

export const metadata = {
  title: "Spa & Steam | Pelbu Suites",
  description:
    "Book a spa treatment or steam session at Pelbu Suites, Olakha Thimphu — open to hotel guests and day visitors. Request a slot online and we confirm with the desk.",
};

export default function SpaPage() {
  return (
    <ConversionShell
      eyebrow="Spa & Steam"
      title="Slow down. Restore after the road."
      body="Massage, bodywork and steam at Pelbu Suites, Olakha. Open to in-house guests and day visitors — tell us your preferred slot and we confirm availability with the therapist. In-house guests can settle at checkout on the room folio."
      aside={
        <div className="space-y-6 text-sm text-muted">
          <div className="space-y-3">
            <p className="text-xs tracking-[0.2em] text-gold uppercase">
              Good to know
            </p>
            <ul className="space-y-2 text-espresso/80">
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-gold/70" />
                Rates are confirmed by the desk — not locked in this form
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-gold/70" />
                In-house guests may charge treatments to the room folio
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-gold/70" />
                Massage and steam slots depend on therapist availability
              </li>
            </ul>
          </div>

          <div className="border-t border-espresso/10 pt-5">
            <p className="text-xs tracking-[0.2em] text-gold uppercase">
              For day visitors
            </p>
            <p className="mt-2 leading-relaxed text-espresso/80">
              Not staying with us? You are welcome — simply leave the room
              reference blank and settle at the desk on the day.
            </p>
          </div>

          <p className="leading-relaxed pt-1">
            Staying overnight?{" "}
            <a
              href="/book"
              className="text-gold underline-offset-4 hover:underline"
            >
              Reserve your room
            </a>{" "}
            first, then note the reference here.
          </p>
        </div>
      }
    >
      <ServiceRequestForm kind="spa" />
    </ConversionShell>
  );
}
