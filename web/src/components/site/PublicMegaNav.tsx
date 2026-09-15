"use client";

import { cloudinaryUrl } from "@/lib/cloudinary";
import type { MegaMenu } from "@/lib/mega-menu";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

function thumbSrc(publicId?: string): string | null {
  if (!publicId?.trim()) return null;
  return cloudinaryUrl(publicId, { width: 160, height: 120, crop: "fill" });
}

export function PublicMegaNav({ menus }: { menus: MegaMenu[] }) {
  const pathname = usePathname();
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    setOpenLabel(null);
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className="hidden items-center gap-1 xl:flex" aria-label="Hotel">
        {menus.map((menu) => {
          const isOpen = openLabel === menu.label;
          return (
            <div
              key={menu.label}
              className="relative"
              onMouseEnter={() => setOpenLabel(menu.label)}
              onMouseLeave={() => setOpenLabel(null)}
            >
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-foreground/80 transition hover:text-foreground",
                  isOpen && "text-foreground",
                )}
                aria-expanded={isOpen}
                aria-controls={`${panelId}-${menu.label}`}
                onClick={() => setOpenLabel(isOpen ? null : menu.label)}
              >
                {menu.label}
                <ChevronDownIcon className="size-3.5 opacity-70" />
              </button>
              {isOpen ? (
                <div
                  id={`${panelId}-${menu.label}`}
                  className="absolute left-1/2 top-full z-40 w-[min(920px,92vw)] -translate-x-1/2 pt-2"
                >
                  <div className="grid gap-6 rounded-xl border border-border bg-background p-6 shadow-lg md:grid-cols-[1.4fr_0.7fr_0.9fr]">
                    <div className="space-y-5">
                      {menu.primary.map((group) => (
                        <div key={group.heading}>
                          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                            {group.heading}
                          </p>
                          <ul className="mt-3 space-y-2">
                            {group.items.map((item) => {
                              const src = thumbSrc(item.publicId);
                              return (
                                <li key={`${item.href}-${item.title}`}>
                                  <Link
                                    href={item.href}
                                    className="flex gap-3 rounded-lg p-2 transition hover:bg-muted/70"
                                    onClick={() => setOpenLabel(null)}
                                  >
                                    {src ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={src}
                                        alt=""
                                        className="size-14 shrink-0 rounded-md object-cover"
                                        width={56}
                                        height={56}
                                      />
                                    ) : (
                                      <span className="size-14 shrink-0 rounded-md bg-muted" />
                                    )}
                                    <span className="min-w-0">
                                      <span className="block text-sm font-medium">
                                        {item.title}
                                      </span>
                                      {item.description ? (
                                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                                          {item.description}
                                        </span>
                                      ) : null}
                                    </span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-4 border-l border-border pl-5">
                      {menu.secondary.map((group) => (
                        <div key={group.heading}>
                          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                            {group.heading}
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {group.items.map((item) => (
                              <li key={`${item.href}-${item.title}`}>
                                <Link
                                  href={item.href}
                                  className="block text-sm text-foreground/80 hover:text-foreground"
                                  onClick={() => setOpenLabel(null)}
                                >
                                  {item.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <PromoCard
                        title={menu.feature.title}
                        description={menu.feature.description}
                        href={menu.feature.href}
                        cta={menu.feature.ctaLabel}
                        publicId={menu.feature.publicId}
                        onNavigate={() => setOpenLabel(null)}
                      />
                      <div className="rounded-lg border border-border p-4">
                        <p className="text-sm font-medium">{menu.contact.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {menu.contact.description}
                        </p>
                        <Link
                          href={menu.contact.href}
                          className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
                          onClick={() => setOpenLabel(null)}
                        >
                          {menu.contact.ctaLabel} →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-md xl:hidden"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
      </button>

      {mobileOpen ? (
        <div className="absolute inset-x-0 top-full max-h-[80vh] overflow-y-auto border-b border-border bg-background px-4 py-4 shadow-md xl:hidden">
          {menus.map((menu) => (
            <div key={menu.label} className="border-b border-border py-3 last:border-0">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {menu.label}
              </p>
              <ul className="mt-2 space-y-1">
                {menu.primary.flatMap((g) =>
                  g.items.map((item) => (
                    <li key={`m-${item.href}-${item.title}`}>
                      <Link
                        href={item.href}
                        className="block rounded-md px-2 py-2 text-sm"
                        onClick={() => setMobileOpen(false)}
                      >
                        {item.title}
                      </Link>
                    </li>
                  )),
                )}
                {menu.secondary.flatMap((g) =>
                  g.items.map((item) => (
                    <li key={`s-${item.href}-${item.title}`}>
                      <Link
                        href={item.href}
                        className="block rounded-md px-2 py-2 text-sm text-muted-foreground"
                        onClick={() => setMobileOpen(false)}
                      >
                        {item.title}
                      </Link>
                    </li>
                  )),
                )}
              </ul>
            </div>
          ))}
          <Link
            href="/book"
            className="mt-3 block rounded-full bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
            onClick={() => setMobileOpen(false)}
          >
            Book a stay
          </Link>
        </div>
      ) : null}
    </>
  );
}

function PromoCard({
  title,
  description,
  href,
  cta,
  publicId,
  onNavigate,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
  publicId?: string;
  onNavigate: () => void;
}) {
  const src = thumbSrc(publicId);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="block overflow-hidden rounded-lg border border-border transition hover:border-primary/40"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-28 w-full object-cover" width={320} height={112} />
      ) : (
        <div className="h-28 w-full bg-muted" />
      )}
      <div className="p-3">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        <p className="mt-2 text-xs font-semibold text-primary">{cta} →</p>
      </div>
    </Link>
  );
}
