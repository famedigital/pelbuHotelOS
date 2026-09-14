import type { CmsContentSection } from "@/lib/cms";
import { CheckIcon } from "lucide-react";

export function CmsContentSections({
  sections,
  className = "",
}: {
  sections?: CmsContentSection[] | null;
  className?: string;
}) {
  if (!sections?.length) return null;

  return (
    <div className={`space-y-6 ${className}`}>
      {sections.map((section, index) => (
        <section
          key={`${section.heading}-${index}`}
          className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-white via-mist-1/45 to-mist-1/35 p-6 shadow-sm md:p-8"
        >
          <h2 className="font-display text-2xl leading-tight text-foreground md:text-3xl">
            {section.heading}
          </h2>
          {section.paragraphs.length ? (
            <div className="mt-4 max-w-3xl space-y-4 text-[15px] leading-7 text-muted-foreground">
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex}>{paragraph}</p>
              ))}
            </div>
          ) : null}
          {section.items.length ? (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-2.5 rounded-xl border border-cedar-rule/60 bg-white/75 px-3.5 py-3 text-sm leading-5 text-foreground"
                >
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-mist-1 text-juniper">
                    <CheckIcon className="size-3.5" aria-hidden />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}
