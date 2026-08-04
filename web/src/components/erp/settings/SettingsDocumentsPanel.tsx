"use client";

import { useState } from "react";
import { updatePropertyDocumentDesign } from "@/app/actions/erp-settings";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { FastBookInvoice, type FastBookInvoiceData } from "@/components/erp/FastBookInvoice";
import { FastBookVoucher, type FastBookVoucherData } from "@/components/erp/FastBookVoucher";
import { SettingsSection } from "@/components/erp/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PropertyDocumentDesign } from "@/lib/property-settings";
import type { PropertyRow } from "@/lib/property-types";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

const fieldClass =
  "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const demoInvoice: FastBookInvoiceData = {
  bookingId: "INV-DEMO-001",
  checkIn: "2026-08-12",
  checkOut: "2026-08-15",
  nights: 3,
  adults: 2,
  guestName: "Tshering Wangdi",
  agentLabel: "Direct guest",
  sourceLabel: "Owner",
  paymentLabel: "Cash",
  lines: [
    { name: "Deluxe room", code: "deluxe", qty: 1, kind: "sellable_guest" },
    { name: "Breakfast", code: "breakfast", qty: 2, kind: "service" },
  ],
};

const demoVoucher: FastBookVoucherData = {
  bookingId: "VCH-DEMO-001",
  checkIn: "2026-08-12",
  checkOut: "2026-08-15",
  nights: 3,
  guestName: "Pema Choden",
  guestPhone: "+975 17 11 22 33",
  agentLabel: "Pelbu friends rate",
  guideNumber: "GUIDE-2881",
  lines: [{ name: "Superior room", code: "sup", qty: 1 }],
};

type DocKind = "invoice" | "receipt" | "voucher";

const DOC_TABS: { kind: DocKind; label: string }[] = [
  { kind: "invoice", label: "Invoice" },
  { kind: "receipt", label: "Receipt" },
  { kind: "voucher", label: "Voucher" },
];

