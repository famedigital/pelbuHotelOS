"use client";

import {
  deleteRoomUnit,
  saveRoomTypeSettings,
  saveRoomUnitSettings,
} from "@/app/actions/erp-settings";
import { LiveRefreshBadge } from "@/components/erp/LiveRefreshBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ChevronsUpDownIcon,
  LayoutGridIcon,
  PlusIcon,
  RotateCcwIcon,
  Table2Icon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

export type RoomTypeOption = {
  id: string;
  code: string;
  name: string;
  inventory_kind: string;
  unit_count: number;
};

export type RoomUnitRow = {
  id: string;
  room_type_id: string;
  label: string;
  floor_label: string | null;
  notes: string | null;
  hk_status: string;
  sort_order: number;
};

export const ROOMS_VIEW_COOKIE = "pelbu_rooms_view";

export type RoomsView = "table" | "cards";

const INVENTORY_KINDS = [
  { value: "sellable_guest", label: "Sellable guest" },
  { value: "guide_comp", label: "Guide complimentary" },
  { value: "driver_comp", label: "Driver complimentary" },
  { value: "staff", label: "Staff" },
] as const;

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function hkDotClass(status: string): string {
  if (status === "clean") return "bg-emerald-500";
  if (status === "dirty") return "bg-rose-500";
  if (status === "inspect") return "bg-amber-500";
  if (status === "occupied") return "bg-sky-500";
  if (status === "ooo") return "bg-slate-500";
  return "bg-muted-foreground/40";
}

function HkBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className="gap-1.5 font-normal"
      title="Housekeeping status — change it on the housekeeping board"
    >
      <span className={cn("size-1.5 rounded-full", hkDotClass(status))} />
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

/** Server values change → remount the editor so drafts never show stale data. */
function roomRowKey(unit: RoomUnitRow): string {
  return [
    unit.id,
    unit.room_type_id,
    unit.label,
    unit.floor_label ?? "",
    unit.sort_order,
    unit.hk_status,
    unit.notes ?? "",
  ].join("|");
}

function roomTypeRowKey(type: RoomTypeOption): string {
  return [type.id, type.code, type.name, type.inventory_kind, type.unit_count].join(
    "|",
  );
}

type RoomDraft = {
  room_type_id: string;
  label: string;
  floor_label: string;
  sort_order: string;
  notes: string;
};

const ROOM_FIELDS = [
  "room_type_id",
  "label",
  "floor_label",
  "sort_order",
  "notes",
] as const;

