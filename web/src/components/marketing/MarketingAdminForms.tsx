"use client";

import {
  upsertCampaign,
  upsertNcReason,
  upsertPromoCode,
  type MarketingState,
} from "@/app/actions/erp-marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";
import { useActionState } from "react";

const initial: MarketingState = { ok: false };

const field =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function Feedback({ state }: { state: MarketingState }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      role="status"
      className={`text-sm sm:col-span-2 lg:col-span-3 ${
        state.error ? "text-destructive" : "text-emerald-700"
      }`}
    >
      {state.error ?? state.message}
    </p>
  );
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

export function CampaignForm({
  campaign,
}: {
  campaign?: CampaignRow | null;
}) {
  const [state, action, pending] = useActionState(upsertCampaign, initial);
  useActionToast(state, { successMessage: "Campaign saved" });
  const isEdit = Boolean(campaign?.id);

  return (
    <form
      action={action}
      className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {isEdit ? (
        <input type="hidden" name="campaign_id" value={campaign!.id} />
      ) : null}
      <p className="sm:col-span-2 lg:col-span-3 text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
        {isEdit ? `Edit · ${campaign!.name}` : "New campaign"}
      </p>
      {isEdit ? (
        <p className="sm:col-span-2 lg:col-span-3 text-xs text-muted-foreground">
          <Link href="/erp/marketing?tab=campaigns" className="underline">
            Cancel edit
          </Link>
        </p>
      ) : null}
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input
          name="name"
          required
          defaultValue={campaign?.name ?? ""}
          placeholder="TikTok spring fill"
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Objective</span>
        <select
          name="objective"
          className={field}
          defaultValue={campaign?.objective ?? "influencer"}
        >
          <option value="influencer">Influencer</option>
          <option value="ota_match">OTA match</option>
          <option value="season_fill">Season fill</option>
          <option value="staff_welfare">Staff welfare</option>
          <option value="service_recovery">Service recovery</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Status</span>
        <select
          name="status"
          className={field}
          defaultValue={campaign?.status ?? "active"}
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="ended">Ended</option>
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Influencer label</span>
        <Input
          name="influencer_label"
          defaultValue={campaign?.influencer_label ?? ""}
          placeholder="TikTok @handle"
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Starts</span>
        <Input
          name="starts_at"
          type="datetime-local"
          defaultValue={toDatetimeLocal(campaign?.starts_at)}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Ends</span>
        <Input
          name="ends_at"
          type="datetime-local"
          defaultValue={toDatetimeLocal(campaign?.ends_at)}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Budget (Nu)</span>
        <Input
          name="budget_btn"
          type="number"
          min={0}
          step="0.01"
          defaultValue={campaign?.budget_btn ?? ""}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm sm:col-span-2">
        <span className="text-muted-foreground">Notes</span>
        <Input
          name="notes"
          defaultValue={campaign?.notes ?? ""}
          placeholder="Brief"
          className="h-10"
        />
      </label>
      <p className="sm:col-span-2 lg:col-span-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Meta / social ROI (manual)
      </p>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">IG handle</span>
        <Input
          name="ig_handle"
          defaultValue={campaign?.ig_handle ?? ""}
          placeholder="@pelbusuites"
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Meta post URL</span>
        <Input
          name="meta_post_url"
          defaultValue={campaign?.meta_post_url ?? ""}
          placeholder="https://facebook.com/…"
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Posted at</span>
        <Input
          name="meta_posted_at"
          type="datetime-local"
          defaultValue={toDatetimeLocal(campaign?.meta_posted_at)}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm sm:col-span-2">
        <span className="text-muted-foreground">Meta post notes</span>
        <Input
          name="meta_post_notes"
          defaultValue={campaign?.meta_post_notes ?? ""}
          placeholder="Reach / creative notes"
          className="h-10"
        />
      </label>
      <Feedback state={state} />
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Update campaign" : "Save campaign"}
        </Button>
      </div>
    </form>
  );
}

