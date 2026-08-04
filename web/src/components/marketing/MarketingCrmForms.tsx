"use client";

import {
  sendMarketingEmailCampaign,
  upsertMarketingContact,
  type MarketingState,
} from "@/app/actions/erp-marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { MARKETING_EMAIL_BATCH_MAX } from "@/lib/marketing/email-batch-limit";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

const initial: MarketingState = { ok: false };

const field =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function Feedback({ state }: { state: MarketingState }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      role="status"
      className={`text-sm sm:col-span-2 lg:col-span-3 ${
        state.error ? "text-destructive" : "text-emerald-700"
      }`}
    >
      {state.error ?? state.message}
    </p>
  );
}

export type ContactRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  contact_type: string;
  tags: string[] | null;
  notes: string | null;
  source: string | null;
  last_touched_at: string | null;
  campaign_id: string | null;
  agent_id: string | null;
};

export function ContactForm({
  contact,
  campaigns,
  agents,
}: {
  contact?: ContactRow | null;
  campaigns: { id: string; name: string }[];
  agents: { id: string; company_name: string }[];
}) {
  const [state, action, pending] = useActionState(
    upsertMarketingContact,
    initial,
  );
  useActionToast(state, { successMessage: "Contact saved" });
  const isEdit = Boolean(contact?.id);

  return (
    <form
      action={action}
      className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {isEdit ? (
        <input type="hidden" name="contact_id" value={contact!.id} />
      ) : null}
      <p className="sm:col-span-2 lg:col-span-3 text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
        {isEdit ? `Edit · ${contact!.full_name}` : "New contact"}
      </p>
      {isEdit ? (
        <p className="sm:col-span-2 lg:col-span-3 text-xs text-muted-foreground">
          <Link href="/erp/marketing?tab=contacts" className="underline">
            Cancel edit
          </Link>
        </p>
      ) : null}
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input
          name="full_name"
          required
          defaultValue={contact?.full_name ?? ""}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Type</span>
        <select
          name="contact_type"
          className={field}
          defaultValue={contact?.contact_type ?? "influencer"}
        >
          <option value="guest">Guest</option>
          <option value="agent">Agent</option>
          <option value="influencer">Influencer</option>
          <option value="media">Media</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Email</span>
        <Input
          name="email"
          type="email"
          defaultValue={contact?.email ?? ""}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Phone</span>
        <Input
          name="phone"
          defaultValue={contact?.phone ?? ""}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">WhatsApp</span>
        <Input
          name="whatsapp"
          defaultValue={contact?.whatsapp ?? ""}
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Tags (comma)</span>
        <Input
          name="tags"
          defaultValue={(contact?.tags ?? []).join(", ")}
          placeholder="tiktok, press"
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Source</span>
        <Input
          name="source"
          defaultValue={contact?.source ?? ""}
          placeholder="walk-in / IG DM / list import"
          className="h-10"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Link campaign</span>
        <select
          name="campaign_id"
          className={field}
          defaultValue={contact?.campaign_id ?? ""}
        >
          <option value="">—</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">Link agent (optional)</span>
        <select
          name="agent_id"
          className={field}
          defaultValue={contact?.agent_id ?? ""}
        >
          <option value="">— free contact —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.company_name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1.5 text-sm sm:col-span-2">
        <span className="text-muted-foreground">Notes</span>
        <Input
          name="notes"
          defaultValue={contact?.notes ?? ""}
          className="h-10"
        />
      </label>
      <Feedback state={state} />
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Update contact" : "Save contact"}
        </Button>
      </div>
    </form>
  );
}

