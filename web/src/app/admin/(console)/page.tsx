import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { formatBtn } from "@/lib/pricing-catalog";

export const metadata = {
  title: "Platform dashboard",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let hotels = 0;
  let distributors = 0;
  let leads = 0;
  let overdueAmc = 0;
  let royaltyDue = 0;

  try {
    const admin = createSupabaseAdminClient();
    const [p, d, l, a, r] = await Promise.all([
      admin.from("properties").select("id", { count: "exact", head: true }).eq("is_demo", false),
      admin.from("distributors").select("id", { count: "exact", head: true }),
      admin.from("sales_leads").select("id", { count: "exact", head: true }).eq("status", "new"),
      admin
        .from("amc_invoices")
        .select("id", { count: "exact", head: true })
        .eq("status", "overdue"),
      admin
        .from("royalty_invoices")
        .select("amount_btn")
        .in("status", ["sent", "overdue", "draft"]),
    ]);
    hotels = p.count ?? 0;
    distributors = d.count ?? 0;
    leads = l.count ?? 0;
    overdueAmc = a.count ?? 0;
    royaltyDue = (r.data ?? []).reduce(
      (sum, row) => sum + Number(row.amount_btn ?? 0),
      0,
    );
  } catch {
    // migrations not applied yet
  }

  const cards = [
    { label: "Hotels", value: String(hotels), href: "/admin/hotels" },
    { label: "Distributors", value: String(distributors), href: "/admin/distributors" },
    { label: "New leads", value: String(leads), href: "/admin/leads" },
    { label: "AMC overdue", value: String(overdueAmc), href: "/admin/hotels" },
    {
      label: "Royalty open",
      value: formatBtn(royaltyDue),
      href: "/admin/royalty",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          All hotels, distributors, royalty, and leads across Bhutan.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border bg-card p-4 transition hover:border-primary/40"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{c.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
