"use client";

import { saveRrcoInvoiceProfile } from "@/app/actions/erp-settings";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { SettingsSection } from "@/components/erp/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildDynamicEmv, parseEmv, toStaticEmv } from "@/lib/bank-qr/emv";
import { rateToPercent } from "@/lib/property-settings";
import type { PropertyRow } from "@/lib/property-types";
import { useEffect, useState } from "react";

export function SettingsRrcoInvoicePanel({ property }: { property: PropertyRow }) {
  const bank = property.bank_accounts?.[0];
  const [payload, setPayload] = useState(bank?.qr_payload ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = Boolean(toStaticEmv(payload));
  const payee = parseEmv(payload).get("59") ?? "";

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const text = new BrowserMultiFormatReader()
        .decodeFromImageUrl(url)
        .then((result) => result.getText());
      const decoded = await text;
      const normalized = toStaticEmv(decoded);
      if (!normalized) {
        setError(
          "That image is not a bank payment QR. Upload the QR from mBoB.",
        );
        return;
      }
      setPayload(normalized);
    } catch {
      setError("Could not read a QR in that image. Use a clear photo of the bank QR.");
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
    }
  }

  return (
    <SettingsSection
      eyebrow="RRCO invoice"
      title="Hotel details on the tax invoice"
      description="Legal name, TPN, address, GST, and the BNB account. The bank QR is saved without an amount. Each invoice stamps the amount due so mBoB fills it in."
      blastRadius="every room bill, food bill, and master bill printed for this hotel"
      status={property.tax_id && ready ? "ready" : "attention"}
    >
      <PropertyWizardForm action={saveRrcoInvoiceProfile}>
        <input type="hidden" name="property_id" value={property.id} />
        <input type="hidden" name="qr_payload" value={payload} />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rrco_name">Hotel name</Label>
            <Input id="rrco_name" name="name" defaultValue={property.name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rrco_legal">Legal name on the invoice</Label>
            <Input
              id="rrco_legal"
              name="legal_name"
              defaultValue={property.legal_name ?? property.name}
              required
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="rrco_address">Address</Label>
            <Textarea
              id="rrco_address"
              name="address"
              rows={2}
              defaultValue={property.address ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rrco_city">City on the bank QR</Label>
            <Input
              id="rrco_city"
              name="city"
              defaultValue={bank?.city ?? "Thimphu"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rrco_phone">Phone</Label>
            <Input id="rrco_phone" name="phone" defaultValue={property.phone ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rrco_email">Email</Label>
            <Input id="rrco_email" name="email" defaultValue={property.email ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rrco_tpn">RRCO TPN</Label>
            <Input
              id="rrco_tpn"
              name="tax_id"
              defaultValue={property.tax_id ?? ""}
              placeholder="PBB24478"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rrco_gst">GST (%)</Label>
            <Input
              id="rrco_gst"
              name="gst_rate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={rateToPercent(property.gst_rate)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rrco_sc">Service charge (%)</Label>
            <Input
              id="rrco_sc"
              name="service_charge_rate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={rateToPercent(property.service_charge_rate)}
              required
            />
          </div>
        </div>
        <div className="flex min-h-11 items-center gap-3 rounded-lg border px-4 py-3">
          <Checkbox
            id="rrco_gst_enabled"
            name="gst_enabled"
            value="1"
            defaultChecked={property.gst_enabled !== false}
          />
          <Label htmlFor="rrco_gst_enabled" className="text-sm">
            Charge GST on new room, menu, and service posts
          </Label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rrco_bank">Bank</Label>
            <Input
              id="rrco_bank"
              name="bank_name"
              defaultValue={bank?.bank ?? "BNB"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rrco_account">Account number</Label>
            <Input
              id="rrco_account"
              name="bank_account"
              defaultValue={bank?.account ?? ""}
              className="font-mono"
              placeholder="642078924"
            />
          </div>
        </div>
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-2">
            <Label>Bank QR</Label>
            <p className="text-xs text-muted-foreground">
              Upload the QR from the bank app. The amount is not stored in it.
              Each printed bill writes the total into a new code for the phone.
            </p>
            <label className="inline-flex h-10 cursor-pointer items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
              {busy ? "Reading QR…" : ready ? "Replace bank QR" : "Upload bank QR"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void onFile(file);
                }}
              />
            </label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {ready ? (
              <p className="text-xs text-muted-foreground">
                Bank QR saved{payee ? ` for ${payee}` : ""}. A Nu 100 sample is
                on the right.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No bank QR yet.</p>
            )}
          </div>
          <QrPreview payload={toStaticEmv(payload)} />
        </div>
        <Button type="submit" className="h-11">
          Save RRCO invoice details
        </Button>
      </PropertyWizardForm>
    </SettingsSection>
  );
}

function QrPreview({ payload }: { payload: string }) {
  const [src, setSrc] = useState("");
  const emv = payload ? buildDynamicEmv(payload, 100, "Preview") : "";

  useEffect(() => {
    if (!emv) {
      setSrc("");
      return;
    }
    let gone = false;
    void import("qrcode")
      .then((mod) =>
        mod.toDataURL(emv, {
          margin: 1,
          width: 280,
          errorCorrectionLevel: "M",
          color: { dark: "#1a1411", light: "#ffffff" },
        }),
      )
      .then((url) => {
        if (!gone) setSrc(url);
      })
      .catch(() => {
        if (!gone) setSrc("");
      });
    return () => {
      gone = true;
    };
  }, [emv]);

  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Nu 100 sample
      </p>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Sample bank QR for Nu 100"
          className="mx-auto mt-2 size-36 bg-white p-1"
        />
      ) : (
        <p className="mt-6 text-xs text-muted-foreground">Upload a bank QR to preview.</p>
      )}
    </div>
  );
}
