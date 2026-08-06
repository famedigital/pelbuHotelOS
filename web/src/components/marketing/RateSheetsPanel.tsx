"use client";

import {
  archiveRateSheet,
  createBlankRateSheet,
  rebuildRateSheetsFromMatrix,
  upsertRateSheet,
  type RateSheetActionState,
} from "@/app/actions/erp-rate-sheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  createBlock,
  parseGridPaste,
  type MarketingRateSheetRow,
  type RateSheetBlock,
  type RateSheetBlockType,
  type RateSheetBrand,
  type RateSheetDocument,
  type RateSheetTableBlock,
} from "@/lib/marketing/rate-sheet";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, type ClipboardEvent } from "react";
import { useRouter } from "next/navigation";

const initial: RateSheetActionState = { ok: false };

const TOOLBAR: { type: RateSheetBlockType; label: string; hint: string }[] = [
  { type: "heading", label: "Heading", hint: "Title line" },
  { type: "paragraph", label: "Text", hint: "Body typing" },
  { type: "banner", label: "Banner", hint: "Peak / highlight strip" },
  { type: "table", label: "Table", hint: "Rates grid" },
  { type: "cards", label: "Cards", hint: "Meal plans / tips" },
  { type: "note", label: "Note", hint: "Fine print" },
  { type: "divider", label: "Line", hint: "Divider" },
  {
    type: "property_contact",
    label: "Contact (settings)",
    hint: "Live phone/email/address from Settings",
  },
  { type: "free_html", label: "Free design", hint: "Advanced HTML" },
];

function Feedback({ state }: { state: RateSheetActionState }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      role="status"
      className={`text-sm ${state.error ? "text-destructive" : "text-emerald-700"}`}
    >
      {state.error ?? state.message}
    </p>
  );
}

function moveBlock(
  blocks: RateSheetBlock[],
  id: string,
  dir: -1 | 1,
): RateSheetBlock[] {
  const i = blocks.findIndex((b) => b.id === id);
  if (i < 0) return blocks;
  const j = i + dir;
  if (j < 0 || j >= blocks.length) return blocks;
  const next = [...blocks];
  const tmp = next[i]!;
  next[i] = next[j]!;
  next[j] = tmp;
  return next;
}

function bannerToneClass(tone: string): string {
  switch (tone) {
    case "teal":
      return "bg-teal-700 text-white";
    case "gold":
      return "bg-amber-500 text-stone-900";
    case "neutral":
      return "bg-muted text-foreground";
    default:
      return "bg-gradient-to-r from-orange-700 to-amber-500 text-white";
  }
}

