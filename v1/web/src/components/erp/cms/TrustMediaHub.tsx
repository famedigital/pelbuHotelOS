"use client";

import {
  addPropertyMedia,
  deletePropertyMedia,
  movePropertyMedia,
  replacePropertyMediaAsset,
  updatePropertyMedia,
  updateStaffTeamVisibility,
  type PropertyMediaState,
} from "@/app/actions/erp-property-media";
import {
  CloudinaryPicker,
  type CloudinaryPickerSelection,
} from "@/components/erp/CloudinaryPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cloudinaryMediaThumbUrl,
  type CloudinaryResourceType,
} from "@/lib/cloudinary";
import {
  facetLabel,
  facetsForScope,
  trustMediaUploadFolder,
  type PropertyMediaRow,
  type PropertyMediaScope,
} from "@/lib/property-media";
import { cn } from "@/lib/utils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ImageIcon,
  PlusIcon,
  Trash2Icon,
  VideoIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState, useTransition } from "react";

const EMPTY: PropertyMediaState = { ok: false };

export type TrustEntity = {
  id: string;
  label: string;
  sublabel?: string;
};

export type TrustTeamStaff = TrustEntity & {
  phone: string | null;
  show_on_team: boolean;
  team_role_label: string | null;
  team_sort_order: number;
  role_label: string;
};

type TabKey =
  | "room_type"
  | "room_unit"
  | "property_area"
  | "menu_item"
  | "staff";

const TABS: { key: TabKey; label: string }[] = [
  { key: "room_type", label: "Room categories" },
  { key: "room_unit", label: "Each room" },
  { key: "property_area", label: "Property" },
  { key: "menu_item", label: "Food" },
  { key: "staff", label: "Team" },
];

function thumb(
  publicId: string,
  resourceType: CloudinaryResourceType = "image",
  poster?: string | null,
): string | null {
  return cloudinaryMediaThumbUrl(
    poster || publicId,
    poster ? "image" : resourceType,
    { width: 320, height: 200, crop: "fill" },
  );
}

