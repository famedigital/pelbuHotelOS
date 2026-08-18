"use client";

import {
  applyBuildingLayout,
  completeBuildingSetup,
  previewBuildingPack,
  resetBuildingSetup,
  type BuildingActionState,
} from "@/app/actions/erp-building-layout";
import { Button } from "@/components/ui/button";
import {
  defaultAmenityKindsForFloor,
  PROGRAM_KIND_OPTIONS,
  spaceKindLabel,
} from "@/lib/building/amenity-defaults";
import {
  facadeWingLabel,
  floorStructure,
  structureBandStyle,
} from "@/lib/building/geometry";
import {
  floorCardBlurb,
  suggestFloors,
} from "@/lib/building/pack-dual-corridor";
import type {
  BuildingFloor,
  BuildingSpaceKind,
  CorridorAxis,
  FloorWingSummary,
  PropertyBuildingLayout,
} from "@/lib/building/types";
import { cn } from "@/lib/utils";
import { useActionToast } from "@/hooks/use-action-toast";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

const initial: BuildingActionState = { ok: false };

type Step = 1 | 2 | 3 | 4 | 5;

function FloorWingCards({
  summaries,
  axis,
}: {
  summaries: FloorWingSummary[];
  axis: CorridorAxis;
}) {
  const structure = floorStructure(axis);
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {summaries.map((s) => (
        <li
          key={s.floor_key}
          className="rounded-lg border border-border bg-card px-3 py-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {s.floor_label}
              </p>
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                {s.kind}
                {s.floor_key !== "_unmatched" ? ` · key ${s.floor_key}` : ""}
              </p>
            </div>
            {s.kind === "guest" ? (
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                {s.front.count + s.back.count} rooms
              </span>
            ) : null}
          </div>

          {s.floor_key === "_unmatched" ? (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
              {s.unmatched.length
                ? s.unmatched.join(", ")
                : "None"}
            </p>
          ) : s.kind === "guest" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-sky-500/25 bg-sky-500/5 px-2 py-1.5">
                <p className="text-[10px] font-semibold tracking-wide text-sky-800 uppercase dark:text-sky-200">
                  Front
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {facadeWingLabel(structure.front.facade, "front")}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                  {s.front.count}
                </p>
                {s.front.labels.length ? (
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                    {s.front.labels.join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-2 py-1.5">
                <p className="text-[10px] font-semibold tracking-wide text-amber-900 uppercase dark:text-amber-100">
                  Back
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {facadeWingLabel(structure.back.facade, "back")}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                  {s.back.count}
                </p>
                {s.back.labels.length ? (
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                    {s.back.labels.join(", ")}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Public / service floor — amenity blocks only
              {s.amenities?.length
                ? `: ${s.amenities.join(", ")}`
                : ""}
            </p>
          )}

          {s.kind === "guest" ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {floorCardBlurb(s)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function BuildingWizard({
  layout,
  onClose,
  startOpen = false,
}: {
  layout: PropertyBuildingLayout | null;
  onClose?: () => void;
  startOpen?: boolean;
}) {
  const router = useRouter();
  const setupDone = Boolean(layout?.setup_completed_at);
  const [open, setOpen] = useState(startOpen || !setupDone);
  const [step, setStep] = useState<Step>(1);

  const [includeGround, setIncludeGround] = useState(true);
  const [includeFirstPublic, setIncludeFirstPublic] = useState(
    () => layout?.floors?.some((f) => f.key === "1") ?? true,
  );
  const [includeAttic, setIncludeAttic] = useState(true);
  const [guestCount, setGuestCount] = useState(4);
  const [guestKeys, setGuestKeys] = useState("2,3,4,5");
  const [floors, setFloors] = useState<BuildingFloor[]>(() =>
    layout?.floors?.length
      ? layout.floors
      : suggestFloors({
          includeGround: true,
          includeFirstPublic: true,
          guestFloorCount: 4,
          includeAttic: true,
          guestKeys: ["2", "3", "4", "5"],
        }),
  );
  const [axis, setAxis] = useState<CorridorAxis>(
    layout?.corridor_axis ?? "ew",
  );

  const [program, setProgram] = useState<
    Record<string, BuildingSpaceKind[]>
  >(() => {
    const map: Record<string, BuildingSpaceKind[]> = {};
    for (const f of floors) {
      map[f.key] = defaultAmenityKindsForFloor(f);
    }
    return map;
  });

  const [previewSummaries, setPreviewSummaries] = useState<
    FloorWingSummary[]
  >([]);
  const [previewPending, startPreview] = useTransition();
  const [includeComp, setIncludeComp] = useState(false);

  const [applyState, applyAction, applyPending] = useActionState(
    applyBuildingLayout,
    initial,
  );
  const [completeState, completeAction, completePending] = useActionState(
    completeBuildingSetup,
    initial,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetBuildingSetup,
    initial,
  );

  useActionToast(applyState);
  useActionToast(completeState);
  useActionToast(resetState);

  useEffect(() => {
    if (applyState.ok && applyState.summaries) {
      setPreviewSummaries(applyState.summaries);
      setStep(5);
      router.refresh();
    }
  }, [applyState.ok, applyState.summaries, router]);

  useEffect(() => {
    if (completeState.ok) {
      setOpen(false);
      onClose?.();
      router.refresh();
    }
  }, [completeState.ok, onClose, router]);

  useEffect(() => {
    if (resetState.ok) {
      setOpen(true);
      setStep(1);
      router.refresh();
    }
  }, [resetState.ok, router]);

  const rebuildFloorsFromForm = useCallback(() => {
    const keys = guestKeys
      .split(/[,\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    const next = suggestFloors({
      includeGround,
      includeFirstPublic,
      guestFloorCount: guestCount,
      includeAttic,
      guestKeys: keys.length ? keys : undefined,
    });
    setFloors(next);
    setProgram((prev) => {
      const map: Record<string, BuildingSpaceKind[]> = {};
      for (const f of next) {
        map[f.key] = prev[f.key] ?? defaultAmenityKindsForFloor(f);
      }
      return map;
    });
  }, [guestCount, guestKeys, includeAttic, includeFirstPublic, includeGround]);

  const runPreview = useCallback(() => {
    startPreview(async () => {
      const res = await previewBuildingPack(floors, axis, includeComp);
      setPreviewSummaries(res.summaries);
    });
  }, [axis, floors, includeComp]);

  useEffect(() => {
    if (step === 4) runPreview();
  }, [step, runPreview]);

  const structurePreview = useMemo(() => floorStructure(axis), [axis]);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setOpen(true);
            setStep(1);
          }}
        >
          Building setup
        </Button>
        {setupDone ? (
          <form action={resetAction}>
            <input type="hidden" name="keep_rooms" value="1" />
            <input type="hidden" name="wipe_spaces" value="0" />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              disabled={resetPending}
              onClick={(e) => {
                if (
                  !confirm(
                    "Re-run building setup? Layout draft will clear (room positions kept).",
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              Re-run setup
            </Button>
          </form>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            Building wizard
          </p>
          <h2 className="text-lg font-semibold tracking-tight">
            Dual-corridor hotel massing
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Define floors, front/back room wings, and lobby/F&amp;B blocks.
            Generate a 2D plan, then use 3D as a live extrusion — not a second
            editor.
          </p>
        </div>
        {setupDone ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              onClose?.();
            }}
          >
            Close
          </Button>
        ) : null}
      </div>

      <ol className="flex flex-wrap gap-1.5">
        {(
          [
            [1, "Floors"],
            [2, "Template"],
            [3, "Program"],
            [4, "Rooms"],
            [5, "Confirm"],
          ] as const
        ).map(([n, label]) => (
          <li key={n}>
            <button
              type="button"
              onClick={() => setStep(n)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                step === n
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-input text-muted-foreground hover:bg-muted",
              )}
            >
              {n}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeGround}
                onChange={(e) => setIncludeGround(e.target.checked)}
              />
              Ground (lobby / bistro / spa / steam)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeFirstPublic}
                onChange={(e) => setIncludeFirstPublic(e.target.checked)}
              />
              First floor (restaurant / meeting)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeAttic}
                onChange={(e) => setIncludeAttic(e.target.checked)}
              />
              Attic / roof service
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Guest floors</span>
              <input
                type="number"
                min={1}
                max={12}
                value={guestCount}
                onChange={(e) =>
                  setGuestCount(Math.max(1, Number(e.target.value) || 1))
                }
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">
                Guest keys (match room numbers, e.g. 2,3,4,5)
              </span>
              <input
                type="text"
                value={guestKeys}
                onChange={(e) => setGuestKeys(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-sm"
              />
            </label>
          </div>
          <Button type="button" onClick={rebuildFloorsFromForm}>
            Build floor stack
          </Button>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {floors.map((f) => (
              <li
                key={f.key}
                className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"
              >
                <p className="font-medium">{f.label}</p>
                <p className="text-xs text-muted-foreground">
                  key <span className="font-mono">{f.key}</span> · {f.kind}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setStep(2)}>
              Next: Template
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Dual wing + long corridor. Rooms place on <strong>front</strong>{" "}
            and <strong>back</strong> of each guest floor.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={axis === "ew" ? "default" : "outline"}
              onClick={() => setAxis("ew")}
            >
              Corridor E–W (rooms N/S)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={axis === "ns" ? "default" : "outline"}
              onClick={() => setAxis("ns")}
            >
              Corridor N–S (rooms E/W)
            </Button>
          </div>
          <div className="relative h-44 w-full max-w-md overflow-hidden rounded-lg border bg-muted/20">
            <div
              className="absolute rounded-sm bg-muted-foreground/15"
              style={structureBandStyle(structurePreview, "front")}
            >
              <span className="absolute top-1 left-2 text-[10px] font-medium">
                Front wing
              </span>
            </div>
            <div
              className="absolute rounded-sm bg-amber-500/20"
              style={structureBandStyle(structurePreview, "corridor")}
            >
              <span className="absolute top-1 left-2 text-[10px] font-medium">
                Corridor
              </span>
            </div>
            <div
              className="absolute rounded-sm bg-muted-foreground/15"
              style={structureBandStyle(structurePreview, "back")}
            >
              <span className="absolute top-1 left-2 text-[10px] font-medium">
                Back wing
              </span>
            </div>
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep(3)}>
              Next: Program
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose amenity blocks per floor card. Stairs/lift go at corridor
            ends; lobby &amp; F&amp;B alternate front/back on public floors.
          </p>
          <ul className="space-y-3">
            {floors.map((f) => (
              <li
                key={f.key}
                className="rounded-lg border border-border px-3 py-3"
              >
                <p className="text-sm font-semibold">
                  {f.label}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({f.kind})
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PROGRAM_KIND_OPTIONS.map((kind) => {
                    const checked = (program[f.key] ?? []).includes(kind);
                    return (
                      <label
                        key={kind}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                          checked
                            ? "border-accent bg-accent/10"
                            : "border-input text-muted-foreground",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => {
                            setProgram((prev) => {
                              const cur = new Set(prev[f.key] ?? []);
                              if (cur.has(kind)) cur.delete(kind);
                              else cur.add(kind);
                              return {
                                ...prev,
                                [f.key]: [...cur] as BuildingSpaceKind[],
                              };
                            });
                          }}
                        />
                        {spaceKindLabel(kind)}
                      </label>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep(4)}>
              Next: Room pack
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Floor-wise cards show{" "}
              <strong className="font-medium text-foreground">front</strong>{" "}
              and{" "}
              <strong className="font-medium text-foreground">back</strong> wing
              counts from live inventory. Generate writes positions.
            </p>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={includeComp}
                onChange={(e) => setIncludeComp(e.target.checked)}
              />
              Include guide/driver beds
            </label>
          </div>

          {previewPending ? (
            <p className="text-sm text-muted-foreground">Previewing pack…</p>
          ) : (
            <FloorWingCards summaries={previewSummaries} axis={axis} />
          )}

          <form action={applyAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="floors" value={JSON.stringify(floors)} />
            <input type="hidden" name="corridor_axis" value={axis} />
            <input
              type="hidden"
              name="program"
              value={JSON.stringify(
                floors.map((f) => ({
                  floor_key: f.key,
                  kinds: program[f.key] ?? [],
                })),
              )}
            />
            <input
              type="hidden"
              name="include_comp"
              value={includeComp ? "1" : "0"}
            />
            <Button type="button" variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button type="button" variant="outline" onClick={runPreview}>
              Refresh preview
            </Button>
            <Button type="submit" disabled={applyPending} variant="citrus">
              {applyPending
                ? "Placing…"
                : "Generate 2D positions (overwrite)"}
            </Button>
          </form>
          {applyState.error ? (
            <p className="text-sm text-destructive">{applyState.error}</p>
          ) : null}
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Confirm layout. Desk will use Plan to fine-tune, Building for 3D
            massing.
          </p>
          <FloorWingCards
            summaries={
              applyState.summaries?.length
                ? applyState.summaries
                : previewSummaries
            }
            axis={axis}
          />
          <form action={completeAction} className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(4)}>
              Back
            </Button>
            <Button type="submit" disabled={completePending}>
              {completePending ? "Saving…" : "Finish building setup"}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
