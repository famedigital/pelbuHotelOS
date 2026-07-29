"use client";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-10 items-center rounded-sm bg-gold px-4 text-sm font-medium text-espresso print:hidden"
    >
      {label}
    </button>
  );
}