function MediaRow({
  item,
  propCode,
}: {
  item: PropertyMediaRow;
  propCode: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updatePropertyMedia, EMPTY);
  const [replaceState, replaceAction, replacePending] = useActionState(
    replacePropertyMediaAsset,
    EMPTY,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingId, setPendingId] = useState(item.public_id);
  const [pendingType, setPendingType] = useState<CloudinaryResourceType>(
    item.resource_type,
  );
  const [, startRefresh] = useTransition();

  const src = thumb(
    pendingId,
    pendingType,
    item.poster_public_id,
  );

  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex gap-3">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              {item.resource_type === "video" ? (
                <VideoIcon className="size-5" />
              ) : (
                <ImageIcon className="size-5" />
              )}
            </div>
          )}
          {item.resource_type === "video" ? (
            <Badge className="absolute left-1 top-1 text-[10px]" variant="secondary">
              Video
            </Badge>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <form action={formAction} className="space-y-2">
            <input type="hidden" name="id" value={item.id} />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{facetLabel(item.facet)}</Badge>
              {item.is_primary ? (
                <Badge variant="secondary">Primary</Badge>
              ) : null}
              {!item.is_published ? (
                <Badge variant="destructive">Hidden</Badge>
              ) : null}
            </div>
            <Input name="alt" defaultValue={item.alt} placeholder="Alt text" />
            <Input
              name="caption"
              defaultValue={item.caption ?? ""}
              placeholder="Guest caption (honest)"
            />
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name="is_published"
                  value="on"
                  defaultChecked={item.is_published}
                  className="size-3.5"
                />
                Published
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name="is_primary"
                  value="on"
                  defaultChecked={item.is_primary}
                  className="size-3.5"
                />
                Primary card image
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPickerOpen(true)}
              >
                Replace
              </Button>
            </div>
          </form>
          <div className="flex flex-wrap gap-2">
            <form
              action={async (fd) => {
                fd.set("id", item.id);
                fd.set("direction", "up");
                await movePropertyMedia(EMPTY, fd);
                router.refresh();
              }}
            >
              <Button type="submit" size="icon" variant="ghost" title="Move up">
                <ArrowUpIcon className="size-3.5" />
              </Button>
            </form>
            <form
              action={async (fd) => {
                fd.set("id", item.id);
                fd.set("direction", "down");
                await movePropertyMedia(EMPTY, fd);
                router.refresh();
              }}
            >
              <Button type="submit" size="icon" variant="ghost" title="Move down">
                <ArrowDownIcon className="size-3.5" />
              </Button>
            </form>
            <form
              action={async (fd) => {
                fd.set("id", item.id);
                await deletePropertyMedia(EMPTY, fd);
                router.refresh();
              }}
            >
              <Button type="submit" size="icon" variant="ghost" title="Delete">
                <Trash2Icon className="size-3.5 text-destructive" />
              </Button>
            </form>
          </div>
          {state.error ? (
            <p className="text-xs text-destructive">{state.error}</p>
          ) : null}
          {state.message ? (
            <p className="text-xs text-emerald-700">{state.message}</p>
          ) : null}
          {replaceState.error ? (
            <p className="text-xs text-destructive">{replaceState.error}</p>
          ) : null}
        </div>
      </div>
      <CloudinaryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        uploadFolder={trustMediaUploadFolder(propCode, item.scope, item.facet)}
        acceptVideo
        onSelect={(publicId, meta) => {
          setPendingId(publicId);
          setPendingType(meta?.resourceType ?? "image");
          const fd = new FormData();
          fd.set("id", item.id);
          fd.set("public_id", publicId);
          fd.set("resource_type", meta?.resourceType ?? "image");
          if (meta) {
            fd.set("bytes", String(meta.bytes));
            fd.set("width", String(meta.width));
            fd.set("height", String(meta.height));
            if (meta.durationSec != null) {
              fd.set("duration_sec", String(meta.durationSec));
            }
            fd.set("format", meta.format);
          }
          startRefresh(async () => {
            await replaceAction(fd);
            router.refresh();
          });
          setPickerOpen(false);
        }}
      />
      {replacePending ? (
        <p className="mt-1 text-xs text-muted-foreground">Replacing…</p>
      ) : null}
    </li>
  );
}

