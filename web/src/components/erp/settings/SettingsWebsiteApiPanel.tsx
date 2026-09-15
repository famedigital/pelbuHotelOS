"use client";

import { useActionState, useState } from "react";
import {
  createIntegrationApiKeyAction,
  revokeIntegrationApiKeyAction,
  rotateIntegrationApiKeyAction,
  type ApiKeyActionState,
} from "@/app/actions/property-api-keys";
import { SettingsSection } from "@/components/erp/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ApiKeyListRow } from "@/lib/website-api-keys";

const initial: ApiKeyActionState = { ok: false };

export function SettingsWebsiteApiPanel({
  keys,
  canEdit,
}: {
  keys: ApiKeyListRow[];
  canEdit: boolean;
}) {
  const [createState, createAction, createPending] = useActionState(
    createIntegrationApiKeyAction,
    initial,
  );
  const [revealed, setRevealed] = useState<string | null>(null);
  const shownKey = createState.fullKey ?? revealed;
  if (createState.fullKey && createState.fullKey !== revealed) {
    // Sync once when a new key is issued (client action state).
    queueMicrotask(() => setRevealed(createState.fullKey ?? null));
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        eyebrow="Integrations"
        title="Website & channel API"
        description="Issue per-hotel API keys so your website or a channel manager can read live inventory and create bookings. Keep keys on a server — never in browser JavaScript."
        blastRadius="External systems can search rooms and create holds/OTA reservations for this hotel only"
        status={keys.some((k) => !k.revokedAt) ? "ready" : "attention"}
      >
        {!canEdit ? (
          <p className="text-sm text-muted-foreground">
            Only Owner or GM can manage API keys.
          </p>
        ) : (
          <form action={createAction} className="space-y-4 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Label</Label>
              <Input
                id="api-key-name"
                name="name"
                required
                placeholder="e.g. Hotel website / Channex bridge"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key-purpose">Purpose</Label>
              <select
                id="api-key-purpose"
                name="purpose"
                defaultValue="both"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="both">Website + channel manager</option>
                <option value="website">Website only</option>
                <option value="channel_manager">Channel manager only</option>
              </select>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Scopes</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="scope_availability" defaultChecked />
                availability (stay search)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="scope_ari" defaultChecked />
                ari (daily calendar for channel managers)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="scope_bookings" defaultChecked />
                bookings (create / poll reservations)
              </label>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="cors_origins">CORS origins (optional)</Label>
              <Textarea
                id="cors_origins"
                name="cors_origins"
                rows={2}
                placeholder={"https://www.example.com\n(leave empty for server-to-server only)"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ip_allowlist">IP allowlist (optional)</Label>
              <Textarea
                id="ip_allowlist"
                name="ip_allowlist"
                rows={2}
                placeholder="One IP per line"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expires_at">Expires (optional)</Label>
              <Input id="expires_at" name="expires_at" type="datetime-local" />
            </div>
            {createState.error ? (
              <p className="text-sm text-destructive">{createState.error}</p>
            ) : null}
            <Button type="submit" disabled={createPending}>
              {createPending ? "Creating…" : "Generate API key"}
            </Button>
          </form>
        )}

        {shownKey ? (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
            <p className="text-sm font-medium">
              Copy this key now — it will not be shown again.
            </p>
            <code className="block break-all text-xs">{shownKey}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(shownKey)}
            >
              Copy
            </Button>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection
        eyebrow="Keys"
        title="Issued keys"
        description="Prefix is safe to display. Revoke immediately if a key leaks."
        blastRadius="Revoking cuts off that website or channel manager"
        status="ready"
      >
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No keys yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    {k.name}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({k.purpose})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {k.keyPrefix}… · scopes {k.scopes.join(", ")}
                    {k.revokedAt ? " · REVOKED" : ""}
                    {k.lastUsedAt
                      ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                {canEdit && !k.revokedAt ? (
                  <div className="flex gap-2">
                    <form action={rotateIntegrationApiKeyAction}>
                      <input type="hidden" name="key_id" value={k.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Rotate
                      </Button>
                    </form>
                    <form action={revokeIntegrationApiKeyAction}>
                      <input type="hidden" name="key_id" value={k.id} />
                      <Button type="submit" variant="destructive" size="sm">
                        Revoke
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </div>
  );
}
