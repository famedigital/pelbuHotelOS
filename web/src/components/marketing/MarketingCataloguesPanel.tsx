import {
  archiveCatalogue,
  upsertCatalogue,
} from "@/app/actions/erp-catalogues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MarketingCatalogueRow } from "@/lib/marketing/catalogue";
import {
  listCatalogueTemplates,
  type CatalogueTemplateCode,
} from "@/lib/marketing/catalogue-templates";
import { absoluteUrl } from "@/lib/site";
import Link from "next/link";

async function createCatalogueAction(formData: FormData) {
  "use server";
  await upsertCatalogue({ ok: false }, formData);
}

async function archiveCatalogueAction(formData: FormData) {
  "use server";
  await archiveCatalogue({ ok: false }, formData);
}

export function MarketingCataloguesPanel({
  catalogues,
  promos,
}: {
  catalogues: MarketingCatalogueRow[];
  promos: { id: string; code: string; name: string }[];
}) {
  const templates = listCatalogueTemplates();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Compose a hotel pack from live rooms, menu, media. Publish a link for
        Instagram / Facebook, export social crops, and print PDF. Pick a
        template first — no freestyle layout.
      </p>

      <form
        action={createCatalogueAction}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <p className="sm:col-span-2 lg:col-span-3 text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
          New catalogue
        </p>

        <label className="space-y-1.5 text-sm sm:col-span-2 lg:col-span-3">
          <span className="text-muted-foreground">Template</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {templates.map((t) => (
              <label
                key={t.code}
                className="flex cursor-pointer flex-col gap-1 rounded-md border p-3 has-[:checked]:border-sky-500 has-[:checked]:bg-sky-50"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="template_code"
                    value={t.code}
                    defaultChecked={t.code === "flagship_stay"}
                    required
                  />
                  <span className="font-medium">{t.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">{t.blurb}</span>
              </label>
            ))}
          </div>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Title</span>
          <Input
            name="title"
            required
            placeholder="Olakha summer stay pack"
            className="h-10"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Slug (share URL)</span>
          <Input
            name="slug"
            placeholder="olakha-summer"
            className="h-10 font-mono text-sm"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Season label</span>
          <Input name="season_label" placeholder="Summer 2026" className="h-10" />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Audience</span>
          <select
            name="audience"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            defaultValue="public"
          >
            <option value="public">Public (IG/FB)</option>
            <option value="agents">Agents</option>
            <option value="media_press">Media / press</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Cover Cloudinary ID</span>
          <Input
            name="cover_public_id"
            placeholder="pelbu/hotel/..."
            className="h-10 font-mono text-xs"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Promo code (optional)</span>
          <select
            name="promo_code_id"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            defaultValue=""
          >
            <option value="">— none —</option>
            {promos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Intro blurb</span>
          <Input
            name="intro_blurb"
            placeholder="Quiet rooms above Olakha · guided groups welcome"
            className="h-10"
          />
        </label>
        <label className="space-y-1.5 text-sm sm:col-span-2 lg:col-span-3">
          <span className="text-muted-foreground">IG feed caption</span>
          <Input
            name="caption_feed"
            placeholder="Caption for Instagram / Facebook posts"
            className="h-10"
          />
        </label>
        <label className="space-y-1.5 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Hashtags</span>
          <Input
            name="hashtags"
            placeholder="#PelbuSuites #Thimphu #Bhutan"
            className="h-10"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">CTA</span>
          <select
            name="cta_kind"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            defaultValue="book"
          >
            <option value="book">Book stay</option>
            <option value="order">Order F&B</option>
            <option value="contact">Contact</option>
            <option value="custom">Custom URL</option>
          </select>
        </label>

        <fieldset className="sm:col-span-2 lg:col-span-3 space-y-2">
          <legend className="text-xs font-medium text-muted-foreground">
            Sections (defaults from template; check to include)
          </legend>
          <div className="flex flex-wrap gap-3 text-sm">
            {(
              [
                "cover",
                "gallery",
                "rooms",
                "fnb",
                "spa",
                "meeting",
                "rates",
                "contact",
              ] as const
            ).map((type) => (
              <label key={type} className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name={`section_${type}`}
                  value="1"
                  defaultChecked={
                    type !== "rates" && type !== "meeting"
                  }
                />
                <span className="capitalize">{type}</span>
              </label>
            ))}
          </div>
          <input type="hidden" name="sections" value="[]" />
        </fieldset>

        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="submit" name="status" value="draft">
            Save draft
          </Button>
          <Button type="submit" name="status" value="published" variant="citrus">
            Publish
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Template</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Views</th>
              <th className="px-3 py-2 font-medium">Share</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {catalogues.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No catalogues yet.
                </td>
              </tr>
            ) : (
              catalogues.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{c.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      /c/{c.slug}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {labelTemplate(c.template_code)}
                  </td>
                  <td className="px-3 py-2">{c.status}</td>
                  <td className="px-3 py-2 tabular-nums">{c.view_count}</td>
                  <td className="px-3 py-2">
                    {c.status === "published" ? (
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/c/${c.slug}`}
                          className="text-sky-600 underline-offset-2 hover:underline"
                          target="_blank"
                        >
                          Open
                        </Link>
                        <span className="max-w-[12rem] truncate font-mono text-[10px] text-muted-foreground">
                          {absoluteUrl(`/c/${c.slug}`)}
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {c.status !== "archived" ? (
                      <form action={archiveCatalogueAction}>
                        <input type="hidden" name="catalogue_id" value={c.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Archive
                        </Button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function labelTemplate(code: CatalogueTemplateCode): string {
  return listCatalogueTemplates().find((t) => t.code === code)?.name ?? code;
}