export function ContactTable({
  rows,
  editId,
  q,
}: {
  rows: ContactRow[];
  editId?: string | null;
  q?: string;
}) {
  const filtered = useMemo(() => {
    const needle = (q ?? "").trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const blob = [
        r.full_name,
        r.email,
        r.phone,
        r.whatsapp,
        r.contact_type,
        r.source,
        ...(r.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [rows, q]);

  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No contacts yet. Add influencers, media, or free email leads here
        without duplicating guests.
      </p>
    );
  }
  if (!filtered.length) {
    return (
      <p className="text-sm text-muted-foreground">No contacts match search.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Phone</th>
            <th className="px-3 py-2 font-medium">Tags</th>
            <th className="px-3 py-2 font-medium">Touched</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {filtered.map((r) => (
            <tr
              key={r.id}
              className={editId === r.id ? "bg-accent/10" : undefined}
            >
              <td className="px-3 py-2 font-medium">{r.full_name}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.contact_type}
              </td>
              <td className="px-3 py-2">{r.email ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.phone ?? r.whatsapp ?? "—"}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {(r.tags ?? []).join(", ") || "—"}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {r.last_touched_at
                  ? String(r.last_touched_at).slice(0, 10)
                  : "—"}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/erp/marketing?tab=contacts&contact_id=${r.id}`}
                  className="text-xs text-sky-700 underline-offset-2 hover:underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmailBroadcastForm({
  contacts,
  campaigns,
  canSend,
  recentSends,
}: {
  contacts: ContactRow[];
  campaigns: { id: string; name: string }[];
  canSend: boolean;
  recentSends: {
    id: string;
    to_email: string;
    subject: string;
    status: string;
    created_at: string;
    error: string | null;
  }[];
}) {
  const [state, action, pending] = useActionState(
    sendMarketingEmailCampaign,
    initial,
  );
  useActionToast(state, { successMessage: "Broadcast finished" });
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const withEmail = contacts.filter((c) => c.email?.includes("@"));
  const selectedIds = Object.entries(selected)
    .filter(([, on]) => on)
    .map(([id]) => id);
  const selectedCount = selectedIds.length;

  if (!canSend) {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-4 text-sm">
        <p className="font-medium text-foreground">Email broadcast</p>
        <p className="text-muted-foreground">
          Only owner / GM can send campaigns. PIN sessions act as GM. Front desk
          can maintain contacts; ask an owner to send.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4 rounded-lg border bg-card p-4">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
          One-shot email (max {MARKETING_EMAIL_BATCH_MAX})
        </p>
        <p className="text-xs text-muted-foreground">
          Uses Resend (same as invoice / guest pack). Requires{" "}
          <code className="text-[11px]">RESEND_API_KEY</code>. No drip sequences.
        </p>
        <input type="hidden" name="contact_ids" value={selectedIds.join(",")} />
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted-foreground">Subject</span>
          <Input name="subject" required className="h-10" maxLength={200} />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted-foreground">Body (plain text)</span>
          <textarea
            name="body_text"
            required
            rows={6}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Short seasonal invite…"
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted-foreground">
            Optional HTML fragment (advanced)
          </span>
          <textarea
            name="body_html"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            placeholder="<p>…</p>"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">Link campaign (ROI)</span>
            <select name="campaign_id" className={field} defaultValue="">
              <option value="">—</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">
              Or tag filter (if no boxes)
            </span>
            <Input
              name="tag_filter"
              placeholder="tiktok"
              className="h-10"
            />
          </label>
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
          <p className="mb-2 text-xs text-muted-foreground">
            Select recipients with email ({selectedCount} selected ·{" "}
            {withEmail.length} available)
          </p>
          {withEmail.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add contacts with email on the Contacts tab first.
            </p>
          ) : (
            withEmail.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-secondary/60"
              >
                <input
                  type="checkbox"
                  checked={Boolean(selected[c.id])}
                  onChange={(e) =>
                    setSelected((prev) => ({
                      ...prev,
                      [c.id]: e.target.checked,
                    }))
                  }
                  disabled={
                    !selected[c.id] &&
                    selectedCount >= MARKETING_EMAIL_BATCH_MAX
                  }
                />
                <span className="font-medium">{c.full_name}</span>
                <span className="text-muted-foreground">{c.email}</span>
              </label>
            ))
          )}
        </div>

        <Feedback state={state} />
        <Button type="submit" disabled={pending}>
          {pending
            ? "Sending…"
            : `Send${selectedCount > 0 ? ` (${selectedCount})` : " / tag"} · max ${MARKETING_EMAIL_BATCH_MAX}`}
        </Button>
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Recent sends</h2>
        {recentSends.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sends logged yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">To</th>
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentSends.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 text-muted-foreground">
                      {String(s.created_at).slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-3 py-2">{s.to_email}</td>
                    <td className="px-3 py-2">{s.subject}</td>
                    <td className="px-3 py-2">
                      {s.status}
                      {s.error ? (
                        <span className="ml-1 text-xs text-destructive">
                          {s.error}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