export function CampaignTable({
  rows,
  editId,
}: {
  rows: CampaignRow[];
  editId?: string | null;
}) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No campaigns yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Objective</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Budget</th>
            <th className="px-3 py-2 font-medium">Influencer</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr
              key={r.id}
              className={editId === r.id ? "bg-accent/10" : undefined}
            >
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.objective}</td>
              <td className="px-3 py-2">{r.status}</td>
              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                {r.budget_btn != null ? formatBtn(Number(r.budget_btn)) : "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.influencer_label ?? "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/erp/marketing?tab=campaigns&campaign_id=${r.id}`}
                  className="text-sky-600 underline-offset-2 hover:underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type PromoRow = {
  id: string;
  code: string;
  name: string;
  benefit_type: string;
  benefit_value: number;
  max_redemptions: number | null;
  redeemed_count: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  applies_to: string[] | null;
  channels: string[] | null;
  campaign_id: string | null;
  max_per_guest?: number | null;
  min_spend_btn?: number | null;
  min_nights?: number | null;
  max_discount_btn?: number | null;
  stackable_with_partner?: boolean;
  notes?: string | null;
};

export function PromoForm({
  promo,
  campaigns,
}: {
  promo?: PromoRow | null;
  campaigns: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(upsertPromoCode, initial);
  useActionToast(state, { successMessage: "Coupon saved" });
  const isEdit = Boolean(promo?.id);

  return (
    <form
      action={action}
      className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {isEdit ? <input type="hidden" name="promo_id" value={promo!.id} /> : null}
      <p className="sm:col-span-2 lg:col-span-3 text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
        {isEdit
          ? `Edit · ${promo!.code}`
          : "New coupon (e.g. TIKTOK50 · first 100 · 50%)"}
      </p>
      {isEdit ? (
        <p className="sm:col-span-2 lg:col-span-3 text-xs text-muted-foreground">
          <Link href="/erp/marketing?tab=coupons" className="underline">
            Cancel edit
          </Link>
        </p>
      ) : null}
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Code</span>
        <Input
          name="code"
          required
          defaultValue={promo?.code ?? ""}
          placeholder="TIKTOK50"
          className="h-10 uppercase"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input
          name="name"
          required
          defaultValue={promo?.name ?? ""}
          placeholder="TikTok first 100"
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Campaign</span>
        <select
          name="campaign_id"
          className={field}
          defaultValue={promo?.campaign_id ?? ""}
        >
          <option value="">— none —</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Benefit type</span>
        <select
          name="benefit_type"
          className={field}
          defaultValue={promo?.benefit_type ?? "pct"}
        >
          <option value="pct">Percent off</option>
          <option value="fixed_btn">Fixed Nu off</option>
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Benefit value</span>
        <Input
          name="benefit_value"
          type="number"
          required
          defaultValue={promo?.benefit_value ?? 50}
          min={0}
          step="0.01"
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Status</span>
        <select
          name="active"
          className={field}
          defaultValue={promo == null || promo.active ? "1" : "0"}
        >
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Max redemptions</span>
        <Input
          name="max_redemptions"
          type="number"
          min={1}
          placeholder="100"
          defaultValue={promo?.max_redemptions ?? ""}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Max per guest</span>
        <Input
          name="max_per_guest"
          type="number"
          min={1}
          placeholder="1"
          defaultValue={promo?.max_per_guest ?? ""}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Min spend Nu</span>
        <Input
          name="min_spend_btn"
          type="number"
          min={0}
          defaultValue={promo?.min_spend_btn ?? 0}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Min nights</span>
        <Input
          name="min_nights"
          type="number"
          min={0}
          defaultValue={promo?.min_nights ?? 0}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Max discount Nu</span>
        <Input
          name="max_discount_btn"
          type="number"
          min={0}
          step="0.01"
          defaultValue={promo?.max_discount_btn ?? ""}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Starts</span>
        <Input
          name="starts_at"
          type="datetime-local"
          defaultValue={toDatetimeLocal(promo?.starts_at)}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Ends</span>
        <Input
          name="ends_at"
          type="datetime-local"
          defaultValue={toDatetimeLocal(promo?.ends_at)}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm sm:col-span-2">
        <span className="text-muted-foreground">Applies to (comma)</span>
        <Input
          name="applies_to"
          defaultValue={
            Array.isArray(promo?.applies_to) && promo!.applies_to.length
              ? promo!.applies_to.join(",")
              : "rooms,pos,spa,laundry,guest_service,meal_plan"
          }
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm sm:col-span-2">
        <span className="text-muted-foreground">Channels (comma)</span>
        <Input
          name="channels"
          defaultValue={
            Array.isArray(promo?.channels) && promo!.channels.length
              ? promo!.channels.join(",")
              : "public_book,desk_pos,desk_folio"
          }
          className="h-10"
        />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="stackable_with_partner"
          value="1"
          defaultChecked={Boolean(promo?.stackable_with_partner)}
        />
        Stackable with partner discount
      </label>
      <Feedback state={state} />
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Update coupon" : "Save coupon"}
        </Button>
      </div>
    </form>
  );
}

function PromoToggle({ promo }: { promo: PromoRow }) {
  const [state, action, pending] = useActionState(upsertPromoCode, initial);
  useActionToast(state, {
    successMessage: promo.active ? "Coupon deactivated" : "Coupon activated",
  });

  return (
    <form action={action} className="inline">
      <input type="hidden" name="promo_id" value={promo.id} />
      <input type="hidden" name="code" value={promo.code} />
      <input type="hidden" name="name" value={promo.name} />
      <input type="hidden" name="benefit_type" value={promo.benefit_type} />
      <input type="hidden" name="benefit_value" value={String(promo.benefit_value)} />
      {promo.campaign_id ? (
        <input type="hidden" name="campaign_id" value={promo.campaign_id} />
      ) : null}
      {promo.max_redemptions != null ? (
        <input
          type="hidden"
          name="max_redemptions"
          value={String(promo.max_redemptions)}
        />
      ) : null}
      {promo.max_per_guest != null ? (
        <input
          type="hidden"
          name="max_per_guest"
          value={String(promo.max_per_guest)}
        />
      ) : null}
      <input
        type="hidden"
        name="min_spend_btn"
        value={String(promo.min_spend_btn ?? 0)}
      />
      <input
        type="hidden"
        name="min_nights"
        value={String(promo.min_nights ?? 0)}
      />
      {promo.max_discount_btn != null ? (
        <input
          type="hidden"
          name="max_discount_btn"
          value={String(promo.max_discount_btn)}
        />
      ) : null}
      {promo.starts_at ? (
        <input
          type="hidden"
          name="starts_at"
          value={toDatetimeLocal(promo.starts_at)}
        />
      ) : null}
      {promo.ends_at ? (
        <input
          type="hidden"
          name="ends_at"
          value={toDatetimeLocal(promo.ends_at)}
        />
      ) : null}
      <input
        type="hidden"
        name="applies_to"
        value={
          Array.isArray(promo.applies_to)
            ? promo.applies_to.join(",")
            : "rooms,pos"
        }
      />
      <input
        type="hidden"
        name="channels"
        value={
          Array.isArray(promo.channels)
            ? promo.channels.join(",")
            : "public_book,desk_pos,desk_folio"
        }
      />
      {promo.stackable_with_partner ? (
        <input type="hidden" name="stackable_with_partner" value="1" />
      ) : null}
      <input type="hidden" name="active" value={promo.active ? "0" : "1"} />
      {state.error ? (
        <span className="mr-2 text-xs text-destructive">{state.error}</span>
      ) : null}
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : promo.active ? "Deactivate" : "Activate"}
      </Button>
    </form>
  );
}

export function PromoTable({
  rows,
  editId,
}: {
  rows: PromoRow[];
  editId?: string | null;
}) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No coupons yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Code</th>
            <th className="px-3 py-2 font-medium">Benefit</th>
            <th className="px-3 py-2 font-medium">Redeemed</th>
            <th className="px-3 py-2 font-medium">Ends</th>
            <th className="px-3 py-2 font-medium">Channels</th>
            <th className="px-3 py-2 font-medium">Active</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr
              key={r.id}
              className={editId === r.id ? "bg-accent/10" : undefined}
            >
              <td className="px-3 py-2 font-mono font-medium">{r.code}</td>
              <td className="px-3 py-2">
                {r.benefit_type === "pct"
                  ? `${r.benefit_value}%`
                  : formatBtn(Number(r.benefit_value))}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {r.redeemed_count}
                {r.max_redemptions != null ? ` / ${r.max_redemptions}` : ""}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {r.ends_at
                  ? String(r.ends_at).slice(0, 16).replace("T", " ")
                  : "—"}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {Array.isArray(r.channels) ? r.channels.join(", ") : "—"}
              </td>
              <td className="px-3 py-2">{r.active ? "Yes" : "No"}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <Link
                  href={`/erp/marketing?tab=coupons&promo_id=${r.id}`}
                  className="mr-2 text-sky-600 underline-offset-2 hover:underline"
                >
                  Edit
                </Link>
                <PromoToggle promo={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type NcReasonRow = {
  id: string;
  code: string;
  label: string;
  domains: string[] | null;
  requires_role: string;
  active: boolean;
  sort_order: number;
  notes?: string | null;
};

export function NcReasonForm({ reason }: { reason?: NcReasonRow | null }) {
  const [state, action, pending] = useActionState(upsertNcReason, initial);
  useActionToast(state, { successMessage: "NC reason saved" });
  const isEdit = Boolean(reason?.id);

  return (
    <form
      action={action}
      className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {isEdit ? (
        <input type="hidden" name="reason_id" value={reason!.id} />
      ) : null}
      <p className="sm:col-span-2 lg:col-span-3 text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
        {isEdit ? `Edit · ${reason!.code}` : "Add NC reason"}
      </p>
      {isEdit ? (
        <p className="sm:col-span-2 lg:col-span-3 text-xs text-muted-foreground">
          <Link href="/erp/marketing?tab=nc" className="underline">
            Cancel edit
          </Link>
        </p>
      ) : null}
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Code</span>
        <Input
          name="code"
          required
          defaultValue={reason?.code ?? ""}
          placeholder="owner_house"
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Label</span>
        <Input
          name="label"
          required
          defaultValue={reason?.label ?? ""}
          placeholder="Owner / house use"
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Requires role</span>
        <select
          name="requires_role"
          className={field}
          defaultValue={reason?.requires_role ?? "manager"}
        >
          <option value="supervisor">Supervisor</option>
          <option value="manager">Manager</option>
          <option value="owner">Owner</option>
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Active</span>
        <select
          name="active"
          className={field}
          defaultValue={reason == null || reason.active ? "1" : "0"}
        >
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Sort order</span>
        <Input
          name="sort_order"
          type="number"
          defaultValue={reason?.sort_order ?? 100}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm sm:col-span-2">
        <span className="text-muted-foreground">Domains (comma)</span>
        <Input
          name="domains"
          defaultValue={
            Array.isArray(reason?.domains) && reason!.domains.length
              ? reason!.domains.join(",")
              : "pos,room"
          }
          className="h-10"
        />
      </label>
      <Feedback state={state} />
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Update reason" : "Save reason"}
        </Button>
      </div>
    </form>
  );
}

function NcReasonToggle({ reason }: { reason: NcReasonRow }) {
  const [state, action, pending] = useActionState(upsertNcReason, initial);
  useActionToast(state, {
    successMessage: reason.active ? "Reason deactivated" : "Reason activated",
  });
  return (
    <form action={action} className="inline">
      <input type="hidden" name="reason_id" value={reason.id} />
      <input type="hidden" name="code" value={reason.code} />
      <input type="hidden" name="label" value={reason.label} />
      <input type="hidden" name="requires_role" value={reason.requires_role} />
      <input
        type="hidden"
        name="domains"
        value={
          Array.isArray(reason.domains) ? reason.domains.join(",") : "pos,room"
        }
      />
      <input type="hidden" name="sort_order" value={String(reason.sort_order)} />
      <input type="hidden" name="active" value={reason.active ? "0" : "1"} />
      {state.error ? (
        <span className="mr-2 text-xs text-destructive">{state.error}</span>
      ) : null}
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : reason.active ? "Deactivate" : "Activate"}
      </Button>
    </form>
  );
}

export function NcReasonTable({
  rows,
  editId,
}: {
  rows: NcReasonRow[];
  editId?: string | null;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No NC reasons. Seed runs with migration / create one above.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Code</th>
            <th className="px-3 py-2 font-medium">Label</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">Domains</th>
            <th className="px-3 py-2 font-medium">Active</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr
              key={r.id}
              className={editId === r.id ? "bg-accent/10" : undefined}
            >
              <td className="px-3 py-2 font-mono">{r.code}</td>
              <td className="px-3 py-2">{r.label}</td>
              <td className="px-3 py-2">{r.requires_role}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {Array.isArray(r.domains) ? r.domains.join(", ") : "—"}
              </td>
              <td className="px-3 py-2">{r.active ? "Yes" : "No"}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <Link
                  href={`/erp/marketing?tab=nc&reason_id=${r.id}`}
                  className="mr-2 text-sky-600 underline-offset-2 hover:underline"
                >
                  Edit
                </Link>
                <NcReasonToggle reason={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Simple client CSV download for ROI samples. */
export function RoiExportButton({
  redemptions,
  ncEvents,
}: {
  redemptions: Record<string, unknown>[];
  ncEvents: Record<string, unknown>[];
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        const lines: string[] = ["type,when,code_or_reason,amount_btn,detail"];
        for (const r of redemptions) {
          const promo = r.promo_codes as
            | { code?: string }
            | { code?: string }[]
            | null;
          const code = Array.isArray(promo)
            ? promo[0]?.code
            : promo?.code;
          lines.push(
            [
              "redemption",
              String(r.created_at ?? ""),
              code ?? "",
              String(r.discount_btn ?? 0),
              `${r.channel ?? ""} ${r.applies_domain ?? ""}`,
            ]
              .map(csvEscape)
              .join(","),
          );
        }
        for (const n of ncEvents) {
          lines.push(
            [
              "nc",
              String(n.created_at ?? ""),
              String(n.reason_code ?? ""),
              String(n.list_value_btn ?? 0),
              String(n.domain ?? ""),
            ]
              .map(csvEscape)
              .join(","),
          );
        }
        const blob = new Blob([lines.join("\n")], {
          type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `marketing-roi-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      Export CSV
    </Button>
  );
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
