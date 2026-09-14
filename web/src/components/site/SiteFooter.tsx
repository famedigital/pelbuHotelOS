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

/** Compact forest footer — brand + columns + ember strip. */
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
    <footer className="relative overflow-hidden bg-forest text-[#f2f4f3]">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-ember" aria-hidden />

      <div className="relative mx-auto max-w-[1200px] px-5 py-8 md:px-8 md:py-9">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-md space-y-2">
            <BrandLockup
              logoSrc={logoSrc}
              tone="hero"
              className="!text-[#f2f4f3]"
              sizeRem={logoSizeRem}
              offsetPct={logoOffsetPct}
              gapRem={logoGapRem}
            />
            <p className="text-sm leading-snug text-white/65">
              {property?.address ??
                "Olakha, Thimphu — rooms, cafe, restaurant, bar, spa and meeting under one roof."}
            </p>
          </div>

          {socials.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
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
                      className="inline-flex size-9 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/80 transition-colors hover:border-ember/70 hover:bg-white/10 hover:text-white"
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
          className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 md:grid-cols-5"
        >
          {columns.map((column) => (
            <div key={column.heading} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-celadon">
                {column.heading}
              </p>
              <ul className="space-y-0 text-sm text-white/65">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.href}`}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-9 items-center transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="relative bg-ember">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-3.5 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <p className="text-sm font-semibold text-white">Book direct</p>
            <p className="text-xs text-white/85">
              Best available rate at Pelbu Suites, Olakha — no channel fee.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              className="bg-forest text-[#f2f4f3] hover:bg-forest-soft"
            >
              <Link href="/book">
                Check rates
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white"
            >
              <Link href="/contact">Contact the desk</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-forest">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-5 py-3 text-xs text-white/45 md:flex-row md:items-center md:justify-between md:px-8">
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
