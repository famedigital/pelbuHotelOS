"use client";

import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";

export function PosSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search menu…"
        className="h-11 pl-9"
        aria-label="Search menu"
      />
    </div>
  );
}
