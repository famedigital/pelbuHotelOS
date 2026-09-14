"use client";

import { absoluteUrl } from "@/lib/site";
import type { LaundryBag } from "@/lib/laundry";

export type PrintableBagLabel = {
  id: string;
  bagSeq: number;
  bagCount: number;
  publicCode: string;
  scanPath: string;
  qrDataUrl: string;
  roomLabel: string;
  orderRef: string;
  garmentCount: number;
  createdAt: string;
  notes?: string | null;
};

export function LaundryBagLabel({ label }: { label: PrintableBagLabel }) {
  return (
    <article className="break-inside-avoid rounded-2xl border border-neutral-300 bg-white p-4 text-neutral-950 shadow-sm print:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700">
            Pelbu Suites · Laundry
          </p>
          <h2 className="mt-1 text-xl font-bold">Room {label.roomLabel}</h2>
          <p className="mt-1 text-sm font-semibold">
            Bag {label.bagSeq} of {label.bagCount}
          </p>
          <p className="mt-2 font-mono text-xs font-semibold tracking-wide">
            {label.publicCode}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Order {label.orderRef} · {label.garmentCount} piece
            {label.garmentCount === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-[10px] text-neutral-500">
            {new Date(label.createdAt).toLocaleString()}
          </p>
          {label.notes ? (
            <p className="mt-2 line-clamp-2 text-xs text-neutral-700">
              {label.notes}
            </p>
          ) : null}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={label.qrDataUrl}
          alt={`Scan code for laundry bag ${label.publicCode}`}
          className="size-28 shrink-0"
        />
      </div>
      <p className="mt-3 border-t border-dashed border-neutral-300 pt-2 text-[10px] text-neutral-600">
        Staff scan only · guest name, contents, and charges are behind login
      </p>
      <p className="mt-1 break-all font-mono text-[8px] text-neutral-400">
        {absoluteUrl(label.scanPath)}
      </p>
    </article>
  );
}

export function bagsToLabelMeta(
  bags: LaundryBag[],
  meta: { roomLabel: string; orderId: string },
): Omit<PrintableBagLabel, "qrDataUrl" | "scanPath">[] {
  return bags.map((bag) => ({
    id: bag.id,
    bagSeq: bag.bag_seq,
    bagCount: bags.length,
    publicCode: bag.public_code,
    roomLabel: meta.roomLabel,
    orderRef: meta.orderId.slice(0, 8).toUpperCase(),
    garmentCount: bag.garment_count,
    createdAt: bag.created_at,
    notes: bag.notes,
  }));
}
