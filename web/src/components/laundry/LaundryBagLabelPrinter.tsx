"use client";

import {
  issueDeskLaundryBagLabelTokens,
} from "@/app/actions/erp-laundry";
import { issueLaundryBagLabelTokens } from "@/app/actions/laundry-bags";
import {
  LaundryBagLabel,
  type PrintableBagLabel,
} from "@/components/laundry/LaundryBagLabel";
import { PrintButton } from "@/components/erp/PrintButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LaundryBag } from "@/lib/laundry";
import { absoluteUrl } from "@/lib/site";
import QRCode from "qrcode";
import { useState, useTransition } from "react";

export function LaundryBagLabelPrinter({
  orderId,
  roomLabel,
  bags,
  mode,
  staffOptions,
}: {
  orderId: string;
  roomLabel: string;
  bags: LaundryBag[];
  mode: "staff" | "desk";
  staffOptions?: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [labels, setLabels] = useState<PrintableBagLabel[]>([]);
  const [staffId, setStaffId] = useState(staffOptions?.[0]?.id ?? "");
  const countById = new Map(bags.map((bag) => [bag.id, bag]));

  function generate() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result =
        mode === "desk"
          ? await issueDeskLaundryBagLabelTokens(orderId, staffId)
          : await issueLaundryBagLabelTokens(orderId);
      if (!result.ok || !result.bags?.length) {
        setError(result.error ?? "Could not issue print codes.");
        return;
      }
      const rendered: PrintableBagLabel[] = await Promise.all(
        result.bags.map(async (bag) => {
          const meta = countById.get(bag.id);
          return {
            id: bag.id,
            bagSeq: bag.bagSeq,
            bagCount: result.bags!.length,
            publicCode: bag.publicCode,
            scanPath: bag.scanPath,
            roomLabel,
            orderRef: orderId.slice(0, 8).toUpperCase(),
            garmentCount: meta?.garment_count ?? 0,
            createdAt: meta?.created_at ?? new Date().toISOString(),
            notes: meta?.notes ?? null,
            qrDataUrl: await QRCode.toDataURL(absoluteUrl(bag.scanPath), {
              errorCorrectionLevel: "M",
              margin: 1,
              width: 360,
            }),
          };
        }),
      );
      setLabels(rendered);
      setMessage(result.message ?? "Labels ready.");
      setTimeout(() => window.print(), 250);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        {mode === "desk" && staffOptions?.length ? (
          <div className="min-w-[200px] space-y-1.5">
            <Label>Print audit staff</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                {staffOptions.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <Button
          type="button"
          variant="citrus"
          disabled={
            pending || !bags.length || (mode === "desk" && !staffId)
          }
          onClick={generate}
        >
          {pending ? "Preparing codes…" : "Generate & print labels"}
        </Button>
        {labels.length ? <PrintButton label="Print again" /> : null}
      </div>
      {error ? (
        <Alert variant="destructive" className="print:hidden">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert className="print:hidden">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {labels.length ? (
        <section className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          {labels.map((label) => (
            <LaundryBagLabel key={label.id} label={label} />
          ))}
        </section>
      ) : (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground print:hidden">
          {bags.length
            ? "Generate print codes when stickers are ready. Each print rotates the scan token so older stickers stop working."
            : "Prepare bags on the laundry board first, then return here to print stickers."}
        </p>
      )}
    </div>
  );
}
