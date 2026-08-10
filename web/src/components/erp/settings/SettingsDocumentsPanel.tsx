"use client";

import { useState } from "react";
import { updatePropertyDocumentDesign } from "@/app/actions/erp-settings";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import {
  AgentSettlementPrintSheet,
} from "@/components/erp/AgentSettlementPrintSheet";
import { FastBookInvoice, type FastBookInvoiceData } from "@/components/erp/FastBookInvoice";
import { FastBookVoucher, type FastBookVoucherData } from "@/components/erp/FastBookVoucher";
import {
  FolioReceipt,
  type FolioReceiptData,
} from "@/components/erp/FolioReceipt";
import {
  GuestRegistrationCard,
  type GuestRegistrationCardData,
} from "@/components/erp/GuestRegistrationCard";
import { SettingsSection } from "@/components/erp/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  PropertyDocumentDesign,
  PropertyRegistrationDesign,
} from "@/lib/property-settings";
import type { PropertyRow } from "@/lib/property-types";
import { cn } from "@/lib/utils";

const fieldClass =
  "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const demoInvoice: FastBookInvoiceData = {
  bookingId: "INV-DEMO-001",
  confirmationCode: "PS-2026-01001",
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
  confirmationCode: "PS-2026-01002",
  checkIn: "2026-08-12",
  checkOut: "2026-08-15",
  nights: 3,
  guestName: "Pema Choden",
  guestPhone: "+975 17 11 22 33",
  agentLabel: "Pelbu friends rate",
  guideNumber: "GUIDE-2881",
  lines: [{ name: "Superior room", code: "sup", qty: 1 }],
};

const demoReceipt: FolioReceiptData = {
  folioId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  label: "Room 201",
  bookingId: "b9c8d7e6-f5a4-3210-9876-543210fedcba",
  createdAt: "2026-08-15T09:40:00+06:00",
  docNo: "RCP-2026-0042",
  lines: [
    {
      description: "Deluxe room · 3 nights",
      amount: 19500,
      gst: 1365,
      serviceCharge: 0,
      isPayment: false,
    },
    {
      description: "Breakfast × 2",
      amount: 1200,
      gst: 84,
      serviceCharge: 0,
      isPayment: false,
    },
    {
      description: "Payment · mBOB",
      amount: -15000,
      gst: 0,
      serviceCharge: 0,
      isPayment: true,
    },
  ],
};

const demoReg: GuestRegistrationCardData = {
  bookingId: "550e8400-e29b-41d4-a716-446655440000",
  confirmationCode: "PS-2026-00042",
  guestName: "Sonam Dorji",
  guestPhone: "+975 17 55 66 77",
  guestOrigin: "international",
  passportOrCid: "P1234567",
  sdfRef: "SDF-99881",
  guideNumber: "GUIDE-1201",
  agentLabel: "Bhutan Trails",
  checkIn: "2026-08-12",
  checkOut: "2026-08-15",
  nights: 3,
  adults: 2,
  children: 0,
  extraBeds: 0,
  mealPlanCode: "BB",
  roomLines: [{ name: "Deluxe · 201", qty: 1 }],
  rateNightlyBtn: 6500,
  stayTotalBtn: null,
};

type DocKind =
  | "invoice"
  | "receipt"
  | "voucher"
  | "settlement"
  | "registration";

const DOC_TABS: { kind: DocKind; label: string }[] = [
  { kind: "invoice", label: "Invoice" },
  { kind: "receipt", label: "Receipt" },
  { kind: "voucher", label: "Voucher" },
  { kind: "settlement", label: "Checkout" },
  { kind: "registration", label: "Registration" },
];

function propBits(property: PropertyRow) {
  return {
    name: property.name,
    legal_name: property.legal_name,
    address: property.address,
    phone: property.phone,
    email: property.email,
    tax_id: property.tax_id,
    logo_public_id: property.logo_public_id,
  };
}

