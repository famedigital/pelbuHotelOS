import { Star, Quote } from "lucide-react";

type Testimonial = {
  quote: string;
  author: string;
  title: string;
  property: string;
  location: string;
  badge: string;
  metric: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Before Hotel OS, night audit was a two-hour ordeal with paper ledgers and calculators. Now our night auditor rolls the business date in one click, and gapless DRC tax invoices are filed automatically.",
    author: "Dorji Penjor",
    title: "General Manager",
    property: "Pelbu Suites",
    location: "Thimphu",
    badge: "Boutique Heritage",
    metric: "Night Audit cut from 2 hrs to 3 mins",
  },
  {
    quote:
      "When the Tourism Department (DOT) inspector came for our 3-Star classification, we simply opened the built-in checklist. Fire safety, food licenses, and room specs were 100% verified. We passed with zero remarks.",
    author: "Sonam Choden",
    title: "Operations Director",
    property: "Paro Valley Haven",
    location: "Paro",
    badge: "DOT 3-Star Certified",
    metric: "100% Audit Compliance Score",
  },
  {
    quote:
      "We run 18 bilateral MoU agreements with tour operators across Bhutan. Having an automated B2B agent portal with city ledger credit tracking eliminated all payment disputes at checkout.",
    author: "Tashi Wangdi",
    title: "Managing Partner",
    property: "Punakha Riverside Lodge",
    location: "Punakha",
    badge: "Group Tour Operations",
    metric: "Zero Booking Disputes with Agents",
  },
];

export function BhutanTestimonials() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {TESTIMONIALS.map((t) => (
        <div
          key={t.author}
          className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card/70 p-6 shadow-xl backdrop-blur-xl"
        >
          {/* Specular Top Rim */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/20"
            aria-hidden
          />

          <div>
            {/* Header with Location & Stars */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                {t.badge}
              </span>
              <div className="flex text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="size-3.5 fill-current" />
                ))}
              </div>
            </div>

            {/* Quote Body */}
            <div className="mt-4 relative">
              <Quote className="size-6 text-muted-foreground/20 absolute -top-1 -left-1" />
              <p className="relative z-10 text-xs sm:text-sm text-foreground leading-relaxed pl-3 italic">
                &ldquo;{t.quote}&rdquo;
              </p>
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="mt-6 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-xs text-foreground">{t.author}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t.title} · {t.property}, {t.location}
                </p>
              </div>

              <div className="text-right">
                <span className="inline-block rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {t.metric}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
