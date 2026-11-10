/**
 * Guests & Docs — mobile camera-first cards, desktop upload-first.
 * OCR fills name / passport / nationality; FO reviews thumbnail + Save.
 */
import { useEffect, useState } from "react";
import { Camera, ImagePlus, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, useIsPhone, useIsTablet } from "@hos-v2/ui";
import type { Stay } from "../lib/front-office-store";
import { fileToBase64, hermesOcrDocument } from "../lib/hermes-remote";

export type GuestDocsRowDraft = {
  stayId: string;
  guestName: string;
  passportOrCid: string;
  nationality: string;
  companionName: string;
  companionPassportOrCid: string;
  companionNationality: string;
};

export function docsStatusForStay(s: {
  passportOrCid?: string | null;
  guestName?: string | null;
  isDeferredPartyId?: (id: string) => boolean;
}): "ok" | "deferred" | "due" {
  const id = (s.passportOrCid ?? "").trim();
  if (
    s.isDeferredPartyId?.(id) ||
    /^PARTY:/i.test(id) ||
    /^pending$/i.test(id)
  ) {
    return "deferred";
  }
  if (!id || id.length < 4) {
    const named = (s.guestName ?? "").trim().length >= 2;
    return named ? "deferred" : "due";
  }
  return "ok";
}

export function docsStatusLabel(status: "ok" | "deferred" | "due"): string {
  if (status === "ok") return "ID ok";
  if (status === "deferred") return "ID deferred";
  return "Docs due";
}

