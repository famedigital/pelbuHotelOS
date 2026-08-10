import {
  logFnbCleaning,
  logFnbGas,
  logFnbTemp,
  logFnbWaste,
} from "@/app/actions/erp-fnb-ops";
import { ComplianceForms } from "@/components/erp/fnb/ComplianceForms";
import { FnbSectionHeader } from "@/components/erp/fnb/FnbSectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { thimphuToday } from "@/lib/erp-lists";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function KitchenCompliancePage() {
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const day = thimphuToday();
  const dayStart = `${day}T00:00:00+06:00`;

  const [{ data: waste }, { data: temps }, { data: clean }, { data: gas }] =
    await Promise.all([
      admin
        .from("fnb_waste_log")
        .select("id, item_name, qty, unit, reason_code, logged_at")
        .eq("property_id", propertyId)
        .eq("business_date", day)
        .order("logged_at", { ascending: false })
        .limit(20),
      admin
        .from("fnb_temp_log")
        .select("id, location_label, temp_c, in_range, logged_at")
        .eq("property_id", propertyId)
        .gte("logged_at", dayStart)
        .order("logged_at", { ascending: false })
        .limit(20),
      admin
        .from("fnb_cleaning_log")
        .select("id, area, task, completed_by_name")
        .eq("property_id", propertyId)
        .eq("business_date", day)
        .limit(30),
      admin
        .from("fnb_gas_log")
        .select("id, cylinders, cost_btn, business_date")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <FnbSectionHeader
        title="BFDA / kitchen compliance"
        description={`Waste book · fridge temps · cleaning sign-off · LPG · ${day}. Print this page for inspections.`}
      />
      <Link href="/erp/kitchen" className="text-sm text-muted-foreground">
        ← Kitchen board
      </Link>

      <ComplianceForms
        wasteAction={logFnbWaste}
        tempAction={logFnbTemp}
        cleanAction={logFnbCleaning}
        gasAction={logFnbGas}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <LogCard title="Waste today">
          {(waste ?? []).map((w) => (
            <li key={w.id as string} className="text-sm">
              {String(w.item_name)} · {String(w.qty)}
              {String(w.unit)} · {String(w.reason_code)}
            </li>
          ))}
        </LogCard>
        <LogCard title="Temperatures today">
          {(temps ?? []).map((t) => (
            <li key={t.id as string} className="text-sm">
              {String(t.location_label)} · {String(t.temp_c)}°C
              {!t.in_range ? " · OUT OF RANGE" : ""}
            </li>
          ))}
        </LogCard>
        <LogCard title="Cleaning sign-off">
          {(clean ?? []).map((c) => (
            <li key={c.id as string} className="text-sm">
              {String(c.area)} · {String(c.task)} ·{" "}
              {String(c.completed_by_name ?? "")}
            </li>
          ))}
        </LogCard>
        <LogCard title="LPG / gas">
          {(gas ?? []).map((g) => (
            <li key={g.id as string} className="text-sm">
              {String(g.business_date)} · {String(g.cylinders)} cyl
              {g.cost_btn != null ? ` · Nu ${g.cost_btn}` : ""}
            </li>
          ))}
        </LogCard>
      </div>
    </div>
  );
}

function LogCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">{children}</ul>
      </CardContent>
    </Card>
  );
}
