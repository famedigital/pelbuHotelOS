import { createPropertyIdentity } from "@/app/actions/erp-properties";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Add hotel | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  // Keep auth-anchored; the layout renders the shell.
  void createSupabaseAdminClient();

  return (
    <div className="erp mx-auto w-full max-w-xl space-y-8 p-4 md:p-6">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Step 1 of 5
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Hotel identity
        </h2>
        <p className="text-sm text-muted-foreground">
          Create the property, then continue through rooms, income streams,
          holds, and bank details.
        </p>
      </div>
      <PropertyWizardForm action={createPropertyIdentity}>
        <div className="space-y-1.5">
          <Label htmlFor="name">Hotel name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug (URL key)</Label>
          <Input id="slug" name="slug" placeholder="auto from name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" name="timezone" defaultValue="Asia/Thimphu" />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="clone_from" name="clone_from" value="flagship" defaultChecked />
          <Label htmlFor="clone_from" className="text-sm text-foreground">
            Clone rooms, seasons, and rates from Pelbu Suites
          </Label>
        </div>
        <Button type="submit" className="h-11 w-full">
          Create and continue
        </Button>
      </PropertyWizardForm>
    </div>
  );
}
