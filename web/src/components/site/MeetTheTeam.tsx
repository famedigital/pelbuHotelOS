import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { Button } from "@/components/ui/button";
import type { PublicTeamMember } from "@/lib/property-media-loader";

export function MeetTheTeam({ members }: { members: PublicTeamMember[] }) {
  if (members.length === 0) return null;

  return (
    <section className="border-t border-border bg-sky-50/40 py-14 md:py-16">
      <div className="mx-auto max-w-[1120px] px-5 md:px-8">
        <p className="text-sm font-medium text-sky-700">Meet the team</p>
        <h2 className="mt-2 font-display text-3xl text-foreground md:text-4xl">
          People you can message.
        </h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Real staff from Pelbu Suites — not stock models. Reach them on WhatsApp
          for bookings, dining, or a quick question.
        </p>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <li
              key={m.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="relative aspect-[4/5] bg-muted">
                {m.portraitPublicId ? (
                  <CloudinaryImage
                    publicId={m.portraitPublicId}
                    alt={m.name}
                    fill
                    sizes="33vw"
                    imgClassName="object-cover object-top"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                    Photo coming soon
                  </div>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <p className="font-semibold text-foreground">{m.name}</p>
                  <p className="text-sm text-muted-foreground">{m.roleLabel}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.whatsappUrl ? (
                    <Button asChild size="sm" variant="citrus">
                      <a
                        href={m.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp
                      </a>
                    </Button>
                  ) : null}
                  {m.phone ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={`tel:${m.phone.replace(/\s/g, "")}`}>Call</a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
