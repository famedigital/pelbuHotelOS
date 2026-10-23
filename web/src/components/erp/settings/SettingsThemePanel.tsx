import { updateDeskTheme } from "@/app/actions/erp-settings";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { SettingsSection } from "@/components/erp/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { DESK_THEME_CHOICES, type DeskTheme } from "@/lib/desk-theme";

export function SettingsThemePanel({
  propertyId,
  theme,
  canEdit,
}: {
  propertyId: string;
  theme: DeskTheme;
  canEdit: boolean;
}) {
  return (
    <SettingsSection
      eyebrow="Look"
      title="Desk theme"
      description="One skin for this hotel. Room status colors stay the same on every skin."
      blastRadius="desk canvas, sidebar, buttons, and cards for this property"
      status="ready"
    >
      <PropertyWizardForm action={updateDeskTheme}>
        <input type="hidden" name="property_id" value={propertyId} />
        <div className="grid gap-2 sm:grid-cols-2">
          {DESK_THEME_CHOICES.map((choice) => (
            <label
              key={choice.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background p-3 has-[:checked]:border-ring"
            >
              <input
                type="radio"
                name="desk_theme"
                value={choice.id}
                defaultChecked={choice.id === theme}
                disabled={!canEdit}
                className="size-4"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-foreground">
                  {choice.name}
                </span>
                <span className="text-xs text-muted-foreground">{choice.note}</span>
              </span>
              <span className="flex shrink-0 overflow-hidden rounded-md border border-border">
                <span
                  className="size-6"
                  style={{ backgroundColor: choice.canvas }}
                />
                <span
                  className="size-6"
                  style={{ backgroundColor: choice.metal }}
                />
                <span
                  className="size-6"
                  style={{ backgroundColor: choice.signal }}
                />
              </span>
            </label>
          ))}
        </div>
        {canEdit ? (
          <Button type="submit">Save theme</Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            An owner or general manager can change the theme.
          </p>
        )}
      </PropertyWizardForm>
    </SettingsSection>
  );
}
