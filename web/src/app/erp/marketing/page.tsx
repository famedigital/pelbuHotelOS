import {
  upsertCampaign,
  upsertNcReason,
  upsertPromoCode,
} from "@/app/actions/erp-marketing";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { MarketingCataloguesPanel } from "@/components/marketing/MarketingCataloguesPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { listCataloguesForProperty } from "@/lib/marketing/catalogue";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sales & Marketing | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

async function createCampaignAction(formData: FormData) {
  "use server";
  await upsertCampaign({ ok: false }, formData);
}

async function createPromoAction(formData: FormData) {
  "use server";
  await upsertPromoCode({ ok: false }, formData);
}

async function createNcReasonAction(formData: FormData) {
  "use server";
  await upsertNcReason({ ok: false }, formData);
}

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const tab = sp.tab ?? "dashboard";

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [
    { data: campaigns },
    { data: promos },
    { data: reasons },
    { data: redemptions },
    { data: ncEvents },
    catalogues,
  ] = await Promise.all([
    admin
      .from("marketing_campaigns")
      .select(
        "id, name, objective, status, influencer_label, starts_at, ends_at, budget_btn, created_at",
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("promo_codes")
      .select(
        "id, code, name, benefit_type, benefit_value, max_redemptions, redeemed_count, active, starts_at, ends_at, applies_to, channels, campaign_id",
      )
      .eq("property_id", propertyId)
      .order("code")
      .limit(100),
    admin
      .from("nc_reason_codes")
      .select(
        "id, code, label, domains, requires_role, active, sort_order",
      )
      .eq("property_id", propertyId)
      .order("sort_order")
      .order("code")
      .limit(100),
    admin
      .from("promo_redemptions")
      .select("id, discount_btn, pre_discount_btn, channel, applies_domain, created_at, promo_codes(code)")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("nc_events")
      .select("id, domain, reason_code, list_value_btn, description, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(30),
    listCataloguesForProperty(admin, propertyId).catch(() => []),
  ]);

  const activePromos = (promos ?? []).filter((p) => p.active);
  const nearCap = activePromos.filter(
    (p) =>
      p.max_redemptions != null &&
      Number(p.redeemed_count) >= Number(p.max_redemptions) * 0.8,
  );
  const discountBurn = (redemptions ?? []).reduce(
    (s, r) => s + Number(r.discount_btn ?? 0),
    0,
  );
  const ncBurn = (ncEvents ?? []).reduce(
    (s, r) => s + Number(r.list_value_btn ?? 0),
    0,
  );
  const catalogueViews = catalogues.reduce(
    (s, c) => s + Number(c.view_count ?? 0),
    0,
  );

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "catalogues", label: "Catalogues" },
    { id: "campaigns", label: "Campaigns" },
    { id: "coupons", label: "Coupons" },
    { id: "nc", label: "NC policies" },
    { id: "roi", label: "ROI" },
  ] as const;

  return (
    <DeskListShell
      eyebrow="Channels"
      heading="Sales & Marketing"
      blurb="Campaigns, discount coupons (first-N caps, time windows), and non-chargeable (NC) reason policies. Desk executes NC on POS / rooms; commercials live here."
      filters={
        <nav className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={
                t.id === "dashboard"
                  ? "/erp/marketing"
                  : `/erp/marketing?tab=${t.id}`
              }
              className={
                tab === t.id
                  ? "rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
                  : "rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
              }
            >
              {t.label}
            </Link>
          ))}
        </nav>
      }
    >
      {tab === "dashboard" ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active campaigns"
              value={String(
                (campaigns ?? []).filter((c) => c.status === "active").length,
              )}
            />
            <StatCard
              label="Live coupons"
              value={String(activePromos.length)}
            />
            <StatCard
              label="Catalogue views"
              value={String(catalogueViews)}
            />
            <StatCard label="Recent NC list value" value={formatBtn(ncBurn)} />
          </div>
          {nearCap.length > 0 ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
              <p className="font-medium text-foreground">Near redemption cap</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {nearCap.map((p) => (
                  <li key={p.id as string}>
                    <span className="font-mono text-foreground">
                      {p.code as string}
                    </span>{" "}
                    {String(p.redeemed_count)}/
                    {String(p.max_redemptions)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              Latest redemptions
            </h2>
            <RedemptionTable rows={redemptions ?? []} />
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              Latest NC events
            </h2>
            <NcTable rows={ncEvents ?? []} />
          </section>
        </div>
      ) : null}

      {tab === "catalogues" ? (
        <MarketingCataloguesPanel
          catalogues={catalogues}
          promos={activePromos.map((p) => ({
            id: p.id as string,
            code: p.code as string,
            name: (p.name as string) ?? (p.code as string),
          }))}
        />
      ) : null}

      {tab === "campaigns" ? (
        <div className="space-y-6">
          <form
            action={createCampaignAction}
            className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <p className="sm:col-span-2 lg:col-span-3 text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
              New campaign
            </p>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Name</span>
              <Input
                name="name"
                required
                placeholder="TikTok spring fill"
                className="h-10"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Objective</span>
              <select
                name="objective"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="influencer"
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
              <span className="text-muted-foreground">Influencer label</span>
              <Input
                name="influencer_label"
                placeholder="TikTok @handle"
                className="h-10"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Starts</span>
              <Input name="starts_at" type="datetime-local" className="h-10" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Ends</span>
              <Input name="ends_at" type="datetime-local" className="h-10" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Budget (Nu)</span>
              <Input name="budget_btn" type="number" min={0} step="0.01" className="h-10" />
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="text-muted-foreground">Notes</span>
              <Input name="notes" placeholder="Brief" className="h-10" />
            </label>
            <input type="hidden" name="status" value="active" />
            <div className="flex items-end">
              <Button type="submit">Save campaign</Button>
            </div>
          </form>
          <CampaignTable rows={campaigns ?? []} />
        </div>
      ) : null}

      {tab === "coupons" ? (
        <div className="space-y-6">
          <form
            action={createPromoAction}
            className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <p className="sm:col-span-2 lg:col-span-3 text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
              New coupon (e.g. TIKTOK50 · first 100 · 50%)
            </p>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Code</span>
              <Input
                name="code"
                required
                placeholder="TIKTOK50"
                className="h-10 uppercase"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Name</span>
              <Input
                name="name"
                required
                placeholder="TikTok first 100"
                className="h-10"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Campaign</span>
              <select
                name="campaign_id"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">— none —</option>
                {(campaigns ?? []).map((c) => (
                  <option key={c.id as string} value={c.id as string}>
                    {c.name as string}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Benefit type</span>
              <select
                name="benefit_type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="pct"
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
                defaultValue={50}
                min={0}
                step="0.01"
                className="h-10"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Max redemptions</span>
              <Input
                name="max_redemptions"
                type="number"
                min={1}
                placeholder="100"
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
                className="h-10"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Min spend Nu</span>
              <Input
                name="min_spend_btn"
                type="number"
                min={0}
                defaultValue={0}
                className="h-10"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Min nights</span>
              <Input
                name="min_nights"
                type="number"
                min={0}
                defaultValue={0}
                className="h-10"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Starts</span>
              <Input name="starts_at" type="datetime-local" className="h-10" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Ends</span>
              <Input name="ends_at" type="datetime-local" className="h-10" />
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="text-muted-foreground">
                Applies to (comma)
              </span>
              <Input
                name="applies_to"
                defaultValue="rooms,pos,spa,laundry,guest_service,meal_plan"
                className="h-10"
              />
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="text-muted-foreground">Channels (comma)</span>
              <Input
                name="channels"
                defaultValue="public_book,desk_pos,desk_folio"
                className="h-10"
              />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="stackable_with_partner" value="1" />
              Stackable with partner discount
            </label>
            <div className="flex items-end">
              <Button type="submit">Save coupon</Button>
            </div>
          </form>
          <PromoTable rows={promos ?? []} />
        </div>
      ) : null}

      {tab === "nc" ? (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            NC policies define reason codes and authority. Staff mark lines NC
            on POS (manager PIN) or room assignments via desk calendar/folio.
            Stock and KOT still run; bill is Nu 0.
          </p>
          <form
            action={createNcReasonAction}
            className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <p className="sm:col-span-2 lg:col-span-3 text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
              Add NC reason
            </p>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Code</span>
              <Input name="code" required placeholder="owner_house" className="h-10" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Label</span>
              <Input name="label" required placeholder="Owner / house use" className="h-10" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">Requires role</span>
              <select
                name="requires_role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="manager"
              >
                <option value="supervisor">Supervisor</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="text-muted-foreground">Domains (comma)</span>
              <Input
                name="domains"
                defaultValue="pos,room"
                className="h-10"
              />
            </label>
            <div className="flex items-end">
              <Button type="submit">Save reason</Button>
            </div>
          </form>
          <NcReasonTable rows={reasons ?? []} />
        </div>
      ) : null}

      {tab === "roi" ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Discount equity (sample)" value={formatBtn(discountBurn)} />
            <StatCard label="NC list value (sample)" value={formatBtn(ncBurn)} />
          </div>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Redemptions</h2>
            <RedemptionTable rows={redemptions ?? []} />
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">NC ledger</h2>
            <NcTable rows={ncEvents ?? []} />
          </section>
          <p className="text-xs text-muted-foreground">
            Export path for CSV can plug into{" "}
            <code className="rounded bg-secondary px-1">/api/erp/export</code>{" "}
            later. Figures above are the latest 30 events, not full history.
          </p>
        </div>
      ) : null}
    </DeskListShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function CampaignTable({
  rows,
}: {
  rows: Record<string, unknown>[];
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
            <th className="px-3 py-2 font-medium">Influencer</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td className="px-3 py-2 font-medium">{String(r.name)}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {String(r.objective)}
              </td>
              <td className="px-3 py-2">{String(r.status)}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {String(r.influencer_label ?? "—")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PromoTable({ rows }: { rows: Record<string, unknown>[] }) {
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
            <th className="px-3 py-2 font-medium">Active</th>
            <th className="px-3 py-2 font-medium">Scope</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td className="px-3 py-2 font-mono font-medium">
                {String(r.code)}
              </td>
              <td className="px-3 py-2">
                {r.benefit_type === "pct"
                  ? `${r.benefit_value}%`
                  : formatBtn(Number(r.benefit_value))}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {String(r.redeemed_count)}
                {r.max_redemptions != null
                  ? ` / ${String(r.max_redemptions)}`
                  : ""}
              </td>
              <td className="px-3 py-2">{r.active ? "Yes" : "No"}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {Array.isArray(r.applies_to)
                  ? (r.applies_to as string[]).join(", ")
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NcReasonTable({ rows }: { rows: Record<string, unknown>[] }) {
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
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td className="px-3 py-2 font-mono">{String(r.code)}</td>
              <td className="px-3 py-2">{String(r.label)}</td>
              <td className="px-3 py-2">{String(r.requires_role)}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {Array.isArray(r.domains)
                  ? (r.domains as string[]).join(", ")
                  : "—"}
              </td>
              <td className="px-3 py-2">{r.active ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RedemptionTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No redemptions yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Code</th>
            <th className="px-3 py-2 font-medium">Channel</th>
            <th className="px-3 py-2 font-medium">Discount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => {
            const promo = r.promo_codes as
              | { code?: string }
              | { code?: string }[]
              | null;
            const code = Array.isArray(promo)
              ? promo[0]?.code
              : promo?.code;
            return (
              <tr key={String(r.id)}>
                <td className="px-3 py-2 text-muted-foreground">
                  {String(r.created_at).slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-3 py-2 font-mono">{code ?? "—"}</td>
                <td className="px-3 py-2">
                  {String(r.channel)} · {String(r.applies_domain)}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatBtn(Number(r.discount_btn))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NcTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No NC events yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Domain</th>
            <th className="px-3 py-2 font-medium">Reason</th>
            <th className="px-3 py-2 font-medium">List value</th>
            <th className="px-3 py-2 font-medium">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td className="px-3 py-2 text-muted-foreground">
                {String(r.created_at).slice(0, 16).replace("T", " ")}
              </td>
              <td className="px-3 py-2">{String(r.domain)}</td>
              <td className="px-3 py-2 font-mono">{String(r.reason_code)}</td>
              <td className="px-3 py-2 tabular-nums">
                {formatBtn(Number(r.list_value_btn))}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {String(r.description ?? "—")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
