import { createPropertyIdentity } from "@/app/actions/erp-properties";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  listProperties,
  resolveActivePropertyId,
} from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Add hotel | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const [activeId, properties] = await Promise.all([
    resolveActivePropertyId(admin),
    listProperties(admin),
  ]);

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader
        title="Add hotel"
        properties={properties}
        activePropertyId={activeId}
      />
      <main className="mx-auto max-w-xl space-y-8 px-6 py-10 md:px-8">
        <div>
          <p className="text-xs tracking-[0.25em] text-gold uppercase">
            Step 1 of 5
          </p>
          <h2 className="mt-2 text-2xl text-espresso">Hotel identity</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create the property, then continue through rooms, income streams,
            holds, and bank details.
          </p>
        </div>
        <PropertyWizardForm action={createPropertyIdentity}>
          <label className="block text-sm text-muted-foreground">
            Hotel name
            <input
              name="name"
              required
              className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-gold"
            />
          </label>
          <label className="block text-sm text-muted-foreground">
            Slug (URL key)
            <input
              name="slug"
              placeholder="auto from name"
              className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-gold"
            />
          </label>
          <label className="block text-sm text-muted-foreground">
            Timezone
            <input
              name="timezone"
              defaultValue="Asia/Thimphu"
              className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-gold"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-espresso">
            <input type="checkbox" name="clone_from" value="flagship" defaultChecked />
            Clone rooms, seasons, and rates from Pelbu Suites
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
          >
            Create and continue
          </button>
        </PropertyWizardForm>
      </main>
    </div>
  );
}
