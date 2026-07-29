"use client";

import type { PropertyWizardState } from "@/app/actions/erp-properties";
import { useActionToast } from "@/hooks/use-action-toast";
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
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p
          className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="border border-espresso/10 bg-white px-4 py-3 text-sm text-muted-foreground">
          {state.message}
        </p>
      ) : null}
      <fieldset disabled={pending} className="space-y-4">
        {children}
      </fieldset>
    </form>
  );
}
