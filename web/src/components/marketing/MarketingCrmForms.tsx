"use client";

/** Temporary stubs after website purge — restore full CRM forms when briefed. */

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

function Stub({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      {label} UI stub — restore MarketingCrmForms for full desk forms.
    </p>
  );
}

export function ContactForm(_props: {
  contact?: ContactRow | null;
  campaigns: { id: string; name: string }[];
  agents: { id: string; company_name: string }[];
}) {
  return <Stub label="Contact form" />;
}

export function ContactTable(_props: {
  rows: ContactRow[];
  editId?: string;
  q?: string;
}) {
  return <Stub label="Contact table" />;
}

export function ContactSearchForm(_props: { defaultQ?: string }) {
  return <Stub label="Contact search" />;
}

export function EmailBroadcastForm(_props: {
  contacts: ContactRow[];
  campaigns: { id: string; name: string }[];
  canSend: boolean;
  recentSends: unknown[];
}) {
  return <Stub label="Email broadcast" />;
}
