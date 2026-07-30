"use client";

import {
  publishCmsPage,
  saveCmsPageDraft,
  type CmsEditorState,
} from "@/app/actions/erp-cms";
import { CloudinaryPicker } from "@/components/erp/CloudinaryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CmsAdminPage } from "@/lib/cms-admin";
import { publicPathForSlug } from "@/lib/cms-routes";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { ExternalLinkIcon, ImageIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

const INITIAL_STATE: CmsEditorState = { ok: false };

function Field({
  label,
  name,
  defaultValue,
  hint,
  maxLength,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  hint?: string;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        maxLength={maxLength}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function CmsPageEditor({ page }: { page: CmsAdminPage }) {
  const [draftState, draftAction, draftPending] = useActionState(
    saveCmsPageDraft,
    INITIAL_STATE,
  );
  const [publishState, publishAction, publishPending] = useActionState(
    publishCmsPage,
    INITIAL_STATE,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [ogPublicId, setOgPublicId] = useState(page.draft.og_public_id ?? "");
  const previewSrc = ogPublicId
    ? cloudinaryUrl(ogPublicId, { width: 360, height: 190, crop: "fill" })
    : null;
  const state = publishState.message || publishState.error
    ? publishState
    : draftState;
  const pending = draftPending || publishPending;

  return (
    <>
      <form className="space-y-6">
        <input type="hidden" name="page_id" value={page.id} />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Revision {page.revision}
            </p>
            <p className="text-xs text-muted-foreground">
              {page.has_unpublished_changes
                ? "This page has an unpublished draft."
                : "Draft matches the published page."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={publicPathForSlug(page.slug)} target="_blank">
                Preview live
                <ExternalLinkIcon className="size-4" />
              </Link>
            </Button>
            <Button
              type="submit"
              variant="outline"
              formAction={draftAction}
              disabled={pending}
            >
              {draftPending ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="submit"
              formAction={publishAction}
              disabled={pending}
            >
              {publishPending ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </div>

        {state.message || state.error ? (
          <p
            role="status"
            className={
              state.ok
                ? "rounded-lg border border-mint-500/30 bg-mint-100/50 px-4 py-3 text-sm text-mint-600"
                : "rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            }
          >
            {state.message ?? state.error}
          </p>
        ) : null}

        <section className="space-y-5 rounded-xl border bg-card p-5 md:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
              Page content
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              Hero and introduction
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Eyebrow"
              name="eyebrow"
              defaultValue={page.draft.eyebrow}
              maxLength={120}
            />
            <Field
              label="Page title"
              name="title"
              defaultValue={page.draft.title}
              maxLength={180}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">Main copy</Label>
            <Textarea
              id="body"
              name="body"
              defaultValue={page.draft.body}
              rows={7}
              maxLength={12_000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="summary">Short summary</Label>
            <Textarea
              id="summary"
              name="summary"
              defaultValue={page.draft.summary ?? ""}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sections_json">Additional content sections</Label>
            <Textarea
              id="sections_json"
              name="sections_json"
              defaultValue={JSON.stringify(page.draft.sections_json, null, 2)}
              rows={14}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Long-form page content. Each section has a heading, paragraphs
              array, and optional items array.
            </p>
          </div>

          <Field
            label="Hours note"
            name="hours_note"
            defaultValue={page.draft.hours_note}
            maxLength={500}
          />
        </section>

        <section className="space-y-5 rounded-xl border bg-card p-5 md:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
              Actions
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              Calls to action
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Primary label"
              name="primary_cta_label"
              defaultValue={page.draft.primary_cta_label}
              maxLength={80}
            />
            <Field
              label="Primary link"
              name="primary_cta_href"
              defaultValue={page.draft.primary_cta_href}
              hint="Internal paths begin with /."
              maxLength={500}
            />
            <Field
              label="Secondary label"
              name="secondary_cta_label"
              defaultValue={page.draft.secondary_cta_label}
              maxLength={80}
            />
            <Field
              label="Secondary link"
              name="secondary_cta_href"
              defaultValue={page.draft.secondary_cta_href}
              maxLength={500}
            />
          </div>
        </section>

        <section className="space-y-5 rounded-xl border bg-card p-5 md:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
              Search and sharing
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              SEO
            </h2>
          </div>
          <Field
            label="SEO title"
            name="seo_title"
            defaultValue={page.draft.seo_title}
            hint="Recommended: no more than 60–65 characters."
            maxLength={70}
          />
          <div className="space-y-1.5">
            <Label htmlFor="meta_description">Meta description</Label>
            <Textarea
              id="meta_description"
              name="meta_description"
              defaultValue={page.draft.meta_description ?? ""}
              rows={3}
              maxLength={180}
            />
          </div>
          <Field
            label="Canonical path"
            name="canonical_path"
            defaultValue={page.draft.canonical_path}
            hint="Example: /rooms"
            maxLength={500}
          />

          <div className="space-y-3">
            <Label>Social sharing image</Label>
            <input type="hidden" name="og_public_id" value={ogPublicId} />
            <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-3">
              {previewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewSrc}
                  alt=""
                  className="h-24 w-40 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-24 w-40 items-center justify-center rounded-md border border-dashed">
                  <ImageIcon className="size-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="break-all text-xs text-muted-foreground">
                  {ogPublicId || "No social image selected"}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPickerOpen(true)}
                  >
                    Choose image
                  </Button>
                  {ogPublicId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setOgPublicId("")}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5 rounded-xl border bg-card p-5 md:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
              Structured content
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              FAQ and verification
            </h2>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="faq_json">FAQ JSON</Label>
            <Textarea
              id="faq_json"
              name="faq_json"
              defaultValue={JSON.stringify(page.draft.faq_json, null, 2)}
              rows={10}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Use an array of objects with “question” and “answer”.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Author"
              name="author_name"
              defaultValue={page.draft.author_name}
              maxLength={120}
            />
            <Field
              label="Last verified"
              name="last_verified_at"
              defaultValue={page.draft.last_verified_at?.slice(0, 10)}
              hint="YYYY-MM-DD"
              maxLength={40}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="source_note">Source note</Label>
            <Textarea
              id="source_note"
              name="source_note"
              defaultValue={page.draft.source_note ?? ""}
              rows={3}
              maxLength={500}
            />
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm font-medium">
            <input
              type="checkbox"
              name="is_published"
              value="1"
              defaultChecked={page.draft.is_published}
              className="size-4 accent-primary"
            />
            Publicly visible
          </label>
        </section>

        <div className="sticky bottom-4 z-10 flex justify-end gap-2 rounded-xl border bg-background/90 p-3 shadow-lg backdrop-blur">
          <Button
            type="submit"
            variant="outline"
            formAction={draftAction}
            disabled={pending}
          >
            {draftPending ? "Saving…" : "Save draft"}
          </Button>
          <Button
            type="submit"
            formAction={publishAction}
            disabled={pending}
          >
            {publishPending ? "Publishing…" : "Publish changes"}
          </Button>
        </div>
      </form>

      <CloudinaryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={setOgPublicId}
        uploadFolder={`pelbu/cms/${page.slug}`}
        title={`Choose social image for ${page.slug}`}
      />
    </>
  );
}
