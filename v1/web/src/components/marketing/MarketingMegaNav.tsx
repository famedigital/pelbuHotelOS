"use client";

import { ProductFrame } from "@/components/marketing/ProductFrame";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";
import {
  buildMarketingMegaMenu,
  type MarketingMegaSection,
} from "@/lib/marketing-mega-menu";
import { CATALOG_PACKAGES, formatBtn } from "@/lib/pricing-catalog";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";

const classic = CATALOG_PACKAGES.find((pkg) => pkg.code === "classic");
const portfolio = CATALOG_PACKAGES.find((pkg) => pkg.code === "portfolio");
const chainPkg = CATALOG_PACKAGES.find((pkg) => pkg.code === "chain");

type PanelLink = { href: string; title: string; note: string };

type Panel = {
  label: string;
  feature: {
    href: string;
    title: string;
    desc: string;
    src: string;
    alt: string;
    frame: boolean;
  } | null;
  links: PanelLink[];
  enquireTitle: string;
  enquireDesc: string;
};

const PANELS: Panel[] = [
  {
    label: "Product",
    feature: {
      href: "/",
      title: "Owner and general manager board",
      desc: "Occupancy, arrivals, and the month, on one screen.",
      src: MARKETING_MEDIA.screenDesk.src,
      alt: MARKETING_MEDIA.screenDesk.alt,
      frame: true,
    },
    links: [
      { href: "/#desk", title: "Front desk", note: "Arrivals, departures, who is in house" },
      { href: "/#folio", title: "Folio and night audit", note: "The bill, then the business date rolls" },
      { href: "/#pos", title: "POS", note: "A table, a room, or the counter" },
      { href: "/#site", title: "Web booking", note: "Their site, the same rooms" },
      { href: "/#product", title: "Owner board", note: "Occupancy, arrivals, the month" },
      { href: "/#answers", title: "DOT assessment", note: "Trade, DOT, and BAFRA" },
      { href: "/#prints", title: "Rota", note: "The week for every department" },
      { href: "/#prints", title: "Daily printouts", note: "Day sheet through the kitchen ticket" },
    ],
    enquireTitle: "See it on your hotels",
    enquireDesc: "A walkthrough of desk, folio, POS, and the booking page.",
  },
  {
    label: "Solutions",
    feature: {
      href: "/for/leased",
      title: "One owner. Many leased hotels.",
      desc: "Each property keeps its own rooms, rates, and night audit.",
      src: MARKETING_MEDIA.segmentLeased.src,
      alt: MARKETING_MEDIA.segmentLeased.alt,
      frame: false,
    },
    links: [
      {
        href: "/for/leased",
        title: "Leased",
        note: portfolio ? `${formatBtn(portfolio.msrpBtnMo)} a month per property` : "One owner, many hotels",
      },
      {
        href: "/for/independent",
        title: "Independent",
        note: classic ? `Classic ${formatBtn(classic.msrpBtnMo)} a month` : "One building, one desk",
      },
      {
        href: "/for/chain",
        title: "Chain",
        note: chainPkg ? `From ${formatBtn(chainPkg.msrpBtnMo)} a month` : "Shared standards, separate books",
      },
      { href: "/pricing", title: "Pricing", note: "Packages in BTN, Classic through Chain" },
    ],
    enquireTitle: "Which package fits?",
    enquireDesc: "Classic starts with the front office. POS and portfolios sit above it.",
  },
  {
    label: "Company",
    feature: null,
    links: [
      { href: "/demo", title: "Demo", note: "Desk, folio, POS, and the booking page" },
      { href: "/conditions", title: "Conditions", note: "Accept before go-live" },
      { href: "/status", title: "Status", note: "Whether Innora itself is up" },
      { href: "/changelog", title: "Changelog", note: "What is on the desk" },
    ],
    enquireTitle: "Talk to us",
    enquireDesc: "Tell us how many hotels you run. We reply in business hours.",
  },
];

function sectionActive(pathname: string, section: MarketingMegaSection): boolean {
  if (section.href && (pathname === section.href || pathname.startsWith(`${section.href}/`))) {
    return true;
  }
  return (section.columns ?? []).some((col) =>
    col.items.some(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ),
  );
}

