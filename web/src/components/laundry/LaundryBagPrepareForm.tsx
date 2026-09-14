"use client";

import {
  prepareLaundryBags,
  type LaundryBagState,
} from "@/app/actions/laundry-bags";
import { prepareDeskLaundryBags } from "@/app/actions/erp-laundry";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  laundryItemCap,
  type LaundryBag,
  type LaundryOrderItem,
} from "@/lib/laundry";
import { MinusIcon, PlusIcon, PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

const initial: LaundryBagState = { ok: false };

type BagDraft = {
  key: string;
  items: Record<string, number>;
};

export function LaundryBagPrepareForm({
  orderId,
  items,
  existingBags,
  mode,
  staffOptions,
}: {
  orderId: string;
  items: LaundryOrderItem[];
  existingBags: LaundryBag[];
  mode: "staff" | "desk";
  staffOptions?: { id: string; name: string }[];
}) {
  const action = mode === "desk" ? prepareDeskLaundryBags : prepareLaundryBags;
  const [state, formAction, pending] = useActionState(action, initial);
  const [staffId, setStaffId] = useState(staffOptions?.[0]?.id ?? "");
  const [bags, setBags] = useState<BagDraft[]>(() =>
    existingBags.length
      ? existingBags.map((bag) => ({
          key: bag.id,
          items: Object.fromEntries(
            bag.laundry_bag_items.map((item) => [
              item.order_item_id,
              item.qty,
            ]),
          ),
        }))
      : [
          {
            key: crypto.randomUUID(),
            items: Object.fromEntries(
              items.map((item) => [item.id, laundryItemCap(item)]),
            ),
          },
        ],
  );

  const payload = useMemo(
    () =>
      bags.map((bag) => ({
        items: Object.entries(bag.items)
          .filter(([, qty]) => qty > 0)
          .map(([orderItemId, qty]) => ({ orderItemId, qty })),
      })),
    [bags],
  );

  function addBag() {
    setBags((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        items: Object.fromEntries(items.map((item) => [item.id, 0])),
      },
    ]);
  }

  function removeBag(key: string) {
    setBags((current) =>
      current.length <= 1 ? current : current.filter((bag) => bag.key !== key),
    );
  }

  function step(bagKey: string, itemId: string, delta: number) {
    setBags((current) =>
      current.map((bag) => {
        if (bag.key !== bagKey) return bag;
        const cap = laundryItemCap(
          items.find((item) => item.id === itemId) ?? {
            confirmed_qty: null,
            requested_qty: 0,
          },
        );
        return {
          ...bag,
          items: {
            ...bag.items,
            [itemId]: Math.max(0, Math.min(cap, (bag.items[itemId] ?? 0) + delta)),
          },
        };
      }),
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-secondary/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Prepare bags</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Split garments across one or more bags, then print Amazon-style
            stickers. Guest name and money stay off the paper label.
          </p>
        </div>
        {existingBags.length ? (
          <Button asChild size="sm" variant="outline">
            <Link
              href={
                mode === "desk"
                  ? `/erp/laundry/orders/${orderId}/labels`
                  : `/staff/laundry/orders/${orderId}/labels`
              }
            >
              <PrinterIcon className="size-3.5" />
              Labels
            </Link>
          </Button>
        ) : null}
      </div>

      {existingBags.length ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {existingBags.map((bag) => (
            <li key={bag.id}>
              Bag {bag.bag_seq} · {bag.public_code} · {bag.garment_count} pcs
            </li>
          ))}
        </ul>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="bags" value={JSON.stringify(payload)} />
        <input type="hidden" name="require_full" value="1" />
        {mode === "desk" ? (
          <>
            <input type="hidden" name="staff_id" value={staffId} />
            <div className="space-y-1.5">
              <Label>Prepared by</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {(staffOptions ?? []).map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}

        {bags.map((bag, index) => (
          <div key={bag.key} className="space-y-2 rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Bag {index + 1}</p>
              {bags.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeBag(bag.key)}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            {items.map((item) => {
              const qty = bag.items[item.id] ?? 0;
              const cap = laundryItemCap(item);
              return (
                <div
                  key={item.id}
                  className="flex min-h-12 items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.name_snapshot}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Cap {cap}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-9"
                      onClick={() => step(bag.key, item.id, -1)}
                    >
                      <MinusIcon className="size-3.5" />
                    </Button>
                    <Input
                      className="h-9 w-12 text-center"
                      value={qty}
                      readOnly
                      aria-label={`${item.name_snapshot} in bag ${index + 1}`}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-9"
                      onClick={() => step(bag.key, item.id, 1)}
                    >
                      <PlusIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <Button type="button" variant="outline" className="w-full" onClick={addBag}>
          <PlusIcon className="size-4" />
          Add another bag
        </Button>

        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.ok ? (
          <Alert>
            <AlertDescription>
              {state.message}{" "}
              <Link
                className="font-semibold underline"
                href={
                  mode === "desk"
                    ? `/erp/laundry/orders/${orderId}/labels`
                    : `/staff/laundry/orders/${orderId}/labels`
                }
              >
                Print labels
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="submit"
          variant="citrus"
          className="min-h-11 w-full"
          disabled={
            pending ||
            payload.every((bag) => bag.items.length === 0) ||
            (mode === "desk" && !staffId)
          }
        >
          {pending
            ? "Saving…"
            : existingBags.length
              ? "Replace bags & save"
              : "Save bags"}
        </Button>
      </form>
    </div>
  );
}