function useRoomEditor(unit: RoomUnitRow, propertyId: string) {
  const router = useRouter();
  const base: RoomDraft = {
    room_type_id: unit.room_type_id,
    label: unit.label,
    floor_label: unit.floor_label ?? "",
    sort_order: String(unit.sort_order),
    notes: unit.notes ?? "",
  };
  const [draft, setDraft] = useState<RoomDraft>(base);
  const [pending, startTransition] = useTransition();

  const dirty = ROOM_FIELDS.some((field) => draft[field] !== base[field]);

  function setField(field: keyof RoomDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function save() {
    if (!draft.label.trim()) {
      toast.error("Room name or number is required.");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("property_id", propertyId);
      formData.set("room_type_id", draft.room_type_id);
      formData.set("room_unit_id", unit.id);
      formData.set("label", draft.label.trim());
      formData.set("floor_label", draft.floor_label.trim());
      formData.set("sort_order", draft.sort_order.trim());
      formData.set("notes", draft.notes.trim());
      const result = await saveRoomUnitSettings({ ok: false }, formData);
      if (result.ok) {
        toast.success(result.message ?? "Room saved");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not save room.");
      }
    });
  }

  function remove() {
    if (
      !window.confirm(
        `Delete room ${unit.label}? Rooms with calendar assignments cannot be deleted.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("property_id", propertyId);
      formData.set("room_type_id", unit.room_type_id);
      formData.set("room_unit_id", unit.id);
      try {
        await deleteRoomUnit(formData);
        toast.success(`Room ${unit.label} deleted`);
        router.refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : "";
        toast.error(
          message.includes("foreign key")
            ? `${unit.label} still has calendar assignments — move or cancel those stays first.`
            : message || "Could not delete room.",
        );
      }
    });
  }

  return {
    draft,
    setField,
    dirty,
    pending,
    save,
    remove,
    reset: () => setDraft(base),
  };
}

function RoomActions({
  dirty,
  pending,
  onSave,
  onReset,
  onDelete,
  className,
}: {
  dirty: boolean;
  pending: boolean;
  onSave: () => void;
  onReset: () => void;
  onDelete: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        size="sm"
        variant={dirty ? "default" : "outline"}
        onClick={onSave}
        disabled={pending || !dirty}
      >
        {pending ? "Saving…" : "Save"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onReset}
        disabled={pending || !dirty}
        title="Discard unsaved edits"
      >
        <RotateCcwIcon />
        <span className="sr-only">Discard edits</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10"
        onClick={onDelete}
        disabled={pending}
        title="Delete room"
      >
        <Trash2Icon />
        <span className="sr-only">Delete room</span>
      </Button>
    </div>
  );
}

function RoomTableRow({
  unit,
  propertyId,
  roomTypes,
}: {
  unit: RoomUnitRow;
  propertyId: string;
  roomTypes: RoomTypeOption[];
}) {
  const editor = useRoomEditor(unit, propertyId);
  const { draft, setField } = editor;

  return (
    <TableRow data-state={editor.dirty ? "selected" : undefined}>
      <TableCell className="px-3 py-2">
        <Input
          value={draft.label}
          onChange={(event) => setField("label", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") editor.save();
          }}
          aria-label={`Room name or number for ${unit.label}`}
          className="h-9 w-[132px] font-medium"
          required
        />
      </TableCell>
      <TableCell className="px-3 py-2">
        <select
          value={draft.room_type_id}
          onChange={(event) => setField("room_type_id", event.target.value)}
          aria-label={`Category for ${unit.label}`}
          className={cn(selectClass, "w-[168px]")}
        >
          {roomTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name} ({type.code})
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell className="px-3 py-2">
        <Input
          value={draft.floor_label}
          onChange={(event) => setField("floor_label", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") editor.save();
          }}
          aria-label={`Floor for ${unit.label}`}
          placeholder="—"
          className="h-9 w-[96px]"
        />
      </TableCell>
      <TableCell className="px-3 py-2">
        <Input
          value={draft.sort_order}
          onChange={(event) => setField("sort_order", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") editor.save();
          }}
          type="number"
          min={0}
          step={1}
          aria-label={`Rack order for ${unit.label}`}
          title="Row order on the calendar rack"
          className="h-9 w-[76px] tabular-nums"
        />
      </TableCell>
      <TableCell className="px-3 py-2">
        <Input
          value={draft.notes}
          onChange={(event) => setField("notes", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") editor.save();
          }}
          aria-label={`Notes for ${unit.label}`}
          placeholder="Optional notes"
          className="h-9 w-full min-w-[180px]"
        />
      </TableCell>
      <TableCell className="px-3 py-2">
        <HkBadge status={unit.hk_status} />
      </TableCell>
      <TableCell className="px-3 py-2">
        <RoomActions
          dirty={editor.dirty}
          pending={editor.pending}
          onSave={editor.save}
          onReset={editor.reset}
          onDelete={editor.remove}
          className="justify-end"
        />
      </TableCell>
    </TableRow>
  );
}

function RoomCard({
  unit,
  propertyId,
  roomTypes,
}: {
  unit: RoomUnitRow;
  propertyId: string;
  roomTypes: RoomTypeOption[];
}) {
  const editor = useRoomEditor(unit, propertyId);
  const { draft, setField } = editor;

  return (
    <Card
      className={cn(
        "gap-4 py-4",
        editor.dirty && "border-accent/60 ring-1 ring-accent/20",
      )}
    >
      <CardHeader className="gap-2 px-4">
        <div className="flex items-center justify-between gap-2">
          <Input
            value={draft.label}
            onChange={(event) => setField("label", event.target.value)}
            aria-label={`Room name or number for ${unit.label}`}
            className="h-9 max-w-[160px] font-medium"
            required
          />
          <HkBadge status={unit.hk_status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        <div className="space-y-1.5">
          <Label htmlFor={`card-type-${unit.id}`} className="text-xs">
            Category
          </Label>
          <select
            id={`card-type-${unit.id}`}
            value={draft.room_type_id}
            onChange={(event) => setField("room_type_id", event.target.value)}
            className={selectClass}
          >
            {roomTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} ({type.code})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`card-floor-${unit.id}`} className="text-xs">
              Floor
            </Label>
            <Input
              id={`card-floor-${unit.id}`}
              value={draft.floor_label}
              onChange={(event) => setField("floor_label", event.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`card-order-${unit.id}`} className="text-xs">
              Rack order
            </Label>
            <Input
              id={`card-order-${unit.id}`}
              value={draft.sort_order}
              onChange={(event) => setField("sort_order", event.target.value)}
              type="number"
              min={0}
              step={1}
              className="h-9 tabular-nums"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`card-notes-${unit.id}`} className="text-xs">
            Notes
          </Label>
          <Textarea
            id={`card-notes-${unit.id}`}
            value={draft.notes}
            onChange={(event) => setField("notes", event.target.value)}
            rows={2}
            placeholder="Optional notes"
          />
        </div>
      </CardContent>
      <CardFooter className="px-4">
        <RoomActions
          dirty={editor.dirty}
          pending={editor.pending}
          onSave={editor.save}
          onReset={editor.reset}
          onDelete={editor.remove}
        />
      </CardFooter>
    </Card>
  );
}

type CategoryDraft = {
  code: string;
  name: string;
  inventory_kind: string;
  unit_count: string;
};

const CATEGORY_FIELDS = [
  "code",
  "name",
  "inventory_kind",
  "unit_count",
] as const;

function CategoryTableRow({
  type,
  propertyId,
  actualRooms,
}: {
  type: RoomTypeOption;
  propertyId: string;
  actualRooms: number;
}) {
  const router = useRouter();
  const base: CategoryDraft = {
    code: type.code,
    name: type.name,
    inventory_kind: type.inventory_kind,
    unit_count: String(type.unit_count),
  };
  const [draft, setDraft] = useState<CategoryDraft>(base);
  const [pending, startTransition] = useTransition();
  const dirty = CATEGORY_FIELDS.some((field) => draft[field] !== base[field]);

  function setField(field: keyof CategoryDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function save() {
    const nextCount = Number(draft.unit_count);
    if (!draft.code.trim() || !draft.name.trim()) {
      toast.error("Code and category name are required.");
      return;
    }
    if (!Number.isInteger(nextCount) || nextCount < 0 || nextCount > 500) {
      toast.error("Room count must be a whole number between 0 and 500.");
      return;
    }
    if (nextCount < actualRooms) {
      const removed = actualRooms - nextCount;
      if (
        !window.confirm(
          `Lowering ${type.name} to ${nextCount} rooms retires ${removed} existing room${removed === 1 ? "" : "s"}. Continue?`,
        )
      ) {
        return;
      }
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("property_id", propertyId);
      formData.set("room_type_id", type.id);
      formData.set("code", draft.code.trim());
      formData.set("name", draft.name.trim());
      formData.set("inventory_kind", draft.inventory_kind);
      formData.set("unit_count", String(nextCount));
      const result = await saveRoomTypeSettings({ ok: false }, formData);
      if (result.ok) {
        toast.success(result.message ?? "Room category saved");
        router.refresh();
      } else {
        const error = result.error ?? "";
        toast.error(
          error.includes("foreign key")
            ? "Some rooms being retired still have calendar assignments — clear those stays first."
            : error || "Could not save room category.",
        );
      }
    });
  }

  return (
    <TableRow data-state={dirty ? "selected" : undefined}>
      <TableCell className="px-3 py-2">
        <Input
          value={draft.code}
          onChange={(event) => setField("code", event.target.value)}
          aria-label={`Code for ${type.name}`}
          className="h-9 w-[104px] font-mono text-xs"
          required
        />
      </TableCell>
      <TableCell className="px-3 py-2">
        <Input
          value={draft.name}
          onChange={(event) => setField("name", event.target.value)}
          aria-label={`Name for ${type.name}`}
          className="h-9 w-full min-w-[180px] font-medium"
          required
        />
      </TableCell>
      <TableCell className="px-3 py-2">
        <select
          value={draft.inventory_kind}
          onChange={(event) => setField("inventory_kind", event.target.value)}
          aria-label={`Inventory kind for ${type.name}`}
          className={cn(selectClass, "w-[188px]")}
        >
          {INVENTORY_KINDS.map((kind) => (
            <option key={kind.value} value={kind.value}>
              {kind.label}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Input
            value={draft.unit_count}
            onChange={(event) => setField("unit_count", event.target.value)}
            type="number"
            min={0}
            max={500}
            step={1}
            aria-label={`Number of rooms in ${type.name}`}
            className="h-9 w-[84px] tabular-nums"
            required
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {actualRooms} live
          </span>
        </div>
      </TableCell>
      <TableCell className="px-3 py-2 text-right">
        <Button
          type="button"
          size="sm"
          variant={dirty ? "default" : "outline"}
          onClick={save}
          disabled={pending || !dirty}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AddRoomForm({
  propertyId,
  roomTypes,
  defaultTypeId,
}: {
  propertyId: string;
  roomTypes: RoomTypeOption[];
  defaultTypeId: string;
}) {
  const router = useRouter();
  const [roomTypeId, setRoomTypeId] = useState(defaultTypeId);
  const [label, setLabel] = useState("");
  const [floorLabel, setFloorLabel] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!label.trim()) {
      toast.error("Room name or number is required.");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("property_id", propertyId);
      formData.set("room_type_id", roomTypeId);
      formData.set("label", label.trim());
      formData.set("floor_label", floorLabel.trim());
      formData.set("sort_order", sortOrder.trim());
      const result = await saveRoomUnitSettings({ ok: false }, formData);
      if (result.ok) {
        toast.success(`Room ${label.trim()} added`);
        setLabel("");
        setFloorLabel("");
        setSortOrder("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not add room.");
      }
    });
  }

  const selectedType = roomTypes.find((type) => type.id === roomTypeId);

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed bg-muted/20 p-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="add-room-type" className="text-xs">
          Category
        </Label>
        <select
          id="add-room-type"
          value={roomTypeId}
          onChange={(event) => setRoomTypeId(event.target.value)}
          className={cn(selectClass, "w-[188px]")}
        >
          {roomTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name} ({type.code})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="add-room-label" className="text-xs">
          Room name / number
        </Label>
        <Input
          id="add-room-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={
            selectedType ? `${selectedType.code.toUpperCase()}-01` : "101"
          }
          className="h-9 w-[152px]"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="add-room-floor" className="text-xs">
          Floor
        </Label>
        <Input
          id="add-room-floor"
          value={floorLabel}
          onChange={(event) => setFloorLabel(event.target.value)}
          className="h-9 w-[96px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="add-room-order" className="text-xs">
          Rack order
        </Label>
        <Input
          id="add-room-order"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          type="number"
          min={0}
          step={1}
          placeholder="Auto"
          className="h-9 w-[92px] tabular-nums"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending} className="h-9">
        <PlusIcon />
        {pending ? "Adding…" : "Add room"}
      </Button>
    </form>
  );
}

type SortKey = "label" | "category" | "floor_label" | "sort_order" | "hk_status";

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <TableHead
      className={cn(
        "h-10 bg-muted/40 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
        className,
      )}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-foreground"
      >
        {label}
        <ChevronsUpDownIcon
          className={cn("size-3", active ? "text-accent opacity-100" : "opacity-40")}
        />
      </button>
    </TableHead>
  );
}

export function RoomSettingsPanel({
  propertyId,
  roomTypes,
  units,
  initialView = "table",
}: {
  propertyId: string;
  roomTypes: RoomTypeOption[];
  units: RoomUnitRow[];
  initialView?: RoomsView;
}) {
  const [view, setView] = useState<RoomsView>(initialView);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("sort_order");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function changeView(next: RoomsView) {
    setView(next);
    document.cookie = `${ROOMS_VIEW_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  const typeById = useMemo(
    () => new Map(roomTypes.map((type) => [type.id, type])),
    [roomTypes],
  );

  const roomsPerType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const unit of units) {
      counts.set(unit.room_type_id, (counts.get(unit.room_type_id) ?? 0) + 1);
    }
    return counts;
  }, [units]);

  const visibleUnits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = units.filter((unit) => {
      if (typeFilter !== "all" && unit.room_type_id !== typeFilter) return false;
      if (!needle) return true;
      const type = typeById.get(unit.room_type_id);
      return [
        unit.label,
        unit.floor_label,
        unit.notes,
        unit.hk_status,
        type?.name,
        type?.code,
      ].some((value) => (value ?? "").toLowerCase().includes(needle));
    });

    const factor = sortDir === "asc" ? 1 : -1;
    const text = (value: string | null | undefined) => value ?? "";
    return [...filtered].sort((a, b) => {
      if (sortKey === "sort_order") {
        const delta = a.sort_order - b.sort_order;
        return factor * (delta !== 0 ? delta : a.label.localeCompare(b.label));
      }
      if (sortKey === "category") {
        const aName = text(typeById.get(a.room_type_id)?.name);
        const bName = text(typeById.get(b.room_type_id)?.name);
        return (
          factor *
          (aName.localeCompare(bName) ||
            a.label.localeCompare(b.label, undefined, { numeric: true }))
        );
      }
      if (sortKey === "floor_label") {
        return (
          factor *
          (text(a.floor_label).localeCompare(text(b.floor_label), undefined, {
            numeric: true,
          }) || a.label.localeCompare(b.label, undefined, { numeric: true }))
        );
      }
      if (sortKey === "hk_status") {
        return factor * a.hk_status.localeCompare(b.hk_status);
      }
      return (
        factor * a.label.localeCompare(b.label, undefined, { numeric: true })
      );
    });
  }, [query, sortDir, sortKey, typeById, typeFilter, units]);

  const addRoomTypeId =
    typeFilter !== "all" ? typeFilter : (roomTypes[0]?.id ?? "");

  if (roomTypes.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-5 md:p-6">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          No room categories yet
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Add a category above — the physical rooms table appears once at least
          one category exists.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5 md:p-6">
        <div className="mb-4 space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Categories
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Room categories and inventory
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Edit inline and save the row. Changing the count auto-adds or retires
            physical rooms; “live” is what exists right now.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <caption className="sr-only">Room categories</caption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 bg-muted/40 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Code
                </TableHead>
                <TableHead className="h-10 bg-muted/40 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Category
                </TableHead>
                <TableHead className="h-10 bg-muted/40 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Inventory kind
                </TableHead>
                <TableHead className="h-10 bg-muted/40 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Rooms
                </TableHead>
                <TableHead className="h-10 bg-muted/40 px-3 text-right text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Save
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomTypes.map((type) => (
                <CategoryTableRow
                  key={roomTypeRowKey(type)}
                  type={type}
                  propertyId={propertyId}
                  actualRooms={roomsPerType.get(type.id) ?? 0}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 md:p-6">
        <div className="mb-4 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              Physical rooms
            </p>
            <LiveRefreshBadge
              endpoint="/api/erp/rooms-version"
              intervalMs={10000}
              title="Polling for room setup changes"
            />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Room numbers, floors, and rack order
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Edit any cell and save the row. Switching a room’s category moves it
            and re-counts both categories. Rack order controls the row order on
            the calendar.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search room, floor, notes…"
            aria-label="Search rooms"
            className="h-9 max-w-[240px]"
          />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            aria-label="Filter by category"
            className={cn(selectClass, "w-[200px]")}
          >
            <option value="all">All categories</option>
            {roomTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} ({type.code})
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground tabular-nums">
            {visibleUnits.length} of {units.length} rooms
          </span>
          <div
            className="ml-auto inline-flex rounded-md border p-0.5"
            role="group"
            aria-label="Room view"
          >
            <Button
              type="button"
              size="sm"
              variant={view === "table" ? "secondary" : "ghost"}
              aria-pressed={view === "table"}
              onClick={() => changeView("table")}
              className="h-8"
            >
              <Table2Icon />
              Table
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "cards" ? "secondary" : "ghost"}
              aria-pressed={view === "cards"}
              onClick={() => changeView("cards")}
              className="h-8"
            >
              <LayoutGridIcon />
              Cards
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <AddRoomForm
            key={addRoomTypeId}
            propertyId={propertyId}
            roomTypes={roomTypes}
            defaultTypeId={addRoomTypeId}
          />
        </div>

        {view === "table" ? (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <caption className="sr-only">Physical rooms</caption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHeader
                    label="Room"
                    sortKey="label"
                    active={sortKey === "label"}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Category"
                    sortKey="category"
                    active={sortKey === "category"}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Floor"
                    sortKey="floor_label"
                    active={sortKey === "floor_label"}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Order"
                    sortKey="sort_order"
                    active={sortKey === "sort_order"}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <TableHead className="h-10 bg-muted/40 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Notes
                  </TableHead>
                  <SortHeader
                    label="HK"
                    sortKey="hk_status"
                    active={sortKey === "hk_status"}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <TableHead className="h-10 bg-muted/40 px-3 text-right text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleUnits.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={7}
                      className="h-20 text-center text-sm text-muted-foreground"
                    >
                      No rooms match this search.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleUnits.map((unit) => (
                    <RoomTableRow
                      key={roomRowKey(unit)}
                      unit={unit}
                      propertyId={propertyId}
                      roomTypes={roomTypes}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : visibleUnits.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No rooms match this search.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleUnits.map((unit) => (
              <RoomCard
                key={roomRowKey(unit)}
                unit={unit}
                propertyId={propertyId}
                roomTypes={roomTypes}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
