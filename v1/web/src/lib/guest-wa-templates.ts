/**
 * Guest WhatsApp message templates (desk opens wa.me — not a CRM).
 * CallMeBot auto-send only when guest number is pre-approved.
 */

export type GuestWaKind = "confirmation" | "due_reminder" | "thank_you";

export function guestWaTemplate(opts: {
  kind: GuestWaKind;
  guestName: string;
  confLabel?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  dueBtn?: number | null;
  propertyName?: string | null;
}): { title: string; body: string } {
  const hotel = opts.propertyName?.trim() || "Hotel";
  const name = opts.guestName.trim() || "Guest";
  const conf = opts.confLabel?.trim() || "";
  const stay =
    opts.checkIn && opts.checkOut
      ? `${opts.checkIn} → ${opts.checkOut}`
      : opts.checkIn
        ? opts.checkIn
        : "";

  if (opts.kind === "confirmation") {
    return {
      title: "Stay confirmed",
      body: [
        `Kuzuzangpo ${name},`,
        "",
        `Your stay at ${hotel} is confirmed${conf ? ` · ${conf}` : ""}.`,
        stay ? `Dates: ${stay}` : null,
        "",
        "We look forward to welcoming you. Reply here if you need anything.",
        `— ${hotel}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (opts.kind === "due_reminder") {
    const due =
      opts.dueBtn != null && Number.isFinite(opts.dueBtn)
        ? `Nu ${Math.round(opts.dueBtn)}`
        : "your balance";
    return {
      title: "Folio due",
      body: [
        `Kuzuzangpo ${name},`,
        "",
        `Friendly note from ${hotel}: ${due} is open on your folio.`,
        conf ? `Stay ${conf}` : null,
        "Settle at the desk when convenient — or reply here.",
        `— ${hotel}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  return {
    title: "Thank you",
    body: [
      `Kuzuzangpo ${name},`,
      "",
      `Thank you for staying at ${hotel}. Safe travels — we hope to welcome you again.`,
      conf ? `Ref ${conf}` : null,
      `— ${hotel}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function guestWaMeHref(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? "").replace(/\D+/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