type Props = {
  drafts: GuestDocsRowDraft[];
  onDraftsChange: (next: GuestDocsRowDraft[]) => void;
  stays: Stay[];
  focusStay: Stay | null;
  isGroupHub: boolean;
  busyId: string | null;
  saveAllBusy: boolean;
  setBusyId: (id: string | null) => void;
  isDeferredPartyId: (id: string | null | undefined) => boolean;
  onSaveRow: (
    row: GuestDocsRowDraft,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  onSaveAll: () => Promise<void>;
};

function DocCaptureButton({
  stayId,
  kind,
  useCamera,
  disabled,
  onFile,
}: {
  stayId: string;
  kind: "passport" | "sdf";
  useCamera: boolean;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const label =
    kind === "passport"
      ? useCamera
        ? "Take passport photo"
        : "Upload passport"
      : useCamera
        ? "Take SDF photo"
        : "Upload SDF";
  const Icon = useCamera ? Camera : ImagePlus;
  return (
    <label
      className={[
        "inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition-colors",
        kind === "passport"
          ? "bg-[var(--hos-primary)] text-[var(--hos-primary-on-container,#fff)]"
          : "border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)] hover:text-[var(--hos-ink)]",
        disabled ? "pointer-events-none opacity-50" : "",
      ].join(" ")}
    >
      <Icon className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
      {label}
      <input
        type="file"
        accept="image/*"
        {...(useCamera ? { capture: "environment" as const } : {})}
        className="sr-only"
        data-testid={
          kind === "passport"
            ? `stayhub-scan-passport-${stayId}`
            : `stayhub-scan-sdf-${stayId}`
        }
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

export function GuestDocsPanel({
  drafts,
  onDraftsChange,
  stays,
  focusStay,
  isGroupHub,
  busyId,
  saveAllBusy,
  setBusyId,
  isDeferredPartyId,
  onSaveRow,
  onSaveAll,
}: Props) {
  const isPhone = useIsPhone();
  const isTablet = useIsTablet();
  const useCamera = isPhone || isTablet;
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [companionOpen, setCompanionOpen] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    return () => {
      for (const url of Object.values(previews)) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke on unmount only
  }, []);

  const patchRow = (stayId: string, patch: Partial<GuestDocsRowDraft>) => {
    onDraftsChange(
      drafts.map((r) => (r.stayId === stayId ? { ...r, ...patch } : r)),
    );
  };

  const setPreview = (stayId: string, file: File) => {
    setPreviews((prev) => {
      const old = prev[stayId];
      if (old) URL.revokeObjectURL(old);
      return { ...prev, [stayId]: URL.createObjectURL(file) };
    });
  };

  const runOcr = async (
    row: GuestDocsRowDraft,
    file: File,
    hintKind: "passport" | "sdf",
  ) => {
    setBusyId(row.stayId);
    setPreview(row.stayId, file);
    try {
      const { mime, dataBase64 } = await fileToBase64(file);
      const res = await hermesOcrDocument({
        mime,
        dataBase64,
        hintKind,
        createDraft: false,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      patchRow(row.stayId, {
        guestName: res.data.ocr.fullName || row.guestName,
        passportOrCid: res.data.ocr.passportOrCid || row.passportOrCid,
        nationality: res.data.ocr.nationality || row.nationality,
      });
      if (hintKind === "sdf" && res.data.ocr.sdfRef) {
        toast.message(`SDF ref ${res.data.ocr.sdfRef} — review fields & Save`);
      } else {
        toast.success(
          res.data.simulated
            ? "OCR filled (simulated) — review photo & Save"
            : "OCR filled — review photo & Save",
        );
      }
    } catch (err) {
      console.error("[GuestDocs] OCR", err);
      toast.error(err instanceof Error ? err.message : "OCR failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-3" data-testid="stayhub-guests-docs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <strong className="text-sm text-[var(--hos-ink)]">
            Guests &amp; Docs
          </strong>
          <p className="m-0 mt-0.5 text-[11px] leading-snug text-[var(--hos-ink-3)]">
            {useCamera
              ? "Tap Take photo — OCR fills ID fields. Review, then Save."
              : "Upload passport / CID image — OCR fills ID fields. Review, then Save."}
            {isGroupHub ? " One card per room." : ""}
          </p>
        </div>
        {isGroupHub && drafts.length > 1 ? (
          <Button
            size="sm"
            className="hos-btn-ink !min-h-10 !rounded-xl !px-4"
            data-testid="stayhub-guests-save-all"
            disabled={saveAllBusy || busyId !== null}
            onClick={() => void onSaveAll()}
          >
            {saveAllBusy ? "Saving…" : "Save all"}
          </Button>
        ) : null}
      </div>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {drafts.map((row) => {
          const live =
            stays.find((s) => s.id === row.stayId) ??
            (focusStay?.id === row.stayId ? focusStay : null);
          const status = docsStatusForStay({
            passportOrCid: row.passportOrCid || live?.passportOrCid,
            guestName: row.guestName || live?.guestName,
            isDeferredPartyId: (id) => isDeferredPartyId(id),
          });
          const busy = busyId === row.stayId || saveAllBusy;
          const preview = previews[row.stayId];
          const showCompanion =
            companionOpen[row.stayId] ||
            Boolean(row.companionName.trim()) ||
            Boolean(row.companionPassportOrCid.trim());

          return (
            <li
              key={row.stayId}
              data-testid={`stayhub-guest-row-${row.stayId}`}
              className="overflow-hidden rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[var(--hos-line)] bg-[color-mix(in_srgb,var(--hos-primary)_6%,var(--hos-cell))] px-3 py-2">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="font-mono text-[13px] font-semibold tabular-nums text-[var(--hos-ink)]">
                    Rm {live?.roomNumber ?? "—"}
                  </span>
                  <span className="truncate text-[11px] text-[var(--hos-ink-3)]">
                    {live?.typeCode ?? ""}
                  </span>
                </div>
                <Badge
                  tone={
                    status === "ok"
                      ? "success"
                      : status === "deferred"
                        ? "vip"
                        : "danger"
                  }
                >
                  {docsStatusLabel(status)}
                </Badge>
              </div>

              <div className="grid gap-3 p-3 sm:grid-cols-[7.5rem_1fr]">
                <div className="relative mx-auto aspect-[3/4] w-full max-w-[7.5rem] overflow-hidden rounded-xl border border-[var(--hos-line)] bg-[var(--hos-canvas-2)] sm:mx-0">
                  {preview ? (
                    <img
                      src={preview}
                      alt="ID document preview"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-[var(--hos-ink-3)]">
                      <UserRound
                        className="size-7 opacity-40"
                        strokeWidth={1.5}
                      />
                      No photo yet
                    </div>
                  )}
                  {busy ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[rgba(15,23,42,0.45)]">
                      <Loader2
                        className="size-6 animate-spin text-white"
                        strokeWidth={2}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <DocCaptureButton
                      stayId={row.stayId}
                      kind="passport"
                      useCamera={useCamera}
                      disabled={busy}
                      onFile={(file) => void runOcr(row, file, "passport")}
                    />
                    <DocCaptureButton
                      stayId={row.stayId}
                      kind="sdf"
                      useCamera={useCamera}
                      disabled={busy}
                      onFile={(file) => void runOcr(row, file, "sdf")}
                    />
                  </div>

                  <label className="grid gap-0.5 text-[11px] font-medium text-[var(--hos-ink-2)]">
                    Primary guest
                    <input
                      value={row.guestName}
                      onChange={(e) =>
                        patchRow(row.stayId, { guestName: e.target.value })
                      }
                      data-testid={`stayhub-guest-name-${row.stayId}`}
                      className="hos-input !min-h-11 !rounded-xl !text-[14px]"
                      autoComplete="name"
                    />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-0.5 text-[11px] font-medium text-[var(--hos-ink-2)]">
                      Passport / CID
                      <input
                        value={row.passportOrCid}
                        onChange={(e) =>
                          patchRow(row.stayId, {
                            passportOrCid: e.target.value,
                          })
                        }
                        placeholder="P-… / CID"
                        data-testid={`stayhub-guest-cid-${row.stayId}`}
                        className="hos-input !min-h-11 !rounded-xl !font-mono !text-[14px]"
                        autoComplete="off"
                      />
                    </label>
                    <label className="grid gap-0.5 text-[11px] font-medium text-[var(--hos-ink-2)]">
                      Nationality
                      <input
                        value={row.nationality}
                        onChange={(e) =>
                          patchRow(row.stayId, {
                            nationality: e.target.value,
                          })
                        }
                        className="hos-input !min-h-11 !rounded-xl !text-[14px]"
                        autoComplete="country-name"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    className="justify-self-start text-[12px] font-semibold text-[var(--hos-primary)] underline-offset-2 hover:underline"
                    onClick={() =>
                      setCompanionOpen((p) => ({
                        ...p,
                        [row.stayId]: !showCompanion,
                      }))
                    }
                  >
                    {showCompanion
                      ? "Hide companion"
                      : "Add sharing companion"}
                  </button>

                  {showCompanion ? (
                    <div className="grid gap-2 rounded-xl border border-dashed border-[var(--hos-line)] bg-[var(--hos-canvas-2)] p-2.5">
                      <label className="grid gap-0.5 text-[11px] font-medium text-[var(--hos-ink-2)]">
                        Companion name
                        <input
                          value={row.companionName}
                          onChange={(e) =>
                            patchRow(row.stayId, {
                              companionName: e.target.value,
                            })
                          }
                          placeholder="Optional"
                          data-testid={`stayhub-companion-name-${row.stayId}`}
                          className="hos-input !min-h-10 !rounded-xl !text-[13px]"
                        />
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-0.5 text-[11px] font-medium text-[var(--hos-ink-2)]">
                          Companion ID
                          <input
                            value={row.companionPassportOrCid}
                            onChange={(e) =>
                              patchRow(row.stayId, {
                                companionPassportOrCid: e.target.value,
                              })
                            }
                            placeholder="Optional"
                            className="hos-input !min-h-10 !rounded-xl !font-mono !text-[13px]"
                          />
                        </label>
                        <label className="grid gap-0.5 text-[11px] font-medium text-[var(--hos-ink-2)]">
                          Nat.
                          <input
                            value={row.companionNationality}
                            onChange={(e) =>
                              patchRow(row.stayId, {
                                companionNationality: e.target.value,
                              })
                            }
                            className="hos-input !min-h-10 !rounded-xl !text-[13px]"
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  <Button
                    className="hos-btn-ink !min-h-11 w-full !rounded-xl text-[14px] font-semibold"
                    data-testid={`stayhub-guest-save-${row.stayId}`}
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        setBusyId(row.stayId);
                        try {
                          const res = await onSaveRow(row);
                          if (!res.ok) toast.error(res.error);
                          else
                            toast.success(
                              `Saved · ${row.guestName || "guest"}`,
                            );
                        } finally {
                          setBusyId(null);
                        }
                      })();
                    }}
                  >
                    {busyId === row.stayId ? "Saving…" : "Save guest"}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
