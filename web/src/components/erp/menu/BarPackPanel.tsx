"use client";

import {
  createBeerBarPack,
  createSpiritBarPack,
  receiveBarPack,
  wasteBarStock,
  type BarPackState,
} from "@/app/actions/erp-menu";
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
  DEFAULT_PEK_ML,
  formatPeksPerBottleLabel,
  peksPerBottle,
} from "@/lib/bar-packaging";
import { useActionToast } from "@/hooks/use-action-toast";
import type { PropertyOutlet } from "@/lib/outlets";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const initial: BarPackState = { ok: false };

export type BarInventoryOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  qty_on_hand: number;
  bottle_size_ml?: number | null;
  bottles_per_case?: number | null;
  standard_pour_ml?: number | null;
  bar_kind?: string | null;
};

export function BarPackPanel({
  outlets,
  categories,
  barInventory,
  defaultPourMl = DEFAULT_PEK_ML,
}: {
  outlets: PropertyOutlet[];
  categories: { id: string; name: string }[];
  barInventory: BarInventoryOption[];
  defaultPourMl?: number;
}) {
  const router = useRouter();
  const barOutlets = useMemo(
    () => outlets.filter((o) => o.is_active),
    [outlets],
  );
  const defaultOutlet =
    barOutlets.find((o) => o.code === "bar")?.code ??
    barOutlets[0]?.code ??
    "bar";

  const [spiritState, spiritAction, spiritPending] = useActionState(
    createSpiritBarPack,
    initial,
  );
  const [beerState, beerAction, beerPending] = useActionState(
    createBeerBarPack,
    initial,
  );
  const [recvState, recvAction, recvPending] = useActionState(
    receiveBarPack,
    initial,
  );
  const [wasteState, wasteAction, wastePending] = useActionState(
    wasteBarStock,
    initial,
  );

  useActionToast(spiritState, {
    successMessage: spiritState.message ?? "Spirit pack created",
  });
  useActionToast(beerState, {
    successMessage: beerState.message ?? "Beer pack created",
  });
  useActionToast(recvState, {
    successMessage: recvState.message ?? "Stock received",
  });
  useActionToast(wasteState, {
    successMessage: wasteState.message ?? "Waste recorded",
  });

  useEffect(() => {
    if (
      spiritState.ok ||
      beerState.ok ||
      recvState.ok ||
      wasteState.ok
    ) {
      router.refresh();
    }
  }, [
    spiritState.ok,
    spiritState.message,
    beerState.ok,
    beerState.message,
    recvState.ok,
    recvState.message,
    wasteState.ok,
    wasteState.message,
    router,
  ]);

  const [bottleMl, setBottleMl] = useState("300");
  const [pourMl, setPourMl] = useState(String(defaultPourMl));
  const [spiritOutlet, setSpiritOutlet] = useState(defaultOutlet);
  const [beerOutlet, setBeerOutlet] = useState(defaultOutlet);
  const [wasteUnit, setWasteUnit] = useState("pek");
  const spiritHint = useMemo(() => {
    const b = Number(bottleMl);
    const p = Number(pourMl);
    if (!Number.isFinite(b) || !Number.isFinite(p) || b <= 0 || p <= 0) {
      return null;
    }
    return formatPeksPerBottleLabel(b, p);
  }, [bottleMl, pourMl]);

  const [recvItemId, setRecvItemId] = useState(barInventory[0]?.id ?? "");
  const recvItem =
    barInventory.find((i) => i.id === recvItemId) ?? barInventory[0] ?? null;
  const recvIsSpirit =
    recvItem?.bar_kind === "spirit" ||
    (recvItem?.unit === "ml" && Boolean(recvItem?.bottle_size_ml));
  const recvIsBeer =
    recvItem?.bar_kind === "beer" ||
    (recvItem?.unit === "ea" && Boolean(recvItem?.bottles_per_case));

  const [wasteItemId, setWasteItemId] = useState(barInventory[0]?.id ?? "");
  const wasteItem =
    barInventory.find((i) => i.id === wasteItemId) ?? barInventory[0] ?? null;
  const wasteIsSpirit =
    wasteItem?.bar_kind === "spirit" ||
    (wasteItem?.unit === "ml" && Boolean(wasteItem?.bottle_size_ml));

  useEffect(() => {
    setWasteUnit(wasteIsSpirit ? "pek" : "ea");
  }, [wasteItemId, wasteIsSpirit]);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-card p-4 md:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Spirit pack
        </p>
        <h2 className="mt-1 text-lg font-semibold">Pek + bottle (shared stock)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Example: Old Monk 300&nbsp;ml → system creates{" "}
          <strong>Pek</strong> (30&nbsp;ml) and <strong>Bottle</strong> sell
          rows. Stock is stored in&nbsp;ml so both sizes drain the same bottle.
        </p>
        <form action={spiritAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="spirit-name">Brand name</Label>
            <Input
              id="spirit-name"
              name="name"
              required
              maxLength={60}
              placeholder="Old Monk"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spirit-outlet">Outlet</Label>
            <input type="hidden" name="outlet" value={spiritOutlet} />
            <Select value={spiritOutlet} onValueChange={setSpiritOutlet}>
              <SelectTrigger id="spirit-outlet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {barOutlets.map((o) => (
                  <SelectItem key={o.code} value={o.code}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spirit-cat">Category</Label>
            <Input
              id="spirit-cat"
              name="category"
              required
              maxLength={40}
              list="bar-cat-suggestions"
              defaultValue="Spirits"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spirit-bottle-ml">Bottle size (ml)</Label>
            <Input
              id="spirit-bottle-ml"
              name="bottle_size_ml"
              type="number"
              required
              min={50}
              max={5000}
              step="1"
              value={bottleMl}
              onChange={(e) => setBottleMl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spirit-pour-ml">Pek size (ml)</Label>
            <Input
              id="spirit-pour-ml"
              name="pour_ml"
              type="number"
              required
              min={10}
              max={200}
              step="1"
              value={pourMl}
              onChange={(e) => setPourMl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spirit-price-pek">Price per pek (Nu)</Label>
            <Input
              id="spirit-price-pek"
              name="price_pek"
              type="number"
              required
              min={0}
              step="0.01"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spirit-price-bottle">Price per bottle (Nu)</Label>
            <Input
              id="spirit-price-bottle"
              name="price_bottle"
              type="number"
              required
              min={0}
              step="0.01"
            />
          </div>
          {spiritHint ? (
            <p className="sm:col-span-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm font-medium text-foreground">
              Auto: {spiritHint}
              {Number.isFinite(Number(bottleMl)) &&
              Number.isFinite(Number(pourMl))
                ? ` · ${peksPerBottle(Number(bottleMl), Number(pourMl))} peks saleable per full bottle`
                : null}
            </p>
          ) : null}
          {spiritState.error ? (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{spiritState.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" variant="citrus" disabled={spiritPending}>
              {spiritPending ? "Creating…" : "Create pek + bottle"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border bg-card p-4 md:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Beer / can pack
        </p>
        <h2 className="mt-1 text-lg font-semibold">Case → bottle sell</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Inventory is counted in bottles. Receive by case size (e.g. 24).
        </p>
        <form action={beerAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="beer-name">Brand name</Label>
            <Input id="beer-name" name="name" required maxLength={60} placeholder="Druk 11000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="beer-outlet">Outlet</Label>
            <input type="hidden" name="outlet" value={beerOutlet} />
            <Select value={beerOutlet} onValueChange={setBeerOutlet}>
              <SelectTrigger id="beer-outlet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {barOutlets.map((o) => (
                  <SelectItem key={o.code} value={o.code}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="beer-cat">Category</Label>
            <Input
              id="beer-cat"
              name="category"
              required
              maxLength={40}
              list="bar-cat-suggestions"
              defaultValue="Beer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="beer-case">Bottles per case</Label>
            <Input
              id="beer-case"
              name="bottles_per_case"
              type="number"
              required
              min={1}
              max={500}
              defaultValue={24}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="beer-price">Price per bottle (Nu)</Label>
            <Input
              id="beer-price"
              name="price_bottle"
              type="number"
              required
              min={0}
              step="0.01"
            />
          </div>
          {beerState.error ? (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{beerState.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" variant="outline" disabled={beerPending}>
              {beerPending ? "Creating…" : "Create beer bottle"}
            </Button>
          </div>
        </form>
        <datalist id="bar-cat-suggestions">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
          <option value="Spirits" />
          <option value="Beer" />
          <option value="Wine" />
          <option value="Cocktails" />
        </datalist>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4 md:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Receive
          </p>
          <h2 className="mt-1 text-lg font-semibold">Receive by pack</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Spirits: enter <strong>bottles</strong> (auto × ml). Beer: enter{" "}
            <strong>cases</strong> (auto × bottles/case).
          </p>
          {barInventory.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Create a spirit or beer pack first.
            </p>
          ) : (
            <form action={recvAction} className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Bar stock SKU</Label>
                <input
                  type="hidden"
                  name="inventory_item_id"
                  value={recvItemId || recvItem?.id || ""}
                />
                <Select
                  value={recvItemId || recvItem?.id}
                  onValueChange={setRecvItemId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {barInventory.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} · {i.qty_on_hand} {i.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recv-count">
                  {recvIsSpirit
                    ? "Bottles received"
                    : recvIsBeer
                      ? "Cases received"
                      : "Quantity"}
                </Label>
                <Input
                  id="recv-count"
                  name="pack_count"
                  type="number"
                  required
                  min={0.001}
                  step="1"
                  defaultValue={1}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recv-cost">Unit cost (optional)</Label>
                <Input
                  id="recv-cost"
                  name="unit_cost_btn"
                  type="number"
                  min={0}
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recv-ref">Reference / invoice</Label>
                <Input id="recv-ref" name="reference" maxLength={80} />
              </div>
              {recvState.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{recvState.error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={recvPending} className="w-full">
                {recvPending ? "Receiving…" : "Receive stock"}
              </Button>
            </form>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4 md:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Waste / spill
          </p>
          <h2 className="mt-1 text-lg font-semibold">Write off stock</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Record broken pours, free samples, or spillage without a sale.
          </p>
          {barInventory.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No bar inventory yet.
            </p>
          ) : (
            <form action={wasteAction} className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Bar stock SKU</Label>
                <input
                  type="hidden"
                  name="inventory_item_id"
                  value={wasteItemId || wasteItem?.id || ""}
                />
                <Select
                  value={wasteItemId || wasteItem?.id}
                  onValueChange={setWasteItemId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {barInventory.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} · {i.qty_on_hand} {i.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="waste-unit">Unit</Label>
                  <input type="hidden" name="waste_unit" value={wasteUnit} />
                  <Select value={wasteUnit} onValueChange={setWasteUnit}>
                    <SelectTrigger id="waste-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {wasteIsSpirit ? (
                        <>
                          <SelectItem value="pek">Pek(s)</SelectItem>
                          <SelectItem value="bottle">Bottle(s)</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="ea">Bottle / unit</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="waste-amount">Amount</Label>
                  <Input
                    id="waste-amount"
                    name="amount"
                    type="number"
                    required
                    min={0.001}
                    step="1"
                    defaultValue={1}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="waste-reason">Reason</Label>
                <Input
                  id="waste-reason"
                  name="reason"
                  required
                  maxLength={200}
                  placeholder="Spill · free tasting · breakage"
                />
              </div>
              {wasteState.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{wasteState.error}</AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="submit"
                variant="outline"
                disabled={wastePending}
                className="w-full"
              >
                {wastePending ? "Recording…" : "Record waste"}
              </Button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