export function SettingsDocumentsPanel({ property }: { property: PropertyRow }) {
  const [active, setActive] = useState<DocKind>("invoice");

  const design =
    active === "invoice"
      ? property.doc_invoice
      : active === "receipt"
        ? property.doc_receipt
        : property.doc_voucher;

  return (
    <div className="space-y-6">
      <SettingsSection
        eyebrow="Printouts"
        title="Document designs"
        description="Choose a preset, then tweak colors, header/footer, visible fields, and paper size without breaking print reliability."
        blastRadius="guest-facing invoices, receipts, and vouchers printed from the desk"
      >
        <div
          role="tablist"
          aria-label="Document type"
          className="flex flex-wrap gap-1 rounded-lg border p-1"
        >
          {DOC_TABS.map((tab) => {
            const selected = active === tab.kind;
            return (
              <button
                key={tab.kind}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(tab.kind)}
                className={cn(
                  "min-h-10 rounded-md px-3.5 py-2 text-sm transition-colors",
                  selected
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <DocumentSection
        key={active}
        propertyId={property.id}
        title={DOC_TABS.find((t) => t.kind === active)?.label ?? "Document"}
        docKind={active}
        design={design}
      />

      {active === "invoice" ? (
        <div className="rounded-xl border bg-card p-5 md:p-6">
          <FastBookInvoice
            data={demoInvoice}
            property={{
              name: property.name,
              legal_name: property.legal_name,
              address: property.address,
              phone: property.phone,
              email: property.email,
              tax_id: property.tax_id,
              logo_public_id: property.logo_public_id,
            }}
            design={property.doc_invoice}
          />
        </div>
      ) : null}

      {active === "receipt" ? (
        <div className="rounded-xl border bg-card p-5 md:p-6">
          <ReceiptPreview
            property={property}
            design={property.doc_receipt}
            bookingId="RCT-DEMO-004"
            guestName="Sonam Lhamo"
            postedAt="29 Jul 2026, 15:40"
            subtotal="Nu 2,100"
            serviceCharge="Nu 210"
            gst="Nu 162.7"
            total="Nu 2,472.7"
          />
        </div>
      ) : null}

      {active === "voucher" ? (
        <div className="rounded-xl border bg-card p-5 md:p-6">
          <FastBookVoucher
            data={demoVoucher}
            property={{
              name: property.name,
              legal_name: property.legal_name,
              address: property.address,
              phone: property.phone,
              email: property.email,
              tax_id: property.tax_id,
              logo_public_id: property.logo_public_id,
            }}
            design={property.doc_voucher}
          />
        </div>
      ) : null}
    </div>
  );
}

function DocumentSection({
  propertyId,
  title,
  docKind,
  design,
}: {
  propertyId: string;
  title: string;
  docKind: DocKind;
  design: PropertyDocumentDesign;
}) {
  return (
    <section className="rounded-xl border bg-card p-5 md:p-6">
      <div className="mb-5 space-y-1">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          {title}
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {title} design
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Edits apply after you save. Switch tab to edit another document type.
        </p>
      </div>

      <PropertyWizardForm action={updatePropertyDocumentDesign}>
        <input type="hidden" name="property_id" value={propertyId} />
        <input type="hidden" name="doc_kind" value={docKind} />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${docKind}-preset`}>Preset</Label>
            <select
              id={`${docKind}-preset`}
              name="preset"
              defaultValue={design.preset}
              className={fieldClass}
            >
              <option value="classic">Classic</option>
              <option value="compact">Compact</option>
              <option value="branded">Branded</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${docKind}-paper`}>Paper size</Label>
            <select
              id={`${docKind}-paper`}
              name="paper_size"
              defaultValue={design.paper_size}
              className={fieldClass}
            >
              <option value="a4">A4</option>
              <option value="thermal">Thermal / narrow</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${docKind}-brand`}>Brand color</Label>
            <Input
              id={`${docKind}-brand`}
              name="brand_color"
              defaultValue={design.brand_color}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${docKind}-accent`}>Accent color</Label>
            <Input
              id={`${docKind}-accent`}
              name="accent_color"
              defaultValue={design.accent_color}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${docKind}-header`}>Header text</Label>
            <Input
              id={`${docKind}-header`}
              name="header_text"
              defaultValue={design.header_text}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${docKind}-footer`}>Footer text</Label>
            <Textarea
              id={`${docKind}-footer`}
              name="footer_text"
              rows={2}
              defaultValue={design.footer_text}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <FieldToggle
            id={`${docKind}-show-phone`}
            name="show_phone"
            label="Show phone"
            defaultChecked={design.show_phone}
          />
          <FieldToggle
            id={`${docKind}-show-email`}
            name="show_email"
            label="Show email"
            defaultChecked={design.show_email}
          />
          <FieldToggle
            id={`${docKind}-show-tax`}
            name="show_tax_id"
            label="Show GST / tax ID"
            defaultChecked={design.show_tax_id}
          />
          <FieldToggle
            id={`${docKind}-show-address`}
            name="show_address"
            label="Show address"
            defaultChecked={design.show_address}
          />
        </div>
        <Button type="submit" className="h-11">
          Save {title.toLowerCase()} design
        </Button>
      </PropertyWizardForm>
    </section>
  );
}

function FieldToggle({
  id,
  name,
  label,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-lg border px-4 py-3">
      <Checkbox id={id} name={name} value="1" defaultChecked={defaultChecked} />
      <Label htmlFor={id} className="text-sm text-foreground">
        {label}
      </Label>
    </div>
  );
}

function ReceiptPreview({
  property,
  design,
  bookingId,
  guestName,
  postedAt,
  subtotal,
  serviceCharge,
  gst,
  total,
}: {
  property: {
    name: string;
    legal_name: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    tax_id: string | null;
  };
  design: PropertyDocumentDesign;
  bookingId: string;
  guestName: string;
  postedAt: string;
  subtotal: string;
  serviceCharge: string;
  gst: string;
  total: string;
}) {
  return (
    <section
      className="rounded-lg border px-5 py-5"
      style={
        {
          borderColor: design.accent_color,
          background:
            design.preset === "branded"
              ? `linear-gradient(180deg, ${design.accent_color}12, transparent 28%)`
              : undefined,
        } as CSSProperties
      }
    >
      <div
        className="border-b pb-3"
        style={{ borderColor: design.brand_color }}
      >
        <p
          className="text-[11px] font-semibold tracking-[0.2em] uppercase"
          style={{ color: design.brand_color }}
        >
          {property.name}
        </p>
        <h3 className="mt-1 text-xl font-semibold text-foreground">
          Receipt preview
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{design.header_text}</p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <PreviewField label="Guest" value={guestName} />
        <PreviewField label="Ref" value={bookingId} />
        <PreviewField label="Posted" value={postedAt} />
        <PreviewField label="Paper" value={design.paper_size} />
      </dl>
      <div className="mt-4 space-y-2 rounded-lg border px-4 py-4 text-sm">
        <PreviewMoney label="Subtotal" value={subtotal} />
        <PreviewMoney label="Service charge" value={serviceCharge} />
        <PreviewMoney label="GST" value={gst} />
        <div className="flex justify-between border-t pt-2 font-medium text-foreground">
          <span>Total</span>
          <span>{total}</span>
        </div>
      </div>
      <div className="mt-4 text-xs text-muted-foreground">
        {design.show_address && property.address ? (
          <p>{property.address}</p>
        ) : null}
        {design.show_phone && property.phone ? <p>{property.phone}</p> : null}
        {design.show_email && property.email ? <p>{property.email}</p> : null}
        {design.show_tax_id && property.tax_id ? (
          <p>GST/TAX: {property.tax_id}</p>
        ) : null}
        <p className="mt-2">{design.footer_text}</p>
      </div>
    </section>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}

function PreviewMoney({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}
