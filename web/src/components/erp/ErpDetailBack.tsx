import Link from "next/link";

/** Consistent back link on ERP detail pages. */
export function ErpDetailBack({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
    >
      ← {label}
    </Link>
  );
}
