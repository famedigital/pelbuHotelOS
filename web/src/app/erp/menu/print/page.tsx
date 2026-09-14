import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadAllMenuItems } from "@/lib/menu-admin";
import { MENU_PRINT_TEMPLATES } from "@/lib/menu-print-templates";
import { loadPropertyOutlets } from "@/lib/outlets";
import {
  loadProperty,
  resolveActivePropertyId,
} from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Print menu | Hotel OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MenuPrintIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const params = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const [property, outlets, items] = await Promise.all([
    loadProperty(admin, propertyId),
    loadPropertyOutlets(admin, propertyId),
    loadAllMenuItems(admin),
  ]);

  const available = items.filter((i) => i.is_available !== false);
  const outletFilter = params.outlet?.trim() || "all";
  const activeOutlets = outlets.filter((o) => o.is_active);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
          F&amp;B · print
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Print menu</h1>
        <p className="text-sm text-muted-foreground">
          Live prices from the catalog ({available.length} available items).
          Templates echo designs in{" "}
          <code className="text-xs">marketing/print/</code> — open one, then
          Print / PDF (background graphics ON, margins default or none).
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <label htmlFor="outlet" className="text-xs font-medium">
            Outlet
          </label>
          <select
            id="outlet"
            name="outlet"
            defaultValue={outletFilter}
            className="h-10 min-w-[12rem] rounded-md border px-3 text-sm"
          >
            <option value="all">All outlets</option>
            {activeOutlets.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Apply
        </Button>
        <Button type="button" size="sm" variant="ghost" asChild>
          <Link href="/erp/menu">← Catalog</Link>
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {MENU_PRINT_TEMPLATES.map((t) => {
          const qs = new URLSearchParams();
          if (outletFilter !== "all") qs.set("outlet", outletFilter);
          const href = `/erp/menu/print/${t.id}${qs.toString() ? `?${qs}` : ""}`;
          return (
            <Card key={t.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {t.paper} · {t.blurb}
                </p>
              </CardHeader>
              <CardContent className="mt-auto flex flex-col gap-2">
                <p className="text-[11px] text-muted-foreground">{t.source}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="citrus" asChild>
                    <Link href={href}>Open</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`${href}${href.includes("?") ? "&" : "?"}print=1`}>
                      Open &amp; print
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Property: {property?.name ?? "—"} · Hide sold-out / archived items are
        omitted; edit catalog then re-print.
      </p>
    </div>
  );
}
