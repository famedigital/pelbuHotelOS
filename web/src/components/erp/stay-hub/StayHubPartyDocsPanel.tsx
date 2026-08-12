"use client";

import {
  deletePartyDocument,
  listPartyDocuments,
  savePartyDocument,
  type PartyDocKind,
  type PartyDocument,
} from "@/app/actions/erp-party-docs";
import { Button } from "@/components/ui/button";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { uploadToCloudinary } from "@/lib/cloudinary-direct-upload";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

const KINDS: Array<{ id: PartyDocKind; label: string }> = [
  { id: "sdf_pack", label: "SDF pack" },
  { id: "voucher", label: "Voucher" },
  { id: "reg", label: "Reg / ID" },
  { id: "other", label: "Other" },
];

export function StayHubPartyDocsPanel({ groupId }: { groupId: string }) {
  const [docs, setDocs] = useState<PartyDocument[]>([]);
  const [kind, setKind] = useState<PartyDocKind>("sdf_pack");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    setLoading(true);
    void listPartyDocuments(groupId).then((res) => {
      if (res.ok) setDocs(res.data);
      else toast.error(res.error);
      setLoading(false);
    });
  }, [groupId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    try {
      const result = await uploadToCloudinary(file, {
        folder: `pelbu/party-docs/${groupId}`,
        signEndpoint: "/api/erp/cloudinary/sign-upload",
        imageOnly: false,
        allowPdf: true,
        onProgress: (next) => setProgress(next.percent),
      });
      const saved = await savePartyDocument({
        groupId,
        kind,
        storagePublicId: result.publicId,
        title: file.name.slice(0, 120),
      });
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      toast.success(saved.message);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-background p-2">
      <p className="text-[11px] text-muted-foreground">
        Party vault — SDF pack, vouchers, reg. Upload after check-in when the
        agent sends papers.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[7rem] space-y-1 text-[10px] text-muted-foreground">
          Kind
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
            value={kind}
            disabled={busy}
            onChange={(e) => setKind(e.target.value as PartyDocKind)}
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 text-[11px]"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? `Uploading ${progress}%…` : "Upload file"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No documents yet.</p>
      ) : (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto">
          {docs.map((d) => {
            const url = d.storagePublicId
              ? cloudinaryUrl(d.storagePublicId, {
                  crop: "limit",
                  width: 1200,
                })
              : d.fileUrl;
            return (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-2 rounded border border-border/60 px-2 py-1.5 text-[11px]"
              >
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium uppercase tracking-wide text-muted-foreground">
                  {d.kind.replace(/_/g, " ")}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {d.title ?? "Document"}
                </span>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    Open
                  </a>
                ) : null}
                <button
                  type="button"
                  className="text-destructive"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const res = await deletePartyDocument(d.id);
                      if (res.ok) {
                        toast.success(res.message);
                        reload();
                      } else toast.error(res.error);
                    });
                  }}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
