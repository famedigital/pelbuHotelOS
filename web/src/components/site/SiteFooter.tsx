import { BrandLockup } from "@/components/site/BrandLockup";
import {
  FacebookGlyph,
  InstagramGlyph,
  TiktokGlyph,
} from "@/components/site/SocialIcons";
import { Button } from "@/components/ui/button";
import { buildFooterColumns } from "@/lib/mega-menu";
import { loadPublicRooms } from "@/lib/public-content";
import { resolveLogoSrc } from "@/lib/logo-src";
import {
  loadPublicPropertyProfile,
  type PublicPropertyProfile,
} from "@/lib/public-property";
import {
  ArrowRightIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

type SocialLink = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

function socialLinks(property: PublicPropertyProfile | null): SocialLink[] {
  const links: SocialLink[] = [];
  if (property?.instagram) {
    links.push({
      href: property.instagram,
      label: "Instagram",
      icon: InstagramGlyph,
    });
  }
  if (property?.facebook) {
    links.push({
      href: property.facebook,
      label: "Facebook",
      icon: FacebookGlyph,
    });
  }
  if (property?.tiktok) {
    links.push({ href: property.tiktok, label: "TikTok", icon: TiktokGlyph });
  }
  if (property?.whatsapp) {
    links.push({
      href: `https://wa.me/${property.whatsapp.replace(/\D+/g, "")}`,
      label: "WhatsApp",
      icon: MessageCircleIcon,
    });
  }
  if (property?.phone) {
    links.push({
      href: `tel:${property.phone}`,
      label: `Call ${property.phone}`,
      icon: PhoneIcon,
    });
  }
  if (property?.email) {
    links.push({
      href: `mailto:${property.email}`,
      label: property.email,
      icon: MailIcon,
    });
  }
  if (property?.mapsUrl) {
    links.push({ href: property.mapsUrl, label: "Map", icon: MapPinIcon });
  }
  return links;
}

/**
 * Mega footer: brand + five link columns that mirror the mega menu, then a
 * contact rail with the two conversion CTAs. Rooms under Stay come from live
 * sellable `room_types`, same source as the header.
 */
export async function SiteFooter({
  profile,
}: {
  profile?: PublicPropertyProfile | null;
} = {}) {
  const [property, rooms] = await Promise.all([
    profile === undefined ? loadPublicPropertyProfile() : Promise.resolve(profile),
    loadPublicRooms(),
  ]);
  const columns = buildFooterColumns(rooms);
  const socials = socialLinks(property);
  const logoSrc = resolveLogoSrc(property?.logoPublicId);
  const logoSizeRem = property?.logoNavSizeRem;
  const logoOffsetPct = property?.logoNavOffsetPct;
  const logoGapRem = property?.logoNavGapRem;

  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-sky-ink via-sky-ink to-sky-800 text-white">
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-sky-500 via-mint-500 to-citrus"
        aria-hidden
      />
      <div
        className="absolute -left-24 top-10 size-80 rounded-full bg-sky-500/20 blur-[110px]"
        aria-hidden
      />
      <div
        className="absolute -right-20 bottom-0 size-80 rounded-full bg-mint-500/20 blur-[110px]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-[1200px] px-5 py-14 md:px-8 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,3.2fr)_minmax(0,1.15fr)] lg:gap-8">
          <div className="space-y-4">
            <BrandLockup
              logoSrc={logoSrc}
              tone="hero"
              className="!text-white"
              sizeRem={logoSizeRem}
              offsetPct={logoOffsetPct}
              gapRem={logoGapRem}
            />
            <p className="max-w-xs text-sm leading-relaxed text-white/60">
              {property?.address ??
                "Olakha, Thimphu — rooms, cafe, restaurant, bar, spa and meeting under one roof."}
            </p>

            {socials.length > 0 ? (
              <ul className="flex flex-wrap gap-2 pt-1">
                {socials.map((social) => {
                  const Icon = social.icon;
                  const external = social.href.startsWith("http");
                  return (
                    <li key={social.label}>
                      <a
                        href={social.href}
                        aria-label={social.label}
                        title={social.label}
                        {...(external
                          ? { target: "_blank", rel: "noreferrer" }
                          : {})}
                        className="inline-flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white/80 transition-colors hover:border-citrus/60 hover:bg-white/20 hover:text-white"
                      >
                        <Icon className="size-4" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-5"
          >
            {columns.map((column) => (
              <div key={column.heading} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-citrus-soft">
                  {column.heading}
                </p>
                <ul className="space-y-2 text-sm text-white/65">
                  {column.links.map((link) => (
                    <li key={`${column.heading}-${link.href}`}>
                      <Link
                        href={link.href}
                        className="transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="space-y-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm font-semibold text-white">Book direct</p>
              <p className="mt-1 text-xs leading-5 text-white/65">
                Best available rate at Pelbu Suites, Olakha — no channel fee.
              </p>
              <Button
                asChild
                size="sm"
                className="mt-3 w-full bg-citrus text-sky-ink hover:bg-citrus-soft"
              >
                <Link href="/book">
                  Check rates
                  <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-4">
              <p className="text-sm font-semibold text-white">Need help?</p>
              <p className="mt-1 text-xs leading-5 text-white/65">
                Front desk hours, directions and group dining enquiries.
              </p>
              <div className="mt-3 space-y-1.5 text-sm text-white/75">
                {property?.phone ? (
                  <a
                    href={`tel:${property.phone}`}
                    className="flex items-center gap-2 transition-colors hover:text-white"
                  >
                    <PhoneIcon className="size-3.5 shrink-0" aria-hidden />
                    {property.phone}
                  </a>
                ) : null}
                {property?.email ? (
                  <a
                    href={`mailto:${property.email}`}
                    className="flex items-center gap-2 transition-colors hover:text-white"
                  >
                    <MailIcon className="size-3.5 shrink-0" aria-hidden />
                    {property.email}
                  </a>
                ) : null}
              </div>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="mt-3 w-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/contact">Contact the desk</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-6 text-xs text-white/45 md:flex-row md:items-center md:justify-between md:px-8">
          <p>
            © {new Date().getFullYear()} Pelbu Suites · Olakha, Thimphu, Bhutan
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/contact" className="hover:text-white">
              Contact
            </Link>
            <Link href="/faq" className="hover:text-white">
              FAQ
            </Link>
            <Link href="/agents" className="hover:text-white">
              Agents
            </Link>
            <Link href="/order" className="hover:text-white">
              Order
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
