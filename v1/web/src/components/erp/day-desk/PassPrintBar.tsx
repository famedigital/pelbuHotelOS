"use client";

export function PassPrintBar({ whatsapp }: { whatsapp: string }) {
  return (
    <p className="mt-6 text-sm print:hidden">
      <a href={whatsapp}>Open WhatsApp</a>
      {" · "}
      <button type="button" onClick={() => window.print()}>
        Print
      </button>
    </p>
  );
}
