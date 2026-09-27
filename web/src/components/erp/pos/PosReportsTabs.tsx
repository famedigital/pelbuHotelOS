"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PosReportView } from "@/lib/fnb/pos-reports";
import { useRouter } from "next/navigation";

const VIEWS: { id: PosReportView; label: string }[] = [
  { id: "day", label: "Day sales" },
  { id: "cashier", label: "Cashier" },
  { id: "tenders", label: "Tenders" },
  { id: "hour", label: "Hour" },
  { id: "items", label: "Items" },
];

export function PosReportsTabs({
  view,
  from,
  to,
}: {
  view: PosReportView;
  from: string;
  to: string;
}) {
  const router = useRouter();

  return (
    <Tabs
      value={view}
      onValueChange={(next) => {
        const q = new URLSearchParams({ view: next, from, to });
        router.push(`/erp/pos/reports?${q.toString()}`);
      }}
    >
      <TabsList className="h-auto flex-wrap justify-start">
        {VIEWS.map((row) => (
          <TabsTrigger key={row.id} value={row.id}>
            {row.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