function BrandHeader({
  brand,
  title,
  seasonLabel,
}: {
  brand: RateSheetBrand;
  title: string;
  seasonLabel: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#e8d5b8] pb-3">
      <div className="flex min-w-0 items-start gap-3">
        {brand.logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary dynamic; print-friendly
          <img
            src={brand.logoSrc}
            alt=""
            width={52}
            height={52}
            className="size-12 shrink-0 object-contain"
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-amber-700 uppercase">
            {brand.name}
          </p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {seasonLabel ? (
            <p className="mt-0.5 text-xs text-[#5c4033]">{seasonLabel}</p>
          ) : null}
        </div>
      </div>
      <div className="max-w-[40%] text-right text-[10px] leading-snug text-[#5c4033]">
        {brand.address ? <p>{brand.address}</p> : null}
        {brand.phone ? <p className="tabular-nums">{brand.phone}</p> : null}
      </div>
    </div>
  );
}

function PropertyContactBlock({ brand }: { brand: RateSheetBrand }) {
  const wa = brand.whatsapp?.replace(/\D+/g, "") || null;
  return (
    <div className="rounded-md border border-[#e8d5b8] bg-white px-4 py-3 text-sm text-[#3d2a22]">
      <p className="text-[10px] font-semibold tracking-[0.16em] text-amber-700 uppercase">
        Reservations · linked to Settings
      </p>
      <p className="mt-1 font-serif text-base font-semibold">{brand.name}</p>
      {brand.legalName && brand.legalName !== brand.name ? (
        <p className="text-xs text-[#5c4033]">{brand.legalName}</p>
      ) : null}
      <div className="mt-2 space-y-0.5 text-xs leading-relaxed">
        {brand.phone ? (
          <p>
            Phone{" "}
            <a href={`tel:${brand.phone}`} className="font-medium underline-offset-2 hover:underline">
              {brand.phone}
            </a>
          </p>
        ) : null}
        {wa ? (
          <p>
            WhatsApp{" "}
            <a
              href={`https://wa.me/${wa}`}
              className="font-medium underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {brand.whatsapp}
            </a>
          </p>
        ) : null}
        {brand.email ? (
          <p>
            Email{" "}
            <a
              href={`mailto:${brand.email}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              {brand.email}
            </a>
          </p>
        ) : null}
        {brand.webUrl ? (
          <p>
            Web{" "}
            <a
              href={brand.webUrl}
              className="font-medium underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {brand.webLabel ?? brand.webUrl}
            </a>
          </p>
        ) : null}
        {brand.address ? <p>{brand.address}</p> : null}
        {!brand.phone && !brand.email && !brand.address ? (
          <p className="text-amber-800">
            No contact saved yet.{" "}
            <Link href={brand.settingsHref} className="underline">
              Open Settings → Identity
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Live print-ish preview of the block document. */
function RateSheetPreview({
  title,
  seasonLabel,
  doc,
  brand,
}: {
  title: string;
  seasonLabel: string;
  doc: RateSheetDocument;
  brand: RateSheetBrand;
}) {
  return (
    <div className="rate-sheet-preview mx-auto max-w-[210mm] rounded-lg border border-border bg-[#fffaf3] p-6 text-[#1a0f0a] shadow-sm print:border-0 print:shadow-none">
      <BrandHeader brand={brand} title={title} seasonLabel={seasonLabel} />

      {doc.intro ? (
        <p className="mb-4 text-sm leading-relaxed text-[#3d2a22]">{doc.intro}</p>
      ) : null}

      <div className="space-y-4">
        {doc.blocks.map((block) => {
          switch (block.type) {
            case "heading": {
              const Tag = block.level === 1 ? "h2" : block.level === 3 ? "h4" : "h3";
              const size =
                block.level === 1
                  ? "text-xl"
                  : block.level === 3
                    ? "text-sm"
                    : "text-lg";
              return (
                <Tag
                  key={block.id}
                  className={`font-serif font-semibold ${size}`}
                >
                  {block.text}
                </Tag>
              );
            }
            case "paragraph":
              return (
                <p
                  key={block.id}
                  className="whitespace-pre-wrap text-sm leading-relaxed text-[#3d2a22]"
                >
                  {block.text}
                </p>
              );
            case "banner":
              return (
                <div
                  key={block.id}
                  className={`rounded-md px-4 py-3 ${bannerToneClass(block.tone)}`}
                >
                  {block.eyebrow ? (
                    <p className="text-[10px] font-semibold tracking-[0.16em] uppercase opacity-90">
                      {block.eyebrow}
                    </p>
                  ) : null}
                  {block.title ? (
                    <p className="mt-0.5 text-base font-semibold">{block.title}</p>
                  ) : null}
                  {block.body ? (
                    <p className="mt-1 text-xs leading-relaxed opacity-95">
                      {block.body}
                    </p>
                  ) : null}
                </div>
              );
            case "table":
              return (
                <div key={block.id} className="overflow-x-auto">
                  {block.caption ? (
                    <p className="mb-1 text-[11px] font-medium text-[#5c4033]">
                      {block.caption}
                    </p>
                  ) : null}
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b-2 border-[#c45c26] bg-[#fff6ea]">
                        {block.headers.map((h, i) => (
                          <th
                            key={i}
                            className="px-2 py-1.5 font-semibold text-[#1a0f0a]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, ri) => (
                        <tr
                          key={ri}
                          className="border-b border-[#e8d5b8] odd:bg-white even:bg-[#fffaf3]"
                        >
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1.5 tabular-nums">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            case "cards":
              return (
                <div
                  key={block.id}
                  className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {block.items.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-[#e8d5b8] bg-white px-3 py-2"
                    >
                      <p className="text-xs font-semibold text-[#c45c26]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[#3d2a22]">{item.body}</p>
                    </div>
                  ))}
                </div>
              );
            case "note":
              return (
                <p
                  key={block.id}
                  className="rounded-md border border-dashed border-[#e8d5b8] bg-[#fff6ea] px-3 py-2 text-[11px] leading-relaxed text-[#5c4033]"
                >
                  {block.text}
                </p>
              );
            case "divider":
              return (
                <hr key={block.id} className="border-t border-[#e8d5b8]" />
              );
            case "property_contact":
              return <PropertyContactBlock key={block.id} brand={brand} />;
            case "free_html":
              return (
                <div
                  key={block.id}
                  className="prose prose-sm max-w-none text-[#3d2a22] [&_table]:w-full [&_td]:border [&_td]:border-[#e8d5b8] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[#c45c26] [&_th]:bg-[#fff6ea] [&_th]:px-2 [&_th]:py-1"
                  dangerouslySetInnerHTML={{ __html: block.html }}
                />
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}

function TableBlockEditor({
  block,
  onChange,
}: {
  block: RateSheetTableBlock;
  onChange: (next: RateSheetTableBlock) => void;
}) {
  const colN = block.headers.length;

  function setHeader(i: number, value: string) {
    const headers = [...block.headers];
    headers[i] = value;
    onChange({ ...block, headers });
  }

  function setCell(ri: number, ci: number, value: string) {
    const rows = block.rows.map((r) => [...r]);
    if (!rows[ri]) return;
    rows[ri]![ci] = value;
    onChange({ ...block, rows });
  }

  function addRow() {
    onChange({
      ...block,
      rows: [...block.rows, Array.from({ length: colN }, () => "")],
    });
  }

  function removeRow(ri: number) {
    if (block.rows.length <= 1) return;
    onChange({
      ...block,
      rows: block.rows.filter((_, i) => i !== ri),
    });
  }

  function addCol() {
    onChange({
      ...block,
      headers: [...block.headers, `Col ${colN + 1}`],
      rows: block.rows.map((r) => [...r, ""]),
    });
  }

  function removeCol() {
    if (colN <= 1) return;
    onChange({
      ...block,
      headers: block.headers.slice(0, -1),
      rows: block.rows.map((r) => r.slice(0, -1)),
    });
  }

  function onPaste(
    e: ClipboardEvent,
    startRi: number,
    startCi: number,
  ) {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const grid = parseGridPaste(text);
    if (!grid.length) return;

    let headers = [...block.headers];
    let rows = block.rows.map((r) => [...r]);
    const needCols = startCi + Math.max(...grid.map((g) => g.length));
    while (headers.length < needCols) {
      headers.push(`Col ${headers.length + 1}`);
      rows = rows.map((r) => [...r, ""]);
    }
    for (let gi = 0; gi < grid.length; gi++) {
      const ri = startRi + gi;
      while (rows.length <= ri) {
        rows.push(Array.from({ length: headers.length }, () => ""));
      }
      for (let gj = 0; gj < grid[gi]!.length; gj++) {
        const ci = startCi + gj;
        if (ci < headers.length) {
          rows[ri]![ci] = grid[gi]![gj] ?? "";
        }
      }
    }
    onChange({ ...block, headers, rows });
  }

  return (
    <div className="space-y-2">
      <Input
        value={block.caption}
        onChange={(e) => onChange({ ...block, caption: e.target.value })}
        placeholder="Table caption (optional)"
        className="max-w-md text-sm"
      />
      <p className="text-[11px] text-muted-foreground">
        Tip: paste from Excel / Google Sheets — select a cell and Ctrl+V.
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              {block.headers.map((h, i) => (
                <th key={i} className="border-b border-border p-1">
                  <input
                    value={h}
                    onChange={(e) => setHeader(i, e.target.value)}
                    className="w-full min-w-[4.5rem] bg-transparent px-1 py-1 text-xs font-semibold outline-none"
                    aria-label={`Header ${i + 1}`}
                  />
                </th>
              ))}
              <th className="w-8 border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border-b border-border/70 p-0.5">
                    <input
                      value={cell}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      onPaste={(e) => onPaste(e, ri, ci)}
                      className="w-full min-w-[4.5rem] rounded px-1.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                      aria-label={`Row ${ri + 1} col ${ci + 1}`}
                    />
                  </td>
                ))}
                <td className="border-b border-border/70 p-0.5">
                  <button
                    type="button"
                    onClick={() => removeRow(ri)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    aria-label="Remove row"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={addRow}>
          + Row
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={addCol}>
          + Column
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={removeCol}>
          − Last column
        </Button>
      </div>
    </div>
  );
}

function BlockEditor({
  block,
  index,
  total,
  brand,
  onChange,
  onRemove,
  onMove,
  onDuplicate,
}: {
  block: RateSheetBlock;
  index: number;
  total: number;
  brand: RateSheetBrand;
  onChange: (b: RateSheetBlock) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          {block.type.replace("_", " ")} · #{index + 1}
        </p>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label="Move up"
          >
            <ArrowUpIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={index >= total - 1}
            onClick={() => onMove(1)}
            aria-label="Move down"
          >
            <ArrowDownIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={onDuplicate}
            aria-label="Duplicate"
          >
            <CopyIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 text-destructive"
            onClick={onRemove}
            aria-label="Remove block"
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      </div>

      {block.type === "heading" ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={block.level}
              onChange={(e) =>
                onChange({
                  ...block,
                  level: Number(e.target.value) as 1 | 2 | 3,
                })
              }
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value={1}>H1 large</option>
              <option value={2}>H2</option>
              <option value={3}>H3 small</option>
            </select>
            <Input
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
              className="flex-1 font-semibold"
            />
          </div>
        </div>
      ) : null}

      {block.type === "paragraph" || block.type === "note" ? (
        <Textarea
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          rows={block.type === "note" ? 3 : 4}
          className="text-sm"
        />
      ) : null}

      {block.type === "banner" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Tone</Label>
            <select
              value={block.tone}
              onChange={(e) =>
                onChange({
                  ...block,
                  tone: e.target.value as typeof block.tone,
                })
              }
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="peak">Peak (copper/gold)</option>
              <option value="teal">Teal</option>
              <option value="gold">Gold</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Eyebrow</Label>
            <Input
              value={block.eyebrow}
              onChange={(e) =>
                onChange({ ...block, eyebrow: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input
              value={block.title}
              onChange={(e) => onChange({ ...block, title: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Body</Label>
            <Textarea
              value={block.body}
              onChange={(e) => onChange({ ...block, body: e.target.value })}
              rows={2}
            />
          </div>
        </div>
      ) : null}

      {block.type === "table" ? (
        <TableBlockEditor
          block={block}
          onChange={(next) => onChange(next)}
        />
      ) : null}

      {block.type === "cards" ? (
        <div className="space-y-3">
          {block.items.map((item, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-md border border-border/60 p-2 sm:grid-cols-2"
            >
              <Input
                value={item.title}
                placeholder="Title"
                onChange={(e) => {
                  const items = block.items.map((it, j) =>
                    j === i ? { ...it, title: e.target.value } : it,
                  );
                  onChange({ ...block, items });
                }}
              />
              <div className="flex gap-1">
                <Input
                  value={item.body}
                  placeholder="Body"
                  className="flex-1"
                  onChange={(e) => {
                    const items = block.items.map((it, j) =>
                      j === i ? { ...it, body: e.target.value } : it,
                    );
                    onChange({ ...block, items });
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() =>
                    onChange({
                      ...block,
                      items: block.items.filter((_, j) => j !== i),
                    })
                  }
                  aria-label="Remove card"
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({
                ...block,
                items: [...block.items, { title: "New", body: "" }],
              })
            }
          >
            + Card
          </Button>
        </div>
      ) : null}

      {block.type === "divider" ? (
        <p className="text-xs text-muted-foreground">Horizontal rule</p>
      ) : null}

      {block.type === "property_contact" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Live from{" "}
            <Link
              href={brand.settingsHref}
              className="font-medium text-sky-700 underline-offset-2 hover:underline"
            >
              Settings → Identity
            </Link>
            : logo, hotel name, phone, WhatsApp, email, address, website. Change
            them there — this block updates automatically.
          </p>
          <PropertyContactBlock brand={brand} />
        </div>
      ) : null}

      {block.type === "free_html" ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            Advanced: paste tables or custom layout HTML. Scripts are stripped
            on save. Use for complex free designs your staff needs.
          </p>
          <Textarea
            value={block.html}
            onChange={(e) => onChange({ ...block, html: e.target.value })}
            rows={8}
            className="font-mono text-xs"
            spellCheck={false}
          />
        </div>
      ) : null}
    </div>
  );
}

function RateSheetEditorForm({
  sheet,
  brand,
  onClose,
}: {
  sheet: MarketingRateSheetRow;
  brand: RateSheetBrand;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(sheet.title);
  const [slug, setSlug] = useState(sheet.slug);
  const [audience, setAudience] = useState(sheet.audience);
  const [status, setStatus] = useState(sheet.status);
  const [seasonLabel, setSeasonLabel] = useState(sheet.season_label ?? "");
  const [notes, setNotes] = useState(sheet.notes ?? "");
  const [intro, setIntro] = useState(sheet.document.intro ?? "");
  const [blocks, setBlocks] = useState<RateSheetBlock[]>(sheet.document.blocks);
  const [tab, setTab] = useState<"design" | "preview">("design");

  const documentJson = useMemo(
    () =>
      JSON.stringify({
        version: 1,
        intro,
        blocks,
      } satisfies RateSheetDocument),
    [intro, blocks],
  );

  const [state, action, pending] = useActionState(upsertRateSheet, initial);
  useActionToast(state, { successMessage: "Rate sheet saved" });

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  function updateBlock(id: string, next: RateSheetBlock) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? next : b)));
  }

  function addBlock(type: RateSheetBlockType) {
    setBlocks((prev) => [...prev, createBlock(type)]);
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
            Editing rate sheet
          </p>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            Print preview
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {brand.logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoSrc}
            alt=""
            width={28}
            height={28}
            className="size-7 object-contain"
          />
        ) : (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            No logo
          </span>
        )}
        <span className="font-medium text-foreground">{brand.name}</span>
        {brand.phone ? <span className="tabular-nums">{brand.phone}</span> : null}
        {brand.email ? <span>{brand.email}</span> : null}
        <Link
          href={brand.settingsHref}
          className="ml-auto font-medium text-sky-700 underline-offset-2 hover:underline"
        >
          Edit in Settings → Identity
        </Link>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="sheet_id" value={sheet.id} />
        <input type="hidden" name="document_json" value={documentJson} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rs-title">Title</Label>
            <Input
              id="rs-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-slug">Slug</Label>
            <Input
              id="rs-slug"
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-season">Season label</Label>
            <Input
              id="rs-season"
              name="season_label"
              value={seasonLabel}
              onChange={(e) => setSeasonLabel(e.target.value)}
              placeholder="Peak Sep–Nov 2026"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-audience">Audience</Label>
            <select
              id="rs-audience"
              name="audience"
              value={audience}
              onChange={(e) =>
                setAudience(e.target.value as typeof audience)
              }
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="public">Public / guest</option>
              <option value="agents">Agents</option>
              <option value="partners">Partners</option>
              <option value="custom">Custom / free design</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-status">Status</Label>
            <select
              id="rs-status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="published">Published (desk ready)</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rs-notes">Internal notes</Label>
            <Input
              id="rs-notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Only staff see this"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rs-intro">Intro (top paragraph)</Label>
          <Textarea
            id="rs-intro"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={2}
          />
        </div>

        <div className="flex flex-wrap gap-2 border-y border-border py-2">
          <Button
            type="button"
            size="sm"
            variant={tab === "design" ? "default" : "outline"}
            onClick={() => setTab("design")}
          >
            Design
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "preview" ? "default" : "outline"}
            onClick={() => setTab("preview")}
          >
            Live preview
          </Button>
          <span className="self-center text-xs text-muted-foreground">
            Add blocks below — tables, text, banners, or free HTML design
          </span>
        </div>

        {tab === "design" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {TOOLBAR.map((t) => (
                <Button
                  key={t.type}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  title={t.hint}
                  onClick={() => addBlock(t.type)}
                >
                  <PlusIcon className="size-3.5" />
                  {t.label}
                </Button>
              ))}
            </div>

            {blocks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Empty canvas — add a table or free design block to start.
              </p>
            ) : (
              <div className="space-y-3">
                {blocks.map((block, index) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    index={index}
                    total={blocks.length}
                    brand={brand}
                    onChange={(next) => updateBlock(block.id, next)}
                    onRemove={() =>
                      setBlocks((prev) => prev.filter((b) => b.id !== block.id))
                    }
                    onMove={(dir) =>
                      setBlocks((prev) => moveBlock(prev, block.id, dir))
                    }
                    onDuplicate={() =>
                      setBlocks((prev) => {
                        const i = prev.findIndex((b) => b.id === block.id);
                        if (i < 0) return prev;
                        const copy = {
                          ...structuredClone(block),
                          id: crypto.randomUUID(),
                        } as RateSheetBlock;
                        const next = [...prev];
                        next.splice(i + 1, 0, copy);
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <RateSheetPreview
            title={title}
            seasonLabel={seasonLabel}
            doc={{ version: 1, intro, blocks }}
            brand={brand}
          />
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save rate sheet"}
          </Button>
          <Feedback state={state} />
        </div>
      </form>
    </div>
  );
}

export function RateSheetsPanel({
  sheets,
  brand,
}: {
  sheets: MarketingRateSheetRow[];
  brand: RateSheetBrand;
}) {
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null);
  const editSheet = editId
    ? (sheets.find((s) => s.id === editId) ?? null)
    : null;

  const [rebuildState, rebuildAction, rebuildPending] = useActionState(
    rebuildRateSheetsFromMatrix,
    initial,
  );
  const [blankState, blankAction, blankPending] = useActionState(
    createBlankRateSheet,
    initial,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveRateSheet,
    initial,
  );

  useActionToast(rebuildState);
  useActionToast(blankState);
  useActionToast(archiveState);

  useEffect(() => {
    if (rebuildState.ok && rebuildState.id) {
      setEditId(rebuildState.id);
      router.refresh();
    } else if (rebuildState.ok) {
      router.refresh();
    }
  }, [rebuildState.ok, rebuildState.id, router]);

  useEffect(() => {
    if (blankState.ok && blankState.id) {
      setEditId(blankState.id);
      router.refresh();
    }
  }, [blankState.ok, blankState.id, router]);

  useEffect(() => {
    if (archiveState.ok) {
      setEditId(null);
      router.refresh();
    }
  }, [archiveState.ok, router]);

  if (editSheet) {
    return (
      <RateSheetEditorForm
        key={editSheet.id + editSheet.updated_at}
        sheet={editSheet}
        brand={brand}
        onClose={() => setEditId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-2xl space-y-2">
        <h3 className="text-base font-semibold tracking-tight">Rate cards</h3>
        <p className="text-sm text-muted-foreground">
          Print/share cards only. All Nu comes from{" "}
          <Link
            href="/erp/rates"
            className="font-medium text-sky-700 underline-offset-2 hover:underline"
          >
            Hotel → Room rates
          </Link>{" "}
          (public, agents, friends, seasons, single/double). Rebuild deletes old
          sheets (beta) and regenerates from the live matrix. Logo and contact
          always come from{" "}
          <Link
            href={brand.settingsHref}
            className="font-medium text-sky-700 underline-offset-2 hover:underline"
          >
            Settings → Identity
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
        {brand.logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoSrc}
            alt=""
            width={36}
            height={36}
            className="size-9 object-contain"
          />
        ) : null}
        <div className="min-w-0">
          <p className="font-medium text-foreground">{brand.name}</p>
          <p className="text-xs text-muted-foreground">
            {[brand.phone, brand.email, brand.webLabel]
              .filter(Boolean)
              .join(" · ") || "Add phone & email in Settings → Identity"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <form action={rebuildAction}>
          <Button type="submit" disabled={rebuildPending} variant="citrus">
            {rebuildPending
              ? "Rebuilding…"
              : "Rebuild from Room rates (delete old)"}
          </Button>
        </form>
        <form action={blankAction}>
          <input type="hidden" name="title" value="Free design rate sheet" />
          <Button type="submit" disabled={blankPending} variant="outline">
            {blankPending ? "Creating…" : "New free design"}
          </Button>
        </form>
        <Link
          href="/erp/rates"
          className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm hover:bg-muted"
        >
          Edit Nu on Room rates →
        </Link>
      </div>

      <Feedback state={rebuildState} />
      <Feedback state={blankState} />

      {sheets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No rate sheets yet. Rebuild from Room rates, or create a free design
          for one-off layouts.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {sheets.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground">
                  {s.audience} · {s.status}
                  {s.season_label ? ` · ${s.season_label}` : ""} ·{" "}
                  {s.document.blocks.length} blocks · updated{" "}
                  {new Date(s.updated_at).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Thimphu",
                  })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setEditId(s.id)}
                >
                  Edit
                </Button>
                <form action={archiveAction}>
                  <input type="hidden" name="sheet_id" value={s.id} />
                  <Button
                    type="submit"
                    size="sm"
                    variant="ghost"
                    disabled={archivePending}
                  >
                    Archive
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