export function SettingsDocumentsPanel({ property }: { property: PropertyRow }) {
  const [active, setActive] = useState<DocKind>("invoice");

  return (
    <div className="space-y-6">
      <SettingsSection
        eyebrow="Printouts"
        title="Document designs"
        description="Logo from Identity. Edit title, intro, notes, colors, and what appears on booking notes, folio receipts, agent vouchers, guide checkout packs, and registration cards."
        blastRadius="desk prints: confirmation, receipt, voucher, settlement pack, registration"
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

      {active === "registration" ? (
        <RegistrationSection
          key="registration"
          propertyId={property.id}
          design={property.doc_registration}
        />
      ) : (
        <DocumentSection
          key={active}
          propertyId={property.id}
          title={DOC_TABS.find((t) => t.kind === active)?.label ?? "Document"}
          docKind={active}
          design={
            active === "invoice"
              ? property.doc_invoice
              : active === "receipt"
                ? property.doc_receipt
                : active === "voucher"
                  ? property.doc_voucher
                  : property.doc_settlement
          }
        />
      )}

      {active === "invoice" ? (
        <PreviewFrame hint="StayHub / Fast Book confirmation note — not a fiscal GST INV.">
          <FastBookInvoice
            data={demoInvoice}
            property={propBits(property)}
            design={property.doc_invoice}
          />
        </PreviewFrame>
      ) : null}

      {active === "receipt" ? (
        <PreviewFrame hint="Guest folio receipt / checkout copy from Folios.">
          <FolioReceipt
            data={demoReceipt}
            property={propBits(property)}
            design={property.doc_receipt}
          />
        </PreviewFrame>
      ) : null}

      {active === "voucher" ? (
        <PreviewFrame hint="Agent room voucher — rates settle on folio, not shown here.">
          <FastBookVoucher
            data={demoVoucher}
            property={propBits(property)}
            design={property.doc_voucher}
          />
        </PreviewFrame>
      ) : null}

      {active === "settlement" ? (
        <PreviewFrame hint="Guide-sign checkout pack from StayHub Checkout.">
          <AgentSettlementPrintSheet
            design={property.doc_settlement}
            fallback={{
              guestName: "Sonam Dorji",
              rooms: ["201"],
              checkIn: "2026-08-12",
              checkOut: "2026-08-15",
              guideNumber: "GUIDE-1201",
              agentName: "Bhutan Trails",
              confirmationCode: "PS-2026-00042",
            }}
          />
        </PreviewFrame>
      ) : null}

      {active === "registration" ? (
        <PreviewFrame hint="Arrival registration — StayHub after check-in.">
          <GuestRegistrationCard
            data={demoReg}
            design={property.doc_registration}
            property={{
              ...propBits(property),
              check_in_time: "14:00",
              check_out_time: "12:00",
            }}
          />
        </PreviewFrame>
      ) : null}
    </div>
  );
}

function PreviewFrame({
  hint,
  children,
}: {
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-muted/20 p-4 md:p-6">
      <p className="mb-3 text-xs text-muted-foreground">{hint}</p>
      {children}
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
  docKind: Exclude<DocKind, "registration">;
  design: PropertyDocumentDesign;
}) {
  const isSettlement = docKind === "settlement";
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
          {isSettlement
            ? "Guide checkout / agent settlement pack printed at StayHub Checkout."
            : "Edits apply after you save. One line per bullet in Notes."}
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
          {docKind === "receipt" ? (
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
          ) : (
            <input type="hidden" name="paper_size" value="a4" />
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`${docKind}-title`}>Document title</Label>
            <Input
              id={`${docKind}-title`}
              name="title"
              defaultValue={design.title}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${docKind}-header`}>Subtitle / eyebrow</Label>
            <Input
              id={`${docKind}-header`}
              name="header_text"
              defaultValue={design.header_text}
            />
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
            <Label htmlFor={`${docKind}-intro`}>Intro</Label>
            <Textarea
              id={`${docKind}-intro`}
              name="intro_text"
              rows={2}
              defaultValue={design.intro_text}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${docKind}-notes`}>Notes (one bullet per line)</Label>
            <Textarea
              id={`${docKind}-notes`}
              name="notes_text"
              rows={4}
              defaultValue={design.notes_text}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${docKind}-terms`}>
              {isSettlement ? "Guide acknowledgment / terms" : "Terms band"}
            </Label>
            <Textarea
              id={`${docKind}-terms`}
              name="terms_text"
              rows={3}
              defaultValue={design.terms_text}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${docKind}-footer`}>Footer</Label>
            <Textarea
              id={`${docKind}-footer`}
              name="footer_text"
              rows={2}
              defaultValue={design.footer_text}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <FieldToggle
            id={`${docKind}-show-logo`}
            name="show_logo"
            label="Show logo"
            defaultChecked={design.show_logo}
          />
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
        <Button type="submit" className="mt-4 h-11">
          Save {title.toLowerCase()} design
        </Button>
      </PropertyWizardForm>
    </section>
  );
}

