"use client";

import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";
import { useRef } from "react";

/**
 * Menu search + keyboard-wedge barcode entry.
 * Wedge scanners typically end with Enter; digits-only buffers resolve as PLU.
 */
export function PosSearch({
  value,
  onChange,
  onBarcode,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Called when Enter on a barcode-like string (digits / GTIN). */
  onBarcode?: (code: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !onBarcode) return;
          const raw = value.trim();
          if (!raw) return;
          // Typical UPC/EAN/PLU: 4–18 chars, mostly digits (allow leading zeros).
          const looksBarcode =
            raw.length >= 4 &&
            raw.length <= 18 &&
            /^[0-9]+$/.test(raw);
          if (!looksBarcode) return;
          e.preventDefault();
          onBarcode(raw);
          onChange("");
        }}
        placeholder="Search menu or scan barcode…"
        className="h-10 pl-9"
        aria-label="Search menu or scan barcode"
        autoComplete="off"
      />
    </div>
  );
}
