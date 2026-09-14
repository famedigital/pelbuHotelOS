import { createPropertyIdentity } from "@/app/actions/erp-properties";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { PropertySetupModalShell } from "@/components/erp/setup/PropertySetupModalShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Add hotel | Hotel OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const fieldClass =
  "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export default async function NewPropertyPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  return (
    <PropertySetupModalShell
      step={1}
      title="Hotel identity"
      blurb="Create the property shell, then walk rooms, rates, outlets, and bank details until setup is marked complete."
    >
      <PropertyWizardForm action={createPropertyIdentity}>
        <div className="space-y-1.5">
          <Label htmlFor="name">Hotel name</Label>
          <Input id="name" name="name" required placeholder="Pelbu Suites Olakha" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="legal_name">Legal name</Label>
          <Input
            id="legal_name"
            name="legal_name"
            placeholder="Same as hotel name if sole prop"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug (URL key)</Label>
          <Input id="slug" name="slug" placeholder="auto from name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            name="address"
            rows={2}
            className={fieldClass}
            placeholder="Olakha, Thimphu, Bhutan"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" placeholder="+975 …" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tax_id">TPN / GST tax ID</Label>
            <Input id="tax_id" name="tax_id" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" name="timezone" defaultValue="Asia/Thimphu" />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="clone_from"
            value="flagship"
            className="mt-0.5"
          />
          <span>
            Clone rooms, seasons, and rates from Pelbu Suites (optional —
            leave off for a blank inventory)
          </span>
        </label>
        <Button type="submit" className="h-11 w-full">
          Create and continue
        </Button>
      </PropertyWizardForm>
    </PropertySetupModalShell>
  );
}
