"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

type Props = {
  title: string;
  body: string;
  category?: string;
  priority?: string;
};

/** Copy notice text for pasting into the staff WhatsApp group — no API. */
export function CopyForWhatsAppButton({
  title,
  body,
  category,
  priority,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = [
    `*${title.trim()}*`,
    category ? `_${category}_` : null,
    priority && priority !== "normal" ? `Priority: ${priority}` : null,
    "",
    body.trim(),
    "",
    "— Pelbu Suites · desk bulletin",
  ]
    .filter(Boolean)
    .join("\n");

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy — select text manually.");
    }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? "Copied!" : "Copy for WhatsApp"}
      </Button>
      <a
        href={waHref}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted"
      >
        Open WhatsApp
      </a>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