function RegistrationSection({
  propertyId,
  design,
}: {
  propertyId: string;
  design: PropertyRegistrationDesign;
}) {
  return (
    <section className="rounded-xl border bg-card p-5 md:p-6">
      <div className="mb-5 space-y-1">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Registration
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Registration card design
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Logo comes from Settings → Identity. Edit header, house policies, and
          guest dos &amp; don’ts. One line per bullet in the text boxes.
        </p>
      </div>

      <PropertyWizardForm action={updatePropertyDocumentDesign}>
        <input type="hidden" name="property_id" value={propertyId} />
        <input type="hidden" name="doc_kind" value="registration" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="reg-preset">Preset</Label>
            <select
              id="reg-preset"
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
            <Label htmlFor="reg-title">Card title</Label>
            <Input id="reg-title" name="title" defaultValue={design.title} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-brand">Brand color</Label>
            <Input
              id="reg-brand"
              name="brand_color"
              defaultValue={design.brand_color}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-accent">Accent color</Label>
            <Input
              id="reg-accent"
              name="accent_color"
              defaultValue={design.accent_color}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="reg-header">Subtitle / eyebrow</Label>
            <Input
              id="reg-header"
              name="header_text"
              defaultValue={design.header_text}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="reg-intro">Intro</Label>
            <Textarea
              id="reg-intro"
              name="intro_text"
              rows={2}
              defaultValue={design.intro_text}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="reg-policies">House policies</Label>
            <Textarea
              id="reg-policies"
              name="policies_text"
              rows={5}
              defaultValue={design.policies_text}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-dos">Please do</Label>
            <Textarea
              id="reg-dos"
              name="dos_text"
              rows={5}
              defaultValue={design.dos_text}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-donts">Please don’t</Label>
            <Textarea
              id="reg-donts"
              name="donts_text"
              rows={5}
              defaultValue={design.donts_text}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="reg-terms">Signature terms</Label>
            <Textarea
              id="reg-terms"
              name="terms_text"
              rows={3}
              defaultValue={design.terms_text}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="reg-footer">Footer</Label>
            <Textarea
              id="reg-footer"
              name="footer_text"
              rows={2}
              defaultValue={design.footer_text}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <FieldToggle
            id="reg-show-logo"
            name="show_logo"
            label="Show logo"
            defaultChecked={design.show_logo}
          />
          <FieldToggle
            id="reg-show-phone"
            name="show_phone"
            label="Show phone"
            defaultChecked={design.show_phone}
          />
          <FieldToggle
            id="reg-show-email"
            name="show_email"
            label="Show email"
            defaultChecked={design.show_email}
          />
          <FieldToggle
            id="reg-show-tax"
            name="show_tax_id"
            label="Show GST / tax ID"
            defaultChecked={design.show_tax_id}
          />
          <FieldToggle
            id="reg-show-address"
            name="show_address"
            label="Show address"
            defaultChecked={design.show_address}
          />
        </div>
        <Button type="submit" className="mt-4 h-11">
          Save registration design
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
