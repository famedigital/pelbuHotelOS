import {
  CampaignForm,
  CampaignTable,
  NcReasonForm,
  NcReasonTable,
  PromoForm,
  PromoTable,
  RoiExportButton,
  type CampaignRow,
  type NcReasonRow,
  type PromoRow,
} from "@/components/marketing/MarketingAdminForms";
import {
  ContactForm,
  ContactTable,
  EmailBroadcastForm,
  type ContactRow,
} from "@/components/marketing/MarketingCrmForms";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { DeskViewSwitcher } from "@/components/erp/DeskViewSwitcher";
import { MarketingCataloguesPanel } from "@/components/marketing/MarketingCataloguesPanel";
import { MarketingShareHub } from "@/components/marketing/MarketingShareHub";
import { RateSheetsPanel } from "@/components/marketing/RateSheetsPanel";
import { BOOKABLE_AGENT_STATUSES } from "@/lib/agents/status";
import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { listCataloguesForProperty } from "@/lib/marketing/catalogue";
import { getMetaTokenConfig } from "@/lib/marketing/meta-share";
import { formatBtn } from "@/lib/pricing";
import { listRateSheetsForProperty, loadRateSheetBrand } from "@/app/actions/erp-rate-sheets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sales & Marketing | Hotel OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function parseDays(raw: string | undefined): number {
  const n = Number(raw ?? "90");
  if (!Number.isFinite(n) || n < 1) return 90;
  return Math.min(365, Math.floor(n));
}

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    promo_id?: string;
    campaign_id?: string;
    reason_id?: string;
    contact_id?: string;
    days?: string;
    q?: string;
  }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const tab = sp.tab ?? "dashboard";
  const roiDays = parseDays(sp.days);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - roiDays);
  const sinceIso = since.toISOString();

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const deskRole = await getDeskRole();
  const canEmail = deskRole === "owner" || deskRole === "gm";
  const metaCfg = getMetaTokenConfig();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

  const [
    { data: campaignsRaw },
    { data: promosRaw },
    { data: reasonsRaw },
    { data: redemptionsRecent },
    { data: ncEventsRecent },
    { data: redemptionsRange },
    { data: ncEventsRange },
    catalogues,
    rateSheets,
    rateSheetBrand,
    { data: contactsRaw },
    { data: agentsRaw },
    { data: emailSendsRaw },
  ] = await Promise.all([
    admin
      .from("marketing_campaigns")
      .select(
        "id, name, objective, status, influencer_label, starts_at, ends_at, budget_btn, notes, meta_post_url, ig_handle, meta_posted_at, meta_post_notes, created_at",
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("promo_codes")
      .select(
        "id, code, name, benefit_type, benefit_value, max_redemptions, redeemed_count, active, starts_at, ends_at, applies_to, channels, campaign_id, max_per_guest, min_spend_btn, min_nights, max_discount_btn, stackable_with_partner, notes",
      )
      .eq("property_id", propertyId)
      .order("code")
      .limit(100),
    admin
      .from("nc_reason_codes")
      .select(
        "id, code, label, domains, requires_role, active, sort_order, notes",
      )
      .eq("property_id", propertyId)
      .order("sort_order")
      .order("code")
      .limit(100),
    admin
      .from("promo_redemptions")
      .select(
        "id, discount_btn, pre_discount_btn, channel, applies_domain, created_at, promo_codes(code)",
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("nc_events")
      .select("id, domain, reason_code, list_value_btn, description, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("promo_redemptions")
      .select(
        "id, discount_btn, pre_discount_btn, channel, applies_domain, created_at, promo_code_id, promo_codes(code, campaign_id)",
      )
      .eq("property_id", propertyId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5000),
    admin
      .from("nc_events")
      .select("id, domain, reason_code, list_value_btn, description, created_at")
      .eq("property_id", propertyId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5000),
    listCataloguesForProperty(admin, propertyId).catch(() => []),
    listRateSheetsForProperty(propertyId).catch(() => []),
    loadRateSheetBrand(propertyId).catch(() => ({
      name: "Hotel",
      legalName: null,
      logoPublicId: null,
      logoSrc: null,
      phone: null,
      whatsapp: null,
      email: null,
      address: null,
      webUrl: null,
      webLabel: null,
      settingsHref: "/erp/settings?tab=identity",
    })),
    admin
      .from("marketing_contacts")
      .select(
        "id, full_name, email, phone, whatsapp, contact_type, tags, notes, source, last_touched_at, campaign_id, agent_id",
      )
      .eq("property_id", propertyId)
      .order("last_touched_at", { ascending: false })
      .limit(200),
    admin
      .from("agents")
      .select("id, company_name, status")
      .in("status", [...BOOKABLE_AGENT_STATUSES])
      .order("company_name")
      .limit(1000),
    admin
      .from("marketing_email_sends")
      .select("id, to_email, subject, status, created_at, error")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const campaigns = (campaignsRaw ?? []) as CampaignRow[];
  const promos = (promosRaw ?? []) as PromoRow[];
  const reasons = (reasonsRaw ?? []) as NcReasonRow[];
  const contacts = (contactsRaw ?? []) as ContactRow[];
  const agents = (agentsRaw ?? []) as { id: string; company_name: string }[];
  const emailSends = (emailSendsRaw ?? []) as {
    id: string;
    to_email: string;
    subject: string;
    status: string;
    created_at: string;
    error: string | null;
  }[];

  const editCampaign = sp.campaign_id
    ? (campaigns.find((c) => c.id === sp.campaign_id) ?? null)
    : null;
  const editPromo = sp.promo_id
    ? (promos.find((p) => p.id === sp.promo_id) ?? null)
    : null;
  const editReason = sp.reason_id
    ? (reasons.find((r) => r.id === sp.reason_id) ?? null)
    : null;
  const editContact = sp.contact_id
    ? (contacts.find((c) => c.id === sp.contact_id) ?? null)
    : null;

  const activePromos = promos.filter((p) => p.active);
  const nearCap = activePromos.filter(
    (p) =>
      p.max_redemptions != null &&
      Number(p.redeemed_count) >= Number(p.max_redemptions) * 0.8,
  );

  const rangeRedemptions = redemptionsRange ?? [];
  const rangeNc = ncEventsRange ?? [];
  const discountBurn = rangeRedemptions.reduce(
    (s, r) => s + Number(r.discount_btn ?? 0),
    0,
  );
  const ncBurn = rangeNc.reduce(
    (s, r) => s + Number(r.list_value_btn ?? 0),
    0,
  );
  const catalogueViews = catalogues.reduce(
    (s, c) => s + Number(c.view_count ?? 0),
    0,
  );
  const catalogueSocialDls = catalogues.reduce(
    (s, c) => s + Number(c.social_download_count ?? 0),
    0,
  );
  const publishedCatalogues = catalogues.filter(
    (c) => c.status === "published",
  ).length;

  const discountByCampaign = new Map<string, number>();
  for (const r of rangeRedemptions) {
    const promo = r.promo_codes as
      | { campaign_id?: string | null; code?: string }
      | { campaign_id?: string | null; code?: string }[]
      | null;
    const p = Array.isArray(promo) ? promo[0] : promo;
    const cid = p?.campaign_id;
    if (!cid) continue;
    discountByCampaign.set(
      cid,
      (discountByCampaign.get(cid) ?? 0) + Number(r.discount_btn ?? 0),
    );
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "rate-sheets", label: "Rate sheets" },
    { id: "catalogues", label: "Catalogues" },
    { id: "campaigns", label: "Campaigns" },
    { id: "coupons", label: "Coupons" },
    { id: "contacts", label: "Contacts" },
    { id: "email", label: "Email" },
    { id: "share", label: "Share / Meta" },
    { id: "nc", label: "NC policies" },
    { id: "roi", label: "ROI" },
  ] as const;

  return (
    <DeskListShell
      eyebrow="Channels"
      heading="Sales & Marketing"
      subtitle="Campaigns, coupons, rate sheets, CRM, catalogues, and NC"
      blurb="Campaigns, coupons, editable public rate cards, CRM contacts, email broadcast (owner/GM), Meta share hub, catalogues, and NC policies."
      filters={
        <DeskViewSwitcher
          label="Marketing sections"
          items={tabs.map((t) => ({
            href:
              t.id === "dashboard"
                ? "/erp/marketing"
                : `/erp/marketing?tab=${t.id}`,
            label: t.label,
            active: tab === t.id,
          }))}
        />
      }
    >
      {tab === "dashboard" ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active campaigns"
              value={String(
                campaigns.filter((c) => c.status === "active").length,
              )}
            />
            <StatCard
              label="Live coupons"
              value={String(activePromos.length)}
            />
            <StatCard label="CRM contacts" value={String(contacts.length)} />
            <StatCard
              label={`NC list value (${roiDays}d)`}
              value={formatBtn(ncBurn)}
            />
          </div>
          {nearCap.length > 0 ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
              <p className="font-medium text-foreground">Near redemption cap</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {nearCap.map((p) => (
                  <li key={p.id}>
                    <span className="font-mono text-foreground">{p.code}</span>{" "}
                    {p.redeemed_count}/{p.max_redemptions}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              Latest redemptions
            </h2>
            <RedemptionTable rows={redemptionsRecent ?? []} />
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              Latest NC events
            </h2>
            <NcTable rows={ncEventsRecent ?? []} />
          </section>
          <p className="text-xs text-muted-foreground">
            Catalogue views (all-time): {catalogueViews}
          </p>
        </div>
      ) : null}

      {tab === "rate-sheets" ? (
        <RateSheetsPanel sheets={rateSheets} brand={rateSheetBrand} />
      ) : null}

      {tab === "catalogues" ? (
        <MarketingCataloguesPanel
          catalogues={catalogues}
          promos={activePromos.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name ?? p.code,
          }))}
        />
      ) : null}

      {tab === "campaigns" ? (
        <div className="space-y-6">
          <CampaignForm campaign={editCampaign} />
          <CampaignTable rows={campaigns} editId={editCampaign?.id} />
        </div>
      ) : null}

      {tab === "coupons" ? (
        <div className="space-y-6">
          <PromoForm
            promo={editPromo}
            campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
          />
          <PromoTable rows={promos} editId={editPromo?.id} />
        </div>
      ) : null}

      {tab === "contacts" ? (
        <div className="space-y-6">
          <ContactForm
            contact={editContact}
            campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
            agents={agents}
          />
          <ContactSearchForm defaultQ={sp.q ?? ""} />
          <ContactTable
            rows={contacts}
            editId={editContact?.id}
            q={sp.q}
          />
        </div>
      ) : null}

      {tab === "email" ? (
        <EmailBroadcastForm
          contacts={contacts}
          campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
          canSend={canEmail}
          recentSends={emailSends}
        />
      ) : null}

      {tab === "share" ? (
        <MarketingShareHub
          catalogueLinks={catalogues
            .filter((c) => c.status === "published")
            .map((c) => ({
              id: c.id,
              title: c.title,
              publicPath: `/c/${c.slug}`,
            }))}
          campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
          graphEnabled={metaCfg.graphEnabled}
          siteUrl={siteUrl}
        />
      ) : null}

      {tab === "nc" ? (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            NC policies define reason codes and authority. Staff mark lines NC on
            POS (manager PIN) or room assignments via StayHub (Reserve / Stay
            Money). Stock and KOT still run; bill is Nu 0.
          </p>
          <NcReasonForm reason={editReason} />
          <NcReasonTable rows={reasons} editId={editReason?.id} />
        </div>
      ) : null}

      {tab === "roi" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Property totals for the last{" "}
              <span className="font-medium text-foreground">{roiDays}</span>{" "}
              days (not the 30-row sample below).
            </p>
            <div className="flex flex-wrap gap-2">
              {[30, 90, 180].map((d) => (
                <Link
                  key={d}
                  href={`/erp/marketing?tab=roi&days=${d}`}
                  className={
                    roiDays === d
                      ? "rounded-md bg-accent px-2.5 py-1 text-xs font-medium"
                      : "rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary"
                  }
                >
                  {d}d
                </Link>
              ))}
            </div>
            <RoiExportButton
              redemptions={(rangeRedemptions as Record<string, unknown>[]) ?? []}
              ncEvents={(rangeNc as Record<string, unknown>[]) ?? []}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label={`Promo discount burn (${roiDays}d)`}
              value={formatBtn(discountBurn)}
            />
            <StatCard
              label={`NC list value (${roiDays}d)`}
              value={formatBtn(ncBurn)}
            />
            <StatCard
              label="Redemptions + NC events"
              value={String(rangeRedemptions.length + rangeNc.length)}
            />
            <StatCard
              label="Published catalogues"
              value={String(publishedCatalogues)}
            />
            <StatCard
              label="Catalogue views (all-time)"
              value={String(catalogueViews)}
            />
            <StatCard
              label="Social crop opens (all-time)"
              value={String(catalogueSocialDls)}
            />
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Campaign vs budget</h2>
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No campaigns yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Campaign</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Discount redeemed</th>
                      <th className="px-3 py-2 font-medium">Budget</th>
                      <th className="px-3 py-2 font-medium">Vs budget</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {campaigns.map((c) => {
                      const spent = discountByCampaign.get(c.id) ?? 0;
                      const budget =
                        c.budget_btn != null ? Number(c.budget_btn) : null;
                      const pct =
                        budget != null && budget > 0
                          ? Math.round((spent / budget) * 100)
                          : null;
                      return (
                        <tr key={c.id}>
                          <td className="px-3 py-2 font-medium">{c.name}</td>
                          <td className="px-3 py-2">{c.status}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatBtn(spent)}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {budget != null ? formatBtn(budget) : "—"}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {pct != null ? `${pct}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">
              Recent redemptions (sample)
            </h2>
            <RedemptionTable rows={redemptionsRecent ?? []} />
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Recent NC ledger (sample)</h2>
            <NcTable rows={ncEventsRecent ?? []} />
          </section>
        </div>
      ) : null}
    </DeskListShell>
  );
}

function ContactSearchForm({ defaultQ }: { defaultQ: string }) {
  return (
    <form className="flex flex-wrap gap-2" action="/erp/marketing" method="get">
      <input type="hidden" name="tab" value="contacts" />
      <input
        name="q"
        defaultValue={defaultQ}
        placeholder="Search name, email, tags…"
        className="h-10 min-w-[16rem] flex-1 rounded-md border border-input bg-background px-3 text-sm"
      />
      <button
        type="submit"
        className="h-10 rounded-md border px-3 text-sm hover:bg-secondary"
      >
        Search
      </button>
    </form>
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
