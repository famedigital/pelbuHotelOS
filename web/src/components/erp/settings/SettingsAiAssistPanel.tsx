"use client";

import {
  savePropertyGeminiByok,
  type AiSettingsState,
} from "@/app/actions/erp-ai-assist";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: AiSettingsState = { ok: false };

export function SettingsAiAssistPanel({
  propertyId,
  enabled,
  model,
  maskedKey,
  canEdit,
}: {
  propertyId: string;
  enabled: boolean;
  model: string;
  maskedKey: string | null;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(
    savePropertyGeminiByok,
    initial,
  );
  useActionToast(state, { successMessage: "Gemini Assist saved" });

  return (
    <section className="rounded-xl border bg-card p-5 md:p-6">
      <div className="mb-5 space-y-1.5">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Assist
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Gemini (your key)
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Paste this hotel&apos;s Gemini API key. Assist drafts check-in, Due
          explanations, checkout checks, and POS tickets — it never writes money
          without a visible Confirm. Platform finance receipt Gemini stays
          separate.
        </p>
      </div>

      {state.error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          View only — Owner or Manager can change this. Currently:{" "}
          <span className="font-medium text-foreground">
            {enabled ? "enabled" : "off"}
          </span>
          {maskedKey ? ` · key ${maskedKey}` : " · no key"} · model {model}
        </p>
      ) : (
        <form action={action} className="space-y-4">
          <input type="hidden" name="property_id" value={propertyId} />
          <div className="space-y-1.5">
            <Label htmlFor="gemini_api_key">API key</Label>
            <Input
              id="gemini_api_key"
              name="gemini_api_key"
              type="password"
              autoComplete="off"
              placeholder={
                maskedKey
                  ? `Saved (${maskedKey}) — paste to replace`
                  : "AIza…"
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gemini_model">Model</Label>
            <select
              id="gemini_model"
              name="gemini_model"
              defaultValue={model}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="gemini-3.8-flash">gemini-3.8-flash</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
            </select>
          </div>
          <div className="flex min-h-11 items-start gap-3 rounded-lg border px-4 py-3">
            <Checkbox
              id="enabled"
              name="enabled"
              value="on"
              defaultChecked={enabled}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="enabled" className="text-sm font-medium">
                Enable desk Assist
              </Label>
              <p className="text-xs text-muted-foreground">
                Off until you paste a key. Drafts only — Confirm still required.
              </p>
            </div>
          </div>
          {maskedKey ? (
            <div className="flex min-h-11 items-start gap-3 rounded-lg border px-4 py-3">
              <Checkbox
                id="clear_key"
                name="clear_key"
                value="on"
                className="mt-0.5"
              />
              <Label htmlFor="clear_key" className="text-sm">
                Remove saved key
              </Label>
            </div>
          ) : null}
          <Button type="submit" className="h-11" disabled={pending}>
            {pending ? "Saving…" : "Save Gemini Assist"}
          </Button>
        </form>
      )}
    </section>
  );
}
