import { DeskHeader } from "@/components/erp/DeskHeader";
import { deskPinConfigured } from "@/lib/desk-auth";
import type { ReactNode } from "react";

export function DeskListShell({
  title,
  eyebrow,
  heading,
  blurb,
  children,
  filters,
}: {
  title: string;
  eyebrow: string;
  heading: string;
  blurb?: string;
  filters?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title={title} />
      <main className="mx-auto max-w-[1200px] space-y-8 px-6 py-10 md:px-8">
        {!deskPinConfigured() ? (
          <p className="border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-espresso">
            Dev mode: desk PIN not set.
          </p>
        ) : null}
        <header className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.28em] text-gold uppercase">
            {eyebrow}
          </p>
          <h1 className="text-3xl text-espresso">{heading}</h1>
          {blurb ? <p className="max-w-prose text-sm text-muted-foreground">{blurb}</p> : null}
        </header>
        {filters}
        {children}
      </main>
    </div>
  );
}

export function DeskSearchForm({
  action,
  q,
  placeholder,
  children,
}: {
  action: string;
  q?: string;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <form className="flex flex-wrap items-end gap-2" action={action} method="get">
      <label className="block min-w-[200px] flex-1 text-sm text-espresso">
        <span className="sr-only">Search</span>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={placeholder}
          className="w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
      </label>
      {children}
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-sm border border-espresso/20 px-4 text-sm text-espresso hover:border-espresso/40 hover:bg-espresso/[0.03]"
      >
        Search
      </button>
    </form>
  );
}

export function DeskTable({
  caption,
  headers,
  children,
  empty,
}: {
  caption: string;
  headers: string[];
  children: ReactNode;
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-sm border border-espresso/10 bg-white">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-espresso/[0.04] text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty ? (
        <p className="border-t border-espresso/10 px-5 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : null}
    </div>
  );
}

export function StatusPill({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-espresso/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-espresso">
      {value}
    </span>
  );
}
