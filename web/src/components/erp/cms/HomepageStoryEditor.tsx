"use client";

import {
  publishHomepageStory,
  saveHomepageStoryDraft,
  type HomepageStoryState,
} from "@/app/actions/erp-homepage-story";
import {
  CloudinaryPicker,
  type CloudinaryUploadIntent,
} from "@/components/erp/CloudinaryPicker";
import { ImageFramePanEditor } from "@/components/erp/cms/ImageFramePanEditor";
import { DeskStickyActionBar } from "@/components/erp/DeskStickyActionBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type {
  FunnelModules,
  HomepageStory,
  StoryBlock,
  StoryAccent,
} from "@/lib/home-story";
import { cn } from "@/lib/utils";
import {
  CameraIcon,
  ImagePlusIcon,
  Trash2Icon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { useActionState, useState } from "react";

const EMPTY: HomepageStoryState = { ok: false };

type StorySectionKey = Exclude<keyof HomepageStory, "funnel">;

const SECTION_META: {
  key: "about" | "rooms" | "restaurant" | "lunch" | "cafe" | "spa";
  label: string;
  hint: string;
  folder: string;
  group: "headers" | "deep";
  showAmount?: boolean;
}[] = [
  {
    key: "rooms",
    label: "Rooms section headers",
    hint: "Copy above the live room cards (prices still come from rates).",
    folder: "pelbu/rooms",
    group: "headers",
  },
  {
    key: "about",
    label: "About Pelbu (optional)",
    hint: "Brand / lucky-sign story. Off by default — enable only if you want a brand band after proof.",
    folder: "pelbu/hotel",
    group: "headers",
  },
  {
    key: "lunch",
    label: "Lunch package",
    hint: "Day-visitor commercial CTA after In-house. BTN amount is public.",
    folder: "pelbu/restaurant",
    group: "deep",
    showAmount: true,
  },
  {
    key: "restaurant",
    label: "Restaurant story (optional)",
    hint: "Long-form dining band. Prefer In-house strip for most guests; enable for brochure depth.",
    folder: "pelbu/restaurant",
    group: "deep",
  },
  {
    key: "cafe",
    label: "Cafe story (optional)",
    hint: "PELBU ZONE long-form. Keep off if In-house is enough.",
    folder: "pelbu/cafe",
    group: "deep",
  },
  {
    key: "spa",
    label: "Spa story (optional)",
    hint: "Wellness long-form after In-house. Jacuzzi = Suite only.",
    folder: "pelbu/spa",
    group: "deep",
  },
];

const FUNNEL_META: {
  key: keyof FunnelModules;
  label: string;
  hint: string;
}[] = [
  {
    key: "trust",
    label: "Trust strip",
    hint: "Price / contact / season bar under the hero.",
  },
  {
    key: "proof",
    label: "Proof cards",
    hint: "Direct rates · live availability · one roof · agents.",
  },
  {
    key: "why",
    label: "Why Pelbu",
    hint: "Four differentiators after rooms.",
  },
  {
    key: "inHouse",
    label: "In-house services",
    hint: "Restaurant · cafe · spa · order — one compact grid.",
  },
  {
    key: "faq",
    label: "FAQ teaser",
    hint: "Pulls from the public FAQ CMS page.",
  },
  {
    key: "agents",
    label: "Agents CTA",
    hint: "Travel partner block at the bottom.",
  },
];

const ACCENTS: StoryAccent[] = ["sky", "citrus", "mint", "spa", "espresso"];

function previewUrl(
  publicId: string | null,
  width = 1200,
): string | null {
  if (!publicId) return null;
  return cloudinaryUrl(publicId, {
    width,
    crop: "limit",
    quality: "auto:good",
  });
}

type PickerMode =
  | { target: "lead"; intent: CloudinaryUploadIntent | null }
  | { target: "gallery"; intent: CloudinaryUploadIntent | null }
  | null;

function StoryImageFields({
  name,
  block,
  uploadFolder,
}: {
  name: StorySectionKey;
  block: StoryBlock;
  uploadFolder: string;
}) {
  const p = (key: string) => `${name}.${key}`;
  const [leadId, setLeadId] = useState(block.public_id ?? "");
  const [gallery, setGallery] = useState<string[]>(block.gallery_public_ids);
  const [focalX, setFocalX] = useState(block.focal_x);
  const [focalY, setFocalY] = useState(block.focal_y);
  const [picker, setPicker] = useState<PickerMode>(null);

  const leadPreview = previewUrl(leadId || null);
  const pickerOpen = picker != null;

  function openPicker(
    target: "lead" | "gallery",
    intent: CloudinaryUploadIntent | null = null,
  ) {
    setPicker({ target, intent });
  }

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-border bg-muted/20 p-3">
      <input type="hidden" name={p("public_id")} value={leadId} />
      <input
        type="hidden"
        name={p("gallery_public_ids")}
        value={gallery.join("\n")}
      />
      <input type="hidden" name={p("focal_x")} value={focalX} />
      <input type="hidden" name={p("focal_y")} value={focalY} />

      <div>
        <p className="text-sm font-medium text-foreground">Lead photo</p>
        <p className="text-xs text-muted-foreground">
          Drag the photo in the frame (slide up/down) so the subject stays
          visible after crop. Live WYSIWYG.
        </p>
      </div>

      <ImageFramePanEditor
        imageSrc={leadPreview}
        focalX={focalX}
        focalY={focalY}
        onChange={(x, y) => {
          setFocalX(x);
          setFocalY(y);
        }}
        aspect="16/9"
        label="Lead photo frame"
        hint="Drag · sliders · arrow keys"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => openPicker("lead")}
        >
          <ImagePlusIcon className="size-3.5" aria-hidden />
          Choose photo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => openPicker("lead", "file")}
        >
          <UploadCloudIcon className="size-3.5" aria-hidden />
          Upload file
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => openPicker("lead", "camera")}
        >
          <CameraIcon className="size-3.5" aria-hidden />
          Capture
        </Button>
        {leadId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => {
              setLeadId("");
              setFocalX(0.5);
              setFocalY(0.5);
            }}
          >
            <Trash2Icon className="size-3.5" aria-hidden />
            Clear
          </Button>
        ) : null}
      </div>

      {leadId ? (
        <p className="truncate font-mono text-[11px] text-muted-foreground" title={leadId}>
          {leadId}
        </p>
      ) : null}

      <div className="space-y-2 border-t border-border/60 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">
              Extra photos
            </p>
            <p className="text-xs text-muted-foreground">
              Optional strip under the section (comma-free list).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => openPicker("gallery")}
            >
              <ImagePlusIcon className="size-3.5" aria-hidden />
              Add photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => openPicker("gallery", "camera")}
            >
              <CameraIcon className="size-3.5" aria-hidden />
              Capture
            </Button>
          </div>
        </div>

        {gallery.length === 0 ? (
          <p className="text-xs text-muted-foreground">No extra photos yet.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {gallery.map((id) => {
              const src = previewUrl(id, 280);
              return (
                <li
                  key={id}
                  className="group relative overflow-hidden rounded-md border bg-card"
                >
                  <div className="aspect-[4/3] bg-muted">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={`Remove ${id}`}
                    onClick={() =>
                      setGallery((prev) => prev.filter((g) => g !== id))
                    }
                  >
                    <XIcon className="size-3.5" aria-hidden />
                  </button>
                  <p
                    className="truncate px-1 py-0.5 font-mono text-[9px] text-muted-foreground"
                    title={id}
                  >
                    {id.split("/").pop()}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <CloudinaryPicker
        open={pickerOpen}
        onOpenChange={(open) => {
          if (!open) setPicker(null);
        }}
        uploadFolder={uploadFolder}
        acceptVideo={false}
        initialTab={picker?.intent ? "upload" : "library"}
        uploadIntent={picker?.intent ?? null}
        title={
          picker?.target === "gallery"
            ? "Add section photo"
            : "Section lead photo"
        }
        description="Browse Cloudinary library, upload from this device, or capture with the camera. Only images."
        onSelect={(id) => {
          if (picker?.target === "gallery") {
            setGallery((prev) => (prev.includes(id) ? prev : [...prev, id]));
          } else {
            setLeadId(id);
            setFocalX(0.5);
            setFocalY(0.45);
          }
          setPicker(null);
        }}
      />
    </div>
  );
}

function BlockFields({
  name,
  block,
  showAmount,
  uploadFolder,
}: {
  name: StorySectionKey;
  block: StoryBlock;
  showAmount?: boolean;
  uploadFolder: string;
}) {
  const p = (key: string) => `${name}.${key}`;
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name={p("enabled")}
            value="1"
            defaultChecked={block.enabled}
            className="size-4 rounded border"
          />
          Show section
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor={p("accent")} className="text-xs">
            Accent
          </Label>
          <select
            id={p("accent")}
            name={p("accent")}
            defaultValue={block.accent}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {ACCENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={p("eyebrow")}>Eyebrow</Label>
          <Input
            id={p("eyebrow")}
            name={p("eyebrow")}
            defaultValue={block.eyebrow}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={p("title")}>Title</Label>
          <Input id={p("title")} name={p("title")} defaultValue={block.title} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={p("body")}>Body</Label>
        <Textarea
          id={p("body")}
          name={p("body")}
          defaultValue={block.body}
          rows={3}
        />
      </div>

      <StoryImageFields
        name={name}
        block={block}
        uploadFolder={uploadFolder}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={p("primary_href")}>Primary link</Label>
          <Input
            id={p("primary_href")}
            name={p("primary_href")}
            defaultValue={block.primary_href}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={p("primary_label")}>Primary button</Label>
          <Input
            id={p("primary_label")}
            name={p("primary_label")}
            defaultValue={block.primary_label}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={p("secondary_href")}>Secondary link</Label>
          <Input
            id={p("secondary_href")}
            name={p("secondary_href")}
            defaultValue={block.secondary_href ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={p("secondary_label")}>Secondary button</Label>
          <Input
            id={p("secondary_label")}
            name={p("secondary_label")}
            defaultValue={block.secondary_label ?? ""}
          />
        </div>
      </div>

      {showAmount ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={p("amount_btn")}>Amount (BTN)</Label>
            <Input
              id={p("amount_btn")}
              name={p("amount_btn")}
              type="number"
              min={0}
              step={1}
              defaultValue={block.amount_btn ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={p("amount_note")}>Amount note</Label>
            <Input
              id={p("amount_note")}
              name={p("amount_note")}
              defaultValue={block.amount_note ?? ""}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function HomepageStoryEditor({
  story,
  hasUnpublishedChanges,
}: {
  story: HomepageStory;
  hasUnpublishedChanges: boolean;
}) {
  const [saveState, saveAction, savePending] = useActionState(
    saveHomepageStoryDraft,
    EMPTY,
  );
  const [publishState, publishAction, publishPending] = useActionState(
    publishHomepageStory,
    EMPTY,
  );

  const state = publishState.message || publishState.error ? publishState : saveState;
  const busy = savePending || publishPending;

  const funnel = story.funnel ?? {
    trust: true,
    proof: true,
    why: true,
    inHouse: true,
    faq: true,
    agents: true,
  };
  const headerSections = SECTION_META.filter((s) => s.group === "headers");
  const deepSections = SECTION_META.filter((s) => s.group === "deep");

  return (
    <form action={saveAction} className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {hasUnpublishedChanges
            ? "You have unpublished draft changes."
            : "Draft matches the live homepage."}{" "}
          Layout: conversion spine first, optional story bands after. Then{" "}
          <span className="font-medium text-foreground">Save draft</span> and{" "}
          <span className="font-medium text-foreground">Publish live</span>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {savePending ? "Saving…" : "Save draft"}
          </Button>
          <Button type="submit" formAction={publishAction} disabled={busy}>
            {publishPending ? "Publishing…" : "Publish live"}
          </Button>
        </div>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-emerald-700">{state.message}</p>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Conversion spine
          </h2>
          <p className="text-sm text-muted-foreground">
            Guest funnel after the hero: trust → proof → rooms → why →
            in-house → FAQ → agents. Toggle modules on or off (hero is always
            on; rooms use the section below).
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FUNNEL_META.map(({ key, label, hint }) => (
            <label
              key={key}
              className="flex cursor-pointer gap-3 rounded-xl border bg-card p-3"
            >
              <input
                type="checkbox"
                name={`funnel.${key}`}
                value="1"
                defaultChecked={funnel[key]}
                className="mt-0.5 size-4 shrink-0 rounded border"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  {label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="space-y-6 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Rooms &amp; brand headers
          </h2>
          <p className="text-sm text-muted-foreground">
            Rooms section sits in the spine. About is optional brand copy after
            proof.
          </p>
        </div>
        {headerSections.map(({ key, label, hint, folder, showAmount }) => (
          <section key={key} className="space-y-2">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {label}
              </h3>
              <p className="text-sm text-muted-foreground">{hint}</p>
            </div>
            <BlockFields
              name={key}
              block={story[key]}
              showAmount={showAmount}
              uploadFolder={folder}
            />
          </section>
        ))}
      </div>

      <div className="space-y-6 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Optional deep-dives
          </h2>
          <p className="text-sm text-muted-foreground">
            Long story bands after In-house. Leave off when the compact In-house
            strip is enough; lunch package is a commercial CTA.
          </p>
        </div>
        {deepSections.map(({ key, label, hint, folder, showAmount }) => (
          <section key={key} className="space-y-2">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {label}
              </h3>
              <p className="text-sm text-muted-foreground">{hint}</p>
            </div>
            <BlockFields
              name={key}
              block={story[key]}
              showAmount={showAmount}
              uploadFolder={folder}
            />
          </section>
        ))}
      </div>

      <DeskStickyActionBar>
        <Button type="submit" disabled={busy}>
          {savePending ? "Saving…" : "Save draft"}
        </Button>
        <Button type="submit" formAction={publishAction} disabled={busy}>
          {publishPending ? "Publishing…" : "Publish live"}
        </Button>
      </DeskStickyActionBar>
    </form>
  );
}