export function MarketingMegaNav({ onHome = false }: { onHome?: boolean }) {
  const pathname = usePathname();
  const sections = buildMarketingMegaMenu();
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [openPath, setOpenPath] = useState(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobilePath, setMobilePath] = useState(pathname);
  const panelId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuOpen = openPath === pathname ? openLabel : null;
  const mobileVisible = mobilePath === pathname && mobileOpen;

  function showPanel(label: string | null) {
    setOpenPath(pathname);
    setOpenLabel(label);
  }

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => showPanel(null), 140);
  }

  const linkMuted = onHome
    ? "text-white/80 hover:text-white"
    : "text-muted-foreground hover:text-foreground";
  const linkActive = onHome ? "text-white" : "text-foreground";
  const panel = PANELS.find((item) => item.label === menuOpen);

  return (
    <>
      <nav
        className="hidden items-center gap-1 lg:flex"
        aria-label="Primary"
        onMouseLeave={scheduleClose}
      >
        {sections.map((section) => {
          const active = sectionActive(pathname, section);
          const isOpen = menuOpen === section.label;
          const hasPanel = PANELS.some((item) => item.label === section.label);
          if (!hasPanel && section.href) {
            return (
              <Link
                key={section.label}
                href={section.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm transition-colors",
                  linkMuted,
                  active && linkActive,
                )}
              >
                {section.label}
              </Link>
            );
          }
          return (
            <button
              key={section.label}
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors",
                linkMuted,
                (active || isOpen) && linkActive,
              )}
              aria-expanded={isOpen}
              aria-controls={`${panelId}-${section.label}`}
              onMouseEnter={() => {
                cancelClose();
                showPanel(section.label);
              }}
              onClick={() => showPanel(isOpen ? null : section.label)}
            >
              {section.label}
              <ChevronDownIcon
                className={cn("size-3.5 opacity-70 transition", isOpen && "rotate-180")}
              />
            </button>
          );
        })}
      </nav>

      {panel ? (
        <div
          id={`${panelId}-${panel.label}`}
          className="fixed inset-x-0 top-[4.25rem] z-40 hidden border-b border-black/10 bg-white text-foreground shadow-[0_28px_64px_-36px_rgba(12,23,38,0.45)] lg:block"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div
            className={cn(
              "mx-auto grid max-w-6xl items-start gap-8 px-6 py-7 md:px-10",
              panel.feature
                ? "lg:grid-cols-[minmax(16rem,1.1fr)_minmax(0,0.8fr)_minmax(12rem,0.7fr)]"
                : "lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.6fr)]",
            )}
          >
            {panel.feature ? (
              <Link href={panel.feature.href} className="block">
                {panel.feature.frame ? (
                  <ProductFrame url="app.innorahotel.com">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={panel.feature.src}
                      alt={panel.feature.alt}
                      className="h-auto w-full"
                    />
                  </ProductFrame>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={panel.feature.src}
                    alt={panel.feature.alt}
                    className="aspect-[16/10] w-full object-cover"
                  />
                )}
                <p className="mt-3 font-display text-xl tracking-tight">{panel.feature.title}</p>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                  {panel.feature.desc}
                </p>
              </Link>
            ) : null}

            <ul className={cn("grid gap-x-8", panel.links.length > 4 && "sm:grid-cols-2")}>
              {panel.links.map((link) => (
                <li key={link.title} className="border-t border-border">
                  <Link href={link.href} className="block py-3 hover:text-primary">
                    <span className="text-sm font-medium">{link.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                      {link.note}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div>
              <div className="border-t-2 border-foreground bg-secondary p-5">
                <p className="font-display text-xl tracking-tight">{panel.enquireTitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {panel.enquireDesc}
                </p>
                <Link
                  href="/demo"
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-cta text-sm font-semibold"
                >
                  Book a demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-md lg:hidden",
          onHome ? "text-white" : "text-foreground",
        )}
        aria-label={mobileVisible ? "Close menu" : "Open menu"}
        aria-expanded={mobileVisible}
        onClick={() => {
          setMobilePath(pathname);
          setMobileOpen(!mobileVisible);
        }}
      >
        {mobileVisible ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
      </button>

      {mobileVisible ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white text-foreground lg:hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <p className="font-display text-xl">Innora</p>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-md"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            >
              <XIcon className="size-5" />
            </button>
          </div>
          <div className="space-y-8 px-5 py-6">
            {PANELS.map((item) => (
              <div key={item.label}>
                <p className="font-display text-2xl tracking-tight">{item.label}</p>
                <ul className="mt-3">
                  {item.links.map((link) => (
                    <li key={link.title} className="border-t border-border">
                      <Link
                        href={link.href}
                        className="block py-3"
                        onClick={() => setMobileOpen(false)}
                      >
                        <span className="text-base font-medium">{link.title}</span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {link.note}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <Link
              href="/demo"
              className="inline-flex h-11 items-center rounded-full bg-cta px-6 text-sm font-semibold"
              onClick={() => setMobileOpen(false)}
            >
              Book a demo
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
