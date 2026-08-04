"use client";

import {
  archiveCatalogue,
  upsertCatalogue,
  type CatalogueActionState,
} from "@/app/actions/erp-catalogues";
import { CloudinaryPicker } from "@/components/erp/CloudinaryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type { MarketingCatalogueRow } from "@/lib/marketing/catalogue";
import {
  getCatalogueTemplate,
  listCatalogueTemplates,
  type CatalogueSectionType,
  type CatalogueTemplateCode,
} from "@/lib/marketing/catalogue-templates";
import { catalogueShareUrl } from "@/lib/marketing/catalogue-share";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

const initial: CatalogueActionState = { ok: false };

const ALL_SECTION_TYPES: CatalogueSectionType[] = [
  "cover",
  "gallery",
  "rooms",
  "fnb",
  "spa",
  "meeting",
  "rates",
  "contact",
];

function Feedback({ state }: { state: CatalogueActionState }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      role="status"
      className={`text-sm sm:col-span-2 lg:col-span-3 ${
        state.error ? "text-destructive" : "text-emerald-700"
      }`}
    >
      {state.error ?? state.message}
    </p>
  );
}

export function MarketingCataloguesPanel({
  catalogues,
  promos,
}: {
  catalogues: MarketingCatalogueRow[];
  promos: { id: string; code: string; name: string }[];
}) {
  const templates = listCatalogueTemplates();
  const [createState, createAction, createPending] = useActionState(
    upsertCatalogue,
    initial,
  );
  useActionToast(createState, { successMessage: "Catalogue saved" });
  const [editId, setEditId] = useState<string | null>(null);
  const [templateCode, setTemplateCode] =
    useState<CatalogueTemplateCode>("flagship_stay");
  const template = useMemo(
    () => getCatalogueTemplate(templateCode),
    [templateCode],
  );
  const editRow = editId
    ? (catalogues.find((c) => c.id === editId) ?? null)
    : null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Compose a hotel pack from live rooms, menu, media. Publish a link for
        Instagram / Facebook, export social crops, and print PDF. Pick a
        template first — no freestyle layout.
      </p>

      {editRow ? (
        <EditCatalogueForm
          catalogue={editRow}
          promos={promos}
          onCancel={() => setEditId(null)}
        />
      ) : (
        <form
          action={createAction}
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
                      checked={templateCode === t.code}
                      onChange={() => setTemplateCode(t.code)}
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
            <Input
              name="season_label"
              placeholder="Summer 2026"
              className="h-10"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">Audience</span>
            <select
              name="audience"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={template.defaultAudience}
              key={`audience-${templateCode}`}
            >
              <option value="public">Public (IG/FB)</option>
              <option value="agents">Agents</option>
              <option value="media_press">Media / press</option>
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-2">
            <CoverPublicIdField />
          </div>
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
          <label className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">Story caption (short)</span>
            <Input
              name="caption_story"
              placeholder="Short story sticker text"
              className="h-10"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">Agent blurb</span>
            <Input
              name="caption_agent"
              placeholder="Trade newsletter blurb"
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
              defaultValue={templateCode === "fnb_taste" ? "order" : "book"}
              key={`cta-${templateCode}`}
            >
              <option value="book">Book stay</option>
              <option value="order">Order F&B</option>
              <option value="contact">Contact</option>
              <option value="custom">Custom URL</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">Custom CTA URL</span>
            <Input
              name="cta_href"
              placeholder="/book or https://…"
              className="h-10 font-mono text-xs"
            />
          </label>

          <fieldset
            className="sm:col-span-2 lg:col-span-3 space-y-2"
            key={`sections-${templateCode}`}
          >
            <legend className="text-xs font-medium text-muted-foreground">
              Sections (from {template.name}; uncheck to hide)
            </legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {ALL_SECTION_TYPES.map((type) => {
                const def = template.defaultSections.find(
                  (s) => s.type === type,
                );
                const defaultOn = def ? def.enabled : false;
                return (
                  <label
                    key={type}
                    className="inline-flex items-center gap-1.5"
                  >
                    <input
                      type="checkbox"
                      name={`section_${type}`}
                      value="1"
                      defaultChecked={defaultOn}
                    />
                    <span className="capitalize">{type}</span>
                  </label>
                );
              })}
            </div>
            <input type="hidden" name="sections" value="[]" />
          </fieldset>

          <Feedback state={createState} />
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
            <Button
              type="submit"
              name="status"
              value="draft"
              disabled={createPending}
            >
              {createPending ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="submit"
              name="status"
              value="published"
              variant="citrus"
              disabled={createPending}
            >
              Publish
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Template</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Views</th>
              <th className="px-3 py-2 font-medium">Social DL</th>
              <th className="px-3 py-2 font-medium">Share</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {catalogues.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
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
                  <td className="px-3 py-2 tabular-nums">
                    {c.social_download_count}
                  </td>
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
                        <Link
                          href={`/c/${c.slug}/print`}
                          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                          target="_blank"
                        >
                          Print / PDF
                        </Link>
                        <span className="max-w-[12rem] truncate font-mono text-[10px] text-muted-foreground">
                          {catalogueShareUrl(
                            c.slug,
                            c.audience === "agents" ? "agent" : "copy",
                          )}
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {c.status !== "archived" ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditId(c.id)}
                        >
                          Edit
                        </Button>
                        <ArchiveForm id={c.id} />
                      </>
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

function EditCatalogueForm({
  catalogue,
  promos,
  onCancel,
}: {
  catalogue: MarketingCatalogueRow;
  promos: { id: string; code: string; name: string }[];
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(upsertCatalogue, initial);
  useActionToast(state, { successMessage: "Catalogue updated" });
  const [templateCode, setTemplateCode] = useState<CatalogueTemplateCode>(
    catalogue.template_code,
  );
  const template = useMemo(
    () => getCatalogueTemplate(templateCode),
    [templateCode],
  );
  const enabled = new Set(
    (catalogue.sections ?? [])
      .filter((s) => s.enabled !== false)
      .map((s) => s.type),
  );
  // Switching template re-seeds enable flags from template defaults while
  // keeping types staff already enabled when shared across templates.
  const sectionDefaults =
    templateCode === catalogue.template_code
      ? enabled
      : new Set(
          template.defaultSections
            .filter((s) => s.enabled)
            .map((s) => s.type),
        );

  return (
    <form
      action={action}
      className="grid gap-3 rounded-lg border border-sky-500/40 bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <input type="hidden" name="catalogue_id" value={catalogue.id} />
      <input
        type="hidden"
        name="sections"
        value={JSON.stringify(
          templateCode === catalogue.template_code
            ? (catalogue.sections ?? [])
            : template.defaultSections,
        )}
      />
      <p className="sm:col-span-2 lg:col-span-3 text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
        Edit · {catalogue.title}
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="sm:col-span-2 lg:col-span-3 text-left text-xs text-muted-foreground underline"
      >
        Cancel edit
      </button>

      <label className="space-y-1.5 text-sm sm:col-span-2 lg:col-span-3">
        <span className="text-muted-foreground">Template</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {listCatalogueTemplates().map((t) => (
            <label
              key={t.code}
              className="flex cursor-pointer flex-col gap-1 rounded-md border p-3 has-[:checked]:border-sky-500 has-[:checked]:bg-sky-50"
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="template_code"
                  value={t.code}
                  checked={templateCode === t.code}
                  onChange={() => setTemplateCode(t.code)}
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
          defaultValue={catalogue.title}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Slug</span>
        <Input
          name="slug"
          defaultValue={catalogue.slug}
          className="h-10 font-mono text-sm"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Status</span>
        <select
          name="status"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue={
            catalogue.status === "archived" ? "draft" : catalogue.status
          }
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Audience</span>
        <select
          name="audience"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue={catalogue.audience}
        >
          <option value="public">Public (IG/FB)</option>
          <option value="agents">Agents</option>
          <option value="media_press">Media / press</option>
        </select>
      </label>
      <div className="sm:col-span-2">
        <CoverPublicIdField initial={catalogue.cover_public_id} />
      </div>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Promo code</span>
        <select
          name="promo_code_id"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue={catalogue.promo_code_id ?? ""}
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
          defaultValue={catalogue.intro_blurb ?? ""}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm sm:col-span-2 lg:col-span-3">
        <span className="text-muted-foreground">IG feed caption</span>
        <Input
          name="caption_feed"
          defaultValue={catalogue.caption_feed ?? ""}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Story caption</span>
        <Input
          name="caption_story"
          defaultValue={catalogue.caption_story ?? ""}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Agent blurb</span>
        <Input
          name="caption_agent"
          defaultValue={catalogue.caption_agent ?? ""}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm sm:col-span-2">
        <span className="text-muted-foreground">Hashtags</span>
        <Input
          name="hashtags"
          defaultValue={catalogue.hashtags ?? ""}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">CTA</span>
        <select
          name="cta_kind"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue={catalogue.cta_kind}
        >
          <option value="book">Book stay</option>
          <option value="order">Order F&B</option>
          <option value="contact">Contact</option>
          <option value="custom">Custom URL</option>
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Custom CTA URL</span>
        <Input
          name="cta_href"
          defaultValue={catalogue.cta_href ?? ""}
          className="h-10 font-mono text-xs"
        />
      </label>
      <fieldset
        className="sm:col-span-2 lg:col-span-3 space-y-2"
        key={`edit-sections-${templateCode}`}
      >
        <legend className="text-xs font-medium text-muted-foreground">
          Sections ({template.name})
        </legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {ALL_SECTION_TYPES.map((type) => (
            <label key={type} className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                name={`section_${type}`}
                value="1"
                defaultChecked={sectionDefaults.has(type)}
              />
              <span className="capitalize">{type}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Feedback state={state} />
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Update catalogue"}
        </Button>
      </div>
    </form>
  );
}

function ArchiveForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(archiveCatalogue, initial);
  useActionToast(state, { successMessage: "Catalogue archived" });
  return (
    <form action={action} className="inline">
      <input type="hidden" name="catalogue_id" value={id} />
      {state.error ? (
        <span className="mr-1 text-xs text-destructive">{state.error}</span>
      ) : null}
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : "Archive"}
      </Button>
    </form>
  );
}

function CoverPublicIdField({ initial = "" }: { initial?: string | null }) {
  const [publicId, setPublicId] = useState(initial ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const preview = publicId
    ? cloudinaryUrl(publicId, { width: 480, height: 300, crop: "fill" })
    : null;

  return (
    <div className="space-y-2">
      <span className="text-sm text-muted-foreground">Cover image</span>
      <input type="hidden" name="cover_public_id" value={publicId} />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-1 text-center text-[10px] text-muted-foreground">
              No cover
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              {publicId ? "Change cover" : "Pick cover"}
            </Button>
            {publicId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPublicId("")}
              >
                Clear
              </Button>
            ) : null}
          </div>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {publicId || "Uses first gallery/room photo if empty"}
          </p>
        </div>
      </div>
      <CloudinaryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(id) => {
          setPublicId(id);
          setPickerOpen(false);
        }}
        uploadFolder="pelbu/marketing"
        title="Catalogue cover"
        description="Pick an approved CMS/hotel image for the pack hero and OG preview."
        acceptVideo={false}
      />
    </div>
  );
}

function labelTemplate(code: CatalogueTemplateCode): string {
  return listCatalogueTemplates().find((t) => t.code === code)?.name ?? code;
}
