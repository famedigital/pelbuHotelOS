import { DeskPageTitle } from "@/components/erp/DeskShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadCmsAdminPages } from "@/lib/cms-admin";
import { publicPathForSlug } from "@/lib/cms-routes";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  BookOpenTextIcon,
  ExternalLinkIcon,
  ImageIcon,
  LayoutTemplateIcon,
  MenuIcon,
  PaletteIcon,
  PanelsTopLeftIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Front Public | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FrontPublicPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const pages = await loadCmsAdminPages(admin, propertyId);
  const changed = pages.filter((page) => page.has_unpublished_changes).length;

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-8 p-4 md:p-6">
      <DeskPageTitle
        eyebrow="Website CMS"
        title="Front Public"
        description="Edit public page copy and SEO safely. Save drafts without changing the website, then publish when ready."
        actions={
          <Button asChild variant="outline">
            <Link href="/" target="_blank">
              View website
              <ExternalLinkIcon className="size-4" />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pages
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
            {pages.length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Unpublished drafts
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
            {changed}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Published
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
            {pages.filter((page) => page.published.is_published).length}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Pages</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hero copy, calls to action, search metadata, FAQ and social image.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <article
              key={page.id}
              className="flex min-h-40 flex-col rounded-xl border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    /{page.slug === "home" ? "" : page.slug}
                  </p>
                  <h3 className="mt-1 truncate text-lg font-semibold text-foreground">
                    {page.draft.title}
                  </h3>
                </div>
                <Badge
                  variant={page.has_unpublished_changes ? "citrus" : "mint"}
                >
                  {page.has_unpublished_changes ? "Draft" : "Live"}
                </Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {page.draft.body}
              </p>
              <div className="mt-auto flex items-center gap-3 pt-5">
                <Link
                  href={`/erp/front-public/pages/${page.slug}`}
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  Edit page
                </Link>
                <Link
                  href={publicPathForSlug(page.slug)}
                  target="_blank"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  View live
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Public content sources
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Existing operational editors remain the source of truth and are
            collected here while the richer CMS modules are added.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Menus and prices",
              description: "Cafe, pastry, restaurant and bar.",
              href: "/erp/menu",
              icon: MenuIcon,
              ready: true,
            },
            {
              title: "Rooms",
              description: "Room inventory and categories.",
              href: "/erp/settings",
              icon: PanelsTopLeftIcon,
              ready: true,
            },
            {
              title: "Media library",
              description: "Page galleries, hero slides and image ordering.",
              href: "/erp/front-public/media",
              icon: ImageIcon,
              ready: true,
            },
            {
              title: "Navigation and footer",
              description: "Desktop mega menu and mobile tabs.",
              href: "#",
              icon: LayoutTemplateIcon,
              ready: false,
            },
            {
              title: "Guides",
              description: "Local articles and destination content.",
              href: "#",
              icon: BookOpenTextIcon,
              ready: false,
            },
            {
              title: "Templates and colors",
              description: "Template packs and public theme tokens.",
              href: "#",
              icon: PaletteIcon,
              ready: false,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                aria-disabled={!item.ready}
                className={`rounded-xl border bg-card p-5 transition-colors ${
                  item.ready
                    ? "hover:border-accent/50 hover:bg-muted/30"
                    : "pointer-events-none opacity-55"
                }`}
              >
                <Icon className="size-5 text-accent" />
                <h3 className="mt-4 font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.description}
                </p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent">
                  {item.ready ? "Open" : "Next phase"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
