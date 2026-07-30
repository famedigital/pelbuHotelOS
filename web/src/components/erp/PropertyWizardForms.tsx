"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PropertyWizardState } from "@/app/actions/erp-properties";
import { useActionToast } from "@/hooks/use-action-toast";
import { TriangleAlertIcon } from "lucide-react";
import { useActionState, type ReactNode } from "react";

const initial: PropertyWizardState = { ok: false };

export function PropertyWizardForm({
  action,
  children,
}: {
  action: (
    prev: PropertyWizardState,
    formData: FormData,
  ) => Promise<PropertyWizardState>;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  useActionToast(state, { successMessage: "Saved" });
  return (
    <form action={formAction} className="erp space-y-4">
      {state.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.ok && state.message ? (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          {state.message}
        </p>
      ) : null}
      <fieldset disabled={pending} className="space-y-4">
        {children}
      </fieldset>
    </form>
  );
}
