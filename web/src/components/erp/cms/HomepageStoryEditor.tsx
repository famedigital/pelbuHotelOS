"use client";

import {
  publishHomepageStory,
  saveHomepageStoryDraft,
  type HomepageStoryState,
} from "@/app/actions/erp-homepage-story";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  HomepageStory,
  StoryBlock,
  StoryAccent,
} from "@/lib/home-story";
import { useActionState } from "react";

const EMPTY: HomepageStoryState = { ok: false };

const SECTION_META: {
  key: keyof HomepageStory;
  label: string;
  hint: string;
}[] = [
  {
    key: "about",
    label: "About Pelbu",
    hint: "Lucky-sign name story and rebrand brief.",
  },
  {
    key: "rooms",
    label: "Rooms",
    hint: "Section headers above live room cards.",
  },
  {
    key: "restaurant",
    label: "Restaurant",
    hint: "Chefs / dining teaser + menu highlights.",
  },
  {
    key: "lunch",
    label: "Lunch package",
    hint: "Day-visitor price (BTN pp) and CTA.",
  },
  {
    key: "cafe",
    label: "Cafe & menu",
    hint: "PELBU ZONE copy and showcase photo.",
  },
  {
    key: "spa",
    label: "Spa & steam",
    hint: "Wellness teaser; suite jacuzzi note.",
  },
];

const ACCENTS: StoryAccent[] = ["sky", "citrus", "mint", "spa", "espresso"];

function BlockFields({
  name,
  block,
  showAmount,
}: {
  name: keyof HomepageStory;
  block: StoryBlock;
  showAmount?: boolean;
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

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={p("public_id")}>Lead image public_id</Label>
          <Input
            id={p("public_id")}
            name={p("public_id")}
            defaultValue={block.public_id ?? ""}
            placeholder="pelbu/hotel/exterior"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={p("gallery_public_ids")}>
            Extra images (comma or newline)
          </Label>
          <Textarea
            id={p("gallery_public_ids")}
            name={p("gallery_public_ids")}
            defaultValue={block.gallery_public_ids.join("\n")}
            rows={2}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={p("focal_x")}>Focal X (0–1)</Label>
          <Input
            id={p("focal_x")}
            name={p("focal_x")}
            type="number"
            min={0}
            max={1}
            step={0.01}
            defaultValue={block.focal_x}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={p("focal_y")}>Focal Y (0–1)</Label>
          <Input
            id={p("focal_y")}
            name={p("focal_y")}
            type="number"
            min={0}
            max={1}
            step={0.01}
            defaultValue={block.focal_y}
          />
        </div>
      </div>

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

  return (
    <form action={saveAction} className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {hasUnpublishedChanges
            ? "You have unpublished draft changes."
            : "Draft matches the live homepage."}
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

      {SECTION_META.map(({ key, label, hint }) => (
        <section key={key} className="space-y-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{label}</h2>
            <p className="text-sm text-muted-foreground">{hint}</p>
          </div>
          <BlockFields
            name={key}
            block={story[key]}
            showAmount={key === "lunch"}
          />
        </section>
      ))}

      <div className="sticky bottom-4 flex justify-end gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur">
        <Button type="submit" disabled={busy}>
          {savePending ? "Saving…" : "Save draft"}
        </Button>
        <Button type="submit" formAction={publishAction} disabled={busy}>
          {publishPending ? "Publishing…" : "Publish live"}
        </Button>
      </div>
    </form>
  );
}
