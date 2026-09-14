"use client";

/** Temporary stubs so /erp/marketing typechecks after website component purge.
 *  Restore full MarketingAdminForms from ERP implementer brief when ready.
 */

export type CampaignRow = {
  id: string;
  name: string;
  objective: string;
  status: string;
  influencer_label: string | null;
  starts_at: string | null;
  ends_at: string | null;
  budget_btn: number | null;
  notes?: string | null;
  meta_post_url?: string | null;
  ig_handle?: string | null;
  meta_posted_at?: string | null;
  meta_post_notes?: string | null;
};

export type PromoRow = {
  id: string;
  code: string;
  name: string | null;
  benefit_type: string;
  benefit_value: number | null;
  max_redemptions: number | null;
  redeemed_count: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  applies_to: string | null;
  channels: string | null;
  campaign_id: string | null;
  max_per_guest: number | null;
  min_spend_btn: number | null;
  min_nights: number | null;
  max_discount_btn: number | null;
  stackable_with_partner: boolean | null;
  notes: string | null;
};

export type NcReasonRow = {
  id: string;
  code: string;
  label: string;
  domains: string | null;
  requires_role: string | null;
  active: boolean;
  sort_order: number | null;
  notes: string | null;
};

function Stub({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      {label} UI stub — restore MarketingAdminForms for full desk forms.
    </p>
  );
}

export function CampaignForm(_props: { campaign?: CampaignRow | null }) {
  return <Stub label="Campaign form" />;
}

export function CampaignTable(_props: {
  rows: CampaignRow[];
  editId?: string;
}) {
  return <Stub label="Campaign table" />;
}

export function PromoForm(_props: {
  promo?: PromoRow | null;
  campaigns: { id: string; name: string }[];
}) {
  return <Stub label="Promo form" />;
}

export function PromoTable(_props: { rows: PromoRow[]; editId?: string }) {
  return <Stub label="Promo table" />;
}

export function NcReasonForm(_props: { reason?: NcReasonRow | null }) {
  return <Stub label="NC reason form" />;
}

export function NcReasonTable(_props: {
  rows: NcReasonRow[];
  editId?: string;
}) {
  return <Stub label="NC reason table" />;
}

export function RoiExportButton(_props: {
  redemptions: Record<string, unknown>[];
  ncEvents: Record<string, unknown>[];
}) {
  return <Stub label="ROI export" />;
}