function AddMediaForm({
  scope,
  scopeId,
  facet,
  propCode,
}: {
  scope: PropertyMediaScope;
  scopeId: string | null;
  facet: string;
  propCode: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(addPropertyMedia, EMPTY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [asset, setAsset] = useState<CloudinaryPickerSelection | null>(null);

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <p className="text-sm font-medium text-foreground">
        Add {facetLabel(facet)} photo or video
      </p>
      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="scope" value={scope} />
        {scopeId ? <input type="hidden" name="scope_id" value={scopeId} /> : null}
        <input type="hidden" name="facet" value={facet} />
        <input type="hidden" name="public_id" value={asset?.publicId ?? ""} />
        <input
          type="hidden"
          name="resource_type"
          value={asset?.resourceType ?? "image"}
        />
        {asset ? (
          <>
            <input type="hidden" name="bytes" value={asset.bytes} />
            <input type="hidden" name="width" value={asset.width} />
            <input type="hidden" name="height" value={asset.height} />
            <input type="hidden" name="format" value={asset.format} />
            {asset.durationSec != null ? (
              <input
                type="hidden"
                name="duration_sec"
                value={asset.durationSec}
              />
            ) : null}
          </>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
          >
            <PlusIcon className="size-3.5" />
            {asset ? "Change asset" : "Upload / pick"}
          </Button>
          {asset ? (
            <span className="self-center truncate text-xs text-muted-foreground">
              {asset.publicId}
            </span>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor={`alt-${facet}`}>Alt text</Label>
            <Input id={`alt-${facet}`} name="alt" placeholder="Describe the shot" />
          </div>
          <div>
            <Label htmlFor={`cap-${facet}`}>Caption</Label>
            <Input
              id={`cap-${facet}`}
              name="caption"
              placeholder="As guests will see it"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="is_primary" className="size-3.5" />
            Set as primary
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              name="is_published"
              defaultChecked
              value="on"
              className="size-3.5"
            />
            Publish to public site
          </label>
        </div>
        <Button type="submit" size="sm" disabled={pending || !asset}>
          Save media
        </Button>
        {state.error ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : null}
        {state.message ? (
          <p className="text-xs text-emerald-700">{state.message}</p>
        ) : null}
      </form>
      <CloudinaryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        uploadFolder={trustMediaUploadFolder(propCode, scope, facet)}
        acceptVideo
        initialTab="upload"
        onSelect={(publicId, meta) => {
          setAsset(
            meta ?? {
              publicId,
              resourceType: "image",
              format: "jpg",
              bytes: 0,
              width: 0,
              height: 0,
              durationSec: null,
            },
          );
          setPickerOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function TeamMemberCard({ staff }: { staff: TrustTeamStaff }) {
  const [state, formAction, pending] = useActionState(
    updateStaffTeamVisibility,
    EMPTY,
  );

  return (
    <form
      action={formAction}
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      <input type="hidden" name="staff_id" value={staff.id} />
      <div>
        <p className="font-medium text-foreground">{staff.label}</p>
        <p className="text-xs text-muted-foreground">
          {staff.phone ?? "No phone on file"}
        </p>
      </div>
      <div>
        <Label>Guest-facing role</Label>
        <Input
          name="team_role_label"
          defaultValue={staff.team_role_label ?? ""}
          placeholder={staff.role_label}
        />
      </div>
      <div>
        <Label>Sort order</Label>
        <Input
          name="team_sort_order"
          type="number"
          defaultValue={staff.team_sort_order}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="show_on_team"
          defaultChecked={staff.show_on_team}
          className="size-3.5"
        />
        Show on public Meet the team
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        Save team settings
      </Button>
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="text-xs text-emerald-700">{state.message}</p>
      ) : null}
    </form>
  );
}

export function TrustMediaHub({
  propCode,
  roomTypes,
  roomUnits,
  menuItems,
  staff,
  media,
  initialTab,
  initialScopeId,
}: {
  propCode: string;
  roomTypes: TrustEntity[];
  roomUnits: TrustEntity[];
  menuItems: TrustEntity[];
  staff: TrustTeamStaff[];
  media: PropertyMediaRow[];
  initialTab?: TabKey;
  initialScopeId?: string | null;
}) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? "room_type");
  const [entityId, setEntityId] = useState<string | null>(
    initialScopeId ??
      (initialTab === "room_type"
        ? roomTypes[0]?.id ?? null
        : initialTab === "room_unit"
          ? roomUnits[0]?.id ?? null
          : initialTab === "menu_item"
            ? menuItems[0]?.id ?? null
            : initialTab === "staff"
              ? staff[0]?.id ?? null
              : null),
  );
  const [facetFilter, setFacetFilter] = useState<string>("overview");

  const entities = useMemo(() => {
    if (tab === "room_type") return roomTypes;
    if (tab === "room_unit") return roomUnits;
    if (tab === "menu_item") return menuItems;
    if (tab === "staff") return staff;
    return [];
  }, [tab, roomTypes, roomUnits, menuItems, staff]);

  const scope: PropertyMediaScope =
    tab === "property_area" ? "property_area" : tab;

  const facets = facetsForScope(scope);

  // Default facet when switching tab
  const effectiveFacet = facets.includes(facetFilter)
    ? facetFilter
    : facets[0] ?? "other";

  const filtered = useMemo(() => {
    return media.filter((m) => {
      if (m.scope !== scope) return false;
      if (scope === "property_area") {
        return m.facet === effectiveFacet;
      }
      if (!entityId) return false;
      return m.scope_id === entityId && m.facet === effectiveFacet;
    });
  }, [media, scope, entityId, effectiveFacet]);

  const allForEntity = useMemo(() => {
    if (scope === "property_area") {
      return media.filter((m) => m.scope === "property_area");
    }
    if (!entityId) return [];
    return media.filter((m) => m.scope === scope && m.scope_id === entityId);
  }, [media, scope, entityId]);

  const facetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of facets) counts[f] = 0;
    for (const m of allForEntity) {
      counts[m.facet] = (counts[m.facet] ?? 0) + 1;
    }
    return counts;
  }, [allForEntity, facets]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              if (t.key === "room_type") setEntityId(roomTypes[0]?.id ?? null);
              else if (t.key === "room_unit")
                setEntityId(roomUnits[0]?.id ?? null);
              else if (t.key === "menu_item")
                setEntityId(menuItems[0]?.id ?? null);
              else if (t.key === "staff") setEntityId(staff[0]?.id ?? null);
              else setEntityId(null);
              setFacetFilter(
                t.key === "property_area"
                  ? "lobby"
                  : t.key === "menu_item"
                    ? "plated"
                    : t.key === "staff"
                      ? "portrait"
                      : "overview",
              );
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-sky-ink text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "property_area" ? (
        <div className="space-y-2">
          <Label>Select</Label>
          <select
            className="h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
            value={entityId ?? ""}
            onChange={(e) => setEntityId(e.target.value || null)}
          >
            <option value="">— Choose —</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
                {e.sublabel ? ` (${e.sublabel})` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Property-wide areas (lobby, reception, restaurant, cafe, bar, building,
          facilities). Guests see these on Gallery and related pages.
        </p>
      )}

      {tab === "staff" && entityId ? (
        <div className="grid gap-4 md:grid-cols-2">
          {staff
            .filter((s) => s.id === entityId)
            .map((s) => (
              <TeamMemberCard key={s.id} staff={s} />
            ))}
        </div>
      ) : null}

      {(scope === "property_area" || entityId) && tab !== "staff" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {facets.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFacetFilter(f)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                  effectiveFacet === f
                    ? "border-sky-700 bg-sky-50 text-sky-900"
                    : "border-border text-muted-foreground",
                )}
              >
                {facetLabel(f)}
                {facetCounts[f] ? (
                  <span className="ml-1 opacity-70">({facetCounts[f]})</span>
                ) : null}
              </button>
            ))}
          </div>

          <AddMediaForm
            scope={scope}
            scopeId={scope === "property_area" ? null : entityId}
            facet={effectiveFacet}
            propCode={propCode}
          />

          <ul className="grid gap-3 md:grid-cols-2">
            {filtered.map((item) => (
              <MediaRow key={item.id} item={item} propCode={propCode} />
            ))}
          </ul>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No photos for this shot type yet. Upload real on-property photos —
              empty stays empty.
            </p>
          ) : null}
        </>
      ) : null}

      {tab === "staff" && entityId ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {facetsForScope("staff").map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFacetFilter(f)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                  effectiveFacet === f
                    ? "border-sky-700 bg-sky-50 text-sky-900"
                    : "border-border text-muted-foreground",
                )}
              >
                {facetLabel(f)}
              </button>
            ))}
          </div>
          <AddMediaForm
            scope="staff"
            scopeId={entityId}
            facet={effectiveFacet === "at_work" ? "at_work" : "portrait"}
            propCode={propCode}
          />
          <ul className="grid gap-3 md:grid-cols-2">
            {media
              .filter(
                (m) =>
                  m.scope === "staff" &&
                  m.scope_id === entityId &&
                  m.facet ===
                    (effectiveFacet === "at_work" ? "at_work" : "portrait"),
              )
              .map((item) => (
                <MediaRow key={item.id} item={item} propCode={propCode} />
              ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
