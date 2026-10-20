"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** This stay tab — search then jump to Ctrl+K desk search / reservations. */
export function BillsStaySearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      className="flex max-w-xl flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        if (!query) return;
        router.push(`/erp/reservations?q=${encodeURIComponent(query)}`);
      }}
    >
      <p className="text-sm text-muted-foreground">
        Search by guest name, PS confirmation, room, or phone — then open the
        stay and use <span className="font-medium text-foreground">Bill</span>{" "}
        on the folio.
      </p>
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="PS-2026-00042 or guest name"
          className="h-11"
          autoFocus
        />
        <Button type="submit" className="h-11 shrink-0">
          Find stay
        </Button>
      </div>
    </form>
  );
}
